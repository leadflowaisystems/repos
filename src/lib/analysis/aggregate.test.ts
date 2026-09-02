import { describe, expect, it } from 'vitest';
import { getPackOrFallback, _resetPackCache } from '@/lib/packs';
import { classifyByKeywords } from './classify';
import {
  aggregate,
  evidenceTier,
  MIN_MENTIONS_FOR_THEME,
  TIER_LIMITED_MIN,
  TIER_STANDARD_MIN,
  toPreviousSummary,
  type AggregateInput,
  type ClassifiedReview,
  type SnapshotObservation,
} from './aggregate';

_resetPackCache();
const pack = getPackOrFallback('clinic');
const CAPTURED = new Date('2026-03-15T00:00:00.000Z');
const NOW = new Date('2026-03-15T10:00:00.000Z');

function review(text: string, stars: number | null = null): ClassifiedReview {
  const c = classifyByKeywords(text, stars, pack);
  return {
    text,
    stars,
    reviewDate: null,
    language: 'en',
    sentiment: c.sentiment,
    issueTags: c.issueTags,
    praiseTags: c.praiseTags,
  };
}

/** n reviews complaining about waiting time. */
function waitReviews(n: number, stars: number | null = 2): ClassifiedReview[] {
  return Array.from({ length: n }, () =>
    review("The waiting time here was far too long today", stars),
  );
}

/** n neutral-ish praise reviews, used as filler to reach an evidence tier. */
function fillerReviews(n: number): ClassifiedReview[] {
  return Array.from({ length: n }, () =>
    review('The doctor explained everything and the clinic was clean', 5),
  );
}

const baseSnapshot: SnapshotObservation = {
  capturedAt: CAPTURED,
  rating: 4.2,
  reviewCount: 180,
  unansweredCount: 12,
  daysSinceLastPost: 45,
  photoRecencyDays: 120,
  reviewsPerWeek: 1.5,
  profileGaps: ['hours_missing'],
};

function run(overrides: Partial<AggregateInput> = {}) {
  return aggregate({
    pack,
    snapshot: baseSnapshot,
    reviews: [],
    competitors: [],
    baseline: null,
    previous: null,
    now: NOW,
    ...overrides,
  });
}

describe('evidenceTier', () => {
  it('maps counts to the documented tiers', () => {
    expect(evidenceTier(0)).toBe('INSUFFICIENT');
    expect(evidenceTier(TIER_LIMITED_MIN - 1)).toBe('INSUFFICIENT');
    expect(evidenceTier(TIER_LIMITED_MIN)).toBe('LIMITED');
    expect(evidenceTier(TIER_STANDARD_MIN - 1)).toBe('LIMITED');
    expect(evidenceTier(TIER_STANDARD_MIN)).toBe('STANDARD');
  });
});

describe('evidence rules — under 10 reviews', () => {
  const result = run({ reviews: [...waitReviews(5), ...fillerReviews(3)] });

  it('refuses to claim any theme', () => {
    expect(result.evidence.tier).toBe('INSUFFICIENT');
    expect(result.evidence.canClaimThemes).toBe(false);
    expect(result.issues.every((t) => t.qualifies === false)).toBe(true);
  });

  it('withholds percentages entirely', () => {
    expect(result.issues.every((t) => t.share === null)).toBe(true);
  });

  it('says so explicitly rather than staying silent', () => {
    expect(result.evidence.statement).toContain('below the 10-review floor');
  });

  it('falls back to an operational recommendation, not an invented pattern', () => {
    expect(result.recommendation.source).toBe('OPERATIONAL');
    expect(result.recommendation.issueKey).toBeNull();
    expect(result.recommendation.confidence).toBe('INSUFFICIENT');
  });
});

describe('evidence rules — 10 to 24 reviews', () => {
  const result = run({ reviews: [...waitReviews(4), ...fillerReviews(8)] });

  it('reaches LIMITED and allows themes at 3+ mentions', () => {
    expect(result.evidence.tier).toBe('LIMITED');
    const wait = result.issues.find((t) => t.key === 'wait_time');
    expect(wait?.count).toBe(4);
    expect(wait?.qualifies).toBe(true);
  });

  it('does not qualify a theme with fewer than 3 mentions', () => {
    const r = run({ reviews: [...waitReviews(2), ...fillerReviews(10)] });
    const wait = r.issues.find((t) => t.key === 'wait_time');
    expect(wait?.count).toBe(2);
    expect(wait?.qualifies).toBe(false);
  });

  it('recommends the qualifying issue with a low-evidence caveat', () => {
    expect(result.recommendation.source).toBe('PULSE');
    expect(result.recommendation.issueKey).toBe('wait_time');
    expect(result.recommendation.caveat).toContain('not enough to call a trend');
  });

  it('blocks theme trend claims even when a previous snapshot exists', () => {
    const previousResult = run({ reviews: [...waitReviews(3), ...fillerReviews(9)] });
    const previous = toPreviousSummary(
      'prev1',
      'Feb',
      new Date('2026-02-15T00:00:00.000Z'),
      baseSnapshot,
      previousResult,
    );
    const withHistory = run({
      reviews: [...waitReviews(4), ...fillerReviews(8)],
      previous,
    });
    expect(withHistory.comparison?.themeTrendAllowed).toBe(false);
    expect(withHistory.comparison?.issueDeltas).toHaveLength(0);
    expect(withHistory.evidence.canClaimTrend).toBe(false);
    expect(withHistory.comparison?.themeTrendBlockedReason).toContain('25+');
  });

  it('still reports directly observed metric deltas, which are not sample-derived', () => {
    const previousResult = run({ reviews: fillerReviews(12) });
    const previous = toPreviousSummary(
      'prev1',
      'Feb',
      new Date('2026-02-15T00:00:00.000Z'),
      { ...baseSnapshot, rating: 4.0, reviewCount: 160 },
      previousResult,
    );
    const withHistory = run({ reviews: fillerReviews(12), previous });
    const rating = withHistory.comparison?.metrics.find((m) => m.key === 'rating');
    expect(rating?.delta).toBe(0.2);
    const count = withHistory.comparison?.metrics.find((m) => m.key === 'reviewCount');
    expect(count?.delta).toBe(20);
  });
});

describe('evidence rules — 25+ reviews', () => {
  const reviews = [...waitReviews(8), ...fillerReviews(20)];
  const result = run({ reviews });

  it('reaches STANDARD and computes shares from real counts', () => {
    expect(result.evidence.tier).toBe('STANDARD');
    const wait = result.issues.find((t) => t.key === 'wait_time');
    expect(wait?.count).toBe(8);
    expect(wait?.share).toBeCloseTo(8 / 28, 4);
  });

  it('allows theme trend claims only against comparable history', () => {
    const previousResult = run({ reviews: [...waitReviews(2), ...fillerReviews(24)] });
    const previous = toPreviousSummary(
      'prev1',
      'Feb',
      new Date('2026-02-15T00:00:00.000Z'),
      baseSnapshot,
      previousResult,
    );
    const withHistory = run({ reviews, previous });
    expect(withHistory.comparison?.themeTrendAllowed).toBe(true);
    const delta = withHistory.comparison?.issueDeltas.find((d) => d.key === 'wait_time');
    expect(delta).toEqual({
      key: 'wait_time',
      label: 'Long waiting time',
      now: 8,
      then: 2,
      delta: 6,
    });
  });

  it('blocks the trend when the previous snapshot is too thin', () => {
    const previousResult = run({ reviews: [...waitReviews(2), ...fillerReviews(6)] });
    const previous = toPreviousSummary(
      'prev1',
      'Feb',
      new Date('2026-02-15T00:00:00.000Z'),
      baseSnapshot,
      previousResult,
    );
    const withHistory = run({ reviews, previous });
    expect(withHistory.comparison?.themeTrendAllowed).toBe(false);
    expect(withHistory.comparison?.themeTrendBlockedReason).toContain('previous snapshot');
  });
});

describe('emerging vs watch item', () => {
  it('calls an emerging issue only with comparable history', () => {
    const previousResult = run({ reviews: fillerReviews(30) });
    const previous = toPreviousSummary(
      'prev1',
      'Feb',
      new Date('2026-02-15T00:00:00.000Z'),
      baseSnapshot,
      previousResult,
    );
    const result = run({
      reviews: [...waitReviews(5), ...fillerReviews(25)],
      previous,
    });
    expect(result.emerging.kind).toBe('EMERGING');
    expect(result.emerging.key).toBe('wait_time');
    expect(result.emerging.previousCount).toBe(0);
  });

  it('downgrades to a watch item when the mention count is below the floor', () => {
    const result = run({ reviews: [...waitReviews(2), ...fillerReviews(20)] });
    expect(result.emerging.kind).toBe('WATCH');
    expect(result.emerging.statement).toContain('not being called a pattern');
  });

  it('explains the absence of history on a first snapshot', () => {
    const result = run({ reviews: fillerReviews(30) });
    expect(result.emerging.kind).toBe('NONE');
    expect(result.emerging.statement).toContain('first snapshot');
  });
});

describe('never fabricates missing data', () => {
  it('reports an unobserved response gap as unobserved', () => {
    const result = run({
      snapshot: { ...baseSnapshot, unansweredCount: null },
      reviews: fillerReviews(30),
    });
    expect(result.responseGap.observed).toBe(false);
    expect(result.responseGap.share).toBeNull();
    expect(result.responseGap.statement).toContain('not observed');
  });

  it('lists every missing observation explicitly', () => {
    const result = run({
      snapshot: {
        capturedAt: CAPTURED,
        rating: null,
        reviewCount: null,
        unansweredCount: null,
        daysSinceLastPost: null,
        photoRecencyDays: null,
        reviewsPerWeek: null,
        profileGaps: [],
      },
    });
    expect(result.dataGaps).toContain('Business rating was not entered.');
    expect(result.dataGaps).toContain('Total review count was not entered.');
    expect(result.dataGaps).toContain('No competitor values were entered.');
  });

  it('produces no star distribution when no ratings were supplied', () => {
    const result = run({ reviews: [review('Long wait at reception', null)] });
    expect(result.starDistribution).toBeNull();
    expect(result.averageStarsInSample).toBeNull();
  });

  it('says nothing about competitors that were not entered', () => {
    expect(run().competitorSummary).toContain('No competitor values');
  });
});

describe('competitor comparison', () => {
  it('compares against the strongest entered competitor only', () => {
    const result = run({
      reviews: fillerReviews(30),
      competitors: [
        { name: 'Alpha Clinic', rating: 4.6, reviewCount: 300 },
        { name: 'Beta Clinic', rating: 3.9, reviewCount: 90 },
      ],
    });
    expect(result.competitorSummary).toContain('0.4 behind');
    expect(result.competitorSummary).toContain('Alpha Clinic');
    expect(result.competitors[0]?.ratingDelta).toBeCloseTo(-0.4, 2);
  });

  it('skips the comparison when competitor ratings are blank', () => {
    const result = run({
      competitors: [{ name: 'Alpha Clinic', rating: null, reviewCount: null }],
    });
    expect(result.competitorSummary).toContain('no ratings were entered');
  });
});

describe('the one recommended action', () => {
  it('is deterministic for identical input', () => {
    const reviews = [...waitReviews(6), ...fillerReviews(20)];
    expect(JSON.stringify(run({ reviews }).recommendation)).toBe(
      JSON.stringify(run({ reviews }).recommendation),
    );
  });

  it('carries evidence containing only real counts', () => {
    const result = run({ reviews: [...waitReviews(6), ...fillerReviews(20)] });
    expect(result.recommendation.evidence[0]).toBe(
      '6 of 26 reviews analysed mention long waiting time (23%).',
    );
  });

  it('uses the pack action text for the selected issue', () => {
    const result = run({ reviews: [...waitReviews(6), ...fillerReviews(20)] });
    const packAction = pack.issueTaxonomy.find((t) => t.key === 'wait_time')?.action;
    expect(result.recommendation.action).toBe(packAction);
  });

  it('prefers the higher-severity issue when counts are close', () => {
    const result = run({
      reviews: [
        ...waitReviews(4),
        ...Array.from({ length: 4 }, () => review('Parking is very hard to find here', 3)),
        ...fillerReviews(20),
      ],
    });
    expect(result.recommendation.issueKey).toBe('wait_time');
  });
});

describe('tracking whether the previous action worked', () => {
  it('reports the outcome of the previous snapshot recommendation', () => {
    const previousResult = run({ reviews: [...waitReviews(9), ...fillerReviews(20)] });
    expect(previousResult.recommendation.issueKey).toBe('wait_time');

    const previous = toPreviousSummary(
      'prev1',
      'Feb',
      new Date('2026-02-15T00:00:00.000Z'),
      baseSnapshot,
      previousResult,
    );
    const now = run({ reviews: [...waitReviews(3), ...fillerReviews(25)], previous });

    expect(now.comparison?.previousActionOutcome).toMatchObject({
      issueKey: 'wait_time',
      then: 9,
      now: 3,
      delta: -6,
      verdict: 'IMPROVED',
    });
  });

  it('marks the outcome not comparable when the evidence is too thin', () => {
    const previousResult = run({ reviews: [...waitReviews(4), ...fillerReviews(8)] });
    const previous = toPreviousSummary(
      'prev1',
      'Feb',
      new Date('2026-02-15T00:00:00.000Z'),
      baseSnapshot,
      previousResult,
    );
    const now = run({ reviews: [...waitReviews(3), ...fillerReviews(9)], previous });
    expect(now.comparison?.previousActionOutcome?.verdict).toBe('NOT_COMPARABLE');
  });
});

describe('next-month checks', () => {
  it('always states what will be re-measured, with the current value', () => {
    const result = run({ reviews: [...waitReviews(6), ...fillerReviews(20)] });
    expect(result.nextMonthChecks[0]).toContain('Long waiting time');
    expect(result.nextMonthChecks.join(' ')).toContain('Rating — currently 4.2');
    expect(result.nextMonthChecks.length).toBeGreaterThanOrEqual(4);
  });

  it('says "not observed" instead of inventing a value', () => {
    const result = run({ snapshot: { ...baseSnapshot, rating: null } });
    expect(result.nextMonthChecks.join(' ')).toContain('Rating — not observed');
  });
});

describe('minimum-mention floor is exactly 3', () => {
  it('does not qualify at 2 and does qualify at 3', () => {
    const two = run({ reviews: [...waitReviews(2), ...fillerReviews(23)] });
    const three = run({ reviews: [...waitReviews(3), ...fillerReviews(22)] });
    expect(MIN_MENTIONS_FOR_THEME).toBe(3);
    expect(two.issues.find((t) => t.key === 'wait_time')?.qualifies).toBe(false);
    expect(three.issues.find((t) => t.key === 'wait_time')?.qualifies).toBe(true);
  });
});
