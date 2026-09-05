-- ===========================================================================
-- M20 — adversarial tenant isolation test.
--
-- Run as repos_app, the role the application actually connects with. Every
-- query below is one a compromised or buggy request could issue: the client id
-- is supplied directly, exactly as it would be if it had been read off a URL.
-- ===========================================================================
\set ON_ERROR_STOP 0
\pset pager off

-- ---------------------------------------------------------------------------
-- 0. THE FIXTURES MUST EXIST.
--
-- This suite proves tenant isolation by asking for other people's rows and
-- expecting zero. A run against the wrong fixtures returns those same zeros
-- and looks identical to a pass - which is exactly what happened when the ids
-- here drifted from the ids in the database. Zero is only evidence when the
-- row it is counting could have been found.
--
-- So the suite refuses to run at all unless its fixtures are present. The check
-- needs an identity to see them, because every table below is under RLS.
-- ---------------------------------------------------------------------------
BEGIN;
SELECT set_config('app.user_id', 'u_admin', true);
DO $fixtures$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = 'u_admin' AND "isPlatformAdmin")
     OR NOT EXISTS (SELECT 1 FROM public."User" WHERE id IN ('u_a','u_b','u_staff','u_susp'))
     OR NOT EXISTS (SELECT 1 FROM public."Client" WHERE id = 'c_a')
     OR NOT EXISTS (SELECT 1 FROM public."Client" WHERE id = 'c_b')
     OR NOT EXISTS (SELECT 1 FROM public."Membership" WHERE "userId" = 'u_a' AND "clientId" = 'c_a')
  THEN
    RAISE EXCEPTION
      'ADVERSARIAL SUITE ABORTED: fixtures missing (expected users u_a/u_b/u_admin/u_staff/u_susp and clients c_a/c_b). Every result below would be a zero that proves nothing.';
  END IF;
END $fixtures$;
ROLLBACK;
-- ---------------------------------------------------------------------------
\echo '### 1. NO IDENTITY SET — an unauthenticated connection'
BEGIN;
SELECT count(*) AS clients_visible FROM "Client";
SELECT count(*) AS feedback_visible FROM "ReviewItem";
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 2. AS OWNER OF TENANT A'
BEGIN;
SET LOCAL app.user_id = 'u_a';
SELECT "businessName" AS a_can_see FROM "Client" ORDER BY "businessName";
SELECT count(*) AS a_feedback_rows FROM "ReviewItem";
\echo '--- A asks for B by id, directly (the attack) ---'
SELECT count(*) AS a_reading_b_client FROM "Client" WHERE id = 'c_b';
SELECT count(*) AS a_reading_b_feedback FROM "ReviewItem" WHERE "clientId" = 'c_b';
SELECT count(*) AS a_reading_b_minutes FROM "Minute" WHERE "clientId" = 'c_b';
SELECT count(*) AS a_reading_b_gateway FROM "FeedbackGateway" WHERE "clientId" = 'c_b';
SELECT count(*) AS a_reading_b_snapshots FROM "Snapshot" WHERE "clientId" = 'c_b';
SELECT count(*) AS a_reading_b_actions FROM "ImprovementAction" WHERE "clientId" = 'c_b';
SELECT count(*) AS a_reading_b_context FROM "BusinessContext" WHERE "clientId" = 'c_b';
SELECT count(*) AS a_reading_b_members FROM "Membership" WHERE "clientId" = 'c_b';
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 3. TENANT A TRIES TO MUTATE TENANT B'
BEGIN;
SET LOCAL app.user_id = 'u_a';
\echo '--- update B feedback ---'
UPDATE "ReviewItem" SET text = 'tampered' WHERE "clientId" = 'c_b';
\echo '--- delete B feedback ---'
DELETE FROM "ReviewItem" WHERE "clientId" = 'c_b';
\echo '--- rename B ---'
UPDATE "Client" SET "businessName" = 'stolen' WHERE id = 'c_b';
-- Each write below is expected to be REFUSED, and a refusal aborts the
-- transaction it is in. Without a savepoint per attempt, the first refusal
-- would swallow every attack after it and the suite would quietly stop
-- testing them - reporting success because nothing ran.
\echo '--- insert a row INTO B (the WITH CHECK path) ---'
SAVEPOINT attack;
INSERT INTO "Minute" (id, "clientId", "occurredAt", category, title, body, "createdAt", "updatedAt")
VALUES ('m_evil', 'c_b', now(), 'NOTE', 'planted', 'planted', now(), now());
ROLLBACK TO SAVEPOINT attack;
\echo '--- grant themselves membership of B ---'
SAVEPOINT attack;
INSERT INTO "Membership" (id, "userId", "clientId", role, status, "createdAt", "updatedAt")
VALUES ('mem_evil', 'u_a', 'c_b', 'BUSINESS_OWNER', 'ACTIVE', now(), now());
ROLLBACK TO SAVEPOINT attack;
\echo '--- make themselves a platform admin ---'
SAVEPOINT attack;
UPDATE "User" SET "isPlatformAdmin" = true WHERE id = 'u_a';
ROLLBACK TO SAVEPOINT attack;
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 4. DID ANY OF THAT LAND? (checked as tenant B)'
BEGIN;
SET LOCAL app.user_id = 'u_b';
SELECT "businessName" AS b_sees FROM "Client";
SELECT count(*) AS b_feedback_rows FROM "ReviewItem";
SELECT count(*) AS planted_minutes FROM "Minute" WHERE id = 'm_evil';
SELECT count(*) AS tampered FROM "ReviewItem" WHERE text = 'tampered';
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 5. PLATFORM ADMIN SEES EVERYTHING'
BEGIN;
SET LOCAL app.user_id = 'u_admin';
SELECT count(*) AS admin_sees_clients FROM "Client";
SELECT count(*) AS admin_sees_feedback FROM "ReviewItem";
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 6. SUSPENDED MEMBERSHIP LOSES ACCESS'
BEGIN;
SET LOCAL app.user_id = 'u_susp';
SELECT count(*) AS suspended_sees_clients FROM "Client";
SELECT count(*) AS suspended_sees_feedback FROM "ReviewItem";
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 7. FORGED IDENTITY — a user id that does not exist'
BEGIN;
SET LOCAL app.user_id = 'no_such_user';
SELECT count(*) AS forged_sees_clients FROM "Client";
SELECT count(*) AS forged_sees_feedback FROM "ReviewItem";
COMMIT;

-- ---------------------------------------------------------------------------
-- 7. THE IDENTITY BRIDGE.
--
-- Everything above sets app.user_id to an internal User.id by hand. Production
-- cannot: Supabase Auth hands the application a UUID, and every policy here
-- compares against User.id, a cuid. The two are joined only by
-- User.authProviderId.
--
-- That gap is how the Stage 10B proof passed while the application would have
-- failed - the proof supplied the cuid the policies want, the application
-- supplied the UUID they ignore. Nothing errors when the wrong one arrives;
-- the policies simply match no row, so the failure is a blank application
-- rather than an exception, which is precisely why a test had to catch it.
--
-- The UUIDs below are written out rather than selected from "User", because
-- that is how a request gets one: handed to it by the auth server, never read
-- out of a table it cannot see. Reading "User" as repos_app needs an identity
-- that has not been resolved yet - the circularity app.user_id_for_auth exists
-- to break. (Try it: a bare SELECT on "User" here returns nothing.)
-- ---------------------------------------------------------------------------

-- Each fixture UUID resolves to its own internal id, and to something other
-- than itself. Expect u_a, u_b, u_admin, u_staff and t / t on every row.
SELECT
  app.user_id_for_auth(uuid) AS resolved_id,
  app.user_id_for_auth(uuid) = expected AS resolves_to_own_id,
  app.user_id_for_auth(uuid) IS DISTINCT FROM uuid AS uuid_is_not_the_identity
FROM (VALUES
  ('11111111-1111-4111-8111-111111111111', 'u_a'),
  ('22222222-2222-4222-8222-222222222222', 'u_b'),
  ('33333333-3333-4333-8333-333333333333', 'u_admin'),
  ('44444444-4444-4444-8444-444444444444', 'u_staff')
) AS f(uuid, expected);

-- A suspended account and an invented UUID both resolve to nothing, so neither
-- carries an identity. Expect two null rows.
SELECT app.user_id_for_auth('55555555-5555-4555-8555-555555555555') AS suspended_resolves;
SELECT app.user_id_for_auth('ffffffff-ffff-4fff-8fff-ffffffffffff') AS forged_resolves;

-- THE REGRESSION ITSELF. With the raw UUID in the GUC every policy goes blind;
-- with the resolved id the admin sees the installation.
-- Expect admin_via_uuid = f, clients_via_uuid = 0,
--        admin_via_resolved = t, clients_via_resolved > 0.
BEGIN;
SELECT set_config('app.user_id', '33333333-3333-4333-8333-333333333333', true);
SELECT app.is_platform_admin() AS admin_via_uuid,
       (SELECT count(*) FROM app.accessible_client_ids()) AS clients_via_uuid;
SELECT set_config('app.user_id', app.user_id_for_auth('33333333-3333-4333-8333-333333333333'), true);
SELECT app.is_platform_admin() AS admin_via_resolved,
       (SELECT count(*) FROM app.accessible_client_ids()) AS clients_via_resolved;
ROLLBACK;

-- The tenant boundary still holds when the identity arrives by resolution
-- rather than by hand. Expect a_sees = 1 and a_reading_b = 0.
BEGIN;
SELECT set_config('app.user_id', app.user_id_for_auth('11111111-1111-4111-8111-111111111111'), true);
SELECT count(*) AS a_sees FROM "Client";
SELECT count(*) AS a_reading_b FROM "Client" WHERE id = 'c_b';
ROLLBACK;

-- A suspended account resolves to nothing, and nothing sees nothing.
-- Expect suspended_sees = 0.
BEGIN;
SELECT set_config('app.user_id', coalesce(app.user_id_for_auth('55555555-5555-4555-8555-555555555555'), ''), true);
SELECT count(*) AS suspended_sees FROM "Client";
ROLLBACK;
