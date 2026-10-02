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
 * Supabase and the database are mocked; this file is about routing.
 */

const h = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  provisionUser: vi.fn(),
  loadActor: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/auth/supabase', () => ({
  supabaseServerClient: async () => ({
    auth: { verifyOtp: h.verifyOtp, exchangeCodeForSession: h.exchangeCodeForSession },
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

async function visit(query: string): Promise<string> {
  const { GET } = await import('@/app/auth/callback/route');
  const response = await GET(new NextRequest(`https://headway.test/auth/callback?${query}`));
  const location = response.headers.get('location') ?? '';
  return location.replace('https://headway.test', '');
}

beforeEach(() => {
  for (const mock of Object.values(h)) mock.mockReset();
  h.provisionUser.mockResolvedValue({ userId: 'u1', created: false });
  h.loadActor.mockResolvedValue(OWNER);
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
    expect(h.provisionUser).toHaveBeenCalledWith({}, { providerId: 'auth1', email: 'new@example.com' });
  });

  it('an owner’s own login confirmed from its email lands on Account, saying so', async () => {
    h.verifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-own', email: 'owner@example.com' } }, error: null });

    expect(await visit('token_hash=abc&type=signup')).toBe('/workspace/client1/account?email=confirmed');
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'signup' });
    expect(h.provisionUser).toHaveBeenCalledWith({}, { providerId: 'auth-own', email: 'owner@example.com' });
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
