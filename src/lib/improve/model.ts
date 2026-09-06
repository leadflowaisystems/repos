import type { Insight, IntelligenceSignal } from '@/lib/intelligence/engine';

/**
 * THE IMPROVEMENT ACTION (M11).
 *
 * The shape and the rules of one business-improvement attempt:
 *
 *   customer signal -> insight -> recommendation -> human decision ->
 *   the change -> new feedback -> before/after -> what we learned
 *
 * Two things this module exists to protect:
 *
 *  1. HISTORY IS FROZEN. The insight, the recommendation and the baseline are
 *     copied onto the action when it is created and never recomputed. The
 *     intelligence engine recalculates on every page load; an action written in
 *     March must still say what RepOS recommended in March, on the evidence it
 *     had in March, even if the theme has since dropped below the naming floor.
 *
 *  2. "DONE" IS NOT "WORKED". Marking an action done records that the business
 *     says the change was implemented. Whether customers noticed is a separate
 *     question, answered later, from feedback, by the measurement engine — and
 *     answered conservatively.
 *
 * Pure: no database, no dates of its own, no I/O.
 */

/** Bump when the stored shape or the transition rules change. */
export const ACTION_VERSION = 1;

// ---------------------------------------------------------------------------
// The state vocabulary
// ---------------------------------------------------------------------------

export const ACTION_STATUSES = [
  'RECOMMENDED',
  'ACCEPTED',
  'DONE',
  'MEASURED',
  'PAUSED',
  'DECLINED',
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const STATUS_LABELS: Record<ActionStatus, string> = {
  RECOMMENDED: 'Waiting on a decision',
  ACCEPTED: 'Agreed, not done yet',
  DONE: 'Business says it is done',
  MEASURED: 'Measured',
  PAUSED: 'On hold',
  DECLINED: 'Declined',
};

/**
 * What each state actually asserts.
 *
 * Written out because the difference between "the business says it did this"
 * and "this worked" is the whole integrity of the milestone, and a label alone
 * does not carry it.
 */
export const STATUS_MEANINGS: Record<ActionStatus, string> = {
  RECOMMENDED: 'Headway suggested this from the feedback. Nobody has decided yet.',
  ACCEPTED: 'The business agreed to make this change. It has not been made yet.',
  DONE: 'The business says the change was made. This is not evidence that it worked.',
  MEASURED:
    'Feedback that arrived after the change has been compared with the baseline.',
  PAUSED: 'Agreed but on hold. Nothing is waiting on Headway.',
  DECLINED: 'The business decided not to do this.',
};

export const STATUS_TONES: Record<ActionStatus, 'good' | 'warn' | 'bad' | 'neutral' | 'brand'> =
  {
    RECOMMENDED: 'warn',
    ACCEPTED: 'brand',
    DONE: 'brand',
    MEASURED: 'good',
    PAUSED: 'neutral',
    DECLINED: 'neutral',
  };

/**
 * Legal moves, and only these.
 *
 * DONE -> ACCEPTED exists so a mis-click is correctable without deleting the
 * history; it means "not done after all", not a new state. MEASURED -> MEASURED
 * is a re-measurement once more feedback has come in, which is the normal way
 * an action is revisited.
 */
export const TRANSITIONS: Record<ActionStatus, readonly ActionStatus[]> = {
  RECOMMENDED: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['DONE', 'PAUSED', 'DECLINED'],
  PAUSED: ['ACCEPTED', 'DECLINED'],
  DONE: ['MEASURED', 'ACCEPTED'],
  MEASURED: ['MEASURED'],
  DECLINED: [],
};

export function isActionStatus(value: string): value is ActionStatus {
  return (ACTION_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The message the operator sees when a move is not allowed. Never a code. */
export function transitionError(from: ActionStatus, to: ActionStatus): string {
  if (from === 'DECLINED') {
    return 'This action was declined. Create a new one if the business changes its mind.';
  }
  if (to === 'MEASURED' && from !== 'DONE' && from !== 'MEASURED') {
    return 'Nothing can be measured until the business says the change was made.';
  }
  return `An action that is "${STATUS_LABELS[from].toLowerCase()}" cannot become "${STATUS_LABELS[to].toLowerCase()}".`;
}

// ---------------------------------------------------------------------------
// The frozen provenance
// ---------------------------------------------------------------------------

/**
 * What RepOS knew, said and rested on at the moment the action was created.
 *
 * Every field here is a copy. Nothing in it is ever recomputed, because the
 * question it answers is historical: "what did RepOS tell me, and on what?"
 */
export type ActionProvenance = {
  /** M10's stable insight id. The traceability runs through this. */
  insightId: string;
  themeKey: string;
  themeLabel: string;
  themeSentiment: 'PRAISE' | 'ISSUE';
  themeSeverity: 'low' | 'medium' | 'high';
  insightHeadline: string;
  insightDetail: string;
  /** The named signals that ranked it, in the words the operator read. */
  signals: IntelligenceSignal[];
  intelligenceVersion: number;
  /** The vertical pack's own advice, verbatim. Empty when it had none. */
  recommendationText: string;
};

export type ActionBaseline = {
  /** Feedback items mentioning the theme when the action was created. */
  count: number;
  /** Out of how many read items. Never absent: a count without this is noise. */
  total: number;
  /** The rows behind the count, so the evidence survives the years. */
  itemIds: string[];
  confidence: 'STRONG' | 'MODERATE' | 'EARLY';
  capturedAt: Date;
  snapshotId: string | null;
  snapshotLabel: string | null;
};

/** Share of the read pile, or null when there was nothing to divide by. */
export function shareOf(count: number, total: number): number | null {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return null;
  return count / total;
}

export function formatShare(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

/**
 * "9 of 50 reviews (18%)".
 *
 * The house format for a piece of evidence. There is no format that prints the
 * count without the denominator, because a bare count is exactly the mistake
 * this milestone is not allowed to make.
 */
export function evidenceLine(count: number, total: number): string {
  const share = shareOf(count, total);
  if (share === null) return 'No feedback read for this period';
  return `${count} of ${total} ${total === 1 ? 'review' : 'reviews'} (${formatShare(share)})`;
}

/**
 * When the after window starts.
 *
 * The later of "the change was made" and "the baseline was frozen". Everything
 * that reads or offers a measurement uses this one definition, so the count on
 * a button can never promise evidence the comparison will not see.
 */
export function measurementWindowStart(
  doneAt: Date,
  baselineCapturedAt: Date,
): number {
  return Math.max(doneAt.getTime(), baselineCapturedAt.getTime());
}

// ---------------------------------------------------------------------------
// Creating an action from an insight
// ---------------------------------------------------------------------------

export type NewAction = {
  provenance: ActionProvenance;
  baseline: ActionBaseline;
  title: string;
};

/**
 * The action a given insight would create.
 *
 * Pure, so the freeze is testable without a database. The title is the problem
 * being tackled, not the fix — the fix is what the business decides later, and
 * the two are deliberately different fields.
 */
export function actionFromInsight(
  insight: Insight,
  context: {
    capturedAt: Date;
    snapshotId: string | null;
    snapshotLabel: string | null;
  },
): NewAction {
  return {
    provenance: {
      insightId: insight.id,
      themeKey: insight.themeKey,
      themeLabel: insight.themeLabel,
      themeSentiment: insight.sentiment,
      themeSeverity: insight.severity,
      insightHeadline: insight.headline,
      insightDetail: insight.detail,
      signals: insight.signals,
      intelligenceVersion: insight.version,
      recommendationText: insight.recommendation ?? '',
    },
    baseline: {
      count: insight.evidence.count,
      total: insight.evidence.outOf,
      itemIds: insight.evidence.itemIds,
      confidence: insight.confidence,
      capturedAt: context.capturedAt,
      snapshotId: context.snapshotId,
      snapshotLabel: context.snapshotLabel,
    },
    title:
      insight.sentiment === 'ISSUE'
        ? `Reduce complaints about ${insight.themeLabel.toLowerCase()}`
        : `Protect what customers praise: ${insight.themeLabel.toLowerCase()}`,
  };
}

/**
 * The decision minute, when the operator wants one.
 *
 * Actions do not keep their own memory system. When a decision is worth
 * remembering operationally it becomes an ordinary M4 Minute, in the same list
 * as every other thing that happened with this client, and the action simply
 * points at it.
 */
export function decisionMinute(
  action: { themeLabel: string; description: string; recommendationText: string },
  occurredAt: Date,
): { occurredAt: Date; category: 'DECISION'; title: string; body: string } {
  const chosen = action.description.trim();
  return {
    occurredAt,
    category: 'DECISION',
    title: `Agreed a change for ${action.themeLabel.toLowerCase()}`.slice(0, 140),
    body: [
      chosen ? `Decided: ${chosen}` : '',
      action.recommendationText ? `Headway suggested: ${action.recommendationText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

// ---------------------------------------------------------------------------
// The measured result
// ---------------------------------------------------------------------------

/**
 * The shape and vocabulary of a measurement live here rather than in the
 * engine that produces one, because the panel renders them in the browser and
 * the engine reads the vertical packs off disk. Types and labels are safe to
 * ship to a client; a filesystem read is not.
 */
export type ActionResult =
  | 'IMPROVED'
  | 'WORSENED'
  | 'NO_CLEAR_CHANGE'
  | 'INSUFFICIENT_DATA';

/**
 * Observational wording only. The comparison shows how often a theme came up
 * before and after the change; it never shows why, so the label must not
 * read as a verdict on the change itself.
 */
export const RESULT_LABELS: Record<ActionResult, string> = {
  IMPROVED: 'Mentioned less often after the change',
  WORSENED: 'Mentioned more often after the change',
  NO_CLEAR_CHANGE: 'No clear change after the change',
  INSUFFICIENT_DATA: 'Not enough feedback after the change to tell',
};

export const RESULT_TONES: Record<ActionResult, 'good' | 'warn' | 'bad' | 'neutral'> = {
  IMPROVED: 'good',
  WORSENED: 'bad',
  NO_CLEAR_CHANGE: 'neutral',
  INSUFFICIENT_DATA: 'neutral',
};

export type MeasurementSide = {
  /** Feedback items mentioning the theme in this window. */
  count: number;
  /** Every read item in this window. The denominator, never omitted. */
  total: number;
  share: number | null;
  /** The window in words: what was counted, and over what period. */
  label: string;
  /** "9 of 50 reviews (18%)". */
  line: string;
  /** The check-in this side sits against, when there was one. */
  snapshotLabel: string | null;
};

export type Measurement = {
  result: ActionResult;
  resultLabel: string;
  themeKey: string;
  themeLabel: string;
  sentiment: 'PRAISE' | 'ISSUE';

  before: MeasurementSide;
  after: MeasurementSide;

  /** Change in share, positive when the share rose. Null when incomparable. */
  shareDelta: number | null;

  /**
   * The finding, in careful language. Describes what happened after the change
   * and never why. This is the sentence shown to an owner.
   */
  headline: string;
  /** Why RepOS reached this verdict, with the numbers in it. */
  why: string[];
  /** What this measurement cannot tell anyone. Never empty for a real verdict. */
  limits: string[];

  /** Feedback that arrived between the decision and the change being made. */
  betweenCount: number;
  measuredAt: Date;
  version: number;
};
