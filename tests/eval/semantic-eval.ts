import { normalizeFeedback, type NormalizedFeedback } from '@/lib/analysis/normalize';
import { routeForAi, type AiRouteReason } from '@/lib/ai/route';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import type { EvalExample, EvalSentiment } from './semantic-dataset';

/**
 * SCORING FOR THE SEMANTIC EVALUATION SET.
 *
 * Runs the DETERMINISTIC reader — `normalizeFeedback` with no AI suggestion,
 * which is exactly what production does for every response the router does not
 * escalate, and for every response when no provider is configured or the
 * budget is spent — and compares it with the fixed human label.
 *
 * It cannot score the optional AI reader: that answer comes from a provider
 * over a network and is not reproducible. What it CAN say, deterministically,
 * is which responses the router would escalate (`routeForAi`), so every miss is
 * split into "a second reader would at least see this" and "kept as confident:
 * nothing else will ever look at it". The second kind is the one that matters.
 *
 * THE SAFETY METRICS COME FIRST. Aggregate accuracy can be bought with false
 * positives; these cannot:
 *
 *   invented topics      a topic the sentence does not support
 *   prohibited hits      a reading the label forbids outright
 *   wrong polarity       a topic filed on the wrong side — praise read as a
 *                        complaint about the same thing, or the reverse
 *   sentiment reversals  POSITIVE read as NEGATIVE, or NEGATIVE as POSITIVE
 *   false strong         an invented problem the reader was confident about
 *   silent serious miss  a pack-declared serious problem missed, and not sent
 *                        to a second reader either
 *
 * Pure: no database, no network, no clock.
 */

export type ExampleResult = {
  id: string;
  pack: string;
  category: string;
  text: string;
  /** Written in the second pass, before any engine change: the generalisation check. */
  secondSet: boolean;
  predicted: {
    sentiment: string;
    praise: string[];
    issues: string[];
    confidence: string;
    routing: 'KEYWORD' | 'AI';
    routeReason: AiRouteReason;
  };
  sentimentOk: boolean;
  /** POSITIVE for NEGATIVE or the reverse. MIXED or NEUTRAL in error is not a reversal. */
  sentimentReversed: boolean;
  missingPraise: string[];
  missingIssues: string[];
  extraPraise: string[];
  extraIssues: string[];
  /** Predicted topics that the label forbids outright. */
  prohibitedHit: string[];
  /** A topic filed on the wrong side of the same concept. */
  wrongPolarity: string[];
  /** Issue dimensions the label names whose pack theme was not found. */
  missingDimensions: string[];
  routingOk: boolean;
  /** Everything right: sentiment, both topic sets, nothing prohibited. */
  exact: boolean;
  /** Wrong, and the router kept it as confident — no second reader will see it. */
  silentMiss: boolean;
  /** A missed problem the pack calls serious, with no second reader. */
  silentSeriousMiss: string[];
  /** An invented problem, stated with HIGH confidence. */
  falseStrong: boolean;
};

const SECOND_SET_FROM: Record<string, number> = { r: 29, c: 18, k: 16, g: 16, e: 15, s: 16, w: 15 };

/** The fresh set, written after round two of the taxonomy pass: ids like rx1, cx4. */
export function isFresh(id: string): boolean {
  return /^[a-z]x\d+$/.test(id);
}

/** The blind holdout, written after the taxonomy pass: ids like rh1, ch4. */
export function isHoldout(id: string): boolean {
  return /^[a-z]h\d+$/.test(id);
}

export function isSecondSet(id: string): boolean {
  if (isHoldout(id) || isFresh(id)) return false;
  const prefix = id[0] ?? '';
  const n = Number(id.slice(1));
  return prefix in SECOND_SET_FROM && n >= (SECOND_SET_FROM[prefix] ?? Infinity);
}

function themeForDimension(pack: Pack, dimensionKey: string): string | null {
  return pack.gateway?.dimensions.find((d) => d.key === dimensionKey)?.themeKey ?? null;
}

/** The praise topic a problem topic is the other side of, per the pack. */
function counterpartOf(pack: Pack, issueKey: string): string | null {
  return pack.issueTaxonomy.find((e) => e.key === issueKey)?.counterpart ?? null;
}

export function evaluateExample(example: EvalExample): ExampleResult {
  const pack = getPackOrFallback(example.pack);
  const read: NormalizedFeedback = normalizeFeedback({ text: example.text, stars: example.stars, pack, ai: null });
  const route = routeForAi({ text: example.text, stars: example.stars }, pack);

  const e = example.expected;
  const tolerated = new Set(e.tolerated ?? []);
  const accept = new Set<EvalSentiment>([e.sentiment, ...(e.alsoAccept ?? [])]);

  const missing = (want: string[], got: string[]) => want.filter((k) => !got.includes(k));
  const extra = (want: string[], got: string[]) => got.filter((k) => !want.includes(k) && !tolerated.has(k));

  const missingPraise = missing(e.praise, read.praiseTags);
  const missingIssues = missing(e.issues, read.issueTags);
  const extraPraise = extra(e.praise, read.praiseTags);
  const extraIssues = extra(e.issues, read.issueTags);
  const prohibitedHit = (e.prohibited ?? []).filter(
    (k) => read.praiseTags.includes(k) || read.issueTags.includes(k),
  );

  // Wrong side of the same concept: an issue whose praise counterpart is what
  // the label says, or a praise whose issue counterpart is what the label says.
  const wrongPolarity = [
    ...read.issueTags.filter((k) => {
      const c = counterpartOf(pack, k);
      return c !== null && e.praise.includes(c) && !e.issues.includes(k);
    }),
    ...read.praiseTags.filter((p) =>
      e.issues.some((k) => counterpartOf(pack, k) === p) && !e.praise.includes(p) && !tolerated.has(p),
    ),
  ];

  const missingDimensions = e.dimensions
    .filter((d) => d.polarity === 'negative')
    .filter((d) => {
      const themeKey = themeForDimension(pack, d.key);
      return themeKey !== null && e.issues.includes(themeKey) && !read.issueTags.includes(themeKey);
    })
    .map((d) => d.key);

  const sentimentOk = accept.has(read.sentiment as EvalSentiment);
  const sentimentReversed =
    (e.sentiment === 'POSITIVE' && read.sentiment === 'NEGATIVE' && !accept.has('NEGATIVE')) ||
    (e.sentiment === 'NEGATIVE' && read.sentiment === 'POSITIVE' && !accept.has('POSITIVE'));
  const exact =
    sentimentOk &&
    missingPraise.length === 0 &&
    missingIssues.length === 0 &&
    extraPraise.length === 0 &&
    extraIssues.length === 0 &&
    prohibitedHit.length === 0;
  const routing = route.needsAi ? 'AI' : 'KEYWORD';
  const severity = (k: string) => pack.issueTaxonomy.find((x) => x.key === k)?.severity ?? 'medium';

  return {
    id: example.id,
    pack: example.pack,
    category: example.category,
    text: example.text,
    secondSet: isSecondSet(example.id),
    predicted: {
      sentiment: read.sentiment,
      praise: read.praiseTags,
      issues: read.issueTags,
      confidence: read.confidence,
      routing,
      routeReason: route.reason,
    },
    sentimentOk,
    sentimentReversed,
    missingPraise,
    missingIssues,
    extraPraise,
    extraIssues,
    prohibitedHit,
    wrongPolarity,
    missingDimensions,
    routingOk: routing === e.routing,
    exact,
    silentMiss: !exact && !route.needsAi,
    silentSeriousMiss: route.needsAi ? [] : missingIssues.filter((k) => severity(k) === 'high'),
    falseStrong: extraIssues.length > 0 && read.confidence === 'HIGH',
  };
}

export type EvalSummary = {
  total: number;
  exact: number;
  sentimentCorrect: number;
  sentimentReversals: number;
  /** Of the examples labelled MIXED, how many were read as MIXED. */
  mixed: { total: number; correct: number };
  /** Of the rating/text conflict examples, how many were fully right. */
  ratingConflicts: { total: number; exact: number };
  /** Over topics, not examples. */
  praise: { expected: number; found: number; invented: number; predicted: number };
  issues: { expected: number; found: number; invented: number; predicted: number };
  prohibitedViolations: number;
  wrongPolarity: number;
  falseStrong: number;
  /** Under-escalated: labelled for a second reader, kept by the router. */
  underEscalated: number;
  /** Over-escalated: explicit wording sent to a second reader anyway. Costs money, not accuracy. */
  overEscalated: number;
  misses: number;
  escalatedMisses: number;
  silentMisses: number;
  silentSeriousMisses: number;
  byPack: Record<string, { total: number; exact: number }>;
  byCategory: Record<string, { total: number; exact: number }>;
};

export function summarise(examples: EvalExample[], results: ExampleResult[]): EvalSummary {
  const byId = new Map(examples.map((e) => [e.id, e]));
  const tally = (key: (r: ExampleResult) => string) => {
    const out: Record<string, { total: number; exact: number }> = {};
    for (const r of results) {
      const bucket = (out[key(r)] ??= { total: 0, exact: 0 });
      bucket.total += 1;
      if (r.exact) bucket.exact += 1;
    }
    return out;
  };
  const sum = (f: (r: ExampleResult) => number) => results.reduce((n, r) => n + f(r), 0);
  const scoped = results.map((r) => byId.get(r.id)!);
  const expectedPraise = scoped.reduce((n, e) => n + e.expected.praise.length, 0);
  const expectedIssues = scoped.reduce((n, e) => n + e.expected.issues.length, 0);
  const misses = results.filter((r) => !r.exact);
  const mixedLabelled = results.filter((r) => byId.get(r.id)!.expected.sentiment === 'MIXED');
  const conflicts = results.filter((r) => r.category === 'rating_disagrees');

  return {
    total: results.length,
    exact: results.filter((r) => r.exact).length,
    sentimentCorrect: results.filter((r) => r.sentimentOk).length,
    sentimentReversals: results.filter((r) => r.sentimentReversed).length,
    mixed: { total: mixedLabelled.length, correct: mixedLabelled.filter((r) => r.sentimentOk).length },
    ratingConflicts: { total: conflicts.length, exact: conflicts.filter((r) => r.exact).length },
    praise: {
      expected: expectedPraise,
      found: expectedPraise - sum((r) => r.missingPraise.length),
      invented: sum((r) => r.extraPraise.length),
      predicted: sum((r) => r.predicted.praise.length),
    },
    issues: {
      expected: expectedIssues,
      found: expectedIssues - sum((r) => r.missingIssues.length),
      invented: sum((r) => r.extraIssues.length),
      predicted: sum((r) => r.predicted.issues.length),
    },
    prohibitedViolations: sum((r) => r.prohibitedHit.length),
    wrongPolarity: sum((r) => r.wrongPolarity.length),
    falseStrong: results.filter((r) => r.falseStrong).length,
    underEscalated: results.filter((r) => byId.get(r.id)!.expected.routing === 'AI' && r.predicted.routing === 'KEYWORD').length,
    overEscalated: results.filter((r) => byId.get(r.id)!.expected.routing === 'KEYWORD' && r.predicted.routing === 'AI').length,
    misses: misses.length,
    escalatedMisses: misses.filter((r) => !r.silentMiss).length,
    silentMisses: misses.filter((r) => r.silentMiss).length,
    silentSeriousMisses: sum((r) => r.silentSeriousMiss.length),
    byPack: tally((r) => r.pack),
    byCategory: tally((r) => r.category),
  };
}

/** One line per miss, for the audit document and for a failing test's message. */
export function describeMiss(r: ExampleResult): string {
  const parts: string[] = [];
  if (!r.sentimentOk) parts.push(`sentiment ${r.predicted.sentiment}`);
  if (r.missingIssues.length) parts.push(`missed problem ${r.missingIssues.join('+')}`);
  if (r.missingPraise.length) parts.push(`missed praise ${r.missingPraise.join('+')}`);
  if (r.extraIssues.length) parts.push(`invented problem ${r.extraIssues.join('+')}`);
  if (r.extraPraise.length) parts.push(`invented praise ${r.extraPraise.join('+')}`);
  if (r.prohibitedHit.length) parts.push(`PROHIBITED ${r.prohibitedHit.join('+')}`);
  return `${r.id} [${r.predicted.routing}] ${parts.join('; ')}`;
}
