import { MIN_MENTIONS_FOR_THEME } from '@/lib/analysis/aggregate';
import type { Sentiment } from '@/lib/analysis/classify';
import type { Pack } from '@/lib/packs';
import {
  LOW_VELOCITY_PER_WEEK,
  MIN_FEEDBACK_FOR_SHARE_CLAIMS,
  MIN_FEEDBACK_FOR_TREND_CLAIMS,
  NEGATIVE_SHARE_ATTENTION,
  NEGATIVE_SHARE_WATCH,
  RATING_DROP_ATTENTION,
  RATING_DROP_WATCH,
  STALE_SNAPSHOT_ATTENTION_DAYS,
  STALE_SNAPSHOT_WATCH_DAYS,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  TREND_LABELS,
  TREND_RATING_DELTA,
  TREND_SHARE_DELTA,
  UNANSWERED_SHARE_ATTENTION,
  UNANSWERED_SHARE_WATCH,
  type HealthStatus,
  type SignalLevel,
  type TrendDirection,
} from './rules';

/**
 * HEALTH CARD + PULSE — deterministic.
 *
 * Everything here is computed from rows already stored in SQLite: snapshots the
 * operator entered by hand and feedback they pasted. Nothing is fetched, and no
 * language model is consulted. The same stored inputs always produce the same
 * output, which is what makes the status defensible to a business owner.
 *
 * Where data is missing, the result says so. There is no imputation, no
 * default score and no "estimated" anything.
 */

// ---------------------------------------------------------------------------
// Inputs (Prisma-free, so this module is directly testable)
// ---------------------------------------------------------------------------

export type StoredFeedback = {
  sentiment: Sentiment;
  issueTags: string[];
  praiseTags: string[];
  stars: number | null;
  reviewDate: Date | null;
};

export type StoredSnapshot = {
  id: string;
  label: string | null;
  capturedAt: Date;
  rating: number | null;
  reviewCount: number | null;
  unansweredCount: number | null;
  reviewsPerWeek: number | null;
  daysSinceLastPost: number | null;
  photoRecencyDays: number | null;
  generatedAt: Date | null;
  feedback: StoredFeedback[];
};

export type HealthInput = {
  pack: Pack;
  /** Any order — sorted newest-first internally. */
  snapshots: StoredSnapshot[];
  /** Injected so results are reproducible in tests. */
  now: Date;
};

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type HealthSignal = {
  key: string;
  level: SignalLevel;
  label: string;
  /** Human-readable, always containing the real numbers that fired it. */
  detail: string;
};

export type Distribution = {
  total: number;
  counts: Record<Sentiment, number>;
  /** Null when there is no feedback at all — never a zero-denominator share. */
  shares: Record<Sentiment, number> | null;
  /** False when the sample is below the share-claim floor. */
  reliable: boolean;
  note: string;
};

export type ThemeCount = {
  key: string;
  label: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
  qualifies: boolean;
};

export type TrendMetric = {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  /** Which way is good for this metric, so the UI never guesses. */
  goodDirection: 'up' | 'down';
  /** Did this metric move enough, with enough evidence, to count? */
  contributes: boolean;
  /** +1 improving, -1 declining, 0 flat or not counted. */
  score: number;
  note: string;
};

export type Trend = {
  direction: TrendDirection;
  label: string;
  available: boolean;
  reason: string;
  metrics: TrendMetric[];
  comparedSnapshotIds: [string, string] | null;
  periodDays: number | null;
};

export type Coverage = {
  snapshotCount: number;
  firstSnapshotAt: Date | null;
  lastSnapshotAt: Date | null;
  windowDays: number | null;
  daysSinceLastSnapshot: number | null;
  totalFeedbackStored: number;
  note: string;
};

export type HealthCard = {
  status: HealthStatus;
  statusLabel: string;
  statusSummary: string;
  /** Every signal that fired, most severe first. Empty when Healthy. */
  signals: HealthSignal[];
  latestSnapshotId: string | null;
  latestSnapshotLabel: string | null;
  lastUpdatedAt: Date | null;
  observed: {
    rating: number | null;
    reviewCount: number | null;
    unansweredCount: number | null;
    unansweredShare: number | null;
    reviewsPerWeek: number | null;
    daysSinceLastPost: number | null;
    photoRecencyDays: number | null;
  };
  distribution: Distribution;
  topIssues: ThemeCount[];
  topPraises: ThemeCount[];
  trend: Trend;
  coverage: Coverage;
};

export type PulsePeriod = {
  snapshotId: string;
  label: string;
  capturedAt: Date;
  feedbackCount: number;
  distribution: Distribution;
  rating: number | null;
  reviewCount: number | null;
  unansweredCount: number | null;
  topIssues: ThemeCount[];
  /**
   * Praise themes in this period. Added so the intelligence layer can report
   * praise that grew, not only complaints that moved — an owner deserves to
   * hear "the food is being praised more" as much as "waits are worse".
   */
  topPraises: ThemeCount[];
};

export type NotableChange = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  note: string;
};

export type Pulse = {
  available: boolean;
  reason: string;
  direction: TrendDirection;
  directionLabel: string;
  current: PulsePeriod | null;
  previous: PulsePeriod | null;
  periodDays: number | null;
  metrics: TrendMetric[];
  notableChanges: NotableChange[];
  /** Set when either side is too small to read as a trend. */
  sampleWarning: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_SENTIMENT: Record<Sentiment, number> = {
  POSITIVE: 0,
  NEGATIVE: 0,
  MIXED: 0,
  NEUTRAL: 0,
  UNKNOWN: 0,
};

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Ratings always read to one decimal place, so "4" never appears beside "4.4". */
function stars(value: number): string {
  return value.toFixed(1);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

/** Share that returns null rather than dividing by zero. */
export function safeShare(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null) return null;
  if (!Number.isFinite(part) || !Number.isFinite(whole)) return null;
  if (whole <= 0) return null;
  return round(part / whole, 4);
}

/** Counts sentiment across stored feedback. Zero feedback yields no shares. */
export function summariseDistribution(feedback: StoredFeedback[]): Distribution {
  const counts: Record<Sentiment, number> = { ...EMPTY_SENTIMENT };
  for (const item of feedback) counts[item.sentiment] += 1;

  const total = feedback.length;
  if (total === 0) {
    return {
      total: 0,
      counts,
      shares: null,
      reliable: false,
      note: 'No feedback yet.',
    };
  }

  const shares = Object.fromEntries(
    (Object.keys(counts) as Sentiment[]).map((k) => [
      k,
      round(counts[k] / total, 4),
    ]),
  ) as Record<Sentiment, number>;

  const reliable = total >= MIN_FEEDBACK_FOR_SHARE_CLAIMS;
  return {
    total,
    counts,
    shares,
    reliable,
    note: reliable
      ? `Based on ${total} stored feedback items.`
      : `Only ${total} feedback item${total === 1 ? '' : 's'} stored — below the ${MIN_FEEDBACK_FOR_SHARE_CLAIMS} needed before Headway treats a share as meaningful.`,
  };
}

/** Counts taxonomy tags across stored feedback, sorted by count then taxonomy order. */
export function summariseThemes(
  feedback: StoredFeedback[],
  pack: Pack,
  which: 'issues' | 'praises',
): ThemeCount[] {
  const entries =
    which === 'issues' ? pack.issueTaxonomy : pack.praiseTaxonomy;
  const orderOf = new Map(entries.map((e, i) => [e.key, i]));

  const counts = new Map<string, number>();
  for (const item of feedback) {
    const tags = which === 'issues' ? item.issueTags : item.praiseTags;
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return entries
    .filter((e) => (counts.get(e.key) ?? 0) > 0)
    .map((e) => ({
      key: e.key,
      label: e.label,
      count: counts.get(e.key) as number,
      severity: e.severity ?? ('medium' as const),
      qualifies: (counts.get(e.key) as number) >= MIN_MENTIONS_FOR_THEME,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (orderOf.get(a.key) ?? 0) - (orderOf.get(b.key) ?? 0),
    );
}

function sortedNewestFirst(snapshots: StoredSnapshot[]): StoredSnapshot[] {
  return [...snapshots].sort(
    (a, b) =>
      b.capturedAt.getTime() - a.capturedAt.getTime() || a.id.localeCompare(b.id),
  );
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

function buildTrendMetrics(
  current: StoredSnapshot,
  previous: StoredSnapshot,
): TrendMetric[] {
  const metrics: TrendMetric[] = [];

  // 1. Observed rating — a directly observed number, always comparable.
  {
    const now = current.rating;
    const then = previous.rating;
    const comparable = now !== null && then !== null;
    const delta = comparable ? round(now - then, 2) : null;
    const contributes = delta !== null && Math.abs(delta) >= TREND_RATING_DELTA;

    let note: string;
    if (!comparable || delta === null) {
      note = 'Rating was not observed in both snapshots, so it cannot be compared.';
    } else {
      const move = `Rating moved from ${stars(then)} to ${stars(now)}`;
      note = contributes
        ? `${move} (${delta > 0 ? '+' : ''}${delta}).`
        : `${move} — smaller than the ${TREND_RATING_DELTA} needed to call a direction.`;
    }

    metrics.push({
      key: 'rating',
      label: 'Rating',
      current: now,
      previous: then,
      delta,
      goodDirection: 'up',
      contributes,
      score: contributes && delta !== null ? (delta > 0 ? 1 : -1) : 0,
      note,
    });
  }

  // 2. Negative share of stored feedback — sample-derived, so it needs a floor
  //    on BOTH sides before it may influence the trend.
  {
    const currentDist = summariseDistribution(current.feedback);
    const previousDist = summariseDistribution(previous.feedback);
    const now = currentDist.shares?.NEGATIVE ?? null;
    const then = previousDist.shares?.NEGATIVE ?? null;
    const delta = now !== null && then !== null ? round(now - then, 4) : null;

    const bigEnough =
      currentDist.total >= MIN_FEEDBACK_FOR_TREND_CLAIMS &&
      previousDist.total >= MIN_FEEDBACK_FOR_TREND_CLAIMS;
    const contributes =
      bigEnough && delta !== null && Math.abs(delta) >= TREND_SHARE_DELTA;

    metrics.push({
      key: 'negativeShare',
      label: 'Negative feedback share',
      current: now,
      previous: then,
      delta,
      goodDirection: 'down',
      contributes,
      score: contributes && delta !== null ? (delta < 0 ? 1 : -1) : 0,
      note:
        delta === null
          ? 'One of the two periods has no stored feedback, so the share cannot be compared.'
          : !bigEnough
            ? `Sample too small to read as a trend: ${previousDist.total} then, ${currentDist.total} now (need ${MIN_FEEDBACK_FOR_TREND_CLAIMS} on both sides).`
            : contributes
              ? `Negative share moved from ${pct(then as number)} to ${pct(now as number)}.`
              : `Negative share moved from ${pct(then as number)} to ${pct(now as number)} — under the ${pct(TREND_SHARE_DELTA)} needed to call a direction.`,
    });
  }

  // 3. Unanswered share — directly observed, always comparable when present.
  {
    const now = safeShare(current.unansweredCount, current.reviewCount);
    const then = safeShare(previous.unansweredCount, previous.reviewCount);
    const delta = now !== null && then !== null ? round(now - then, 4) : null;
    const contributes = delta !== null && Math.abs(delta) >= TREND_SHARE_DELTA;
    metrics.push({
      key: 'unansweredShare',
      label: 'Unanswered reviews',
      current: now,
      previous: then,
      delta,
      goodDirection: 'down',
      contributes,
      score: contributes && delta !== null ? (delta < 0 ? 1 : -1) : 0,
      note:
        delta === null
          ? 'Unanswered reviews were not observed in both snapshots, so they cannot be compared.'
          : contributes
            ? `Unanswered share moved from ${pct(then as number)} to ${pct(now as number)}.`
            : `Unanswered share moved from ${pct(then as number)} to ${pct(now as number)} — under the ${pct(TREND_SHARE_DELTA)} needed to call a direction.`,
    });
  }

  return metrics;
}

function directionFromMetrics(metrics: TrendMetric[]): TrendDirection {
  const contributing = metrics.filter((m) => m.contributes);
  if (contributing.length === 0) return 'STABLE';
  const score = contributing.reduce((sum, m) => sum + m.score, 0);
  if (score > 0) return 'IMPROVING';
  if (score < 0) return 'DECLINING';
  return 'STABLE';
}

export function computeTrend(snapshots: StoredSnapshot[]): Trend {
  const ordered = sortedNewestFirst(snapshots);
  const current = ordered[0];
  const previous = ordered[1];

  if (!current || !previous) {
    return {
      direction: 'NONE',
      label: TREND_LABELS.NONE,
      available: false,
      reason:
        ordered.length === 0
          ? 'No snapshots yet, so there is nothing to compare.'
          : 'Only one snapshot exists. A trend needs at least two.',
      metrics: [],
      comparedSnapshotIds: null,
      periodDays: null,
    };
  }

  const metrics = buildTrendMetrics(current, previous);
  const comparable = metrics.filter((m) => m.delta !== null);

  if (comparable.length === 0) {
    return {
      direction: 'NONE',
      label: TREND_LABELS.NONE,
      available: false,
      reason:
        'The two most recent snapshots share no comparable measurement, so no direction can be given.',
      metrics,
      comparedSnapshotIds: [current.id, previous.id],
      periodDays: daysBetween(current.capturedAt, previous.capturedAt),
    };
  }

  const direction = directionFromMetrics(metrics);
  const moving = metrics.filter((m) => m.contributes);

  return {
    direction,
    label: TREND_LABELS[direction],
    available: true,
    reason:
      moving.length === 0
        ? `Nothing moved by more than the thresholds Headway requires, across ${comparable.length} comparable measurement${comparable.length === 1 ? '' : 's'}.`
        : moving.map((m) => m.note).join(' '),
    metrics,
    comparedSnapshotIds: [current.id, previous.id],
    periodDays: daysBetween(current.capturedAt, previous.capturedAt),
  };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function buildSignals(
  latest: StoredSnapshot,
  previous: StoredSnapshot | undefined,
  distribution: Distribution,
  issues: ThemeCount[],
  now: Date,
): HealthSignal[] {
  const signals: HealthSignal[] = [];

  // --- negative sentiment share (needs the evidence floor) -----------------
  if (distribution.reliable && distribution.shares) {
    const share = distribution.shares.NEGATIVE;
    const count = distribution.counts.NEGATIVE;
    if (share >= NEGATIVE_SHARE_ATTENTION) {
      signals.push({
        key: 'negative_share',
        level: 'ATTENTION',
        label: 'High share of negative feedback',
        detail: `${count} of ${distribution.total} stored items are negative (${pct(share)}), at or above the ${pct(NEGATIVE_SHARE_ATTENTION)} attention threshold.`,
      });
    } else if (share >= NEGATIVE_SHARE_WATCH) {
      signals.push({
        key: 'negative_share',
        level: 'WATCH',
        label: 'Negative feedback climbing',
        detail: `${count} of ${distribution.total} stored items are negative (${pct(share)}), at or above the ${pct(NEGATIVE_SHARE_WATCH)} watch threshold.`,
      });
    }
  }

  // --- recurring issue themes ----------------------------------------------
  const qualifying = issues.filter((i) => i.qualifies);
  const severeIssue = qualifying.find((i) => i.severity === 'high');
  if (severeIssue) {
    signals.push({
      key: 'severe_issue',
      level: 'ATTENTION',
      label: `Recurring issue: ${severeIssue.label}`,
      detail: `Mentioned in ${severeIssue.count} of ${distribution.total} stored items, at or above the ${MIN_MENTIONS_FOR_THEME}-mention floor, and rated high severity for this vertical.`,
    });
  } else if (qualifying.length > 0) {
    const top = qualifying[0] as ThemeCount;
    signals.push({
      key: 'recurring_issue',
      level: 'WATCH',
      label: `Recurring issue: ${top.label}`,
      detail: `Mentioned in ${top.count} of ${distribution.total} stored items, at or above the ${MIN_MENTIONS_FOR_THEME}-mention floor.`,
    });
  }

  // --- rating movement ------------------------------------------------------
  if (previous && latest.rating !== null && previous.rating !== null) {
    const delta = round(latest.rating - previous.rating, 2);
    if (delta <= RATING_DROP_ATTENTION) {
      signals.push({
        key: 'rating_drop',
        level: 'ATTENTION',
        label: 'Rating fell',
        detail: `Rating went from ${stars(previous.rating)} to ${stars(latest.rating)} (${delta}), at or beyond the ${RATING_DROP_ATTENTION} attention threshold.`,
      });
    } else if (delta <= RATING_DROP_WATCH) {
      signals.push({
        key: 'rating_drop',
        level: 'WATCH',
        label: 'Rating slipping',
        detail: `Rating went from ${stars(previous.rating)} to ${stars(latest.rating)} (${delta}).`,
      });
    }
  }

  // --- reply gap ------------------------------------------------------------
  const unansweredShare = safeShare(latest.unansweredCount, latest.reviewCount);
  if (unansweredShare !== null && (latest.unansweredCount ?? 0) > 0) {
    if (unansweredShare >= UNANSWERED_SHARE_ATTENTION) {
      signals.push({
        key: 'reply_gap',
        level: 'ATTENTION',
        label: 'Most reviews have no reply',
        detail: `${latest.unansweredCount} of ${latest.reviewCount} reviews are unanswered (${pct(unansweredShare)}), at or above the ${pct(UNANSWERED_SHARE_ATTENTION)} attention threshold.`,
      });
    } else if (unansweredShare >= UNANSWERED_SHARE_WATCH) {
      signals.push({
        key: 'reply_gap',
        level: 'WATCH',
        label: 'Reply backlog building',
        detail: `${latest.unansweredCount} of ${latest.reviewCount} reviews are unanswered (${pct(unansweredShare)}).`,
      });
    }
  }

  // --- our own data going stale --------------------------------------------
  const age = daysBetween(now, latest.capturedAt);
  if (age >= STALE_SNAPSHOT_ATTENTION_DAYS) {
    signals.push({
      key: 'stale_data',
      level: 'ATTENTION',
      label: 'Health data is out of date',
      detail: `The most recent snapshot is ${age} days old, past the ${STALE_SNAPSHOT_ATTENTION_DAYS}-day limit. This card describes the past, not the present.`,
    });
  } else if (age >= STALE_SNAPSHOT_WATCH_DAYS) {
    signals.push({
      key: 'stale_data',
      level: 'WATCH',
      label: 'Snapshot due',
      detail: `The most recent snapshot is ${age} days old, past the ${STALE_SNAPSHOT_WATCH_DAYS}-day mark.`,
    });
  }

  // --- collection velocity --------------------------------------------------
  if (
    latest.reviewsPerWeek !== null &&
    latest.reviewsPerWeek < LOW_VELOCITY_PER_WEEK
  ) {
    signals.push({
      key: 'low_velocity',
      level: 'WATCH',
      label: 'Almost no new reviews arriving',
      detail: `${latest.reviewsPerWeek} reviews per week observed, below the ${LOW_VELOCITY_PER_WEEK} floor. The feedback kit and staff ask-script are the lever.`,
    });
  }

  const rank: Record<SignalLevel, number> = { ATTENTION: 0, WATCH: 1 };
  return signals.sort(
    (a, b) => rank[a.level] - rank[b.level] || a.key.localeCompare(b.key),
  );
}

/**
 * A client has enough stored data to be judged when the latest snapshot carries
 * either an observed rating or at least one piece of feedback. Without either,
 * RepOS says so instead of inventing a status.
 */
function hasJudgeableData(latest: StoredSnapshot | undefined): boolean {
  if (!latest) return false;
  return latest.rating !== null || latest.feedback.length > 0;
}

// ---------------------------------------------------------------------------
// Health card
// ---------------------------------------------------------------------------

export function computeHealthCard(input: HealthInput): HealthCard {
  const { pack, now } = input;
  const ordered = sortedNewestFirst(input.snapshots);
  const latest = ordered[0];
  const previous = ordered[1];

  const totalFeedbackStored = ordered.reduce(
    (sum, s) => sum + s.feedback.length,
    0,
  );

  const first = ordered[ordered.length - 1];
  const coverage: Coverage = {
    snapshotCount: ordered.length,
    firstSnapshotAt: first?.capturedAt ?? null,
    lastSnapshotAt: latest?.capturedAt ?? null,
    windowDays:
      first && latest && first.id !== latest.id
        ? daysBetween(latest.capturedAt, first.capturedAt)
        : null,
    daysSinceLastSnapshot: latest ? daysBetween(now, latest.capturedAt) : null,
    totalFeedbackStored,
    note: !latest
      ? 'No snapshots have been saved for this client yet.'
      : ordered.length === 1
        ? `One snapshot, covering the moment it was taken. ${totalFeedbackStored} feedback item${totalFeedbackStored === 1 ? '' : 's'} stored.`
        : `${ordered.length} snapshots spanning ${daysBetween(latest.capturedAt, (first as StoredSnapshot).capturedAt)} days. ${totalFeedbackStored} feedback item${totalFeedbackStored === 1 ? '' : 's'} stored.`,
  };

  const distribution = summariseDistribution(latest?.feedback ?? []);
  const topIssues = latest ? summariseThemes(latest.feedback, pack, 'issues') : [];
  const topPraises = latest
    ? summariseThemes(latest.feedback, pack, 'praises')
    : [];
  const trend = computeTrend(ordered);

  if (!hasJudgeableData(latest)) {
    return {
      status: 'INSUFFICIENT_DATA',
      statusLabel: STATUS_LABELS.INSUFFICIENT_DATA,
      statusSummary: !latest
        ? 'No snapshot has been taken yet. Take the first snapshot to give this client a health status.'
        : 'The latest snapshot has neither an observed rating nor any pasted feedback, so there is nothing to judge.',
      signals: [],
      latestSnapshotId: latest?.id ?? null,
      latestSnapshotLabel: latest?.label ?? null,
      lastUpdatedAt: latest?.capturedAt ?? null,
      observed: {
        rating: latest?.rating ?? null,
        reviewCount: latest?.reviewCount ?? null,
        unansweredCount: latest?.unansweredCount ?? null,
        unansweredShare: latest
          ? safeShare(latest.unansweredCount, latest.reviewCount)
          : null,
        reviewsPerWeek: latest?.reviewsPerWeek ?? null,
        daysSinceLastPost: latest?.daysSinceLastPost ?? null,
        photoRecencyDays: latest?.photoRecencyDays ?? null,
      },
      distribution,
      topIssues,
      topPraises,
      trend,
      coverage,
    };
  }

  const snapshot = latest as StoredSnapshot;
  const signals = buildSignals(snapshot, previous, distribution, topIssues, now);

  const hasAttention = signals.some((s) => s.level === 'ATTENTION');
  const status: HealthStatus = hasAttention
    ? 'ATTENTION'
    : signals.length > 0
      ? 'WATCH'
      : 'HEALTHY';

  const statusSummary =
    status === 'HEALTHY'
      ? `${STATUS_DESCRIPTIONS.HEALTHY} Checked against ${distribution.total} stored feedback item${distribution.total === 1 ? '' : 's'} and the observed listing figures.`
      : `${signals.length} signal${signals.length === 1 ? '' : 's'} fired: ${signals.map((s) => s.label.toLowerCase()).join('; ')}.`;

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    statusSummary,
    signals,
    latestSnapshotId: snapshot.id,
    latestSnapshotLabel: snapshot.label,
    lastUpdatedAt: snapshot.capturedAt,
    observed: {
      rating: snapshot.rating,
      reviewCount: snapshot.reviewCount,
      unansweredCount: snapshot.unansweredCount,
      unansweredShare: safeShare(snapshot.unansweredCount, snapshot.reviewCount),
      reviewsPerWeek: snapshot.reviewsPerWeek,
      daysSinceLastPost: snapshot.daysSinceLastPost,
      photoRecencyDays: snapshot.photoRecencyDays,
    },
    distribution,
    topIssues,
    topPraises,
    trend,
    coverage,
  };
}

// ---------------------------------------------------------------------------
// Pulse
// ---------------------------------------------------------------------------

function toPeriod(snapshot: StoredSnapshot, pack: Pack): PulsePeriod {
  return {
    snapshotId: snapshot.id,
    label: snapshot.label ?? snapshot.capturedAt.toISOString().slice(0, 10),
    capturedAt: snapshot.capturedAt,
    feedbackCount: snapshot.feedback.length,
    distribution: summariseDistribution(snapshot.feedback),
    rating: snapshot.rating,
    reviewCount: snapshot.reviewCount,
    unansweredCount: snapshot.unansweredCount,
    topIssues: summariseThemes(snapshot.feedback, pack, 'issues'),
    topPraises: summariseThemes(snapshot.feedback, pack, 'praises'),
  };
}

/**
 * Period-over-period view.
 *
 * A "period" is one saved snapshot: the current period is the most recent
 * snapshot, the previous comparable period is the one before it. That keeps the
 * comparison anchored to what the operator actually measured, rather than to a
 * calendar window RepOS has no data for.
 */
export function computePulse(input: HealthInput): Pulse {
  const { pack } = input;
  const ordered = sortedNewestFirst(input.snapshots);
  const currentSnapshot = ordered[0];
  const previousSnapshot = ordered[1];

  if (!currentSnapshot) {
    return {
      available: false,
      reason: 'No check-in recorded yet. Once two are on record, Headway can say which way things are moving.',
      direction: 'NONE',
      directionLabel: TREND_LABELS.NONE,
      current: null,
      previous: null,
      periodDays: null,
      metrics: [],
      notableChanges: [],
      sampleWarning: null,
    };
  }

  const current = toPeriod(currentSnapshot, pack);

  if (!previousSnapshot) {
    return {
      available: false,
      reason:
        'Only one snapshot exists. The next snapshot will give this client its first period-over-period comparison.',
      direction: 'NONE',
      directionLabel: TREND_LABELS.NONE,
      current,
      previous: null,
      periodDays: null,
      metrics: [],
      notableChanges: [],
      sampleWarning: null,
    };
  }

  const previous = toPeriod(previousSnapshot, pack);
  const metrics = buildTrendMetrics(currentSnapshot, previousSnapshot);
  const direction = directionFromMetrics(metrics);

  // Issue themes that moved. Reported as raw counts on both sides so a change
  // of "1 to 3" can never be dressed up as a percentage swing.
  const issueKeys = new Set<string>([
    ...current.topIssues.map((t) => t.key),
    ...previous.topIssues.map((t) => t.key),
  ]);
  const notableChanges: NotableChange[] = [...issueKeys]
    .map((key) => {
      const nowCount = current.topIssues.find((t) => t.key === key)?.count ?? 0;
      const thenCount = previous.topIssues.find((t) => t.key === key)?.count ?? 0;
      const label =
        current.topIssues.find((t) => t.key === key)?.label ??
        previous.topIssues.find((t) => t.key === key)?.label ??
        key;
      const delta = nowCount - thenCount;
      return {
        key,
        label,
        current: nowCount,
        previous: thenCount,
        delta,
        note: `${thenCount} → ${nowCount} mention${nowCount === 1 ? '' : 's'}`,
      };
    })
    .filter((c) => c.delta !== 0)
    .sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.label.localeCompare(b.label),
    );

  const tooSmall =
    current.feedbackCount < MIN_FEEDBACK_FOR_TREND_CLAIMS ||
    previous.feedbackCount < MIN_FEEDBACK_FOR_TREND_CLAIMS;

  return {
    available: true,
    reason: `Comparing ${previous.label} with ${current.label}.`,
    direction,
    directionLabel: TREND_LABELS[direction],
    current,
    previous,
    periodDays: daysBetween(currentSnapshot.capturedAt, previousSnapshot.capturedAt),
    metrics,
    notableChanges,
    sampleWarning: tooSmall
      ? `Small samples: ${previous.feedbackCount} feedback item${previous.feedbackCount === 1 ? '' : 's'} in the previous period and ${current.feedbackCount} in the current one. Headway needs ${MIN_FEEDBACK_FOR_TREND_CLAIMS} on both sides before treating a change in feedback as a trend — read these as counts, not as a pattern.`
      : null,
  };
}
