#!/usr/bin/env node
/**
 * Runs the live AI-reader recording on the SYNTHETIC evaluation corpus.
 *
 *   node scripts/eval-ai-reader.mjs [all|dev|blind] [--model <id>] [--only-missing]
 *
 * Reads only GROQ_API_KEY, GROQ_MODEL and REPOS_AI_TIMEOUT_MS from .env.local
 * and hands them to the test process. It never prints, logs or writes them:
 * the key is in the child's environment and nowhere else. Nothing but the
 * synthetic examples in tests/eval/ is ever sent.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const sets = ['all', 'dev', 'blind'].includes(args[0] ?? '') ? args[0] : 'all';
const modelFlag = args.indexOf('--model');
const modelOverride = modelFlag !== -1 ? args[modelFlag + 1] : undefined;
const onlyMissing = args.includes('--only-missing');

const env = readFileSync('.env.local', 'utf8');
const read = (key) => {
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(env);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};
const key = read('GROQ_API_KEY');
if (!key) {
  console.error('GROQ_API_KEY is not set in .env.local.');
  process.exit(1);
}

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', 'tests/m46.ai-reader-live.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    REPOS_EVAL_AI_LIVE: '1',
    REPOS_EVAL_AI_SETS: sets,
    REPOS_EVAL_AI_ONLY_MISSING: onlyMissing ? '1' : '0',
    REPOS_AI_DISABLED: '0',
    GROQ_API_KEY: key,
    GROQ_MODEL: modelOverride || read('GROQ_MODEL'),
    REPOS_AI_TIMEOUT_MS: read('REPOS_AI_TIMEOUT_MS') || '45000',
  },
});
process.exit(result.status ?? 1);
