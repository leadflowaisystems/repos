import type { Pack } from '@/lib/packs';
import { LOW_RATING_AT, type ThemeSummary, type ThemeSummaryRow } from '@/lib/feedback/analysis';
import type { Pulse, PulsePeriod, ThemeCount } from '@/lib/health/health';
import {
  TIER_LIMITED_MIN,
  TIER_STANDARD_MIN,
  type EvidenceTier,
} from '@/lib/analysis/aggregate';

/**
 * THE CUSTOMER INTELLIGENCE ENGINE (M10).
 *
 * Answers one question: what are this client's customers actually trying to
 * tell them? Four answers, no more:
 *
 *   A. what customers love
 *   B. what they are unhappy about
 *   C. what is changing
 *   D. what needs attention
 *
 * Every rule below is ordinary application code. Nothing here is produced by a
 * model, and nothing here is allowed to exist without the stored rows behind
 * it — every insight carries the ids of the feedback it was counted from and,
 * where it makes a comparison, the two snapshots it compared. The operator must
 * always be able to answer "why did RepOS say this?" without trusting anything.
 *
 * The engine is the single calculation. The owner update (M8) projects from
 * this object rather than recomputing, and the command centre orders its cards
 * with the same ranking, so a client can never be told one story on a screen
 * and a different one in a message.
 *
 * Pure by construction: everything it needs is passed in.
 */

/** Bump when the shape or the derivation rules change. */
export const INTELLIGENCE_VERSION = 1;

// ---------------------------------------------------------------------------
// Evidence floors
// ---------------------------------------------------------------------------

/**
 * A theme must be named by at least this many customers before RepOS will
 * call it anything. Below the floor it is two people having a bad day, and
 * saying otherwise is exactly the confident nonsense this milestone exists to
 * avoid. Reported honestly instead, as "mentioned once or twice so far".
 */
export const MIN_MENTIONS_TO_NAME = 3;

/**
 * A theme's count must move by this much between two check-ins before it is
 * called a change. A single mention either way is noise at SMB volumes.
 */
export const MIN_CHANGE_TO_REPORT = 2;

/**
 * Both check-ins need at least this much feedback attached before theme counts
 * can be compared at all. Comparing "1 mention" with "2 mentions" is not a
 * trend, it is arithmetic.
 */
export const MIN_PERIOD_FEEDBACK_TO_COMPARE = MIN_MENTIONS_TO_NAME;

/**
 * When one check-in holds this many times more feedback than the other, raw
 * mention counts are partly just volume. The comparison is still shown — with
 * the caveat attached, never silently.
 */
export const VOLUME_CAVEAT_RATIO = 1.5;

/** How many signals the client summary will lead with. Fewer is fine. */
export const HEADLINE_LIMIT = 3;

export { TIER_LIMITED_MIN, TIER_STANDARD_MIN, type EvidenceTier };

export function tierFor(analysed: number): EvidenceTier {
  if (analysed >= TIER_STANDARD_MIN) return 'STANDARD';
  if (analysed >= TIER_LIMITED_MIN) return 'LIMITED';
  return 'INSUFFICIENT';
}

// ---------------------------------------------------------------------------
// Ranking weights
// ---------------------------------------------------------------------------

/**
 * Explainable ranking, not a score.
 *
 * A theme's rank is the sum of the named signals that fired for it, and every
 * signal carries the sentence that explains it. There is no hidden model, no
 * normalisation and no tuning constant that cannot be read out loud.
 *
 * The weights encode one deliberate judgement: how serious the vertical pack
 * says a complaint is outranks how often it was said. A pack-declared serious
 * issue named by three customers (30 + 6 + 8 = 44) beats a harmless theme named
 * by twenty (20 + 8 = 28), because a clinic with three infection-control
 * complaints has a bigger problem than one with twenty parking gripes.
 */
export const SIGNAL_WEIGHTS = {
  /** The pack declares this kind of complaint serious for this vertical. */
  severity_high: 30,
  severity_medium: 15,
  severity_low: 5,
  /** Per mention, capped — volume matters, but it cannot run away with it. */
  mention: 2,
  mention_cap: 20,
  /** It cleared the naming floor, so it is a pattern rather than a one-off. */
  pattern: 8,
  /** More customers raised it than at the previous check-in. */
  worsening: 25,
  /** More customers praised it than at the previous check-in. */
  growing: 15,
  /** Praised by more than twice the floor: a genuine strength. */
  strength: 10,
  /**
   * Customers who never wrote a word still rated this part of the business
   * poorly (M19). Weighted below a written complaint on purpose: a tap says
   * something is wrong, words say what.
   */
  rated_low: 12,
} as const;

export type SignalKey = Exclude<keyof typeof SIGNAL_WEIGHTS, 'mention_cap'>;

export type IntelligenceSignal = {
  key: SignalKey;
  weight: number;
  /** Plain language. The operator reads this, never the weight. */
  reason: string;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four insight types. Nothing else is an insight. */
export type InsightKind = 'LOVED' | 'UNHAPPY' | 'CHANGING' | 'ATTENTION';

export type Sentiment = 'PRAISE' | 'ISSUE';

/**
 * Deterministic trend states.
 *
 * INSUFFICIENT_DATA is a first-class answer, not a failure. RepOS says it
 * whenever there is no second check-in to compare against — it never reports
 * "stable" for a client it has only ever seen once.
 */
export type TrendState = 'IMPROVING' | 'WORSENING' | 'STABLE' | 'INSUFFICIENT_DATA';

/** Something the operator recorded doing. Context, never customer evidence. */
export type RecordedStep = {
  id: string;
  occurredAt: Date;
  title: string;
  category: string;
};

/**
 * The two points a comparison is made between.
 *
 * Carried on every insight that compares anything, so a before/after can never
 * be shown without saying what was compared with what.
 */
export type ComparisonWindow = {
  available: boolean;
  /** Why not, when unavailable. Shown to the operator verbatim. */
  reason: string;
  previousSnapshotId: string | null;
  previousLabel: string | null;
  previousCapturedAt: Date | null;
  previousFeedbackCount: number | null;
  currentSnapshotId: string | null;
  currentLabel: string | null;
  currentCapturedAt: Date | null;
  currentFeedbackCount: number | null;
  periodDays: number | null;
  /** "Comparing your check-in of X with Y." Always names both points. */
  note: string;
  /**
   * Set when the two check-ins hold very different amounts of feedback, so a
   * rise in mentions is partly just more feedback. Never suppressed.
   */
  volumeCaveat: string | null;
};

export type ThemeMovement = {
  available: boolean;
  previousCount: number | null;
  currentCount: number | null;
  delta: number | null;
  state: TrendState;
  /** Names the theme, the direction, both points and both counts. */
  note: string;
  /**
   * The same sentence without the theme name, for use under a heading that
   * already says which theme this is. Repeating the label there reads as a
   * stutter.
   */
  pointNote: string | null;
  /** The bare "2 → 6 mentions" form the owner update already uses. */
  countNote: string | null;
};

export type InsightEvidence = {
  /** How many stored, read feedback items mention this theme. */
  count: number;
  /** Out of how many read items — the denominator, always stated. */
  outOf: number;
  /** The rows behind the count. "Show me the reviews" always has an answer. */
  itemIds: string[];
  /** Says which pile the count is over, so it is never mistaken for a period. */
  scope: string;
};

export type Confidence = 'STRONG' | 'MODERATE' | 'EARLY';

export type Insight = {
  /** Stable across runs. The action loop (M11) will key off this. */
  id: string;
  clientId: string;
  kind: InsightKind;
  themeKey: string;
  themeLabel: string;
  sentiment: Sentiment;
  severity: 'low' | 'medium' | 'high';
  /** One deterministic sentence. Never model-written. */
  headline: string;
  /** The supporting sentence, with the counts in it. */
  detail: string;
  evidence: InsightEvidence;
  movement: ThemeMovement;
  window: ComparisonWindow;
  signals: IntelligenceSignal[];
  /** Sum of the signal weights above. Nothing else feeds it. */
  rank: number;
  confidence: Confidence;
  confidenceReason: string;
  /** The pack's own advice for this theme. Never invented. Issues only. */
  recommendation: string | null;
  version: number;
};

/**
 * An operator note offered as context.
 *
 * Kept in its own field with its own source label so it can never be counted,
 * ranked or presented as something a customer said. Minutes are what the
 * operator did; insights are what customers reported. The two never merge.
 */
export type ContextNote = {
  id: string;
  occurredAt: Date;
  title: string;
  category: string;
  source: 'OPERATOR_NOTE';
  label: string;
};

export type ClientIntelligence = {
  clientId: string;
  businessName: string;
  vertical: string;
  verticalLabel: string;

  evidence: {
    analysed: number;
    total: number;
    unread: number;
    tier: EvidenceTier;
    note: string;
    enough: boolean;
  };

  /** A. What customers love. */
  loved: Insight[];
  /** B. What they are unhappy about. */
  unhappy: Insight[];
  /** C. What is changing. Empty unless two comparable check-ins exist. */
  changing: Insight[];
  /** D. What needs attention. Null when nothing clears the evidence floor. */
  attention: Insight | null;

  /** At most three, deduplicated. Often fewer, and honest about it. */
  headline: Insight[];
  headlineNote: string;

  window: ComparisonWindow;
  overallTrend: TrendState;
  overallTrendNote: string;

  /** Context the operator recorded. Never customer evidence. */
  contextNotes: ContextNote[];

  /** What RepOS cannot yet say, in plain words. Never empty by accident. */
  limits: string[];

  version: number;
};

export type IntelligenceInput = {
  client: { id: string; businessName: string; vertical: string };
  pack: Pack;
  themes: ThemeSummary;
  /** Total stored feedback, including anything not yet read. */
  totalFeedback: number;
  pulse: Pulse;
  notes: RecordedStep[];
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function mentions(n: number): string {
  return `${n} mention${n === 1 ? '' : 's'}`;
}

function customers(n: number): string {
  return `${n} customer${n === 1 ? '' : 's'}`;
}

function reviews(n: number): string {
  return `${n} review${n === 1 ? '' : 's'}`;
}

/** Insight ids are stable so the action loop can key off them later. */
export function insightId(clientId: string, kind: InsightKind, themeKey: string): string {
  return `${clientId}:${kind}:${themeKey}`;
}

function evidenceNote(tier: EvidenceTier, analysed: number): string {
  switch (tier) {
    case 'STANDARD':
      return `Based on ${reviews(analysed)} — enough to be confident about what keeps coming up.`;
    case 'LIMITED':
      return `Based on ${reviews(analysed)}. Enough to spot patterns, not enough to be sure of them yet.`;
    default:
      return analysed === 0
        ? 'No feedback has been read yet, so there is nothing to report.'
        : `Only ${reviews(analysed)} so far — too few to draw conclusions from.`;
  }
}

function confidenceFor(
  count: number,
  analysed: number,
): { level: Confidence; reason: string } {
  const basis = `${count} of the ${reviews(analysed)} read so far mention this`;
  if (count >= MIN_MENTIONS_TO_NAME * 2 && analysed >= TIER_STANDARD_MIN) {
    return { level: 'STRONG', reason: `${basis} — repeated often enough to act on.` };
  }
  if (count >= MIN_MENTIONS_TO_NAME && analysed >= TIER_LIMITED_MIN) {
    return { level: 'MODERATE', reason: `${basis} — a real pattern, still worth watching.` };
  }
  return {
    level: 'EARLY',
    reason: `${basis} — an early signal, on too little feedback to be sure of.`,
  };
}

// ---------------------------------------------------------------------------
// The comparison window
// ---------------------------------------------------------------------------

const NO_WINDOW = (reason: string): ComparisonWindow => ({
  available: false,
  reason,
  previousSnapshotId: null,
  previousLabel: null,
  previousCapturedAt: null,
  previousFeedbackCount: null,
  currentSnapshotId: null,
  currentLabel: null,
  currentCapturedAt: null,
  currentFeedbackCount: null,
  periodDays: null,
  note: reason,
  volumeCaveat: null,
});

/**
 * What two points are being compared, and whether comparing them is honest.
 *
 * The pulse engine already decided whether two snapshots exist and are
 * comparable; this adds the one thing theme counting needs on top — enough
 * feedback attached to both sides for a count to mean anything — and states
 * the volume caveat when the two piles are very different sizes.
 */
export function comparisonWindowFrom(pulse: Pulse): ComparisonWindow {
  if (!pulse.available || !pulse.current || !pulse.previous) {
    return NO_WINDOW(
      pulse.reason ||
        'There is only one check-in so far, so there is nothing to compare against yet.',
    );
  }

  const previous: PulsePeriod = pulse.previous;
  const current: PulsePeriod = pulse.current;
  const base = {
    previousSnapshotId: previous.snapshotId,
    previousLabel: previous.label,
    previousCapturedAt: previous.capturedAt,
    previousFeedbackCount: previous.feedbackCount,
    currentSnapshotId: current.snapshotId,
    currentLabel: current.label,
    currentCapturedAt: current.capturedAt,
    currentFeedbackCount: current.feedbackCount,
    periodDays: pulse.periodDays,
  };

  if (
    previous.feedbackCount < MIN_PERIOD_FEEDBACK_TO_COMPARE ||
    current.feedbackCount < MIN_PERIOD_FEEDBACK_TO_COMPARE
  ) {
    // "0 at Check-in 1 and 0 at Check-in 2" told an owner with 261 comments
    // that RepOS had nothing, which reads as broken rather than careful. A
    // check-in only covers the feedback that arrived up to its own date, so
    // when both sides are empty the honest answer is that everything has
    // arrived since — and the fix is another check-in, not more feedback (M18).
    const bothEmpty = previous.feedbackCount === 0 && current.feedbackCount === 0;
    const reason = bothEmpty
      ? `Your check-ins of ${previous.label} and ${current.label} have no feedback between them to compare — everything read so far arrived afterwards. The next check-in will bring it into the comparison.`
      : `Too little feedback between your check-ins to compare topic by topic: ${previous.feedbackCount} at ` +
        `${previous.label} and ${current.feedbackCount} at ${current.label} ` +
        `(${MIN_PERIOD_FEEDBACK_TO_COMPARE} needed on both sides).`;
    return { ...NO_WINDOW(reason), ...base, available: false, reason, note: reason };
  }

  const bigger = Math.max(previous.feedbackCount, current.feedbackCount);
  const smaller = Math.min(previous.feedbackCount, current.feedbackCount);
  const lopsided = bigger / smaller >= VOLUME_CAVEAT_RATIO;

  return {
    ...base,
    available: true,
    reason: '',
    note:
      `Comparing your check-in of ${previous.label} (${previous.feedbackCount} feedback items) ` +
      `with ${current.label} (${current.feedbackCount} items).`,
    volumeCaveat: lopsided
      ? `One check-in holds far more feedback than the other (${previous.feedbackCount} then, ` +
        `${current.feedbackCount} now), so some of this movement is simply more feedback ` +
        `rather than a change in what customers think.`
      : null,
  };
}

// ---------------------------------------------------------------------------
// Theme movement
// ---------------------------------------------------------------------------

const NO_MOVEMENT = (reason: string): ThemeMovement => ({
  available: false,
  previousCount: null,
  currentCount: null,
  delta: null,
  state: 'INSUFFICIENT_DATA',
  note: reason,
  pointNote: null,
  countNote: null,
});

function countIn(period: PulsePeriod, sentiment: Sentiment, key: string): number {
  const rows: ThemeCount[] = sentiment === 'ISSUE' ? period.topIssues : period.topPraises;
  return rows.find((row) => row.key === key)?.count ?? 0;
}

/**
 * How one theme moved between the two check-ins.
 *
 * "Improving" always means good for the business: fewer complaints, or more
 * praise. A change smaller than the reporting floor is STABLE — genuinely
 * compared and genuinely flat — which is a different statement from
 * INSUFFICIENT_DATA, and the wording keeps them apart.
 */
export function movementFor(
  pulse: Pulse,
  window: ComparisonWindow,
  sentiment: Sentiment,
  themeKey: string,
  themeLabel: string,
): ThemeMovement {
  if (!window.available || !pulse.current || !pulse.previous) {
    return NO_MOVEMENT(window.reason);
  }

  const previousCount = countIn(pulse.previous, sentiment, themeKey);
  const currentCount = countIn(pulse.current, sentiment, themeKey);

  // The check-ins hold the reviews the operator observed; the theme counts on
  // an insight come from the feedback pile. A theme can be well evidenced in
  // one and absent from the other, and calling that "holding steady" would be
  // a claim about reviews that never mentioned it.
  if (previousCount === 0 && currentCount === 0) {
    return NO_MOVEMENT(
      `${themeLabel} has not come up in the reviews attached to either check-in, ` +
        `so there is nothing to compare for it.`,
    );
  }

  const delta = currentCount - previousCount;
  const countNote = `${previousCount} → ${mentions(currentCount)}`;

  const point =
    `${previousCount} ${previousCount === 1 ? 'mention' : 'mentions'} at your check-in on ` +
    `${window.previousLabel}, ${currentCount} at ${window.currentLabel}`;

  if (Math.abs(delta) < MIN_CHANGE_TO_REPORT) {
    const pointNote = `${point}. Holding steady.`;
    return {
      available: true,
      previousCount,
      currentCount,
      delta,
      state: 'STABLE',
      note: `${themeLabel} — ${pointNote}`,
      pointNote,
      countNote,
    };
  }

  // A move from two mentions to none is a large percentage of almost nothing.
  // The naming floor applies to movement for the same reason it applies to
  // themes: at least one side has to be a pattern before a direction is real.
  if (Math.max(previousCount, currentCount) < MIN_MENTIONS_TO_NAME) {
    const pointNote =
      `${point} — too few either way to read as a change ` +
      `(${MIN_MENTIONS_TO_NAME} needed on one side).`;
    return {
      available: true,
      previousCount,
      currentCount,
      delta,
      state: 'INSUFFICIENT_DATA',
      note: `${themeLabel} — ${pointNote}`,
      pointNote,
      countNote,
    };
  }

  const rose = delta > 0;
  const good = sentiment === 'ISSUE' ? !rose : rose;
  const word = rose ? 'up' : 'down';
  const pointNote = `${point} (${word} ${Math.abs(delta)}).`;

  return {
    available: true,
    previousCount,
    currentCount,
    delta,
    state: good ? 'IMPROVING' : 'WORSENING',
    note: `${themeLabel} — ${pointNote}`,
    pointNote,
    countNote,
  };
}

// ---------------------------------------------------------------------------
// Signals and ranking
// ---------------------------------------------------------------------------

function signal(key: SignalKey, reason: string, weight?: number): IntelligenceSignal {
  return { key, weight: weight ?? SIGNAL_WEIGHTS[key], reason };
}

/**
 * Why this theme sits where it sits, as sentences.
 *
 * Every signal returned carries a positive weight and its own explanation, and
 * the rank is their sum and nothing else. Read the reasons out loud and you
 * have explained the ordering completely.
 */
/**
 * The tapped evidence for one theme (M19).
 *
 * Kept apart from the written mentions all the way through, and worded apart
 * too: "rated it 3 or below" is what happened, "said the wait was long" is
 * not. Nobody who only tapped is ever quoted.
 */
export type RatedEvidence = {
  label: string;
  rated: number;
  low: number;
  average: number | null;
};

export function signalsFor(
  sentiment: Sentiment,
  theme: { label: string; count: number; severity: 'low' | 'medium' | 'high' },
  movement: ThemeMovement,
  verticalLabel: string,
  rated: RatedEvidence | null = null,
): IntelligenceSignal[] {
  const out: IntelligenceSignal[] = [];

  if (sentiment === 'ISSUE') {
    if (theme.severity === 'high') {
      out.push(
        signal(
          'severity_high',
          `This is a serious complaint for a ${verticalLabel.toLowerCase()}.`,
        ),
      );
    } else if (theme.severity === 'medium') {
      out.push(
        signal('severity_medium', `This matters to ${verticalLabel.toLowerCase()} customers.`),
      );
    } else {
      out.push(signal('severity_low', 'A minor complaint, but customers did raise it.'));
    }
  }

  const mentionWeight = Math.min(
    theme.count * SIGNAL_WEIGHTS.mention,
    SIGNAL_WEIGHTS.mention_cap,
  );
  if (mentionWeight > 0) {
    out.push(
      signal(
        'mention',
        sentiment === 'ISSUE'
          ? `${customers(theme.count)} raised it.`
          : `${customers(theme.count)} praised it.`,
        mentionWeight,
      ),
    );
  }

  if (theme.count >= MIN_MENTIONS_TO_NAME) {
    out.push(
      signal(
        'pattern',
        `Named by at least ${MIN_MENTIONS_TO_NAME} customers, so it is a pattern rather than a one-off.`,
      ),
    );
  }

  if (
    sentiment === 'PRAISE' &&
    theme.count >= MIN_MENTIONS_TO_NAME * 2
  ) {
    out.push(
      signal('strength', 'Praised often enough to be a genuine strength worth protecting.'),
    );
  }

  // The same floor a written theme has to clear. Ratings are easier to give
  // than words, so letting them in on weaker evidence would quietly lower the
  // bar for everything RepOS reports.
  if (sentiment === 'ISSUE' && rated && rated.low >= MIN_MENTIONS_TO_NAME) {
    out.push(
      signal(
        'rated_low',
        `${customers(rated.low)} of the ${rated.rated} who rated ${rated.label.toLowerCase()} put it at ${LOW_RATING_AT} or below.`,
      ),
    );
  }

  if (movement.available && movement.state === 'WORSENING' && movement.delta !== null) {
    if (sentiment === 'ISSUE') {
      out.push(
        signal('worsening', `It is coming up more than last time: ${movement.countNote}.`),
      );
    }
  }

  if (
    sentiment === 'PRAISE' &&
    movement.available &&
    movement.state === 'IMPROVING' &&
    movement.delta !== null
  ) {
    out.push(signal('growing', `Praised more than last time: ${movement.countNote}.`));
  }

  return out;
}

function rankOf(signals: IntelligenceSignal[]): number {
  return signals.reduce((sum, s) => sum + s.weight, 0);
}

/**
 * Stable ordering: heaviest first, then by label.
 *
 * The tie-break by name means two equally ranked themes never swap places
 * between refreshes, so the operator can trust that a changed order means the
 * data changed.
 */
export function compareInsights(a: Insight, b: Insight): number {
  return b.rank - a.rank || a.themeLabel.localeCompare(b.themeLabel);
}

// ---------------------------------------------------------------------------
// Building insights
// ---------------------------------------------------------------------------

function headlineFor(
  kind: InsightKind,
  sentiment: Sentiment,
  label: string,
  movement: ThemeMovement,
): string {
  switch (kind) {
    case 'LOVED':
      return `Customers keep praising ${label.toLowerCase()}.`;
    case 'UNHAPPY':
      return `Customers are unhappy about ${label.toLowerCase()}.`;
    case 'ATTENTION':
      return `${label} needs attention.`;
    case 'CHANGING': {
      const better = movement.state === 'IMPROVING';
      if (sentiment === 'ISSUE') {
        return better
          ? `Fewer customers are raising ${label.toLowerCase()}.`
          : `More customers are raising ${label.toLowerCase()}.`;
      }
      return better
        ? `More customers are praising ${label.toLowerCase()}.`
        : `Fewer customers are praising ${label.toLowerCase()}.`;
    }
  }
}

function detailFor(
  kind: InsightKind,
  evidence: InsightEvidence,
  movement: ThemeMovement,
): string {
  if (kind === 'CHANGING') return movement.pointNote ?? movement.note;
  return `${mentions(evidence.count)} ${evidence.scope}.`;
}

function actionFor(pack: Pack, themeKey: string): string | null {
  return pack.issueTaxonomy.find((t) => t.key === themeKey)?.action?.trim() || null;
}

function buildInsightFor(args: {
  clientId: string;
  kind: InsightKind;
  sentiment: Sentiment;
  theme: { key: string; label: string; count: number; severity: 'low' | 'medium' | 'high' };
  itemIds: string[];
  analysed: number;
  pack: Pack;
  verticalLabel: string;
  movement: ThemeMovement;
  window: ComparisonWindow;
  /** The tapped evidence for this theme, when the vertical asks about it. */
  rated?: RatedEvidence | null;
}): Insight {
  const { clientId, kind, sentiment, theme, analysed, movement, window } = args;

  const evidence: InsightEvidence = {
    count: theme.count,
    outOf: analysed,
    itemIds: args.itemIds,
    scope: `across the ${reviews(analysed)} read so far`,
  };
  const signals = signalsFor(sentiment, theme, movement, args.verticalLabel, args.rated ?? null);
  const confidence = confidenceFor(theme.count, analysed);

  return {
    id: insightId(clientId, kind, theme.key),
    clientId,
    kind,
    themeKey: theme.key,
    themeLabel: theme.label,
    sentiment,
    severity: theme.severity,
    headline: headlineFor(kind, sentiment, theme.label, movement),
    detail: detailFor(kind, evidence, movement),
    evidence,
    movement,
    window,
    signals,
    rank: rankOf(signals),
    confidence: confidence.level,
    confidenceReason: confidence.reason,
    recommendation: sentiment === 'ISSUE' ? actionFor(args.pack, theme.key) : null,
    version: INTELLIGENCE_VERSION,
  };
}

// ---------------------------------------------------------------------------
// The overall trend
// ---------------------------------------------------------------------------

/**
 * The client-level verdict.
 *
 * Delegated to the pulse engine on purpose. Its direction is built from
 * observed rating, negative share and unanswered share — all proportions — so
 * a client who simply collected more feedback this month can never be reported
 * as improving. Mention counts are never allowed to drive this verdict; they
 * describe individual themes, with the volume caveat attached.
 */
export function overallTrendFrom(
  pulse: Pulse,
  window: ComparisonWindow,
): { state: TrendState; note: string } {
  if (!pulse.available) {
    return {
      state: 'INSUFFICIENT_DATA',
      note:
        pulse.reason ||
        'There is only one check-in so far, so RepOS cannot say which way things are going.',
    };
  }

  const scope = window.available ? ` ${window.note}` : '';
  switch (pulse.direction) {
    case 'IMPROVING':
      return { state: 'IMPROVING', note: `Things are moving the right way.${scope}` };
    case 'DECLINING':
      return { state: 'WORSENING', note: `Things are moving the wrong way.${scope}` };
    case 'STABLE':
      return {
        state: 'STABLE',
        note: `Nothing moved enough to call a direction either way.${scope}`,
      };
    default:
      return {
        state: 'INSUFFICIENT_DATA',
        note:
          pulse.reason ||
          'There is not enough comparable data to say which way things are going.',
      };
  }
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

function qualifying(rows: ThemeSummaryRow[]): ThemeSummaryRow[] {
  return rows.filter((row) => row.count >= MIN_MENTIONS_TO_NAME);
}

function belowFloor(rows: ThemeSummaryRow[]): ThemeSummaryRow[] {
  return rows.filter((row) => row.count > 0 && row.count < MIN_MENTIONS_TO_NAME);
}

function headlineNoteFor(count: number): string {
  switch (count) {
    case 0:
      return 'Nothing has been said often enough yet for RepOS to call it a pattern.';
    case 1:
      return 'Only 1 clear signal so far. More will appear as feedback comes in.';
    case 2:
      return 'Only 2 clear signals so far. More will appear as feedback comes in.';
    default:
      return 'The clearest things customers are telling this business right now.';
  }
}

/**
 * Everything RepOS knows about what this client's customers are saying.
 *
 * Order of operations, all deterministic:
 *
 *  1. Decide whether the two check-ins can be compared at all.
 *  2. Rank the themes that clear the evidence floor, by named signals.
 *  3. Name the one issue that needs attention, if any clears the floor.
 *  4. Report themes that actually moved, with both comparison points.
 *  5. Say plainly what is still missing.
 */
export function buildIntelligence(input: IntelligenceInput): ClientIntelligence {
  const clientId = input.client.id;
  const analysed = input.themes.analysedCount;
  const tier = tierFor(analysed);
  const verticalLabel = input.pack.label;
  const window = comparisonWindowFrom(input.pulse);

  // A theme is corroborated by the question the pack points at it, and only
  // for complaints: the vertical's questions ask what went wrong, so a high
  // rating is the absence of a problem rather than evidence of praise.
  const ratedFor = (themeKey: string): RatedEvidence | null => {
    const dimension = input.themes.dimensions.find((d) => d.themeKey === themeKey);
    if (!dimension || dimension.rated === 0) return null;
    return {
      label: dimension.label,
      rated: dimension.rated,
      low: dimension.low,
      average: dimension.average,
    };
  };

  const make = (
    kind: InsightKind,
    sentiment: Sentiment,
    row: { key: string; label: string; count: number; severity: 'low' | 'medium' | 'high' },
    itemIds: string[],
  ): Insight =>
    buildInsightFor({
      clientId,
      kind,
      sentiment,
      theme: row,
      itemIds,
      analysed,
      pack: input.pack,
      verticalLabel,
      movement: movementFor(input.pulse, window, sentiment, row.key, row.label),
      window,
      rated: sentiment === 'ISSUE' ? ratedFor(row.key) : null,
    });

  // ---- A + B: what customers love, and what they are unhappy about --------
  const loved = qualifying(input.themes.praises)
    .map((row) => make('LOVED', 'PRAISE', row, row.itemIds))
    .sort(compareInsights);

  const unhappy = qualifying(input.themes.issues)
    .map((row) => make('UNHAPPY', 'ISSUE', row, row.itemIds))
    .sort(compareInsights);

  // ---- D: what needs attention -------------------------------------------
  // The highest-ranked complaint, which is the pack's severity judgement and
  // the mention count together — not simply the loudest theme.
  const top = unhappy[0];
  const attention = top
    ? make(
        'ATTENTION',
        'ISSUE',
        {
          key: top.themeKey,
          label: top.themeLabel,
          count: top.evidence.count,
          severity: top.severity,
        },
        top.evidence.itemIds,
      )
    : null;

  // ---- C: what is changing ------------------------------------------------
  // Only from themes RepOS already has evidence for, and only when the two
  // check-ins are comparable. Never manufactured from a single snapshot.
  const changing: Insight[] = window.available
    ? [...loved, ...unhappy]
        .map((insight) => {
          const movement = insight.movement;
          if (
            !movement.available ||
            (movement.state !== 'IMPROVING' && movement.state !== 'WORSENING')
          ) {
            return null;
          }
          return make(
            'CHANGING',
            insight.sentiment,
            {
              key: insight.themeKey,
              label: insight.themeLabel,
              count: insight.evidence.count,
              severity: insight.severity,
            },
            insight.evidence.itemIds,
          );
        })
        .filter((i): i is Insight => i !== null)
        .sort(compareInsights)
    : [];

  // ---- The three things worth leading with --------------------------------
  // Attention first when it exists, then whatever ranks highest. One theme
  // appears once: an issue that both needs attention and is getting worse is
  // one headline, not two.
  const headline: Insight[] = [];
  const seen = new Set<string>();
  for (const insight of [
    ...(attention ? [attention] : []),
    ...[...changing, ...unhappy, ...loved].sort(compareInsights),
  ]) {
    if (seen.has(insight.themeKey)) continue;
    seen.add(insight.themeKey);
    headline.push(insight);
    if (headline.length >= HEADLINE_LIMIT) break;
  }

  const overall = overallTrendFrom(input.pulse, window);

  // ---- What RepOS still cannot say ----------------------------------------
  const limits: string[] = [];
  const unread = Math.max(0, input.totalFeedback - analysed);
  if (analysed === 0) {
    limits.push(
      'No feedback has been read yet, so RepOS has nothing to tell you about customers.',
    );
  } else if (tier === 'INSUFFICIENT') {
    limits.push(
      `Only ${reviews(analysed)} have been read. Everything above is an early signal, not a conclusion.`,
    );
  }
  if (unread > 0) {
    limits.push(
      `${unread} piece${unread === 1 ? '' : 's'} of feedback ${unread === 1 ? 'has' : 'have'} not been read yet, so ${unread === 1 ? 'it is' : 'they are'} not counted above.`,
    );
  }
  if (!window.available && analysed > 0) {
    limits.push(window.reason);
  }
  const quiet = [...belowFloor(input.themes.praises), ...belowFloor(input.themes.issues)];
  if (quiet.length > 0) {
    limits.push(
      `${quiet.length} other thing${quiet.length === 1 ? ' was' : 's were'} mentioned once or twice — not enough to call a pattern yet.`,
    );
  }
  if (window.volumeCaveat) {
    limits.push(window.volumeCaveat);
  }

  return {
    clientId,
    businessName: input.client.businessName,
    vertical: input.client.vertical,
    verticalLabel,

    evidence: {
      analysed,
      total: input.totalFeedback,
      unread,
      tier,
      note: evidenceNote(tier, analysed),
      enough: tier !== 'INSUFFICIENT',
    },

    loved,
    unhappy,
    changing,
    attention,

    headline,
    headlineNote: headlineNoteFor(headline.length),

    window,
    overallTrend: overall.state,
    overallTrendNote: overall.note,

    contextNotes: input.notes.map((note) => ({
      id: note.id,
      occurredAt: note.occurredAt,
      title: note.title,
      category: note.category,
      source: 'OPERATOR_NOTE' as const,
      label: 'You recorded this — not something a customer said.',
    })),

    limits,
    version: INTELLIGENCE_VERSION,
  };
}

/**
 * Every number the intelligence object states, as strings.
 *
 * The same guard the owner update uses: prose about a client may only contain
 * figures that appear here. Anything else is a number nobody can show the
 * evidence for.
 */
export function intelligenceNumbers(intel: ClientIntelligence): Set<string> {
  const out = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (typeof n === 'number' && Number.isFinite(n)) out.add(String(n));
  };

  add(intel.evidence.analysed);
  add(intel.evidence.total);
  add(intel.evidence.unread);
  add(intel.window.previousFeedbackCount);
  add(intel.window.currentFeedbackCount);
  add(intel.window.periodDays);

  for (const insight of [
    ...intel.loved,
    ...intel.unhappy,
    ...intel.changing,
    ...(intel.attention ? [intel.attention] : []),
  ]) {
    add(insight.evidence.count);
    add(insight.evidence.outOf);
    add(insight.movement.previousCount);
    add(insight.movement.currentCount);
    if (insight.movement.delta !== null) add(Math.abs(insight.movement.delta));
  }

  return out;
}
