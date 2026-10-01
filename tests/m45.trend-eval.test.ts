import { describe, expect, it } from 'vitest';
import { compareShares, twoProportionZ, type ShareVerdict } from '@/lib/health/compare';
import { MIN_PERIOD_FEEDBACK_TO_COMPARE } from '@/lib/intelligence/engine';
import { measureAction, type MeasurableRow } from '@/lib/improve/measure';
import { getPackOrFallback } from '@/lib/packs';
import { runScenario } from './eval/trend-scenarios';

/**
 * M45 — TREND MATHEMATICS (intelligence quality pass, Sep 2026).
 *
 * Before this pass a topic's trend between two check-ins compared RAW mention
 * counts, so a check-in that simply held more feedback looked worse. Every
 * comparison now goes through one rule (health/compare.ts) on SHARES, and
 * this file holds it to the cases the audit required, at three levels:
 *
 *   1. the rule itself                      compareShares
 *   2. the whole chain an owner reads       check-ins → pulse → intelligence
 *                                           → portal view → Trends page shelf
 *   3. before/after measurement             measureAction
 *
 * No database, no clock, no provider.
 */

const cases: Array<{
  name: string;
  before: [number, number];
  after: [number, number];
  verdict: ShareVerdict;
  /** For a complaint: the Trends shelf the topic must land on. */
  shelf: 'WORSE' | 'BETTER' | 'STABLE' | 'NONE';
}> = [
  // The audit's required cases, verbatim.
  { name: '5/10 → 10/20 is the same half of customers', before: [5, 10], after: [10, 20], verdict: 'FLAT', shelf: 'STABLE' },
  { name: '5/10 → 15/20 is a larger share', before: [5, 10], after: [15, 20], verdict: 'ROSE', shelf: 'WORSE' },
  { name: '15/20 → 5/20 is a smaller share', before: [15, 20], after: [5, 20], verdict: 'FELL', shelf: 'BETTER' },
  { name: '5/10 → 5/20 is a smaller share, though the count is unchanged', before: [5, 10], after: [5, 20], verdict: 'FELL', shelf: 'BETTER' },
  { name: '0/10 → 1/20 is no trend at all', before: [0, 10], after: [1, 20], verdict: 'TOO_FEW_MENTIONS', shelf: 'NONE' },
  { name: '1/5 → 2/20 has too little feedback before to compare', before: [1, 5], after: [2, 20], verdict: 'TOO_THIN', shelf: 'NONE' },
  { name: '10/20 → 10/10 is not stable: everyone, up from half', before: [10, 20], after: [10, 10], verdict: 'ROSE', shelf: 'WORSE' },
  // The raw-count failures the audit proved, now read the right way round.
  { name: '10/20 → 12/40: more mentions, a smaller share', before: [10, 20], after: [12, 40], verdict: 'FELL', shelf: 'BETTER' },
  { name: '6/30 → 5/10: fewer mentions, a larger share', before: [6, 30], after: [5, 10], verdict: 'ROSE', shelf: 'WORSE' },
  { name: '3/3 → 5/5 is too little feedback on both sides', before: [3, 3], after: [5, 5], verdict: 'TOO_THIN', shelf: 'NONE' },
  // Moved, but not by enough on this much feedback to rule out chance.
  { name: '5/20 → 7/20 moved ten points on twenty: cannot tell yet', before: [5, 20], after: [7, 20], verdict: 'UNCLEAR', shelf: 'NONE' },
  { name: '3/10 → 5/10 moved twenty points on ten: cannot tell yet', before: [3, 10], after: [5, 10], verdict: 'UNCLEAR', shelf: 'NONE' },
  // Large denominators: small real moves are flat, larger ones are called.
  { name: '100/1000 → 120/1000 is under five points: flat', before: [100, 1000], after: [120, 1000], verdict: 'FLAT', shelf: 'STABLE' },
  { name: '100/1000 → 160/1000 is six points on a thousand: a direction', before: [100, 1000], after: [160, 1000], verdict: 'ROSE', shelf: 'WORSE' },
  // Everyone, both times; nobody... is absent (see below).
  { name: '10/10 → 20/20 is the same everyone', before: [10, 10], after: [20, 20], verdict: 'FLAT', shelf: 'STABLE' },
];

describe('the comparison rule: shares, both totals, a real move', () => {
  for (const c of cases) {
    it(c.name, () => {
      const got = compareShares(
        { count: c.before[0], total: c.before[1] },
        { count: c.after[0], total: c.after[1] },
      );
      expect(got.verdict).toBe(c.verdict);
    });
  }

  it('never divides by zero', () => {
    expect(compareShares({ count: 0, total: 0 }, { count: 0, total: 0 }).verdict).toBe('TOO_THIN');
    expect(compareShares({ count: 0, total: 0 }, { count: 5, total: 10 }).delta).toBeNull();
    expect(twoProportionZ({ count: 0, total: 10 }, { count: 0, total: 20 })).toBeNull();
    expect(twoProportionZ({ count: 10, total: 10 }, { count: 20, total: 20 })).toBeNull();
  });

  it('states the z-score it used, and it can be checked by hand', () => {
    // p1 = .5, p2 = .75, pooled = 20/30; se = sqrt(2/9 × 0.15) = 0.1826; z = 1.369
    const got = compareShares({ count: 5, total: 10 }, { count: 15, total: 20 });
    expect(got.before).toBe(0.5);
    expect(got.after).toBe(0.75);
    expect(got.delta).toBe(0.25);
    expect(got.z).toBeCloseTo(1.369, 3);
  });

  it('gives the same verdict whichever way round a period is read', () => {
    for (const c of cases) {
      const forward = compareShares({ count: c.before[0], total: c.before[1] }, { count: c.after[0], total: c.after[1] });
      const backward = compareShares({ count: c.after[0], total: c.after[1] }, { count: c.before[0], total: c.before[1] });
      const mirror: Record<ShareVerdict, ShareVerdict> = {
        ROSE: 'FELL', FELL: 'ROSE', FLAT: 'FLAT', UNCLEAR: 'UNCLEAR', TOO_THIN: 'TOO_THIN', TOO_FEW_MENTIONS: 'TOO_FEW_MENTIONS',
      };
      expect(backward.verdict, c.name).toBe(mirror[forward.verdict]);
    }
  });
});

describe('the Trends page an owner reads agrees with the rule', () => {
  for (const c of cases) {
    it(`${c.name} — a complaint lands on ${c.shelf}`, () => {
      const result = runScenario({
        previous: { mentions: c.before[0], total: c.before[1] },
        current: { mentions: c.after[0], total: c.after[1] },
      });
      expect(result.shelf).toBe(c.shelf);
    });
  }

  it('reads praise the other way: a larger share of praise is better news', () => {
    const rose = runScenario({ previous: { mentions: 5, total: 10 }, current: { mentions: 15, total: 20 }, kind: 'PRAISE' });
    expect(rose.state).toBe('IMPROVING');
    const same = runScenario({ previous: { mentions: 5, total: 10 }, current: { mentions: 10, total: 20 }, kind: 'PRAISE' });
    expect(same.state).toBe('STABLE');
  });

  it('says both totals and both shares in the sentence, so the arithmetic can be checked', () => {
    const result = runScenario({ previous: { mentions: 5, total: 10 }, current: { mentions: 10, total: 20 } });
    const insight = result.intelligence.unhappy.find((i) => i.themeKey === 'service_speed');
    expect(insight?.movement.pointNote).toMatch(/5 of 10 .*\(50%\), 10 of 20 .*\(50%\)\. About the same share/);
    expect(insight?.movement.countNote).toBe('5 of 10 → 10 of 20 · 50% → 50%');
  });

  it('never calls a theme absent from both check-ins steady', () => {
    const result = runScenario({ previous: { mentions: 0, total: 12 }, current: { mentions: 0, total: 15 }, since: { mentions: 6, total: 10 } });
    expect(result.state).toBe('INSUFFICIENT_DATA');
    expect(result.shelf).toBe('NONE');
  });

  it('needs ten pieces of feedback on each side before comparing at all', () => {
    expect(MIN_PERIOD_FEEDBACK_TO_COMPARE).toBe(10);
    const thin = runScenario({ previous: { mentions: 3, total: 9 }, current: { mentions: 9, total: 20 } });
    expect(thin.comparable).toBe(false);
    expect(thin.shelf).toBe('NONE');
  });
});

describe('before/after measurement uses the same rule, on unequal samples', () => {
  const clinic = getPackOrFallback('clinic');
  const AGREED = new Date(2026, 2, 1);
  const DONE = new Date(2026, 3, 1);
  const NOW = new Date(2026, 5, 1);
  const issue = clinic.issueTaxonomy.find((t) => t.key === 'wait_time')!;
  const rows = (count: number, withTheme: number): MeasurableRow[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `r-${i}`,
      analysisStatus: 'ANALYSED',
      evidenceAt: new Date(2026, 4, 1),
      themesJson: JSON.stringify(
        i < withTheme
          ? [{ key: 'wait_time', label: issue.label, kind: 'ISSUE', sentiment: 'NEGATIVE', severity: issue.severity }]
          : [],
      ),
    }));
  const measure = (before: [number, number], after: [number, number]) =>
    measureAction({
      pack: clinic,
      themeKey: 'wait_time',
      themeLabel: issue.label,
      sentiment: 'ISSUE',
      baseline: {
        count: before[0],
        total: before[1],
        itemIds: [],
        confidence: 'MODERATE',
        capturedAt: AGREED,
        snapshotId: null,
        snapshotLabel: null,
      },
      doneAt: DONE,
      rows: rows(after[1], after[0]),
      now: NOW,
    });

  it('5/10 before, 10/20 after: no clear change, not "worse"', () => {
    expect(measure([5, 10], [10, 20]).result).toBe('NO_CLEAR_CHANGE');
  });

  it('15/20 before, 5/20 after: improved', () => {
    expect(measure([15, 20], [5, 20]).result).toBe('IMPROVED');
  });

  it('10/20 before, 12/40 after: improved, though the count rose', () => {
    expect(measure([10, 20], [12, 40]).result).toBe('IMPROVED');
  });

  it('2/20 before, 0/20 after: too few mentions to call it improved', () => {
    const m = measure([2, 20], [0, 20]);
    expect(m.result).toBe('NO_CLEAR_CHANGE');
    expect(m.why.join(' ')).toMatch(/too few to call a change/);
  });

  it('5/20 before, 2/20 after: fifteen points on twenty is not enough to rule out chance', () => {
    const m = measure([5, 20], [2, 20]);
    expect(m.result).toBe('NO_CLEAR_CHANGE');
    expect(m.why.join(' ')).toMatch(/could still be chance/);
  });

  it('9 after is not enough to measure, whatever it shows', () => {
    expect(measure([9, 50], [0, 9]).result).toBe('INSUFFICIENT_DATA');
  });

  it('never words a result as a cause', () => {
    const m = measure([15, 20], [5, 20]);
    expect(m.limits.join(' ')).toMatch(/cannot prove|does not prove|not prove|cause/i);
  });
});
