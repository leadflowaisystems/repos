import type { Prisma, PrismaClient } from '@prisma/client';
import { oncePerRequest } from '@/lib/request-cache';

/**
 * ONE CLIENT'S FEEDBACK, READ ONCE PER REQUEST.
 *
 * Every intelligence-backed page asks eight different services about the same
 * rows, and until this file existed each of them went to the database for its
 * own copy: the theme summary read the analysed rows and then all rows again
 * for the tapped ratings, health read the rows that arrived between check-ins,
 * the improvement loop read the analysed dates, responsibility read the dates
 * and sources, the reply engine read the draft columns, the evidence index
 * read the words, and "since your last visit" read the dates once more. Eight
 * scans of one business's history for one screen — measured, not estimated:
 * a business with 10,000 pieces of feedback moved 80,000 rows and 13 MB out of
 * Postgres to render Home, and the same again for every other page.
 *
 * None of those readers disagreed about WHICH rows: every one of them wanted
 * this client's feedback, whole. They differed only in which columns they
 * looked at afterwards. So the rows are read once, with the union of those
 * columns, and each service filters and projects the copy it always did — in
 * memory, with the same predicates it used to send to the database. The counts,
 * the thresholds and the evidence rules are untouched, because the rows each
 * function sees are the rows it saw before; they just arrive together.
 *
 * SCOPED TO ONE CLIENT AND ONE REQUEST. The key is the client id, the query is
 * `where: { clientId }`, and underneath it Row Level Security still decides
 * what `repos_app` may see — a scan for a business the caller is not a member
 * of returns nothing, exactly as the eight scans did. The memo is React's
 * per-request `cache()` (or an explicit scope in a script), so nothing here
 * outlives the response and two people looking at two businesses never share
 * a map. See `src/lib/request-cache.ts` for why that is the whole safety
 * argument.
 *
 * WHY A WRITE CANNOT LEAVE A PAGE READING A STALE COPY. The memo lives in
 * React's per-render cache. A Server Action body runs BEFORE the re-render,
 * outside any render — Next 15.5 executes it under the request store alone,
 * and React's `cache()` hands out a throwaway map when no render is current —
 * so nothing an action reads is remembered, and the page that follows starts
 * with an empty scope and reads the rows the action left behind. The only
 * way to read a copy from before a write is for a RENDER itself to write
 * feedback rows after loading them, and no server component under the
 * workspace writes anything (`tests/perf.client-scoped.test.ts` asserts that,
 * and that the action modules do not reach for these loaders directly). The
 * pipeline's own runs use their own queries. Keep all three true.
 *
 * `text` is included because the evidence index quotes it. It is the one wide
 * column, and it is still read once instead of once per page section.
 */

export const LEDGER_SELECT = {
  id: true,
  text: true,
  stars: true,
  reviewDate: true,
  createdAt: true,
  updatedAt: true,
  analysedAt: true,
  source: true,
  snapshotId: true,
  sentiment: true,
  issueTags: true,
  praiseTags: true,
  themesJson: true,
  dimensionsJson: true,
  signalsJson: true,
  analysisStatus: true,
  analysisVersion: true,
  triageVersion: true,
  responseAction: true,
  draftStatus: true,
  draftVersion: true,
  handledAt: true,
  redacted: true,
} as const;

/** Exactly the columns above, typed from the select so the two cannot drift. */
export type LedgerRow = Prisma.ReviewItemGetPayload<{ select: typeof LEDGER_SELECT }>;

/**
 * Every piece of feedback this client holds, newest evidence first.
 *
 * The order is the one the evidence index wants — the customer's own date
 * where it was parsed, then arrival — and it is harmless to everyone else,
 * who only count. The previous eight queries carried no order at all, so no
 * reader may have depended on one.
 *
 * THE ID IS THE LAST KEY, AND IT IS NOT DECORATION. Rows pasted in one batch
 * share a `createdAt` to the microsecond, and Postgres does not promise a
 * stable order among ties: two reads of the same rows can come back in two
 * orders when the planner picks two plans. The ids inside a theme's evidence
 * list follow row order, so without a total order the same business could
 * be handed two different-looking intelligence objects for the same facts —
 * which is exactly what `tests/intelligence.service.test.ts` compares for.
 */
export function loadFeedbackLedger(db: PrismaClient, clientId: string): Promise<LedgerRow[]> {
  return oncePerRequest(`feedback-ledger:${clientId}`, () =>
    db.reviewItem.findMany({
      where: { clientId },
      select: LEDGER_SELECT,
      orderBy: [{ reviewDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    }),
  );
}

/** The rows the analysis layer has read. The predicate every "analysed" scan used. */
export function analysedRows(ledger: LedgerRow[]): LedgerRow[] {
  return ledger.filter((row) => row.analysisStatus === 'ANALYSED');
}
