import { readFileSync } from 'node:fs';
import { getPackOrFallback } from '@/lib/packs';
import type { EvalSentiment } from '../semantic-dataset';
import type { V2Example } from '../semantic-v2';
import type { Reading, Scored } from '../reader-eval';

/**
 * THE CAFÉ EVALUATION (café handover pass, October 2026).
 *
 * The café corpus is labelled in MEANING, not in taxonomy keys: each example
 * names the café concepts a careful reader would take from it ("coffee served
 * cold" → `temperature_served-`), with their polarity. The labels were written
 * by one annotator, labelled again blind by a second, and reconciled by a
 * third; no reader output was consulted.
 *
 * Meaning labels survive a taxonomy change. `CONCEPT_MAP` translates each
 * concept into the restaurant pack's topic keys, and every example becomes an
 * ordinary `V2Example` scored by `reader-eval.ts` — the same rules that score
 * every other vertical. A concept with no topic in the pack is a TAXONOMY GAP:
 * it is reported, never scored as a miss, and never makes a topic acceptable.
 *
 * The map is part of the measurement. It is fixed before a blind set is run,
 * and changing it after seeing a blind result would be tuning against it.
 */

export type CafeSentiment = EvalSentiment;

export type CafeExample = {
  id: string;
  text: string;
  stars: number | null;
  lang: string;
  categories: string[];
  sentiment: CafeSentiment;
  alsoSentiment: CafeSentiment[];
  /** "<concept><+|->": what a careful reader must take from the words. */
  must: string[];
  /** Defensible either way: neither required nor an error. */
  ok: string[];
  /** A wrong reading: a reversal, or something the words do not support. */
  never: string[];
  /** Pins on the café what a third party, another customer or a circumstance did. */
  traps: string[];
  abstain: boolean;
  ratingConflict: boolean;
  note: string;
};

export const CONCEPTS = [
  'food_taste', 'drink_quality', 'freshness', 'temperature_served', 'portion', 'seasoning', 'texture', 'presentation',
  'menu_variety', 'food_safety',
  'staff_friendliness', 'attentiveness', 'professionalism', 'order_accuracy', 'service_speed', 'table_wait',
  'billing_accuracy', 'payment', 'refund', 'reservation', 'delivery_takeaway',
  'cleanliness', 'ambience', 'music', 'noise', 'smell', 'lighting', 'seating_comfort', 'crowding', 'ac_temperature',
  'wifi_workspace',
  'price', 'value_for_money', 'offers',
  'return_intent', 'recommend_intent',
] as const;
export type Concept = (typeof CONCEPTS)[number];

/** Where each concept lives in the restaurant pack: the problem key (−) and the praise key (+). Null: no home. */
export type ConceptMap = Record<Concept, { neg: string | null; pos: string | null }>;

/**
 * THE CAFÉ TAXONOMY MAP (restaurant pack, café handover pass).
 *
 * Written against packs/restaurant.json as it stands after the café taxonomy
 * change, before any blind set was run.
 */
export const CONCEPT_MAP: ConceptMap = {
  food_taste: { neg: 'food_quality', pos: 'food_taste' },
  drink_quality: { neg: 'drink_quality', pos: 'drink_praise' },
  freshness: { neg: 'food_quality', pos: 'food_taste' },
  temperature_served: { neg: 'served_cold', pos: null },
  portion: { neg: 'portion_size', pos: 'generous_portions' },
  seasoning: { neg: 'food_quality', pos: 'food_taste' },
  texture: { neg: 'food_quality', pos: 'food_taste' },
  presentation: { neg: 'food_quality', pos: 'food_taste' },
  menu_variety: { neg: null, pos: 'menu_variety' },
  food_safety: { neg: 'cleanliness', pos: null },
  staff_friendliness: { neg: 'staff_behaviour', pos: 'staff_warmth' },
  attentiveness: { neg: 'staff_behaviour', pos: 'service_quality' },
  professionalism: { neg: 'staff_behaviour', pos: 'service_quality' },
  order_accuracy: { neg: 'order_accuracy', pos: 'service_quality' },
  service_speed: { neg: 'service_speed', pos: 'service_quality' },
  table_wait: { neg: 'wait_for_table', pos: null },
  billing_accuracy: { neg: 'billing_issue', pos: null },
  payment: { neg: 'billing_issue', pos: null },
  refund: { neg: 'billing_issue', pos: null },
  reservation: { neg: 'wait_for_table', pos: null },
  delivery_takeaway: { neg: 'delivery_packaging', pos: null },
  cleanliness: { neg: 'cleanliness', pos: 'cleanliness_praise' },
  ambience: { neg: 'ambience_noise', pos: 'ambience' },
  music: { neg: 'ambience_noise', pos: 'ambience' },
  noise: { neg: 'ambience_noise', pos: 'ambience' },
  smell: { neg: 'cleanliness', pos: 'ambience' },
  lighting: { neg: 'ambience_noise', pos: 'ambience' },
  seating_comfort: { neg: 'ambience_noise', pos: 'ambience' },
  crowding: { neg: 'ambience_noise', pos: null },
  ac_temperature: { neg: 'ambience_noise', pos: 'ambience' },
  wifi_workspace: { neg: null, pos: null },
  price: { neg: 'pricing_value', pos: 'value_for_money' },
  value_for_money: { neg: 'pricing_value', pos: 'value_for_money' },
  offers: { neg: 'billing_issue', pos: 'value_for_money' },
  return_intent: { neg: null, pos: null },
  recommend_intent: { neg: null, pos: null },
};

const PARSE = /^([a-z_]+)([+-])$/;

export function parseLabel(label: string): { concept: Concept; sign: '+' | '-' } {
  const m = PARSE.exec(label.trim());
  if (!m || !(CONCEPTS as readonly string[]).includes(m[1]!)) throw new Error(`Unknown café label "${label}"`);
  return { concept: m[1] as Concept, sign: m[2] as '+' | '-' };
}

/** The pack key a label lands on, with its side; null when the concept has no home on that side. */
export function mapLabel(label: string, map: ConceptMap = CONCEPT_MAP): { key: string; side: 'P' | 'I' } | null {
  const { concept, sign } = parseLabel(label);
  const key = sign === '+' ? map[concept].pos : map[concept].neg;
  return key ? { key, side: sign === '+' ? 'P' : 'I' } : null;
}

export type Converted = {
  v2: V2Example;
  /** Must-labels whose concept has no topic on that side in the pack. */
  gaps: string[];
};

/**
 * One café example as an ordinary scored example.
 *
 * A key that is both expected and forbidden (two concepts sharing a topic,
 * one supported and one not) is expected: the topic is right, whatever the
 * finer concept. A tolerated key is never also forbidden.
 */
export function toV2(e: CafeExample, map: ConceptMap = CONCEPT_MAP): Converted {
  const pack = getPackOrFallback('restaurant');
  const keys = new Set([...pack.issueTaxonomy, ...pack.praiseTaxonomy].map((t) => t.key));
  const praise = new Set<string>();
  const issues = new Set<string>();
  const gaps: string[] = [];
  for (const l of e.must) {
    const m = mapLabel(l, map);
    if (!m) {
      gaps.push(l);
      continue;
    }
    if (!keys.has(m.key)) throw new Error(`CONCEPT_MAP names "${m.key}", which packs/restaurant.json does not declare`);
    (m.side === 'P' ? praise : issues).add(m.key);
  }
  const expected = new Set([...praise, ...issues]);
  const tolerated = new Set<string>();
  for (const l of e.ok) {
    const m = mapLabel(l, map);
    if (m && !expected.has(m.key)) tolerated.add(m.key);
  }
  const prohibited = new Set<string>();
  for (const l of e.never) {
    const m = mapLabel(l, map);
    if (m && !expected.has(m.key) && !tolerated.has(m.key)) prohibited.add(m.key);
  }
  const traps = new Set<string>();
  for (const l of e.traps) {
    const m = mapLabel(l, map);
    if (m && !expected.has(m.key) && !tolerated.has(m.key)) traps.add(m.key);
  }
  return {
    gaps,
    v2: {
      id: e.id,
      pack: 'restaurant',
      category: (e.categories[0] ?? 'positive') as V2Example['category'],
      text: e.text,
      stars: e.stars,
      set: 'DEV',
      traps: [...traps],
      abstain: e.abstain,
      expected: {
        sentiment: e.sentiment,
        alsoAccept: e.alsoSentiment,
        praise: [...praise],
        issues: [...issues],
        tolerated: [...tolerated],
        prohibited: [...prohibited, ...traps],
        dimensions: [],
        routing: 'KEYWORD',
      },
    },
  };
}

export function loadCafeSet(path: string): CafeExample[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as CafeExample[];
  const seen = new Set<string>();
  for (const e of raw) {
    if (seen.has(e.id)) throw new Error(`Duplicate café example id ${e.id}`);
    seen.add(e.id);
    for (const l of [...e.must, ...e.ok, ...e.never, ...e.traps]) parseLabel(l);
  }
  return raw;
}

/**
 * THE UNSAFE ERRORS — what would show a café owner something false.
 *
 *   reversal        the overall tone the wrong way round, or a topic on the
 *                   wrong side of its own concept
 *   misattribution  the café blamed for what someone else did
 *   inventedIssue   a problem the words do not support
 *   inventedPraise  praise the words do not support
 *
 * A missed topic is not unsafe: the reader said less, not something false.
 */
export type Unsafe = {
  reversal: boolean;
  misattribution: boolean;
  inventedIssue: string[];
  inventedPraise: string[];
};

export function unsafeOf(s: Scored): Unsafe {
  const plain = s.invented.filter((k) => !s.misattributed.includes(k) && !s.wrongPolarity.includes(k));
  return {
    reversal: s.reversed || s.wrongPolarity.length > 0,
    misattribution: s.misattributed.length > 0,
    inventedIssue: plain.filter((k) => s.reading.issues.includes(k)),
    inventedPraise: plain.filter((k) => s.reading.praise.includes(k)),
  };
}

export const isUnsafe = (u: Unsafe) => u.reversal || u.misattribution || u.inventedIssue.length > 0 || u.inventedPraise.length > 0;

export type CafeSummary = {
  total: number;
  exact: number;
  sentimentCorrect: number;
  /** Topic precision: correct / (predicted − tolerated). */
  precision: number;
  /** Topic recall over representable must-labels. */
  recall: number;
  /** Non-abstain examples where the reader named at least one correct topic. */
  coverage: number;
  abstained: number;
  abstainLabelled: { total: number; correct: number };
  mixed: { total: number; correct: number };
  unsafe: { any: number; high: number; medium: number; low: number; reversal: number; misattribution: number; inventedIssue: number; inventedPraise: number };
  attribution: { withTraps: number; misattributed: number };
  gaps: number;
};

export function summariseCafe(conv: Converted[], scored: Scored[]): CafeSummary {
  const byId = new Map(conv.map((c) => [c.v2.id, c]));
  let expected = 0;
  let predicted = 0;
  let correct = 0;
  let tolerated = 0;
  let covered = 0;
  let coverable = 0;
  const u = { any: 0, high: 0, medium: 0, low: 0, reversal: 0, misattribution: 0, inventedIssue: 0, inventedPraise: 0 };
  for (const s of scored) {
    const c = byId.get(s.id)!;
    expected += c.v2.expected.praise.length + c.v2.expected.issues.length;
    predicted += s.reading.praise.length + s.reading.issues.length;
    correct += s.correct.length;
    tolerated += s.toleratedHits.length;
    if (!c.v2.abstain && c.v2.expected.praise.length + c.v2.expected.issues.length > 0) {
      coverable += 1;
      if (s.correct.length > 0) covered += 1;
    }
    const x = unsafeOf(s);
    if (isUnsafe(x)) {
      u.any += 1;
      if (s.reading.confidence === 'HIGH') u.high += 1;
      else if (s.reading.confidence === 'MEDIUM') u.medium += 1;
      else u.low += 1;
    }
    if (x.reversal) u.reversal += 1;
    if (x.misattribution) u.misattribution += 1;
    u.inventedIssue += x.inventedIssue.length;
    u.inventedPraise += x.inventedPraise.length;
  }
  const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);
  const mixed = scored.filter((s) => byId.get(s.id)!.v2.expected.sentiment === 'MIXED');
  const withTraps = scored.filter((s) => byId.get(s.id)!.v2.traps.length > 0);
  const abstainLabelled = scored.filter((s) => s.abstainedCorrectly !== null);
  return {
    total: scored.length,
    exact: scored.filter((s) => s.exact).length,
    sentimentCorrect: scored.filter((s) => s.sentimentOk).length,
    precision: ratio(correct, predicted - tolerated),
    recall: ratio(correct, expected),
    coverage: ratio(covered, coverable),
    abstained: scored.filter((s) => s.abstained).length,
    abstainLabelled: { total: abstainLabelled.length, correct: abstainLabelled.filter((s) => s.abstainedCorrectly).length },
    mixed: { total: mixed.length, correct: mixed.filter((s) => s.sentimentOk).length },
    unsafe: u,
    attribution: { withTraps: withTraps.length, misattributed: withTraps.filter((s) => s.misattributed.length > 0).length },
    gaps: conv.reduce((n, c) => n + c.gaps.length, 0),
  };
}

/** Per category tag and per language: exact, unsafe. A tag counts every example carrying it. */
export function breakdown(examples: CafeExample[], scored: Scored[]): Array<{ group: string; n: number; exact: number; unsafe: number; sentiment: number }> {
  const byId = new Map(scored.map((s) => [s.id, s]));
  const groups = new Map<string, { n: number; exact: number; unsafe: number; sentiment: number }>();
  const add = (g: string, s: Scored) => {
    const r = groups.get(g) ?? { n: 0, exact: 0, unsafe: 0, sentiment: 0 };
    r.n += 1;
    if (s.exact) r.exact += 1;
    if (s.sentimentOk) r.sentiment += 1;
    if (isUnsafe(unsafeOf(s))) r.unsafe += 1;
    groups.set(g, r);
  };
  for (const e of examples) {
    const s = byId.get(e.id);
    if (!s) continue;
    for (const c of new Set(e.categories)) add(`cat:${c}`, s);
    add(`lang:${e.lang}`, s);
  }
  return [...groups.entries()].map(([group, r]) => ({ group, ...r })).sort((a, b) => a.group.localeCompare(b.group));
}

export function cafeLine(name: string, s: CafeSummary): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `${name}: exact ${s.exact}/${s.total}`,
    `sentiment ${s.sentimentCorrect}/${s.total}`,
    `P ${pct(s.precision)} R ${pct(s.recall)} coverage ${pct(s.coverage)}`,
    `mixed ${s.mixed.correct}/${s.mixed.total}`,
    `UNSAFE ${s.unsafe.any} (HIGH ${s.unsafe.high}, MED ${s.unsafe.medium}, LOW ${s.unsafe.low}; reversal ${s.unsafe.reversal}, misattrib ${s.unsafe.misattribution}, invented issue ${s.unsafe.inventedIssue}, invented praise ${s.unsafe.inventedPraise})`,
    `abstained ${s.abstained} (labelled ${s.abstainLabelled.correct}/${s.abstainLabelled.total})`,
    `gaps ${s.gaps}`,
  ].join(' | ');
}

export type { Reading };
