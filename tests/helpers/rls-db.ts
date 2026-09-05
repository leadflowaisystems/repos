import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * A DATABASE THAT ENFORCES RLS, CONNECTED TO AS THE ROLE PRODUCTION USES (M20).
 *
 * The rest of the suite connects as the schema OWNER. That is the right choice
 * for testing what the services do — it is fast, it isolates by schema, and the
 * behaviour under test is the application's, not the database's.
 *
 * It is the wrong choice for testing whether the application can still do those
 * things once the policies are switched on, and the difference is not academic.
 * An owner role bypasses RLS and holds every column privilege, so a test suite
 * that only ever connects as one will pass with a green run while signup,
 * onboarding and password reset are all refused in production. That is exactly
 * what happened: 1,395 tests passed against three flows that could not complete
 * under `repos_app`.
 *
 * So this helper builds the other thing:
 *
 *   * a whole DATABASE rather than a schema, because `prisma/m20/rls.sql` is
 *     written against `public` and applying it verbatim is the only way to test
 *     the file that actually ships rather than a rewritten copy of it;
 *   * the real `repos_app` role, with `bypassrls = false`, holding exactly the
 *     grants that file gives it;
 *   * an owner handle alongside it, used only to seed fixtures and to read back
 *     what the application role did — never to perform the operation under test.
 *
 * Both connection strings are configuration. There is deliberately no default
 * and no derivation of one from the other: guessing a role name into a URL is
 * how a test suite ends up authenticating as something nobody intended.
 */

const ROOT = resolve(__dirname, '..', '..');

export const OWNER_DATABASE_URL_VAR = 'REPOS_TEST_DATABASE_URL';
export const APP_DATABASE_URL_VAR = 'REPOS_TEST_APP_DATABASE_URL';

function read(name: string): string | null {
  const value = (process.env[name] ?? '').trim();
  return value.length === 0 ? null : value;
}

/**
 * Whether this machine is set up to run the runtime-role tests at all.
 *
 * Asserted by a named test, NOT used to skip one. A skipped suite reads as a
 * pass in every summary line, which is exactly how three broken flows shipped
 * behind 1,395 green tests. When this is false the runtime-role file fails and
 * says which variable to set.
 */
export function hasRlsRuntimeDb(): boolean {
  return read(OWNER_DATABASE_URL_VAR) !== null && read(APP_DATABASE_URL_VAR) !== null;
}

/** The same guard the schema-based helper uses: local hosts only, ever. */
function localOnly(raw: string, varName: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${varName} is not a valid connection URL.`);
  }
  const local = ['localhost', '127.0.0.1', '::1'];
  if (!local.includes(parsed.hostname)) {
    throw new Error(
      `Refusing to run tests against a non-local database (${parsed.hostname}). ` +
        `Set ${varName} to a local PostgreSQL instance.`,
    );
  }
  return parsed;
}

/** One database per test file, named from the file's own label. */
function databaseFor(name: string): string {
  return `repos_rls_${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}

function pointAt(raw: string, database: string): string {
  const url = new URL(raw);
  url.pathname = `/${database}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

export type RlsTestDb = {
  /** Owns the tables and bypasses RLS. For fixtures and for reading back only. */
  owner: PrismaClient;
  /** What the application connects as. `bypassrls = false`, column grants only. */
  appUrl: string;
  dispose: () => Promise<void>;
};

/**
 * Creates the database, pushes the schema, and applies the shipped RLS file.
 *
 * `rls.sql` goes in verbatim and unedited. A test that rewrote it to fit a
 * scratch schema would be testing the rewrite; the whole value here is that the
 * bytes exercised are the bytes applied to production.
 */
export async function createRlsTestDb(name: string): Promise<RlsTestDb> {
  const ownerBase = read(OWNER_DATABASE_URL_VAR);
  const appBase = read(APP_DATABASE_URL_VAR);
  if (!ownerBase || !appBase) {
    throw new Error(
      `${OWNER_DATABASE_URL_VAR} and ${APP_DATABASE_URL_VAR} must both be set.\n` +
        'Point them at the SAME local cluster: the first at a role that owns the\n' +
        'schema, the second at the non-owner runtime role `repos_app`.',
    );
  }
  localOnly(ownerBase, OWNER_DATABASE_URL_VAR);
  localOnly(appBase, APP_DATABASE_URL_VAR);

  const database = databaseFor(name);
  const ownerUrl = pointAt(ownerBase, database);
  const appUrl = pointAt(appBase, database);

  // CREATE DATABASE cannot run inside a transaction, so it goes through a
  // throwaway connection to whichever database the base URL already names.
  const admin = new PrismaClient({ datasources: { db: { url: ownerBase } } });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.$disconnect();
  }

  const prismaCli = join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  const schemaPath = join(ROOT, 'prisma', 'schema.prisma');
  const rlsPath = join(ROOT, 'prisma', 'm20', 'rls.sql');
  // The connection string goes in the environment, never in the argument list:
  // Node builds a failed execFileSync's error message out of the arguments, so
  // a single connection error would print it into the test output.
  const env = { ...process.env, DATABASE_URL: ownerUrl, DIRECT_DATABASE_URL: ownerUrl };

  execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--schema', schemaPath], {
    cwd: ROOT,
    env,
    stdio: 'pipe',
  });
  execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--file', rlsPath, '--schema', schemaPath], {
    cwd: ROOT,
    env,
    stdio: 'pipe',
  });

  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });

  return {
    owner,
    appUrl,
    dispose: async () => {
      await owner.$disconnect();
    },
  };
}
