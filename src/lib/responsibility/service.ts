import type { PrismaClient } from '@prisma/client';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { getReplyCoverage } from '@/lib/feedback/replies';
import { evidenceDateOf } from '@/lib/improve/service';
import { findPortalClient, loadCore } from '@/lib/portal/service';
import { buildPortalView, type PortalView } from '@/lib/portal/view';
import {
  buildResponsibility,
  type FeedbackSince,
  type GatewayState,
  type Responsibility,
} from './engine';

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
  options: { now?: Date } = {},
): Promise<ResponsibilityBundle | null> {
  const client = await findPortalClient(db, clientId);
  if (!client) return null;
  const now = options.now ?? new Date();

  const [core, rows, replies, gateway, archived] = await Promise.all([
    loadCore(db, client, now),
    db.reviewItem.findMany({
      where: { clientId: client.id },
      select: {
        reviewDate: true,
        createdAt: true,
        analysisStatus: true,
        analysisVersion: true,
        source: true,
      },
    }),
    getReplyCoverage(db, client.id),
    db.feedbackGateway.findUnique({
      where: { clientId: client.id },
      select: { enabled: true },
    }),
    db.client.findUnique({ where: { id: client.id }, select: { archivedAt: true } }),
  ]);

  const view = buildPortalView(core);
  const since = core.checkins[0]?.capturedAt ?? null;
  const gatewayState: GatewayState | null = gateway
    ? { enabled: gateway.enabled, received: rows.filter((r) => r.source === 'REP_OS_QR').length }
    : null;

  const responsibility = buildResponsibility({
    view,
    intelligence: core.intelligence,
    actions: core.actions,
    checkins: core.checkins,
    feedbackSince: feedbackSince(rows, since),
    needsYourWords: replies.needsYou,
    gateway: gatewayState,
    archived: archived?.archivedAt !== null && archived?.archivedAt !== undefined,
    now,
  });

  return { clientId: client.id, view, responsibility };
}
