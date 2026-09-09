import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';

/**
 * WHERE ONE PIECCE OF FEEDBACK STANDS WITH REPOS.
 *
 * The stored column is `analysisStatus`, and it means what the MACHINE has
 * done: nothing yet, in hand, done, or tried and failed. Nobody has to open a
 * review for it to be read — "read" in this product is RepOS reading, and it
 * happens on its own after a customer submits. Whether a person has looked at
 * a piece of feedback is a different fact and is not tracked here, so it can
 * never gate the pipeline.
 *
 *   COLLECTED   stored, not yet read — the default the gateway inserts with,
 *               a failed attempt that is due a retry, a reading left behind by
 *               an older engine, or a claim a crashed run never released.
 *   PROCESSING  a run has claimed it within the last PROCESSING_STALE_MS.
 *   ANALYSED    read by the current engine; themes, tone and language are
 *               set and the intelligence counts it.
 *   FAILED      the last attempt failed; the words are untouched and the
 *               next run will try again.
 */
export type AnalysisState = 'COLLECTED' | 'PROCESSING' | 'ANALYSED' | 'FAILED';

/**
 * How long a claim stands before another run may take the item over.
 *
 * Long enough for one batch and one slow provider round trip; short enough
 * that a function killed mid-run costs a few minutes, not a lost review.
 */
export const PROCESSING_STALE_MS = 10 * 60_000;

/**
 * How long a failed reading waits before the automatic pipeline tries again.
 *
 * A row fails when its write throws, which is usually something persistent —
 * and until this existed, "the next run will try again" meant the next PAGE
 * VIEW would try again, forever, with no attempt counter and no ceiling. One
 * stuck row could therefore spend an entire day's AI allowance on its own,
 * a few tokens at a time, and nothing on any screen would say so.
 *
 * An hour keeps a genuine transient failure self-healing within the hour
 * while capping a permanently broken row at 24 attempts a day instead of one
 * per visit. The operator's own re-read ignores this: a person who has just
 * fixed the cause should not be told to wait.
 */
export const FAILED_RETRY_COOLDOWN_MS = 60 * 60_000;

/** Read by the engine that is running now — not by an older one. */
export function isCurrentAnalysis(row: { analysisStatus: string; analysisVersion: number }): boolean {
  return row.analysisStatus === 'ANALYSED' && row.analysisVersion >= ANALYSIS_VERSION;
}

export function analysisStateOf(
  row: { analysisStatus: string; analysisVersion: number; updatedAt?: Date | null },
  now: Date = new Date(),
): AnalysisState {
  if (isCurrentAnalysis(row)) return 'ANALYSED';
  if (row.analysisStatus === 'PROCESSING') {
    const fresh = row.updatedAt ? row.updatedAt.getTime() >= now.getTime() - PROCESSING_STALE_MS : true;
    return fresh ? 'PROCESSING' : 'COLLECTED';
  }
  if (row.analysisStatus === 'FAILED') return 'FAILED';
  return 'COLLECTED';
}
