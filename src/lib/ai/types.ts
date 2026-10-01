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
  /**
   * How hard a reasoning model thinks before it answers, where the model has
   * the setting. Reasoning is paid from the same output allowance as the
   * answer, so a long think can cut the answer short.
   */
  reasoningEffort?: 'low' | 'medium' | 'high';
};

/**
 * What one call actually cost, as the provider reported it.
 *
 * Reported rather than estimated wherever possible: the daily budget is only
 * as honest as its arithmetic, and a provider counts its own tokens better
 * than any character heuristic can. Null when a provider does not say.
 */
export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiCompletion = {
  text: string;
  usage: AiUsage | null;
  /** The model that actually answered, when the provider chose another than the configured one. */
  model?: string;
};

export type AiProvider = {
  id: AiProviderId;
  label: string;
  /** Model id currently configured for this provider. */
  model: string;
  /** True when an API key is present in the environment. */
  isConfigured(): boolean;
  complete(options: AiCompleteOptions): Promise<AiCompletion>;
};

/**
 * Why a call failed, where the reason changes what the caller should do.
 *
 *   TRUNCATED        the answer hit the output limit and was cut off. Never
 *                    parsed: half a JSON reply is not a reading. A smaller
 *                    batch may fit.
 *   MODEL_NOT_FOUND  the configured model id no longer exists.
 *   RATE_LIMITED     the provider's per-minute or per-day allowance is spent.
 *   INVALID_JSON     the provider refused the model's own reply as broken
 *                    JSON. A smaller batch usually comes back whole.
 */
export type AiErrorCode = 'TRUNCATED' | 'MODEL_NOT_FOUND' | 'RATE_LIMITED' | 'INVALID_JSON';

export class AiError extends Error {
  readonly providerId: AiProviderId;
  readonly status?: number;
  readonly code?: AiErrorCode;

  constructor(providerId: AiProviderId, message: string, status?: number, code?: AiErrorCode) {
    super(message);
    this.name = 'AiError';
    this.providerId = providerId;
    this.status = status;
    this.code = code;
  }
}

/** Guards against any accidental import of provider code into a client bundle. */
export function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Headway AI providers are server-only. API keys must never reach the browser.',
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
