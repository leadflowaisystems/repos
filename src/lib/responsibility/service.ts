import type { PrismaClient } from '@prisma/client';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { loadFeedbackLedger } from '@/lib/feedback/ledger';
import { getReplyCoverage } from '@/lib/feedback/replies';
import { evidenceDateOf } from '@/lib/improve/service';
import { findPortalClient, loadCore } from '@/lib/portal/service';
import { buildPortalView, type PortalView } from '@/lib/portal/view';
import { buildTrendReadiness } from '@/lib/portal/trends';
import {
  buildResponsibility,
  type FeedbackSince,
  type GatewayState,
  type Responsibility,
} from './engine';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * RESPONSIBILITY SERVICE (M15).
 *
 * Loads exactly what the owner's pages already load — one core, shared with
 * the portal — adds the three facts this layer needs that the portal did not
 * (what arrived since the last check-in, what the reply engine handed to a
 * person, whether the feedback page is switched on), and hands everything to
 * the pure engine.
 *
 * Nothing is written, nothing is fetched, and nothing runs on a timer: the
 * state exists when a page asks for it, computed from stored rows. Every
 * query is scoped by the client id.
 */

export type ResponsibilityBundle = {
  clientId: string;
  view: PortalView;
  responsibility: Responsibility;
};

type DatedRow = {
  reviewDate: Date | null;
  createdAt: Date;
  analysisStatus: string;
  analysisVersion: number;
  source: string;
};

/**
 * What came in after the latest check-in, counted from row dates.
 *
 * "Since" uses the evidence date — the customer's own where it was parsed,
 * otherwise arrival — the same rule the measurement engine uses to split
 * before from after. With no check-in, everything counts.
 */
export function feedbackSince(rows: DatedRow[], since: Date | null): FeedbackSince {
  const after = since
    ? rows.filter((row) => evidenceDateOf(row).getTime() > since.getTime())
    : rows;
  const read = after.filter(
    (row) => row.analysisStatus === 'ANALYSED' && row.analysisVersion >= ANALYSIS_VERSION,
  );
  return {
    total: after.length,
    read: read.length,
    unread: after.length - read.length,
    direct: read.filter((row) => row.source === 'REP_OS_QR').length,
  };
}

/** The responsibility state for one client, with the portal view it rests on. Null when the client is gone. */
export async function getResponsibility(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date; t?: PortalTranslator } = {},
): Promise<ResponsibilityBundle | null> {
  const client = await findPortalClient(db, clientId);
  if (!client) return null;
  const now = options.now ?? new Date();

  // The feedback rows come from the one read the page shares (see
  // feedback/ledger.ts): every row of this client's, as before. The archived
  // flag rides on the client row already in hand rather than a fifth query.
  const [core, rows, replies, gateway] = await Promise.all([
    loadCore(db, client, now, options.t),
    loadFeedbackLedger(db, client.id),
    getReplyCoverage(db, client.id),
    db.feedbackGateway.findUnique({
      where: { clientId: client.id },
      select: { enabled: true },
    }),
  ]);

  const view = buildPortalView(core);
  // "Since" is the operator's latest check-in, as it always was: the lines
  // about Headway's recent work are counted from it. The automatic comparison
  // points (snapshots/periods.ts) are for what the next comparison waits for,
  // and are handed over separately — so a business nobody has recorded a
  // check-in for still reads "since feedback started coming in".
  const operatorCheckins = core.checkins.filter((c) => !c.automatic);
  const since = operatorCheckins[0]?.capturedAt ?? null;
  const trend = buildTrendReadiness(core);
  const gatewayState: GatewayState | null = gateway
    ? { enabled: gateway.enabled, received: rows.filter((r) => r.source === 'REP_OS_QR').length }
    : null;

  const responsibility = buildResponsibility({
    view,
    intelligence: core.intelligence,
    actions: core.actions,
    checkins: operatorCheckins,
    feedbackSince: feedbackSince(rows, since),
    comparison: { periods: trend.checkins, latestAt: trend.latest?.at ?? null, readSince: trend.since },
    needsYourWords: replies.needsYou,
    gateway: gatewayState,
    archived: client.archivedAt !== null,
    now,
    t: options.t,
  });

  return { clientId: client.id, view, responsibility };
}
