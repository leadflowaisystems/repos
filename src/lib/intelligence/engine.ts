import type { Pack } from '@/lib/packs';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';
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
  /** How many stored, read pieces of feedback mention this theme. */
  count: number;
  /** Out of how many pieces read — the denominator, always stated. */
  outOf: number;
  /** The rows behind the count, so "what Headway based this on" always has an answer. */
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
  /**
   * What each limit IS, in the same order — 'quiet', 'unread', 'thin', …
   *
   * Anything downstream that needs to single out one limit matches on these,
   * never on the sentence. Home used to drop the quiet-topics line with
   * /mentioned once or twice/, which matched nothing once the sentence was in
   * Hindi and showed the owner the same line twice.
   */
  limitKinds: string[];

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
  /**
   * The owner's language, if there is one.
   *
   * Passed in rather than looked up, so this file never asks what language it
   * is in. Absent from the operator console, which reads English on purpose.
   */
  t?: PortalTranslator;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * The key segment for the second count in a sentence.
 *
 * `t.plural` carries exactly one number, and several sentences here inflect on
 * two: how many entries mention a theme, and how many entries have been read.
 * The pile's own singular/plural is therefore chosen in the key — `.single` or
 * `.many` — before the translator appends `.one` or `.other` for the first.
 *
 * The counting unit is never "reviews": a review is something published on a
 * public listing, and almost everything counted here is private feedback a
 * customer left after scanning the card. Calling it a review would break the
 * one promise the product makes about where feedback goes. Counts count
 * feedback entries, not people — one customer can leave several.
 */
function readSuffix(analysed: number): string {
  return analysed === 1 ? 'single' : 'many';
}

/** Insight ids are stable so the action loop can key off them later. */
export function insightId(clientId: string, kind: InsightKind, themeKey: string): string {
  return `${clientId}:${kind}:${themeKey}`;
}

function evidenceNote(tier: EvidenceTier, analysed: number, t: PortalTranslator): string {
  switch (tier) {
    case 'STANDARD':
      return t.plural('intelligence.evidence.standard', analysed);
    case 'LIMITED':
      return t.plural('intelligence.evidence.limited', analysed);
    default:
      return analysed === 0
        ? t('intelligence.evidence.none')
        : t.plural('intelligence.evidence.thin', analysed);
  }
}

function confidenceFor(
  count: number,
  analysed: number,
  t: PortalTranslator,
): { level: Confidence; reason: string } {
  const read = readSuffix(analysed);
  const basis = { total: analysed };
  if (count >= MIN_MENTIONS_TO_NAME * 2 && analysed >= TIER_STANDARD_MIN) {
    return {
      level: 'STRONG',
      reason: t.plural(`intelligence.confidence.strong.${read}`, count, basis),
    };
  }
  if (count >= MIN_MENTIONS_TO_NAME && analysed >= TIER_LIMITED_MIN) {
    return {
      level: 'MODERATE',
      reason: t.plural(`intelligence.confidence.moderate.${read}`, count, basis),
    };
  }
  return {
    level: 'EARLY',
    reason: t.plural(`intelligence.confidence.early.${read}`, count, basis),
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
export function comparisonWindowFrom(
  pulse: Pulse,
  t: PortalTranslator = EN,
): ComparisonWindow {
  if (!pulse.available || !pulse.current || !pulse.previous) {
    return NO_WINDOW(pulse.reason || t('intelligence.window.single_checkin'));
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
      ? t('intelligence.window.both_empty', {
          previous: previous.label,
          current: current.label,
        })
      : t('intelligence.window.too_thin', {
          previous: previous.label,
          previousCount: previous.feedbackCount,
          current: current.label,
          currentCount: current.feedbackCount,
          needed: MIN_PERIOD_FEEDBACK_TO_COMPARE,
        });
    return { ...NO_WINDOW(reason), ...base, available: false, reason, note: reason };
  }

  const bigger = Math.max(previous.feedbackCount, current.feedbackCount);
  const smaller = Math.min(previous.feedbackCount, current.feedbackCount);
  const lopsided = bigger / smaller >= VOLUME_CAVEAT_RATIO;

  return {
    ...base,
    available: true,
    reason: '',
    note: t.plural('intelligence.window.note', previous.feedbackCount, {
      previous: previous.label,
      current: current.label,
      currentCount: current.feedbackCount,
    }),
    volumeCaveat: lopsided
      ? t('intelligence.window.volume_caveat', {
          previousCount: previous.feedbackCount,
          currentCount: current.feedbackCount,
        })
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
  t: PortalTranslator = EN,
): ThemeMovement {
  if (!window.available || !pulse.current || !pulse.previous) {
    return NO_MOVEMENT(window.reason);
  }

  const previousCount = countIn(pulse.previous, sentiment, themeKey);
  const currentCount = countIn(pulse.current, sentiment, themeKey);

  // A check-in only holds the feedback attached to it; the theme counts on an
  // insight come from the whole pile. A theme can be well evidenced in one and
  // absent from the other, and calling that "holding steady" would be a claim
  // about feedback that never mentioned it.
  if (previousCount === 0 && currentCount === 0) {
    return NO_MOVEMENT(t('intelligence.movement.absent', { theme: themeLabel }));
  }

  const delta = currentCount - previousCount;
  const countNote = t.plural('intelligence.movement.count_note', currentCount, {
    previousCount,
  });

  // The two points a movement sentence names. `String` rather than a fallback:
  // an unlabelled window is a bug worth seeing, not one worth papering over.
  const point = {
    previous: String(window.previousLabel),
    current: String(window.currentLabel),
    currentCount,
  };

  if (Math.abs(delta) < MIN_CHANGE_TO_REPORT) {
    const pointNote = t.plural('intelligence.movement.steady', previousCount, point);
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
    const pointNote = t.plural('intelligence.movement.too_few', previousCount, {
      ...point,
      needed: MIN_MENTIONS_TO_NAME,
    });
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
  const pointNote = t.plural(
    rose ? 'intelligence.movement.up' : 'intelligence.movement.down',
    previousCount,
    { ...point, delta: Math.abs(delta) },
  );

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
  t: PortalTranslator = EN,
  packId?: string,
): IntelligenceSignal[] {
  const out: IntelligenceSignal[] = [];
  // The vertical is a word inside a sentence — "a serious complaint for a
  // clinic / healthcare" — so it has to be in the reader's language too, or an
  // otherwise-Marathi sentence carries an English noun in the middle of it.
  // The dictionary's English is the same lowercased label this used before.
  const vertical =
    (packId ? t.soft(`pack.vertical.${packId}`) : null) ?? verticalLabel.toLowerCase();

  if (sentiment === 'ISSUE') {
    if (theme.severity === 'high') {
      out.push(signal('severity_high', t('intelligence.signal.severity_high', { vertical })));
    } else if (theme.severity === 'medium') {
      out.push(signal('severity_medium', t('intelligence.signal.severity_medium', { vertical })));
    } else {
      out.push(signal('severity_low', t('intelligence.signal.severity_low')));
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
        t.plural(
          sentiment === 'ISSUE'
            ? 'intelligence.signal.mentioned'
            : 'intelligence.signal.praised',
          theme.count,
        ),
        mentionWeight,
      ),
    );
  }

  if (theme.count >= MIN_MENTIONS_TO_NAME) {
    out.push(
      signal('pattern', t('intelligence.signal.pattern', { needed: MIN_MENTIONS_TO_NAME })),
    );
  }

  if (
    sentiment === 'PRAISE' &&
    theme.count >= MIN_MENTIONS_TO_NAME * 2
  ) {
    out.push(signal('strength', t('intelligence.signal.strength')));
  }

  // The same floor a written theme has to clear. Ratings are easier to give
  // than words, so letting them in on weaker evidence would quietly lower the
  // bar for everything RepOS reports.
  if (sentiment === 'ISSUE' && rated && rated.low >= MIN_MENTIONS_TO_NAME) {
    out.push(
      signal(
        'rated_low',
        t.plural('intelligence.signal.rated_low', rated.low, {
          rated: rated.rated,
          label: rated.label.toLowerCase(),
          threshold: LOW_RATING_AT,
        }),
      ),
    );
  }

  if (movement.available && movement.state === 'WORSENING' && movement.delta !== null) {
    if (sentiment === 'ISSUE') {
      out.push(
        signal(
          'worsening',
          t('intelligence.signal.worsening', { counts: String(movement.countNote) }),
        ),
      );
    }
  }

  if (
    sentiment === 'PRAISE' &&
    movement.available &&
    movement.state === 'IMPROVING' &&
    movement.delta !== null
  ) {
    out.push(
      signal(
        'growing',
        t('intelligence.signal.growing', { counts: String(movement.countNote) }),
      ),
    );
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
  t: PortalTranslator,
): string {
  // The pack's own label, as data. Lowercased for the sentences that put it
  // mid-phrase in English; the other languages interpolate it unchanged.
  const lower = { theme: label.toLowerCase() };
  switch (kind) {
    case 'LOVED':
      return t('intelligence.headline.loved', lower);
    case 'UNHAPPY':
      return t('intelligence.headline.unhappy', lower);
    case 'ATTENTION':
      return t('intelligence.headline.attention', { theme: label });
    case 'CHANGING': {
      const better = movement.state === 'IMPROVING';
      if (sentiment === 'ISSUE') {
        return better
          ? t('intelligence.headline.issue_down', lower)
          : t('intelligence.headline.issue_up', lower);
      }
      return better
        ? t('intelligence.headline.praise_up', lower)
        : t('intelligence.headline.praise_down', lower);
    }
  }
}

function detailFor(
  kind: InsightKind,
  evidence: InsightEvidence,
  movement: ThemeMovement,
  t: PortalTranslator,
): string {
  if (kind === 'CHANGING') return movement.pointNote ?? movement.note;
  return t.plural(
    `intelligence.detail.mentions.${readSuffix(evidence.outOf)}`,
    evidence.count,
    { total: evidence.outOf },
  );
}

/**
 * The pack's suggested change, in the owner's language when there is one.
 *
 * This string is the WHAT TO DO line on Home, so leaving it English would put
 * the one instruction an owner is meant to act on in a language they may not
 * read. Looked up softly by key, with the pack's own English as the fallback,
 * so a pack that has not been translated yet still says something useful.
 */
function actionFor(pack: Pack, themeKey: string, t: PortalTranslator): string | null {
  const own = pack.issueTaxonomy.find((x) => x.key === themeKey)?.action?.trim() || null;
  if (!own) return null;
  return t.soft(`pack.${pack.id}.${themeKey}.action`) ?? own;
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
  t: PortalTranslator;
}): Insight {
  const { clientId, kind, sentiment, theme, analysed, movement, window, t } = args;

  const evidence: InsightEvidence = {
    count: theme.count,
    outOf: analysed,
    itemIds: args.itemIds,
    scope: t.plural('intelligence.evidence.scope', analysed),
  };
  const signals = signalsFor(
    sentiment,
    theme,
    movement,
    args.verticalLabel,
    args.rated ?? null,
    t,
    args.pack.id,
  );
  const confidence = confidenceFor(theme.count, analysed, t);

  // The pack's label, in the owner's language when there is one.
  //
  // Localized HERE, at the single point where a theme becomes an insight, so
  // every sentence downstream — the headline, the WHY paragraph, the evidence
  // chips, the responsibility items — inherits it without any of them knowing
  // that labels can be translated. `themeKey` is untouched: the key is how the
  // code recognises a theme, the label is only how it is read.
  const themeLabel = t.soft(`pack.${args.pack.id}.${theme.key}`) ?? theme.label;

  return {
    id: insightId(clientId, kind, theme.key),
    clientId,
    kind,
    themeKey: theme.key,
    themeLabel,
    sentiment,
    severity: theme.severity,
    headline: headlineFor(kind, sentiment, themeLabel, movement, t),
    detail: detailFor(kind, evidence, movement, t),
    evidence,
    movement,
    window,
    signals,
    rank: rankOf(signals),
    confidence: confidence.level,
    confidenceReason: confidence.reason,
    recommendation: sentiment === 'ISSUE' ? actionFor(args.pack, theme.key, t) : null,
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
  t: PortalTranslator = EN,
): { state: TrendState; note: string } {
  if (!pulse.available) {
    return {
      state: 'INSUFFICIENT_DATA',
      note: pulse.reason || t('intelligence.trend.single_checkin'),
    };
  }

  // The verdict, then the two points it was read between. Two finished
  // sentences joined by a space — each already written in the owner's language.
  const scope = window.available ? ` ${window.note}` : '';
  switch (pulse.direction) {
    case 'IMPROVING':
      return { state: 'IMPROVING', note: `${t('intelligence.trend.improving')}${scope}` };
    case 'DECLINING':
      return { state: 'WORSENING', note: `${t('intelligence.trend.declining')}${scope}` };
    case 'STABLE':
      return {
        state: 'STABLE',
        note: `${t('intelligence.trend.stable')}${scope}`,
      };
    default:
      return {
        state: 'INSUFFICIENT_DATA',
        note: pulse.reason || t('intelligence.trend.unknown'),
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

function headlineNoteFor(count: number, t: PortalTranslator): string {
  switch (count) {
    case 0:
      return t('intelligence.summary.none');
    case 1:
    case 2:
      return t.plural('intelligence.summary.few', count);
    default:
      return t('intelligence.summary.clearest');
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
  const t = input.t ?? EN;
  const clientId = input.client.id;
  const analysed = input.themes.analysedCount;
  const tier = tierFor(analysed);
  const verticalLabel = input.pack.label;
  const window = comparisonWindowFrom(input.pulse, t);

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
  ): Insight => {
    // The theme's name in the owner's language, resolved before the comparison
    // sentence is written rather than after.
    //
    // `movementFor` is the one place a theme label is joined to a translated
    // sentence by CODE — `${label} — ${pointNote}` and the "has not come up in
    // either check-in" line both take the name as a value — so handing it the
    // pack's raw English put an English noun phrase inside a Hindi sentence.
    // `buildInsightFor` resolves the same key for the insight itself; doing it
    // here as well means both say the theme's name the same way. Identical in
    // English: the dictionary's `en` for a pack label is the pack label, byte
    // for byte, and an untranslated theme still falls back to `row.label`.
    const label = t.soft(`pack.${input.pack.id}.${row.key}`) ?? row.label;
    return buildInsightFor({
      clientId,
      kind,
      sentiment,
      theme: row,
      itemIds,
      analysed,
      pack: input.pack,
      verticalLabel,
      movement: movementFor(input.pulse, window, sentiment, row.key, label, t),
      window,
      rated: sentiment === 'ISSUE' ? ratedFor(row.key) : null,
      t,
    });
  };

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

  const overall = overallTrendFrom(input.pulse, window, t);

  // ---- What RepOS still cannot say ----------------------------------------
  const limits: string[] = [];
  const limitKinds: string[] = [];
  const addLimit = (kind: string, sentence: string) => {
    limits.push(sentence);
    limitKinds.push(kind);
  };
  const unread = Math.max(0, input.totalFeedback - analysed);
  if (analysed === 0) {
    addLimit(
      'nothingRead',
      unread > 0
        ? t.plural('intelligence.limit.reading_all', unread)
        : t('intelligence.limit.nothing_read'),
    );
  } else if (tier === 'INSUFFICIENT') {
    addLimit('thin', t.plural('intelligence.limit.too_thin', analysed));
  }
  if (unread > 0 && analysed > 0) {
    addLimit('unread', t.plural('intelligence.limit.reading_more', unread));
  }
  if (!window.available && analysed > 0) {
    addLimit('window', window.reason);
  }
  const quiet = [...belowFloor(input.themes.praises), ...belowFloor(input.themes.issues)];
  if (quiet.length > 0) {
    addLimit('quiet', t.plural('intelligence.limit.quiet', quiet.length));
  }
  if (window.volumeCaveat) {
    addLimit('volume', window.volumeCaveat);
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
      note: evidenceNote(tier, analysed, t),
      enough: tier !== 'INSUFFICIENT',
    },

    loved,
    unhappy,
    changing,
    attention,

    headline,
    headlineNote: headlineNoteFor(headline.length, t),

    window,
    overallTrend: overall.state,
    overallTrendNote: overall.note,

    contextNotes: input.notes.map((note) => ({
      id: note.id,
      occurredAt: note.occurredAt,
      title: note.title,
      category: note.category,
      source: 'OPERATOR_NOTE' as const,
      label: t('intelligence.context.label'),
    })),

    limits,
    limitKinds,
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
