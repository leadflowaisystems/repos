import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { triageClientFeedback } from '@/lib/feedback/replies';
import { _resetGatewayThrottles, ensureGateway, submitCustomerFeedback } from '@/lib/gateway/service';
import type { StoredFeedback, StoredSnapshot } from '@/lib/health/health';
import { getEvidenceState, getImprovementsView, getPortalView } from '@/lib/portal/service';
import {
  AUTO_PERIOD_MIN_DAYS,
  AUTO_PERIOD_MIN_RESPONSES,
  automaticPeriods,
  isAutomaticPeriod,
  withAutomaticPeriods,
  type PeriodRow,
} from '@/lib/snapshots/periods';
import { createSnapshot, getClientHealth, listSnapshots, loadComparisonPeriods } from '@/lib/snapshots/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';
import { PRAISE_BANK, cycle, runLadder, spread, type Response } from './eval/ladder-scenarios';

/**
 * M50 — AUTOMATIC CHECK-INS (Oct 2026).
 *
 * A trend compares two check-ins, and only an operator could record one, so
 * real businesses never had a trend and their owners were told they were
 * "waiting for your first check-in". Headway now draws comparable periods from
 * the read feedback itself (`snapshots/periods.ts`): a period closes once it
 * holds 10 read responses collected over at least 7 days.
 *
 * These pin the rule, and then require that NOTHING about the comparison
 * changed: the same required cases give the same verdicts through automatic
 * periods as through operator check-ins (`tests/m45.trend-eval.test.ts`), the
 * health card keeps the operator's listing figures, and the operator's own
 * list of check-ins is untouched.
 */

const DAY = 86_400_000;
const T0 = new Date('2026-09-01T06:00:00.000Z');
const fb = (over: Partial<StoredFeedback> = {}): StoredFeedback => ({
  sentiment: 'POSITIVE',
  issueTags: [],
  praiseTags: [],
  stars: 5,
  reviewDate: null,
  ...over,
});
const rowAt = (i: number, at: Date): PeriodRow => ({ id: `r${String(i).padStart(3, '0')}`, createdAt: at, feedback: fb() });
const evenly = (n: number, days: number, start: Date = T0): PeriodRow[] =>
  Array.from({ length: n }, (_, i) => rowAt(i, new Date(start.getTime() + (n > 1 ? (i * days * DAY) / (n - 1) : 0))));

describe('the rule: ten read responses, over at least a week', () => {
  it('has the documented floors', () => {
    expect(AUTO_PERIOD_MIN_RESPONSES).toBe(10);
    expect(AUTO_PERIOD_MIN_DAYS).toBe(7);
  });

  it('closes nothing below ten responses, however long they took', () => {
    expect(automaticPeriods(evenly(9, 60))).toEqual([]);
  });

  it('closes nothing inside a week, however many arrive — a busy launch is one period, later', () => {
    expect(automaticPeriods(evenly(40, 6))).toEqual([]);
  });

  it('closes a period at the first response that gives it both', () => {
    const periods = automaticPeriods(evenly(10, 7));
    expect(periods).toHaveLength(1);
    expect(periods[0]!.feedback).toHaveLength(10);
    expect(periods[0]!.capturedAt.getTime()).toBe(T0.getTime() + 7 * DAY);
  });

  it('starts the next period after the last, and leaves the rest open', () => {
    // 25 over 21 days: closes at the 10th and the 20th; the last five wait.
    const periods = automaticPeriods(evenly(25, 21));
    expect(periods.map((p) => p.feedback.length)).toEqual([10, 10]);
  });

  it('keeps responses that share the closing moment together', () => {
    const rows = [...evenly(9, 6), rowAt(97, new Date(T0.getTime() + 8 * DAY)), rowAt(98, new Date(T0.getTime() + 8 * DAY)), rowAt(99, new Date(T0.getTime() + 8 * DAY))];
    const periods = automaticPeriods(rows);
    expect(periods).toHaveLength(1);
    expect(periods[0]!.feedback).toHaveLength(12);
  });

  it('does not depend on the order it is handed the rows in', () => {
    const rows = evenly(25, 21);
    const shuffled = [...rows].reverse();
    expect(automaticPeriods(shuffled).map((p) => p.id)).toEqual(automaticPeriods(rows).map((p) => p.id));
  });

  it('observes no public listing: every listing figure is unknown, never zero', () => {
    const [p] = automaticPeriods(evenly(10, 7));
    expect(p).toMatchObject({ label: null, rating: null, reviewCount: null, unansweredCount: null, reviewsPerWeek: null });
    expect(isAutomaticPeriod(p!)).toBe(true);
    expect(isAutomaticPeriod({ id: 'cm0operator' })).toBe(false);
  });
});

describe('operator check-ins stay boundaries, and stay theirs', () => {
  const operator = (id: string, at: Date): StoredSnapshot => ({
    id,
    label: 'Operator',
    capturedAt: at,
    rating: 4.4,
    reviewCount: 180,
    unansweredCount: 10,
    reviewsPerWeek: 1.5,
    daysSinceLastPost: 3,
    photoRecencyDays: 9,
    generatedAt: null,
    feedback: [fb(), fb()],
  });

  it('forms automatic periods only from what arrived after the latest operator check-in', () => {
    const op = operator('op1', new Date(T0.getTime() + 10 * DAY));
    const rows = evenly(30, 30).map((r) => ({ ...r, snapshotId: null as string | null }));
    const merged = withAutomaticPeriods([op], rows);
    const automatic = merged.filter(isAutomaticPeriod);
    // Every automatic period lies after the operator's check-in.
    expect(automatic.length).toBeGreaterThan(0);
    for (const p of automatic) expect(p.capturedAt.getTime()).toBeGreaterThan(op.capturedAt.getTime());
    // The operator's check-in is in the list, unchanged.
    expect(merged.find((s) => s.id === 'op1')).toBe(op);
    // Newest first, as loadHealthSnapshots returns them.
    expect(merged.map((s) => s.capturedAt.getTime())).toEqual([...merged.map((s) => s.capturedAt.getTime())].sort((a, b) => b - a));
  });

  it('never takes a response pasted into an operator check-in', () => {
    const rows = evenly(12, 10).map((r, i) => ({ ...r, snapshotId: i < 3 ? 'op1' : null }));
    const merged = withAutomaticPeriods([], rows);
    expect(merged.filter(isAutomaticPeriod)).toHaveLength(0); // nine left: below the floor
  });
});

// ---------------------------------------------------------------------------
// The trend math, through automatic periods
// ---------------------------------------------------------------------------

const SLOW: Response = { text: 'Service was very slow, we waited 40 minutes', stars: 1 };
const FILL: Response[] = PRAISE_BANK;

/** Two automatic periods of known composition: m1 of n1, then m2 of n2. */
function twoPeriods(m1: number, n1: number, m2: number, n2: number) {
  const before = spread([...cycle([SLOW], m1, 'a'), ...cycle(FILL, n1 - m1, 'b')], 7, new Date('2026-09-10T12:00:00.000Z'));
  const after = spread([...cycle([SLOW], m2, 'c'), ...cycle(FILL, n2 - m2, 'd')], 7, new Date('2026-09-25T12:00:00.000Z'));
  return runLadder([...before, ...after]);
}

function shelf(r: ReturnType<typeof runLadder>): 'WORSE' | 'BETTER' | 'STABLE' | 'NONE' {
  const t = r.improvements.trends;
  const on = (rows: Array<{ key: string }>) => rows.some((x) => x.key === 'service_speed');
  return on(t.worse) ? 'WORSE' : on(t.better) ? 'BETTER' : on(t.stable) ? 'STABLE' : 'NONE';
}

describe('the required trend cases give the same verdicts through automatic periods', () => {
  const cases: Array<[string, [number, number, number, number], 'WORSE' | 'BETTER' | 'STABLE' | 'NONE']> = [
    ['5/10 → 10/20 is stable: the same half of customers', [5, 10, 10, 20], 'STABLE'],
    ['5/10 → 15/20 is worse', [5, 10, 15, 20], 'WORSE'],
    ['15/20 → 5/20 is better', [15, 20, 5, 20], 'BETTER'],
    ['5/10 → 5/20 is better: half, then a quarter', [5, 10, 5, 20], 'BETTER'],
    ['0/10 → 1/20 is no trend: too few mentions', [0, 10, 1, 20], 'NONE'],
  ];
  for (const [name, [m1, n1, m2, n2], expected] of cases) {
    it(name, () => {
      const r = twoPeriods(m1, n1, m2, n2);
      expect(r.periods.map((p) => p.feedback.length)).toEqual([n2, n1]); // newest first
      expect(r.state.direction.state).toBe('READY');
      expect(shelf(r)).toBe(expected);
    });
  }

  it('1/5 → 2/20 is no trend: five responses never make a comparable period', () => {
    const before = spread([...cycle([SLOW], 1, 'a'), ...cycle(FILL, 4, 'b')], 7, new Date('2026-09-10T12:00:00.000Z'));
    const after = spread([...cycle([SLOW], 2, 'c'), ...cycle(FILL, 18, 'd')], 7, new Date('2026-09-25T12:00:00.000Z'));
    const r = runLadder([...before, ...after]);
    // The first five cannot close a period alone; with the next twenty they
    // make ONE period — the starting point — and there is nothing to compare.
    expect(r.periods).toHaveLength(1);
    expect(r.state.direction.state).toBe('BASELINE_SET');
    expect(r.improvements.trends.comparable).toBe(false);
    expect(shelf(r)).toBe('NONE');
  });

  it('compares shares, never raw counts: twice the mentions on twice the feedback is the same', () => {
    const r = twoPeriods(5, 10, 10, 20);
    const row = r.improvements.trends.stable.find((x) => x.key === 'service_speed');
    expect(row).toMatchObject({ previous: 5, previousTotal: 10, current: 10, currentTotal: 20, previousPct: 50, currentPct: 50 });
  });
});

// ---------------------------------------------------------------------------
// On a real database
// ---------------------------------------------------------------------------

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m50-automatic-periods');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db?.$disconnect();
});

const NOW = new Date('2026-10-01T12:00:00.000Z');

async function cafe(name = 'Periods Cafe (test)') {
  const created = await createClient(db, validClientInput({ businessName: name, vertical: 'restaurant' }));
  if (!created.ok) throw new Error(created.message);
  const id = created.data.id;
  const token = (await ensureGateway(db, id))!.publicToken;
  return { id, token };
}

async function submitAll(token: string, responses: Array<Response & { at: Date }>) {
  for (const r of responses) {
    _resetGatewayThrottles();
    const sent = await submitCustomerFeedback(db, token, { stars: r.stars, text: r.text }, { now: r.at });
    if (!sent.ok) throw new Error(sent.message);
  }
}

async function readAll(id: string) {
  const read = await analyseClientFeedback(db, id, { useAi: false, now: NOW, limit: 500 });
  if (!read.ok) throw new Error('analysis failed');
  await triageClientFeedback(db, id, { now: NOW });
}

describe('automatic check-ins on a real database', () => {
  it('a business nobody recorded a check-in for gets a trend from its own feedback', async () => {
    const { id, token } = await cafe();
    const before = spread([...cycle([SLOW], 2, 'a'), ...cycle(FILL, 10, 'b')], 7, new Date('2026-09-10T12:00:00.000Z'));
    const after = spread([...cycle([SLOW], 9, 'c'), ...cycle(FILL, 3, 'd')], 7, new Date('2026-09-25T12:00:00.000Z'));
    await submitAll(token, [...before, ...after] as Array<Response & { at: Date }>);
    await readAll(id);

    const periods = await loadComparisonPeriods(db, id);
    expect(periods.filter(isAutomaticPeriod).map((p) => p.feedback.length)).toEqual([12, 12]);
    // Nothing was written to make them.
    expect(await db.snapshot.count({ where: { clientId: id } })).toBe(0);

    const state = await getEvidenceState(db, id, { now: NOW });
    expect(state?.direction.state).toBe('READY');
    const improvements = await getImprovementsView(db, id, { now: NOW });
    expect(improvements?.trends.comparable).toBe(true);
    expect(improvements?.trends.worse.map((t) => t.key)).toContain('service_speed');
  });

  it('an operator check-in keeps its listing figures on the health card, and automatic periods follow it', async () => {
    const { id, token } = await cafe('Operator Cafe (test)');
    const at = new Date('2026-08-20T06:00:00.000Z');
    const snap = await createSnapshot(
      db,
      id,
      {
        label: 'August',
        capturedAt: at,
        rating: 4.2,
        reviewCount: 120,
        unansweredCount: 10,
        daysSinceLastPost: 10,
        photoRecencyDays: 20,
        reviewsPerWeek: 1.5,
        profileGaps: [],
        observationNotes: '',
        reviewsRaw: Array.from({ length: 12 }, (_, i) => `5 stars The food was delicious and fresh (o${i})`).join('\n'),
      },
      { useAi: false, now: at },
    );
    if (!snap.ok) throw new Error(snap.message);
    const after = spread(cycle(FILL, 24, 'q'), 20, new Date('2026-09-28T12:00:00.000Z'));
    await submitAll(token, after as Array<Response & { at: Date }>);
    await readAll(id);

    // The console's list is the operator's, unchanged.
    expect((await listSnapshots(db, id)).map((s) => s.label)).toEqual(['August']);
    // The health card still reports what the operator observed.
    const health = await getClientHealth(db, id, 'restaurant', NOW);
    expect(health.card.observed.rating).toBe(4.2);
    expect(health.card.latestSnapshotLabel).toBe('August');
    // The comparisons now run between the automatic periods after it.
    const periods = await loadComparisonPeriods(db, id);
    expect(periods[periods.length - 1]?.label).toBe('August');
    expect(periods.filter(isAutomaticPeriod).length).toBeGreaterThanOrEqual(2);
    expect(health.pulse.available).toBe(true);
    expect(isAutomaticPeriod({ id: health.pulse.current!.snapshotId })).toBe(true);

    // The owner's public rating fact still reads the operator's figure.
    const view = await getPortalView(db, id, { now: NOW });
    expect(view?.view.facts.find((f) => f.key === 'publicRating')?.value).toBe('4.2');
  });
});
