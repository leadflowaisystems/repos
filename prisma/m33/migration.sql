-- M33 — the printed kit an owner can order.
--
-- ADDITIVE ONLY. One new table. Nothing is dropped, no column changes type, no
-- existing row is read or written, and no feedback, token, trial date, QR or
-- price anywhere else is touched by this file. Running it twice is the same as
-- running it once.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot create a
-- table and should not be able to.
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m33/migration.sql
--
-- (`prisma db execute` reads .env, which on a developer machine points at the
-- LOCAL cluster, so it is the wrong tool for reaching production. `-d` is not
-- optional: given a bare positional URI this psql ignores the `-c` after it.)
--
-- REQUIRES a database that has had `prisma/m20/rls.sql` applied, so the role
-- `repos_app` exists and `app.accessible_client_ids()` is defined.
--
-- ORDER DOES NOT MATTER.
--
--   * OLD CODE + NEW TABLE — the table sits unread. Harmless.
--   * NEW CODE + NO TABLE  — the Kit page still renders its two products and
--     the reprint link; ordering fails with "The order could not be placed",
--     and the Orders page shows the empty state. Nothing else in the portal
--     touches this table, so no count, no reading and no existing screen
--     changes either way.
--
--
-- WHAT THE TABLE IS FOR
--
-- One row per order. The lines live on the row as JSON because nothing queries
-- across them: a business reads its own orders and sees what each contained.
-- `ReviewItem` keeps its themes the same way.
--
-- EVERY NUMBER IN IT WAS COMPUTED ON THE SERVER. `itemsJson` holds the priced
-- lines and `totalInr` their sum, both worked out from the catalogue in
-- src/lib/kit/catalogue.ts at the moment of ordering. A browser sends
-- quantities and nothing else; it cannot send a price, a total, or somebody
-- else's client id.
--
-- IT HOLDS NO CUSTOMER DATA. No feedback, no customer text, no contact detail —
-- a business, how many cards it asked for, and what that came to.

CREATE TABLE IF NOT EXISTS public."KitOrder" (
  "id"        TEXT         NOT NULL,
  "clientId"  TEXT         NOT NULL,
  -- 1, 2, 3 … per business, so an owner reads "Order #003" and not a cuid.
  "number"    INTEGER      NOT NULL,
  -- RECEIVED is the only status this system can honestly claim. There is no
  -- printing, dispatch or delivery to observe, so there is nothing else to say.
  "status"    TEXT         NOT NULL DEFAULT 'RECEIVED',
  "itemsJson" TEXT         NOT NULL,
  -- Whole rupees. No tax line, no discount, no fractional currency anywhere in
  -- this product, so an integer is the honest type and no float touches money.
  "totalInr"  INTEGER      NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KitOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KitOrder_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES public."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One "Order #3" per business, not one in the whole installation.
CREATE UNIQUE INDEX IF NOT EXISTS "KitOrder_clientId_number_key"
  ON public."KitOrder" ("clientId", "number");

CREATE INDEX IF NOT EXISTS "KitOrder_clientId_createdAt_idx"
  ON public."KitOrder" ("clientId", "createdAt");


-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
--
-- The same shape as every other tenant table: the application role may read
-- and write, and row-level security decides WHICH rows, from the memberships
-- of whoever is asking. `repos_app` does not bypass RLS, so a request for
-- another business's orders returns no rows rather than their orders.
--
-- No sequence grant is needed — the id is a cuid from the application.

GRANT SELECT, INSERT, UPDATE, DELETE ON public."KitOrder" TO repos_app;

ALTER TABLE public."KitOrder" ENABLE ROW LEVEL SECURITY;
-- FORCE as well, so the table owner is not silently exempt and the invariant
-- the runtime-role test checks — every table enabled AND forced — still holds.
ALTER TABLE public."KitOrder" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public."KitOrder";
CREATE POLICY tenant_isolation ON public."KitOrder"
  USING ("clientId" IN (SELECT app.accessible_client_ids()))
  WITH CHECK ("clientId" IN (SELECT app.accessible_client_ids()));

-- The public customer-facing role must never see it. A customer scanning a QR
-- has no business knowing what the shop ordered or what it paid.
REVOKE ALL ON public."KitOrder" FROM repos_public;
