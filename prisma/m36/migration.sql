-- M36 — sent, and arrived.
--
-- ADDITIVE ONLY. Four nullable columns and two foreign keys on ONE table.
-- Nothing is dropped, no column changes type, no existing row is read or
-- written, and no feedback, token, trial date, QR, price or order anywhere is
-- altered by this file. Running it twice is the same as running it once.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot alter a
-- table and should not be able to.
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m36/migration.sql
--
-- (`prisma db execute` reads .env, which on a developer machine points at the
-- LOCAL cluster, so it is the wrong tool for reaching production. `-d` is not
-- optional: given a bare positional URI this psql ignores the `-c` after it.)
--
-- REQUIRES prisma/m33/migration.sql, which created public."KitOrder".
--
--
-- ORDER MATTERS. SQL FIRST, then deploy the code:
--
--   1. this file
--   2. deploy
--
-- Code first is not safe: the deployed Prisma client would select
-- "deliveredAt" from a table that does not have it, and every screen that
-- lists or opens an order — the operator's Orders page, an order's detail, the
-- business's own Orders page — would fail rather than degrade.
--
-- The other way round is harmless. OLD CODE + NEW COLUMNS is four nulls
-- nothing reads.
--
--
-- WHAT THE COLUMNS ARE FOR
--
--   KitOrder.deliveredAt / deliveredByUserId
--     When an operator said they had sent the printed kit, and which operator.
--     Written only behind an admin gate, from the server's clock and the
--     signed-in staff member. A business cannot write either: the policy below
--     already restricts it to its own rows, and the ACTION that writes these
--     refuses anybody who is not platform staff.
--
--   KitOrder.receivedAt / receivedByUserId
--     When the business said the kit had arrived, and who said so. A DIFFERENT
--     FACT FROM DELIVERY, and deliberately a separate pair of columns: "I sent
--     it" and "it arrived" are two claims by two people, and neither may be
--     inferred from the other.
--
-- NO RE-GRANT IS NEEDED. `repos_app` holds a TABLE-level grant on this table
-- (prisma/m33/migration.sql line 84: GRANT SELECT, INSERT, UPDATE, DELETE ON
-- public."KitOrder"), not the explicit column list that public."Client" and
-- public."User" carry — so in PostgreSQL these new columns are covered
-- automatically. What stops a business writing them is not a column privilege
-- but the action that owns them.
--
-- NO NEW TABLE AND NO NEW POLICY, so the counts the runtime-role test pins —
-- 20 tables, 23 policies — are unchanged by this file.
--
-- IT ADDS NO CUSTOMER DATA. Two timestamps and two references to a Headway
-- account. No feedback, no customer text, no contact detail.

ALTER TABLE public."KitOrder" ADD COLUMN IF NOT EXISTS "deliveredAt"       TIMESTAMP(3);
ALTER TABLE public."KitOrder" ADD COLUMN IF NOT EXISTS "deliveredByUserId" TEXT;
ALTER TABLE public."KitOrder" ADD COLUMN IF NOT EXISTS "receivedAt"        TIMESTAMP(3);
ALTER TABLE public."KitOrder" ADD COLUMN IF NOT EXISTS "receivedByUserId"  TEXT;


-- ---------------------------------------------------------------------------
-- Who said so
-- ---------------------------------------------------------------------------
--
-- ON DELETE SET NULL, matching Invitation."invitedById" — the one other place
-- this schema points at a person who did something. Removing a staff member
-- must not take the order with them; the record of the delivery survives with
-- the name gone. ON UPDATE CASCADE for the same reason every other foreign key
-- here has it: an id that moved should not orphan a row.
--
-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS, so each one is guarded by
-- name instead. That is what makes this file safe to run twice.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'KitOrder_deliveredByUserId_fkey'
       AND conrelid = 'public."KitOrder"'::regclass
  ) THEN
    ALTER TABLE public."KitOrder"
      ADD CONSTRAINT "KitOrder_deliveredByUserId_fkey"
      FOREIGN KEY ("deliveredByUserId") REFERENCES public."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'KitOrder_receivedByUserId_fkey'
       AND conrelid = 'public."KitOrder"'::regclass
  ) THEN
    ALTER TABLE public."KitOrder"
      ADD CONSTRAINT "KitOrder_receivedByUserId_fkey"
      FOREIGN KEY ("receivedByUserId") REFERENCES public."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
