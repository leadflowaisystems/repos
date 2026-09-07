# The service lifecycle pass — M28, September 2026

Trials end now. Before this, `trialEndsAt` was a date the product printed and
nothing acted on: a business whose trial had run out kept its whole workspace,
and the only lever was pause. This pass makes the stored date mean something —
and does it without letting the date itself move.

## 1. One function decides everything

`src/lib/lifecycle/service.ts`. Pure, no database handle, no settings lookup.
Given a business's own columns and an instant, it returns the state, whether the
workspace opens, whether the QR takes feedback, how many days are left and
whether to warn.

Seven states: `ACTIVE_TRIAL`, `ACTIVE_SERVICE`, `TRIAL_EXPIRED`,
`MANUALLY_LOCKED`, `ADMIN_OVERRIDE`, `FOUNDER_EXEMPT`, `DEMO_EXEMPT`.

Every surface reads it — the Account page, the server-side gate, the operator's
client list, the public QR — so none of them can disagree with another about
whether a trial has ended.

**Days are calendar days in Asia/Kolkata.** Subtracting instants gives "1.6
days", which rounds differently over one afternoon; an owner would watch the
number flicker while nothing changed. Days are counted as midnights crossed, in
the timezone every date in Headway is already printed in. India has no DST, so a
fixed +05:30 is exact.

**Expiry itself is an instant**, not a day: the workspace closes when the clock
passes the stored `trialEndsAt`. Only the QR grace is measured in calendar days.

## 2. The lock is server-side, and fail-closed

`requireOpenWorkspace` in `src/lib/lifecycle/access.ts`. Every protected page
calls it instead of `tenantGateFor`; when the workspace is shut it **redirects**
rather than returning a flag a page could forget to read, so there is no path
through it that renders content while locked.

Not in the layout — that file says itself that a layout is not a security
boundary in the App Router. Not in middleware — it runs at the edge with no
database, and Server Actions are POSTs addressed by an action id, not a path.

So the actions are gated too: `tenantGate` now refuses a locked tenant **by
default**, and the three that must keep working while shut opt out by name
(`requestContinuationAction`, `continueWithHeadwayAction`,
`updateOwnerContactAction`). An action that says nothing gets the lock.

`tests/m28.lifecycle-rls.test.ts` asserts mechanically that every workspace page
except Account calls the locking gate and that none still calls `tenantGateFor`.

## 3. The QR grace: three calendar days, then dark

Expiry on 1 October leaves the QR live on the 1st, 2nd and 3rd, and dark from
midnight IST starting the 4th. The workspace stays shut throughout — a customer
standing at a table is not party to a billing conversation.

Both public paths gate on one shared predicate, `app.service_qr_live`, because
they have always been a matched pair: a customer who can load the page must be
able to submit from it. The token never changes, and restoring service brings
the same token back.

A real card whose business has lapsed shows **"Feedback is temporarily
unavailable."** rather than a 404 — a 404 makes the *business* look broken to
its own customer. An unknown token still 404s, so nothing can be used to find
out which businesses exist, and no subscription state reaches the page.

## 4. The Account page answers seven questions

What am I on, when did it start, when does it end, how long is left, what
happens next, how do I continue, how do I reach Headway.

"19-day trial" is gone. It was the *length* when the reader wanted the
*remainder*. Now: **Trial started**, **Trial ends**, **Days remaining**,
**Status** — four labelled rows, each computed on the server from the business's
own stored dates. The page contains no date arithmetic and never reads the
installation-wide default.

Warnings at five days, and more plainly at two; Home says it only at two,
because a warning on every page every day for a week stops being read. A paying
or exempt business is never described as being on a trial.

## 5. Extend access means ASK

Phone required, email optional, no name field — the person is signed in and
Headway already knows which business is asking. Submitting writes one
`ServiceContinuationRequest` and does not extend the trial, move a date, open
the workspace or take a payment. A second press while a request is open returns
the same confirmation without writing anything.

## 6. What the platform can do, and what it cannot

`serviceLockedAt`, `accessOverrideAt`, `serviceExemption` — three nullable
columns, none of them in the `repos_app` UPDATE grant, all written only through
`app.set_service_access`, which asks the database whether the caller is platform
staff. **None of the six actions writes a trial date.** Lock and override are
mutually exclusive by construction. Each decision is recorded as a `DECISION`
Minute, which is the operator-facing record RepOS already keeps.

The demo exemption is a **column**, not a name match, because `businessName` is
owner-writable — an exemption anybody can award themselves by typing "Corner
Cafe" is not an exemption. The founder exemption is `User.isPlatformAdmin`, the
existing unforgeable authorization column, resolved server-side and never from a
form.

## 7. Shipping it — order matters

```
1. prisma/m28/migration.sql   against production, as the owner
2. deploy the code
```

**SQL first is safe**: the new columns sit unread by the old build, and the
replaced functions behave identically for every business whose trial has not
ended. **Code first is an outage**: the deployed Prisma client selects
`serviceLockedAt` from a table that does not have it, and every workspace page
and the operator's client list 500.

`prisma/m23/backfill.sql` is not part of this sequence and must not be run.

## 8. What changed

```
src/lib/lifecycle/service.ts         NEW. The pure decision, 29 unit tests.
src/lib/lifecycle/access.ts          NEW. The server-side door.
src/lib/lifecycle/admin.ts           NEW. The platform's four decisions.
src/lib/continuation/service.ts      NEW. Asking to carry on.
src/lib/actions/continuation.ts      NEW. Three server actions.
src/components/forms/extend-access-form.tsx  NEW.
prisma/m28/migration.sql             NEW. Additive: 3 columns, 1 table, 3 fns.
tests/m28.lifecycle-rls.test.ts      NEW. 30 tests under the real policies.
src/lib/auth/guard.ts                tenantGate refuses a locked tenant
src/lib/gateway/{service,store}.ts   the grace, and the unavailable message
prisma/m20/{rls,public-gateway}.sql  the same functions, for a fresh build
9 workspace pages                    onto requireOpenWorkspace
account/page.tsx                     the seven questions
clients/page.tsx, commercial-panel   the operator's view and controls
```

No existing trial date, QR token or feedback row is read or written by any of
it.
