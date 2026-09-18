import type { PrismaClient } from '@prisma/client';
import { listActionsWithProgress, measureClientAction } from './service';

/**
 * HEADWAY MEASURES A CHANGE ITSELF, ONCE THE EVIDENCE IS THERE.
 *
 * The weak link in the loop was a person. An owner marked a change done, new
 * customers wrote in, and the before-and-after — the only moment in this
 * product that shows whether acting on feedback helped — waited until someone
 * in the operator console remembered to press Measure. On a phone, that
 * looked like Headway had stopped watching.
 *
 * NO NEW MACHINERY. This is called from the pipeline that already runs after
 * a customer submits and after a workspace is opened (`pipeline/trigger.ts`),
 * with the handle that run already holds: scoped to one client, no person,
 * Row Level Security choosing the rows. It calls the same `measureClientAction`
 * the console's button calls. There is no scheduler, no queue and no cron.
 *
 * WHAT IT MEASURES, AND WHAT IT LEAVES ALONE.
 *
 *   - Only actions the owner said are DONE. Nothing that was merely agreed,
 *     paused or declined is ever measured.
 *   - Only when `canMeasure` says so: at least MIN_FEEDBACK_TO_MEASURE new,
 *     read feedback entries since the change. Below that floor the page keeps
 *     saying "too early to tell" with the counts, which is the honest answer;
 *     measuring early would file a verdict of "not enough" and move the change
 *     off the watching shelf for no reason.
 *   - Only the FIRST measurement. A change measured once becomes MEASURED and
 *     drops out of the candidates, so this runs at most once per change. A
 *     re-measurement a month later is still a person's call in the console,
 *     because a verdict that silently rewrites itself every week is not one an
 *     owner can remember.
 *
 * COST. One indexed query per run in the common case — `@@index([clientId,
 * status])` — and only when a DONE action exists does it read further. It runs
 * after the response has gone, so nobody waits on it.
 */
export async function measureReadyActions(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<{ measured: string[] }> {
  const waiting = await db.improvementAction.count({
    where: { clientId, status: 'DONE' },
  });
  if (waiting === 0) return { measured: [] };

  const progress = await listActionsWithProgress(db, clientId);
  const ready = progress.filter((p) => p.action.status === 'DONE' && p.canMeasure);

  const measured: string[] = [];
  for (const p of ready) {
    // One at a time: a handful at most, and a failure on one must not stop
    // the rest from being read. The service validates the transition itself,
    // so a change moved by a person in the meantime is simply refused.
    const result = await measureClientAction(db, clientId, p.action.id, options);
    if (result.ok) measured.push(p.action.id);
  }
  return { measured };
}
