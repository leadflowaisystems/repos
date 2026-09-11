-- M38 — a person may see the people they share a business with.
--
-- ONE FUNCTION AND ONE POLICY, both new. Nothing is dropped, no column
-- changes, no row is read or written, no grant is widened, and no trial date,
-- token, price, order or piece of feedback is touched anywhere in this file.
-- Running it twice is the same as running it once.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot create a
-- policy and should not be able to.
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m38/migration.sql
--
-- (`prisma db execute` reads .env, which on a developer machine points at the
-- LOCAL cluster, so it is the wrong tool for reaching production. `-d` is not
-- optional: given a bare positional URI this psql ignores the `-c` after it.)
--
-- REQUIRES an already-built database — one that has had `prisma/m20/rls.sql`
-- applied, so `app.current_user_id()` and the `repos_app` role exist.
--
-- ORDER DOES NOT MATTER for this one. The application code is unchanged:
-- the Team page runs the same query before and after. Before this file it
-- throws for the case below; after it, it answers. Deploying code first
-- changes nothing; applying SQL first fixes the page under the build that is
-- already live.
--
--
-- WHAT WAS WRONG
--
-- `user_self_or_admin`, the only policy on public."User", lets a person read
-- exactly one row of that table: their own. A platform admin reads every
-- row. That is the right rule for identity, and it was the whole rule.
--
-- The Team page lists a business's members by joining Membership to User for
-- each one's name and email. Membership's own policy (`membership_read`)
-- already lets anyone in the business see who else is in it — but the join
-- to User then returned NOTHING for every colleague, because the reader was
-- not that colleague and not an admin. Prisma treats the relation as
-- required, so the page did not degrade: it threw
--
--   Inconsistent query result: Field user is required to return data, got `null`
--
-- for any owner who was not Headway staff and whose business had a second
-- member. Every business a founder looks at has the founder in it, which is
-- why a platform admin never saw this and why it shipped. The same missing
-- visibility also let "invite somebody who is already on the team" go
-- through: the duplicate check filters Membership by the invitee's User row,
-- and could not see it.
--
--
-- WHAT THIS CHANGES, EXACTLY
--
--   app.colleague_user_ids()
--     The ids of every person who holds a membership — active or suspended —
--     in a business where the CALLER holds an ACTIVE membership. SECURITY
--     DEFINER, like `app.owned_client_ids()`, so the policy below does not
--     re-enter Membership's own policies to answer. It reads only
--     `app.current_user_id()`: a pipeline run (which names a client, not a
--     person) gets no colleagues from it, and neither does a signed-out
--     connection.
--
--   user_colleague_read ON public."User", FOR SELECT
--     A person may READ the User rows of their colleagues. Read only: the
--     UPDATE and INSERT paths keep `user_self_or_admin`'s USING and WITH
--     CHECK, and the column grants that stop a person writing
--     isPlatformAdmin, status or sessionVersion are untouched.
--
-- WHAT IT DOES NOT CHANGE
--
--   * Tenant isolation. A person sees colleagues in the businesses they are
--     in and nobody else. Two businesses that share a database and share no
--     member still cannot see each other's people. Asserted, as `repos_app`,
--     in tests/m38.team-rls.test.ts: owner with two members, an ordinary
--     member, an unrelated tenant, a platform admin, and no identity at all.
--   * Who may CHANGE a team. `membership_write` still asks for BUSINESS_OWNER
--     of that same business.
--   * The suspended. A suspended colleague is still listed as suspended, so
--     their row is readable; a suspended CALLER holds no active membership
--     and so sees no colleagues, matching what `loadActor` already decides.
--
-- WHAT A COLLEAGUE CAN NOW SEE ABOUT YOU, plainly: your name, your email, and
-- the rest of your User row — an opaque Supabase identifier, whether you are
-- Headway staff, your account status, a session counter and timestamps.
-- None of it is a secret and none of it grants anything: signing in still
-- needs a cookie Supabase signed. It is the same list the Team page has
-- always been meant to show, plus fields the page does not print.
--
-- Afterwards the policy count the runtime-role test pins moves from 23 to
-- 24, and the `app` schema gains one function.

CREATE OR REPLACE FUNCTION app.colleague_user_ids()
  RETURNS SETOF text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
  SELECT m."userId"
  FROM public."Membership" m
  WHERE m."clientId" IN (
    SELECT mine."clientId"
    FROM public."Membership" mine
    WHERE mine."userId" = app.current_user_id()
      AND mine.status = 'ACTIVE'
  )
$$;

REVOKE ALL ON FUNCTION app.colleague_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.colleague_user_ids() TO repos_app;

DROP POLICY IF EXISTS user_colleague_read ON public."User";
CREATE POLICY user_colleague_read ON public."User"
  FOR SELECT
  USING (id IN (SELECT app.colleague_user_ids()));
