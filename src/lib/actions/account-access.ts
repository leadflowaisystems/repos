'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentAuthIdentity, prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import { detachedAuthClient, supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import { setIdentityPassword } from '@/lib/auth/supabase-admin';
import { authRedirectUrl, emailConfirmCallback } from '@/lib/auth/redirect';
import {
  disableTempAccess,
  finalizeAccountSetup,
  generateTempAccess,
  newPasswordSchema,
  ownerEmailSchema,
  validateAccountSetup,
} from '@/lib/account-access/service';
import { isTemporaryEmail } from '@/lib/account-access/state';
import { failure, str, success, type ActionState } from './shared';

/**
 * Account-access actions (M39, M52).
 *
 * Generating and disabling are admin-only. Completing setup is OWNER-level:
 * by the time it is reachable the actor already holds the real, ACTIVE
 * BUSINESS_OWNER membership `generateTempAccess` created, and the finer check
 * — is this the bound temporary login, still TEMPORARY_ACTIVE — happens in
 * `validateAccountSetup`. Changing a password is any member's own business.
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
    message: 'Temporary access is ready. Copy the password now — it will not be shown again.',
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
// Asking Supabase to confirm the owner's real address
// ---------------------------------------------------------------------------

/** How a request to move the sign-in email went, in words the page can use. */
type EmailOutcome = 'sent' | 'taken' | 'wait' | 'failed';

/**
 * THE ONE EMAIL IN THE HANDOVER.
 *
 * Asked for by the owner's OWN session, so Supabase does what it does for any
 * email change on this project: it sends one link to the new address, and the
 * sign-in email changes only when that link is opened. Nothing is trusted
 * before then — a mistyped address never becomes the address a password can be
 * reset through. (The admin API could set the address with no email at all,
 * which is exactly why it is not used here.)
 *
 * Needs "Secure email change" OFF in Supabase: with it on, Supabase also
 * mails the CURRENT address — for a temporary login, the synthetic one — and
 * the change can never finish. Depending on the mail provider that shows up
 * either here, as a refused send (logged with a hint naming the setting), or
 * later, as a link that confirms only "one of two" (the auth callback logs it
 * and tells the owner plainly).
 */
async function askSupabaseToConfirm(
  supabase: SupabaseClient,
  email: string,
  clientId: string,
): Promise<EmailOutcome> {
  const redirectTo = await authRedirectUrl(emailConfirmCallback(`${accountPath(clientId)}?email=confirmed`));
  const { error } = await supabase.auth.updateUser(
    { email },
    redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  );
  if (!error) return 'sent';

  console.error('Email change could not be started', {
    clientId,
    code: error.code,
    status: error.status,
    message: error.message,
    // Supabase's own wording for a failed send is generic ("Error sending
    // email change email"), so the likeliest cause is named here by shape.
    hint:
      /access\.headway\.local/.test(error.message) || (error.status ?? 0) >= 500
        ? 'If "Secure email change" is ON in Supabase (Authentication > Sign In / Providers > Email), it also emails the temporary address and the change fails: turn it OFF.'
        : undefined,
  });
  if (error.code === 'email_exists') return 'taken';
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) return 'wait';
  return 'failed';
}

/**
 * The business's contact address follows the address the owner asked to sign
 * in with — once Supabase has accepted it for a confirmation link. Contact
 * details only: the sign-in email itself moves in Supabase when the link is
 * opened. A failure here is logged, never shown: the link is already on its
 * way and is what matters.
 */
async function recordOwnerEmail(clientId: string, email: string): Promise<void> {
  await prisma.client.update({ where: { id: clientId }, data: { ownerEmail: email } }).catch((error: unknown) => {
    console.error('Could not record the owner email on the business', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

// ---------------------------------------------------------------------------
// Completing setup — the owner, signed in with temporary access
// ---------------------------------------------------------------------------

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

  const password = str(form, 'password');
  const validated = await validateAccountSetup(prisma, actor.userId, clientId, {
    ...values,
    password,
    confirmPassword: str(form, 'confirmPassword'),
  });
  if (!validated.ok) return refuse(validated.message, validated.errors);

  if (!supabaseConfig().ok) return refuse('Account setup is unavailable right now. Please contact Headway.');
  const supabase = await supabaseServerClient();
  const [{ data: auth }, user] = await Promise.all([
    supabase.auth.getUser(),
    prisma.user.findUnique({ where: { id: actor.userId }, select: { authProviderId: true } }),
  ]);
  if (!auth.user || auth.user.id !== user?.authProviderId) {
    return refuse('Please sign in again, then finish setting up your account.');
  }

  // 1. THE PASSWORD, on the owner's own session. Supabase keeps this session
  // and ends every OTHER one the temporary login had, so whoever else saw the
  // temporary password is signed out by the same call. Nothing in RepOS has
  // moved yet, so a refusal here changes nothing.
  const { error: passwordError } = await supabase.auth.updateUser({ password });
  // "Same password" can only mean a resubmission whose first attempt already
  // set it: the temporary password itself is refused before this point
  // (TEMP_PASSWORD_SHAPE), so it can never be "kept" by typing it again.
  if (passwordError && passwordError.code !== 'same_password') {
    console.error('completeAccountSetupAction: password not accepted', {
      clientId,
      code: passwordError.code,
      status: passwordError.status,
      message: passwordError.message,
    });
    if (passwordError.code === 'weak_password') {
      return refuse('Some fields need attention.', {
        password: passwordError.message || 'Choose a longer, less predictable password.',
      });
    }
    if (passwordError.code === 'reauthentication_needed') {
      return refuse(
        'For your security, sign out, sign in again with your temporary password, and finish setup straight away.',
      );
    }
    if (passwordError.code === 'current_password_required' || passwordError.code === 'current_password_invalid') {
      console.error('completeAccountSetupAction: Supabase asks for the current password on every change', {
        hint: 'Turn OFF "Require current password when updating" in Supabase (Authentication > Sign In / Providers > Email), or setup cannot finish.',
      });
      return refuse('Account setup is unavailable right now. Please contact Headway.');
    }
    return refuse('Your password could not be set. Nothing was changed — try again.');
  }

  // 2. RepOS's record. Supabase has accepted the password, so a failure here
  // must never read as "nothing changed": tried twice, then the truth.
  let committed: boolean;
  try {
    committed = await finalizeAccountSetup(prisma, actor.userId, validated.data);
  } catch {
    try {
      committed = await finalizeAccountSetup(prisma, actor.userId, validated.data);
    } catch (second) {
      console.error('completeAccountSetupAction: finalize failed after Supabase accepted the password', {
        userId: actor.userId,
        clientId,
        message: second instanceof Error ? second.message : String(second),
      });
      return refuse(
        'Your new password is saved, but Headway could not finish recording your setup. Please submit this form once more.',
      );
    }
  }
  if (!committed) {
    // Either an admin turned the access off first, or the first attempt above
    // did commit and only its reply was lost. Only the first is a refusal.
    const now = await prisma.accountAccess.findUnique({
      where: { userId: actor.userId },
      select: { status: true },
    });
    if (now?.status !== 'SETUP_COMPLETE') {
      return refuse('This temporary access was turned off by Headway. Please contact Headway.');
    }
  }

  // 3. The email — last, so a problem sending it never undoes the password.
  // Account offers the same request again whenever the address is not
  // confirmed yet. The business's contact address follows only an address
  // Supabase accepted: a taken one belongs to somebody else.
  const outcome = await askSupabaseToConfirm(supabase, validated.data.email, clientId);
  if (outcome === 'sent') await recordOwnerEmail(clientId, validated.data.email);

  revalidatePath(accountPath(clientId));
  revalidateClient(clientId);
  redirect(`${accountPath(clientId)}?setup=${outcome}`);
}

// ---------------------------------------------------------------------------
// The sign-in email, while it is still the temporary one
// ---------------------------------------------------------------------------

/**
 * Asks Supabase to move the sign-in email to the owner's real address — again,
 * or to a different address than the one typed at setup. Only for a login that
 * still signs in with a temporary address: changing an established login email
 * is not part of the handover.
 */
export async function requestEmailChangeAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER', 'clientId', { allowLocked: true });
  if (!gate.ok) return gate.state;
  const { clientId, actor } = gate;

  // What was typed comes back on every refusal: React resets the form after
  // the action, and without this the field would refill with the old address.
  const typed = str(form, 'email');
  const refuse = (message: string, errors: Record<string, string> = {}): ActionState => ({
    ...failure(message, errors),
    data: { email: typed },
  });

  const parsed = ownerEmailSchema.safeParse(typed);
  if (!parsed.success) {
    return refuse('Some fields need attention.', { email: parsed.error.issues[0]!.message });
  }
  const email = parsed.data;

  // Only AFTER setup: before it, the temporary password is still the one that
  // works, and moving the email first would turn the handed-over password into
  // a login nobody could switch off. Setup is where the email is asked for.
  const access = await prisma.accountAccess.findUnique({
    where: { userId: actor.userId },
    select: { clientId: true, setupCompletedAt: true },
  });
  if (!access || access.clientId !== clientId || access.setupCompletedAt === null) {
    return refuse('Finish setting up your account first.');
  }

  const identity = await currentAuthIdentity();
  if (!identity) return refuse('Please sign in again.');
  if (!isTemporaryEmail(identity.email)) return refuse('Your sign-in email is already set.');

  const collision = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (collision && collision.id !== actor.userId) {
    return refuse('Some fields need attention.', { email: 'That email is already in use by another account.' });
  }

  const supabase = await supabaseServerClient();
  const outcome = await askSupabaseToConfirm(supabase, email, clientId);
  if (outcome === 'taken') {
    return refuse('Some fields need attention.', { email: 'That email is already in use by another account.' });
  }
  if (outcome === 'wait') return refuse('An email was sent a moment ago. Wait a minute, then try again.');
  if (outcome === 'failed') return refuse('We could not send the email just now. Try again, or contact Headway.');

  await recordOwnerEmail(clientId, email);
  revalidatePath(accountPath(clientId));
  return success(`Check your email to confirm your new email address. We sent the link to ${email}.`);
}

// ---------------------------------------------------------------------------
// Changing the password — any signed-in member, knowing their current one
// ---------------------------------------------------------------------------

export async function changePasswordAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER', 'clientId', { allowLocked: true });
  if (!gate.ok) return gate.state;

  // Temporary access is replaced by setup, which also records it; changing
  // the password here instead would leave the panel saying "temporary access
  // active" over a password nobody was given.
  const access = await prisma.accountAccess.findUnique({
    where: { userId: gate.actor.userId },
    select: { status: true, setupCompletedAt: true },
  });
  if (access?.status === 'TEMPORARY_ACTIVE' && access.setupCompletedAt === null) {
    return failure('Finish setting up your account first.');
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

  // The owner's own session: Supabase keeps it and ends every other one.
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

  // Supabase drops a waiting "confirm your new email" link whenever the
  // password changes, so a link already in the inbox no longer works — and
  // the page above should stop saying one is on its way.
  revalidatePath(accountPath(gate.clientId));
  return success(
    identity.pendingEmail
      ? 'Your password has been changed, and any other devices have been signed out. The email link we sent earlier no longer works — send it again above.'
      : 'Your password has been changed. Any other devices you were signed in on have been signed out.',
  );
}
