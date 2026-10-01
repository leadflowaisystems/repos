import { describe, expect, it } from 'vitest';
import { aiStatus } from '@/lib/ai';
import { SEMANTIC_V2_DEV } from './eval/semantic-v2-dev';
import { SEMANTIC_V2_DEV2 } from './eval/semantic-v2-dev2';
import { SEMANTIC_V2_DEV3 } from './eval/semantic-v2-dev3';
import { SEMANTIC_V2_DEV4 } from './eval/semantic-v2-dev4';
import { SEMANTIC_V2_LOCKED } from './eval/semantic-v2-locked';
import { SEMANTIC_V2_FRESH2 } from './eval/semantic-v2-fresh2';
import { SEMANTIC_V2_FRESH3 } from './eval/semantic-v2-fresh3';
import { SEMANTIC_V2_FRESH4 } from './eval/semantic-v2-fresh4';
import type { V2Example } from './eval/semantic-v2';
import { loadRecording, recordAiReadings, saveRecording } from './eval/ai-reader-eval';

/**
 * M46 — RECORD THE AI READER ON THE SYNTHETIC CORPUS. Deliberate, and off by default.
 *
 * Sends SYNTHETIC examples only — never customer feedback — to the configured
 * provider with production's own prompt, batch size and output limit, and
 * writes the raw replies to tests/eval/ai-recordings.json (git-ignored). The
 * run resumes: batches already recorded for this reader version and model are
 * not sent again. Everything is scored offline by m46.semantic-eval.test.ts.
 *
 * Start it through the runner, which passes only the provider settings and
 * never prints them:
 *
 *   node scripts/eval-ai-reader.mjs [all|dev|blind] [--model <id>]
 */
const live = process.env.REPOS_EVAL_AI_LIVE === '1';
const which = process.env.REPOS_EVAL_AI_SETS ?? 'all';

/** REPOS_EVAL_AI_ONLY_MISSING=1: only examples with no recorded reply yet, batched on their own. */
const onlyMissing = process.env.REPOS_EVAL_AI_ONLY_MISSING === '1';

function examples(): V2Example[] {
  const dev = [...SEMANTIC_V2_DEV, ...SEMANTIC_V2_DEV2, ...SEMANTIC_V2_DEV3, ...SEMANTIC_V2_DEV4];
  const blind = [...SEMANTIC_V2_LOCKED, ...SEMANTIC_V2_FRESH2, ...SEMANTIC_V2_FRESH3, ...SEMANTIC_V2_FRESH4];
  return which === 'dev' ? dev : which === 'blind' ? blind : [...dev, ...blind];
}

describe.skipIf(!live)('recording the AI reader (live, synthetic data only)', () => {
  it('records a reply for every batch', async () => {
    expect(aiStatus().enabled, 'a provider key is required').toBe(true);
    const existing = loadRecording();
    const recorded = new Set((existing?.batches ?? []).filter((b) => b.raw).flatMap((b) => b.ids));
    const todo = onlyMissing ? examples().filter((e) => !recorded.has(e.id)) : examples();
    console.log(`examples to record: ${todo.length}`);
    const recording = await recordAiReadings(todo, {
      existing,
      pauseMs: Number(process.env.REPOS_EVAL_AI_PAUSE_MS ?? 8_000),
      onRetry: (pack, attempt, waitMs, reason) =>
        console.log(`retry ${pack} attempt ${attempt}, waiting ${Math.round(waitMs / 1000)}s: ${reason.slice(0, 300)}`),
      onBatch: (r, done, total) => {
        // Merge with what is already on disk, so dev and blind runs add up.
        const keep = (existing?.batches ?? []).filter((b) => !r.batches.some((x) => x.ids.join(',') === b.ids.join(',')));
        saveRecording({ ...r, batches: [...keep, ...r.batches] });
        const last = r.batches[r.batches.length - 1]!;
        console.log(`batch ${done}/${total} ${last.pack} ${last.raw ? 'ok' : `FAILED: ${last.error}`}`);
      },
    });
    const failed = recording.batches.filter((b) => !b.raw);
    expect(failed.map((b) => `${b.pack}: ${b.error}`)).toEqual([]);
  }, 7_200_000);
});
