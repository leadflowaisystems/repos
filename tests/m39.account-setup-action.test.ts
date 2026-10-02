import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * completeAccountSetupAction: THE ORDER OF THE THREE STEPS (M39, M52).
 *
 *   1. the new password, on the owner's OWN Supabase session — nothing in
 *      RepOS has moved yet, so a refusal here changes nothing;
 *   2. RepOS's record (`finalizeAccountSetup`), only once Supabase accepted
 *      the password — tried twice, and never described as "nothing changed"
 *      after the password is already set;
 *   3. the real email, last, through the owner's session's own
 *      `updateUser({ email })` — the one email in the handover, a link the
 *      owner must open before the address counts. A problem sending it never
 *      undoes the password: it is reported on Account, where it can be asked
 *      for again.
 *
 * Nothing here may use the admin API to set the email (that would trust an
 * address nobody has proved they read), and no password may ever come back
 * to the browser. Every collaborator is mocked: this file is about wiring.
 */

const h = vi.hoisted(() => ({
  calls: [] as string[],
  validateAccountSetup: vi.fn(),
  finalizeAccountSetup: vi.fn(),
  findUnique: vi.fn(),
  accessFindUnique: vi.fn(),
  clientUpdate: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  setIdentityPassword: vi.fn(),
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
  prisma: {
    user: { findUnique: h.findUnique },
    accountAccess: { findUnique: h.accessFindUnique },
    client: { update: h.clientUpdate },
  },
  currentAuthIdentity: vi.fn(),
  withRlsContext: vi.fn(),
}));

vi.mock('@/lib/auth/guard', () => ({
  adminGate: vi.fn(),
  tenantGate: vi.fn(async () => ({
    ok: true,
    actor: { userId: 'owner1', email: 'xyz12345@access.headway.local', isPlatformAdmin: false, status: 'ACTIVE', memberships: [] },
    clientId: 'client1',
    role: 'BUSINESS_OWNER',
  })),
}));

vi.mock('@/lib/auth/supabase', () => ({
  supabaseConfig: () => ({ ok: true, config: { url: 'https://x.supabase.co', anonKey: 'anon' } }),
  supabaseServerClient: async () => ({ auth: { getUser: h.getUser, updateUser: h.updateUser } }),
  detachedAuthClient: vi.fn(),
  SUPABASE_URL_VAR: 'SUPABASE_URL',
}));

vi.mock('@/lib/auth/redirect', () => ({
  authRedirectUrl: async (path: string) => `https://headway.test${path}`,
  emailConfirmCallback: (next: string) => `/auth/callback?next=${encodeURIComponent(next)}&kind=email`,
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  setIdentityPassword: h.setIdentityPassword,
  createTempIdentity: vi.fn(),
  deleteIdentity: vi.fn(),
  getIdentitySnapshot: vi.fn(),
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

const VALID = { clientId: 'client1', name: 'Priya', phone: '98765', email: 'new-owner@example.com' };

/** updateUser is called twice on the happy path: password first, then email. */
function supabaseAccepts(emailError: unknown = null) {
  h.updateUser.mockImplementation(async (attributes: { password?: string; email?: string }) => {
    if (attributes.password) {
      h.calls.push('password');
      expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
      return { data: {}, error: null };
    }
    h.calls.push('email');
    expect(h.finalizeAccountSetup).toHaveBeenCalled();
    return { data: {}, error: emailError };
  });
}

beforeEach(() => {
  h.calls.length = 0;
  for (const mock of [h.validateAccountSetup, h.finalizeAccountSetup, h.findUnique, h.accessFindUnique, h.clientUpdate, h.getUser, h.updateUser, h.setIdentityPassword]) {
    mock.mockReset();
  }
  h.findUnique.mockResolvedValue({ authProviderId: 'auth-owner-1' });
  h.clientUpdate.mockResolvedValue({});
  h.getUser.mockResolvedValue({ data: { user: { id: 'auth-owner-1', email: 'xyz12345@access.headway.local' } }, error: null });
  h.finalizeAccountSetup.mockImplementation(async () => {
    h.calls.push('finalize');
    return true;
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('completeAccountSetupAction — the happy path', () => {
  it('sets the password, then commits, then asks Supabase to confirm the email — in that order', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    supabaseAccepts();

    const outcome = await run();

    expect(outcome).toBe('redirected');
    expect(h.calls).toEqual(['password', 'finalize', 'email', 'redirect:/workspace/client1/account?setup=sent']);
    expect(h.updateUser).toHaveBeenNthCalledWith(1, { password: 'a-new-password' });
    expect(h.updateUser).toHaveBeenNthCalledWith(2, { email: 'new-owner@example.com' }, {
      emailRedirectTo:
        'https://headway.test/auth/callback?next=%2Fworkspace%2Fclient1%2Faccount%3Femail%3Dconfirmed&kind=email',
    });
    expect(h.finalizeAccountSetup).toHaveBeenCalledWith(expect.anything(), 'owner1', VALID);
    // The business's contact email follows an address Supabase accepted.
    expect(h.clientUpdate).toHaveBeenCalledWith({ where: { id: 'client1' }, data: { ownerEmail: 'new-owner@example.com' } });
  });

  it('never uses the admin API: the email is not trusted until the owner opens the link', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    supabaseAccepts();
    await run();
    expect(h.setIdentityPassword).not.toHaveBeenCalled();
  });

  it('treats "same password" on a resubmission as already set, and finishes', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    h.updateUser
      .mockResolvedValueOnce({ data: {}, error: { code: 'same_password', status: 422, message: 'New password should be different from the old password.' } })
      .mockResolvedValueOnce({ data: {}, error: null });

    expect(await run()).toBe('redirected');
    expect(h.finalizeAccountSetup).toHaveBeenCalledTimes(1);
    expect(h.calls.at(-1)).toBe('redirect:/workspace/client1/account?setup=sent');
  });
});

describe('completeAccountSetupAction — the email step', () => {
  it.each([
    [{ code: 'email_exists', status: 422, message: 'A user with this email address has already been registered' }, 'taken'],
    [{ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' }, 'wait'],
    [{ code: 'email_address_invalid', status: 400, message: 'Email address "xyz12345@access.headway.local" is invalid' }, 'failed'],
    [{ code: 'unexpected_failure', status: 500, message: 'Error sending email change email' }, 'failed'],
  ])('reports %o on Account as setup=%s, with the password kept', async (error, flag) => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    supabaseAccepts(error);

    expect(await run()).toBe('redirected');
    expect(h.finalizeAccountSetup).toHaveBeenCalledTimes(1);
    expect(h.calls.at(-1)).toBe(`redirect:/workspace/client1/account?setup=${flag}`);
    // A refused address — above all a taken one — never becomes the business's contact.
    expect(h.clientUpdate).not.toHaveBeenCalled();
  });
});

describe('completeAccountSetupAction — refusals change nothing', () => {
  it('never calls Supabase or finalize when validation refused, and keeps what was typed', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({
      ok: false,
      message: 'Some fields need attention.',
      errors: { email: 'That email is already in use by another account.' },
    });

    const outcome = (await run({ email: 'taken@example.com' })) as State;

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.email).toBeTruthy();
    expect(outcome.data).toEqual({ name: 'Priya', phone: '98765', email: 'taken@example.com' });
    expect(JSON.stringify(outcome)).not.toContain('a-new-password');
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
  });

  it("puts a weak password on the password field, in Supabase's own wording", async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    h.updateUser.mockResolvedValueOnce({
      data: {},
      error: { code: 'weak_password', status: 422, message: 'Password should be at least 10 characters.' },
    });

    const outcome = (await run()) as State;

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.password).toBe('Password should be at least 10 characters.');
    expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
    expect(h.updateUser).toHaveBeenCalledTimes(1);
    expect(h.calls).toEqual([]);
  });

  it('asks for a fresh sign-in when Supabase wants reauthentication', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    h.updateUser.mockResolvedValueOnce({
      data: {},
      error: { code: 'reauthentication_needed', status: 400, message: 'Password update requires reauthentication' },
    });

    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/sign in again/);
    expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
  });

  it('says nothing was changed when Supabase refuses for any other reason', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    h.updateUser.mockResolvedValueOnce({ data: {}, error: { code: 'unexpected_failure', status: 500, message: 'x' } });

    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/Nothing was changed/);
    expect(h.finalizeAccountSetup).not.toHaveBeenCalled();
  });

  it('refuses when the browser session is not the identity this owner row names', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    h.getUser.mockResolvedValueOnce({ data: { user: { id: 'somebody-else' } }, error: null });

    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('refuses when there is no session at all', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    h.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'no session' } });

    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('stops — and sends no email — when an admin disabled the access first', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    supabaseAccepts();
    h.finalizeAccountSetup.mockResolvedValueOnce(false);
    h.accessFindUnique.mockResolvedValueOnce({ status: 'DISABLED' });

    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/turned off/);
    expect(h.calls).not.toContain('email');
  });
});

describe('completeAccountSetupAction when the database drops after Supabase accepted', () => {
  it('a first commit whose reply was lost is still a finished setup, not "turned off"', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    supabaseAccepts();
    h.finalizeAccountSetup
      .mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))
      .mockResolvedValueOnce(false);
    h.accessFindUnique.mockResolvedValueOnce({ status: 'SETUP_COMPLETE' });

    expect(await run()).toBe('redirected');
    expect(h.calls).toContain('email');
    expect(h.calls.at(-1)).toBe('redirect:/workspace/client1/account?setup=sent');
  });

  it('tries the commit once more, and finishes normally when that works', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    supabaseAccepts();
    h.finalizeAccountSetup.mockRejectedValueOnce(new Error('Can’t reach database server'));

    expect(await run()).toBe('redirected');
    expect(h.finalizeAccountSetup).toHaveBeenCalledTimes(2);
    expect(h.calls).toContain('email');
  });

  it('never says "nothing changed" once Supabase has the new password, and asks for one more submit', async () => {
    h.validateAccountSetup.mockResolvedValueOnce({ ok: true, data: VALID });
    supabaseAccepts();
    h.finalizeAccountSetup.mockRejectedValue(new Error('Can’t reach database server'));

    const outcome = (await run()) as State;
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('Your new password is saved');
    expect(outcome.message).toContain('submit this form once more');
    expect(outcome.message).not.toContain('Nothing was changed');
    expect(h.finalizeAccountSetup).toHaveBeenCalledTimes(2);
    // No email for a setup RepOS has not recorded yet.
    expect(h.calls).not.toContain('email');
  });
});
