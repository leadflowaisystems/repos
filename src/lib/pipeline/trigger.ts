import { after } from 'next/server';
import { serviceScopedDb } from '@/lib/db';
import { hasUnprocessedFeedback, isServiceSuspended, processClientFeedback } from './feedback';

/**
 * WHEN THE PIPELINE RUNS.
 *
 * Two moments, both after the response has gone out, so no customer and no
 * owner ever waits on a reading:
 *
 *   SUBMITTED  a customer has just sent feedback. The run starts once the
 *              thank-you page is on its way and is normally done within
 *              seconds; the owner's next page load shows it read.
 *   VISIT      somebody opened this business's workspace or console. A
 *              catch-up: if anything is waiting — a retry, a reading from an
 *              older engine, a claim a killed run never released — it is read
 *              now. When nothing is waiting this costs one indexed count, and
 *              still not on the response path.
 *
 * WHO THE RUN IS. Nobody. A customer has no account and a job has no session,
 * so the run reaches the database through a handle scoped to exactly this
 * client — see `serviceScopedDb` — and Row Level Security shows it that
 * client's rows and no others. The id is never taken from a URL here: the
 * gateway resolved it from the customer's token inside the database, or a
 * tenant gate has already admitted the visitor to it.
 *
 * WHEN IT DOES NOT RUN. A paused or closed account keeps collecting feedback
 * and stops being read — see `isServiceSuspended`. Nothing is discarded; the
 * rows wait, and the first run after the account resumes reads them.
 *
 * `after()` is Next's own post-response hook: on Vercel the function stays
 * alive until the callback settles, and the route declares a `maxDuration`
 * long enough for a batch and a provider round trip. Outside a request — a
 * script, a test — there is no response to wait for, so the run starts at
 * once instead.
 */
export type TriggerReason = 'SUBMITTED' | 'VISIT';

/** Ids are cuids. Anything else is not a client and starts nothing. */
const CLIENT_ID = /^[a-z0-9]{10,64}$/i;

export function triggerFeedbackProcessing(clientId: string, reason: TriggerReason): void {
  if (!CLIENT_ID.test(clientId)) return;

  const run = async () => {
    try {
      const db = serviceScopedDb(clientId);
      // A paused account still collects. It does not get read until it is
      // resumed, and then the backlog is read in the ordinary way.
      if (await isServiceSuspended(db, clientId)) return;
      if (reason === 'VISIT' && !(await hasUnprocessedFeedback(db, clientId))) return;
      const result = await processClientFeedback(db, clientId);
      if (!result.ok || result.needsRetry > 0) {
        console.error(
          `[pipeline] ${reason} run for client ${clientId}: ${result.needsRetry} need retry. ${result.notes.join(' ')}`,
        );
      }
    } catch (error) {
      console.error(
        `[pipeline] ${reason} run for client ${clientId} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}
