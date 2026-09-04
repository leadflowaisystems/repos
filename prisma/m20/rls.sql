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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repos_app') THEN
    CREATE ROLE repos_app LOGIN PASSWORD 'repos_app_pw';
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

-- Feedback belongs to the business it arrived at. Nobody moves a row between
-- tenants, so the tenant key itself is not writable by the application.
REVOKE UPDATE ("clientId") ON public."ReviewItem" FROM repos_app;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO repos_app;
