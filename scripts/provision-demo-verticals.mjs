/**
 * Provision the six vertical demo workspaces in PRODUCTION — or rehearse it.
 *
 *   node scripts/provision-demo-verticals.mjs <verified backup folder> --admin-email <admin>          dry run
 *   node scripts/provision-demo-verticals.mjs <verified backup folder> --admin-email <admin> --yes    provision
 *   node scripts/provision-demo-verticals.mjs <any folder> --rehearsal-loopback --admin-email <admin> [--yes]
 *        (REPOS_REHEARSAL_URL names a LOOPBACK database; Supabase is never called)
 *
 *   Extra flags pass through: --only clinic,gym   --reseed salon
 *
 * The same three gates as `rebuild-demo-production.mjs`:
 *
 *   1. The target is the database a VERIFIED backup was taken from: the
 *      connection comes from `.env.local` (`DIRECT_DATABASE_URL`) and must match
 *      the backup's `manifest.json`, and the folder must hold a
 *      `verification.json` with `pass: true`.
 *   2. Only businesses carrying a `[headway-demo:<key>]` marker are written —
 *      see `scripts/demo/provision.ts`. Corner Cafe and every other business
 *      are never touched.
 *   3. Nothing is written without `--yes`.
 *
 * Demo logins need `SUPABASE_SERVICE_ROLE_KEY` (in the environment or in
 * `.env.local`). Without it the workspaces are still provisioned and the run
 * says that no login was created. New passwords go to `secrets/demo-logins.json`
 * (git-ignored); no URL, key or password is ever printed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const folder = args[0] && !args[0].startsWith('--') ? args[0] : null;
const passThrough = args.slice(folder ? 1 : 0).filter((a) => a !== '--rehearsal-loopback');
const loopbackOnly = args.includes('--rehearsal-loopback');

if (!folder) {
  console.error('usage: node scripts/provision-demo-verticals.mjs <verified backup folder> --admin-email <admin> [--yes]');
  process.exit(2);
}

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// `.env.local` wins over process.env: importing the Prisma client loads `.env`
// (the LOCAL cluster) first — see backup-production.mjs.
const env = loadEnv(resolve(ROOT, '.env.local'));
const url = loopbackOnly ? process.env.REPOS_REHEARSAL_URL ?? '' : env.DIRECT_DATABASE_URL ?? '';
if (!url) {
  console.error(loopbackOnly ? 'REPOS_REHEARSAL_URL is not set.' : 'DIRECT_DATABASE_URL is missing from .env.local.');
  process.exit(2);
}
const target = new URL(url);
const identity = `${target.hostname}:${target.port || '5432'}/${target.pathname.slice(1)} as ${target.username}`;
const LOOPBACK = ['127.0.0.1', 'localhost', '::1'];

if (loopbackOnly) {
  if (!LOOPBACK.includes(target.hostname)) {
    console.error('--rehearsal-loopback only applies to a loopback target.');
    process.exit(2);
  }
  console.log(`rehearsal target: ${identity}`);
} else {
  const manifestPath = resolve(folder, 'manifest.json');
  const verificationPath = resolve(folder, 'verification.json');
  if (!existsSync(manifestPath)) {
    console.error(`No manifest.json in ${folder}.`);
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const recorded = manifest.database ?? {};
  const verification = existsSync(verificationPath) ? JSON.parse(readFileSync(verificationPath, 'utf8')) : null;
  const matches =
    recorded.host === target.hostname &&
    String(recorded.port ?? '5432') === (target.port || '5432') &&
    recorded.database === target.pathname.slice(1) &&
    (!recorded.user || recorded.user === target.username);
  console.log(`target:  ${identity}`);
  console.log(`backup:  ${recorded.host}:${recorded.port}/${recorded.database} as ${recorded.user} (${manifest.takenAt ?? 'undated'})`);
  if (!matches) {
    console.error('The target does not match the database the backup was taken from. Refusing.');
    process.exit(2);
  }
  if (!verification || verification.pass !== true) {
    console.error('That backup has not been verified (no verification.json with pass: true). Verify it first.');
    process.exit(2);
  }
}

const result = spawnSync(
  process.execPath,
  [resolve(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'scripts/demo-verticals.ts', ...passThrough],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_DATABASE_URL: url,
      // The deterministic reader, always: the demo reads the same everywhere.
      REPOS_AI_DISABLED: '1',
      GROQ_API_KEY: '',
      // A rehearsal must never mint a real identity for a throwaway database.
      SUPABASE_URL: loopbackOnly ? '' : process.env.SUPABASE_URL ?? env.SUPABASE_URL ?? '',
      SUPABASE_SERVICE_ROLE_KEY: loopbackOnly ? '' : process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      REPOS_PUBLIC_BASE_URL: process.env.REPOS_PUBLIC_BASE_URL ?? env.REPOS_PUBLIC_BASE_URL ?? '',
    },
  },
);
process.exit(result.status ?? 1);
