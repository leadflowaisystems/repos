import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * ACCOUNT ACCESS, AS THE ROLE THAT SERVES IT (M39).
 *
 * The generic `tenant_tables` policy (`FOR ALL` to any accessible member)
 * would let a plain BUSINESS_STAFF colleague read and rewrite another
 * person's temporary credential — including `disabledAt`/`disabledByUserId`,
 * which is exactly the admin-only decision this table exists to protect.
 * This is the case `tests/m38.team-rls.test.ts` proved for Membership and
 * Invitation, run again for the table this milestone adds: connected as
 * `repos_app`, through the real `src/lib/db.ts`, against the real
 * `prisma/m20/rls.sql`. Only the Supabase boundary is mocked.
 *
 * Four people, and what each may do with one client's AccountAccess row:
 *
 *   a) a platform admin           full access — create, read, update
 *   b) the bound owner            reads and updates their own row, and only
 *                                  the columns the setup action ever touches
 *   c) a colleague on the SAME client, not the one this row is bound to
 *                                  nothing — the assertion this file exists for
 *   d) an unrelated tenant's owner   nothing
 *   e) no identity at all          nothing
 */

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

const AUTH = {
  admin: '11111111-1111-4111-8111-111111111111',
  alphaBound: '22222222-2222-4222-8222-222222222222',
  alphaColleague: '33333333-3333-4333-8333-333333333333',
  betaOwner: '44444444-4444-4444-8444-444444444444',
  loner: 'deadbeef-0000-4000-8000-000000000000',
} as const;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let ids: {
  admin: string;
  alphaBound: string;
  alphaColleague: string;
  betaOwner: string;
  loner: string;
  alpha: string;
  beta: string;
};

beforeAll(async () => {
  harness = await createRlsTestDb('m39-account-access-rls');
  owner = harness.owner;
  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;
  ({ prisma: app } = await import('@/lib/db'));
}, 180_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  session = null;
  await resetDb(owner);

  const user = (email: string, authProviderId: string, extra: Record<string, unknown> = {}) =>
    owner.user.create({ data: { email, authProviderId, ...extra }, select: { id: true } });

  const [admin, alphaBound, alphaColleague, betaOwner, loner] = await Promise.all([
    user('admin@headway.test', AUTH.admin, { isPlatformAdmin: true, name: 'Headway' }),
    user('temp@alpha.test', AUTH.alphaBound, { name: 'Alpha Temp Owner' }),
    user('colleague@alpha.test', AUTH.alphaColleague, { name: 'Alpha Colleague' }),
    user('owner@beta.test', AUTH.betaOwner, { name: 'Beta Owner' }),
    user('nobody@else.test', AUTH.loner),
  ]);

  const alpha = await owner.client.create({
    data: { businessName: 'Alpha Salon', vertical: 'salon', status: 'ACTIVE' },
    select: { id: true },
  });
  const beta = await owner.client.create({
    data: { businessName: 'Beta Gym', vertical: 'gym', status: 'ACTIVE' },
    select: { id: true },
  });
  await owner.membership.createMany({
    data: [
      { userId: alphaBound.id, clientId: alpha.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
      { userId: alphaColleague.id, clientId: alpha.id, role: 'BUSINESS_STAFF', status: 'ACTIVE' },
      { userId: betaOwner.id, clientId: beta.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
    ],
  });
  await owner.accountAccess.create({
    data: {
      clientId: alpha.id,
      userId: alphaBound.id,
      loginId: 'abcdefgh@access.headway.local',
      status: 'TEMPORARY_ACTIVE',
      createdByUserId: admin.id,
    },
  });

  ids = {
    admin: admin.id,
    alphaBound: alphaBound.id,
    alphaColleague: alphaColleague.id,
    betaOwner: betaOwner.id,
    loner: loner.id,
    alpha: alpha.id,
    beta: beta.id,
  };
});

describe('the policy is in place', () => {
  it('forces RLS and ships exactly three policies, none of them the generic tenant one', async () => {
    const rls = await owner.$queryRawUnsafe<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname = 'AccountAccess'`,
    );
    expect(rls[0]?.relrowsecurity).toBe(true);
    expect(rls[0]?.relforcerowsecurity).toBe(true);

    const policies = await owner.$queryRawUnsafe<{ policyname: string; cmd: string }[]>(
      `SELECT policyname, cmd FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'AccountAccess' ORDER BY policyname`,
    );
    expect(policies.map((p) => p.policyname)).toEqual([
      'account_access_admin_all',
      'account_access_self_read',
      'account_access_self_update',
    ]);
  });
});

describe('a) a platform admin', () => {
  it('reads and writes any row', async () => {
    session = { id: AUTH.admin };
    const row = await app.accountAccess.findUnique({ where: { clientId: ids.alpha } });
    expect(row?.loginId).toBe('abcdefgh@access.headway.local');

    await app.accountAccess.update({
      where: { clientId: ids.alpha },
      data: { status: 'DISABLED', disabledByUserId: ids.admin },
    });
    const disabled = await owner.accountAccess.findUnique({ where: { clientId: ids.alpha } });
    expect(disabled?.status).toBe('DISABLED');
  });

  it('may create a new row', async () => {
    session = { id: AUTH.admin };
    await app.accountAccess.create({
      data: {
        clientId: ids.beta,
        userId: ids.betaOwner,
        loginId: 'ijklmnop@access.headway.local',
        createdByUserId: ids.admin,
      },
    });
    expect(await owner.accountAccess.count({ where: { clientId: ids.beta } })).toBe(1);
  });
});

describe('b) the bound owner', () => {
  it('reads their own row', async () => {
    session = { id: AUTH.alphaBound };
    const row = await app.accountAccess.findUnique({ where: { userId: ids.alphaBound } });
    expect(row?.status).toBe('TEMPORARY_ACTIVE');
  });

  it('may complete their own setup, but not touch an immutable column', async () => {
    session = { id: AUTH.alphaBound };
    const updated = await app.accountAccess.update({
      where: { userId: ids.alphaBound },
      data: { status: 'SETUP_COMPLETE', setupCompletedAt: new Date() },
      select: { status: true },
    });
    expect(updated.status).toBe('SETUP_COMPLETE');

    // loginId has no column grant for repos_app at all — not even for the
    // row's own bound user — because nothing in the product ever rewrites it.
    await expect(
      app.accountAccess.update({
        where: { userId: ids.alphaBound },
        data: { loginId: 'zzzzzzzz@access.headway.local' },
      }),
    ).rejects.toThrow();
  });

  it('cannot create a row directly — only the admin path may', async () => {
    session = { id: AUTH.alphaBound };
    await expect(
      app.accountAccess.create({
        data: { clientId: ids.beta, userId: ids.betaOwner, loginId: 'qqqqqqqq@access.headway.local' },
      }),
    ).rejects.toThrow();
  });
});

describe('c) a colleague on the same client who is not the bound user', () => {
  it('sees nothing at all for this row', async () => {
    session = { id: AUTH.alphaColleague };
    expect(await app.accountAccess.findUnique({ where: { clientId: ids.alpha } })).toBeNull();
    expect(await app.accountAccess.findMany()).toEqual([]);
  });

  it('cannot disable it, or touch it in any way — the assertion this file exists for', async () => {
    session = { id: AUTH.alphaColleague };
    await expect(
      app.accountAccess.update({
        where: { clientId: ids.alpha },
        data: { status: 'DISABLED', disabledByUserId: ids.alphaColleague },
      }),
    ).rejects.toThrow();
    const untouched = await owner.accountAccess.findUnique({ where: { clientId: ids.alpha } });
    expect(untouched?.status).toBe('TEMPORARY_ACTIVE');
  });
});

describe('d) an unrelated tenant', () => {
  it("sees none of another business's temporary access", async () => {
    session = { id: AUTH.betaOwner };
    expect(await app.accountAccess.findUnique({ where: { clientId: ids.alpha } })).toBeNull();
    expect(await app.accountAccess.findMany()).toEqual([]);
  });
});

describe('e) no identity', () => {
  it('sees nothing', async () => {
    session = null;
    expect(await app.accountAccess.findMany()).toEqual([]);
    expect(await app.accountAccess.findUnique({ where: { clientId: ids.alpha } })).toBeNull();
  });
});
