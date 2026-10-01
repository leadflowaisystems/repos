import {
  MIN_FEEDBACK_FOR_TREND_CLAIMS,
  MIN_MENTIONS_FOR_TREND_CLAIMS,
  TREND_MIN_Z,
  TREND_SHARE_DELTA,
} from './rules';

/**
 * ONE RULE FOR "DID THIS CHANGE?" (intelligence quality pass, Sep 2026).
 *
 * Every comparison Headway makes between two piles of feedback — a topic
 * between two check-ins, a topic before and after a fix, the unhappy share on
 * the Health card, a topic this week against last — asks the same question,
 * and before this pass they answered it three different ways. The per-topic
 * trend compared RAW MENTION COUNTS, which is wrong whenever the two piles
 * differ in size: 5 of 10 then and 10 of 20 now is the same half of customers,
 * and it was reported as "worse, up 5". Proven, and fixed here, once.
 *
 * The rule, in order — the first that applies is the answer:
 *
 *   TOO_THIN            either side holds fewer than
 *                       MIN_FEEDBACK_FOR_TREND_CLAIMS (10) pieces of feedback.
 *                       A share of five is not a share.
 *   TOO_FEW_MENTIONS    neither side reaches MIN_MENTIONS_FOR_TREND_CLAIMS (3)
 *                       mentions. Two to none is a large percentage of almost
 *                       nothing.
 *   FLAT                the share moved by less than TREND_SHARE_DELTA (five
 *                       percentage points). Genuinely compared, genuinely the
 *                       same — a different statement from "cannot tell".
 *   UNCLEAR             it moved by more than that, but not by enough, on this
 *                       much feedback, to rule out chance: the two-proportion
 *                       z-score is under TREND_MIN_Z. Reported as "cannot call
 *                       it yet", never as flat and never as a direction.
 *   ROSE / FELL         the share moved past both bars.
 *
 * THE Z-SCORE, in full, so it can be checked by hand:
 *
 *   p₁ = m₁/n₁, p₂ = m₂/n₂, p̄ = (m₁+m₂)/(n₁+n₂)
 *   z  = (p₂ − p₁) / √( p̄(1−p̄)(1/n₁ + 1/n₂) )
 *
 * TREND_MIN_Z is 1.28 — the 80% two-sided bar. Deliberately not 1.96: at the
 * volumes a local business collects, a 95% bar would almost never be met and
 * the owner would never hear anything. What keeps 80% honest is everything
 * around it: both totals are always stated, the move must also clear five
 * points, and a direction is always worded as what the feedback shows, never
 * as a cause.
 *
 * Pure: no database, no clock.
 */

export type ShareVerdict = 'TOO_THIN' | 'TOO_FEW_MENTIONS' | 'FLAT' | 'UNCLEAR' | 'ROSE' | 'FELL';

export type ShareSide = { count: number; total: number };

export type ShareComparison = {
  verdict: ShareVerdict;
  /** m/n, or null when the side holds no feedback at all. */
  before: number | null;
  after: number | null;
  /** after − before, rounded to four places; null when either share is. */
  delta: number | null;
  /** The two-proportion z-score; null when it was never needed or is undefined. */
  z: number | null;
};

export type CompareOptions = {
  /** Feedback each side needs. Defaults to MIN_FEEDBACK_FOR_TREND_CLAIMS. */
  minTotal?: number;
  /** Mentions at least one side needs. Defaults to MIN_MENTIONS_FOR_TREND_CLAIMS. */
  minCount?: number;
};

const shareOf = (side: ShareSide): number | null => (side.total > 0 ? side.count / side.total : null);

/** The pooled two-proportion z-score, or null when it is undefined (no spread). */
export function twoProportionZ(before: ShareSide, after: ShareSide): number | null {
  if (before.total <= 0 || after.total <= 0) return null;
  const pooled = (before.count + after.count) / (before.total + after.total);
  const variance = pooled * (1 - pooled) * (1 / before.total + 1 / after.total);
  if (variance <= 0) return null;
  return (after.count / after.total - before.count / before.total) / Math.sqrt(variance);
}

export function compareShares(
  before: ShareSide,
  after: ShareSide,
  options: CompareOptions = {},
): ShareComparison {
  const minTotal = options.minTotal ?? MIN_FEEDBACK_FOR_TREND_CLAIMS;
  const minCount = options.minCount ?? MIN_MENTIONS_FOR_TREND_CLAIMS;
  const p1 = shareOf(before);
  const p2 = shareOf(after);
  const delta = p1 !== null && p2 !== null ? Number((p2 - p1).toFixed(4)) : null;
  const base = { before: p1, after: p2, delta, z: null };

  if (before.total < minTotal || after.total < minTotal || delta === null) {
    return { ...base, verdict: 'TOO_THIN' };
  }
  if (Math.max(before.count, after.count) < minCount) {
    return { ...base, verdict: 'TOO_FEW_MENTIONS' };
  }
  if (Math.abs(delta) < TREND_SHARE_DELTA) {
    return { ...base, verdict: 'FLAT' };
  }
  const z = twoProportionZ(before, after);
  if (z === null || Math.abs(z) < TREND_MIN_Z) {
    return { ...base, z, verdict: 'UNCLEAR' };
  }
  return { ...base, z, verdict: delta > 0 ? 'ROSE' : 'FELL' };
}

/** Whole percent, for sentences: 0.4999 → 50. */
export function wholePercent(share: number | null): number | null {
  return share === null ? null : Math.round(share * 100);
}
