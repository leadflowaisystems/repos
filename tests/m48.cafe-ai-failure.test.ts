import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCompletion } from '@/lib/ai';
import { DEFAULT_MODEL } from '@/lib/ai/groq';
import { classifyReviews, parseReaderBatch } from '@/lib/ai/classify-reviews';
import { normalizeFeedback, type AiSuggestion } from '@/lib/analysis/normalize';
import { getPackOrFallback } from '@/lib/packs';

/**
 * M48 — THE CAFÉ'S AI READER FAILS SAFELY (café handover pass).
 *
 * Production's configured model was retired by the provider and every call
 * failed for six weeks. These tests pin what happens on every way a call can
 * go wrong: the reading falls back to the deterministic reader, nothing is
 * invented, and a reply is never half-used.
 */

const pack = getPackOrFallback('restaurant');

type Reply = { status: number; body: unknown; headers?: Record<string, string> };

function reply({ status, body, headers }: Reply): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

const completion = (content: string, finish = 'stop') => ({
  status: 200,
  body: { choices: [{ message: { content }, finish_reason: finish }], usage: { prompt_tokens: 100, completion_tokens: 50 } },
});

let calls: Array<{ model: string; reviews: number; effort?: string }> = [];

function stubFetch(handler: (body: { model: string; messages: Array<{ content: string }>; reasoning_effort?: string }) => Reply) {
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    const reviews = (body.messages[1].content.match(/^\[\d+\]/gm) ?? []).length;
    calls.push({ model: body.model, reviews, effort: body.reasoning_effort });
    return reply(handler(body));
  });
}

/** A valid structured reading for every review in the prompt: service_speed, evidence "slow". */
const slowFor = (n: number) =>
  JSON.stringify({
    results: Array.from({ length: n }, (_, i) => ({
      i,
      abstain: false,
      sentiment: 'NEGATIVE',
      confidence: 'HIGH',
      topics: [{ key: 'service_speed', polarity: 'NEGATIVE', about: 'BUSINESS', confidence: 'HIGH', evidence: 'slow' }],
    })),
  });

const reviewsIn = (b: { messages: Array<{ content: string }> }) => (b.messages[1]!.content.match(/^\[\d+\]/gm) ?? []).length;

beforeEach(() => {
  calls = [];
  process.env.GROQ_API_KEY = 'gsk_test';
  process.env.REPOS_AI_PRIMARY = 'groq';
  delete process.env.REPOS_AI_DISABLED;
  delete process.env.REPOS_AI_FALLBACK;
  process.env.GROQ_MODEL = DEFAULT_MODEL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
});

describe('a retired model', () => {
  it('falls back once to the measured default, says so loudly, and records which model answered', async () => {
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch((b) =>
      b.model === 'llama-3.3-70b-versatile'
        ? { status: 404, body: { error: { message: 'The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.', code: 'model_not_found' } } }
        : completion('{"ok":true}'),
    );
    const run = await runCompletion({ system: 's', user: 'u', json: true });
    expect(run.ok).toBe(true);
    expect(run.ok && run.model).toBe(DEFAULT_MODEL);
    expect(calls.map((c) => c.model)).toEqual(['llama-3.3-70b-versatile', DEFAULT_MODEL]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Update GROQ_MODEL'));
  });

  it('does not loop when the default itself is gone', async () => {
    stubFetch(() => ({ status: 404, body: { error: { message: 'gone', code: 'model_not_found' } } }));
    const run = await runCompletion({ system: 's', user: 'u' });
    expect(run.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe('a reply cut off at the output limit', () => {
  it('is never parsed; the batch is split until each half fits', async () => {
    stubFetch((b) => (reviewsIn(b) > 2 ? completion('{"results":[{"i":0', 'length') : completion(slowFor(reviewsIn(b)))));
    const reviews = Array.from({ length: 5 }, (_, i) => ({ text: `service was slow ${i}`, stars: 2 }));
    const out = await classifyReviews(reviews, pack, { useAi: true });
    expect(out.source).toBe('AI:groq');
    expect(out.results).toHaveLength(5);
    for (const r of out.results) expect(r.ai?.issueTags).toEqual(['service_speed']);
    // 5 → (3 → 2 + 1) + 2
    expect(calls.map((c) => c.reviews)).toEqual([5, 3, 2, 1, 2]);
  });

  it('a reply the provider refuses as broken JSON is retried in halves, never parsed', async () => {
    stubFetch((b) =>
      reviewsIn(b) > 1
        ? { status: 400, body: { error: { message: "Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.", code: 'json_validate_failed' } } }
        : completion(slowFor(1)),
    );
    const reviews = Array.from({ length: 3 }, (_, i) => ({ text: `service was slow ${i}`, stars: 2 }));
    const out = await classifyReviews(reviews, pack, { useAi: true });
    expect(out.source).toBe('AI:groq');
    for (const r of out.results) expect(r.ai?.issueTags).toEqual(['service_speed']);
  });

  it('a single review that never fits is read deterministically, with nothing from the cut-off reply', async () => {
    stubFetch(() => completion('{"results":[{"i":0,"topics":[{"key":"cleanliness"', 'length'));
    const out = await classifyReviews([{ text: 'The coffee was lovely', stars: 5 }], pack, { useAi: true });
    expect(out.source).toBe('KEYWORD');
    expect(out.results[0]!.ai).toBeUndefined();
    expect(out.results[0]!.issueTags).toEqual([]);
  });
});

describe('rate limits', () => {
  it('waits once for a short per-minute limit, then answers', async () => {
    let first = true;
    stubFetch(() => {
      if (first) {
        first = false;
        return { status: 429, body: { error: { message: 'Rate limit reached on tokens per minute (TPM). Please try again in 0.05s.' } } };
      }
      return completion('{"ok":true}');
    });
    const run = await runCompletion({ system: 's', user: 'u' });
    expect(run.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('a daily limit fails at once and the reviews are read deterministically', async () => {
    stubFetch(() => ({ status: 429, body: { error: { message: 'Rate limit reached on tokens per day (TPD). Please try again in 7m.' } } }));
    const out = await classifyReviews([{ text: 'Waited forever, service was slow', stars: 2 }], pack, { useAi: true });
    expect(calls).toHaveLength(1);
    expect(out.source).toBe('KEYWORD');
    expect(out.failures).toBe(1);
    expect(out.results[0]!.issueTags).toContain('service_speed');
  });
});

describe('bad replies are refused, never half-used', () => {
  const reviews = [
    { text: 'coffee was lukewarm', stars: 2 },
    { text: 'loved the waffles', stars: 5 },
  ];

  it('malformed JSON', async () => {
    stubFetch(() => completion('Sure! Here are the results: {results: [i:0'));
    const out = await classifyReviews(reviews, pack, { useAi: true });
    expect(out.source).toBe('KEYWORD');
    expect(out.results.every((r) => r.ai === undefined)).toBe(true);
  });

  it('an empty reply', async () => {
    stubFetch(() => completion('   '));
    const out = await classifyReviews(reviews, pack, { useAi: true });
    expect(out.source).toBe('KEYWORD');
  });

  it('a network failure or timeout', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    const out = await classifyReviews(reviews, pack, { useAi: true });
    expect(out.source).toBe('KEYWORD');
    expect(out.failures).toBe(1);
  });

  it('rows without indexes that do not match the batch one-to-one', () => {
    const raw = JSON.stringify({ results: [{ sentiment: 'POSITIVE', topics: [{ key: 'food_taste', polarity: 'POSITIVE', about: 'BUSINESS', confidence: 'HIGH', evidence: 'loved the waffles' }] }] });
    expect(parseReaderBatch(raw, reviews, pack)).toBeNull();
  });

  it('two rows claiming the same review', () => {
    const row = { i: 0, sentiment: 'NEGATIVE', topics: [] };
    expect(parseReaderBatch(JSON.stringify({ results: [row, row] }), reviews, pack)).toBeNull();
  });

  it('evidence that is not in the review, a key outside the café taxonomy, or praise on a problem key', () => {
    const raw = JSON.stringify({
      results: [
        {
          i: 0,
          sentiment: 'NEGATIVE',
          confidence: 'HIGH',
          topics: [
            { key: 'served_cold', polarity: 'NEGATIVE', about: 'BUSINESS', confidence: 'HIGH', evidence: 'the food was freezing' },
            { key: 'kitchen_understaffed', polarity: 'NEGATIVE', about: 'BUSINESS', confidence: 'HIGH', evidence: 'lukewarm' },
            { key: 'served_cold', polarity: 'POSITIVE', about: 'BUSINESS', confidence: 'HIGH', evidence: 'lukewarm' },
          ],
        },
        { i: 1, sentiment: 'POSITIVE', topics: [] },
      ],
    });
    const parsed = parseReaderBatch(raw, reviews, pack)!;
    expect(parsed[0]!.suggestion!.issueTags).toEqual([]);
    expect(parsed[0]!.rejected.map((r) => r.why).sort()).toEqual(['EVIDENCE_NOT_IN_TEXT', 'NOT_IN_TAXONOMY', 'WRONG_POLARITY']);
  });
});

describe('the reasoning effort', () => {
  it('is sent to gpt-oss models', async () => {
    stubFetch((b) => completion(slowFor(reviewsIn(b))));
    await classifyReviews([{ text: 'service was slow', stars: 2 }], pack, { useAi: true });
    expect(calls[0]!.effort).toBe('low');
  });
});

describe('the combined reader never lets the AI blame the café for a third party', () => {
  const ai = (topics: AiSuggestion['topics']): AiSuggestion => ({
    issueTags: (topics ?? []).filter((t) => t.kind === 'ISSUE').map((t) => t.key),
    praiseTags: (topics ?? []).filter((t) => t.kind === 'PRAISE').map((t) => t.key),
    sentiment: 'NEGATIVE',
    topics,
    abstain: false,
  });

  it('"Delivery partner was late." — an AI delivery complaint is refused', () => {
    const n = normalizeFeedback({
      text: 'Delivery partner was late.',
      stars: 2,
      pack,
      ai: ai([{ key: 'delivery_packaging', kind: 'ISSUE', confidence: 'HIGH', evidence: 'delivery partner was late' }]),
    });
    expect(n.issueTags).toEqual([]);
  });

  it('"The swiggy delivery guy was rude." — an AI staff complaint is refused', () => {
    const n = normalizeFeedback({
      text: 'The swiggy delivery guy was rude.',
      stars: 2,
      pack,
      ai: ai([{ key: 'staff_behaviour', kind: 'ISSUE', confidence: 'HIGH', evidence: 'delivery guy was rude' }]),
    });
    expect(n.issueTags).toEqual([]);
  });

  it('"Delivery partner was late because the restaurant was not ready." — the café\'s own preparation is kept', () => {
    const n = normalizeFeedback({ text: "Delivery partner was late because the restaurant wasn't ready.", stars: 2, pack, ai: null });
    expect(n.issueTags).toEqual(['service_speed']);
  });
});
