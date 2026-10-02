'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentAuthIdentity, prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import { detachedAuthClient, supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import {
  createOwnerIdentity,
  deleteIdentity,
  deleteUnconfirmedIdentity,
  getIdentitySnapshot,
  setIdentityPassword,
} from '@/lib/auth/supabase-admin';
import { authRedirectUrl, emailConfirmCallback } from '@/lib/auth/redirect';
import {
  disableTempAccess,
  finalizeAccountSetup,
  generateTempAccess,
  newPasswordSchema,
  validateAccountSetup,
} from '@/lib/account-access/service';
import { failure, str, success, type ActionState } from './shared';

/**
 * Account-access actions (M39; two logins since M52).
 *
 * Generating, enabling and disabling the TEMPORARY login are admin-only.
 * Setting up the owner's OWN login is done from the temporary login, by the
 * business's owner (OWNER gate, plus `validateAccountSetup`'s check that the
 * request really comes from this business's temporary login). Changing a
 * password is any member's own business, from their own login.
 *
 * Every password here goes straight to Supabase and is forgotten. None is
 * stored, logged, or sent back to the browser, except the one temporary
 * password the admin must read off the screen once.
 */

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/profile`);
}

function accountPath(clientId: string): string {
  return `/workspace/${clientId}/account`;
}

// ---------------------------------------------------------------------------
// The admin's side
// ---------------------------------------------------------------------------

/** Generates temporary access, or switches it back on with a new password. */
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
  const signInUrl = (await authRedirectUrl('/login')) ?? '';
  return {
    ok: true,
    message: 'Temporary access is on. Copy the password now — it will not be shown again.',
    errors: {},
    // clientId rides along so the panel can tell "just generated for THIS
    // client" apart from stale state left over from a different one — the
    // panel does not remount on an in-app move between two clients' pages.
    data: { clientId, email: result.data.email, password: result.data.password, signInUrl },
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
  return success('Temporary access disabled. The temporary email and password no longer work.');
}

// ---------------------------------------------------------------------------
// Setting up the owner's own login — signed in with temporary access
// ---------------------------------------------------------------------------

/**
 * THE OWNER'S OWN LOGIN, AND THE ONE EMAIL IN THE HANDOVER.
 *
 *   1. Supabase creates the owner's own login — their real email and their
 *      own password — NOT confirmed. Nothing can sign in with it yet.
 *   2. RepOS records it on the owner's User (one transaction).
 *   3. The owner's own session asks Supabase to send the confirmation link to
 *      that address — the one email. Opening it is what makes the login work:
 *      a mistyped or somebody else's address never becomes a login or a
 *      password-reset address.
 *
 * The temporary login is not touched: it keeps working until an admin
 * disables it, so the owner is never stranded between the two. Filling setup
 * in again before the link is opened (a typo, a lost email) replaces the
 * unconfirmed login with a new one.
 */
export async function completeAccountSetupAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // allowLocked: finishing the identity you sign in with is not a
  // commercial action and must not depend on the trial/billing state.
  const gate = await tenantGate(form, 'OWNER', 'clientId', { allowLocked: true });
  if (!gate.ok) return gate.state;
  const { clientId, actor } = gate;

  // Typed values come back so a refusal does not empty the form. Never the
  // passwords.
  const values = { name: str(form, 'name'), phone: str(form, 'phone'), email: str(form, 'email') };
  const refuse = (message: string, errors: Record<string, string> = {}): ActionState => ({
    ...failure(message, errors),
    data: values,
  });

  if (!supabaseConfig().ok) return refuse('Account setup is unavailable right now. Please contact Headway.');
  const session = await currentAuthIdentity();
  if (!session) return refuse('Please sign in again, then finish setting up your account.');

  const password = str(form, 'password');
  const validated = await validateAccountSetup(prisma, actor.userId, clientId, session.id, {
    ...values,
    password,
    confirmPassword: str(form, 'confirmPassword'),
  });
  if (!validated.ok) return refuse(validated.message, validated.errors);

  // Redoing setup is only for a login nobody has confirmed yet.
  const previous = validated.data.previousOwnAuthId;
  if (previous) {
    const snapshot = await getIdentitySnapshot(previous);
    if (!snapshot || snapshot.confirmed) {
      return refuse('Your own sign-in is already set up. Sign in with your email and password.');
    }
  }

  // 1. The owner's own login, unconfirmed. No email yet.
  const created = await createOwnerIdentity(validated.data.email, password);
  if (!created.ok) {
    if (created.reason === 'EMAIL_TAKEN') {
      return refuse('Some fields need attention.', { email: 'That email is already in use by another account.' });
    }
    if (created.reason === 'WEAK_PASSWORD') {
      return refuse('Some fields need attention.', {
        password: created.message || 'Choose a longer, less predictable password.',
      });
    }
    return refuse('Account setup is unavailable right now. Nothing was changed — try again, or contact Headway.');
  }

  // 2. RepOS's record. If it cannot be written, the new login goes again, so
  // nothing half-made is left behind.
  let committed = false;
  try {
    committed = await finalizeAccountSetup(prisma, actor.userId, session.id, validated.data, created.authUserId);
  } catch (error) {
    await deleteIdentity(created.authUserId);
    const taken = String(error).includes('Unique constraint') || String(error).includes('23505');
    console.error('completeAccountSetupAction: could not record the owner login', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
    if (taken) {
      return refuse('Some fields need attention.', { email: 'That email is already in use by another account.' });
    }
    return refuse('Your account could not be set up. Nothing was changed — try again.');
  }
  if (!committed) {
    await deleteIdentity(created.authUserId);
    return refuse('This temporary access was turned off by Headway. Please contact Headway.');
  }
  if (previous) await deleteUnconfirmedIdentity(previous);

  // 3. The confirmation email, through the owner's own session. Supabase finds
  // the unconfirmed login just made and sends its link; it changes nothing else.
  const outcome = await sendConfirmationLink(clientId, validated.data.email, password, created.authUserId);

  revalidatePath(accountPath(clientId));
  revalidateClient(clientId);
  redirect(`${accountPath(clientId)}?setup=${outcome}`);
}

/** How asking for the confirmation email went, in words the page can use. */
type EmailOutcome = 'sent' | 'wait' | 'failed';

async function sendConfirmationLink(
  clientId: string,
  email: string,
  password: string,
  expectedAuthId: string,
): Promise<EmailOutcome> {
  const supabase = await supabaseServerClient();
  const redirectTo = await authRedirectUrl(
    emailConfirmCallback(`${accountPath(clientId)}?email=confirmed`),
  );
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });
  if (!error && data.user?.id === expectedAuthId) return 'sent';
  console.error('Confirmation email could not be sent', {
    clientId,
    code: error?.code,
    status: error?.status,
    message: error?.message,
    sameLogin: data?.user?.id === expectedAuthId,
  });
  if (error?.code === 'over_email_send_rate_limit' || error?.status === 429) return 'wait';
  return 'failed';
}

// ---------------------------------------------------------------------------
// Changing the password — any member, from their own login
// ---------------------------------------------------------------------------

export async function changePasswordAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER', 'clientId', { allowLocked: true });
  if (!gate.ok) return gate.state;

  // A temporary login has no password of anyone's own to change: the owner
  // changes theirs signed in with their own email.
  if (gate.actor.temporaryAccessClientId) {
    return failure('You are signed in with temporary access. Sign in with your own email to change your password.');
  }

  const current = str(form, 'currentPassword');
  const password = str(form, 'password');
  if (current.length === 0) {
    return failure('Some fields need attention.', { currentPassword: 'Enter your current password.' });
  }
  const parsed = newPasswordSchema.safeParse(password);
  if (!parsed.success) return failure('Some fields need attention.', { password: parsed.error.issues[0]!.message });
  if (password !== str(form, 'confirmPassword')) {
    return failure('Some fields need attention.', { confirmPassword: 'These two passwords do not match.' });
  }
  if (password === current) {
    return failure('Some fields need attention.', { password: 'Choose a new password, different from your current one.' });
  }

  const identity = await currentAuthIdentity();
  if (!identity?.email) return failure('Please sign in again.');

  // The current password is checked on a client that cannot touch this
  // browser's session, then that check's own session is ended at once.
  const detached = detachedAuthClient();
  const check = await detached.auth.signInWithPassword({ email: identity.email, password: current });
  if (check.data.session) await detached.auth.signOut({ scope: 'local' }).catch(() => undefined);
  if (check.error || check.data.user?.id !== identity.id) {
    if (check.error?.status === 429) return failure('Too many attempts. Wait a minute and try again.');
    return failure('Some fields need attention.', { currentPassword: 'That is not your current password.' });
  }

  // The person's own session: Supabase keeps it and ends every other one.
  const supabase = await supabaseServerClient();
  // The current password rides along, so a project that insists on it
  // ("Require current password") accepts the change too; one that does not
  // simply ignores it.
  const { error } = await supabase.auth.updateUser({ password, current_password: current });
  if (error?.code === 'reauthentication_needed') {
    // A session older than a day, on a project that asks for a fresh sign-in
    // before a password change. The current password was just proved, so the
    // admin path sets it instead, and this browser signs straight back in.
    const set = await setIdentityPassword(identity.id, password);
    if (!set.ok) {
      if (set.reason === 'WEAK_PASSWORD') return failure('Some fields need attention.', { password: set.message });
      return failure('Your password could not be changed. Nothing was changed — try again.');
    }
    // That also ended this browser's session; sign it straight back in, and
    // say so plainly if that did not work.
    const again = await supabase.auth.signInWithPassword({ email: identity.email, password });
    if (again.error) {
      return success('Your password has been changed. Please sign in again with your new password.');
    }
  } else if (error) {
    console.error('changePasswordAction: password not accepted', { code: error.code, status: error.status, message: error.message });
    if (error.code === 'weak_password') {
      return failure('Some fields need attention.', { password: error.message || 'Choose a longer, less predictable password.' });
    }
    return failure('Your password could not be changed. Nothing was changed — try again.');
  }

  return success('Your password has been changed. Any other devices you were signed in on have been signed out.');
}
