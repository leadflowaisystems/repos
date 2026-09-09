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
import { spoken, type PortalAction, type PortalSignal, type PortalView } from '@/lib/portal/view';
import { formatDate } from '@/lib/format';
import { EN, type PortalTranslator } from '@/lib/i18n/translator';

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
 * The same six words, as dictionary keys.
 *
 * `STATE_LABELS` stays as it is — the operator console reads these builders
 * without a translator, and staff read one language. What reaches an owner
 * goes through `stateLabel` instead, so the badge is in their language.
 */
const STATE_KEYS = {
  DO_NOW: 'responsibility.state.doNow',
  FOLLOW_UP: 'responsibility.state.followUp',
  WATCH: 'responsibility.state.watch',
  KEEP_DOING: 'responsibility.state.keepDoing',
  WAITING_FOR_EVIDENCE: 'responsibility.state.waiting',
  CLEAR: 'responsibility.state.clear',
} as const satisfies Record<ResponsibilityState, string>;

function stateLabel(state: ResponsibilityState, t: PortalTranslator): string {
  return t(STATE_KEYS[state]);
}

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
  /** "14 of 110 feedback entries mention it." */
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
  /** What each `did` line is: 'read' | 'readingMore' | 'grouped' | 'compared' | 'measured' | 'remembered' | 'checked' | 'noProblem'. */
  didKinds: string[];
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
  /** Feedback the reply engine handed to a person: harm, money back, escalation. */
  needsYourWords: number;
  /** Null when the client has never had a feedback page created. */
  gateway: GatewayState | null;
  archived: boolean;
  now: Date;
  /**
   * The language this portal is being read in, as a translator.
   *
   * Passed in, never looked up: these builders are pure, and a function that
   * asked what language it was in would have to be edited again for the next
   * one. Omitted means English — which is not an oversight but the operator
   * console's deliberate answer, since staff read one language.
   */
  t?: PortalTranslator;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const CERTAINTY = {
  STRONG: 'responsibility.certainty.strong',
  MODERATE: 'responsibility.certainty.moderate',
  EARLY: 'responsibility.certainty.early',
} as const satisfies Record<Insight['confidence'], string>;

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

function evidenceFor(
  signal: PortalSignal,
  insight: Insight | null,
  t: PortalTranslator,
): ResponsibilityEvidence {
  return {
    count: signal.evidenceCount,
    outOf: signal.evidenceTotal,
    line: signal.fact,
    scope: t('responsibility.evidence.scope'),
    certainty: t(CERTAINTY[insight?.confidence ?? 'EARLY']),
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
function placeSignal(
  signal: PortalSignal,
  progress: ActionProgress | undefined,
  t: PortalTranslator,
): Placement {
  const label = spoken(signal.themeLabel);
  const extra: Weighed[] = [];

  if (signal.returning) {
    extra.push({
      key: 'returning',
      weight: RESPONSIBILITY_WEIGHTS.returning,
      reason: t('responsibility.reason.returning'),
      source: 'CUSTOMERS',
    });
    return {
      state: 'DO_NOW',
      instruction: t('responsibility.instruction.lookAgain'),
      headline: t('responsibility.headline.returning', { theme: signal.themeLabel }),
      extra,
    };
  }

  // The owner decided not to act. Asking again would be nagging, so the state
  // stays Watching, the instruction says the decision stands, and the headline
  // says why the theme is still on the page.
  if (progress?.action.status === 'DECLINED' && signal.kind === 'ISSUE') {
    return {
      state: 'WATCH',
      instruction: t('responsibility.instruction.notDoing'),
      headline: signal.bucket === 'FIRST'
        ? t('responsibility.headline.declinedFirst', { theme: signal.themeLabel })
        : t('responsibility.headline.declinedPattern', { theme: signal.themeLabel }),
      extra,
    };
  }

  switch (signal.advice) {
    case 'START':
      return {
        state: 'DO_NOW',
        instruction: t('responsibility.instruction.decideChange'),
        headline: t('responsibility.headline.start', { theme: signal.themeLabel }),
        extra,
      };
    case 'HOLD':
      return {
        state: 'DO_NOW',
        instruction: t('responsibility.instruction.actOrWait'),
        headline: t('responsibility.headline.hold', { theme: signal.themeLabel }),
        extra,
      };
    case 'CONTINUE': {
      const paused = progress?.action.status === 'PAUSED';
      extra.push({
        key: 'agreed_not_done',
        weight: RESPONSIBILITY_WEIGHTS.agreed_not_done,
        reason: paused
          ? t('responsibility.reason.agreedPaused')
          : t('responsibility.reason.agreedNotDone'),
        source: 'YOU',
      });
      return {
        state: 'FOLLOW_UP',
        instruction: paused
          ? t('responsibility.instruction.restart')
          : t('responsibility.instruction.finishChange'),
        headline: paused
          ? t('responsibility.headline.continuePaused', { theme: label })
          : t('responsibility.headline.continue', { theme: label }),
        extra,
      };
    }
    case 'CHECKING': {
      if (progress?.canMeasure) {
        extra.push({
          key: 'comparison_due',
          weight: RESPONSIBILITY_WEIGHTS.comparison_due,
          reason: t('responsibility.reason.comparisonDue'),
          source: 'REPOS',
        });
        return {
          state: 'FOLLOW_UP',
          instruction: t('responsibility.instruction.readyToCompare'),
          headline: t('responsibility.headline.comparisonDue', { theme: label }),
          extra,
        };
      }
      return {
        state: 'WAITING_FOR_EVIDENCE',
        instruction: t('responsibility.instruction.notYetChecked'),
        headline: t('responsibility.headline.checking', { theme: label }),
        extra,
      };
    }
    case 'KEEP_CHANGE':
      return {
        state: 'KEEP_DOING',
        instruction: t('responsibility.instruction.keepChange'),
        headline: t('responsibility.headline.keepChange', { theme: label }),
        extra,
      };
    case 'REVIEW_CHANGE':
      extra.push({
        key: 'measured_worsened',
        weight: RESPONSIBILITY_WEIGHTS.measured_worsened,
        reason: t('responsibility.reason.measuredWorsened'),
        source: 'CUSTOMERS',
      });
      return {
        state: 'DO_NOW',
        instruction: t('responsibility.instruction.lookAgain'),
        headline: t('responsibility.headline.reviewChange', { theme: label }),
        extra,
      };
    case 'PROTECT':
      return {
        state: 'KEEP_DOING',
        // Not "Protect this": the badge beside it already says "Keep doing
        // this", and a synonym in the second slot spends a line saying nothing.
        // This one says what to actually do about it.
        instruction: t('responsibility.instruction.keepAsIs'),
        headline: signal.isRecurring
          ? t('responsibility.headline.protectRecurring', { theme: label })
          : t('responsibility.headline.protect', { theme: label }),
        extra,
      };
    case 'WAIT':
      return {
        state: 'WAITING_FOR_EVIDENCE',
        instruction: t('responsibility.instruction.nothingYet'),
        headline:
          signal.kind === 'ISSUE'
            ? t('responsibility.headline.waitIssue', { theme: signal.themeLabel })
            : t('responsibility.headline.waitPraise', { theme: label }),
        extra,
      };
    case 'WATCH':
    default: {
      if (signal.kind === 'PRAISE') {
        return {
          state: 'WATCH',
          instruction: t('responsibility.instruction.nothingYet'),
          headline: t('responsibility.headline.praiseFading', { theme: label }),
          extra,
        };
      }
      // A measured "no clear change" or "not enough after the change" reads
      // as a watch with the loop attached; an ordinary secondary complaint is
      // a pattern that is not the one to act on first.
      if (signal.outcome?.result === 'INSUFFICIENT_DATA') {
        return {
          state: 'WAITING_FOR_EVIDENCE',
          instruction: t('responsibility.instruction.notEnoughSince'),
          headline: t('responsibility.headline.insufficient', { theme: label }),
          extra,
        };
      }
      if (signal.outcome?.result === 'NO_CLEAR_CHANGE') {
        return {
          state: 'WATCH',
          instruction: t('responsibility.instruction.keepCollecting'),
          headline: t('responsibility.headline.noClearChange', { theme: signal.themeLabel }),
          extra,
        };
      }
      return {
        state: 'WATCH',
        instruction: t('responsibility.instruction.importantNotUrgent'),
        headline:
          signal.movementDirection === 'WORSENING'
            ? t('responsibility.headline.worsening', { theme: signal.themeLabel })
            : t('responsibility.headline.secondary', { theme: signal.themeLabel }),
        extra,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// The thread: what customers said → what you decided → what happened → now → next
// ---------------------------------------------------------------------------

function threadFor(
  signal: PortalSignal,
  action: PortalAction | null,
  t: PortalTranslator,
): ThreadStep[] {
  const steps: ThreadStep[] = [];
  const label = spoken(signal.themeLabel);

  if (action) {
    steps.push({
      key: 'observed',
      label: t('responsibility.thread.observed'),
      text: action.problem,
      at: action.suggestedAt,
      source: 'CUSTOMERS',
    });
    if (action.stage === 'NOT_DOING') {
      steps.push({
        key: 'decided',
        label: t('responsibility.thread.decided'),
        text: action.decisionNote
          ? t('responsibility.thread.notDoingWithNote', { note: action.decisionNote })
          : t('responsibility.thread.notDoing'),
        at: action.decidedAt,
        source: 'YOU',
      });
    } else if (action.decidedAt) {
      steps.push({
        key: 'decided',
        label: t('responsibility.thread.decided'),
        text: action.decision || t('responsibility.thread.toAct'),
        at: action.decidedAt,
        source: 'YOU',
      });
    }
    if (action.doneAt && action.stage !== 'NOT_DOING') {
      steps.push({
        key: 'changed',
        label: t('responsibility.thread.changed'),
        text: action.decision
          ? t('responsibility.thread.made', { decision: action.decision })
          : t('responsibility.thread.madeUnnamed'),
        at: action.doneAt,
        source: 'YOU',
      });
    }
    if (action.outcome) {
      steps.push({
        key: 'result',
        label: t('responsibility.thread.result'),
        text: `${action.outcome.headline} ${action.outcome.note}`,
        at: action.measuredAt,
        source: 'CUSTOMERS',
      });
    } else if (action.awaiting) {
      steps.push({
        key: 'result',
        label: t('responsibility.thread.result'),
        text:
          action.awaiting.have >= action.awaiting.need
            ? t('responsibility.thread.awaitingEnough', { have: action.awaiting.have })
            : t('responsibility.thread.awaitingShort', {
                have: action.awaiting.have,
                need: action.awaiting.need,
              }),
        at: null,
        source: 'REPOS',
      });
    }
  } else {
    steps.push({
      key: 'observed',
      label: t('responsibility.thread.observed'),
      text: signal.fact,
      at: null,
      source: 'CUSTOMERS',
    });
  }

  // "Now" is the movement at the last two check-ins, only when the engine
  // could read one; otherwise the reading of the whole pile.
  const now =
    signal.returning
      ? t('responsibility.thread.nowReturning')
      : signal.movementLine
        ? t('responsibility.thread.nowMovement', { movement: signal.movementLine })
        : action
          ? signal.brief
          : null;
  if (now) {
    steps.push({ key: 'now', label: t('responsibility.thread.now'), text: now, at: null, source: 'REPOS' });
  }
  steps.push({
    key: 'next',
    label: t('responsibility.thread.next'),
    text: signal.watchLine,
    at: null,
    source: 'REPOS',
  });

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
  t: PortalTranslator,
): ResponsibilityItem {
  const intel = input.intelligence;
  const insight = insightFor(intel, signal.themeKey);
  const progress = loops.get(signal.themeKey);
  const action = actionFor(input.view, signal.themeKey);
  const placed = placeSignal(signal, progress, t);

  const weighed: Weighed[] = [...fromIntelligence(insight?.signals ?? []), ...placed.extra];
  if (signal.ownerPriority) {
    weighed.push({
      key: 'owner_priority',
      weight: RESPONSIBILITY_WEIGHTS.owner_priority,
      reason: t('responsibility.reason.ownerPriority'),
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
    limitations.push(t('responsibility.limit.early'));
  }
  if (signal.outcome) {
    limitations.push(signal.outcome.caveat || signal.outcome.note);
  }

  return {
    id: `${intel.clientId}:${placed.state}:${signal.themeKey}`,
    state: placed.state,
    stateLabel: stateLabel(placed.state, t),
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
    evidence: evidenceFor(signal, insight, t),
    contextUsed,
    contextNote: signal.suggestionNote,
    thread: threadFor(signal, action, t),
    watching: signal.watchLine,
    limitations,
  };
}

/** Feedback the reply engine will not answer: it needs the owner's own words. */
function needsYourWordsItem(
  input: ResponsibilityInput,
  t: PortalTranslator,
): ResponsibilityItem | null {
  const n = input.needsYourWords;
  if (n <= 0) return null;
  const intel = input.intelligence;
  const reason = t.plural('responsibility.words.reason', n);
  return {
    id: `${intel.clientId}:FOLLOW_UP:needs-your-words`,
    state: 'FOLLOW_UP',
    stateLabel: stateLabel('FOLLOW_UP', t),
    instruction: t('responsibility.instruction.answerYourself'),
    priority:
      STATE_WEIGHTS.FOLLOW_UP + RESPONSIBILITY_WEIGHTS.needs_your_words,
    reasons: [{ reason, source: 'CUSTOMERS' }],
    themeKey: null,
    themeLabel: null,
    kind: null,
    relatedInsight: null,
    relatedAction: null,
    headline: t.plural('responsibility.words.headline', n),
    whyItMatters: t('responsibility.words.why'),
    recommendedNextStep: t('responsibility.words.next'),
    evidence: null,
    contextUsed: [],
    contextNote: null,
    thread: [],
    watching: t('responsibility.words.watching'),
    limitations: [],
  };
}

/** Everything below the evidence floor, as one calm item rather than a list. */
function earlyItem(
  input: ResponsibilityInput,
  t: PortalTranslator,
): ResponsibilityItem | null {
  const early = input.view.early;
  if (early.length === 0) return null;
  const intel = input.intelligence;
  const names = early.map((s) => s.themeLabel);
  const joined = names.length <= 1
    ? (names[0] ?? '')
    : t('responsibility.early.joined', {
        head: names.slice(0, -1).join(', '),
        last: names[names.length - 1] ?? '',
      });
  const single = early.length === 1 ? early[0] : null;
  return {
    id: `${intel.clientId}:WAITING_FOR_EVIDENCE:early`,
    state: 'WAITING_FOR_EVIDENCE',
    stateLabel: stateLabel('WAITING_FOR_EVIDENCE', t),
    instruction: t('responsibility.instruction.nothingYet'),
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
          ? t('responsibility.headline.waitPraise', { theme: spoken(single.themeLabel) })
          : t('responsibility.headline.waitIssue', { theme: single.themeLabel })
        : t('responsibility.early.headline', { themes: joined }),
    whyItMatters: t('responsibility.early.why', { min: MIN_MENTIONS_TO_NAME }),
    recommendedNextStep: t('responsibility.early.next'),
    evidence: null,
    contextUsed: [],
    contextNote: null,
    thread: [],
    watching: single?.watchLine ?? t('responsibility.early.watching'),
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
  t: PortalTranslator;
}): { did: string[]; didKinds: string[]; sinceLabel: string } {
  const { input, first, t } = args;
  const intel = input.intelligence;
  const since = input.checkins[0]?.capturedAt ?? null;
  const f = input.feedbackSince;
  const did: string[] = [];
  // Each line's kind, in the same order. Anything that needs to single a line
  // out matches on these — never on the sentence, which is not English for
  // every reader.
  const didKinds: string[] = [];
  const say = (kind: string, sentence: string) => {
    did.push(sentence);
    didKinds.push(kind);
  };

  const sinceLabel = since
    ? t('responsibility.since.checkin', { date: formatDate(since) })
    : t('responsibility.since.start');

  if (intel.evidence.analysed === 0 && f.total === 0) {
    return { did, didKinds, sinceLabel };
  }

  // The read count. "Since" is said only when there is a check-in to be since.
  const direct =
    f.direct > 0 ? ` ${t('responsibility.did.direct', { count: f.direct })}` : '';
  if (since) {
    if (f.read > 0) {
      say(
        'read',
        `${t.plural('responsibility.did.read', f.read, { date: formatDate(since) })}${direct}`,
      );
    } else if (f.unread > 0) {
      say('read', t.plural('responsibility.did.unread', f.unread, { date: formatDate(since) }));
    } else {
      say('read', t('responsibility.did.none', { date: formatDate(since) }));
    }
    if (f.read > 0 && f.unread > 0) {
      say('readingMore', t('responsibility.did.readingMore', { count: f.unread }));
    }
  } else if (intel.evidence.analysed > 0) {
    say(
      'read',
      `${t.plural('responsibility.did.readTotal', intel.evidence.analysed)}${direct}${intel.evidence.unread > 0 ? ` ${t('responsibility.did.readingMore', { count: intel.evidence.unread })}` : ''}`,
    );
  } else if (intel.evidence.unread > 0) {
    say('read', t.plural('responsibility.did.readingNow', intel.evidence.unread));
  }

  // The comparisons and the grouping, in M12's own words: what RepOS read,
  // what it grouped that reading into, which check-ins it compared, what it
  // remembered. The grouping line is the clearest statement of the work the
  // owner would otherwise be doing by hand, and until M17 it was computed and
  // then dropped on the floor.
  // By kind, never by prefix. This used to test each line against
  // /^Grouped |^Compared |^Kept track /, which is a sentence in one language
  // pretending to be a category — and matched nothing at all in Hindi.
  const CARRIED = new Set(['grouped', 'compared', 'measured', 'remembered']);
  input.view.work.forEach((line, i) => {
    const kind = input.view.workKinds[i] ?? '';
    if (CARRIED.has(kind)) say(kind, line);
  });

  // The checks RepOS actually made on the new feedback. Only when there was
  // new feedback to check against.
  if (first && f.read > 0) {
    say(
      'checked',
      since
        ? t('responsibility.did.checkedSince', { theme: spoken(first.themeLabel) })
        : t('responsibility.did.checkedAll', { theme: spoken(first.themeLabel) }),
    );
  }
  // Only claim a clear read when the owner is genuinely not being asked for
  // anything. It used to test DO_NOW alone, so an owner with a follow-up
  // sitting in "Needs you" read "Found no new problem big enough to act on"
  // directly underneath it (M18).
  if (!args.hasNeedsYou && intel.evidence.enough && f.read > 0) {
    say('noProblem', t('responsibility.did.noProblem'));
  }

  return { did, didKinds, sinceLabel };
}

function nextCheckFor(args: {
  input: ResponsibilityInput;
  comparisonsDue: number;
  t: PortalTranslator;
}): string {
  const { input, t } = args;
  const intel = input.intelligence;
  const checkins = input.checkins;
  const latest = checkins[0] ?? null;
  const f = input.feedbackSince;

  if (args.comparisonsDue > 0) {
    return args.comparisonsDue === 1
      ? t('responsibility.next.compareOne')
      : t('responsibility.next.compareMany', { count: args.comparisonsDue });
  }
  if (intel.evidence.analysed === 0) {
    return t('responsibility.next.firstCheckin');
  }
  if (!latest) {
    return t('responsibility.next.firstNow');
  }
  const days = daysBetween(latest.capturedAt, input.now);
  if (checkins.length === 1) {
    return f.read >= MIN_FEEDBACK_TO_MEASURE
      ? t.plural('responsibility.next.secondReady', f.read)
      : t.plural('responsibility.next.secondWaiting', f.read, {
          need: MIN_FEEDBACK_TO_MEASURE,
        });
  }
  if (f.read >= MIN_FEEDBACK_TO_MEASURE) {
    return t.plural('responsibility.next.worthNow', f.read, {
      date: formatDate(latest.capturedAt),
    });
  }
  if (days >= STALE_SNAPSHOT_DAYS) {
    return t.plural('responsibility.next.stale', f.read, { days });
  }
  return f.read === 0
    ? t('responsibility.next.notYetNone', { date: formatDate(latest.capturedAt) })
    : t.plural('responsibility.next.notYet', f.read, {
        date: formatDate(latest.capturedAt),
      });
}

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

function answerFor(args: {
  input: ResponsibilityInput;
  needsYou: ResponsibilityItem[];
  watching: ResponsibilityItem[];
  t: PortalTranslator;
}): { state: ResponsibilityState; answer: string; detail: string } {
  const { input, needsYou, watching, t } = args;
  const intel = input.intelligence;

  if (intel.evidence.analysed === 0) {
    return {
      state: 'WAITING_FOR_EVIDENCE',
      answer: t('responsibility.answer.none'),
      detail:
        intel.evidence.unread > 0
          ? t.plural('responsibility.answer.arriving', intel.evidence.unread)
          : t('responsibility.answer.noneYet'),
    };
  }

  const top = needsYou[0];
  if (top) {
    const doNow = needsYou.filter((i) => i.state === 'DO_NOW').length;
    const follow = needsYou.length - doNow;
    const bits: string[] = [];
    if (doNow > 0) bits.push(t.plural('responsibility.answer.bit.doNow', doNow));
    if (follow > 0) bits.push(t.plural('responsibility.answer.bit.follow', follow));
    return {
      state: top.state,
      answer:
        needsYou.length === 1
          ? top.state === 'DO_NOW'
            ? t('responsibility.answer.oneDoNow')
            : t('responsibility.answer.oneFollow')
          : t('responsibility.answer.some', { bits: bits.join(', ') }),
      detail:
        watching.length > 0
          ? t.plural('responsibility.answer.watchingOther', watching.length)
          : t('responsibility.answer.nothingElse'),
    };
  }

  if (!intel.evidence.enough) {
    return {
      state: 'WAITING_FOR_EVIDENCE',
      answer: t('responsibility.answer.notEnough'),
      detail: t.plural('responsibility.answer.notEnoughDetail', intel.evidence.analysed),
    };
  }

  return {
    state: 'CLEAR',
    answer: t('responsibility.answer.clear'),
    detail:
      watching.length > 0
        ? t.plural('responsibility.answer.watchingClear', watching.length)
        : t('responsibility.answer.clearDetail'),
  };
}

// ---------------------------------------------------------------------------
// The object
// ---------------------------------------------------------------------------

export function buildResponsibility(input: ResponsibilityInput): Responsibility {
  const { view, intelligence: intel } = input;
  // The language, once, at the top. Omitted means English — the operator
  // console's answer, not an oversight. Everything below is handed `t`.
  const t = input.t ?? EN;

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
    items.push(themeItem(signal, input, loops, t));
  }

  const words = needsYourWordsItem(input, t);
  if (words) items.push(words);
  const early = earlyItem(input, t);
  if (early) items.push(early);

  items.sort(compareItems);

  const needsYou = items.filter((i) => i.state === 'DO_NOW' || i.state === 'FOLLOW_UP');
  const watching = items.filter((i) => !(i.state === 'DO_NOW' || i.state === 'FOLLOW_UP'));

  const comparisonsDue = input.actions.filter((p) => p.canMeasure && p.action.status === 'DONE').length;
  const { did, didKinds, sinceLabel } = didFor({
    input,
    first: view.first,
    hasDoNow: needsYou.some((i) => i.state === 'DO_NOW'),
    hasNeedsYou: needsYou.length > 0,
    t,
  });
  const verdict = answerFor({ input, needsYou, watching, t });

  // What this page cannot say: the engine's own limits, plus the two things
  // this layer knows that it does not — a paused feedback page, and an
  // archived business.
  const limitations = [...view.limits];
  if (input.gateway && !input.gateway.enabled) {
    limitations.push(t('responsibility.limit.gatewayPaused'));
  }
  if (input.archived) {
    limitations.push(t('responsibility.limit.archived'));
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
    didKinds,
    sinceLabel,
    lastCheckinAt: input.checkins[0]?.capturedAt ?? null,
    nextUsefulCheck: nextCheckFor({ input, comparisonsDue, t }),
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
