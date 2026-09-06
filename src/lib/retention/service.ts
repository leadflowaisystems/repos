import { after } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { evidenceDateOf } from '@/lib/improve/service';
import { currentUserId, isMissingDbFunction, withRlsContext } from '@/lib/db';

/**
 * SINCE YOU WERE LAST HERE (M21).
 *
 * The honest reason to come back, and the only one RepOS is willing to use.
 *
 * There are no streaks here, no badges, no points, no counter running down, and
 * nothing that is worth more today than it will be on Friday. Those work by
 * manufacturing a cost for not returning; what is below reports a fact that
 * either exists or does not — customers said things while you were away, and
 * here is what RepOS did with them. When nothing happened, this renders
 * nothing at all rather than inventing a reason to be on screen.
 *
 * THE ORDER MATTERS. The page reads `lastSeenAt` while rendering and the visit
 * is stamped afterwards, from the same post-response hook that reads new
 * feedback. So "since your last visit" describes the PREVIOUS visit, which is
 * the only reading of it that is true. Stamped first, every visit would report
 * nothing, forever.
 */

export type MeasuredSince = {
  id: string;
  title: string;
  /** IMPROVED | WORSENED | NO_CLEAR_CHANGE | INSUFFICIENT_DATA. */
  result: string;
};

export type SinceLastVisit = {
  lastSeenAt: Date;
  daysAgo: number;
  /** Feedback that arrived while they were away. */
  arrived: number;
  /** How much of it RepOS has finished reading. */
  read: number;
  /** Improvements that reached a result while they were away. */
  measured: MeasuredSince[];
  /** Improvements the business marked done while they were away. */
  done: number;
};

const DAY = 86_400_000;

/**
 * When this person last opened this business's workspace, or null the first
 * time. Read with the caller's own identity, so it is their visit and not
 * somebody else's.
 */
export async function lastSeenAt(
  db: PrismaClient,
  clientId: string,
  userId: string,
): Promise<Date | null> {
  const membership = await db.membership.findFirst({
    where: { clientId, userId, status: 'ACTIVE' },
    select: { lastSeenAt: true },
  });
  return membership?.lastSeenAt ?? null;
}

/**
 * Records that this person has been here.
 *
 * Through `app.touch_membership` because `membership_write` asks for
 * BUSINESS_OWNER and a staff member is not one — and widening that policy so
 * they could stamp their own row would also let them edit their own role. The
 * function writes one column, on the caller's own row, and nothing else.
 *
 * BOTH PATHS MUST MEAN THE SAME THING, and for a while they did not. The
 * function narrows its UPDATE to `"userId" = app.current_user_id()`; the
 * fallback below narrowed only by client, so where the DDL was absent one
 * person opening the workspace stamped every colleague as having been there
 * too. Nobody lost data, but "since your last visit" then reported an empty
 * week to someone who had not visited — which is the one thing that panel
 * exists to get right.
 *
 * So the fallback resolves the caller and refuses to write without one.
 * `userId` is an argument rather than always resolved here because the only
 * production path is the definer function, which derives the identity inside
 * the database; passing it explicitly is what lets a test exercise the fallback
 * as a named person rather than as nobody.
 *
 * Never throws. Failing to record a visit is not worth failing a page load
 * over, and the worst consequence is one "since your last visit" that reaches
 * back further than it should.
 */
export async function touchLastSeen(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date; userId?: string | null } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  try {
    await withRlsContext(db, async (tx) => {
      await tx.$executeRaw`SELECT app.touch_membership(${clientId}::text, ${now.toISOString()}::text)`;
    });
    return;
  } catch (error) {
    if (!isMissingDbFunction(error)) return;
  }

  // Only where rls.sql has not been applied: one role owns everything, so the
  // narrowing the function would have done has to be written out here.
  const who = options.userId === undefined ? await currentUserId() : options.userId;
  // No identity, no stamp. Writing to every member of the business would be
  // worse than not recording the visit at all.
  if (!who) return;
  try {
    await db.membership.updateMany({
      where: { clientId, userId: who, status: 'ACTIVE' },
      data: { lastSeenAt: now },
    });
  } catch {
    // Not worth a page for.
  }
}

/**
 * What happened while they were away, or null when there is nothing to say.
 *
 * Null covers three cases and they are deliberately not distinguished on the
 * page: a first visit, a visit minutes after the last one, and a genuinely
 * quiet week. In all three the correct thing to show is nothing.
 */
export async function sinceLastVisit(
  db: PrismaClient,
  clientId: string,
  userId: string,
  options: { now?: Date } = {},
): Promise<SinceLastVisit | null> {
  const since = await lastSeenAt(db, clientId, userId);
  if (!since) return null;

  const now = options.now ?? new Date();
  const [rows, measured, done] = await Promise.all([
    db.reviewItem.findMany({
      where: { clientId },
      select: {
        reviewDate: true,
        createdAt: true,
        analysisStatus: true,
        analysisVersion: true,
      },
    }),
    db.improvementAction.findMany({
      where: { clientId, measuredAt: { gt: since }, result: { not: null } },
      orderBy: { measuredAt: 'desc' },
      take: 3,
      select: { id: true, title: true, result: true },
    }),
    db.improvementAction.count({ where: { clientId, doneAt: { gt: since } } }),
  ]);

  // The evidence date, the same rule the measurement engine splits on: the
  // customer's own date where it was parsed, otherwise when it arrived.
  const arrived = rows.filter((row) => evidenceDateOf(row).getTime() > since.getTime());
  const read = arrived.filter(
    (row) => row.analysisStatus === 'ANALYSED' && row.analysisVersion >= ANALYSIS_VERSION,
  ).length;

  const summary: SinceLastVisit = {
    lastSeenAt: since,
    daysAgo: Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY)),
    arrived: arrived.length,
    read,
    measured: measured.map((m) => ({ id: m.id, title: m.title, result: m.result ?? '' })),
    done,
  };

  const nothingHappened =
    summary.arrived === 0 && summary.measured.length === 0 && summary.done === 0;
  return nothingHappened ? null : summary;
}

/** How the gap reads in a heading. Never a countdown, never a nudge. */
export function sinceLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'Since you were last here today';
  if (daysAgo === 1) return 'Since yesterday';
  if (daysAgo < 7) return `Since your last visit, ${daysAgo} days ago`;
  if (daysAgo < 14) return 'Since your last visit, a week ago';
  if (daysAgo < 60) return `Since your last visit, ${Math.round(daysAgo / 7)} weeks ago`;
  return `Since your last visit, ${Math.round(daysAgo / 30)} months ago`;
}

/**
 * Records the visit once the page has been served.
 *
 * Same post-response hook the feedback pipeline uses, and for the same reason:
 * a visit is not worth a millisecond of somebody's page load. Outside a request
 * — a script, a test — there is no response to wait for, so it runs at once.
 *
 * Ids are cuids. Anything else is not a client and records nothing.
 */
const CLIENT_ID = /^[a-z0-9]{10,64}$/i;

export function recordVisit(db: PrismaClient, clientId: string): void {
  if (!CLIENT_ID.test(clientId)) return;
  const run = () => touchLastSeen(db, clientId);
  try {
    after(run);
  } catch {
    void run();
  }
}
