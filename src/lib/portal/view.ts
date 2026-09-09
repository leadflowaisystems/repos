import {
  MIN_CHANGE_TO_REPORT,
  MIN_MENTIONS_TO_NAME,
  type ClientIntelligence,
  type Insight,
  type SignalKey,
  type TrendState,
} from '@/lib/intelligence/engine';
import type { HealthCard, StoredSnapshot } from '@/lib/health/health';
import type { DimensionSummaryRow, ThemeSummary } from '@/lib/feedback/analysis';
import type { Pack, TaxonomyEntry } from '@/lib/packs';
import {
  RESULT_LABELS,
  formatShare,
  type ActionResult,
  type ActionStatus,
} from '@/lib/improve/model';
import { MIN_FEEDBACK_TO_MEASURE } from '@/lib/improve/measure';
import type { ActionProgress } from '@/lib/improve/service';
import { formatDate } from '@/lib/format';
import {
  EMPTY_CONTEXT,
  answerFor,
  applyConstraints,
  contextForTheme,
  ownerPriority,
  youToldUs,
  type ContextItem,
  type ContextSet,
} from '@/lib/context/apply';
import { presenceFrom, recurrenceFor, type PresenceMap, type Recurrence } from './history';

/**
 * THE CLIENT VIEW (M12).
 *
 * The owner's view of their own business, built entirely from what M2, M6,
 * M10 and M11 already decided. This module computes NO intelligence of its
 * own: it selects, groups and words. Every number was calculated upstream;
 * every judgement was made upstream. What is new here is the WORK OF
 * EXPLAINING — the layer a review platform does not have:
 *
 *   customer fact -> what it means -> why it matters -> what we recommend ->
 *   what you decided -> what happened after -> what we will watch next
 *
 * Four layers are kept apart on purpose, because an owner must never mistake
 * one for another:
 *
 *   CUSTOMER FACT      what the feedback shows            (`fact`, counts)
 *   REPOS MEANING      what the evidence suggests          (`meaning`, `why`)
 *   RECOMMENDATION     what RepOS suggests considering     (`suggestion`, `nextStep`)
 *   OWNER CONTEXT      what the owner told RepOS           (`decision`, `learning`)
 *
 * Three comparisons exist and are never blurred: the whole read pile (the
 * fact), the last two check-ins (movement), and before/after a change (the
 * measurement). Each sentence says which one it is about.
 *
 * Wording rules: plain language first, number second; nothing internal; no
 * causal claim — a measured change says what the feedback did after it, in
 * the measurement engine's own careful words.
 *
 * Pure: everything it needs is passed in.
 */

/** Bump when the shape or the wording rules change. */
export const PORTAL_VERSION = 4;

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type PortalMood = 'GOOD' | 'MIXED' | 'NEEDS_WORK' | 'TOO_EARLY';

/**
 * Where a theme sits in the owner's attention. Four buckets, derived from
 * signals the intelligence engine already named — never from a fresh score.
 */
export type PortalBucket = 'FIRST' | 'KEEP' | 'WATCH' | 'EARLY';

export const BUCKET_LABELS: Record<PortalBucket, string> = {
  FIRST: 'Do this first',
  KEEP: 'Keep doing this',
  WATCH: 'Watching',
  EARLY: 'Waiting for more feedback',
};

/** The short instruction attached to a theme. */
export type PortalAdvice =
  | 'START'
  | 'HOLD'
  | 'CONTINUE'
  | 'CHECKING'
  | 'KEEP_CHANGE'
  | 'REVIEW_CHANGE'
  | 'PROTECT'
  | 'WATCH'
  | 'WAIT';

export const ADVICE_LABELS: Record<PortalAdvice, string> = {
  START: 'Act on this',
  HOLD: 'Coming up less on its own',
  CONTINUE: 'Finish the change you agreed',
  CHECKING: 'Change made, not yet checked',
  KEEP_CHANGE: 'Keep it in place',
  REVIEW_CHANGE: 'Look at this again',
  PROTECT: 'Worth protecting',
  WATCH: 'Keep watching',
  WAIT: 'Wait for more feedback',
};

export type PortalActionState = 'NONE' | 'SUGGESTED' | 'IN_PROGRESS' | 'CHECKED' | 'DECLINED';

export type PortalActionStage = 'SUGGESTED' | 'AGREED' | 'DONE' | 'CHECKED' | 'NOT_DOING';

export type PortalStep = { label: string; done: boolean };

/**
 * One labelled fact on Home.
 *
 * `key` and `tone` exist so that nothing outside this module has to recognise a
 * fact, or read its meaning, by matching the English words it happens to be
 * displayed with. Home used to find these with
 * `facts.find((f) => f.label === 'Overall direction')`, and the direction pill
 * used to pick its colour by regex-testing the value for /getting better/ —
 * both of which quietly stop working the moment the words are reworded, and
 * stop working for every reader the moment the words are in Marathi. A lookup
 * that fails loudly is fine; one that returns undefined and removes a row from
 * the page is not.
 *
 * WORDS ARE FOR READING. Keys are for matching.
 */
export type PortalFactKey = 'direction' | 'publicRating';

export type PortalFact = {
  /** Stable identifier. Never displayed, never translated. */
  key: PortalFactKey;
  label: string;
  value: string;
  scope: string;
  /** Which way this points, independent of the words used to say it. */
  tone: 'good' | 'bad' | 'neutral' | 'unknown';
};

/**
 * CURRENT SIGNALS — what customers are saying so far, before it is a pattern.
 *
 * The intelligence names a theme only once it has been raised three times,
 * and that floor is right for a conclusion. It is wrong for a first week: an
 * owner with two feedback entries should still see what those two said.
 * So this lists every mention RepOS has read, marks the ones that have
 * cleared the floor, and says plainly that the rest are only being watched.
 * Nothing here is a trend, a comparison or a cause.
 */
export type PortalSoFar = {
  /** Read by RepOS and counted here. */
  read: number;
  /** Arrived and being read; not counted here yet. */
  waiting: number;
  mentions: Array<{
    themeKey: string;
    label: string;
    kind: 'PRAISE' | 'ISSUE';
    count: number;
    /** Raised often enough to be called a pattern. */
    pattern: boolean;
  }>;
  /** The parts of the visit customers rated on the feedback page, with the average. */
  rated: Array<{ themeKey: string; label: string; average: number; rated: number; low: number }>;
  /** What the numbers can and cannot mean, in one line. */
  note: string;
};

/**
 * The before/after of a change, straight from the measurement engine.
 *
 * Observational by construction: it names the two piles and the date the
 * change was recorded, and every label says "after the change", never
 * "because of it".
 */
export type PortalOutcome = {
  result: ActionResult;
  /** "Mentioned less often after the change" — never a verdict on the change. */
  resultLabel: string;
  /** "Customers are mentioning waiting time less often since the change." */
  headline: string;
  beforeShare: string | null;
  afterShare: string | null;
  beforeLine: string;
  afterLine: string;
  /** "Feedback read up to 12 Mar 2026" */
  beforeScope: string;
  /** "Feedback after the change you made on 1 Apr 2026" */
  afterScope: string;
  /** When the change was recorded as made. */
  changeDate: Date | null;
  direction: 'DOWN' | 'UP' | 'FLAT';
  good: boolean;
  /** Why the engine reached this reading, with the numbers in it. */
  why: string[];
  /** The one-line reminder shown wherever the reading appears. */
  note: string;
  /** The engine's full no-causation sentence, verbatim. */
  caveat: string;
};

const OUTCOME_NOTE = 'This does not show the change caused the difference.';

/** The other face of a theme, when the pack declares one and customers raised it. */
export type PortalCounterpart = {
  themeKey: string;
  themeLabel: string;
  kind: 'PRAISE' | 'ISSUE';
  count: number;
};

export type PortalQuestion = {
  themeKey: string;
  themeLabel: string;
  question: string;
  options: string[];
  why: string;
};

/**
 * What customers tapped on the feedback page about this theme (final
 * experience pass). The form asks a rating for each part of the visit and
 * offers specifics after a low one; the pack maps each question to the issue
 * it is evidence for. Until now the taps were shown one row at a time on
 * Reviews and never added up for the owner. Counts only — the engine already
 * decided whether they matter.
 */
export type PortalTapped = {
  /** The question as the pack words it: "Waiting". */
  label: string;
  /** How many customers rated it at all. */
  rated: number;
  /** How many of those put it at 3 or below. */
  low: number;
  /** Mean of the ratings given, to one decimal. */
  average: number;
  /** The specifics they picked, most-picked first, as the pack words them today. */
  specifics: Array<{ label: string; count: number }>;
};

/** One thing customers are saying, fully explained. */
export type PortalSignal = {
  themeKey: string;
  themeLabel: string;
  kind: 'PRAISE' | 'ISSUE';

  // ---- customer fact --------------------------------------------------
  /** "14 of 110 feedback entries Headway has read mention it." */
  fact: string;
  evidenceCount: number;
  evidenceTotal: number;
  /** "13%" of the read pile. */
  share: string;
  /** Movement between the last two check-ins, when the engine could read one. */
  movementDirection: 'IMPROVING' | 'WORSENING' | 'STABLE' | null;
  /** "6 → 2 mentions" — at the last two check-ins. */
  movementCounts: string | null;
  /** The engine's full sentence, naming both check-ins. */
  movementLine: string | null;
  /** "Raised at 2 of your last 2 check-ins." */
  recurrence: string | null;
  isRecurring: boolean;
  isNew: boolean;
  counterpart: PortalCounterpart | null;

  // ---- RepOS meaning --------------------------------------------------
  /** One sentence: the reading of this theme. */
  brief: string;
  /** The reading of the last two check-ins only — for the pages about movement. */
  movementBrief: string;
  /** The full reading, up to three sentences. */
  meaning: string;
  /** Why it ranks where it does — the engine's own reasons, verbatim. */
  why: string[];
  bucket: PortalBucket;
  bucketLabel: string;
  advice: PortalAdvice;
  adviceLabel: string;
  /** Why this one was chosen over a bigger number, when it was. */
  featuredBecause: string | null;
  /** It improved after a change and is coming up more again. */
  returning: boolean;

  // ---- recommendation -------------------------------------------------
  /** The vertical pack's own advice, with the owner's constraints applied. Issues only. */
  suggestion: string | null;
  /** "You told us extra staff is not possible right now, so this is the version that does not need it." */
  suggestionNote: string | null;
  /** The next move, given where the improvement loop stands. */
  nextStep: string;
  /** What RepOS will check next for this theme. A full sentence. */
  watchLine: string;

  // ---- owner context / the loop ----------------------------------------
  actionState: PortalActionState;
  /** "You changed: cut evening bookings to five an hour." */
  actionLine: string | null;
  outcome: PortalOutcome | null;
  question: PortalQuestion | null;
  /** The ratings and specifics tapped on the feedback page about this theme. Issues only. */
  tapped: PortalTapped | null;
  /** "You told us what matters most right now: …" when the owner said so about this theme. */
  ownerPriority: string | null;
  /** What the owner told RepOS about this theme, each line attributed to them. */
  ownerContext: string[];
};

export type PortalWatch = {
  themeKey: string | null;
  label: string;
  state: string;
  tone: 'good' | 'warn' | 'neutral';
  next: string;
};

/** One improvement, told end to end. */
export type PortalAction = {
  id: string;
  about: string;
  themeKey: string;
  kind: 'PRAISE' | 'ISSUE';
  stage: PortalActionStage;
  stageLabel: string;
  stageMeaning: string;
  /** Customer fact at the time: "12 of 80 feedback entries read by 2 Mar 2026." */
  problem: string;
  suggestedAt: Date;
  /** What RepOS suggested, verbatim from the pack. */
  suggested: string;
  /** What the owner decided, in their words. Owner context. */
  decision: string;
  decidedAt: Date | null;
  /** The reason recorded when it was declined or paused. */
  decisionNote: string;
  doneAt: Date | null;
  measuredAt: Date | null;
  steps: PortalStep[];
  outcome: PortalOutcome | null;
  /** What the owner recorded after checking. Owner context. */
  learning: string | null;
  nextStep: string;
  /** The memory strip: then → change → now → reading. */
  memory: { then: string; change: string; now: string; result: string } | null;
  /** Movement at check-ins recorded after the change, when any exist. */
  sinceThen: string | null;
  returning: boolean;
  /** New feedback collected so far against what a check needs. */
  awaiting: { have: number; need: number } | null;
};

export type PortalView = {
  businessName: string;
  verticalLabel: string;

  mood: PortalMood;
  /** The picture, in one or two sentences. */
  summary: string;
  basis: string;
  facts: PortalFact[];
  soFar: PortalSoFar;

  /** The invisible work, stated plainly. */
  work: string[];

  keep: PortalSignal | null;
  first: PortalSignal | null;
  watch: PortalSignal[];
  early: PortalSignal[];
  /** "4 other topics were mentioned once or twice." */
  quietNote: string | null;
  /** What not to spend time on. */
  noAction: string;

  loved: PortalSignal[];
  unhappy: PortalSignal[];
  changed: PortalSignal[];
  changedNote: string;
  /** Themes read as steady between the last two check-ins. */
  steady: PortalSignal[];
  /** Themes the engine could not compare between the last two check-ins. */
  notComparable: PortalSignal[];

  watching: PortalWatch[];
  question: PortalQuestion | null;

  /** Everything the owner told RepOS, as "You told us …" lines. */
  knows: PortalKnown[];

  actions: PortalAction[];
  actionsNote: string;
  /** The leading complaint nobody has decided on yet — the decision to start. */
  suggestedNow: PortalSignal | null;

  limits: string[];
  basedOn: number;
  version: number;
};

/** One line the owner told RepOS, shown back to them. */
export type PortalKnown = {
  id: string;
  kind: ContextItem['kind'];
  /** "You told us …" */
  line: string;
  /** The theme it is about, for the evidence link, when it has one. */
  themeKey: string | null;
  recordedAt: Date;
};

export type PortalInput = {
  intelligence: ClientIntelligence;
  card: HealthCard;
  actions: ActionProgress[];
  /** Every check-in with its attached feedback, for what keeps coming back. */
  snapshots: StoredSnapshot[];
  pack: Pack;
  themes: ThemeSummary;
  /** What the owner told RepOS. Optional so an owner with nothing recorded is the same page. */
  context?: ContextSet;
};

// ---------------------------------------------------------------------------
// Small wording helpers
// ---------------------------------------------------------------------------

export function pieces(n: number): string {
  return `${n} feedback ${n === 1 ? 'entry' : 'entries'}`;
}

/** Counts are feedback entries, not people: one customer may leave several. */
function comments(n: number): string {
  return `${n} ${n === 1 ? 'comment' : 'comments'}`;
}

function shareText(count: number, total: number): string {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : '—';
}

/**
 * A pack label, as a person would say it inside a sentence.
 *
 * "AC / ventilation / temperature" is a category name; in a sentence it is
 * "AC, ventilation and temperature". Words are lowercased except acronyms.
 */
export function spoken(label: string): string {
  const parts = label
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const joined =
    parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
      : (parts[0] ?? label);
  return joined.replace(/\b[A-Z][a-z']+/g, (w) => w.toLowerCase());
}

const lower = spoken;

function hasSignal(insight: Insight, key: SignalKey): boolean {
  return insight.signals.some((s) => s.key === key);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const STAGE_LABELS: Record<PortalActionStage, string> = {
  SUGGESTED: 'Suggested',
  AGREED: 'Agreed',
  DONE: 'Change made',
  CHECKED: 'Checked',
  NOT_DOING: 'Not doing',
};

const STAGE_MEANINGS: Record<PortalActionStage, string> = {
  SUGGESTED: 'Suggested from your feedback. Nothing has been decided yet.',
  AGREED: 'You agreed to make this change. It has not been made yet.',
  DONE: 'You told us the change was made. Headway has not compared the feedback yet.',
  CHECKED: 'Headway compared how often it came up before and after the change.',
  NOT_DOING: 'You decided not to make this change.',
};

function stageFor(status: ActionStatus): PortalActionStage {
  switch (status) {
    case 'RECOMMENDED':
      return 'SUGGESTED';
    case 'ACCEPTED':
    case 'PAUSED':
      return 'AGREED';
    case 'DONE':
      return 'DONE';
    case 'MEASURED':
      return 'CHECKED';
    default:
      return 'NOT_DOING';
  }
}

function stateFor(status: ActionStatus): PortalActionState {
  switch (status) {
    case 'RECOMMENDED':
      return 'SUGGESTED';
    case 'ACCEPTED':
    case 'PAUSED':
    case 'DONE':
      return 'IN_PROGRESS';
    case 'MEASURED':
      return 'CHECKED';
    default:
      return 'DECLINED';
  }
}

/** The most advanced action per theme, so a theme tells one loop, not two. */
const STATUS_ORDER: Record<ActionStatus, number> = {
  MEASURED: 5,
  DONE: 4,
  ACCEPTED: 3,
  PAUSED: 3,
  RECOMMENDED: 2,
  DECLINED: 1,
};

function loopByTheme(actions: ActionProgress[]): Map<string, ActionProgress> {
  const out = new Map<string, ActionProgress>();
  for (const p of actions) {
    const key = p.action.provenance.themeKey;
    const current = out.get(key);
    if (!current || STATUS_ORDER[p.action.status] > STATUS_ORDER[current.action.status]) {
      out.set(key, p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

export function outcomeFrom(progress: ActionProgress | undefined): PortalOutcome | null {
  const m = progress?.action.measurement;
  if (!m || !progress) return null;
  const delta = m.shareDelta ?? 0;
  const doneAt = progress.action.doneAt;
  return {
    result: m.result,
    resultLabel: RESULT_LABELS[m.result],
    headline: m.headline,
    beforeShare: m.before.share === null ? null : formatShare(m.before.share),
    afterShare: m.after.share === null ? null : formatShare(m.after.share),
    beforeLine: m.before.line,
    afterLine: m.after.line,
    beforeScope: `Feedback read up to ${formatDate(progress.action.baseline.capturedAt)}`,
    afterScope: doneAt
      ? `Feedback after the change you made on ${formatDate(doneAt)}`
      : 'Feedback after the change',
    changeDate: doneAt,
    direction: delta === 0 ? 'FLAT' : delta < 0 ? 'DOWN' : 'UP',
    good: m.result === 'IMPROVED',
    why: m.why,
    note: OUTCOME_NOTE,
    caveat: m.limits[0] ?? '',
  };
}

/**
 * The next move, given where the loop stands. Process, not advice: Headway can
 * say what it will check and when, and repeat the pack's own suggestion. It
 * cannot invent a different fix, and it never turns a before/after into a
 * cause.
 */
function nextStepFor(args: {
  kind: 'PRAISE' | 'ISSUE';
  bucket: PortalBucket;
  easing: boolean;
  suggestion: string | null;
  progress: ActionProgress | undefined;
  returning: boolean;
}): string {
  const { progress, suggestion, bucket } = args;
  const a = progress?.action;
  const returnNote = args.returning
    ? ' It is coming up more again. Before you make another change, check what else has changed.'
    : '';

  if (!a) {
    if (args.kind === 'PRAISE') {
      // The watch line beside this already names the drop Headway would flag,
      // and names the number. Saying it here too would repeat it on one card —
      // and it would be wrong on a strength that has already slipped.
      return 'Keep doing what customers are praising here.';
    }
    if (bucket === 'WATCH') {
      // Same reason as above: the watch line says what Headway will flag, and
      // at what number.
      return suggestion
        ? `No change needed yet. If you want to fix it early, the usual fix is: ${suggestion}`
        : 'No change needed yet.';
    }
    // On the card, the advice label beside this already says the complaint is
    // coming up less on its own, so this sentence gives the decision rather
    // than repeating the movement a third time.
    if (args.easing) {
      return suggestion
        ? `Decide whether to act now or wait. If it comes up more again, start here: ${suggestion}`
        : 'Decide whether to act now or wait.';
    }
    return suggestion
      ? `Start here: ${suggestion}`
      : 'Customers have raised this often enough to act on. Decide what to change and tell us.';
  }

  switch (a.status) {
    case 'RECOMMENDED':
      return 'Decide whether to make this change and tell us.';
    case 'ACCEPTED':
      return 'Tell us once the change is made. Then Headway can compare the feedback that comes after it.';
    case 'PAUSED':
      return 'The change you agreed is on hold. Headway cannot compare anything until it is made.';
    case 'DONE': {
      // Once enough has arrived, saying "48 of the 10 needed" is nonsense —
      // and it is what an owner saw on every page of a busy client (M18).
      const have = progress?.newFeedbackSinceDone ?? 0;
      const made = `You made the change${a.doneAt ? ` on ${formatDate(a.doneAt)}` : ''}.`;
      return have >= MIN_FEEDBACK_TO_MEASURE
        ? `${made} ${pieces(have)} ${have === 1 ? 'has' : 'have'} come in since then. That is enough to compare before and after.`
        : `${made} Headway is waiting for enough new feedback to compare. So far it has ${have} of the ${MIN_FEEDBACK_TO_MEASURE} it needs.`;
    }
    case 'MEASURED': {
      switch (a.measurement?.result) {
        case 'IMPROVED':
          return `Nothing in the feedback after the change says you should undo it. Headway will keep comparing as more comes in.${returnNote}`;
        case 'WORSENED':
          return `It came up more often in the feedback after the change. That does not show the change caused it. Before you undo the change, check what else changed.${suggestion ? ` The first suggestion still stands: ${suggestion}` : ''}`;
        case 'NO_CLEAR_CHANGE':
          return 'The feedback after the change reads about the same as before. Keep collecting it. Headway will compare again.';
        default:
          return `Not enough feedback after the change to compare yet. Headway will compare once ${MIN_FEEDBACK_TO_MEASURE} feedback entries have come in after it.`;
      }
    }
    default:
      return 'The suggestion stays on record in case it comes up again.';
  }
}

// ---------------------------------------------------------------------------
// Reading one theme
// ---------------------------------------------------------------------------

type ThemeContext = {
  intel: ClientIntelligence;
  pack: Pack;
  presence: PresenceMap;
  loops: Map<string, ActionProgress>;
  context: ContextSet;
  /** The feedback page's own questions, counted, in pack order. */
  dimensions: DimensionSummaryRow[];
  isAttention: boolean;
  /** Position among strengths by count: 0 and 1 are "praised most". */
  strengthRank: number;
  featuredBecause?: string | null;
};

/** The feedback-page question that is evidence for this issue, once anyone has answered it. */
function tappedFor(insight: Insight, ctx: ThemeContext): PortalTapped | null {
  if (insight.sentiment !== 'ISSUE') return null;
  const row = ctx.dimensions.find((d) => d.themeKey === insight.themeKey && d.rated > 0 && d.average !== null);
  if (!row) return null;
  return {
    label: row.label,
    rated: row.rated,
    low: row.low,
    average: row.average as number,
    specifics: row.signals.map((s) => ({ label: s.label, count: s.count })),
  };
}

function entryFor(pack: Pack, kind: 'PRAISE' | 'ISSUE', key: string): TaxonomyEntry | undefined {
  return (kind === 'ISSUE' ? pack.issueTaxonomy : pack.praiseTaxonomy).find((t) => t.key === key);
}

/** The pack-declared other face of this theme, if customers raised it too. */
function counterpartFor(insight: Insight, ctx: ThemeContext): PortalCounterpart | null {
  if (insight.sentiment === 'ISSUE') {
    const key = entryFor(ctx.pack, 'ISSUE', insight.themeKey)?.counterpart;
    const praise = key ? ctx.intel.loved.find((i) => i.themeKey === key) : undefined;
    return praise
      ? { themeKey: praise.themeKey, themeLabel: praise.themeLabel, kind: 'PRAISE', count: praise.evidence.count }
      : null;
  }
  const issues = ctx.pack.issueTaxonomy
    .filter((t) => t.counterpart === insight.themeKey)
    .map((t) => ctx.intel.unhappy.find((i) => i.themeKey === t.key))
    .filter((i): i is Insight => i !== undefined)
    .sort((a, b) => b.evidence.count - a.evidence.count);
  const issue = issues[0];
  return issue
    ? { themeKey: issue.themeKey, themeLabel: issue.themeLabel, kind: 'ISSUE', count: issue.evidence.count }
    : null;
}

function bucketFor(insight: Insight, ctx: ThemeContext): PortalBucket {
  if (insight.confidence === 'EARLY') return 'EARLY';
  if (insight.sentiment === 'ISSUE') return ctx.isAttention ? 'FIRST' : 'WATCH';
  if (!hasSignal(insight, 'strength')) return 'EARLY';
  return insight.movement.state === 'WORSENING' ? 'WATCH' : 'KEEP';
}

function adviceFor(
  insight: Insight,
  bucket: PortalBucket,
  progress: ActionProgress | undefined,
  outcome: PortalOutcome | null,
): PortalAdvice {
  if (bucket === 'EARLY') return 'WAIT';
  if (insight.sentiment === 'PRAISE') return bucket === 'KEEP' ? 'PROTECT' : 'WATCH';
  const status = progress?.action.status;
  if (status === 'MEASURED' && outcome) {
    if (outcome.result === 'IMPROVED') return 'KEEP_CHANGE';
    if (outcome.result === 'WORSENED') return 'REVIEW_CHANGE';
    return 'WATCH';
  }
  if (status === 'DONE') return 'CHECKING';
  if (status === 'ACCEPTED' || status === 'PAUSED') return 'CONTINUE';
  if (bucket === 'FIRST') return insight.movement.state === 'IMPROVING' ? 'HOLD' : 'START';
  return 'WATCH';
}

/** The last two check-ins, on their own. */
function movementBriefFor(insight: Insight): string {
  const move = insight.movement.state;
  const issue = insight.sentiment === 'ISSUE';
  if (move === 'WORSENING') {
    return issue
      ? 'Customers raised it more at your latest check-in than at the one before.'
      : 'Customers praised it less at your latest check-in than at the one before.';
  }
  if (move === 'IMPROVING') {
    return issue
      ? 'Customers raised it less at your latest check-in than at the one before.'
      : 'Customers praised it more at your latest check-in than at the one before.';
  }
  if (move === 'STABLE')
    return 'Customers mentioned it about as often at your latest check-in as at the one before.';
  return 'There were too few mentions at one of your last two check-ins to compare.';
}

/**
 * The reading of one theme: the sentence an advisor would say before showing
 * the number. Composed from judgements already made — the measurement result,
 * the engine's movement state, the check-in history — never from a model.
 * Each sentence names the comparison it is about.
 */
function meaningFor(args: {
  insight: Insight;
  counterpart: PortalCounterpart | null;
  recurrence: Recurrence;
  state: PortalActionState;
  outcome: PortalOutcome | null;
  isAttention: boolean;
  returning: boolean;
  bucket: PortalBucket;
  strengthRank: number;
}): { brief: string; meaning: string } {
  const { insight, counterpart, recurrence, outcome, bucket } = args;
  const move = insight.movement.state;
  const sentences: string[] = [];

  if (insight.sentiment === 'ISSUE') {
    if (counterpart) {
      sentences.push(
        `${counterpart.themeLabel} is mostly a strength. ${comments(counterpart.count)} praised it. But ${comments(insight.evidence.count)} said the opposite.`,
      );
    }
    let primary: string;
    let afterNote: string | null = null;
    if (args.state === 'CHECKED' && outcome) {
      const range =
        outcome.beforeShare && outcome.afterShare
          ? ` (${outcome.beforeShare} of feedback before, ${outcome.afterShare} after)`
          : '';
      const when = outcome.changeDate ? ` on ${formatDate(outcome.changeDate)}` : '';
      switch (outcome.result) {
        case 'IMPROVED':
          primary = `In the feedback after the change${when}, it has come up less often${range}.${
            args.isAttention ? ' It is still the complaint Headway watches most closely.' : ''
          }`;
          afterNote = outcome.note;
          break;
        case 'WORSENED':
          primary = `In the feedback after the change${when}, it has come up more often${range}.`;
          afterNote = `${outcome.note} Look at it again.`;
          break;
        case 'NO_CLEAR_CHANGE':
          primary = `In the feedback after the change${when}, it is coming up about as often as before${range}.`;
          break;
        default:
          primary = `Not enough feedback after the change${when} to compare yet.`;
      }
    } else if (move === 'WORSENING') {
      primary = movementBriefFor(insight);
    } else if (move === 'IMPROVING') {
      primary = movementBriefFor(insight);
    } else if (recurrence.recurring) {
      primary = `It has come up at each of your recent check-ins. It is not a one-off.`;
    } else if (recurrence.isNew) {
      primary = `It became a pattern for the first time at your latest check-in. Watch it before you decide anything.`;
    } else if (bucket === 'EARLY') {
      primary = `Customers raised it in ${comments(insight.evidence.count)} so far. That is too few to be sure it is a pattern.`;
    } else if (bucket === 'WATCH') {
      primary = `Mentioned often enough to be a pattern, but not the main problem to fix first.`;
    } else {
      primary = `Customers raised it in ${comments(insight.evidence.count)}. That is often enough to act on.`;
    }
    sentences.push(primary);
    if (afterNote) sentences.push(afterNote);
    if (args.returning) {
      sentences.push(
        `It came up less often after your earlier change. Now it is coming up more again.`,
      );
    }
    return { brief: primary, meaning: sentences.join(' ') };
  }

  // Praise.
  const strong = hasSignal(insight, 'strength');
  const top = args.strengthRank <= 1;
  let primary: string;
  if (strong && move === 'IMPROVING') {
    primary = top
      ? `This is one of the things customers praise most. They are mentioning it more than before.`
      : `This is a strength. Customers are mentioning it more than before.`;
  } else if (strong && move === 'WORSENING') {
    primary = `This is still a strength. But customers praised it less at your latest check-in than at the one before.`;
  } else if (strong && recurrence.recurring) {
    primary = top
      ? `Customers praised it at each of your recent check-ins. It is one of the things they praise most.`
      : `Customers praised it at each of your recent check-ins. It is a steady strength.`;
  } else if (strong) {
    primary = top
      ? `This is one of the things customers praise most.`
      : `This is one of your strengths.`;
  } else {
    primary = `Customers have praised this a few times. That is not often enough yet to call it a strength.`;
  }
  sentences.push(primary);
  if (counterpart) {
    sentences.push(
      `Not everyone agrees. ${comments(counterpart.count)} said the opposite: ${lower(counterpart.themeLabel)}.`,
    );
  }
  return { brief: primary, meaning: sentences.join(' ') };
}

function watchLineFor(
  insight: Insight,
  bucket: PortalBucket,
  state: PortalActionState,
  outcome: PortalOutcome | null,
): string {
  const label = lower(insight.themeLabel);
  if (bucket === 'EARLY') {
    return insight.sentiment === 'PRAISE'
      ? `Headway is watching whether customers praise ${label} often enough to call it a strength. It needs ${MIN_MENTIONS_TO_NAME * 2} comments before it can say so.`
      : `Headway is watching whether ${label} comes up more often. It calls this a pattern once customers have raised it ${MIN_MENTIONS_TO_NAME} times.`;
  }
  if (insight.sentiment === 'PRAISE') {
    return `Headway is checking that customers keep praising ${label}. It will tell you if the praise drops by ${MIN_CHANGE_TO_REPORT} or more mentions at a check-in.`;
  }
  if (state === 'CHECKED' && outcome?.result === 'IMPROVED') {
    return `Headway is checking whether ${label} keeps coming up less often as new feedback arrives. It will tell you if it comes up more again.`;
  }
  if (state === 'IN_PROGRESS') {
    return `Headway is waiting for the feedback that comes in after the change. Then it can compare how often ${label} comes up.`;
  }
  return `Headway is checking whether ${label} comes up more or less at your next check-in. It will tell you if the count moves by ${MIN_CHANGE_TO_REPORT} or more mentions.`;
}

/**
 * Engine reasons worth repeating to an owner: the ones that differentiate.
 * The bare count, the "at least 3" floor and the movement are not among them
 * — the count and the movement are on the fact line, and the floor would
 * read as a machine reciting its settings on every card.
 */
function whyFor(insight: Insight, verticalLabel: string): string[] {
  const short = verticalLabel.split('/')[0]?.trim().toLowerCase() ?? verticalLabel.toLowerCase();
  return insight.signals
    .filter((s) => s.key === 'severity_high' || s.key === 'severity_medium' || s.key === 'severity_low' || s.key === 'strength')
    .map((s) => s.reason.replace(verticalLabel.toLowerCase(), short));
}

export function toSignal(insight: Insight, ctx: ThemeContext): PortalSignal {
  const { count, outOf } = insight.evidence;
  const progress = ctx.loops.get(insight.themeKey);
  const state: PortalActionState = progress ? stateFor(progress.action.status) : 'NONE';
  const outcome = outcomeFrom(progress);
  const recurrence = recurrenceFor(ctx.presence, insight.sentiment, insight.themeKey);
  const counterpart = counterpartFor(insight, ctx);
  const moved = insight.movement.state;
  const returning =
    insight.sentiment === 'ISSUE' &&
    outcome?.result === 'IMPROVED' &&
    moved === 'WORSENING';
  const bucket = bucketFor(insight, ctx);
  const advice = adviceFor(insight, bucket, progress, outcome);
  // The engine only calls a direction (or a genuine "steady") when both sides
  // clear its floors; anything else is arithmetic, and is not shown as movement.
  const readable = moved === 'IMPROVING' || moved === 'WORSENING' || moved === 'STABLE';
  // "Raised" in the history means "cleared the pattern floor at that
  // check-in". Beside a count from the check-in before, "not raised before"
  // reads as a contradiction, so the history only speaks where the engine's
  // own movement has nothing to say.
  const hadMentionsBefore = (insight.movement.previousCount ?? 0) > 0;
  const isNew = recurrence.isNew && !hadMentionsBefore;
  const recurrenceLine =
    (recurrence.faded && insight.movement.available) || (recurrence.isNew && hadMentionsBefore)
      ? null
      : recurrence.line;

  const { brief, meaning } = meaningFor({
    insight,
    counterpart,
    recurrence: { ...recurrence, isNew },
    state,
    outcome,
    isAttention: ctx.isAttention,
    returning,
    bucket,
    strengthRank: ctx.strengthRank,
  });
  const entry = entryFor(ctx.pack, insight.sentiment, insight.themeKey);
  const ask = entry?.askOwner;

  // What the owner told RepOS about this theme. Attributed on every line, and
  // never allowed near the counts: it explains the situation around the
  // evidence, it does not become evidence.
  const applied =
    insight.sentiment === 'ISSUE'
      ? applyConstraints(entry, ctx.context)
      : { text: null, constraint: null, note: null, blocked: false };
  const suggestion = insight.sentiment === 'ISSUE' ? (applied.text ?? insight.recommendation) : null;
  const priorityItem = ownerPriority(ctx.context, insight.themeKey);
  const ownerContext = contextForTheme(ctx.context, insight.themeKey).map((item) =>
    youToldUs(item, item.kind === 'ANSWER' ? (ask?.question ?? null) : null),
  );
  const answered = answerFor(ctx.context, insight.themeKey);

  // This line sits in the owner's own row, so it opens with "You" even when
  // the owner recorded no words of their own. It never guesses WHAT changed —
  // Headway does not know.
  const decision = progress?.action.description.trim() ?? '';
  const actionLine = !progress
    ? null
    : state === 'DECLINED'
      ? `You decided not to make this change.`
      : state === 'SUGGESTED'
        ? `You have not decided on Headway's suggestion yet.`
        : decision
          ? `You ${state === 'CHECKED' || progress.action.status === 'DONE' ? 'changed' : 'agreed to change'}: ${decision}`
          : state === 'CHECKED'
            ? `You made a change here.`
            : `You agreed to a change here.`;

  return {
    themeKey: insight.themeKey,
    themeLabel: insight.themeLabel,
    kind: insight.sentiment,

    fact: `${count} of ${pieces(outOf)} Headway has read mention it.`,
    evidenceCount: count,
    evidenceTotal: outOf,
    share: shareText(count, outOf),
    movementDirection: readable ? moved : null,
    movementCounts: readable ? insight.movement.countNote : null,
    movementLine: readable ? insight.movement.pointNote : null,
    recurrence: recurrenceLine,
    isRecurring: recurrence.recurring,
    isNew,
    counterpart,

    brief,
    movementBrief: movementBriefFor(insight),
    meaning,
    why: whyFor(insight, ctx.intel.verticalLabel),
    bucket,
    bucketLabel: BUCKET_LABELS[bucket],
    advice,
    adviceLabel: ADVICE_LABELS[advice],
    featuredBecause: ctx.featuredBecause ?? null,
    returning,

    suggestion,
    suggestionNote: applied.note,
    nextStep: nextStepFor({
      kind: insight.sentiment,
      bucket,
      easing: moved === 'IMPROVING',
      suggestion,
      progress,
      returning,
    }),
    watchLine: watchLineFor(insight, bucket, state, outcome),

    actionState: state,
    actionLine,
    outcome,
    tapped: tappedFor(insight, ctx),
    ownerPriority: priorityItem ? youToldUs(priorityItem) : null,
    ownerContext,
    // Asked once. Once the owner has answered, the answer is shown instead.
    question:
      ask && ctx.isAttention && state === 'NONE' && !answered
        ? {
            themeKey: insight.themeKey,
            themeLabel: insight.themeLabel,
            question: ask.question,
            options: ask.options,
            why: `${comments(count)} mention ${lower(insight.themeLabel)}. Headway cannot tell from the feedback alone which of these fits. Your answer decides what to try first.`,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

/**
 * The executive sentence. Composed from judgements already made: the praise
 * the engine ranks highest, the complaint it ranks first, and — when a change
 * has been measured for that complaint — the measurement's own verdict.
 * "Keep" and "still" are said only when the history supports them.
 */
export function summaryFor(
  intel: ClientIntelligence,
  trend: TrendState,
  keep: { insight: Insight; recurring: boolean } | null,
  first: { insight: Insight; outcome: PortalOutcome | null; recurring: boolean } | null,
): { mood: PortalMood; summary: string } {
  if (intel.evidence.analysed === 0) {
    const arrived = intel.evidence.unread;
    return {
      mood: 'TOO_EARLY',
      summary:
        arrived > 0
          ? `${pieces(arrived)} ${arrived === 1 ? 'has' : 'have'} arrived. Headway is reading ${arrived === 1 ? 'it' : 'them'} now.`
          : 'No feedback has come in yet. Once customers leave feedback through your QR code, Headway will read it and say what matters.',
    };
  }
  if (!intel.evidence.enough) {
    return {
      mood: 'TOO_EARLY',
      summary: `It is still early. Headway has read ${pieces(intel.evidence.analysed)}. That is enough to start looking, but not enough to be sure of anything.`,
    };
  }

  const growing = intel.loved
    .filter((i) => hasSignal(i, 'growing'))
    .sort((a, b) => b.evidence.count - a.evidence.count)
    .slice(0, 2);
  const praiseClause = growing.length
    ? `Customers are praising your ${joinNames(growing.map((i) => lower(i.themeLabel)))} more than before.`
    : keep
      ? keep.recurring
        ? `Customers keep praising your ${lower(keep.insight.themeLabel)}.`
        : `Customers praise your ${lower(keep.insight.themeLabel)} most.`
      : null;

  let weakClause: string | null = null;
  if (first) {
    const label = lower(first.insight.themeLabel);
    const move = first.insight.movement.state;
    const still = first.recurring || first.outcome !== null ? 'still ' : '';
    // Each of these was glued on with ", although …" or ", and …". Two short
    // sentences read better than one long one, so the clause stands on its own.
    const tail =
      first.outcome?.result === 'IMPROVED'
        ? ' It has come up less in the feedback after the change.'
        : first.outcome?.result === 'WORSENED'
          ? ' It has come up more in the feedback after the change.'
          : move === 'WORSENING'
            ? ' It came up more at your latest check-in.'
            : move === 'IMPROVING'
              ? ' It came up less at your latest check-in.'
              : '';
    // "The main problem is X" reads right whether X is singular or plural.
    weakClause = `The main problem is ${still}${label}.${tail}`;
  }

  if (praiseClause && weakClause) {
    return {
      mood: trend === 'WORSENING' ? 'NEEDS_WORK' : 'MIXED',
      summary: `${praiseClause} ${weakClause}`,
    };
  }
  if (weakClause) {
    return { mood: 'NEEDS_WORK', summary: weakClause };
  }
  if (praiseClause) {
    return {
      mood: 'GOOD',
      summary: `${praiseClause} Nothing is coming up often enough to call a problem.`,
    };
  }
  return {
    mood: 'GOOD',
    summary: 'Nothing in your feedback is standing out as a problem.',
  };
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export function buildPortalView(input: PortalInput): PortalView {
  const intel = input.intelligence;
  const trend = intel.overallTrend;
  const presence = presenceFrom(input.snapshots, input.pack);
  const loops = loopByTheme(input.actions);
  const context = input.context ?? EMPTY_CONTEXT;

  // ---- The strength worth protecting ---------------------------------------
  // The engine ranks growing praise above merely frequent praise; among equal
  // ranks the one customers mention most wins, so a bigger number never sits
  // under a smaller one unexplained.
  const rankedPraise = [...intel.loved].sort(
    (a, b) => b.rank - a.rank || b.evidence.count - a.evidence.count,
  );
  const strongest = rankedPraise[0] ?? null;
  const biggestOther = Math.max(0, ...rankedPraise.slice(1).map((i) => i.evidence.count));
  const featuredBecause = !strongest
    ? null
    : strongest.movement.state === 'IMPROVING'
      ? 'Chosen because customers are mentioning it more than before, not only because it is mentioned often.'
      : strongest.evidence.count < biggestOther
        ? 'Not your most-mentioned strength, but the one that matters most right now.'
        : null;
  // "Praised most" is reserved for the top two strengths by count.
  const byCount = [...intel.loved]
    .filter((i) => hasSignal(i, 'strength'))
    .sort((a, b) => b.evidence.count - a.evidence.count)
    .map((i) => i.themeKey);
  const strengthRank = (i: Insight) => {
    const at = byCount.indexOf(i.themeKey);
    return at === -1 ? 99 : at;
  };
  const base = { intel, pack: input.pack, presence, loops, context, dimensions: input.themes.dimensions };

  const loved = rankedPraise.map((i) =>
    toSignal(i, {
      ...base,
      isAttention: false,
      strengthRank: strengthRank(i),
      featuredBecause: i === strongest ? featuredBecause : null,
    }),
  );
  const unhappy = intel.unhappy.map((i) =>
    toSignal(i, { ...base, isAttention: i.themeKey === intel.attention?.themeKey, strengthRank: 99 }),
  );
  const first = unhappy.find((s) => s.bucket === 'FIRST') ?? null;
  const keep = loved.find((s) => s.bucket === 'KEEP') ?? null;
  const watch = [
    ...unhappy.filter((s) => s.bucket === 'WATCH'),
    ...loved.filter((s) => s.bucket === 'WATCH'),
  ];
  const early = [...unhappy, ...loved].filter((s) => s.bucket === 'EARLY');

  const { mood, summary } = summaryFor(
    intel,
    trend,
    keep ? { insight: rankedPraise.find((i) => i.themeKey === keep.themeKey)!, recurring: keep.isRecurring } : null,
    intel.attention && first
      ? { insight: intel.attention, outcome: first.outcome, recurring: first.isRecurring }
      : null,
  );

  const changed = intel.changing.map((i) =>
    toSignal(i, {
      ...base,
      isAttention: i.themeKey === intel.attention?.themeKey,
      strengthRank: strengthRank(i),
    }),
  );
  const steady = [...loved, ...unhappy].filter((s) => s.movementDirection === 'STABLE');
  const notComparable = intel.window.available
    ? [...loved, ...unhappy].filter((s) => s.movementDirection === null)
    : [];

  // ---- Current signals, pattern or not -----------------------------------
  // Counts straight from the theme summary, so a first week is not a blank
  // page. The floor still decides what is a pattern; it no longer decides
  // whether the owner may see what two customers said.
  const mentions = [...input.themes.issues, ...input.themes.praises]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8)
    .map((r) => ({
      themeKey: r.key,
      label: r.label,
      kind: r.kind,
      count: r.count,
      pattern: r.count >= MIN_MENTIONS_TO_NAME,
    }));
  const rated = input.themes.dimensions
    .filter((d) => d.rated > 0 && d.average !== null)
    .map((d) => ({ themeKey: d.themeKey, label: d.label, average: d.average as number, rated: d.rated, low: d.low }));
  const soFar: PortalSoFar = {
    read: intel.evidence.analysed,
    waiting: intel.evidence.unread,
    mentions,
    rated,
    note:
      mentions.length === 0 && rated.length === 0
        ? 'Once Headway has read some feedback, what customers mention appears here.'
        : mentions.some((m) => m.pattern)
          ? `The marked ones are patterns. Customers raised them ${MIN_MENTIONS_TO_NAME} or more times. The rest are mentions Headway is watching, not conclusions.`
          : `Nothing here has been raised ${MIN_MENTIONS_TO_NAME} times yet. So Headway is not calling any of it a pattern. It needs two check-ins before it can say whether anything is coming up more or less.`,
  };

  // ---- Facts, each with its own scope ---------------------------------------
  const facts: PortalFact[] = [
    {
      key: 'direction',
      label: 'Overall direction',
      // The words are free to change and to be translated; the colour is
      // chosen from `tone` below, not from these.
      tone:
        trend === 'IMPROVING'
          ? 'good'
          : trend === 'WORSENING'
            ? 'bad'
            : trend === 'STABLE'
              ? 'neutral'
              : 'unknown',
      value:
        trend === 'IMPROVING'
          ? 'Getting better'
          : trend === 'WORSENING'
            ? 'Getting worse'
            : trend === 'STABLE'
              ? 'Holding steady'
              : 'Not enough to say',
      scope:
        trend === 'INSUFFICIENT_DATA'
          ? 'Headway needs two check-ins before it can compare'
          : 'Compared with your previous check-in',
    },
  ];
  const observed = input.card.observed;
  if (observed.rating !== null) {
    facts.push({
      key: 'publicRating',
      label: 'Public rating',
      tone: 'neutral',
      value: observed.rating.toFixed(1),
      scope:
        observed.reviewCount !== null
          ? `All ${observed.reviewCount} public reviews, not just the feedback Headway has read`
          : 'Your public listing, not the feedback Headway has read',
    });
  }

  // ---- The invisible work, stated ------------------------------------------
  const quiet = [...input.themes.praises, ...input.themes.issues].filter(
    (r) => r.count > 0 && r.count < MIN_MENTIONS_TO_NAME,
  ).length;
  const patterns = intel.loved.length + intel.unhappy.length;
  const work: string[] = [];
  if (intel.evidence.analysed > 0) {
    work.push(
      `Read ${pieces(intel.evidence.analysed)}${intel.evidence.unread > 0 ? ` (${intel.evidence.unread} more being read now)` : ''}.`,
    );
    work.push(
      patterns > 0
        ? `Grouped them into ${patterns} ${patterns === 1 ? 'thing' : 'things'} customers keep raising.${quiet > 0 ? ` Set aside ${quiet} ${quiet === 1 ? 'topic' : 'topics'} mentioned only once or twice.` : ''}`
        : `Found nothing yet that has been raised ${MIN_MENTIONS_TO_NAME} or more times.`,
    );
  }
  if (intel.window.available && intel.window.previousCapturedAt && intel.window.currentCapturedAt) {
    // Dates, not labels: a label is whatever was typed at the time.
    work.push(
      `Compared your check-ins of ${formatDate(intel.window.previousCapturedAt)} and ${formatDate(intel.window.currentCapturedAt)}.`,
    );
  } else if (presence.checkins === 1) {
    work.push('Recorded your first check-in. The next one lets Headway show what changed.');
  }
  const measured = input.actions.filter((p) => p.action.measurement).length;
  const remembered = input.actions.length - measured;
  if (measured > 0) {
    work.push(
      `Compared the feedback before and after ${measured} ${measured === 1 ? 'change' : 'changes'} you made.`,
    );
  }
  if (remembered > 0) {
    work.push(`Kept track of ${remembered} ${remembered === 1 ? 'decision' : 'decisions'} you have made.`);
  }

  // ---- What not to worry about ---------------------------------------------
  const quietNote =
    quiet > 0
      ? `${quiet} other ${quiet === 1 ? 'topic was' : 'topics were'} mentioned once or twice. That is not enough to call a pattern.`
      : null;
  const earlyNames = early.map((s) => lower(s.themeLabel));
  // With a watch list on screen, the bare "nothing else needs your attention"
  // would be false — the watch items are right there. So the lead only claims
  // that nothing comes ahead of them.
  const lead =
    watch.length > 0
      ? 'Nothing else comes ahead of what is listed above.'
      : 'Nothing else needs your attention.';
  const noAction =
    early.length > 0 || quiet > 0
      ? `${lead} ${earlyNames.length ? `${joinNames(earlyNames).replace(/^./, (c) => c.toUpperCase())} ${earlyNames.length === 1 ? 'has' : 'have'} come up. That is not often enough to act on yet. ` : ''}${quiet > 0 ? `${quiet} other ${quiet === 1 ? 'topic was' : 'topics were'} mentioned once or twice. ` : ''}Headway is not suggesting a change for any of these until they come up more often.`
      : intel.evidence.analysed > 0
        ? watch.length > 0
          ? `${lead} Everything else customers raised is in the watch list above. None of it needs a change yet.`
          : 'Nothing else is coming up often enough to act on.'
        : 'There is nothing to set aside yet.';

  // ---- The improvement loop, told end to end ---------------------------------
  const windowAfter = (doneAt: Date | null): boolean =>
    doneAt !== null &&
    intel.window.available &&
    intel.window.previousCapturedAt !== null &&
    intel.window.previousCapturedAt.getTime() >= doneAt.getTime();

  const actions: PortalAction[] = input.actions.map((progress) => {
    const a = progress.action;
    const stage = stageFor(a.status);
    const measuredNow = stage === 'CHECKED';
    const outcome = outcomeFrom(progress);
    const insightNow =
      [...intel.loved, ...intel.unhappy].find((i) => i.themeKey === a.provenance.themeKey) ?? null;
    const returning =
      a.provenance.themeSentiment === 'ISSUE' &&
      outcome?.result === 'IMPROVED' &&
      insightNow?.movement.state === 'WORSENING' &&
      windowAfter(a.doneAt);
    const m = a.measurement;

    return {
      id: a.id,
      about: a.provenance.themeLabel,
      themeKey: a.provenance.themeKey,
      kind: a.provenance.themeSentiment,
      stage,
      stageLabel: STAGE_LABELS[stage],
      stageMeaning: STAGE_MEANINGS[stage],
      // The pile and the date it was counted on — never a check-in label,
      // which names a different pile.
      problem: `${a.baseline.count} of ${pieces(a.baseline.total)} read by ${formatDate(a.baseline.capturedAt)} mentioned it (${shareText(a.baseline.count, a.baseline.total)}).`,
      suggestedAt: a.createdAt,
      suggested: a.provenance.recommendationText || 'Headway raised this without a specific suggestion.',
      decision: a.description.trim(),
      decidedAt: a.decidedAt,
      decisionNote: a.statusNote.trim(),
      doneAt: a.doneAt,
      measuredAt: a.measuredAt,
      steps: [
        { label: 'Suggested', done: true },
        { label: stage === 'NOT_DOING' ? 'Not doing' : 'Agreed', done: a.decidedAt !== null },
        { label: 'Change made', done: a.doneAt !== null && stage !== 'NOT_DOING' },
        // One stage word, "Checked"; "compared" stays as the verb inside the
        // stage meaning, never as a competing name for the same step.
        { label: 'Checked', done: measuredNow },
      ],
      outcome,
      learning: a.learningNote.trim() || null,
      nextStep: nextStepFor({
        kind: a.provenance.themeSentiment,
        bucket: 'FIRST',
        easing: false,
        suggestion: a.provenance.recommendationText || null,
        progress,
        returning,
      }),
      memory:
        m && m.before.share !== null && m.after.share !== null
          ? {
              then: formatShare(m.before.share),
              change: a.description.trim() || 'the change you made',
              now: formatShare(m.after.share),
              result:
                m.result === 'IMPROVED'
                  ? 'Less often'
                  : m.result === 'WORSENED'
                    ? 'More often'
                    : m.result === 'NO_CLEAR_CHANGE'
                      ? 'No clear difference'
                      : 'Not enough feedback',
            }
          : null,
      // Only check-ins recorded after the change count as "since". Earlier
      // ones are not evidence about it, and are not shown as if they were.
      sinceThen:
        insightNow && insightNow.movement.available && insightNow.movement.pointNote && windowAfter(a.doneAt)
          ? `At check-ins after the change: ${insightNow.movement.pointNote}`
          : null,
      returning,
      awaiting:
        a.status === 'DONE'
          ? { have: progress.newFeedbackSinceDone, need: MIN_FEEDBACK_TO_MEASURE }
          : null,
    };
  });

  // ---- What RepOS is watching ----------------------------------------------
  const watching: PortalWatch[] = [];
  const tone = (s: PortalSignal): 'good' | 'warn' | 'neutral' =>
    s.movementDirection === 'IMPROVING' || s.outcome?.result === 'IMPROVED'
      ? 'good'
      : s.movementDirection === 'WORSENING' || s.outcome?.result === 'WORSENED' || s.returning
        ? 'warn'
        : 'neutral';
  const stateOf = (s: PortalSignal): string => {
    if (s.returning) return 'coming up again';
    if (s.actionState === 'IN_PROGRESS') return 'change in progress';
    if (s.outcome?.result === 'IMPROVED') return 'less often after the change';
    if (s.outcome?.result === 'WORSENED') return 'more often after the change';
    if (s.movementDirection === null) {
      return intel.window.available ? 'too few to compare yet' : 'one check-in so far';
    }
    // Mention counts, in the portal's three words: more often, less often,
    // about the same. The verb says which side of the ledger it is.
    if (s.kind === 'ISSUE') {
      if (s.movementDirection === 'IMPROVING') return 'raised less often';
      if (s.movementDirection === 'WORSENING') return 'raised more often';
      return 'about the same';
    }
    if (s.movementDirection === 'IMPROVING') return 'praised more often';
    if (s.movementDirection === 'WORSENING') return 'praised less often';
    return 'about the same';
  };
  // The watch-this themes already carry their own flag line in their section;
  // listing them again here would say the same sentence twice on one page.
  for (const s of [first, keep].filter((s): s is PortalSignal => s !== null)) {
    watching.push({
      themeKey: s.themeKey,
      label: s.themeLabel,
      state: stateOf(s),
      tone: tone(s),
      next: s.watchLine,
    });
  }
  for (const a of actions) {
    if (a.awaiting && !watching.some((w) => w.themeKey === a.themeKey)) {
      watching.push({
        themeKey: a.themeKey,
        label: a.about,
        state: 'not yet checked',
        tone: 'neutral',
        next: `Headway is waiting for enough new feedback to compare. So far it has ${a.awaiting.have} of ${a.awaiting.need}.`,
      });
    }
  }
  if (early.length > 0) {
    watching.push({
      themeKey: null,
      label: joinNames(early.map((s) => s.themeLabel)),
      state: 'waiting for more feedback',
      tone: 'neutral',
      next:
        early.length === 1 && early[0]
          ? early[0].watchLine
          : `Headway is watching whether these come up more often before it says anything about them.`,
    });
  }

  // The quiet-topics count is already in "not worth your time"; the engine's
  // limit line would say it a second time on the same page.
  const limits = quiet > 0 ? intel.limits.filter((l) => !/mentioned once or twice/.test(l)) : intel.limits;

  // ---- What the owner told RepOS, shown back as theirs ----------------------
  const KIND_ORDER: ContextItem['kind'][] = [
    'PRIORITY',
    'FOCUS',
    'OPERATING',
    'CONSTRAINT',
    'TRIED',
    'DEFINITION',
    'ANSWER',
  ];
  const knows: PortalKnown[] = context.items
    .filter((i) => i.provenance === 'OWNER_TOLD_US')
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        b.recordedAt.getTime() - a.recordedAt.getTime(),
    )
    .map((i) => ({
      id: i.id,
      kind: i.kind,
      line: youToldUs(
        i,
        i.kind === 'ANSWER' && i.questionKey
          ? (entryFor(input.pack, 'ISSUE', i.questionKey)?.askOwner?.question ?? null)
          : null,
      ),
      themeKey: i.themeKey,
      recordedAt: i.recordedAt,
    }));

  return {
    businessName: intel.businessName,
    verticalLabel: intel.verticalLabel,

    mood,
    summary,
    basis:
      intel.evidence.analysed === 0
        ? intel.evidence.unread > 0
          ? 'Feedback is usually read within a minute of arriving. Refresh this page to see what Headway found.'
          : 'No feedback collected yet.'
        : intel.evidence.unread > 0
          ? `Based on ${pieces(intel.evidence.analysed)}. ${intel.evidence.unread} more ${intel.evidence.unread === 1 ? 'is' : 'are'} being read now.`
          : `Based on ${pieces(intel.evidence.analysed)}.`,
    facts,
    soFar,
    work,

    keep,
    first,
    watch,
    early,
    quietNote,
    noAction,

    loved,
    unhappy,
    changed,
    changedNote: intel.window.available
      ? intel.window.previousCapturedAt && intel.window.currentCapturedAt
        ? `Comparing your check-ins of ${formatDate(intel.window.previousCapturedAt)} (${pieces(intel.window.previousFeedbackCount ?? 0)}) and ${formatDate(intel.window.currentCapturedAt)} (${intel.window.currentFeedbackCount ?? 0}).`
        : intel.window.note
      : 'Headway needs two check-ins before it can show you what changed.',
    steady,
    notComparable,

    watching: watching.slice(0, 6),
    question: first?.question ?? null,
    knows,

    actions,
    actionsNote:
      actions.length === 0
        ? 'Nothing has been agreed yet. When something comes up often enough to act on, it will appear here.'
        : '',
    suggestedNow: first && first.actionState === 'NONE' ? first : null,

    limits,
    basedOn: intel.evidence.analysed,
    version: PORTAL_VERSION,
  };
}
