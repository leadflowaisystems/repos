import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE SERVICE LIFECYCLE, UNDER THE POLICIES THAT ACTUALLY SHIP (M28).
 *
 * A whole database with `prisma/m20/rls.sql` applied verbatim, reached through
 * the same non-owner `repos_app` role production connects as. The claims here
 * are the ones that would matter if they were wrong:
 *
 *   1. A business cannot unlock itself, rename itself into an exemption, or
 *      write any of the three new columns.
 *   2. One tenant cannot see, create or touch another's continuation request.
 *   3. Asking to continue changes no trial date and opens no workspace.
 *   4. Locking and overriding change no trial date either.
 *   5. The QR grace is exactly three calendar days, in the database.
 *   6. Every protected page is behind the lock, checked mechanically.
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
  alpha: '22222222-2222-4222-8222-222222222222',
  beta: '33333333-3333-4333-8333-333333333333',
} as const;

const NOW = new Date('2026-09-08T06:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let lifecycle: typeof import('@/lib/lifecycle/service');
let admin: typeof import('@/lib/lifecycle/admin');
let continuation: typeof import('@/lib/continuation/service');

let seeded: { adminId: string; alphaId: string; betaId: string; alphaClient: string; betaClient: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m28-lifecycle');
  owner = harness.owner;

  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

  lifecycle = await import('@/lib/lifecycle/service');
  admin = await import('@/lib/lifecycle/admin');
  continuation = await import('@/lib/continuation/service');
  ({ prisma: app } = await import('@/lib/db'));
}, 180_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  session = null;
  await resetDb(owner);

  const a = await owner.user.create({
    data: { email: 'admin@repos.test', authProviderId: AUTH.admin, isPlatformAdmin: true },
    select: { id: true },
  });
  const alpha = await owner.user.create({
    data: { email: 'owner@alpha.test', authProviderId: AUTH.alpha },
    select: { id: true },
  });
  const beta = await owner.user.create({
    data: { email: 'owner@beta.test', authProviderId: AUTH.beta },
    select: { id: true },
  });

  const alphaClient = await owner.client.create({
    data: {
      businessName: 'Alpha Cafe',
      vertical: 'restaurant',
      status: 'ACTIVE',
      subscriptionStatus: 'TRIAL',
      trialStartsAt: new Date(NOW.getTime() - 10 * DAY),
      trialEndsAt: new Date(NOW.getTime() + 10 * DAY),
    },
    select: { id: true },
  });
  const betaClient = await owner.client.create({
    data: {
      businessName: 'Beta Salon',
      vertical: 'salon',
      status: 'ACTIVE',
      subscriptionStatus: 'TRIAL',
      trialStartsAt: new Date(NOW.getTime() - 10 * DAY),
      trialEndsAt: new Date(NOW.getTime() + 10 * DAY),
    },
    select: { id: true },
  });

  await owner.membership.create({
    data: { userId: alpha.id, clientId: alphaClient.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });
  await owner.membership.create({
    data: { userId: beta.id, clientId: betaClient.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });

  seeded = {
    adminId: a.id,
    alphaId: alpha.id,
    betaId: beta.id,
    alphaClient: alphaClient.id,
    betaClient: betaClient.id,
  };
});

async function trialOf(clientId: string) {
  return owner.client.findUniqueOrThrow({
    where: { id: clientId },
    select: {
      trialStartsAt: true,
      trialEndsAt: true,
      serviceLockedAt: true,
      accessOverrideAt: true,
      serviceExemption: true,
    },
  });
}

// ---------------------------------------------------------------------------
// 1. A business cannot let itself back in
// ---------------------------------------------------------------------------

describe('the three access columns are the platform’s alone', () => {
  it('gives repos_app no UPDATE privilege on any of them', async () => {
    const granted = await owner.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee = 'repos_app' AND table_name = 'Client' AND privilege_type = 'UPDATE'`,
    );
    const columns = granted.map((g) => g.column_name);
    expect(columns).not.toContain('serviceLockedAt');
    expect(columns).not.toContain('accessOverrideAt');
    expect(columns).not.toContain('serviceExemption');
    // And the ones an owner legitimately writes are still there.
    expect(columns).toContain('paymentRequestedAt');
    expect(columns).toContain('businessName');
  });

  it('refuses a business owner trying to unlock itself', async () => {
    session = { id: AUTH.admin };
    expect((await admin.setServiceAccess(app, seeded.alphaClient, 'LOCK', { now: NOW })).ok).toBe(true);
    expect((await trialOf(seeded.alphaClient)).serviceLockedAt).not.toBeNull();

    session = { id: AUTH.alpha };
    await expect(
      app.client.update({ where: { id: seeded.alphaClient }, data: { serviceLockedAt: null } }),
    ).rejects.toThrow();
    await expect(
      app.client.update({ where: { id: seeded.alphaClient }, data: { accessOverrideAt: NOW } }),
    ).rejects.toThrow();

    expect((await trialOf(seeded.alphaClient)).serviceLockedAt).not.toBeNull();
  });

  it('refuses a business owner awarding itself the demo exemption', async () => {
    session = { id: AUTH.alpha };
    await expect(
      app.client.update({ where: { id: seeded.alphaClient }, data: { serviceExemption: 'DEMO' } }),
    ).rejects.toThrow();
    expect((await trialOf(seeded.alphaClient)).serviceExemption).toBeNull();
  });

  it('cannot be forged by renaming the business to the demo’s name', async () => {
    // businessName IS owner-writable, which is exactly why the exemption is a
    // separate column and not a name match.
    session = { id: AUTH.alpha };
    await app.client.update({
      where: { id: seeded.alphaClient },
      data: { businessName: 'Corner Cafe' },
    });
    const row = await trialOf(seeded.alphaClient);
    expect(row.serviceExemption).toBeNull();
    expect(
      lifecycle.describeLifecycle({
        subscriptionStatus: 'TRIAL',
        trialStartsAt: row.trialStartsAt,
        trialEndsAt: new Date(NOW.getTime() - DAY),
        serviceExemption: row.serviceExemption,
        now: NOW,
      }).workspaceLocked,
    ).toBe(true);
  });

  it('refuses a non-admin calling the definer function directly', async () => {
    session = { id: AUTH.alpha };
    await expect(
      app.$queryRawUnsafe(
        `SELECT app.set_service_access('${seeded.alphaClient}'::text, 'UNLOCK'::text, '${NOW.toISOString()}'::text)`,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Locking and overriding never touch a trial date
// ---------------------------------------------------------------------------

describe('administrative decisions leave the stored dates alone', () => {
  it('keeps trialStartsAt and trialEndsAt through all six actions', async () => {
    const before = await trialOf(seeded.alphaClient);
    session = { id: AUTH.admin };

    for (const action of [
      'LOCK',
      'UNLOCK',
      'OVERRIDE',
      'CLEAR_OVERRIDE',
      'EXEMPT_DEMO',
      'CLEAR_EXEMPTION',
    ] as const) {
      const result = await admin.setServiceAccess(app, seeded.alphaClient, action, { now: NOW });
      expect(result.ok, action).toBe(true);
      const after = await trialOf(seeded.alphaClient);
      expect(after.trialStartsAt?.toISOString(), action).toBe(before.trialStartsAt?.toISOString());
      expect(after.trialEndsAt?.toISOString(), action).toBe(before.trialEndsAt?.toISOString());
    }
  });

  it('makes lock and override mutually exclusive', async () => {
    session = { id: AUTH.admin };
    await admin.setServiceAccess(app, seeded.alphaClient, 'LOCK', { now: NOW });
    expect((await trialOf(seeded.alphaClient)).serviceLockedAt).not.toBeNull();

    await admin.setServiceAccess(app, seeded.alphaClient, 'OVERRIDE', { now: NOW });
    const after = await trialOf(seeded.alphaClient);
    expect(after.accessOverrideAt).not.toBeNull();
    expect(after.serviceLockedAt).toBeNull();

    await admin.setServiceAccess(app, seeded.alphaClient, 'LOCK', { now: NOW });
    const back = await trialOf(seeded.alphaClient);
    expect(back.serviceLockedAt).not.toBeNull();
    expect(back.accessOverrideAt).toBeNull();
  });

  it('records each decision where the operator can find it', async () => {
    session = { id: AUTH.admin };
    await admin.setServiceAccess(app, seeded.alphaClient, 'LOCK', { now: NOW });
    const minutes = await owner.minute.findMany({ where: { clientId: seeded.alphaClient } });
    expect(minutes).toHaveLength(1);
    expect(minutes[0]?.category).toBe('DECISION');
    expect(minutes[0]?.title).toContain('locked');
    expect(minutes[0]?.body).toContain('trial dates are unchanged');
  });
});

// ---------------------------------------------------------------------------
// 3. Continuation requests: one tenant, one request
// ---------------------------------------------------------------------------

describe('asking to carry on', () => {
  it('records the phone, keeps the email optional, and moves no date', async () => {
    const before = await trialOf(seeded.alphaClient);
    session = { id: AUTH.alpha };

    const result = await continuation.requestContinuation(
      app,
      seeded.alphaClient,
      { phone: '+91 98765 43210' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.created).toBe(true);
    expect(result.data.request.phone).toBe('+91 98765 43210');
    expect(result.data.request.email).toBeNull();
    // The name comes from the business, never from the customer.
    expect(result.data.request.name).toBe('Alpha Cafe');

    const after = await trialOf(seeded.alphaClient);
    expect(after.trialStartsAt?.toISOString()).toBe(before.trialStartsAt?.toISOString());
    expect(after.trialEndsAt?.toISOString()).toBe(before.trialEndsAt?.toISOString());
    expect(after.accessOverrideAt).toBeNull();
    expect(after.serviceLockedAt).toBeNull();
  });

  it('stores an email when one is given', async () => {
    session = { id: AUTH.alpha };
    const result = await continuation.requestContinuation(
      app,
      seeded.alphaClient,
      { phone: '9876543210', email: '  Owner@Alpha.TEST ' },
      { now: NOW },
    );
    expect(result.ok && result.data.request.email).toBe('owner@alpha.test');
  });

  it('refuses an empty or nonsense phone number and accepts real ones', async () => {
    session = { id: AUTH.alpha };
    for (const bad of ['', '   ', 'call me', '123', '-', '++']) {
      const result = await continuation.requestContinuation(app, seeded.alphaClient, { phone: bad });
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.errors.phone).toBeTruthy();
    }
    expect(await owner.serviceContinuationRequest.count()).toBe(0);

    for (const good of ['9876543210', '+91 98765 43210', '098765-43210', '(022) 2345 6789']) {
      expect(continuation.normalisePhone(good), good).not.toBeNull();
    }
  });

  it('refuses a malformed email but accepts none at all', async () => {
    session = { id: AUTH.alpha };
    const bad = await continuation.requestContinuation(app, seeded.alphaClient, {
      phone: '9876543210',
      email: 'not-an-email',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.email).toBeTruthy();

    const fine = await continuation.requestContinuation(app, seeded.alphaClient, {
      phone: '9876543210',
      email: '',
    });
    expect(fine.ok).toBe(true);
    if (fine.ok) expect(fine.data.request.email).toBeNull();
  });

  it('does not pile up duplicates when the button is pressed twice', async () => {
    session = { id: AUTH.alpha };
    const first = await continuation.requestContinuation(app, seeded.alphaClient, { phone: '9876543210' });
    const second = await continuation.requestContinuation(app, seeded.alphaClient, { phone: '9999999999' });
    expect(first.ok && first.data.created).toBe(true);
    expect(second.ok && second.data.created).toBe(false);
    expect(await owner.serviceContinuationRequest.count()).toBe(1);
    // And the answer is still the original request, not a new one.
    if (second.ok) expect(second.data.request.phone).toBe('9876543210');
  });

  it('lets a business ask again once the operator has resolved the last one', async () => {
    session = { id: AUTH.alpha };
    const first = await continuation.requestContinuation(app, seeded.alphaClient, { phone: '9876543210' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    session = { id: AUTH.admin };
    expect((await continuation.setContinuationStatus(app, first.data.request.id, 'RESOLVED')).ok).toBe(true);

    session = { id: AUTH.alpha };
    const again = await continuation.requestContinuation(app, seeded.alphaClient, { phone: '9876543210' });
    expect(again.ok && again.data.created).toBe(true);
    expect(await owner.serviceContinuationRequest.count()).toBe(2);
  });

  it('keeps one tenant out of another’s requests entirely', async () => {
    session = { id: AUTH.alpha };
    expect((await continuation.requestContinuation(app, seeded.alphaClient, { phone: '9876543210' })).ok).toBe(true);

    // Beta cannot see it...
    session = { id: AUTH.beta };
    expect(await app.serviceContinuationRequest.count()).toBe(0);
    expect(await continuation.listContinuationRequests(app)).toEqual([]);
    expect(await continuation.pendingRequestFor(app, seeded.alphaClient)).toBeNull();

    // ...and cannot create one for Alpha either.
    await expect(
      app.serviceContinuationRequest.create({
        data: { clientId: seeded.alphaClient, name: 'Alpha Cafe', phone: '5555555555', status: 'NEW' },
      }),
    ).rejects.toThrow();
    expect(await owner.serviceContinuationRequest.count()).toBe(1);
  });

  it('shows the operator the business, the phone and the optional email', async () => {
    session = { id: AUTH.alpha };
    await continuation.requestContinuation(app, seeded.alphaClient, {
      phone: '9876543210',
      email: 'owner@alpha.test',
    });
    session = { id: AUTH.beta };
    await continuation.requestContinuation(app, seeded.betaClient, { phone: '9000000000' });

    session = { id: AUTH.admin };
    const all = await continuation.listContinuationRequests(app);
    expect(all).toHaveLength(2);
    const alpha = all.find((r) => r.clientId === seeded.alphaClient);
    expect(alpha?.businessName).toBe('Alpha Cafe');
    expect(alpha?.phone).toBe('9876543210');
    expect(alpha?.email).toBe('owner@alpha.test');
    expect(alpha?.status).toBe('NEW');
    expect(all.find((r) => r.clientId === seeded.betaClient)?.email).toBeNull();
  });

  it('carries the tenant_isolation policy every other per-business table has', async () => {
    const policies = await owner.$queryRawUnsafe<{ policyname: string }[]>(
      `SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'ServiceContinuationRequest'`,
    );
    expect(policies.map((p) => p.policyname)).toEqual(['tenant_isolation']);
    const forced = await owner.$queryRawUnsafe<{ ok: boolean }[]>(
      `SELECT relrowsecurity AND relforcerowsecurity AS ok FROM pg_class
        WHERE oid = 'public."ServiceContinuationRequest"'::regclass`,
    );
    expect(forced[0]?.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. The QR grace, in the database
// ---------------------------------------------------------------------------

describe('the QR grace as the database computes it', () => {
  it('agrees with the TypeScript on the exact boundary', async () => {
    // Both sides mirror each other; this asks the database for its arithmetic
    // and compares it to the function the application uses.
    const ends = new Date('2026-09-30T18:30:00.000Z'); // 1 Oct 00:00 IST
    await owner.client.update({
      where: { id: seeded.alphaClient },
      data: { trialEndsAt: ends },
    });

    const rows = await owner.$queryRawUnsafe<{ grace: Date }[]>(
      `SELECT date_trunc('day', "trialEndsAt" + interval '5 hours 30 minutes')
              + interval '3 days' - interval '5 hours 30 minutes' AS grace
         FROM public."Client" WHERE id = '${seeded.alphaClient}'`,
    );
    expect(rows[0]?.grace.toISOString()).toBe(lifecycle.qrGraceEnd(ends).toISOString());
    expect(rows[0]?.grace.toISOString()).toBe('2026-10-03T18:30:00.000Z');
  });

  it('gates both public paths on the same predicate', () => {
    // This harness applies rls.sql only, so the public functions are not
    // installed here — tests/m20.public-boundary.test.ts exercises them for
    // real. What matters here is that the two paths cannot drift apart: a
    // customer who can load the page must be able to submit from it.
    const gateway = readFileSync(
      join(resolve(__dirname, '..'), 'prisma', 'm20', 'public-gateway.sql'),
      'utf8',
    );
    const body = (name: string) => {
      const i = gateway.indexOf(`CREATE OR REPLACE FUNCTION app.${name}(`);
      expect(i, name).toBeGreaterThan(-1);
      return gateway.slice(i, gateway.indexOf('$$;', i));
    };
    expect(body('public_gateway')).toContain('app.service_qr_live(c.id)');
    expect(body('public_submit')).toContain('app.service_qr_live(c.id)');
    expect(gateway).toContain('CREATE OR REPLACE FUNCTION app.service_qr_live(');
    expect(gateway).toContain('CREATE OR REPLACE FUNCTION app.public_gateway_exists(');
  });

  it('ships the same predicate to a new database and to an existing one', () => {
    // Production receives prisma/m28/migration.sql; a fresh build receives
    // public-gateway.sql. Nothing else in the suite reads the migration, so a
    // typo in the copy that actually reaches production would otherwise ship
    // behind a green run. This is the M27 guard, applied to M28's function.
    const root = resolve(__dirname, '..');
    const grab = (file: string, name: string) => {
      const sql = readFileSync(join(root, ...file.split('/')), 'utf8');
      const i = sql.indexOf(`CREATE OR REPLACE FUNCTION app.${name}(`);
      expect(i, `${file}:${name}`).toBeGreaterThan(-1);
      const end = sql.indexOf('END $fn$;', i);
      return sql.slice(i, end + 'END $fn$;'.length).split('\r\n').join('\n');
    };
    expect(grab('prisma/m28/migration.sql', 'service_qr_live')).toBe(
      grab('prisma/m20/public-gateway.sql', 'service_qr_live'),
    );
    expect(grab('prisma/m28/migration.sql', 'set_service_access')).toBe(
      grab('prisma/m20/rls.sql', 'set_service_access'),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Every protected page is actually behind the lock
// ---------------------------------------------------------------------------

describe('the lock is on every protected page, mechanically', () => {
  const ROOT = resolve(__dirname, '..');
  const WORKSPACE = join(ROOT, 'src', 'app', '(workspace)', 'workspace', '[clientId]');

  function pages(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...pages(full));
      else if (entry === 'page.tsx' && extname(entry) === '.tsx') out.push(full);
    }
    return out;
  }

  it('has every workspace page except Account calling requireOpenWorkspace', () => {
    const offenders: string[] = [];
    for (const file of pages(WORKSPACE)) {
      const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
      const code = readFileSync(file, 'utf8');
      const isAccount = rel.includes('/account/');
      if (isAccount) {
        // Account must stay reachable when the workspace is shut: it is where
        // the lock is explained and where continuing is asked for.
        if (code.includes('requireOpenWorkspace')) offenders.push(`${rel} must NOT lock itself`);
        if (!code.includes('workspaceAccess')) offenders.push(`${rel} should use workspaceAccess`);
        continue;
      }
      if (!code.includes('await requireOpenWorkspace(')) {
        offenders.push(`${rel} does not call requireOpenWorkspace`);
      }
      // And none of them may fall back to the un-locked gate.
      if (code.includes('tenantGateFor(')) {
        offenders.push(`${rel} still calls tenantGateFor directly`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('covers the seven areas the brief names', () => {
    const found = pages(WORKSPACE).map((f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'));
    for (const slug of ['analysis', 'reviews', 'improvements', 'checkin', 'team', 'kit']) {
      expect(found.some((f) => f.includes(`/${slug}/page.tsx`)), slug).toBe(true);
    }
    // Home is the bare page.tsx.
    expect(found.some((f) => f.endsWith('[clientId]/page.tsx'))).toBe(true);
  });

  it('refuses a locked tenant at the action gate too', async () => {
    session = { id: AUTH.admin };
    await admin.setServiceAccess(app, seeded.alphaClient, 'LOCK', { now: NOW });

    const { tenantGate } = await import('@/lib/auth/guard');
    const form = new FormData();
    form.set('clientId', seeded.alphaClient);

    session = { id: AUTH.alpha };
    const locked = await tenantGate(form, 'OWNER');
    expect(locked.ok).toBe(false);
    // The refusal is the owner's own words, and it names no trial: the same
    // lock covers a lapsed trial and a workspace closed by hand, whose dates
    // are still good. Account is the page that knows which, so it sends them
    // there rather than guessing.
    if (!locked.ok)
      expect(locked.state.message).toBe(
        'Your Headway workspace is closed for now. Your feedback and your history are safe. Go to Account and ask to continue.',
      );

    // ...but the one action that must keep working still does.
    const allowed = await tenantGate(form, 'OWNER', 'clientId', { allowLocked: true });
    expect(allowed.ok).toBe(true);
  });

  it('never locks out platform staff', async () => {
    session = { id: AUTH.admin };
    await admin.setServiceAccess(app, seeded.alphaClient, 'LOCK', { now: NOW });

    const { tenantGate } = await import('@/lib/auth/guard');
    const form = new FormData();
    form.set('clientId', seeded.alphaClient);
    session = { id: AUTH.admin };
    expect((await tenantGate(form, 'OWNER')).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. What the Account page actually says
// ---------------------------------------------------------------------------

describe('the Account page answers the seven questions', () => {
  const ROOT = resolve(__dirname, '..');
  const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
  /**
   * Comments explain what was REMOVED, so a scan for removed wording has to
   * read the code rather than the prose about it.
   */
  const stripComments = (code: string) =>
    code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => (line.trim().startsWith('//') ? '' : line))
      .join('\n');
  const page = () =>
    stripComments(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'account', 'page.tsx'));

  it('shows the stored dates and a server-computed remainder, not a length', () => {
    const code = page();
    // Labelled rows, each one a separate fact.
    expect(code).toContain("label: 'Trial started'");
    expect(code).toContain("'Trial ended' : 'Trial ends'");
    expect(code).toContain("label: 'Days left'");
    expect(code).toContain("label: 'Status'");
    // From the business's own row, through the shared lifecycle.
    expect(code).toContain('lifecycle.trialStartsAt');
    expect(code).toContain('lifecycle.trialEndsAt');
    expect(code).toContain('lifecycle.daysRemaining');
    expect(code).toContain('statusLabel(lifecycle)');
    // The ambiguous phrase M28 removed must not come back.
    expect(code).not.toContain('-day trial');
    // And no arithmetic of its own: the page never subtracts two dates.
    expect(code).not.toContain('getTime() -');
    expect(code).not.toContain('86_400_000');
    // Nor does it read the installation-wide default.
    expect(code).not.toContain('getTrialDefaultDays');
    expect(code).not.toContain('DEFAULT_TRIAL_DAYS');
  });

  it('says the locked words, and offers the one thing that helps', () => {
    const code = page();
    expect(code).toContain("'Your Headway trial has ended'");
    expect(code).toContain(
      'Your feedback and your history are safe. Your workspace opens again when you continue your Headway service.',
    );
    expect(code).toContain('Ask to continue');
    expect(code).toContain('Nothing is charged');
  });

  it('does not describe a paying or exempt business as being on a trial', () => {
    const code = page();
    expect(code).toContain("lifecycle.state === 'DEMO_EXEMPT'");
    expect(code).toContain("lifecycle.state === 'ACTIVE_SERVICE'");
    expect(code).toContain("value: 'Headway demo'");
    expect(code).toContain("value: 'Headway'");
  });

  it('shows how to reach Headway, and builds no deep link to do it', () => {
    const code = page();
    expect(code).toContain('Reaching Headway');
    expect(code).toContain('siteContact()');
    expect(code).toContain('contact.email');
    expect(code).toContain('contact.phone');
    // The rule the whole product follows: a stored reference, never a link.
    expect(code).not.toMatch(/mailto:|tel:|wa\.me|whatsapp/i);
  });

  it('is the one workspace page that stays reachable when the rest is shut', () => {
    const code = page();
    expect(code).toContain('workspaceAccess(clientId)');
    expect(code).not.toContain('requireOpenWorkspace');
    // Exactly one h1 on the page, and it comes from PageIntro.
    expect((code.match(/<h1/g) ?? []).length).toBe(0);
    expect((code.match(/<PageIntro/g) ?? []).length).toBe(2);
  });

  it('warns at five days and more plainly at two, and Home only at two', () => {
    const code = page();
    expect(code).toContain('lifecycle.warning');
    expect(code).toContain("'ENDING_IMMINENTLY'");
    const home = read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'page.tsx');
    expect(home).toContain("lifecycle.warning === 'ENDING_IMMINENTLY'");
    expect(home).not.toContain('ENDING_SOON');
  });
});
