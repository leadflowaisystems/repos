# The trial length pass — M27, September 2026

One number moves: a new trial runs for **30 days** instead of 14. The operator
was always able to change it from Settings; what changes here is what the
product says when they have not.

Everything else in this document is about the businesses that do **not** move.

## 1. What the operator sees

Nothing new. The Settings page keeps the card M23 built, and the card is the
whole feature:

> **New trials** — `30 DAYS`
>
> Every business starts on a trial with an end date. This is how long that
> trial runs unless you change it for one client.
>
> **Trial length, in days** — `[ 30 ]`
> Whole days, between 1 and 365. New businesses start on a trial of this length.
>
> `[ Save ]`
>
> Applies to trials started from now on. Existing trials keep their dates.

The badge is rendered from the stored value (`{trialDays} DAYS`, and the page
is `force-dynamic`), so it reads back whatever was last saved. Saving uses the
same feedback as every other form in RepOS: one `Notice` banner from
`ActionForm`, green on success ("New trials run for 30 days."), red with an
inline field error under the input when the number is refused.

## 2. Where the number lives

Two places, in two languages, and they have to agree:

| | |
|---|---|
| `DEFAULT_TRIAL_DAYS` | `src/lib/commercial/service.ts` |
| the fallback in `app.trial_default_days()` | `prisma/m20/rls.sql`, shipped to an existing database as `prisma/m27/migration.sql` |

Both exist because a trial can start from either side. Under the real policies
a signup or an operator-added business goes through `app.create_client`, which
calls the SQL function; the TypeScript constant is what Settings displays and
what the no-DDL fallbacks use. If only one of them had moved, production would
have kept handing out 14 days while the suite went green — so
`tests/m27.trial-length.test.ts` asserts the two are equal, as its first test.

There is a third copy, and it is the one production actually receives:
`prisma/m27/migration.sql`. The RLS harness applies `rls.sql`, so the first test
pins *that* file to TypeScript, and production never replays it. A second test
therefore compares the function text in `migration.sql` against the text in
`rls.sql` character for character, so a typo in the file nobody executes cannot
ship behind a green run.

The operator's own value still wins over both. The fallback is the product's
opinion, not an override.

## 3. Why no existing business moves

Not because anything guards against it. Because there is nothing to guard.

The configured length is read at exactly **one moment** — when a trial starts —
and what is written is a date:

* `app.create_client` (`prisma/m20/rls.sql`): `v_days := app.trial_default_days()`
  once, then `trialEndsAt = v_now + make_interval(days => v_days)` in the INSERT.
* `startTrial` (`src/lib/commercial/service.ts`): `getTrialDefaultDays(db)` only
  when the operator gave no length, then `trialWindowFrom(now, days)`.

After that the business carries its own `trialStartsAt` / `trialEndsAt`, and
**nothing recomputes them**:

* `describeAccount` is a pure function that takes no database handle at all, so
  it structurally cannot read the setting. Days remaining, expired-or-not and
  the sentence the owner reads all come from the row.
* `extendTrial` extends from the stored end date, never from the default.
* The Account page's "15-day trial" label is derived from the client's two
  stored columns, so a business that started on 15 keeps reading 15 forever.
* The operator's board (`trial_ending` / `trial_ended` signals) reads
  `trialEndsAt` off each row.
* `repos_app` holds **no** UPDATE privilege on `trialStartsAt` or `trialEndsAt`.
  Only `app.set_subscription` can move them, and it demands a platform admin.

There was **one** path where it was not true, and this pass closed it. The
operator's client page has two buttons that look alike and mean opposite
things, and both prefilled their day box from the same number: "Start a trial"
(correct — it starts a new one) and "Extend the trial" (not correct — it adds
to a business that already has dates). Moving the default from 14 to 30 would
have silently doubled what one default-accepting click does to a live client,
two weeks before the operator is due to reach for that button. Worse, it would
not have been cleanly reversible: there is no "shorten the trial", and
restarting one rewrites `trialStartsAt`, the column this pass exists to
protect. So the extend box now has its own constant, `EXTEND_TRIAL_DAYS = 14`
— what that button has always offered — and Settings cannot reach it.

So the operator can change the number as often as they like, and the only
businesses affected are the ones that do not exist yet.

**The one file that would break this is `prisma/m23/backfill.sql`.** It sets
`trialEndsAt = now() + make_interval(days => app.trial_default_days())` for
trials with no end date. It is a spent, one-shot file: it already ran, no
production row has a NULL `trialEndsAt`, and its `trialEndsAt IS NULL` guard
means a re-run would change nothing today. It is not part of this pass and
must not be re-run.

## 4. Who may change it

Twice, independently.

* **The action** — `saveTrialDefaultDaysAction` opens with `await adminGate()`,
  which takes no arguments at all, so there is nothing client-supplied to
  trust. `tests/compliance.test.ts` mechanically pins it to `ADMIN` and
  requires the gate to be the first statement.
* **The database** — `AppSetting` carries `ENABLE` + `FORCE ROW LEVEL SECURITY`
  and one policy, `settings_admin_only`, `USING`/`WITH CHECK
  app.is_platform_admin()`. A business owner's connection reads zero rows and
  its write is refused with `42501`. The test calls the service directly, with
  no `adminGate` in front of it, and asserts the SQLSTATE — and then reads the
  stored value back through the owner handle anyway, because an UPDATE the
  policy hides matches zero rows and raises nothing, so "no error" would never
  have been evidence of "no write".

Neither may be removed on the grounds that the other exists. Server actions are
addressed by an internal action id, not by page path, so the operator-only
layout does not gate this call.

## 5. Shipping it — order matters

```
1. prisma/m27/migration.sql   against production, as the owner
2. deploy the code
```

The two orderings are not symmetric.

**SQL first is safe.** `app.create_client` starts giving 30 straight away, and
the only cost is that the Settings badge — rendered by the old build, which
still reads `DEFAULT_TRIAL_DAYS = 14` while `AppSetting` is empty — says 14
until the deploy lands. A wrong number on a screen for a few minutes.

**Code first is not**, and the damage is permanent. In that window Settings says
30 while `app.create_client` still returns 14, so a business that signs up gets
`trialEndsAt = now + 14 days` written into its row — and by the whole design of
this pass, nothing recomputes it. Applying the SQL afterwards does not go back
and fix that business, and must not. There is no error and no log line; the
signup succeeds and records the old number. The only remedy is the operator
noticing and pressing "Start a trial".

**If the code has already shipped**, the gap closes without psql: open Settings,
put 30 in "Trial length, in days", press Save. That writes the
`trial.default_days` row, and `app.trial_default_days()` reads that row *before*
it reaches its fallback — so even the old 14-returning function then answers 30.
Apply `prisma/m27/migration.sql` afterwards anyway, to correct the fallback for
the day somebody deletes that row.

`prisma/m23/backfill.sql` is **not** part of this sequence and must not be run.

## 6. What changed

```
src/lib/commercial/service.ts        DEFAULT_TRIAL_DAYS 14 -> 30, and the notes
                                     recording why nothing else needed to move
src/lib/commercial/service.ts        NEW EXTEND_TRIAL_DAYS = 14, so the extend
                                     box stops following the Settings default
src/components/forms/commercial-panel.tsx   extend button reads the new prop
src/app/(app)/clients/[id]/page.tsx  passes it
src/lib/onboarding/service.ts        one stale comment
prisma/m20/rls.sql                   app.trial_default_days() fallback 14 -> 30
prisma/m27/migration.sql             NEW. The same function, for a database that
                                     already exists. No schema change, no row
                                     written, re-runnable.
tests/m27.trial-length.test.ts       NEW. 21 tests under the real policies.
tests/m23.portal-pass.test.ts        expectations follow the new default
tests/m23.trial-rls.test.ts          expectations follow the new default
prisma/m20/README.md                 the function's documented fallback
docs/PORTAL_PASS_2026-09.md          a pointer to this pass
```

No schema change: no column, table, index, constraint or policy is touched, and
the migration writes no row. It does restate the two privilege lines that
`rls.sql` already establishes for this one function (`REVOKE ALL ... FROM
PUBLIC`, `GRANT EXECUTE ... TO repos_app`) so that it is also correct on a
database creating the function rather than replacing it — no-ops against
production, but they are privilege statements and worth naming. That `GRANT` is
the one line that can fail: it names `repos_app`, which `rls.sql` creates, so
the file requires an already-built database.

## 7. What this pass did NOT build

The brief that prompted it also described a service lifecycle: an Account
warning at 5 days remaining, a Home and Account warning at 2 days, a workspace
lock at expiry, a QR that stays live for exactly 3 calendar days after expiry
and then goes inactive, an admin manual lock/unlock, and permanent exemptions
for the founder's account and for Corner Cafe.

**Six of those seven do not exist in RepOS**, and this pass did not add them.
What exists today:

* **Warnings** — none owner-facing at any threshold. The operator's board has
  `trial_ending` at **3** days and `trial_ended` at 0
  (`src/lib/command/priority.ts`). The Account page prints the end date with no
  warning tone. `trialLine()` in `src/lib/portal/focus.ts` is written but has
  no callers.
* **Workspace lock at expiry** — does not exist. The workspace layout selects
  only `subscriptionStatus` and draws a banner for PAUSED/CANCELLED; a lapsed
  trial changes nothing. There is no `lockedAt` / `isLocked` / `trialExempt`
  column.
* **QR grace** — does not exist, and is contradicted in writing. Both QR paths
  (`src/lib/gateway/store.ts` and `app.public_gateway`) gate on `enabled` and
  `archivedAt` only. RepOS states as a design rule that a paused account keeps
  collecting, because "a customer standing at a table is not party to a billing
  conversation and should never meet a dead page because of one". Switching the
  QR off after a trial reverses that rule and needs deciding, not adding.
* **Manual lock/unlock** — the nearest thing is pause/resume, which is admin
  only. The QR's own on/off switch is gated `tenantGate(form, 'OWNER')`, so
  reusing it as the lock would hand a locked-out owner the unlock button.
* **Exemptions** — there is no exemption mechanism of any kind. The address
  `omnaarkar2673@gmail.com` appears nowhere in the repository; production's
  platform admin is `0mnaarkar2673@gmail.com` (a leading zero). Corner Cafe is
  an ordinary business with an ordinary trial, and exists in the repo only as
  demo content.

The requirement this pass *is* responsible for holds for both named accounts,
and is tested: changing the installation default cannot reach the founder's
account (a platform admin is a `User` and carries no trial at all) or Corner
Cafe (a business whose dates are its own) — exactly as it cannot reach anybody
else.
