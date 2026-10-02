'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentAuthIdentity, prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import { detachedAuthClient, supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import {
  createOwnerIdentity,
  deleteIdentity,
  getIdentitySnapshot,
  IDENTITY_MISSING,
  setIdentityPassword,
} from '@/lib/auth/supabase-admin';
import { isTemporaryEmail } from '@/lib/account-access/state';
import { authRedirectUrl, emailConfirmCallback } from '@/lib/auth/redirect';
import {
  disableTempAccess,
  finalizeAccountSetup,
  generateTempAccess,
  newPasswordSchema,
  recordedOwnLogin,
  restoreOwnLogin,
  validateAccountSetup,
  type SetupRecord,
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
 *   2. RepOS records it on the owner User (one transaction). The User's email
 *      itself changes only once the address is confirmed.
 *   3. The owner's own session asks Supabase to send the confirmation link to
 *      that address — the one email. Opening it is what makes the login work:
 *      a mistyped or somebody else's address never becomes a login or a
 *      password-reset address.
 *
 * The temporary login is not touched: it keeps working until an admin
 * disables it, so the owner is never stranded between the two.
 *
 * Filling setup in again before the link is opened is how a lost, late or
 * expired email is recovered, and how a typo is fixed:
 *
 *   - the SAME address: the login that already holds it gets the password just
 *     typed and a fresh link (Supabase would refuse to make a second login for
 *     an address one already holds);
 *   - a DIFFERENT address: a new login, and the unconfirmed one goes.
 *
 * A Headway-made own login (an owner who "set up" before M52 but whose real
 * email never arrived) is replaced the same way. One somebody has confirmed
 * is never replaced here.
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
  const email = validated.data.email;

  // The own login on record, if any, decides what a redo may do with it.
  const previous = validated.data.previousOwnAuthId;
  let sameLogin = false;
  if (previous) {
    const snapshot = await getIdentitySnapshot(previous);
    if (snapshot === null) {
      return refuse('We could not check your sign-in just now. Nothing was changed — try again in a minute.');
    }
    if (snapshot !== IDENTITY_MISSING) {
      if (stillTheOwners(snapshot)) {
        return refuse('Your own sign-in is already set up. Sign in with your email and password.');
      }
      sameLogin = !isTemporaryEmail(snapshot.email) && snapshot.email === email;
    }
  }

  // 1. The owner's own login, unconfirmed. No email yet.
  let ownAuthId: string;
  if (sameLogin) {
    // The SAME address again: the email never came, or its link expired. The
    // login that holds it keeps the password it was given — a temporary
    // session never overwrites it (whoever else holds the handover sheet could
    // otherwise set the password the owner then confirms) — so the password
    // typed now must be that one. Supabase then sends a fresh link.
    const proof = await provePendingPassword(email, password, previous!);
    if (proof === 'confirmed') {
      return refuse('Your own sign-in is already set up. Sign in with your email and password.');
    }
    if (proof === 'wrong') {
      return refuse('Some fields need attention.', {
        password:
          'This address is already waiting for confirmation, with the password chosen the first time. Enter that password to get a new link — or, if it is forgotten, use “Forgot password?” on the sign-in page with this address.',
      });
    }
    if (proof === 'busy') return refuse('Too many attempts. Wait a minute and try again.');
    if (proof === 'unknown') {
      return refuse('We could not check your sign-in just now. Nothing was changed — try again in a minute.');
    }
    ownAuthId = previous!;
  } else {
    const created = await createOwnerIdentity(email, password);
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
    ownAuthId = created.authUserId;
  }
  // A login this request made, and only that, is removed if setup does not land.
  const discardNew = async () => {
    if (!sameLogin) await deleteIdentity(ownAuthId);
  };

  // A login being replaced may have been confirmed while this ran (its link
  // opened in another tab). Then it is the owner's, and it stays.
  if (previous && !sameLogin) {
    const now = await getIdentitySnapshot(previous);
    if (now !== null && now !== IDENTITY_MISSING && stillTheOwners(now)) {
      await discardNew();
      return refuse('Your own sign-in was just confirmed. Sign in with your email and password.');
    }
  }

  // 2. RepOS's record. If it cannot be written, a login made here goes again,
  // so nothing half-made is left behind.
  let recorded: SetupRecord;
  try {
    recorded = await finalizeAccountSetup(prisma, actor.userId, session.id, validated.data, ownAuthId);
  } catch (error) {
    console.error('completeAccountSetupAction: could not record the owner login', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
    // A commit whose acknowledgement was lost would otherwise have its live
    // login deleted out from under it: if the record is there, it worked.
    // If the database cannot even say (asked a few times), the login made
    // here goes anyway — left behind unrecorded it would hold the owner's
    // address for good. Had the commit landed, RepOS now names a login
    // Supabase no longer has, which reads as not set up, and the next setup
    // simply replaces it.
    const landed = await readBack(() => recordedOwnLogin(prisma, actor.userId));
    if (landed === undefined) {
      await discardNew();
      return refuse('Your account could not be set up. Reload the page and try again.');
    }
    if (landed !== ownAuthId) {
      await discardNew();
      return refuse('Your account could not be set up. Nothing was changed — try again.');
    }
    recorded = 'recorded';
  }
  if (recorded === 'access-off') {
    await discardNew();
    return refuse('This temporary access was turned off by Headway. Please contact Headway.');
  }
  if (recorded === 'raced') {
    await discardNew();
    return refuse('Your account was just set up from another window. Reload the page to see it.');
  }

  // The login this replaced — an address the owner corrected, or the
  // Headway-made one — goes: nothing points at it any more, and left behind
  // it would sign in as a stranger to this account. Checked once more first:
  // one confirmed in the last moment is the owner's, so it is put back and
  // the one made here goes instead.
  if (previous && previous !== ownAuthId) {
    const after = await getIdentitySnapshot(previous);
    if (after === null) {
      console.error('completeAccountSetupAction: the replaced login could not be checked, so it was kept', { clientId });
    } else if (after !== IDENTITY_MISSING && stillTheOwners(after)) {
      const restored = await restoreOwnLogin(prisma, actor.userId, ownAuthId, previous).catch(() => false);
      if (restored) {
        await discardNew();
        return refuse('Your own sign-in was just confirmed. Sign in with your email and password.');
      }
      console.error('completeAccountSetupAction: a just-confirmed own login could not be put back', { clientId });
    } else {
      await deleteIdentity(previous);
    }
  }

  // 3. The confirmation email, through the owner's own session. Supabase finds
  // the unconfirmed login and sends its link; it changes nothing else.
  const outcome = await sendConfirmationLink(clientId, email, password, ownAuthId);

  revalidatePath(accountPath(clientId));
  revalidateClient(clientId);
  redirect(`${accountPath(clientId)}?setup=${outcome}`);
}

/** A confirmed login on a real address: the owner's own, never replaced by setup. */
function stillTheOwners(snapshot: { email: string; confirmed: boolean }): boolean {
  return snapshot.confirmed && !isTemporaryEmail(snapshot.email);
}

/**
 * Whether `password` is the one the owner's pending (unconfirmed) login was
 * given, asked of Supabase on a client that cannot touch this browser's
 * session. Supabase checks the password before the confirmation, so the right
 * one on an unconfirmed login answers "Email not confirmed", and a wrong one
 * answers "Invalid login credentials". A session means the login has been
 * confirmed since; it is ended at once.
 */
async function provePendingPassword(
  email: string,
  password: string,
  expectedAuthId: string,
): Promise<'match' | 'wrong' | 'confirmed' | 'busy' | 'unknown'> {
  const detached = detachedAuthClient();
  const { data, error } = await detached.auth.signInWithPassword({ email, password });
  if (data?.session) {
    await detached.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return data.user?.id === expectedAuthId ? 'confirmed' : 'unknown';
  }
  if (error?.code === 'email_not_confirmed') return 'match';
  if (error?.code === 'invalid_credentials') return 'wrong';
  if (error?.status === 429) return 'busy';
  console.error('completeAccountSetupAction: could not check the pending password', {
    code: error?.code,
    status: error?.status,
    message: error?.message,
  });
  return 'unknown';
}

/** A read retried a few times over a short blip; undefined when it never answered. */
async function readBack<T>(read: () => Promise<T>): Promise<T | undefined> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await read();
    } catch {
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return undefined;
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
