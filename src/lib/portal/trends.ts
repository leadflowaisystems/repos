import { MIN_PERIOD_FEEDBACK_TO_COMPARE } from '@/lib/intelligence/engine';
import { MIN_FEEDBACK_TO_MEASURE } from '@/lib/improve/measure';
import { formatDate } from '@/lib/format';
import type { PortalInput, PortalSignal, PortalView } from './view';

/**
 * WHAT IS CHANGING IN MY BUSINESS? (trends pass)
 *
 * The Improvements door now opens on trends: what is getting worse, what is
 * getting better, what is holding steady. Nothing here is a new reading. The
 * engine already compares the last two check-ins for every named topic and
 * decides — with its own floors — whether the movement is worse for the
 * owner, better, a genuine steady, or too little to say. This module only
 * sorts those verdicts into three shelves and carries the numbers behind them.
 *
 *   WORSE    a complaint mentioned more, or praise mentioned less
 *   BETTER   a complaint mentioned less, or praise mentioned more
 *   STABLE   the engine read both check-ins and the count held
 *
 * A topic the engine could not read — too few mentions on both sides, or no
 * second check-in — is on no shelf. "Improving" is never a synonym for
 * "positive": praise that is simply common is not a trend.
 *
 * ORDER is the engine's: within a shelf, topics keep the order the view gave
 * them (complaints before praise, each already ranked), so the one that
 * matters most is first without this module deciding anything.
 *
 * NUMBERS are counts the check-ins recorded — mentions of the topic over the
 * feedback that check-in held — and the change between the two counts. The
 * percentage is only shown when there was something to change from.
 */

export type TrendRow = {
  key: string;
  label: string;
  kind: 'ISSUE' | 'PRAISE';
  /** Every mention of the topic Headway holds — the count Home and Feedback show. */
  mentions: number;
  /** Mentions at the earlier and the later check-in. */
  previous: number;
  current: number;
  /** How much feedback each check-in held, when it was recorded. */
  previousTotal: number | null;
  currentTotal: number | null;
  /**
   * The topic's share of each check-in's feedback, whole percent; null when
   * that check-in's total was not recorded. Replaced a "+100%" change in the
   * raw count (Sep 2026), which called 5 of 10 → 10 of 20 a doubling when it
   * is the same half of customers.
   */
  previousPct: number | null;
  currentPct: number | null;
  /** WHICH way the share moved — the phrase under the topic. */
  moved: 'UP' | 'DOWN' | 'SAME';
};

export type Trends = {
  /** False when there is no second check-in to compare with. */
  comparable: boolean;
  worse: TrendRow[];
  better: TrendRow[];
  stable: TrendRow[];
};

const pctOf = (count: number, total: number | null): number | null =>
  total !== null && total > 0 ? Math.round((count / total) * 100) : null;

function rowOf(signal: PortalSignal): TrendRow | null {
  const points = signal.movementPoints;
  if (!points || signal.movementDirection === null) return null;
  const previousPct = pctOf(points.previous, points.previousTotal);
  const currentPct = pctOf(points.current, points.currentTotal);
  // Which way the SHARE went. The engine only files a row under better or
  // worse when the share moved past its bar, so this agrees with the shelf.
  const shareDelta =
    points.previousTotal && points.currentTotal
      ? points.current / points.currentTotal - points.previous / points.previousTotal
      : points.current - points.previous;
  return {
    key: signal.themeKey,
    label: signal.themeLabel,
    kind: signal.kind,
    mentions: signal.evidenceCount,
    previous: points.previous,
    current: points.current,
    previousTotal: points.previousTotal,
    currentTotal: points.currentTotal,
    previousPct,
    currentPct,
    moved: signal.movementDirection === 'STABLE' ? 'SAME' : shareDelta > 0 ? 'UP' : 'DOWN',
  };
}

export function buildTrends(view: PortalView, comparable: boolean): Trends {
  const seen = new Set<string>();
  const signals = [...view.unhappy, ...view.loved, ...view.early].filter((s) =>
    seen.has(s.themeKey) ? false : (seen.add(s.themeKey), true),
  );
  const shelf = (direction: PortalSignal['movementDirection']) =>
    signals
      .filter((s) => s.movementDirection === direction)
      .map(rowOf)
      .filter((row): row is TrendRow => row !== null);
  return {
    comparable,
    // The engine's direction is already good-or-bad news for the owner:
    // WORSENING is a complaint that rose or praise that fell.
    worse: shelf('WORSENING'),
    better: shelf('IMPROVING'),
    stable: shelf('STABLE'),
  };
}

// ===========================================================================
// WHY THERE IS NO TREND YET — and what would make one
// ===========================================================================

/**
 * TREND READINESS (intelligence audit, Sep 2026).
 *
 * A trend is a comparison between two check-ins, and until both exist — each
 * holding enough feedback to compare — there is no trend to show. That was
 * always the rule. What the page said about it was one line, "Trends appear
 * after your second check-in", which left an owner with five read responses
 * looking at a blank page and no way to tell "not ready" from "not working".
 *
 * This is the same rule, explained: which of the conditions are already met,
 * the counts behind each, and what happens next. It decides nothing. The
 * verdict is `intelligence.window.available`, which the engine reached with
 * its own floors; this only reads the state that produced it.
 *
 *   NO_CHECKIN   no check-in has been recorded
 *   ONE_CHECKIN  one has; there is nothing to compare it with
 *   TOO_THIN     two exist, but one side holds too little feedback to compare
 *   READY        the engine compared them — the trend shelves say the rest
 *
 * CURRENT PATTERNS ARE NOT TRENDS, and the page keeps the two apart: what
 * customers are saying now is counted over everything read and needs no
 * check-in at all; which way it is moving needs two.
 *
 * Pure: no database, no clock. Every number is a count the input carries.
 */
export type TrendReadinessState = 'NO_CHECKIN' | 'ONE_CHECKIN' | 'TOO_THIN' | 'READY';

export type TrendReadiness = {
  state: TrendReadinessState;
  /** Responses Headway has read so far. */
  read: number;
  /** How many check-ins are on record. */
  checkins: number;
  /** The most recent check-in, and how many responses it holds. */
  latest: { label: string; held: number } | null;
  /** The one before it. */
  previous: { label: string; held: number } | null;
  /**
   * Responses that arrived after the latest check-in — or every response,
   * when there is no check-in yet. They belong to the next one.
   */
  since: number;
  /** The engine's floor: each side needs this many before topics are compared. */
  needPerSide: number;
  /** When a further check-in is worth recording: this many new responses. */
  worthAt: number;
  /** True once enough has arrived since the latest check-in for another. */
  nextIsDue: boolean;
};

export function buildTrendReadiness(input: PortalInput): TrendReadiness {
  const intel = input.intelligence;
  const ordered = [...input.snapshots].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  const side = (s: (typeof ordered)[number] | undefined) =>
    s ? { label: s.label ?? formatDate(s.capturedAt), held: s.feedback.length } : null;
  const latest = side(ordered[0]);
  const previous = side(ordered[1]);

  // A response belongs to at most one check-in, so whatever no check-in holds
  // arrived after the latest one and is waiting for the next.
  const held = ordered.reduce((n, s) => n + s.feedback.length, 0);
  const since = Math.max(0, intel.evidence.total - held);

  const state: TrendReadinessState = intel.window.available
    ? 'READY'
    : ordered.length === 0
      ? 'NO_CHECKIN'
      : ordered.length === 1
        ? 'ONE_CHECKIN'
        : 'TOO_THIN';

  return {
    state,
    read: intel.evidence.analysed,
    checkins: ordered.length,
    latest,
    previous,
    since,
    needPerSide: MIN_PERIOD_FEEDBACK_TO_COMPARE,
    worthAt: MIN_FEEDBACK_TO_MEASURE,
    nextIsDue: since >= MIN_FEEDBACK_TO_MEASURE,
  };
}
