import type { StoredFeedback, StoredSnapshot } from '@/lib/health/health';
import { MIN_FEEDBACK_FOR_TREND_CLAIMS } from '@/lib/health/rules';

/**
 * AUTOMATIC CHECK-INS (evidence ladder pass, Oct 2026).
 *
 * A trend compares two check-ins, and until now only an operator could record
 * one. Real businesses had none, so their owners were told "Trends aren't ready
 * yet — responses waiting for your first check-in", as if a hidden chore of
 * theirs was holding the product back. Nothing about a trend needs a person:
 * it needs two comparable sets of read feedback. So Headway now draws those
 * sets itself.
 *
 * DERIVED, NEVER STORED. An automatic check-in is not a row. It is computed
 * from the read feedback every time it is asked for, the same way every other
 * reading in this product is ("nothing is stored beyond the analysis
 * columns"). That makes it retroactive — a business with a year of feedback
 * has its history of comparable periods the moment this ships — and it means
 * no background job, no race between two runs and no migration.
 *
 * THE RULE. Walking the read feedback that arrived after the latest
 * operator check-in (or all of it, when there is none) in the order it
 * arrived, a period closes at the first response that gives it BOTH
 *
 *   - at least AUTO_PERIOD_MIN_RESPONSES read responses — the same floor every
 *     share comparison already needs on each side (`MIN_FEEDBACK_FOR_TREND_CLAIMS`),
 *     so an automatic period is never "too thin" to compare by construction; and
 *   - at least AUTO_PERIOD_MIN_DAYS between its first response and that one, so
 *     a busy launch day is one period rather than three, and a "trend" is a
 *     change over time rather than between lunch and dinner.
 *
 * Whatever has arrived since the last period closed belongs to the next one,
 * exactly as feedback after an operator's latest check-in always has.
 *
 * NOTHING ABOUT THE COMPARISON CHANGES. The periods are handed to the same
 * pulse and intelligence engines as operator check-ins, which compare shares
 * with the one rule (`health/compare.ts`) and its floors. Automatic periods
 * only decide WHERE the boundaries fall.
 *
 * WHAT STAYS THE OPERATOR'S. An operator check-in also records what they saw
 * on the public listing (rating, review count, unanswered reviews). Automatic
 * periods observe no listing, so the health card keeps reading operator
 * check-ins only; an operator check-in remains a boundary like any other, and
 * automatic periods begin after the latest one.
 *
 * Pure: no database, no clock.
 */

/** Each automatic period holds at least this many read responses. */
export const AUTO_PERIOD_MIN_RESPONSES = MIN_FEEDBACK_FOR_TREND_CLAIMS;

/** …collected over at least this many days, first response to last. */
export const AUTO_PERIOD_MIN_DAYS = 7;

/** Automatic periods are recognisable by id, and only by id. */
export const AUTO_PERIOD_ID_PREFIX = 'auto:';

const DAY_MS = 86_400_000;

/** One read response, as the period builder needs it. */
export type PeriodRow = {
  id: string;
  /** When it reached Headway — the date a check-in window is cut on. */
  createdAt: Date;
  feedback: StoredFeedback;
};

export function isAutomaticPeriod(snapshot: { id: string }): boolean {
  return snapshot.id.startsWith(AUTO_PERIOD_ID_PREFIX);
}

function periodOf(rows: PeriodRow[]): StoredSnapshot {
  const last = rows[rows.length - 1]!;
  return {
    id: `${AUTO_PERIOD_ID_PREFIX}${last.createdAt.toISOString()}`,
    label: null,
    capturedAt: last.createdAt,
    // Nothing was observed on a public listing: these are unknown, never zero.
    rating: null,
    reviewCount: null,
    unansweredCount: null,
    reviewsPerWeek: null,
    daysSinceLastPost: null,
    photoRecencyDays: null,
    generatedAt: null,
    feedback: rows.map((r) => r.feedback),
  };
}

/**
 * The closed automatic periods in a run of read responses, oldest first.
 *
 * Responses that share a timestamp with the one that closes a period close
 * with it, so the result agrees with the window rule the stored check-ins use
 * ("arrived at or before the moment of the check-in").
 */
export function automaticPeriods(
  rows: PeriodRow[],
  options: { minResponses?: number; minDays?: number } = {},
): StoredSnapshot[] {
  const minResponses = options.minResponses ?? AUTO_PERIOD_MIN_RESPONSES;
  const minSpan = (options.minDays ?? AUTO_PERIOD_MIN_DAYS) * DAY_MS;
  const sorted = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );

  const periods: StoredSnapshot[] = [];
  let start = 0;
  while (start < sorted.length) {
    const first = sorted[start]!.createdAt.getTime();
    let end = -1;
    for (let i = start; i < sorted.length; i += 1) {
      const held = i - start + 1;
      if (held >= minResponses && sorted[i]!.createdAt.getTime() - first >= minSpan) {
        end = i;
        break;
      }
    }
    // Not enough yet, or not over long enough: the open period. It is
    // "since the last check-in", and waits for more.
    if (end === -1) break;
    const closing = sorted[end]!.createdAt.getTime();
    while (end + 1 < sorted.length && sorted[end + 1]!.createdAt.getTime() === closing) end += 1;
    periods.push(periodOf(sorted.slice(start, end + 1)));
    start = end + 1;
  }
  return periods;
}

/**
 * Operator check-ins and automatic periods, as one list of comparison points,
 * newest first — the order `loadHealthSnapshots` returns.
 *
 * `readRows` are the business's read responses that arrived on their own (not
 * pasted into a check-in). Only those after the latest operator check-in form
 * automatic periods: everything earlier already belongs to an operator
 * check-in's window.
 */
export function withAutomaticPeriods(
  operator: StoredSnapshot[],
  readRows: Array<PeriodRow & { snapshotId: string | null }>,
  options: { minResponses?: number; minDays?: number } = {},
): StoredSnapshot[] {
  const latest = operator.reduce<number | null>(
    (max, s) => (max === null || s.capturedAt.getTime() > max ? s.capturedAt.getTime() : max),
    null,
  );
  const after = readRows.filter(
    (row) => row.snapshotId === null && (latest === null || row.createdAt.getTime() > latest),
  );
  const automatic = automaticPeriods(after, options);
  return [...operator, ...automatic].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
}
