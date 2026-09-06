import { groqProvider } from './groq';
import {
  AiError,
  assertServerOnly,
  type AiCompleteOptions,
  type AiProvider,
  type AiProviderId,
} from './types';

export * from './types';

/**
 * Provider registry.
 *
 * V1 RULE: exactly one provider is registered — Groq. No Google endpoint of any
 * kind may appear in the RepOS runtime, which rules out Gemini / AI Studio as
 * well as every Google platform API. See COMPLIANCE.md.
 *
 * The abstraction itself is intentionally kept: adding a future non-Google
 * provider means writing one adapter and adding one line here. Nothing outside
 * src/lib/ai/ knows which provider is in use.
 */
const REGISTRY: Record<AiProviderId, AiProvider> = {
  groq: groqProvider,
};

const REGISTERED_IDS = Object.keys(REGISTRY) as AiProviderId[];

function parseProviderId(raw: string | undefined): AiProviderId | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  return (REGISTERED_IDS as string[]).includes(value)
    ? (value as AiProviderId)
    : null;
}

export function aiDisabled(): boolean {
  const flag = process.env.REPOS_AI_DISABLED?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

/**
 * Providers to try, in order: configured primary, then configured fallback.
 * Unknown ids and providers without a key are skipped silently, so a stale
 * REPOS_AI_FALLBACK="gemini" in an old .env.local can never reach the network.
 */
export function providerChain(): AiProvider[] {
  if (aiDisabled()) return [];

  const order: AiProviderId[] = [];
  const primary = parseProviderId(process.env.REPOS_AI_PRIMARY) ?? 'groq';
  const fallback = parseProviderId(process.env.REPOS_AI_FALLBACK);

  order.push(primary);
  if (fallback && fallback !== primary) order.push(fallback);

  return order.map((id) => REGISTRY[id]).filter((p) => p.isConfigured());
}

export type AiStatus = {
  enabled: boolean;
  disabledByFlag: boolean;
  chain: Array<{ id: AiProviderId; label: string; model: string }>;
  /** Present when nothing is usable, explaining why. */
  note: string;
};

/** Safe to render in the UI: contains model names, never keys. */
export function aiStatus(): AiStatus {
  const disabledByFlag = aiDisabled();
  const chain = providerChain().map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
  }));

  let note: string;
  if (disabledByFlag) {
    note =
      'AI is switched off (REPOS_AI_DISABLED=1). Headway is running fully offline: keyword classification and template prose.';
  } else if (chain.length === 0) {
    note =
      'No AI key is configured. Headway is running in deterministic-only mode: keyword classification and template prose. Every number is unaffected.';
  } else {
    note = `AI drafting via ${chain.map((c) => `${c.label} (${c.model})`).join(', then ')}. All counts remain deterministic.`;
  }

  return { enabled: chain.length > 0, disabledByFlag, chain, note };
}

export type AiRun =
  | { ok: true; text: string; providerId: AiProviderId; model: string }
  | { ok: false; reason: string; attempts: string[] };

/**
 * Runs a completion across the provider chain, returning the first success.
 * Never throws: callers always have a deterministic fallback path.
 */
export async function runCompletion(options: AiCompleteOptions): Promise<AiRun> {
  assertServerOnly();

  const chain = providerChain();
  if (chain.length === 0) {
    return {
      ok: false,
      reason: aiDisabled()
        ? 'AI is disabled by REPOS_AI_DISABLED.'
        : 'No AI provider is configured.',
      attempts: [],
    };
  }

  const attempts: string[] = [];
  for (const provider of chain) {
    try {
      const text = await provider.complete(options);
      return { ok: true, text, providerId: provider.id, model: provider.model };
    } catch (error) {
      const message =
        error instanceof AiError
          ? `${provider.label}: ${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`
          : `${provider.label}: ${error instanceof Error ? error.message : 'unknown error'}`;
      attempts.push(message);
    }
  }

  return {
    ok: false,
    reason: 'Every configured AI provider failed.',
    attempts,
  };
}

/** Ids RepOS will actually talk to. Used by the compliance guard test. */
export function registeredProviderIds(): AiProviderId[] {
  return [...REGISTERED_IDS];
}
