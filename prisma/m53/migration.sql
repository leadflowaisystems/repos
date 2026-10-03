-- M53 — the owner's own login is made by Headway, on the address Headway records.
--
-- NO SCHEMA CHANGE, AND NOTHING IS MOVED. Every table and column stays as M52
-- left it. The database side of M53 is entirely in `prisma/m20/rls.sql` (its
-- M53 block: a guard so only platform staff can re-point a handed-over
-- owner's login or rewrite their email, and `app.owner_email_taken` dropped).
--
-- Run ONCE, as the OWNER, through DIRECT_DATABASE_URL, in ONE transaction
-- AFTER `prisma/m20/rls.sql`, immediately BEFORE the M53 code goes live:
--
--   psql -X -d "<DIRECT_DATABASE_URL>" -v ON_ERROR_STOP=1 -1 -c "SET lock_timeout = '5s'" -f prisma/m20/rls.sql -f prisma/m53/migration.sql
--
-- After rls.sql, not before: by then its ALTER TABLE statements hold
-- "User" and "AccountAccess" exclusively until COMMIT, and the guard exists.
-- So nothing the old code (still serving for a minute or two) writes can slip
-- in unseen between this check and the guard: a write that committed first is
-- visible here (each statement reads afresh), and one still waiting meets the
-- guard once this commits. No extra lock is taken here — one taken early and
-- upgraded later in the same transaction can deadlock with live sign-ins.
--
-- WHY
--
-- Up to M52, "Set up your account" took an email AND a password from whoever
-- was signed in with the temporary login, and made the owner's permanent
-- login from them: whoever held the handover sheet first could make that
-- login their own. From M53 the admin types the owner's address when
-- generating temporary access, and the owner's own login is made then — on
-- that address, unconfirmed, with no password anybody knows. It works only
-- once somebody opens a link emailed to that address and chooses a password.
--
-- WHAT THIS FILE CHECKS
--
-- M53 must not inherit an own login that M52's setup made and nobody has
-- confirmed yet: its password was typed in a temporary session, by whoever
-- held the sheet, and confirming it would hand them a working permanent
-- login. Production had none when M53 was written; if one has appeared
-- since, this stops the whole transaction — rls.sql included — to be settled
-- by hand (delete that Supabase login and set the owner's "authProviderId"
-- to NULL; the admin then records the owner's email). Run once, before the
-- M53 code makes pending logins of its own. Test databases have no auth
-- schema and skip this.

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM public."AccountAccess" a
        JOIN public."User" u ON u.id = a."userId"
        JOIN auth.users au ON au.id::text = u."authProviderId"
       WHERE au.email_confirmed_at IS NULL
    ) THEN
      RAISE EXCEPTION 'M53: an owner with temporary access has an own login nobody has confirmed, made by the old setup. Nothing was changed; settle that row by hand first.';
    END IF;
  END IF;
END $$;
