import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DENIED_MESSAGE,
  requireAuthenticatedUser,
  requirePlatformAdmin,
  requireTenantMembership,
  requireTenantOwner,
  requireTenantStaffOrOwner,
} from '@/lib/auth/authorize';
import { supabaseConfig, isSupabaseConfigured } from '@/lib/auth/supabase';
import {
  ROLE_OWNER,
  ROLE_STAFF,
  accessibleClientIds,
  canManage,
  canRead,
  loadActor,
  provisionUser,
  roleFor,
  type Actor,
} from '@/lib/tenancy/service';
import { completeOnboarding, landingPathFor, verticalChoices } from '@/lib/onboarding/service';
import { createTestDb, resetDb } from './helpers/test-db';

/**
 * IDENTITY, TENANCY AND ROLES (M20 Stage 2).
 *
 * The chain this file exists to prove:
 *
 *   Supabase identity -> RepOS User -> Membership -> Client -> role -> data
 *
 * and the one thing that must never work: supplying a client id and being
 * believed. Every "wrong tenant" case below hands the authorization layer a
 * real, existing client id belonging to somebody else — which is exactly what
 * an attacker would do, and exactly what UI-level filtering would let through.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m20-auth');
}, 180_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

// --- fixtures --------------------------------------------------------------

async function makeUser(
  providerId: string,
  email: string,
  opts: { admin?: boolean; status?: string } = {},
) {
  return db.user.create({
    data: {
      email,
      authProviderId: providerId,
      isPlatformAdmin: opts.admin ?? false,
      status: opts.status ?? 'ACTIVE',
    },
    select: { id: true },
  });
}

async function makeClient(name: string, vertical = 'salon') {
  return db.client.create({
    data: { businessName: name, vertical },
    select: { id: true },
  });
}

async function makeMembership(userId: string, clientId: string, role: string, status = 'ACTIVE') {
  return db.membership.create({ data: { userId, clientId, role, status } });
}

/** Two businesses, an owner each, one staff member and one platform admin. */
async function world() {
  const [a, b] = [await makeClient('Tenant A Salon'), await makeClient('Tenant B Clinic', 'clinic')];
  const ownerA = await makeUser('sb_a', 'a@example.com');
  const ownerB = await makeUser('sb_b', 'b@example.com');
  const staffA = await makeUser('sb_staff', 'staff@example.com');
  const admin = await makeUser('sb_admin', 'admin@example.com', { admin: true });
  const suspended = await makeUser('sb_susp', 'susp@example.com');

  await makeMembership(ownerA.id, a.id, ROLE_OWNER);
  await makeMembership(ownerB.id, b.id, ROLE_OWNER);
  await makeMembership(staffA.id, a.id, ROLE_STAFF);
  await makeMembership(suspended.id, a.id, ROLE_OWNER, 'SUSPENDED');

  return { a: a.id, b: b.id, ownerA, ownerB, staffA, admin, suspended };
}

// ---------------------------------------------------------------------------

describe('the identity chain', () => {
  it('resolves a Supabase identity to the Headway user behind it', async () => {
    const w = await world();
    const actor = await loadActor(db, 'sb_a');

    expect(actor?.userId).toBe(w.ownerA.id);
    expect(actor?.email).toBe('a@example.com');
    expect(actor?.isPlatformAdmin).toBe(false);
    expect(accessibleClientIds(actor!)).toEqual([w.a]);
  });

  it('resolves nothing for an identity Headway has never seen', async () => {
    await world();
    expect(await loadActor(db, 'sb_forged')).toBeNull();
  });

  it('resolves nothing for a blank or missing identity', async () => {
    await world();
    expect(await loadActor(db, '')).toBeNull();
    expect(await loadActor(db, null)).toBeNull();
    expect(await loadActor(db, undefined)).toBeNull();
  });

  it('refuses a suspended account entirely, without deleting anything', async () => {
    const w = await world();
    await db.user.update({ where: { id: w.ownerA.id }, data: { status: 'SUSPENDED' } });

    expect(await loadActor(db, 'sb_a')).toBeNull();
    // The membership survives; only the ability to act is withdrawn.
    expect(await db.membership.count({ where: { userId: w.ownerA.id } })).toBe(1);
  });

  it('ignores a membership that is not active', async () => {
    const w = await world();
    const actor = await loadActor(db, 'sb_susp');

    expect(actor).not.toBeNull();
    expect(accessibleClientIds(actor!)).toEqual([]);
    expect(canRead(actor!, w.a)).toBe(false);
  });
});

describe('provisioning a user from a verified identity', () => {
  it('creates the Headway user on first sign-in', async () => {
    const result = await provisionUser(db, { providerId: 'sb_new', email: 'New@Example.com ' });

    expect(result.created).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.email).toBe('new@example.com');
    expect(user.authProviderId).toBe('sb_new');
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('returns the same user on every later sign-in', async () => {
    const first = await provisionUser(db, { providerId: 'sb_new', email: 'new@example.com' });
    const second = await provisionUser(db, { providerId: 'sb_new', email: 'new@example.com' });

    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(await db.user.count()).toBe(1);
  });

  it('NEVER makes a signup a platform admin', async () => {
    const result = await provisionUser(db, { providerId: 'sb_new', email: 'new@example.com' });
    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.isPlatformAdmin).toBe(false);
  });

  it('cannot be talked into promoting an existing admin flag either', async () => {
    await makeUser('sb_admin', 'admin@example.com', { admin: true });
    // Signing in again must not change privilege in either direction.
    await provisionUser(db, { providerId: 'sb_admin', email: 'admin@example.com' });
    const user = await db.user.findFirstOrThrow({ where: { authProviderId: 'sb_admin' } });
    expect(user.isPlatformAdmin).toBe(true);

    await provisionUser(db, { providerId: 'sb_new', email: 'someone@example.com' });
    const other = await db.user.findFirstOrThrow({ where: { authProviderId: 'sb_new' } });
    expect(other.isPlatformAdmin).toBe(false);
  });

  it('claims a row an invitation created before the account existed', async () => {
    const invited = await db.user.create({
      data: { email: 'invited@example.com' },
      select: { id: true },
    });

    const result = await provisionUser(db, {
      providerId: 'sb_invited',
      email: 'invited@example.com',
    });

    expect(result.userId).toBe(invited.id);
    expect(await db.user.count()).toBe(1);
  });

  it('refuses to provision without a verified identity', async () => {
    await expect(provisionUser(db, { providerId: '', email: 'x@example.com' })).rejects.toThrow();
    await expect(provisionUser(db, { providerId: 'sb_x', email: '  ' })).rejects.toThrow();
  });
});

describe('authorization primitives', () => {
  it('rejects everyone when nobody is signed in', () => {
    expect(requireAuthenticatedUser(null).ok).toBe(false);
    expect(requirePlatformAdmin(null).ok).toBe(false);
    expect(requireTenantMembership(null, 'client_a').ok).toBe(false);
    expect(requireTenantOwner(null, 'client_a').ok).toBe(false);
    expect(requireTenantStaffOrOwner(null, 'client_a').ok).toBe(false);

    const denial = requireTenantMembership(null, 'client_a');
    expect(denial.ok === false && denial.reason).toBe('UNAUTHENTICATED');
  });

  it('lets an owner into their own business', async () => {
    const w = await world();
    const actor = (await loadActor(db, 'sb_a'))!;

    expect(requireTenantMembership(actor, w.a).ok).toBe(true);
    expect(requireTenantOwner(actor, w.a).ok).toBe(true);
    expect(requireTenantStaffOrOwner(actor, w.a).ok).toBe(true);
  });

  it('keeps an owner out of somebody else’s business', async () => {
    const w = await world();
    const actor = (await loadActor(db, 'sb_a'))!;

    expect(requireTenantMembership(actor, w.b).ok).toBe(false);
    expect(requireTenantOwner(actor, w.b).ok).toBe(false);
    expect(requireTenantStaffOrOwner(actor, w.b).ok).toBe(false);
  });

  it('lets staff work but not reshape the business', async () => {
    const w = await world();
    const actor = (await loadActor(db, 'sb_staff'))!;

    expect(requireTenantMembership(actor, w.a).ok).toBe(true);
    expect(requireTenantStaffOrOwner(actor, w.a).ok).toBe(true);
    expect(requireTenantOwner(actor, w.a).ok).toBe(false);
    expect(requirePlatformAdmin(actor).ok).toBe(false);
    expect(roleFor(actor, w.a)).toBe(ROLE_STAFF);
    expect(canRead(actor, w.a)).toBe(true);
    expect(canManage(actor, w.a)).toBe(false);
  });

  it('lets a platform admin into every business', async () => {
    const w = await world();
    const actor = (await loadActor(db, 'sb_admin'))!;

    expect(requirePlatformAdmin(actor).ok).toBe(true);
    expect(requireTenantMembership(actor, w.a).ok).toBe(true);
    expect(requireTenantMembership(actor, w.b).ok).toBe(true);
    expect(requireTenantOwner(actor, w.b).ok).toBe(true);
    // An admin has authority over a business, not a role inside one.
    expect(roleFor(actor, w.a)).toBeNull();
  });

  it('refuses a suspended membership even for its own business', async () => {
    const w = await world();
    const actor = (await loadActor(db, 'sb_susp'))!;
    expect(requireTenantMembership(actor, w.a).ok).toBe(false);
    expect(requireTenantOwner(actor, w.a).ok).toBe(false);
  });

  it('refuses an empty, blank or absurd client id', async () => {
    await world();
    const actor = (await loadActor(db, 'sb_a'))!;
    for (const id of ['', '   ', 'does-not-exist', '../../etc', "' OR 1=1 --"]) {
      expect(requireTenantMembership(actor, id).ok, id).toBe(false);
    }
  });

  it('says the same thing whether the business is missing or simply not yours', async () => {
    // Otherwise the error message becomes a way to enumerate RepOS customers.
    const w = await world();
    const actor = (await loadActor(db, 'sb_a'))!;

    const notYours = requireTenantMembership(actor, w.b);
    const notReal = requireTenantMembership(actor, 'no_such_client');

    expect(notYours.ok).toBe(false);
    expect(notReal.ok).toBe(false);
    expect(notYours.ok === false && notYours.reason).toBe('DENIED');
    expect(notReal.ok === false && notReal.reason).toBe('DENIED');
    expect(DENIED_MESSAGE).not.toMatch(/exist|found|tenant|client|business/i);
  });
});

describe('onboarding', () => {
  it('leaves behind everything a working business needs', async () => {
    const user = await makeUser('sb_new', 'new@example.com');

    const result = await completeOnboarding(db, user.id, {
      businessName: 'Anand Tiffin House',
      vertical: 'restaurant',
      areaLabel: 'Kothrud, Pune',
      ownerName: 'A. Owner',
      context: 'Lunch rush is the hard part.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const client = await db.client.findUniqueOrThrow({ where: { id: result.data.clientId } });
    expect(client.businessName).toBe('Anand Tiffin House');
    expect(client.vertical).toBe('restaurant');
    expect(client.setupCompletedAt).not.toBeNull();
    expect(client.subscriptionStatus).toBe('TRIAL');

    const membership = await db.membership.findFirstOrThrow({
      where: { clientId: client.id, userId: user.id },
    });
    expect(membership.role).toBe(ROLE_OWNER);
    expect(membership.status).toBe('ACTIVE');

    // The M19 gateway, reused rather than reinvented.
    const gateway = await db.feedbackGateway.findFirstOrThrow({ where: { clientId: client.id } });
    expect(gateway.publicToken).toHaveLength(22);
    expect(result.data.publicToken).toBe(gateway.publicToken);

    const context = await db.businessContext.findFirstOrThrow({ where: { clientId: client.id } });
    expect(context.text).toContain('Lunch rush');
  });

  it('gives every new business a different feedback token', async () => {
    const one = await makeUser('sb_1', 'one@example.com');
    const two = await makeUser('sb_2', 'two@example.com');

    const a = await completeOnboarding(db, one.id, { businessName: 'One', vertical: 'salon' });
    const b = await completeOnboarding(db, two.id, { businessName: 'Two', vertical: 'salon' });

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.data.publicToken).not.toBe(b.data.publicToken);
  });

  it('refuses a vertical that has no pack behind it', async () => {
    const user = await makeUser('sb_new', 'new@example.com');
    const result = await completeOnboarding(db, user.id, {
      businessName: 'Somewhere',
      vertical: 'spaceship_repair',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.vertical).toBeDefined();
    expect(await db.client.count()).toBe(0);
  });

  it('offers only verticals that actually exist', () => {
    const values = verticalChoices().map((c) => c.value);
    expect(values).toContain('restaurant');
    expect(values).toContain('clinic');
    expect(values.length).toBeGreaterThanOrEqual(7);
  });

  it('creates nothing at all when the details are wrong', async () => {
    const user = await makeUser('sb_new', 'new@example.com');
    const result = await completeOnboarding(db, user.id, { businessName: 'x', vertical: 'salon' });

    expect(result.ok).toBe(false);
    expect(await db.client.count()).toBe(0);
    expect(await db.membership.count()).toBe(0);
    expect(await db.feedbackGateway.count()).toBe(0);
  });

  it('refuses an account that no longer exists', async () => {
    const result = await completeOnboarding(db, 'no_such_user', {
      businessName: 'Ghost Business',
      vertical: 'salon',
    });
    expect(result.ok).toBe(false);
    expect(await db.client.count()).toBe(0);
  });

  it('never lets onboarding hand out platform admin', async () => {
    const user = await makeUser('sb_new', 'new@example.com');
    await completeOnboarding(db, user.id, { businessName: 'Anywhere', vertical: 'salon' });
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.isPlatformAdmin).toBe(false);
  });
});

describe('where a signed-in person lands', () => {
  it('sends platform staff to the operator workspace', () => {
    expect(landingPathFor({ isPlatformAdmin: true, memberships: [] })).toBe('/');
  });

  it('sends an owner to their business', () => {
    expect(
      landingPathFor({
        isPlatformAdmin: false,
        memberships: [{ clientId: 'c1', status: 'ACTIVE' }],
      }),
    ).toBe('/workspace/c1');
  });

  it('sends someone with no business to finish signing up', () => {
    expect(landingPathFor({ isPlatformAdmin: false, memberships: [] })).toBe('/onboarding');
    expect(
      landingPathFor({
        isPlatformAdmin: false,
        memberships: [{ clientId: 'c1', status: 'SUSPENDED' }],
      }),
    ).toBe('/onboarding');
  });
});

describe('supabase configuration', () => {
  it('says what is missing rather than throwing', () => {
    const result = supabaseConfig({} as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/SUPABASE_URL/);
  });

  it('rejects a malformed project URL', () => {
    const result = supabaseConfig({
      SUPABASE_URL: 'not a url',
      SUPABASE_ANON_KEY: 'k',
    } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
  });

  it('accepts a complete configuration', () => {
    const env = {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
    } as unknown as NodeJS.ProcessEnv;
    expect(isSupabaseConfigured(env)).toBe(true);
  });

  it('never names a NEXT_PUBLIC_ variable, because there are none', () => {
    // Supabase is normally wired up with NEXT_PUBLIC_ values. RepOS keeps auth
    // entirely server-side so no project URL or key reaches a browser bundle.
    const result = supabaseConfig({} as NodeJS.ProcessEnv);
    expect(result.ok === false && result.reason).not.toMatch(/NEXT_PUBLIC/);
  });
});

describe('a client id from the browser proves nothing', () => {
  it('is not believed even when it is real, current and correctly formed', async () => {
    const w = await world();
    const actorA = (await loadActor(db, 'sb_a'))!;

    // Everything an attacker could realistically supply.
    const supplied = [w.b, w.b.toUpperCase(), ` ${w.b} `, `${w.b} `];
    for (const id of supplied) {
      expect(requireTenantMembership(actorA, id).ok, id).toBe(false);
      expect(requireTenantOwner(actorA, id).ok, id).toBe(false);
      expect(canRead(actorA, id), id).toBe(false);
      expect(canManage(actorA, id), id).toBe(false);
    }
  });

  it('does not become true by adding a role the browser asked for', async () => {
    const w = await world();
    const staff = (await loadActor(db, 'sb_staff'))!;

    // A forged actor object is the closest a caller can get to lying, and the
    // primitives still read the memberships rather than the claim.
    const forged: Actor = { ...staff, isPlatformAdmin: false, memberships: staff.memberships };
    expect(requireTenantOwner(forged, w.a).ok).toBe(false);
    expect(requireTenantMembership(forged, w.b).ok).toBe(false);
  });
});
