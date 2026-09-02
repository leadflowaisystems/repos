import type { Pack } from '@/lib/packs';
import type { ThemeSummary, ThemeSummaryRow } from '@/lib/feedback/analysis';
import type { Pulse } from '@/lib/health/health';
import {
  MIN_MENTIONS_TO_NAME,
  TIER_LIMITED_MIN,
  TIER_STANDARD_MIN,
  buildIntelligence,
  tierFor,
  type ClientIntelligence,
  type EvidenceTier,
  type Insight,
  type RecordedStep,
} from '@/lib/intelligence/engine';

/**
 * THE INSIGHT OBJECT (M8).
 *
 * One deterministic structure holding everything RepOS currently knows about a
 * client that is worth telling their owner:
 *
 *   what customers love · what they are unhappy about · the one repeated issue
 *   · what changed since last time · what to do about it · what was already done
 *
 * Two rules make this safe to build messages from:
 *
 *  1. Every field is derived from stored rows. There is no field here that a
 *     model produced, and no field that RepOS cannot show the evidence for.
 *  2. A field that is not supported by the data is ABSENT, not guessed. An
 *     owner with nine reviews gets an honest "too early to call", never a
 *     confident-sounding paragraph built on nine rows.
 *
 * This object is also the reuse point for the future client portal: the portal
 * will render the same fields (Customer pulse → What customers love → What they
 * are unhappy about → What we recommend → What changed → View evidence) rather
 * than recomputing any of it. Nothing here knows about a screen or a message.
 */

/** Bump when the shape or the derivation rules change. */
export const INSIGHT_VERSION = 1;

/**
 * Evidence floors, owned by the intelligence engine and re-exported here so the
 * owner never hears one story on a report, another on a panel and a third in a
 * message. One definition, one meaning.
 */
export { MIN_MENTIONS_TO_NAME, TIER_LIMITED_MIN, TIER_STANDARD_MIN, tierFor };
export type { EvidenceTier, RecordedStep };

export type InsightTheme = {
  key: string;
  label: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
  /** True once the theme clears the naming floor. Below it, counts only. */
  qualifies: boolean;
  /** The reviews behind this count. The portal's "show me the evidence". */
  itemIds: string[];
};

export type InsightChange = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  direction: 'BETTER' | 'WORSE' | 'FLAT';
  /** Already written in plain language by the pulse engine. */
  note: string;
};

/**
 * The improvement loop, as far as it can honestly be told to an owner (M11).
 *
 * `result` stays null until the action has actually been measured. An owner
 * must never read a message implying a change worked before the feedback has
 * been compared — that is the single easiest way for RepOS to lose credibility.
 */
export type InsightAction = {
  themeLabel: string;
  /** What the business decided to do, in their own words. */
  decision: string;
  status: 'ACCEPTED' | 'DONE' | 'MEASURED';
  result: {
    label: string;
    /** Written by the measurement engine: "after", never "because". */
    headline: string;
    beforeLine: string;
    afterLine: string;
    beforeCount: number;
    beforeTotal: number;
    afterCount: number;
    afterTotal: number;
  } | null;
};

export type InsightRecommendation = {
  themeKey: string;
  themeLabel: string;
  /** The vertical pack's own advice for this theme. Never invented. */
  action: string;
  /** How many mentions it is based on, so the owner can weigh it. */
  mentions: number;
};

export type OwnerInsight = {
  clientId: string;
  businessName: string;
  vertical: string;
  verticalLabel: string;

  evidence: {
    analysed: number;
    total: number;
    tier: EvidenceTier;
    /** Honest one-liner about what this much feedback can and cannot say. */
    note: string;
    /** False when there is not enough to say anything useful at all. */
    enough: boolean;
  };

  loves: InsightTheme[];
  dislikes: InsightTheme[];
  /** The single most repeated issue, or null when nothing clears the floor. */
  topIssue: InsightTheme | null;

  /** Empty unless two comparable periods exist. Never a fabricated trend. */
  changes: InsightChange[];
  comparisonNote: string;

  recommendation: InsightRecommendation | null;

  /**
   * Decisions and actions the operator recorded. Present so an update can say
   * "last time you decided X" — it must NEVER say whether X worked. Measuring
   * that is the action loop's job (M11), not this milestone's.
   */
  recentlyDone: RecordedStep[];

  /**
   * The most advanced improvement action, when there is one. Present so the
   * owner update can say "you agreed to X" or "since you did X, here is what
   * the feedback did" without a second composer being written for it.
   */
  action: InsightAction | null;

  version: number;
};

export type InsightInput = {
  client: { id: string; businessName: string; vertical: string };
  pack: Pack;
  themes: ThemeSummary;
  /** Total stored feedback, including anything not yet read. */
  totalFeedback: number;
  pulse: Pulse;
  recentlyDone: RecordedStep[];
  /** Optional: the improvement loop's current state for this client. */
  action?: InsightAction | null;
};

function toInsightTheme(row: ThemeSummaryRow): InsightTheme {
  return {
    key: row.key,
    label: row.label,
    count: row.count,
    severity: row.severity,
    qualifies: row.count >= MIN_MENTIONS_TO_NAME,
    itemIds: row.itemIds,
  };
}

/**
 * The recommended next step.
 *
 * Comes from the vertical pack's own advice for the theme the intelligence
 * engine ranked highest. RepOS does not write advice: it picks which of the
 * pack's existing advice applies, based on a count it can show the evidence
 * for. When nothing clears the naming floor there is no recommendation, rather
 * than a weak one.
 */
function recommendationFor(attention: Insight | null): InsightRecommendation | null {
  if (!attention || !attention.recommendation) return null;

  return {
    themeKey: attention.themeKey,
    themeLabel: attention.themeLabel,
    action: attention.recommendation,
    mentions: attention.evidence.count,
  };
}

/** The ranked complaint, in the flat shape the composer reads. */
function toTheme(insight: Insight): InsightTheme {
  return {
    key: insight.themeKey,
    label: insight.themeLabel,
    count: insight.evidence.count,
    severity: insight.severity,
    qualifies: insight.evidence.count >= MIN_MENTIONS_TO_NAME,
    itemIds: insight.evidence.itemIds,
  };
}

/**
 * Changes worth mentioning to an owner.
 *
 * Taken from the intelligence engine, which already decided whether the two
 * check-ins can be compared, which themes moved by enough to be worth saying
 * out loud, and which direction is the good one for a complaint as against a
 * compliment. Nothing is recomputed here.
 */
function changesFrom(intel: ClientIntelligence): {
  changes: InsightChange[];
  note: string;
} {
  if (!intel.window.available) {
    return { changes: [], note: intel.window.reason };
  }

  const changes: InsightChange[] = intel.changing.map((insight) => ({
    key: insight.themeKey,
    label: insight.themeLabel,
    current: insight.movement.currentCount ?? 0,
    previous: insight.movement.previousCount ?? 0,
    delta: insight.movement.delta ?? 0,
    direction:
      insight.movement.state === 'IMPROVING'
        ? 'BETTER'
        : insight.movement.state === 'WORSENING'
          ? 'WORSE'
          : 'FLAT',
    note: insight.movement.countNote ?? '',
  }));

  const note =
    changes.length > 0
      ? (intel.window.volumeCaveat ?? '')
      : 'Nothing moved enough between the two check-ins to be worth flagging.';

  return { changes, note };
}

/**
 * Builds the insight from the client intelligence.
 *
 * Pure: everything it needs is passed in, so it is fully testable and produces
 * the same object for the same stored rows. Callers that already hold the
 * intelligence object pass it in rather than having it rebuilt.
 */
export function buildInsight(
  input: InsightInput,
  intelligence?: ClientIntelligence,
): OwnerInsight {
  const intel =
    intelligence ?? buildIntelligence({ ...input, notes: input.recentlyDone });

  // Every theme, including the ones below the naming floor: the composer needs
  // the flag to decide what it is allowed to say, and the portal will need the
  // counts. The ranking judgement is not repeated here.
  const loves = input.themes.praises.map(toInsightTheme);
  const dislikes = input.themes.issues.map(toInsightTheme);

  // The one issue to raise with the owner is the one the engine ranked first,
  // which weighs how serious the pack says a complaint is alongside how often
  // customers said it — not simply the loudest theme.
  const topIssue = intel.attention ? toTheme(intel.attention) : null;
  const { changes, note: comparisonNote } = changesFrom(intel);

  return {
    clientId: intel.clientId,
    businessName: intel.businessName,
    vertical: intel.vertical,
    verticalLabel: intel.verticalLabel,

    evidence: {
      analysed: intel.evidence.analysed,
      total: intel.evidence.total,
      tier: intel.evidence.tier,
      note: intel.evidence.note,
      enough: intel.evidence.enough,
    },

    loves,
    dislikes,
    topIssue,

    changes,
    comparisonNote,

    recommendation: recommendationFor(intel.attention),
    recentlyDone: input.recentlyDone,
    action: input.action ?? null,

    version: INSIGHT_VERSION,
  };
}

/**
 * Every number an owner-facing message is allowed to state.
 *
 * The numeric guard uses this: a figure that is not in here did not come from
 * the stored data, so the sentence containing it is rejected. This is the same
 * rule the report engine applies to AI prose.
 */
export function insightNumbers(insight: OwnerInsight): Set<string> {
  const allowed = new Set<string>();
  const add = (n: number) => {
    if (!Number.isFinite(n)) return;
    allowed.add(String(n));
    allowed.add(String(Math.abs(n)));
    allowed.add(String(Math.round(n)));
    allowed.add(String(Math.abs(Math.round(n))));
    allowed.add(n.toFixed(1));
    allowed.add(Math.abs(n).toFixed(1));
  };

  add(insight.evidence.analysed);
  add(insight.evidence.total);
  for (const theme of [...insight.loves, ...insight.dislikes]) add(theme.count);
  for (const change of insight.changes) {
    add(change.current);
    add(change.previous);
    add(change.delta);
  }
  if (insight.recommendation) add(insight.recommendation.mentions);

  // Figures inside the operator's own description of what the business decided.
  // The guard exists to stop RepOS stating a statistic it cannot evidence; a
  // sentence a human typed and is about to send themselves is not that. Without
  // this, "cut 6-8pm bookings to five an hour" makes the message unsendable.
  if (insight.action) {
    for (const figure of insight.action.decision.match(/\d+(?:\.\d+)?/g) ?? []) {
      allowed.add(figure);
    }
  }

  // The before/after figures an action update is allowed to quote, including
  // the percentages, which the safety gate sees as bare numbers.
  if (insight.action?.result) {
    const r = insight.action.result;
    for (const n of [r.beforeCount, r.beforeTotal, r.afterCount, r.afterTotal]) add(n);
    for (const [count, total] of [
      [r.beforeCount, r.beforeTotal],
      [r.afterCount, r.afterTotal],
    ] as const) {
      if (total > 0) add(Math.round((count / total) * 100));
    }
  }

  // Floors RepOS itself quotes when explaining how sure it is.
  for (const t of [MIN_MENTIONS_TO_NAME, TIER_LIMITED_MIN, TIER_STANDARD_MIN]) add(t);

  return allowed;
}
