import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { prisma } from '@/lib/db';
import { supabaseServerClient } from '@/lib/auth/supabase';
import { IdentityConflictError, provisionUser } from '@/lib/tenancy/service';
import { landingPathFor } from '@/lib/onboarding/service';
import { EMAIL_CONFIRM_KIND, safeNextPath } from '@/lib/auth/redirect';
import { loadActor } from '@/lib/tenancy/service';

/**
 * THE AUTH CALLBACK (M20 Stage 8A, M52, M53).
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
 * NOTHING IS SPENT BY OPENING A LINK (M53). A token link works once, and
 * people are not the only ones who open it: mail scanners (Outlook Safe
 * Links, Defender) fetch every link in a message before it is delivered, and
 * a chat app fetches a link pasted into a conversation to draw its preview.
 * Verified on that first GET, the token would be gone before the owner ever
 * tapped it — a reset link that always says "expired". So a GET carrying a
 * token only moves on to `/auth/confirm`, a page with one button, and the
 * token is verified when that button POSTs it back here. Fetchers do not
 * press buttons. (The templates are unchanged: they still point here.)
 *
 * Three more things this route is careful about.
 *
 * IT DOES NOT TRUST `next`. The parameter decides where somebody lands after
 * signing in, which is exactly the shape of an open redirect. Only a same-site
 * path is honoured — no scheme, no host, no protocol-relative `//evil.com`.
 *
 * IT TAKES A POST ONLY FROM ITS OWN PAGE. A browser names the site a form was
 * sent from (`Origin`, or `Sec-Fetch-Site` where a referrer policy turns
 * Origin into "null"); any other site's form is refused.
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

function tokenTypeOf(raw: string | null | undefined): EmailOtpType | null {
  return raw && TOKEN_TYPES.has(raw as EmailOtpType) ? (raw as EmailOtpType) : null;
}

const RESET_PATH = '/reset-password';

/** Where a token link waits for its one button. */
export const CONFIRM_PATH = '/auth/confirm';

/** Supabase reports a refused or expired link this way rather than by omitting the token. */
function refusedBySupabase(params: URLSearchParams): boolean {
  return Boolean(params.get('error') ?? params.get('error_description'));
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = tokenTypeOf(searchParams.get('type'));

  // A token link, opened — or merely fetched. Nothing is spent here.
  if (tokenHash && type && !refusedBySupabase(searchParams)) {
    const to = new URL(CONFIRM_PATH, origin);
    to.searchParams.set('token_hash', tokenHash);
    to.searchParams.set('type', type);
    const next = safeNext(searchParams.get('next'));
    if (next) to.searchParams.set('next', next);
    return NextResponse.redirect(to, 303);
  }

  return complete(origin, searchParams, { verifyToken: false, status: 307 });
}

/**
 * Whether a POST was sent by this site's own page.
 *
 *   1. `Sec-Fetch-Site`, which every current browser sends and no page can
 *      set: only `same-origin` is this site. It also covers a page whose
 *      referrer policy turns `Origin` into the literal "null".
 *   2. Otherwise `Origin`, compared with the host the request was actually
 *      sent to (the proxy's forwarded host, then `Host`) — never with the
 *      server's own idea of its address, which a proxy or a bind address can
 *      make differ ("localhost" for a request to 127.0.0.1).
 *   3. A request with neither header comes from a browser too old for both,
 *      and is let through, exactly as opening the link was before.
 */
export function sentFromThisSite(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null) return fetchSite === 'same-origin';
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  if (origin === 'null') return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  try {
    return new URL(origin).host === host.split(',')[0]!.trim();
  } catch {
    return false;
  }
}

/** The button on `/auth/confirm`: the one place a token is verified. */
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  let form: FormData | null = null;
  if (sentFromThisSite(request)) {
    form = await request.formData().catch(() => null);
  }
  const params = new URLSearchParams();
  for (const key of ['token_hash', 'type', 'next']) {
    const value = form?.get(key);
    if (typeof value === 'string' && value.length > 0) params.set(key, value);
  }
  // 303: after a POST the browser must GET wherever it is sent next, never
  // send the form there again.
  return complete(origin, params, { verifyToken: true, status: 303 });
}

async function complete(
  origin: string,
  searchParams: URLSearchParams,
  options: { verifyToken: boolean; status: 303 | 307 },
): Promise<NextResponse> {
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = tokenTypeOf(searchParams.get('type'));
  const next = safeNext(searchParams.get('next'));

  const isRecovery = type === 'recovery' || next === RESET_PATH;
  // "Confirm your email": an owner's new login (signup) or an email change.
  const isEmailChange =
    type === 'email_change' || type === 'signup' || searchParams.get('kind') === EMAIL_CONFIRM_KIND;

  const go = (path: string) => NextResponse.redirect(new URL(path, origin), options.status);
  // A failed link is answered where a new one can be asked for: a reset link
  // on the forgot-password page, a confirm-your-email link with a note that
  // a new one comes from Account (forgot-password cannot send one).
  const expired = () =>
    go(isRecovery ? '/forgot-password?link=expired' : isEmailChange ? '/login?email=expired' : '/login?expired=1');

  // Supabase reports a refused or expired link this way rather than by
  // omitting the code. Say the same thing for every failure.
  if (refusedBySupabase(searchParams)) return expired();

  const supabase = await supabaseServerClient();
  let user: { id: string; email?: string } | null = null;

  if (tokenHash && type && options.verifyToken) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && !data.user && type === 'email_change') return halfConfirmed(go);
    // A spent token is "expired" whoever's session this browser holds: the
    // confirm page's button turns itself off after one press, and nothing
    // here guesses which login a second press meant.
    if (error || !data.user) return expired();
    user = data.user;
  } else if (!options.verifyToken && !code && isEmailChange && searchParams.get('message')) {
    // The older link's way of saying the same thing: one of two links opened.
    return halfConfirmed(go);
  } else if (code && !options.verifyToken) {
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

  const actor = await loadActor(prisma, user.id, user.email);

  // A business owner's own login, made by Headway on the address Headway
  // recorded (M53), has no password anybody knows. The owner normally proves
  // the address with a reset link (above); a "confirm your signup" email can
  // reach the same login too (anyone can ask the sign-up form to send one),
  // and either way the person who opened that inbox chooses the password —
  // now, while the link's session lasts.
  if (type === 'signup' && actor && !actor.temporaryAccessClientId) {
    const handover = await prisma.accountAccess.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (handover) return go(RESET_PATH);
  }

  if (next) return go(next);

  // A confirmed login that belongs to a business lands on its Account page,
  // saying so; anyone else (a brand-new self-serve signup) goes where their
  // memberships say — for them, on to set up a business.
  const workspace = actor?.memberships.find((m) => m.status === 'ACTIVE');
  if (isEmailChange && workspace) return go(`/workspace/${workspace.clientId}/account?email=confirmed`);
  return go(actor ? landingPathFor(actor) : '/onboarding');
}
