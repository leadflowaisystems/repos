# Headway client portal pass — September 2026 (M23)

The owner-facing workspace, audited sentence by sentence against one question:
does this help the owner understand, decide, act, verify, or come back? What
did not was removed, shortened, or moved behind a click. This document is the
record of that pass: what an owner saw before, what they see now, and where
each piece of copy went.

Every "before" line below was captured from the live code rendered against a
restored copy of the production database (Corner Cafe, 87 pieces of feedback,
one measured change), not from memory. Every "after" line was rendered the same
way after the change.

## 0. The backup that came first

`backups/prod-2026-09-07-010919/` (gitignored). Read-only against production:
pg_dump 17.6 in three formats, a per-table JSON snapshot taken in one
REPEATABLE READ, READ ONLY transaction with a server-side digest per table,
catalog snapshots (20 policies, 19 functions, all grants), Supabase Auth rows,
git HEAD `6cec910` (which was also the deployed production commit), and a
sha256 for every file. Verified by restoring twice into the local cluster:
every table matched its digest, and the repository's own runbook reproduced
the production schema exactly. The folder's `README.md` says how to restore.
The scripts now live in the repository as `scripts/backup-production.mjs` and
`scripts/verify-production-backup.mjs`.

## 1. Home

**Before.** 4,360 px tall on a phone. The decision card sat under the picture,
a two-figure strip (direction and public rating), and the since-last-visit
panel. Below the decision: the thing itself, four tiles (repeating the public
rating), "Going well", a five-line list of everything Headway did since the
check-in, "What Headway knows about your business" with a two-sentence footer,
"What changed", "Not worth your time right now" (a three-sentence paragraph),
and the full "What we cannot tell you yet" list.

**After.** 3,999 px, and in the order the brief asks for: Right now → Do I need
to do anything? / Headway is watching → Needs you → Going well → Since you
were last here (only when something happened) → the four tiles → What's next
(one progress line, the next-check condition, a link to Check-in) → What
Headway knows → limits behind one tap.

| Copy | What happened |
| --- | --- |
| "Public rating 3.6 — All 244 public reviews, not just the feedback we have read" in the strip under the picture | **Removed** from the strip. It was also the second tile. Said once now. |
| "Nothing else needs your attention first. 2 other topics were mentioned once or twice. Headway is not recommending action on any of these until more customers raise them." (section "Not worth your time right now") | **Removed.** The decision card already says "none of them needs you right now", and the below-floor topics are on Customers under "Not yet clear". |
| "What changed" aside (movement between check-ins) | **Removed** from Home. Check-in owns movement; the direction pill and the tiles carry the headline. |
| "Grouped them into 6 things…", "Compared your check-ins of…", "Compared the feedback before and after 1 change…", "Checked whether slow service is still coming up…" (five ✓ lines under "Your progress") | **Moved** to Check-in only. Home keeps the one line that carries the date ("Since your check-in on 28 Aug 2026, read 5 pieces of feedback…") plus "Next check." and a link. |
| "Headway keeps this apart from what customers said, and uses it to keep its suggestions practical. Tell your Headway contact if any of it is no longer true." | **Shortened** to "Tell your Headway contact if any of this changes." |
| "Tell your Headway contact which fits at your next check-in. It is kept on record for the recommendations that follow." (under the owner question) | **Shortened** to "Tell your Headway contact which fits." |
| "Marked ones are patterns — raised by 3 or more customers. The rest are mentions Headway is keeping an eye on, not conclusions." (under current signals) | **Moved** to Customers, which explains method. Home shows the chips under "Current signals, not conclusions". |
| "What we cannot tell you yet" list | **Progressive disclosure**: collapsed behind a summary on Home; open on Customers. |

## 2. Customers

| Copy | What happened |
| --- | --- |
| Title "Why Headway is saying this" | **Replaced** by "What your customers are telling you". The page answers that; the method sits at the bottom. |
| "What customers are mentioning so far / Current signals, not conclusions" | **Renamed** "Current signals / What customers are mentioning, pattern or not", with the one methodology sentence kept here. |
| "What Headway did with your feedback" (second section) | **Moved** to the end as "How Headway read this". Conclusions first, method last. |
| "Customers are telling you" | **Renamed** "In short". |
| "What customers love" / "Where the experience falls short" | **Renamed** "Strengths — Praised by three or more customers" / "Issues — Raised by three or more customers". The evidence floor is in the section note, once. |
| "Nothing has been praised often enough yet to name. We call something a strength once at least three customers have mentioned it." | **Shortened** to "Nothing praised by three or more customers yet." |
| "No complaint has come up often enough to name. That is good news, with one caveat: it only covers the feedback we have read." | **Shortened** to "No complaint has come up often enough to name, in the feedback read so far." |
| "Between your last two check-ins" showing "We need two check-ins before we can show you what changed." | **Hidden** until two check-ins exist. Check-in says it; Home's direction pill says it. |
| "Complaints that keep coming back" and "New complaints" as two sections, each with an empty-state sentence | **Merged** into "Across your check-ins" with one line when there is nothing. |

## 3. Reviews

Structure unchanged: the counts, the rating filters, "What Headway found in
them", then each comment with "Customer gave" beside "Headway understood".
The empty state "Once customers start scanning your QR code, each piece of
feedback appears here exactly as they gave it — the rating, what they tapped,
and their words — with what Headway made of it alongside." was **shortened**
to "Each piece of feedback appears here as the customer gave it, with what
Headway made of it alongside."

## 4. Improvements

| Copy | What happened |
| --- | --- |
| "What we cannot tell you: This does not show the change caused the difference. This compares feedback before and after the change. It cannot show that the change caused the difference — nothing RepOS can see would prove that." | **Deduplicated** to the one full sentence, and the internal product name frozen in the measurement JSON before the rename now renders as Headway (and `prisma/m23/backfill.sql` fixes the stored text). |
| "What we cannot tell you yet — A comparison shows how often a theme came up before and after a change. It cannot show that the change caused the difference." (page footer) | **Removed.** The same limit sits beside every reading. |
| "Nothing here yet. When you agree to act on something Headway suggested, it appears here, and once enough new feedback has come in we compare how often it comes up before and after the change." | **Shortened** to "Nothing here yet. When you act on something Headway suggested, this page remembers the change and compares the feedback before and after it." |

The story an owner reads is unchanged and now uninterrupted: The problem →
Headway suggested → You decided → Change made → Compared with feedback →
Before / After → What we know → What we cannot tell you → You told us → What
we recommend.

## 5. Check-in

**Added**, directly under the movement line: three labelled lines — **Do**
(the one thing that needs a decision, linked), **Protect** (the strength worth
keeping, with its count), **Watching** (what Headway will look at next). The
owner leaves with those three even if they read nothing else.

| Copy | What happened |
| --- | --- |
| "This does not show the change caused the difference." on every compact outcome row | **Removed** here; the full reading with its limit is one link away on Improvements. |
| "What we cannot tell you yet" list at the foot of the page | **Removed** (Customers carries it). |
| "What Headway will look at next" list | **Folded** into the Watching line; further items appear as "Also being watched". |
| "Nothing needs a decision from this check-in. The picture and the priorities are on Home." | **Shortened** to "Nothing needs a decision from this check-in." |

## 6. Print kit

| Copy | What happened |
| --- | --- |
| "The card that goes on your tables — One A4 sheet makes two. Each one folds down the middle into a standing card with your QR code on both sides, so a customer sees it whichever way they are facing." | **Replaced** by "Your feedback card — Put it where customers naturally see it. Every scan is a customer telling you how it went." |
| "How it goes together / Four steps, about a minute" with four two-sentence steps | **Renamed** "Print · Cut · Fold · Place / About a minute"; each step is one line ("One A4 sheet at 100%, on the heaviest paper you have. Not "fit to page"." / "Cut out both cards along the dashed borders." / "Fold each card once along its dotted line, printed sides out." / "Stand it up. No glue, no tape, no holder."). |
| "Download the PDF" / "Open in a new tab" | **Renamed** "Download print kit" / "Preview". The PDF frame is shown from tablet width up; on a phone the Preview button replaces it. |
| "When clearing the table, for every guest…" and the staff script (three languages) and the six "Never…" rules | **Moved** behind "Staff guidance", one disclosure. |
| "Offer it to everyone, the same way, whether or not the visit went well. The card asks the customer to tell you honestly — that is the whole point of it, and showing it only to happy customers would make the answers worthless." | **Shortened** to "Offer it to everyone, the same way, whatever kind of visit they had. Honest answers are the point." Said once. |

## 7. Account — rebuilt

**Before.** "Where this account stands — What Headway is doing for you right
now, and how to reach us about carrying on." Then "You are on a trial. There
is no end date set — talk to us whenever you are ready.", a "State: Trial"
row, and a section headed "What this costs" with a four-sentence explanation
of why there is no published price, three fields ("Who should we ask for",
"Email — Where we send what this costs and how to pay.", "Mobile or WhatsApp —
For anything quicker than email.") and a button "Request payment details".
Paused accounts got a five-sentence "What paused means" paragraph.

**After.** One headline, one sentence, then facts:

| State | Headline | Line |
| --- | --- | --- |
| Trial running | Your Headway trial | Your trial is active until 21 September 2026. |
| Trial ended | Your trial has ended | Your Headway workspace and history are still here. |
| Asked to continue | (as above) | Thanks. We've got your details. You asked to continue with Headway on 7 September 2026. We'll send the payment information and QR directly to you at … |
| Active | Headway is active | Your workspace is active. (+ "Headway has resumed reading new feedback." for two weeks after a resume) |
| Paused | Headway is paused | Your customer history is safe. New feedback will be kept, but Headway is not actively processing it right now. (+ "Paused since 4 September 2026.") |

"What Headway has done for you": feedback collected, read by Headway, the
strongest current signal with its count, and the one thing Headway needs the
owner for or is watching — each a link into the page that holds the evidence.
No invented number: with nothing collected the section says so in one line.

"Carrying on": "Ready to keep going?" (or "Want to carry on after the trial?"
while it runs), one sentence, and the gold button **Continue with Headway**.
The button opens three prefilled fields — your name, email, WhatsApp or mobile
number — and one press sends them. Staff see "The owner of this business can
continue from this page." Nothing on the page can reach the negotiated amount
or the operator's note: the page never imports them and the database returns
no `Commercial` row to an owner's connection (RLS, tested).

Removed outright: "What this costs", "There is no end date set", the pricing
explanation, "State", the trial start/end rows, "What paused means".

## 8. Trial, continuation, pause — the mechanics

* **Every trial has an end date.** `app.create_client` now opens the window
  when it creates the business (`trialStartsAt = now`, `trialEndsAt = now +
  default`). The default is 14 days; the operator changes it on Settings ("New
  trials") and it is stored as one `AppSetting` row, read by
  `app.trial_default_days()`, so no schema change is needed to change it.
  "Start a trial" on the operator's client page defaults to the same number.
* **Existing trials** (all six production businesses had no end date) get one
  from `prisma/m23/backfill.sql`: the configured default measured from the day
  it runs, so nobody is told a trial they did not know they had ended weeks
  ago. Until it runs, the page says "Your trial is active. Your Headway
  contact will confirm the end date." — never "no end date".
* **Continue with Headway** writes the owner's name, email and mobile plus a
  timestamp, and nothing else. The operator sees it on the client page
  ("Waiting on you → Details sent → Paid", with the contact details), at the
  top of the command centre ("Owners waiting to continue with Headway"), and
  as the client's next action ("Send payment details", ranked above
  everything else). The negotiated amount, cadence, payment instructions and
  note stay in the operator-only card.
* **Pause and resume** are stamped by `app.set_subscription`
  (`servicePausedAt`, `serviceResumedAt`, at most one set), so "paused since"
  and "resumed" are records. The workspace banner is one line ("Headway is
  paused. New feedback is kept but not read until the account is resumed.
  Account") instead of three sentences. Nothing is deleted or hidden.

## 9. The retention loop, as built

Customers speak (the card, the feedback page) → Headway understands (Reviews:
gave / understood) → the owner sees what matters (Home: Right now, the
decision card) → the owner acts (Improvements: You decided / Change made) →
Headway remembers (the frozen loop, "You told us") → new feedback arrives
(Since you were last here: "3 customers left feedback…") → Headway checks
("Headway checked … against the feedback that has come in since, and it got
worse") → the owner sees what changed (Check-in: Do / Protect / Watching) →
next thing to watch ("Next check. Not yet. 5 pieces of feedback have come in…
Headway will say when another check-in would show something new."). No
streaks, points, badges, countdowns or confetti anywhere; a source-level test
keeps it that way.

## 10. Other surfaces

* Login: "This tool is for the operator. Customers and business owners have
  their own links and do not sign in here." was untrue since M20 and is now
  "Your Headway workspace: what your customers are saying, and what to do
  about it."
* Team: the invitation helper is one sentence shorter; controls unchanged.
* Operator print kit: two stale placeholders said to "add the public review
  link" to get a QR; the QR is the feedback page, so they now say to set the
  address customers open.
* Feedback page, thank-you page, invitation, signup, tent PDF: audited, no
  change needed.

## 11. Mobile, desktop, accessibility

Rendered from the restored production copy and measured in the browser at
375, 390, 768 and 1366 px: no horizontal overflow on any page; one `h1` and
one `main` per page; every link, button, input, select and disclosure is at
least 44 px tall and wide (the one 15 px-wide link found on Account was fixed);
Home is 361 px shorter on a phone and the decision card moved up by the height
of the since-visit panel and the rating figure. Colour never carries meaning
alone (arrows and dots are `aria-hidden` beside words), disclosures are native
`<details>`, forms have labels and `aria-describedby` errors.

## 12. Tests, build, security

* Full suite: 69 files, 1,780 tests, both database roles (owner and
  `repos_app` with RLS enforced). New: `tests/m23.portal-pass.test.ts` (21)
  and `tests/m23.trial-rls.test.ts` (7): no "What this costs" / "no end date"
  anywhere owner-facing; a trial's end date is explicit; new businesses get
  14 days by default and honour the operator's setting (through the real
  `app.create_client`); the ended trial offers the continuation; the
  continuation captures name/email/mobile, creates no amount, and reaches the
  operator's board as the top action; an owner's connection cannot read the
  amount or the note; pause and resume are stamped and cannot be written by an
  owner; nothing historical is deleted; current signals stay on Home and the
  method stays on Customers, once; frozen measurement text reads as Headway.
* `tsc --noEmit` clean, `eslint .` clean (one pre-existing unused-variable
  error in an older test was fixed on the way).
* Cold `next build` in an isolated copy: success, 42 routes, first-load JS
  103–139 kB, unchanged; `prefetch={false}` rules intact; no new dependency.
* Security: no new privilege for `repos_app`; the two new columns are outside
  its UPDATE grant; the new function is SECURITY DEFINER for one admin-only
  row and returns a number; every new server action is in the authorization
  matrix (owner-level for the owner's two, admin for the setting); the public
  gateway is untouched.

## 13. The production cutover — applied 2026-09-07

All three files are **applied to production and verified**. What follows is the
record, including the two things that were wrong when this document was first
written.

**The command originally printed here was dangerous and has been corrected.**
It read `npx prisma db execute --file ... --schema prisma/schema.prisma`. With
`--schema`, Prisma takes the connection from the datasource block, which it
populates from `.env` — it never reads `.env.local`. `.env` in this repository
points at the LOCAL development cluster, so that command would have applied a
production migration to a dev database. It fails loudly today only because that
local port is dead. See "Applying SQL to production" in `prisma/m20/README.md`
for the mechanism that was actually used.

**The second correction: `--single-transaction` is load-bearing.** `rls.sql`
grants `repos_app` table-wide UPDATE at line 124 and narrows it back 174 lines
later, and drops every policy before re-creating it. Applied without a
transaction, a mid-file failure leaves either a committed privilege-escalation
window on `User.isPlatformAdmin`, or a table with RLS forced and zero policies,
which denies every row silently. `prisma db execute` offers no such flag.

What was actually run, per file, against the session pooler as the owner:

```bash
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m23/migration.sql
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m20/rls.sql
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m23/backfill.sql
```

Result: `ALTER TABLE` ×2, then 18 `CREATE FUNCTION` / 14 `DROP POLICY` /
11 `CREATE POLICY` / 13 `GRANT` / 13 `REVOKE` with no errors, then `UPDATE 6`
and `UPDATE 2`. Verified afterwards: 20 `app` functions, 20 policies, RLS
enabled and forced on all 17 tables, `repos_app` still not `BYPASSRLS` and
holding **no** UPDATE grant on either new column, all six trials ending exactly
14 days after the run with each start taken from `coalesce(onboardingDate,
createdAt)`, zero rows still carrying the internal name in `resultJson`, and
`app.set_subscription` proven to actually resolve the new columns by executing
it inside a transaction that was rolled back.

A pre-cutover backup (`backups/prod-2026-09-07-020939`) and a post-cutover
backup (`backups/prod-2026-09-07-123836`) were taken and diffed: every expected
M23 change present, and the only differences beyond them were ordinary live
traffic that arrived during the window — one customer's QR submission, one
`lastSeenAt` stamp, one sign-in.
