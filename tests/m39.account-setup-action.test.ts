import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * completeAccountSetupAction: THE ORDER OF THE THREE STEPS (M39, M52).
 *
 *   1. Supabase creates the owner's OWN login — real email, own password —
 *      unconfirmed. Nothing in RepOS has moved yet, so a refusal here changes
 *      nothing.
 *   2. RepOS records it on the same owner User (`finalizeAccountSetup`). If
 *      that cannot be written, the new login is removed again: nothing
 *      half-made is left.
 *   3. The owner's own session asks Supabase for the confirmation email — the
 *      one email in the handover. The login works only once that link is
 *      opened; a problem sending it never undoes steps 1–2.
 *
 * The temporary login is never touched here. No password ever comes back to
 * the browser. Every collaborator is mocked: this file is about wiring.
 */

const h = vi.hoisted(() => ({
  calls: [] as string[],
  validateAccountSetup: vi.fn(),
  finalizeAccountSetup: vi.fn(),
  currentAuthIdentity: vi.fn(),
  createOwnerIdentity: vi.fn(),
  deleteIdentity: vi.fn(),
  deleteUnconfirmedIdentity: vi.fn(),
  getIdentitySnapshot: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    h.calls.push(`redirect:${to}`);
    // The real one throws to unwind the action; code under test must not be
    // written in a way that swallows it.
    throw new Error('NEXT_REDIRECT');
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

vi.mock('@/lib/db', () => ({
  prisma: {},
  currentAuthIdentity: h.currentAuthIdentity,
  withRlsContext: vi.fn(),
  isMissingDbFunction: () => false,
}));

vi.mock('@/lib/auth/guard', () => ({
  adminGate: vi.fn(),
  tenantGate: vi.fn(async () => ({
    ok: true,
    actor: { userId: 'owner1', email: 'xyz12345@access.headway.local', isPlatformAdmin: false, status: 'ACTIVE', memberships: [], temporaryAccessClientId: 'client1' },
    clientId: 'client1',
    role: 'BUSINESS_OWNER',
  })),
}));

vi.mock('@/lib/auth/supabase', () => ({
  supabaseConfig: () => ({ ok: true, config: { url: 'https://x.supabase.co', anonKey: 'anon' } }),
  supabaseServerClient: async () => ({ auth: { signUp: h.signUp } }),
  detachedAuthClient: vi.fn(),
  SUPABASE_URL_VAR: 'SUPABASE_URL',
}));

vi.mock('@/lib/auth/redirect', () => ({
  authRedirectUrl: async (path: string) => `https://headway.test${path}`,
  emailConfirmCallback: (next: string) => `/auth/callback?next=${encodeURIComponent(next)}&kind=email`,
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  createOwnerIdentity: h.createOwnerIdentity,
  deleteIdentity: h.deleteIdentity,
  deleteUnconfirmedIdentity: h.deleteUnconfirmedIdentity,
  getIdentitySnapshot: h.getIdentitySnapshot,
  setIdentityPassword: vi.fn(),
  createTempIdentity: vi.fn(),
  randomizeIdentityPassword: vi.fn(),
}));

vi.mock('@/lib/account-access/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/account-access/service')>()),
  validateAccountSetup: h.validateAccountSetup,
  finalizeAccountSetup: h.finalizeAccountSetup,
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

type State = { ok: boolean; message: string; errors: Record<string, string>; data?: Record<string, string> };

/** Runs the action, turning the redirect throw into an observable outcome. */
async function run(fields: Record<string, string> = {}): Promise<State | 'redirected'> {
  const { completeAccountSetupAction } = await import('@/lib/actions/account-access');
  const { IDLE } = await import('@/lib/actions/shared');
  try {
    return await completeAccountSetupAction(
      IDLE,
      form({
        clientId: 'client1',
        name: 'Priya',
        phone: '98765',
        email: 'New-Owner@Example.com',
        password: 'a-new-password',
        confirmPassword: 'a-new-password',
        ...fields,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') return 'redirected';
    throw error;
  }
}

const VALID = { clientId: 'client1', name: 'Priya', phone: '98765', email: 'new-owner@example.com', previousOwnAuthId: null };

beforeEach(() => {
  h.calls.length = 0;
  for (const mock of Object.values(h)) if (typeof mock === 'function') mock.mockReset();
  h.currentAuthIdentity.mockResolvedValue({ id: 'auth-temp', email: 'xyz12345@access.headway.local' });
  h.validateAccountSetup.mockResolvedValue({ ok: true, data: VALID });
  h.createOwnerIdentity.mockImplementation(async () => {
    h.calls.push('create');
    return { ok: true, authUserId: 'auth-own' };
  });
  h.finalizeAccountSetup.mockImplementation(async () => {
    h.calls.push('finalize');
    return true;
  });
  h.signUp.mockImplementation(async () => {
    h.calls.push('email');
    return { data: { user: { id: 'auth-own' }, session: null }, error: null };
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('completeAccountSetupAction — the happy path', () => {
  it('creates the own login, records it, then asks for the confirmation email — in that order', async () => {
    expect(await run()).toBe('redirected');

    expect(h.calls).toEqual(['create', 'finalize', 'email', 'redirect:/workspace/client1/account?setup=sent']);
    expect(h.validateAccountSetup).toHaveBeenCalledWith(expect.anything(), 'owner1', 'client1', 'auth-temp', {
      name: 'Priya',
      phone: '98765',
      email: 'New-Owner@Example.com',
      password: 'a-new-password',
      confirmPassword: 'a-new-password',
    });
    expect(h.createOwnerIdentity).toHaveBeenCalledWith('new-owner@example.com', 'a-new-password');
    expect(h.finalizeAccountSetup).toHaveBeenCalledWith(expect.anything(), 'owner1', 'auth-temp', VALID, 'auth-own');
    // The one email, through the owner's own session, back to Account.
    expect(h.signUp).toHaveBeenCalledWith({
      email: 'new-owner@example.com',
      password: 'a-new-password',
      options: {
        emailRedirectTo:
          'https://headway.test/auth/callback?next=%2Fworkspace%2Fclient1%2Faccount%3Femail%3Dconfirmed&kind=email',
      },
    });
    expect(h.deleteIdentity).not.toHaveBeenCalled();
  });

  it('a redo before the email is confirmed replaces the unconfirmed login, and only then', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: { ...VALID, previousOwnAuthId: 'auth-own-old' } });
    h.getIdentitySnapshot.mockResolvedValueOnce({ email: 'typo@example.com', confirmed: false, lastSignInAt: null });

    expect(await run()).toBe('redirected');
    expect(h.deleteUnconfirmedIdentity).toHaveBeenCalledWith('auth-own-old');
  });

  it('never redoes a setup whose own login is already confirmed', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: { ...VALID, previousOwnAuthId: 'auth-own-old' } });
    h.getIdentitySnapshot.mockResolvedValueOnce({ email: 'owner@example.com', confirmed: true, lastSignInAt: null });

    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/already set up/);
    expect(h.createOwnerIdentity).not.toHaveBeenCalled();
  });
});

describe('completeAccountSetupAction — the email step', () => {
  it.each([
    [{ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' }, 'wait'],
    [{ code: 'unexpected_failure', status: 500, message: 'Error sending confirmation email' }, 'failed'],
  ])('reports %o on Account as setup=%s, with the login recorded', async (error, flag) => {
    h.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error });

    expect(await run()).toBe('redirected');
    expect(h.finalizeAccountSetup).toHaveBeenCalledTimes(1);
    expect(h.calls.at(-1)).toBe(`redirect:/workspace/client1/account?setup=${flag}`);
  });

  it('treats a confirmation for any other login than the one just made as not sent', async () => {
    h.signUp.mockResolvedValueOnce({ data: { user: { id: 'someone-else' }, session: null }, error: null });
    expect(await run()).toBe('redirected');
    expect(h.calls.at(-1)).toBe('redirect:/workspace/client1/account?setup=failed');
  });
});

describe('completeAccountSetupAction — refusals leave nothing behind', () => {
  it('never calls Supabase when validation refused, and keeps what was typed (never the password)', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({
      ok: false,
      message: 'Some fields need attention.',
      errors: { email: 'That email is already in use by another account.' },
    });

    const outcome = (await run({ email: 'taken@example.com' })) as State;

    expect(outcome.ok).toBe(false);
    expect(outcome.data).toEqual({ name: 'Priya', phone: '98765', email: 'taken@example.com' });
    expect(JSON.stringify(outcome)).not.toContain('a-new-password');
    expect(h.createOwnerIdentity).not.toHaveBeenCalled();
    expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
  });

  it('puts a taken address on the email field, with nothing written', async () => {
    h.createOwnerIdentity.mockResolvedValueOnce({ ok: false, reason: 'EMAIL_TAKEN', message: 'already been registered' });
    const outcome = (await run()) as State;
    expect(outcome.errors.email).toMatch(/already in use/);
    expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it("puts Supabase's password policy on the password field", async () => {
    h.createOwnerIdentity.mockResolvedValueOnce({
      ok: false,
      reason: 'WEAK_PASSWORD',
      message: 'Password should be at least 10 characters.',
    });
    const outcome = (await run()) as State;
    expect(outcome.errors.password).toBe('Password should be at least 10 characters.');
    expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
  });

  it('removes the new login again when RepOS cannot record it', async () => {
    h.finalizeAccountSetup.mockRejectedValueOnce(new Error('Can’t reach database server'));
    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/Nothing was changed/);
    expect(h.deleteIdentity).toHaveBeenCalledWith('auth-own');
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('…and says the email is taken when the database says so', async () => {
    h.finalizeAccountSetup.mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`email`)'));
    const outcome = (await run()) as State;
    expect(outcome.errors.email).toMatch(/already in use/);
    expect(h.deleteIdentity).toHaveBeenCalledWith('auth-own');
  });

  it('removes the new login and stops when an admin switched temporary access off first', async () => {
    h.finalizeAccountSetup.mockResolvedValueOnce(false);
    const outcome = (await run()) as State;
    expect(outcome.message).toMatch(/turned off/);
    expect(h.deleteIdentity).toHaveBeenCalledWith('auth-own');
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('refuses when there is no session at all', async () => {
    h.currentAuthIdentity.mockResolvedValueOnce(null);
    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(h.validateAccountSetup).not.toHaveBeenCalled();
  });
});
