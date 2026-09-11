import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE TEAM PAGE, AS THE ROLE THAT RENDERS IT (M38).
 *
 * `user_self_or_admin` let a person read one row of public."User": their own.
 * The Team page joins Membership to User for every member's name and email,
 * so for any owner who was not Headway staff and whose business had a second
 * member the join came back empty for the colleague and Prisma threw:
 *
 *   Inconsistent query result: Field user is required to return data, got `null`
 *
 * It shipped because every business a platform admin opens has the admin in
 * it. This file is the case that was missing: a real owner, a real second
 * member, connected as `repos_app`, through the real `src/lib/db.ts`, against
 * the real `prisma/m20/rls.sql` — the same shape as the runtime-role file, and
 * for the same reason. Only the Supabase boundary is mocked.
 *
 * Five people, and what each may see:
 *
 *   a) an owner with two colleagues     the whole team, names and emails
 *   b) an ordinary member               the same team (staff may see who else is in it)
 *   c) an owner of an unrelated business   nobody in the first one
 *   d) a platform admin                 everyone
 *   e) no identity at all               nobody
 *
 * And the boundary that must not move: reading a colleague is not writing one.
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
  alphaOwner: '22222222-2222-4222-8222-222222222222',
  alphaStaff: '33333333-3333-4333-8333-333333333333',
  alphaSuspended: '55555555-5555-4555-8555-555555555555',
  betaOwner: '44444444-4444-4444-8444-444444444444',
  loner: 'deadbeef-0000-4000-8000-000000000000',
} as const;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;
let getTeam: typeof import('@/lib/team/service')['getTeam'];
let inviteMember: typeof import('@/lib/team/service')['inviteMember'];

let ids: {
  admin: string;
  alphaOwner: string;
  alphaStaff: string;
  alphaSuspended: string;
  betaOwner: string;
  loner: string;
  alpha: string;
  beta: string;
};

beforeAll(async () => {
  harness = await createRlsTestDb('m38-team-rls');
  owner = harness.owner;
  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;
  ({ getTeam, inviteMember } = await import('@/lib/team/service'));
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

  const [admin, alphaOwner, alphaStaff, alphaSuspended, betaOwner, loner] = await Promise.all([
    user('admin@headway.test', AUTH.admin, { isPlatformAdmin: true, name: 'Headway' }),
    user('owner@alpha.test', AUTH.alphaOwner, { name: 'Alpha Owner' }),
    user('staff@alpha.test', AUTH.alphaStaff, { name: 'Alpha Staff' }),
    user('former@alpha.test', AUTH.alphaSuspended, { name: 'Alpha Former' }),
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
      { userId: alphaOwner.id, clientId: alpha.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
      { userId: alphaStaff.id, clientId: alpha.id, role: 'BUSINESS_STAFF', status: 'ACTIVE' },
      { userId: alphaSuspended.id, clientId: alpha.id, role: 'BUSINESS_STAFF', status: 'SUSPENDED' },
      { userId: betaOwner.id, clientId: beta.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
    ],
  });

  ids = {
    admin: admin.id,
    alphaOwner: alphaOwner.id,
    alphaStaff: alphaStaff.id,
    alphaSuspended: alphaSuspended.id,
    betaOwner: betaOwner.id,
    loner: loner.id,
    alpha: alpha.id,
    beta: beta.id,
  };
});

/** Which User rows this session can read, by email, sorted. */
async function visibleUsers(): Promise<string[]> {
  const rows = await app.user.findMany({ select: { email: true }, orderBy: { email: 'asc' } });
  return rows.map((r) => r.email);
}

describe('the policy is in place', () => {
  it('ships the colleague function and the read-only policy', async () => {
    const fn = await owner.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app' AND p.proname = 'colleague_user_ids'`,
    );
    expect(Number(fn[0]?.n)).toBe(1);

    const policy = await owner.$queryRawUnsafe<{ cmd: string; permissive: string }[]>(
      `SELECT cmd, permissive FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'User' AND policyname = 'user_colleague_read'`,
    );
    expect(policy).toHaveLength(1);
    // SELECT only. Writing a colleague is still governed by user_self_or_admin.
    expect(policy[0]?.cmd).toBe('SELECT');
  });
});

describe('a) an owner whose business has other members', () => {
  it('opens the Team page: every member, with name and email, and no throw', async () => {
    session = { id: AUTH.alphaOwner };
    const team = await getTeam(app, ids.alpha);
    expect(team.members.map((m) => m.email).sort()).toEqual([
      'former@alpha.test',
      'owner@alpha.test',
      'staff@alpha.test',
    ]);
    expect(team.members.find((m) => m.email === 'staff@alpha.test')?.name).toBe('Alpha Staff');
    // The suspended colleague is still listed, as suspended — which is why a
    // suspended membership's User row has to be readable too.
    expect(team.members.find((m) => m.email === 'former@alpha.test')?.status).toBe('SUSPENDED');
    expect(team.members.find((m) => m.email === 'owner@alpha.test')?.isLastOwner).toBe(true);
  });

  it('sees exactly the people of their own business, and nobody else', async () => {
    session = { id: AUTH.alphaOwner };
    expect(await visibleUsers()).toEqual(['former@alpha.test', 'owner@alpha.test', 'staff@alpha.test']);
  });

  it('is refused when inviting somebody who is already on the team', async () => {
    // The duplicate check filters Membership by the invitee's User row. Without
    // colleague visibility it could not see the row and let a second
    // invitation through.
    session = { id: AUTH.alphaOwner };
    const result = await inviteMember(app, ids.alpha, {
      email: 'staff@alpha.test',
      role: 'BUSINESS_STAFF',
      invitedById: ids.alphaOwner,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toMatch(/already on this team/i);
    expect(await owner.invitation.count({ where: { clientId: ids.alpha } })).toBe(0);
  });
});

describe('b) an ordinary member', () => {
  it('sees who else is in the business, and only them', async () => {
    session = { id: AUTH.alphaStaff };
    const team = await getTeam(app, ids.alpha);
    expect(team.members.map((m) => m.email).sort()).toEqual([
      'former@alpha.test',
      'owner@alpha.test',
      'staff@alpha.test',
    ]);
    expect(await visibleUsers()).toEqual(['former@alpha.test', 'owner@alpha.test', 'staff@alpha.test']);
  });

  it('cannot change a colleague: reading is not writing', async () => {
    session = { id: AUTH.alphaStaff };
    // The row is readable now, but the UPDATE path is still self-or-admin, so
    // the database shows the update no row to change.
    await expect(
      app.user.update({ where: { id: ids.alphaOwner }, data: { name: 'Renamed by staff' } }),
    ).rejects.toThrow();
    const untouched = await owner.user.findUnique({ where: { id: ids.alphaOwner }, select: { name: true } });
    expect(untouched?.name).toBe('Alpha Owner');

    // Their own row, they may.
    const mine = await app.user.update({ where: { id: ids.alphaStaff }, data: { name: 'Alpha Staff Two' }, select: { name: true } });
    expect(mine.name).toBe('Alpha Staff Two');
  });

  it('whose own membership is suspended sees nobody at all', async () => {
    // A suspended caller holds no ACTIVE membership, so the colleague rule
    // gives them nothing — the same answer loadActor gives at the door.
    session = { id: AUTH.alphaSuspended };
    expect(await visibleUsers()).toEqual(['former@alpha.test']);
  });
});

describe('c) the owner of an unrelated business', () => {
  it('sees none of the first business, and the Team query returns nothing rather than throwing', async () => {
    session = { id: AUTH.betaOwner };
    expect(await visibleUsers()).toEqual(['owner@beta.test']);
    expect(await app.user.findUnique({ where: { id: ids.alphaOwner } })).toBeNull();
    expect(await app.membership.count({ where: { clientId: ids.alpha } })).toBe(0);

    const team = await getTeam(app, ids.alpha);
    expect(team.members).toEqual([]);
    expect(team.invites).toEqual([]);
  });

  it('with no membership anywhere sees only themselves', async () => {
    session = { id: AUTH.loner };
    expect(await visibleUsers()).toEqual(['nobody@else.test']);
  });
});

describe('d) a platform admin', () => {
  it('sees everyone, as before', async () => {
    session = { id: AUTH.admin };
    expect(await visibleUsers()).toHaveLength(6);
    const team = await getTeam(app, ids.alpha);
    expect(team.members).toHaveLength(3);
    expect(team.members.every((m) => m.email.endsWith('@alpha.test'))).toBe(true);
  });
});

describe('e) no identity', () => {
  it('sees no user, no membership, and no team', async () => {
    session = null;
    expect(await app.user.findMany()).toEqual([]);
    expect(await app.membership.findMany()).toEqual([]);
    const team = await getTeam(app, ids.alpha);
    expect(team.members).toEqual([]);
  });

  it('is what a pipeline run gets too: a client scope names no person', async () => {
    // The colleague rule reads app.current_user_id() alone. A run scoped to a
    // client through app.service_client_id can read that client's rows and
    // still no User row of anybody in it.
    const rows = await owner.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.service_client_id', ${ids.alpha}, TRUE)`;
      return tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM public."User" WHERE id IN (SELECT app.colleague_user_ids())`;
    });
    expect(Number(rows[0]?.n)).toBe(0);
  });
});
