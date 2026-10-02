-- M52 — the temporary login and the owner's own login become two identities.
--
-- ADDITIVE. One nullable column and its unique index on "AccountAccess", and a
-- one-time move of existing rows into the new shape. No other table or column
-- changes, nothing is dropped, and no business data (feedback, QR, analysis)
-- is read or written. Running it twice is the same as running it once.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL, BEFORE deploying the code
-- that reads the column — then re-apply `prisma/m20/rls.sql`, whose M52 block
-- teaches `app.user_id_for_auth` and `app.provision_user` about the column
-- and adds `app.rebind_temp_access`:
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m52/migration.sql
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m20/rls.sql
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
--   1. A row whose temporary login was never set up, and whose User still
--      signs in with that temporary address, is temporary-only: its Supabase
--      identity moves from "User"."authProviderId" to "tempAuthId". The
--      User keeps its row, membership and history; it simply has no own login
--      until setup makes one.
--   2. A row whose old temporary login became the owner's own (set up before
--      M52, or its email already moved) keeps that login as the owner's, gets
--      no temporary identity, and is marked DISABLED and set up. An admin can
--      issue a fresh temporary login for it later.

ALTER TABLE public."AccountAccess" ADD COLUMN IF NOT EXISTS "tempAuthId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AccountAccess_tempAuthId_key"
  ON public."AccountAccess"("tempAuthId");

-- 1. temporary-only rows: move the identity across.
UPDATE public."AccountAccess" a
   SET "tempAuthId" = u."authProviderId"
  FROM public."User" u
 WHERE u.id = a."userId"
   AND a."tempAuthId" IS NULL
   AND a."setupCompletedAt" IS NULL
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
