import { describe, expect, it } from 'vitest';
import { getPackOrFallback, _resetPackCache } from '@/lib/packs';
import type { Sentiment } from '@/lib/analysis/classify';
import {
  computeHealthCard,
  computePulse,
  computeTrend,
  safeShare,
  summariseDistribution,
  summariseThemes,
  type StoredFeedback,
  type StoredSnapshot,
} from './health';
import {
  LOW_VELOCITY_PER_WEEK,
  MIN_FEEDBACK_FOR_SHARE_CLAIMS,
  MIN_FEEDBACK_FOR_TREND_CLAIMS,
  NEGATIVE_SHARE_ATTENTION,
  NEGATIVE_SHARE_WATCH,
  STALE_SNAPSHOT_ATTENTION_DAYS,
  STALE_SNAPSHOT_WATCH_DAYS,
  UNANSWERED_SHARE_ATTENTION,
} from './rules';

_resetPackCache();
const pack = getPackOrFallback('clinic');
const NOW = new Date('2026-03-15T00:00:00.000Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

function feedback(
  sentiment: Sentiment,
  issueTags: string[] = [],
  praiseTags: string[] = [],
): StoredFeedback {
  return { sentiment, issueTags, praiseTags, stars: null, reviewDate: null };
}

function many(
  n: number,
  sentiment: Sentiment,
  issueTags: string[] = [],
): StoredFeedback[] {
  return Array.from({ length: n }, () => feedback(sentiment, issueTags));
}

function snapshot(overrides: Partial<StoredSnapshot> = {}): StoredSnapshot {
  return {
    id: 'snap-current',
    label: 'March',
    capturedAt: daysAgo(1),
    rating: 4.4,
    reviewCount: 200,
    unansweredCount: 0,
    reviewsPerWeek: 2,
    daysSinceLastPost: 5,
    photoRecencyDays: 10,
    generatedAt: daysAgo(1),
    feedback: [],
    ...overrides,
  };
}

function card(snapshots: StoredSnapshot[]) {
  return computeHealthCard({ pack, snapshots, now: NOW });
}

function pulse(snapshots: StoredSnapshot[]) {
  return computePulse({ pack, snapshots, now: NOW });
}

// ---------------------------------------------------------------------------

describe('safeShare — zero-denominator handling', () => {
  it('returns null instead of dividing by zero', () => {
    expect(safeShare(3, 0)).toBeNull();
    expect(safeShare(0, 0)).toBeNull();
    expect(safeShare(3, -1)).toBeNull();
  });

  it('returns null when either side is missing', () => {
    expect(safeShare(null, 10)).toBeNull();
    expect(safeShare(3, null)).toBeNull();
  });

  it('computes a real share when both sides exist', () => {
    expect(safeShare(3, 12)).toBeCloseTo(0.25, 4);
    expect(safeShare(0, 12)).toBe(0);
  });
});

describe('summariseDistribution', () => {
  it('reports no shares at all when there is no feedback', () => {
    const d = summariseDistribution([]);
    expect(d.total).toBe(0);
    expect(d.shares).toBeNull();
    expect(d.reliable).toBe(false);
    expect(d.note).toBe('No feedback yet.');
  });

  it('counts every sentiment bucket', () => {
    const d = summariseDistribution([
      ...many(4, 'POSITIVE'),
      ...many(3, 'NEGATIVE'),
      ...many(2, 'MIXED'),
      ...many(1, 'NEUTRAL'),
    ]);
    expect(d.total).toBe(10);
    expect(d.counts).toEqual({
      POSITIVE: 4,
      NEGATIVE: 3,
      MIXED: 2,
      NEUTRAL: 1,
      UNKNOWN: 0,
    });
    expect(d.shares?.POSITIVE).toBeCloseTo(0.4, 4);
    expect(d.shares?.NEGATIVE).toBeCloseTo(0.3, 4);
  });

  it('marks a sample below the floor as unreliable but still reports counts', () => {
    const d = summariseDistribution(many(4, 'NEGATIVE'));
    expect(d.total).toBe(4);
    expect(d.reliable).toBe(false);
    expect(d.counts.NEGATIVE).toBe(4);
    expect(d.note).toContain(`below the ${MIN_FEEDBACK_FOR_SHARE_CLAIMS}`);
  });

  it('marks a sample at the floor as reliable', () => {
    expect(summariseDistribution(many(MIN_FEEDBACK_FOR_SHARE_CLAIMS, 'POSITIVE')).reliable).toBe(true);
  });
});

describe('summariseThemes', () => {
  it('counts tags and flags which reach the mention floor', () => {
    const themes = summariseThemes(
      [
        ...many(3, 'NEGATIVE', ['wait_time']),
        ...many(1, 'NEGATIVE', ['parking_access']),
      ],
      pack,
      'issues',
    );
    expect(themes.map((t) => [t.key, t.count, t.qualifies])).toEqual([
      ['wait_time', 3, true],
      ['parking_access', 1, false],
    ]);
  });

  it('returns nothing when there is no feedback', () => {
    expect(summariseThemes([], pack, 'issues')).toEqual([]);
    expect(summariseThemes([], pack, 'praises')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('status — insufficient data', () => {
  it('reports INSUFFICIENT_DATA with no snapshots at all', () => {
    const result = card([]);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.statusSummary).toContain('No snapshot has been taken yet');
    expect(result.distribution.total).toBe(0);
    expect(result.distribution.shares).toBeNull();
    expect(result.coverage.snapshotCount).toBe(0);
    expect(result.trend.direction).toBe('NONE');
  });

  it('reports INSUFFICIENT_DATA when the snapshot has no rating and no feedback', () => {
    const result = card([snapshot({ rating: null, feedback: [] })]);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.statusSummary).toContain('nothing to judge');
    expect(result.signals).toEqual([]);
  });

  it('becomes judgeable as soon as a rating alone is observed', () => {
    expect(card([snapshot({ rating: 4.4, feedback: [] })]).status).not.toBe(
      'INSUFFICIENT_DATA',
    );
  });

  it('becomes judgeable as soon as one piece of feedback exists', () => {
    expect(
      card([snapshot({ rating: null, feedback: many(1, 'POSITIVE') })]).status,
    ).not.toBe('INSUFFICIENT_DATA');
  });
});

describe('status — healthy', () => {
  const healthy = card([
    snapshot({ feedback: [...many(12, 'POSITIVE'), ...many(1, 'NEGATIVE')] }),
  ]);

  it('fires no signals', () => {
    expect(healthy.status).toBe('HEALTHY');
    expect(healthy.signals).toEqual([]);
  });

  it('explains what it checked instead of leaving the reason blank', () => {
    expect(healthy.statusSummary).toContain('13 stored feedback items');
  });
});

describe('status — watch', () => {
  it('fires on a negative share at the watch threshold', () => {
    const result = card([
      snapshot({ feedback: [...many(2, 'NEGATIVE'), ...many(8, 'POSITIVE')] }),
    ]);
    expect(result.distribution.shares?.NEGATIVE).toBeCloseTo(NEGATIVE_SHARE_WATCH, 4);
    expect(result.status).toBe('WATCH');
    expect(result.signals[0]?.key).toBe('negative_share');
    expect(result.signals[0]?.detail).toContain('2 of 10');
  });

  it('fires on a recurring non-severe issue', () => {
    const result = card([
      snapshot({
        feedback: [
          ...many(3, 'NEUTRAL', ['followup_communication']),
          ...many(9, 'POSITIVE'),
        ],
      }),
    ]);
    expect(result.status).toBe('WATCH');
    expect(result.signals.some((s) => s.key === 'recurring_issue')).toBe(true);
  });

  it('fires when a snapshot is overdue', () => {
    const result = card([
      snapshot({
        capturedAt: daysAgo(STALE_SNAPSHOT_WATCH_DAYS),
        feedback: many(12, 'POSITIVE'),
      }),
    ]);
    expect(result.status).toBe('WATCH');
    const signal = result.signals.find((s) => s.key === 'stale_data');
    expect(signal?.level).toBe('WATCH');
    expect(signal?.detail).toContain(`${STALE_SNAPSHOT_WATCH_DAYS} days old`);
  });

  it('fires when almost no reviews are arriving', () => {
    const result = card([
      snapshot({ reviewsPerWeek: 0.1, feedback: many(12, 'POSITIVE') }),
    ]);
    expect(result.status).toBe('WATCH');
    const signal = result.signals.find((s) => s.key === 'low_velocity');
    expect(signal?.detail).toContain(String(LOW_VELOCITY_PER_WEEK));
  });
});

describe('status — attention', () => {
  it('fires on a high negative share', () => {
    const result = card([
      snapshot({ feedback: [...many(4, 'NEGATIVE'), ...many(6, 'POSITIVE')] }),
    ]);
    expect(result.distribution.shares?.NEGATIVE).toBeGreaterThanOrEqual(
      NEGATIVE_SHARE_ATTENTION,
    );
    expect(result.status).toBe('ATTENTION');
    expect(result.signals[0]?.level).toBe('ATTENTION');
  });

  it('fires on a recurring high-severity issue', () => {
    const result = card([
      snapshot({
        feedback: [...many(3, 'NEGATIVE', ['wait_time']), ...many(9, 'POSITIVE')],
      }),
    ]);
    expect(result.status).toBe('ATTENTION');
    const signal = result.signals.find((s) => s.key === 'severe_issue');
    expect(signal?.label).toContain('Long waiting time');
    expect(signal?.detail).toContain('3 of 12');
  });

  it('fires on a rating drop between snapshots', () => {
    const result = card([
      snapshot({ id: 'now', rating: 4.0, capturedAt: daysAgo(1), feedback: many(12, 'POSITIVE') }),
      snapshot({ id: 'then', rating: 4.4, capturedAt: daysAgo(31), feedback: many(12, 'POSITIVE') }),
    ]);
    expect(result.status).toBe('ATTENTION');
    const signal = result.signals.find((s) => s.key === 'rating_drop');
    expect(signal?.detail).toContain('4.4 to 4.0');
  });

  it('fires when most reviews are unanswered', () => {
    const result = card([
      snapshot({
        reviewCount: 100,
        unansweredCount: 60,
        feedback: many(12, 'POSITIVE'),
      }),
    ]);
    expect(result.status).toBe('ATTENTION');
    const signal = result.signals.find((s) => s.key === 'reply_gap');
    expect(signal?.detail).toContain('60 of 100');
    expect(signal?.detail).toContain(`${Math.round(UNANSWERED_SHARE_ATTENTION * 100)}%`);
  });

  it('fires when the data itself has gone stale', () => {
    const result = card([
      snapshot({
        capturedAt: daysAgo(STALE_SNAPSHOT_ATTENTION_DAYS),
        feedback: many(12, 'POSITIVE'),
      }),
    ]);
    expect(result.status).toBe('ATTENTION');
    expect(result.signals.find((s) => s.key === 'stale_data')?.level).toBe(
      'ATTENTION',
    );
  });

  it('lists attention signals before watch signals', () => {
    const result = card([
      snapshot({
        reviewCount: 100,
        unansweredCount: 60,
        reviewsPerWeek: 0.1,
        feedback: many(12, 'POSITIVE'),
      }),
    ]);
    expect(result.signals[0]?.level).toBe('ATTENTION');
    expect(result.signals[result.signals.length - 1]?.level).toBe('WATCH');
  });
});

describe('status — tiny samples cannot drive sentiment signals', () => {
  it('ignores a 100% negative sample below the evidence floor', () => {
    const result = card([
      snapshot({ rating: 4.4, feedback: many(3, 'NEGATIVE') }),
    ]);
    expect(result.distribution.total).toBe(3);
    expect(result.distribution.reliable).toBe(false);
    expect(result.signals.some((s) => s.key === 'negative_share')).toBe(false);
    expect(result.status).toBe('HEALTHY');
  });

  it('still shows the raw counts so the operator can see them', () => {
    const result = card([snapshot({ feedback: many(3, 'NEGATIVE') })]);
    expect(result.distribution.counts.NEGATIVE).toBe(3);
    expect(result.distribution.note).toContain('below the');
  });
});

// ---------------------------------------------------------------------------

describe('trend', () => {
  it('is unavailable with no snapshots', () => {
    const t = computeTrend([]);
    expect(t.direction).toBe('NONE');
    expect(t.available).toBe(false);
    expect(t.reason).toContain('No snapshots yet');
  });

  it('is unavailable with a single snapshot', () => {
    const t = computeTrend([snapshot()]);
    expect(t.direction).toBe('NONE');
    expect(t.reason).toContain('at least two');
  });

  it('is unavailable when the two snapshots share no comparable measurement', () => {
    const t = computeTrend([
      snapshot({ id: 'now', rating: null, reviewCount: null, unansweredCount: null, capturedAt: daysAgo(1) }),
      snapshot({ id: 'then', rating: null, reviewCount: null, unansweredCount: null, capturedAt: daysAgo(31) }),
    ]);
    expect(t.direction).toBe('NONE');
    expect(t.available).toBe(false);
    expect(t.reason).toContain('no comparable measurement');
  });

  it('reports IMPROVING when the rating rises meaningfully', () => {
    const t = computeTrend([
      snapshot({ id: 'now', rating: 4.5, capturedAt: daysAgo(1) }),
      snapshot({ id: 'then', rating: 4.2, capturedAt: daysAgo(31) }),
    ]);
    expect(t.direction).toBe('IMPROVING');
    expect(t.metrics.find((m) => m.key === 'rating')?.delta).toBeCloseTo(0.3, 2);
    expect(t.periodDays).toBe(30);
  });

  it('reports DECLINING when the rating falls meaningfully', () => {
    const t = computeTrend([
      snapshot({ id: 'now', rating: 4.0, capturedAt: daysAgo(1) }),
      snapshot({ id: 'then', rating: 4.4, capturedAt: daysAgo(31) }),
    ]);
    expect(t.direction).toBe('DECLINING');
  });

  it('reports STABLE when movement is under the threshold', () => {
    const t = computeTrend([
      snapshot({ id: 'now', rating: 4.42, capturedAt: daysAgo(1) }),
      snapshot({ id: 'then', rating: 4.4, capturedAt: daysAgo(31) }),
    ]);
    expect(t.direction).toBe('STABLE');
    expect(t.metrics.find((m) => m.key === 'rating')?.contributes).toBe(false);
  });

  it('refuses to let a tiny feedback sample move the trend', () => {
    const t = computeTrend([
      snapshot({ id: 'now', rating: 4.4, capturedAt: daysAgo(1), feedback: many(4, 'NEGATIVE') }),
      snapshot({ id: 'then', rating: 4.4, capturedAt: daysAgo(31), feedback: many(4, 'POSITIVE') }),
    ]);
    const metric = t.metrics.find((m) => m.key === 'negativeShare');
    expect(metric?.delta).toBeCloseTo(1, 4);
    expect(metric?.contributes).toBe(false);
    expect(metric?.note).toContain('Sample too small');
    expect(t.direction).toBe('STABLE');
  });

  it('lets a large feedback sample move the trend', () => {
    const t = computeTrend([
      snapshot({
        id: 'now',
        rating: 4.4,
        capturedAt: daysAgo(1),
        feedback: [...many(2, 'NEGATIVE'), ...many(18, 'POSITIVE')],
      }),
      snapshot({
        id: 'then',
        rating: 4.4,
        capturedAt: daysAgo(31),
        feedback: [...many(8, 'NEGATIVE'), ...many(12, 'POSITIVE')],
      }),
    ]);
    const metric = t.metrics.find((m) => m.key === 'negativeShare');
    expect(metric?.contributes).toBe(true);
    expect(t.direction).toBe('IMPROVING');
  });

  it('nets opposing signals to STABLE rather than picking one', () => {
    const t = computeTrend([
      snapshot({
        id: 'now',
        rating: 4.6,
        reviewCount: 100,
        unansweredCount: 40,
        capturedAt: daysAgo(1),
      }),
      snapshot({
        id: 'then',
        rating: 4.2,
        reviewCount: 100,
        unansweredCount: 10,
        capturedAt: daysAgo(31),
      }),
    ]);
    expect(t.metrics.find((m) => m.key === 'rating')?.score).toBe(1);
    expect(t.metrics.find((m) => m.key === 'unansweredShare')?.score).toBe(-1);
    expect(t.direction).toBe('STABLE');
  });

  it('does not compare a metric that is missing on one side', () => {
    const t = computeTrend([
      snapshot({ id: 'now', rating: 4.5, unansweredCount: null, capturedAt: daysAgo(1) }),
      snapshot({ id: 'then', rating: 4.2, unansweredCount: 10, capturedAt: daysAgo(31) }),
    ]);
    const metric = t.metrics.find((m) => m.key === 'unansweredShare');
    expect(metric?.delta).toBeNull();
    expect(metric?.contributes).toBe(false);
    expect(metric?.note).toContain('cannot be compared');
  });
});

// ---------------------------------------------------------------------------

describe('pulse', () => {
  it('is unavailable with no snapshots', () => {
    const p = pulse([]);
    expect(p.available).toBe(false);
    expect(p.current).toBeNull();
    expect(p.reason).toContain('No snapshots yet');
  });

  it('shows the current period but no comparison after one snapshot', () => {
    const p = pulse([snapshot({ feedback: many(5, 'POSITIVE') })]);
    expect(p.available).toBe(false);
    expect(p.current?.feedbackCount).toBe(5);
    expect(p.previous).toBeNull();
    expect(p.reason).toContain('Only one snapshot exists');
  });

  it('compares the two most recent snapshots', () => {
    const p = pulse([
      snapshot({ id: 'now', label: 'March', capturedAt: daysAgo(1), rating: 4.5 }),
      snapshot({ id: 'then', label: 'February', capturedAt: daysAgo(31), rating: 4.2 }),
      snapshot({ id: 'older', label: 'January', capturedAt: daysAgo(61), rating: 3.9 }),
    ]);
    expect(p.available).toBe(true);
    expect(p.current?.label).toBe('March');
    expect(p.previous?.label).toBe('February');
    expect(p.periodDays).toBe(30);
    expect(p.direction).toBe('IMPROVING');
  });

  it('reports theme movement as raw counts on both sides', () => {
    const p = pulse([
      snapshot({
        id: 'now',
        capturedAt: daysAgo(1),
        feedback: many(5, 'NEGATIVE', ['wait_time']),
      }),
      snapshot({
        id: 'then',
        capturedAt: daysAgo(31),
        feedback: many(1, 'NEGATIVE', ['wait_time']),
      }),
    ]);
    const change = p.notableChanges.find((c) => c.key === 'wait_time');
    expect(change).toMatchObject({ previous: 1, current: 5, delta: 4 });
    expect(change?.note).toBe('1 → 5 mentions');
  });

  it('warns when either side is too small to read as a trend', () => {
    const p = pulse([
      snapshot({ id: 'now', capturedAt: daysAgo(1), feedback: many(3, 'NEGATIVE') }),
      snapshot({ id: 'then', capturedAt: daysAgo(31), feedback: many(20, 'POSITIVE') }),
    ]);
    expect(p.sampleWarning).toContain(`needs ${MIN_FEEDBACK_FOR_TREND_CLAIMS}`);
    expect(p.sampleWarning).toContain('20 feedback items in the previous period');
  });

  it('does not warn when both sides clear the floor', () => {
    const p = pulse([
      snapshot({ id: 'now', capturedAt: daysAgo(1), feedback: many(20, 'POSITIVE') }),
      snapshot({ id: 'then', capturedAt: daysAgo(31), feedback: many(20, 'POSITIVE') }),
    ]);
    expect(p.sampleWarning).toBeNull();
  });

  it('omits themes that did not move', () => {
    const p = pulse([
      snapshot({ id: 'now', capturedAt: daysAgo(1), feedback: many(3, 'NEGATIVE', ['wait_time']) }),
      snapshot({ id: 'then', capturedAt: daysAgo(31), feedback: many(3, 'NEGATIVE', ['wait_time']) }),
    ]);
    expect(p.notableChanges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('coverage', () => {
  it('reports no coverage before any snapshot', () => {
    const c = card([]).coverage;
    expect(c).toMatchObject({
      snapshotCount: 0,
      firstSnapshotAt: null,
      lastSnapshotAt: null,
      windowDays: null,
      totalFeedbackStored: 0,
    });
  });

  it('reports the window across all snapshots and total feedback stored', () => {
    const c = card([
      snapshot({ id: 'a', capturedAt: daysAgo(1), feedback: many(4, 'POSITIVE') }),
      snapshot({ id: 'b', capturedAt: daysAgo(31), feedback: many(6, 'POSITIVE') }),
      snapshot({ id: 'c', capturedAt: daysAgo(61), feedback: many(2, 'POSITIVE') }),
    ]).coverage;
    expect(c.snapshotCount).toBe(3);
    expect(c.windowDays).toBe(60);
    expect(c.daysSinceLastSnapshot).toBe(1);
    expect(c.totalFeedbackStored).toBe(12);
  });

  it('has no window for a single snapshot', () => {
    expect(card([snapshot()]).coverage.windowDays).toBeNull();
  });
});

describe('determinism', () => {
  const snapshots = [
    snapshot({
      id: 'now',
      capturedAt: daysAgo(1),
      rating: 4.1,
      reviewCount: 180,
      unansweredCount: 30,
      feedback: [...many(5, 'NEGATIVE', ['wait_time']), ...many(15, 'POSITIVE')],
    }),
    snapshot({
      id: 'then',
      capturedAt: daysAgo(31),
      rating: 4.3,
      reviewCount: 160,
      unansweredCount: 10,
      feedback: [...many(2, 'NEGATIVE', ['wait_time']), ...many(18, 'POSITIVE')],
    }),
  ];

  it('produces byte-identical health cards for identical input', () => {
    expect(JSON.stringify(card(snapshots))).toBe(JSON.stringify(card(snapshots)));
  });

  it('produces byte-identical pulses for identical input', () => {
    expect(JSON.stringify(pulse(snapshots))).toBe(JSON.stringify(pulse(snapshots)));
  });

  it('does not depend on the order snapshots are supplied in', () => {
    const forward = card(snapshots);
    const reversed = card([...snapshots].reverse());
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  });
});
