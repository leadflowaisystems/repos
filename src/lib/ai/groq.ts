import {
  AiError,
  aiTimeoutMs,
  assertServerOnly,
  type AiCompleteOptions,
  type AiCompletion,
  type AiProvider,
} from './types';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * The model Headway asks for when GROQ_MODEL says nothing.
 *
 * WAS `llama-3.3-70b-versatile`, WHICH GROQ SHUT DOWN ON 2026-08-16. Its
 * deprecation notice applied to free and developer tier usage, and after the
 * shutdown date requests to the old id return an error rather than a
 * completion — so the previous default silently disabled the AI enhancement
 * for anybody without an enterprise contract. This is Groq's own named
 * replacement, on the same OpenAI-compatible endpoint, so nothing else about
 * the call changes.
 *
 * Measured, not assumed: the café handover pass (October 2026) scored the
 * models Groq offers on this account against the café evaluation corpus.
 * gpt-oss-20b, at low reasoning effort, is the one measured end to end; the
 * larger gpt-oss-120b could not be, as its 200,000-token daily allowance on
 * this account was spent (docs/CAFE_HANDOVER_2026-10.md).
 *
 * A model id is not forever. GROQ_MODEL overrides this without a deploy, and
 * every path that uses a model already falls back to deterministic output when
 * the provider refuses — which is what made the last decommission survivable.
 */
export const DEFAULT_MODEL = 'openai/gpt-oss-20b';

/** The longest a rate-limited call waits for its allowance before giving up. */
const MAX_RATE_LIMIT_WAIT_MS = 10_000;

type GroqResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Groq's suggested wait: the retry-after header, or "try again in 1m2.5s" in the message. */
function retryAfterMs(response: Response, message: string): number | null {
  const header = Number.parseFloat(response.headers.get('retry-after') ?? '');
  if (Number.isFinite(header) && header >= 0) return header * 1000;
  const m = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(message);
  return m ? (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 : null;
}

/** Reasoning models with an effort setting. */
const takesReasoningEffort = (model: string) => model.startsWith('openai/gpt-oss');

async function requestOnce(
  apiKey: string,
  model: string,
  options: AiCompleteOptions,
): Promise<AiCompletion> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user },
    ],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxOutputTokens ?? 2048,
  };
  if (options.json) body.response_format = { type: 'json_object' };
  if (options.reasoningEffort && takesReasoningEffort(model)) body.reasoning_effort = options.reasoningEffort;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(aiTimeoutMs()),
        cache: 'no-store',
      });
    } catch (error) {
      throw new AiError(
        'groq',
        error instanceof Error ? error.message : 'Network request failed.',
      );
    }

    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 300);
      let code: string | undefined;
      try {
        const parsed = JSON.parse(text) as GroqResponse;
        detail = parsed.error?.message ?? detail;
        code = parsed.error?.code;
      } catch {
        // keep the raw snippet
      }
      if (response.status === 429) {
        // One short wait for a per-minute allowance; a daily one, or a long
        // wait, fails now and the caller reads deterministically instead.
        const wait = retryAfterMs(response, detail);
        if (attempt === 0 && wait !== null && wait <= MAX_RATE_LIMIT_WAIT_MS && !/per day|\bTPD\b|\bRPD\b/i.test(detail)) {
          await sleep(wait + 250);
          continue;
        }
        throw new AiError('groq', detail, 429, 'RATE_LIMITED');
      }
      const notFound = response.status === 404 && (code === 'model_not_found' || /model .* does not exist|decommissioned/i.test(detail));
      const badJson = response.status === 400 && (code === 'json_validate_failed' || /failed to validate json/i.test(detail));
      throw new AiError('groq', detail, response.status, notFound ? 'MODEL_NOT_FOUND' : badJson ? 'INVALID_JSON' : undefined);
    }

    let parsed: GroqResponse;
    try {
      parsed = JSON.parse(text) as GroqResponse;
    } catch {
      throw new AiError('groq', 'Response was not valid JSON.');
    }

    const choice = parsed.choices?.[0];
    // A reply cut off by the output limit is never used, not even in part:
    // a half-written list of readings would silently lose the reviews at its
    // end, or worse, parse into something the model never finished saying.
    if (choice?.finish_reason === 'length') {
      throw new AiError('groq', 'The reply was cut off at the output limit.', undefined, 'TRUNCATED');
    }
    const content = choice?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AiError('groq', 'Response contained no content.');
    }

    // Groq reports its own counts on the OpenAI-compatible shape. Preferred
    // over any estimate: the daily budget is only as honest as its arithmetic.
    const usage =
      typeof parsed.usage?.prompt_tokens === 'number' &&
      typeof parsed.usage?.completion_tokens === 'number'
        ? {
            inputTokens: parsed.usage.prompt_tokens,
            outputTokens: parsed.usage.completion_tokens,
          }
        : null;

    return { text: content, usage, model };
  }
}

export const groqProvider: AiProvider = {
  id: 'groq',
  label: 'Groq',
  get model() {
    return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  },

  isConfigured() {
    return Boolean(process.env.GROQ_API_KEY?.trim());
  },

  async complete(options: AiCompleteOptions): Promise<AiCompletion> {
    assertServerOnly();
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new AiError('groq', 'GROQ_API_KEY is not set.');

    const configured = this.model;
    try {
      return await requestOnce(apiKey, configured, options);
    } catch (error) {
      // A configured model that no longer exists is the failure that disabled
      // the AI reader for six weeks in 2026 without anyone noticing. The
      // default is the measured replacement; use it, and say so loudly every
      // time, so the setting gets fixed rather than relied on.
      if (error instanceof AiError && error.code === 'MODEL_NOT_FOUND' && configured !== DEFAULT_MODEL) {
        console.error(
          `[ai] GROQ_MODEL "${configured}" does not exist at Groq; using the default "${DEFAULT_MODEL}". Update GROQ_MODEL.`,
        );
        return requestOnce(apiKey, DEFAULT_MODEL, options);
      }
      throw error;
    }
  },
};
