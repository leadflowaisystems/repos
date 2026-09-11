import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { runInRequestScope } from '@/lib/request-cache';
import { translatorFor } from '@/lib/i18n/translator';
import { loadFeedbackLedger } from '@/lib/feedback/ledger';
import { getLifecycle } from '@/lib/lifecycle/access';
import { sinceLastVisit } from '@/lib/retention/service';
import { getResponsibility } from '@/lib/responsibility/service';
import {
  findPortalClient,
  getAnalysisView,
  getCheckinView,
  getEvidenceIndex,
  getImprovementsView,
  getReviewsView,
  loadCore,
} from '@/lib/portal/service';
import { getAccountState } from '@/lib/commercial/service';
import { pendingRequestFor } from '@/lib/continuation/service';

/**
 * A CLIENT'S PAGES COST WHAT THAT CLIENT HOLDS, AND NOTHING MORE (perf pass).
 *
 * Measured before this pass, against a database shaped exactly like
 * production (schema + rls.sql, connected as repos_app): Home issued 21
 * Prisma operations and read the client's feedback table EIGHT times, once
 * per service that wanted a different projection of the same rows. A business
 * with 10,000 pieces of feedback moved 80,000 rows out of Postgres to draw one
 * screen; Customers and Check-in loaded the whole core twice.
 *
 * The fix is one shared read per request (`feedback/ledger.ts`) and one core
 * per request. These tests pin the shape so it cannot drift back:
 *
 *   - every intelligence page reads the feedback table ONCE (Feedback twice:
 *     the ledger and its own paged list);
 *   - the rows a page pulls are the client's own, and adding other businesses,
 *     with more feedback than the target has, changes neither the operation
 *     count nor the row count for the target;
 *   - the request scope is keyed on the client AND the language, so two
 *     businesses, or two languages, never share a copy;
 *   - no server action reads through a memoised loader, because a request
 *     that read, wrote and re-rendered would hand the page the copy from
 *     before the write.
 *
 * Counts, not milliseconds. A slow laptop must not fail this file; a ninth
 * scan must.
 */

const ROOT = resolve(__dirname, '..');

type Counters = { ops: number; rows: number; byModel: Record<string, number> };

/** A client shaped like production's: the app role, the identity set per operation. */
function appClient(appUrl: string, userId: string, counters: Counters): PrismaClient {
  const base = new PrismaClient({ datasources: { db: { url: appUrl } } });
  const wrapped = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          counters.ops += 1;
          const key = `${model}.${operation}`;
          counters.byModel[key] = (counters.byModel[key] ?? 0) + 1;
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE)`,
            query(args),
          ]);
          if (Array.isArray(result)) counters.rows += result.length;
          return result as unknown;
        },
      },
    },
  });
  return wrapped as unknown as PrismaClient;
}

const DAY = 86_400_000;
const OWNER = 'usperfowner00000000001';
const OWNER_AUTH = '99999999-9999-4999-8999-999999999999';
const TARGET = 'clperftarget0000000001';

async function seedBusiness(
  db: PrismaClient,
  id: string,
  feedback: number,
  owner: { userId: string; authId: string; email: string },
) {
  const now = Date.now();
  await db.client.create({
    data: { id, businessName: `Business ${id}`, vertical: 'restaurant', status: 'ACTIVE', subscriptionStatus: 'ACTIVE' },
  });
  await db.user.upsert({
    where: { id: owner.userId },
    create: { id: owner.userId, email: owner.email, authProviderId: owner.authId },
    update: {},
  });
  await db.membership.create({
    data: { userId: owner.userId, clientId: id, role: 'BUSINESS_OWNER', status: 'ACTIVE', lastSeenAt: new Date(now - 3 * DAY) },
  });
  await db.feedbackGateway.create({
    data: { clientId: id, publicToken: `${id}tok`.slice(0, 24), enabled: true },
  });
  await db.snapshot.create({
    data: { clientId: id, label: 'Check-in', capturedAt: new Date(now - 20 * DAY), rating: 4.2, reviewCount: 40 },
  });
  const rows = Array.from({ length: feedback }, (_, i) => {
    const negative = i % 3 === 0;
    const createdAt = new Date(now - (i % 90) * DAY);
    return {
      id: `${id}f${i.toString(36).padStart(4, '0')}`.slice(0, 32),
      clientId: id,
      text: negative
        ? 'Waited almost forty minutes for the main course to arrive even though the place was half empty.'
        : 'Quick friendly service, our order came within ten minutes and everything was hot.',
      stars: negative ? 2 : 5,
      reviewDate: createdAt,
      source: i % 2 === 0 ? 'REP_OS_QR' : 'PUBLIC_REVIEW',
      fingerprint: `${id}-${i}`,
      sentiment: negative ? 'NEGATIVE' : 'POSITIVE',
      issueTags: JSON.stringify(negative ? ['service_speed'] : []),
      praiseTags: JSON.stringify(negative ? [] : ['service_quality']),
      analysisStatus: 'ANALYSED',
      analysisVersion: 2,
      analysedAt: createdAt,
      themesJson: JSON.stringify([
        negative
          ? { key: 'service_speed', label: 'Service speed', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' }
          : { key: 'service_quality', label: 'Service quality', kind: 'PRAISE', sentiment: 'POSITIVE', severity: 'low' },
      ]),
      responseAction: negative ? 'REPLY_RECOMMENDED' : 'REPLY_OPTIONAL',
      priorityBand: negative ? 'HIGH' : 'LOW',
      triageVersion: 1,
      draftStatus: 'READY',
      draftVersion: 1,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await db.reviewItem.createMany({ data: rows });
}

type Ctx = { db: PrismaClient; clientId: string; userId: string; locale: 'en' | 'hi' | 'mr' };

/** The loader sets the workspace pages run, as their components run them. */
const PAGES: Record<string, (ctx: Ctx) => Promise<unknown>> = {
  home: async ({ db, clientId, userId, locale }) => {
    const t = translatorFor(locale);
    await sinceLastVisit(db, clientId, userId);
    await Promise.all([getResponsibility(db, clientId, { t }), getEvidenceIndex(db, clientId)]);
  },
  customers: async ({ db, clientId, locale }) => {
    const t = translatorFor(locale);
    await Promise.all([
      getAnalysisView(db, clientId, { t }),
      getResponsibility(db, clientId, { t }),
      getEvidenceIndex(db, clientId),
    ]);
  },
  feedback: async ({ db, clientId, locale }) => {
    const t = translatorFor(locale);
    await Promise.all([
      getReviewsView(db, clientId, { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null }, { page: 1, t }),
      getEvidenceIndex(db, clientId),
    ]);
  },
  improvements: async ({ db, clientId, locale }) => {
    const t = translatorFor(locale);
    await Promise.all([getImprovementsView(db, clientId, { t }), getEvidenceIndex(db, clientId)]);
  },
  checkin: async ({ db, clientId, locale }) => {
    const t = translatorFor(locale);
    await Promise.all([
      getCheckinView(db, clientId, { t }),
      getResponsibility(db, clientId, { t }),
      getEvidenceIndex(db, clientId),
    ]);
  },
  account: async ({ db, clientId, locale }) => {
    const t = translatorFor(locale);
    await Promise.all([
      getAccountState(db, clientId, { t }),
      getResponsibility(db, clientId, { t }),
      pendingRequestFor(db, clientId),
    ]);
  },
};

/** How many times each page may read the feedback table. */
const FEEDBACK_SCANS: Record<string, number> = {
  home: 1,
  customers: 1,
  // The ledger, and the page's own paged, filtered list of 25.
  feedback: 2,
  improvements: 1,
  checkin: 1,
  account: 1,
};

async function measure(appUrl: string, ctx: Omit<Ctx, 'db'>, page: string): Promise<Counters> {
  const counters: Counters = { ops: 0, rows: 0, byModel: {} };
  const db = appClient(appUrl, ctx.userId, counters);
  try {
    await runInRequestScope(() => PAGES[page]!({ ...ctx, db }));
  } finally {
    await db.$disconnect();
  }
  return counters;
}

const TARGET_FEEDBACK = 60;

describe('a workspace page reads its client, once', () => {
  let rls: RlsTestDb;

  beforeAll(async () => {
    expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
    rls = await createRlsTestDb('perf-client-scoped');
    await seedBusiness(rls.owner, TARGET, TARGET_FEEDBACK, {
      userId: OWNER,
      authId: OWNER_AUTH,
      email: 'perf-owner@example.test',
    });
  }, 120_000);

  afterAll(async () => {
    await rls?.dispose();
  });

  const ctx = { clientId: TARGET, userId: OWNER, locale: 'en' as const };

  it('reads the feedback table once per page, and never more than the ledger plus its own list', async () => {
    for (const page of Object.keys(PAGES)) {
      const c = await measure(rls.appUrl, ctx, page);
      const scans = c.byModel['ReviewItem.findMany'] ?? 0;
      expect(scans, `${page}: ReviewItem.findMany`).toBe(FEEDBACK_SCANS[page]);
      // No page still asks the database to count what the ledger already holds.
      expect(c.byModel['ReviewItem.count'] ?? 0, `${page}: ReviewItem.count`).toBeLessThanOrEqual(page === 'feedback' ? 2 : 0);
    }
  }, 120_000);

  it('loads the core, the client row and the lifecycle row once per request', async () => {
    const c = await measure(rls.appUrl, ctx, 'customers');
    // Customers asks for the core through its own view AND the responsibility
    // bundle. One improvement list, one check-in list, one client row.
    expect(c.byModel['ImprovementAction.findMany']).toBe(1);
    expect(c.byModel['Snapshot.findMany']).toBe(2); // the health load and the check-in list: different shapes, each once
    expect(c.byModel['Client.findFirst']).toBe(1);

    const counters: Counters = { ops: 0, rows: 0, byModel: {} };
    const db = appClient(rls.appUrl, OWNER, counters);
    try {
      await runInRequestScope(async () => {
        // The shell and the page both ask, in one request.
        await getLifecycle(db, TARGET);
        await getLifecycle(db, TARGET);
        await findPortalClient(db, TARGET);
        await findPortalClient(db, TARGET);
        const client = (await findPortalClient(db, TARGET))!;
        await loadCore(db, client, new Date(), translatorFor('en'));
        await loadCore(db, client, new Date(), translatorFor('en'));
        await loadFeedbackLedger(db, TARGET);
        await loadFeedbackLedger(db, TARGET);
      });
    } finally {
      await db.$disconnect();
    }
    expect(counters.byModel['Client.findFirst']).toBe(2); // one lifecycle row, one portal row
    expect(counters.byModel['ImprovementAction.findMany']).toBe(1);
    expect(counters.byModel['ReviewItem.findMany']).toBe(1);
  }, 60_000);

  it('keys the request scope on the client and on the language', async () => {
    const OTHER = 'clperfother00000000001';
    await seedBusiness(rls.owner, OTHER, 25, { userId: OWNER, authId: OWNER_AUTH, email: 'perf-owner@example.test' });

    const counters: Counters = { ops: 0, rows: 0, byModel: {} };
    const db = appClient(rls.appUrl, OWNER, counters);
    try {
      await runInRequestScope(async () => {
        const a = await loadFeedbackLedger(db, TARGET);
        const b = await loadFeedbackLedger(db, OTHER);
        expect(a).toHaveLength(TARGET_FEEDBACK);
        expect(b).toHaveLength(25);
        expect(a.every((row) => row.id.startsWith(TARGET))).toBe(true);
        expect(b.every((row) => row.id.startsWith(OTHER))).toBe(true);

        const client = (await findPortalClient(db, TARGET))!;
        const en = await loadCore(db, client, new Date(), translatorFor('en'));
        const hi = await loadCore(db, client, new Date(), translatorFor('hi'));
        // Two languages are two loads: the core carries sentences.
        expect(en).not.toBe(hi);
        expect(en.t?.locale).toBe('en');
        expect(hi.t?.locale).toBe('hi');
        // The rows underneath are the same rows, read once.
        expect(en.intelligence.evidence.total).toBe(hi.intelligence.evidence.total);
        expect(en.intelligence.evidence.total).toBe(TARGET_FEEDBACK);
      });
    } finally {
      await db.$disconnect();
    }
    expect(counters.byModel['ReviewItem.findMany']).toBe(2); // one per client, not one per language
    expect(counters.byModel['ImprovementAction.findMany']).toBe(2); // one per language for the core
  }, 60_000);

  it('does not share a copy across requests', async () => {
    const counters: Counters = { ops: 0, rows: 0, byModel: {} };
    const db = appClient(rls.appUrl, OWNER, counters);
    try {
      await runInRequestScope(() => loadFeedbackLedger(db, TARGET));
      await runInRequestScope(() => loadFeedbackLedger(db, TARGET));
    } finally {
      await db.$disconnect();
    }
    expect(counters.byModel['ReviewItem.findMany']).toBe(2);
  }, 60_000);

  it('costs the target the same with many other, larger businesses in the database', async () => {
    const before: Record<string, Counters> = {};
    for (const page of Object.keys(PAGES)) before[page] = await measure(rls.appUrl, ctx, page);

    // Six more businesses, each with more feedback than the target holds.
    for (let n = 1; n <= 6; n += 1) {
      await seedBusiness(rls.owner, `clperfbulk0000000000${n}`, 200, {
        userId: `usperfbulk0000000000${n}`,
        authId: `88888888-8888-4888-8888-00000000000${n}`,
        email: `bulk${n}@example.test`,
      });
    }

    for (const page of Object.keys(PAGES)) {
      const after = await measure(rls.appUrl, ctx, page);
      expect(after.ops, `${page}: operations`).toBe(before[page]!.ops);
      expect(after.rows, `${page}: rows`).toBe(before[page]!.rows);
      expect(after.byModel, `${page}: shape`).toEqual(before[page]!.byModel);
    }

    // And the rows are the target's own: the ledger is exactly its history.
    const counters: Counters = { ops: 0, rows: 0, byModel: {} };
    const db = appClient(rls.appUrl, OWNER, counters);
    try {
      const ledger = await runInRequestScope(() => loadFeedbackLedger(db, TARGET));
      expect(ledger).toHaveLength(TARGET_FEEDBACK);
    } finally {
      await db.$disconnect();
    }
  }, 300_000);
});

describe('a render never writes, and an action never reads through the page loaders', () => {
  // WHY THE PER-REQUEST MEMO CANNOT SERVE A STALE COPY. The memo is React's
  // per-render cache. A Server Action body runs before the re-render, outside
  // any render, where React's cache() hands out a throwaway map — so nothing
  // an action reads is remembered and the page that follows starts empty and
  // reads what the action wrote (Next 15.5: action-handler.js runs the action
  // under the request store alone, then generateFlight). The one path that
  // COULD read a copy from before a write is a render that writes feedback
  // rows after loading them. So two things are pinned, both lexical and both
  // exact for what they claim:
  //
  //   1. no server component in the workspace tree writes to the database —
  //      renders read, actions write;
  //   2. the action modules do not reach for the page loaders directly, so a
  //      reader of an action can see what it reads. (An action may still reach
  //      a memoised loader through a service — createActionFromInsight reads
  //      the intelligence before writing an ImprovementAction — and that is
  //      safe for the reason above, not because of this check.)
  const MEMOISED = [
    'loadFeedbackLedger',
    'loadCore',
    'findPortalClient',
    'getResponsibility',
    'getPortalView',
    'getAnalysisView',
    'getImprovementsView',
    'getCheckinView',
    'getReviewsView',
    'loadIntelligence',
    'getClientIntelligence',
    'getThemeSummary',
    'loadHealthSnapshots',
    'getClientHealth',
    'getEvidenceIndex',
    'getFeedbackStats',
    'getAnalysisCoverage',
    'getReplyCoverage',
    'listActionsWithProgress',
    'sinceLastVisit',
    'getLifecycle',
  ];

  it('no server component under the workspace writes to the database', () => {
    const roots = [
      join(ROOT, 'src', 'app', '(workspace)'),
      join(ROOT, 'src', 'components', 'workspace'),
      join(ROOT, 'src', 'components', 'portal'),
    ];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, name.name);
        if (name.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name.name) && !/\.test\.tsx?$/.test(name.name)) files.push(full);
      }
    };
    for (const root of roots) walk(root);
    expect(files.length).toBeGreaterThan(20);
    const writers = files
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        // A server component: not a client component, and rendering.
        if (/^\s*'use client';/m.test(source)) return false;
        return /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$transaction|withRlsContext/.test(source);
      })
      .map((file) => file.replace(ROOT, '').replace(/\\/g, '/'));
    expect(writers).toEqual([]);
  });

  it('is true of every module under src/lib/actions', () => {
    const dir = join(ROOT, 'src', 'lib', 'actions');
    const offenders: string[] = [];
    let checked = 0;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      checked += 1;
      const source = readFileSync(join(dir, file), 'utf8');
      for (const name of MEMOISED) {
        if (new RegExp(`\\b${name}\\b`).test(source)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});
