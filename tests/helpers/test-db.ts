import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Real PostgreSQL database for service-layer tests (M20).
 *
 * RepOS was a SQLite application through M19 and its tests have always run
 * against a real database rather than a mock, because duplicate detection,
 * cascade behaviour and archiving all depend on actual database semantics.
 * That principle is unchanged; only the engine moved.
 *
 * Each test file gets its own PostgreSQL SCHEMA inside one isolated database,
 * which is the faithful translation of the old one-file-per-test-file rule:
 * tests are isolated from each other and can never reach anything real.
 *
 * The database is named by REPOS_TEST_DATABASE_URL and must NEVER be a
 * production database. The guard below refuses anything that does not look
 * like a local test instance, so a stray environment variable cannot point the
 * suite at customer data and then truncate it between tests.
 */

const ROOT = resolve(__dirname, '..', '..');

export const TEST_DATABASE_URL_VAR = 'REPOS_TEST_DATABASE_URL';

/**
 * Where the suite is allowed to run, said out loud by whoever runs it.
 *
 * There is deliberately no default. A default would mean a connection string
 * living in tracked source, and a connection string that works carries a
 * password — which is exactly the thing that should never be committed, even
 * when it guards nothing more than a throwaway local cluster.
 *
 * So the address is configuration, the repository holds none of it, and a
 * developer who has not set it gets told precisely what to do rather than
 * silently connecting to whatever happens to be listening.
 */
function baseUrl(): string {
  const configured = (process.env[TEST_DATABASE_URL_VAR] ?? '').trim();
  if (configured.length === 0) {
    throw new Error(
      `${TEST_DATABASE_URL_VAR} is not set, so there is no database to test against.\n` +
        'Point it at a LOCAL, DISPOSABLE PostgreSQL database — never a real one:\n' +
        `  ${TEST_DATABASE_URL_VAR}="postgresql://<user>:<password>@127.0.0.1:<port>/<database>"\n` +
        'The suite creates and drops a schema per test file and truncates tables between cases.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`${TEST_DATABASE_URL_VAR} is not a valid connection URL.`);
  }

  // A test run truncates every table between cases. Being wrong about which
  // database that is would be unrecoverable, so the suite refuses to start
  // against anything but a local host.
  const local = ['localhost', '127.0.0.1', '::1'];
  if (!local.includes(parsed.hostname)) {
    throw new Error(
      `Refusing to run tests against a non-local database (${parsed.hostname}). ` +
        `Set ${TEST_DATABASE_URL_VAR} to a local PostgreSQL instance.`,
    );
  }
  return configured;
}

/** One schema per test file, named from the file's own label. */
function schemaFor(name: string): string {
  const safe = name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  return `test_${safe}`;
}

export function createTestDb(name: string): PrismaClient {
  const schema = schemaFor(name);
  const base = baseUrl();
  const url = `${base}?schema=${schema}`;

  const prismaCli = join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');

  // Start from an empty schema so a leftover from an interrupted run cannot
  // leak rows into this one. Deliberately NOT `db push --force-reset`: that
  // flag resets whatever database it is pointed at, and this suite should
  // never hold a tool capable of doing that. Dropping one scratch schema by
  // name can only ever affect this test file.
  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'execute', '--stdin', '--url', base],
    {
      cwd: ROOT,
      input: `DROP SCHEMA IF EXISTS "${schema}" CASCADE; CREATE SCHEMA "${schema}";`,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--skip-generate'],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
      stdio: 'pipe',
    },
  );

  return new PrismaClient({ datasources: { db: { url } } });
}

/** Empties every table between tests. Order respects foreign keys. */
export async function resetDb(db: PrismaClient): Promise<void> {
  await db.businessContext.deleteMany();
  await db.feedbackGateway.deleteMany();
  await db.minute.deleteMany();
  await db.reviewItem.deleteMany();
  await db.snapshot.deleteMany();
  await db.timeEntry.deleteMany();
  await db.competitor.deleteMany();
  await db.kitConfig.deleteMany();
  await db.businessPolicy.deleteMany();
  await db.voiceProfile.deleteMany();
  await db.invitation.deleteMany();
  await db.membership.deleteMany();
  await db.improvementAction.deleteMany();
  await db.client.deleteMany();
  await db.user.deleteMany();
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
