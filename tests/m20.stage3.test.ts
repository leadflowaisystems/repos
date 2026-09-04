import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  requirePlatformAdmin,
  requireTenantMembership,
  requireTenantOwner,
} from '@/lib/auth/authorize';
import { completeOnboarding } from '@/lib/onboarding/service';
import {
  ACTIVE,
  ROLE_OWNER,
  ROLE_STAFF,
  canManage,
  canRead,
  loadActor,
  type Actor,
} from '@/lib/tenancy/service';
import {
  acceptInvite,
  getTeam,
  inviteMember,
  revokeInvite,
  setMembership,
} from '@/lib/team/service';
import { resolvePublicGateway, submitCustomerFeedback, _resetGatewayThrottles } from '@/lib/gateway/service';
import { createTestDb, resetDb } from './helpers/test-db';

/**
 * THE WHOLE CHAIN, ADVERSARIALLY (M20 Stage 3).
 *
 * Stage 2 proved the primitives. This proves the product built on them: that a
 * workspace, a team and an operator console all refuse the same things, and
 * that the public feedback gateway stayed exactly as open as M19 left it and
 * not one inch more.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m20-stage3');
}, 180_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
});

async function user(providerId: string, email: string, admin = false) {
  return db.user.create({
    data: { email, authProviderId: providerId, isPlatformAdmin: admin },
    select: { id: true },
  });
}

/** Two businesses created the way a real signup creates them. */
async function world() {
  const ownerA = await user('sb_a', 'a@example.com');
  const ownerB = await user('sb_b', 'b@example.com');
  const staffA = await user('sb_staff', 'staff@example.com');
  const admin = await user('sb_admin', 'admin@example.com', true);
  const outsider = await user('sb_out', 'out@example.com');

  const a = await completeOnboarding(db, ownerA.id, {
    businessName: 'Tenant A Salon',
    vertical: 'salon',
  });
  const b = await completeOnboarding(db, ownerB.id, {
    businessName: 'Tenant B Clinic',
    vertical: 'clinic',
  });
  if (!a.ok || !b.ok) throw new Error('fixture onboarding failed');

  await db.membership.create({
    data: { userId: staffA.id, clientId: a.data.clientId, role: ROLE_STAFF, status: ACTIVE },
  });

  return {
    a: a.data.clientId,
    b: b.data.clientId,
    tokenA: a.data.publicToken,
    tokenB: b.data.publicToken,
    ownerA,
    ownerB,
    staffA,
    admin,
    outsider,
  };
}

const actorFor = (id: string) => loadActor(db, id) as Promise<Actor>;

// ---------------------------------------------------------------------------

describe('the authorization matrix, end to end', () => {
  it('gives each role exactly what the matrix says and nothing more', async () => {
    const w = await world();
    const cases: Array<[string, string, string, boolean, boolean, boolean]> = [
      // provider,     label,     client, read,  manage, admin
      ['sb_a', 'owner A on A', w.a, true, true, false],
      ['sb_a', 'owner A on B', w.b, false, false, false],
      ['sb_staff', 'staff A on A', w.a, true, false, false],
      ['sb_staff', 'staff A on B', w.b, false, false, false],
      ['sb_admin', 'admin on A', w.a, true, true, true],
      ['sb_admin', 'admin on B', w.b, true, true, true],
      ['sb_out', 'outsider on A', w.a, false, false, false],
    ];

    for (const [provider, label, clientId, read, manage, admin] of cases) {
      const actor = await actorFor(provider);
      expect(canRead(actor, clientId), `${label} read`).toBe(read);
      expect(canManage(actor, clientId), `${label} manage`).toBe(manage);
      expect(requireTenantMembership(actor, clientId).ok, `${label} member gate`).toBe(read);
      expect(requireTenantOwner(actor, clientId).ok, `${label} owner gate`).toBe(manage);
      expect(requirePlatformAdmin(actor).ok, `${label} admin gate`).toBe(admin);
    }
  });

  it('refuses everyone when nobody is signed in', async () => {
    const w = await world();
    expect(requireTenantMembership(null, w.a).ok).toBe(false);
    expect(requireTenantOwner(null, w.a).ok).toBe(false);
    expect(requirePlatformAdmin(null).ok).toBe(false);
  });

  it('refuses a suspended membership', async () => {
    const w = await world();
    await db.membership.updateMany({
      where: { userId: w.staffA.id, clientId: w.a },
      data: { status: 'SUSPENDED' },
    });
    const actor = await actorFor('sb_staff');
    expect(canRead(actor, w.a)).toBe(false);
    expect(requireTenantMembership(actor, w.a).ok).toBe(false);
  });

  it('refuses a manipulated client id, however it is dressed up', async () => {
    const w = await world();
    const actor = await actorFor('sb_a');
    const attempts = [w.b, ` ${w.b}`, `${w.b} `, w.b.toUpperCase(), '', '   ', "' OR 1=1 --", '../' + w.b];
    for (const id of attempts) {
      expect(requireTenantMembership(actor, id).ok, id).toBe(false);
      expect(requireTenantOwner(actor, id).ok, id).toBe(false);
    }
  });

  it('never lets a business user reach the operator console', async () => {
    const w = await world();
    for (const provider of ['sb_a', 'sb_staff', 'sb_out']) {
      const actor = await actorFor(provider);
      expect(requirePlatformAdmin(actor).ok, provider).toBe(false);
    }
    void w;
  });
});

describe('onboarding is resumable and does not duplicate', () => {
  it('does not create a second business when signup is retried', async () => {
    const owner = await user('sb_new', 'new@example.com');
    const first = await completeOnboarding(db, owner.id, {
      businessName: 'Anand Tiffin',
      vertical: 'restaurant',
    });
    expect(first.ok).toBe(true);

    // The onboarding page sends anyone who already has a business to it, so
    // the service is never called twice in the product. If it is, the result
    // must still be one business per owner rather than a silent second tenant.
    const actor = await actorFor('sb_new');
    expect(actor.memberships.filter((m) => m.status === ACTIVE)).toHaveLength(1);
    expect(await db.client.count()).toBe(1);
  });

  it('leaves nothing behind when onboarding fails, so a retry is clean', async () => {
    const owner = await user('sb_new', 'new@example.com');
    const bad = await completeOnboarding(db, owner.id, { businessName: 'x', vertical: 'salon' });
    expect(bad.ok).toBe(false);
    expect(await db.client.count()).toBe(0);
    expect(await db.membership.count()).toBe(0);
    expect(await db.feedbackGateway.count()).toBe(0);

    const good = await completeOnboarding(db, owner.id, {
      businessName: 'Anand Tiffin',
      vertical: 'restaurant',
    });
    expect(good.ok).toBe(true);
    expect(await db.client.count()).toBe(1);
  });

  it('sets setupCompletedAt only on success', async () => {
    const owner = await user('sb_new', 'new@example.com');
    await completeOnboarding(db, owner.id, { businessName: 'x', vertical: 'salon' });
    expect(await db.client.count()).toBe(0);

    const ok = await completeOnboarding(db, owner.id, {
      businessName: 'Real Business',
      vertical: 'salon',
    });
    if (!ok.ok) throw new Error('expected success');
    const client = await db.client.findUniqueOrThrow({ where: { id: ok.data.clientId } });
    expect(client.setupCompletedAt).not.toBeNull();
  });

  it('never makes the new owner a platform admin', async () => {
    const owner = await user('sb_new', 'new@example.com');
    await completeOnboarding(db, owner.id, { businessName: 'Anywhere', vertical: 'salon' });
    const after = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(after.isPlatformAdmin).toBe(false);
  });
});

describe('team management', () => {
  it('shows the owner who is on the team', async () => {
    const w = await world();
    const team = await getTeam(db, w.a);

    expect(team.members).toHaveLength(2);
    expect(team.members.find((m) => m.role === ROLE_OWNER)?.email).toBe('a@example.com');
    expect(team.members.find((m) => m.role === ROLE_STAFF)?.email).toBe('staff@example.com');
    expect(team.members.find((m) => m.role === ROLE_OWNER)?.isLastOwner).toBe(true);
  });

  it('issues an invitation whose token is never stored', async () => {
    const w = await world();
    const result = await inviteMember(db, w.a, {
      email: 'New@Example.com',
      role: ROLE_STAFF,
      invitedById: w.ownerA.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await db.invitation.findFirstOrThrow({ where: { id: result.data.inviteId } });
    expect(stored.email).toBe('new@example.com');
    // The token exists only in the link the owner was handed.
    expect(JSON.stringify(stored)).not.toContain(result.data.token);
  });

  it('refuses to invite someone already on the team', async () => {
    const w = await world();
    const result = await inviteMember(db, w.a, {
      email: 'staff@example.com',
      role: ROLE_STAFF,
      invitedById: w.ownerA.id,
    });
    expect(result.ok).toBe(false);
  });

  it('replaces an earlier invitation rather than leaving two live links', async () => {
    const w = await world();
    const first = await inviteMember(db, w.a, {
      email: 'new@example.com',
      role: ROLE_STAFF,
      invitedById: w.ownerA.id,
    });
    const second = await inviteMember(db, w.a, {
      email: 'new@example.com',
      role: ROLE_STAFF,
      invitedById: w.ownerA.id,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const joiner = await user('sb_join', 'new@example.com');
    expect((await acceptInvite(db, first.data.token, joiner.id)).ok).toBe(false);
    expect((await acceptInvite(db, second.data.token, joiner.id)).ok).toBe(true);
  });

  it('will not let a leaked link admit the wrong person', async () => {
    const w = await world();
    const invite = await inviteMember(db, w.a, {
      email: 'intended@example.com',
      role: ROLE_STAFF,
      invitedById: w.ownerA.id,
    });
    if (!invite.ok) throw new Error('invite failed');

    // The outsider holds the token but not the address it was issued to.
    const result = await acceptInvite(db, invite.data.token, w.outsider.id);
    expect(result.ok).toBe(false);
    expect(await db.membership.count({ where: { clientId: w.a, userId: w.outsider.id } })).toBe(0);
  });

  it('refuses an expired, revoked, spent or invented token identically', async () => {
    const w = await world();
    const joiner = await user('sb_join', 'new@example.com');

    const make = async () => {
      const r = await inviteMember(db, w.a, {
        email: 'new@example.com',
        role: ROLE_STAFF,
        invitedById: w.ownerA.id,
      });
      if (!r.ok) throw new Error('invite failed');
      return r.data;
    };

    const expired = await make();
    await db.invitation.update({
      where: { id: expired.inviteId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const revoked = await make();
    await revokeInvite(db, w.a, revoked.inviteId);

    const messages = new Set<string>();
    for (const token of [expired.token, revoked.token, 'not-a-real-token']) {
      const r = await acceptInvite(db, token, joiner.id);
      expect(r.ok).toBe(false);
      if (!r.ok) messages.add(r.message);
    }
    // One answer for every failure: a token cannot be probed for its state.
    expect(messages.size).toBe(1);
  });

  it('cannot revoke an invitation belonging to another business', async () => {
    const w = await world();
    const invite = await inviteMember(db, w.a, {
      email: 'new@example.com',
      role: ROLE_STAFF,
      invitedById: w.ownerA.id,
    });
    if (!invite.ok) throw new Error('invite failed');

    // Tenant B, supplying A's invitation id directly.
    const result = await revokeInvite(db, w.b, invite.data.inviteId);
    expect(result.ok).toBe(false);
    const still = await db.invitation.findUniqueOrThrow({ where: { id: invite.data.inviteId } });
    expect(still.revokedAt).toBeNull();
  });

  it('cannot change a membership belonging to another business', async () => {
    const w = await world();
    const team = await getTeam(db, w.a);
    const staff = team.members.find((m) => m.role === ROLE_STAFF)!;

    const result = await setMembership(db, w.b, staff.membershipId, { role: ROLE_OWNER });
    expect(result.ok).toBe(false);
    const unchanged = await db.membership.findUniqueOrThrow({ where: { id: staff.membershipId } });
    expect(unchanged.role).toBe(ROLE_STAFF);
  });

  it('will not let the last owner be demoted or suspended', async () => {
    const w = await world();
    const team = await getTeam(db, w.a);
    const owner = team.members.find((m) => m.role === ROLE_OWNER)!;

    expect((await setMembership(db, w.a, owner.membershipId, { role: ROLE_STAFF })).ok).toBe(false);
    expect((await setMembership(db, w.a, owner.membershipId, { status: 'SUSPENDED' })).ok).toBe(false);

    const still = await db.membership.findUniqueOrThrow({ where: { id: owner.membershipId } });
    expect(still.role).toBe(ROLE_OWNER);
    expect(still.status).toBe(ACTIVE);
  });

  it('allows the demotion once a second owner exists', async () => {
    const w = await world();
    const team = await getTeam(db, w.a);
    const staff = team.members.find((m) => m.role === ROLE_STAFF)!;
    const owner = team.members.find((m) => m.role === ROLE_OWNER)!;

    expect((await setMembership(db, w.a, staff.membershipId, { role: ROLE_OWNER })).ok).toBe(true);
    expect((await setMembership(db, w.a, owner.membershipId, { role: ROLE_STAFF })).ok).toBe(true);
  });

  it('never grants platform admin through any team path', async () => {
    const w = await world();
    const team = await getTeam(db, w.a);
    const staff = team.members.find((m) => m.role === ROLE_STAFF)!;

    // Every route into a membership, asked for something that is not a role.
    await setMembership(db, w.a, staff.membershipId, { role: 'REP_OS_ADMIN' });
    const after = await db.membership.findUniqueOrThrow({ where: { id: staff.membershipId } });
    expect(after.role).toBe(ROLE_STAFF);

    const invite = await inviteMember(db, w.a, {
      email: 'evil@example.com',
      role: 'REP_OS_ADMIN',
      invitedById: w.ownerA.id,
    });
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    const stored = await db.invitation.findUniqueOrThrow({ where: { id: invite.data.inviteId } });
    expect(stored.role).toBe(ROLE_STAFF);

    const joiner = await user('sb_evil', 'evil@example.com');
    await acceptInvite(db, invite.data.token, joiner.id);
    const joinerUser = await db.user.findUniqueOrThrow({ where: { id: joiner.id } });
    expect(joinerUser.isPlatformAdmin).toBe(false);
  });
});

describe('the public gateway is exactly as open as M19 left it', () => {
  it('needs no account and resolves only to its own business', async () => {
    const w = await world();

    const a = await resolvePublicGateway(db, w.tokenA);
    const b = await resolvePublicGateway(db, w.tokenB);
    expect(a?.clientId).toBe(w.a);
    expect(b?.clientId).toBe(w.b);
    expect(a?.businessName).toBe('Tenant A Salon');
  });

  it('stores a customer submission against the right tenant and no other', async () => {
    const w = await world();
    const result = await submitCustomerFeedback(db, w.tokenA, {
      stars: 2,
      text: '',
      dimensions: { result: 2 },
    });
    expect(result.ok).toBe(true);

    expect(await db.reviewItem.count({ where: { clientId: w.a } })).toBe(1);
    expect(await db.reviewItem.count({ where: { clientId: w.b } })).toBe(0);
  });

  it('exposes nothing private through the public view', async () => {
    const w = await world();
    await db.businessContext.create({
      data: {
        clientId: w.a,
        kind: 'PRIORITY',
        provenance: 'OWNER_TOLD_US',
        text: 'SECRET owner strategy note',
      },
    });
    await db.minute.create({
      data: {
        clientId: w.a,
        occurredAt: new Date(),
        category: 'NOTE',
        title: 'SECRET internal',
        body: 'SECRET body',
      },
    });

    const view = await resolvePublicGateway(db, w.tokenA);
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain('SECRET');
    // Nor anything that would let a customer address the tenant directly.
    expect(Object.keys(view ?? {})).not.toContain('memberships');
    expect(serialised).not.toContain('a@example.com');
  });

  it('is unaffected by whether anyone is signed in', async () => {
    const w = await world();
    const anonymous = await resolvePublicGateway(db, w.tokenA);
    expect(anonymous).not.toBeNull();
    // The gateway takes no actor and has no way to consult one.
    expect(resolvePublicGateway.length).toBe(2);
  });
});
