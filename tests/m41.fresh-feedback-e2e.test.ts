import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, OWNER_DATABASE_URL_VAR, type RlsTestDb } from './helpers/rls-db';
import { runInRequestScope } from '@/lib/request-cache';
import { translatorFor } from '@/lib/i18n/translator';
import { markPublicClient } from '@/lib/db-public';
import { getPackOrFallback } from '@/lib/packs';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { _resetGatewayThrottles, submitCustomerFeedback } from '@/lib/gateway/service';
import { hasUnprocessedFeedback, processClientFeedback } from '@/lib/pipeline/feedback';
import { getAnalysisCoverage } from '@/lib/feedback/analysis';
import { getEvidenceIndex, getFeedbackEntry, getFreshFeed } from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { buildBrief } from '@/lib/portal/brief';
import { newPublicToken } from '@/lib/tokens';

/**
 * A CUSTOMER'S FEEDBACK, FROM THE CARD TO HOME — AGAINST A REAL DATABASE.
 *
 * The freshness pass promised the owner three things, and this file proves
 * each one end to end, on a real Postgres with the shipped `rls.sql` and
 * `public-gateway.sql` applied and every workspace read issued as `repos_app`
 * with the owner's identity set, exactly as production issues it:
 *
 *   1. A submission lands in the real data pipeline — through the anonymous
 *      path's own SQL function, `app.public_submit`, never with a tenant id
 *      the application chose.
 *   2. Home says so honestly at every stage: "1 new · Headway is reading it"
 *      before the pipeline has run, and "Headway just read 1" after — with
 *      the customer's own words in "Latest from customers" throughout, and
 *      the happy/mixed/unhappy counts and the topic counts moving only once
 *      the reading is actually done.
 *   3. The individual entry opens for its owner and for nobody else.
 *
 * The run is the pipeline's own: `processClientFeedback` through a handle
 * scoped to exactly this client (`scopeToClient` semantics, as the trigger
 * uses), with the deterministic reader — no AI provider is called from a test.
 *
 * DISPOSABLE. `createRlsTestDb` creates and drops its own database on a
 * cluster it refuses unless it is on localhost.
 */

const ROOT = resolve(__dirname, '..');
const DAY = 86_400_000;
const OWNER = 'usfreshowner000000001';
const OWNER_AUTH = '77777777-7777-4777-8777-777777777771';
const STRANGER = 'usfreshstranger00001';
const STRANGER_AUTH = '77777777-7777-4777-8777-777777777772';
const MINE = 'clfreshmine000000001';
const THEIRS = 'clfreshtheirs0000001';
// Real tokens, from the generator the product uses: 22 characters from an
// alphabet with no look-alikes. Anything else is refused before any query.
const TOKEN = newPublicToken();
const THEIR_TOKEN = newPublicToken();

const WORDS = 'We waited almost forty minutes for our food and the service was really slow tonight.';

const t = translatorFor('en');
const scoped = <T>(fn: () => Promise<T>): Promise<T> => runInRequestScope(fn);

/** The runtime role, with the identity set per operation, as production does. */
function appClient(appUrl: string, userId: string): PrismaClient {
  const base = new PrismaClient({ datasources: { db: { url: appUrl } } });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE)`,
            query(args),
          ]);
          return result as unknown;
        },
      },
    },
  }) as unknown as PrismaClient;
}

/** The pipeline's handle: the runtime role, scoped to one client and no person. */
function serviceScope(appUrl: string, clientId: string): PrismaClient {
  const base = new PrismaClient({ datasources: { db: { url: appUrl } } });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.service_client_id', ${clientId}, TRUE)`,
            query(args),
          ]);
          return result as unknown;
        },
      },
    },
  }) as unknown as PrismaClient;
}

/** A business with an established complaint, read long before today. */
async function seed(
  db: PrismaClient,
  id: string,
  owner: { userId: string; authId: string; email: string },
  token: string,
  complaints: number,
) {
  const long = new Date(Date.now() - 30 * DAY);
  await db.client.create({
    data: { id, businessName: `Fresh ${id}`, vertical: 'restaurant', status: 'ACTIVE', subscriptionStatus: 'ACTIVE' },
  });
  await db.user.upsert({
    where: { id: owner.userId },
    create: { id: owner.userId, email: owner.email, authProviderId: owner.authId },
    update: {},
  });
  await db.membership.create({
    data: { userId: owner.userId, clientId: id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });
  await db.feedbackGateway.create({ data: { clientId: id, publicToken: token, enabled: true } });
  await db.snapshot.create({
    data: { clientId: id, label: 'Check-in', capturedAt: new Date(Date.now() - 20 * DAY), rating: 4.0, reviewCount: 30 },
  });
  const rows: Prisma.ReviewItemCreateManyInput[] = [];
  for (let i = 0; i < complaints + 8; i += 1) {
    const bad = i < complaints;
    rows.push({
      id: `${id}h${i.toString(36).padStart(3, '0')}`.slice(0, 32),
      clientId: id,
      text: bad
        ? 'Waited almost forty minutes for the main course even though the place was half empty.'
        : 'Lovely food, friendly staff and the table was ready when we arrived.',
      stars: bad ? 2 : 5,
      reviewDate: long,
      source: 'REP_OS_QR',
      fingerprint: `${id}-h-${i}`,
      sentiment: bad ? 'NEGATIVE' : 'POSITIVE',
      issueTags: JSON.stringify(bad ? ['service_speed'] : []),
      praiseTags: JSON.stringify(bad ? [] : ['service_quality']),
      analysisStatus: 'ANALYSED',
      analysisVersion: 2,
      analysedAt: long,
      themesJson: JSON.stringify([
        bad
          ? { key: 'service_speed', label: 'Service speed', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' }
          : { key: 'service_quality', label: 'Service quality', kind: 'PRAISE', sentiment: 'POSITIVE', severity: 'low' },
      ]),
      responseAction: bad ? 'REPLY_RECOMMENDED' : 'REPLY_OPTIONAL',
      priorityBand: bad ? 'HIGH' : 'LOW',
      triageVersion: 1,
      draftStatus: 'READY',
      draftVersion: 1,
      createdAt: long,
      updatedAt: long,
    });
  }
  await db.reviewItem.createMany({ data: rows });
}

/** What Home computes, with Home's own loaders, in one request scope. */
async function home(db: PrismaClient, clientId: string) {
  return scoped(async () => {
    const [bundle, evidence, coverage] = await Promise.all([
      getResponsibility(db, clientId, { t }),
      getEvidenceIndex(db, clientId),
      getAnalysisCoverage(db, clientId),
    ]);
    const now = new Date();
    const brief = buildBrief({
      view: bundle!.view,
      responsibility: bundle!.responsibility,
      evidence,
      coverage,
      basePath: `/workspace/${clientId}`,
      now,
      t,
    });
    const fresh = await getFreshFeed(db, clientId, { now });
    return { brief, fresh, coverage, view: bundle!.view, evidence };
  });
}

describe('a customer submits, Headway reads it, and Home shows it — honestly, at every step', () => {
  let rls: RlsTestDb;
  let owner: PrismaClient;
  let stranger: PrismaClient;
  let publicDb: PrismaClient;
  let pipeline: PrismaClient;
  let itemId = '';
  let theirItem = '';
  const before = { total: 0, negative: 0, serviceSpeed: 0 };

  beforeAll(async () => {
    expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
    rls = await createRlsTestDb('fresh-feedback-e2e');

    // The anonymous path's own functions, from the file that ships — applied
    // the same way `createRlsTestDb` applies rls.sql, to this database only.
    const ownerUrl = new URL(process.env[OWNER_DATABASE_URL_VAR]!.trim());
    ownerUrl.pathname = '/repos_rls_fresh_feedback_e2e';
    ownerUrl.searchParams.set('schema', 'public');
    execFileSync(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'prisma', 'build', 'index.js'),
        'db',
        'execute',
        '--file',
        join(ROOT, 'prisma', 'm20', 'public-gateway.sql'),
        '--schema',
        join(ROOT, 'prisma', 'schema.prisma'),
      ],
      { cwd: ROOT, env: { ...process.env, DATABASE_URL: ownerUrl.toString(), DIRECT_DATABASE_URL: ownerUrl.toString() }, stdio: 'pipe' },
    );

    await seed(rls.owner, MINE, { userId: OWNER, authId: OWNER_AUTH, email: 'fresh-owner@example.test' }, TOKEN, 12);
    await seed(rls.owner, THEIRS, { userId: STRANGER, authId: STRANGER_AUTH, email: 'fresh-stranger@example.test' }, THEIR_TOKEN, 6);
    theirItem = `${THEIRS}h000`.slice(0, 32);

    owner = appClient(rls.appUrl, OWNER);
    stranger = appClient(rls.appUrl, STRANGER);
    // The customer's handle: marked anonymous, so the submission goes through
    // `app.public_submit` — the token in, no client id — as in production.
    publicDb = markPublicClient(new PrismaClient({ datasources: { db: { url: ownerUrl.toString() } } }));
    pipeline = serviceScope(rls.appUrl, MINE);
    _resetGatewayThrottles();
  }, 240_000);

  afterAll(async () => {
    await Promise.all([owner?.$disconnect(), stranger?.$disconnect(), publicDb?.$disconnect(), pipeline?.$disconnect()]);
    await rls?.dispose();
  });

  it('starts from a business Headway has already read', async () => {
    const { brief, fresh, coverage, view } = await home(owner, MINE);
    before.total = coverage.total;
    before.negative = coverage.sentimentCounts.NEGATIVE ?? 0;
    before.serviceSpeed = view.unhappy.find((s) => s.themeKey === 'service_speed')?.evidenceCount ?? 0;
    expect(before.total).toBe(20);
    expect(before.serviceSpeed).toBe(12);
    // Nothing new today: the band has no live line, and says nothing it cannot back.
    expect(fresh!.live).toBeNull();
    expect(brief.mix.read).toBe(20);
  });

  it('stores a customer submission through the anonymous boundary, into the real pipeline', async () => {
    const result = await submitCustomerFeedback(
      publicDb,
      TOKEN,
      { stars: 2, text: WORDS, dimensions: {}, signals: [], nonce: null, website: null },
      { address: '203.0.113.41' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.clientId).toBe(MINE);
    expect(result.data.stored).toBe(true);
    itemId = result.data.itemId!;

    // What was written, read back by the owner of the tables: this client,
    // the card's source, stamped now, and waiting for the pipeline.
    const row = await rls.owner.reviewItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(row.clientId).toBe(MINE);
    expect(row.source).toBe('REP_OS_QR');
    expect(row.analysisStatus).toBe('PENDING');
    expect(row.analysedAt).toBeNull();
    expect(Math.abs(row.reviewDate!.getTime() - Date.now())).toBeLessThan(60_000);
    // And the pipeline's own catch-up check can see it waiting.
    expect(await hasUnprocessedFeedback(pipeline, MINE)).toBe(true);
  });

  it('shows it on Home at once, as new and being read — without counting it as read', async () => {
    const { brief, fresh, coverage } = await home(owner, MINE);
    expect(fresh!.live).toEqual({ kind: 'READING', count: 1 });
    // The customer's own words are the first thing in "Latest from customers".
    expect(fresh!.latest[0]).toMatchObject({ id: itemId, text: WORDS, stars: 2, state: 'NEW', exact: true, topics: [] });
    expect(fresh!.total).toBe(before.total + 1);
    // Not read, so not in the happy/mixed/unhappy split or any topic count yet.
    expect(coverage.needsAnalysis).toBe(1);
    expect(brief.mix.read).toBe(20);
  });

  it('opens the entry itself for its owner, even before it is read', async () => {
    const item = await scoped(() => getFeedbackEntry(owner, MINE, itemId, { t }));
    expect(item).not.toBeNull();
    expect(item!.text).toBe(WORDS);
    expect(item!.state).toBe('COLLECTED');
    expect(item!.exact).toBe(true);
  });

  it('is read by the pipeline, through a handle scoped to this business alone', async () => {
    const result = await processClientFeedback(pipeline, MINE, { useAi: false });
    expect(result.ok).toBe(true);
    expect(result.analysed).toBe(1);
    const row = await rls.owner.reviewItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(row.analysisStatus).toBe('ANALYSED');
    expect(row.analysedAt).not.toBeNull();
    // The other business was not touched by this run.
    const theirs = await rls.owner.reviewItem.count({ where: { clientId: THEIRS, analysedAt: { gt: new Date(Date.now() - 60_000) } } });
    expect(theirs).toBe(0);
  });

  it('then says "just read" on Home, and every count that includes it has moved', async () => {
    const pack = getPackOrFallback('restaurant');
    const expected = normalizeFeedback({ text: WORDS, stars: 2, pack });
    const { brief, fresh, coverage, view, evidence } = await home(owner, MINE);

    expect(fresh!.live).toEqual({ kind: 'JUST_READ', count: 1 });
    const latest = fresh!.latest[0]!;
    expect(latest).toMatchObject({ id: itemId, state: 'READ' });
    // Filed under exactly the topics the deterministic reader finds in the words.
    expect(latest.topics.map((x) => x.key).sort()).toEqual(expected.themes.map((x) => x.key).sort());

    // The split and the read count include it now — and only now.
    expect(coverage.needsAnalysis).toBe(0);
    expect(brief.mix.read).toBe(before.total + 1);
    expect(coverage.sentimentCounts.NEGATIVE ?? 0).toBe(before.negative + (expected.sentiment === 'NEGATIVE' ? 1 : 0));

    // The intelligence still works, and counts it under its topic.
    for (const theme of expected.themes) {
      expect(evidence.byTheme.get(theme.key)?.some((row) => row.id === itemId), theme.key).toBe(true);
    }
    if (expected.themes.some((x) => x.key === 'service_speed')) {
      const signal = view.unhappy.find((s) => s.themeKey === 'service_speed');
      expect(signal!.evidenceCount).toBe(before.serviceSpeed + 1);
    }
  });

  it('keeps the path from the new entry to its topic and back', async () => {
    const item = await scoped(() => getFeedbackEntry(owner, MINE, itemId, { t }));
    expect(item!.state).toBe('ANALYSED');
    for (const topic of item!.topics) {
      // Every topic the entry names is one the Feedback page can open.
      expect(topic.key).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('opens an entry for its own business only', async () => {
    // Another business's entry, asked for from this business's page: not found.
    expect(await scoped(() => getFeedbackEntry(owner, MINE, theirItem, { t }))).toBeNull();
    // This owner asking for the other business directly: Row Level Security
    // shows them nothing, so there is nothing to open.
    expect(await scoped(() => getFeedbackEntry(owner, THEIRS, theirItem, { t }))).toBeNull();
    // And the other business's owner cannot open this one.
    expect(await scoped(() => getFeedbackEntry(stranger, MINE, itemId, { t }))).toBeNull();
    // A malformed id never reaches the database.
    expect(await scoped(() => getFeedbackEntry(owner, MINE, "x' OR '1'='1", { t }))).toBeNull();
  });

  it('never shows one business the other\'s newest feedback', async () => {
    const mine = await home(owner, MINE);
    // Asked of the tables' owner, which sees every business: each of the
    // newest entries on this Home belongs to this business.
    const ids = mine.fresh!.latest.map((e) => e.id);
    expect(ids).toContain(itemId);
    const owners = await rls.owner.reviewItem.findMany({ where: { id: { in: ids } }, select: { clientId: true } });
    expect(owners).toHaveLength(ids.length);
    expect(new Set(owners.map((o) => o.clientId))).toEqual(new Set([MINE]));
    const theirsSeenByMe = await scoped(() => getFreshFeed(owner, THEIRS, { now: new Date() }));
    expect(theirsSeenByMe).toBeNull();
  });
});
