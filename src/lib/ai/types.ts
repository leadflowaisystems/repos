/**
 * AI provider abstraction.
 *
 * RepOS must not depend structurally on any single provider. Everything the
 * application asks of an LLM goes through `AiProvider`, and every provider is
 * a thin adapter over a plain HTTPS call with an API key. No SDK, no OAuth, no
 * account linkage, no vendor lock-in.
 *
 * HARD RULE (see PRODUCT_PRINCIPLES.md): a provider may classify text and draft
 * prose. It may never produce a number that reaches a report.
 */

/**
 * Registered providers.
 *
 * V1 allows exactly one: Groq. Google-operated endpoints (including Gemini via
 * AI Studio) are prohibited by the V1 hard rules, so no Google provider exists
 * in this codebase. Widening this union is how a future non-Google provider
 * gets added — the rest of the application is unaffected.
 */
export type AiProviderId = 'groq';

export type AiCompleteOptions = {
  system: string;
  user: string;
  /** Ask the provider for strict JSON output where it supports it. */
  json?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
};

export type AiProvider = {
  id: AiProviderId;
  label: string;
  /** Model id currently configured for this provider. */
  model: string;
  /** True when an API key is present in the environment. */
  isConfigured(): boolean;
  complete(options: AiCompleteOptions): Promise<string>;
};

export class AiError extends Error {
  readonly providerId: AiProviderId;
  readonly status?: number;

  constructor(providerId: AiProviderId, message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.providerId = providerId;
    this.status = status;
  }
}

/** Guards against any accidental import of provider code into a client bundle. */
export function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'RepOS AI providers are server-only. API keys must never reach the browser.',
    );
  }
}

export function aiTimeoutMs(): number {
  const raw = Number.parseInt(process.env.REPOS_AI_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 45_000;
}

/**
 * Pulls the first JSON value out of a model response, tolerating markdown
 * fences and leading prose. Returns null rather than throwing so callers can
 * fall back to deterministic output.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(
    (c): c is string => typeof c === 'string' && c.length > 0,
  );

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // fall through to substring scan
    }

    const firstBrace = candidate.search(/[[{]/);
    if (firstBrace === -1) continue;
    const opener = candidate[firstBrace];
    const closer = opener === '{' ? '}' : ']';
    const lastClose = candidate.lastIndexOf(closer);
    if (lastClose > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastClose + 1));
      } catch {
        // give up on this candidate
      }
    }
  }
  return null;
}
