import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE TRIAL AND THE PAUSE, UNDER THE POLICIES THAT ACTUALLY SHIP (M23).
 *
 * Three claims about the database, tested against the database — the real
 * schema, `prisma/m20/rls.sql` applied verbatim, and the same non-superuser
 * role production connects as:
 *
 *   1. A business created through `app.create_client` starts on a trial with
 *      an end date, the product default long — thirty days since M27 —
 *      unless the operator has set a different default in AppSetting, which the
 *      function reads for itself, because a signing-up owner's connection
 *      cannot read that table.
 *   2. `app.set_subscription` stamps the pause and the resume, and a business
 *      owner holds no privilege on either stamp.
 *   3. Nothing the pass added lets an owner read the negotiated amount.
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
  newcomer: '99999999-9999-4999-8999-999999999999',
} as const;

const NOW = new Date('2026-09-07T10:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let commercial: typeof import('@/lib/commercial/service');
let onboarding: typeof import('@/lib/onboarding/service');

let seeded: { adminId: string; alphaUserId: string; newcomerId: string; alphaClientId: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m23-trial');
  owner = harness.owner;

  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

  commercial = await import('@/lib/commercial/service');
  onboarding = await import('@/lib/onboarding/service');
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
  const alpha = await owner.user.create({
    data: { email: 'owner@alpha.test', authProviderId: AUTH.alpha },
    select: { id: true },
  });
  const newcomer = await owner.user.create({
    data: { email: 'new@business.test', authProviderId: AUTH.newcomer },
    select: { id: true },
  });
  const alphaClient = await owner.client.create({
    data: { businessName: 'Alpha Cafe', vertical: 'restaurant', status: 'ACTIVE' },
    select: { id: true },
  });
  await owner.membership.create({
    data: { userId: alpha.id, clientId: alphaClient.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });
  seeded = { adminId: admin.id, alphaUserId: alpha.id, newcomerId: newcomer.id, alphaClientId: alphaClient.id };
});

// ---------------------------------------------------------------------------

describe('a new business starts on a trial with an end date', () => {
  it('is the product default from the moment of creation, through app.create_client', async () => {
    session = { id: AUTH.newcomer };
    const result = await onboarding.completeOnboarding(
      app,
      seeded.newcomerId,
      { businessName: 'New Business', vertical: 'restaurant' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const client = await owner.client.findUniqueOrThrow({ where: { id: result.data.clientId } });
    expect(client.subscriptionStatus).toBe('TRIAL');
    expect(client.trialStartsAt?.toISOString()).toBe(NOW.toISOString());
    expect(commercial.DEFAULT_TRIAL_DAYS).toBe(30);
    expect(client.trialEndsAt?.toISOString()).toBe(
      new Date(NOW.getTime() + commercial.DEFAULT_TRIAL_DAYS * DAY).toISOString(),
    );
  });

  it("honours the operator's default from AppSetting, which the signing-up owner cannot read", async () => {
    await owner.appSetting.create({ data: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING, value: '45' } });

    // The function reads it as its definer; the owner's connection sees no row.
    session = { id: AUTH.newcomer };
    expect(await app.appSetting.count()).toBe(0);
    const viaFunction = await owner.$queryRawUnsafe<{ days: number }[]>(
      `SELECT app.trial_default_days() AS days`,
    );
    expect(viaFunction[0]?.days).toBe(45);

    const result = await onboarding.completeOnboarding(
      app,
      seeded.newcomerId,
      { businessName: 'Long Trial', vertical: 'salon' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const client = await owner.client.findUniqueOrThrow({ where: { id: result.data.clientId } });
    expect(client.trialEndsAt?.toISOString()).toBe(new Date(NOW.getTime() + 45 * DAY).toISOString());
  });

  it('falls back to the product default for a malformed or out-of-range setting', async () => {
    for (const bad of ['0', '400', 'fortnight', ' ']) {
      await owner.appSetting.upsert({
        where: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING },
        create: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING, value: bad },
        update: { value: bad },
      });
      const rows = await owner.$queryRawUnsafe<{ days: number }[]>(`SELECT app.trial_default_days() AS days`);
      expect(rows[0]?.days, bad).toBe(commercial.DEFAULT_TRIAL_DAYS);
    }
  });

  it('lets platform staff start a trial of the configured length without typing it', async () => {
    await owner.appSetting.create({ data: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING, value: '21' } });
    session = { id: AUTH.admin };
    const result = await commercial.startTrial(app, seeded.alphaClientId, undefined, { now: NOW });
    expect(result.ok && result.data.days).toBe(21);
    const client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.trialEndsAt?.toISOString()).toBe(new Date(NOW.getTime() + 21 * DAY).toISOString());
  });
});

describe('the pause and the resume are stamped, and not by the business', () => {
  it('stamps the pause, then the resume, through app.set_subscription', async () => {
    session = { id: AUTH.admin };

    expect((await commercial.pauseService(app, seeded.alphaClientId, { now: NOW })).ok).toBe(true);
    let client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.subscriptionStatus).toBe('PAUSED');
    expect(client.servicePausedAt?.toISOString()).toBe(NOW.toISOString());
    expect(client.serviceResumedAt).toBeNull();

    // Pausing a paused account keeps the original date.
    const later = new Date(NOW.getTime() + DAY);
    expect((await commercial.pauseService(app, seeded.alphaClientId, { now: later })).ok).toBe(true);
    client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.servicePausedAt?.toISOString()).toBe(NOW.toISOString());

    const resumedAt = new Date(NOW.getTime() + 3 * DAY);
    expect((await commercial.resumeService(app, seeded.alphaClientId, { now: resumedAt })).ok).toBe(true);
    client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.subscriptionStatus).toBe('ACTIVE');
    expect(client.serviceResumedAt?.toISOString()).toBe(resumedAt.toISOString());
    expect(client.servicePausedAt).toBeNull();

    // And the owner is told so.
    session = { id: AUTH.alpha };
    const state = await commercial.getAccountState(app, seeded.alphaClientId, { now: resumedAt });
    expect(state?.headline).toBe('Headway is active');
    expect(state?.note).toBe('Headway has resumed reading new feedback.');
  });

  it('gives the business owner no privilege on either stamp', async () => {
    const granted = await owner.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee = 'repos_app' AND table_name = 'Client' AND privilege_type = 'UPDATE'`,
    );
    const columns = granted.map((g) => g.column_name);
    expect(columns).not.toContain('servicePausedAt');
    expect(columns).not.toContain('serviceResumedAt');
    expect(columns).toContain('paymentRequestedAt');

    session = { id: AUTH.alpha };
    await expect(
      app.client.update({ where: { id: seeded.alphaClientId }, data: { serviceResumedAt: NOW } }),
    ).rejects.toThrow();
    await expect(
      commercial.resumeService(app, seeded.alphaClientId, { now: NOW }).then((r) => {
        if (!r.ok) throw new Error(r.message);
      }),
    ).rejects.toThrow();
  });

  it('adds the one function and changes nothing about who can read the amount', async () => {
    const fn = await owner.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app' AND p.proname = 'trial_default_days'`,
    );
    expect(Number(fn[0]?.n)).toBe(1);

    await owner.commercial.create({
      data: { clientId: seeded.alphaClientId, amountInr: 4500, note: 'Agreed on the call.' },
    });
    session = { id: AUTH.alpha };
    expect(await app.commercial.count()).toBe(0);
    const requests = await commercial.listContinuationRequests(app);
    // An owner's connection lists nothing about anybody's request.
    expect(requests).toEqual([]);
  });
});
