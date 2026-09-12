-- M39 — a temporary, admin-issued credential for the pilot onboarding flow.
--
-- PURELY ADDITIVE. One new table, no column changes anywhere else, nothing
-- dropped, no row read or written. Running it twice is the same as running
-- it once.
--
-- ORDER MATTERS, same rule as every table added since M21: apply this FIRST,
-- then re-apply `prisma/m20/rls.sql`. That file switches Row Level Security
-- on for "AccountAccess", creates its policies, and narrows its column
-- grants — none of which it can do for a table that does not exist yet.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot create a
-- table and should not be able to.
--
--   psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" \
--        -f prisma/m39/migration.sql
--   psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" \
--        -f prisma/m20/rls.sql
--
-- (`prisma db execute` reads .env, which on a developer machine points at the
-- LOCAL cluster, so it is the wrong tool for reaching production.)
--
-- WHAT THIS IS FOR
--
-- An admin creates a business's Client row today with no owner attached —
-- granting real access has always meant a separate, email-dependent invite.
-- For the pilot, the admin instead generates a temporary login id and
-- password, hands them over with the printed kit, and the owner signs in
-- through the ordinary login page. AccountAccess is the record of that: one
-- row per client, naming the one User it was minted for, and a status that
-- moves TEMPORARY_ACTIVE -> SETUP_COMPLETE once the owner replaces the
-- password, or -> DISABLED if an admin turns it off first. It never grows a
-- second identity for a client — see the model's own comment in
-- prisma/schema.prisma for the full reasoning.
--
-- WHAT THIS DOES NOT CHANGE
--
--   * No existing table, column or constraint is touched.
--   * Client/User/Membership creation is unchanged; this table is written
--     to only by the new account-access service, never inline with them.
--   * The password itself is never a column here or anywhere else in this
--     schema — it lives only in Supabase Auth's own storage.

CREATE TABLE IF NOT EXISTS public."AccountAccess" (
  "id"               TEXT NOT NULL,
  "clientId"         TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "loginId"          TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'TEMPORARY_ACTIVE',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId"  TEXT,
  "setupCompletedAt" TIMESTAMP(3),
  "disabledAt"       TIMESTAMP(3),
  "disabledByUserId" TEXT,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountAccess_clientId_key"
  ON public."AccountAccess"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "AccountAccess_userId_key"
  ON public."AccountAccess"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AccountAccess_loginId_key"
  ON public."AccountAccess"("loginId");

DO $$
BEGIN
  ALTER TABLE public."AccountAccess"
    ADD CONSTRAINT "AccountAccess_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES public."Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public."AccountAccess"
    ADD CONSTRAINT "AccountAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public."AccountAccess"
    ADD CONSTRAINT "AccountAccess_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public."AccountAccess"
    ADD CONSTRAINT "AccountAccess_disabledByUserId_fkey"
    FOREIGN KEY ("disabledByUserId") REFERENCES public."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
