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
  formatShare,
  type ActionResult,
  type ActionStatus,
} from '@/lib/improve/model';
import { MIN_FEEDBACK_TO_MEASURE, measurementWords } from '@/lib/improve/measure';
import type { ActionProgress } from '@/lib/improve/service';
import { formatDate } from '@/lib/format';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';
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

/**
 * The English labels, for the operator console and anything else without a
 * translator. Read out of the dictionary rather than typed a second time, so
 * the two cannot drift apart; the portal calls `bucketLabelFor` instead.
 */
export const BUCKET_LABELS: Record<PortalBucket, string> = {
  FIRST: EN('insight.bucket.FIRST'),
  KEEP: EN('insight.bucket.KEEP'),
  WATCH: EN('insight.bucket.WATCH'),
  EARLY: EN('insight.bucket.EARLY'),
};

function bucketLabelFor(bucket: PortalBucket, t: PortalTranslator): string {
  return t(`insight.bucket.${bucket}`);
}

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
  START: EN('insight.advice.START'),
  HOLD: EN('insight.advice.HOLD'),
  CONTINUE: EN('insight.advice.CONTINUE'),
  CHECKING: EN('insight.advice.CHECKING'),
  KEEP_CHANGE: EN('insight.advice.KEEP_CHANGE'),
  REVIEW_CHANGE: EN('insight.advice.REVIEW_CHANGE'),
  PROTECT: EN('insight.advice.PROTECT'),
  WATCH: EN('insight.advice.WATCH'),
  WAIT: EN('insight.advice.WAIT'),
};

function adviceLabelFor(advice: PortalAdvice, t: PortalTranslator): string {
  return t(`insight.advice.${advice}`);
}

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
  /**
   * The same four figures, as numbers.
   *
   * Home needs them to draw the two piles. It used to read them back out of
   * `beforeLine` with /^(\d+) of (\d+)/ — which is English sentence structure,
   * and Hindi writes the total first, so the whole before/after block vanished
   * for a Hindi reader with nothing to indicate it ever existed.
   */
  beforeCount: number;
  beforeTotal: number;
  afterCount: number;
  afterTotal: number;
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

/**
 * The sentence that keeps a before/after observational.
 *
 * It travels with every reading, in every language. A translation that softens
 * it into "may not have been caused by" would make the portal claim more in
 * Hindi than it claims in English, which is the one thing this layer exists to
 * prevent.
 */
function outcomeNote(t: PortalTranslator): string {
  return t('insight.outcome.note');
}

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
  /**
   * The same two numbers, as numbers.
   *
   * Home's recurrence chip needs them. Reading them back out of `recurrence`
   * with a regex worked only while that sentence was English — see the note on
   * Recurrence in portal/history.ts.
   */
  recurrenceRaised: number | null;
  recurrenceOutOf: number | null;
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
  /**
   * The same figures, as data.
   *
   * The Improvements page draws them as a labelled row. It used to recover them
   * by matching the sentence against
   * /^(\d+) of the (\d+) pieces of feedback read by (.+?) \((\d+%)\)/ — which
   * stopped matching the moment the wording changed, in English, and would
   * never have matched Hindi at all.
   */
  problemCount: number;
  problemTotal: number;
  problemShare: string;
  problemBy: string;
  suggestedAt: Date;
  /** What RepOS suggested, verbatim from the pack. */
  suggested: string;
  /**
   * Whether `suggested` is a real suggestion.
   *
   * `suggested` falls back to "Headway raised this without a specific
   * suggestion", so it is never empty and cannot be used as a truthiness test.
   * Carried as a flag rather than by comparing the sentence, which would be
   * the same English-matching mistake in a new place.
   */
  hasSuggestion: boolean;
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
  /**
   * What each work line IS, in the same order — 'read', 'grouped', 'compared',
   * 'firstCheckin', 'measured', 'remembered'.
   *
   * The responsibility engine picks some of these lines out. It used to do so
   * with /^Grouped |^Compared |^Kept track /, which matched nothing once the
   * lines were written in Hindi — so the sentence describing the work Headway
   * did simply disappeared for those readers.
   */
  workKinds: string[];

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
// Small wording helpers
// ---------------------------------------------------------------------------

/**
 * The pile, counted.
 *
 * The translator defaults to English because this is exported and the operator
 * console's own callers have no translator to give it.
 */
export function pieces(n: number, t: PortalTranslator = EN): string {
  return t.plural('insight.pieces', n);
}

/** Counts are feedback entries, not people: one customer may leave several. */
function comments(n: number, t: PortalTranslator): string {
  return t.plural('insight.comments', n);
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

/**
 * A list of theme names, as a person would read it.
 *
 * The names are pack data and are never translated; only the last join is a
 * word, and it is one key rather than a bare " and " glued in.
 */
function joinNames(names: string[], t: PortalTranslator): string {
  if (names.length <= 1) return names[0] ?? '';
  return t('insight.list.pair', {
    first: names.slice(0, -1).join(', '),
    last: names[names.length - 1] ?? '',
  });
}

function stageLabelFor(stage: PortalActionStage, t: PortalTranslator): string {
  return t(`insight.stage.${stage}`);
}

function stageMeaningFor(stage: PortalActionStage, t: PortalTranslator): string {
  return t(`insight.stageMeaning.${stage}`);
}

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

/**
 * The suggestion frozen onto an action, in the owner's language WHERE THAT IS
 * HONEST.
 *
 * `recommendationText` is copied onto the action when it is created, so an old
 * action can carry wording the pack has since changed. Showing the pack's
 * current sentence instead would rewrite history — the portal is supposed to
 * say what Headway suggested at the time.
 *
 * So: translate it only when the frozen text is still word-for-word the pack's
 * current suggestion, which means nothing has changed and the translation says
 * exactly the same thing. When they differ, the frozen English stands, because
 * there is no translation of a sentence that no longer exists anywhere.
 */
function frozenSuggestion(
  pack: Pack,
  themeKey: string,
  frozen: string | null,
  t: PortalTranslator,
): string | null {
  if (!frozen) return null;
  const current = pack.issueTaxonomy.find((x) => x.key === themeKey)?.action?.trim() ?? null;
  if (!current || current !== frozen.trim()) return frozen;
  return t.soft(`pack.${pack.id}.${themeKey}.action`) ?? frozen;
}

export function outcomeFrom(
  progress: ActionProgress | undefined,
  t: PortalTranslator = EN,
  packId?: string,
): PortalOutcome | null {
  const m = progress?.action.measurement;
  if (!m || !progress) return null;
  const delta = m.shareDelta ?? 0;
  const doneAt = progress.action.doneAt;

  // THE SENTENCES ARE RE-RENDERED, THE NUMBERS ARE NOT.
  //
  // A measurement is stored as JSON with its prose inside it, so a reading
  // taken before the portal spoke Hindi holds English prose forever — reading
  // `m.headline` back out of storage would show that English to a Hindi owner
  // with nothing to indicate why. So the words are written again here, from
  // the frozen figures, in the reader's language.
  //
  // Every figure still comes from the stored measurement and the frozen
  // baseline: the counts, the totals, the share move, the feedback that fell
  // between the decision and the change, and the two dates the comparison was
  // drawn between. Nothing is recounted. The verdict is not re-decided either
  // — `m.result` is handed over as a fact, and the renderer only picks the
  // sentence that describes it.
  const words = doneAt
    ? measurementWords(
        {
          result: m.result,
          // The label frozen beside the figures is English. The KEY is stable,
          // so the label is looked up again here — otherwise a Marathi
          // sentence carries an English noun phrase in the middle of it.
          themeLabel:
            (packId
              ? t.soft(`pack.${packId}.${progress.action.provenance.themeKey}`)
              : null) ?? m.themeLabel,
          sentiment: m.sentiment,
          before: m.before,
          after: m.after,
          shareDelta: m.shareDelta,
          betweenCount: m.betweenCount,
          capturedAt: progress.action.baseline.capturedAt,
          doneAt,
        },
        t,
      )
    : // Only reachable if the change date were cleared while the measurement
      // survived, which the service does not allow — it drops the measurement
      // in the same write. The stored sentences stand rather than a blank.
      {
        resultLabel: m.resultLabel,
        headline: m.headline,
        why: m.why,
        limits: m.limits,
        beforeLine: m.before.line,
        afterLine: m.after.line,
      };

  return {
    result: m.result,
    resultLabel: words.resultLabel,
    headline: words.headline,
    beforeShare: m.before.share === null ? null : formatShare(m.before.share),
    afterShare: m.after.share === null ? null : formatShare(m.after.share),
    beforeLine: words.beforeLine,
    afterLine: words.afterLine,
    beforeCount: m.before.count,
    beforeTotal: m.before.total,
    afterCount: m.after.count,
    afterTotal: m.after.total,
    beforeScope: t('insight.outcome.beforeScope', {
      date: formatDate(progress.action.baseline.capturedAt),
    }),
    afterScope: doneAt
      ? t('insight.outcome.afterScope.dated', { date: formatDate(doneAt) })
      : t('insight.outcome.afterScope'),
    changeDate: doneAt,
    direction: delta === 0 ? 'FLAT' : delta < 0 ? 'DOWN' : 'UP',
    good: m.result === 'IMPROVED',
    why: words.why,
    note: outcomeNote(t),
    caveat: words.limits[0] ?? '',
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
  t: PortalTranslator;
}): string {
  const { progress, suggestion, bucket, t } = args;
  const a = progress?.action;

  if (!a) {
    if (args.kind === 'PRAISE') {
      // The watch line beside this already names the drop Headway would flag,
      // and names the number. Saying it here too would repeat it on one card —
      // and it would be wrong on a strength that has already slipped.
      return t('insight.next.praise');
    }
    if (bucket === 'WATCH') {
      // Same reason as above: the watch line says what Headway will flag, and
      // at what number.
      return suggestion
        ? t('insight.next.watch.suggestion', { suggestion })
        : t('insight.next.watch');
    }
    // On the card, the advice label beside this already says the complaint is
    // coming up less on its own, so this sentence gives the decision rather
    // than repeating the movement a third time.
    if (args.easing) {
      return suggestion
        ? t('insight.next.easing.suggestion', { suggestion })
        : t('insight.next.easing');
    }
    return suggestion ? t('insight.next.start', { suggestion }) : t('insight.next.act');
  }

  switch (a.status) {
    case 'RECOMMENDED':
      return t('insight.next.recommended');
    case 'ACCEPTED':
      return t('insight.next.accepted');
    case 'PAUSED':
      return t('insight.next.paused');
    case 'DONE': {
      // Once enough has arrived, saying "48 of the 10 needed" is nonsense —
      // and it is what an owner saw on every page of a busy client (M18).
      const have = progress?.newFeedbackSinceDone ?? 0;
      // A whole sentence, not a stem: it is dropped into the two sentences
      // below as `{made}`, so each language keeps its own word order inside it.
      const made = a.doneAt
        ? t('insight.next.done.madeOn', { date: formatDate(a.doneAt) })
        : t('insight.next.done.made');
      return have >= MIN_FEEDBACK_TO_MEASURE
        ? t.plural('insight.next.done.enough', have, { made })
        : t('insight.next.done.waiting', { made, have, need: MIN_FEEDBACK_TO_MEASURE });
    }
    case 'MEASURED': {
      switch (a.measurement?.result) {
        case 'IMPROVED':
          return args.returning
            ? t('insight.next.improved.returning')
            : t('insight.next.improved');
        case 'WORSENED':
          return suggestion
            ? t('insight.next.worsened.suggestion', { suggestion })
            : t('insight.next.worsened');
        case 'NO_CLEAR_CHANGE':
          return t('insight.next.noClearChange');
        default:
          return t('insight.next.notEnough', { need: MIN_FEEDBACK_TO_MEASURE });
      }
    }
    default:
      return t('insight.next.record');
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
  /** The language this theme is being read in. Passed down, never looked up. */
  t: PortalTranslator;
};

/** The feedback-page question that is evidence for this issue, once anyone has answered it. */
/**
 * What customers tapped on the feedback page, for one theme.
 *
 * The dimension and signal labels come from the pack's gateway block, which is
 * DATA — so they are looked up softly by key with the pack's own English as the
 * fallback. Without this the owner reads "What customers tapped" in Marathi and
 * then an English list underneath it.
 */
function tappedFor(
  insight: Insight,
  ctx: ThemeContext,
  t: PortalTranslator,
  packId: string,
): PortalTapped | null {
  if (insight.sentiment !== 'ISSUE') return null;
  const row = ctx.dimensions.find((d) => d.themeKey === insight.themeKey && d.rated > 0 && d.average !== null);
  if (!row) return null;
  return {
    label: t.soft(`pack.${packId}.dim.${row.key}`) ?? row.label,
    rated: row.rated,
    low: row.low,
    average: row.average as number,
    specifics: row.signals.map((s) => ({
      label: t.soft(`pack.${packId}.sig.${row.key}.${s.key}`) ?? s.label,
      count: s.count,
    })),
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
function movementBriefFor(insight: Insight, t: PortalTranslator): string {
  const move = insight.movement.state;
  const issue = insight.sentiment === 'ISSUE';
  if (move === 'WORSENING') {
    return issue
      ? t('insight.movement.issue.worsening')
      : t('insight.movement.praise.worsening');
  }
  if (move === 'IMPROVING') {
    return issue
      ? t('insight.movement.issue.improving')
      : t('insight.movement.praise.improving');
  }
  if (move === 'STABLE') return t('insight.movement.stable');
  return t('insight.movement.none');
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
  t: PortalTranslator;
}): { brief: string; meaning: string } {
  const { insight, counterpart, recurrence, outcome, bucket, t } = args;
  const move = insight.movement.state;
  const sentences: string[] = [];

  if (insight.sentiment === 'ISSUE') {
    if (counterpart) {
      sentences.push(
        t('insight.meaning.counterpart.issue', {
          label: counterpart.themeLabel,
          praise: comments(counterpart.count, t),
          against: comments(insight.evidence.count, t),
        }),
      );
    }
    let primary: string;
    let afterNote: string | null = null;
    if (args.state === 'CHECKED' && outcome) {
      // The date and the two shares sit in different places in Hindi and
      // Marathi than they do in English, so each combination is a whole
      // sentence of its own rather than fragments dropped into the middle.
      const shares = Boolean(outcome.beforeShare && outcome.afterShare);
      const dated = outcome.changeDate !== null;
      const vars = {
        date: outcome.changeDate ? formatDate(outcome.changeDate) : '',
        before: outcome.beforeShare ?? '',
        after: outcome.afterShare ?? '',
      };
      const variant = (base: 'improved' | 'worsened' | 'noClearChange'): string =>
        dated && shares
          ? t(`insight.meaning.${base}.dated.shares`, vars)
          : dated
            ? t(`insight.meaning.${base}.dated`, vars)
            : shares
              ? t(`insight.meaning.${base}.shares`, vars)
              : t(`insight.meaning.${base}`);
      switch (outcome.result) {
        case 'IMPROVED':
          primary = args.isAttention
            ? `${variant('improved')} ${t('insight.meaning.stillWatched')}`
            : variant('improved');
          afterNote = outcome.note;
          break;
        case 'WORSENED':
          primary = variant('worsened');
          afterNote = `${outcome.note} ${t('insight.outcome.lookAgain')}`;
          break;
        case 'NO_CLEAR_CHANGE':
          primary = variant('noClearChange');
          break;
        default:
          primary = dated
            ? t('insight.meaning.notEnough.dated', vars)
            : t('insight.meaning.notEnough');
      }
    } else if (move === 'WORSENING') {
      primary = movementBriefFor(insight, t);
    } else if (move === 'IMPROVING') {
      primary = movementBriefFor(insight, t);
    } else if (recurrence.recurring) {
      primary = t('insight.meaning.recurring');
    } else if (recurrence.isNew) {
      primary = t('insight.meaning.new');
    } else if (bucket === 'EARLY') {
      primary = t('insight.meaning.early', { comments: comments(insight.evidence.count, t) });
    } else if (bucket === 'WATCH') {
      primary = t('insight.meaning.watch');
    } else {
      primary = t('insight.meaning.act', { comments: comments(insight.evidence.count, t) });
    }
    sentences.push(primary);
    if (afterNote) sentences.push(afterNote);
    if (args.returning) {
      sentences.push(t('insight.meaning.returning'));
    }
    return { brief: primary, meaning: sentences.join(' ') };
  }

  // Praise.
  const strong = hasSignal(insight, 'strength');
  const top = args.strengthRank <= 1;
  let primary: string;
  if (strong && move === 'IMPROVING') {
    primary = top
      ? t('insight.meaning.praise.growing.top')
      : t('insight.meaning.praise.growing');
  } else if (strong && move === 'WORSENING') {
    primary = t('insight.meaning.praise.slipping');
  } else if (strong && recurrence.recurring) {
    primary = top
      ? t('insight.meaning.praise.recurring.top')
      : t('insight.meaning.praise.recurring');
  } else if (strong) {
    primary = top ? t('insight.meaning.praise.top') : t('insight.meaning.praise.strength');
  } else {
    primary = t('insight.meaning.praise.few');
  }
  sentences.push(primary);
  if (counterpart) {
    sentences.push(
      t('insight.meaning.praise.counterpart', {
        comments: comments(counterpart.count, t),
        theme: lower(counterpart.themeLabel),
      }),
    );
  }
  return { brief: primary, meaning: sentences.join(' ') };
}

function watchLineFor(
  insight: Insight,
  bucket: PortalBucket,
  state: PortalActionState,
  outcome: PortalOutcome | null,
  t: PortalTranslator,
): string {
  const theme = lower(insight.themeLabel);
  if (bucket === 'EARLY') {
    return insight.sentiment === 'PRAISE'
      ? t('insight.watch.early.praise', { theme, need: MIN_MENTIONS_TO_NAME * 2 })
      : t('insight.watch.early.issue', { theme, need: MIN_MENTIONS_TO_NAME });
  }
  if (insight.sentiment === 'PRAISE') {
    return t('insight.watch.praise', { theme, change: MIN_CHANGE_TO_REPORT });
  }
  if (state === 'CHECKED' && outcome?.result === 'IMPROVED') {
    return t('insight.watch.improved', { theme });
  }
  if (state === 'IN_PROGRESS') {
    return t('insight.watch.inProgress', { theme });
  }
  return t('insight.watch.default', { theme, change: MIN_CHANGE_TO_REPORT });
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
  const t = ctx.t;
  const { count, outOf } = insight.evidence;
  const progress = ctx.loops.get(insight.themeKey);
  const state: PortalActionState = progress ? stateFor(progress.action.status) : 'NONE';
  const outcome = outcomeFrom(progress, t, ctx.pack.id);
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
    t,
  });
  const entry = entryFor(ctx.pack, insight.sentiment, insight.themeKey);
  const ask = entry?.askOwner;

  // What the owner told RepOS about this theme. Attributed on every line, and
  // never allowed near the counts: it explains the situation around the
  // evidence, it does not become evidence.
  const applied =
    insight.sentiment === 'ISSUE'
      ? applyConstraints(entry, ctx.context, t, ctx.pack.id)
      : { text: null, constraint: null, note: null, blocked: false };
  const suggestion = insight.sentiment === 'ISSUE' ? (applied.text ?? insight.recommendation) : null;
  const priorityItem = ownerPriority(ctx.context, insight.themeKey);
  const ownerContext = contextForTheme(ctx.context, insight.themeKey).map((item) =>
    youToldUs(item, item.kind === 'ANSWER' ? (ask?.question ?? null) : null, t),
  );
  const answered = answerFor(ctx.context, insight.themeKey);

  // This line sits in the owner's own row, so it opens with "You" even when
  // the owner recorded no words of their own. It never guesses WHAT changed —
  // Headway does not know.
  const decision = progress?.action.description.trim() ?? '';
  const actionLine = !progress
    ? null
    : state === 'DECLINED'
      ? t('insight.action.declined')
      : state === 'SUGGESTED'
        ? t('insight.action.undecided')
        : decision
          ? state === 'CHECKED' || progress.action.status === 'DONE'
            ? t('insight.action.changed', { decision })
            : t('insight.action.agreedToChange', { decision })
          : state === 'CHECKED'
            ? t('insight.action.madeChange')
            : t('insight.action.agreedChange');

  return {
    themeKey: insight.themeKey,
    themeLabel: insight.themeLabel,
    kind: insight.sentiment,

    fact: t.plural('insight.fact', outOf, { count, total: outOf }),
    evidenceCount: count,
    evidenceTotal: outOf,
    share: shareText(count, outOf),
    movementDirection: readable ? moved : null,
    movementCounts: readable ? insight.movement.countNote : null,
    movementLine: readable ? insight.movement.pointNote : null,
    recurrence: recurrenceLine,
    recurrenceRaised: recurrence.raisedAt,
    recurrenceOutOf: recurrence.outOf,
    isRecurring: recurrence.recurring,
    isNew,
    counterpart,

    brief,
    movementBrief: movementBriefFor(insight, t),
    meaning,
    why: whyFor(insight, ctx.intel.verticalLabel),
    bucket,
    bucketLabel: bucketLabelFor(bucket, t),
    advice,
    adviceLabel: adviceLabelFor(advice, t),
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
      t,
    }),
    watchLine: watchLineFor(insight, bucket, state, outcome, t),

    actionState: state,
    actionLine,
    outcome,
    tapped: tappedFor(insight, ctx, t, ctx.pack.id),
    ownerPriority: priorityItem ? youToldUs(priorityItem, null, t) : null,
    ownerContext,
    // Asked once. Once the owner has answered, the answer is shown instead.
    question:
      ask && ctx.isAttention && state === 'NONE' && !answered
        ? {
            themeKey: insight.themeKey,
            themeLabel: insight.themeLabel,
            question:
              t.soft(`pack.${ctx.pack.id}.${insight.themeKey}.ask`) ?? ask.question,
            options: ask.options.map(
              (option, i) =>
                t.soft(`pack.${ctx.pack.id}.${insight.themeKey}.ask.${i}`) ?? option,
            ),
            why: t('insight.question.why', {
              comments: comments(count, t),
              theme: lower(insight.themeLabel),
            }),
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
  t: PortalTranslator = EN,
): { mood: PortalMood; summary: string } {
  if (intel.evidence.analysed === 0) {
    const arrived = intel.evidence.unread;
    return {
      mood: 'TOO_EARLY',
      summary:
        arrived > 0
          ? t.plural('insight.summary.arrived', arrived)
          : t('insight.summary.none'),
    };
  }
  if (!intel.evidence.enough) {
    return {
      mood: 'TOO_EARLY',
      summary: t.plural('insight.summary.early', intel.evidence.analysed),
    };
  }

  const growing = intel.loved
    .filter((i) => hasSignal(i, 'growing'))
    .sort((a, b) => b.evidence.count - a.evidence.count)
    .slice(0, 2);
  const praiseClause = growing.length
    ? t('insight.summary.praise.growing', {
        themes: joinNames(
          growing.map((i) => lower(i.themeLabel)),
          t,
        ),
      })
    : keep
      ? keep.recurring
        ? t('insight.summary.praise.keeps', { theme: lower(keep.insight.themeLabel) })
        : t('insight.summary.praise.most', { theme: lower(keep.insight.themeLabel) })
      : null;

  let weakClause: string | null = null;
  if (first) {
    const theme = lower(first.insight.themeLabel);
    const move = first.insight.movement.state;
    const still = first.recurring || first.outcome !== null;
    // Each of these was glued on with ", although …" or ", and …". Two short
    // sentences read better than one long one, so the clause stands on its own
    // — and a whole sentence is what the other two languages can reorder.
    const tail =
      first.outcome?.result === 'IMPROVED'
        ? t('insight.summary.tail.improved')
        : first.outcome?.result === 'WORSENED'
          ? t('insight.summary.tail.worsened')
          : move === 'WORSENING'
            ? t('insight.summary.tail.worsening')
            : move === 'IMPROVING'
              ? t('insight.summary.tail.improving')
              : '';
    // "The main problem is X" reads right whether X is singular or plural.
    const main = still
      ? t('insight.summary.main.still', { theme })
      : t('insight.summary.main', { theme });
    weakClause = tail ? `${main} ${tail}` : main;
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
      summary: `${praiseClause} ${t('insight.summary.noProblem')}`,
    };
  }
  return {
    mood: 'GOOD',
    summary: t('insight.summary.clear'),
  };
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export function buildPortalView(input: PortalInput): PortalView {
  // English when nobody supplied a language — the operator console's answer,
  // not a fallback. Never a locale check, and never a second mechanism.
  const t = input.t ?? EN;
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
      ? t('insight.featured.growing')
      : strongest.evidence.count < biggestOther
        ? t('insight.featured.notBiggest')
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
  const base = { intel, pack: input.pack, presence, loops, context, dimensions: input.themes.dimensions, t };

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
    t,
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
        ? t('insight.soFar.empty')
        : mentions.some((m) => m.pattern)
          ? t('insight.soFar.patterns', { need: MIN_MENTIONS_TO_NAME })
          : t('insight.soFar.noPattern', { need: MIN_MENTIONS_TO_NAME }),
  };

  // ---- Facts, each with its own scope ---------------------------------------
  const facts: PortalFact[] = [
    {
      key: 'direction',
      label: t('insight.fact.direction.label'),
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
          ? t('insight.fact.direction.improving')
          : trend === 'WORSENING'
            ? t('insight.fact.direction.worsening')
            : trend === 'STABLE'
              ? t('insight.fact.direction.stable')
              : t('insight.fact.direction.unknown'),
      scope:
        trend === 'INSUFFICIENT_DATA'
          ? t('insight.fact.direction.scope.none')
          : t('insight.fact.direction.scope'),
    },
  ];
  const observed = input.card.observed;
  if (observed.rating !== null) {
    facts.push({
      key: 'publicRating',
      label: t('insight.fact.rating.label'),
      tone: 'neutral',
      value: observed.rating.toFixed(1),
      scope:
        observed.reviewCount !== null
          ? t('insight.fact.rating.scope.count', { count: observed.reviewCount })
          : t('insight.fact.rating.scope'),
    });
  }

  // ---- The invisible work, stated ------------------------------------------
  const quiet = [...input.themes.praises, ...input.themes.issues].filter(
    (r) => r.count > 0 && r.count < MIN_MENTIONS_TO_NAME,
  ).length;
  const patterns = intel.loved.length + intel.unhappy.length;
  const work: string[] = [];
  const workKinds: string[] = [];
  const addWork = (kind: string, sentence: string) => {
    work.push(sentence);
    workKinds.push(kind);
  };
  if (intel.evidence.analysed > 0) {
    addWork(
      'read',
      intel.evidence.unread > 0
        ? t.plural('insight.work.readWithUnread', intel.evidence.analysed, {
            unread: intel.evidence.unread,
          })
        : t.plural('insight.work.read', intel.evidence.analysed),
    );
    const grouped = t.plural('insight.work.grouped', patterns);
    // Two different kinds, because the responsibility engine carries one and
    // not the other. The English filter this replaced tested for a "Grouped …"
    // prefix, which the nothing-found sentence never had — tagging both
    // 'grouped' quietly added a line to the check-in list.
    if (patterns > 0) {
      addWork(
        'grouped',
        quiet > 0 ? `${grouped} ${t.plural('insight.work.setAside', quiet)}` : grouped,
      );
    } else {
      addWork('groupedNone', t('insight.work.nothing', { need: MIN_MENTIONS_TO_NAME }));
    }
  }
  if (intel.window.available && intel.window.previousCapturedAt && intel.window.currentCapturedAt) {
    // Dates, not labels: a label is whatever was typed at the time.
    addWork(
      'compared',
      t('insight.work.compared', {
        first: formatDate(intel.window.previousCapturedAt),
        second: formatDate(intel.window.currentCapturedAt),
      }),
    );
  } else if (presence.checkins === 1) {
    addWork('firstCheckin', t('insight.work.firstCheckin'));
  }
  const measured = input.actions.filter((p) => p.action.measurement).length;
  const remembered = input.actions.length - measured;
  if (measured > 0) {
    addWork('measured', t.plural('insight.work.measured', measured));
  }
  if (remembered > 0) {
    addWork('remembered', t.plural('insight.work.remembered', remembered));
  }

  // ---- What not to worry about ---------------------------------------------
  const quietNote = quiet > 0 ? t.plural('insight.quiet', quiet) : null;
  const earlyNames = early.map((s) => lower(s.themeLabel));
  // With a watch list on screen, the bare "nothing else needs your attention"
  // would be false — the watch items are right there. So the lead only claims
  // that nothing comes ahead of them.
  const lead =
    watch.length > 0 ? t('insight.noAction.lead.watch') : t('insight.noAction.lead');
  // Whole sentences, joined. Each one keeps its own word order in each
  // language, which a mid-sentence fragment could not.
  const noAction =
    early.length > 0 || quiet > 0
      ? [
          lead,
          earlyNames.length
            ? t.plural('insight.noAction.early', earlyNames.length, {
                names: joinNames(earlyNames, t).replace(/^./, (c) => c.toUpperCase()),
              })
            : null,
          quiet > 0 ? t.plural('insight.noAction.quiet', quiet) : null,
          t('insight.noAction.tail'),
        ]
          .filter((s): s is string => s !== null)
          .join(' ')
      : intel.evidence.analysed > 0
        ? watch.length > 0
          ? `${lead} ${t('insight.noAction.watchList')}`
          : t('insight.noAction.none')
        : t('insight.noAction.empty');

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
    const frozen = frozenSuggestion(
      input.pack,
      a.provenance.themeKey,
      a.provenance.recommendationText || null,
      t,
    );
    const outcome = outcomeFrom(progress, t, input.pack.id);
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
      stageLabel: stageLabelFor(stage, t),
      stageMeaning: stageMeaningFor(stage, t),
      // The pile and the date it was counted on — never a check-in label,
      // which names a different pile.
      problem: t.plural('insight.action.problem', a.baseline.total, {
        count: a.baseline.count,
        total: a.baseline.total,
        date: formatDate(a.baseline.capturedAt),
        share: shareText(a.baseline.count, a.baseline.total),
      }),
      problemCount: a.baseline.count,
      problemTotal: a.baseline.total,
      problemShare: shareText(a.baseline.count, a.baseline.total),
      problemBy: formatDate(a.baseline.capturedAt),
      suggestedAt: a.createdAt,
      suggested: frozen ?? t('insight.action.noSuggestion'),
      hasSuggestion: frozen !== null,
      decision: a.description.trim(),
      decidedAt: a.decidedAt,
      decisionNote: a.statusNote.trim(),
      doneAt: a.doneAt,
      measuredAt: a.measuredAt,
      steps: [
        { label: stageLabelFor('SUGGESTED', t), done: true },
        {
          label: stageLabelFor(stage === 'NOT_DOING' ? 'NOT_DOING' : 'AGREED', t),
          done: a.decidedAt !== null,
        },
        { label: stageLabelFor('DONE', t), done: a.doneAt !== null && stage !== 'NOT_DOING' },
        // One stage word, "Checked"; "compared" stays as the verb inside the
        // stage meaning, never as a competing name for the same step.
        { label: stageLabelFor('CHECKED', t), done: measuredNow },
      ],
      outcome,
      learning: a.learningNote.trim() || null,
      nextStep: nextStepFor({
        kind: a.provenance.themeSentiment,
        bucket: 'FIRST',
        easing: false,
        suggestion: frozenSuggestion(
          input.pack,
          a.provenance.themeKey,
          a.provenance.recommendationText || null,
          t,
        ),
        progress,
        returning,
        t,
      }),
      memory:
        m && m.before.share !== null && m.after.share !== null
          ? {
              then: formatShare(m.before.share),
              change: a.description.trim() || t('insight.memory.change'),
              now: formatShare(m.after.share),
              result:
                m.result === 'IMPROVED'
                  ? t('insight.memory.less')
                  : m.result === 'WORSENED'
                    ? t('insight.memory.more')
                    : m.result === 'NO_CLEAR_CHANGE'
                      ? t('insight.memory.noChange')
                      : t('insight.memory.notEnough'),
            }
          : null,
      // Only check-ins recorded after the change count as "since". Earlier
      // ones are not evidence about it, and are not shown as if they were.
      sinceThen:
        insightNow && insightNow.movement.available && insightNow.movement.pointNote && windowAfter(a.doneAt)
          ? t('insight.sinceThen', { note: insightNow.movement.pointNote })
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
    if (s.returning) return t('insight.state.returning');
    if (s.actionState === 'IN_PROGRESS') return t('insight.state.inProgress');
    if (s.outcome?.result === 'IMPROVED') return t('insight.state.improvedAfter');
    if (s.outcome?.result === 'WORSENED') return t('insight.state.worsenedAfter');
    if (s.movementDirection === null) {
      return intel.window.available
        ? t('insight.state.tooFew')
        : t('insight.state.oneCheckin');
    }
    // Mention counts, in the portal's three words: more often, less often,
    // about the same. The verb says which side of the ledger it is.
    if (s.kind === 'ISSUE') {
      if (s.movementDirection === 'IMPROVING') return t('insight.state.raisedLess');
      if (s.movementDirection === 'WORSENING') return t('insight.state.raisedMore');
      return t('insight.state.same');
    }
    if (s.movementDirection === 'IMPROVING') return t('insight.state.praisedMore');
    if (s.movementDirection === 'WORSENING') return t('insight.state.praisedLess');
    return t('insight.state.same');
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
        state: t('insight.state.notChecked'),
        tone: 'neutral',
        next: t('insight.watching.awaiting', {
          have: a.awaiting.have,
          need: a.awaiting.need,
        }),
      });
    }
  }
  if (early.length > 0) {
    watching.push({
      themeKey: null,
      label: joinNames(
        early.map((s) => s.themeLabel),
        t,
      ),
      state: t('insight.state.waitingFeedback'),
      tone: 'neutral',
      next:
        early.length === 1 && early[0]
          ? early[0].watchLine
          : t('insight.watching.early'),
    });
  }

  // The quiet-topics count is already in "not worth your time"; the engine's
  // limit line would say it a second time on the same page.
  const limits =
    quiet > 0
      ? intel.limits.filter((_, i) => intel.limitKinds[i] !== 'quiet')
      : intel.limits;

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
          ? (t.soft(`pack.${input.pack.id}.${i.questionKey}.ask`) ??
             entryFor(input.pack, 'ISSUE', i.questionKey)?.askOwner?.question ??
             null)
          : null,
        t,
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
          ? t('insight.basis.reading')
          : t('insight.basis.none')
        : intel.evidence.unread > 0
          ? `${t.plural('insight.basis.on', intel.evidence.analysed)} ${t.plural('insight.basis.more', intel.evidence.unread)}`
          : t.plural('insight.basis.on', intel.evidence.analysed),
    facts,
    soFar,
    work,
    workKinds,

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
        ? t.plural('insight.changed.comparing', intel.window.previousFeedbackCount ?? 0, {
            first: formatDate(intel.window.previousCapturedAt),
            second: formatDate(intel.window.currentCapturedAt),
            current: intel.window.currentFeedbackCount ?? 0,
          })
        : intel.window.note
      : t('insight.changed.needTwo'),
    steady,
    notComparable,

    watching: watching.slice(0, 6),
    question: first?.question ?? null,
    knows,

    actions,
    actionsNote: actions.length === 0 ? t('insight.actions.none') : '',
    suggestedNow: first && first.actionState === 'NONE' ? first : null,

    limits,
    basedOn: intel.evidence.analysed,
    version: PORTAL_VERSION,
  };
}
