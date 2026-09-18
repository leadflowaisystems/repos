import type { PortalSignal, PortalView } from './view';

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
  /** Mentions at the earlier and the later check-in. */
  previous: number;
  current: number;
  /** How much feedback each check-in held, when it was recorded. */
  previousTotal: number | null;
  currentTotal: number | null;
  /** Change between the two counts, whole percent; null when there was nothing before. */
  changePct: number | null;
  /** WHICH way the count moved — the phrase under the topic. */
  moved: 'UP' | 'DOWN' | 'SAME';
};

export type Trends = {
  /** False when there is no second check-in to compare with. */
  comparable: boolean;
  worse: TrendRow[];
  better: TrendRow[];
  stable: TrendRow[];
};

function rowOf(signal: PortalSignal): TrendRow | null {
  const points = signal.movementPoints;
  if (!points || signal.movementDirection === null) return null;
  const delta = points.current - points.previous;
  return {
    key: signal.themeKey,
    label: signal.themeLabel,
    kind: signal.kind,
    previous: points.previous,
    current: points.current,
    previousTotal: points.previousTotal,
    currentTotal: points.currentTotal,
    changePct: points.previous > 0 ? Math.round((delta / points.previous) * 100) : null,
    moved: signal.movementDirection === 'STABLE' ? 'SAME' : delta > 0 ? 'UP' : 'DOWN',
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
