import { NextResponse, type NextRequest } from 'next/server';
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
  // The invitation page resolves nothing until someone signs in; it has to be
  // reachable so an invited person can get to the sign-in link on it.
  '/invite',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // The owner's token portal is authorized by the secret in its URL, not by a
  // session. M20 keeps it working while the authenticated workspace takes
  // over; the route itself validates the token.
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return NextResponse.next();

  const url = (process.env[SUPABASE_URL_VAR] ?? '').trim();
  const anonKey = (process.env[SUPABASE_ANON_KEY_VAR] ?? '').trim();
  // Nothing is configured yet: send people to sign in rather than letting them
  // through on the grounds that the check could not run.
  if (!url || !anonKey) return toLogin(request);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser, not getSession: the cookie is re-verified with the auth server
  // rather than believed as it stands.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return toLogin(request);

  return response;
}

function toLogin(request: NextRequest) {
  const login = new URL('/login', request.nextUrl);
  // Only same-site paths are ever echoed back, so this cannot become an open
  // redirect: the value is used as a path, and the login page re-checks it.
  if (request.nextUrl.pathname !== '/') {
    login.searchParams.set('next', request.nextUrl.pathname);
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
