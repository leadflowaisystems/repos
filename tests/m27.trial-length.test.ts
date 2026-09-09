import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * HOW LONG A NEW TRIAL RUNS, AND WHO IT CANNOT REACH (M27).
 *
 * The operator sets one number on Settings and every trial started afterwards
 * is that long. The whole of the risk in that sentence is the word
 * "afterwards", so this file is mostly about businesses NOT moving.
 *
 * It runs against the real policies — a whole database with `prisma/m20/rls.sql`
 * applied verbatim, reached through the same non-owner `repos_app` role
 * production connects as — because the number lives in two places and only one
 * of them is TypeScript. `app.trial_default_days()` is what `app.create_client`
 * actually consults when a business signs up, and a suite that only exercised
 * the TypeScript constant would go green while production still handed out
 * fourteen days. The first test here exists to make that specific failure loud.
 *
 * The claims:
 *
 *   1. A fresh installation gives thirty days, from both sides, and the two
 *      sides agree.
 *   2. The operator can change it, up and down, and the next business created
 *      gets the new length.
 *   3. NOBODY ALREADY ON A TRIAL MOVES. Not when the default goes up, not when
 *      it goes down, not ever. This is not a precaution bolted on afterwards:
 *      the length is read once, at the moment a trial starts, and what is
 *      stored is a date. There is no code that could recompute it.
 *   4. Everything that judges an account — days remaining, expired or not, the
 *      sentence the owner reads — reads that stored date and not the setting.
 *   5. The range is 1..365 whole days, and the refusals are refusals.
 *   6. Only a platform admin can change it, enforced by the database and not
 *      only by the action.
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
  /** The founder's own account: platform admin, and the only one. */
  founder: '11111111-1111-4111-8111-111111111111',
  cafeOwner: '22222222-2222-4222-8222-222222222222',
  earlyOwner: '33333333-3333-4333-8333-333333333333',
  lateOwner: '44444444-4444-4444-8444-444444444444',
} as const;

const NOW = new Date('2026-09-07T10:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let commercial: typeof import('@/lib/commercial/service');
let onboarding: typeof import('@/lib/onboarding/service');

let seeded: { founderId: string; cafeOwnerId: string; earlyOwnerId: string; lateOwnerId: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m27-trial');
  owner = harness.owner;

  // The service modules must be imported AFTER this, or `@/lib/db` resolves its
  // connection string at module init and the whole file runs as the owner.
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
  // resetDb empties AppSetting too, so every test below starts from a fresh
  // installation and sets the default itself if it needs one.
  await resetDb(owner);

  const founder = await owner.user.create({
    data: { email: 'founder@headway.test', authProviderId: AUTH.founder, isPlatformAdmin: true },
    select: { id: true },
  });
  const cafeOwner = await owner.user.create({
    data: { email: 'owner@cornercafe.test', authProviderId: AUTH.cafeOwner },
    select: { id: true },
  });
  const earlyOwner = await owner.user.create({
    data: { email: 'early@business.test', authProviderId: AUTH.earlyOwner },
    select: { id: true },
  });
  const lateOwner = await owner.user.create({
    data: { email: 'late@business.test', authProviderId: AUTH.lateOwner },
    select: { id: true },
  });
  seeded = {
    founderId: founder.id,
    cafeOwnerId: cafeOwner.id,
    earlyOwnerId: earlyOwner.id,
    lateOwnerId: lateOwner.id,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sets the installation-wide default as the founder, the way Settings does. */
async function setDefaultAs(actor: string, raw: string) {
  session = { id: actor };
  return commercial.saveTrialDefaultDays(app, raw);
}

/** Signs a business up, through app.create_client — the real creation path. */
async function startBusiness(
  userId: string,
  authId: string,
  businessName: string,
  at: Date,
): Promise<string> {
  session = { id: authId };
  const result = await onboarding.completeOnboarding(
    app,
    userId,
    { businessName, vertical: 'restaurant' },
    { now: at },
  );
  expect(result.ok, `onboarding ${businessName}`).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.data.clientId;
}

async function trialOf(clientId: string) {
  const client = await owner.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { subscriptionStatus: true, trialStartsAt: true, trialEndsAt: true },
  });
  const days =
    client.trialStartsAt && client.trialEndsAt
      ? Math.round((client.trialEndsAt.getTime() - client.trialStartsAt.getTime()) / DAY)
      : null;
  return { ...client, days };
}

const ROOT = resolve(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

/** What `app.trial_default_days()` answers right now. */
async function sqlDefault(): Promise<number> {
  const rows = await owner.$queryRawUnsafe<{ days: number }[]>(
    `SELECT app.trial_default_days() AS days`,
  );
  return Number(rows[0]?.days);
}

// ---------------------------------------------------------------------------
// 1. A fresh installation is thirty days, and the two sides agree
// ---------------------------------------------------------------------------

describe('a fresh installation runs new trials for thirty days', () => {
  it('is thirty in TypeScript, thirty in the database, and the same thirty', async () => {
    expect(await owner.appSetting.count()).toBe(0);

    expect(commercial.DEFAULT_TRIAL_DAYS).toBe(30);
    expect(await sqlDefault()).toBe(30);

    // The claim that actually matters. The constant is consulted by the
    // no-DDL fallbacks and by Settings; the function is consulted by
    // app.create_client, which is what runs in production. They are separate
    // literals in separate languages, so nothing but an assertion keeps them
    // honest — and if they drift, signup silently hands out the wrong length.
    expect(await sqlDefault()).toBe(commercial.DEFAULT_TRIAL_DAYS);

    session = { id: AUTH.founder };
    expect(await commercial.getTrialDefaultDays(app)).toBe(30);
  });

  it('ships the same function to a new database and to an existing one', () => {
    // There is a THIRD copy of the number, and it is the one production
    // actually receives. The RLS harness applies prisma/m20/rls.sql, so the
    // test above pins rls.sql to TypeScript — but production will never replay
    // rls.sql; it gets prisma/m27/migration.sql, which nothing else in this
    // suite so much as reads. Without this, a typo in the file that reaches the
    // live database would ship behind a completely green run.
    const body = (sql: string) => {
      const start = sql.indexOf('CREATE OR REPLACE FUNCTION app.trial_default_days()');
      const end = sql.indexOf('END $fn$;', start);
      expect(start, 'function not found').toBeGreaterThan(-1);
      expect(end, 'function end not found').toBeGreaterThan(start);
      return sql.slice(start, end + 'END $fn$;'.length).replace(/\r\n/g, '\n');
    };

    const fromRls = body(read('prisma', 'm20', 'rls.sql'));
    const fromMigration = body(read('prisma', 'm27', 'migration.sql'));
    expect(fromMigration).toBe(fromRls);

    // And both really do say 30, so this cannot pass by both being wrong in
    // the same way while TypeScript says something else.
    expect(fromRls).toContain('RETURN 30;');
    expect(fromRls).not.toContain('RETURN 14;');
    expect(fromRls.match(/RETURN 30;/g)).toHaveLength(2);
    expect(String(commercial.DEFAULT_TRIAL_DAYS)).toBe('30');
  });

  it('gives a business signing up today a trial that ends thirty days later', async () => {
    const id = await startBusiness(seeded.lateOwnerId, AUTH.lateOwner, 'Fresh Start', NOW);
    const trial = await trialOf(id);

    expect(trial.subscriptionStatus).toBe('TRIAL');
    expect(trial.trialStartsAt?.toISOString()).toBe(NOW.toISOString());
    expect(trial.trialEndsAt?.toISOString()).toBe(new Date(NOW.getTime() + 30 * DAY).toISOString());
    expect(trial.days).toBe(30);
  });

  it('starts 7 September and ends 7 October, which is the example on the tin', async () => {
    const september7 = new Date('2026-09-07T09:30:00.000Z');
    const id = await startBusiness(seeded.lateOwnerId, AUTH.lateOwner, 'Seventh', september7);
    const trial = await trialOf(id);
    expect(trial.trialEndsAt?.toISOString()).toBe('2026-10-07T09:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// 1b. The Settings card, which is M23's and was not redesigned
// ---------------------------------------------------------------------------

describe('Settings keeps the card it had, and the badge reads back what is saved', () => {
  it('shows the saved number rather than a hardcoded one', () => {
    const page = read('src', 'app', '(app)', 'settings', 'page.tsx');

    // Read from the database on every render, not baked into the build.
    expect(page).toContain('getTrialDefaultDays(prisma)');
    expect(page).toContain("export const dynamic = 'force-dynamic'");
    expect(page).toContain('<Badge tone="brand">{trialDays} DAYS</Badge>');
    expect(page).toContain('<TrialSettingsForm days={trialDays} />');
    // The badge must not be a literal.
    expect(page).not.toMatch(/>\s*\d+\s+DAYS\s*</);
  });

  it('says the words the operator was promised, unchanged', () => {
    const page = read('src', 'app', '(app)', 'settings', 'page.tsx');
    const form = read('src', 'components', 'forms', 'trial-settings-form.tsx');

    expect(page).toContain('title="New trials"');
    expect(page).toContain(
      'Every business starts on a trial with an end date. This is how long that trial runs unless you change it for one client.',
    );

    expect(form).toContain('label="Trial length, in days"');
    expect(form).toContain(
      'hint="Whole days, between 1 and 365. New businesses start on a trial of this length."',
    );
    expect(form).toContain('submitLabel="Save"');
    expect(form).toContain(
      'footerNote="Applies to trials started from now on. Existing trials keep their dates."',
    );

    // The input's own bounds match the rule the services enforce.
    expect(form).toContain('min={1}');
    expect(form).toContain('max={365}');
    expect(form).toContain('step={1}');
    expect(form).toContain('defaultValue={days}');
  });

  it('saves through the admin-gated action and reports the number back', () => {
    const actions = read('src', 'lib', 'actions', 'commercial.ts');
    const start = actions.indexOf('export async function saveTrialDefaultDaysAction');
    expect(start).toBeGreaterThan(-1);
    // To the next export, or to the end of the file if it is the last one.
    // Sliced on the export keyword rather than on a closing brace, because the
    // file's line endings are not this test's business.
    const rest = actions.slice(start + 1);
    const next = rest.indexOf('\nexport ');
    const body = next === -1 ? rest : rest.slice(0, next);

    // adminGate is the first thing that happens, before the form is read.
    expect(body.indexOf('await adminGate()')).toBeGreaterThan(-1);
    expect(body.indexOf('await adminGate()')).toBeLessThan(body.indexOf("str(form, 'trialDays')"));
    expect(body).toContain('revalidatePath(\'/settings\')');
    expect(body).toContain('New trials run for ${result.data.days} days.');
    // It writes the setting and nothing about any client.
    expect(body).not.toContain('trialEndsAt');
    expect(body).not.toContain('client');
  });
});

// ---------------------------------------------------------------------------
// 2 & 3. Changing it moves the next business and nobody else
// ---------------------------------------------------------------------------

describe('the setting is a default for the next trial, never a rule applied to the old ones', () => {
  it('30 → 15 → 30, with each business keeping the length it was born with', async () => {
    // --- the operator changes the default to fifteen ----------------------
    const toFifteen = await setDefaultAs(AUTH.founder, '15');
    expect(toFifteen.ok && toFifteen.data.days).toBe(15);
    expect(await sqlDefault()).toBe(15);

    // --- a business started now gets fifteen ------------------------------
    const early = await startBusiness(seeded.earlyOwnerId, AUTH.earlyOwner, 'Fifteen Cafe', NOW);
    const earlyTrial = await trialOf(early);
    expect(earlyTrial.days).toBe(15);
    expect(earlyTrial.trialEndsAt?.toISOString()).toBe(
      new Date(NOW.getTime() + 15 * DAY).toISOString(),
    );
    const earlyEndsAt = earlyTrial.trialEndsAt;

    // --- the operator changes it back to thirty ---------------------------
    const laterOn = new Date(NOW.getTime() + 3 * DAY);
    const toThirty = await setDefaultAs(AUTH.founder, '30');
    expect(toThirty.ok && toThirty.data.days).toBe(30);
    expect(await sqlDefault()).toBe(30);

    // --- the NEXT business gets thirty ------------------------------------
    const late = await startBusiness(seeded.lateOwnerId, AUTH.lateOwner, 'Thirty Cafe', laterOn);
    const lateTrial = await trialOf(late);
    expect(lateTrial.days).toBe(30);
    expect(lateTrial.trialEndsAt?.toISOString()).toBe(
      new Date(laterOn.getTime() + 30 * DAY).toISOString(),
    );

    // --- AND THE FIFTEEN-DAY BUSINESS HAS NOT MOVED -----------------------
    // Same instant, to the millisecond, as before the default changed.
    const earlyAfter = await trialOf(early);
    expect(earlyAfter.trialEndsAt?.toISOString()).toBe(earlyEndsAt?.toISOString());
    expect(earlyAfter.trialEndsAt?.getTime()).toBe(NOW.getTime() + 15 * DAY);
    expect(earlyAfter.days).toBe(15);
    expect(earlyAfter.trialStartsAt?.toISOString()).toBe(NOW.toISOString());
  });

  it('leaves a thirty-day business alone when the default is cut to fifteen', async () => {
    const id = await startBusiness(seeded.earlyOwnerId, AUTH.earlyOwner, 'Long Cafe', NOW);
    const before = await trialOf(id);
    expect(before.days).toBe(30);

    expect((await setDefaultAs(AUTH.founder, '15')).ok).toBe(true);

    const after = await trialOf(id);
    expect(after.trialEndsAt?.toISOString()).toBe(before.trialEndsAt?.toISOString());
    expect(after.trialStartsAt?.toISOString()).toBe(before.trialStartsAt?.toISOString());
    expect(after.days).toBe(30);
  });

  it('moves no row at all: every existing business is byte for byte where it was', async () => {
    // Four businesses on four different lengths, then the default is changed
    // twice. A single UPDATE anywhere in the write path would show up here.
    const lengths: Array<[string, string, number]> = [
      ['7', 'Week Cafe', 7],
      ['15', 'Fortnight Cafe', 15],
      ['45', 'Long Cafe', 45],
      ['365', 'Year Cafe', 365],
    ];
    const born: Record<string, { endsAt: string; startsAt: string; updatedAt: string }> = {};

    for (const [days, name] of lengths) {
      expect((await setDefaultAs(AUTH.founder, days)).ok).toBe(true);
      const id = await startBusiness(seeded.earlyOwnerId, AUTH.earlyOwner, name, NOW);
      const row = await owner.client.findUniqueOrThrow({
        where: { id },
        select: { trialStartsAt: true, trialEndsAt: true, updatedAt: true },
      });
      born[id] = {
        endsAt: row.trialEndsAt!.toISOString(),
        startsAt: row.trialStartsAt!.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }
    expect(Object.keys(born)).toHaveLength(4);

    expect((await setDefaultAs(AUTH.founder, '30')).ok).toBe(true);
    expect((await setDefaultAs(AUTH.founder, '1')).ok).toBe(true);

    for (const [id, was] of Object.entries(born)) {
      const now = await owner.client.findUniqueOrThrow({
        where: { id },
        select: { trialStartsAt: true, trialEndsAt: true, updatedAt: true },
      });
      expect(now.trialEndsAt!.toISOString(), id).toBe(was.endsAt);
      expect(now.trialStartsAt!.toISOString(), id).toBe(was.startsAt);
      // Not even touched: changing the setting writes one AppSetting row and
      // nothing on Client, so updatedAt has not moved either.
      expect(now.updatedAt.toISOString(), id).toBe(was.updatedAt);
    }

    // And the four lengths are still four different lengths, read back off the
    // database rather than out of the snapshot above — four rows rewritten to
    // one common default is the exact failure this whole test is about.
    const rows = await owner.client.findMany({
      select: { trialStartsAt: true, trialEndsAt: true },
    });
    const lengthsNow = rows
      .map((r) => Math.round((r.trialEndsAt!.getTime() - r.trialStartsAt!.getTime()) / DAY))
      .sort((a, b) => a - b);
    expect(lengthsNow).toEqual([7, 15, 45, 365]);
  });
});

// ---------------------------------------------------------------------------
// 4. Everything downstream reads the stored date
// ---------------------------------------------------------------------------

describe('the stored trialEndsAt stays the source of truth for the account', () => {
  it('judges days remaining and expiry from the row, not from the setting', async () => {
    expect((await setDefaultAs(AUTH.founder, '15')).ok).toBe(true);
    const id = await startBusiness(seeded.earlyOwnerId, AUTH.earlyOwner, 'Judged Cafe', NOW);

    // Move the installation default far away from this client's own length.
    expect((await setDefaultAs(AUTH.founder, '365')).ok).toBe(true);

    session = { id: AUTH.earlyOwner };

    // Ten days in: five left, because the row says the 22nd — not 355 left,
    // which is what reading the setting would produce.
    const tenDaysIn = new Date(NOW.getTime() + 10 * DAY);
    const midTrial = await commercial.getAccountState(app, id, { now: tenDaysIn });
    expect(midTrial?.phase).toBe('TRIAL');
    expect(midTrial?.trialDaysLeft).toBe(5);
    expect(midTrial?.trialExpired).toBe(false);
    expect(midTrial?.trialEndsAt?.toISOString()).toBe(new Date(NOW.getTime() + 15 * DAY).toISOString());

    // Thirteen days in: two left.
    const twoLeft = await commercial.getAccountState(app, id, {
      now: new Date(NOW.getTime() + 13 * DAY),
    });
    expect(twoLeft?.trialDaysLeft).toBe(2);
    expect(twoLeft?.trialExpired).toBe(false);

    // Sixteen days in: over, even though the installation default is 365.
    const after = await commercial.getAccountState(app, id, {
      now: new Date(NOW.getTime() + 16 * DAY),
    });
    expect(after?.phase).toBe('TRIAL_ENDED');
    expect(after?.trialExpired).toBe(true);
    expect(after?.headline).toBe('Your trial has ended');
    expect(after?.line).toBe('Your feedback and your history are safe.');
  });

  it('describes the account from the dates it is handed and has no way to read a setting', async () => {
    // describeAccount is pure and takes no database handle at all, which is
    // why no change to the default can reach it.
    const state = commercial.describeAccount({
      subscriptionStatus: 'TRIAL',
      trialStartsAt: NOW,
      trialEndsAt: new Date(NOW.getTime() + 15 * DAY),
      paymentRequestedAt: null,
      ownerName: 'Priya',
      ownerEmail: 'priya@corner.test',
      ownerPhone: '+91 90000 00000',
      now: new Date(NOW.getTime() + 14 * DAY),
    });
    expect(state.trialDaysLeft).toBe(1);
    expect(state.trialExpired).toBe(false);

    // The structural half of the claim, checked where it can actually fail.
    // Arity would stay 1 if somebody threaded a handle through the options
    // object, so read the source instead: describeAccount must not mention the
    // setting, and must not take a database at all.
    const service = read('src', 'lib', 'commercial', 'service.ts');
    const start = service.indexOf('export function describeAccount(');
    expect(start).toBeGreaterThan(-1);
    const rest = service.slice(start + 1);
    const next = rest.indexOf('\nexport ');
    const fn = next === -1 ? rest : rest.slice(0, next);
    expect(fn).not.toContain('PrismaClient');
    // A whole word, so "daysBetween" and the like do not match.
    expect(fn).not.toMatch(/\bdb\b/);
    expect(fn).not.toMatch(/\bprisma\b/i);
    expect(fn).not.toContain('await');
    expect(fn).not.toContain('getTrialDefaultDays');
    expect(fn).not.toContain('TRIAL_DEFAULT_DAYS_SETTING');
    expect(fn).not.toContain('DEFAULT_TRIAL_DAYS');
  });

  it('extends from the business own end date, never from the current default', async () => {
    expect((await setDefaultAs(AUTH.founder, '15')).ok).toBe(true);
    const id = await startBusiness(seeded.earlyOwnerId, AUTH.earlyOwner, 'Extended Cafe', NOW);
    expect((await setDefaultAs(AUTH.founder, '365')).ok).toBe(true);

    session = { id: AUTH.founder };
    const extended = await commercial.extendTrial(app, id, 7, { now: new Date(NOW.getTime() + DAY) });
    expect(extended.ok).toBe(true);
    if (!extended.ok) return;

    // 15 + 7, from the stored end. Not 365, and not 365 + 7.
    expect(extended.data.trialEndsAt.toISOString()).toBe(
      new Date(NOW.getTime() + 22 * DAY).toISOString(),
    );
    expect((await trialOf(id)).days).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// 5. The range
// ---------------------------------------------------------------------------

describe('a whole number of days between 1 and 365, and nothing else', () => {
  it('accepts the two ends and rejects one step past each', async () => {
    expect((await setDefaultAs(AUTH.founder, '1')).ok).toBe(true);
    expect(await sqlDefault()).toBe(1);
    expect((await setDefaultAs(AUTH.founder, '365')).ok).toBe(true);
    expect(await sqlDefault()).toBe(365);

    // Below one.
    for (const low of ['0', '-1', '-30']) {
      const result = await setDefaultAs(AUTH.founder, low);
      expect(result.ok, low).toBe(false);
      if (!result.ok) expect(result.errors.trialDays).toContain('between 1 and 365');
    }

    // Above 365.
    for (const high of ['366', '400', '999']) {
      const result = await setDefaultAs(AUTH.founder, high);
      expect(result.ok, high).toBe(false);
    }

    // Not a whole number.
    for (const fractional of ['14.5', '30.0', '1e2', '0.5', ' 15 .5']) {
      const result = await setDefaultAs(AUTH.founder, fractional);
      expect(result.ok, fractional).toBe(false);
    }

    // Not a number.
    for (const nonsense of ['', ' ', 'thirty', 'two weeks', '30 days', 'NaN', '½']) {
      const result = await setDefaultAs(AUTH.founder, nonsense);
      expect(result.ok, nonsense).toBe(false);
    }

    // Every refusal above left the last accepted value in place.
    expect(await sqlDefault()).toBe(365);
    expect(commercial.normaliseTrialDays('366')).toBeNull();
    expect(commercial.normaliseTrialDays('0')).toBeNull();
    expect(commercial.normaliseTrialDays('30')).toBe(30);
    expect(commercial.MAX_TRIAL_DAYS).toBe(365);
  });

  it('falls back to thirty rather than to a stored value the range would refuse', async () => {
    // The database is the second reader of that row and validates it again,
    // because a value could be written by something other than Settings.
    for (const bad of ['0', '366', '', ' ', 'thirty', '14.5']) {
      await owner.appSetting.upsert({
        where: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING },
        create: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING, value: bad },
        update: { value: bad },
      });
      expect(await sqlDefault(), bad).toBe(30);
      session = { id: AUTH.founder };
      expect(await commercial.getTrialDefaultDays(app), bad).toBe(30);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Only the platform admin
// ---------------------------------------------------------------------------

describe('only the platform admin changes how long a trial runs', () => {
  it('refuses a business owner at the database, not merely at the action', async () => {
    expect((await setDefaultAs(AUTH.founder, '30')).ok).toBe(true);

    // A business owner, signed in, with a business of their own.
    await startBusiness(seeded.cafeOwnerId, AUTH.cafeOwner, 'Corner Cafe', NOW);
    session = { id: AUTH.cafeOwner };

    // They cannot even see the row: AppSetting is admin-only under RLS.
    expect(await app.appSetting.count()).toBe(0);

    // The write is refused by the POLICY, not by the action: this calls the
    // service directly, with no adminGate in front of it. Catch it to look at
    // it rather than to ignore it — the code is the one the policy raises.
    let refusal: unknown = null;
    await commercial.saveTrialDefaultDays(app, '1').catch((e) => {
      refusal = e;
    });
    expect(refusal, 'the database let a business owner through').not.toBeNull();
    expect(String((refusal as Error).message)).toContain('42501');
    expect(String((refusal as Error).message)).toContain('AppSetting');

    // And the stored value is untouched, which is what actually counts: an
    // UPDATE the policy hides would match zero rows and raise nothing at all,
    // so "no error" would never have been evidence of "no write".
    const stored = await owner.appSetting.findUnique({
      where: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING },
    });
    expect(stored?.value).toBe('30');
    expect(await sqlDefault()).toBe(30);
  });

  it('does not let the Settings default reach the extend button on a client page', () => {
    // Settings is a default for NEW trials. The two buttons on a client page
    // look alike and mean opposite things, and until M27 both boxes read the
    // same number -- so moving the default from 14 to 30 would have doubled
    // what one default-accepting click does to a business that already exists.
    const panel = read('src', 'components', 'forms', 'commercial-panel.tsx');
    const page = read('src', 'app', '(app)', 'clients', '[id]', 'page.tsx');

    const extend = panel.slice(panel.indexOf('action={extendTrialAction}'));
    const extendButton = extend.slice(0, extend.indexOf('/>'));
    expect(extendButton).toContain('days={props.extendTrialDays}');
    expect(extendButton).not.toContain('defaultTrialDays');

    const start = panel.slice(panel.indexOf('action={startTrialAction}'));
    const startButton = start.slice(0, start.indexOf('/>'));
    expect(startButton).toContain('days={props.defaultTrialDays}');

    // The page feeds them from two different sources.
    expect(page).toContain('defaultTrialDays={defaultTrialDays}');
    expect(page).toContain('extendTrialDays={EXTEND_TRIAL_DAYS}');
    expect(commercial.EXTEND_TRIAL_DAYS).toBe(14);
    expect(commercial.EXTEND_TRIAL_DAYS).not.toBe(commercial.DEFAULT_TRIAL_DAYS);
  });

  it('refuses a signed-out caller the same way', async () => {
    expect((await setDefaultAs(AUTH.founder, '30')).ok).toBe(true);
    session = null;

    await commercial.saveTrialDefaultDays(app, '7').catch(() => undefined);

    const stored = await owner.appSetting.findUnique({
      where: { key: commercial.TRIAL_DEFAULT_DAYS_SETTING },
    });
    expect(stored?.value).toBe('30');
  });

  it('keeps the admin-only policy on the table that carries the setting', async () => {
    const policies = await owner.$queryRawUnsafe<{ policyname: string; qual: string }[]>(
      `SELECT policyname, qual FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'AppSetting'`,
    );
    expect(policies).toHaveLength(1);
    expect(policies[0]?.policyname).toBe('settings_admin_only');
    expect(policies[0]?.qual).toContain('is_platform_admin');

    const forced = await owner.$queryRawUnsafe<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE oid = 'public."AppSetting"'::regclass`,
    );
    expect(forced[0]?.relrowsecurity).toBe(true);
    expect(forced[0]?.relforcerowsecurity).toBe(true);
  });

  it('still gives a business owner no way to write a trial date directly', async () => {
    const id = await startBusiness(seeded.cafeOwnerId, AUTH.cafeOwner, 'Corner Cafe', NOW);
    const before = await trialOf(id);

    session = { id: AUTH.cafeOwner };
    await expect(
      app.client.update({
        where: { id },
        data: { trialEndsAt: new Date(NOW.getTime() + 900 * DAY) },
      }),
    ).rejects.toThrow();

    expect((await trialOf(id)).trialEndsAt?.toISOString()).toBe(before.trialEndsAt?.toISOString());
  });
});

// ---------------------------------------------------------------------------
// 7. The two accounts named in the brief
// ---------------------------------------------------------------------------

/**
 * The brief asks that the founder's account and Corner Cafe stay permanently
 * exempt. There is no exemption MECHANISM in RepOS — no `trialExempt` column,
 * no allow-list of addresses, nothing that reads a business name — and this
 * pass does not add one, because adding "who is exempt" identity logic next to
 * trial enforcement is a different change with a different risk.
 *
 * What is true, and what these two tests pin, is the guarantee this pass is
 * responsible for: changing the installation default cannot reach either of
 * them, exactly as it cannot reach anybody else. The founder is a platform
 * admin, which is a User and carries no trial at all; Corner Cafe is an
 * ordinary business whose dates are its own.
 */
describe('the founder and Corner Cafe are out of reach of this setting', () => {
  it('leaves a business the founder owns exactly where it was', async () => {
    // Deliberately NOT a founder with no business: nothing in RepOS stops a
    // platform admin from owning one (app.create_client with p_as_owner writes
    // the membership for whoever is asking, admin or not), and production's
    // admin plausibly does. Asserting "the founder holds no membership" would
    // only restate a fixture built to make it true. So give the founder a real
    // business and prove the thing that actually matters about it.
    expect((await setDefaultAs(AUTH.founder, '15')).ok).toBe(true);
    const own = await startBusiness(seeded.founderId, AUTH.founder, 'Founder Cafe', NOW);

    const born = await trialOf(own);
    expect(born.days).toBe(15);

    const membership = await owner.membership.findFirstOrThrow({
      where: { userId: seeded.founderId, clientId: own },
      select: { role: true },
    });
    expect(membership.role).toBe('BUSINESS_OWNER');
    const founder = await owner.user.findUniqueOrThrow({
      where: { id: seeded.founderId },
      select: { isPlatformAdmin: true, status: true },
    });
    expect(founder.isPlatformAdmin).toBe(true);
    expect(founder.status).toBe('ACTIVE');

    for (const days of ['30', '1', '365']) {
      expect((await setDefaultAs(AUTH.founder, days)).ok, days).toBe(true);
      const after = await trialOf(own);
      expect(after.trialEndsAt?.toISOString(), days).toBe(born.trialEndsAt?.toISOString());
      expect(after.trialStartsAt?.toISOString(), days).toBe(born.trialStartsAt?.toISOString());
    }

    // Being the platform admin bought no different treatment, and cost none.
    expect((await trialOf(own)).days).toBe(15);
  });

  it('leaves Corner Cafe on the dates it started with, whatever the default becomes', async () => {
    expect((await setDefaultAs(AUTH.founder, '15')).ok).toBe(true);
    const cafe = await startBusiness(seeded.cafeOwnerId, AUTH.cafeOwner, 'Corner Cafe', NOW);
    const born = await trialOf(cafe);
    expect(born.days).toBe(15);

    for (const days of ['30', '1', '365', '7', '30']) {
      expect((await setDefaultAs(AUTH.founder, days)).ok, days).toBe(true);
      const after = await trialOf(cafe);
      expect(after.trialEndsAt?.toISOString(), days).toBe(born.trialEndsAt?.toISOString());
      expect(after.trialStartsAt?.toISOString(), days).toBe(born.trialStartsAt?.toISOString());
    }

    // And the owner is still told the same date they were told on day one.
    session = { id: AUTH.cafeOwner };
    const state = await commercial.getAccountState(app, cafe, { now: NOW });
    expect(state?.trialEndsAt?.toISOString()).toBe(born.trialEndsAt?.toISOString());
    expect(state?.line).toContain(commercial.formatLongDate(born.trialEndsAt!));
  });
});
