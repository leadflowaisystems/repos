import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { getClientIntelligence } from '@/lib/intelligence/service';
import { getOwnerComms } from '@/lib/comms/service';
import { getBoard } from '@/lib/command/board';
import {
  createActionFromInsight,
  decideAction,
  getAction,
  listActionsWithProgress,
  measureClientAction,
  moveAction,
  recordLearning,
} from '@/lib/improve/service';
import { MIN_FEEDBACK_TO_MEASURE } from '@/lib/improve/measure';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('improve-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const BASELINE_AT = new Date('2026-02-10T00:00:00.000Z');
const AGREED = new Date('2026-03-01T00:00:00.000Z');
const CHANGED = new Date('2026-04-01T00:00:00.000Z');
const AFTER = new Date('2026-05-01T00:00:00.000Z');
const NOW = new Date('2026-06-01T00:00:00.000Z');
/** A later reading, for the tests that measure and then collect more. */
const LATER = new Date('2026-07-01T00:00:00.000Z');

async function makeClient(businessName: string, vertical = 'clinic') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

/**
 * Imports a batch, reads it, and dates it.
 *
 * The evidence date is what splits before from after, so the tests set it
 * explicitly rather than relying on when the row happened to be inserted.
 */
async function addFeedback(
  clientId: string,
  raw: string,
  evidenceAt: Date,
  /** When RepOS read it. Only matters when a test measures in between. */
  readAt: Date = NOW,
) {
  const seen = new Set(
    (await db.reviewItem.findMany({ where: { clientId }, select: { id: true } })).map(
      (row) => row.id,
    ),
  );

  const imported = await importFeedbackBatch(db, clientId, {
    raw,
    source: 'PUBLIC_REVIEW',
    referenceDate: evidenceAt,
  });
  if (!imported.ok) throw new Error(`import failed: ${imported.message}`);

  const analysed = await analyseClientFeedback(db, clientId, {
    useAi: false,
    now: readAt,
  });
  if (!analysed.ok) throw new Error('analysis failed');

  const fresh = (
    await db.reviewItem.findMany({ where: { clientId }, select: { id: true } })
  )
    .filter((row) => !seen.has(row.id))
    .map((row) => row.id);

  await db.reviewItem.updateMany({
    where: { id: { in: fresh } },
    data: { reviewDate: evidenceAt },
  });
}

function waitingComplaints(n: number, tag: string): string[] {
  return Array.from(
    { length: n },
    (_, i) => `1 star Waited over an hour past my appointment time (${tag}${i})`,
  );
}

function happyReviews(n: number, tag: string): string[] {
  return Array.from(
    { length: n },
    (_, i) => `5 stars The doctor explained everything clearly (${tag}${i})`,
  );
}

/** A clinic with a clear, repeated waiting-time complaint. */
async function clinicWithWaitingProblem(name = 'Sunrise Dental Clinic') {
  const id = await makeClient(name);
  await addFeedback(
    id,
    [...waitingComplaints(9, 'b'), ...happyReviews(21, 'b')].join('\n'),
    BASELINE_AT,
  );
  return id;
}

async function attentionInsightId(clientId: string) {
  const intel = await getClientIntelligence(db, clientId, { now: AGREED });
  const id = intel?.attention?.id;
  if (!id) throw new Error('no attention insight for that client');
  return id;
}

/** Creates the action, accepts it, and records it as done. */
async function runLoopToDone(clientId: string, decision: string) {
  const insightId = await attentionInsightId(clientId);

  const created = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
  if (!created.ok) throw new Error(`create failed: ${created.message}`);

  const decided = await decideAction(
    db,
    clientId,
    created.data.id,
    { decision: 'ACCEPT', description: decision, statusNote: '', recordMinute: true },
    { now: AGREED },
  );
  if (!decided.ok) throw new Error(`decide failed: ${decided.message}`);

  const done = await moveAction(
    db,
    clientId,
    created.data.id,
    { to: 'DONE', note: '', occurredAt: CHANGED },
    { now: NOW },
  );
  if (!done.ok) throw new Error(`done failed: ${done.message}`);

  return created.data.id;
}

// ---------------------------------------------------------------------------

describe('an action is created from an insight and freezes it', () => {
  it('carries the client, the insight, the evidence and the pack advice', async () => {
    const clientId = await clinicWithWaitingProblem();
    const insightId = await attentionInsightId(clientId);

    const created = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
    if (!created.ok) throw new Error(created.message);

    const action = await getAction(db, clientId, created.data.id);
    expect(action).not.toBeNull();
    expect(action?.clientId).toBe(clientId);
    expect(action?.provenance.insightId).toBe(insightId);
    expect(action?.provenance.themeKey).toBe('wait_time');
    expect(action?.status).toBe('RECOMMENDED');

    // The evidence trail resolves to this client's own feedback.
    const rows = await db.reviewItem.findMany({
      where: { id: { in: action?.baseline.itemIds ?? [] } },
      select: { clientId: true },
    });
    expect(rows.length).toBe(action?.baseline.count);
    expect(rows.every((row) => row.clientId === clientId)).toBe(true);

    // The pack's own advice, verbatim.
    expect(action?.provenance.recommendationText.length).toBeGreaterThan(10);
    expect(action?.baseline.total).toBe(30);
    expect(action?.baseline.capturedAt.toISOString()).toBe(AGREED.toISOString());
  });

  it('refuses an insight that is not in the current intelligence', async () => {
    const clientId = await clinicWithWaitingProblem();
    const result = await createActionFromInsight(db, clientId, `${clientId}:ATTENTION:nope`);
    expect(result.ok).toBe(false);
  });

  it('will not open two actions for the same insight', async () => {
    const clientId = await clinicWithWaitingProblem();
    const insightId = await attentionInsightId(clientId);

    const first = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
    expect(first.ok).toBe(true);
    const second = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
    expect(second.ok).toBe(false);
  });

  it('keeps the original baseline when more feedback arrives afterwards', async () => {
    const clientId = await clinicWithWaitingProblem();
    const insightId = await attentionInsightId(clientId);
    const created = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
    if (!created.ok) throw new Error(created.message);

    const before = await getAction(db, clientId, created.data.id);

    // A hundred glowing reviews later, the theme is a much smaller share...
    await addFeedback(clientId, happyReviews(40, 'later').join('\n'), AFTER);
    const intelNow = await getClientIntelligence(db, clientId, { now: NOW });
    expect(intelNow?.evidence.analysed).toBe(70);

    // ...and the action still says what it was based on at the time.
    const after = await getAction(db, clientId, created.data.id);
    expect(after?.baseline).toEqual(before?.baseline);
    expect(after?.baseline.total).toBe(30);
    expect(after?.provenance).toEqual(before?.provenance);
  });
});

// ---------------------------------------------------------------------------

describe('the human decision is recorded, and it is not the recommendation', () => {
  it('stores what the business actually decided, alongside what RepOS said', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(
      clientId,
      'Cut 6–8pm bookings to five an hour and add 15 minutes between slots',
    );

    const action = await getAction(db, clientId, actionId);
    expect(action?.description).toContain('Cut 6–8pm bookings');
    expect(action?.description).not.toBe(action?.provenance.recommendationText);
    expect(action?.provenance.recommendationText.length).toBeGreaterThan(10);
    expect(action?.decidedAt).not.toBeNull();
  });

  it('writes the decision into Minutes rather than a second memory system', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');

    const action = await getAction(db, clientId, actionId);
    expect(action?.minuteId).not.toBeNull();

    const minute = await db.minute.findUnique({ where: { id: action?.minuteId ?? '' } });
    expect(minute?.clientId).toBe(clientId);
    expect(minute?.category).toBe('DECISION');
    expect(minute?.body).toContain('Reduced evening bookings');
  });

  it('refuses to accept without saying what was decided', async () => {
    const clientId = await clinicWithWaitingProblem();
    const insightId = await attentionInsightId(clientId);
    const created = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
    if (!created.ok) throw new Error(created.message);

    const result = await decideAction(
      db,
      clientId,
      created.data.id,
      { decision: 'ACCEPT', description: '', statusNote: '', recordMinute: false },
      { now: AGREED },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.description).toBeTruthy();
  });

  it('records a decline with the reason, and leaves it there', async () => {
    const clientId = await clinicWithWaitingProblem();
    const insightId = await attentionInsightId(clientId);
    const created = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
    if (!created.ok) throw new Error(created.message);

    const declined = await decideAction(
      db,
      clientId,
      created.data.id,
      {
        decision: 'DECLINE',
        description: '',
        statusNote: 'Owner says evenings are their busiest hours.',
        recordMinute: false,
      },
      { now: AGREED },
    );
    expect(declined.ok).toBe(true);

    const action = await getAction(db, clientId, created.data.id);
    expect(action?.status).toBe('DECLINED');
    expect(action?.statusNote).toContain('busiest hours');

    // A declined action is final: it cannot be walked forward again.
    const reopened = await moveAction(
      db,
      clientId,
      created.data.id,
      { to: 'DONE', note: '', occurredAt: CHANGED },
      { now: NOW },
    );
    expect(reopened.ok).toBe(false);
  });

  it('refuses to skip the decision or measure something undone', async () => {
    const clientId = await clinicWithWaitingProblem();
    const insightId = await attentionInsightId(clientId);
    const created = await createActionFromInsight(db, clientId, insightId, { now: AGREED });
    if (!created.ok) throw new Error(created.message);

    const straightToDone = await moveAction(
      db,
      clientId,
      created.data.id,
      { to: 'DONE', note: '', occurredAt: CHANGED },
      { now: NOW },
    );
    expect(straightToDone.ok).toBe(false);

    const measured = await measureClientAction(db, clientId, created.data.id, { now: NOW });
    expect(measured.ok).toBe(false);
    if (!measured.ok) expect(measured.message).toMatch(/until the business says/i);
  });
});

// ---------------------------------------------------------------------------

describe('measurement uses feedback the operator brought in', () => {
  it('reports an improvement when complaints are a smaller share afterwards', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');

    // 30 new reviews, 2 of them still about waiting: 7% against 30%.
    await addFeedback(
      clientId,
      [...waitingComplaints(2, 'a'), ...happyReviews(28, 'a')].join('\n'),
      AFTER,
    );

    const result = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!result.ok) throw new Error(result.message);

    expect(result.data.measurement.result).toBe('IMPROVED');
    expect(result.data.measurement.before.total).toBe(30);
    expect(result.data.measurement.after.total).toBe(30);
    expect(result.data.measurement.headline).toMatch(/less often since the change/i);

    const action = await getAction(db, clientId, actionId);
    expect(action?.status).toBe('MEASURED');
    expect(action?.measurement?.result).toBe('IMPROVED');
  });

  it('reports a worsening when complaints are a larger share afterwards', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Added a second chair');

    await addFeedback(
      clientId,
      [...waitingComplaints(18, 'a'), ...happyReviews(12, 'a')].join('\n'),
      AFTER,
    );

    const result = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!result.ok) throw new Error(result.message);
    expect(result.data.measurement.result).toBe('WORSENED');
  });

  it('says there is no clear change when the share barely moves', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Put up a waiting-time sign');

    // 30% before, 30% after.
    await addFeedback(
      clientId,
      [...waitingComplaints(9, 'a'), ...happyReviews(21, 'a')].join('\n'),
      AFTER,
    );

    const result = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!result.ok) throw new Error(result.message);
    expect(result.data.measurement.result).toBe('NO_CLEAR_CHANGE');
  });

  it('refuses to judge on a handful of new reviews', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');

    await addFeedback(clientId, happyReviews(4, 'a').join('\n'), AFTER);

    const result = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!result.ok) throw new Error(result.message);
    expect(result.data.measurement.after.total).toBeLessThan(MIN_FEEDBACK_TO_MEASURE);
    expect(result.data.measurement.result).toBe('INSUFFICIENT_DATA');
    // The theme vanished, and RepOS still does not claim success.
    expect(result.data.measurement.after.count).toBe(0);
    expect(result.data.measurement.headline).toMatch(/not enough feedback yet/i);
  });

  it('says nothing at all when no new feedback has arrived', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');

    const result = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!result.ok) throw new Error(result.message);
    expect(result.data.measurement.result).toBe('INSUFFICIENT_DATA');
    expect(result.data.measurement.why.join(' ')).toMatch(/no new feedback/i);
  });

  it('re-measures once more feedback comes in, and keeps the newer verdict', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');

    await addFeedback(clientId, happyReviews(4, 'a').join('\n'), AFTER);
    const first = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!first.ok) throw new Error(first.message);
    expect(first.data.measurement.result).toBe('INSUFFICIENT_DATA');

    await addFeedback(
      clientId,
      [...waitingComplaints(2, 'c'), ...happyReviews(24, 'c')].join('\n'),
      AFTER,
    );
    const second = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!second.ok) throw new Error(second.message);
    expect(second.data.measurement.result).toBe('IMPROVED');

    const action = await getAction(db, clientId, actionId);
    expect(action?.measurement?.result).toBe('IMPROVED');
  });

  it('offers a re-measure only once something new has been read', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');
    await addFeedback(clientId, happyReviews(12, 'a').join('\n'), AFTER);
    await measureClientAction(db, clientId, actionId, { now: NOW });

    // Nothing has been read since the verdict, so measuring again would return
    // the same answer. RepOS does not offer it.
    const settled = await listActionsWithProgress(db, clientId);
    expect(settled[0]?.action.status).toBe('MEASURED');
    expect(settled[0]?.newFeedbackSinceMeasured).toBe(0);
    expect(settled[0]?.canMeasure).toBe(false);

    // More feedback arrives later, and the loop reopens.
    await addFeedback(clientId, happyReviews(12, 'c').join('\n'), AFTER, LATER);
    const reopened = await listActionsWithProgress(db, clientId);
    expect(reopened[0]?.newFeedbackSinceMeasured).toBe(12);
    expect(reopened[0]?.canMeasure).toBe(true);
  });

  it('only offers to measure once there is enough new feedback', async () => {
    const clientId = await clinicWithWaitingProblem();
    await runLoopToDone(clientId, 'Reduced evening bookings');

    const thin = await listActionsWithProgress(db, clientId);
    expect(thin[0]?.canMeasure).toBe(false);
    expect(thin[0]?.newFeedbackSinceDone).toBe(0);

    await addFeedback(clientId, happyReviews(12, 'a').join('\n'), AFTER);
    const ready = await listActionsWithProgress(db, clientId);
    expect(ready[0]?.newFeedbackSinceDone).toBe(12);
    expect(ready[0]?.canMeasure).toBe(true);
  });

  it('keeps the frozen verdict even after the feedback is re-read', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');
    await addFeedback(
      clientId,
      [...waitingComplaints(2, 'a'), ...happyReviews(28, 'a')].join('\n'),
      AFTER,
    );

    const measured = await measureClientAction(db, clientId, actionId, { now: NOW });
    if (!measured.ok) throw new Error(measured.message);
    const frozen = (await getAction(db, clientId, actionId))?.measurement;

    // Re-analysing every row does not touch a result already reported.
    await db.reviewItem.updateMany({
      where: { clientId },
      data: { analysisStatus: 'PENDING', analysisVersion: 0 },
    });
    const after = (await getAction(db, clientId, actionId))?.measurement;
    expect(after).toEqual(frozen);
  });
});

// ---------------------------------------------------------------------------

describe('what the operator concluded stays their own', () => {
  it('stores the learning note apart from the measured evidence', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');
    await addFeedback(
      clientId,
      [...waitingComplaints(2, 'a'), ...happyReviews(28, 'a')].join('\n'),
      AFTER,
    );
    await measureClientAction(db, clientId, actionId, { now: NOW });

    const saved = await recordLearning(
      db,
      clientId,
      actionId,
      { note: 'Owner thinks the evening cut did it, but Saturdays are still bad.' },
      { now: NOW },
    );
    expect(saved.ok).toBe(true);

    const action = await getAction(db, clientId, actionId);
    expect(action?.learningNote).toContain('Saturdays are still bad');
    expect(action?.learningAt).not.toBeNull();

    // It is nowhere in the customer evidence.
    expect(JSON.stringify(action?.measurement)).not.toContain('Saturdays');
    expect(action?.measurement?.headline).not.toContain('Owner thinks');
  });

  it('leaves an old note alone when the action is measured again', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');
    await addFeedback(clientId, happyReviews(12, 'a').join('\n'), AFTER);
    await measureClientAction(db, clientId, actionId, { now: NOW });
    await recordLearning(db, clientId, actionId, { note: 'Looks better.' }, { now: NOW });

    await addFeedback(clientId, waitingComplaints(12, 'c').join('\n'), AFTER);
    await measureClientAction(db, clientId, actionId, { now: NOW });

    const action = await getAction(db, clientId, actionId);
    expect(action?.learningNote).toBe('Looks better.');
  });
});

// ---------------------------------------------------------------------------

describe('one client can never reach another client\'s actions', () => {
  it('refuses to read or change an action through the wrong client', async () => {
    const a = await clinicWithWaitingProblem('Sunrise Dental Clinic');
    const b = await makeClient('Glow Salon & Spa', 'salon');
    const actionId = await runLoopToDone(a, 'Reduced evening bookings');

    expect(await getAction(db, b, actionId)).toBeNull();

    const moved = await moveAction(
      db,
      b,
      actionId,
      { to: 'ACCEPTED', note: '', occurredAt: null },
      { now: NOW },
    );
    expect(moved.ok).toBe(false);

    const measured = await measureClientAction(db, b, actionId, { now: NOW });
    expect(measured.ok).toBe(false);

    const learned = await recordLearning(db, b, actionId, { note: 'x' }, { now: NOW });
    expect(learned.ok).toBe(false);

    // ...and it is untouched.
    const action = await getAction(db, a, actionId);
    expect(action?.status).toBe('DONE');
    expect(action?.learningNote).toBe('');
  });

  it('never measures one client against another client\'s feedback', async () => {
    const a = await clinicWithWaitingProblem('Sunrise Dental Clinic');
    const actionId = await runLoopToDone(a, 'Reduced evening bookings');

    const b = await makeClient('Second Clinic', 'clinic');
    await addFeedback(b, waitingComplaints(40, 'other').join('\n'), AFTER);

    const result = await measureClientAction(db, a, actionId, { now: NOW });
    if (!result.ok) throw new Error(result.message);
    // The other client's forty complaints are nowhere in this.
    expect(result.data.measurement.after.total).toBe(0);
    expect(result.data.measurement.result).toBe('INSUFFICIENT_DATA');
  });

  it('lists only this client\'s actions', async () => {
    const a = await clinicWithWaitingProblem('Sunrise Dental Clinic');
    const b = await clinicWithWaitingProblem('Second Clinic');
    await runLoopToDone(a, 'A change');
    await runLoopToDone(b, 'B change');

    const aList = await listActionsWithProgress(db, a);
    const bList = await listActionsWithProgress(db, b);
    expect(aList.length).toBe(1);
    expect(bList.length).toBe(1);
    expect(aList[0]?.action.description).toBe('A change');
    expect(bList[0]?.action.description).toBe('B change');
  });
});

// ---------------------------------------------------------------------------

describe('the same loop works for every vertical', () => {
  const cases: Array<{
    vertical: string;
    name: string;
    complaint: (tag: string, i: number) => string;
    praise: (tag: string, i: number) => string;
  }> = [
    {
      vertical: 'salon',
      name: 'Glow Salon & Spa',
      complaint: (tag, i) =>
        `1 star The haircut was not what I asked for at all, ${tag} visit ${i}`,
      praise: (tag, i) =>
        `5 stars The stylist was friendly and the salon was spotless, ${tag} visit ${i}`,
    },
    {
      vertical: 'restaurant',
      name: 'Corner Cafe',
      complaint: (tag, i) =>
        `1 star We waited far too long for our food and the service was very slow, ${tag} visit ${i}`,
      praise: (tag, i) => `5 stars The food was delicious and fresh, ${tag} visit ${i}`,
    },
  ];

  for (const { vertical, name, complaint, praise } of cases) {
    it(`runs the whole loop for a ${vertical}`, async () => {
      const clientId = await makeClient(name, vertical);

      // Each batch is worded distinctly, because RepOS de-duplicates identical
      // feedback within a client — as it should.
      const lines = (
        make: (tag: string, i: number) => string,
        n: number,
        tag: string,
      ) => Array.from({ length: n }, (_, i) => make(tag, i));

      await addFeedback(
        clientId,
        [...lines(complaint, 9, 'first'), ...lines(praise, 21, 'first')].join('\n'),
        BASELINE_AT,
      );

      const actionId = await runLoopToDone(clientId, `A ${vertical} change`);

      await addFeedback(clientId, lines(praise, 30, 'later').join('\n'), AFTER);

      const result = await measureClientAction(db, clientId, actionId, { now: NOW });
      if (!result.ok) throw new Error(result.message);
      expect(result.data.measurement.result).toBe('IMPROVED');
      expect(result.data.measurement.after.total).toBe(30);

      const action = await getAction(db, clientId, actionId);
      // Advice came from that vertical's own pack, not from a branch in code.
      expect(action?.provenance.recommendationText.length).toBeGreaterThan(10);
    });
  }
});

// ---------------------------------------------------------------------------

describe('the rest of RepOS knows about the loop', () => {
  it('never lets an owner update claim a result before it is measured', async () => {
    const clientId = await clinicWithWaitingProblem();
    await runLoopToDone(clientId, 'Reduced evening bookings to five an hour');

    const comms = await getOwnerComms(db, clientId, { now: NOW });
    if (!comms.ok) throw new Error('comms failed');

    const update = comms.data.messages.find((m) => m.type === 'OWNER_UPDATE');
    expect(update?.body).toContain('Reduced evening bookings');
    expect(update?.body).toMatch(/do not have enough new feedback yet/i);
    expect(update?.body).not.toMatch(/improved|worked|better since/i);
    expect(update?.blocked).toBe(false);
  });

  it('does not block the message over numbers the operator typed themselves', async () => {
    const clientId = await clinicWithWaitingProblem();
    // The decision names times and quantities. They are the operator's words,
    // not a statistic RepOS is claiming, so the message must still be sendable.
    await runLoopToDone(clientId, 'Cut 6-8pm bookings to 5 an hour, 15 minutes apart');

    const comms = await getOwnerComms(db, clientId, { now: NOW });
    if (!comms.ok) throw new Error('comms failed');
    const update = comms.data.messages.find((m) => m.type === 'OWNER_UPDATE');

    expect(update?.blocked).toBe(false);
    expect(update?.body).toContain('Cut 6-8pm bookings to 5 an hour');
  });

  it('tells the owner the before and after once it is measured', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');
    await addFeedback(
      clientId,
      [...waitingComplaints(2, 'a'), ...happyReviews(28, 'a')].join('\n'),
      AFTER,
    );
    await measureClientAction(db, clientId, actionId, { now: NOW });

    const comms = await getOwnerComms(db, clientId, { now: NOW });
    if (!comms.ok) throw new Error('comms failed');
    const update = comms.data.messages.find((m) => m.type === 'OWNER_UPDATE');

    expect(update?.body).toContain('9 of 30 reviews');
    expect(update?.body).toContain('2 of 30 reviews');
    expect(update?.body).toMatch(/since the change/i);
    // Never a causal claim, and never blocked by the numeric guard.
    expect(update?.body).not.toMatch(/\bcaused\b|\bproved\b|thanks to/i);
    expect(update?.blocked).toBe(false);
  });

  it('puts a decision waiting on the business onto the command centre', async () => {
    const clientId = await clinicWithWaitingProblem();
    const insightId = await attentionInsightId(clientId);
    await createActionFromInsight(db, clientId, insightId, { now: AGREED });

    const board = await getBoard(db, NOW);
    const card = board.cards.find((c) => c.clientId === clientId);
    expect(card?.actions.awaitingDecision).toBe(1);
    expect(card?.signals.map((s) => s.key)).toContain('action_awaiting_decision');
  });

  it('asks the operator to measure once there is enough new feedback', async () => {
    const clientId = await clinicWithWaitingProblem();
    await runLoopToDone(clientId, 'Reduced evening bookings');

    const waiting = await getBoard(db, NOW);
    const before = waiting.cards.find((c) => c.clientId === clientId);
    expect(before?.actions.awaitingEvidence).toBe(1);
    expect(before?.actions.readyToMeasure).toBe(0);

    await addFeedback(clientId, happyReviews(12, 'a').join('\n'), AFTER);

    const ready = await getBoard(db, NOW);
    const card = ready.cards.find((c) => c.clientId === clientId);
    expect(card?.actions.readyToMeasure).toBe(1);
    expect(card?.signals.map((s) => s.key)).toContain('action_ready_to_measure');
    expect(card?.nextAction.key).toBe('MEASURE_ACTION');
    expect(card?.nextAction.href).toBe(`/clients/${clientId}#actions`);
  });

  it('shows the last measured result on the card', async () => {
    const clientId = await clinicWithWaitingProblem();
    const actionId = await runLoopToDone(clientId, 'Reduced evening bookings');
    await addFeedback(
      clientId,
      [...waitingComplaints(2, 'a'), ...happyReviews(28, 'a')].join('\n'),
      AFTER,
    );
    await measureClientAction(db, clientId, actionId, { now: NOW });

    const board = await getBoard(db, NOW);
    const card = board.cards.find((c) => c.clientId === clientId);
    expect(card?.actions.lastResult?.themeLabel).toBe('Long waiting time');
    // Observational wording only: the label says what the feedback did after
    // the change, never that the change worked.
    expect(card?.actions.lastResult?.label).toBe('Mentioned less often after the change');
    expect(card?.actions.lastResult?.label).not.toMatch(/improved|worse|fixed/i);
  });
});
