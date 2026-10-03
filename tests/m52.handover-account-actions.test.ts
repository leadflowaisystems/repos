import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AFTER SETUP: CHANGING THE PASSWORD, AND FORGOT PASSWORD
 * (M52).
 *
 *   - changePasswordAction needs the CURRENT password, checked on a client
 *     that cannot touch this browser's session, and then changes it on the
 *     owner's own session (which ends every other one). Passwords never come
 *     back to the browser.
 *   - requestPasswordResetAction sends nothing to a temporary address (it can
 *     receive nothing), and says the same sentence whatever happens.
 *
 * Every collaborator is mocked; this file is about wiring and messages.
 */

const h = vi.hoisted(() => ({
  identity: { id: 'auth1', email: 'owner@example.com' } as { id: string; email: string } | null,
  detachedSignIn: vi.fn(),
  detachedSignOut: vi.fn(),
  updateUser: vi.fn(),
  sessionSignIn: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  setIdentityPassword: vi.fn(),
  userFindUnique: vi.fn(),
  accessFindUnique: vi.fn(),
  clientUpdate: vi.fn(),
  gate: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: h.userFindUnique },
    accountAccess: { findUnique: h.accessFindUnique },
    client: { update: h.clientUpdate },
  },
  currentAuthIdentity: async () => h.identity,
  currentUserId: async () => 'u1',
  withRlsContext: vi.fn(),
}));

vi.mock('@/lib/auth/guard', () => ({ adminGate: vi.fn(), tenantGate: h.gate }));

vi.mock('@/lib/auth/supabase', () => ({
  SUPABASE_URL_VAR: 'SUPABASE_URL',
  supabaseConfig: () => ({ ok: true, config: { url: 'https://x.supabase.co', anonKey: 'anon' } }),
  supabaseServerClient: async () => ({
    auth: {
      updateUser: h.updateUser,
      signInWithPassword: h.sessionSignIn,
      resetPasswordForEmail: h.resetPasswordForEmail,
    },
  }),
  detachedAuthClient: () => ({ auth: { signInWithPassword: h.detachedSignIn, signOut: h.detachedSignOut } }),
}));

vi.mock('@/lib/auth/redirect', () => ({
  authRedirectUrl: async (path: string) => `https://headway.test${path}`,
  callbackFor: (next: string) => `/auth/callback?next=${encodeURIComponent(next)}`,
  emailConfirmCallback: (next: string) => `/auth/callback?next=${encodeURIComponent(next)}&kind=email`,
  safeNextPath: (v: string) => v,
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  setIdentityPassword: h.setIdentityPassword,
  createTempIdentity: vi.fn(),
  deleteIdentity: vi.fn(),
  getIdentitySnapshot: vi.fn(),
  randomizeIdentityPassword: vi.fn(),
}));

vi.mock('@/lib/tenancy/service', () => ({
  ACTIVE: 'ACTIVE',
  ROLE_OWNER: 'BUSINESS_OWNER',
  IdentityConflictError: class extends Error {},
  provisionUser: vi.fn(),
  loadActor: vi.fn(),
  bumpSessionVersion: vi.fn(),
}));

type State = { ok: boolean; message: string; errors: Record<string, string> };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const IDLE = { ok: false, message: '', errors: {} };

beforeEach(() => {
  for (const mock of [h.detachedSignIn, h.detachedSignOut, h.updateUser, h.sessionSignIn, h.resetPasswordForEmail, h.setIdentityPassword, h.userFindUnique, h.accessFindUnique, h.clientUpdate, h.gate]) {
    mock.mockReset();
  }
  h.identity = { id: 'auth1', email: 'owner@example.com' };
  h.gate.mockResolvedValue({
    ok: true,
    actor: { userId: 'u1', email: 'owner@example.com', isPlatformAdmin: false, status: 'ACTIVE', memberships: [] },
    clientId: 'client1',
    role: 'BUSINESS_OWNER',
  });
  h.detachedSignIn.mockResolvedValue({ data: { user: { id: 'auth1' }, session: { access_token: 't' } }, error: null });
  h.detachedSignOut.mockResolvedValue({ error: null });
  h.updateUser.mockResolvedValue({ data: {}, error: null });
  h.clientUpdate.mockResolvedValue({});
  h.userFindUnique.mockResolvedValue(null);
  // Set up already: the normal state for both forms on Account.
  h.accessFindUnique.mockResolvedValue({ clientId: 'client1', status: 'SETUP_COMPLETE', setupCompletedAt: new Date() });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('changePasswordAction', () => {
  async function change(fields: Partial<Record<'currentPassword' | 'password' | 'confirmPassword', string>> = {}) {
    const { changePasswordAction } = await import('@/lib/actions/account-access');
    return (await changePasswordAction(
      IDLE,
      form({ clientId: 'client1', currentPassword: 'old-password', password: 'new-password-1', confirmPassword: 'new-password-1', ...fields }),
    )) as State;
  }

  it('checks the current password on a detached client, ends that check, then changes it on the owner’s own session', async () => {
    const result = await change();

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/password has been changed/);
    expect(h.detachedSignIn).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'old-password' });
    expect(h.detachedSignOut).toHaveBeenCalledWith({ scope: 'local' });
    // The current password rides along for projects that require it.
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'new-password-1', current_password: 'old-password' });
    expect(h.setIdentityPassword).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/old-password|new-password-1/);
  });

  it('refuses a wrong current password on its own field, and changes nothing', async () => {
    h.detachedSignIn.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 400, message: 'Invalid login credentials' } });

    const result = await change();
    expect(result.ok).toBe(false);
    expect(result.errors.currentPassword).toBe('That is not your current password.');
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('refuses a mismatch, a short password, a blank current one, and a new one equal to the current', async () => {
    expect((await change({ confirmPassword: 'new-password-2' })).errors.confirmPassword).toMatch(/do not match/);
    expect((await change({ password: 'short', confirmPassword: 'short' })).errors.password).toMatch(/at least 8/);
    expect((await change({ currentPassword: '' })).errors.currentPassword).toMatch(/current password/);
    expect((await change({ password: 'old-password', confirmPassword: 'old-password' })).errors.password).toMatch(/different/);
    expect(h.detachedSignIn).not.toHaveBeenCalled();
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('refuses the temporary password from a handover sheet as the new one (M53)', async () => {
    const result = await change({ password: 'Kq7m-x3pa-9fne-t2wd', confirmPassword: 'Kq7m-x3pa-9fne-t2wd' });
    expect(result.errors.password).toBe('Choose your own password, not the temporary one from Headway.');
    expect(h.detachedSignIn).not.toHaveBeenCalled();
    expect(h.updateUser).not.toHaveBeenCalled();
    // Typed without its hyphens, it is still the sheet's.
    expect((await change({ password: 'Kq7mx3pa9fnet2wd', confirmPassword: 'Kq7mx3pa9fnet2wd' })).errors.password).toBe(
      'Choose your own password, not the temporary one from Headway.',
    );
  });

  it('accepts an own password that merely looks like four groups of four', async () => {
    for (const own of ['Blue-Fish-Tree-Lamp', 'Ravi-1985-Pune-2024']) {
      expect(await change({ password: own, confirmPassword: own }), own).toMatchObject({ ok: true });
    }
  });

  it("puts Supabase's password policy on the new-password field", async () => {
    h.updateUser.mockResolvedValueOnce({ data: {}, error: { code: 'weak_password', message: 'Password should contain at least one character of each: abc, ABC, 123.' } });
    const result = await change();
    expect(result.ok).toBe(false);
    expect(result.errors.password).toMatch(/at least one character of each/);
  });

  it('a day-old session the project wants refreshed: sets it through the admin API and signs this browser straight back in', async () => {
    h.updateUser.mockResolvedValueOnce({ data: {}, error: { code: 'reauthentication_needed', message: 'Password update requires reauthentication' } });
    h.setIdentityPassword.mockResolvedValueOnce({ ok: true });
    h.sessionSignIn.mockResolvedValueOnce({ data: {}, error: null });

    const result = await change();
    expect(result.ok).toBe(true);
    expect(h.setIdentityPassword).toHaveBeenCalledWith('auth1', 'new-password-1');
    expect(h.sessionSignIn).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'new-password-1' });
    expect(result.message).not.toMatch(/sign in again/);
  });

  it('...and says to sign in again when signing straight back in did not work', async () => {
    h.updateUser.mockResolvedValueOnce({ data: {}, error: { code: 'reauthentication_needed', message: 'x' } });
    h.setIdentityPassword.mockResolvedValueOnce({ ok: true });
    h.sessionSignIn.mockResolvedValueOnce({ data: {}, error: { status: 429, message: 'Request rate limit reached' } });

    const result = await change();
    expect(result.ok).toBe(true);
    expect(result.message).toBe('Your password has been changed. Please sign in again with your new password.');
  });

  it('is refused on a temporary login: the owner changes their own password signed in with their own email', async () => {
    h.gate.mockResolvedValueOnce({
      ok: true,
      actor: { userId: 'u1', email: 'x@access.headway.local', isPlatformAdmin: false, status: 'ACTIVE', memberships: [], temporaryAccessClientId: 'client1' },
      clientId: 'client1',
      role: 'BUSINESS_OWNER',
    });
    const result = await change();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/signed in with temporary access/);
    expect(h.detachedSignIn).not.toHaveBeenCalled();
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('is refused by the tenant gate for a business that is not the person’s own', async () => {
    h.gate.mockResolvedValueOnce({ ok: false, state: { ok: false, message: 'You do not have access to that.', errors: {} } });
    const result = await change();
    expect(result.message).toBe('You do not have access to that.');
    expect(h.detachedSignIn).not.toHaveBeenCalled();
  });
});

describe('requestPasswordResetAction', () => {
  async function forgot(email: string) {
    const { requestPasswordResetAction } = await import('@/lib/actions/account');
    return (await requestPasswordResetAction(IDLE, form({ email }))) as State;
  }

  it('asks Supabase for a reset email to a real address, and says the same sentence', async () => {
    h.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const result = await forgot('Owner@Example.com');
    expect(result).toMatchObject({ ok: true, message: 'If that address has an account, a reset link is on its way.' });
    expect(h.resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', {
      redirectTo: 'https://headway.test/auth/callback?next=%2Freset-password',
    });
  });

  it('sends nothing to a temporary address, which could never receive it — same sentence', async () => {
    const result = await forgot('abcd2345@access.headway.local');
    expect(result.message).toBe('If that address has an account, a reset link is on its way.');
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('logs a refusal (with no address in it) but never shows it — that would say who has an account', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' } });

    const result = await forgot('owner@example.com');
    expect(result.message).toBe('If that address has an account, a reset link is on its way.');
    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain('owner@example.com');
  });
});

describe('the temporary password', () => {
  it('is four readable groups that satisfy every character rule Supabase can enforce', async () => {
    const { generateTemporaryPassword } = await import('@/lib/account-access/service');
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/);
      expect(password).toMatch(/[a-z]/);
      // Exactly one capital: the first letter, wherever it falls.
      expect(password.replace(/[^A-Z]/g, '')).toHaveLength(1);
      expect(password.search(/[A-Z]/)).toBe(password.search(/[A-Za-z]/));
      expect(password).toMatch(/[0-9]/);
      // No i, l, o or 1 anywhere: nothing to misread as its neighbour.
      expect(password.toLowerCase()).not.toMatch(/[ilo1]/);
      seen.add(password);
    }
    expect(seen.size).toBe(2000);
  });
});
