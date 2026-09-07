import { NextResponse, type NextRequest } from 'next/server';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY_VAR, SUPABASE_URL_VAR } from '@/lib/auth/supabase';

/**
 * WHO GETS PAST THE FRONT DOOR (M16, rebuilt on Supabase Auth in M20).
 *
 * Middleware answers one narrow question — is there a valid session at all —
 * and refreshes the session cookie while it is here. It deliberately does not
 * decide WHICH business a request may touch: it cannot reach the database from
 * the edge, and Server Actions are POSTs addressed by an internal action id
 * rather than by page path, so a path rule could never be the real gate. That
 * decision belongs to `requireOperator` and the tenancy primitives, which run
 * inside every action and page.
 */

/** Paths a customer, or a signed-out person, must be able to reach. */
const PUBLIC_PREFIXES = [
  '/feedback',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  // The code exchange: reached from an emailed link by someone who has, by
  // definition, no session yet.
  '/auth',
  // The invitation page resolves nothing until someone signs in; it has to be
  // reachable so an invited person can get to the sign-in link on it.
  '/invite',
];

/**
 * THE PUBLIC WEBSITE (M26).
 *
 * `/` is two things. To a signed-in operator it is the command centre, as it
 * always was. To everyone else it is now the front door: the page that says
 * what Headway is and offers a way in. The marketing page is built at this
 * internal path and never linked to by it; a signed-out request for `/` is
 * rewritten here — the address bar still says `/` — and a request that names
 * this path directly is sent back to `/`, so the site has exactly one home.
 *
 * Nothing else changed. A signed-in owner opening `/` still reaches the
 * operator layout, which still sends them on to their workspace, and every
 * protected path still bounces to the sign-in page.
 */
const MARKETING_PATH = '/welcome';

/** Static files a signed-out visitor must be able to load. See `config` below. */
function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The marketing page's own path is not an address anybody should hold.
  if (pathname === MARKETING_PATH || pathname.startsWith(`${MARKETING_PATH}/`)) {
    return NextResponse.redirect(new URL('/', request.nextUrl), 308);
  }

  if (isPublic(pathname)) return NextResponse.next();

  // The owner's token portal is authorized by the secret in its URL, not by a
  // session. M20 keeps it working while the authenticated workspace takes
  // over; the route itself validates the token.
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return NextResponse.next();

  const url = (process.env[SUPABASE_URL_VAR] ?? '').trim();
  const anonKey = (process.env[SUPABASE_ANON_KEY_VAR] ?? '').trim();
  // Nothing is configured yet: send people to sign in rather than letting them
  // through on the grounds that the check could not run.
  if (!url || !anonKey) return signedOut(request);

  let response = NextResponse.next({ request });

  /**
   * Cookies Supabase rotated while verifying, kept so they survive a redirect.
   *
   * This is the whole of the ERR_TOO_MANY_REDIRECTS bug. Supabase rotates the
   * refresh token during `getUser()` and hands back new cookies; they were
   * written onto `response`, but the redirect below built a brand-new response
   * and carried none of them. The browser therefore kept presenting the OLD
   * refresh token, which Supabase had already invalidated — rotation makes
   * them single-use.
   *
   * The loop followed from that. `/login` is public, so middleware skips it and
   * the page runs its own check, which could still succeed and send an
   * authenticated person to their workspace. That route IS protected, so
   * middleware checked again with the stale cookie, failed, and sent them back
   * to `/login`. Two checks disagreeing, forever.
   */
  const rotated: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }> = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const cookie of toSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
          rotated.push(cookie);
        }
      },
    },
  });

  // getUser, not getSession: the cookie is re-verified with the auth server
  // rather than believed as it stands.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return signedOut(request, rotated);

  return response;
}

type Rotated = Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>;

/**
 * Where a request with no usable session goes: the front door for `/`, the
 * sign-in page for anything else.
 */
function signedOut(request: NextRequest, rotated: Rotated = []) {
  if (request.nextUrl.pathname === '/') return toFrontDoor(request, rotated);
  return toLogin(request, rotated);
}

function toFrontDoor(request: NextRequest, rotated: Rotated) {
  // A rewrite, not a redirect: the visitor's address stays `/`, and whatever
  // query they arrived with travels with them.
  const target = request.nextUrl.clone();
  target.pathname = MARKETING_PATH;
  const rewritten = NextResponse.rewrite(target);
  for (const cookie of rotated) rewritten.cookies.set(cookie.name, cookie.value, cookie.options);
  return rewritten;
}

function toLogin(request: NextRequest, rotated: Rotated = []) {
  const login = new URL('/login', request.nextUrl);
  // Only same-site paths are ever echoed back, so this cannot become an open
  // redirect: the value is used as a path, and the login page re-checks it.
  if (request.nextUrl.pathname !== '/') {
    login.searchParams.set('next', request.nextUrl.pathname);
  }
  const redirected = NextResponse.redirect(login);
  // Whatever Supabase rotated has to reach the browser even on the way out,
  // or the next request repeats this with a token that is already spent.
  for (const cookie of rotated) redirected.cookies.set(cookie.name, cookie.value, cookie.options);
  return redirected;
}

export const config = {
  // The brand icons belong beside favicon.ico in this list. Next serves
  // `app/icon.svg` at `/icon.svg?<hash>` and `app/apple-icon.svg` at
  // `/apple-icon.svg`, and without them here the middleware sent both to the
  // sign-in page — so the one visitor who most needs to see the mark, a
  // customer standing at a table with a QR code, got a blank tab.
  //
  // Safe to exempt for the same reason favicon.ico always was: they are static
  // files that carry no data about anybody. `og.png` joined them with the
  // public website: it is the picture a link to the front door unfurls into,
  // fetched by whichever service is drawing the preview, with no session.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|og.png|sitemap.xml|robots.txt).*)',
  ],
};
