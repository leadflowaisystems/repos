-- M21 — the commercial side, and remembering a visit.
--
-- PURELY ADDITIVE. Four nullable columns and one new table. Nothing is dropped,
-- no type changes, no row is written or read. Every statement is guarded, so
-- running this file twice is the same as running it once.
--
-- ORDER MATTERS: apply this FIRST, then re-apply `prisma/m20/rls.sql`. The RLS
-- file switches Row Level Security on for "Commercial", creates its policy, and
-- grants the table to `repos_app` through its GRANT ON ALL TABLES — none of
-- which it can do for a table that does not exist yet. Until it runs, the new
-- table has no policy and the new app.* functions are not there.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot create a
-- table and should not be able to.
--
--   npx prisma db execute --file prisma/m21/migration.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/m20/rls.sql       --schema prisma/schema.prisma
--
-- WHAT EACH COLUMN IS FOR
--
--   Client.trialStartsAt / trialEndsAt
--     The trial window. Deliberately NOT added to the Client UPDATE grant in
--     rls.sql, alongside plan, status and subscriptionStatus: a business that
--     can move its own trial end date does not have a trial. They move through
--     app.set_subscription, which asks app.is_platform_admin().
--
--   Client.paymentRequestedAt
--     When the owner asked to be told what this costs. This one IS in the
--     grant, because it is their own request.
--
--   Membership.lastSeenAt
--     When this person last opened this workspace, so the next visit can open
--     with what happened in between. Written through app.touch_membership,
--     because membership_write asks for BUSINESS_OWNER and a staff member is
--     not one — and widening that policy so they could stamp their own row
--     would also let them edit their own role.
--
--   Commercial
--     What was agreed and what it costs. Separate from Client because it is not
--     the owner's to read: its policy asks for platform admin rather than for
--     membership, so a business owner's connection returns no rows at all. That
--     is the difference between a price the application declines to render and
--     one the database will not hand over.

ALTER TABLE public."Client"     ADD COLUMN IF NOT EXISTS "trialStartsAt"      TIMESTAMP(3);
ALTER TABLE public."Client"     ADD COLUMN IF NOT EXISTS "trialEndsAt"        TIMESTAMP(3);
ALTER TABLE public."Client"     ADD COLUMN IF NOT EXISTS "paymentRequestedAt" TIMESTAMP(3);
ALTER TABLE public."Membership" ADD COLUMN IF NOT EXISTS "lastSeenAt"         TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS public."Commercial" (
  "id"                  TEXT NOT NULL,
  "clientId"            TEXT NOT NULL,
  "amountInr"           INTEGER,
  "cadence"             TEXT NOT NULL DEFAULT 'MONTHLY',
  "note"                TEXT,
  "paymentInstructions" TEXT,
  "instructionsSentAt"  TIMESTAMP(3),
  "paidAt"              TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Commercial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Commercial_clientId_key"
  ON public."Commercial"("clientId");

DO $$
BEGIN
  ALTER TABLE public."Commercial"
    ADD CONSTRAINT "Commercial_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES public."Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
