import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { prisma } from '@/lib/db';
import { supabaseServerClient } from '@/lib/auth/supabase';
import { IdentityConflictError, provisionUser } from '@/lib/tenancy/service';
import { landingPathFor } from '@/lib/onboarding/service';
import { EMAIL_CONFIRM_KIND, safeNextPath } from '@/lib/auth/redirect';
import { loadActor } from '@/lib/tenancy/service';

/**
 * THE AUTH CALLBACK (M20 Stage 8A, M52).
 *
 * Every link Supabase emails — confirm your address, reset your password,
 * confirm a new address — comes back here, carrying one of two things:
 *
 *   `token_hash` + `type`  what the email templates send since M52. Verified
 *                          here with `verifyOtp`, it works on ANY device and
 *                          for as long as the link itself is valid (an hour
 *                          by default), because nothing about it depends on
 *                          the browser that asked for the email.
 *   `code`                 the older PKCE link. It can only be exchanged in
 *                          the browser that asked for the email, and only
 *                          within a few minutes of asking. Kept, so a link
 *                          sent before the templates changed still works.
 *
 * Two things this route is careful about.
 *
 * IT DOES NOT TRUST `next`. The parameter decides where somebody lands after
 * signing in, which is exactly the shape of an open redirect. Only a same-site
 * path is honoured — no scheme, no host, no protocol-relative `//evil.com`.
 *
 * IT PROVISIONS ON THE WAY THROUGH. A confirmation link is often the first
 * time an identity is genuinely usable, and the RepOS row behind it may not
 * exist yet — or, after an email change, may still hold the old address.
 * Provisioning here uses the same `provisionUser` every other entry point
 * uses — it cannot set `isPlatformAdmin`, and the database would refuse it if
 * it tried.
 */

/**
 * Only same-site paths. Anything else falls back to the caller's own home.
 * The rule itself lives in `@/lib/auth/redirect`.
 */
export function safeNext(raw: string | null): string | null {
  return safeNextPath(raw);
}

/**
 * Supabase accepted ONE of two links and is waiting for the other. That only
 * happens with "Secure email change" ON, where the second link went to the
 * temporary address and can never be opened — so the change cannot finish
 * until the setting is off. Said plainly to the owner, and named in the log.
 */
function halfConfirmed(go: (path: string) => NextResponse) {
  console.error('auth callback: email change half-confirmed', {
    hint: 'Turn OFF "Secure email change" in Supabase (Authentication > Sign In / Providers > Email); the other link went to the temporary address.',
  });
  return go('/login?email=incomplete');
}

/**
 * The link types the templates send as token links: a password reset, the
 * owner's own login being confirmed (signup), and an email change.
 */
const TOKEN_TYPES = new Set<EmailOtpType>(['recovery', 'signup', 'email_change']);

const RESET_PATH = '/reset-password';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  const type = rawType && TOKEN_TYPES.has(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;
  const next = safeNext(searchParams.get('next'));

  const isRecovery = type === 'recovery' || next === RESET_PATH;
  // "Confirm your email": an owner's new login (signup) or an email change.
  const isEmailChange =
    type === 'email_change' || type === 'signup' || searchParams.get('kind') === EMAIL_CONFIRM_KIND;

  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  // A failed link is answered where a new one can be asked for: a reset link
  // on the forgot-password page, a confirm-your-email link with a note that
  // a new one comes from Account (forgot-password cannot send one).
  const expired = () =>
    go(isRecovery ? '/forgot-password?link=expired' : isEmailChange ? '/login?email=expired' : '/login?expired=1');

  // Supabase reports a refused or expired link this way rather than by
  // omitting the code. Say the same thing for every failure.
  if (searchParams.get('error') ?? searchParams.get('error_description')) return expired();

  const supabase = await supabaseServerClient();
  let user: { id: string; email?: string } | null = null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && !data.user && type === 'email_change') return halfConfirmed(go);
    if (error || !data.user) return expired();
    user = data.user;
  } else if (!code && isEmailChange && searchParams.get('message')) {
    // The older link's way of saying the same thing: one of two links opened.
    return halfConfirmed(go);
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      // Supabase already did what the link was for — it changed the address
      // when the link was opened — so this is only about signing THIS browser
      // in, which a link opened on another device cannot do.
      if (isEmailChange) return go('/login?email=confirmed');
      if (isRecovery && error?.code === 'pkce_code_verifier_not_found') {
        return go('/forgot-password?link=other-browser');
      }
      return expired();
    }
    user = data.user;
  } else {
    return expired();
  }

  if (!user.email) return expired();

  // Same refusal as the sign-up and sign-in actions: an identity conflict is
  // a real, anticipated condition, so it lands on the same "start over"
  // redirect every other failure on this route already uses.
  try {
    await provisionUser(prisma, { providerId: user.id, email: user.email });
  } catch (error) {
    if (error instanceof IdentityConflictError) return expired();
    throw error;
  }

  // A recovery link must go to the reset form even though the person now
  // holds a session.
  if (isRecovery) return go(RESET_PATH);
  if (next) return go(next);

  const actor = await loadActor(prisma, user.id, user.email);
  // A confirmed login that belongs to a business lands on its Account page,
  // saying so; anyone else (a brand-new self-serve signup) goes where their
  // memberships say — for them, on to set up a business.
  const workspace = actor?.memberships.find((m) => m.status === 'ACTIVE');
  if (isEmailChange && workspace) return go(`/workspace/${workspace.clientId}/account?email=confirmed`);
  return go(actor ? landingPathFor(actor) : '/onboarding');
}
