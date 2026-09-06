-- M23 — data, applied AFTER prisma/m23/migration.sql and AFTER prisma/m20/rls.sql.
--
-- Two corrections to rows that exist today. Both are guarded so that a second
-- run changes nothing, and neither deletes anything.
--
-- 1. EVERY TRIAL GETS AN END DATE.
--
--    Before M23 a business on a trial could have no trial dates at all, and the
--    Account page told its owner "there is no end date set". New businesses now
--    start with a window (see app.create_client); this gives the same to the
--    ones already here. The start is the earliest fact we hold about the
--    relationship; the end is the configured default measured from NOW, not
--    from that start -- an existing owner who gets told, on the day this runs,
--    that their trial ended three weeks ago has been given a deadline rather
--    than a trial. The operator can shorten or extend it from the client page.
--
--    Only trials with no end date. A trial the operator has already given a
--    window, a paying account, a paused one and an archived business are all
--    left exactly as they are.

UPDATE public."Client"
   SET "trialStartsAt" = coalesce("trialStartsAt", "onboardingDate", "createdAt"),
       "trialEndsAt"   = now() + make_interval(days => app.trial_default_days()),
       "updatedAt"     = now()
 WHERE "subscriptionStatus" = 'TRIAL'
   AND "trialEndsAt" IS NULL
   AND "archivedAt" IS NULL;

-- 2. FROZEN TEXT WRITTEN BEFORE THE RENAME.
--
--    An improvement's measurement is frozen as JSON when it is taken, on
--    purpose: a later engine must not rewrite history. The wording frozen
--    before the Headway rename still carries the internal product name, and an
--    owner reads it on the Improvements page ("nothing RepOS can see would
--    prove that"). The application now substitutes the brand when it renders
--    frozen text; this makes the stored copy match. No number, date or
--    structure in the JSON changes -- only the one word.

UPDATE public."ImprovementAction"
   SET "resultJson"         = replace("resultJson", 'RepOS', 'Headway'),
       "insightHeadline"    = replace("insightHeadline", 'RepOS', 'Headway'),
       "insightDetail"      = replace("insightDetail", 'RepOS', 'Headway'),
       "recommendationText" = replace("recommendationText", 'RepOS', 'Headway'),
       "updatedAt"          = now()
 WHERE "resultJson" LIKE '%RepOS%'
    OR "insightHeadline" LIKE '%RepOS%'
    OR "insightDetail" LIKE '%RepOS%'
    OR "recommendationText" LIKE '%RepOS%';
