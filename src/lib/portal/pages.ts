import type { ClientIntelligence } from '@/lib/intelligence/engine';
import type { FeedbackRow, FeedbackStats } from '@/lib/feedback/service';
import type { AnalysisCoverage } from '@/lib/feedback/analysis';
import type { SnapshotListRow } from '@/lib/snapshots/service';
import { SENTIMENT_LABELS } from '@/lib/analysis/normalize';
import { formatDate } from '@/lib/format';
import { RESPONSE_CLASS_LABELS } from '@/lib/reply/triage';
import type { Pack } from '@/lib/packs';
import {
  buildPortalView,
  pieces,
  spoken,
  type PortalAction,
  type PortalInput,
  type PortalSignal,
  type PortalWatch,
} from './view';

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

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
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
  limits: string[];
};

export function buildAnalysisView(input: PortalInput): AnalysisView {
  const v = buildPortalView(input);
  const intel = input.intelligence;

  const telling: string[] = [];
  if (v.keep) {
    const others = v.loved
      .filter((s) => s.themeKey !== v.keep?.themeKey && s.bucket !== 'EARLY')
      .map((s) => spoken(s.themeLabel));
    const othersLine = others.length
      ? ` ${joinNames(others).replace(/^./, (c) => c.toUpperCase())} ${others.length === 1 ? 'is' : 'are'} praised often too.`
      : '';
    telling.push(
      `${v.keep.isRecurring ? 'Customers most consistently value' : 'Customers praise'} your ${spoken(v.keep.themeLabel)}${
        v.keep.isRecurring ? '' : ' most'
      }${v.keep.counterpart ? `, though ${v.keep.counterpart.count} said the opposite` : ''}.${othersLine}`,
    );
  } else if (v.loved.length > 0) {
    telling.push(
      `${joinNames(v.loved.map((s) => s.themeLabel))} ${v.loved.length === 1 ? 'is' : 'are'} praised, but not yet often enough to call a strength.`,
    );
  }
  if (v.first) {
    telling.push(
      `${v.first.themeLabel} is where the experience falls short most often — ${v.first.evidenceCount} of the ${pieces(v.first.evidenceTotal)} we have read.`,
    );
  } else if (intel.evidence.analysed > 0) {
    telling.push('No complaint has come up often enough to call a weakness.');
  }
  const otherIssues = v.unhappy.filter((s) => s.bucket === 'WATCH').length;
  if (otherIssues > 0) {
    telling.push(
      `${otherIssues} other ${otherIssues === 1 ? 'complaint is' : 'complaints are'} worth watching; RepOS is not asking you to act on ${otherIssues === 1 ? 'it' : 'them'} yet.`,
    );
  }

  const readable = input.snapshots.length;
  const recurrenceNote =
    readable < 2
      ? readable === 0
        ? 'No check-in has been recorded yet, so RepOS cannot tell what keeps coming back.'
        : 'Only one check-in so far. From the next one, RepOS can tell you what keeps coming back and what is new.'
      : null;

  const better = v.changed.filter((s) => s.movementDirection === 'IMPROVING');
  const worse = v.changed.filter((s) => s.movementDirection === 'WORSENING');
  const steadyLine =
    intel.window.available && better.length + worse.length === 0
      ? v.steady.length > 0
        ? `Nothing moved by 2 or more mentions between these check-ins. ${joinNames(
            v.steady.map((s) => `${spoken(s.themeLabel)} (${s.movementCounts ?? 'steady'})`),
          ).replace(/^./, (c) => c.toUpperCase())} held steady.`
        : 'Nothing moved by 2 or more mentions between these check-ins.'
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
    limits: v.limits,
  };
}

// ===========================================================================
// IMPROVEMENTS — what did we do, and did it help?
// ===========================================================================

export type ImprovementsView = {
  businessName: string;
  /** "1 change compared · feedback improved after 1" */
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
  const checked = v.actions.filter((a) => a.stage === 'CHECKED');
  const notPursued = v.actions.filter((a) => a.stage === 'NOT_DOING');
  const open = v.actions.filter((a) => a.stage !== 'CHECKED' && a.stage !== 'NOT_DOING');
  const compared = v.actions.filter((a) => a.outcome).length;
  const improved = v.actions.filter((a) => a.outcome?.good).length;
  const worse = v.actions.filter((a) => a.outcome?.result === 'WORSENED').length;

  const bits = [`${compared} ${compared === 1 ? 'change' : 'changes'} compared`];
  if (improved > 0) bits.push(`mentioned less often after ${improved}`);
  if (worse > 0) bits.push(`more often after ${worse}`);

  return {
    businessName: v.businessName,
    record:
      compared === 0
        ? v.actions.length === 0
          ? 'No change has been agreed yet.'
          : 'No change has been compared against feedback yet.'
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
  withRating: number;
  averageRating: number | null;
  ratings: Array<{ stars: number; count: number }>;
  sentiments: Array<{ key: string; label: string; count: number }>;
  /** What RepOS found in this pile, so reading it is optional. */
  found: string[];
  /** The conclusions, as filters: one tap to the words behind each. */
  quick: Array<{ label: string; query: string }>;
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

function sentimentLabelOf(key: string): string {
  return SENTIMENT_LABELS[key as keyof typeof SENTIMENT_LABELS] ?? 'Not analysed';
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
  replyWorth: number;
}): ReviewsView {
  const rows = input.rows;

  const themeLabel = (key: string) =>
    input.pack.praiseTaxonomy.find((t) => t.key === key)?.label ??
    input.pack.issueTaxonomy.find((t) => t.key === key)?.label ??
    null;

  const parts: string[] = [];
  if (input.filters.theme) {
    const l = themeLabel(input.filters.theme);
    if (l) parts.push(`about ${spoken(l)}`);
  }
  if (input.filters.stars) {
    parts.push(`rated ${input.filters.stars} star${input.filters.stars === 1 ? '' : 's'}`);
  }
  if (input.filters.sentiment) parts.push(sentimentLabelOf(input.filters.sentiment).toLowerCase());
  if (input.filters.needs === 'reply') parts.push('that need your answer');
  if (input.filters.q.trim()) parts.push(`mentioning "${input.filters.q.trim()}"`);

  const ratings = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: input.stats.ratingCounts[String(stars)] ?? 0,
  }));
  const sentiments = (['POSITIVE', 'MIXED', 'NEUTRAL', 'NEGATIVE'] as const).map((key) => ({
    key,
    label: SENTIMENT_LABELS[key],
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
  if (intel && intel.evidence.analysed > 0) {
    found.push(
      `Across all ${pieces(analysed)} read: ${positive} positive, ${mixed} mixed, ${neutral} neutral, ${negative} negative.`,
    );
    const topPraise = [...intel.loved]
      .sort((a, b) => b.evidence.count - a.evidence.count)
      .slice(0, 2)
      .map((i) => spoken(i.themeLabel));
    if (topPraise.length) {
      found.push(
        topPraise.length === 2
          ? `The two things praised most are ${topPraise[0]} and ${topPraise[1]}.`
          : `The thing praised most is ${topPraise[0]}.`,
      );
    }
    if (intel.attention) {
      found.push(
        `The complaint that matters most is ${spoken(intel.attention.themeLabel)}. It appears in ${intel.attention.evidence.count} of the ${intel.attention.evidence.outOf} comments.`,
      );
      quick.push({
        label: `${intel.attention.themeLabel} (${intel.attention.evidence.count} comments)`,
        query: `theme=${encodeURIComponent(intel.attention.themeKey)}`,
      });
    } else {
      found.push('No complaint comes up often enough to name a pattern.');
    }
    if (input.replyWorth > 0) {
      found.push(
        `${input.replyWorth} of the ${analysed} ${input.replyWorth === 1 ? 'needs' : 'need'} an answer from you. A draft is attached where RepOS could write one safely; the rest need your own words.`,
      );
    }
  }
  if (positive > 0) quick.push({ label: `All positive (${positive})`, query: 'sentiment=POSITIVE' });
  if (negative > 0) quick.push({ label: `All negative (${negative})`, query: 'sentiment=NEGATIVE' });
  if (input.replyWorth > 0) {
    quick.push({ label: `Need your answer (${input.replyWorth} of ${analysed})`, query: 'needs=reply' });
  }

  return {
    businessName: input.businessName,
    total: input.stats.total,
    analysed: input.stats.analysed,
    withRating: input.stats.withRating,
    averageRating: input.stats.averageRating,
    ratings,
    sentiments,
    found,
    quick,
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
      return {
        id: row.id,
        text: row.text,
        stars: row.stars,
        at: row.reviewDate,
        sourceLabel: row.sourceLabel,
        sentiment: row.sentiment,
        sentimentLabel: sentimentLabelOf(row.sentiment),
        classLabel:
          row.responseClass === 'UNCLASSIFIED' ? null : (RESPONSE_CLASS_LABELS[row.responseClass] ?? null),
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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function buildCheckinView(
  input: PortalInput & { checkins: SnapshotListRow[] },
): CheckinView {
  const v = buildPortalView(input);
  const intel = input.intelligence;
  const latest = input.checkins[0] ?? null;
  const previous = input.checkins[1] ?? null;
  const month = latest ? MONTHS[latest.capturedAt.getMonth()] : null;
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
  if (better.length) bits.push(`${better.length} ${better.length === 1 ? 'thing' : 'things'} improved`);
  if (worse.length) bits.push(`${worse.length} ${worse.length === 1 ? 'thing' : 'things'} got worse`);
  if (checked.length) bits.push(`${checked.length} ${checked.length === 1 ? 'change was' : 'changes were'} compared`);
  const prevDate = intel.window.previousCapturedAt
    ? formatDate(intel.window.previousCapturedAt)
    : previous
      ? on(previous)
      : null;
  const movementLine = !intel.window.available
    ? v.changedNote
    : bits.length
      ? `Since your check-in on ${prevDate}: ${bits.join(', ')}.`
      : `Nothing moved enough to report since your check-in on ${prevDate}.`;

  const moved = better.length + worse.length > 0;
  const comparedNote =
    v.notComparable.length > 0
      ? ` ${v.notComparable.length} ${v.notComparable.length === 1 ? 'theme' : 'themes'} had too few mentions at one of the two check-ins to compare.`
      : '';
  const unchangedNote = !intel.window.available
    ? ''
    : !moved
      ? comparedNote.trim()
      : v.steady.length > 0
        ? `Everything else RepOS could compare held steady, including ${joinNames(v.steady.slice(0, 3).map((s) => spoken(s.themeLabel)))}.${comparedNote}`
        : `Everything else RepOS could compare held steady.${comparedNote}`;

  const movedKeys = new Set([...better, ...worse, ...returning].map((s) => s.themeKey));
  const next = v.watching.filter((w) => w.themeKey !== null && movedKeys.has(w.themeKey));

  return {
    businessName: v.businessName,
    title: month ? `Your ${month} check-in` : 'Your customer check-in',
    periodNote: latest
      ? previous
        ? `Compares your check-in on ${on(latest)} with the one on ${on(previous)}.`
        : `Prepared from your check-in on ${on(latest)}. A second check-in will let us show what changed.`
      : 'No check-in has been recorded yet, so this covers everything we have read so far.',
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
