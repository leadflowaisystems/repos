-- ===========================================================================
-- M20 - Row Level Security, as verified against PostgreSQL 16.
--
-- Generated from the live policy state of the isolated dev database after
-- the adversarial test suite passed. Server-side authorization remains the
-- primary gate; this is the backstop that holds when a query is built with
-- a client id that came from a URL rather than from a membership.
--
-- Apply order: schema push, then this file.
-- ===========================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- --- who the current request is ------------------------------------------
-- Set per transaction by the application: SET LOCAL app.user_id = '<cuid>'.
-- `true` as the second argument makes a missing setting return NULL rather
-- than erroring, so an unset connection sees nothing instead of everything.

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app.is_platform_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
      SELECT 1 FROM public."User" u
      WHERE u.id = app.current_user_id()
        AND u."isPlatformAdmin"
        AND u.status = 'ACTIVE'
    )
$$;

-- --- the one bridge between Supabase's identity and RepOS's own -----------
--
-- Supabase Auth knows a person by a UUID. RepOS knows them by `User.id`, a
-- cuid, and every policy in this file compares against THAT -- `id =
-- app.current_user_id()`, `m."userId" = app.current_user_id()`. Both
-- identifiers live on the same row, since `User.authProviderId` holds the
-- UUID, so the mapping is a single lookup.
--
-- It has to be a definer function because the policies create an ordering
-- problem for themselves. Resolving the UUID means reading `User`, and reading
-- `User` is gated by `user_self_or_admin`, which needs the identity that has
-- not been resolved yet: a request would have to already know who it is in
-- order to find out who it is. This steps outside that circle exactly once,
-- for exactly one row.
--
-- What it can be talked into: nothing beyond confirming a UUID the caller has
-- already authenticated with. An invented UUID returns no row, so it
-- enumerates nothing, and what it returns is an opaque id belonging to the
-- account that asked. A suspended account resolves to nothing, matching
-- loadActor -- such a request then carries no identity at all and sees
-- nothing, which is the correct reading of a suspension.
CREATE OR REPLACE FUNCTION app.user_id_for_auth(p_auth_id text)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
  SELECT u.id
  FROM public."User" u
  WHERE u."authProviderId" = p_auth_id
    AND u.status = 'ACTIVE'
$$;

REVOKE ALL ON FUNCTION app.user_id_for_auth(text) FROM PUBLIC;

-- The businesses this request may touch. A platform admin may touch all of
-- them; everyone else only those they hold an ACTIVE membership for.
CREATE OR REPLACE FUNCTION app.accessible_client_ids() RETURNS SETOF text
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT c.id FROM public."Client" c WHERE app.is_platform_admin()
    UNION
    SELECT m."clientId" FROM public."Membership" m
    WHERE m."userId" = app.current_user_id() AND m.status = 'ACTIVE'
$$;

-- --- the application role --------------------------------------------------
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
--   \password repos_app
--
-- That prompts with the input hidden, hashes the value locally, and sends the
-- ALTER ROLE already encrypted — so the cleartext reaches neither argv, nor
-- the shell history, nor psql's history, nor the server log. Writing the
-- statement out by hand instead puts the password in all four.
-- See prisma/m20/README.md.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repos_app') THEN
    CREATE ROLE repos_app LOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app TO repos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO repos_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO repos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO repos_app;

-- --- policies --------------------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'BusinessContext','BusinessPolicy','Competitor','FeedbackGateway',
    'ImprovementAction','Invitation','KitConfig','Membership','Minute',
    'ReviewItem','Snapshot','TimeEntry','VoiceProfile'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON public.%I
        USING ("clientId" IN (SELECT app.accessible_client_ids()))
        WITH CHECK ("clientId" IN (SELECT app.accessible_client_ids()))
    $f$, t);
  END LOOP;
END $$;

-- The tenant itself: keyed on its own id rather than a clientId column.
ALTER TABLE public."Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Client" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public."Client";
CREATE POLICY tenant_isolation ON public."Client"
  USING (id IN (SELECT app.accessible_client_ids()))
  WITH CHECK (id IN (SELECT app.accessible_client_ids()));

-- Identity: a person sees themselves; an admin sees everyone. Nobody sees a
-- user in another tenant just because they share a database.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_self_or_admin ON public."User";
CREATE POLICY user_self_or_admin ON public."User"
  USING (id = app.current_user_id() OR app.is_platform_admin())
  WITH CHECK (id = app.current_user_id() OR app.is_platform_admin());

-- M20 Stage 2: PasswordResetToken is gone. Password recovery is Supabase
-- Auth's job entirely, so RepOS stores no reset token to protect.

-- Installation-wide settings belong to the operator alone.
ALTER TABLE public."AppSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AppSetting" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_admin_only ON public."AppSetting";
CREATE POLICY settings_admin_only ON public."AppSetting"
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Hardening applied after the first attack run found a privilege-escalation
-- path: a user could update their own User row, and isPlatformAdmin is a
-- column on it. RLS chooses rows, not columns, so column privileges close it.
-- ---------------------------------------------------------------------------

REVOKE UPDATE ON public."User" FROM repos_app;
REVOKE INSERT ON public."User" FROM repos_app;

-- Everything a person legitimately changes about themselves. `isPlatformAdmin`,
-- `status` and `sessionVersion` are deliberately absent: those are decisions
-- made ABOUT a user, not BY one.
GRANT UPDATE (name, email, "authProviderId", "emailVerifiedAt", "lastSignInAt", "updatedAt")
  ON public."User" TO repos_app;

-- Signup inserts a user. It cannot insert an administrator, because it cannot
-- write that column at all - the default (false) applies instead.
GRANT INSERT (id, email, name, "authProviderId", status, "emailVerifiedAt", "sessionVersion", "createdAt", "updatedAt")
  ON public."User" TO repos_app;

-- Belt and braces: even if a column grant were widened by mistake, a
-- non-admin still cannot leave behind a row marked as an administrator.
DROP POLICY IF EXISTS user_self_or_admin ON public."User";
CREATE POLICY user_self_or_admin ON public."User"
  USING (id = app.current_user_id() OR app.is_platform_admin())
  WITH CHECK (
    (id = app.current_user_id() OR app.is_platform_admin())
    AND (app.is_platform_admin() OR NOT "isPlatformAdmin")
  );

-- Promotion and suspension happen here and nowhere else. SECURITY DEFINER, so
-- it runs with the owner's rights - and its first act is to check the caller
-- actually is an administrator.
CREATE OR REPLACE FUNCTION app.set_platform_admin(target_user_id text, value boolean)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT app.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  UPDATE public."User" SET "isPlatformAdmin" = value, "updatedAt" = now()
  WHERE id = target_user_id;
END $$;

CREATE OR REPLACE FUNCTION app.set_user_status(target_user_id text, new_status text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT app.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  -- Suspending someone also ends every session they hold.
  UPDATE public."User"
     SET status = new_status,
         "sessionVersion" = "sessionVersion" + 1,
         "updatedAt" = now()
   WHERE id = target_user_id;
END $$;

-- Signing out everywhere, available to the person themselves.
CREATE OR REPLACE FUNCTION app.bump_session_version(target_user_id text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (app.is_platform_admin() OR target_user_id = app.current_user_id()) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  UPDATE public."User"
     SET "sessionVersion" = "sessionVersion" + 1, "updatedAt" = now()
   WHERE id = target_user_id;
END $$;

-- --- Membership: staff may see the team, owners may change it -------------
CREATE OR REPLACE FUNCTION app.owned_client_ids() RETURNS SETOF text
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT c.id FROM public."Client" c WHERE app.is_platform_admin()
    UNION
    SELECT m."clientId" FROM public."Membership" m
    WHERE m."userId" = app.current_user_id()
      AND m.status = 'ACTIVE'
      AND m.role = 'BUSINESS_OWNER'
$$;

DROP POLICY IF EXISTS tenant_isolation ON public."Membership";
DROP POLICY IF EXISTS membership_read ON public."Membership";
DROP POLICY IF EXISTS membership_write ON public."Membership";

-- Anyone in the business can see who else is in it.
CREATE POLICY membership_read ON public."Membership"
  FOR SELECT USING ("clientId" IN (SELECT app.accessible_client_ids()));

-- Only an owner of that same business (or an admin) can change the team, and
-- only within that business.
CREATE POLICY membership_write ON public."Membership"
  FOR ALL
  USING ("clientId" IN (SELECT app.owned_client_ids()))
  WITH CHECK ("clientId" IN (SELECT app.owned_client_ids()));

-- Invitations follow the same rule: owners invite, staff do not.
DROP POLICY IF EXISTS tenant_isolation ON public."Invitation";
DROP POLICY IF EXISTS invitation_read ON public."Invitation";
DROP POLICY IF EXISTS invitation_write ON public."Invitation";
CREATE POLICY invitation_read ON public."Invitation"
  FOR SELECT USING ("clientId" IN (SELECT app.accessible_client_ids()));
CREATE POLICY invitation_write ON public."Invitation"
  FOR ALL
  USING ("clientId" IN (SELECT app.owned_client_ids()))
  WITH CHECK ("clientId" IN (SELECT app.owned_client_ids()));

-- --- Client: a business may be edited by its owners, not by its staff ------
DROP POLICY IF EXISTS tenant_isolation ON public."Client";
DROP POLICY IF EXISTS client_read ON public."Client";
DROP POLICY IF EXISTS client_write ON public."Client";
CREATE POLICY client_read ON public."Client"
  FOR SELECT USING (id IN (SELECT app.accessible_client_ids()));
CREATE POLICY client_write ON public."Client"
  FOR ALL
  USING (id IN (SELECT app.owned_client_ids()))
  WITH CHECK (id IN (SELECT app.owned_client_ids()));

-- Subscription state is the platform's decision, not the customer's. A
-- business owner must not be able to move themselves off a paused plan.
REVOKE UPDATE ON public."Client" FROM repos_app;
GRANT UPDATE (
  "businessName", vertical, "areaLabel", "mapsUrl", "reviewLinkUrl",
  "ownerName", "ownerPhone", "ownerEmail", "avgCustomerValueInr",
  "onboardingDate", "baselineRating", "baselineReviewCount",
  "baselineReviewsPerWeek", "baselineObservedAt", "kitInstalledDate",
  notes, "archivedAt", "portalToken", "portalTokenAt", "portalLinkSentAt",
  "setupCompletedAt", "updatedAt"
) ON public."Client" TO repos_app;

CREATE OR REPLACE FUNCTION app.set_subscription_status(target_client_id text, new_status text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT app.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  UPDATE public."Client" SET "subscriptionStatus" = new_status, "updatedAt" = now()
  WHERE id = target_client_id;
END $$;

-- --- the two columns a customer must not be able to set for themselves --------
--
-- `plan` and `status` were left out of the Client UPDATE grant above, alongside
-- `subscriptionStatus`, and the comment there explains why for the third of them
-- only. The reasoning is the same for all three: `plan` is what the business is
-- billed for, and `status` is the operator's own sales pipeline. Neither is a
-- customer's to choose.
--
-- Leaving them out was right and incomplete. `updateClient` writes the whole
-- validated form, `plan` and `status` included, so under `repos_app` the
-- operator's "edit client" form was refused outright -- and so were archive and
-- restore, which both move `status`. The column grant was doing the security job
-- and breaking three admin flows to do it.
--
-- What made that more than an inconvenience: `updateClientAction` is gated by
-- `tenantGate(form, 'OWNER', 'id')`, and a BUSINESS_OWNER satisfies that. The
-- edit PAGE is staff-only, but a server action is a POST addressed by action id,
-- not by path, so the page's gate is not the action's gate. A business owner who
-- posted to it could name their own `plan`. The missing column privilege was the
-- only thing stopping a self-service upgrade to PRO.
--
-- So the privilege stays revoked and the capability moves here, where it can be
-- gated on being platform staff rather than on being anybody's owner. Same shape
-- as `app.set_subscription_status` directly above, and for the same reason.
--
-- A NULL or blank argument leaves that column alone, so archive and restore can
-- move `status` without having an opinion about `plan`.
CREATE OR REPLACE FUNCTION app.set_client_commercials(
  p_client_id text,
  p_status    text,
  p_plan      text,
  p_now       text
)
  RETURNS void
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

  UPDATE public."Client"
     SET status      = coalesce(nullif(btrim(coalesce(p_status, '')), ''), status),
         plan        = coalesce(nullif(btrim(coalesce(p_plan,   '')), ''), plan),
         "updatedAt" = v_now
   WHERE id = p_client_id;
END $fn$;

REVOKE ALL ON FUNCTION app.set_client_commercials(text, text, text, text) FROM PUBLIC;

-- Feedback belongs to the business it arrived at. Nobody moves a row between
-- tenants, so the tenant key itself is not writable by the application.
REVOKE UPDATE ("clientId") ON public."ReviewItem" FROM repos_app;


-- --- accepting an invitation ------------------------------------------------
--
-- The same shape of problem the identity bridge has, one level further out.
-- Reading an invitation is gated by `invitation_read`, which asks whether the
-- caller already belongs to the business -- and the whole point of accepting is
-- that they do not yet. So an invitee could never read the invitation that
-- exists to admit them, and could never insert the membership either, since
-- `membership_write` asks the same question. Correct, and unusable.
--
-- This does the acceptance in one place instead, under the owner's rights, and
-- refuses unless every condition the application already required is met. It
-- takes the token HASH, never the token: the raw value stays in the browser and
-- the application's hands, and a leaked database backup yields nothing usable.
--
-- What it cannot be talked into: joining a business the invitation does not
-- name (there is no clientId argument), joining as anyone other than the
-- authenticated caller, accepting an invitation addressed to a different email,
-- reusing a spent or revoked one, using an expired one, or granting platform
-- admin -- the role is clamped to the two business roles, so `isPlatformAdmin`
-- is not reachable from here in any form.
CREATE OR REPLACE FUNCTION app.accept_invitation(
  p_token_hash text,
  p_user_id    text,
  p_now        text
)
  RETURNS TABLE (client_id text, member_role text)
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now    timestamp := p_now::timestamp;
  v_inv    record;
  v_email  text;
  v_role   text;
BEGIN
  SELECT i.id, i."clientId", i.email, i.role, i."expiresAt", i."acceptedAt", i."revokedAt"
    INTO v_inv
  FROM public."Invitation" i
  WHERE i."tokenHash" = p_token_hash;

  -- Unknown, spent, revoked and expired all answer the same way: nothing. The
  -- caller cannot learn which, so a stale link tells them no more than a
  -- fabricated one.
  IF v_inv.id IS NULL THEN RETURN; END IF;
  IF v_inv."acceptedAt" IS NOT NULL OR v_inv."revokedAt" IS NOT NULL THEN RETURN; END IF;
  IF v_inv."expiresAt" < v_now THEN RETURN; END IF;

  -- The invitation is addressed to a person, not to whoever holds the link.
  SELECT u.email INTO v_email
  FROM public."User" u WHERE u.id = p_user_id AND u.status = 'ACTIVE';
  IF v_email IS NULL THEN RETURN; END IF;
  IF lower(v_email) <> lower(v_inv.email) THEN RETURN; END IF;

  -- Two business roles exist. Anything else an invitation might carry becomes
  -- staff, which is what the application has always done.
  v_role := CASE WHEN v_inv.role = 'BUSINESS_OWNER' THEN 'BUSINESS_OWNER' ELSE 'BUSINESS_STAFF' END;

  INSERT INTO public."Membership" (id, "userId", "clientId", role, status, "createdAt", "updatedAt")
  VALUES (replace(gen_random_uuid()::text, '-', ''), p_user_id, v_inv."clientId", v_role, 'ACTIVE', v_now, v_now)
  ON CONFLICT ("userId", "clientId") DO UPDATE
    SET role = excluded.role, status = 'ACTIVE', "updatedAt" = v_now;

  UPDATE public."Invitation" SET "acceptedAt" = v_now WHERE id = v_inv.id;

  RETURN QUERY SELECT v_inv."clientId", v_role;
END $$;

REVOKE ALL ON FUNCTION app.accept_invitation(text, text, text) FROM PUBLIC;

-- --- signing up ---------------------------------------------------------------
--
-- The third instance of the same shape, and the one that broke the front door.
--
-- Signing up has to create the `User` row that every policy in this file is
-- written against -- and until that row exists there is no `app.user_id`, so
-- `user_self_or_admin` compares the new row against NULL and refuses it. The
-- application could not create the account that would let it create the
-- account. Two separate walls, in fact: the INSERT column grant above omits
-- `lastSignInAt`, which Prisma writes, so the statement never even reached the
-- policy -- it was refused for the table.
--
-- This does the whole of provisioning in one place, under the owner's rights.
-- It is the counterpart to `user_id_for_auth`: that one answers "who is this
-- verified identity", this one answers "make one if there is not one yet".
-- Both take an id the caller has ALREADY authenticated against Supabase, and
-- neither is reachable by anything but the application role.
--
-- What it cannot be talked into:
--   * granting platform admin -- `isPlatformAdmin` is not written here at all,
--     in any branch, so the column default (false) is the only value a signup
--     can produce;
--   * taking over somebody else's account -- a row whose `authProviderId` is
--     already set is never re-pointed. Presenting a stranger's email with your
--     own Supabase id is refused, not merged;
--   * reviving a suspended account -- `status` is not written either, so a row
--     that was suspended stays suspended and resolves to no identity;
--   * inventing sessions -- `sessionVersion` is not written, so it starts and
--     stays at the default until something entitled to bump it does.
--
-- What it deliberately CAN do is claim a row an invitation created ahead of its
-- account: `authProviderId IS NULL` means "this address was invited but has
-- never signed in", and that is precisely the row a first sign-in should adopt
-- rather than collide with on the unique email.
CREATE OR REPLACE FUNCTION app.provision_user(
  p_auth_id text,
  p_email   text,
  p_name    text,
  p_now     text
)
  RETURNS TABLE (user_id text, was_created boolean)
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_now   timestamp := p_now::timestamp;
  v_email text      := lower(btrim(p_email));
  v_name  text      := nullif(btrim(coalesce(p_name, '')), '');
  v_id    text;
  v_bound text;
BEGIN
  IF btrim(coalesce(p_auth_id, '')) = '' OR v_email = '' THEN
    RAISE EXCEPTION 'provision_user needs a verified identity';
  END IF;

  -- Already known. This is every sign-in after the first, and every repeat of a
  -- confirmation link, so it has to be idempotent rather than an error.
  SELECT u.id INTO v_id
  FROM public."User" u
  WHERE u."authProviderId" = p_auth_id;

  IF v_id IS NOT NULL THEN
    UPDATE public."User"
       SET email = v_email, "lastSignInAt" = v_now, "updatedAt" = v_now
     WHERE id = v_id;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  SELECT u.id, u."authProviderId" INTO v_id, v_bound
  FROM public."User" u
  WHERE lower(u.email) = v_email;

  IF v_id IS NOT NULL THEN
    -- The address is spoken for by a different Supabase identity. Refusing is
    -- the only safe answer: re-pointing it would hand one person's account to
    -- whoever signed up with their email.
    IF v_bound IS NOT NULL THEN
      RAISE EXCEPTION 'that email belongs to another identity'
        USING ERRCODE = 'unique_violation';
    END IF;
    UPDATE public."User"
       SET "authProviderId"  = p_auth_id,
           "lastSignInAt"    = v_now,
           "emailVerifiedAt" = v_now,
           "updatedAt"       = v_now
     WHERE id = v_id;
    RETURN QUERY SELECT v_id, false;
    RETURN;
  END IF;

  v_id := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public."User"
    (id, email, name, "authProviderId", "emailVerifiedAt", "lastSignInAt", "createdAt", "updatedAt")
  VALUES
    (v_id, v_email, v_name, p_auth_id, v_now, v_now, v_now, v_now);

  RETURN QUERY SELECT v_id, true;
END $fn$;

REVOKE ALL ON FUNCTION app.provision_user(text, text, text, text) FROM PUBLIC;

-- --- creating a business ------------------------------------------------------
--
-- And the fourth. `client_write` admits a row whose id is already in
-- `owned_client_ids()`, which for a business being created for the first time
-- is nobody's: the ownership that would authorise the insert is created BY the
-- insert. A platform admin fares no better, because `owned_client_ids()` reads
-- the `Client` table through a STABLE function and the row being inserted is
-- not in its snapshot either. Neither self-service signup nor the operator's
-- own "add a client" form could put a business into this database.
--
-- The narrow thing that cannot be done any other way is exactly that: create
-- the tenant, and in the same breath create the membership that makes it
-- somebody's. Everything else about a business -- its area, its owner's name,
-- its baseline, its voice profile, its feedback gateway -- is an ordinary write
-- the policies already allow once the row exists and the caller owns it, and it
-- stays on that path. So this takes four facts about a business, not twenty-five.
--
-- THERE IS NO OWNER PARAMETER. The owner is `app.current_user_id()`, the
-- transaction-local identity `db.ts` sets from the verified Supabase session and
-- from nothing else. A browser cannot name the owner because there is nowhere to
-- name one -- the same reason `accept_invitation` takes no clientId.
--
-- p_as_owner = TRUE  -- self-service signup. The caller becomes the owner, and
--                       `status` and `plan` are FORCED, so an owner cannot put
--                       their own business on a plan they did not buy.
-- p_as_owner = FALSE -- the operator's client list: a business RepOS manages
--                       with no customer account attached yet. Platform admins
--                       only, checked here rather than trusted from the caller.
--
-- `subscriptionStatus` is never a parameter in either case. It is the platform's
-- decision and moves only through `app.set_subscription_status`.
CREATE OR REPLACE FUNCTION app.create_client(
  p_business_name text,
  p_vertical      text,
  p_as_owner      boolean,
  p_status        text,
  p_plan          text,
  p_now           text
)
  RETURNS text
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_now    timestamp := p_now::timestamp;
  v_actor  text      := app.current_user_id();
  v_id     text;
  v_status text;
  v_plan   text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  -- The GUC is set by the application from a resolved session, but this is the
  -- one thing standing between an identity and a brand new tenant, so it
  -- confirms the account is real and active rather than taking the setting's
  -- word for it. A suspended account creates nothing.
  IF NOT EXISTS (
    SELECT 1 FROM public."User" u WHERE u.id = v_actor AND u.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  IF btrim(coalesce(p_business_name, '')) = '' OR btrim(coalesce(p_vertical, '')) = '' THEN
    RAISE EXCEPTION 'a business needs a name and a vertical';
  END IF;

  IF p_as_owner THEN
    v_status := 'ACTIVE';
    v_plan   := 'STARTER';
  ELSE
    IF NOT app.is_platform_admin() THEN
      RAISE EXCEPTION 'not authorised';
    END IF;
    v_status := coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'PROSPECT');
    v_plan   := coalesce(nullif(btrim(coalesce(p_plan,   '')), ''), 'STARTER');
  END IF;

  v_id := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public."Client"
    (id, "businessName", vertical, plan, status, "subscriptionStatus", "createdAt", "updatedAt")
  VALUES
    (v_id, btrim(p_business_name), btrim(p_vertical), v_plan, v_status, 'TRIAL', v_now, v_now);

  IF p_as_owner THEN
    INSERT INTO public."Membership"
      (id, "userId", "clientId", role, status, "createdAt", "updatedAt")
    VALUES
      (replace(gen_random_uuid()::text, '-', ''), v_actor, v_id,
       'BUSINESS_OWNER', 'ACTIVE', v_now, v_now);
  END IF;

  RETURN v_id;
END $fn$;

REVOKE ALL ON FUNCTION app.create_client(text, text, boolean, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO repos_app;
GRANT EXECUTE ON FUNCTION app.user_id_for_auth(text) TO repos_app;
GRANT EXECUTE ON FUNCTION app.accept_invitation(text, text, text) TO repos_app;
GRANT EXECUTE ON FUNCTION app.provision_user(text, text, text, text) TO repos_app;
GRANT EXECUTE ON FUNCTION app.create_client(text, text, boolean, text, text, text) TO repos_app;
GRANT EXECUTE ON FUNCTION app.set_client_commercials(text, text, text, text) TO repos_app;
