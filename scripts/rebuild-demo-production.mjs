/**
 * Rebuild — or put back — the Corner Cafe demo in PRODUCTION (M24).
 *
 *   node scripts/rebuild-demo-production.mjs <verified backup folder>            dry run
 *   node scripts/rebuild-demo-production.mjs <verified backup folder> --yes      rebuild
 *   node scripts/rebuild-demo-production.mjs <verified backup folder> --restore  put the
 *                                              client's rows back from that backup
 *
 * Why a script and not a command: the rebuild deletes and re-creates every
 * feedback row, check-in, improvement, minute and context line of one demo
 * client, and that is only safe when three things are true at once. This
 * script refuses to run unless they are:
 *
 *   1. The target is the database a VERIFIED backup was taken from. The
 *      connection comes from `.env.local` (`DIRECT_DATABASE_URL`, the owner
 *      role over the session pooler) and is compared with the identity the
 *      backup's `manifest.json` recorded; the folder must also carry a
 *      `verification.json` with `pass: true`.
 *   2. The client is the demo restaurant, by name, and nothing else. The row,
 *      its memberships, its feedback page and its printed QR token are never
 *      touched by either direction.
 *   3. `--yes` (or `--restore`) was said out loud. Without it, the script
 *      prints what it would remove and stops.
 *
 * The rebuild itself is `scripts/demo-seed.ts --client "Corner Cafe" --replace`,
 * run with the deterministic reader so the numbers match what
 * `tests/m24.command-center.test.ts` asserts. `--restore` reverses it from the
 * backup's own rows, table by table, in one transaction.
 *
 * No URL and no password is ever printed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_CLIENT = 'Corner Cafe';

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith('--'));
const yes = args.includes('--yes');
const restore = args.includes('--restore');
// Rehearsal only: skips the manifest match for a LOOPBACK target, never a remote one.
const loopbackOnly = args.includes('--rehearsal-loopback');

if (!folder) {
  console.error('usage: node scripts/rebuild-demo-production.mjs <verified backup folder> [--yes | --restore]');
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

// `.env.local` wins over process.env, for the reason `backup-production.mjs`
// gives: importing the Prisma client loads `.env` (the LOCAL cluster) first.
const env = loadEnv(resolve(ROOT, '.env.local'));
const url = loopbackOnly ? process.env.REPOS_REHEARSAL_URL ?? '' : env.DIRECT_DATABASE_URL ?? '';
if (!url) {
  console.error(loopbackOnly ? 'REPOS_REHEARSAL_URL is not set.' : 'DIRECT_DATABASE_URL is missing from .env.local.');
  process.exit(2);
}
const target = new URL(url);
const identity = `${target.hostname}:${target.port || '5432'}/${target.pathname.slice(1)} as ${target.username}`;

// --- Gate 1: the verified backup names this database ------------------------
const manifestPath = resolve(folder, 'manifest.json');
const verificationPath = resolve(folder, 'verification.json');
if (!existsSync(manifestPath)) {
  console.error(`No manifest.json in ${folder}.`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const recorded = manifest.database ?? {};
if (loopbackOnly) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
    console.error('--rehearsal-loopback only applies to a loopback target.');
    process.exit(2);
  }
  console.log(`rehearsal target: ${identity}`);
} else {
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

// --- The client, by name ------------------------------------------------------
const db = new PrismaClient({ datasources: { db: { url } } });

async function findDemoClient() {
  const client = await db.client.findFirst({
    where: { businessName: { equals: DEMO_CLIENT, mode: 'insensitive' } },
    select: { id: true, businessName: true, vertical: true },
  });
  if (!client) throw new Error(`No client named "${DEMO_CLIENT}" in the target database.`);
  return client;
}

async function counts(clientId) {
  const where = { clientId };
  const [feedback, snapshots, actions, minutes, context] = await Promise.all([
    db.reviewItem.count({ where }),
    db.snapshot.count({ where }),
    db.improvementAction.count({ where }),
    db.minute.count({ where }),
    db.businessContext.count({ where }),
  ]);
  return { feedback, snapshots, actions, minutes, context };
}

function rowsFor(table, clientId) {
  const path = resolve(folder, 'data', `public.${table}.ndjson`);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
    .filter((row) => row.clientId === clientId);
}

/**
 * Put the client's rows back exactly as the backup holds them.
 *
 * One transaction: everything the client owns in the five tables is removed,
 * then the backup's rows are inserted in foreign-key order through
 * `jsonb_populate_recordset`, so every column — dates, JSON strings, nulls —
 * is typed by the database from the row's own JSON rather than re-typed here.
 */
async function restoreFromBackup(client) {
  const tables = ['Snapshot', 'ReviewItem', 'ImprovementAction', 'Minute', 'BusinessContext'];
  const rows = Object.fromEntries(tables.map((t) => [t, rowsFor(t, client.id)]));
  console.log(
    `backup holds for ${client.businessName}: ` +
      tables.map((t) => `${t} ${rows[t].length}`).join(', '),
  );
  await db.$transaction(async (tx) => {
    const where = { clientId: client.id };
    await tx.improvementAction.deleteMany({ where });
    await tx.minute.deleteMany({ where });
    await tx.businessContext.deleteMany({ where });
    await tx.snapshot.deleteMany({ where });
    await tx.reviewItem.deleteMany({ where });
    for (const table of tables) {
      if (rows[table].length === 0) continue;
      const json = JSON.stringify(rows[table]);
      await tx.$executeRawUnsafe(
        `INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb)`,
        json,
      );
    }
  });
}

async function main() {
  const client = await findDemoClient();
  const before = await counts(client.id);
  console.log(
    `${client.businessName} (${client.id}, ${client.vertical}) holds ${before.feedback} feedback, ` +
      `${before.snapshots} check-ins, ${before.actions} improvements, ${before.minutes} minutes, ${before.context} context lines.`,
  );

  if (restore) {
    await restoreFromBackup(client);
    const after = await counts(client.id);
    console.log(
      `Restored from the backup: ${after.feedback} feedback, ${after.snapshots} check-ins, ` +
        `${after.actions} improvements, ${after.minutes} minutes, ${after.context} context lines.`,
    );
    return;
  }

  if (!yes) {
    console.log('Dry run: nothing changed. Add --yes to rebuild the story, or --restore to put the backup\'s rows back.');
    return;
  }

  await db.$disconnect();
  // Node running tsx's own entry point: no shell, so the client name with its
  // space survives as one argument on every platform.
  const result = spawnSync(
    process.execPath,
    [resolve(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'scripts/demo-seed.ts', '--client', DEMO_CLIENT, '--replace', '--yes'],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: url,
        DIRECT_DATABASE_URL: url,
        REPOS_AI_DISABLED: '1',
        GROQ_API_KEY: '',
      },
    },
  );
  if (result.status !== 0) {
    console.error(`The rebuild exited with ${result.status}. The --restore mode puts the backup's rows back.`);
    process.exit(result.status ?? 1);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
