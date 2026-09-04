import { existsSync } from 'node:fs';
import { mkdir, open, readdir, rename, stat, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';

/**
 * TAKING A COPY (M16).
 *
 * RepOS holds a single SQLite file, and everything a client's business
 * intelligence is built from lives in it. One bad disk and the whole record is
 * gone, so the operator needs a copy they can take away — on demand, in one
 * click, with a plain answer about whether it worked.
 *
 * How the copy is made, and why it is not a file copy:
 *
 *   `VACUUM INTO` asks SQLite itself to write a fresh, fully-formed database
 *   at a new path. It runs inside a read transaction, so the copy is a single
 *   consistent moment even if RepOS is being used while it runs — which a
 *   plain file copy cannot promise. It also refuses to overwrite anything,
 *   which is the guarantee this feature needs most.
 *
 * The copy is written to a temporary name, checked, and only then given its
 * real name. A file in the backups folder is therefore always a backup that
 * passed its check — never a half-written one.
 *
 * Backups are written OUTSIDE the folder holding the live database, are never
 * inside `public/`, and are never uploaded anywhere. There is no cloud backup
 * in RepOS and none is planned.
 */

export const BACKUP_DIR_VAR = 'REPOS_BACKUP_DIR';

export type BackupFile = {
  name: string;
  path: string;
  bytes: number;
  takenAt: Date;
};

export type BackupResult =
  | { ok: true; file: BackupFile; verified: 'INTEGRITY_CHECK' | 'STRUCTURE' }
  | { ok: false; reason: string; detail?: string };

/**
 * Where the live database is, read from the same setting Prisma uses.
 *
 * `DATABASE_URL` is a `file:` URL whose relative paths are resolved against
 * the `prisma/` directory — that is Prisma's rule, not ours, and the whole
 * installation depends on it, so it is repeated here rather than guessed.
 */
export function databaseFile(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.DATABASE_URL ?? '').trim();
  if (!raw.startsWith('file:')) return null;
  const p = raw.slice('file:'.length).trim();
  if (p.length === 0) return null;
  return isAbsolute(p) ? resolve(p) : resolve(process.cwd(), 'prisma', p);
}

/** Where copies are kept. Beside the installation, never inside the data folder. */
export function backupDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env[BACKUP_DIR_VAR] ?? '').trim();
  if (configured.length > 0) return resolve(configured);
  return resolve(process.cwd(), 'backups');
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** `repos-2026-09-03-221407.db` — sorts chronologically as plain text. */
export function backupFileName(at: Date): string {
  return [
    'repos-',
    at.getFullYear(),
    '-',
    two(at.getMonth() + 1),
    '-',
    two(at.getDate()),
    '-',
    two(at.getHours()),
    two(at.getMinutes()),
    two(at.getSeconds()),
    '.db',
  ].join('');
}

/**
 * A name nothing is using yet.
 *
 * Two backups in the same second get `-2`, `-3` and so on rather than one
 * quietly replacing the other. Nothing in the backups folder is ever
 * overwritten, by any path through this file.
 */
function freeName(dir: string, at: Date): string | null {
  const base = backupFileName(at);
  if (!existsSync(join(dir, base))) return base;
  for (let n = 2; n <= 99; n += 1) {
    const candidate = base.replace(/\.db$/, `-${n}.db`);
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  return null;
}

const SQLITE_MAGIC = 'SQLite format 3' + String.fromCharCode(0);

/** The first 16 bytes of any SQLite file. A cheap check that we wrote a database. */
async function looksLikeSqlite(path: string): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buf, 0, 16, 0);
    return bytesRead === 16 && buf.toString('latin1') === SQLITE_MAGIC;
  } finally {
    await handle.close();
  }
}

/**
 * Asks SQLite whether the copy is sound, by attaching it and running the same
 * check a database repair tool would. Falls back to the structural check when
 * attaching is not possible, and says which check actually ran.
 */
async function verify(
  db: PrismaClient,
  path: string,
): Promise<{ ok: true; how: 'INTEGRITY_CHECK' | 'STRUCTURE' } | { ok: false; reason: string }> {
  if (!(await looksLikeSqlite(path))) {
    return { ok: false, reason: 'The copy that was written is not a database file.' };
  }
  try {
    await db.$executeRaw`ATTACH DATABASE ${path} AS repos_backup_check`;
  } catch {
    return { ok: true, how: 'STRUCTURE' };
  }
  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'PRAGMA repos_backup_check.integrity_check',
    );
    const first = rows[0];
    const answer = first ? String(Object.values(first)[0] ?? '') : '';
    if (answer.toLowerCase() !== 'ok') {
      return { ok: false, reason: `SQLite reported a problem with the copy: ${answer}` };
    }
    return { ok: true, how: 'INTEGRITY_CHECK' };
  } finally {
    // Detaching must happen even if the check throws, or every later backup
    // in this process fails on the name already being in use.
    try {
      await db.$executeRawUnsafe('DETACH DATABASE repos_backup_check');
    } catch {
      // Nothing useful to do: the copy has already been judged.
    }
  }
}

/**
 * Take a backup now. Returns what happened, in words the operator can act on.
 */
export async function createBackup(
  db: PrismaClient,
  options: { now?: Date; env?: NodeJS.ProcessEnv } = {},
): Promise<BackupResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();

  const source = databaseFile(env);
  if (!source) {
    // M20. RepOS runs on PostgreSQL, which has no local file to copy. Saying
    // so plainly matters more than the feature did: an operator who thinks
    // they took a backup and did not is worse off than one who knows they
    // have none. Managed daily backups and point-in-time recovery come from
    // the database provider now, and the operator is told where to find them.
    if ((env.DATABASE_URL ?? '').trim().startsWith('postgres')) {
      return {
        ok: false,
        reason: 'Backups are handled by the database provider, not by RepOS.',
        detail:
          'RepOS runs on PostgreSQL. There is no local database file to copy — ' +
          'take backups and restore points from the Supabase project dashboard.',
      };
    }
    return {
      ok: false,
      reason: 'RepOS cannot tell where its own database file is, so it did not copy anything.',
      detail: 'DATABASE_URL is missing or is not a local file: path.',
    };
  }
  if (!existsSync(source)) {
    return { ok: false, reason: 'The database file is not where RepOS expects it to be.' };
  }

  const dir = backupDir(env);
  if (resolve(dir) === resolve(source, '..')) {
    return {
      ok: false,
      reason: 'Backups must not be kept in the same folder as the live database.',
    };
  }

  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    return {
      ok: false,
      reason: 'RepOS could not create the backups folder.',
      detail: message(error),
    };
  }

  const name = freeName(dir, now);
  if (!name) {
    return { ok: false, reason: 'Too many backups were taken in the same second. Try again.' };
  }

  const finalPath = join(dir, name);
  const tmpPath = `${finalPath}.writing`;
  // VACUUM INTO refuses to write over an existing file, which is what we want
  // — but a leftover from a crashed run would then block every later attempt.
  if (existsSync(tmpPath)) await removeQuietly(tmpPath);

  try {
    await db.$executeRaw`VACUUM INTO ${tmpPath}`;
  } catch (error) {
    await removeQuietly(tmpPath);
    return { ok: false, reason: 'SQLite could not write the copy.', detail: message(error) };
  }

  const checked = await verify(db, tmpPath);
  if (!checked.ok) {
    await removeQuietly(tmpPath);
    return { ok: false, reason: checked.reason };
  }

  try {
    await rename(tmpPath, finalPath);
  } catch (error) {
    await removeQuietly(tmpPath);
    return {
      ok: false,
      reason: 'The copy could not be given its final name.',
      detail: message(error),
    };
  }

  const info = await stat(finalPath);
  return {
    ok: true,
    verified: checked.how,
    file: { name, path: finalPath, bytes: info.size, takenAt: info.mtime },
  };
}

/** Every backup on this computer, newest first. */
export async function listBackups(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ dir: string; files: BackupFile[] }> {
  const dir = backupDir(env);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { dir, files: [] };
  }

  const files: BackupFile[] = [];
  for (const name of names) {
    if (!name.startsWith('repos-') || !name.endsWith('.db')) continue;
    const path = join(dir, name);
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      files.push({ name, path, bytes: info.size, takenAt: info.mtime });
    } catch {
      // A file that vanished between listing and reading is simply not listed.
    }
  }
  files.sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  return { dir, files };
}

async function removeQuietly(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Already gone, or held open by something else. Either way there is
    // nothing the operator could do about it, so it is not reported.
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
