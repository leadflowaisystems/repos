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
