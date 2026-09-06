import {
  MIN_CHANGE_TO_REPORT,
  MIN_MENTIONS_TO_NAME,
  MIN_PERIOD_FEEDBACK_TO_COMPARE,
  type ClientIntelligence,
  type Insight,
  type IntelligenceSignal,
} from '@/lib/intelligence/engine';
import { MIN_FEEDBACK_TO_MEASURE } from '@/lib/improve/measure';
import type { ActionProgress } from '@/lib/improve/service';
import { STALE_SNAPSHOT_DAYS } from '@/lib/command/priority';
import type { SnapshotListRow } from '@/lib/snapshots/service';
import { pieces, spoken, type PortalAction, type PortalSignal, type PortalView } from '@/lib/portal/view';
import { formatDate } from '@/lib/format';

/**
 * RESPONSIBILITY (M15).
 *
 * The one question an owner opens RepOS with: do I need to do anything?
 *
 * This module answers it from judgements that were all made upstream. M10
 * ranked the themes and named its reasons; M11 knows where every change
 * stands and what the feedback did after it; M12 already turned those into a
 * bucket, an advice stage, a next step and a watch line per theme; M13 holds
 * what the owner said; M14 knows what arrived through the feedback page. No
 * count, no threshold and no reading is produced here. What is new is the
 * RESPONSIBILITY: which of those things needs the owner, which RepOS is
 * carrying for them, and the thread that connects what customers said, what
 * the owner decided, what happened after, and what RepOS will keep watching.
 *
 * Six states, and honesty about them. A quiet business gets CLEAR, not a
 * manufactured task. A business with too little feedback gets
 * WAITING_FOR_EVIDENCE, not a guess. Every sentence carries where it came
 * from — customers, the owner, or RepOS's own reading — and nothing is said
 * about cause.
 *
 * Pure: everything it needs is passed in, including the clock.
 */

/** Bump when the states, the weights or the wording rules change. */
export const RESPONSIBILITY_VERSION = 1;

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type ResponsibilityState =
  | 'DO_NOW'
  | 'FOLLOW_UP'
  | 'WATCH'
  | 'KEEP_DOING'
  | 'WAITING_FOR_EVIDENCE'
  | 'CLEAR';

/** The owner's words for each state. The internal names never reach a page. */
export const STATE_LABELS: Record<ResponsibilityState, string> = {
  DO_NOW: 'Do this first',
  FOLLOW_UP: 'Follow through',
  WATCH: 'Watching',
  KEEP_DOING: 'Keep doing this',
  WAITING_FOR_EVIDENCE: 'Waiting for more feedback',
  CLEAR: 'Nothing needed',
};

/**
 * A state outranks everything in the states below it. Within a state, the
 * intelligence engine's own rank and a few named signals decide the order,
 * so severity can still beat volume exactly as it does everywhere else.
 */
export const STATE_WEIGHTS: Record<ResponsibilityState, number> = {
  DO_NOW: 1000,
  FOLLOW_UP: 800,
  KEEP_DOING: 600,
  WATCH: 400,
  WAITING_FOR_EVIDENCE: 200,
  CLEAR: 0,
};

/**
 * The signals this layer adds to the intelligence engine's own. Each one is a
 * fact about the loop or the owner, never a re-reading of the feedback, and
 * each carries the sentence that explains it.
 */
export const RESPONSIBILITY_WEIGHTS = {
  /** Came up less after a change and is coming up more again. */
  returning: 25,
  /** The comparison after a change read worse. */
  measured_worsened: 20,
  /** Harm, money-back or escalation language that needs a person. */
  needs_your_words: 30,
  /** Agreed by the owner, and nothing recorded since. */
  agreed_not_done: 12,
  /** Enough feedback has come in after the change to compare. */
  comparison_due: 16,
  /** The owner said this is what matters most right now. */
  owner_priority: 15,
} as const;

/** One reason an item sits where it does, with where the reason came from. */
export type ResponsibilityReason = {
  /** Plain language, shown to the owner verbatim. */
  reason: string;
  /** The feedback, the owner, or the loop. */
  source: 'CUSTOMERS' | 'YOU' | 'REPOS';
};

/** A reason with the weight that ranks it. Internal: the weight never leaves. */
type Weighed = ResponsibilityReason & { key: string; weight: number };

/** One link in the continuity thread, with who said it. */
export type ThreadStep = {
  key: 'observed' | 'decided' | 'changed' | 'result' | 'now' | 'next';
  label: string;
  text: string;
  at: Date | null;
  source: 'CUSTOMERS' | 'YOU' | 'REPOS';
};

export type ResponsibilityEvidence = {
  count: number;
  outOf: number;
  /** "14 of the 110 pieces of feedback we have read mention it." */
  line: string;
  /** Which pile, always. */
  scope: string;
  /** Owner words for how sure the evidence lets RepOS be. */
  certainty: string;
};

export type ResponsibilityItem = {
  /** Stable across renders: the client, the state and the thing it is about. */
  id: string;
  state: ResponsibilityState;
  stateLabel: string;
  /** The short instruction under the state, in the owner's words. */
  instruction: string;
  priority: number;
  /** Why it ranks where it does, each line with its source. */
  reasons: ResponsibilityReason[];

  themeKey: string | null;
  themeLabel: string | null;
  kind: 'PRAISE' | 'ISSUE' | null;
  relatedInsight: string | null;
  relatedAction: string | null;

  /** One sentence: what this is. */
  headline: string;
  /** Why it deserves the owner's attention (or RepOS's), in one or two sentences. */
  whyItMatters: string;
  /** The next move, given where the loop stands. */
  recommendedNextStep: string;
  evidence: ResponsibilityEvidence | null;
  /** What the owner told RepOS that shaped the next step. Attributed lines. */
  contextUsed: string[];
  /** The one line explaining a constraint that changed the suggestion, when it did. */
  contextNote: string | null;
  /** observed → decided → changed → result → now → next, each with its source. */
  thread: ThreadStep[];
  /** What RepOS keeps checking for this. A full sentence. */
  watching: string;
  limitations: string[];
};

export type Responsibility = {
  clientId: string;
  businessName: string;
  /** The top item's state, or CLEAR / WAITING_FOR_EVIDENCE when nothing needs anyone. */
  state: ResponsibilityState;
  /** "Yes — one thing needs a decision from you." */
  answer: string;
  answerDetail: string;
  /** Items that need the owner: DO_NOW and FOLLOW_UP, in priority order. */
  needsYou: ResponsibilityItem[];
  /** Items RepOS is carrying: WATCH, KEEP_DOING and WAITING_FOR_EVIDENCE. */
  watching: ResponsibilityItem[];
  /** The work done since the last check-in, stated only where the data supports it. */
  did: string[];
  /** "Since your check-in on 12 Jun 2026" or "Since feedback started coming in". */
  sinceLabel: string;
  lastCheckinAt: Date | null;
  /** A condition, never a countdown. */
  nextUsefulCheck: string;
  limitations: string[];
  basedOn: number;
  version: number;
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Read feedback since the latest check-in, counted by the service from row dates. */
export type FeedbackSince = {
  /** Every piece of feedback, read or not. */
  total: number;
  /** Read by RepOS. */
  read: number;
  /** Not yet read. */
  unread: number;
  /** Of the read pieces, how many arrived through the feedback page. */
  direct: number;
};

export type GatewayState = {
  enabled: boolean;
  /** Everything that ever came through the page. */
  received: number;
};

export type ResponsibilityInput = {
  view: PortalView;
  intelligence: ClientIntelligence;
  actions: ActionProgress[];
  /** Newest first, as `listSnapshots` returns them. */
  checkins: SnapshotListRow[];
  feedbackSince: FeedbackSince;
  /** Reviews the reply engine handed to a person: harm, money back, escalation. */
  needsYourWords: number;
  /** Null when the client has never had a feedback page created. */
  gateway: GatewayState | null;
  archived: boolean;
  now: Date;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const CERTAINTY: Record<Insight['confidence'], string> = {
  STRONG: 'enough feedback to be sure of',
  MODERATE: 'a clear pattern, still worth confirming',
  EARLY: 'an early signal on little feedback',
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function insightFor(intel: ClientIntelligence, themeKey: string): Insight | null {
  return (
    [...intel.unhappy, ...intel.loved].find((i) => i.themeKey === themeKey) ?? null
  );
}

function actionFor(view: PortalView, themeKey: string): PortalAction | null {
  // The most advanced attempt for the theme, matching the loop the signal read.
  const order: Record<PortalAction['stage'], number> = {
    CHECKED: 5,
    DONE: 4,
    AGREED: 3,
    SUGGESTED: 2,
    NOT_DOING: 1,
  };
  return (
    view.actions
      .filter((a) => a.themeKey === themeKey)
      .sort((a, b) => order[b.stage] - order[a.stage])[0] ?? null
  );
}

function fromIntelligence(signals: IntelligenceSignal[]): Weighed[] {
  return signals.map((s) => ({ key: s.key, weight: s.weight, reason: s.reason, source: 'CUSTOMERS' }));
}

function unweighed(weighed: Weighed[]): ResponsibilityReason[] {
  return weighed.map(({ reason, source }) => ({ reason, source }));
}

function evidenceFor(signal: PortalSignal, insight: Insight | null): ResponsibilityEvidence {
  return {
    count: signal.evidenceCount,
    outOf: signal.evidenceTotal,
    line: signal.fact,
    scope: 'across everything Headway has read so far',
    certainty: CERTAINTY[insight?.confidence ?? 'EARLY'],
  };
}

// ---------------------------------------------------------------------------
// The state of one theme
// ---------------------------------------------------------------------------

type Placement = {
  state: ResponsibilityState;
  instruction: string;
  headline: string;
  extra: Weighed[];
};

/**
 * Where a theme sits, from the advice stage M12 already assigned it.
 *
 * The mapping is the whole judgement of this layer, and it is short on
 * purpose: a complaint nobody has decided on needs the owner; a change that
 * is agreed or made needs following through; a change that read well after
 * the comparison needs protecting; a strength needs protecting; anything
 * below the evidence floor is waited for, not acted on.
 */
function placeSignal(signal: PortalSignal, progress: ActionProgress | undefined): Placement {
  const label = spoken(signal.themeLabel);
  const extra: Weighed[] = [];

  if (signal.returning) {
    extra.push({
      key: 'returning',
      weight: RESPONSIBILITY_WEIGHTS.returning,
      reason: 'It came up less often after your change and is starting to come up more again.',
      source: 'CUSTOMERS',
    });
    return {
      state: 'DO_NOW',
      instruction: 'Look at this again',
      headline: `${signal.themeLabel} is coming back after your change.`,
      extra,
    };
  }

  // The owner decided not to act. Asking again would be nagging; RepOS keeps
  // watching, says so, and says why it is still here.
  if (progress?.action.status === 'DECLINED' && signal.kind === 'ISSUE') {
    return {
      state: 'WATCH',
      instruction: 'You decided not to act; Headway keeps watching',
      headline: signal.bucket === 'FIRST'
        ? `${signal.themeLabel} is still the clearest complaint. You decided not to pursue a change.`
        : `${signal.themeLabel} is still a pattern. You decided not to pursue a change.`,
      extra,
    };
  }

  switch (signal.advice) {
    case 'START':
      return {
        state: 'DO_NOW',
        instruction: 'Decide what to change',
        headline: `${signal.themeLabel} is the clearest thing customers are unhappy about.`,
        extra,
      };
    case 'HOLD':
      return {
        state: 'DO_NOW',
        instruction: 'Decide: act now, or wait',
        headline: `${signal.themeLabel} is your clearest weakness, though it came up less at your latest check-in.`,
        extra,
      };
    case 'CONTINUE': {
      const paused = progress?.action.status === 'PAUSED';
      extra.push({
        key: 'agreed_not_done',
        weight: RESPONSIBILITY_WEIGHTS.agreed_not_done,
        reason: paused
          ? 'You agreed a change and then put it on hold.'
          : 'You agreed a change that has not been made yet.',
        source: 'YOU',
      });
      return {
        state: 'FOLLOW_UP',
        instruction: paused ? 'Decide whether to restart the change' : 'Finish the change you agreed',
        headline: paused
          ? `The change you agreed for ${label} is on hold.`
          : `The change you agreed for ${label} has not been made yet.`,
        extra,
      };
    }
    case 'CHECKING': {
      if (progress?.canMeasure) {
        extra.push({
          key: 'comparison_due',
          weight: RESPONSIBILITY_WEIGHTS.comparison_due,
          reason: `Enough feedback has come in after your change to compare before and after.`,
          source: 'REPOS',
        });
        return {
          state: 'FOLLOW_UP',
          instruction: 'A comparison is due',
          headline: `Your change for ${label} can now be compared with the feedback after it.`,
          extra,
        };
      }
      return {
        state: 'WAITING_FOR_EVIDENCE',
        instruction: 'Change made, not yet checked',
        headline: `Your change for ${label} is in place. Headway is waiting for enough new feedback to compare.`,
        extra,
      };
    }
    case 'KEEP_CHANGE':
      return {
        state: 'KEEP_DOING',
        instruction: 'Keep the change in place',
        headline: `${signal.themeLabel} came up less often in the feedback after your change.`,
        extra,
      };
    case 'REVIEW_CHANGE':
      extra.push({
        key: 'measured_worsened',
        weight: RESPONSIBILITY_WEIGHTS.measured_worsened,
        reason: 'It came up more often in the feedback after your change.',
        source: 'CUSTOMERS',
      });
      return {
        state: 'DO_NOW',
        instruction: 'Look at this again',
        headline: `${signal.themeLabel} came up more often in the feedback after your change.`,
        extra,
      };
    case 'PROTECT':
      return {
        state: 'KEEP_DOING',
        instruction: 'Protect this',
        headline: signal.isRecurring
          ? `Customers consistently praise your ${label}.`
          : `Customers praise your ${label}.`,
        extra,
      };
    case 'WAIT':
      return {
        state: 'WAITING_FOR_EVIDENCE',
        instruction: 'Not enough feedback yet',
        headline:
          signal.kind === 'ISSUE'
            ? `${signal.themeLabel} has come up, but not often enough to act on.`
            : `${signal.themeLabel} is praised, but not yet often enough to call a strength.`,
        extra,
      };
    case 'WATCH':
    default: {
      if (signal.kind === 'PRAISE') {
        return {
          state: 'WATCH',
          instruction: 'Watching a strength',
          headline: `Customers praised your ${label} less at your latest check-in.`,
          extra,
        };
      }
      // A measured "no clear change" or "not enough after the change" reads
      // as a watch with the loop attached; an ordinary secondary complaint is
      // a pattern that is not the one to act on first.
      if (signal.outcome?.result === 'INSUFFICIENT_DATA') {
        return {
          state: 'WAITING_FOR_EVIDENCE',
          instruction: 'Change made, not enough feedback since',
          headline: `Not enough feedback after your change for ${label} to compare yet.`,
          extra,
        };
      }
      if (signal.outcome?.result === 'NO_CLEAR_CHANGE') {
        return {
          state: 'WATCH',
          instruction: 'Keep collecting feedback',
          headline: `${signal.themeLabel} reads about the same after your change as before.`,
          extra,
        };
      }
      return {
        state: 'WATCH',
        instruction: 'Important, not urgent',
        headline:
          signal.movementDirection === 'WORSENING'
            ? `${signal.themeLabel} came up more at your latest check-in.`
            : `${signal.themeLabel} is a pattern, but not the complaint to act on first.`,
        extra,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// The thread: what customers said → what you decided → what happened → now → next
// ---------------------------------------------------------------------------

function threadFor(signal: PortalSignal, action: PortalAction | null): ThreadStep[] {
  const steps: ThreadStep[] = [];
  const label = spoken(signal.themeLabel);

  if (action) {
    steps.push({
      key: 'observed',
      label: 'Customers said',
      text: action.problem,
      at: action.suggestedAt,
      source: 'CUSTOMERS',
    });
    if (action.stage === 'NOT_DOING') {
      steps.push({
        key: 'decided',
        label: 'You decided',
        text: action.decisionNote
          ? `Not to pursue this. ${action.decisionNote}`
          : 'Not to pursue this.',
        at: action.decidedAt,
        source: 'YOU',
      });
    } else if (action.decidedAt) {
      steps.push({
        key: 'decided',
        label: 'You decided',
        text: action.decision || 'To act on this.',
        at: action.decidedAt,
        source: 'YOU',
      });
    }
    if (action.doneAt && action.stage !== 'NOT_DOING') {
      steps.push({
        key: 'changed',
        label: 'You changed it',
        text: action.decision ? `Made: ${action.decision}` : 'You told us the change was in place.',
        at: action.doneAt,
        source: 'YOU',
      });
    }
    if (action.outcome) {
      steps.push({
        key: 'result',
        label: 'What the feedback did',
        text: `${action.outcome.headline} ${action.outcome.note}`,
        at: action.measuredAt,
        source: 'CUSTOMERS',
      });
    } else if (action.awaiting) {
      steps.push({
        key: 'result',
        label: 'What the feedback did',
        text:
          action.awaiting.have >= action.awaiting.need
            ? `Not compared yet — ${action.awaiting.have} pieces of new feedback have come in, which is enough to compare.`
            : `Not compared yet — ${action.awaiting.have} of the ${action.awaiting.need} pieces of new feedback needed have come in.`,
        at: null,
        source: 'REPOS',
      });
    }
  } else {
    steps.push({
      key: 'observed',
      label: 'Customers say',
      text: signal.fact,
      at: null,
      source: 'CUSTOMERS',
    });
  }

  // "Now" is the movement at the last two check-ins, only when the engine
  // could read one; otherwise the reading of the whole pile.
  const now =
    signal.returning
      ? `It came up less often after your earlier change but is starting to come up more again.`
      : signal.movementLine
        ? `At your last two check-ins: ${signal.movementLine}`
        : action
          ? signal.brief
          : null;
  if (now) {
    steps.push({ key: 'now', label: 'Now', text: now, at: null, source: 'REPOS' });
  }
  steps.push({ key: 'next', label: 'Headway will watch', text: signal.watchLine, at: null, source: 'REPOS' });

  void label;
  return steps;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function themeItem(
  signal: PortalSignal,
  input: ResponsibilityInput,
  loops: Map<string, ActionProgress>,
): ResponsibilityItem {
  const intel = input.intelligence;
  const insight = insightFor(intel, signal.themeKey);
  const progress = loops.get(signal.themeKey);
  const action = actionFor(input.view, signal.themeKey);
  const placed = placeSignal(signal, progress);

  const weighed: Weighed[] = [...fromIntelligence(insight?.signals ?? []), ...placed.extra];
  if (signal.ownerPriority) {
    weighed.push({
      key: 'owner_priority',
      weight: RESPONSIBILITY_WEIGHTS.owner_priority,
      reason: 'You told us this is what matters most right now.',
      source: 'YOU',
    });
  }
  const priority = STATE_WEIGHTS[placed.state] + weighed.reduce((sum, s) => sum + s.weight, 0);

  // Why it matters: the reading M12 already wrote for this theme, plus the
  // pack's severity reason when the engine gave one. Never a new count.
  const why = [signal.brief, ...signal.why.slice(0, 1)].filter(Boolean).join(' ');

  const contextUsed = [signal.ownerPriority, ...signal.ownerContext].filter(
    (line): line is string => typeof line === 'string' && line.length > 0,
  );

  const limitations: string[] = [];
  if (insight?.confidence === 'EARLY') {
    limitations.push('This rests on little feedback, so it is an early signal rather than a conclusion.');
  }
  if (signal.outcome) {
    limitations.push(signal.outcome.caveat || signal.outcome.note);
  }

  return {
    id: `${intel.clientId}:${placed.state}:${signal.themeKey}`,
    state: placed.state,
    stateLabel: STATE_LABELS[placed.state],
    instruction: placed.instruction,
    priority,
    reasons: unweighed(weighed),
    themeKey: signal.themeKey,
    themeLabel: signal.themeLabel,
    kind: signal.kind,
    relatedInsight: insight?.id ?? null,
    relatedAction: action?.id ?? null,
    headline: placed.headline,
    whyItMatters: why,
    recommendedNextStep: signal.nextStep,
    evidence: evidenceFor(signal, insight),
    contextUsed,
    contextNote: signal.suggestionNote,
    thread: threadFor(signal, action),
    watching: signal.watchLine,
    limitations,
  };
}

/** Reviews the reply engine will not answer: they need the owner's own words. */
function needsYourWordsItem(input: ResponsibilityInput): ResponsibilityItem | null {
  const n = input.needsYourWords;
  if (n <= 0) return null;
  const intel = input.intelligence;
  const reason = `${n} ${n === 1 ? 'piece' : 'pieces'} of feedback ${n === 1 ? 'mentions' : 'mention'} harm, money back or taking things further.`;
  return {
    id: `${intel.clientId}:FOLLOW_UP:needs-your-words`,
    state: 'FOLLOW_UP',
    stateLabel: STATE_LABELS.FOLLOW_UP,
    instruction: 'Answer these yourself',
    priority:
      STATE_WEIGHTS.FOLLOW_UP + RESPONSIBILITY_WEIGHTS.needs_your_words,
    reasons: [{ reason, source: 'CUSTOMERS' }],
    themeKey: null,
    themeLabel: null,
    kind: null,
    relatedInsight: null,
    relatedAction: null,
    headline: `${n} ${n === 1 ? 'piece' : 'pieces'} of feedback ${n === 1 ? 'needs' : 'need'} your own words.`,
    whyItMatters:
      'Headway does not suggest a reply where someone mentions harm, safety, money back or taking things further. A person should read and answer those.',
    recommendedNextStep: 'Read them on the Reviews page and answer in your own words, or tell your Headway contact how you want them handled.',
    evidence: null,
    contextUsed: [],
    contextNote: null,
    thread: [],
    watching: 'Headway will flag any new feedback of this kind the moment it is read.',
    limitations: [],
  };
}

/** Everything below the evidence floor, as one calm item rather than a list. */
function earlyItem(input: ResponsibilityInput): ResponsibilityItem | null {
  const early = input.view.early;
  if (early.length === 0) return null;
  const intel = input.intelligence;
  const names = early.map((s) => s.themeLabel);
  const joined = names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const single = early.length === 1 ? early[0] : null;
  return {
    id: `${intel.clientId}:WAITING_FOR_EVIDENCE:early`,
    state: 'WAITING_FOR_EVIDENCE',
    stateLabel: STATE_LABELS.WAITING_FOR_EVIDENCE,
    instruction: 'Not enough feedback yet',
    priority: STATE_WEIGHTS.WAITING_FOR_EVIDENCE,
    reasons: [],
    themeKey: single?.themeKey ?? null,
    themeLabel: single?.themeLabel ?? null,
    kind: single?.kind ?? null,
    relatedInsight: null,
    relatedAction: null,
    headline:
      single
        ? single.kind === 'PRAISE'
          ? `${single.themeLabel} is praised, but not yet often enough to call a strength.`
          : `${single.themeLabel} has come up, but not often enough to act on.`
        : `${joined} have come up, but not often enough to act on.`,
    whyItMatters: `Headway names something once ${MIN_MENTIONS_TO_NAME} customers have raised it. Until then it would be guessing.`,
    recommendedNextStep: 'Nothing to do. Headway will say so when any of these clears the floor.',
    evidence: null,
    contextUsed: [],
    contextNote: null,
    thread: [],
    watching:
      single?.watchLine ??
      'Headway is watching whether more customers raise these before it says anything about them.',
    limitations: [],
  };
}

/** Stable order: state first, then priority, then the label, then the id. */
export function compareItems(a: ResponsibilityItem, b: ResponsibilityItem): number {
  return (
    STATE_WEIGHTS[b.state] - STATE_WEIGHTS[a.state] ||
    b.priority - a.priority ||
    (a.themeLabel ?? '').localeCompare(b.themeLabel ?? '') ||
    a.id.localeCompare(b.id)
  );
}

// ---------------------------------------------------------------------------
// The work since the last check-in, and the next useful check
// ---------------------------------------------------------------------------

function didFor(args: {
  input: ResponsibilityInput;
  first: PortalSignal | null;
  hasDoNow: boolean;
  /** Anything at all sitting under "Needs you", not only a new issue. */
  hasNeedsYou: boolean;
}): { did: string[]; sinceLabel: string } {
  const { input, first } = args;
  const intel = input.intelligence;
  const since = input.checkins[0]?.capturedAt ?? null;
  const f = input.feedbackSince;
  const did: string[] = [];

  const sinceLabel = since
    ? `Since your check-in on ${formatDate(since)}`
    : 'Since feedback started coming in';

  if (intel.evidence.analysed === 0 && f.total === 0) {
    return { did, sinceLabel };
  }

  // The read count. "Since" is said only when there is a check-in to be since.
  const direct = f.direct > 0 ? ` — ${f.direct} of them sent through your feedback page` : '';
  if (since) {
    if (f.read > 0) {
      did.push(`Since your check-in on ${formatDate(since)}, read ${pieces(f.read)}${direct}.`);
    } else if (f.unread > 0) {
      did.push(
        `Since your check-in on ${formatDate(since)}, ${pieces(f.unread)} ${f.unread === 1 ? 'has' : 'have'} come in and ${f.unread === 1 ? 'is' : 'are'} being read now.`,
      );
    } else {
      did.push(`No new feedback has come in since your check-in on ${formatDate(since)}.`);
    }
    if (f.read > 0 && f.unread > 0) {
      did.push(`${f.unread} more ${f.unread === 1 ? 'is' : 'are'} being read now.`);
    }
  } else if (intel.evidence.analysed > 0) {
    did.push(
      `Read ${pieces(intel.evidence.analysed)}${f.direct > 0 ? ` — ${f.direct} of them sent through your feedback page` : ''}${intel.evidence.unread > 0 ? ` (${intel.evidence.unread} more being read now)` : ''}.`,
    );
  } else if (intel.evidence.unread > 0) {
    did.push(`${pieces(intel.evidence.unread)} ${intel.evidence.unread === 1 ? 'is' : 'are'} being read now.`);
  }

  // The comparisons and the grouping, in M12's own words: what RepOS read,
  // what it grouped that reading into, which check-ins it compared, what it
  // remembered. The grouping line is the clearest statement of the work the
  // owner would otherwise be doing by hand, and until M17 it was computed and
  // then dropped on the floor.
  for (const line of input.view.work) {
    if (/^Grouped |^Compared |^Kept track /.test(line)) did.push(line);
  }

  // The checks RepOS actually made on the new feedback. Only when there was
  // new feedback to check against.
  if (first && f.read > 0) {
    did.push(
      since
        ? `Checked whether ${spoken(first.themeLabel)} is still coming up in the new feedback.`
        : `Checked whether ${spoken(first.themeLabel)} keeps coming up across everything read.`,
    );
  }
  // Only claim a clear read when the owner is genuinely not being asked for
  // anything. It used to test DO_NOW alone, so an owner with a follow-up
  // sitting in "Needs you" read "Found no new issue strong enough to
  // recommend action" directly underneath it (M18).
  if (!args.hasNeedsYou && intel.evidence.enough && f.read > 0) {
    did.push('Found no new issue strong enough to recommend action.');
  }

  return { did, sinceLabel };
}

function nextCheckFor(args: {
  input: ResponsibilityInput;
  comparisonsDue: number;
}): string {
  const { input } = args;
  const intel = input.intelligence;
  const checkins = input.checkins;
  const latest = checkins[0] ?? null;
  const f = input.feedbackSince;

  if (args.comparisonsDue > 0) {
    return args.comparisonsDue === 1
      ? 'A comparison is due now: enough feedback has come in after your change to compare before and after.'
      : `${args.comparisonsDue} comparisons are due now: enough feedback has come in after those changes to compare before and after.`;
  }
  if (intel.evidence.analysed === 0) {
    return 'Once feedback starts coming in, a first check-in gives Headway something to compare against later.';
  }
  if (!latest) {
    return 'A first check-in now would give Headway something to compare your next one against.';
  }
  const days = daysBetween(latest.capturedAt, input.now);
  if (checkins.length === 1) {
    return f.read >= MIN_FEEDBACK_TO_MEASURE
      ? `A second check-in now would let Headway show what changed — ${pieces(f.read)} ${f.read === 1 ? 'has' : 'have'} come in since the first.`
      : `A second check-in will show what changed. So far ${f.read} of the ${MIN_FEEDBACK_TO_MEASURE} pieces of new feedback that make a comparison worthwhile ${f.read === 1 ? 'has' : 'have'} come in.`;
  }
  if (f.read >= MIN_FEEDBACK_TO_MEASURE) {
    return `Worth a check-in now: ${pieces(f.read)} ${f.read === 1 ? 'has' : 'have'} come in since ${formatDate(latest.capturedAt)}, enough to show what changed.`;
  }
  if (days >= STALE_SNAPSHOT_DAYS) {
    return `Worth a check-in now: it has been ${days} days since your last one, even though only ${pieces(f.read)} ${f.read === 1 ? 'has' : 'have'} come in since.`;
  }
  return `Not yet. ${f.read === 0 ? 'No new feedback has' : `${pieces(f.read)} ${f.read === 1 ? 'has' : 'have'}`} come in since your check-in on ${formatDate(latest.capturedAt)}; Headway will say when another check-in would show something new.`;
}

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

function answerFor(args: {
  input: ResponsibilityInput;
  needsYou: ResponsibilityItem[];
  watching: ResponsibilityItem[];
}): { state: ResponsibilityState; answer: string; detail: string } {
  const { input, needsYou, watching } = args;
  const intel = input.intelligence;

  if (intel.evidence.analysed === 0) {
    return {
      state: 'WAITING_FOR_EVIDENCE',
      answer: 'Nothing to decide yet.',
      detail:
        intel.evidence.unread > 0
          ? `${pieces(intel.evidence.unread)} ${intel.evidence.unread === 1 ? 'has' : 'have'} arrived and Headway is reading ${intel.evidence.unread === 1 ? 'it' : 'them'} now — usually done within a minute. Reload to see what it found.`
          : 'Headway has no customer feedback to work from yet. Once it starts coming in, this page will say what needs you.',
    };
  }

  const top = needsYou[0];
  if (top) {
    const doNow = needsYou.filter((i) => i.state === 'DO_NOW').length;
    const follow = needsYou.length - doNow;
    const bits: string[] = [];
    if (doNow > 0) bits.push(`${doNow} ${doNow === 1 ? 'thing needs a decision' : 'things need decisions'}`);
    if (follow > 0) bits.push(`${follow} to follow through on`);
    return {
      state: top.state,
      answer:
        needsYou.length === 1
          ? top.state === 'DO_NOW'
            ? 'Yes — one thing needs a decision from you.'
            : 'One thing to follow through on.'
          : `Yes — ${bits.join(', ')}.`,
      detail:
        watching.length > 0
          ? `Headway is watching ${watching.length} other ${watching.length === 1 ? 'thing' : 'things'} for you; none of them needs you right now.`
          : 'Nothing else needs you.',
    };
  }

  if (!intel.evidence.enough) {
    return {
      state: 'WAITING_FOR_EVIDENCE',
      answer: 'Not enough feedback yet to say.',
      detail: `Headway has read ${pieces(intel.evidence.analysed)} — enough to start looking, not enough to be sure of anything. Nothing is being recommended until more comes in.`,
    };
  }

  return {
    state: 'CLEAR',
    answer: 'Nothing needs you right now.',
    detail:
      watching.length > 0
        ? `Headway is watching ${watching.length} ${watching.length === 1 ? 'thing' : 'things'} for you and will say when one of them needs a decision.`
        : 'Nothing is coming up often enough to act on. Headway will say when that changes.',
  };
}

// ---------------------------------------------------------------------------
// The object
// ---------------------------------------------------------------------------

export function buildResponsibility(input: ResponsibilityInput): Responsibility {
  const { view, intelligence: intel } = input;

  const loops = new Map<string, ActionProgress>();
  for (const p of input.actions) {
    const key = p.action.provenance.themeKey;
    const current = loops.get(key);
    const rank: Record<string, number> = {
      MEASURED: 5,
      DONE: 4,
      ACCEPTED: 3,
      PAUSED: 3,
      RECOMMENDED: 2,
      DECLINED: 1,
    };
    if (!current || (rank[p.action.status] ?? 0) > (rank[current.action.status] ?? 0)) {
      loops.set(key, p);
    }
  }

  // One item per theme: the signals M12 already read, each placed once. A
  // theme in both "changed" and "unhappy" is the same theme, so the changed
  // list is never a second source of items.
  const seen = new Set<string>();
  const items: ResponsibilityItem[] = [];
  // Every complaint that clears the floor is carried. Of the strengths, the
  // one M12 chose to feature is carried, plus any the owner said matters or
  // that has a change attached — the rest are praise the owner can read on
  // Customers, not something RepOS is responsible for watching separately.
  for (const signal of [
    ...(view.first ? [view.first] : []),
    ...(view.keep ? [view.keep] : []),
    ...view.watch,
    ...view.unhappy,
    ...view.loved.filter((s) => s.ownerPriority !== null || loops.has(s.themeKey)),
  ]) {
    if (seen.has(signal.themeKey)) continue;
    if (signal.bucket === 'EARLY') continue;
    seen.add(signal.themeKey);
    items.push(themeItem(signal, input, loops));
  }

  const words = needsYourWordsItem(input);
  if (words) items.push(words);
  const early = earlyItem(input);
  if (early) items.push(early);

  items.sort(compareItems);

  const needsYou = items.filter((i) => i.state === 'DO_NOW' || i.state === 'FOLLOW_UP');
  const watching = items.filter((i) => !(i.state === 'DO_NOW' || i.state === 'FOLLOW_UP'));

  const comparisonsDue = input.actions.filter((p) => p.canMeasure && p.action.status === 'DONE').length;
  const { did, sinceLabel } = didFor({
    input,
    first: view.first,
    hasDoNow: needsYou.some((i) => i.state === 'DO_NOW'),
    hasNeedsYou: needsYou.length > 0,
  });
  const verdict = answerFor({ input, needsYou, watching });

  // What this page cannot say: the engine's own limits, plus the two things
  // this layer knows that it does not — a paused feedback page, and an
  // archived business.
  const limitations = [...view.limits];
  if (input.gateway && !input.gateway.enabled) {
    limitations.push(
      'Your feedback page is paused, so nothing new is arriving through the QR until it is switched back on.',
    );
  }
  if (input.archived) {
    limitations.push('This account is no longer active, so Headway is not collecting anything new for it.');
  }
  if (!intel.window.available && input.checkins.length >= 2 && intel.evidence.analysed > 0) {
    // The engine already says why the two check-ins could not be compared;
    // nothing to add.
  }

  return {
    clientId: intel.clientId,
    businessName: intel.businessName,
    state: verdict.state,
    answer: verdict.answer,
    answerDetail: verdict.detail,
    needsYou,
    watching,
    did,
    sinceLabel,
    lastCheckinAt: input.checkins[0]?.capturedAt ?? null,
    nextUsefulCheck: nextCheckFor({ input, comparisonsDue }),
    limitations: [...new Set(limitations)],
    basedOn: intel.evidence.analysed,
    version: RESPONSIBILITY_VERSION,
  };
}

/**
 * Every number the object states, for the same guard the intelligence and
 * owner-update layers use: prose may only carry figures the data holds.
 */
export function responsibilityNumbers(input: ResponsibilityInput): Set<string> {
  const out = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (typeof n === 'number' && Number.isFinite(n)) out.add(String(n));
  };
  const intel = input.intelligence;
  add(intel.evidence.analysed);
  add(intel.evidence.total);
  add(intel.evidence.unread);
  add(input.feedbackSince.read);
  add(input.feedbackSince.unread);
  add(input.feedbackSince.direct);
  add(input.feedbackSince.total);
  add(input.needsYourWords);
  // The floors the watch lines name: the pattern floor, the strength floor
  // (twice the pattern floor), the reporting floor and the comparison floor.
  add(MIN_MENTIONS_TO_NAME);
  add(MIN_MENTIONS_TO_NAME * 2);
  add(MIN_CHANGE_TO_REPORT);
  add(MIN_FEEDBACK_TO_MEASURE);
  add(MIN_PERIOD_FEEDBACK_TO_COMPARE);
  for (const s of [...input.view.loved, ...input.view.unhappy, ...input.view.early]) {
    add(s.evidenceCount);
    add(s.evidenceTotal);
  }
  for (const a of input.view.actions) {
    add(a.awaiting?.have);
    add(a.awaiting?.need);
  }
  // The loop's own counts, which M12's work lines already state.
  const measured = input.view.actions.filter((a) => a.outcome !== null).length;
  add(input.view.actions.length);
  add(measured);
  add(input.view.actions.length - measured);
  for (const c of input.checkins) {
    add(daysBetween(c.capturedAt, input.now));
  }
  return out;
}
