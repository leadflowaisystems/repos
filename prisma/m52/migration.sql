-- M52 — the temporary login and the owner's own login become two identities.
--
-- ADDITIVE. One nullable column and its unique index on "AccountAccess", and a
-- one-time move of existing rows into the new shape. No other table or column
-- changes, nothing is dropped, and no business data (feedback, QR, analysis)
-- is read or written. Running it twice is the same as running it once.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL, in ONE transaction with
-- `prisma/m20/rls.sql` (whose M52 block teaches `app.user_id_for_auth` and
-- `app.provision_user` about the column and adds `app.rebind_temp_access`),
-- immediately BEFORE the code that reads the column goes live:
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -c "SET lock_timeout = '5s'" -f prisma/m52/migration.sql -f prisma/m20/rls.sql
--
-- One transaction, because in between the old `app.provision_user` would
-- bind a moved temporary login straight back as its owner's own on the next
-- sign-in. Once the new code is live, run THIS file once more, on its own:
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -f prisma/m52/migration.sql
--
-- (anything the old code still running in between created is moved then).
--
-- THE WINDOW. From the commit until the new code is live, the OLD code cannot
-- sign anyone in with a moved temporary login (it looks only at
-- "User"."authProviderId", which step 1 empties): every business on temporary
-- access, and every owner who "set up" before M52 on the temporary address, is
-- refused for that minute or two. So: build the new deployment first, apply,
-- then promote it at once; do not generate temporary access or permanently
-- delete a business in between. Do NOT roll the app back to the pre-M52 code
-- after this has run unless the move is reversed first — valid only while no
-- M52 setup or enable has happened yet:
--
--   UPDATE public."User" u SET "authProviderId" = a."tempAuthId"
--     FROM public."AccountAccess" a
--    WHERE a."userId" = u.id AND u."authProviderId" IS NULL AND a."tempAuthId" IS NOT NULL;
--
-- (and give the rows step 1 switched back on their old status and
-- "setupCompletedAt" from the backup taken before).
--
-- WHY
--
-- Until M52 the temporary login WAS the owner's account: setup changed its
-- password and email in place. One Supabase identity has one password, so
-- after setup an admin could never turn temporary access back on without
-- replacing the owner's own password. Now:
--
--   "AccountAccess"."tempAuthId"  the temporary Supabase identity
--   "User"."authProviderId"       the owner's own identity, made at setup
--
-- Both resolve to the same User, Membership and Client.
--
-- THE ONE-TIME MOVE (existing rows)
--
--   1. A row whose User still signs in with the temporary address is
--      temporary-only: its Supabase identity moves from "User"."authProviderId"
--      to "tempAuthId". The User keeps its row, membership and history; it
--      simply has no own login until setup makes one. That includes an owner
--      who "set up" before M52 but whose real email never arrived (the change
--      was never confirmed): they sign in today with the temporary address and
--      a password they chose, so that login stays ON, and Account offers them
--      setup again — this time with an email of their own.
--   2. A row whose old temporary login became the owner's own (its email moved
--      to their real address) keeps that login as the owner's, gets no
--      temporary identity, and is marked DISABLED and set up. An admin can
--      issue a fresh temporary login for it later.

ALTER TABLE public."AccountAccess" ADD COLUMN IF NOT EXISTS "tempAuthId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AccountAccess_tempAuthId_key"
  ON public."AccountAccess"("tempAuthId");

-- 0. On a Supabase database, nothing moves unless the LIVE identity agrees.
--    Step 1 trusts "User".email to say a login still carries the temporary
--    address; a login whose address Supabase has already changed to a real
--    one (a confirmation link opened where RepOS never saw it), or which has
--    a change still pending, is the owner's own and must never become a
--    temporary login that "Disable" would scramble. Such a row stops the
--    whole migration, to be settled by hand. (Test databases have no auth
--    schema and skip this.)
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM public."AccountAccess" a
        JOIN public."User" u ON u.id = a."userId"
        JOIN auth.users au ON au.id::text = u."authProviderId"
       WHERE a."tempAuthId" IS NULL
         AND lower(u.email) = lower(a."loginId")
         AND (lower(coalesce(au.email, '')) <> lower(a."loginId") OR coalesce(au.email_change, '') <> '')
    ) THEN
      RAISE EXCEPTION 'M52: a login RepOS records under its temporary address has a real or pending address in Supabase. Nothing was changed; settle that row by hand first.';
    END IF;
  END IF;
END $$;

-- 1. temporary-only rows: move the identity across. (Every SET reads the row
--    as it was, so "setupCompletedAt" below is the old value.)
UPDATE public."AccountAccess" a
   SET "tempAuthId"       = u."authProviderId",
       status             = CASE WHEN a."setupCompletedAt" IS NOT NULL OR a.status = 'SETUP_COMPLETE'
                                 THEN 'TEMPORARY_ACTIVE' ELSE a.status END,
       "disabledAt"       = CASE WHEN a."setupCompletedAt" IS NOT NULL OR a.status = 'SETUP_COMPLETE'
                                 THEN NULL ELSE a."disabledAt" END,
       "disabledByUserId" = CASE WHEN a."setupCompletedAt" IS NOT NULL OR a.status = 'SETUP_COMPLETE'
                                 THEN NULL ELSE a."disabledByUserId" END,
       "setupCompletedAt" = NULL,
       "updatedAt"        = now()
  FROM public."User" u
 WHERE u.id = a."userId"
   AND a."tempAuthId" IS NULL
   AND u."authProviderId" IS NOT NULL
   AND lower(u.email) = lower(a."loginId");

UPDATE public."User" u
   SET "authProviderId" = NULL, "updatedAt" = now()
  FROM public."AccountAccess" a
 WHERE a."userId" = u.id
   AND a."tempAuthId" IS NOT NULL
   AND u."authProviderId" = a."tempAuthId";

-- 2. rows whose old temporary login is the owner's own: retire temporary access.
UPDATE public."AccountAccess" a
   SET status             = 'DISABLED',
       "disabledAt"       = coalesce(a."disabledAt", now()),
       "setupCompletedAt" = coalesce(a."setupCompletedAt", now()),
       "updatedAt"        = now()
  FROM public."User" u
 WHERE u.id = a."userId"
   AND a."tempAuthId" IS NULL
   AND u."authProviderId" IS NOT NULL;
