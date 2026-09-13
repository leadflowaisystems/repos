'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import { setPermanentCredentials } from '@/lib/auth/supabase-admin';
import {
  completeAccountSetup,
  disableTempAccess,
  generateTempAccess,
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
 * TEMPORARY_ACTIVE" check happens inside `completeAccountSetup` itself.
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

  const result = await completeAccountSetup(prisma, actor.userId, clientId, {
    name: str(form, 'name'),
    phone: str(form, 'phone'),
    email: str(form, 'email'),
    password,
    confirmPassword,
  });
  if (!result.ok) return failure(result.message, result.errors);

  // ORDER MATTERS, same rule updatePasswordAction already follows: the
  // reversible writes (contact fields, AccountAccess status, the session
  // bump) have already committed inside completeAccountSetup. Supabase owns
  // the identity and cannot join that transaction, so it moves last — if
  // this fails, the account is still fully set up except for the one field,
  // and the person can simply try setting the password again.
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
    return failure('Your details were saved, but the password could not be set. Try again.');
  }
  const credentials = await setPermanentCredentials(
    user.authProviderId,
    password,
    result.data.email ?? undefined,
  );
  if (!credentials.ok) {
    return failure('Your details were saved, but the password could not be set. Try again.');
  }

  redirect('/login');
}
