import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Real SQLite database for service-layer tests.
 *
 * RepOS is a SQLite application, so M1 is tested against SQLite rather than a
 * mock: duplicate detection, cascade behaviour and archiving all depend on
 * actual database semantics.
 *
 * Each test file gets its own file under data/.test/ and pushes the real
 * schema into it, so tests never touch the operator's working database.
 */

const ROOT = resolve(__dirname, '..', '..');
const TEST_DIR = join(ROOT, 'data', '.test');

export function createTestDb(name: string): PrismaClient {
  mkdirSync(TEST_DIR, { recursive: true });

  const file = join(TEST_DIR, `${name}.db`);
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const path = `${file}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }

  // Prisma resolves relative SQLite paths against the schema directory, so an
  // absolute URL is used here. Forward slashes work on Windows too.
  const url = `file:${file.replace(/\\/g, '/')}`;

  // Invoke the Prisma CLI through Node directly rather than through npx, so no
  // shell is involved and the call behaves identically on Windows and POSIX.
  execFileSync(
    process.execPath,
    [
      join(ROOT, 'node_modules', 'prisma', 'build', 'index.js'),
      'db',
      'push',
      '--skip-generate',
    ],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    },
  );

  return new PrismaClient({ datasources: { db: { url } } });
}

/** Empties every table between tests. Order respects foreign keys. */
export async function resetDb(db: PrismaClient): Promise<void> {
  await db.minute.deleteMany();
  await db.reviewItem.deleteMany();
  await db.snapshot.deleteMany();
  await db.timeEntry.deleteMany();
  await db.competitor.deleteMany();
  await db.kitConfig.deleteMany();
  await db.businessPolicy.deleteMany();
  await db.voiceProfile.deleteMany();
  await db.client.deleteMany();
  await db.appSetting.deleteMany();
}

/** Minimal valid client input, spread-and-override in tests. */
export function validClientInput(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Sunrise Clinic',
    vertical: 'clinic',
    areaLabel: 'Kothrud, Pune',
    mapsUrl: null,
    reviewLinkUrl: null,
    ownerName: 'A. Owner',
    ownerPhone: null,
    ownerEmail: null,
    avgCustomerValueInr: 900,
    plan: 'STARTER',
    status: 'PROSPECT',
    onboardingDate: null,
    baselineRating: null,
    baselineReviewCount: null,
    baselineReviewsPerWeek: null,
    baselineObservedAt: null,
    kitInstalledDate: null,
    notes: null,
    ...overrides,
  };
}
