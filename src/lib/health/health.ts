import { MIN_MENTIONS_FOR_THEME } from '@/lib/analysis/aggregate';
import type { Sentiment } from '@/lib/analysis/classify';
import { formatDate } from '@/lib/format';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';
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
  /**
   * The owner's language, passed in — never looked up and never branched on.
   * Absent means English, which is what the operator console wants.
   */
  t?: PortalTranslator;
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

/**
 * THE COUNTING UNIT FOR FEEDBACK, EVERYWHERE.
 *
 * Never "items" or "stored items": those name a row in a table, not the thing
 * a customer left. And counts count pieces of feedback, not people — one
 * customer can leave several.
 *
 * It is not a phrase this file can glue into a sentence, which is why there is
 * no `pieces()` helper any more. "3 of 13 pieces of feedback are negative" is
 * one sentence in the dictionary, inflected on the total by `t.plural`, because
 * Hindi and Marathi put that total first and a fragment cannot be reordered.
 */

/** The status word, as a phrase rather than a lookup, so it can be translated. */
function statusLabelOf(status: HealthStatus, t: PortalTranslator): string {
  switch (status) {
    case 'HEALTHY':
      return t('intelligence.health.status_label.healthy');
    case 'WATCH':
      return t('intelligence.health.status_label.watch');
    case 'ATTENTION':
      return t('intelligence.health.status_label.attention');
    default:
      return t('intelligence.health.status_label.insufficient');
  }
}

/**
 * A theme's label for use INSIDE a sentence.
 *
 * The label on a `ThemeCount` stays the pack's own English, because that is
 * data other layers key off and translate themselves. But a label dropped into
 * "Recurring issue: …" is part of a sentence an owner reads, so it goes through
 * the same soft lookup the rest of the generation layer uses — the pack's
 * English is the fallback, so a theme with no entry yet is never a broken line.
 */
function themeLabel(pack: Pack, theme: ThemeCount, t: PortalTranslator): string {
  return t.soft(`pack.${pack.id}.${theme.key}`) ?? theme.label;
}

/** Same, for the direction. `NONE` is "no trend yet", never "flat". */
function trendLabelOf(direction: TrendDirection, t: PortalTranslator): string {
  switch (direction) {
    case 'IMPROVING':
      return t('intelligence.health.trend_label.improving');
    case 'STABLE':
      return t('intelligence.health.trend_label.stable');
    case 'DECLINING':
      return t('intelligence.health.trend_label.declining');
    default:
      return t('intelligence.health.trend_label.none');
  }
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
export function summariseDistribution(
  feedback: StoredFeedback[],
  t: PortalTranslator = EN,
): Distribution {
  const counts: Record<Sentiment, number> = { ...EMPTY_SENTIMENT };
  for (const item of feedback) counts[item.sentiment] += 1;

  const total = feedback.length;
  if (total === 0) {
    return {
      total: 0,
      counts,
      shares: null,
      reliable: false,
      note: t('intelligence.health.distribution.none'),
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
      ? t.plural('intelligence.health.distribution.based_on', total)
      : t.plural('intelligence.health.distribution.thin', total, {
          needed: MIN_FEEDBACK_FOR_SHARE_CLAIMS,
        }),
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
  t: PortalTranslator,
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
      note = t('intelligence.health.trend.rating.not_recorded');
    } else {
      const move = { previous: stars(then), current: stars(now) };
      note = contributes
        ? t('intelligence.health.trend.rating.moved', {
            ...move,
            delta: `${delta > 0 ? '+' : ''}${delta}`,
          })
        : t('intelligence.health.trend.rating.flat', {
            ...move,
            needed: TREND_RATING_DELTA,
          });
    }

    metrics.push({
      key: 'rating',
      label: t('intelligence.health.metric.rating'),
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
    const currentDist = summariseDistribution(current.feedback, t);
    const previousDist = summariseDistribution(previous.feedback, t);
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
      label: t('intelligence.health.metric.negative_share'),
      current: now,
      previous: then,
      delta,
      goodDirection: 'down',
      contributes,
      score: contributes && delta !== null ? (delta < 0 ? 1 : -1) : 0,
      note:
        delta === null
          ? t('intelligence.health.trend.negative.not_comparable')
          : !bigEnough
            ? t('intelligence.health.trend.negative.too_little', {
                previousCount: previousDist.total,
                currentCount: currentDist.total,
                needed: MIN_FEEDBACK_FOR_TREND_CLAIMS,
              })
            : contributes
              ? t('intelligence.health.trend.negative.moved', {
                  previous: pct(then as number),
                  current: pct(now as number),
                })
              : t('intelligence.health.trend.negative.flat', {
                  previous: pct(then as number),
                  current: pct(now as number),
                  needed: pct(TREND_SHARE_DELTA),
                }),
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
      label: t('intelligence.health.metric.unanswered_share'),
      current: now,
      previous: then,
      delta,
      goodDirection: 'down',
      contributes,
      score: contributes && delta !== null ? (delta < 0 ? 1 : -1) : 0,
      note:
        delta === null
          ? t('intelligence.health.trend.unanswered.not_recorded')
          : contributes
            ? t('intelligence.health.trend.unanswered.moved', {
                previous: pct(then as number),
                current: pct(now as number),
              })
            : t('intelligence.health.trend.unanswered.flat', {
                previous: pct(then as number),
                current: pct(now as number),
                needed: pct(TREND_SHARE_DELTA),
              }),
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

export function computeTrend(
  snapshots: StoredSnapshot[],
  t: PortalTranslator = EN,
): Trend {
  const ordered = sortedNewestFirst(snapshots);
  const current = ordered[0];
  const previous = ordered[1];

  if (!current || !previous) {
    return {
      direction: 'NONE',
      label: trendLabelOf('NONE', t),
      available: false,
      reason:
        ordered.length === 0
          ? t('intelligence.health.trend.no_checkins')
          : t('intelligence.health.trend.one_checkin'),
      metrics: [],
      comparedSnapshotIds: null,
      periodDays: null,
    };
  }

  const metrics = buildTrendMetrics(current, previous, t);
  const comparable = metrics.filter((m) => m.delta !== null);

  if (comparable.length === 0) {
    return {
      direction: 'NONE',
      label: trendLabelOf('NONE', t),
      available: false,
      reason: t('intelligence.health.trend.no_common_figure'),
      metrics,
      comparedSnapshotIds: [current.id, previous.id],
      periodDays: daysBetween(current.capturedAt, previous.capturedAt),
    };
  }

  const direction = directionFromMetrics(metrics);
  const moving = metrics.filter((m) => m.contributes);

  return {
    direction,
    label: trendLabelOf(direction, t),
    available: true,
    reason:
      moving.length === 0
        ? t.plural('intelligence.health.trend.nothing_moved', comparable.length)
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
  pack: Pack,
  t: PortalTranslator,
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
        label: t('intelligence.health.signal.negative_share_attention.label'),
        detail: t.plural(
          'intelligence.health.signal.negative_share_attention.detail',
          distribution.total,
          {
            negative: count,
            share: pct(share),
            threshold: pct(NEGATIVE_SHARE_ATTENTION),
          },
        ),
      });
    } else if (share >= NEGATIVE_SHARE_WATCH) {
      // A level, not a direction: this fires on one check-in's share and never
      // looks at the one before, so the label must not say "climbing".
      signals.push({
        key: 'negative_share',
        level: 'WATCH',
        label: t('intelligence.health.signal.negative_share_watch.label'),
        detail: t.plural(
          'intelligence.health.signal.negative_share_watch.detail',
          distribution.total,
          {
            negative: count,
            share: pct(share),
            threshold: pct(NEGATIVE_SHARE_WATCH),
          },
        ),
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
      label: t('intelligence.health.signal.recurring_issue.label', {
        theme: themeLabel(pack, severeIssue, t),
      }),
      detail: t.plural(
        'intelligence.health.signal.severe_issue.detail',
        distribution.total,
        { mentions: severeIssue.count, needed: MIN_MENTIONS_FOR_THEME },
      ),
    });
  } else if (qualifying.length > 0) {
    const top = qualifying[0] as ThemeCount;
    signals.push({
      key: 'recurring_issue',
      level: 'WATCH',
      label: t('intelligence.health.signal.recurring_issue.label', {
        theme: themeLabel(pack, top, t),
      }),
      detail: t.plural(
        'intelligence.health.signal.recurring_issue.detail',
        distribution.total,
        { mentions: top.count, needed: MIN_MENTIONS_FOR_THEME },
      ),
    });
  }

  // --- rating movement ------------------------------------------------------
  if (previous && latest.rating !== null && previous.rating !== null) {
    const delta = round(latest.rating - previous.rating, 2);
    const move = {
      previous: stars(previous.rating),
      current: stars(latest.rating),
      delta,
    };
    if (delta <= RATING_DROP_ATTENTION) {
      signals.push({
        key: 'rating_drop',
        level: 'ATTENTION',
        label: t('intelligence.health.signal.rating_drop_attention.label'),
        detail: t('intelligence.health.signal.rating_drop_attention.detail', {
          ...move,
          threshold: Math.abs(RATING_DROP_ATTENTION),
        }),
      });
    } else if (delta <= RATING_DROP_WATCH) {
      signals.push({
        key: 'rating_drop',
        level: 'WATCH',
        label: t('intelligence.health.signal.rating_drop_watch.label'),
        detail: t('intelligence.health.signal.rating_drop_watch.detail', move),
      });
    }
  }

  // --- reply gap ------------------------------------------------------------
  const unansweredShare = safeShare(latest.unansweredCount, latest.reviewCount);
  if (unansweredShare !== null && (latest.unansweredCount ?? 0) > 0) {
    const gap = {
      unanswered: String(latest.unansweredCount),
      total: String(latest.reviewCount),
      share: pct(unansweredShare),
    };
    if (unansweredShare >= UNANSWERED_SHARE_ATTENTION) {
      signals.push({
        key: 'reply_gap',
        level: 'ATTENTION',
        label: t('intelligence.health.signal.reply_gap_attention.label'),
        detail: t('intelligence.health.signal.reply_gap_attention.detail', {
          ...gap,
          threshold: pct(UNANSWERED_SHARE_ATTENTION),
        }),
      });
    } else if (unansweredShare >= UNANSWERED_SHARE_WATCH) {
      // Again a level, not a direction: the share at this check-in only. The
      // old "backlog building" claimed a movement nothing here measured.
      signals.push({
        key: 'reply_gap',
        level: 'WATCH',
        label: t('intelligence.health.signal.reply_gap_watch.label'),
        detail: t('intelligence.health.signal.reply_gap_watch.detail', {
          ...gap,
          threshold: pct(UNANSWERED_SHARE_WATCH),
        }),
      });
    }
  }

  // --- our own data going stale --------------------------------------------
  const age = daysBetween(now, latest.capturedAt);
  if (age >= STALE_SNAPSHOT_ATTENTION_DAYS) {
    signals.push({
      key: 'stale_data',
      level: 'ATTENTION',
      label: t('intelligence.health.signal.stale_attention.label'),
      detail: t('intelligence.health.signal.stale_attention.detail', {
        days: age,
        limit: STALE_SNAPSHOT_ATTENTION_DAYS,
      }),
    });
  } else if (age >= STALE_SNAPSHOT_WATCH_DAYS) {
    signals.push({
      key: 'stale_data',
      level: 'WATCH',
      label: t('intelligence.health.signal.stale_watch.label'),
      detail: t('intelligence.health.signal.stale_watch.detail', {
        days: age,
        limit: STALE_SNAPSHOT_WATCH_DAYS,
      }),
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
      label: t('intelligence.health.signal.low_velocity.label'),
      detail: t('intelligence.health.signal.low_velocity.detail', {
        perWeek: String(latest.reviewsPerWeek),
        expected: LOW_VELOCITY_PER_WEEK,
      }),
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
  // EN is correct as the default: the operator console is not localized.
  const t = input.t ?? EN;
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
      ? t('intelligence.health.coverage.none')
      : ordered.length === 1
        ? t.plural('intelligence.health.coverage.single', totalFeedbackStored)
        : t.plural('intelligence.health.coverage.many', totalFeedbackStored, {
            checkins: ordered.length,
            days: daysBetween(
              latest.capturedAt,
              (first as StoredSnapshot).capturedAt,
            ),
          }),
  };

  const distribution = summariseDistribution(latest?.feedback ?? [], t);
  const topIssues = latest ? summariseThemes(latest.feedback, pack, 'issues') : [];
  const topPraises = latest
    ? summariseThemes(latest.feedback, pack, 'praises')
    : [];
  const trend = computeTrend(ordered, t);

  if (!hasJudgeableData(latest)) {
    return {
      status: 'INSUFFICIENT_DATA',
      statusLabel: statusLabelOf('INSUFFICIENT_DATA', t),
      statusSummary: !latest
        ? t('intelligence.health.summary.no_checkin')
        : t('intelligence.health.summary.nothing_to_judge'),
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
  const signals = buildSignals(
    snapshot,
    previous,
    distribution,
    topIssues,
    now,
    pack,
    t,
  );

  const hasAttention = signals.some((s) => s.level === 'ATTENTION');
  const status: HealthStatus = hasAttention
    ? 'ATTENTION'
    : signals.length > 0
      ? 'WATCH'
      : 'HEALTHY';

  const statusSummary =
    status === 'HEALTHY'
      ? t.plural('intelligence.health.summary.healthy', distribution.total)
      : t.plural('intelligence.health.summary.flagged', signals.length, {
          labels: signals.map((s) => s.label.toLowerCase()).join('; '),
        });

  return {
    status,
    statusLabel: statusLabelOf(status, t),
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

function toPeriod(
  snapshot: StoredSnapshot,
  pack: Pack,
  t: PortalTranslator,
): PulsePeriod {
  return {
    snapshotId: snapshot.id,
    // House date format, never an ISO string: this label is read out loud in
    // sentences like "your check-ins of 1 Mar and 1 Apr", and "2026-03-01"
    // among human dates reads as a machine leaking through.
    label: snapshot.label ?? formatDate(snapshot.capturedAt),
    capturedAt: snapshot.capturedAt,
    feedbackCount: snapshot.feedback.length,
    distribution: summariseDistribution(snapshot.feedback, t),
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
  const t = input.t ?? EN;
  const ordered = sortedNewestFirst(input.snapshots);
  const currentSnapshot = ordered[0];
  const previousSnapshot = ordered[1];

  if (!currentSnapshot) {
    return {
      available: false,
      reason: t('intelligence.health.pulse.no_checkin'),
      direction: 'NONE',
      directionLabel: trendLabelOf('NONE', t),
      current: null,
      previous: null,
      periodDays: null,
      metrics: [],
      notableChanges: [],
      sampleWarning: null,
    };
  }

  const current = toPeriod(currentSnapshot, pack, t);

  if (!previousSnapshot) {
    return {
      available: false,
      reason: t('intelligence.health.pulse.one_checkin'),
      direction: 'NONE',
      directionLabel: trendLabelOf('NONE', t),
      current,
      previous: null,
      periodDays: null,
      metrics: [],
      notableChanges: [],
      sampleWarning: null,
    };
  }

  const previous = toPeriod(previousSnapshot, pack, t);
  const metrics = buildTrendMetrics(currentSnapshot, previousSnapshot, t);
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
        note: t.plural('intelligence.health.pulse.count_note', nowCount, {
          previousCount: thenCount,
        }),
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
    reason: t('intelligence.health.pulse.comparing', {
      previous: previous.label,
      current: current.label,
    }),
    direction,
    directionLabel: trendLabelOf(direction, t),
    current,
    previous,
    periodDays: daysBetween(currentSnapshot.capturedAt, previousSnapshot.capturedAt),
    metrics,
    notableChanges,
    sampleWarning: tooSmall
      ? t.plural(
          'intelligence.health.pulse.small_numbers',
          previous.feedbackCount,
          {
            currentCount: current.feedbackCount,
            needed: MIN_FEEDBACK_FOR_TREND_CLAIMS,
          },
        )
      : null,
  };
}
