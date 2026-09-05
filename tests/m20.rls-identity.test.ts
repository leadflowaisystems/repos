import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';
import { createClient } from '@/lib/clients/service';
import { ACTIVE, ROLE_OWNER, ROLE_STAFF } from '@/lib/tenancy/service';

/**
 * WHICH IDENTITY REACHES THE POLICIES (M20).
 *
 * Two identifiers name the same person. Supabase Auth issues a UUID; RepOS's
 * own `User.id` is a cuid; `User.authProviderId` holds the UUID so the two can
 * be mapped. Every RLS policy compares against `User.id`.
 *
 * `db.ts` used to put the UUID into `app.user_id` directly. Nothing errored —
 * the policies simply matched no row, so every query would have returned
 * nothing the moment the runtime stopped bypassing RLS. The application would
 * have gone blank, on every page, for every account, at cutover.
 *
 * The Stage 10B proof missed it because the proof supplied `User.id` by hand
 * while the application supplied the UUID. It tested the policies and never
 * tested the wiring into them. So these tests deliberately do NOT inject a
 * cuid: they mock only `supabase.auth.getUser` — the real external boundary —
 * and let `db.ts` do its own resolution, exactly as it does in production.
 *
 * The last case in the first block is the one that matters most: it feeds the
 * policies the UUID and asserts they go blind. That is the bug, kept as a test
 * so it cannot come back quietly.
 */

const SCHEMA = 'test_m20_rls_identity';

/**
 * Pointing DATABASE_URL at this schema BEFORE anything imports `db.ts`.
 *
 * `db.ts` builds its client at module load, from whatever DATABASE_URL exists
 * at that moment. Setting it in `beforeAll` was enough only while nothing in
 * this file's static import graph reached `db.ts` first — and that held by
 * accident, not by design. The moment a service this file imports gained an
 * import of `db.ts`, the client was built during module evaluation, against
 * whatever `.env` happened to say, and every resolution here quietly returned
 * null against a database that was not even running.
 *
 * `vi.hoisted` runs above the imports, which is the only place that assumption
 * can actually be made true.
 */
const { BASE, URL_ } = vi.hoisted(() => {
  const base = process.env.REPOS_TEST_DATABASE_URL;
  const url = `${base}?schema=test_m20_rls_identity`;
  process.env.DATABASE_URL = url;
  process.env.DIRECT_DATABASE_URL = url;
  return { BASE: base, URL_: url };
});

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
        session ? { data: { user: { id: session.id } }, error: null } : { data: { user: null }, error: null },
    },
  }),
}));

let db: PrismaClient;
let currentUserId: () => Promise<string | null>;

/** Real Supabase-shaped UUIDs, so the resolution has something true to do. */
const AUTH = {
  admin: '3f8c1d20-9a4e-4b71-8c33-2b6f0a1d5e70',
  owner: '7b21e4a8-6c5d-4f19-9e02-1a7c3d8b4f65',
  staff: 'c4d97e13-2f60-4a8b-b7d5-8e91c0a2f34d',
  suspended: '0a5b6c7d-8e9f-4012-a345-6b7c8d9e0f12',
  stranger: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
} as const;

type Seeded = { adminId: string; ownerId: string; staffId: string; alphaId: string; betaId: string };

/**
 * Installs the identity helpers from the real rls.sql, pointed at this test
 * file's schema. Reading the shipped DDL rather than restating it means a
 * change to production's definition is exercised here instead of drifting.
 */
async function installIdentityFunctions(): Promise<void> {
  const file = readFileSync(join(resolve(__dirname, '..'), 'prisma', 'm20', 'rls.sql'), 'utf8');

  const wanted = [
    'CREATE OR REPLACE FUNCTION app.current_user_id()',
    'CREATE OR REPLACE FUNCTION app.user_id_for_auth(p_auth_id text)',
    'CREATE OR REPLACE FUNCTION app.is_platform_admin()',
    'CREATE OR REPLACE FUNCTION app.accessible_client_ids()',
    'CREATE OR REPLACE FUNCTION app.owned_client_ids()',
  ];

  await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS app');

  for (const head of wanted) {
    const from = file.indexOf(head);
    expect(from, `rls.sql no longer defines ${head}`).toBeGreaterThan(0);
    const to = file.indexOf('$$;', from);
    expect(to).toBeGreaterThan(from);
    const statement = file
      .slice(from, to + 2)
      // Every body fully qualifies its tables, so aiming them at this schema is
      // a substitution rather than a rewrite.
      .replace(/\bpublic\.("[A-Za-z]+")/g, `"${SCHEMA}".$1`)
      .replace(/SET search_path = pg_catalog, public/g, `SET search_path = pg_catalog, "${SCHEMA}"`);
    await db.$executeRawUnsafe(statement);
  }
}

async function seed(): Promise<Seeded> {
  const alpha = await createClient(db, validClientInput({ businessName: 'Alpha Cafe' }));
  const beta = await createClient(db, validClientInput({ businessName: 'Beta Dental' }));
  if (!alpha.ok || !beta.ok) throw new Error('seed failed');

  const mk = (email: string, authProviderId: string, isPlatformAdmin = false, status = ACTIVE) =>
    db.user.create({
      data: { email, authProviderId, isPlatformAdmin, status },
      select: { id: true },
    });

  const admin = await mk('admin@repos.test', AUTH.admin, true);
  const owner = await mk('owner@alpha.test', AUTH.owner);
  const staff = await mk('staff@alpha.test', AUTH.staff);
  await mk('gone@alpha.test', AUTH.suspended, false, 'SUSPENDED');

  await db.membership.create({
    data: { userId: owner.id, clientId: alpha.data.id, role: ROLE_OWNER, status: ACTIVE },
  });
  await db.membership.create({
    data: { userId: staff.id, clientId: alpha.data.id, role: ROLE_STAFF, status: ACTIVE },
  });

  return {
    adminId: admin.id,
    ownerId: owner.id,
    staffId: staff.id,
    alphaId: alpha.data.id,
    betaId: beta.data.id,
  };
}

/** What the policies would grant, for whatever identity is put in front of them. */
async function policyViewFor(userId: string | null): Promise<{ admin: boolean; accessible: string[]; owned: string[] }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ''}, TRUE)`;
    const flags = await tx.$queryRawUnsafe<{ admin: boolean }[]>(
      'SELECT app.is_platform_admin() AS admin',
    );
    const admin = flags[0]?.admin ?? false;
    const accessible = await tx.$queryRawUnsafe<{ id: string }[]>(
      'SELECT * FROM app.accessible_client_ids() AS id',
    );
    const owned = await tx.$queryRawUnsafe<{ id: string }[]>(
      'SELECT * FROM app.owned_client_ids() AS id',
    );
    return { admin, accessible: accessible.map((r) => r.id), owned: owned.map((r) => r.id) };
  });
}

let seeded: Seeded;

beforeAll(async () => {
  db = createTestDb('m20-rls-identity');
  await installIdentityFunctions();

  // Already pointed at this schema above, before any import could build a
  // client against something else.
  ({ currentUserId } = await import('@/lib/db'));
}, 180_000);

beforeEach(async () => {
  await resetDb(db);
  seeded = await seed();
  session = null;
});

afterAll(async () => {
  await db.$disconnect();
});

describe('resolving a Supabase UUID to the identity the policies use', () => {
  it('gives back User.id, not the UUID it was handed', async () => {
    session = { id: AUTH.owner };
    const resolved = await currentUserId();

    expect(resolved).toBe(seeded.ownerId);
    expect(resolved).not.toBe(AUTH.owner);
    // cuid, not uuid: the shapes differ, so a regression is visible at a glance.
    expect(resolved).toMatch(/^c[a-z0-9]{20,}$/);
  });

  it('resolves each kind of account to its own row', async () => {
    for (const [who, id] of [
      ['admin', seeded.adminId],
      ['owner', seeded.ownerId],
      ['staff', seeded.staffId],
    ] as const) {
      session = { id: AUTH[who] };
      expect(await currentUserId(), who).toBe(id);
    }
  });

  it('resolves nothing for a forged UUID, a suspended account, or a signed-out request', async () => {
    session = { id: AUTH.stranger };
    expect(await currentUserId(), 'forged').toBeNull();

    // A suspension has to bite at the database, not only in the pages that
    // remember to check for it.
    session = { id: AUTH.suspended };
    expect(await currentUserId(), 'suspended').toBeNull();

    session = null;
    expect(await currentUserId(), 'signed out').toBeNull();
  });

  it('THE REGRESSION: the raw UUID makes every policy blind', async () => {
    // This is the bug, kept as a test. Before the fix, db.ts put this value
    // into app.user_id. Nothing threw; the application would simply have shown
    // every account an empty RepOS the moment RLS started applying to it.
    const asUuid = await policyViewFor(AUTH.admin);
    expect(asUuid.admin).toBe(false);
    expect(asUuid.accessible).toEqual([]);

    session = { id: AUTH.admin };
    const asResolved = await policyViewFor(await currentUserId());
    expect(asResolved.admin).toBe(true);
    expect(asResolved.accessible).toHaveLength(2);
  });
});

describe('what each resolved identity may reach', () => {
  it('platform admin: every business, with owner-level rights in each', async () => {
    session = { id: AUTH.admin };
    const view = await policyViewFor(await currentUserId());

    expect(view.admin).toBe(true);
    expect(view.accessible.sort()).toEqual([seeded.alphaId, seeded.betaId].sort());
    // Owner-level too, everywhere. `owned_client_ids()` carries the same
    // platform-admin branch as `accessible_client_ids()`, so an admin can make
    // owner-only changes to any business without holding a membership - which
    // is what the application already believes: `canManage` short-circuits on
    // isPlatformAdmin before it looks for one. The two agreeing is the point;
    // a database that disagreed would refuse writes the UI had just offered.
    expect(view.owned.sort()).toEqual([seeded.alphaId, seeded.betaId].sort());
  });

  it('business owner: their own tenant, and it counts as owned', async () => {
    session = { id: AUTH.owner };
    const view = await policyViewFor(await currentUserId());

    expect(view.admin).toBe(false);
    expect(view.accessible).toEqual([seeded.alphaId]);
    expect(view.owned).toEqual([seeded.alphaId]);
    expect(view.accessible).not.toContain(seeded.betaId);
  });

  it('business staff: the same tenant, but owning nothing in it', async () => {
    session = { id: AUTH.staff };
    const view = await policyViewFor(await currentUserId());

    expect(view.admin).toBe(false);
    expect(view.accessible).toEqual([seeded.alphaId]);
    expect(view.owned).toEqual([]);
  });

  it('forged, suspended and signed-out identities reach nothing at all', async () => {
    for (const who of ['stranger', 'suspended'] as const) {
      session = { id: AUTH[who] };
      const view = await policyViewFor(await currentUserId());
      expect(view.admin, who).toBe(false);
      expect(view.accessible, who).toEqual([]);
      expect(view.owned, who).toEqual([]);
    }

    const signedOut = await policyViewFor(null);
    expect(signedOut.admin).toBe(false);
    expect(signedOut.accessible).toEqual([]);
  });

  it('a suspended owner keeps the membership but loses the access', async () => {
    // The membership row is untouched; it is the account status that decides,
    // and it decides at the database.
    session = { id: AUTH.owner };
    expect((await policyViewFor(await currentUserId())).accessible).toEqual([seeded.alphaId]);

    await db.user.update({ where: { id: seeded.ownerId }, data: { status: 'SUSPENDED' } });

    session = { id: AUTH.owner };
    expect(await currentUserId()).toBeNull();
    expect((await policyViewFor(await currentUserId())).accessible).toEqual([]);
    expect(await db.membership.count({ where: { userId: seeded.ownerId } })).toBe(1);
  });
});

describe('the window before the DDL is applied', () => {
  it('still resolves when app.user_id_for_auth does not exist yet', async () => {
    // Production is still on the owner role and has not had the new function
    // applied, so this is the path it takes TODAY. It has to work, or the fix
    // for the cutover would break the thing it is meant to protect.
    await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS app.user_id_for_auth(text)');
    vi.resetModules();
    const fresh = await import('@/lib/db');

    session = { id: AUTH.owner };
    expect(await fresh.currentUserId()).toBe(seeded.ownerId);

    session = { id: AUTH.stranger };
    expect(await fresh.currentUserId()).toBeNull();

    session = { id: AUTH.suspended };
    expect(await fresh.currentUserId(), 'a suspension still bites').toBeNull();

    await installIdentityFunctions();
  });
});
