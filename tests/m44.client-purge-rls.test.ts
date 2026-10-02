import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb, validClientInput } from './helpers/test-db';

/**
 * PERMANENTLY DELETING AN ARCHIVED BUSINESS, AS THE ROLE THAT SERVES IT (M44).
 *
 * Connected as `repos_app`, through the real `src/lib/db.ts`, against the real
 * `prisma/m20/rls.sql` — only the Supabase boundary is mocked, and nothing
 * here can reach a real Supabase project or a real database (see
 * tests/helpers/rls-db.ts, which refuses any non-local host).
 *
 * Two businesses share the database, and every tenant table holds rows for
 * BOTH before anything is deleted, so "Alpha's rows are gone" and "Beta's rows
 * are untouched" are both assertions about real rows. The people:
 *
 *   admin        Headway staff
 *   alphaOwner   signed up themselves; Alpha only
 *   alphaStaff   invited; Alpha only
 *   shared       a member of Alpha AND Beta — one person, two businesses
 *   betaOwner    Beta only
 *   generated    the temporary login Headway generated for Alpha (M39),
 *                never claimed
 *
 * What must hold:
 *
 *   * archive → restore still works, and restore is impossible once deleted;
 *   * only an ARCHIVED business can be deleted, only by platform staff, and
 *     the database refuses the rest for itself;
 *   * deleting removes every row in every table that carries a clientId —
 *     found from the catalogue, not from a list somebody has to maintain;
 *   * no other business loses a row;
 *   * every person keeps their account; only the generated, unclaimed login
 *     goes, and it is revoked in Supabase BEFORE anything is deleted;
 *   * afterwards nothing resolves the business: not the id, the archive list,
 *     the QR token, the owner's link, nor a former member's gate.
 */

let session: { id: string } | null = null;
const removed: string[] = [];
let removeOutcome: { ok: true } | { ok: false; message: string } = { ok: true };

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

// The service-role boundary. Recorded, never real.
vi.mock('@/lib/auth/supabase-admin', () => ({
  SUPABASE_SERVICE_ROLE_KEY_VAR: 'SUPABASE_SERVICE_ROLE_KEY',
  isAccountAccessConfigured: () => true,
  removeGeneratedIdentity: async (authUserId: string) => {
    if (removeOutcome.ok) removed.push(authUserId);
    return removeOutcome;
  },
  createTempIdentity: async () => {
    throw new Error('not in this file');
  },
  randomizeIdentityPassword: async () => {},
  setPermanentCredentials: async () => ({ ok: true }),
  deleteIdentity: async () => {},
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to });
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const AUTH = {
  admin: '11111111-1111-4111-8111-111111111111',
  alphaOwner: '22222222-2222-4222-8222-222222222222',
  alphaStaff: '33333333-3333-4333-8333-333333333333',
  shared: '44444444-4444-4444-8444-444444444444',
  betaOwner: '55555555-5555-4555-8555-555555555555',
  generated: '66666666-6666-4666-8666-666666666666',
} as const;

const GENERATED_LOGIN = 'abcdefgh@access.headway.local';

// Real token shapes (22 characters from TOKEN_ALPHABET), so the resolvers
// accept them and a null answer means the row is gone, not the shape wrong.
const TOKENS = {
  gateway: { alpha: 'gw' + 'a'.repeat(20), beta: 'gw' + 'b'.repeat(20) },
  portal: { alpha: 'pt' + 'a'.repeat(20), beta: 'pt' + 'b'.repeat(20) },
} as const;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

type Ids = Record<keyof typeof AUTH, string> & { alpha: string; beta: string };
let ids: Ids;

beforeAll(async () => {
  harness = await createRlsTestDb('m44-client-purge-rls');
  owner = harness.owner;
  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;
  ({ prisma: app } = await import('@/lib/db'));
}, 180_000);

afterAll(async () => {
  await harness?.dispose();
});

/** One row in every tenant table, for one business. */
async function seedTenant(clientId: string, tag: 'alpha' | 'beta', createdBy: string) {
  const snapshot = await owner.snapshot.create({ data: { clientId, capturedAt: new Date() } });
  const action = await owner.improvementAction.create({
    data: {
      clientId,
      insightId: `${clientId}:ISSUE:wait_time`,
      themeKey: 'wait_time',
      themeLabel: 'Waiting time',
      baselineCount: 3,
      baselineTotal: 9,
      baselineCapturedAt: new Date(),
      title: `Shorter waits at ${tag}`,
    },
  });
  await Promise.all([
    owner.reviewItem.create({ data: { clientId, snapshotId: snapshot.id, text: `Waited too long at ${tag}` } }),
    owner.reviewItem.create({ data: { clientId, text: `Friendly staff at ${tag}`, source: 'REP_OS_QR' } }),
    owner.businessContext.create({ data: { clientId, kind: 'TRIED', text: 'Added a second counter', actionId: action.id } }),
    owner.voiceProfile.create({ data: { clientId } }),
    owner.businessPolicy.create({ data: { clientId } }),
    owner.kitConfig.create({ data: { clientId } }),
    owner.competitor.create({ data: { clientId, name: `Rival of ${tag}` } }),
    owner.minute.create({ data: { clientId, occurredAt: new Date(), title: 'Kick-off call' } }),
    owner.timeEntry.create({ data: { clientId, taskType: 'Onboarding', minutes: 30, entryDate: new Date() } }),
    owner.feedbackGateway.create({ data: { clientId, publicToken: TOKENS.gateway[tag] } }),
    owner.commercial.create({ data: { clientId, amountInr: 1500 } }),
    owner.serviceContinuationRequest.create({ data: { clientId, name: tag, phone: '9000000000' } }),
    owner.kitOrder.create({ data: { clientId, number: 1, itemsJson: '[]', totalInr: 0, completedByUserId: createdBy } }),
    owner.invitation.create({
      data: {
        clientId,
        email: `invitee@${tag}.test`,
        tokenHash: `hash-${tag}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        invitedById: createdBy,
      },
    }),
  ]);
}

/** Every table in `public` that carries a clientId column — from the catalogue. */
async function tenantTables(): Promise<string[]> {
  const rows = await owner.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT c.table_name FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = 'clientId' AND t.table_type = 'BASE TABLE'
      ORDER BY 1`,
  );
  return rows.map((r) => r.table_name);
}

async function rowsFor(clientId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of await tenantTables()) {
    const rows = await owner.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM public."${table}" WHERE "clientId" = $1`,
      clientId,
    );
    out[table] = Number(rows[0]?.n ?? 0);
  }
  return out;
}

async function archive(clientId: string) {
  await owner.client.update({ where: { id: clientId }, data: { archivedAt: new Date(), status: 'CHURNED' } });
}

beforeEach(async () => {
  session = null;
  removed.length = 0;
  removeOutcome = { ok: true };
  await resetDb(owner);
  await owner.user.deleteMany();

  const user = (email: string, authProviderId: string | null, extra: Record<string, unknown> = {}) =>
    owner.user.create({ data: { email, authProviderId, ...extra }, select: { id: true } });
  const [admin, alphaOwner, alphaStaff, shared, betaOwner, generated] = await Promise.all([
    user('admin@headway.test', AUTH.admin, { isPlatformAdmin: true, name: 'Headway' }),
    user('owner@alpha.test', AUTH.alphaOwner),
    user('staff@alpha.test', AUTH.alphaStaff),
    user('both@shared.test', AUTH.shared),
    user('owner@beta.test', AUTH.betaOwner),
    // M52: the owner User temporary access made, with no login of its own;
    // the temporary login is a separate identity, named on AccountAccess.
    user(GENERATED_LOGIN, null),
  ]);

  const alpha = await owner.client.create({
    data: { businessName: 'Alpha Salon', vertical: 'salon', status: 'ACTIVE', portalToken: TOKENS.portal.alpha },
    select: { id: true },
  });
  const beta = await owner.client.create({
    data: { businessName: 'Beta Gym', vertical: 'gym', status: 'ACTIVE', portalToken: TOKENS.portal.beta },
    select: { id: true },
  });

  await owner.membership.createMany({
    data: [
      { userId: alphaOwner.id, clientId: alpha.id, role: 'BUSINESS_OWNER' },
      { userId: alphaStaff.id, clientId: alpha.id, role: 'BUSINESS_STAFF' },
      { userId: generated.id, clientId: alpha.id, role: 'BUSINESS_OWNER' },
      { userId: shared.id, clientId: alpha.id, role: 'BUSINESS_STAFF' },
      { userId: shared.id, clientId: beta.id, role: 'BUSINESS_STAFF' },
      { userId: betaOwner.id, clientId: beta.id, role: 'BUSINESS_OWNER' },
    ],
  });
  await owner.accountAccess.create({
    data: {
      clientId: alpha.id,
      userId: generated.id,
      loginId: GENERATED_LOGIN,
      tempAuthId: AUTH.generated,
      createdByUserId: admin.id,
    },
  });

  await seedTenant(alpha.id, 'alpha', admin.id);
  await seedTenant(beta.id, 'beta', admin.id);

  ids = {
    admin: admin.id,
    alphaOwner: alphaOwner.id,
    alphaStaff: alphaStaff.id,
    shared: shared.id,
    betaOwner: betaOwner.id,
    generated: generated.id,
    alpha: alpha.id,
    beta: beta.id,
  };
});

describe('the ground this file stands on', () => {
  it('has a local runtime-role database to run against', () => {
    expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
  });

  it('cascades every clientId foreign key from Client, so one delete reaches every table', async () => {
    const rows = await owner.$queryRawUnsafe<{ table: string; column: string; on_delete: string }[]>(
      `SELECT cl.relname AS table, a.attname AS column, con.confdeltype AS on_delete
         FROM pg_constraint con
         JOIN pg_class cl ON cl.oid = con.conrelid
         JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
        WHERE con.contype = 'f' AND con.confrelid = 'public."Client"'::regclass`,
    );
    const tables = await tenantTables();
    expect(tables.length).toBeGreaterThanOrEqual(17);
    for (const table of tables) {
      const fk = rows.find((r) => r.table === table && r.column === 'clientId');
      expect(fk, `${table}.clientId has no foreign key to Client`).toBeTruthy();
      expect(fk?.on_delete, `${table}.clientId does not cascade`).toBe('c');
    }
  });

  it('seeded a row in every tenant table for both businesses', async () => {
    for (const [table, n] of Object.entries(await rowsFor(ids.alpha))) expect(n, `alpha ${table}`).toBeGreaterThan(0);
    for (const [table, n] of Object.entries(await rowsFor(ids.beta))) {
      // AccountAccess exists for Alpha only.
      if (table === 'AccountAccess') continue;
      expect(n, `beta ${table}`).toBeGreaterThan(0);
    }
  });

  it('ships the same policy to production that this file tested', () => {
    // The harness applies rls.sql; production receives prisma/m44/migration.sql.
    // The statement must be byte-for-byte the same in both, or a typo in the
    // file nobody here executes would ship behind a green run.
    const statement = (file: string) => {
      const text = readFileSync(join(__dirname, '..', 'prisma', ...file.split('/')), 'utf8').replace(/\r\n/g, '\n');
      const match = /CREATE POLICY client_delete_admin_archived[\s\S]*?;/.exec(text);
      return match?.[0] ?? null;
    };
    const shipped = statement('m44/migration.sql');
    expect(shipped).not.toBeNull();
    expect(shipped).toBe(statement('m20/rls.sql'));
  });

  it('ships the restrictive delete policy on Client', async () => {
    const rows = await owner.$queryRawUnsafe<{ permissive: string; cmd: string; qual: string }[]>(
      `SELECT permissive, cmd, qual FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'Client' AND policyname = 'client_delete_admin_archived'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.permissive).toBe('RESTRICTIVE');
    expect(rows[0]?.cmd).toBe('DELETE');
    expect(rows[0]?.qual).toContain('is_platform_admin');
    expect(rows[0]?.qual).toContain('archivedAt');
  });
});

describe('archive → restore', () => {
  it('still works for staff, and keeps every row', async () => {
    const { archiveClient, restoreClient } = await import('@/lib/clients/service');
    session = { id: AUTH.admin };
    const before = await rowsFor(ids.alpha);

    expect((await archiveClient(app, ids.alpha)).ok).toBe(true);
    expect((await owner.client.findUnique({ where: { id: ids.alpha } }))?.archivedAt).not.toBeNull();

    expect((await restoreClient(app, ids.alpha)).ok).toBe(true);
    expect((await owner.client.findUnique({ where: { id: ids.alpha } }))?.archivedAt).toBeNull();
    expect(await rowsFor(ids.alpha)).toEqual(before);
  });
});

describe('archive → permanent delete, by Headway staff', () => {
  it('removes every row the business owned and nothing any other business owns', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await archive(ids.alpha);
    const betaBefore = await rowsFor(ids.beta);
    const usersBefore = await owner.user.count();

    session = { id: AUTH.admin };
    const result = await purgeClient(app, ids.alpha, 'Alpha Salon');
    expect(result).toEqual({ ok: true, data: { id: ids.alpha, removedLogin: true } });

    expect(await owner.client.findUnique({ where: { id: ids.alpha } })).toBeNull();
    for (const [table, n] of Object.entries(await rowsFor(ids.alpha))) expect(n, `alpha ${table}`).toBe(0);
    expect(await rowsFor(ids.beta)).toEqual(betaBefore);
    expect(await owner.client.findUnique({ where: { id: ids.beta } })).not.toBeNull();

    // Exactly one account went: the generated one.
    expect(await owner.user.count()).toBe(usersBefore - 1);
  });

  it('keeps every person, and their access to every other business', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await archive(ids.alpha);
    session = { id: AUTH.admin };
    expect((await purgeClient(app, ids.alpha, 'Alpha Salon')).ok).toBe(true);

    for (const key of ['admin', 'alphaOwner', 'alphaStaff', 'shared', 'betaOwner'] as const) {
      const row = await owner.user.findUnique({ where: { id: ids[key] } });
      expect(row, `${key} lost their account`).not.toBeNull();
      expect(row?.status).toBe('ACTIVE');
    }

    // The person in both businesses keeps Beta, loses Alpha.
    const sharedMemberships = await owner.membership.findMany({ where: { userId: ids.shared } });
    expect(sharedMemberships.map((m) => m.clientId)).toEqual([ids.beta]);
    // Beta's own team is exactly as it was.
    expect(await owner.membership.count({ where: { clientId: ids.beta } })).toBe(2);
  });

  it('revokes the generated, unclaimed login in Supabase and removes its row', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await archive(ids.alpha);
    session = { id: AUTH.admin };
    expect((await purgeClient(app, ids.alpha, 'Alpha Salon')).ok).toBe(true);

    expect(removed).toEqual([AUTH.generated]);
    expect(await owner.user.findUnique({ where: { id: ids.generated } })).toBeNull();
  });

  it('keeps the owner once they set up a login of their own — the temporary login still goes', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await owner.user.update({
      where: { id: ids.generated },
      data: { authProviderId: '77777777-7777-4777-8777-777777777777', email: 'real@owner.test' },
    });
    await owner.accountAccess.update({ where: { clientId: ids.alpha }, data: { setupCompletedAt: new Date() } });
    await archive(ids.alpha);
    session = { id: AUTH.admin };
    const result = await purgeClient(app, ids.alpha, 'Alpha Salon');
    expect(result).toEqual({ ok: true, data: { id: ids.alpha, removedLogin: true } });

    // Headway's temporary login is revoked; the person's own account stays.
    expect(removed).toEqual([AUTH.generated]);
    expect(await owner.user.findUnique({ where: { id: ids.generated } })).not.toBeNull();
  });

  it('keeps a generated login that also belongs to another business', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await owner.membership.create({ data: { userId: ids.generated, clientId: ids.beta, role: 'BUSINESS_STAFF' } });
    await archive(ids.alpha);
    session = { id: AUTH.admin };
    expect((await purgeClient(app, ids.alpha, 'Alpha Salon')).ok).toBe(true);

    expect(removed).toEqual([AUTH.generated]);
    expect(await owner.user.findUnique({ where: { id: ids.generated } })).not.toBeNull();
    expect(await owner.membership.count({ where: { userId: ids.generated, clientId: ids.beta } })).toBe(1);
  });

  it('deletes nothing when the generated login cannot be revoked', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await archive(ids.alpha);
    const before = await rowsFor(ids.alpha);
    removeOutcome = { ok: false, message: 'Supabase is unavailable' };

    session = { id: AUTH.admin };
    const result = await purgeClient(app, ids.alpha, 'Alpha Salon');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/^Nothing was deleted/);

    expect(await owner.client.findUnique({ where: { id: ids.alpha } })).not.toBeNull();
    expect(await rowsFor(ids.alpha)).toEqual(before);
    expect(await owner.user.findUnique({ where: { id: ids.generated } })).not.toBeNull();
  });

  it('refuses a business still in service, in the service and in the database', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    session = { id: AUTH.admin };

    const result = await purgeClient(app, ids.beta, 'Beta Gym');
    expect(result.ok).toBe(false);

    // Past the service, straight at the table: the policy says no as well.
    await expect(app.client.delete({ where: { id: ids.beta } })).rejects.toThrow();
    expect(await owner.client.findUnique({ where: { id: ids.beta } })).not.toBeNull();
    expect(removed).toEqual([]);
  });

  it('refuses the wrong name, even in the wrong case', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await archive(ids.alpha);
    session = { id: AUTH.admin };
    for (const typed of ['alpha salon', 'Alpha', '', 'Beta Gym']) {
      expect((await purgeClient(app, ids.alpha, typed)).ok).toBe(false);
    }
    expect(await owner.client.findUnique({ where: { id: ids.alpha } })).not.toBeNull();
    expect(removed).toEqual([]);
  });
});

describe('nobody else can delete a business', () => {
  for (const who of ['alphaOwner', 'alphaStaff', 'shared'] as const) {
    it(`${who} cannot, even once it is archived — the database refuses`, async () => {
      const { purgeClient } = await import('@/lib/clients/service');
      await archive(ids.alpha);
      session = { id: AUTH[who] };

      await expect(app.client.delete({ where: { id: ids.alpha } })).rejects.toThrow();
      const viaService = await purgeClient(app, ids.alpha, 'Alpha Salon').catch(() => 'refused' as const);
      expect(viaService === 'refused' || viaService.ok === false).toBe(true);

      expect(await owner.client.findUnique({ where: { id: ids.alpha } })).not.toBeNull();
      for (const [table, n] of Object.entries(await rowsFor(ids.alpha))) expect(n, table).toBeGreaterThan(0);
    });
  }

  it('a signed-out connection cannot even see it', async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await archive(ids.alpha);
    session = null;
    const result = await purgeClient(app, ids.alpha, 'Alpha Salon');
    expect(result.ok).toBe(false);
    expect(await owner.client.findUnique({ where: { id: ids.alpha } })).not.toBeNull();
  });

  it('the server action turns away everyone but staff, before touching anything', async () => {
    const { purgeClientAction } = await import('@/lib/actions/clients');
    const { IDLE } = await import('@/lib/actions/shared');
    await archive(ids.alpha);
    const form = () => {
      const f = new FormData();
      f.set('id', ids.alpha);
      f.set('confirm', 'Alpha Salon');
      return f;
    };

    for (const who of [null, AUTH.alphaOwner, AUTH.alphaStaff, AUTH.shared, AUTH.betaOwner]) {
      session = who ? { id: who } : null;
      const state = await purgeClientAction(IDLE, form());
      expect(state.ok, `session ${who}`).toBe(false);
    }
    expect(await owner.client.findUnique({ where: { id: ids.alpha } })).not.toBeNull();
    expect(removed).toEqual([]);

    session = { id: AUTH.admin };
    const done = await purgeClientAction(IDLE, form()).catch((e: Error & { to?: string }) => e);
    expect(done).toBeInstanceOf(Error);
    expect((done as Error & { to?: string }).to).toBe('/clients?view=archived&deleted=1&login=removed');
    expect(await owner.client.findUnique({ where: { id: ids.alpha } })).toBeNull();
  });
});

describe('after deletion, nothing resolves the business', () => {
  beforeEach(async () => {
    const { purgeClient } = await import('@/lib/clients/service');
    await archive(ids.alpha);
    session = { id: AUTH.admin };
    expect((await purgeClient(app, ids.alpha, 'Alpha Salon')).ok).toBe(true);
  });

  it('is absent from the archive, the counts and a direct read', async () => {
    const { countClients, listClients } = await import('@/lib/clients/service');
    session = { id: AUTH.admin };
    expect((await listClients(app, { onlyArchived: true })).map((c) => c.id)).toEqual([]);
    expect((await listClients(app, { includeArchived: true })).map((c) => c.id)).toEqual([ids.beta]);
    expect(await countClients(app)).toEqual({ active: 1, archived: 0 });
    expect(await app.client.findUnique({ where: { id: ids.alpha } })).toBeNull();
  });

  it('cannot be restored, archived or edited', async () => {
    const { archiveClient, restoreClient, updateClient } = await import('@/lib/clients/service');
    session = { id: AUTH.admin };
    expect((await restoreClient(app, ids.alpha)).ok).toBe(false);
    expect((await archiveClient(app, ids.alpha)).ok).toBe(false);
    // A valid form, so a refusal means the business is gone, not the input bad.
    const edited = await updateClient(app, ids.alpha, validClientInput({ businessName: 'Alpha Salon', vertical: 'salon' }));
    expect(edited.ok).toBe(false);
    expect(await owner.client.count({ where: { id: ids.alpha } })).toBe(0);
  });

  it('opens nothing from its QR token or its owner link', async () => {
    const { readGateway } = await import('@/lib/gateway/store');
    const { resolvePortalToken } = await import('@/lib/portal/access');
    expect(await readGateway(owner, TOKENS.gateway.alpha)).toBeNull();
    expect(await resolvePortalToken(owner, TOKENS.portal.alpha)).toBeNull();
    // Beta's still open, so the checks above are not vacuous.
    expect(await readGateway(owner, TOKENS.gateway.beta)).not.toBeNull();
    expect(await resolvePortalToken(owner, TOKENS.portal.beta)).not.toBeNull();
  });

  it('turns away its former members at the gate, and leaves their other business open', async () => {
    const { tenantGateFor } = await import('@/lib/auth/guard');
    for (const who of ['alphaOwner', 'alphaStaff', 'shared'] as const) {
      session = { id: AUTH[who] };
      expect((await tenantGateFor(ids.alpha, 'MEMBER')).ok, who).toBe(false);
    }
    session = { id: AUTH.shared };
    expect((await tenantGateFor(ids.beta, 'MEMBER')).ok).toBe(true);
  });

  it('writes nothing new for it, even for staff', async () => {
    session = { id: AUTH.admin };
    await expect(
      app.minute.create({ data: { clientId: ids.alpha, occurredAt: new Date(), title: 'After the fact' } }),
    ).rejects.toThrow();
    expect(await owner.minute.count({ where: { clientId: ids.alpha } })).toBe(0);
  });
});
