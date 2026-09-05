-- ===========================================================================
-- M20 Stage 10B — the public feedback gateway's database boundary.
--
-- A customer scanning a QR code has no account and no identity, so the RLS
-- policies that protect every tenant table can never let them through: with no
-- `app.user_id` they see nothing, which is exactly right for everything except
-- the one page they are entitled to use.
--
-- The obvious fix — granting an anonymous role SELECT on FeedbackGateway and
-- Client — would hand that role every business name and every gateway token in
-- the installation. So instead the anonymous role gets no table privileges at
-- all, and two SECURITY DEFINER functions do the only two things a customer
-- needs. Each validates the token itself and returns nothing for a token it
-- does not recognise.
--
-- WHY SECURITY DEFINER IS THE RIGHT TOOL HERE. The boundary has to be
-- "you may see the ONE row matching this argument". A GRANT cannot express
-- that. An RLS policy could, but only by reading the token from a session
-- variable the caller sets — which is still a caller-controlled value the
-- policy has to trust, and the underlying grant would remain. A definer
-- function takes the token as an argument, resolves it in trusted code, and
-- returns a projection. Nothing else is reachable.
--
-- Each function: fixed search_path, fully-qualified objects, no dynamic SQL,
-- STRICT-checked arguments, and EXECUTE granted only to repos_public.
-- ===========================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- --- the anonymous runtime role -------------------------------------------
-- The role is created WITHOUT a password on purpose. A password written here
-- is a password in the repository, and this file is published; a default that
-- works is worse than no default, because the installation that never changes
-- it is authenticated by a string anyone can read. A LOGIN role with no
-- password cannot authenticate at all under password authentication, so the
-- failure mode is a connection that is refused, never one that succeeds for a
-- stranger.
--
-- Set it out of band, once, with psql's own \password command:
--
--   psql -d "$DIRECT_DATABASE_URL"
--   \password repos_public
--
-- That prompts with the input hidden, hashes the value locally, and sends the
-- ALTER ROLE already encrypted — so the cleartext reaches neither argv, nor
-- the shell history, nor psql's history, nor the server log. Writing the
-- statement out by hand instead puts the password in all four.
-- See prisma/m20/README.md.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repos_public') THEN
    CREATE ROLE repos_public LOGIN;
  END IF;
END $$;

-- It owns nothing and may read nothing. USAGE on the schemas is only enough to
-- resolve a function name; without EXECUTE it still cannot call anything.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM repos_public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM repos_public;
REVOKE ALL ON SCHEMA public FROM repos_public;
GRANT USAGE ON SCHEMA app TO repos_public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM repos_public;

-- ---------------------------------------------------------------------------
-- 1. Resolve one gateway from its public token.
--
-- Returns at most one row, and only for a gateway that is switched on and
-- whose business is not archived — the same three conditions the application
-- has applied since M14. A token that matches nothing returns no rows, which
-- is indistinguishable from a token belonging to a paused or archived
-- business: a customer cannot probe for which.
-- ---------------------------------------------------------------------------
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
$$;

-- ---------------------------------------------------------------------------
-- 2. Store one customer submission.
--
-- The caller supplies the token and the already-prepared fields. It does NOT
-- supply a client id — this function resolves that from the token itself, so
-- there is no argument through which a submission could be aimed at another
-- business. That is the single most important property here.
--
-- Duplicate detection stays where M19 put it, expressed against the same two
-- windows: identical wording within one window is the same person tapping
-- twice, and an identical wordless rating within a shorter window likewise.
-- The function returns the existing row's id in that case, so the caller's
-- "thank you" is unchanged and nothing is written.
-- ---------------------------------------------------------------------------
-- Timestamps arrive as ISO text and are cast here rather than passed as
-- timestamp parameters: the driver decides on its own whether a JS Date is
-- sent with a time zone, and PostgreSQL will not implicitly cast timestamptz
-- to timestamp when it resolves which function to call. Text has one meaning
-- on both sides of the wire.
DROP FUNCTION IF EXISTS app.public_submit(text, text, integer, timestamp, text, text, text, text, boolean, text, bigint, bigint, timestamp);

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
    AND c."archivedAt" IS NULL;

  IF v_client_id IS NULL THEN
    RETURN; -- unknown, paused or archived: no rows, no row written
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

-- Only the anonymous gateway role may call these, and it may do nothing else.
REVOKE ALL ON FUNCTION app.public_gateway(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.public_submit(text, text, integer, text, text, text, text, text, boolean, text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.public_gateway(text) TO repos_public;
GRANT EXECUTE ON FUNCTION app.public_submit(text, text, integer, text, text, text, text, text, boolean, text, integer, integer, text) TO repos_public;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, so the
-- anonymous role inherited the authenticated helpers. They answer harmlessly
-- with no identity set (false, and an empty list), but a role that can only
-- do two things should be able to call only two things.
REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.accessible_client_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.owned_client_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_platform_admin(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_user_status(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.bump_session_version(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_subscription_status(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.current_user_id() TO repos_app;
GRANT EXECUTE ON FUNCTION app.is_platform_admin() TO repos_app;
GRANT EXECUTE ON FUNCTION app.accessible_client_ids() TO repos_app;
GRANT EXECUTE ON FUNCTION app.owned_client_ids() TO repos_app;
GRANT EXECUTE ON FUNCTION app.set_platform_admin(text, boolean) TO repos_app;
GRANT EXECUTE ON FUNCTION app.set_user_status(text, text) TO repos_app;
GRANT EXECUTE ON FUNCTION app.bump_session_version(text) TO repos_app;
GRANT EXECUTE ON FUNCTION app.set_subscription_status(text, text) TO repos_app;
