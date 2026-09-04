import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_DIR_VAR,
  backupDir,
  backupFileName,
  createBackup,
  databaseFile,
  listBackups,
} from '@/lib/backup/service';
import { createClient } from '@/lib/clients/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * TAKING A COPY (M16).
 *
 * The operator's only protection against a dead disk. These tests care about
 * three things: that the copy is real, that it is checked, and that taking one
 * can never destroy an older one.
 */

let db: PrismaClient;

// The test harness hands its database straight to the Prisma client rather
// than through the environment, so the environment these tests pass around has
// to name the same file — otherwise the checks would be looking at the
// operator's real database while the copy came from this one.
const TEST_DB_FILE = resolve(process.cwd(), 'data', '.test', 'backup-service.db');
const TEST_DB_URL = `file:${TEST_DB_FILE.split('\\').join('/')}`;
// A fresh directory per test rather than one cleared between them (M18).
// On Windows, removing a directory whose SQLite file was just attached and
// detached fails intermittently while the handle closes, which made this file
// fail a dozen tests at random under parallel load.
const root = resolve(tmpdir(), `repos-backup-test-${process.pid}`);
let dir = root;
let caseNumber = 0;
let dbPath: string;

beforeAll(() => {
  db = createTestDb('backup-service');
  dbPath = databaseFile(env())!;
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  caseNumber += 1;
  dir = join(root, `case-${caseNumber}`);
});

afterAll(async () => {
  await db.$disconnect();
  try {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  } catch {
    // A handle the OS has not released yet. The directory is in the system
    // temp folder; leaving it is harmless and better than a flaky failure.
  }
});

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const values: Record<string, string | undefined> = {
    DATABASE_URL: TEST_DB_URL,
    [BACKUP_DIR_VAR]: dir,
    ...overrides,
  };
  return values as NodeJS.ProcessEnv;
}

describe('where things are', () => {
  it('finds the live database from the same setting the app uses', () => {
    expect(dbPath).toBe(TEST_DB_FILE);
    expect(existsSync(dbPath)).toBe(true);
  });

  it('refuses a DATABASE_URL that is not a local file', () => {
    expect(databaseFile(env({ DATABASE_URL: 'postgres://somewhere/db' }))).toBeNull();
    expect(databaseFile(env({ DATABASE_URL: '' }))).toBeNull();
  });

  it('keeps copies somewhere other than the live database folder', () => {
    const configured = backupDir(env());
    expect(configured).toBe(dir);
    // And the default is beside the install, not inside the data folder.
    expect(backupDir(env({ [BACKUP_DIR_VAR]: '' }))).toBe(resolve(process.cwd(), 'backups'));
  });

  it('names copies so they sort by when they were taken', () => {
    const early = backupFileName(new Date(2026, 0, 2, 3, 4, 5));
    const late = backupFileName(new Date(2026, 10, 20, 21, 22, 23));
    expect(early).toBe('repos-2026-01-02-030405.db');
    expect(late).toBe('repos-2026-11-20-212223.db');
    expect([late, early].sort()).toEqual([early, late]);
  });
});

describe('taking a copy', () => {
  /**
   * M20. RepOS moved to PostgreSQL, so there is no local database file to
   * copy and no VACUUM INTO to run. These cases used to prove the copy was
   * real, checked, and could never overwrite an older one. What has to be
   * proved now is narrower and, for an operator, more important: that RepOS
   * does not pretend to have taken a backup it cannot take.
   */

  it('says plainly that the provider owns backups now', async () => {
    const result = await createBackup(db, {
      env: env({ DATABASE_URL: 'postgresql://user:pw@localhost:5432/repos' }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/database provider/i);
    expect(result.detail).toMatch(/supabase/i);
  });

  it('never reports success when nothing was copied', async () => {
    const result = await createBackup(db, {
      env: env({ DATABASE_URL: 'postgresql://user:pw@localhost:5432/repos' }),
    });
    expect(result.ok).toBe(false);
  });

  it('leaves the live database alone', async () => {
    const created = await createClient(db, validClientInput({ businessName: 'Corner Cafe' }));
    expect(created.ok).toBe(true);
    const before = await db.client.count();

    await createBackup(db, { env: env() });

    expect(await db.client.count()).toBe(before);
  });

  it('says what went wrong when there is no database it understands', async () => {
    const result = await createBackup(db, { env: env({ DATABASE_URL: 'mysql://nope/db' }) });
    expect(result.ok).toBe(false);
  });

  it('says what went wrong when a file database is missing', async () => {
    const result = await createBackup(db, {
      env: env({ DATABASE_URL: 'file:../data/.test/definitely-not-here.db' }),
    });
    expect(result.ok).toBe(false);
  });
});

describe('listing what has been taken', () => {
  it('is empty, and says where it looked', async () => {
    const listed = await listBackups(env());
    expect(listed.files).toEqual([]);
    expect(listed.dir).toBe(dir);
  });

  it('ignores files that are not RepOS backups', async () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'notes.txt'), 'not a backup', 'utf8');
    writeFileSync(join(dir, 'something-else.db'), 'not a backup', 'utf8');

    const listed = await listBackups(env());
    expect(listed.files).toEqual([]);
  });
});
