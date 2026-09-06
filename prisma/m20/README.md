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
Supabase templates are per email type and cannot be set per send. The
invitation arrives as a Magic Link, and the business name, the role, the expiry
and the Accept button are on the RepOS page it opens. An owner who wants RepOS
wording in the mail itself pastes this into Authentication → Emails → Magic
Link; `{{ .Data.* }}` is populated by the invitation for exactly this purpose:

```html
<h2>You have been invited to a RepOS workspace</h2>
<p>You have been invited to join <strong>{{ .Data.repos_business }}</strong> as
   {{ .Data.repos_role }}.</p>
<p><a href="{{ .ConfirmationURL }}">Accept invitation</a></p>
<p>The link signs you in and opens the invitation. It expires in 7 days and
   works once. If you were not expecting this, ignore it — nothing happens
   until you accept.</p>
```

Ordinary sign-in also uses the Magic Link template, so wording it as an
invitation is a choice, not a requirement. RepOS reports what the provider
said: the Team page says "Invitation email sent" only when the message was
accepted, and otherwise says why and offers the link to send by hand.


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
