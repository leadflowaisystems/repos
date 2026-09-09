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
 * A model id is not forever. GROQ_MODEL overrides this without a deploy, and
 * every path that uses a model already falls back to deterministic output when
 * the provider refuses — which is what made the last decommission survivable.
 */
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

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

    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxOutputTokens ?? 2048,
    };
    if (options.json) body.response_format = { type: 'json_object' };

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
      try {
        detail = (JSON.parse(text) as GroqResponse).error?.message ?? detail;
      } catch {
        // keep the raw snippet
      }
      throw new AiError('groq', detail, response.status);
    }

    let parsed: GroqResponse;
    try {
      parsed = JSON.parse(text) as GroqResponse;
    } catch {
      throw new AiError('groq', 'Response was not valid JSON.');
    }

    const content = parsed.choices?.[0]?.message?.content;
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

    return { text: content, usage };
  },
};
