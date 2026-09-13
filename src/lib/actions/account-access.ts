'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import { setPermanentCredentials } from '@/lib/auth/supabase-admin';
import {
  disableTempAccess,
  finalizeAccountSetup,
  generateTempAccess,
  validateAccountSetup,
} from '@/lib/account-access/service';
import { failure, str, success, type ActionState } from './shared';

/**
 * Account-access actions (M39).
 *
 * Generating and disabling are admin-only, exactly like every other
 * whole-installation action in this file's neighbours. Completing setup is
 * OWNER-level like `setMembershipAction`: by the time it is reachable the
 * actor already holds a real, ACTIVE BUSINESS_OWNER membership on this
 * client (created eagerly by `generateTempAccess`), and the finer-grained
 * "is this actually the bound temporary-access user, and is it still
 * TEMPORARY_ACTIVE" check happens inside `validateAccountSetup` itself.
 */

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
}

export async function generateTempAccessAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

  const result = await generateTempAccess(prisma, clientId, gate.actor.userId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateClient(clientId);
  return {
    ok: true,
    message: 'Temporary access created. Copy these credentials now — the password will not be shown again.',
    errors: {},
    // clientId rides along so the panel can tell "just generated for THIS
    // client" apart from stale state left over from a different one — see
    // AccountAccessPanel, which never remounts on an in-app navigation
    // between two clients' Profile tabs.
    data: { clientId, loginId: result.data.loginId, password: result.data.password },
  };
}

export async function disableTempAccessAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

  const result = await disableTempAccess(prisma, clientId, gate.actor.userId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateClient(clientId);
  return success('Temporary access disabled. The permanent account is unaffected.');
}

export async function completeAccountSetupAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // allowLocked: finishing the identity you sign in with is not a
  // commercial action and must not depend on the trial/billing state.
  const gate = await tenantGate(form, 'OWNER', 'clientId', { allowLocked: true });
  if (!gate.ok) return gate.state;
  const { clientId, actor } = gate;

  const password = str(form, 'password');
  const confirmPassword = str(form, 'confirmPassword');

  const validated = await validateAccountSetup(prisma, actor.userId, clientId, {
    name: str(form, 'name'),
    phone: str(form, 'phone'),
    email: str(form, 'email'),
    password,
    confirmPassword,
  });
  if (!validated.ok) return failure(validated.message, validated.errors);

  // ORDER MATTERS — the other way round from how this used to run. Supabase
  // owns the identity and cannot join a Prisma transaction, so it goes
  // FIRST, before anything in RepOS's own database moves: nothing has been
  // written yet at this point, so a rejection here is simply reported and
  // this form can be tried again exactly as it stands. Committing
  // AccountAccess = SETUP_COMPLETE ahead of Supabase's own answer was the
  // earlier bug — it let the database say setup had finished while the
  // temporary password was still the only one that worked.
  //
  // The admin module, not the signed-in session's own client: this is the
  // one call that also sets the LOGIN EMAIL (when one was given), and
  // finishing that with no confirmation link needs the service-role path —
  // see setPermanentCredentials for why that is safe here specifically.
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { authProviderId: true },
  });
  if (!user?.authProviderId) {
    return failure('Something is wrong with this account. Contact support before trying again.');
  }
  const credentials = await setPermanentCredentials(
    user.authProviderId,
    password,
    validated.data.email ?? undefined,
  );
  if (!credentials.ok) {
    // Nothing has been written — this is not a partial success, and the
    // form can be resubmitted as-is (setPermanentCredentials already logged
    // the real Supabase reason server-side).
    return failure('Your password could not be set. Nothing was changed — try again.');
  }

  await finalizeAccountSetup(prisma, actor.userId, validated.data);

  redirect('/login');
}
