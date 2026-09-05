import type { PrismaClient } from '@prisma/client';
import { oncePerRequest } from '@/lib/request-cache';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { getThemeSummary, type ThemeSummary } from '@/lib/feedback/analysis';
import { getClientHealth } from '@/lib/snapshots/service';
import type { Pulse } from '@/lib/health/health';
import {
  buildIntelligence,
  type ClientIntelligence,
  type RecordedStep,
} from './engine';

/**
 * CUSTOMER INTELLIGENCE SERVICE (M10).
 *
 * Loads the stored rows the engine needs and hands back one intelligence
 * object. Read-only: there is no intelligence table, no cache and no derived
 * row written anywhere. The object is recomputed from the feedback and the
 * snapshots every time it is asked for, which is what makes it impossible for
 * a stale insight to outlive the evidence behind it.
 *
 * Every query here is scoped by clientId. One client's feedback can never
 * reach another client's intelligence.
 */

/** How far back a recorded decision or action is still worth showing. */
export const RECENT_STEP_DAYS = 120;
export const MAX_RECENT_STEPS = 3;

/**
 * Decisions and actions the operator recorded in Minutes.
 *
 * Loaded here so the intelligence object can carry them as CONTEXT. They are
 * never counted, ranked or presented as customer evidence — an operator note
 * is what the operator did, not what a customer said.
 */
export async function loadRecentSteps(
  db: PrismaClient,
  clientId: string,
  now: Date,
): Promise<RecordedStep[]> {
  const since = new Date(now.getTime() - RECENT_STEP_DAYS * 86_400_000);

  const rows = await db.minute.findMany({
    where: {
      clientId,
      category: { in: ['DECISION', 'ACTION'] },
      occurredAt: { gte: since, lte: now },
    },
    orderBy: { occurredAt: 'desc' },
    take: MAX_RECENT_STEPS,
    select: { id: true, occurredAt: true, title: true, category: true },
  });

  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt,
    title: row.title,
    category: row.category,
  }));
}

export type IntelligenceContext = {
  pack: Pack;
  themes: ThemeSummary;
  totalFeedback: number;
  pulse: Pulse;
  recentlyDone: RecordedStep[];
  intelligence: ClientIntelligence;
};

/**
 * The intelligence for one client, plus the inputs it was built from.
 *
 * The owner update needs the same four loads, so it takes this context instead
 * of issuing its own queries and running its own arithmetic. One load, one
 * calculation, two presentations — a message and a screen can never disagree.
 */
export async function loadIntelligence(
  db: PrismaClient,
  client: { id: string; businessName: string; vertical: string },
  now: Date,
): Promise<IntelligenceContext> {
  // Three services ask for this independently while one page renders - the
  // owner's update, the improvement actions, and the responsibility panel - so
  // without this the same intelligence is computed three times from the same
  // rows. Keyed on the business alone: `now` differs between those callers only
  // by the milliseconds between their `new Date()` calls, and everything here
  // buckets by week and month, so no reachable difference in `now` within one
  // request can change the answer.
  return oncePerRequest(`intelligence:${client.id}`, () => loadIntelligenceUncached(db, client, now));
}

async function loadIntelligenceUncached(
  db: PrismaClient,
  client: { id: string; businessName: string; vertical: string },
  now: Date,
): Promise<IntelligenceContext> {
  const pack = getPackOrFallback(client.vertical);

  const [themes, totalFeedback, health, recentlyDone] = await Promise.all([
    getThemeSummary(db, client.id, client.vertical),
    db.reviewItem.count({ where: { clientId: client.id } }),
    getClientHealth(db, client.id, client.vertical, now),
    loadRecentSteps(db, client.id, now),
  ]);

  const intelligence = buildIntelligence({
    client,
    pack,
    themes,
    totalFeedback,
    pulse: health.pulse,
    notes: recentlyDone,
  });

  return { pack, themes, totalFeedback, pulse: health.pulse, recentlyDone, intelligence };
}

/**
 * What this client's customers are telling them. Null when the client is gone.
 */
export async function getClientIntelligence(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<ClientIntelligence | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true, vertical: true },
  });
  if (!client) return null;

  const context = await loadIntelligence(db, client, options.now ?? new Date());
  return context.intelligence;
}
