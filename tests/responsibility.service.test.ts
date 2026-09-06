import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { archiveClient, createClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { triageClientFeedback } from '@/lib/feedback/replies';
import { createSnapshot } from '@/lib/snapshots/service';
import { createActionFromInsight, decideAction, moveAction } from '@/lib/improve/service';
import { getClientIntelligence } from '@/lib/intelligence/service';
import {
  _resetGatewayThrottles,
  ensureGateway,
  setGatewayEnabled,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { feedbackSince, getResponsibility } from '@/lib/responsibility/service';
import { CAUSAL, INTERNALS } from '@/lib/portal/test-fixtures';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * THE RESPONSIBILITY LAYER ON A REAL DATABASE (M15).
 *
 * Feedback goes in through the real intake and the real feedback page, is
 * read by the real reader, and the responsibility state is asked for the way
 * the owner's Home asks for it. Nothing is mocked.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('responsibility-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');
const NOW = new Date('2026-06-01T12:00:00.000Z');
const text = (v: unknown) => JSON.stringify(v);

async function makeClient(businessName: string, vertical = 'clinic') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

/**
 * Pastes feedback and dates it, so the evidence sits where the test says it
 * does rather than at the wall clock the test happens to run under.
 */
async function paste(clientId: string, lines: string[], at: Date = REF) {
  const imported = await importFeedbackBatch(db, clientId, {
    raw: lines.join('\n'),
    source: 'PUBLIC_REVIEW',
    referenceDate: at,
  });
  if (!imported.ok) throw new Error(`import failed: ${imported.message}`);
  await db.reviewItem.updateMany({
    where: { clientId, reviewDate: null, source: 'PUBLIC_REVIEW' },
    data: { reviewDate: at },
  });
}

async function read(clientId: string) {
  const analysed = await analyseClientFeedback(db, clientId, { useAi: false, now: NOW });
  if (!analysed.ok) throw new Error('analysis failed');
  await triageClientFeedback(db, clientId, { now: NOW });
}

function waits(n: number, tag = 'w'): string[] {
  return Array.from({ length: n }, (_, i) => `1 star Waited over an hour past my appointment time (${tag}${i})`);
}

function praise(n: number, tag = 'p'): string[] {
  return Array.from({ length: n }, (_, i) => `5 stars The doctor explained everything patiently (${tag}${i})`);
}

async function responsibility(clientId: string) {
  const bundle = await getResponsibility(db, clientId, { now: NOW });
  if (!bundle) throw new Error('no bundle');
  return bundle.responsibility;
}

// ---------------------------------------------------------------------------

describe('from nothing to something', () => {
  it('an empty business is told there is nothing to decide, and nothing is invented', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    const r = await responsibility(id);
    expect(r.state).toBe('WAITING_FOR_EVIDENCE');
    expect(r.answer).toBe('Nothing to decide yet.');
    expect(r.needsYou).toEqual([]);
    expect(r.watching).toEqual([]);
    expect(r.did).toEqual([]);
    expect(text(r)).not.toMatch(INTERNALS);
  });

  it('one piece of feedback is still nothing to decide', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await paste(id, waits(1));
    await read(id);
    const r = await responsibility(id);
    expect(r.state).toBe('WAITING_FOR_EVIDENCE');
    expect(r.answer).toBe('Not enough feedback yet to say.');
    expect(r.needsYou).toEqual([]);
    expect(r.did[0]).toBe('Read 1 piece of feedback.');
  });

  it('unread feedback is reported as being read, never counted as read', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await paste(id, waits(4));
    const r = await responsibility(id);
    expect(r.state).toBe('WAITING_FOR_EVIDENCE');
    expect(r.answerDetail).toMatch(/^4 pieces of feedback have arrived and Headway is reading them now/);
    expect(r.did).toEqual(['4 pieces of feedback are being read now.']);
  });

  it('a clear complaint on enough feedback becomes the one thing to decide', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await paste(id, [...waits(6), ...praise(8)]);
    await read(id);
    const r = await responsibility(id);
    expect(r.state).toBe('DO_NOW');
    expect(r.needsYou[0]?.themeKey).toBe('wait_time');
    expect(r.needsYou[0]?.evidence).toMatchObject({ count: 6, outOf: 14 });
    expect(r.watching.find((i) => i.themeKey === 'doctor_care')?.state).toBe('KEEP_DOING');
    // What RepOS did, in the order it did it. The grouping line is the whole
    // reason the owner is paying rather than reading fourteen comments
    // themselves, and until M17 it was computed and never shown (M17).
    expect(r.did).toEqual([
      'Read 14 pieces of feedback.',
      'Grouped them into 2 things customers keep raising.',
      'Checked whether long waiting time keeps coming up across everything read.',
    ]);
  });
});

// ---------------------------------------------------------------------------

describe('the loop, end to end', () => {
  async function withAction(id: string) {
    const intel = await getClientIntelligence(db, id, { now: NOW });
    const insight = intel?.attention;
    if (!insight) throw new Error('no attention insight');
    const created = await createActionFromInsight(db, id, insight.id, { now: NOW });
    if (!created.ok) throw new Error(created.message);
    return created.data.id;
  }

  it('suggested → agreed → made → compared, each a different responsibility', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await paste(id, [...waits(6), ...praise(8)]);
    await read(id);
    const actionId = await withAction(id);

    // Suggested: still the owner's decision.
    let r = await responsibility(id);
    expect(r.state).toBe('DO_NOW');
    expect(r.needsYou[0]?.recommendedNextStep).toBe('Headway has suggested a change for this. It is waiting on your decision.');

    // Agreed: follow through.
    const agreed = await decideAction(
      db,
      id,
      actionId,
      { decision: 'ACCEPT', description: 'Cut evening bookings to five an hour', statusNote: '', recordMinute: false },
      { now: NOW },
    );
    if (!agreed.ok) throw new Error(agreed.message);
    r = await responsibility(id);
    expect(r.state).toBe('FOLLOW_UP');
    expect(r.needsYou[0]?.instruction).toBe('Finish the change you agreed');
    expect(r.needsYou[0]?.thread.find((s) => s.key === 'decided')).toMatchObject({ source: 'YOU', text: 'Cut evening bookings to five an hour' });

    // Made, with too little feedback after it: waiting, nothing needed.
    const done = await moveAction(db, id, actionId, { to: 'DONE', note: '', occurredAt: NOW }, { now: NOW });
    if (!done.ok) throw new Error(done.message);
    r = await responsibility(id);
    expect(r.state).toBe('CLEAR');
    expect(r.watching.find((i) => i.themeKey === 'wait_time')?.state).toBe('WAITING_FOR_EVIDENCE');
    expect(r.watching.find((i) => i.themeKey === 'wait_time')?.thread.find((s) => s.key === 'changed')?.source).toBe('YOU');
    expect(text(r)).not.toMatch(CAUSAL);
  });

  it('a declined suggestion is remembered as the owner\'s call and watched without nagging', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await paste(id, [...waits(6), ...praise(8)]);
    await read(id);
    const actionId = await withAction(id);
    const declined = await decideAction(
      db,
      id,
      actionId,
      { decision: 'DECLINE', description: '', statusNote: 'Not this quarter.', recordMinute: false },
      { now: NOW },
    );
    if (!declined.ok) throw new Error(declined.message);
    const r = await responsibility(id);
    expect(r.state).toBe('CLEAR');
    const item = r.watching.find((i) => i.themeKey === 'wait_time');
    expect(item?.state).toBe('WATCH');
    expect(item?.thread.find((s) => s.key === 'decided')?.text).toBe('Not to pursue this. Not this quarter.');
  });
});

// ---------------------------------------------------------------------------

describe('the feedback page feeds it', () => {
  it('counts what arrived through the QR, and changes the state only when the floors allow', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    const token = (await ensureGateway(db, id))!.publicToken;
    await paste(id, praise(8));
    await read(id);

    // Two private complaints: below the naming floor, so nothing to decide.
    for (let i = 0; i < 2; i += 1) {
      const sent = await submitCustomerFeedback(db, token, { stars: 1, text: `Waited over an hour past my appointment time (q${i})` }, { now: new Date(NOW.getTime() + i * 60_000) });
      expect(sent.ok).toBe(true);
    }
    await read(id);
    let r = await responsibility(id);
    expect(r.state).toBe('CLEAR');
    expect(r.needsYou).toEqual([]);
    expect(r.did[0]).toBe('Read 10 pieces of feedback — 2 of them sent through your feedback page.');

    // The third clears the floor: now it is the thing to decide.
    const third = await submitCustomerFeedback(db, token, { stars: 1, text: 'Waited over an hour past my appointment time (q2)' }, { now: new Date(NOW.getTime() + 180_000) });
    expect(third.ok).toBe(true);
    await read(id);
    r = await responsibility(id);
    expect(r.state).toBe('DO_NOW');
    expect(r.needsYou[0]?.themeKey).toBe('wait_time');
    expect(r.needsYou[0]?.evidence).toMatchObject({ count: 3, outOf: 11 });
    expect(r.did[0]).toBe('Read 11 pieces of feedback — 3 of them sent through your feedback page.');
  });

  it('a paused page is a stated limitation, and nothing else changes', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await ensureGateway(db, id);
    await paste(id, [...waits(6), ...praise(8)]);
    await read(id);
    const before = await responsibility(id);
    await setGatewayEnabled(db, id, false);
    const after = await responsibility(id);
    expect(after.limitations).toContain('Your feedback page is paused, so nothing new is arriving through the QR until it is switched back on.');
    expect(before.limitations).not.toContain('Your feedback page is paused, so nothing new is arriving through the QR until it is switched back on.');
    expect(after.state).toBe(before.state);
    expect(after.needsYou.map((i) => i.id)).toEqual(before.needsYou.map((i) => i.id));
  });

  it('counts "since the last check-in" from evidence dates, direct or pasted', () => {
    const since = new Date('2026-05-01T00:00:00.000Z');
    const rows = [
      { reviewDate: new Date('2026-04-30T00:00:00.000Z'), createdAt: new Date('2026-05-02T00:00:00.000Z'), analysisStatus: 'ANALYSED', analysisVersion: 99, source: 'PUBLIC_REVIEW' },
      { reviewDate: null, createdAt: new Date('2026-05-02T00:00:00.000Z'), analysisStatus: 'ANALYSED', analysisVersion: 99, source: 'REP_OS_QR' },
      { reviewDate: new Date('2026-05-03T00:00:00.000Z'), createdAt: new Date('2026-05-03T00:00:00.000Z'), analysisStatus: 'PENDING', analysisVersion: 0, source: 'REP_OS_QR' },
      { reviewDate: new Date('2026-05-04T00:00:00.000Z'), createdAt: new Date('2026-05-04T00:00:00.000Z'), analysisStatus: 'ANALYSED', analysisVersion: 99, source: 'PUBLIC_REVIEW' },
    ];
    expect(feedbackSince(rows, since)).toEqual({ total: 3, read: 2, unread: 1, direct: 1 });
    expect(feedbackSince(rows, null)).toEqual({ total: 4, read: 3, unread: 1, direct: 1 });
  });
});

// ---------------------------------------------------------------------------

describe('check-ins', () => {
  async function checkin(id: string, label: string, capturedAt: Date, reviews: string[]) {
    const result = await createSnapshot(
      db,
      id,
      {
        label,
        capturedAt,
        rating: 4.2,
        reviewCount: 120,
        unansweredCount: 10,
        daysSinceLastPost: 10,
        photoRecencyDays: 20,
        reviewsPerWeek: 1.5,
        profileGaps: [],
        observationNotes: '',
        reviewsRaw: reviews.join('\n'),
      },
      { useAi: false, now: capturedAt },
    );
    if (!result.ok) throw new Error(result.message);
    await db.reviewItem.updateMany({ where: { snapshotId: result.data.id, reviewDate: null }, data: { reviewDate: capturedAt } });
  }

  it('one check-in: "since" is said, and the second check-in is what comes next', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    const at = new Date('2026-04-01T00:00:00.000Z');
    await checkin(id, 'April', at, [...waits(5, 'a'), ...praise(7, 'b')]);
    await read(id);
    const r = await responsibility(id);
    expect(r.lastCheckinAt?.getTime()).toBe(at.getTime());
    expect(r.sinceLabel).toBe('Since your check-in on 01 Apr 2026');
    expect(r.did[0]).toBe('No new feedback has come in since your check-in on 01 Apr 2026.');
    expect(r.nextUsefulCheck).toMatch(/^A second check-in will show what changed/);
    expect(text(r)).not.toMatch(/held steady|holding steady/);
  });

  it('feedback after the check-in is what "since" counts', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await checkin(id, 'April', new Date('2026-04-01T00:00:00.000Z'), [...waits(5, 'a'), ...praise(7, 'b')]);
    await read(id);
    await paste(id, praise(3, 'c'), new Date('2026-05-20T00:00:00.000Z'));
    await read(id);
    const r = await responsibility(id);
    expect(r.did[0]).toBe('Since your check-in on 01 Apr 2026, read 3 pieces of feedback.');
    expect(r.did).toContain('Checked whether long waiting time is still coming up in the new feedback.');
  });
});

// ---------------------------------------------------------------------------

describe('isolation and honesty', () => {
  it('one business never sees another\'s themes, ids or words', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic');
    const cafe = await makeClient('Corner Cafe', 'restaurant');
    await paste(clinic, [...waits(6), ...praise(8)]);
    await paste(cafe, Array.from({ length: 8 }, (_, i) => `1 star Waited 40 minutes for the food, service was very slow (s${i})`));
    await paste(cafe, Array.from({ length: 6 }, (_, i) => `5 stars The biryani was excellent (b${i})`));
    await read(clinic);
    await read(cafe);

    const a = await responsibility(clinic);
    const b = await responsibility(cafe);
    expect(a.clientId).toBe(clinic);
    expect(b.clientId).toBe(cafe);
    expect(text(a)).not.toMatch(/Corner Cafe|service_speed|Slow service|biryani/i);
    expect(text(b)).not.toMatch(/Sunrise|wait_time|waiting time|doctor/i);
    expect(a.needsYou[0]?.themeKey).toBe('wait_time');
    expect(b.needsYou[0]?.themeKey).toBe('service_speed');
    expect(a.needsYou[0]?.id.startsWith(clinic)).toBe(true);
    expect(b.needsYou[0]?.id.startsWith(cafe)).toBe(true);
  });

  it('different businesses land in genuinely different states', async () => {
    const quiet = await makeClient('Glow Salon & Spa', 'salon');
    await paste(quiet, Array.from({ length: 12 }, (_, i) => `5 stars Loved the haircut, the stylist really listened (h${i})`));
    await read(quiet);
    const busy = await makeClient('Corner Cafe', 'restaurant');
    await paste(busy, Array.from({ length: 8 }, (_, i) => `1 star Waited 40 minutes for the food, service was very slow (s${i})`));
    await paste(busy, Array.from({ length: 6 }, (_, i) => `5 stars The biryani was excellent (b${i})`));
    await read(busy);
    const fresh = await makeClient('FitZone Gym', 'gym');

    const states = await Promise.all([quiet, busy, fresh].map((id) => responsibility(id).then((r) => r.state)));
    expect(states).toEqual(['CLEAR', 'DO_NOW', 'WAITING_FOR_EVIDENCE']);
  });

  it('an archived business still computes, and says it is inactive', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await paste(id, [...waits(6), ...praise(8)]);
    await read(id);
    await archiveClient(db, id, NOW);
    const r = await responsibility(id);
    expect(r.state).toBe('DO_NOW');
    expect(r.limitations).toContain('This account is no longer active, so Headway is not collecting anything new for it.');
  });

  it('returns nothing for a business that does not exist', async () => {
    expect(await getResponsibility(db, 'nope', { now: NOW })).toBeNull();
  });

  it('carries no personal detail a customer volunteered', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await paste(id, [...waits(6), ...praise(8), '1 star Call me on 98765 43210, rahul@example.com — waited an hour']);
    await read(id);
    const r = await responsibility(id);
    expect(text(r)).not.toMatch(/98765|example\.com|rahul/i);
  });
});
