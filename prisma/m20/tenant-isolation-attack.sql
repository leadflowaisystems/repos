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
\echo '### 1. NO IDENTITY SET — an unauthenticated connection'
BEGIN;
SELECT count(*) AS clients_visible FROM "Client";
SELECT count(*) AS feedback_visible FROM "ReviewItem";
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 2. AS OWNER OF TENANT A'
BEGIN;
SET LOCAL app.user_id = 'user_a';
SELECT "businessName" AS a_can_see FROM "Client" ORDER BY "businessName";
SELECT count(*) AS a_feedback_rows FROM "ReviewItem";
\echo '--- A asks for B by id, directly (the attack) ---'
SELECT count(*) AS a_reading_b_client FROM "Client" WHERE id = 'client_b';
SELECT count(*) AS a_reading_b_feedback FROM "ReviewItem" WHERE "clientId" = 'client_b';
SELECT count(*) AS a_reading_b_minutes FROM "Minute" WHERE "clientId" = 'client_b';
SELECT count(*) AS a_reading_b_gateway FROM "FeedbackGateway" WHERE "clientId" = 'client_b';
SELECT count(*) AS a_reading_b_snapshots FROM "Snapshot" WHERE "clientId" = 'client_b';
SELECT count(*) AS a_reading_b_actions FROM "ImprovementAction" WHERE "clientId" = 'client_b';
SELECT count(*) AS a_reading_b_context FROM "BusinessContext" WHERE "clientId" = 'client_b';
SELECT count(*) AS a_reading_b_members FROM "Membership" WHERE "clientId" = 'client_b';
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 3. TENANT A TRIES TO MUTATE TENANT B'
BEGIN;
SET LOCAL app.user_id = 'user_a';
\echo '--- update B feedback ---'
UPDATE "ReviewItem" SET text = 'tampered' WHERE "clientId" = 'client_b';
\echo '--- delete B feedback ---'
DELETE FROM "ReviewItem" WHERE "clientId" = 'client_b';
\echo '--- rename B ---'
UPDATE "Client" SET "businessName" = 'stolen' WHERE id = 'client_b';
\echo '--- insert a row INTO B (the WITH CHECK path) ---'
INSERT INTO "Minute" (id, "clientId", "occurredAt", kind, title, body, "createdAt", "updatedAt")
VALUES ('m_evil', 'client_b', now(), 'NOTE', 'planted', 'planted', now(), now());
\echo '--- grant themselves membership of B ---'
INSERT INTO "Membership" (id, "userId", "clientId", role, status, "createdAt", "updatedAt")
VALUES ('mem_evil', 'user_a', 'client_b', 'BUSINESS_OWNER', 'ACTIVE', now(), now());
\echo '--- make themselves a platform admin ---'
UPDATE "User" SET "isPlatformAdmin" = true WHERE id = 'user_a';
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 4. DID ANY OF THAT LAND? (checked as tenant B)'
BEGIN;
SET LOCAL app.user_id = 'user_b';
SELECT "businessName" AS b_sees FROM "Client";
SELECT count(*) AS b_feedback_rows FROM "ReviewItem";
SELECT count(*) AS planted_minutes FROM "Minute" WHERE id = 'm_evil';
SELECT count(*) AS tampered FROM "ReviewItem" WHERE text = 'tampered';
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 5. PLATFORM ADMIN SEES EVERYTHING'
BEGIN;
SET LOCAL app.user_id = 'user_admin';
SELECT count(*) AS admin_sees_clients FROM "Client";
SELECT count(*) AS admin_sees_feedback FROM "ReviewItem";
COMMIT;

-- ---------------------------------------------------------------------------
\echo ''
\echo '### 6. SUSPENDED MEMBERSHIP LOSES ACCESS'
BEGIN;
SET LOCAL app.user_id = 'user_suspended';
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
