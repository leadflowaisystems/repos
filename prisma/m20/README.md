# M20 — PostgreSQL and Row Level Security artifacts

These files were written during the M20 move from a local-first SQLite
application to a multi-tenant SaaS on Supabase PostgreSQL. They are applied
by hand, once, against a database — none of them is read at build or run time.

## The authoritative schema is `prisma/schema.prisma`

Not anything in this folder.

`prisma/schema.prisma` is the only Prisma schema RepOS has. It is what
`prisma generate` builds the client from, what the test suite pushes into a
scratch schema per test file, and what was applied to the production Supabase
database in Stage 6A. It has **16 models**.

A second copy, `schema.postgres.prisma`, used to live here. It was a snapshot
taken in Stage 1, before Stage 2 deleted the app-owned credential path, so it
still declared `User.passwordHash` and a `PasswordResetToken` model — a
password store the product deliberately does not have, because Supabase Auth
is the only identity system. Nothing referenced it, and it was one careless
`--schema` flag away from recreating both in production. It was removed in
Stage 6C rather than refreshed: two schema files means one of them is wrong
eventually, and the second copy bought nothing.

If you need the historical Stage-1 shape, it is in git history at `2664bb0`.

## What is here

| File | What it is |
| --- | --- |
| `rls.sql` | The Row Level Security policies, helper functions in the `app` schema, the non-owner `repos_app` role, and the column privileges that close the platform-admin escalation path. Applied after the schema, by hand. |
| `public-gateway.sql` | The anonymous feedback gateway's database boundary: the privilege-less `repos_public` role and the two `SECURITY DEFINER` functions it may call. A customer scanning a QR code has no identity for RLS to filter on, so this gives them exactly two token-scoped operations instead of a table grant. |
| `tenant-isolation-attack.sql` | The adversarial test suite for the above: cross-tenant reads, writes, inserts and privilege escalation, each expected to fail. It **writes fixture rows**, so it runs against a disposable local database and never against production. |

## Applying them to a fresh database

Three steps, in this order, all as the OWNER over the session pooler. **A
database is not ready for production until all three have run.** They are not
alternatives and neither SQL file is optional:

* `rls.sql` is the AUTHENTICATED side — the policies, the `app.*` functions and
  the `repos_app` role every signed-in request uses. Without it the application
  has no tenant isolation, and signing up or creating a business fails outright.
* `public-gateway.sql` is the ANONYMOUS side — the privilege-less `repos_public`
  role and the two functions a customer scanning a QR code may call. Without it
  there is no `repos_public` to connect as, so `PUBLIC_DATABASE_URL` cannot be
  set, and in production RepOS refuses to serve the feedback page at all.

```bash
npx prisma db push --skip-generate                       # reads prisma/schema.prisma
psql -v ON_ERROR_STOP=1 -f prisma/m20/rls.sql            # connection from PG* env
psql -v ON_ERROR_STOP=1 -f prisma/m20/public-gateway.sql # connection from PG* env
```

Connect using `PGHOST` / `PGPORT` / `PGUSER` / `PGDATABASE`, or a password
file, rather than `psql -d "$DIRECT_DATABASE_URL"`. The shell expands that URL
before psql runs, which puts the owner's password into the process arguments —
the same leak the rotation section below exists to avoid.

`DIRECT_DATABASE_URL` is the session pooler (port 5432). The transaction
pooler on 6543 cannot hold the session a schema change needs.

There are no Prisma migration files in this repository; `db push` has been the
schema mechanism throughout.

### Then give both roles a password, and put them in the environment

Both files create their role with `LOGIN` and no password, so at this point
neither can connect to anything. Set both, out of band, with `\password` — the
next section explains why that command and nothing else:

```
\password repos_app
\password repos_public
```

Then put the two connection strings in `.env.local` (or the deployment's
environment), by pasting into an editor — never by assembling them in a shell,
which would put the password in the history:

| Variable | Role | Pooler | Why |
| --- | --- | --- | --- |
| `DATABASE_URL` | `repos_app` | 6543 (transaction) | Every authenticated request. Must NOT be the owner: RLS is the boundary, and an owner bypasses it. |
| `DIRECT_DATABASE_URL` | owner | 5432 (session) | Schema changes and these SQL files only. |
| `PUBLIC_DATABASE_URL` | `repos_public` | 6543 (transaction) | The anonymous feedback page. **Required in production** — with `NODE_ENV=production` and this unset, RepOS refuses to build the anonymous handle rather than quietly falling back to the application client, which would leave every operator screen healthy while every printed QR pointed at a page with no boundary. |

Verify the runtime role really is the non-owner one before calling it done:

```sql
SELECT current_user, rolsuper, rolbypassrls
  FROM pg_roles WHERE rolname = current_user;
```

`repos_app`, `false`, `false`. A fast application that secretly runs as the
owner is a failed deployment, not a working one.

## Re-applying to a database that already has them

`rls.sql` is written to be re-run. Every function is `CREATE OR REPLACE`, every
policy is dropped by name before it is created, `ENABLE`/`FORCE` and the grants
are idempotent, and the role is created only if it is missing. Re-running it
touches no rows and does not change a role's password.

```bash
psql -v ON_ERROR_STOP=1 -f prisma/m20/rls.sql          # connection from PG* env
```

**A database that had `rls.sql` applied before the blocker-clearing pass needs
this.** The file gained three functions:

* `app.provision_user` — signing up. Without it no account can be created.
* `app.create_client` — creating a business, self-service or operator-side.
* `app.set_client_commercials` — the `plan` and `status` columns, which
  `repos_app` deliberately holds no privilege on. Without it the operator's edit
  form, archive and restore are all refused.

Each has a direct fallback for a database that has not seen this file, and each
of those fallbacks is itself refused under `repos_app` — they exist for the test
suite, which owns its own tables, not as a working alternative in production.

Afterwards the `app` schema holds **15** functions with `public-gateway.sql`
applied, 13 without, and the policy count is unchanged at 19.

**A database that had `rls.sql` applied before the launch pass needs this
too.** The feedback pipeline now runs on its own — after a customer submits,
and whenever a workspace is opened with something waiting — and such a run has
no signed-in person to carry. The file gained one function and changed one:

* `app.service_client_id` — reads a second transaction-local setting,
  `app.service_client_id`, which the application sets to the ONE client a
  pipeline run may touch (`SELECT set_config('app.service_client_id', '<cuid>', TRUE)`).
* `app.accessible_client_ids` — honours that setting alongside a person's
  memberships. The scope is exactly as narrow as a membership and dies with
  the transaction; it is never taken from a URL.

Without them a pipeline run sees no rows and reads nothing (fail closed): new
feedback stays "being read" until the file is re-applied. Re-applying the whole
file is the supported way; the two statements are also safe to run alone.

Afterwards the `app` schema holds **16** functions with `public-gateway.sql`
applied, 14 without, and the policy count is unchanged at 19.


**A database from before M21 needs a schema change FIRST, and then this file.**
M21 added the commercial side and the record of a visit, and one of the tables
it introduces has to exist before `rls.sql` can protect it:

```bash
# See "Applying SQL to production" below. NOT `prisma db execute`, which reads
# .env and would aim these at the local development cluster.
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m21/migration.sql   # 1
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m20/rls.sql         # 2
```

Step 1 is purely additive — four nullable columns and one new table, every
statement guarded, nothing dropped and no row touched. Step 2 is the same
re-runnable file as always, and it is what switches Row Level Security on for
the new table, creates its policy, and grants it to `repos_app`.

**Run them in that order, and run the application only afterwards.** Between the
two, `Commercial` exists with no policy on it. Before step 1, the deployed code
asks for columns the database does not have, and the owner's Home page and the
operator's client page both fail.

The file gained three functions and one policy:

* `app.set_subscription` — the subscription and the trial window, which move
  together because they are one decision. `repos_app` holds no privilege on
  `subscriptionStatus`, `trialStartsAt` or `trialEndsAt`, so this is the only
  way through, and it refuses anyone who is not platform staff.
* `app.touch_membership` — one column, `lastSeenAt`, on the caller's own
  membership. `membership_write` asks for BUSINESS_OWNER, so a staff member
  could not stamp their own row; widening that policy would also have let them
  edit their own role.
* `app.invitation_preview` — what an invitee may be told before they accept.
  Answers for the signed-in account whose email the invitation names, and for
  nobody else, so the invitation page can carry the business, the role and the
  expiry above a real Accept button.
* `commercial_admin_only` — the one policy in the file that asks
  `app.is_platform_admin()` rather than for membership. A business owner's
  connection returns no rows from `Commercial` at all.

Afterwards there are **17** tables with RLS enabled and forced, **20** policies,
and the `app` schema holds **19** functions with `public-gateway.sql` applied,
17 without.


**A database from before M23 needs a schema change FIRST, then this file, then
a backfill.** M23 rebuilt the owner's Account page around two facts the
database has to hold: every trial has an end date, and a pause and a resume are
recorded when they happen.

```bash
# See "Applying SQL to production" below. NOT `prisma db execute`, which reads
# .env and would aim these at the local development cluster.
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m23/migration.sql   # 1
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m20/rls.sql         # 2
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m23/backfill.sql    # 3
```

**Verify between steps 1 and 2, every time.** `rls.sql` re-creates
`app.set_subscription`, whose body writes `servicePausedAt`. plpgsql only
raw-parses a body at creation and binds names at first execution, so if step 1
did not land, step 2 still commits with a zero exit status and the function is
silently broken until somebody pauses an account. Step 1's own
`ADD COLUMN IF NOT EXISTS` is equally quiet about whether it did anything. So
prove it, rather than trusting the exit code:

```sql
SELECT count(*) FROM information_schema.columns
 WHERE table_schema='public' AND table_name='Client'
   AND column_name IN ('servicePausedAt','serviceResumedAt');   -- must be 2
```

and after step 3, force the plan to build inside a transaction you roll back —
this is the only thing that proves the function actually resolves:

```sql
BEGIN;
SELECT set_config('app.user_id', '<a platform admin User.id>', true);
SELECT app.set_subscription('<a real client id>', 'PAUSED', NULL, NULL, now()::text);
ROLLBACK;
```

Step 1 adds two nullable columns to `Client` (`servicePausedAt`,
`serviceResumedAt`), guarded, nothing dropped. Step 2 is the same re-runnable
file as always. Step 3 gives every existing trial that has no end date one —
the configured default, measured from the day it runs — and replaces the
internal product name in measurement text frozen before the rename. Both
statements only touch rows that need it, so a second run changes nothing.

**Run them in that order, and deploy the M23 code only afterwards.** The
deployed code reads the two new columns on every owner's Account page and on
Home's layout; before step 1 it fails the way M21 did.

The file gained one function and changed two:

* `app.trial_default_days` — how long a new trial runs. Reads one `AppSetting`
  row, key `trial.default_days`, set from the operator's Settings page, and
  returns the product default for anything missing or malformed — **30 since
  M27**, 14 when M23 shipped. SECURITY DEFINER because `AppSetting` is
  admin-only and the function is called on the signup path. The fallback must
  stay equal to `DEFAULT_TRIAL_DAYS` in `src/lib/commercial/service.ts`; see
  `prisma/m27/migration.sql`, which is how an already-built database is moved
  forward without replaying this whole file.
* `app.create_client` — now opens the trial window it always should have:
  `trialStartsAt = now`, `trialEndsAt = now + trial_default_days()`. Same
  signature, so an older deployment keeps working against the new function.
* `app.set_subscription` — stamps `servicePausedAt` on the move into PAUSED or
  CANCELLED and `serviceResumedAt` on the move back out, clearing the other, so
  at most one is ever set. Same signature.

Afterwards there are still **17** tables with RLS enabled and forced, **20**
policies, and the `app` schema holds **20** functions with
`public-gateway.sql` applied, 18 without.


**A database from before M38 needs one more policy, and this file carries it.**
The Team page joins Membership to User for each member's name and email, and
`user_self_or_admin` — the only policy on `User` — let a person read one row
of it: their own. For an owner who is not Headway staff and whose business has
a second member, the join answered nothing and Prisma threw (the relation is
required), so the page failed. It never showed to a platform admin, who reads
every row. Either of these puts it right; the first is the incremental one:

```bash
# See "Applying SQL to production" below.
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m38/migration.sql   # 1
# or re-apply the whole file, which now carries the same function and policy:
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m20/rls.sql
```

Order does not matter against the deployed code: the Team query is unchanged,
so the policy fixes the live build the moment it lands. Verify it landed:

```sql
SELECT count(*) FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'User'
   AND policyname = 'user_colleague_read';   -- must be 1
```

The file gained one function and one policy:

* `app.colleague_user_ids` — the ids of everyone holding a membership, active
  or suspended, in a business where the CALLER holds an active one. SECURITY
  DEFINER like `app.owned_client_ids`; keyed on `app.current_user_id()` alone,
  so a pipeline run and a signed-out connection get nobody.
* `user_colleague_read` — SELECT only, on `User`: a person may read the rows
  of their colleagues. Writing a User row is still `user_self_or_admin`, and
  the column grants below it are untouched. Asserted as `repos_app` in
  `tests/m38.team-rls.test.ts`: owner with two members, ordinary member,
  unrelated tenant, platform admin, no identity.

Afterwards there are **20** tables with RLS enabled and forced, **24**
policies, and the `app` schema holds one more function than before.

## Applying SQL to production

**Never `npx prisma db execute` against production. It aims at the wrong
database.** With `--schema`, the connection comes from the datasource block,
which reads `DATABASE_URL` and `DIRECT_DATABASE_URL` — and the Prisma CLI
populates those from `.env`. It has no knowledge of `.env.local` at all. `.env`
in this repository points at the LOCAL development cluster, so that command
targets a developer's scratch database while appearing to do the right thing.
It fails loudly today only because the port in `.env` happens to be dead; point
`.env` at a cluster that is running and the same command would apply a
production migration to a dev database and report success. The same trap is
written up in `scripts/backup-production.mjs`, which was bitten by it.

`npx` is a second hazard on its own: from outside the repository root it
resolves a *published* Prisma rather than the pinned 6.19.3 in `node_modules`,
which is how a phantom 8.0.0-rc.13 with no `db execute` subcommand appeared
during the M23 cutover.

Use `psql`, which is what the top of this file has always prescribed, with four
things set:

| | Why |
| --- | --- |
| the **17.x** client | `C:/Program Files/pgAdmin 4/runtime/psql.exe` on this machine. The one on PATH is 16.8, which does not match the 17.6 server. |
| `-1` (`--single-transaction`) | **Load-bearing for `rls.sql`, not tidiness.** That file issues a blanket table-level `GRANT ... UPDATE ... TO repos_app` and only narrows it back 61–174 lines later, and it DROPs each policy before re-CREATEing it. Run without a transaction, a failure part-way leaves either a committed window where the runtime role can update `User.isPlatformAdmin`, or a table with RLS forced and zero policies — which denies every row, silently. |
| `-v ON_ERROR_STOP=1` | Without it psql keeps going after an error and exits 0. |
| `SET lock_timeout` | Every `ALTER TABLE` and `CREATE POLICY` takes an ACCESS EXCLUSIVE lock, and under `-1` `rls.sql` holds them on all 17 tables until COMMIT. Acquiring is instant; *waiting* is not, and while it waits every query on those tables queues behind it. With a timeout the worst case is a clean abort and whole-file rollback you retry. |

`PGOPTIONS='-c lock_timeout=...'` does **not** work here — Supavisor rewrites
the startup packet and drops it (you can see it do so: `application_name` comes
back as `Supavisor`). Pass it as a statement instead, which psql runs before the
file and which holds for the rest of the transaction:

```bash
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f <file>
```

Supply the connection through `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` /
`PGDATABASE` / `PGSSLMODE=require` in the environment, never on the command
line — and read the password from `.env.local` programmatically rather than
typing it, so it reaches neither argv nor shell history. Port must be **5432**,
the session pooler; the 6543 transaction pooler cannot hold the session a schema
change needs.


## Taking a full backup of production

There is no `pg_dump` in this repository's toolchain by default, and the one
installed with PostgreSQL 16 refuses a PostgreSQL 17 server. pgAdmin ships a
17.x client. `scripts/backup-production.mjs` takes a read-only backup — a
REPEATABLE READ, READ ONLY per-table JSON snapshot with server-side digests,
catalog snapshots, and `pg_dump` in three formats — into `backups/prod-<stamp>/`
with a manifest of sha256s, and `scripts/verify-production-backup.mjs` restores
it twice into the local test cluster and compares digests and catalogs. Both
read `DIRECT_DATABASE_URL` from `.env.local` and print neither it nor any
password. See the README each backup folder carries for how to restore.


## Invitation email — what Supabase has to be told

RepOS sends the team invitation itself, from `src/lib/invite/email.ts`, through
Supabase Auth with the anon key the application already holds. There is no SMTP
setting in this repository, no service-role key and no email dependency: the
compliance suite bans a second outbound caller in `src/` and bans `nodemailer`
and `smtp.` outright, so Supabase Auth is the one sanctioned transport.

Two things live in the Supabase dashboard rather than here.

**1. The redirect must be allowed.** Authentication → URL Configuration →
Redirect URLs must include the production callback:

```
https://<your-domain>/auth/callback
```

Without it Supabase still sends the mail, but the link lands on the project's
Site URL instead of the invitation.

**2. Delivery, at volume.** The built-in email service is documented as
test-only and is rate-limited to a couple of messages an hour. An owner who
will invite more than that should set a custom SMTP server under
Authentication → Emails → SMTP Settings. Nothing in RepOS changes; the same
call goes out through their server instead.

**The wording.** The message body is the project's own template, not RepOS's —
Supabase templates are per email type and per project and cannot be supplied per
send. RepOS controls the link and the page it opens; the body is the project's,
so the wording ships in this directory as something to paste once.

Paste `prisma/m20/invitation-email.html` into Authentication → Emails, into
**both** templates:

| Template | Who receives it |
| --- | --- |
| **Confirm signup** | a first-time invitee, who has no Supabase account yet |
| **Magic Link** | somebody who already has an account |

Both carry `{{ .ConfirmationURL }}`, and both are populated with
`{{ .Data.repos_business }}` and `{{ .Data.repos_role }}` by `deliverInvitation`.
Ordinary sign-in also uses the Magic Link template and sets neither, so the copy
is written to read correctly with those fields empty.

**This was measured, not assumed.** An invitation was sent to a disposable inbox
with a public API and the message was fetched back:

```
supabase /auth/v1/otp        -> 200
arrived                      -> yes, 7 seconds later
from                         -> Supabase Auth <noreply@mail.app.supabase.io>
subject                      -> "Confirm your email address"   (type=signup)
link                         -> https://<domain>/auth/callback?next=%2Finvite%2F<token>
```

Two things follow. The transport works end to end and the link is correct, so
"Invitation email sent" on the Team page is a true statement. And the untouched
templates are Supabase's, which is why the copy above has to be pasted before
this reads as a RepOS invitation rather than a confirmation notice.

RepOS reports what the provider said: the Team page says "Invitation email sent"
only when the message was accepted, and otherwise says why and offers the link
to send by hand.


## The printed table tent

`GET /print/tent/<clientId>` returns a PDF: one A4 sheet, two cards, each
folding once down the middle into a 6in × 2in tent. It is generated by
`src/lib/kit/{pdf,tent}.ts` with no dependency — base-14 Helvetica, the QR as
vector rectangles — so the bytes are reproducible and the geometry is asserted
in `tests/m21.tent-pdf.test.ts` rather than eyeballed.

It refuses with 409 rather than printing a QR that opens nothing when
`REPOS_PUBLIC_BASE_URL` is unset, which is the same rule the HTML print pages
follow.


## Setting a role's password — never on a command line

Both `rls.sql` and `public-gateway.sql` create their role with `LOGIN` and **no
password**. That is deliberate. A password written into either file is a
password in the repository, and these files are committed; a default that works
is worse than no default, because the installation that never changes it is
authenticated by a string anyone can read. A `LOGIN` role with no password
cannot authenticate at all under password authentication, so the failure mode
is a refused connection, never one that succeeds for a stranger.

So the password is set out of band, once, by a person. Use `psql`'s `\password`
command and nothing else.

First connect. Note that `psql -d "$DIRECT_DATABASE_URL"` expands the URL into
this process's argument list, which puts the **owner's** password where `ps` and
Task Manager can read it. On a single-user workstation that is a small thing; to
avoid it entirely, put the connection in a password file, which psql reads on
its own:

```
# %APPDATA%\postgresql\pgpass.conf   (Windows)     ~/.pgpass   (Unix, chmod 600)
# hostname:port:database:username:password
aws-0-<region>.pooler.supabase.com:5432:postgres:postgres.<project-ref>:<owner-password>
```

```bash
psql -h aws-0-<region>.pooler.supabase.com -p 5432 -U "postgres.<project-ref>" -d postgres
```

Then, at the psql prompt:

```
\password repos_app
```

`\password` prompts twice with the input hidden, hashes the value locally, and
sends the `ALTER ROLE` already encrypted. The cleartext never reaches the
command line, the shell history, psql's own history, or the server log. Then
`\q`.

What NOT to do, and why each one leaks:

| Tempting | What it leaks |
| --- | --- |
| `psql -c "ALTER ROLE repos_app PASSWORD '...'"` | argv — visible to every process on the machine, and in shell history |
| `psql -d "$DATABASE_URL"` (any URL with an embedded password) | argv — the shell expands it before psql runs, so the password is in the process arguments |
| `ALTER ROLE ... PASSWORD '...'` typed at the psql prompt | psql's `~/.psql_history`, and the server log if statement logging is on |
| `PASSWORD '...'` added back into a `.sql` file | the repository, permanently, including after it is deleted |
| The Supabase dashboard SQL editor | the query is stored and shown in the editor's history |
| `openssl rand ... \| tee` or any `echo` of the value | terminal scrollback, and often the shell history too |

Generate the value the same way: in the password manager that will store it, or
with a generator that writes straight to the clipboard. Do not print it.

To put it into `.env.local`, open that file in an editor and paste. Do not
construct the connection string with a shell command — the assembled URL would
land in history with the password embedded in it.

`.env.local` is git-ignored and must stay that way. `.env.example` holds
placeholders only and must never receive a real value.

## If a role password is ever exposed

Treat it as compromised the moment it is written anywhere it can be read again
— a commit, a log, a screenshot, a chat message — regardless of whether anyone
used it, whether the repository is private, whether Row Level Security would
have limited it, and whether anything is connected as that role. None of those
is a mitigation; they only bound the damage. The response is rotation.

1. Rotate with `\password`, as above. This invalidates the old value the moment
   it commits — PostgreSQL stores one password per role.
2. Remove the literal from the working tree, and check that no other tracked
   file, script, or document still carries it.
3. Update `.env.local` for whatever connects as that role. Until the runtime
   cutover, nothing does: the application still connects as the owner, so
   rotation cannot interrupt anything.
4. Decide separately about git history. Removing the literal from the tip does
   not remove it from the commits that carried it, and a rewrite is only worth
   it while the exposure window is still open. Once rotated, the old value is
   inert, and rewriting published history costs every clone a reset.
