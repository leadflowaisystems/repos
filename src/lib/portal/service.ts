import type { PrismaClient } from '@prisma/client';
import { computeHealthCard } from '@/lib/health/health';
import { getPackOrFallback } from '@/lib/packs';
import { loadIntelligence } from '@/lib/intelligence/service';
import { listActionsWithProgress } from '@/lib/improve/service';
import { countClientFeedback, getFeedbackStats, listClientFeedback } from '@/lib/feedback/service';
import { getAnalysisCoverage } from '@/lib/feedback/analysis';
import { listSnapshots, loadHealthSnapshots } from '@/lib/snapshots/service';
import { getContextSet } from '@/lib/context/service';
import { buildPortalView, type PortalInput, type PortalView } from './view';
import {
  buildAnalysisView,
  buildCheckinView,
  buildImprovementsView,
  buildReviewsView,
  type AnalysisView,
  type CheckinView,
  type ImprovementsView,
  type ReviewFilters,
  type ReviewsView,
} from './pages';

/**
 * CLIENT WORKSPACE SERVICE (M12).
 *
 * Presentation loaders and nothing more. Each calls the services that already
 * own the answer — M2 for the observed listing, M5/M6/M7 for feedback, M10 for
 * what customers are saying, M11 for the improvement loop — and hands the
 * result to a pure view builder.
 *
 * Nothing is written. Every query is scoped by clientId, so one owner's
 * workspace can never reach another owner's data.
 */

type ClientRow = { id: string; businessName: string; vertical: string };

async function findClient(db: PrismaClient, clientId: string): Promise<ClientRow | null> {
  // Archived clients keep their workspace: the data is still theirs.
  return db.client.findFirst({
    where: { id: clientId },
    select: { id: true, businessName: true, vertical: true },
  });
}

/** The same lookup, for the responsibility layer (M15), which rests on this core. */
export const findPortalClient = findClient;

export type Core = PortalInput & { checkins: Awaited<ReturnType<typeof listSnapshots>> };

/**
 * The inputs every intelligence-backed page shares. One load, reused —
 * exported so the responsibility layer (M15) is built on this exact load
 * rather than a second one that could drift.
 */
export async function loadCore(db: PrismaClient, client: ClientRow, now: Date): Promise<Core> {
  const [context, stored, actions, checkins, ownerContext] = await Promise.all([
    loadIntelligence(db, client, now),
    loadHealthSnapshots(db, client.id),
    listActionsWithProgress(db, client.id),
    listSnapshots(db, client.id),
    getContextSet(db, client.id),
  ]);
  const card = computeHealthCard({ pack: context.pack, snapshots: stored, now });
  return {
    intelligence: context.intelligence,
    card,
    actions,
    snapshots: stored,
    pack: context.pack,
    themes: context.themes,
    context: ownerContext,
    checkins,
  };
}

export type PortalBundle = { clientId: string; view: PortalView };

/** Home. Null when the client does not exist. */
export async function getPortalView(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<PortalBundle | null> {
  const client = await findClient(db, clientId);
  if (!client) return null;
  const core = await loadCore(db, client, options.now ?? new Date());
  return { clientId: client.id, view: buildPortalView(core) };
}

export async function getAnalysisView(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<AnalysisView | null> {
  const client = await findClient(db, clientId);
  if (!client) return null;
  return buildAnalysisView(await loadCore(db, client, options.now ?? new Date()));
}

export async function getImprovementsView(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<ImprovementsView | null> {
  const client = await findClient(db, clientId);
  if (!client) return null;
  return buildImprovementsView(await loadCore(db, client, options.now ?? new Date()));
}

export async function getCheckinView(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<CheckinView | null> {
  const client = await findClient(db, clientId);
  if (!client) return null;
  return buildCheckinView(await loadCore(db, client, options.now ?? new Date()));
}

/**
 * The reviews workspace.
 *
 * Only the columns an owner may see are ever mapped out of the row: the
 * redacted customer text, rating, date, source, sentiment, class, theme
 * labels and — when it is current and passed the safety gate — the suggested
 * reply. Triage reasons, priority ranks and draft internals never leave here.
 */
/** Comments per page on the owner's evidence view (M18). */
export const REVIEWS_PAGE_SIZE = 25;

export async function getReviewsView(
  db: PrismaClient,
  clientId: string,
  filters: ReviewFilters,
  options: { now?: Date; page?: number } = {},
): Promise<ReviewsView | null> {
  const client = await findClient(db, clientId);
  if (!client) return null;

  const pack = getPackOrFallback(client.vertical);
  const themeKnown =
    filters.theme !== null &&
    (pack.praiseTaxonomy.some((t) => t.key === filters.theme) ||
      pack.issueTaxonomy.some((t) => t.key === filters.theme));

  // "Worth a reply from you" means the reply engine ranked it high or asked
  // for a person — not every review it would happily draft for.
  // Every filter is applied in the query now, so the page is a real page: what
  // the owner sees, the count beside it and the "show more" all come from one
  // set of conditions and cannot drift apart.
  const page = Math.min(Math.max(Math.trunc(options.page ?? 1), 1), 40);
  const listFilters = {
    stars: filters.stars,
    sentiment: filters.sentiment,
    source: filters.source,
    // A theme from another vertical's pack is not this client's theme.
    themeKey: themeKnown ? filters.theme : null,
    query: filters.q,
    worthReply: filters.needs === 'reply',
    byPriority: filters.needs === 'reply',
  };

  const [stats, coverage, rows, matching, context, replyWorth] = await Promise.all([
    getFeedbackStats(db, client.id),
    getAnalysisCoverage(db, client.id),
    // Cumulative: "show more" grows the list rather than replacing it, which
    // is how somebody actually reads evidence.
    listClientFeedback(db, client.id, { ...listFilters, limit: REVIEWS_PAGE_SIZE * page }),
    countClientFeedback(db, client.id, listFilters),
    loadIntelligence(db, client, options.now ?? new Date()),
    // The same definition the filter uses, so the number and the list agree.
    countClientFeedback(db, client.id, { worthReply: true }),
  ]);

  return buildReviewsView({
    businessName: client.businessName,
    pack,
    stats,
    coverage,
    rows,
    matching,
    hasMore: rows.length < matching,
    nextPage: page + 1,
    filters: { ...filters, theme: themeKnown ? filters.theme : null },
    intelligence: context.intelligence,
    replyWorth,
  });
}

/** Just enough to render the masthead and navigation. */
export async function getPortalClient(
  db: PrismaClient,
  clientId: string,
): Promise<{ businessName: string; verticalLabel: string } | null> {
  const client = await findClient(db, clientId);
  if (!client) return null;
  return { businessName: client.businessName, verticalLabel: getPackOrFallback(client.vertical).label };
}
