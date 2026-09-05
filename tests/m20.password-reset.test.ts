import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PASSWORD RESET CANNOT FINISH HALF-DONE (M20).
 *
 * Two systems move here and only one of them can be undone. Supabase Auth owns
 * the password and cannot join a Prisma transaction, so there is no honest way
 * to make this atomic. What IS a choice is the order, and the order decides
 * which inconsistent state is reachable.
 *
 * Password first — the shipped order until now — makes the unforgivable state
 * reachable: the password really has changed, the internal write fails, and the
 * person is told it did not work. They cannot sign in with either password and
 * nothing in the product explains why. It was not a rare race, either. The
 * internal write bumps `sessionVersion`, a column `repos_app` deliberately
 * holds no privilege on, so under the real runtime role it failed EVERY time.
 *
 * Bump first inverts it. The only reachable failure is that sessions were
 * invalidated and the password was not: the old password still works, asking
 * for a new link is a path the person can find, and signing out too eagerly
 * costs one sign-in and corrects itself.
 *
 * So these tests are about ordering and about what is reported, which is the
 * whole of the fix. The database half — that the bump actually succeeds as
 * `repos_app` — is proven in `tests/m20.runtime-role.test.ts`.
 */

/** Every externally visible step, in the order it happened. */
let calls: string[] = [];
/** What the mocked collaborators should do this time. */
let sessionUser: { id: string } | null = null;
let internalUserId: string | null = null;
let bumpFails = false;
let updateUserFails = false;

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    calls.push(`redirect:${to}`);
    // The real one throws to unwind the action, and the code under test must
    // not be written in a way that swallows it.
    throw new Error('NEXT_REDIRECT');
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/auth/supabase', () => ({
  SUPABASE_URL_VAR: 'SUPABASE_URL',
  SUPABASE_ANON_KEY_VAR: 'SUPABASE_ANON_KEY',
  supabaseConfig: () => ({ ok: true, config: { url: 'http://localhost', anonKey: 'test' } }),
  isSupabaseConfigured: () => true,
  supabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: sessionUser }, error: null }),
      updateUser: async () => {
        calls.push('supabase.updateUser');
        return updateUserFails ? { error: { message: 'nope' } } : { error: null };
      },
      signOut: async () => ({ error: null }),
    },
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: {},
  currentUserId: async () => internalUserId,
  currentAuthUserId: async () => sessionUser?.id ?? null,
  withRlsContext: async () => undefined,
  isMissingDbFunction: () => false,
}));

vi.mock('@/lib/tenancy/service', () => ({
  ROLE_OWNER: 'BUSINESS_OWNER',
  ROLE_STAFF: 'BUSINESS_STAFF',
  ACTIVE: 'ACTIVE',
  loadActor: async () => null,
  provisionUser: async () => ({ userId: 'u1', created: false }),
  createClientRow: async () => 'c1',
  bumpSessionVersion: async () => {
    calls.push('bumpSessionVersion');
    if (bumpFails) throw new Error('permission denied for table User');
  },
}));

const { updatePasswordAction } = await import('@/lib/actions/account');

function form(password: string): FormData {
  const data = new FormData();
  data.set('password', password);
  return data;
}

const IDLE = { ok: false, message: '', errors: {} };

/** Runs the action, turning the redirect throw into an observable outcome. */
async function run(password: string) {
  try {
    return await updatePasswordAction(IDLE, form(password));
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') return 'redirected' as const;
    throw error;
  }
}

beforeEach(() => {
  calls = [];
  sessionUser = { id: '22222222-2222-4222-8222-222222222222' };
  internalUserId = 'u_owner';
  bumpFails = false;
  updateUserFails = false;
});

describe('a reset that works', () => {
  it('invalidates sessions BEFORE changing the password, then sends them to sign in', async () => {
    expect(await run('a-good-password')).toBe('redirected');

    expect(calls).toEqual(['bumpSessionVersion', 'supabase.updateUser', 'redirect:/login']);
  });

  it('still sets the password when there is no internal row to invalidate', async () => {
    // A recovery link for an identity RepOS has never provisioned. There are no
    // RepOS sessions to end, so there is nothing to bump — but the person must
    // still get their password changed.
    internalUserId = null;

    expect(await run('a-good-password')).toBe('redirected');
    expect(calls).toEqual(['supabase.updateUser', 'redirect:/login']);
  });
});

describe('the failure path that mattered', () => {
  it('never touches the password once the internal write has failed', async () => {
    bumpFails = true;

    const result = await run('a-good-password');

    // The report of failure is TRUE: nothing was changed.
    expect(result).toEqual({
      ok: false,
      message: 'That password could not be set.',
      errors: {},
    });
    expect(calls).toEqual(['bumpSessionVersion']);
    expect(calls).not.toContain('supabase.updateUser');
  });

  it('reports failure when Supabase refuses, leaving only the safe residue', async () => {
    updateUserFails = true;

    const result = await run('a-good-password');

    expect(result).toMatchObject({ ok: false, message: 'That password could not be set.' });
    // Sessions were ended and the password was not changed. The old one still
    // works, so the person can ask for another link and try again.
    expect(calls).toEqual(['bumpSessionVersion', 'supabase.updateUser']);
  });
});

describe('nothing about authentication got weaker', () => {
  it('refuses a short password without touching either system', async () => {
    const result = await run('short');

    expect(result).toMatchObject({ ok: false, errors: { password: 'Use at least 8 characters.' } });
    expect(calls).toEqual([]);
  });

  it('refuses when the recovery session is gone', async () => {
    sessionUser = null;

    const result = await run('a-good-password');

    expect(result).toMatchObject({
      ok: false,
      message: 'That reset link is no longer valid. Ask for a new one.',
    });
    expect(calls).toEqual([]);
  });
});
