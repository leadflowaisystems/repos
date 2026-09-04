'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { currentActor } from '@/lib/auth/authorize';
import { supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import { completeOnboarding, landingPathFor } from '@/lib/onboarding/service';
import { loadActor, provisionUser } from '@/lib/tenancy/service';
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
const NOT_CONFIGURED = 'Sign-in is not configured on this installation yet.';

/** Only same-site paths are followed, so this can never become an open redirect. */
function safeNext(raw: string): string {
  if (!raw.startsWith('/') || raw.startsWith('//')) return '';
  if (raw.startsWith('/login') || raw.startsWith('/signup')) return '';
  return raw;
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
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) return failure(SIGN_UP_FAILED);

  // The RepOS user is created from the identity Supabase just verified, never
  // from the form. Nothing here can set isPlatformAdmin — provisionUser does
  // not write that column at all, and the database will not let it.
  await provisionUser(prisma, { providerId: data.user.id, email });

  // A project that requires email confirmation returns a user with no session.
  // Saying so is safe: the person is holding the address in question.
  if (!data.session) {
    return { ok: true, message: 'Check your email to confirm your address, then sign in.', errors: {} };
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

  const { userId } = await provisionUser(prisma, { providerId: data.user.id, email });
  const actor = await loadActor(prisma, data.user.id);

  // A suspended account authenticates with Supabase and still gets nowhere.
  // The session is ended rather than left open with no destination.
  if (!actor) {
    await supabase.auth.signOut();
    return failure(SIGN_IN_FAILED);
  }
  void userId;

  const next = safeNext(str(form, 'next'));
  redirect(next || landingPathFor(actor));
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

  const origin = str(form, 'origin');
  const supabase = await supabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin.startsWith('http') ? `${origin}/reset-password` : undefined,
  });
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

  const supabase = await supabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return failure('That reset link is no longer valid. Ask for a new one.');

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return failure('That password could not be set.');

  // Everything else that person had open stops working.
  await prisma.user.updateMany({
    where: { authProviderId: userData.user.id },
    data: { sessionVersion: { increment: 1 } },
  });

  redirect('/login');
}

/** Creates the business, its owner membership and its M19 feedback gateway. */
export async function completeOnboardingAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await currentActor(prisma);
  if (!actor) redirect('/login');

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
