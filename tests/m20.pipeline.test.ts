import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { createClient } from '@/lib/clients/service';
import { PROCESSING_STALE_MS, analysisStateOf } from '@/lib/feedback/state';
import { _resetGatewayThrottles, ensureGateway, submitCustomerFeedback } from '@/lib/gateway/service';
import { hasUnprocessedFeedback, processClientFeedback } from '@/lib/pipeline/feedback';
import type { ReviewFilters } from '@/lib/portal/pages';
import {
  getAnalysisView,
  getCheckinView,
  getImprovementsView,
  getPortalView,
  getReviewsView,
} from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * NEW FEEDBACK BECOMES USEFUL ON ITS OWN (launch pass).
 *
 * Two real reviews sat in production as "0 read": the gateway stored them as
 * PENDING and the only thing that ever called the analysis was a button on
 * the operator's console. The owner's Home said there was nothing to tell
 * them, which was false — there were two things, unread.
 *
 * The pipeline in `@/lib/pipeline` is what runs now, after a submission and
 * whenever a workspace is opened with something waiting. These tests pin the
 * properties that make it safe to run without a person:
 *
 *   - a submission is read on the next run, once, and the words are untouched;
 *   - a failed reading is retried; a reading in hand is left alone; a claim a
 *     dead run left behind is taken over;
 *   - two runs at once never read the same item twice and create nothing;
 *   - two pieces of feedback already produce current signals, while the
 *     historical conclusions — direction, before/after, what changed — stay
 *     withheld until there is history to compare;
 *   - while RepOS is reading, every owner page says so, never "nothing".
 */

function filters(overrides: Partial<ReviewFilters> = {}): ReviewFilters {
  return { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null, ...overrides };
}

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m20-pipeline');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
});

const FIRST = 'Half the treadmills were out of order and the changing room was not clean';
const SECOND = 'Great trainers, always around to help with form';

/** Gold Gym, with its QR page, exactly as production has it. */
async function gym() {
  const created = await createClient(
    db,
    validClientInput({ businessName: 'Gold Gym', vertical: 'gym' }),
  );
  if (!created.ok) throw new Error('fixture client failed');
  const gateway = await ensureGateway(db, created.data.id);
  if (!gateway) throw new Error('fixture gateway failed');
  return { clientId: created.data.id, token: gateway.publicToken };
}

/** Two customers scan the code. Stored, not read — the state production was stuck in. */
async function twoSubmissions(token: string) {
  const a = await submitCustomerFeedback(db, token, {
    stars: 2,
    text: FIRST,
    dimensions: { equipment: 2, cleanliness: 2 },
    signals: ['out_of_order', 'changing_room'],
  });
  const b = await submitCustomerFeedback(db, token, {
    stars: 4,
    text: SECOND,
    dimensions: { trainers: 5 },
    signals: [],
  });
  if (!a.ok || !b.ok) throw new Error('fixture submissions failed');
  if (!a.data.itemId || !b.data.itemId) throw new Error('fixture submissions were not stored');
  return { first: a.data.itemId, second: b.data.itemId, clientId: a.data.clientId };
}

describe('processing newly submitted feedback', () => {
  it('reads a submission on the next run, once, and leaves the words alone', async () => {
    const { clientId, token } = await gym();
    const { first, second } = await twoSubmissions(token);

    expect(await hasUnprocessedFeedback(db, clientId)).toBe(true);

    const run = await processClientFeedback(db, clientId, { useAi: false });
    expect(run.ok).toBe(true);
    expect(run.analysed).toBe(2);
    expect(run.needsRetry).toBe(0);
    expect(run.inProgress).toBe(0);
    expect(run.triaged).toBe(2);

    const rows = await db.reviewItem.findMany({ where: { clientId }, orderBy: { sortIndex: 'asc' } });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.analysisStatus).toBe('ANALYSED');
      expect(row.analysisVersion).toBe(ANALYSIS_VERSION);
      expect(row.analysedAt).not.toBeNull();
      expect(row.analysisError).toBeNull();
      expect(analysisStateOf(row)).toBe('ANALYSED');
      expect(row.triageVersion).toBeGreaterThan(0);
    }
    expect(rows.find((r) => r.id === first)?.text).toBe(FIRST);
    expect(rows.find((r) => r.id === second)?.text).toBe(SECOND);

    // Idempotent: nothing to do the second time, and nothing created.
    const again = await processClientFeedback(db, clientId, { useAi: false });
    expect(again.analysed).toBe(0);
    expect(again.skippedUpToDate).toBe(2);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(2);
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(false);
  });

  it('retries a failed reading, and clears the failure once it succeeds', async () => {
    const { clientId, token } = await gym();
    const { first } = await twoSubmissions(token);
    await processClientFeedback(db, clientId, { useAi: false });

    await db.reviewItem.update({
      where: { id: first },
      data: { analysisStatus: 'FAILED', analysisError: 'provider exploded' },
    });
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(true);

    const run = await processClientFeedback(db, clientId, { useAi: false });
    expect(run.analysed).toBe(1);
    const row = await db.reviewItem.findUniqueOrThrow({ where: { id: first } });
    expect(row.analysisStatus).toBe('ANALYSED');
    expect(row.analysisError).toBeNull();
    expect(row.text).toBe(FIRST);
  });

  it('leaves an item another run is reading, and takes over a claim that went stale', async () => {
    const { clientId, token } = await gym();
    const { first, second } = await twoSubmissions(token);

    // Another run has this one in hand right now.
    await db.reviewItem.update({ where: { id: first }, data: { analysisStatus: 'PROCESSING' } });
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(true); // the second one still waits

    const run = await processClientFeedback(db, clientId, { useAi: false });
    expect(run.analysed).toBe(1);
    expect(run.inProgress).toBe(1);
    expect((await db.reviewItem.findUniqueOrThrow({ where: { id: first } })).analysisStatus).toBe('PROCESSING');
    expect((await db.reviewItem.findUniqueOrThrow({ where: { id: second } })).analysisStatus).toBe('ANALYSED');
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(false);

    // The run that held it died. After the stale window the claim is free.
    await db.reviewItem.update({
      where: { id: first },
      data: { updatedAt: new Date(Date.now() - PROCESSING_STALE_MS - 60_000) },
    });
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(true);
    const later = await processClientFeedback(db, clientId, { useAi: false });
    expect(later.analysed).toBe(1);
    expect(later.inProgress).toBe(0);
    expect((await db.reviewItem.findUniqueOrThrow({ where: { id: first } })).analysisStatus).toBe('ANALYSED');
  });

  it('two runs at once read each item exactly once and create nothing', async () => {
    const { clientId, token } = await gym();
    await twoSubmissions(token);

    const [a, b] = await Promise.all([
      processClientFeedback(db, clientId, { useAi: false }),
      processClientFeedback(db, clientId, { useAi: false }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(a.analysed + b.analysed).toBe(2);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(2);
    expect(await db.reviewItem.count({ where: { clientId, analysisStatus: 'ANALYSED' } })).toBe(2);
  });

  it('knows what is waiting: failed, read by an older engine, or a dead claim', async () => {
    const { clientId, token } = await gym();
    const { first } = await twoSubmissions(token);
    await processClientFeedback(db, clientId, { useAi: false });
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(false);

    await db.reviewItem.update({ where: { id: first }, data: { analysisVersion: ANALYSIS_VERSION - 1 } });
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(true);
    await processClientFeedback(db, clientId, { useAi: false });
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(false);

    await db.reviewItem.update({
      where: { id: first },
      data: { analysisStatus: 'PROCESSING', updatedAt: new Date(Date.now() - PROCESSING_STALE_MS - 1_000) },
    });
    expect(await hasUnprocessedFeedback(db, clientId)).toBe(true);
  });
});

describe('what the owner sees', () => {
  it('while Headway is reading, every page says so — never that there is nothing', async () => {
    const { clientId, token } = await gym();
    await twoSubmissions(token);

    const home = await getPortalView(db, clientId);
    expect(home?.view.basedOn).toBe(0);
    expect(home?.view.summary).toBe('2 pieces of feedback have arrived and Headway is reading them now.');
    expect(home?.view.basis).toMatch(/Usually read within a minute/);
    expect(home?.view.soFar.waiting).toBe(2);

    const bundle = await getResponsibility(db, clientId);
    expect(bundle?.responsibility.answerDetail).toMatch(/2 pieces of feedback have arrived and Headway is reading them now/);
    expect(bundle?.responsibility.did).toEqual(['2 pieces of feedback are being read now.']);

    const reviews = await getReviewsView(db, clientId, filters());
    expect(reviews?.total).toBe(2);
    expect(reviews?.analysed).toBe(0);
    expect(reviews?.waiting).toBe(2);
    expect(reviews?.items.map((i) => i.state)).toEqual(['COLLECTED', 'COLLECTED']);

    const analysis = await getAnalysisView(db, clientId);
    expect(analysis?.soFar.waiting).toBe(2);
    expect(analysis?.limits.join(' ')).toMatch(/being read now/);
  });

  it('two pieces of feedback already give current signals, and no historical conclusions', async () => {
    const { clientId, token } = await gym();
    await twoSubmissions(token);
    await processClientFeedback(db, clientId, { useAi: false });

    const home = await getPortalView(db, clientId);
    const view = home!.view;
    expect(view.basedOn).toBe(2);
    expect(view.summary).not.toMatch(/nothing to tell you/);
    expect(view.summary).not.toMatch(/reading them now/);
    // The picture is honest about a first week...
    expect(view.mood).toBe('TOO_EARLY');
    // ...and still says what the two customers said.
    expect(view.soFar.read).toBe(2);
    expect(view.soFar.waiting).toBe(0);
    expect(view.soFar.rated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Equipment', average: 2, rated: 1, low: 1 }),
        expect.objectContaining({ label: 'Cleanliness', average: 2, rated: 1, low: 1 }),
        expect.objectContaining({ label: 'Trainers and staff', average: 5, rated: 1, low: 0 }),
      ]),
    );
    expect(view.soFar.mentions.length).toBeGreaterThan(0);
    expect(view.soFar.mentions.every((m) => !m.pattern)).toBe(true);
    expect(view.soFar.note).toMatch(/single mentions/);

    // Nothing historical: no direction, no change, no comparison.
    expect(view.facts[0]).toMatchObject({ label: 'Overall direction', value: 'Too early to say' });
    expect(view.changed).toEqual([]);
    expect(view.changedNote).toMatch(/two check-ins/);
    expect(view.loved).toEqual([]);
    expect(view.unhappy).toEqual([]);
    expect(view.actions).toEqual([]);

    const analysis = await getAnalysisView(db, clientId);
    expect(analysis?.better).toEqual([]);
    expect(analysis?.worse).toEqual([]);
    expect(analysis?.recurrenceNote).toMatch(/No check-in/);
    expect(analysis?.soFar.mentions.length).toBeGreaterThan(0);

    const improvements = await getImprovementsView(db, clientId);
    expect(improvements?.checked).toEqual([]);
    expect(improvements?.record).toBe('No change has been agreed yet.');

    const checkin = await getCheckinView(db, clientId);
    expect(checkin?.movementLine).toMatch(/two check-ins/);
    expect(checkin?.better).toEqual([]);
    expect(checkin?.worse).toEqual([]);

    const bundle = await getResponsibility(db, clientId);
    expect(bundle?.responsibility.answer).not.toBe('Nothing to decide yet.');
    expect(bundle?.responsibility.answerDetail).not.toMatch(/reading them now|waiting/);

    const reviews = await getReviewsView(db, clientId, filters());
    expect(reviews?.analysed).toBe(2);
    expect(reviews?.waiting).toBe(0);
    expect(reviews?.items.every((i) => i.state === 'ANALYSED')).toBe(true);
    expect(reviews?.items.every((i) => i.themes.length > 0 || i.sentimentLabel !== 'Not analysed')).toBe(true);
  });
});
