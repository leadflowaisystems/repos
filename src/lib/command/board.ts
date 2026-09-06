import type { ImprovementAction, PrismaClient } from '@prisma/client';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import {
  computeHealthCard,
  computePulse,
  type StoredSnapshot,
} from '@/lib/health/health';
import type { HealthStatus } from '@/lib/health/rules';
import { toStoredFeedback } from '@/lib/snapshots/service';
import { summariseThemeRows } from '@/lib/feedback/analysis';
import { replyCoverageOf, type ReplyCoverage } from '@/lib/feedback/replies';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import {
  MIN_MENTIONS_TO_NAME,
  buildIntelligence,
  type Insight,
} from '@/lib/intelligence/engine';
import { categoryLabel, isForwardLooking } from '@/lib/minutes/service';
import { listClientSetup } from '@/lib/clients/service';
import { MIN_FEEDBACK_TO_MEASURE } from '@/lib/improve/measure';
import { evidenceDateOf, toActionRecord } from '@/lib/improve/service';
import { measurementWindowStart } from '@/lib/improve/model';
import {
  compareForBoard,
  prioritise,
  type NextAction,
  type PriorityBand,
  type PrioritySignal,
} from './priority';

/**
 * THE COMMAND CENTRE (M9).
 *
 * One screen that answers, for every client at once: who needs you, why, and
 * what to do about it.
 *
 * This module composes; it does not compute. Health comes from M2, themes from
 * M6, reply states from M7, which complaint matters and what moved from M10,
 * memory from M4. Nothing is re-derived here, so the board and the client page
 * can never tell the operator two different stories.
 *
 * It is deliberately built on FOUR queries regardless of how many clients there
 * are — clients, snapshots, feedback, minutes — and groups them in memory.
 * A per-client query loop would have been simpler to write and would degrade
 * the moment the operator has thirty clients, which is the whole point of them
 * using this.
 */

export type BoardFeedback = {
  total: number;
  /** Brought in but not yet read by the analysis layer. */
  unread: number;
  analysed: number;
  needsYou: number;
  awaitingDraft: number;
  draftsReady: number;
  handled: number;
};

export type BoardIssue = {
  key: string;
  label: string;
  count: number;
  severe: boolean;
};

export type BoardActions = {
  /** Suggested changes nobody has accepted or declined yet. */
  awaitingDecision: number;
  /** Changes made, with enough new feedback to compare before and after. */
  readyToMeasure: number;
  /** Changes made, still waiting for enough new feedback. */
  awaitingEvidence: number;
  /** The latest measured result, in the words the measurement engine used. */
  lastResult: { themeLabel: string; label: string; headline: string } | null;
};

export type BoardMemory = {
  lastNoteAt: Date | null;
  lastNoteTitle: string | null;
  lastNoteCategory: string | null;
  /** The most recent decision, action or follow-up. Not a tracked task. */
  lastFollowUpAt: Date | null;
  lastFollowUpTitle: string | null;
};

export type CommandCard = {
  clientId: string;
  businessName: string;
  vertical: string;
  verticalLabel: string;

  status: HealthStatus;
  statusLabel: string;
  /** The health engine's own wording for the most severe signal. */
  topSignal: string | null;

  topIssue: BoardIssue | null;
  /** The vertical pack's advice for that issue. Never written by RepOS. */
  recommendation: string | null;

  /** Plain-language movement since the previous check-in, or null. */
  change: string | null;
  trendLabel: string;

  feedback: BoardFeedback;
  memory: BoardMemory;

  ownerUpdateReady: boolean;
  /**
   * The improvement loop, in the two states that need the operator, plus the
   * most recent finished one. Not a task board: an action sitting with the
   * business is not shown here, because nothing is waiting on RepOS.
   */
  actions: BoardActions;
  lastActivityAt: Date | null;

  rank: number;
  band: PriorityBand;
  signals: PrioritySignal[];
  reasons: string[];
  nextAction: NextAction;

  /**
   * Set when this client cannot yet support conclusions. Carries what is
   * missing and why, so a new client reads as "not started" rather than broken.
   *
   * `supersedes` names the priority signals this box already explains, so the
   * card can drop those reason lines instead of saying the same thing twice.
   */
  lowData: { missing: string; why: string; supersedes: string[] } | null;
};

export type Board = {
  cards: CommandCard[];
  totals: {
    clients: number;
    needAttention: number;
    unreadFeedback: number;
    awaitingDraft: number;
    needsYou: number;
    lowData: number;
  };
};

type FeedbackRow = {
  clientId: string;
  createdAt: Date;
  /** The customer's own date where it was parsed. Splits before from after. */
  reviewDate: Date | null;
  themesJson: string;
  analysisStatus: string;
  analysisVersion: number;
  triageVersion: number;
  responseAction: string;
  draftStatus: string;
  draftVersion: number;
  handledAt: Date | null;
  id: string;
};

type MinuteRow = {
  clientId: string;
  occurredAt: Date;
  title: string;
  category: string;
};

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

function latest(...dates: Array<Date | null>): Date | null {
  let out: Date | null = null;
  for (const date of dates) {
    if (date && (!out || date.getTime() > out.getTime())) out = date;
  }
  return out;
}

function feedbackFor(rows: FeedbackRow[], coverage: ReplyCoverage): BoardFeedback {
  const analysed = rows.filter(
    (row) =>
      row.analysisStatus === 'ANALYSED' && row.analysisVersion >= ANALYSIS_VERSION,
  ).length;

  return {
    total: rows.length,
    unread: rows.length - analysed,
    analysed,
    needsYou: coverage.youOutstanding,
    awaitingDraft: coverage.awaitingDraft,
    draftsReady: coverage.drafted,
    handled: coverage.handled,
  };
}

/**
 * The most repeated complaint that clears the naming floor.
 *
 * Same floor the owner update uses, so the board never names something the
 * message to the owner would refuse to name.
 */
/**
 * The complaint worth putting on the card.
 *
 * The intelligence engine ranked it, weighing how serious the vertical pack
 * says a complaint is alongside how often customers raised it. The board shows
 * the same one the client page and the owner update do, so the operator is
 * never sent to fix a different problem from the one they were told about.
 */
function topIssueFrom(attention: Insight | null): BoardIssue | null {
  if (!attention) return null;
  return {
    key: attention.themeKey,
    label: attention.themeLabel,
    count: attention.evidence.count,
    severe: attention.severity === 'high',
  };
}

/**
 * The movement, with the thing that moved.
 *
 * The engine writes "6 → 2 mentions" and names the theme separately. On a card
 * read at a glance, a bare pair of numbers says nothing, so the label goes
 * back in.
 */
function changeLine(change: Insight | undefined): string | null {
  if (!change || !change.movement.countNote) return null;
  return `${change.themeLabel} — ${change.movement.countNote}`;
}

/**
 * Where each improvement attempt has got to.
 *
 * Only two states put a client on the board: one nobody has decided on, and one
 * that now has enough new feedback to be measured. An accepted-but-not-done
 * action is with the business, not with the operator, so it is counted but
 * never used to raise priority.
 */
function actionsFor(
  rows: ImprovementAction[],
  feedback: FeedbackRow[],
): BoardActions {
  const readDates = feedback
    .filter((row) => row.analysisStatus === 'ANALYSED')
    .map((row) => evidenceDateOf(row).getTime());

  let awaitingDecision = 0;
  let readyToMeasure = 0;
  let awaitingEvidence = 0;
  let lastResult: BoardActions['lastResult'] = null;

  for (const row of rows) {
    const action = toActionRecord(row);
    if (action.status === 'RECOMMENDED') {
      awaitingDecision += 1;
      continue;
    }
    if (action.status === 'DONE' && action.doneAt) {
      const start = measurementWindowStart(action.doneAt, action.baseline.capturedAt);
      const since = readDates.filter((time) => time >= start).length;
      if (since >= MIN_FEEDBACK_TO_MEASURE) readyToMeasure += 1;
      else awaitingEvidence += 1;
      continue;
    }
    if (action.status === 'MEASURED' && action.measurement && !lastResult) {
      // Rows arrive newest-updated first, so the first one seen is the latest.
      lastResult = {
        themeLabel: action.provenance.themeLabel,
        label: action.measurement.resultLabel,
        headline: action.measurement.headline,
      };
    }
  }

  return { awaitingDecision, readyToMeasure, awaitingEvidence, lastResult };
}

function memoryFrom(rows: MinuteRow[]): BoardMemory {
  const latestNote = rows[0] ?? null;
  const forwardLooking = rows.find((row) => isForwardLooking(row.category)) ?? null;

  return {
    lastNoteAt: latestNote?.occurredAt ?? null,
    lastNoteTitle: latestNote?.title ?? null,
    lastNoteCategory: latestNote ? categoryLabel(latestNote.category) : null,
    lastFollowUpAt: forwardLooking?.occurredAt ?? null,
    lastFollowUpTitle: forwardLooking?.title ?? null,
  };
}

/**
 * What a client is missing, when it is too early to say anything useful.
 *
 * Honest by construction: it names the one next thing rather than listing every
 * gap, and it says why RepOS cannot draw a conclusion instead of showing an
 * empty chart.
 */
function lowDataFor(feedback: BoardFeedback): CommandCard['lowData'] {
  if (feedback.total === 0) {
    return {
      missing: 'No feedback yet',
      why: 'Headway has nothing to read, so it cannot tell you what customers think.',
      supersedes: ['no_feedback'],
    };
  }
  if (feedback.analysed === 0) {
    return {
      missing: 'Nothing read yet',
      why:
        feedback.total === 1
          ? '1 piece of feedback is waiting to be read.'
          : `${feedback.total} pieces of feedback are waiting to be read.`,
      supersedes: ['unread_feedback'],
    };
  }
  if (feedback.analysed < MIN_MENTIONS_TO_NAME) {
    return {
      missing: 'Too little to judge',
      why: `${feedback.analysed} read so far. Nothing is named until it has come up ${MIN_MENTIONS_TO_NAME} times.`,
      supersedes: [],
    };
  }
  // A missing snapshot is NOT low data. A client can have plenty of feedback
  // and a clear complaint while still having nothing to compare against, and
  // showing a warning box beside a named complaint reads as a contradiction.
  // The priority reasons already say the snapshot is missing.
  return null;
}

/**
 * Everything the command centre needs, for every active client.
 *
 * `now` is injected so the board is reproducible in tests and so every client
 * on one render is judged against the same instant.
 */
export async function getBoard(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<Board> {
  const clients = await db.client.findMany({
    where: { archivedAt: null },
    select: { id: true, businessName: true, vertical: true, status: true },
    orderBy: { businessName: 'asc' },
  });

  const setupByClient = await listClientSetup(
    db,
    clients.map((c) => c.id),
  );

  if (clients.length === 0) {
    return {
      cards: [],
      totals: {
        clients: 0,
        needAttention: 0,
        unreadFeedback: 0,
        awaitingDraft: 0,
        needsYou: 0,
        lowData: 0,
      },
    };
  }

  const ids = clients.map((client) => client.id);

  const [snapshots, feedback, minutes, improvements] = await Promise.all([
    db.snapshot.findMany({
      where: { clientId: { in: ids } },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        clientId: true,
        label: true,
        capturedAt: true,
        rating: true,
        reviewCount: true,
        unansweredCount: true,
        reviewsPerWeek: true,
        daysSinceLastPost: true,
        photoRecencyDays: true,
        generatedAt: true,
        reviews: {
          select: {
            sentiment: true,
            issueTags: true,
            praiseTags: true,
            stars: true,
            reviewDate: true,
          },
        },
      },
    }),
    db.reviewItem.findMany({
      where: { clientId: { in: ids } },
      select: {
        id: true,
        clientId: true,
        createdAt: true,
        reviewDate: true,
        themesJson: true,
        analysisStatus: true,
        analysisVersion: true,
        triageVersion: true,
        responseAction: true,
        draftStatus: true,
        draftVersion: true,
        handledAt: true,
      },
    }),
    db.minute.findMany({
      where: { clientId: { in: ids } },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: { clientId: true, occurredAt: true, title: true, category: true },
    }),
    db.improvementAction.findMany({
      where: { clientId: { in: ids } },
      orderBy: [{ updatedAt: 'desc' }],
    }),
  ]);

  const snapshotsByClient = new Map<string, StoredSnapshot[]>();
  for (const row of snapshots) {
    const list = snapshotsByClient.get(row.clientId) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      capturedAt: row.capturedAt,
      rating: row.rating,
      reviewCount: row.reviewCount,
      unansweredCount: row.unansweredCount,
      reviewsPerWeek: row.reviewsPerWeek,
      daysSinceLastPost: row.daysSinceLastPost,
      photoRecencyDays: row.photoRecencyDays,
      generatedAt: row.generatedAt,
      feedback: row.reviews.map(toStoredFeedback),
    });
    snapshotsByClient.set(row.clientId, list);
  }

  const feedbackByClient = groupBy(feedback as FeedbackRow[], (row) => row.clientId);
  const minutesByClient = groupBy(minutes as MinuteRow[], (row) => row.clientId);
  const actionsByClient = groupBy(improvements, (row) => row.clientId);

  const cards: CommandCard[] = clients.map((client) => {
    const pack: Pack = getPackOrFallback(client.vertical);
    const clientSnapshots = snapshotsByClient.get(client.id) ?? [];
    const clientFeedback = feedbackByClient.get(client.id) ?? [];
    const clientMinutes = minutesByClient.get(client.id) ?? [];
    const clientActions = actionsByClient.get(client.id) ?? [];

    const card = computeHealthCard({ pack, snapshots: clientSnapshots, now });
    const pulse = computePulse({ pack, snapshots: clientSnapshots, now });

    const themes = summariseThemeRows(
      clientFeedback.filter((row) => row.analysisStatus === 'ANALYSED'),
      pack,
    );
    const coverage = replyCoverageOf(clientFeedback);
    const boardFeedback = feedbackFor(clientFeedback, coverage);
    const memory = memoryFrom(clientMinutes);

    // The same calculation the client page renders, from rows already in hand:
    // no extra query, and no second opinion about what matters here.
    const intelligence = buildIntelligence({
      client: {
        id: client.id,
        businessName: client.businessName,
        vertical: client.vertical,
      },
      pack,
      themes,
      totalFeedback: boardFeedback.total,
      pulse,
      notes: [],
    });

    const actions = actionsFor(clientActions, clientFeedback);
    const topIssue = topIssueFrom(intelligence.attention);
    const recommendation = intelligence.attention?.recommendation ?? null;

    // The owner update is worth offering once there is something to say in it.
    // "Something to say" is the intelligence engine's judgement, not a count of
    // theme rows: a client whose only themes are below the naming floor gets an
    // update that says "nothing is coming up often enough yet", and sending the
    // operator to copy that is a dead end.
    const ownerUpdateReady = intelligence.headline.length > 0;

    const lastActivityAt = latest(
      memory.lastNoteAt,
      card.coverage.lastSnapshotAt,
      ...clientFeedback.map((row) => row.createdAt),
    );

    const setup = setupByClient.get(client.id);
    const priority = prioritise({
      clientId: client.id,
      businessName: client.businessName,
      status: card.status,
      clientStatus: client.status,
      setup: {
        gatewayLive: setup?.gatewayLive ?? false,
        gatewayPaused: setup?.gatewayPaused ?? false,
        cardsOnSite: setup?.cardsOnSite ?? false,
        ownerLinkSent: setup?.ownerLinkSent ?? false,
      },
      topSignalDetail: card.signals[0]?.detail ?? null,
      trendDeclining: pulse.available && pulse.direction === 'DECLINING',
      topIssue: topIssue
        ? { label: topIssue.label, count: topIssue.count, severe: topIssue.severe }
        : null,
      feedback: {
        total: boardFeedback.total,
        unread: boardFeedback.unread,
        // Outstanding, not the population: an item the operator has finished
        // with must stop asking (M17).
        needsYou: boardFeedback.needsYou,
        awaitingDraft: boardFeedback.awaitingDraft,
        draftsReady: boardFeedback.draftsReady,
      },
      actions: {
        awaitingDecision: actions.awaitingDecision,
        readyToMeasure: actions.readyToMeasure,
      },
      lastFollowUpAt: memory.lastFollowUpAt,
      daysSinceLastSnapshot: card.coverage.daysSinceLastSnapshot,
      snapshotCount: card.coverage.snapshotCount,
      lastActivityAt,
      ownerUpdateReady,
      now,
    });

    return {
      clientId: client.id,
      businessName: client.businessName,
      vertical: client.vertical,
      verticalLabel: pack.label,

      status: card.status,
      statusLabel: card.statusLabel,
      topSignal: card.signals[0]?.detail ?? null,

      topIssue,
      recommendation,

      // The intelligence engine already decided what moved by enough to be
      // worth saying; repeating the arithmetic here would risk the board and
      // the client page disagreeing.
      change: changeLine(intelligence.changing[0]),
      trendLabel: pulse.available ? pulse.directionLabel : card.trend.label,

      feedback: boardFeedback,
      memory,

      ownerUpdateReady,
      actions,
      lastActivityAt,

      rank: priority.rank,
      band: priority.band,
      signals: priority.signals,
      reasons: priority.reasons,
      nextAction: priority.nextAction,

      lowData: lowDataFor(boardFeedback),
    };
  });

  cards.sort(compareForBoard);

  return {
    cards,
    totals: {
      clients: cards.length,
      needAttention: cards.filter((c) => c.band === 'NOW' || c.band === 'SOON').length,
      unreadFeedback: cards.reduce((sum, c) => sum + c.feedback.unread, 0),
      awaitingDraft: cards.reduce((sum, c) => sum + c.feedback.awaitingDraft, 0),
      needsYou: cards.reduce((sum, c) => sum + c.feedback.needsYou, 0),
      lowData: cards.filter((c) => c.lowData !== null).length,
    },
  };
}
