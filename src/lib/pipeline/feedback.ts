import type { PrismaClient } from '@prisma/client';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { triageClientFeedback } from '@/lib/feedback/replies';
import { PROCESSING_STALE_MS } from '@/lib/feedback/state';

/**
 * THE FEEDBACK PIPELINE, AS ONE CALL.
 *
 *   customer submits → row stored → (here) read → understood → sorted for a
 *   reply → every owner page recomputes from the columns on its next render.
 *
 * Nothing is stored beyond the analysis columns: the intelligence, the home
 * page and the check-in are computed from those rows every time they are
 * asked for, so once a row is ANALYSED every view is already up to date.
 *
 * Idempotent and safe to run twice: the analysis claims each item before it
 * reads it and skips anything already read by the current engine, and the
 * triage only touches rows the analysis has finished. The customer's own
 * words are never modified by either.
 */

/** How many items one background run reads. Enough for a busy day; bounded so a run ends. */
export const PIPELINE_BATCH = 50;

export type PipelineResult = {
  ok: boolean;
  analysed: number;
  needsRetry: number;
  /** Claimed by another run that is still going. */
  inProgress: number;
  skippedUpToDate: number;
  triaged: number;
  usedAi: boolean;
  /** Plain-language, safe for a log. Never a key. */
  notes: string[];
};

/**
 * Whether anything for this client is waiting on RepOS: never read, failed,
 * read by an older engine, or claimed by a run that went quiet.
 *
 * One indexed count. Cheap enough to ask on every visit, off the response path.
 */
export async function hasUnprocessedFeedback(
  db: PrismaClient,
  clientId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_MS);
  const waiting = await db.reviewItem.count({
    where: {
      clientId,
      OR: [
        { analysisStatus: { in: ['PENDING', 'FAILED'] } },
        { analysisStatus: 'ANALYSED', analysisVersion: { lt: ANALYSIS_VERSION } },
        { analysisStatus: 'PROCESSING', updatedAt: { lt: staleBefore } },
      ],
    },
  });
  return waiting > 0;
}

export async function processClientFeedback(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date; limit?: number; useAi?: boolean } = {},
): Promise<PipelineResult> {
  const analysis = await analyseClientFeedback(db, clientId, {
    limit: options.limit ?? PIPELINE_BATCH,
    now: options.now,
    useAi: options.useAi,
  });
  if (!analysis.ok) {
    return {
      ok: false,
      analysed: 0,
      needsRetry: 0,
      inProgress: 0,
      skippedUpToDate: 0,
      triaged: 0,
      usedAi: false,
      notes: [analysis.message],
    };
  }

  // Sorting what was just read into "needs a reply" is deterministic and
  // reads only the analysis columns, so it belongs in the same run: an owner
  // never sees a review that is read but not yet sorted.
  let triaged = 0;
  if (analysis.data.analysed > 0) {
    const triage = await triageClientFeedback(db, clientId, { now: options.now });
    if (triage.ok) triaged = triage.data.triaged;
  }

  return {
    ok: true,
    analysed: analysis.data.analysed,
    needsRetry: analysis.data.needsRetry,
    inProgress: analysis.data.inProgress,
    skippedUpToDate: analysis.data.skippedUpToDate,
    triaged,
    usedAi: analysis.data.usedAi,
    notes: analysis.data.notes,
  };
}
