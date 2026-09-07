-- M27 — the default length of a NEW trial moves from 14 days to 30.
--
-- NO SCHEMA CHANGE. No table is created, altered or dropped; no column, index,
-- constraint or policy is touched, and no row is written. This file replaces
-- the body of exactly one function, `app.trial_default_days()`, and then
-- restates that function's two existing privilege lines so the file is correct
-- on a database that does not have it yet. Running it twice is the same as
-- running it once.
--
-- REQUIRES an already-built database — one that has had `prisma/m20/rls.sql`
-- applied, so the role `repos_app` exists. The GRANT at the bottom names that
-- role, so on a database that has never seen `rls.sql` this file aborts (under
-- `-1`, without leaving anything behind). Build such a database with `rls.sql`,
-- which is the single source of truth; this file exists only so an EXISTING
-- database can be moved forward without replaying all 870 lines of it.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot replace a
-- function and should not be able to.
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m27/migration.sql
--
-- (`prisma db execute` reads .env, which on a developer machine points at the
-- LOCAL cluster, so it is the wrong tool for reaching production. `-d` is not
-- optional: given a bare positional URI this psql ignores the `-c` after it.)
--
--
-- ORDER MATTERS, and the two orderings are NOT symmetric.
--
--   1. this file
--   2. deploy the M27 code
--
-- SQL FIRST is safe. `app.create_client` starts giving 30 immediately, and the
-- only cost is that the Settings badge, rendered by the old build, reads 14
-- until the deploy lands. A wrong number on a screen for a few minutes.
--
-- CODE FIRST IS NOT SAFE, and the damage is permanent. In that window Settings
-- says 30 while `app.create_client` still returns 14, so a business that signs
-- up gets `trialEndsAt = now + 14 days` written into its row — and by the whole
-- design of this pass, nothing ever recomputes that. Applying this file
-- afterwards does not and must not go back and fix it. There is no error and
-- no log line: the signup succeeds and simply records the old number. The only
-- remedy is the operator noticing and pressing "Start a trial" on that client.
--
-- IF THE CODE HAS ALREADY SHIPPED, there is a faster fix than this file and it
-- needs no psql at all: open Settings, put 30 in "Trial length, in days" and
-- press Save. That writes the `trial.default_days` row, and the function below
-- reads that row BEFORE it reaches its fallback — so even the old 14-returning
-- function then answers 30. This file is still worth applying afterwards, to
-- correct the fallback for the day somebody deletes that row.
--
-- WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT
--
-- WHAT CHANGES is one number: the value this function returns when the operator
-- has NOT set `trial.default_days` in AppSetting. It was 14 and is now 30. When
-- the operator HAS set a value, that value still wins and this file is a no-op
-- for them — the fallback is the product's opinion, not an override.
--
-- WHAT DOES NOT CHANGE is every business that already exists. This function is
-- called from exactly one place, `app.create_client`, at the moment a business
-- is created, and what it produces is written once into `Client.trialEndsAt`.
-- Nothing recomputes that column afterwards: the owner's Account page, the days
-- remaining, the operator's client list and every decision about an account
-- read the stored date off the row. So there is no UPDATE in this file because
-- there is nothing an UPDATE would be for. A business on a 14-day trial that
-- ends on 21 September still ends on 21 September, before and after this runs.
--
-- The one thing to be careful of is the OTHER direction: `prisma/m23/backfill.sql`
-- does multiply this function's result into existing rows. It is guarded by
-- `trialEndsAt IS NULL`, and no such row exists in production, so it would
-- change nothing — but it is not part of this pass and MUST NOT be re-run.
--
-- This definition is identical to the one in `prisma/m20/rls.sql`, which stays
-- the single source of truth for a database built from scratch. This file
-- exists so an already-built database can be moved forward without replaying
-- the whole of `rls.sql`, and the two must be kept saying the same thing.

CREATE OR REPLACE FUNCTION app.trial_default_days()
  RETURNS integer
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_raw  text;
  v_days integer;
BEGIN
  SELECT s.value INTO v_raw FROM public."AppSetting" s WHERE s.key = 'trial.default_days';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[0-9]{1,3}$' THEN
    RETURN 30;
  END IF;
  v_days := btrim(v_raw)::integer;
  IF v_days < 1 OR v_days > 365 THEN
    RETURN 30;
  END IF;
  RETURN v_days;
END $fn$;

-- CREATE OR REPLACE keeps the existing privileges on a function that already
-- exists, so against production these two lines are no-ops: `rls.sql` already
-- establishes exactly this ACL. They are here for the case where the function
-- is being created rather than replaced. Neither widens anything — PUBLIC is
-- revoked first, and `repos_app` is the role the application already connects
-- as — but they ARE privilege statements, so they are called out rather than
-- hidden behind "nothing is touched".
--
-- This is also the one line in the file that can fail: it names `repos_app`,
-- and `rls.sql` is what creates that role. See the note at the top.
REVOKE ALL     ON FUNCTION app.trial_default_days() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION app.trial_default_days() TO repos_app;
