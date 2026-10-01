import type { Pack } from '@/lib/packs';
import {
  classifyByKeywords,
  deriveSentiment,
  sanitiseSentiment,
  sanitiseTags,
  type Classification,
} from '@/lib/analysis/classify';
import type { AiSuggestion, AiTopicSuggestion } from '@/lib/analysis/normalize';
import { runCompletion } from './index';
import { estimateTokens } from './budget';
import { extractJson } from './types';

/**
 * Per-review classification.
 *
 * This is the one job an LLM is genuinely better at than keywords: reading a
 * mixed English/Hinglish/Marathi sentence and deciding which taxonomy buckets
 * it belongs in. It still produces no numbers — only tags, which are then
 * filtered against the vertical taxonomy and counted in deterministic code.
 *
 * The text passed here is already redacted (see src/lib/redact.ts), so no
 * customer PII ever reaches a provider.
 */

const BATCH_SIZE = 10;

/** The parameters every classification call uses; the evaluation harness imports these so it measures exactly what production sends. */
export const CLASSIFY_BATCH_SIZE = BATCH_SIZE;
export const CLASSIFY_MAX_OUTPUT_TOKENS = 4000;
/**
 * Reasoning effort for models that have the setting (gpt-oss). Chosen on the
 * café evaluation: see docs/CAFE_HANDOVER_2026-10.md.
 */
export const CLASSIFY_REASONING_EFFORT: 'low' | 'medium' | 'high' = 'low';

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0 };

export type ReviewToClassify = {
  text: string;
  stars: number | null;
};

export type ClassificationOutcome = {
  results: Classification[];
  /** KEYWORD when the local classifier produced these, otherwise AI:<provider>. */
  source: 'KEYWORD' | `AI:${string}`;
  model: string | null;
  notes: string[];
  /**
   * What the provider says the whole call cost, summed across batches, so the
   * caller can put it on the daily tally. Zeroes when nothing was sent.
   */
  usage: { inputTokens: number; outputTokens: number };
  /** Requests that actually left the process, and how many of those failed. */
  requests: number;
  failures: number;
};

/**
 * THE AI READER CONTRACT, VERSION 2 (final semantic correctness pass).
 *
 * The model returns, per review, a structured reading that the code then
 * VALIDATES topic by topic (`parseReaderBatch`). A topic survives only if:
 *
 *   - its key is in this vertical's taxonomy,
 *   - its polarity is the key's own side (an ISSUE key is NEGATIVE, a PRAISE
 *     key POSITIVE) — a key on the wrong side is refused, never flipped,
 *   - it is about the BUSINESS, not the customer, another customer, another
 *     business or an event,
 *   - its confidence is MEDIUM or HIGH,
 *   - its evidence is the customer's own words, found verbatim in the review.
 *
 * Everything else is dropped and recorded with the reason. A review the model
 * abstains on contributes nothing. The deterministic reading always exists
 * underneath; this reading is only ever a suggestion to it.
 */
export const AI_READER_VERSION = 3;

export const SYSTEM_PROMPT = `You are a careful classification engine inside Headway, a customer-feedback tool for local Indian small businesses.

You will be given a fixed taxonomy of ISSUE keys (problems) and PRAISE keys (things done well), then a numbered list of anonymous customer reviews. Reviews may be in English, Hindi, Marathi, romanised Hinglish, or a mix.

For each review, list only the taxonomy topics the review genuinely supports about THIS BUSINESS.

RULES:
1. Use ONLY the keys provided. Never invent or rename a key.
2. An ISSUE key always has polarity NEGATIVE. A PRAISE key always has polarity POSITIVE.
3. "about" is BUSINESS when the statement is about this business, its staff or its work. It is OTHER when it is about the customer themselves, their family, other customers, another business (a venue, a caterer, a bank, a builder, a delivery app such as Swiggy or Zomato, the delivery partner or rider) or an event (traffic, rain, a strike). "The baraat ran late" is OTHER. "I arrived late" is OTHER. "The delivery partner was late" is OTHER. "The kitchen took 40 minutes to prepare our order" is BUSINESS. When the words do not say who caused a problem, and it could be someone else, leave that topic out.
4. "evidence" must be copied word for word from the review: the shortest phrase that supports the topic.
5. Read sarcasm for what it means: "Great, another hour waiting" is a complaint about waiting.
6. A past state contrasted with now ("used to be great, now it is bad") describes now.
6b. A drink named by its temperature is a drink, not a temperature complaint: "the cold coffee was great" is praise for the drink; "the coffee was cold" is a complaint that it was served cold. "Not bad" and "not rude" are not praise or complaints on their own.
7. If the subject, the polarity or the topic is unclear, leave that topic out. If nothing can be classified safely, set "abstain": true and give no topics. Missing a topic is better than inventing one.
8. confidence is HIGH, MEDIUM or LOW, for each topic and for the review.
9. sentiment is the overall tone of the words: POSITIVE, NEGATIVE, MIXED or NEUTRAL. Ignore the star rating when choosing it.
10. Return one entry per review, in the same order, with the same index. No commentary.

Return ONLY JSON of the form:
{"results":[{"i":0,"abstain":false,"sentiment":"MIXED","confidence":"HIGH","topics":[{"key":"service_speed","polarity":"NEGATIVE","about":"BUSINESS","confidence":"HIGH","evidence":"service was painfully slow"}]}]}`;

export function buildUserPrompt(pack: Pack, batch: ReviewToClassify[]): string {
  const issues = pack.issueTaxonomy
    .map((t) => `- ${t.key}: ${t.label}`)
    .join('\n');
  const praises = pack.praiseTaxonomy
    .map((t) => `- ${t.key}: ${t.label}`)
    .join('\n');

  const reviews = batch
    .map(
      (r, i) =>
        `[${i}]${r.stars !== null ? ` (${r.stars} stars)` : ''} ${r.text.replace(/\s+/g, ' ').trim()}`,
    )
    .join('\n');

  return [
    `VERTICAL: ${pack.label}`,
    '',
    'ISSUE KEYS:',
    issues,
    '',
    'PRAISE KEYS:',
    praises,
    '',
    `REVIEWS (${batch.length}):`,
    reviews,
  ].join('\n');
}

type RawEntry = {
  i?: unknown;
  issues?: unknown;
  praises?: unknown;
  sentiment?: unknown;
  confidence?: unknown;
  abstain?: unknown;
  topics?: unknown;
};

export type RejectedTopic = {
  key: string;
  why: 'NOT_IN_TAXONOMY' | 'WRONG_POLARITY' | 'NOT_ABOUT_BUSINESS' | 'LOW_CONFIDENCE' | 'NO_EVIDENCE' | 'EVIDENCE_NOT_IN_TEXT';
};

export type ParsedReading = {
  /** The validated suggestion, or null when the model gave nothing usable for this review. */
  suggestion: AiSuggestion | null;
  /** Everything the model proposed that validation refused, and why. */
  rejected: RejectedTopic[];
  /** The model's own overall confidence, for the evaluation. */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
};

const level = (v: unknown): 'HIGH' | 'MEDIUM' | 'LOW' | null => {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return s === 'HIGH' || s === 'MEDIUM' || s === 'LOW' ? s : null;
};

/** Lowercased, whitespace collapsed, quotes and punctuation at the edges ignored. */
const squash = (t: string) =>
  t.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();

/**
 * Validates one review's raw entry against the taxonomy and the review's own
 * words. Pure; exported for the evaluation harness, which scores exactly
 * what production would accept.
 */
export function validateReading(raw: unknown, review: ReviewToClassify, pack: Pack): ParsedReading {
  if (!raw || typeof raw !== 'object') return { suggestion: null, rejected: [], confidence: null };
  const entry = raw as RawEntry;
  const sentiment = sanitiseSentiment(entry.sentiment);
  const confidence = level(entry.confidence);
  const abstain = entry.abstain === true;
  const issueKeys = new Set(pack.issueTaxonomy.map((t) => t.key));
  const praiseKeys = new Set(pack.praiseTaxonomy.map((t) => t.key));
  const text = squash(review.text);
  const rejected: RejectedTopic[] = [];
  const topics: AiTopicSuggestion[] = [];

  if (Array.isArray(entry.topics)) {
    for (const t of entry.topics) {
      if (!t || typeof t !== 'object') continue;
      const o = t as Record<string, unknown>;
      const key = typeof o.key === 'string' ? o.key.trim() : '';
      const kind = issueKeys.has(key) ? 'ISSUE' : praiseKeys.has(key) ? 'PRAISE' : null;
      if (!kind) {
        rejected.push({ key, why: 'NOT_IN_TAXONOMY' });
        continue;
      }
      const polarity = typeof o.polarity === 'string' ? o.polarity.trim().toUpperCase() : '';
      if (polarity !== (kind === 'ISSUE' ? 'NEGATIVE' : 'POSITIVE')) {
        rejected.push({ key, why: 'WRONG_POLARITY' });
        continue;
      }
      if ((typeof o.about === 'string' ? o.about.trim().toUpperCase() : 'BUSINESS') !== 'BUSINESS') {
        rejected.push({ key, why: 'NOT_ABOUT_BUSINESS' });
        continue;
      }
      const c = level(o.confidence) ?? 'LOW';
      if (c === 'LOW') {
        rejected.push({ key, why: 'LOW_CONFIDENCE' });
        continue;
      }
      const evidence = typeof o.evidence === 'string' ? squash(o.evidence).replace(/^["'.,\s]+|["'.,\s]+$/g, '') : '';
      if (!evidence) {
        rejected.push({ key, why: 'NO_EVIDENCE' });
        continue;
      }
      if (!text.includes(evidence)) {
        rejected.push({ key, why: 'EVIDENCE_NOT_IN_TEXT' });
        continue;
      }
      if (!topics.some((x) => x.key === key)) topics.push({ key, kind, confidence: c, evidence });
    }
  } else if (entry.issues !== undefined || entry.praises !== undefined) {
    // A reply in the old shape carries no evidence and no attribution: it is
    // not trusted as a structured reading. Nothing from it is accepted.
    for (const key of [...sanitiseTags(entry.issues, pack.issueTaxonomy), ...sanitiseTags(entry.praises, pack.praiseTaxonomy)]) {
      rejected.push({ key, why: 'NO_EVIDENCE' });
    }
  }

  const accepted = abstain ? [] : topics;
  return {
    suggestion: {
      issueTags: accepted.filter((t) => t.kind === 'ISSUE').map((t) => t.key),
      praiseTags: accepted.filter((t) => t.kind === 'PRAISE').map((t) => t.key),
      sentiment: abstain ? null : sentiment,
      topics: accepted,
      abstain,
    },
    rejected,
    confidence,
  };
}

/** Parses a whole batch reply. Null when the reply is not usable at all. */
export function parseReaderBatch(rawText: string, batch: ReviewToClassify[], pack: Pack): ParsedReading[] | null {
  const parsed = extractJson(rawText);
  const rows =
    parsed && typeof parsed === 'object' && 'results' in parsed
      ? (parsed as { results: unknown }).results
      : parsed;
  if (!Array.isArray(rows)) return null;
  // Rows are matched to reviews by their index. A reply that drops the
  // indexes is matched by position only when it has exactly one row per
  // review; otherwise a skipped row would shift every later reading onto the
  // wrong review, and the whole reply is refused. Two rows claiming one index
  // are refused for the same reason.
  const indexed = rows.filter((row) => row && typeof row === 'object' && Number.isInteger((row as RawEntry).i));
  if (indexed.length !== rows.length && rows.length !== batch.length) return null;
  const byIndex = new Map<number, unknown>();
  let duplicate = false;
  rows.forEach((row, position) => {
    if (!row || typeof row !== 'object') return;
    const entry = row as RawEntry;
    const idx = typeof entry.i === 'number' && Number.isInteger(entry.i) ? entry.i : position;
    if (byIndex.has(idx)) duplicate = true;
    if (idx >= 0 && idx < batch.length) byIndex.set(idx, row);
  });
  if (duplicate || byIndex.size === 0) return null;
  return batch.map((review, index) => validateReading(byIndex.get(index), review, pack));
}

async function classifyBatch(
  batch: ReviewToClassify[],
  pack: Pack,
): Promise<{
  results: Classification[] | null;
  note: string;
  providerId?: string;
  model?: string;
  usage: { inputTokens: number; outputTokens: number };
}> {
  const run = await runCompletion({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(pack, batch),
    json: true,
    temperature: 0,
    maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
    reasoningEffort: CLASSIFY_REASONING_EFFORT,
  });

  if (!run.ok) {
    // A reply cut off at the output limit is never parsed. Half the batch
    // needs half the answer: split and try each half, down to a single
    // review. A review that still does not fit is read deterministically.
    if ((run.codes?.includes('TRUNCATED') || run.codes?.includes('INVALID_JSON')) && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      const [a, b] = [await classifyBatch(batch.slice(0, mid), pack), await classifyBatch(batch.slice(mid), pack)];
      const usage = {
        inputTokens: a.usage.inputTokens + b.usage.inputTokens,
        outputTokens: a.usage.outputTokens + b.usage.outputTokens,
      };
      if (!a.results && !b.results) return { results: null, note: [a.note, b.note].filter(Boolean).join(' '), usage };
      return {
        results: [
          ...(a.results ?? batch.slice(0, mid).map((r) => classifyByKeywords(r.text, r.stars, pack))),
          ...(b.results ?? batch.slice(mid).map((r) => classifyByKeywords(r.text, r.stars, pack))),
        ],
        note: [a.note, b.note].filter(Boolean).join(' '),
        providerId: a.providerId ?? b.providerId,
        model: a.model ?? b.model,
        usage,
      };
    }
    // Nothing was billed if nothing was answered, but a refused or timed-out
    // request still happened; the caller counts it as a failure.
    return { results: null, note: [run.reason, ...run.attempts].join(' '), usage: ZERO_USAGE };
  }

  // Reported counts where the provider gave them, estimated from the exact
  // strings that were sent where it did not. Never guessed from nothing.
  const usage = run.usage ?? {
    inputTokens: estimateTokens(SYSTEM_PROMPT) + estimateTokens(buildUserPrompt(pack, batch)),
    outputTokens: estimateTokens(run.text),
  };

  const readings = parseReaderBatch(run.text, batch, pack);
  if (!readings) {
    return { results: null, note: 'AI classification response had no usable rows.', usage };
  }

  const results = batch.map((review, index) => {
    const reading = readings[index];
    if (!reading?.suggestion) return classifyByKeywords(review.text, review.stars, pack);
    const { issueTags, praiseTags } = reading.suggestion;
    return {
      issueTags,
      praiseTags,
      // The summary sentiment for callers that read only these three fields;
      // the stored reading is composed in normalize.ts from the words and
      // the rating, with the model's own tone as its last resort.
      sentiment: deriveSentiment(review.stars, issueTags, praiseTags, review.text),
      ai: reading.suggestion,
    } satisfies Classification;
  });

  return {
    results,
    note: '',
    providerId: run.providerId,
    model: run.model,
    usage,
  };
}

/**
 * Classifies every review. Falls back to the local keyword classifier for any
 * batch the AI cannot handle, so the operator always gets a complete result.
 */
export async function classifyReviews(
  reviews: ReviewToClassify[],
  pack: Pack,
  options: { useAi: boolean },
): Promise<ClassificationOutcome> {
  if (reviews.length === 0) {
    return { results: [], source: 'KEYWORD', model: null, notes: [], usage: ZERO_USAGE, requests: 0, failures: 0 };
  }

  const keywordAll = () => reviews.map((r) => classifyByKeywords(r.text, r.stars, pack));

  if (!options.useAi) {
    return {
      results: keywordAll(),
      source: 'KEYWORD',
      model: null,
      notes: ['Classified locally with the keyword taxonomy (AI not used).'],
      usage: ZERO_USAGE,
      requests: 0,
      failures: 0,
    };
  }

  const results: Classification[] = [];
  const notes: string[] = [];
  let providerId: string | null = null;
  let model: string | null = null;
  let aiBatches = 0;
  let keywordBatches = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let requests = 0;
  let failures = 0;

  for (let start = 0; start < reviews.length; start += BATCH_SIZE) {
    const batch = reviews.slice(start, start + BATCH_SIZE);
    const outcome = await classifyBatch(batch, pack);
    requests += 1;
    inputTokens += outcome.usage.inputTokens;
    outputTokens += outcome.usage.outputTokens;

    if (outcome.results) {
      results.push(...outcome.results);
      aiBatches += 1;
      providerId ??= outcome.providerId ?? null;
      model ??= outcome.model ?? null;
    } else {
      results.push(...batch.map((r) => classifyByKeywords(r.text, r.stars, pack)));
      keywordBatches += 1;
      failures += 1;
      if (outcome.note) notes.push(outcome.note);
    }
  }

  if (keywordBatches > 0 && aiBatches > 0) {
    notes.unshift(
      `${keywordBatches} of ${aiBatches + keywordBatches} batches fell back to the local keyword classifier.`,
    );
  }

  if (aiBatches === 0) {
    return {
      results,
      source: 'KEYWORD',
      model: null,
      notes: [
        'AI classification unavailable; used the local keyword taxonomy for every review.',
        ...notes,
      ],
      usage: { inputTokens, outputTokens },
      requests,
      failures,
    };
  }

  return {
    results,
    source: providerId ? (`AI:${providerId}` as const) : 'KEYWORD',
    model,
    notes,
    usage: { inputTokens, outputTokens },
    requests,
    failures,
  };
}
