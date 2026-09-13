import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

/**
 * completeAccountSetupAction ORDERS THE ONE STEP THAT CANNOT BE UNDONE FIRST
 * (M39 follow-up).
 *
 * The bug this guards against: the database used to commit
 * AccountAccess = SETUP_COMPLETE BEFORE the action ever asked Supabase to
 * accept the new password and email — so a rejection from Supabase (an
 * email already claimed, a password policy this project enforces server-side
 * that RepOS's own zod schema does not check) landed on a database that
 * already claimed setup had finished, with the temporary password still the
 * only one that actually worked. `validateAccountSetup` now only validates
 * and writes nothing; `finalizeAccountSetup` is the commit. This file proves
 * the ACTION calls them in the right order: Supabase first, and
 * `finalizeAccountSetup` only when that succeeds — never on the failure
 * path, and never before it.
 *
 * Every collaborator is mocked, the same way `tests/m20.password-reset.test.ts`
 * tests `updatePasswordAction`'s own ordering: this file is about wiring, not
 * about the database or a real Supabase project.
 */

const {
  setPermanentCredentialsMock,
  validateAccountSetupMock,
  finalizeAccountSetupMock,
  findUniqueMock,
} = vi.hoisted(() => ({
  setPermanentCredentialsMock: vi.fn(),
  validateAccountSetupMock: vi.fn(),
  finalizeAccountSetupMock: vi.fn(),
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
  validateAccountSetup: validateAccountSetupMock,
  finalizeAccountSetup: finalizeAccountSetupMock,
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

const VALID = { clientId: 'client1', name: '', phone: '', email: 'new-owner@example.com' };

beforeEach(() => {
  calls = [];
  setPermanentCredentialsMock.mockReset();
  validateAccountSetupMock.mockReset();
  finalizeAccountSetupMock.mockReset();
  findUniqueMock.mockReset();
  findUniqueMock.mockResolvedValue({ authProviderId: 'auth-owner-1' });
});

describe('completeAccountSetupAction', () => {
  it('calls Supabase BEFORE finalizing, and finalizes only once Supabase has accepted it', async () => {
    validateAccountSetupMock.mockResolvedValueOnce({ ok: true, data: VALID });
    setPermanentCredentialsMock.mockImplementationOnce(async () => {
      // Proves the order at the moment it matters, not just after the fact:
      // finalize must not have run yet when Supabase is still being asked.
      expect(finalizeAccountSetupMock).not.toHaveBeenCalled();
      return { ok: true };
    });

    const outcome = await run({
      email: 'New-Owner@Example.com',
      password: 'a-new-password',
      confirmPassword: 'a-new-password',
    });

    expect(outcome).toBe('redirected');
    expect(setPermanentCredentialsMock).toHaveBeenCalledWith('auth-owner-1', 'a-new-password', 'new-owner@example.com');
    expect(finalizeAccountSetupMock).toHaveBeenCalledWith(expect.anything(), 'owner1', VALID);
    expect(calls).toEqual(['redirect:/login']);
  });

  it('never finalizes, and reports a clean failure, when Supabase rejects the update', async () => {
    validateAccountSetupMock.mockResolvedValueOnce({ ok: true, data: VALID });
    setPermanentCredentialsMock.mockResolvedValueOnce({ ok: false, message: 'email already registered' });

    const outcome = await run({
      email: 'New-Owner@Example.com',
      password: 'a-new-password',
      confirmPassword: 'a-new-password',
    });

    expect((outcome as { ok: boolean }).ok).toBe(false);
    expect(finalizeAccountSetupMock).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    // The whole point of the fix: this is not "saved but password failed" —
    // nothing was written, so the message must not claim otherwise.
    expect((outcome as { message: string }).message).not.toMatch(/saved/i);
  });

  it('passes undefined, not the blank string, when validation says no email was set', async () => {
    validateAccountSetupMock.mockResolvedValueOnce({ ok: true, data: { ...VALID, email: null } });
    setPermanentCredentialsMock.mockResolvedValueOnce({ ok: true });

    await run({ password: 'a-new-password', confirmPassword: 'a-new-password' });

    expect(setPermanentCredentialsMock).toHaveBeenCalledWith('auth-owner-1', 'a-new-password', undefined);
  });

  it('never calls Supabase or finalize when validation itself already refused', async () => {
    validateAccountSetupMock.mockResolvedValueOnce({
      ok: false,
      message: 'Some fields need attention.',
      errors: { email: 'That email is already in use by another account.' },
    });

    const outcome = await run({ email: 'taken@example.com', password: 'x', confirmPassword: 'x' });

    expect((outcome as { ok: boolean }).ok).toBe(false);
    expect(setPermanentCredentialsMock).not.toHaveBeenCalled();
    expect(finalizeAccountSetupMock).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("does not call Supabase or finalize if the actor's own authProviderId cannot be read", async () => {
    validateAccountSetupMock.mockResolvedValueOnce({ ok: true, data: VALID });
    (findUniqueMock as Mock).mockResolvedValueOnce(null);

    const outcome = await run({ password: 'a-new-password', confirmPassword: 'a-new-password' });

    expect((outcome as { ok: boolean }).ok).toBe(false);
    expect(setPermanentCredentialsMock).not.toHaveBeenCalled();
    expect(finalizeAccountSetupMock).not.toHaveBeenCalled();
  });
});
