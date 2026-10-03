'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentAuthIdentity, prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import { detachedAuthClient, supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import { setIdentityPassword } from '@/lib/auth/supabase-admin';
import { authRedirectUrl, callbackFor } from '@/lib/auth/redirect';
import {
  disableTempAccess,
  generateTempAccess,
  newPasswordSchema,
  passwordLinkTarget,
  setOwnerEmail,
} from '@/lib/account-access/service';
import { failure, str, success, type ActionState } from './shared';

/**
 * Account-access actions (M39; two logins since M52; owner's email recorded
 * by Headway since M53).
 *
 * Generating, enabling and disabling the TEMPORARY login, and recording the
 * owner's email (which makes their own login, pending), are admin-only. From
 * the temporary login, the business's owner can only ask for the link that
 * lets them prove that address and choose their password (OWNER gate, plus
 * `passwordLinkTarget`'s check that the request really comes from this
 * business's temporary login). Changing a password is any member's own
 * business, from their own login.
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

  const ownerEmail = str(form, 'ownerEmail');
  const result = await generateTempAccess(prisma, clientId, gate.actor.userId, { ownerEmail });
  // The typed address comes back so a refusal does not empty the field.
  if (!result.ok) return { ...failure(result.message, result.errors), data: { ownerEmail } };

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

/**
 * The owner's email: added where there is none yet, or corrected while the
 * owner has not proved it. Their pending own login moves to the new address
 * and every link sent to the old one stops working (see `setOwnerEmail`).
 */
export async function setOwnerEmailAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

  const ownerEmail = str(form, 'ownerEmail');
  const result = await setOwnerEmail(prisma, clientId, ownerEmail);
  if (!result.ok) return { ...failure(result.message, result.errors), data: { ownerEmail } };

  revalidateClient(clientId);
  return success(
    result.data.changed
      ? `Saved. The owner's own sign-in is now ${result.data.email}. Links sent to any earlier address no longer work.`
      : `${result.data.email} is already the owner's email.`,
  );
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
// The owner's own login — the one link, asked for with temporary access
// ---------------------------------------------------------------------------

/**
 * THE ONE EMAIL IN THE HANDOVER (M53).
 *
 * Signed in with the temporary login, the owner presses one button on
 * Account and Supabase emails a link to the address Headway recorded for
 * them — where their own login has waited, unconfirmed and with no password
 * anybody knows, since Headway generated the temporary access. Opening it
 * proves the address (and confirms the login) and lets them choose their
 * password. It is the ordinary password-reset email, so a lost, late or
 * expired one is replaced the ordinary way too: this button again, or
 * "Forgot password?" on the sign-in page, which needs no temporary login.
 *
 * Whoever holds the handover sheet can press it as well; it still goes only
 * to the owner's inbox. This action makes and changes nothing — no login, no
 * password, no RepOS row — it only asks Supabase to send that email.
 */
export async function requestOwnerPasswordLinkAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // allowLocked: finishing the identity you sign in with is not a
  // commercial action and must not depend on the trial/billing state.
  const gate = await tenantGate(form, 'OWNER', 'clientId', { allowLocked: true });
  if (!gate.ok) return gate.state;
  const { clientId, actor } = gate;

  if (!supabaseConfig().ok) return failure('This is unavailable right now. Please contact Headway.');
  const session = await currentAuthIdentity();
  if (!session) return failure('Please sign in again, then try once more.');

  const target = await passwordLinkTarget(prisma, clientId, actor.userId, session.id);
  if (!target.ok) {
    if (target.reason === 'NOT_TEMPORARY') {
      return failure('Sign in with the temporary email and password Headway gave you to do this.');
    }
    if (target.reason === 'NO_OWN_LOGIN') {
      return failure('Headway has not added your email address yet. Please contact Headway.');
    }
    return failure('We could not check your sign-in just now. Try again in a minute.');
  }

  const supabase = await supabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(target.email, {
    redirectTo: await authRedirectUrl(callbackFor('/reset-password')),
  });
  let outcome: 'sent' | 'wait' | 'failed' = 'sent';
  if (error) {
    // Message, code and status only — never the address.
    console.error('requestOwnerPasswordLinkAction: Supabase did not send the link', {
      clientId,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    outcome = error.code === 'over_email_send_rate_limit' || error.status === 429 ? 'wait' : 'failed';
  }

  revalidatePath(accountPath(clientId));
  redirect(`${accountPath(clientId)}?link=${outcome}`);
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
