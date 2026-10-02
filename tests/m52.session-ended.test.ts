import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A SESSION THAT ENDED WHILE ITS PAGE WAS STILL OPEN (M52).
 *
 * The owner changes their password on one device, or a reset ends every other
 * session, or the session simply expires — and a tab somewhere still shows the
 * workspace. The next thing that tab does decides what they see:
 *
 *   - opening a page (a GET) is sent to sign in, as always;
 *   - submitting a form is a Server Action: a POST Next makes with fetch and
 *     expects to be answered in its own format. Redirected, the browser
 *     re-posts it to /login, which has no such action, and Next shows
 *     "Something went wrong" (what an owner saw on Account in the live test).
 *     So it reaches the action, whose own gate answers in words: the session
 *     has ended, sign in again.
 */

const h = vi.hoisted(() => ({
  /** What Supabase says about the request's session. */
  user: null as null | { id: string },
  actor: null as null | Record<string, unknown>,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (c: Array<{ name: string; value: string; options?: object }>) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        if (h.user) return { data: { user: h.user }, error: null };
        // What a session ended elsewhere looks like: Supabase refuses it and
        // the client clears the cookie it can no longer use.
        options.cookies.setAll([{ name: 'sb-test-auth-token', value: '', options: { maxAge: 0, path: '/' } }]);
        return {
          data: { user: null },
          error: { name: 'AuthApiError', status: 403, code: 'session_not_found', message: 'Session from session_id claim in JWT does not exist' },
        };
      },
    },
  }),
}));

vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/auth/authorize', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/authorize')>()),
  currentActor: async () => h.actor,
}));

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  h.user = null;
  h.actor = null;
  for (const [key, value] of Object.entries(ENV)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
});

afterEach(() => {
  for (const key of Object.keys(ENV)) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const ACCOUNT = 'https://headway.test/workspace/client1/account';

async function middleware(request: NextRequest) {
  const mod = await import('@/middleware');
  return mod.middleware(request);
}

function serverAction(url = ACCOUNT) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'next-action': '7f3a9c', 'content-type': 'text/plain;charset=UTF-8' },
    body: '[]',
  });
}

describe('middleware, when the session has ended', () => {
  it('still sends a page load to sign in', async () => {
    const res = await middleware(new NextRequest(ACCOUNT));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get('location') ?? '');
    expect(to.pathname).toBe('/login');
    expect(to.searchParams.get('next')).toBe('/workspace/client1/account');
  });

  it('lets a form submission through to its action instead of redirecting it — with the dead cookie cleared', async () => {
    const res = await middleware(serverAction());
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.cookies.get('sb-test-auth-token')?.value).toBe('');
  });

  it('redirects any other POST as before', async () => {
    const res = await middleware(new NextRequest(ACCOUNT, { method: 'POST', body: 'x=1' }));
    expect(res.status).toBe(307);
  });

  it('does the same when Supabase is not configured at all', async () => {
    delete process.env.SUPABASE_URL;
    expect((await middleware(serverAction())).headers.get('x-middleware-next')).toBe('1');
    expect((await middleware(new NextRequest(ACCOUNT))).status).toBe(307);
  });

  it('changes nothing for a live session', async () => {
    h.user = { id: 'auth-owner' };
    const page = await middleware(new NextRequest(ACCOUNT));
    expect(page.headers.get('x-middleware-next')).toBe('1');
    const action = await middleware(serverAction());
    expect(action.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('the action gates, when the session has ended', () => {
  function form(clientId = 'client1') {
    const data = new FormData();
    data.set('clientId', clientId);
    return data;
  }

  it('tell the person to sign in again, rather than that they have no access', async () => {
    const { tenantGate, adminGate, SIGNED_OUT_MESSAGE } = await import('@/lib/auth/guard');
    const { DENIED_MESSAGE } = await import('@/lib/auth/authorize');

    const tenant = await tenantGate(form(), 'MEMBER');
    expect(tenant.ok).toBe(false);
    if (!tenant.ok) expect(tenant.state.message).toBe(SIGNED_OUT_MESSAGE);

    const admin = await adminGate();
    expect(admin.ok).toBe(false);
    if (!admin.ok) expect(admin.state.message).toBe(SIGNED_OUT_MESSAGE);

    expect(SIGNED_OUT_MESSAGE).not.toBe(DENIED_MESSAGE);
    // Names nothing about any business: a stranger learns nothing from it.
    expect(SIGNED_OUT_MESSAGE).not.toMatch(/business|client|exist|found|owner/i);
  });

  it('still refuse a signed-in person the same way whether the business is missing or not theirs', async () => {
    h.actor = {
      userId: 'u1',
      email: 'someone@example.com',
      isPlatformAdmin: false,
      status: 'ACTIVE',
      memberships: [{ clientId: 'theirs', role: 'BUSINESS_OWNER', status: 'ACTIVE' }],
      temporaryAccessClientId: null,
    };
    const { tenantGate, adminGate } = await import('@/lib/auth/guard');
    const { DENIED_MESSAGE } = await import('@/lib/auth/authorize');
    const notTheirs = await tenantGate(form('someone-else'), 'MEMBER');
    expect(!notTheirs.ok && notTheirs.state.message).toBe(DENIED_MESSAGE);
    const admin = await adminGate();
    expect(!admin.ok && admin.state.message).toBe(DENIED_MESSAGE);
  });
});
