import { TIER_LIMITED_MIN } from '@/lib/analysis/aggregate';

/**
 * HEALTH + PULSE RULES.
 *
 * Every threshold RepOS uses to decide a client's status or trend lives here,
 * as a named constant with a stated reason. There is no score, no weighting
 * model and no AI involvement: a status is the plain consequence of one or more
 * named signals firing, and each signal reports the real numbers that fired it.
 *
 * If you change a number here, the reported reason text changes with it,
 * because the reasons are generated from these constants.
 */

// ---------------------------------------------------------------------------
// Evidence floors
// ---------------------------------------------------------------------------

/**
 * Below this many stored feedback items, RepOS will not state a sentiment share
 * or let sentiment drive a status. Same floor the report engine uses, so the
 * Health Card and the printed Pulse never disagree about what counts as enough.
 */
export const MIN_FEEDBACK_FOR_SHARE_CLAIMS = TIER_LIMITED_MIN; // 10

/**
 * Below this many items on EITHER side, a period-over-period sentiment change
 * is reported as a raw count only and is explicitly labelled as too small to
 * read as a trend.
 */
export const MIN_FEEDBACK_FOR_TREND_CLAIMS = TIER_LIMITED_MIN; // 10

// ---------------------------------------------------------------------------
// Status signals — negative sentiment
// ---------------------------------------------------------------------------

/** Roughly one in three pieces of feedback negative: the business has a problem. */
export const NEGATIVE_SHARE_ATTENTION = 0.3;
/** Roughly one in five negative: worth watching, not yet an emergency. */
export const NEGATIVE_SHARE_WATCH = 0.2;

// ---------------------------------------------------------------------------
// Status signals — rating movement
// ---------------------------------------------------------------------------

/** A drop of 0.2 stars between snapshots is large for a local listing. */
export const RATING_DROP_ATTENTION = -0.2;
/** Anything below -0.05 is a real downward move rather than rounding. */
export const RATING_DROP_WATCH = -0.05;

// ---------------------------------------------------------------------------
// Status signals — reply gap
// ---------------------------------------------------------------------------

/** Half or more of reviews unanswered reads as an abandoned listing. */
export const UNANSWERED_SHARE_ATTENTION = 0.5;
/** One in five unanswered is a backlog worth clearing. */
export const UNANSWERED_SHARE_WATCH = 0.2;

// ---------------------------------------------------------------------------
// Status signals — freshness of our own data
// ---------------------------------------------------------------------------

/** Past this, the Health Card is describing history, not the present. */
export const STALE_SNAPSHOT_ATTENTION_DAYS = 90;
/** A monthly service that has not been measured in two months is drifting. */
export const STALE_SNAPSHOT_WATCH_DAYS = 60;

// ---------------------------------------------------------------------------
// Status signals — collection velocity
// ---------------------------------------------------------------------------

/** Fewer than one new review a month means the kit is not working. */
export const LOW_VELOCITY_PER_WEEK = 0.25;

// ---------------------------------------------------------------------------
// Trend thresholds
// ---------------------------------------------------------------------------

/** Rating moves smaller than this are treated as flat, not as a trend. */
export const TREND_RATING_DELTA = 0.1;
/** Share moves smaller than 5 percentage points are treated as flat. */
export const TREND_SHARE_DELTA = 0.05;

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type HealthStatus =
  | 'HEALTHY'
  | 'WATCH'
  | 'ATTENTION'
  | 'INSUFFICIENT_DATA';

export type SignalLevel = 'ATTENTION' | 'WATCH';

export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'NONE';

export const STATUS_LABELS: Record<HealthStatus, string> = {
  HEALTHY: 'Healthy',
  WATCH: 'Watch',
  ATTENTION: 'Attention',
  INSUFFICIENT_DATA: 'Insufficient data',
};

export const STATUS_DESCRIPTIONS: Record<HealthStatus, string> = {
  HEALTHY: 'Nothing in the stored data is currently flagging.',
  WATCH: 'Something is moving in the wrong direction but is not urgent.',
  ATTENTION: 'At least one signal needs acting on this month.',
  INSUFFICIENT_DATA:
    'There is not enough stored data to say anything honest about this client yet.',
};

export const TREND_LABELS: Record<TrendDirection, string> = {
  IMPROVING: 'Improving',
  STABLE: 'Stable',
  DECLINING: 'Declining',
  NONE: 'No trend available',
};
