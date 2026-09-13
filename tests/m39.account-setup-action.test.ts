import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

/**
 * completeAccountSetupAction HANDS THE EMAIL TO THE ONE MODULE ALLOWED TO
 * TOUCH IT (M39 follow-up).
 *
 * This is the orchestration half of the fix described in
 * `tests/m39.account-setup-credentials.test.ts`: given the service layer
 * already validated and returned the (possibly null) email to use, does the
 * action pass BOTH it and the password to `setPermanentCredentials` — the one
 * function allowed to read `SUPABASE_SERVICE_ROLE_KEY` — using the actor's
 * OWN `authProviderId`, never a value the browser supplied. And does a
 * failure there come back as an ordinary form failure rather than a raw
 * exception or a redirect the person never actually completed.
 *
 * Every collaborator is mocked, the same way `tests/m20.password-reset.test.ts`
 * tests `updatePasswordAction`'s own ordering: this file is about wiring, not
 * about the database or a real Supabase project.
 */

const { setPermanentCredentialsMock, completeAccountSetupMock, findUniqueMock } = vi.hoisted(() => ({
  setPermanentCredentialsMock: vi.fn(),
  completeAccountSetupMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

let calls: string[] = [];

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    calls.push(`redirect:${to}`);
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
  prisma: { user: { findUnique: findUniqueMock } },
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

vi.mock('@/lib/account-access/service', () => ({
  completeAccountSetup: completeAccountSetupMock,
  disableTempAccess: vi.fn(),
  generateTempAccess: vi.fn(),
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  setPermanentCredentials: setPermanentCredentialsMock,
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs the action, turning the redirect throw into an observable outcome. */
async function run(fields: Record<string, string>) {
  const { completeAccountSetupAction } = await import('@/lib/actions/account-access');
  const { IDLE } = await import('@/lib/actions/shared');
  try {
    return await completeAccountSetupAction(IDLE, form({ clientId: 'client1', ...fields }));
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') return 'redirected' as const;
    throw error;
  }
}

beforeEach(() => {
  calls = [];
  setPermanentCredentialsMock.mockReset();
  completeAccountSetupMock.mockReset();
  findUniqueMock.mockReset();
  findUniqueMock.mockResolvedValue({ authProviderId: 'auth-owner-1' });
});

describe('completeAccountSetupAction', () => {
  it('hands the authProviderId, the submitted password, and the validated email to setPermanentCredentials', async () => {
    completeAccountSetupMock.mockResolvedValueOnce({
      ok: true,
      data: { clientId: 'client1', email: 'new-owner@example.com' },
    });
    setPermanentCredentialsMock.mockResolvedValueOnce({ ok: true });

    const outcome = await run({
      name: 'Priya',
      email: 'New-Owner@Example.com',
      password: 'a-new-password',
      confirmPassword: 'a-new-password',
    });

    expect(outcome).toBe('redirected');
    expect(setPermanentCredentialsMock).toHaveBeenCalledWith(
      'auth-owner-1',
      'a-new-password',
      'new-owner@example.com',
    );
    expect(calls).toEqual(['redirect:/login']);
  });

  it('passes undefined (not the blank string) when the service says no email was set', async () => {
    completeAccountSetupMock.mockResolvedValueOnce({ ok: true, data: { clientId: 'client1', email: null } });
    setPermanentCredentialsMock.mockResolvedValueOnce({ ok: true });

    await run({ password: 'a-new-password', confirmPassword: 'a-new-password' });

    expect(setPermanentCredentialsMock).toHaveBeenCalledWith('auth-owner-1', 'a-new-password', undefined);
  });

  it('fails cleanly, without redirecting, when setPermanentCredentials fails', async () => {
    completeAccountSetupMock.mockResolvedValueOnce({ ok: true, data: { clientId: 'client1', email: null } });
    setPermanentCredentialsMock.mockResolvedValueOnce({ ok: false, message: 'email already registered' });

    const outcome = await run({ password: 'a-new-password', confirmPassword: 'a-new-password' });

    expect(outcome).not.toBe('redirected');
    expect((outcome as { ok: boolean }).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('never calls setPermanentCredentials when the service layer already refused', async () => {
    completeAccountSetupMock.mockResolvedValueOnce({
      ok: false,
      message: 'Some fields need attention.',
      errors: { email: 'That email is already in use by another account.' },
    });

    const outcome = await run({ email: 'taken@example.com', password: 'x', confirmPassword: 'x' });

    expect((outcome as { ok: boolean }).ok).toBe(false);
    expect(setPermanentCredentialsMock).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("does not proceed if the actor's own authProviderId cannot be read", async () => {
    completeAccountSetupMock.mockResolvedValueOnce({ ok: true, data: { clientId: 'client1', email: null } });
    (findUniqueMock as Mock).mockResolvedValueOnce(null);

    const outcome = await run({ password: 'a-new-password', confirmPassword: 'a-new-password' });

    expect((outcome as { ok: boolean }).ok).toBe(false);
    expect(setPermanentCredentialsMock).not.toHaveBeenCalled();
  });
});
