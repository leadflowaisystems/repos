import type { HealthStatus } from '@/lib/health/rules';

/**
 * COMMAND CENTRE PRIORITY (M9).
 *
 * Decides which client the operator should open first, and what to do when
 * they get there.
 *
 * The same rule the reply layer follows applies here: priority is the sum of a
 * fixed list of NAMED signals, each with a fixed weight and a sentence the
 * operator can read. There is no model, no score from nowhere, and nothing the
 * operator cannot argue with. If RepOS puts a client at the top, it says why in
 * their own words.
 *
 * This module is pure. It takes facts the board has already gathered from
 * stored rows and returns an ordering — no database, no dates of its own, no
 * side effects.
 */

/** Bump when the weights or the rules change. */
export const PRIORITY_VERSION = 1;

export type PriorityBand = 'NOW' | 'SOON' | 'WHEN_FREE' | 'NOTHING';

export type PrioritySignal = {
  key: string;
  weight: number;
  /** Shown to the operator verbatim. Plain language, carries the real number. */
  reason: string;
};

/**
 * What the operator can actually do next.
 *
 * Every one of these maps to a screen that exists and a button that works. No
 * state is invented: there is no "in progress", no "assigned", no "snoozed",
 * because RepOS does not record any of those.
 */
export type NextActionKey =
  | 'ADD_FEEDBACK'
  | 'READ_FEEDBACK'
  | 'HANDLE_YOURSELF'
  | 'DRAFT_REPLIES'
  | 'REVIEW_DRAFTS'
  | 'PREPARE_OWNER_UPDATE'
  | 'DECIDE_ACTION'
  | 'MEASURE_ACTION'
  | 'TAKE_SNAPSHOT'
  | 'RECORD_MINUTE'
  | 'NOTHING';

export type NextAction = {
  key: NextActionKey;
  /** Button text. An instruction, not a noun. */
  label: string;
  /** One line saying why this is the next thing. */
  detail: string;
  /** Path within RepOS. Always a screen that already exists. */
  href: string;
};

/** Everything the ordering looks at, all of it already derived from stored rows. */
export type PriorityInput = {
  clientId: string;
  businessName: string;
  status: HealthStatus;
  /** The health card's most severe signal, already worded by that engine. */
  topSignalDetail: string | null;
  /** Declining pulse, from the trend engine. Never inferred here. */
  trendDeclining: boolean;
  /** The most repeated issue that clears the naming floor. */
  topIssue: { label: string; count: number; severe: boolean } | null;
  feedback: {
    total: number;
    unread: number;
    needsYou: number;
    awaitingDraft: number;
    draftsReady: number;
  };
  /** A follow-up or action the operator wrote down. Never a tracked task. */
  lastFollowUpAt: Date | null;
  daysSinceLastSnapshot: number | null;
  snapshotCount: number;
  /** Last time anything at all happened for this client. */
  lastActivityAt: Date | null;
  ownerUpdateReady: boolean;
  /**
   * The improvement loop's two open ends (M11): a change nobody has decided on
   * yet, and a change that has been made and now has enough new feedback to be
   * measured. Deliberately only these two — the board asks "what needs me?",
   * and an action sitting with the business needs nobody.
   */
  actions: {
    awaitingDecision: number;
    readyToMeasure: number;
  };
  now: Date;
};

export const BAND_NOW = 45;
export const BAND_SOON = 20;

/** A snapshot older than this is stale enough to mention. */
export const STALE_SNAPSHOT_DAYS = 60;
/** A follow-up noted longer ago than this is worth a second look. */
export const FOLLOW_UP_NUDGE_DAYS = 14;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Every signal that fired, in the order they were considered.
 *
 * Weights are deliberately coarse. The point is not a precise ranking — it is
 * that "a client on Attention with a serious recurring complaint" always sorts
 * above "a client whose snapshot is a bit old", and that the operator can see
 * exactly that reasoning.
 */
export function prioritySignals(input: PriorityInput): PrioritySignal[] {
  const signals: PrioritySignal[] = [];

  if (input.status === 'ATTENTION') {
    signals.push({
      key: 'attention',
      weight: 50,
      reason: input.topSignalDetail ?? 'Health is at Attention.',
    });
  } else if (input.status === 'WATCH') {
    signals.push({
      key: 'watch',
      weight: 20,
      reason: input.topSignalDetail ?? 'Health is at Watch.',
    });
  }

  if (input.feedback.needsYou > 0) {
    signals.push({
      key: 'needs_you',
      weight: 30,
      reason: `${input.feedback.needsYou} review${input.feedback.needsYou === 1 ? '' : 's'} RepOS will not answer — ${input.feedback.needsYou === 1 ? 'it needs' : 'they need'} your own words.`,
    });
  }

  if (input.topIssue) {
    signals.push({
      key: input.topIssue.severe ? 'serious_issue' : 'recurring_issue',
      weight: input.topIssue.severe ? 25 : 12,
      reason: `${input.topIssue.label} has come up ${input.topIssue.count} times.`,
    });
  }

  if (input.actions.awaitingDecision > 0) {
    signals.push({
      key: 'action_awaiting_decision',
      weight: 18,
      reason: `${input.actions.awaitingDecision} suggested change${input.actions.awaitingDecision === 1 ? '' : 's'} waiting for the business to accept or decline.`,
    });
  }

  if (input.actions.readyToMeasure > 0) {
    signals.push({
      key: 'action_ready_to_measure',
      weight: 16,
      reason: `${input.actions.readyToMeasure} change${input.actions.readyToMeasure === 1 ? ' has' : 's have'} enough new feedback to check the result.`,
    });
  }

  if (input.trendDeclining) {
    signals.push({
      key: 'declining',
      weight: 20,
      reason: 'Things moved the wrong way since the previous check-in.',
    });
  }

  if (input.feedback.awaitingDraft > 0) {
    signals.push({
      key: 'reply_backlog',
      weight: 15,
      reason: `${input.feedback.awaitingDraft} review${input.feedback.awaitingDraft === 1 ? '' : 's'} waiting for a suggested reply.`,
    });
  }

  if (input.feedback.unread > 0) {
    signals.push({
      key: 'unread_feedback',
      weight: 12,
      reason: `${input.feedback.unread} piece${input.feedback.unread === 1 ? '' : 's'} of feedback RepOS has not read yet.`,
    });
  }

  if (input.lastFollowUpAt) {
    const age = daysBetween(input.lastFollowUpAt, input.now);
    if (age >= FOLLOW_UP_NUDGE_DAYS) {
      signals.push({
        key: 'follow_up_noted',
        weight: 10,
        // Deliberately "noted", not "outstanding": Minutes record what
        // happened, they do not track whether anything was closed.
        reason: `A follow-up was noted ${age} days ago and nothing has been recorded since.`,
      });
    }
  }

  if (input.snapshotCount === 0 && input.feedback.total > 0) {
    signals.push({
      key: 'no_snapshot',
      weight: 8,
      reason: 'No snapshot taken yet, so nothing can be compared over time.',
    });
  } else if (
    input.daysSinceLastSnapshot !== null &&
    input.daysSinceLastSnapshot >= STALE_SNAPSHOT_DAYS
  ) {
    signals.push({
      key: 'stale_snapshot',
      weight: 8,
      reason: `Last snapshot was ${input.daysSinceLastSnapshot} days ago.`,
    });
  }

  if (input.feedback.total === 0) {
    signals.push({
      key: 'no_feedback',
      weight: 6,
      reason: 'No customer feedback has been brought in yet.',
    });
  }

  return signals;
}

export function bandFor(rank: number): PriorityBand {
  if (rank >= BAND_NOW) return 'NOW';
  if (rank >= BAND_SOON) return 'SOON';
  if (rank > 0) return 'WHEN_FREE';
  return 'NOTHING';
}

export const BAND_LABELS: Record<PriorityBand, string> = {
  NOW: 'Needs you now',
  SOON: 'Worth doing today',
  WHEN_FREE: 'When you have time',
  NOTHING: 'Nothing needed',
};

/**
 * The one thing to do next.
 *
 * Ordered by what unblocks the most: you cannot judge feedback RepOS has not
 * read, and you cannot send an owner update built on nothing. Every branch
 * returns a screen that exists today.
 */
export function nextActionFor(input: PriorityInput): NextAction {
  const base = `/clients/${input.clientId}`;
  const feedback = `${base}/feedback`;

  if (input.feedback.total === 0) {
    return {
      key: 'ADD_FEEDBACK',
      label: 'Bring in feedback',
      detail: 'Paste the reviews you have collected and RepOS will read them.',
      href: feedback,
    };
  }

  if (input.feedback.unread > 0) {
    return {
      key: 'READ_FEEDBACK',
      label: `Read ${input.feedback.unread} new`,
      detail: 'Nothing else is reliable until this has been read.',
      href: feedback,
    };
  }

  if (input.feedback.needsYou > 0) {
    return {
      key: 'HANDLE_YOURSELF',
      label: `Handle ${input.feedback.needsYou} yourself`,
      detail: 'These need your own words, not a suggestion.',
      href: `${feedback}?action=NEEDS_HUMAN`,
    };
  }

  if (input.feedback.awaitingDraft > 0) {
    return {
      key: 'DRAFT_REPLIES',
      label: `Suggest ${input.feedback.awaitingDraft} replies`,
      detail: 'Reviews that should get an answer have none yet.',
      href: feedback,
    };
  }

  // Closing the loop beats starting another one: a measured result is the
  // thing the operator has to show for the month.
  if (input.actions.readyToMeasure > 0) {
    return {
      key: 'MEASURE_ACTION',
      label: `Check ${input.actions.readyToMeasure === 1 ? 'the result' : `${input.actions.readyToMeasure} results`}`,
      detail: 'Enough feedback has come in since the change to compare before and after.',
      href: `${base}#actions`,
    };
  }

  if (input.actions.awaitingDecision > 0) {
    return {
      key: 'DECIDE_ACTION',
      label: `Get a decision on ${input.actions.awaitingDecision}`,
      detail: 'RepOS suggested a change. Record what the business decided.',
      href: `${base}#actions`,
    };
  }

  if (input.ownerUpdateReady) {
    return {
      key: 'PREPARE_OWNER_UPDATE',
      label: 'Send the owner update',
      detail: 'Already written from their feedback — read it and copy it.',
      href: `${base}#owner-update`,
    };
  }

  if (input.feedback.draftsReady > 0) {
    return {
      key: 'REVIEW_DRAFTS',
      label: `Check ${input.feedback.draftsReady} drafts`,
      detail: 'Suggested replies waiting for your eyes before you copy them.',
      href: `${feedback}?draft=READY`,
    };
  }

  if (input.snapshotCount === 0) {
    return {
      key: 'TAKE_SNAPSHOT',
      label: 'Take the first snapshot',
      detail: 'One snapshot now gives you something to compare against later.',
      href: `${base}/snapshots/new`,
    };
  }

  if (
    input.daysSinceLastSnapshot !== null &&
    input.daysSinceLastSnapshot >= STALE_SNAPSHOT_DAYS
  ) {
    return {
      key: 'TAKE_SNAPSHOT',
      label: 'Take a new snapshot',
      detail: `The last one was ${input.daysSinceLastSnapshot} days ago.`,
      href: `${base}/snapshots/new`,
    };
  }

  if (input.lastActivityAt === null) {
    return {
      key: 'RECORD_MINUTE',
      label: 'Record what happened',
      detail: 'Nothing has been noted for this client yet.',
      href: `${base}/minutes`,
    };
  }

  return {
    key: 'NOTHING',
    label: 'Open client',
    detail: 'Nothing is waiting on you here.',
    href: base,
  };
}

export type PriorityResult = {
  rank: number;
  band: PriorityBand;
  signals: PrioritySignal[];
  /** Signal sentences, heaviest first. What the card shows under the name. */
  reasons: string[];
  nextAction: NextAction;
  version: number;
};

export function prioritise(input: PriorityInput): PriorityResult {
  const signals = prioritySignals(input);
  const rank = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const ordered = [...signals].sort((a, b) => b.weight - a.weight);

  return {
    rank,
    band: bandFor(rank),
    signals,
    reasons: ordered.map((signal) => signal.reason),
    nextAction: nextActionFor(input),
    version: PRIORITY_VERSION,
  };
}

/**
 * Sorts clients for the board.
 *
 * Rank first, then business name. The name tie-breaker keeps the order stable
 * between refreshes: two clients with identical rank must not swap places just
 * because the database returned them in a different order.
 */
export function compareForBoard(
  a: { rank: number; businessName: string },
  b: { rank: number; businessName: string },
): number {
  return b.rank - a.rank || a.businessName.localeCompare(b.businessName);
}
