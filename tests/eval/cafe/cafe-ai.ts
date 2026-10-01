import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
import type { CafeExample } from './cafe-eval';

/**
 * RECORDING THE AI READER ON THE CAFÉ CORPUS.
 *
 * Every example is sent — not only those the router would send — so the AI
 * reader can be measured on its own (B). The combined reader (C) then uses
 * the recorded reading only where production's router would have asked for
 * one. Replies are recorded once per configuration and every score is
 * computed from the recording, so the numbers are reproducible offline.
 *
 * Synthetic examples only; no customer feedback is ever sent from here.
 */

export type CafeAiConfig = { model: string; effort: 'low' | 'medium' | 'high' | null; batchSize?: number };

export type CafeAiBatch = {
  ids: string[];
  raw: string | null;
  error: string | null;
  ms: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type CafeAiRecording = {
  readerVersion: number;
  config: CafeAiConfig;
  recordedAt: string;
  batches: CafeAiBatch[];
};

export const recordingPath = (set: string, c: CafeAiConfig) =>
  `tests/eval/cafe/recordings/${set}--${c.model.replace(/[^a-z0-9.-]+/gi, '_')}--${c.effort ?? 'default'}--b${c.batchSize ?? CLASSIFY_BATCH_SIZE}.json`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function recordCafe(
  set: string,
  examples: CafeExample[],
  config: CafeAiConfig,
  log: (line: string) => void = () => {},
): Promise<CafeAiRecording> {
  const path = recordingPath(set, config);
  const old: CafeAiRecording | null = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const reusable = new Map<string, CafeAiBatch>();
  if (old && old.readerVersion === AI_READER_VERSION) for (const b of old.batches) if (b.raw) reusable.set(b.ids.join(','), b);
  const pack = getPackOrFallback('restaurant');
  const size = config.batchSize ?? CLASSIFY_BATCH_SIZE;
  const rec: CafeAiRecording = { readerVersion: AI_READER_VERSION, config, recordedAt: new Date().toISOString(), batches: [] };
  const previous = process.env.GROQ_MODEL;
  process.env.GROQ_MODEL = config.model;
  try {
    for (let i = 0; i < examples.length; i += size) {
      const slice = examples.slice(i, i + size);
      const key = slice.map((e) => e.id).join(',');
      const cached = reusable.get(key);
      if (cached) {
        rec.batches.push(cached);
        continue;
      }
      let batch: CafeAiBatch | null = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const t0 = Date.now();
        const run = await runCompletion({
          system: SYSTEM_PROMPT,
          user: buildUserPrompt(pack, slice.map((e) => ({ text: e.text, stars: e.stars }))),
          json: true,
          temperature: 0,
          maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
          reasoningEffort: config.effort ?? undefined,
        });
        const ms = Date.now() - t0;
        if (run.ok) {
          batch = { ids: slice.map((e) => e.id), raw: run.text, error: null, ms, inputTokens: run.usage?.inputTokens ?? null, outputTokens: run.usage?.outputTokens ?? null };
          break;
        }
        const error = [run.reason, ...run.attempts].join(' ').replace(/gsk_[A-Za-z0-9]+/g, '[redacted]').replace(/org_[A-Za-z0-9]+/g, 'org_[redacted]');
        batch = { ids: slice.map((e) => e.id), raw: null, error, ms, inputTokens: null, outputTokens: null };
        if (!/HTTP 429/.test(error) || /per day|\bTPD\b|\bRPD\b/i.test(error)) break;
        const m = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(error);
        const wait = (m ? (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 : 20_000) + 1_000;
        log(`  429, waiting ${Math.round(wait / 1000)}s`);
        await sleep(wait);
      }
      rec.batches.push(batch!);
      log(`  ${config.model}/${config.effort ?? 'default'} batch ${Math.floor(i / size) + 1}/${Math.ceil(examples.length / size)} ${batch!.raw ? 'ok' : 'FAILED ' + batch!.error?.slice(0, 120)} ${batch!.ms}ms out=${batch!.outputTokens}`);
      writeFileSync(path, JSON.stringify(rec, null, 2) + '\n');
    }
  } finally {
    if (previous === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = previous;
  }
  writeFileSync(path, JSON.stringify(rec, null, 2) + '\n');
  return rec;
}

export function loadCafeRecording(set: string, config: CafeAiConfig): CafeAiRecording | null {
  const path = recordingPath(set, config);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as CafeAiRecording) : null;
}

/** The validated reading per example, and per-batch completeness (rows parsed / rows sent). */
export function parseCafeRecording(rec: CafeAiRecording, examples: CafeExample[]): {
  readings: Map<string, ParsedReading>;
  batches: number;
  failedBatches: number;
  rowsSent: number;
  rowsParsed: number;
  ms: number[];
  outTokens: number[];
} {
  const byId = new Map(examples.map((e) => [e.id, e]));
  const pack = getPackOrFallback('restaurant');
  const readings = new Map<string, ParsedReading>();
  let failedBatches = 0;
  let rowsSent = 0;
  let rowsParsed = 0;
  const ms: number[] = [];
  const outTokens: number[] = [];
  for (const b of rec.batches) {
    rowsSent += b.ids.length;
    ms.push(b.ms);
    if (b.outputTokens !== null) outTokens.push(b.outputTokens);
    if (!b.raw || !b.ids.every((id) => byId.has(id))) {
      failedBatches += 1;
      continue;
    }
    const slice = b.ids.map((id) => byId.get(id)!);
    const parsed = parseReaderBatch(b.raw, slice.map((e) => ({ text: e.text, stars: e.stars })), pack);
    if (!parsed) {
      failedBatches += 1;
      continue;
    }
    slice.forEach((e, i) => {
      const p = parsed[i];
      if (p?.suggestion) {
        readings.set(e.id, p);
        rowsParsed += 1;
      }
    });
  }
  return { readings, batches: rec.batches.length, failedBatches, rowsSent, rowsParsed, ms, outTokens };
}
