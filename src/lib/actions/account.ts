'use server';

import { RedirectType, redirect } from 'next/navigation';
import { currentUserId, prisma } from '@/lib/db';
import { currentActor } from '@/lib/auth/authorize';
import { supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import { completeOnboarding, landingPathFor } from '@/lib/onboarding/service';
import { authRedirectUrl, callbackFor, safeNextPath } from '@/lib/auth/redirect';
import {
  bumpSessionVersion,
  IdentityConflictError,
  loadActor,
  provisionUser,
} from '@/lib/tenancy/service';
import { isTemporaryEmail, looksLikeTemporaryPassword, TEMPORARY_PASSWORD_REFUSED } from '@/lib/account-access/state';
import { isRecoverySession } from '@/lib/auth/recovery';
import { failure, str, type ActionState } from './shared';

/**
 * ACCOUNTS (M20).
 *
 * Every one of these actions hands a password straight to Supabase Auth and
 * forgets it. RepOS has no password column, no hashing, no comparison and no
 * reset token of its own — there is exactly one identity system, and this file
 * is the only place that talks to it.
 *
 * These are the four actions in RepOS that cannot require an existing session,
 * for the obvious reason. Everything they do afterwards goes through the
 * ordinary authorization primitives.
 */

/**
 * The same answer for a wrong password, an unknown address and an unconfirmed
 * account. Anything more specific turns this form into a way of asking RepOS
 * whether a given person is a customer.
 */
const SIGN_IN_FAILED = 'That email and password do not match.';
const SIGN_UP_FAILED = 'That account could not be created.';
const NOT_CONFIGURED = 'Sign-in is not set up yet. Contact Headway.';
/**
 * What a signup that needs confirming is told — and, word for word, what an
 * address that already has an account is told, so the two cannot be told apart.
 */
const SIGN_UP_CHECK_EMAIL =
  'Check your email to confirm your address, then sign in. Already have an account? Sign in instead.';

/**
 * Only same-site paths are followed, so this can never become an open redirect.
 *
 * The same-site rule is `safeNextPath`, shared with the auth callback and the
 * sign-in page — a prefix test is not enough, because a browser reads `/\host`
 * and `/<tab>/host` as leaving the site. The extra rule here is not about
 * safety: bouncing a successful sign-in back to the sign-in page is a loop, so
 * those two destinations are refused whatever the path check says.
 */
function safeNext(raw: string): string {
  const path = safeNextPath(raw);
  if (path === null) return '';
  if (path.startsWith('/login') || path.startsWith('/signup')) return '';
  return path;
}

function configured(): boolean {
  return supabaseConfig().ok;
}

// ---------------------------------------------------------------------------

export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!configured()) return failure(NOT_CONFIGURED);

  const email = str(form, 'email').trim().toLowerCase();
  const password = str(form, 'password');
  if (email.length === 0) return failure(SIGN_UP_FAILED, { email: 'Add your email address.' });
  if (password.length < 8) {
    return failure(SIGN_UP_FAILED, { password: 'Use at least 8 characters.' });
  }

  const supabase = await supabaseServerClient();
  // Without this, Supabase falls back to the project's Site URL and the
  // confirmation email points at whatever port that happens to be — which is
  // exactly how a confirmed account ends up landing on a dead server.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await authRedirectUrl(callbackFor('/onboarding')) },
  });
  if (error || !data.user) return failure(SIGN_UP_FAILED);

  // AN ADDRESS THAT ALREADY HAS AN ACCOUNT. Supabase does not say so — that
  // would let this form be used to ask who is a customer — and instead
  // returns a placeholder user whose id belongs to NO identity, marked by an
  // empty `identities` list. Provisioning from that id created a RepOS user
  // bound to a login that does not exist, which then refused every sign-in
  // for that address. Nothing is created; the answer reads exactly like a
  // genuine new signup's.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: true, message: SIGN_UP_CHECK_EMAIL, errors: {} };
  }

  // A project that requires email confirmation returns a user with no session.
  // Saying so is safe: the person is holding the address in question. No
  // RepOS user yet (M53): nobody has proved this address, and the confirmation
  // link provisions one when it is opened (the auth callback). Provisioning
  // here wrote an unproven address onto whatever login Supabase answered with
  // — for an address Headway had reserved for a business owner, that owner's.
  if (!data.session) {
    return { ok: true, message: SIGN_UP_CHECK_EMAIL, errors: {} };
  }

  // The RepOS user is created from the identity Supabase just verified, never
  // from the form. Nothing here can set isPlatformAdmin — provisionUser does
  // not write that column at all, and the database will not let it.
  //
  // provisionUser can refuse this exact email as already belonging to a
  // different identity — a real, anticipated condition, not a crash. The
  // same generic message every other signup failure gets, on purpose:
  // telling this form apart from "that account could not be created" would
  // let it be used to ask whether a given address already has an account.
  try {
    await provisionUser(prisma, { providerId: data.user.id, email });
  } catch (error) {
    if (error instanceof IdentityConflictError) return failure(SIGN_UP_FAILED);
    throw error;
  }
  redirect('/onboarding');
}

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!configured()) return failure(NOT_CONFIGURED);

  const email = str(form, 'email').trim().toLowerCase();
  const password = str(form, 'password');
  if (email.length === 0 || password.length === 0) return failure(SIGN_IN_FAILED);

  const supabase = await supabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return failure(SIGN_IN_FAILED);

  // Same refusal as signUpAction, and for the same reason: an identity
  // conflict here is a real, anticipated condition, not a crash, and it must
  // read exactly like every other sign-in failure.
  let userId: string;
  try {
    ({ userId } = await provisionUser(prisma, { providerId: data.user.id, email }));
  } catch (error) {
    if (error instanceof IdentityConflictError) return failure(SIGN_IN_FAILED);
    throw error;
  }
  const actor = await loadActor(prisma, data.user.id, data.user.email ?? '');

  // A suspended account authenticates with Supabase and still gets nowhere.
  // The session is ended rather than left open with no destination.
  if (!actor) {
    await supabase.auth.signOut();
    return failure(SIGN_IN_FAILED);
  }
  void userId;

  const next = safeNext(str(form, 'next'));
  // REPLACE, not push. The sign-in page is a doorway, not a place: left in
  // history under the workspace, Back from Home landed on a sign-in form for
  // somebody already signed in, or bounced them straight back in. Replaced,
  // Back from Home leaves Headway the way the owner came.
  redirect(next || landingPathFor(actor), RedirectType.replace);
}

export async function signOutAction(): Promise<void> {
  if (configured()) {
    const supabase = await supabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect('/login');
}

/**
 * Starts Supabase's own recovery flow.
 *
 * Always reports success. Whether an address has an account is exactly the
 * thing this form must not disclose.
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const sent = {
    ok: true,
    message: 'If that address has an account, a reset link is on its way.',
    errors: {},
  };
  if (!configured()) return failure(NOT_CONFIGURED);

  const email = str(form, 'email').trim().toLowerCase();
  if (email.length === 0) return sent;
  // A temporary address can receive nothing: asking Supabase to mail it would
  // spend the project's email allowance on a guaranteed bounce. The answer is
  // the same sentence, so this says nothing about whether it exists.
  if (isTemporaryEmail(email)) return sent;

  // Deliberately NOT the origin the form posted: a value from the browser
  // decides where a password-reset email points, which is the last place to
  // trust one. The canonical address is resolved server-side instead.
  //
  // It points at the callback rather than straight at /reset-password because
  // a recovery link carries a code, and the form cannot set a password without
  // a session. That was the second half of the same bug.
  const supabase = await supabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await authRedirectUrl(callbackFor('/reset-password')),
  });
  // Still the same sentence on screen — anything else would say whether the
  // address has an account — but a refusal (a rate limit, the mail provider)
  // is logged, so "the reset email never came" can be diagnosed. No address.
  if (error) {
    console.error('requestPasswordResetAction: Supabase did not send a reset email', {
      code: error.code,
      status: error.status,
      message: error.message,
    });
  }
  return sent;
}

/**
 * Finishes a recovery. Requires the recovery session Supabase established when
 * the link was opened, so a stranger cannot set somebody else's password.
 */
export async function updatePasswordAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!configured()) return failure(NOT_CONFIGURED);

  const password = str(form, 'password');
  if (password.length < 8) {
    return failure('That password is too short.', { password: 'Use at least 8 characters.' });
  }
  if (password.length > 72) {
    return failure('That password is too long.', { password: 'Use 72 characters or fewer.' });
  }
  if (password !== str(form, 'confirmPassword')) {
    return failure('These two passwords do not match.', {
      confirmPassword: 'These two passwords do not match.',
    });
  }
  // A handed-over owner chooses their first password here (M53). The one on
  // the handover sheet has been seen by the admin and by whoever carried the
  // sheet — chosen here, it would be the takeover M53 closes.
  if (looksLikeTemporaryPassword(password)) {
    return failure(TEMPORARY_PASSWORD_REFUSED, { password: TEMPORARY_PASSWORD_REFUSED });
  }

  const supabase = await supabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isRecoverySession(supabase))) {
    return failure('That reset link is no longer valid. Ask for a new one.');
  }

  // ORDER MATTERS, AND IT IS THE OPPOSITE OF THE OBVIOUS ONE.
  //
  // Two systems have to move and only one of them can be rolled back. Supabase
  // Auth owns the password and cannot join a Prisma transaction, so there is no
  // honest way to make this atomic — the only choice left is which half fails
  // first, and therefore which inconsistent state is reachable.
  //
  // Done password-first, the reachable failure is the unforgivable one: the
  // password has really changed, the bump throws, and the person is told it did
  // not work. They then cannot sign in with either password, and nothing in the
  // product will tell them why. That is exactly what happened here — the bump
  // wrote `sessionVersion`, which `repos_app` has no column privilege for, so
  // under the real runtime role this failed EVERY time.
  //
  // Done bump-first, the reachable failure is that sessions are invalidated and
  // the password is not. Signing out too eagerly costs a sign-in and corrects
  // itself; the old password still works, and asking for a new link is a path
  // the person can actually find. So the irreversible step goes last, after
  // everything reversible has already succeeded.
  const userId = await currentUserId();
  if (userId) {
    try {
      await bumpSessionVersion(prisma, userId);
    } catch {
      return failure('That password could not be set. Your old password still works.');
    }
  }

  // Both failures say the same sentence because it is true of both: the
  // password is the last thing to move, so nothing that fails before it has
  // changed how this person signs in.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === 'weak_password') {
      return failure('Choose a stronger password. Your old password still works.', {
        password: error.message || 'Choose a longer, less predictable password.',
      });
    }
    if (error.code === 'same_password') {
      return failure('Choose a new password. Your old password still works.', {
        password: 'That is your current password. Choose a different one.',
      });
    }
    return failure('That password could not be set. Your old password still works.');
  }

  // Supabase has already ended every other session this account had. This
  // one goes too, so the next thing the person does is sign in with the
  // password they just chose — which is also how they know it worked.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login?reset=done');
}

/** Creates the business, its owner membership and its M19 feedback gateway. */
export async function completeOnboardingAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await currentActor(prisma);
  if (!actor) redirect('/login');
  // A temporary login opens the one business it was made for, and creates
  // no other.
  if (actor.temporaryAccessClientId) {
    return failure('You are signed in with temporary access. Sign in with your own email to add a business.');
  }

  const result = await completeOnboarding(prisma, actor.userId, {
    businessName: str(form, 'businessName'),
    vertical: str(form, 'vertical'),
    areaLabel: str(form, 'areaLabel'),
    ownerName: str(form, 'ownerName'),
    ownerPhone: str(form, 'ownerPhone'),
    context: str(form, 'context'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  redirect(`/workspace/${result.data.clientId}`);
}
