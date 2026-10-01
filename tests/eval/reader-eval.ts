import { getPackOrFallback, type Pack } from '@/lib/packs';
import type { EvalSentiment } from './semantic-dataset';
import type { V2Example } from './semantic-v2';

/**
 * SCORING ANY READER AGAINST THE SAME GOLD LABELS.
 *
 * A "reading" is what a reader said about one response: an overall
 * sentiment, the praise and problem topics, a confidence, and whether it
 * declined to classify. The deterministic reader, the AI reader and the
 * combined reader are all turned into readings and scored here by one set of
 * rules, so their numbers can be put side by side honestly.
 *
 * Pure: no network, no database, no clock.
 */

export type Reading = {
  sentiment: string;
  praise: string[];
  issues: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  /** The reader explicitly declined, or named nothing. */
  abstained: boolean;
};

export type Scored = {
  id: string;
  pack: string;
  category: string;
  text: string;
  reading: Reading;
  sentimentOk: boolean;
  reversed: boolean;
  correct: string[];
  missing: string[];
  /** Predicted, not expected, not tolerated. Includes forbidden and traps. */
  invented: string[];
  /** Predicted topics the label forbids outright. */
  forbidden: string[];
  /** Predicted topics that pin on the business what someone else did. */
  misattributed: string[];
  /** A topic on the wrong side of the same concept. */
  wrongPolarity: string[];
  /** Predicted and tolerated: neither right nor wrong. */
  toleratedHits: string[];
  exact: boolean;
  /**
   * A mixed response read as one-sided, or a one-sided response read as
   * mixed, where the label does not accept it.
   */
  mixedError: boolean;
  /** HIGH confidence on a reading that invents, reverses, misattributes or gets mixed wrong. */
  falseHigh: boolean;
  abstained: boolean;
  /** Labelled "abstain", and the reader named nothing it should not have. */
  abstainedCorrectly: boolean | null;
};

const counterpartOf = (pack: Pack, key: string) =>
  pack.issueTaxonomy.find((e) => e.key === key)?.counterpart ?? null;

export function scoreReading(example: V2Example, reading: Reading): Scored {
  const pack = getPackOrFallback(example.pack);
  const e = example.expected;
  const accept = new Set<EvalSentiment>([e.sentiment, ...(e.alsoAccept ?? [])]);
  const tolerated = new Set(e.tolerated ?? []);
  const prohibited = new Set(e.prohibited ?? []);
  const traps = new Set(example.traps);

  const predicted = [...reading.praise.map((k) => ({ k, side: 'P' as const })), ...reading.issues.map((k) => ({ k, side: 'I' as const }))];
  const expectedOf = (side: 'P' | 'I') => (side === 'P' ? e.praise : e.issues);

  const correct = predicted.filter((p) => expectedOf(p.side).includes(p.k)).map((p) => p.k);
  const missing = [...e.praise.filter((k) => !reading.praise.includes(k)), ...e.issues.filter((k) => !reading.issues.includes(k))];
  const toleratedHits = predicted.filter((p) => !expectedOf(p.side).includes(p.k) && tolerated.has(p.k) && !prohibited.has(p.k)).map((p) => p.k);
  const invented = predicted
    .filter((p) => !expectedOf(p.side).includes(p.k) && !(tolerated.has(p.k) && !prohibited.has(p.k)))
    .map((p) => p.k);
  const forbidden = predicted.filter((p) => prohibited.has(p.k)).map((p) => p.k);
  const misattributed = predicted.filter((p) => traps.has(p.k)).map((p) => p.k);
  const wrongPolarity = [
    ...reading.issues.filter((k) => {
      const c = counterpartOf(pack, k);
      return c !== null && e.praise.includes(c) && !e.issues.includes(k) && !tolerated.has(k);
    }),
    ...reading.praise.filter((p) => e.issues.some((k) => counterpartOf(pack, k) === p) && !e.praise.includes(p) && !tolerated.has(p)),
  ];

  const sentimentOk = accept.has(reading.sentiment as EvalSentiment);
  const reversed =
    (e.sentiment === 'POSITIVE' && reading.sentiment === 'NEGATIVE' && !accept.has('NEGATIVE')) ||
    (e.sentiment === 'NEGATIVE' && reading.sentiment === 'POSITIVE' && !accept.has('POSITIVE'));
  const mixedError = !sentimentOk && (e.sentiment === 'MIXED' || reading.sentiment === 'MIXED');
  const exact = sentimentOk && missing.length === 0 && invented.length === 0;
  const abstained = reading.abstained || predicted.length === 0;

  return {
    id: example.id,
    pack: example.pack,
    category: example.category,
    text: example.text,
    reading,
    sentimentOk,
    reversed,
    correct,
    missing,
    invented,
    forbidden,
    misattributed,
    wrongPolarity,
    toleratedHits,
    exact,
    mixedError,
    falseHigh: reading.confidence === 'HIGH' && (invented.length > 0 || reversed || wrongPolarity.length > 0 || misattributed.length > 0 || mixedError),
    abstained,
    abstainedCorrectly: example.abstain ? invented.length === 0 && correct.length === 0 : null,
  };
}

export type ReaderSummary = {
  total: number;
  exact: number;
  sentimentCorrect: number;
  reversals: number;
  mixed: { total: number; correct: number };
  topics: { expected: number; predicted: number; correct: number; tolerated: number; invented: number };
  /** correct / (predicted − tolerated) */
  precision: number;
  /** correct / expected */
  recall: number;
  /** correct / (correct + wrong side of the same concept) */
  polarityAccuracy: number;
  wrongPolarity: number;
  /** Examples with at least one invented topic. */
  inventingExamples: number;
  /** Examples with a trap, and how many of them were misattributed. */
  attribution: { withTraps: number; misattributed: number };
  forbidden: number;
  highConfidence: number;
  falseHigh: number;
  abstained: number;
  abstainLabelled: { total: number; correct: number };
  /** Abstained where the label expected a topic. */
  overAbstained: number;
};

const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);

export function summariseReader(examples: V2Example[], scored: Scored[]): ReaderSummary {
  const byId = new Map(examples.map((e) => [e.id, e]));
  const sum = (f: (s: Scored) => number) => scored.reduce((n, s) => n + f(s), 0);
  const expected = sum((s) => byId.get(s.id)!.expected.praise.length + byId.get(s.id)!.expected.issues.length);
  const predicted = sum((s) => s.reading.praise.length + s.reading.issues.length);
  const correct = sum((s) => s.correct.length);
  const tolerated = sum((s) => s.toleratedHits.length);
  const invented = sum((s) => s.invented.length);
  const wrongPolarity = sum((s) => s.wrongPolarity.length);
  const mixed = scored.filter((s) => byId.get(s.id)!.expected.sentiment === 'MIXED');
  const withTraps = scored.filter((s) => byId.get(s.id)!.traps.length > 0);
  const abstainLabelled = scored.filter((s) => s.abstainedCorrectly !== null);
  const high = scored.filter((s) => s.reading.confidence === 'HIGH');

  return {
    total: scored.length,
    exact: scored.filter((s) => s.exact).length,
    sentimentCorrect: scored.filter((s) => s.sentimentOk).length,
    reversals: scored.filter((s) => s.reversed).length,
    mixed: { total: mixed.length, correct: mixed.filter((s) => s.sentimentOk).length },
    topics: { expected, predicted, correct, tolerated, invented },
    precision: ratio(correct, predicted - tolerated),
    recall: ratio(correct, expected),
    polarityAccuracy: ratio(correct, correct + wrongPolarity),
    wrongPolarity,
    inventingExamples: scored.filter((s) => s.invented.length > 0).length,
    attribution: { withTraps: withTraps.length, misattributed: withTraps.filter((s) => s.misattributed.length > 0).length },
    forbidden: sum((s) => s.forbidden.length),
    highConfidence: high.length,
    falseHigh: high.filter((s) => s.falseHigh).length,
    abstained: scored.filter((s) => s.abstained).length,
    abstainLabelled: { total: abstainLabelled.length, correct: abstainLabelled.filter((s) => s.abstainedCorrectly).length },
    overAbstained: scored.filter((s) => s.abstained && byId.get(s.id)!.expected.praise.length + byId.get(s.id)!.expected.issues.length > 0).length,
  };
}

/** One line per miss: what was wrong and what the reader said. */
export function explain(s: Scored): string {
  const bits: string[] = [];
  if (!s.sentimentOk) bits.push(`sentiment ${s.reading.sentiment}`);
  if (s.missing.length) bits.push(`missed ${s.missing.join('+')}`);
  if (s.misattributed.length) bits.push(`MISATTRIBUTED ${s.misattributed.join('+')}`);
  const plainInvented = s.invented.filter((k) => !s.misattributed.includes(k));
  if (plainInvented.length) bits.push(`invented ${plainInvented.join('+')}`);
  if (s.wrongPolarity.length) bits.push(`WRONG-SIDE ${s.wrongPolarity.join('+')}`);
  return `${s.id} [${s.category}] ${bits.join('; ')} | p=${s.reading.praise.join(',')} i=${s.reading.issues.join(',')} conf=${s.reading.confidence} | ${s.text.slice(0, 80)}`;
}

/** A compact line for a summary, used by the exploration and the audit. */
export function line(name: string, s: ReaderSummary): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `${name}: exact ${s.exact}/${s.total}`,
    `sent ${s.sentimentCorrect}/${s.total}`,
    `rev ${s.reversals}`,
    `mixed ${s.mixed.correct}/${s.mixed.total}`,
    `P ${pct(s.precision)} R ${pct(s.recall)}`,
    `polarity ${pct(s.polarityAccuracy)} (wrong ${s.wrongPolarity})`,
    `invented ${s.topics.invented} in ${s.inventingExamples} ex`,
    `misattrib ${s.attribution.misattributed}/${s.attribution.withTraps}`,
    `forbidden ${s.forbidden}`,
    `falseHigh ${s.falseHigh}/${s.highConfidence}`,
    `abstained ${s.abstained} (correct ${s.abstainLabelled.correct}/${s.abstainLabelled.total}, over ${s.overAbstained})`,
  ].join(' | ');
}
