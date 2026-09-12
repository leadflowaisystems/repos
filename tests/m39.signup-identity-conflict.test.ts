import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

/**
 * THE SIGNUP 500, FIXED (M39).
 *
 * `app.provision_user` can refuse an email two ways — its own deliberate
 * anti-hijack check, and the plain race of two concurrent calls for the same
 * brand-new address — and both raise Postgres 23505. Before this, neither
 * `signUpAction` nor `signInAction` caught it: the raw Prisma exception
 * propagated out of the Server Action and Next.js turned it into an
 * unstyled 500.
 *
 * This does not exercise the real database at all — `provisionUser` is
 * mocked to throw the exact typed error the fix introduces
 * (`IdentityConflictError`), and every other collaborator (Supabase, the
 * public-URL lookup a fresh signup makes) is stubbed so the test is about
 * one thing: does the action catch this and answer normally, with the SAME
 * message an ordinary failure already gets — never a distinct "that email
 * already exists" message, which would let this form be used to ask whether
 * a given address has an account.
 */

// `vi.mock` factories are hoisted above every other statement in this file,
// so the mock functions they close over must be created through
// `vi.hoisted` rather than an ordinary `const` — a plain declaration here
// would still be `undefined` when the factory below actually runs.
const { signUpMock, signInMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInMock: vi.fn(),
}));

vi.mock('@/lib/auth/supabase', () => ({
  SUPABASE_URL_VAR: 'SUPABASE_URL',
  SUPABASE_ANON_KEY_VAR: 'SUPABASE_ANON_KEY',
  supabaseConfig: () => ({ ok: true, config: { url: 'http://localhost', anonKey: 'test' } }),
  isSupabaseConfigured: () => true,
  supabaseServerClient: async () => ({
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInMock,
      signOut: vi.fn(async () => ({ error: null })),
    },
  }),
}));

vi.mock('@/lib/auth/redirect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/redirect')>();
  // The real function reads AppSetting through Prisma, which this file never
  // sets up a database for. Nothing under test cares where the confirmation
  // link points, so it is stubbed rather than exercised.
  return { ...actual, authRedirectUrl: vi.fn(async () => undefined) };
});

vi.mock('@/lib/tenancy/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenancy/service')>();
  return { ...actual, provisionUser: vi.fn() };
});

beforeEach(() => {
  signUpMock.mockReset();
  signInMock.mockReset();
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('signUpAction', () => {
  it('answers the same generic failure for an identity conflict as for any other signup failure', async () => {
    const { signUpAction } = await import('@/lib/actions/account');
    const { provisionUser, IdentityConflictError } = await import('@/lib/tenancy/service');
    const { IDLE } = await import('@/lib/actions/shared');

    // Case 1: Supabase itself refuses (a real, ordinary failure).
    signUpMock.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: 'nope' } });
    const ordinary = await signUpAction(IDLE, form({ email: 'a@example.com', password: 'password1' }));

    // Case 2: Supabase accepts, but provisioning this email conflicts with a
    // different identity — the case that used to crash.
    signUpMock.mockResolvedValueOnce({
      data: { user: { id: 'auth-user-1' }, session: null },
      error: null,
    });
    (provisionUser as Mock).mockRejectedValueOnce(new IdentityConflictError());
    const conflict = await signUpAction(IDLE, form({ email: 'b@example.com', password: 'password1' }));

    expect(conflict.ok).toBe(false);
    expect(ordinary.ok).toBe(false);
    // The whole point: a stranger cannot tell these two failures apart.
    expect(conflict.message).toBe(ordinary.message);
    expect(conflict.message).not.toMatch(/already (has|have) an account|already exists|already registered/i);
  });

  it('does not throw — the raw Prisma exception never reaches the caller', async () => {
    const { signUpAction } = await import('@/lib/actions/account');
    const { provisionUser, IdentityConflictError } = await import('@/lib/tenancy/service');
    const { IDLE } = await import('@/lib/actions/shared');

    signUpMock.mockResolvedValueOnce({
      data: { user: { id: 'auth-user-2' }, session: null },
      error: null,
    });
    (provisionUser as Mock).mockRejectedValueOnce(new IdentityConflictError());

    await expect(
      signUpAction(IDLE, form({ email: 'c@example.com', password: 'password1' })),
    ).resolves.toMatchObject({ ok: false });
  });

  it('still lets a genuinely different failure through unmasked', async () => {
    // A safety check on the fix itself: only IdentityConflictError is caught.
    // Anything else thrown by provisionUser must still surface as a real
    // failure for whatever calls this action, not be silently swallowed.
    const { signUpAction } = await import('@/lib/actions/account');
    const { provisionUser } = await import('@/lib/tenancy/service');
    const { IDLE } = await import('@/lib/actions/shared');

    signUpMock.mockResolvedValueOnce({
      data: { user: { id: 'auth-user-3' }, session: null },
      error: null,
    });
    (provisionUser as Mock).mockRejectedValueOnce(new Error('a genuinely different failure'));

    await expect(
      signUpAction(IDLE, form({ email: 'd@example.com', password: 'password1' })),
    ).rejects.toThrow('a genuinely different failure');
  });
});

describe('signInAction', () => {
  it('answers the same generic failure for an identity conflict as for a wrong password', async () => {
    const { signInAction } = await import('@/lib/actions/account');
    const { provisionUser, IdentityConflictError } = await import('@/lib/tenancy/service');
    const { IDLE } = await import('@/lib/actions/shared');

    signInMock.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad password' } });
    const wrongPassword = await signInAction(
      IDLE,
      form({ email: 'a@example.com', password: 'nope', next: '' }),
    );

    signInMock.mockResolvedValueOnce({ data: { user: { id: 'auth-user-4' } }, error: null });
    (provisionUser as Mock).mockRejectedValueOnce(new IdentityConflictError());
    const conflict = await signInAction(
      IDLE,
      form({ email: 'b@example.com', password: 'password1', next: '' }),
    );

    expect(conflict.ok).toBe(false);
    expect(wrongPassword.ok).toBe(false);
    expect(conflict.message).toBe(wrongPassword.message);
  });
});
