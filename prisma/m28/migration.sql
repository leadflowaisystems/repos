-- M28 — the service lifecycle: expiry, the QR grace, and asking to carry on.
--
-- ADDITIVE ONLY. Three nullable columns on an existing table, one new table,
-- one new function, and two existing functions replaced in place. Nothing is
-- dropped, no column changes type, no row is rewritten, and no trial date and
-- no QR token is touched anywhere in this file. Running it twice is the same
-- as running it once.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot alter a
-- table or replace a function and should not be able to.
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m28/migration.sql
--
-- (`prisma db execute` reads .env, which on a developer machine points at the
-- LOCAL cluster, so it is the wrong tool for reaching production. `-d` is not
-- optional: given a bare positional URI this psql ignores the `-c` after it.)
--
-- REQUIRES an already-built database — one that has had `prisma/m20/rls.sql`
-- and `prisma/m20/public-gateway.sql` applied, so the roles `repos_app` and
-- `repos_public` exist and `app.accessible_client_ids()` is defined.
--
-- ORDER MATTERS. SQL FIRST, then deploy the code:
--
--   1. this file
--   2. deploy
--
-- SQL first is safe: the new columns sit unread by the old build, and the two
-- replaced functions behave identically for every business whose trial has not
-- ended (which is all six of them today). Code first is not: the deployed
-- Prisma client would select `serviceLockedAt` from a table that does not have
-- it, and every workspace page and the operator's client list would 500.
--
--
-- WHAT THE THREE COLUMNS ARE FOR
--
--   Client.serviceLockedAt   platform staff closed this workspace by hand
--   Client.accessOverrideAt  platform staff opened it by hand
--   Client.serviceExemption  'DEMO' — a business that never runs out
--
-- None is added to the `repos_app` UPDATE grant, so a business owner's
-- connection cannot write any of them: the grant on public."Client" is an
-- explicit column list (see prisma/m20/rls.sql) and these are simply not in it.
-- They move only through app.set_service_access below, which asks the database
-- whether the caller is platform staff rather than taking anyone's word.
--
-- serviceExemption is a COLUMN rather than a match on "Corner Cafe" because
-- `businessName` IS in that grant — an owner can rename their own business, and
-- an exemption anybody can award themselves by typing a name is not one.

ALTER TABLE public."Client" ADD COLUMN IF NOT EXISTS "serviceLockedAt"  TIMESTAMP(3);
ALTER TABLE public."Client" ADD COLUMN IF NOT EXISTS "accessOverrideAt" TIMESTAMP(3);
ALTER TABLE public."Client" ADD COLUMN IF NOT EXISTS "serviceExemption" TEXT;


-- ---------------------------------------------------------------------------
-- A business asking to carry on
-- ---------------------------------------------------------------------------
--
-- A message, not a transaction. It does not extend the trial, does not move
-- trialEndsAt, does not open the workspace and does not take a payment.
--
-- The owner may create and read their own; a platform admin sees all of them.
-- That is exactly `app.accessible_client_ids()`, the same predicate all
-- thirteen other tenant tables use, so this table is isolated by the same
-- mechanism as everything else rather than by a rule of its own.

CREATE TABLE IF NOT EXISTS public."ServiceContinuationRequest" (
  id          TEXT         PRIMARY KEY,
  "clientId"  TEXT         NOT NULL
                REFERENCES public."Client"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name        TEXT         NOT NULL,
  phone       TEXT         NOT NULL,
  email       TEXT,
  status      TEXT         NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ServiceContinuationRequest_clientId_createdAt_idx"
  ON public."ServiceContinuationRequest" ("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "ServiceContinuationRequest_status_idx"
  ON public."ServiceContinuationRequest" (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."ServiceContinuationRequest" TO repos_app;

ALTER TABLE public."ServiceContinuationRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ServiceContinuationRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public."ServiceContinuationRequest";
CREATE POLICY tenant_isolation ON public."ServiceContinuationRequest"
  USING ("clientId" IN (SELECT app.accessible_client_ids()))
  WITH CHECK ("clientId" IN (SELECT app.accessible_client_ids()));


-- ---------------------------------------------------------------------------
-- Is this business's QR still live?
-- ---------------------------------------------------------------------------
--
-- ONE definition, called from both public paths, because the two paths existed
-- as a matched pair long before this and the whole value of that is that they
-- answer identically. A customer who can load the page must be able to submit
-- from it, and a customer who cannot load it must not be able to submit either.
--
-- THE GRACE IS THREE CALENDAR DAYS IN IST, counting the day of expiry as the
-- first. A trial ending on 1 October leaves the QR live on the 1st, the 2nd and
-- the 3rd, and dark from midnight starting the 4th. Calendar days rather than
-- 72 hours, because a customer standing at a table should not meet a dead page
-- halfway through a Tuesday afternoon.
--
-- Timestamps in this database are UTC-naive (Prisma writes ISO UTC into
-- `timestamp` columns), so IST midnight is found by adding 5h30, truncating to
-- the day, and taking it back off. India has no daylight saving, so the fixed
-- offset is exact rather than an approximation. This mirrors, statement for
-- statement, `qrGraceEnd` in src/lib/lifecycle/service.ts.
--
-- SECURITY DEFINER because `repos_public` cannot read public."Client" at all,
-- which is deliberate and stays that way: this returns a boolean, never a
-- subscription status, so nothing about the commercial relationship reaches a
-- customer's browser.

CREATE OR REPLACE FUNCTION app.service_qr_live(p_client_id text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $fn$
DECLARE
  c        public."Client"%ROWTYPE;
  v_now    timestamp := (now() AT TIME ZONE 'UTC');
  v_grace  timestamp;
BEGIN
  SELECT * INTO c FROM public."Client" WHERE id = p_client_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- The demonstration business never runs out.
  IF c."serviceExemption" = 'DEMO' THEN
    RETURN true;
  END IF;

  -- Not on a trial clock at all: paying, paused or closed. A paused account
  -- keeps collecting on purpose — the customer at the table is not party to a
  -- billing conversation — and that rule is older than this file.
  IF coalesce(c."subscriptionStatus", 'TRIAL') <> 'TRIAL' THEN
    RETURN true;
  END IF;

  -- A trial with no agreed end cannot run out.
  IF c."trialEndsAt" IS NULL THEN
    RETURN true;
  END IF;

  -- Still inside the trial.
  IF v_now < c."trialEndsAt" THEN
    RETURN true;
  END IF;

  -- Expired: live until IST midnight starting the third day after the day of
  -- expiry. An admin override reopens the workspace but does not extend this;
  -- restoring service is what puts the QR back, and it does so on the same
  -- token because nothing here touches "publicToken".
  IF c."accessOverrideAt" IS NOT NULL THEN
    RETURN true;
  END IF;

  v_grace := date_trunc('day', c."trialEndsAt" + interval '5 hours 30 minutes')
             + interval '3 days'
             - interval '5 hours 30 minutes';
  RETURN v_now < v_grace;
END $fn$;

REVOKE ALL     ON FUNCTION app.service_qr_live(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION app.service_qr_live(text) TO repos_app;
GRANT  EXECUTE ON FUNCTION app.service_qr_live(text) TO repos_public;


-- ---------------------------------------------------------------------------
-- The two public paths, now asking that question
-- ---------------------------------------------------------------------------
--
-- Both keep their signature, their return type and every other condition. The
-- only change is one more AND. A token whose grace has run out returns no rows,
-- which is indistinguishable from a token that never existed — a customer still
-- cannot probe for which businesses are real or what state they are in.

CREATE OR REPLACE FUNCTION app.public_gateway(p_token text)
  RETURNS TABLE (
    client_id         text,
    business_name     text,
    vertical          text,
    public_review_url text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
  SELECT c.id, c."businessName", c.vertical, g."publicReviewUrl"
  FROM public."FeedbackGateway" g
  JOIN public."Client" c ON c.id = g."clientId"
  WHERE g."publicToken" = p_token
    AND g.enabled
    AND c."archivedAt" IS NULL
    AND app.service_qr_live(c.id)
$$;

REVOKE ALL     ON FUNCTION app.public_gateway(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION app.public_gateway(text) TO repos_public;


-- app.public_submit keeps its entire body byte for byte; only the resolving
-- SELECT gains the same condition. This text is generated from
-- prisma/m20/public-gateway.sql rather than retyped, and a test asserts the two
-- still match -- duplicate detection and the insert column list are far too easy
-- to get subtly wrong by hand.
CREATE OR REPLACE FUNCTION app.public_submit(
  p_token             text,
  p_text              text,
  p_stars             integer,
  p_review_date       text,
  p_source            text,
  p_fingerprint       text,
  p_dimensions_json   text,
  p_signals_json      text,
  p_redacted          boolean,
  p_redactions_json   text,
  p_text_window_ms    integer,
  p_rating_window_ms  integer,
  p_now               text
)
  RETURNS TABLE (item_id text, was_duplicate boolean)
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  v_client_id text;
  v_existing  text;
  v_next      integer;
  v_id        text;
  v_now       timestamp := p_now::timestamp;
  v_reviewed  timestamp := nullif(p_review_date, '')::timestamp;
BEGIN
  -- The token is the only thing that decides which business this belongs to.
  SELECT c.id INTO v_client_id
  FROM public."FeedbackGateway" g
  JOIN public."Client" c ON c.id = g."clientId"
  WHERE g."publicToken" = p_token
    AND g.enabled
    AND c."archivedAt" IS NULL
    AND app.service_qr_live(c.id);

  IF v_client_id IS NULL THEN
    RETURN; -- unknown, paused, archived or past its grace: no rows, none written
  END IF;

  IF p_fingerprint <> '' THEN
    SELECT r.id INTO v_existing
    FROM public."ReviewItem" r
    WHERE r."clientId" = v_client_id
      AND r.fingerprint = p_fingerprint
      AND r.source = p_source
      AND r."createdAt" >= v_now - make_interval(secs => p_text_window_ms / 1000.0)
    ORDER BY r."createdAt" DESC
    LIMIT 1;
  ELSE
    SELECT r.id INTO v_existing
    FROM public."ReviewItem" r
    WHERE r."clientId" = v_client_id
      AND r.fingerprint = ''
      AND r.stars IS NOT DISTINCT FROM p_stars
      AND r."dimensionsJson" = p_dimensions_json
      AND r.source = p_source
      AND r."createdAt" >= v_now - make_interval(secs => p_rating_window_ms / 1000.0)
    ORDER BY r."createdAt" DESC
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, true;
    RETURN;
  END IF;

  SELECT coalesce(max(r."sortIndex"), -1) + 1 INTO v_next
  FROM public."ReviewItem" r WHERE r."clientId" = v_client_id;

  v_id := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public."ReviewItem" (
    id, "clientId", text, stars, "reviewDate", source, fingerprint,
    "dimensionsJson", "signalsJson", redacted, "redactionsJson",
    "sortIndex", "createdAt", "updatedAt"
  ) VALUES (
    v_id, v_client_id, p_text, p_stars, v_reviewed, p_source, p_fingerprint,
    p_dimensions_json, p_signals_json, p_redacted, p_redactions_json,
    v_next, v_now, v_now
  );

  RETURN QUERY SELECT v_id, false;
END $$;

REVOKE ALL     ON FUNCTION app.public_submit(text, text, integer, text, text, text, text, text, boolean, text, integer, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION app.public_submit(text, text, integer, text, text, text, text, text, boolean, text, integer, integer, text) TO repos_public;


-- ---------------------------------------------------------------------------
-- Does this token belong to a real, switched-on feedback page?
-- ---------------------------------------------------------------------------
--
-- A BOOLEAN, and deliberately nothing else. It exists so a customer holding a
-- real printed card whose business has lapsed is told "feedback is temporarily
-- unavailable" rather than "this page isn't here" — a 404 makes the BUSINESS
-- look broken to its own customer, which is the one impression Headway must
-- never create on a table tent.
--
-- It reports only that the token is real and the gateway switched on. It says
-- nothing about the trial, the subscription, the dates or the grace, and it
-- cannot be used to enumerate anything: an unknown token answers false, exactly
-- as a dark one that never existed would.
CREATE OR REPLACE FUNCTION app.public_gateway_exists(p_token text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."FeedbackGateway" g
    JOIN public."Client" c ON c.id = g."clientId"
    WHERE g."publicToken" = p_token
      AND g.enabled
      AND c."archivedAt" IS NULL
  )
$$;

REVOKE ALL     ON FUNCTION app.public_gateway_exists(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION app.public_gateway_exists(text) TO repos_public;
GRANT  EXECUTE ON FUNCTION app.public_gateway_exists(text) TO repos_app;


-- ---------------------------------------------------------------------------
-- The platform's hand on the door
-- ---------------------------------------------------------------------------
--
-- Locking, unlocking, overriding and marking a demonstration business, in one
-- place that asks the database whether the caller is platform staff. A business
-- owner's connection holds no UPDATE privilege on any of these columns, so this
-- function is the only way through and a bug in a server action cannot become a
-- business unlocking itself.
--
-- IT NEVER WRITES trialStartsAt OR trialEndsAt. A lock is not a shortened trial
-- and an override is not an extended one: the stored dates are what the owner
-- was told and what every other screen reads, and they survive all four actions
-- untouched. That is the whole reason these are separate columns rather than a
-- date the admin nudges.
--
-- LOCK AND OVERRIDE ARE MUTUALLY EXCLUSIVE by construction — setting either
-- clears the other — so no later reader has to decide which of two conflicting
-- flags wins.
--
--   p_action = 'LOCK'            close it by hand
--              'UNLOCK'          reopen it: clears the lock, leaves dates alone
--              'OVERRIDE'        open it by hand despite the dates
--              'CLEAR_OVERRIDE'  remove that
--              'EXEMPT_DEMO'     mark the demonstration business
--              'CLEAR_EXEMPTION' unmark it

CREATE OR REPLACE FUNCTION app.set_service_access(
  p_client_id text,
  p_action    text,
  p_now       text
)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_now timestamp := p_now::timestamp;
BEGIN
  IF NOT app.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public."Client" WHERE id = p_client_id) THEN
    RETURN false;
  END IF;

  IF p_action = 'LOCK' THEN
    UPDATE public."Client"
       SET "serviceLockedAt" = v_now, "accessOverrideAt" = NULL, "updatedAt" = v_now
     WHERE id = p_client_id;
  ELSIF p_action = 'UNLOCK' THEN
    UPDATE public."Client"
       SET "serviceLockedAt" = NULL, "updatedAt" = v_now
     WHERE id = p_client_id;
  ELSIF p_action = 'OVERRIDE' THEN
    UPDATE public."Client"
       SET "accessOverrideAt" = v_now, "serviceLockedAt" = NULL, "updatedAt" = v_now
     WHERE id = p_client_id;
  ELSIF p_action = 'CLEAR_OVERRIDE' THEN
    UPDATE public."Client"
       SET "accessOverrideAt" = NULL, "updatedAt" = v_now
     WHERE id = p_client_id;
  ELSIF p_action = 'EXEMPT_DEMO' THEN
    UPDATE public."Client"
       SET "serviceExemption" = 'DEMO', "updatedAt" = v_now
     WHERE id = p_client_id;
  ELSIF p_action = 'CLEAR_EXEMPTION' THEN
    UPDATE public."Client"
       SET "serviceExemption" = NULL, "updatedAt" = v_now
     WHERE id = p_client_id;
  ELSE
    RAISE EXCEPTION 'unknown action';
  END IF;

  RETURN true;
END $fn$;

REVOKE ALL     ON FUNCTION app.set_service_access(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION app.set_service_access(text, text, text) TO repos_app;
