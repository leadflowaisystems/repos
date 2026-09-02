import type { Pack, TaxonomyEntry } from '@/lib/packs';

/**
 * Local, deterministic keyword classifier.
 *
 * Two jobs:
 *  1. It is the classifier when no AI provider is configured, so RepOS is fully
 *     usable offline.
 *  2. It is the validator for AI output — any tag the model returns that is not
 *     in the vertical taxonomy is discarded (see `sanitiseTags`).
 *
 * It never produces counts. Counting happens in aggregate.ts.
 */

export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL' | 'UNKNOWN';

export type Classification = {
  issueTags: string[];
  praiseTags: string[];
  sentiment: Sentiment;
};

const regexCache = new Map<string, RegExp>();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when every character is ASCII, which decides whether word-boundary
 * matching is safe. Written as a code-point scan rather than a regex: a
 * control-character range in a literal is unreadable and lint-flagged.
 */
function isAsciiHint(hint: string): boolean {
  for (let i = 0; i < hint.length; i += 1) {
    if (hint.charCodeAt(i) > 127) return false;
  }
  return true;
}

/** Negators that appear BEFORE the thing they negate (English, romanised). */
const PRE_NEGATORS = /(?:\b(?:not|no|never|without|n't|nahi|nahin|nai)\s+|\bdidn'?t\s+|\bdoesn'?t\s+|\bwasn'?t\s+|\bisn'?t\s+)$/i;

/** Negators that appear AFTER the thing they negate (Hindi/Marathi order). */
const POST_NEGATORS = /^\s*(?:नाही|नव्हते|नाहीत|नहीं|नही|ना\b|nahi\b|nahin\b|nai\b)/i;

/**
 * Negators strong enough to flip anything later in the same clause.
 *
 * "Nobody at the desk explained why" sits too far from "explained" for the
 * adjacent check above, but nothing after "nobody" in that clause is a
 * compliment. Deliberately narrow: a bare "not" is excluded, because
 * "not only was the staff friendly" is praise.
 */
const CLAUSE_NEGATORS =
  /\b(?:nobody|no one|noone|never|didn'?t|did not|doesn'?t|does not|wasn'?t|was not|weren'?t|were not|isn'?t|is not|hasn'?t|has not|haven'?t|have not|won'?t|will not|refused to|failed to|forgot to)\b/i;

/** Clause boundaries, so a negator does not leak into the next thought. */
const CLAUSE_BREAK = /[.!?;,\n]|\b(?:and|but|though|although|however)\b/gi;

/** Where the clause containing `idx` starts. */
function clauseStart(lowerText: string, idx: number): number {
  CLAUSE_BREAK.lastIndex = 0;
  let start = 0;
  let m: RegExpExecArray | null = CLAUSE_BREAK.exec(lowerText);
  while (m !== null && m.index < idx) {
    start = m.index + m[0].length;
    m = CLAUSE_BREAK.exec(lowerText);
  }
  return start;
}

/** Index of `hint` inside `lowerText`, or -1. */
function findHint(hint: string, lowerText: string): number {
  const needle = hint.toLowerCase().trim();
  if (needle.length === 0) return -1;

  if (!isAsciiHint(needle)) {
    // Devanagari and other non-Latin scripts: plain substring is correct,
    // word boundaries are unreliable.
    return lowerText.indexOf(needle);
  }

  let re = regexCache.get(needle);
  if (!re) {
    re = new RegExp(`(?:^|[^a-z0-9])(${escapeRegex(needle)})(?:[^a-z0-9]|$)`, 'i');
    regexCache.set(needle, re);
  }
  const m = re.exec(lowerText);
  if (!m || m[1] === undefined) return -1;
  return m.index + m[0].indexOf(m[1]);
}

/**
 * True when the hint occurs and is not negated.
 *
 * "the place was not clean" must not count as a cleanliness compliment, and
 * "उशीर झाला नाही" ("there was no delay") must not count as a delay complaint.
 */
export function hintMatches(hint: string, lowerText: string): boolean {
  const idx = findHint(hint, lowerText);
  if (idx === -1) return false;

  const before = lowerText.slice(Math.max(0, idx - 16), idx);
  if (PRE_NEGATORS.test(before)) return false;

  const after = lowerText.slice(idx + hint.trim().length, idx + hint.trim().length + 16);
  if (POST_NEGATORS.test(after)) return false;

  // A strong negator earlier in the same clause counts too.
  if (CLAUSE_NEGATORS.test(lowerText.slice(clauseStart(lowerText, idx), idx))) return false;

  return true;
}

function matchTaxonomy(entries: TaxonomyEntry[], lowerText: string): string[] {
  const hits: string[] = [];
  for (const entry of entries) {
    if (entry.hints.some((h) => hintMatches(h, lowerText))) {
      hits.push(entry.key);
    }
  }
  return hits;
}

const NEGATIVE_WORDS = [
  'bad','worst','poor','terrible','awful','horrible','disappoint','disappointed',
  'never again','waste','avoid','pathetic','rude','dirty','slow','late','wrong',
  'refuse','refused','cheat','fraud','scam','unhappy','angry','complaint',
  'bekar','kharab','ganda','galat','bura','faltu',
  'वाईट','खराब','नको','चुकीचे','घाण','निराश','बेकार','गंदा','बुरा','धोका',
];

const POSITIVE_WORDS = [
  'good','great','excellent','amazing','best','wonderful','love','loved','happy',
  'satisfied','recommend','recommended','friendly','clean','helpful','perfect',
  'thank','thanks','fantastic','superb','awesome','nice',
  'accha','acha','achha','mast','badhiya','shandar',
  'छान','चांगले','उत्तम','सुंदर','आवडले','धन्यवाद','अच्छा','बढ़िया','शानदार',
];

/**
 * Counts plain positive and negative wording. Exported so the normalization
 * layer can use it as a fallback when nothing matched the vertical taxonomy.
 */
export function keywordPolarity(lowerText: string): { neg: number; pos: number } {
  let neg = 0;
  let pos = 0;
  for (const w of NEGATIVE_WORDS) if (hintMatches(w, lowerText)) neg += 1;
  for (const w of POSITIVE_WORDS) if (hintMatches(w, lowerText)) pos += 1;
  return { neg, pos };
}

/**
 * Sentiment for one review.
 *
 * A supplied star rating always wins — it is the reviewer's own verdict and
 * carries far more signal than any keyword heuristic.
 */
export function deriveSentiment(
  stars: number | null,
  issueTags: string[],
  praiseTags: string[],
  text: string,
): Sentiment {
  if (stars !== null) {
    if (stars >= 4) return issueTags.length > 0 ? 'MIXED' : 'POSITIVE';
    if (stars <= 2) return praiseTags.length > 0 ? 'MIXED' : 'NEGATIVE';
    return 'MIXED';
  }

  if (issueTags.length > 0 && praiseTags.length > 0) return 'MIXED';
  if (issueTags.length > 0) return 'NEGATIVE';
  if (praiseTags.length > 0) return 'POSITIVE';

  const { neg, pos } = keywordPolarity(text.toLowerCase());
  if (neg > pos) return 'NEGATIVE';
  if (pos > neg) return 'POSITIVE';
  if (pos > 0 && neg > 0) return 'MIXED';
  return 'NEUTRAL';
}

/** Classifies one review against the vertical taxonomy, with no AI involved. */
export function classifyByKeywords(
  text: string,
  stars: number | null,
  pack: Pack,
): Classification {
  const lower = text.toLowerCase();
  const issueTags = matchTaxonomy(pack.issueTaxonomy, lower);
  const praiseTags = matchTaxonomy(pack.praiseTaxonomy, lower);
  return {
    issueTags,
    praiseTags,
    sentiment: deriveSentiment(stars, issueTags, praiseTags, text),
  };
}

/**
 * Keeps only tags that exist in this vertical's taxonomy, de-duplicated and in
 * taxonomy order. Everything an AI provider returns passes through here, so a
 * hallucinated tag can never reach the database or a count.
 */
export function sanitiseTags(
  candidate: unknown,
  entries: TaxonomyEntry[],
): string[] {
  if (!Array.isArray(candidate)) return [];
  const valid = new Set(entries.map((e) => e.key));
  const seen = new Set<string>();
  for (const raw of candidate) {
    if (typeof raw !== 'string') continue;
    const key = raw.trim();
    if (valid.has(key)) seen.add(key);
  }
  return entries.filter((e) => seen.has(e.key)).map((e) => e.key);
}

const SENTIMENTS: Sentiment[] = [
  'POSITIVE',
  'NEGATIVE',
  'MIXED',
  'NEUTRAL',
  'UNKNOWN',
];

export function sanitiseSentiment(candidate: unknown): Sentiment | null {
  if (typeof candidate !== 'string') return null;
  const upper = candidate.trim().toUpperCase() as Sentiment;
  return SENTIMENTS.includes(upper) ? upper : null;
}
