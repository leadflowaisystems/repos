import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A TEMPORARY LOGIN OPENS ONE BUSINESS, AND JOINS OR MAKES NO OTHER (M52).
 *
 * Whoever holds a handover sheet signs in as that business's owner — and
 * nothing more. Accepting a team invitation is matched on the account's email,
 * so it must come from a login of the person's own, whose address they proved;
 * creating another business from the temporary login would hang a second
 * business off the handover too. Both are refused before anything is touched.
 * (The database half — a temporary login resolving to nobody for an owner who
 * is staff or belongs elsewhere — is in tests/m43.account-lifecycle-e2e.test.ts.)
 */

const h = vi.hoisted(() => ({
  actor: null as null | Record<string, unknown>,
  acceptInviteViaResolver: vi.fn(),
  completeOnboarding: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  RedirectType: { replace: 'replace', push: 'push' },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('@/lib/db', () => ({ prisma: { client: { findUnique: vi.fn() } }, currentUserId: async () => 'u1' }));
vi.mock('@/lib/auth/authorize', () => ({ currentActor: async () => h.actor }));
vi.mock('@/lib/auth/guard', () => ({ tenantGate: vi.fn() }));
vi.mock('@/lib/team/service', () => ({
  acceptInviteViaResolver: h.acceptInviteViaResolver,
  inviteMember: vi.fn(),
  revokeInvite: vi.fn(),
  setMembership: vi.fn(),
}));
vi.mock('@/lib/invite/email', () => ({ deliverInvitation: vi.fn(), invitationLink: vi.fn(), roleLabel: vi.fn() }));
vi.mock('@/lib/onboarding/service', () => ({ completeOnboarding: h.completeOnboarding, landingPathFor: vi.fn() }));
vi.mock('@/lib/auth/supabase', () => ({ supabaseConfig: () => ({ ok: true }), supabaseServerClient: vi.fn() }));

const OWN = {
  userId: 'u1',
  email: 'owner@example.com',
  isPlatformAdmin: false,
  status: 'ACTIVE',
  memberships: [{ clientId: 'c1', role: 'BUSINESS_OWNER', status: 'ACTIVE' }],
  temporaryAccessClientId: null,
};
const TEMPORARY = { ...OWN, email: 'abcd2345@access.headway.local', temporaryAccessClientId: 'c1' };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  h.acceptInviteViaResolver.mockReset();
  h.completeOnboarding.mockReset();
  h.acceptInviteViaResolver.mockResolvedValue({ ok: false, message: 'stop here', errors: {} });
  h.completeOnboarding.mockResolvedValue({ ok: false, message: 'stop here', errors: {} });
});

describe('acceptInviteAction', () => {
  it('refuses a temporary login before the invitation is even looked at', async () => {
    h.actor = TEMPORARY;
    const { acceptInviteAction } = await import('@/lib/actions/team');
    const { IDLE } = await import('@/lib/actions/shared');
    const outcome = await acceptInviteAction(IDLE, form({ token: 'tok' }));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/temporary access/);
    expect(h.acceptInviteViaResolver).not.toHaveBeenCalled();
  });

  it('goes on to the invitation for a login of the person’s own', async () => {
    h.actor = OWN;
    const { acceptInviteAction } = await import('@/lib/actions/team');
    const { IDLE } = await import('@/lib/actions/shared');
    await acceptInviteAction(IDLE, form({ token: 'tok' }));
    expect(h.acceptInviteViaResolver).toHaveBeenCalledWith(expect.anything(), 'tok', 'u1');
  });
});

describe('completeOnboardingAction', () => {
  it('refuses to create another business from a temporary login', async () => {
    h.actor = TEMPORARY;
    const { completeOnboardingAction } = await import('@/lib/actions/account');
    const { IDLE } = await import('@/lib/actions/shared');
    const outcome = await completeOnboardingAction(IDLE, form({ businessName: 'Another', vertical: 'salon' }));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/temporary access/);
    expect(h.completeOnboarding).not.toHaveBeenCalled();
  });

  it('goes on for a login of the person’s own', async () => {
    h.actor = OWN;
    const { completeOnboardingAction } = await import('@/lib/actions/account');
    const { IDLE } = await import('@/lib/actions/shared');
    await completeOnboardingAction(IDLE, form({ businessName: 'Another', vertical: 'salon' }));
    expect(h.completeOnboarding).toHaveBeenCalledTimes(1);
  });
});
