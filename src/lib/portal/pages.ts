import type { ClientIntelligence } from '@/lib/intelligence/engine';
import type { FeedbackRow, FeedbackStats } from '@/lib/feedback/service';
import { MIN_MENTIONS_TO_NAME } from '@/lib/intelligence/engine';
import type { AnalysisCoverage, ThemeSummary } from '@/lib/feedback/analysis';
import type { AnalysisState } from '@/lib/feedback/state';
import type { SnapshotListRow } from '@/lib/snapshots/service';
import { formatDate } from '@/lib/format';
import type { Pack } from '@/lib/packs';
import {
  buildPortalView,
  spoken,
  type PortalAction,
  type PortalInput,
  type PortalSignal,
  type PortalSoFar,
  type PortalWatch,
} from './view';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * THE OTHER PAGES OF THE CLIENT WORKSPACE (M12).
 *
 * Five pages, five jobs, and a rule: a conclusion lives on the page whose job
 * it serves, and appears elsewhere only when it does a different job there.
 *
 *   Home          what should I know?      the picture, the priorities, the watch list
 *   Customers     why?                     every theme read in full, with its evidence
 *   Improvements  what did we do?          the loop, end to end, with memory
 *   Reviews       what is the evidence?    the customer words behind every claim
 *   Check-in      what changed?            movement only, since the last check-in
 *
 * Each builder below is pure and reuses the one view model. Nothing here
 * computes intelligence.
 */

/**
 * A list of pack labels, as a sentence would say it.
 *
 * The labels themselves are data and are never touched. Only the word that
 * joins the last two is language — "and", "और", "आणि" — and it comes from the
 * dictionary, so the list reads as a list in whichever language the sentence
 * around it is written in.
 */
function joinNames(names: string[], t: PortalTranslator): string {
  if (names.length <= 1) return names[0] ?? '';
  return t('evidence.list.pair', {
    rest: names.slice(0, -1).join(', '),
    last: names[names.length - 1] ?? '',
  });
}

// ===========================================================================
// CUSTOMERS — why is RepOS saying this?
// ===========================================================================

export type AnalysisView = {
  businessName: string;
  basis: string;
  /**
   * The reading itself, stated plainly: how much was read, what it was grouped
   * into, which check-ins were compared (M17).
   *
   * This is the page that answers "why is RepOS saying this", so the method
   * belongs here — not repeated on every page as a conclusion would be.
   */
  work: string[];
  /** The executive interpretation, two or three sentences. */
  telling: string[];
  loved: PortalSignal[];
  unhappy: PortalSignal[];
  better: PortalSignal[];
  worse: PortalSignal[];
  steady: PortalSignal[];
  /** The one-line answer when the two check-ins were compared and nothing moved. */
  steadyLine: string | null;
  changedNote: string;
  /** Complaints that were a pattern at more than one check-in. */
  recurring: PortalSignal[];
  /** Complaints that reached a pattern at the latest check-in for the first time. */
  fresh: PortalSignal[];
  /** Why recurrence cannot be judged yet, when it cannot. */
  recurrenceNote: string | null;
  early: PortalSignal[];
  quietNote: string | null;
  noAction: string;
  /** Current signals: what is being said so far, pattern or not. */
  soFar: PortalSoFar;
  limits: string[];
};

export function buildAnalysisView(input: PortalInput): AnalysisView {
  const v = buildPortalView(input);
  const intel = input.intelligence;
  // Handed in on the input, never looked up. No translator means English,
  // which is the operator console's deliberate answer, not an oversight.
  const t = input.t ?? EN;

  const telling: string[] = [];
  if (v.keep) {
    const others = v.loved
      .filter((s) => s.themeKey !== v.keep?.themeKey && s.bucket !== 'EARLY')
      .map((s) => spoken(s.themeLabel));
    const othersLine = others.length
      ? ` ${t('evidence.telling.others', { things: joinNames(others, t) })}`
      : '';
    // The disagreement was glued on with ", though ...". It is its own fact,
    // so it gets its own short sentence.
    const opposite = v.keep.counterpart
      ? ` ${t.plural('evidence.telling.opposite', v.keep.counterpart.count)}`
      : '';
    telling.push(
      `${
        v.keep.isRecurring
          ? t('evidence.telling.keep.recurring', { theme: spoken(v.keep.themeLabel) })
          : t('evidence.telling.keep.top', { theme: spoken(v.keep.themeLabel) })
      }${opposite}${othersLine}`,
    );
  } else if (v.loved.length > 0) {
    telling.push(
      t.plural('evidence.telling.early', v.loved.length, {
        things: joinNames(
          v.loved.map((s) => spoken(s.themeLabel)),
          t,
        ),
      }),
    );
  }
  // The count and the other complaints live on the cards directly beneath;
  // saying them here as well made the page open by repeating itself.
  if (v.first) {
    telling.push(t('evidence.telling.first', { theme: spoken(v.first.themeLabel) }));
  } else if (intel.evidence.analysed > 0) {
    telling.push(t('evidence.telling.noWeakness'));
  }

  const readable = input.snapshots.length;
  const recurrenceNote =
    readable < 2
      ? readable === 0
        ? t('evidence.recurrence.noCheckin')
        : t('evidence.recurrence.oneCheckin')
      : null;

  const better = v.changed.filter((s) => s.movementDirection === 'IMPROVING');
  const worse = v.changed.filter((s) => s.movementDirection === 'WORSENING');
  const steadyLine =
    intel.window.available && better.length + worse.length === 0
      ? v.steady.length > 0
        ? t('evidence.steady.with', {
            things: joinNames(
              v.steady.map((s) => `${spoken(s.themeLabel)} (${s.movementCounts ?? 'steady'})`),
              t,
            ),
          })
        : t('evidence.steady.none')
      : null;

  return {
    businessName: intel.businessName,
    basis: v.basis,
    work: v.work,
    telling,
    loved: v.loved,
    unhappy: v.unhappy,
    better,
    worse,
    steady: v.steady,
    steadyLine,
    changedNote: v.changedNote,
    // Both about complaints: a strength praised at every check-in says so on
    // its own fact line, and "new" praise is not something to act on.
    recurring: v.unhappy.filter((s) => s.isRecurring),
    fresh: v.unhappy.filter((s) => s.isNew),
    recurrenceNote,
    early: v.early,
    quietNote: v.quietNote,
    noAction: v.noAction,
    soFar: v.soFar,
    limits: v.limits,
  };
}

// ===========================================================================
// IMPROVEMENTS — what did we do, and did it help?
// ===========================================================================

export type ImprovementsView = {
  businessName: string;
  /** "1 change compared · mentioned less often after it" */
  record: string;
  /** The leading complaint nobody has decided on yet. */
  suggested: PortalSignal | null;
  open: PortalAction[];
  checked: PortalAction[];
  notPursued: PortalAction[];
  /** Anything that improved after a change and is now coming back. */
  returning: PortalAction[];
};

export function buildImprovementsView(input: PortalInput): ImprovementsView {
  const v = buildPortalView(input);
  const t = input.t ?? EN;
  const checked = v.actions.filter((a) => a.stage === 'CHECKED');
  const notPursued = v.actions.filter((a) => a.stage === 'NOT_DOING');
  const open = v.actions.filter((a) => a.stage !== 'CHECKED' && a.stage !== 'NOT_DOING');
  const compared = v.actions.filter((a) => a.outcome).length;
  const improved = v.actions.filter((a) => a.outcome?.good).length;
  const worse = v.actions.filter((a) => a.outcome?.result === 'WORSENED').length;

  const bits = [t.plural('evidence.record.compared', compared)];
  if (improved > 0) {
    bits.push(
      compared === 1
        ? t('evidence.record.better.single')
        : t('evidence.record.better.many', { count: improved }),
    );
  }
  if (worse > 0) {
    bits.push(
      compared === 1
        ? t('evidence.record.worse.single')
        : t('evidence.record.worse.many', { count: worse }),
    );
  }

  return {
    businessName: v.businessName,
    record:
      compared === 0
        ? v.actions.length === 0
          ? t('evidence.record.noChange')
          : t('evidence.record.noComparison')
        : bits.join(' · '),
    suggested: v.suggestedNow,
    open,
    checked,
    notPursued,
    returning: v.actions.filter((a) => a.returning),
  };
}

// ===========================================================================
// REVIEWS — what is the evidence?
// ===========================================================================

export type ReviewFilters = {
  q: string;
  stars: number | null;
  sentiment: string | null;
  theme: string | null;
  source: string | null;
  /** 'reply' narrows to items RepOS thinks need the owner's answer. */
  needs: string | null;
};

export type ReviewItem = {
  id: string;
  text: string;
  stars: number | null;
  at: Date | null;
  sourceLabel: string;
  /**
   * Exactly what the customer tapped, as the pack words it today (M19), kept
   * apart from everything RepOS derived so the two can never be confused on
   * screen. Empty for a pasted review and for anything stored before M19.
   */
  gave: {
    dimensions: Array<{ label: string; rating: number }>;
    selected: string[];
  };
  /**
   * Where this stands with RepOS. Without it, "no theme" and "not looked at
   * yet" would render the same, and only one of them is true — and "being read
   * now" and "could not be read" are different news again.
   */
  state: AnalysisState;
  sentiment: string;
  sentimentLabel: string;
  /** Null when the reply engine has not sorted it. */
  classLabel: string | null;
  themes: string[];
  /**
   * SUGGESTED: needs an answer and a draft is ready · YOURS: needs the owner
   * personally · DRAFT: a draft exists but it is optional · ANSWERED: done.
   */
  replyState: 'SUGGESTED' | 'YOURS' | 'DRAFT' | 'ANSWERED' | null;
  suggestedReply: string | null;
};

export type ReviewsView = {
  businessName: string;
  total: number;
  analysed: number;
  /** Collected, not yet read: the next run reads these. */
  waiting: number;
  /** Being read by a run that is going now. */
  processing: number;
  /** The last reading failed; the next run tries again. */
  failed: number;
  withRating: number;
  averageRating: number | null;
  ratings: Array<{ stars: number; count: number }>;
  sentiments: Array<{ key: string; label: string; count: number }>;
  /** What RepOS found in this pile, so reading it is optional. */
  found: string[];
  /** The conclusions, as filters: one tap to the words behind each. */
  quick: Array<{ label: string; query: string }>;
  /**
   * The pile, as the transformation Headway made of it (M24): everything
   * read, the signals that recur, the mentions that stand alone, and the one
   * that needs attention. Each step is a count of the same rows.
   */
  funnel: {
    read: number;
    /** Themes raised by enough customers to be a pattern. */
    signals: number;
    /** Themes mentioned once or twice. */
    isolated: number;
    attention: { key: string; label: string; count: number } | null;
  };
  /** Every recurring signal as a one-tap filter, biggest first. */
  signals: Array<{ key: string; label: string; kind: 'PRAISE' | 'ISSUE'; count: number; active: boolean }>;
  replyWorth: number;
  themeOptions: Array<{ key: string; label: string; kind: 'PRAISE' | 'ISSUE' }>;
  sourceOptions: Array<{ key: string; label: string }>;
  filters: ReviewFilters;
  filterSummary: string | null;
  items: ReviewItem[];
  shown: number;
  /**
   * How many comments match these filters in total, and whether the owner is
   * seeing all of them (M18).
   *
   * The page used to ship every matching comment up to a hard 300 — three
   * quarters of a megabyte on a phone, most of it evidence nobody scrolled to.
   * It now sends a page at a time and says honestly how many there are.
   */
  matching: number;
  hasMore: boolean;
  /** The `page` value that shows the next batch as well as these. */
  nextPage: number;
};

function worthReply(row: FeedbackRow): boolean {
  // Something RepOS has filed as needing no response — private feedback with
  // nobody to reply to (M14) — is never "worth a reply", whatever it ranks.
  if (row.responseAction === 'NO_RESPONSE_NEEDED') return false;
  return !row.handledAt && (row.priorityBand === 'HIGH' || row.responseAction === 'NEEDS_HUMAN');
}

function replyStateOf(row: FeedbackRow): ReviewItem['replyState'] {
  if (row.handledAt || row.draftStatus === 'HANDLED') return 'ANSWERED';
  if (row.responseAction === 'NEEDS_HUMAN') return 'YOURS';
  const drafted =
    (row.draftStatus === 'READY' || row.draftStatus === 'EDITED') && row.draftCurrent && !!row.draftText;
  if (!drafted) return null;
  return worthReply(row) ? 'SUGGESTED' : 'DRAFT';
}

/**
 * How a row was read, in the owner's language.
 *
 * The four tones borrow the keys the filter chips already use, so a chip and
 * the row beneath it cannot drift apart; only "not read yet" is new. The
 * stored value itself (POSITIVE, NEGATIVE) is data and never appears.
 */
const TONE_KEYS = {
  POSITIVE: 'feedback.tone.positive',
  NEGATIVE: 'feedback.tone.negative',
  MIXED: 'feedback.tone.mixed',
  NEUTRAL: 'feedback.tone.neutral',
  UNKNOWN: 'evidence.tone.unread',
} as const;

/** What the reply engine sorted a comment into. UNCLASSIFIED shows nothing. */
const CLASS_KEYS = {
  PRAISE: 'evidence.class.praise',
  COMPLAINT: 'evidence.class.complaint',
  MIXED: 'evidence.class.mixed',
  QUESTION: 'evidence.class.question',
  NEUTRAL: 'evidence.class.neutral',
} as const;

function sentimentLabelOf(key: string, t: PortalTranslator): string {
  return t(TONE_KEYS[key as keyof typeof TONE_KEYS] ?? 'evidence.tone.unread');
}

export function buildReviewsView(input: {
  businessName: string;
  pack: Pack;
  stats: FeedbackStats;
  coverage: AnalysisCoverage;
  /** Already filtered and paged by the query (M18). */
  rows: FeedbackRow[];
  /** How many rows those filters match in total. */
  matching: number;
  /** True when more rows exist beyond the ones passed in. */
  hasMore: boolean;
  nextPage: number;
  filters: ReviewFilters;
  intelligence: ClientIntelligence | null;
  /** The theme counts behind the intelligence, for the funnel. Optional for older callers. */
  themes?: ThemeSummary | null;
  replyWorth: number;
  /** The owner's language. Omitted means English — see PortalTranslator. */
  t?: PortalTranslator;
}): ReviewsView {
  const rows = input.rows;
  // Handed in on the input, never looked up. No translator means English,
  // which is the operator console's deliberate answer, not an oversight.
  const t = input.t ?? EN;

  const themeLabel = (key: string) =>
    input.pack.praiseTaxonomy.find((t) => t.key === key)?.label ??
    input.pack.issueTaxonomy.find((t) => t.key === key)?.label ??
    null;

  const parts: string[] = [];
  if (input.filters.theme) {
    const l = themeLabel(input.filters.theme);
    if (l) parts.push(t('evidence.filter.theme', { theme: spoken(l) }));
  }
  if (input.filters.stars) {
    parts.push(t.plural('evidence.filter.stars', input.filters.stars));
  }
  if (input.filters.sentiment) {
    parts.push(sentimentLabelOf(input.filters.sentiment, t).toLowerCase());
  }
  if (input.filters.needs === 'reply') parts.push(t('evidence.filter.needsReply'));
  // The owner's own search words are a value, quoted and passed through
  // exactly as typed. Nothing a person typed is ever reworded.
  if (input.filters.q.trim()) {
    parts.push(t('evidence.filter.mentioning', { query: input.filters.q.trim() }));
  }

  const ratings = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: input.stats.ratingCounts[String(stars)] ?? 0,
  }));
  const sentiments = (['POSITIVE', 'MIXED', 'NEUTRAL', 'NEGATIVE'] as const).map((key) => ({
    key,
    label: t(TONE_KEYS[key]),
    count: input.coverage.sentimentCounts[key] ?? 0,
  }));

  // ---- What RepOS found, so the list below is optional reading ------------
  // Every count names its pile: the whole read set, or one theme. A theme
  // filter must never look like the owner of the page-wide totals.
  const intel = input.intelligence;
  const found: string[] = [];
  const quick: ReviewsView['quick'] = [];
  const analysed = input.coverage.analysed;
  const positive = sentiments.find((s) => s.key === 'POSITIVE')?.count ?? 0;
  const negative = sentiments.find((s) => s.key === 'NEGATIVE')?.count ?? 0;
  const mixed = sentiments.find((s) => s.key === 'MIXED')?.count ?? 0;
  const neutral = sentiments.find((s) => s.key === 'NEUTRAL')?.count ?? 0;
  // Counts are feedback entries, not people: one customer may leave several.
  const entries = t.plural('evidence.pieces', analysed);
  if (intel && intel.evidence.analysed > 0) {
    found.push(
      t('evidence.found.read', { entries, positive, mixed, neutral, negative }),
    );
    const topPraise = [...intel.loved]
      .sort((a, b) => b.evidence.count - a.evidence.count)
      .slice(0, 2)
      .map((i) => spoken(i.themeLabel));
    if (topPraise.length) {
      found.push(
        topPraise.length === 2
          ? // A pack label can itself contain "and" ("doctor's care and
            // explanation"), so the two are kept apart with a colon and a
            // comma rather than run together on a bare "and".
            t('evidence.found.praiseTwo', {
              first: topPraise[0] ?? '',
              second: topPraise[1] ?? '',
            })
          : t('evidence.found.praiseOne', { first: topPraise[0] ?? '' }),
      );
    }
    if (intel.attention) {
      found.push(
        t('evidence.found.attention', {
          theme: spoken(intel.attention.themeLabel),
          count: intel.attention.evidence.count,
          outOf: intel.attention.evidence.outOf,
        }),
      );
      quick.push({
        // The pack's own label, exactly as the pack words it.
        label: t('evidence.quick.theme', {
          theme: intel.attention.themeLabel,
          count: intel.attention.evidence.count,
        }),
        query: `theme=${encodeURIComponent(intel.attention.themeKey)}`,
      });
    } else {
      found.push(t('evidence.found.noPattern', { min: MIN_MENTIONS_TO_NAME }));
    }
    if (input.replyWorth > 0) {
      found.push(t.plural('evidence.found.reply', input.replyWorth, { entries }));
    }
  }
  // ---- The funnel and the signals ----------------------------------------
  const allThemes = [...(input.themes?.issues ?? []), ...(input.themes?.praises ?? [])];
  const patterns = allThemes.filter((t) => t.count >= MIN_MENTIONS_TO_NAME);
  const isolated = allThemes.filter((t) => t.count > 0 && t.count < MIN_MENTIONS_TO_NAME);
  const funnel: ReviewsView['funnel'] = {
    read: analysed,
    signals: input.themes ? patterns.length : intel ? intel.loved.length + intel.unhappy.length : 0,
    isolated: isolated.length,
    attention: intel?.attention
      ? { key: intel.attention.themeKey, label: intel.attention.themeLabel, count: intel.attention.evidence.count }
      : null,
  };
  const signals: ReviewsView['signals'] = [...patterns]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8)
    .map((t) => ({
      key: t.key,
      label: t.label,
      kind: t.kind,
      count: t.count,
      active: input.filters.theme === t.key,
    }));

  if (positive > 0) {
    quick.push({ label: t('evidence.quick.positive', { count: positive }), query: 'sentiment=POSITIVE' });
  }
  if (negative > 0) {
    quick.push({ label: t('evidence.quick.negative', { count: negative }), query: 'sentiment=NEGATIVE' });
  }
  if (input.replyWorth > 0) {
    quick.push({
      label: t('evidence.quick.needsReply', { count: input.replyWorth, total: analysed }),
      query: 'needs=reply',
    });
  }

  return {
    businessName: input.businessName,
    total: input.stats.total,
    analysed: input.stats.analysed,
    waiting: input.stats.waiting,
    processing: input.stats.processing,
    failed: input.stats.failed,
    withRating: input.stats.withRating,
    averageRating: input.stats.averageRating,
    ratings,
    sentiments,
    found,
    quick,
    funnel,
    signals,
    replyWorth: input.replyWorth,
    themeOptions: [
      ...input.pack.issueTaxonomy.map((t) => ({ key: t.key, label: t.label, kind: 'ISSUE' as const })),
      ...input.pack.praiseTaxonomy.map((t) => ({ key: t.key, label: t.label, kind: 'PRAISE' as const })),
    ],
    sourceOptions: input.stats.sourceCounts.map((s) => ({ key: s.source, label: s.label })),
    filters: input.filters,
    filterSummary: parts.length ? parts.join(', ') : null,
    items: rows.map((row) => {
      const state = replyStateOf(row);
      const classKey = CLASS_KEYS[row.responseClass as keyof typeof CLASS_KEYS];
      return {
        id: row.id,
        text: row.text,
        stars: row.stars,
        at: row.reviewDate,
        sourceLabel: row.sourceLabel,
        state: row.state,
        gave: {
          dimensions: row.answers.map((a) => ({ label: a.label, rating: a.rating })),
          selected: row.answers.flatMap((a) => a.signals),
        },
        sentiment: row.sentiment,
        sentimentLabel: sentimentLabelOf(row.sentiment, t),
        classLabel:
          row.responseClass === 'UNCLASSIFIED' || !classKey ? null : t(classKey),
        themes: row.themes.map((t) => t.label),
        replyState: state,
        suggestedReply: state === 'SUGGESTED' || state === 'DRAFT' ? row.draftText : null,
      };
    }),
    shown: rows.length,
    matching: input.matching,
    hasMore: input.hasMore,
    nextPage: input.nextPage,
  };
}

// ===========================================================================
// CHECK-IN — what changed since last time?
// ===========================================================================

export type CheckinView = {
  businessName: string;
  /** "Your March check-in" */
  title: string;
  periodNote: string;
  /**
   * Whether two check-ins were actually compared.
   *
   * The page used to work this out by testing `movementLine` for the English
   * it happened to start with. Words are for reading; this flag is for
   * matching, and it survives every rewording.
   */
  compared: boolean;
  /** The movement in one line. Not the picture — Home has that. */
  movementLine: string;
  better: PortalSignal[];
  worse: PortalSignal[];
  returning: PortalSignal[];
  /** Changes compared against feedback between the two check-ins. */
  checked: PortalAction[];
  /** Changes compared after the latest check-in was recorded. */
  sinceCheckin: PortalAction[];
  /** Changes made and still waiting for enough feedback. */
  made: PortalAction[];
  unchangedNote: string;
  /** What RepOS will look at next, for the themes that moved. */
  next: PortalWatch[];
  limits: string[];
};

/**
 * The month a check-in is named after.
 *
 * A word in a title, not a date: the dates themselves go through `formatDate`
 * and are printed exactly as it prints them, in every language.
 */
const MONTH_KEYS = [
  'evidence.month.1', 'evidence.month.2', 'evidence.month.3', 'evidence.month.4',
  'evidence.month.5', 'evidence.month.6', 'evidence.month.7', 'evidence.month.8',
  'evidence.month.9', 'evidence.month.10', 'evidence.month.11', 'evidence.month.12',
] as const;

export function buildCheckinView(
  input: PortalInput & { checkins: SnapshotListRow[] },
): CheckinView {
  const v = buildPortalView(input);
  const intel = input.intelligence;
  // Handed in on the input, never looked up. No translator means English,
  // which is the operator console's deliberate answer, not an oversight.
  const t = input.t ?? EN;
  const latest = input.checkins[0] ?? null;
  const previous = input.checkins[1] ?? null;
  const month = latest ? MONTH_KEYS[latest.capturedAt.getMonth()] : null;
  const on = (s: SnapshotListRow) => formatDate(s.capturedAt);

  const better = v.changed.filter((s) => s.movementDirection === 'IMPROVING');
  const worse = v.changed.filter((s) => s.movementDirection === 'WORSENING');
  const returning = [...v.unhappy].filter((s) => s.returning);
  const since = intel.window.previousCapturedAt?.getTime() ?? null;
  const until = intel.window.currentCapturedAt?.getTime() ?? latest?.capturedAt.getTime() ?? null;
  const inWindow = (at: Date | null) =>
    at !== null && (since === null || at.getTime() >= since) && (until === null || at.getTime() <= until);
  const checked = v.actions.filter((a) => a.outcome && inWindow(a.measuredAt));
  const sinceCheckin = v.actions.filter(
    (a) => a.outcome && !inWindow(a.measuredAt) && until !== null && a.measuredAt !== null && a.measuredAt.getTime() > until,
  );
  const made = v.actions.filter((a) => a.awaiting !== null);

  const bits: string[] = [];
  if (better.length) bits.push(t.plural('evidence.checkin.better', better.length));
  if (worse.length) bits.push(t.plural('evidence.checkin.worse', worse.length));
  if (checked.length) bits.push(t.plural('evidence.checkin.compared', checked.length));
  const prevDate = intel.window.previousCapturedAt
    ? formatDate(intel.window.previousCapturedAt)
    : previous
      ? on(previous)
      : null;
  const movementLine = !intel.window.available
    ? v.changedNote
    : bits.length
      ? t('evidence.checkin.since', { date: String(prevDate), bits: bits.join(', ') })
      : t('evidence.checkin.nothing', { date: String(prevDate) });

  const moved = better.length + worse.length > 0;
  // The honest limit on the comparison: what could NOT be compared, and why.
  // The qualifier is the sentence, so it travels whole into every language.
  const comparedNote =
    v.notComparable.length > 0
      ? ` ${t.plural('evidence.checkin.notCompared', v.notComparable.length)}`
      : '';
  const unchangedNote = !intel.window.available
    ? ''
    : !moved
      ? comparedNote.trim()
      : v.steady.length > 0
        ? `${t('evidence.checkin.steadyIncludes', {
            things: joinNames(
              v.steady.slice(0, 3).map((s) => spoken(s.themeLabel)),
              t,
            ),
          })}${comparedNote}`
        : `${t('evidence.checkin.steady')}${comparedNote}`;

  const movedKeys = new Set([...better, ...worse, ...returning].map((s) => s.themeKey));
  const next = v.watching.filter((w) => w.themeKey !== null && movedKeys.has(w.themeKey));

  return {
    businessName: v.businessName,
    title: month
      ? t('evidence.checkin.title', { month: t(month) })
      : t('evidence.checkin.noneTitle'),
    periodNote: latest
      ? previous
        ? t('evidence.period.compares', { latest: on(latest), previous: on(previous) })
        : t('evidence.period.single', { latest: on(latest) })
      : t('evidence.period.all'),
    compared: intel.window.available,
    movementLine,
    better,
    worse,
    returning,
    checked,
    sinceCheckin,
    made,
    unchangedNote,
    next,
    limits: v.limits,
  };
}
