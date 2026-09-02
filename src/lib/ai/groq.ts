import {
  AiError,
  aiTimeoutMs,
  assertServerOnly,
  type AiCompleteOptions,
  type AiProvider,
} from './types';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
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

  async complete(options: AiCompleteOptions): Promise<string> {
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
    return content;
  },
};
