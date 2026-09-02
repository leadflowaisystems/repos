import type { Pack } from '@/lib/packs';
import {
  classifyByKeywords,
  deriveSentiment,
  sanitiseSentiment,
  sanitiseTags,
  type Classification,
} from '@/lib/analysis/classify';
import { runCompletion } from './index';
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

const BATCH_SIZE = 20;

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
};

const SYSTEM_PROMPT = `You are a classification engine inside RepOS, a customer-feedback tool for local Indian small businesses.

You will be given a fixed taxonomy of ISSUE keys and PRAISE keys, then a numbered list of anonymous customer reviews. Reviews may be in English, Hindi, Marathi, romanised Hinglish, or a mix.

For each review, decide which taxonomy keys genuinely apply.

RULES:
1. Use ONLY the keys provided. Never invent a key. Never rename one.
2. Assign a key only when the review actually supports it. An empty list is a correct answer.
3. Do not count anything. Do not summarise. Do not add commentary.
4. sentiment must be exactly one of: POSITIVE, NEGATIVE, MIXED, NEUTRAL.
5. Return one entry per input review, in the same order, with the same index.

Return ONLY JSON of the form:
{"results":[{"i":0,"issues":["key"],"praises":["key"],"sentiment":"NEGATIVE"}]}`;

function buildUserPrompt(pack: Pack, batch: ReviewToClassify[]): string {
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

type RawEntry = { i?: unknown; issues?: unknown; praises?: unknown; sentiment?: unknown };

async function classifyBatch(
  batch: ReviewToClassify[],
  pack: Pack,
): Promise<{ results: Classification[] | null; note: string; providerId?: string; model?: string }> {
  const run = await runCompletion({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(pack, batch),
    json: true,
    temperature: 0,
    maxOutputTokens: 2600,
  });

  if (!run.ok) {
    return { results: null, note: [run.reason, ...run.attempts].join(' ') };
  }

  const parsed = extractJson(run.text);
  const rows =
    parsed && typeof parsed === 'object' && 'results' in parsed
      ? (parsed as { results: unknown }).results
      : parsed;

  if (!Array.isArray(rows)) {
    return { results: null, note: 'AI classification response was not a JSON array.' };
  }

  const byIndex = new Map<number, RawEntry>();
  rows.forEach((row, position) => {
    if (!row || typeof row !== 'object') return;
    const entry = row as RawEntry;
    const idx =
      typeof entry.i === 'number' && Number.isInteger(entry.i) ? entry.i : position;
    if (idx >= 0 && idx < batch.length) byIndex.set(idx, entry);
  });

  if (byIndex.size === 0) {
    return { results: null, note: 'AI classification response had no usable rows.' };
  }

  const results = batch.map((review, index) => {
    const entry = byIndex.get(index);
    if (!entry) return classifyByKeywords(review.text, review.stars, pack);

    const issueTags = sanitiseTags(entry.issues, pack.issueTaxonomy);
    const praiseTags = sanitiseTags(entry.praises, pack.praiseTaxonomy);
    const claimed = sanitiseSentiment(entry.sentiment);

    return {
      issueTags,
      praiseTags,
      // A supplied star rating always overrides the model's sentiment call.
      sentiment:
        review.stars !== null || claimed === null
          ? deriveSentiment(review.stars, issueTags, praiseTags, review.text)
          : claimed,
    } satisfies Classification;
  });

  return {
    results,
    note: '',
    providerId: run.providerId,
    model: run.model,
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
    return { results: [], source: 'KEYWORD', model: null, notes: [] };
  }

  const keywordAll = () => reviews.map((r) => classifyByKeywords(r.text, r.stars, pack));

  if (!options.useAi) {
    return {
      results: keywordAll(),
      source: 'KEYWORD',
      model: null,
      notes: ['Classified locally with the keyword taxonomy (AI not used).'],
    };
  }

  const results: Classification[] = [];
  const notes: string[] = [];
  let providerId: string | null = null;
  let model: string | null = null;
  let aiBatches = 0;
  let keywordBatches = 0;

  for (let start = 0; start < reviews.length; start += BATCH_SIZE) {
    const batch = reviews.slice(start, start + BATCH_SIZE);
    const outcome = await classifyBatch(batch, pack);

    if (outcome.results) {
      results.push(...outcome.results);
      aiBatches += 1;
      providerId ??= outcome.providerId ?? null;
      model ??= outcome.model ?? null;
    } else {
      results.push(...batch.map((r) => classifyByKeywords(r.text, r.stars, pack)));
      keywordBatches += 1;
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
    };
  }

  return {
    results,
    source: providerId ? (`AI:${providerId}` as const) : 'KEYWORD',
    model,
    notes,
  };
}
