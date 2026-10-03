import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * THE AUTH CALLBACK, FOR EVERY KIND OF EMAILED LINK (M52).
 *
 * Token links (`token_hash` + `type`, what the email templates send) are
 * verified with `verifyOtp` and work on any device. The older PKCE links
 * (`code`) still work in the browser that asked for them; opened anywhere
 * else they fail, and the page the person lands on has to say what actually
 * happened:
 *
 *   - "confirm your new email": Supabase changed the address when the link
 *     was opened, so the answer is "confirmed — sign in", never "expired";
 *   - a reset link in the wrong browser: "open it where you asked for it";
 *   - anything refused or expired: the expired sentence, next to the form that
 *     gets a new link.
 *
 * Since M53 a token link is never spent by being OPENED: mail scanners and
 * chat previews fetch links before people do. The GET only moves on to
 * `/auth/confirm`, a page with one button, and that button POSTs the token
 * back here, where it is verified. `visit` below does both, the way a person
 * does; the tests under "nothing is spent by opening a link" check each half.
 *
 * Supabase and the database are mocked; this file is about routing.
 */

const h = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  provisionUser: vi.fn(),
  loadActor: vi.fn(),
  /** The signed-in owner's temporary-access row, if their business was handed over by Headway. */
  accountAccess: vi.fn(),
  /** What this browser's existing session says about itself (JWT claims). */
  getClaims: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: { accountAccess: { findUnique: h.accountAccess } } }));
vi.mock('@/lib/auth/supabase', () => ({
  supabaseServerClient: async () => ({
    auth: { verifyOtp: h.verifyOtp, exchangeCodeForSession: h.exchangeCodeForSession, getClaims: h.getClaims },
  }),
}));
vi.mock('@/lib/tenancy/service', () => ({
  IdentityConflictError: class IdentityConflictError extends Error {},
  provisionUser: h.provisionUser,
  loadActor: h.loadActor,
}));

const OWNER = {
  userId: 'u1',
  email: 'owner@example.com',
  isPlatformAdmin: false,
  status: 'ACTIVE',
  memberships: [{ clientId: 'client1', role: 'BUSINESS_OWNER', status: 'ACTIVE' }],
  setupPendingClientId: null,
};

const SITE = 'https://headway.test';

function where(response: Response): string {
  return (response.headers.get('location') ?? '').replace(SITE, '');
}

/** Opening a link: the GET the email client makes. */
async function open(query: string): Promise<Response> {
  const { GET } = await import('@/app/auth/callback/route');
  return GET(new NextRequest(`${SITE}/auth/callback?${query}`));
}

/** Pressing the button on /auth/confirm: a same-site form POST back to the callback. */
async function press(
  fields: Record<string, string>,
  origin: string | null = SITE,
  fetchSite?: 'same-origin' | 'same-site' | 'cross-site' | 'none',
): Promise<Response> {
  const { POST } = await import('@/app/auth/callback/route');
  const body = new URLSearchParams(fields);
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  if (origin !== null) headers.origin = origin;
  if (fetchSite) headers['sec-fetch-site'] = fetchSite;
  return POST(new NextRequest(`${SITE}/auth/callback`, { method: 'POST', headers, body: body.toString() }));
}

/**
 * Where a person ends up: open the link, and — when it stops at the confirm
 * page — press its button, carrying exactly what the page would carry.
 */
async function visit(query: string): Promise<string> {
  const first = await open(query);
  const to = new URL(first.headers.get('location') ?? '/', SITE);
  if (to.pathname !== '/auth/confirm') return where(first);
  return where(await press(Object.fromEntries(to.searchParams)));
}

beforeEach(() => {
  for (const mock of Object.values(h)) mock.mockReset();
  h.provisionUser.mockResolvedValue({ userId: 'u1', created: false });
  h.loadActor.mockResolvedValue(OWNER);
  h.accountAccess.mockResolvedValue(null);
  h.getClaims.mockResolvedValue({ data: null, error: null });
});

describe('nothing is spent by opening a link (M53)', () => {
  it('a GET carrying a token only moves on to the confirm page, with the token, its type and a safe next', async () => {
    const response = await open('token_hash=pkce_abc&type=recovery&next=%2Freset-password');
    expect(response.status).toBe(303);
    const to = new URL(response.headers.get('location') ?? '', SITE);
    expect(to.pathname).toBe('/auth/confirm');
    expect(Object.fromEntries(to.searchParams)).toEqual({
      token_hash: 'pkce_abc',
      type: 'recovery',
      next: '/reset-password',
    });
    expect(h.verifyOtp).not.toHaveBeenCalled();
    expect(h.provisionUser).not.toHaveBeenCalled();

    // Fetched again and again — by a scanner, then a chat preview — still nothing.
    await open('token_hash=pkce_abc&type=recovery&next=%2Freset-password');
    await open('token_hash=pkce_abc&type=signup');
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('drops a next that leaves the site on the way to the confirm page', async () => {
    const to = new URL(
      (await open(`token_hash=abc&type=recovery&next=${encodeURIComponent('https://evil.example')}`)).headers.get(
        'location',
      ) ?? '',
      SITE,
    );
    expect(to.pathname).toBe('/auth/confirm');
    expect(to.searchParams.has('next')).toBe(false);
  });

  it('the button verifies the token, once, and answers with 303 so the form is never sent on', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });
    const response = await press({ token_hash: 'pkce_abc', type: 'recovery', next: '/reset-password' });
    expect(response.status).toBe(303);
    expect(where(response)).toBe('/reset-password');
    expect(h.verifyOtp).toHaveBeenCalledTimes(1);
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: 'pkce_abc', type: 'recovery' });
  });

  it('a form posted from any other site is refused without touching the token', async () => {
    const response = await press({ token_hash: 'pkce_abc', type: 'recovery' }, 'https://evil.example');
    expect(where(response)).toBe('/login?expired=1');
    // ...also when that site's no-referrer policy hides it as "null", and the
    // browser's own fetch metadata says it came from elsewhere.
    for (const fetchSite of ['cross-site', 'same-site', 'none'] as const) {
      expect(where(await press({ token_hash: 'pkce_abc', type: 'recovery' }, 'null', fetchSite)), fetchSite).toBe(
        '/login?expired=1',
      );
    }
    // "null" with nothing else to go on is not trusted either.
    expect(where(await press({ token_hash: 'pkce_abc', type: 'recovery' }, 'null'))).toBe('/login?expired=1');
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('takes the form a real browser sends from the confirm page: Origin "null" under no-referrer, same-origin fetch metadata', async () => {
    // A plain HTML form POST from a page whose referrer policy is no-referrer
    // carries `Origin: null` in every engine; Sec-Fetch-Site still says where
    // it came from. (The confirm page asks for same-origin, which sends the
    // real Origin — this is the belt to that pair of braces.)
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });
    expect(where(await press({ token_hash: 'pkce_abc', type: 'recovery' }, 'null', 'same-origin'))).toBe('/reset-password');
    // The real Origin with fetch metadata, as the confirm page now sends it.
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });
    expect(where(await press({ token_hash: 'pkce_abc', type: 'recovery' }, SITE, 'same-origin'))).toBe('/reset-password');
    // A browser too old for either header, as opening a link always was.
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });
    expect(where(await press({ token_hash: 'pkce_abc', type: 'recovery' }, null))).toBe('/reset-password');
    expect(h.verifyOtp).toHaveBeenCalledTimes(3);
  });

  it('trusts the browser’s own fetch metadata over Origin: a cross-site request is refused even if it names this site', async () => {
    expect(where(await press({ token_hash: 'pkce_abc', type: 'recovery' }, SITE, 'cross-site'))).toBe('/login?expired=1');
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('compares Origin with the host the request was sent to, not with the server’s own idea of its address', async () => {
    const { POST } = await import('@/app/auth/callback/route');
    const send = (url: string, headers: Record<string, string>) =>
      POST(
        new NextRequest(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
          body: new URLSearchParams({ token_hash: 'pkce_abc', type: 'recovery' }).toString(),
        }),
      );
    h.verifyOtp.mockResolvedValue({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });

    // A server bound to 127.0.0.1 that calls itself "localhost": what the
    // browser asked for is what counts.
    const local = await send('http://localhost:3417/auth/callback', { host: '127.0.0.1:3417', origin: 'http://127.0.0.1:3417' });
    expect(new URL(local.headers.get('location') ?? '').pathname).toBe('/reset-password');

    // Behind a proxy (Vercel): the host the proxy says it received.
    const proxied = await send('http://internal:3000/auth/callback', {
      host: 'internal:3000',
      'x-forwarded-host': 'repos.example',
      origin: 'https://repos.example',
    });
    expect(new URL(proxied.headers.get('location') ?? '').pathname).toBe('/reset-password');
    expect(h.verifyOtp).toHaveBeenCalledTimes(2);

    // Another site's Origin is refused whatever the host.
    const foreign = await send('http://localhost:3417/auth/callback', { host: '127.0.0.1:3417', origin: 'https://evil.example' });
    expect(new URL(foreign.headers.get('location') ?? '').pathname + new URL(foreign.headers.get('location') ?? '').search).toBe(
      '/login?expired=1',
    );
    expect(h.verifyOtp).toHaveBeenCalledTimes(2);
  });

  it('a spent link is "expired" even when this browser holds somebody’s fresh link session', async () => {
    // On a shared device the session in the browser may be another person's
    // (a reset they left half-done). A spent token never opens anybody's
    // password form: it is the honest "expired", where a new link is asked
    // for. (The confirm page's button turns itself off after one press.)
    h.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired', message: 'Email link is invalid or has expired' } });
    h.getClaims.mockResolvedValue({
      data: { claims: { amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) - 30 }] } },
      error: null,
    });
    expect(where(await press({ token_hash: 'pkce_abc', type: 'recovery', next: '/reset-password' }))).toBe(
      '/forgot-password?link=expired',
    );
    expect(where(await press({ token_hash: 'abc', type: 'signup' }))).toBe('/login?email=expired');
    expect(h.getClaims).not.toHaveBeenCalled();
  });

  it('a POST without a token, or with a type it was not built for, is just expired', async () => {
    expect(where(await press({}))).toBe('/login?expired=1');
    expect(where(await press({ token_hash: 'abc', type: 'magiclink' }))).toBe('/login?expired=1');
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('a PKCE code is never accepted by POST — only the GET exchange in the asking browser', async () => {
    expect(where(await press({ code: 'c1' }))).toBe('/login?expired=1');
    expect(h.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('a handed-over owner’s own login (M53)', () => {
  it('confirmed from a "confirm your signup" email, goes straight on to choose its password', async () => {
    // Headway made this login with no password anybody knows. Whoever opened
    // the inbox it belongs to chooses one now, while the link's session lasts.
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-own', email: 'owner@example.com' } }, error: null });
    h.accountAccess.mockResolvedValueOnce({ id: 'access1' });
    expect(await visit('token_hash=abc&type=signup')).toBe('/reset-password');
    expect(h.accountAccess).toHaveBeenCalledWith({ where: { userId: 'u1' }, select: { id: true } });
  });

  it('a reset link for it goes to the same form, like any reset', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-own', email: 'owner@example.com' } }, error: null });
    expect(await visit('token_hash=abc&type=recovery&next=%2Freset-password')).toBe('/reset-password');
  });

  it('a confirmation that somehow reaches a temporary session never asks it for a password', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-temp', email: 'x@access.headway.local' } }, error: null });
    h.loadActor.mockResolvedValueOnce({ ...OWNER, temporaryAccessClientId: 'client1' });
    expect(await visit('token_hash=abc&type=signup')).toBe('/workspace/client1/account?email=confirmed');
    expect(h.accountAccess).not.toHaveBeenCalled();
  });
});

describe('token links (any device)', () => {
  it('a reset link opens the new-password form', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });

    expect(await visit('token_hash=pkce_abc&type=recovery&next=%2Freset-password')).toBe('/reset-password');
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: 'pkce_abc', type: 'recovery' });
  });

  it('a confirm-new-email link lands on Account, saying it is confirmed, with RepOS brought up to date', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'new@example.com' } }, error: null });

    expect(await visit('token_hash=abc&type=email_change')).toBe('/workspace/client1/account?email=confirmed');
    expect(h.provisionUser).toHaveBeenCalledWith(expect.anything(), { providerId: 'auth1', email: 'new@example.com' });
  });

  it('an owner’s own login confirmed from its email lands on Account, saying so', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-own', email: 'owner@example.com' } }, error: null });

    expect(await visit('token_hash=abc&type=signup')).toBe('/workspace/client1/account?email=confirmed');
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'signup' });
    expect(h.provisionUser).toHaveBeenCalledWith(expect.anything(), { providerId: 'auth-own', email: 'owner@example.com' });
  });

  it('a brand-new self-serve signup confirmed the same way still goes on to set up a business', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-new', email: 'new@example.com' } }, error: null });
    h.loadActor.mockResolvedValueOnce({ ...OWNER, memberships: [] });

    expect(await visit('token_hash=abc&type=signup')).toBe('/onboarding');
  });

  it('an expired or used token link says so, where a new link can be asked for', async () => {
    h.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired', message: 'Email link is invalid or has expired' } });

    expect(await visit('token_hash=abc&type=recovery&next=%2Freset-password')).toBe('/forgot-password?link=expired');
    // A dead confirm-your-email link: a new one comes from Account, not from
    // forgot-password, so it gets its own sentence.
    expect(await visit('token_hash=abc&type=email_change')).toBe('/login?email=expired');
    expect(h.provisionUser).not.toHaveBeenCalled();
  });

  it('ignores a token of any type it was not built for', async () => {
    for (const type of ['invite', 'magiclink', 'email', 'nonsense']) {
      expect(await visit(`token_hash=abc&type=${type}`), type).toBe('/login?expired=1');
    }
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it('a link Supabase refused is expired at once, with no confirm page in between', async () => {
    const response = await open('token_hash=abc&type=recovery&next=%2Freset-password&error=access_denied');
    expect(where(response)).toBe('/forgot-password?link=expired');
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });
});

describe('older PKCE links (the browser that asked)', () => {
  it('still work where they were asked for', async () => {
    h.exchangeCodeForSession.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });
    expect(await visit('code=c1&next=%2Freset-password')).toBe('/reset-password');
  });

  it('a confirm-new-email link opened elsewhere is reported as confirmed — Supabase already changed it', async () => {
    h.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'pkce_code_verifier_not_found', message: 'PKCE code verifier not found in storage.' },
    });
    expect(
      await visit(`code=c1&next=${encodeURIComponent('/workspace/client1/account?email=confirmed')}&kind=email`),
    ).toBe('/login?email=confirmed');
  });

  it('a confirm-new-email link opened where it was asked for goes back to Account', async () => {
    h.exchangeCodeForSession.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'new@example.com' } }, error: null });
    expect(
      await visit(`code=c1&next=${encodeURIComponent('/workspace/client1/account?email=confirmed')}&kind=email`),
    ).toBe('/workspace/client1/account?email=confirmed');
  });

  it('a reset link opened in another browser says to open it where it was asked for', async () => {
    h.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'pkce_code_verifier_not_found', message: 'PKCE code verifier not found in storage.' },
    });
    expect(await visit('code=c1&next=%2Freset-password')).toBe('/forgot-password?link=other-browser');
  });

  it('a reset link opened too late says it expired', async () => {
    h.exchangeCodeForSession.mockResolvedValueOnce({ data: { user: null }, error: { code: 'flow_state_expired', message: 'x' } });
    expect(await visit('code=c1&next=%2Freset-password')).toBe('/forgot-password?link=expired');
  });

  it('a link Supabase refused before the redirect says it expired', async () => {
    expect(await visit('error=access_denied&error_code=otp_expired&next=%2Freset-password')).toBe(
      '/forgot-password?link=expired',
    );
    expect(await visit('error=access_denied&error_code=otp_expired')).toBe('/login?expired=1');
    expect(await visit('error=access_denied&error_code=otp_expired&kind=email')).toBe('/login?email=expired');
    expect(h.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('“Secure email change” left ON', () => {
  it('a token link that confirmed only one of two addresses says so, instead of “expired”', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    expect(await visit('token_hash=abc&type=email_change')).toBe('/login?email=incomplete');
    expect(h.provisionUser).not.toHaveBeenCalled();
  });

  it('the older link’s version of the same thing — a message and no code — says so too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = encodeURIComponent('Confirmation link accepted. Please proceed to confirm link sent to the other email');
    expect(await visit(`message=${message}&next=%2Fworkspace%2Fclient1%2Faccount&kind=email`)).toBe('/login?email=incomplete');
  });
});

describe('never an open redirect', () => {
  it('drops a next that leaves the site, and lands on the person’s own home instead', async () => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', '/%5Cevil.example']) {
      h.exchangeCodeForSession.mockResolvedValueOnce({ data: { user: { id: 'auth1', email: 'owner@example.com' } }, error: null });
      const to = await visit(`code=c1&next=${encodeURIComponent(next)}`);
      expect(to, next).toBe('/workspace/client1');
    }
  });

  it('a link with nothing in it is just expired', async () => {
    expect(await visit('')).toBe('/login?expired=1');
  });
});
