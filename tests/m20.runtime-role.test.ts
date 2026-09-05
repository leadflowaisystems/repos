import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE THREE FLOWS THAT ONLY BREAK AS `repos_app` (M20).
 *
 * Signup, onboarding and password reset all passed their tests and all failed
 * in production, for one reason: every other test file connects as the schema
 * owner, which bypasses RLS and holds every column privilege. The suite was
 * exercising the application with the policies effectively switched off, so the
 * three operations that CANNOT satisfy those policies looked fine right up to
 * the moment a real customer tried to sign up.
 *
 * This file connects as the role production connects as. Nothing here is a
 * simulation of the policies — the database is built by pushing the real schema
 * and applying `prisma/m20/rls.sql` verbatim, and the queries are issued by the
 * real services through the real `src/lib/db.ts`, which resolves its identity
 * the way it does in production. Only the Supabase boundary is mocked, because
 * that is the one thing that genuinely is not a database.
 *
 * The owner handle exists to seed fixtures and to read back what happened. It
 * is never used to perform an operation under test — that would be the exact
 * mistake this file exists to correct.
 */

/**
 * THIS FILE MUST NOT SKIP.
 *
 * It used to be five suites that skipped themselves, so on any machine without
 * the second connection string the whole thing quietly reported nothing — and a
 * skip reads like a pass in every summary line and every CI badge. That is
 * precisely how signup, onboarding and password reset shipped broken: 1,395
 * green tests, none of them connected as the role production uses.
 *
 * Now everything runs unconditionally and `beforeAll` throws a message naming
 * the variable when the database is not there. The prerequisite is ALSO
 * asserted as a plain failing test in `m20.runtime-role-required.test.ts`,
 * because a `beforeAll` failure is still reported by vitest as "skipped" — and
 * that word is exactly what hid this the first time.
 */

/** What `supabase.auth.getUser()` returns next. Null means signed out. */
let session: { id: string } | null = null;

vi.mock('@/lib/auth/supabase', () => ({
  SUPABASE_URL_VAR: 'SUPABASE_URL',
  SUPABASE_ANON_KEY_VAR: 'SUPABASE_ANON_KEY',
  supabaseConfig: () => ({ ok: true, config: { url: 'http://localhost', anonKey: 'test' } }),
  isSupabaseConfigured: () => true,
  supabaseServerClient: async () => ({
    auth: {
      getUser: async () =>
        session
          ? { data: { user: { id: session.id } }, error: null }
          : { data: { user: null }, error: null },
    },
  }),
}));

/** Real Supabase-shaped UUIDs, so the identity bridge has something true to do. */
const AUTH = {
  admin: '11111111-1111-4111-8111-111111111111',
  alpha: '22222222-2222-4222-8222-222222222222',
  beta: '44444444-4444-4444-8444-444444444444',
  newcomer: '99999999-9999-4999-8999-999999999999',
  invited: '88888888-8888-4888-8888-888888888888',
  attacker: 'deadbeef-0000-4000-8000-000000000000',
} as const;

let harness: RlsTestDb;
/** The owner handle. Fixtures and read-back only. */
let owner: PrismaClient;
/** The application's own client, connected as `repos_app`. */
let app: PrismaClient;

let provisionUser: typeof import('@/lib/tenancy/service')['provisionUser'];
let bumpSessionVersion: typeof import('@/lib/tenancy/service')['bumpSessionVersion'];
let loadActor: typeof import('@/lib/tenancy/service')['loadActor'];
let completeOnboarding: typeof import('@/lib/onboarding/service')['completeOnboarding'];
let createClient: typeof import('@/lib/clients/service')['createClient'];
let updateClient: typeof import('@/lib/clients/service')['updateClient'];
let archiveClient: typeof import('@/lib/clients/service')['archiveClient'];
let restoreClient: typeof import('@/lib/clients/service')['restoreClient'];
let validClientInput: typeof import('./helpers/test-db')['validClientInput'];

let seeded: { adminId: string; alphaUserId: string; betaUserId: string; betaClientId: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m20-runtime-role');
  owner = harness.owner;

  // `db.ts` builds its client from DATABASE_URL. Pointing that at the runtime
  // role BEFORE importing it is what makes every query below run as `repos_app`
  // rather than as something that can ignore the policies.
  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

  ({ provisionUser, bumpSessionVersion, loadActor } = await import('@/lib/tenancy/service'));
  ({ completeOnboarding } = await import('@/lib/onboarding/service'));
  ({ createClient, updateClient, archiveClient, restoreClient } = await import(
    '@/lib/clients/service',
  ));
  ({ validClientInput } = await import('./helpers/test-db'));
  ({ prisma: app } = await import('@/lib/db'));
}, 180_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  session = null;
  await resetDb(owner);

  const admin = await owner.user.create({
    data: { email: 'admin@repos.test', authProviderId: AUTH.admin, isPlatformAdmin: true },
    select: { id: true },
  });
  const alphaUser = await owner.user.create({
    data: { email: 'owner@alpha.test', authProviderId: AUTH.alpha },
    select: { id: true },
  });
  const betaUser = await owner.user.create({
    data: { email: 'owner@beta.test', authProviderId: AUTH.beta },
    select: { id: true },
  });
  // A row an invitation created ahead of its account: address known, identity not.
  await owner.user.create({ data: { email: 'invited@alpha.test' } });

  const beta = await owner.client.create({
    data: { businessName: 'Beta Gym', vertical: 'gym', status: 'ACTIVE' },
    select: { id: true },
  });
  await owner.membership.create({
    data: { userId: betaUser.id, clientId: beta.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });

  seeded = {
    adminId: admin.id,
    alphaUserId: alphaUser.id,
    betaUserId: betaUser.id,
    betaClientId: beta.id,
  };
});

describe('the role the application actually connects as', () => {
  it('cannot bypass RLS and is not a superuser', async () => {
    const roles = await owner.$queryRawUnsafe<
      { superuser: boolean; bypassrls: boolean }[]
    >(
      `SELECT r.rolsuper AS superuser, r.rolbypassrls AS bypassrls
         FROM pg_roles r WHERE r.rolname = 'repos_app'`,
    );
    expect(roles).toHaveLength(1);
    expect(roles[0]?.superuser).toBe(false);
    expect(roles[0]?.bypassrls).toBe(false);

    // And the application's own connection really is that role.
    const mine = await app.$queryRawUnsafe<{ me: string }[]>('SELECT current_user AS me');
    expect(mine[0]?.me).toBe('repos_app');
  });

  it('has every table forced and the policy set unchanged', async () => {
    const rls = await owner.$queryRawUnsafe<{ enabled: bigint; forced: bigint; total: bigint }[]>(
      `SELECT count(*) FILTER (WHERE relrowsecurity) AS enabled,
              count(*) FILTER (WHERE relforcerowsecurity) AS forced,
              count(*) AS total
         FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`,
    );
    expect(Number(rls[0]?.total)).toBe(16);
    expect(Number(rls[0]?.enabled)).toBe(16);
    expect(Number(rls[0]?.forced)).toBe(16);

    const policies = await owner.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public'`,
    );
    expect(Number(policies[0]?.n)).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// SIGNUP
// ---------------------------------------------------------------------------

describe('signing up', () => {
  it('creates exactly one User for a first-time identity', async () => {
    const before = await owner.user.count();

    const result = await provisionUser(app, {
      providerId: AUTH.newcomer,
      email: 'New@Example.test ',
      name: '  Nikhil  ',
    });

    expect(result.created).toBe(true);
    expect(await owner.user.count()).toBe(before + 1);

    const created = await owner.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(created.email).toBe('new@example.test');
    expect(created.name).toBe('Nikhil');
    expect(created.authProviderId).toBe(AUTH.newcomer);
  });

  it('is idempotent when the callback runs again', async () => {
    const first = await provisionUser(app, { providerId: AUTH.newcomer, email: 'new@example.test' });
    const after = await owner.user.count();

    const second = await provisionUser(app, { providerId: AUTH.newcomer, email: 'new@example.test' });
    const third = await provisionUser(app, { providerId: AUTH.newcomer, email: 'new@example.test' });

    expect(second.userId).toBe(first.userId);
    expect(third.userId).toBe(first.userId);
    expect(second.created).toBe(false);
    expect(third.created).toBe(false);
    expect(await owner.user.count()).toBe(after);
  });

  it('will not let a forged identity take over somebody else', async () => {
    // The attacker authenticates as themselves and presents a stranger's
    // address, which is the only lever they have.
    await expect(
      provisionUser(app, { providerId: AUTH.attacker, email: 'owner@alpha.test' }),
    ).rejects.toThrow();

    const victim = await owner.user.findUniqueOrThrow({ where: { email: 'owner@alpha.test' } });
    expect(victim.authProviderId).toBe(AUTH.alpha);
    expect(victim.id).toBe(seeded.alphaUserId);
    expect(await owner.user.findUnique({ where: { authProviderId: AUTH.attacker } })).toBeNull();
  });

  it('cannot make itself a platform admin', async () => {
    const { userId } = await provisionUser(app, {
      providerId: AUTH.newcomer,
      email: 'new@example.test',
    });

    const created = await owner.user.findUniqueOrThrow({ where: { id: userId } });
    expect(created.isPlatformAdmin).toBe(false);
    expect(created.status).toBe('ACTIVE');
    expect(created.sessionVersion).toBe(1);

    // Nor afterwards, through the ordinary write path: `isPlatformAdmin` is not
    // a column this role holds any privilege on.
    session = { id: AUTH.newcomer };
    await expect(
      app.user.update({ where: { id: userId }, data: { isPlatformAdmin: true } }),
    ).rejects.toThrow();
    expect((await owner.user.findUniqueOrThrow({ where: { id: userId } })).isPlatformAdmin).toBe(
      false,
    );
  });

  it('can then sign in: the new row resolves and loads as an actor', async () => {
    // Provisioning is only half of it. The very next thing signing in does is
    // read that row back — through `user_self_or_admin`, which admits a person
    // to see themselves and no one else. If that read came back empty the
    // account would exist and still be unusable.
    const { userId } = await provisionUser(app, {
      providerId: AUTH.newcomer,
      email: 'new@example.test',
    });

    session = { id: AUTH.newcomer };
    const actor = await loadActor(app, AUTH.newcomer);

    expect(actor).not.toBeNull();
    expect(actor?.userId).toBe(userId);
    expect(actor?.email).toBe('new@example.test');
    expect(actor?.isPlatformAdmin).toBe(false);
    expect(actor?.memberships).toEqual([]);

    // And still sees nobody else, which is what makes that read safe.
    expect(await app.user.count()).toBe(1);
  });

  it('claims the row an invitation created rather than colliding with it', async () => {
    const before = await owner.user.count();

    const result = await provisionUser(app, {
      providerId: AUTH.invited,
      email: 'invited@alpha.test',
    });

    expect(result.created).toBe(false);
    expect(await owner.user.count()).toBe(before);
    const claimed = await owner.user.findUniqueOrThrow({ where: { email: 'invited@alpha.test' } });
    expect(claimed.id).toBe(result.userId);
    expect(claimed.authProviderId).toBe(AUTH.invited);
    expect(claimed.emailVerifiedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ONBOARDING
// ---------------------------------------------------------------------------

describe('creating your first business', () => {
  const input = {
    businessName: 'Nikhil Tiffins',
    vertical: 'clinic',
    areaLabel: 'Kothrud, Pune',
    ownerName: 'Nikhil',
    ownerPhone: '9999999999',
    context: 'Lunch rush is chaos.',
  };

  async function signUpAndOnboard() {
    const { userId } = await provisionUser(app, {
      providerId: AUTH.newcomer,
      email: 'new@example.test',
    });
    session = { id: AUTH.newcomer };
    const result = await completeOnboarding(app, userId, input);
    return { userId, result };
  }

  it('creates the business, its ownership and its feedback gateway', async () => {
    const { result } = await signUpAndOnboard();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const client = await owner.client.findUniqueOrThrow({
      where: { id: result.data.clientId },
      include: { gateway: true, memberships: true, context: true },
    });
    expect(client.businessName).toBe('Nikhil Tiffins');
    expect(client.vertical).toBe('clinic');
    expect(client.areaLabel).toBe('Kothrud, Pune');
    expect(client.setupCompletedAt).not.toBeNull();
    expect(client.gateway?.publicToken).toBe(result.data.publicToken);
    expect(client.context).toHaveLength(1);
  });

  it('binds the business to the person who signed up, as its owner', async () => {
    const { userId, result } = await signUpAndOnboard();
    if (!result.ok) throw new Error(result.message);

    const memberships = await owner.membership.findMany({
      where: { clientId: result.data.clientId },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.userId).toBe(userId);
    expect(memberships[0]?.role).toBe('BUSINESS_OWNER');
    expect(memberships[0]?.status).toBe('ACTIVE');
  });

  it('gives a new owner no say over their own plan or subscription', async () => {
    const { result } = await signUpAndOnboard();
    if (!result.ok) throw new Error(result.message);

    const client = await owner.client.findUniqueOrThrow({ where: { id: result.data.clientId } });
    expect(client.plan).toBe('STARTER');
    expect(client.subscriptionStatus).toBe('TRIAL');

    // And they cannot move themselves off it afterwards either.
    await expect(
      app.client.update({
        where: { id: result.data.clientId },
        data: { subscriptionStatus: 'ACTIVE' },
      }),
    ).rejects.toThrow();
  });

  it('cannot create a business for somebody else', async () => {
    // Signed in as beta's owner, naming alpha's user as the owner-to-be.
    session = { id: AUTH.beta };
    const before = await owner.client.count();

    const result = await completeOnboarding(app, seeded.alphaUserId, input);

    expect(result.ok).toBe(false);
    expect(await owner.client.count()).toBe(before);
  });

  it('leaves the rest of the world exactly as invisible as before', async () => {
    const { result } = await signUpAndOnboard();
    if (!result.ok) throw new Error(result.message);

    // The new owner sees their own business and nothing else.
    expect(await app.client.count()).toBe(1);
    expect(await app.client.findUnique({ where: { id: seeded.betaClientId } })).toBeNull();

    // And cannot write into the tenant they can't see.
    await expect(
      app.businessContext.create({
        data: {
          clientId: seeded.betaClientId,
          kind: 'PRIORITY',
          provenance: 'OWNER_TOLD_US',
          text: 'not mine',
          recordedAt: new Date(),
        },
      }),
    ).rejects.toThrow();

    // Nor grant themselves a way in.
    await expect(
      app.membership.create({
        data: {
          userId: (await owner.user.findUniqueOrThrow({ where: { authProviderId: AUTH.newcomer } }))
            .id,
          clientId: seeded.betaClientId,
          role: 'BUSINESS_OWNER',
          status: 'ACTIVE',
        },
      }),
    ).rejects.toThrow();

    // Seen from the other side: beta's owner never sees the new business.
    session = { id: AUTH.beta };
    expect(await app.client.findUnique({ where: { id: result.data.clientId } })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// THE OPERATOR'S OWN CLIENT LIST
// ---------------------------------------------------------------------------

describe("the operator's client list", () => {
  it('still creates a client, with its profile rows and its gateway', async () => {
    session = { id: AUTH.admin };

    const result = await createClient(
      app,
      validClientInput({ businessName: 'Sunrise Dental', status: 'ACTIVE', plan: 'STARTER' }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const client = await owner.client.findUniqueOrThrow({
      where: { id: result.data.id },
      include: { gateway: true, voiceProfile: true, policy: true, kitConfig: true, memberships: true },
    });
    expect(client.businessName).toBe('Sunrise Dental');
    expect(client.areaLabel).toBe('Kothrud, Pune');
    expect(client.avgCustomerValueInr).toBe(900);
    expect(client.status).toBe('ACTIVE');
    expect(client.gateway).not.toBeNull();
    expect(client.voiceProfile).not.toBeNull();
    expect(client.policy).not.toBeNull();
    expect(client.kitConfig).not.toBeNull();
    // An operator-managed business belongs to no customer account yet.
    expect(client.memberships).toHaveLength(0);
  });

  it('honours the status and plan the operator chose', async () => {
    session = { id: AUTH.admin };

    const result = await createClient(
      app,
      validClientInput({ businessName: 'Prospect Cafe', status: 'PROSPECT', plan: 'GROWTH' }),
    );
    if (!result.ok) throw new Error(result.message);

    const client = await owner.client.findUniqueOrThrow({ where: { id: result.data.id } });
    expect(client.status).toBe('PROSPECT');
    expect(client.plan).toBe('GROWTH');
    expect(client.subscriptionStatus).toBe('TRIAL');
  });

  it('refuses anyone who is not a platform admin', async () => {
    session = { id: AUTH.beta };
    const before = await owner.client.count();

    const result = await createClient(app, validClientInput({ businessName: 'Sneaky Ltd' }));

    expect(result.ok).toBe(false);
    expect(await owner.client.count()).toBe(before);
  });

  it('refuses a request with no identity at all', async () => {
    session = null;
    const before = await owner.client.count();

    const result = await createClient(app, validClientInput({ businessName: 'Anonymous Ltd' }));

    expect(result.ok).toBe(false);
    expect(await owner.client.count()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// EDITING A CLIENT — the fourth flow the column grant was silently breaking
// ---------------------------------------------------------------------------

describe('editing a client', () => {
  async function makeClient(overrides: Record<string, unknown> = {}) {
    session = { id: AUTH.admin };
    const result = await createClient(
      app,
      validClientInput({ businessName: 'Sunrise Dental', ...overrides }),
    );
    if (!result.ok) throw new Error(result.message);
    return result.data.id;
  }

  it('saves the ordinary fields, which used to fail outright', async () => {
    const id = await makeClient();
    session = { id: AUTH.admin };

    const result = await updateClient(
      app,
      id,
      validClientInput({
        businessName: 'Sunrise Dental Care',
        areaLabel: 'Baner, Pune',
        ownerName: 'Dr Rao',
        avgCustomerValueInr: 1500,
        notes: 'Second chair added.',
      }),
    );

    expect(result.ok).toBe(true);
    const after = await owner.client.findUniqueOrThrow({ where: { id } });
    expect(after.businessName).toBe('Sunrise Dental Care');
    expect(after.areaLabel).toBe('Baner, Pune');
    expect(after.ownerName).toBe('Dr Rao');
    expect(after.avgCustomerValueInr).toBe(1500);
    expect(after.notes).toBe('Second chair added.');
  });

  it('lets a platform admin move the plan and the pipeline status', async () => {
    const id = await makeClient({ plan: 'STARTER', status: 'PROSPECT' });
    session = { id: AUTH.admin };

    const result = await updateClient(
      app,
      id,
      validClientInput({ businessName: 'Sunrise Dental', plan: 'PRO', status: 'ACTIVE' }),
    );

    expect(result.ok).toBe(true);
    const after = await owner.client.findUniqueOrThrow({ where: { id } });
    expect(after.plan).toBe('PRO');
    expect(after.status).toBe('ACTIVE');
  });

  it('reports the vertical change the caller needs to know about', async () => {
    const id = await makeClient({ vertical: 'clinic' });
    session = { id: AUTH.admin };

    const result = await updateClient(
      app,
      id,
      validClientInput({ businessName: 'Sunrise Dental', vertical: 'salon' }),
    );

    expect(result.ok && result.data.verticalChanged).toBe(true);
  });

  it('refuses to let a business owner put themselves on a better plan', async () => {
    // The action behind this is reached through tenantGate(..., 'OWNER'), which
    // a BUSINESS_OWNER satisfies, and a server action is addressed by action id
    // rather than by path — so the staff-only edit PAGE is not the gate. This
    // is the gate.
    const id = await makeClient({ plan: 'STARTER' });
    await owner.membership.create({
      data: { userId: seeded.betaUserId, clientId: id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
    });
    session = { id: AUTH.beta };

    const result = await updateClient(
      app,
      id,
      validClientInput({ businessName: 'Sunrise Dental', plan: 'PRO', status: 'ACTIVE' }),
    );

    expect(result.ok).toBe(false);
    const after = await owner.client.findUniqueOrThrow({ where: { id } });
    expect(after.plan).toBe('STARTER');
  });

  it('still lets that owner edit the things that are theirs to edit', async () => {
    const id = await makeClient({ plan: 'STARTER', status: 'PROSPECT' });
    await owner.membership.create({
      data: { userId: seeded.betaUserId, clientId: id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
    });
    session = { id: AUTH.beta };

    // Same plan and status as stored, so nothing elevated is attempted.
    const result = await updateClient(
      app,
      id,
      validClientInput({
        businessName: 'Sunrise Dental',
        plan: 'STARTER',
        status: 'PROSPECT',
        ownerPhone: '9876543210',
      }),
    );

    expect(result.ok).toBe(true);
    const after = await owner.client.findUniqueOrThrow({ where: { id } });
    expect(after.ownerPhone).toBe('9876543210');
    expect(after.plan).toBe('STARTER');
  });

  it('cannot be used to edit a business in another tenant', async () => {
    session = { id: AUTH.beta };

    const result = await updateClient(
      app,
      seeded.betaClientId,
      validClientInput({ businessName: 'Beta Gym Renamed', plan: 'PRO' }),
    );

    // Beta's owner may not set a plan, and the business keeps its name.
    expect(result.ok).toBe(false);
    const untouched = await owner.client.findUniqueOrThrow({ where: { id: seeded.betaClientId } });
    expect(untouched.businessName).toBe('Beta Gym');
  });

  it('archives and restores, moving archivedAt and status together', async () => {
    const id = await makeClient();
    session = { id: AUTH.admin };

    expect((await archiveClient(app, id)).ok).toBe(true);
    const archived = await owner.client.findUniqueOrThrow({ where: { id } });
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.status).toBe('CHURNED');

    expect((await restoreClient(app, id)).ok).toBe(true);
    const restored = await owner.client.findUniqueOrThrow({ where: { id } });
    expect(restored.archivedAt).toBeNull();
    expect(restored.status).toBe('PAUSED');
  });
});

// ---------------------------------------------------------------------------
// PASSWORD RESET, DATABASE HALF
// ---------------------------------------------------------------------------

describe('ending every session a person holds', () => {
  it('bumps the version this role has no column privilege to write', async () => {
    // The direct write is refused, which is the whole reason the reset broke.
    session = { id: AUTH.alpha };
    await expect(
      app.user.update({ where: { id: seeded.alphaUserId }, data: { sessionVersion: 2 } }),
    ).rejects.toThrow();

    await bumpSessionVersion(app, seeded.alphaUserId);

    const after = await owner.user.findUniqueOrThrow({ where: { id: seeded.alphaUserId } });
    expect(after.sessionVersion).toBe(2);
  });

  it('refuses to end somebody else’s sessions', async () => {
    session = { id: AUTH.alpha };

    await expect(bumpSessionVersion(app, seeded.betaUserId)).rejects.toThrow();

    const untouched = await owner.user.findUniqueOrThrow({ where: { id: seeded.betaUserId } });
    expect(untouched.sessionVersion).toBe(1);
  });

  it('lets a platform admin end anybody’s', async () => {
    session = { id: AUTH.admin };

    await bumpSessionVersion(app, seeded.betaUserId);

    const bumped = await owner.user.findUniqueOrThrow({ where: { id: seeded.betaUserId } });
    expect(bumped.sessionVersion).toBe(2);
  });
});
