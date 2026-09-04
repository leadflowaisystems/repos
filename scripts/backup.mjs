/**
 * Take a backup from the command line (M16).
 *
 * The same copy the Settings page takes, available without opening RepOS —
 * so it can be run before an upgrade, or from a scheduled task the operator
 * sets up themselves. RepOS schedules nothing on its own.
 *
 * Usage:
 *   npm run backup
 *   npm run backup -- --dir "D:\\repos-backups"
 */
import { existsSync, mkdirSync, openSync, readSync, closeSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// .env is written by scripts/ensure-env.mjs and holds DATABASE_URL only.
function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return null;
  const text = readFileSyncSafe(envPath);
  const match = text.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/m);
  return match?.[1]?.trim() ?? null;
}

function readFileSyncSafe(path) {
  const fd = openSync(path, 'r');
  try {
    const size = statSync(path).size;
    const buf = Buffer.alloc(size);
    readSync(fd, buf, 0, size, 0);
    return buf.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

function two(n) {
  return String(n).padStart(2, '0');
}

function stamp(at) {
  return `repos-${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}${two(at.getSeconds())}.db`;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = loadDatabaseUrl();
  if (!url || !url.startsWith('file:')) {
    console.error('No local database is configured. Run `npm run setup` first.');
    process.exitCode = 1;
    return;
  }
  process.env.DATABASE_URL = url;

  const relative = url.slice('file:'.length).trim();
  const source = isAbsolute(relative) ? resolve(relative) : resolve(root, 'prisma', relative);
  if (!existsSync(source)) {
    console.error(`The database file is not there: ${source}`);
    process.exitCode = 1;
    return;
  }

  const dir = resolve(argValue('--dir') ?? process.env.REPOS_BACKUP_DIR ?? join(root, 'backups'));
  if (resolve(dir) === resolve(source, '..')) {
    console.error('Backups must not be kept in the same folder as the live database.');
    process.exitCode = 1;
    return;
  }
  mkdirSync(dir, { recursive: true });

  let name = stamp(new Date());
  for (let n = 2; existsSync(join(dir, name)) && n <= 99; n += 1) {
    name = stamp(new Date()).replace(/\.db$/, `-${n}.db`);
  }
  const finalPath = join(dir, name);
  if (existsSync(finalPath)) {
    console.error('A backup with that name already exists. Nothing was overwritten.');
    process.exitCode = 1;
    return;
  }
  const tmpPath = `${finalPath}.writing`;
  if (existsSync(tmpPath)) unlinkSync(tmpPath);

  const db = new PrismaClient();
  try {
    await db.$executeRaw`VACUUM INTO ${tmpPath}`;

    await db.$executeRaw`ATTACH DATABASE ${tmpPath} AS repos_backup_check`;
    const rows = await db.$queryRawUnsafe('PRAGMA repos_backup_check.integrity_check');
    await db.$executeRawUnsafe('DETACH DATABASE repos_backup_check');

    const answer = rows?.[0] ? String(Object.values(rows[0])[0] ?? '') : '';
    if (answer.toLowerCase() !== 'ok') {
      unlinkSync(tmpPath);
      console.error(`SQLite reported a problem with the copy: ${answer}`);
      process.exitCode = 1;
      return;
    }

    renameSync(tmpPath, finalPath);
    const size = statSync(finalPath).size;
    console.log('');
    console.log(`Backup written and checked: ${finalPath}`);
    console.log(`${(size / (1024 * 1024)).toFixed(1)} MB. Copy it somewhere off this computer.`);
    console.log('');
  } catch (error) {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
    console.error(`The backup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
