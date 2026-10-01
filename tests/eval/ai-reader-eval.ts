import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { routeForAi } from '@/lib/ai/route';
import { runCompletion } from '@/lib/ai';
import {
  AI_READER_VERSION,
  CLASSIFY_BATCH_SIZE,
  CLASSIFY_MAX_OUTPUT_TOKENS,
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseReaderBatch,
  type ParsedReading,
} from '@/lib/ai/classify-reviews';
import { getPackOrFallback } from '@/lib/packs';
import type { V2Example } from './semantic-v2';
import type { Reading } from './reader-eval';

/**
 * THE AI READER, MEASURED (final semantic correctness pass).
 *
 * Live provider replies are RECORDED once — for synthetic examples only, never
 * customer feedback — and every score is computed from the recording, so the
 * numbers are reproducible offline and do not move with a provider's mood.
 *
 *   A  deterministic   normalizeFeedback, no AI
 *   B  AI alone        the validated structured reading, nothing else
 *   C  combined        what production does: the router decides which
 *                      responses a second reader sees, and normalizeFeedback
 *                      arbitrates its suggestion against the first reading
 *
 * Recording needs a provider key and is started deliberately:
 *
 *   REPOS_EVAL_AI_LIVE=1 GROQ_API_KEY=… npx vitest run tests/m46.ai-reader-live.test.ts
 *
 * which writes tests/eval/ai-recordings.json. Without it, B and C are
 * reported as NOT MEASURED — never estimated.
 */

export const AI_RECORDINGS_PATH = 'tests/eval/ai-recordings.json';

export type AiRecording = {
  readerVersion: number;
  provider: string;
  model: string;
  recordedAt: string;
  batches: Array<{ pack: string; ids: string[]; raw: string | null; error: string | null }>;
};

/** Calls the provider for every example, in pack batches, exactly as production builds the prompt. */
export type RecordOptions = {
  /** A previous recording: batches it already holds for this reader and model are reused, not resent. */
  existing?: AiRecording | null;
  /** Pause between requests, to stay under the provider's per-minute token limit. */
  pauseMs?: number;
  /** Called after every batch, so a long run can be saved as it goes. */
  onBatch?: (recording: AiRecording, done: number, total: number) => void;
  /** Called before each wait on a rate limit, with the provider's reason (identifiers redacted). */
  onRetry?: (pack: string, attempt: number, waitMs: number, reason: string) => void;
  /** Hard limit on attempts per batch (default 4). */
  maxAttempts?: number;
  /** Hard limit on total waiting per batch (default 5 minutes); past it the batch is recorded as failed. */
  maxBatchWaitMs?: number;
};

/** A provider message with account identifiers removed, safe to print. */
export function redactProviderMessage(message: string): string {
  return message
    .replace(/org_[A-Za-z0-9]+/g, 'org_[redacted]')
    .replace(/gsk_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

/** A daily quota: waiting minutes per batch cannot clear it, so the run stops. */
const DAILY_LIMIT = /tokens per day|requests per day|\bTPD\b|\bRPD\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The provider's own suggested wait from a rate-limit message ("try again in 1m2.5s"), in ms. */
function retryAfterMs(message: string): number | null {
  const m = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(message);
  if (!m) return null;
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000;
}

/**
 * Calls the provider for every example, in pack batches, with production's
 * own prompt, batch size and output limit (imported, not copied).
 */
export async function recordAiReadings(examples: V2Example[], options: RecordOptions = {}): Promise<AiRecording> {
  const byPack = new Map<string, V2Example[]>();
  for (const e of examples) byPack.set(e.pack, [...(byPack.get(e.pack) ?? []), e]);
  const work: Array<{ pack: string; slice: V2Example[] }> = [];
  for (const [packId, list] of byPack) {
    for (let i = 0; i < list.length; i += CLASSIFY_BATCH_SIZE) work.push({ pack: packId, slice: list.slice(i, i + CLASSIFY_BATCH_SIZE) });
  }
  const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
  const reusable = new Map<string, AiRecording['batches'][number]>();
  if (options.existing && options.existing.readerVersion === AI_READER_VERSION && options.existing.model === model) {
    for (const b of options.existing.batches) if (b.raw) reusable.set(b.ids.join(','), b);
  }
  const recording: AiRecording = { readerVersion: AI_READER_VERSION, provider: 'groq', model, recordedAt: new Date().toISOString(), batches: [] };
  let done = 0;
  let stopped: string | null = null;
  for (const { pack: packId, slice } of work) {
    const key = slice.map((e) => e.id).join(',');
    const old = reusable.get(key);
    if (old) {
      recording.batches.push(old);
      done += 1;
      continue;
    }
    const pack = getPackOrFallback(packId);
    let raw: string | null = null;
    let error: string | null = stopped;
    let waited = 0;
    for (let attempt = 0; !stopped && attempt < (options.maxAttempts ?? 4); attempt += 1) {
      const run = await runCompletion({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(pack, slice.map((e) => ({ text: e.text, stars: e.stars }))),
        json: true,
        temperature: 0,
        maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
      });
      if (run.ok) {
        raw = run.text;
        error = null;
        break;
      }
      error = redactProviderMessage([run.reason, ...run.attempts].join(' '));
      if (!/HTTP 429/.test(error)) break;
      if (DAILY_LIMIT.test(error)) {
        stopped = `stopped: daily limit — ${error}`;
        error = stopped;
        break;
      }
      const wait = (retryAfterMs(error) ?? 20_000) + 1_000;
      if (waited + wait > (options.maxBatchWaitMs ?? 300_000)) {
        error = `gave up after ${Math.round(waited / 1000)}s of waiting — ${error}`;
        break;
      }
      options.onRetry?.(packId, attempt + 1, wait, error);
      waited += wait;
      await sleep(wait);
    }
    recording.batches.push({ pack: packId, ids: slice.map((e) => e.id), raw, error });
    done += 1;
    options.onBatch?.(recording, done, work.length);
    if (options.pauseMs) await sleep(options.pauseMs);
  }
  return recording;
}

export function saveRecording(recording: AiRecording): void {
  writeFileSync(AI_RECORDINGS_PATH, JSON.stringify(recording, null, 2) + '\n');
}

export function loadRecording(): AiRecording | null {
  if (!existsSync(AI_RECORDINGS_PATH)) return null;
  return JSON.parse(readFileSync(AI_RECORDINGS_PATH, 'utf8')) as AiRecording;
}

/** The validated reading for each recorded example; missing when the batch failed. */
export function parsedFromRecording(recording: AiRecording, examples: V2Example[]): Map<string, ParsedReading> {
  const byId = new Map(examples.map((e) => [e.id, e]));
  const out = new Map<string, ParsedReading>();
  for (const b of recording.batches) {
    if (!b.raw) continue;
    // Only a batch whose every example is in hand: the reply is positional.
    if (!b.ids.every((id) => byId.has(id))) continue;
    const slice = b.ids.map((id) => byId.get(id)!);
    const parsed = parseReaderBatch(b.raw, slice.map((e) => ({ text: e.text, stars: e.stars })), getPackOrFallback(b.pack));
    if (!parsed) continue;
    slice.forEach((e, i) => {
      if (parsed[i]) out.set(e.id, parsed[i]!);
    });
  }
  return out;
}

export function deterministicReading(e: V2Example): Reading {
  const n = normalizeFeedback({ text: e.text, stars: e.stars, pack: getPackOrFallback(e.pack), ai: null });
  return { sentiment: n.sentiment, praise: n.praiseTags, issues: n.issueTags, confidence: n.confidence, abstained: n.themes.length === 0 };
}

/** B: the AI reading on its own. A review it gave nothing for is an abstention. */
export function aiOnlyReading(parsed: ParsedReading | undefined): Reading {
  const s = parsed?.suggestion;
  if (!s) return { sentiment: 'NEUTRAL', praise: [], issues: [], confidence: null, abstained: true };
  return {
    sentiment: s.sentiment ?? 'NEUTRAL',
    praise: s.praiseTags,
    issues: s.issueTags,
    confidence: parsed?.confidence ?? null,
    abstained: Boolean(s.abstain) || s.issueTags.length + s.praiseTags.length === 0,
  };
}

/** C: production's policy — the router decides, normalize arbitrates. */
export function combinedReading(e: V2Example, parsed: ParsedReading | undefined): Reading {
  const pack = getPackOrFallback(e.pack);
  const route = routeForAi({ text: e.text, stars: e.stars }, pack);
  const ai = route.needsAi ? (parsed?.suggestion ?? null) : null;
  const n = normalizeFeedback({ text: e.text, stars: e.stars, pack, ai });
  return { sentiment: n.sentiment, praise: n.praiseTags, issues: n.issueTags, confidence: n.confidence, abstained: n.themes.length === 0 };
}
