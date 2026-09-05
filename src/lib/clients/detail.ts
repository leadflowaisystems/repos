import type { PrismaClient } from '@prisma/client';
import { getClientSetup } from '@/lib/clients/service';
import { getClientHealth } from '@/lib/snapshots/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { listActionsWithProgress } from '@/lib/improve/service';
import { getOwnerComms } from '@/lib/comms/service';
import { listClientMinutes } from '@/lib/minutes/service';
import { oncePerRequest } from '@/lib/request-cache';
import { monthRange } from '@/lib/time';

/**
 * EVERYTHING THE CLIENT PAGE READS, IN TWO TRIPS INSTEAD OF NINE (M20).
 *
 * The page used to await its client row, then its setup, then a `Promise.all`
 * of seven more loaders — three awaits deep before anything could be shown, and
 * the slowest of the seven decided when the operator saw anything at all. The
 * owner's update alone composes messages from the full intelligence set, and
 * the page waited for it before drawing the business's name.
 *
 * So the read is split by what the operator is actually looking at when the
 * page opens.
 *
 * PRIMARY is the answer to "what is going on with this business" — who they
 * are, whether anything needs doing, their health, and the improvement work in
 * flight. Nothing here is optional and nothing renders without it.
 *
 * SECONDARY is everything the operator scrolls to: the drafted owner update,
 * recent minutes, the month's logged time. All useful, none of it worth
 * delaying the first screen for, so the page streams it in behind Suspense.
 *
 * WHAT THIS IS NOT. It is not a cache, not a denormalisation, and not a
 * privileged read path. Every query still goes through the same RLS-bound
 * client as `repos_app`, still carries the request's `app.user_id`, and still
 * returns nothing for a business the caller cannot see. The page is faster
 * because it asks for less at once and waits for less before drawing, not
 * because anything is trusted that was not trusted before.
 *
 * Both halves are memoised per request, so a Suspense boundary that asks twice
 * gets one read — and two different requests never share a store.
 */

export type ClientDetailPrimary = NonNullable<Awaited<ReturnType<typeof loadPrimary>>>;
export type ClientDetailSecondary = Awaited<ReturnType<typeof loadSecondary>>;

async function loadPrimary(db: PrismaClient, clientId: string) {
  // The client row and the three loaders that do not depend on it start
  // together. Waiting for the row first cost a whole round trip to Mumbai for
  // nothing: only the health calculation needs a field from it.
  const rest = Promise.all([
    getClientSetup(db, clientId),
    getResponsibility(db, clientId),
    listActionsWithProgress(db, clientId),
  ]);

  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      voiceProfile: true,
      policy: true,
      kitConfig: true,
      competitors: { orderBy: { sortIndex: 'asc' } },
      snapshots: {
        orderBy: { capturedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          label: true,
          capturedAt: true,
          rating: true,
          reviewCount: true,
          generatedAt: true,
          _count: { select: { reviews: true } },
        },
      },
    },
  });

  // Null for a client that does not exist AND for one this request may not see:
  // the policies answer both the same way, which is what stops an id in the URL
  // from telling anyone whether a business exists.
  if (!client) return null;

  const [setup, responsibility, actions] = await rest;

  // Free by the time we get here: `getResponsibility` has already pulled the
  // snapshots through the request scope, so this is a cache hit plus the pure
  // health calculation. It is sequential only because it needs the vertical,
  // which is on the client row.
  const health = await getClientHealth(db, client.id, client.vertical);

  return { client, setup, health, responsibility, actions };
}

async function loadSecondary(db: PrismaClient, clientId: string, commsLanguage: string | null) {
  const { start, end } = monthRange(new Date());
  const [comms, recentMinutes, minuteCount, timeLogged] = await Promise.all([
    getOwnerComms(db, clientId, { language: commsLanguage }),
    listClientMinutes(db, clientId, { limit: 3 }),
    db.minute.count({ where: { clientId } }),
    db.timeEntry.aggregate({
      where: { clientId, entryDate: { gte: start, lt: end } },
      _sum: { minutes: true },
      _count: true,
    }),
  ]);
  return { comms, recentMinutes, minuteCount, timeLogged };
}

/** The first screen. Everything else waits for this, and nothing else. */
export function getClientDetailPrimary(
  db: PrismaClient,
  clientId: string,
): Promise<ClientDetailPrimary | null> {
  return oncePerRequest(`client-detail-primary:${clientId}`, () => loadPrimary(db, clientId));
}

/** What streams in underneath it. */
export function getClientDetailSecondary(
  db: PrismaClient,
  clientId: string,
  commsLanguage: string | null,
): Promise<ClientDetailSecondary> {
  return oncePerRequest(`client-detail-secondary:${clientId}:${commsLanguage ?? ''}`, () =>
    loadSecondary(db, clientId, commsLanguage),
  );
}
