import { describe, expect, it } from 'vitest';
import {
  APP_DATABASE_URL_VAR,
  hasRlsRuntimeDb,
  OWNER_DATABASE_URL_VAR,
} from './helpers/rls-db';

/**
 * THE RUNTIME-ROLE SUITE IS NOT OPTIONAL (M20).
 *
 * `tests/m20.runtime-role.test.ts` is the only file that connects as the
 * non-owner role production actually uses. Every other file connects as the
 * schema owner, which bypasses RLS and holds every column privilege — which is
 * why 1,395 green tests once coexisted with a signup, an onboarding and a
 * password reset that could not complete in production.
 *
 * That file used to switch itself off when its connection string was absent,
 * and a skipped suite reads as a pass in every summary line. Now it runs
 * unconditionally, so a missing DSN fails it — but it fails inside `beforeAll`,
 * which vitest reports as "skipped" even while the run exits non-zero. Skipped
 * is precisely the word that let this hide the first time.
 *
 * So the prerequisite is asserted HERE, in a file with no hooks and no database,
 * where a missing variable is what it should be: one named, red, failing test
 * that says what to set.
 */
describe('the runtime-role tests must be able to run', () => {
  it(`has ${OWNER_DATABASE_URL_VAR} and ${APP_DATABASE_URL_VAR} pointed at a local cluster`, () => {
    expect(
      hasRlsRuntimeDb(),
      `\n\n  ${APP_DATABASE_URL_VAR} (and ${OWNER_DATABASE_URL_VAR}) must be set to a LOCAL\n` +
        '  cluster carrying the non-owner `repos_app` role.\n\n' +
        '  These are the only tests that exercise RepOS as the role production connects\n' +
        '  as. Skipping them is how signup, onboarding and password reset shipped broken\n' +
        '  behind a green suite.\n\n' +
        '  Put both in .env.repos-test (git-ignored, read only for REPOS_TEST_* keys),\n' +
        '  or export them:\n\n' +
        `    ${OWNER_DATABASE_URL_VAR}="postgresql://<owner>@127.0.0.1:<port>/<database>"\n` +
        `    ${APP_DATABASE_URL_VAR}="postgresql://repos_app@127.0.0.1:<port>/<database>"\n`,
    ).toBe(true);
  });
});
