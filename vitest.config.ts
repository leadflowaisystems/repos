import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * THE TEST SUITE'S DATABASE ADDRESSES, AND NOTHING ELSE (M20).
 *
 * The suite needs two connection strings and ships neither, on purpose: a
 * working default would be a database password in tracked source. Exporting
 * them in the shell is the supported way and always wins. This reads one
 * optional, git-ignored file so a developer does not have to re-export them for
 * every run.
 *
 * IT IS DELIBERATELY NOT `loadEnv`, AND DELIBERATELY NOT `.env` OR `.env.local`.
 * Vite's own `loadEnv(mode, dir, '')` — the recipe everyone copies — returns
 * EVERY key from `.env` and `.env.local`, and in this repository `.env.local`
 * holds the production Supabase `DATABASE_URL`. Copying that into the test
 * process would point a suite that truncates tables between cases at customer
 * data. `envPrefix` would be safe today and one typo from disaster tomorrow:
 * `REPOS_` rather than `REPOS_TEST_` matches `REPOS_APP_DATABASE_URL`, which is
 * also production.
 *
 * So: one named file, one regex, nothing else can come through. `.env.repos-test`
 * starts with `.env`, so `.gitignore`'s `.env*` already covers it, and it is not
 * one of the four names Vite itself parses — which means this loader is its only
 * reader in the entire toolchain.
 */
const TEST_ENV_FILE = '.env.repos-test';
const ALLOWED = /^REPOS_TEST_[A-Z0-9_]+$/;

function reposTestEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(new URL(`./${TEST_ENV_FILE}`, import.meta.url), 'utf8');
  } catch {
    // Absent is fine. The suite says so itself, loudly, in
    // tests/m20.runtime-role.test.ts rather than by quietly skipping.
    return out;
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1] ?? '';
    const value = match[2] ?? '';
    if (!ALLOWED.test(key)) continue;
    // An explicit export always beats the file: vitest applies `test.env` to
    // workers with a plain assignment, so without this the file would silently
    // override the shell, which is the opposite of what anyone expects.
    if (process.env[key]) continue;
    out[key] = value.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    env: reposTestEnv(),
    // Service tests run against a real SQLite file. On Windows, several test
    // files writing at once can push a heavy case past the 5s default even
    // though it finishes in well under a second on its own.
    testTimeout: 30_000,
  },
});
