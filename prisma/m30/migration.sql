-- M30 — the daily AI tally, and the budget it makes possible.
--
-- ADDITIVE ONLY. One new table. Nothing is dropped, no column changes type, no
-- existing row is touched, and no feedback, token, trial date or client record
-- is read or written by this file. Running it twice is the same as running it
-- once.
--
-- Run as the OWNER, through DIRECT_DATABASE_URL. `repos_app` cannot create a
-- table and should not be able to.
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 \
--        -c "SET lock_timeout = '5s'" -f prisma/m30/migration.sql
--
-- (`prisma db execute` reads .env, which on a developer machine points at the
-- LOCAL cluster, so it is the wrong tool for reaching production. `-d` is not
-- optional: given a bare positional URI this psql ignores the `-c` after it.)
--
-- ORDER DOES NOT MATTER, and that is by design. Deploy first or run this
-- first, either way nothing breaks:
--
--   * OLD CODE + NEW TABLE — the table sits unread. Harmless.
--   * NEW CODE + NO TABLE  — every read of the counter fails, and
--     `aiBudget()` in src/lib/ai/budget.ts answers "no allowance left" when it
--     cannot read the tally. Headway then does what it does whenever AI is
--     unavailable: it reads everything deterministically. The portal is
--     complete, every number is unaffected, and the only cost is slightly
--     coarser tagging on ambiguous free text until this file is applied.
--
-- So this is safe to run at any time, and Headway is safe to deploy before it
-- is. It is NOT optional to run eventually: until it exists, the AI
-- enhancement is switched off.
--
--
-- WHAT THE TABLE IS FOR
--
-- Headway enforces its own daily AI budget rather than discovering the
-- provider's limit by being refused. One row per day, per provider, per model.
--
-- IT HOLDS NO CUSTOMER DATA. Not the text, not a client id, not an item id —
-- only which model was asked, how many tokens it cost, and whether it worked.
-- A usage counter must never become a second, quieter copy of what customers
-- wrote, so there is nothing here to leak and nothing to scope by tenant.

CREATE TABLE IF NOT EXISTS public."AiUsageDay" (
  "id"           TEXT         NOT NULL,
  "day"          TEXT         NOT NULL,
  "provider"     TEXT         NOT NULL,
  "model"        TEXT         NOT NULL,
  "requests"     INTEGER      NOT NULL DEFAULT 0,
  "inputTokens"  INTEGER      NOT NULL DEFAULT 0,
  "outputTokens" INTEGER      NOT NULL DEFAULT 0,
  "totalTokens"  INTEGER      NOT NULL DEFAULT 0,
  "failures"     INTEGER      NOT NULL DEFAULT 0,
  "fallbacks"    INTEGER      NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiUsageDay_pkey" PRIMARY KEY ("id")
);

-- The upsert key: one tally per day per model.
CREATE UNIQUE INDEX IF NOT EXISTS "AiUsageDay_day_provider_model_key"
  ON public."AiUsageDay" ("day", "provider", "model");

CREATE INDEX IF NOT EXISTS "AiUsageDay_day_idx"
  ON public."AiUsageDay" ("day");


-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
--
-- The application role reads the tally before an optional call and adds to it
-- afterwards. It never deletes: a spent allowance must not be clearable by the
-- thing spending it.
--
-- No sequence grant is needed — the id is a cuid from the application.

GRANT SELECT, INSERT, UPDATE ON public."AiUsageDay" TO repos_app;

-- Row Level Security is ENABLED with a permissive policy rather than left off,
-- so that `rowsecurity` is true for every table in this schema and an audit
-- never has to ask why one is different. There is nothing to scope: the table
-- holds no customer data and the budget is one allowance for the whole
-- installation, because the provider limit it stands in for is per key, not
-- per business.
ALTER TABLE public."AiUsageDay" ENABLE ROW LEVEL SECURITY;
-- FORCE as well, so the table owner is not silently exempt and the invariant
-- the runtime-role test checks — every table enabled AND forced — still holds.
ALTER TABLE public."AiUsageDay" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_app ON public."AiUsageDay";
CREATE POLICY ai_usage_app ON public."AiUsageDay"
  USING (true)
  WITH CHECK (true);

-- The public customer-facing role must never see it.
REVOKE ALL ON public."AiUsageDay" FROM repos_public;
