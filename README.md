# RepOS

Local-first operating system for a done-for-you Customer Intelligence service
for local SMBs.

**RepOS is a Customer Feedback → Business Improvement System.** The promise it
makes to a business owner is:

> Know what your customers really think. Fix what matters. See whether it
> actually improved.

It is not a review-management product. The customer voice it works from is
private feedback left through the business's own QR card, and everything —
the reading, the grouping, the recommendation, the before-and-after — works
for a business with no public listing, no Google account and no intention of
getting either. A public review link is optional, offered to every customer
*after* they have already had their say, and RepOS never fetches it, posts to
it, or lets it change a single conclusion.

Three people touch it, and only one of them signs in:

| | How they get in | What they see |
| --- | --- | --- |
| **You**, the operator | your password | everything |
| **The business owner** | one secret link per business | that business's own view, read-only |
| **A customer** | the QR on the card | one page where they can say something, anonymously |

- [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) — what this is and what it is not
- [COMPLIANCE.md](COMPLIANCE.md) — the hard rules and how each is enforced
- [DEFERRED.md](DEFERRED.md) — what was deliberately left out

## Where the data lives

RepOS ran on a local SQLite file through M19. Since M20 it runs on
**Supabase PostgreSQL**, with **Supabase Auth** as the only identity system.
Four things are worth knowing before touching anything:

**`prisma/schema.prisma` is the authoritative schema.** It is the only Prisma
schema in the repository — 16 models — and it is what `prisma generate`, the
test suite and the production database all follow. `prisma/m20/` holds the
Row Level Security SQL and its adversarial test, plus a README explaining
them; there is no second schema file there, deliberately. See
[prisma/m20/README.md](prisma/m20/README.md).

**Supabase is production.** `DATABASE_URL` is the transaction pooler
(port 6543, `pgbouncer=true`) and `DIRECT_DATABASE_URL` is the session pooler
(port 5432) that migrations and `scripts/bootstrap-admin.mjs` need. Both live
in `.env.local`, which is gitignored and must stay that way.

**`scripts/migrate-sqlite-to-postgres.mjs` is a one-off migration utility, not
a startup or seed script.** It moved the pre-M20 SQLite rows into Supabase
once. It is deliberately absent from `package.json` so no `npm run` can reach
it, and it must never be wired into a deploy step.

**`data/repos.db` — the original SQLite database — must remain untouched.** It
is the canonical pre-migration record and the only copy of that state outside
a backup. The migration script opens it `readOnly: true` at the driver level;
nothing else should open it at all. It is gitignored and never committed.

## Requirements

- Node 20.11+ (developed on Node 24)
- Windows, macOS or Linux
- No accounts, no billing, no cloud services

## Setup

```bash
npm install
npm run setup
npm run set-password -- --write
npm run dev
```

`npm run setup` creates `.env` and `.env.local`, generates the Prisma client and
creates the SQLite database at `data/repos.db`.

`npm run set-password` sets the one password you sign in with, and generates the
secret that signs your session cookie. Until it has been run, RepOS cannot be
signed into at all — there is no first-run setup page for anyone to reach first.
Without `--write` it prints the two lines for you to paste into `.env.local`.

Open http://localhost:3000 and sign in. The dev server binds to `0.0.0.0`, so you
can also reach it from your phone on the same network at `http://<laptop-ip>:3000`.

## Configuration

All secrets live in `.env.local`, which is gitignored. See `.env.example`.

| Variable | Needed | What it is |
| --- | --- | --- |
| `DATABASE_URL` | always | The local SQLite path. Lives in `.env`, not `.env.local`, and holds no secret. |
| `REPOS_OPERATOR_PASSWORD_HASH` | always | Your password, as a scrypt hash. Written by `npm run set-password`. |
| `REPOS_SESSION_SECRET` | always | Signs the session cookie. Changing it signs out every open session. |
| `REPOS_PUBLIC_BASE_URL` | production | The `https://` address customers open. Required in production; leave blank in development. |
| `REPOS_BACKUP_DIR` | optional | Where backups go. Defaults to `./backups`. |
| `GROQ_API_KEY` | optional | Enables AI drafting. RepOS works fully without it. |

The password hash uses colons between its parts, never dollar signs: the env
loader expands `$NAME` inside a value, so a dollar sign would silently swallow
the rest of the line.

RepOS works fully **without any AI key**. With no key it classifies feedback
using the local keyword taxonomy and writes report prose from templates. Every
number is identical either way, because no number ever comes from AI.

To enable AI drafting, set `GROQ_API_KEY`. Groq is the only registered provider —
see COMPLIANCE.md for why there is no Google-operated fallback.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server on port 3000 |
| `npm run build` | Production build (stop the dev server first — they share `.next`) |
| `npm run verify` | typecheck + lint + tests |
| `npm test` | Vitest suite — requires `REPOS_TEST_DATABASE_URL` (see below) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply the Prisma schema to PostgreSQL |
| `npm run db:studio` | Browse the local database |
| `npm run db:reset` | Wipe and recreate the database |
| `npm run db:seed` | Load the demo dataset (`npm run db:seed:clear` removes it) |
| `node scripts/bootstrap-admin.mjs` | Promote the first RepOS operator (needs `REPOS_BOOTSTRAP_SECRET`) |

### Running the tests

The suite has **no default database connection**, deliberately: a working
default would put a password in tracked source. Point it at a local,
disposable PostgreSQL database before running anything.

```bash
export REPOS_TEST_DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:<port>/<database>"
npm test
```

It creates and drops a schema per test file and truncates tables between
cases, so never aim it at a database you care about. It refuses any host that
is not `localhost`, `127.0.0.1` or `::1`.

| `npm run backup` | Write a checked copy of the database to `backups/` |

## Running it for a real client

Everything above is enough for development on one laptop. Putting RepOS in front
of a real business needs four things settled, in this order.

### 1. One permanent address

A QR code printed onto a card cannot be recalled, so the address inside it has to
be decided once and never drift. Set it in `.env.local`:

```
REPOS_PUBLIC_BASE_URL="https://repos.yourdomain.com"
```

In production this is **required** and must be `https://`. RepOS will not fall
back to the address a request arrived on, because a `Host` header can be set by
anyone who can reach the server, and a forged one would end up permanently
inside a printed QR. If it is missing or not https, RepOS says so on the client's
Feedback QR page and on Settings, and refuses to draw a QR at all rather than
draw a wrong one.

Put RepOS behind a reverse proxy that terminates TLS (Caddy and nginx both do
this in a few lines) and forwards to `npm start` on port 3000. The proxy's public
host is also what Next compares against the `Origin` header before it will run a
Server Action; that comparison is configured from the same variable, so there is
only ever one address to set.

Restarting RepOS does not change the address, the feedback tokens, or the owner
links. Printed cards keep working.

### 2. Your password

```bash
npm run set-password -- --write
```

There is one operator — you — and one password. It is stored as a scrypt hash in
`.env.local` and never in the database, so a stolen backup contains no
credential. Signing in sets a cookie that is signed with `REPOS_SESSION_SECRET`,
is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and lasts eight hours.

Changing `REPOS_SESSION_SECRET` invalidates every session immediately. That is
the fastest way to lock RepOS if a laptop goes missing.

### 3. The owner's link

Each client has one private address that opens that business's own view:

```
https://repos.yourdomain.com/portal/<22-character-token>
```

The last part is a random 110-bit token, not the client's id. It is issued the
first time you open that client's page. Anyone holding it can read that one
business's view and nothing else — there is no navigation from it to another
client, and no way to reach the operator's side. Treat it like a password and
send it to the owner directly.

If it goes somewhere it should not, press **Issue a new link** on the client's
page. The old address stops working immediately, on every page of the portal.

An unknown, mistyped or retired link, and a business you have archived, all
produce the same neutral "this link doesn't open anything" page, so trying
addresses teaches nothing.

### 4. Backups

Everything RepOS knows is one SQLite file. **Settings → Take a backup now**
writes a checked copy; `npm run backup` does the same from a terminal.

Copies go to `backups/` — beside the installation, never inside the folder
holding the live database, never inside `public/`, and never uploaded anywhere.
Point `REPOS_BACKUP_DIR` at another drive if you have one. Each copy is named
for the moment it was taken and nothing is ever overwritten.

The copy is made with SQLite's own `VACUUM INTO`, so it is a consistent moment
even if RepOS is being used, and it is checked with `PRAGMA integrity_check`
before it is given its final name. A file in `backups/` is always a backup that
passed its check.

**To restore one:**

1. Stop RepOS.
2. Rename `data/repos.db` — keep it, do not delete it.
3. Copy the backup into `data/` and name it `repos.db`.
4. Start RepOS and open a client to check its history is there.

A backup holds clients, feedback and history. It holds no password and no keys,
so a restored copy still needs its own `.env.local`.

## Who can reach what

| | Needs your password | Reaches |
| --- | --- | --- |
| You, the operator | yes | everything |
| A business owner | no — one secret link per business | that business's own view, read-only |
| A customer | no — the QR on the card | one page where they can say something |

Three layers keep that true, and the third is the one that matters:

1. **Middleware** bounces an unauthenticated request to `/login` before a page
   renders. It is a courtesy, not a gate.
2. **The operator layouts** check again before rendering anything.
3. **Every server action checks for itself, as its first statement.** Server
   Actions are POSTs addressed by an internal action id rather than by the page
   path, so no path-matching rule can be the gate. A compliance test walks every
   exported action and fails the build if one is missing the check.

Exactly three actions are deliberately unguarded: signing in, signing out, and a
customer submitting feedback. The last is authorized by the gateway token in the
URL, is rate-limited, and can only ever write against the client that token
resolves to.

## What M16 deliberately does not do

- **No Google, no WhatsApp, no email.** No OAuth of any kind, no review fetching,
  no reply publishing, no notifications. See COMPLIANCE.md.
- **No second user.** No teams, roles, invitations, or customer accounts. One
  operator, one password.
- **No password for the business owner.** Their link is the credential. Adding
  accounts for owners would mean holding their credentials, and RepOS holds no
  customer or owner passwords.
- **No cloud backup, no uploads, no telemetry.** Backups are files on this
  computer, and RepOS never schedules one on its own.
- **No server-side session list.** The session cookie is signed and expires by
  itself; signing out clears it in that browser. There is no store to revoke a
  single stolen cookie from — rotating `REPOS_SESSION_SECRET` ends every session
  at once, and that is the intended lever.

## The command centre

Opening RepOS answers one question: **what do I need to do?**

Every active client gets a card carrying who they are, how their health reads,
why they are where they are in the list, the biggest complaint with its count,
what moved since the last check-in, what is already prepared, and one button
that goes straight to the screen where the work happens.

Order is a sum of **named signals**, not a score — health at Attention, reviews
only the operator can answer, a serious recurring complaint, a declining trend,
a reply backlog, unread feedback, a follow-up noted a while ago, a stale
snapshot. Each one carries the sentence the operator reads under the client's
name, so the ordering can always be argued with. Ties break on business name, so
the list never reshuffles between refreshes.

The next action is only ever something RepOS can actually do — read feedback,
handle the ones it will not answer, suggest replies, send the owner update, take
a snapshot, record a minute. There is no "in progress", no "assigned" and no
"snoozed", because RepOS records none of those.

A client with nothing yet says so plainly and offers the one next step, rather
than rendering an empty chart.

## How it works

1. **Clients** — each client has a knowledge profile: voice, policies, up to
   three manually entered competitors, and a vertical playbook from `/packs`.
2. **Snapshots** — you look at the client's public listing yourself and type in
   what you see, then paste any reviews you collected. RepOS fetches nothing.
3. **Health Card + Pulse** — a deterministic status (Healthy / Watch /
   Attention / Insufficient data), a trend, and a period-over-period comparison,
   all computed from stored rows.
4. **Reports** — each snapshot produces a two-page Health Card and Customer
   Pulse ending in one recommended action with its evidence.
5. **Feedback kit** — one page generates a printable, vertical-aware kit: a
   counter/table stand, eight cards on an A4 sheet, a sticker and a staff
   instruction card, plus copyable messages in English, Hinglish and Marathi.
   Every QR RepOS prints — the kit, the feedback card, the on-screen code and
   the download — encodes the same address: that client's own private feedback
   page. Nothing on the card depends on the business having a public listing.
6. **Feedback inbox** — paste a batch of reviews (or add one by hand) and RepOS
   reads them: ratings, dates and text, with personal details stripped before
   anything is saved and obvious duplicates skipped. Items land unanalysed; the
   analysis layer picks them up later.
7. **Reading the feedback** — one click and RepOS reads everything waiting:
   what language it was written in, whether it is positive, negative, mixed or
   neutral, what it is about, and how clear the reading is. The Feedback page
   then shows what customers are happy and unhappy about as counts, and every
   count links back to the reviews behind it.
8. **Suggested replies** — RepOS sorts what it has read into what needs a
   reply and how soon, then writes a short suggestion for each in the
   business's own voice. You edit it, copy it, and paste it wherever you
   reply. RepOS sends nothing and posts nothing.
9. **Owner communication** — open a client and the message to their owner is
   already written from their own feedback: what customers love, the one thing
   that keeps coming up, and the step worth taking. Copy it and send it however
   you normally do.
10. **Minutes** — the memory layer. Record what happened with a client:
   conversations, issues, decisions, actions and follow-ups. Decisions and
   follow-ups are highlighted so "what we decided" stands apart from "what
   happened". This is what lets a later milestone join feedback → insight →
   action → result.

## How feedback is read

The reading is deterministic. Nothing about it depends on a model being
available, and every number on the screen is produced by application code.

| Step | What decides it |
| --- | --- |
| Language | Script and marker words (`src/lib/analysis/language.ts`) |
| Themes | The client's vertical pack taxonomy, matched with negation handling |
| Theme sentiment | Which half of the taxonomy the theme came from — never guessed |
| Overall sentiment | Composed from the wording and the rating together |
| Confidence | How many signals were found and whether they agree |
| Counts | Application code only (`src/lib/feedback/analysis.ts`) |

**A star rating alone never decides the sentiment.** The wording leads and the
rating corroborates; when they disagree the result is Mixed, and the review page
says so in plain words ("The star rating and the wording point in different
directions").

A taxonomy hint has to mean the thing on its own. Bare nouns — `staff`,
`appointment`, `बिल` — are deliberately absent from both halves of every
taxonomy, because they appear in happy and unhappy reviews alike; the hint is
the phrase that carries the judgement. `scripts/clean-praise-hints.mjs` and
`scripts/clean-issue-hints.mjs` record how the packs were brought to that rule.

If an AI provider is configured, it may suggest tags and a sentiment for
individual items. Suggestions are discarded unless they appear in the client's
pack, and the overall sentiment is always recomposed by the same deterministic
code. With no key configured, everything above still works.

`ANALYSIS_VERSION` in `src/lib/analysis/normalize.ts` is bumped whenever a change
should cause stored readings to be redone. Items keep their stored version, so
the Feedback page simply reports them as not read yet and one click brings them
up to date.

## How a reply is suggested

Same shape as the reading: everything that decides *what happens* is
deterministic, and the model is only ever asked to phrase things.

| Step | What decides it |
| --- | --- |
| Kind of message | Praise / complaint / mixed / question / general comment |
| Whether to reply | Rules in `src/lib/reply/triage.ts` |
| How soon | A fixed list of named signals, each shown with its reason |
| Voice, language, banned words | Client profile first, vertical pack for anything blank |
| The wording | Deterministic writer, or an assisted draft that passed every safety check |

**Priority is never an opaque score.** It is the sum of named signals — a
one-star rating, a serious theme, an unanswered question, how recent it is —
and the review page lists every signal that fired in plain words. Positive
feedback deliberately scores above zero so praise stays visible; it simply
ranks below an operational complaint.

**Some reviews are not RepOS's to answer.** Anything mentioning legal action,
harm, or money back is marked *Handle this one yourself* and no suggestion is
written for it at all.

**Every suggestion passes a safety gate before it is stored** — the same gate
whether RepOS or an assistant wrote it, and whether the operator typed it
themselves. It refuses review incentives, promises of refunds or compensation,
invented operational changes, medical claims, legal admissions, customer
contact details, links, and any mention of RepOS's own analysis. See
COMPLIANCE.md.

**Nothing is sent.** There is no send, post, schedule or share anywhere in the
product, and no WhatsApp or messaging link. The operator copies the text.

## What RepOS prepares for the owner

Three messages, ready on the client page. No form, no tone to pick, no settings.

| Message | What it is |
| --- | --- |
| **Owner update** | What customers love, the main issue with its count, what changed, and the step worth taking. |
| **Recommended next step** | The one change, on its own, with what it is based on. |
| **Follow-up nudge** | A short ask about whether they got to it. |

A **reply to a review** is a fourth kind of communication and stays where it
belongs — written per review on the Feedback page. It is public, short and
customer-facing; an owner update is private, analytical and carries numbers.
They are composed by different code for that reason.

Everything comes from one **insight object** built from stored rows: the themes
with their counts and the ids of the reviews behind them, the change between the
last two check-ins, and the vertical pack's own advice for whatever came up
most. RepOS does not write advice — it picks which of the pack's existing advice
applies, based on a count it can show the evidence for.

**Sections that the data cannot support are left out.** An owner with nine
reviews is told plainly that it is too early, not handed a confident paragraph.
Nothing is named until it has been mentioned at least three times, and there is
no period comparison until two snapshots exist.

**Only figures the stored data holds may appear.** The same numeric guard the
report engine uses is applied to every owner message: a number that is not in
the insight makes the message unpublishable.

**What was already done is quoted, never judged.** An update can say "last
recorded on your side: agreed to review peak-hour staffing". It will not say
whether that worked — measuring that is the action loop's job, and RepOS does
not claim intelligence it has not built.

The owner is written to in **English, Hindi, Hinglish or Marathi**, taken from
the client profile and the vertical pack, with a one-click switch on the panel.

**Nothing is sent.** There is no send, schedule, notification or messaging link
anywhere in RepOS. The operator copies the text.

## One product, every vertical

RepOS is not a clinic tool with other trades bolted on. There is one workflow,
one data model, one intelligence engine and one set of screens. A client picks a
vertical when onboarded, and every screen adapts automatically:

| | Clinic | Salon | Restaurant |
| --- | --- | --- | --- |
| Printed piece | counter card | counter card | table card |
| Kit headline | Was today's visit helpful? | Happy with how it turned out? | How was the food today? |
| Where it goes | billing counter | billing counter | every table |

All of that lives in JSON under `/packs` — taxonomy, voice, staff scripts, kit
wording and playbook. **Onboarding a new business type is a JSON file, not a new
page tree.** `src/lib/kit/content.test.ts` fails the build if any vertical stops
producing a complete kit through the shared code path.

## Health status rules

Status is the plain consequence of named signals firing. There is no score and
no AI involvement. Thresholds live in `src/lib/health/rules.ts`.

| Status | When |
| --- | --- |
| **Insufficient data** | No snapshot, or the latest snapshot has neither an observed rating nor any stored feedback |
| **Attention** | Any attention-level signal fired |
| **Watch** | Only watch-level signals fired |
| **Healthy** | No signal fired |

Signals: negative feedback share (≥30% attention, ≥20% watch, needs 10+ stored
items), recurring issue themes (3+ mentions; high severity is attention), rating
drop between snapshots (≤ -0.2 attention, ≤ -0.05 watch), unanswered review
share (≥50% attention, ≥20% watch), snapshot staleness (≥90 days attention,
≥60 days watch), and review velocity below 0.25/week.

## Architecture

```
packs/                    vertical playbooks (JSON — the only vertical knowledge)
prisma/schema.prisma      SQLite schema
src/lib/analysis/         parsing, classification, normalization, aggregation
src/lib/health/           health status + pulse rules and engine
src/lib/clients/          client service layer
src/lib/snapshots/        snapshot service layer
src/lib/kit/              feedback kit content, QR and service layer
src/lib/feedback/         feedback intake, analysis and reply service layers
src/lib/reply/            triage, voice resolution, drafting and safety
src/lib/comms/            owner insight object and message composition
src/lib/command/          command-centre priority and board aggregation
src/lib/minutes/          operational memory (minutes) service layer
src/lib/ai/               provider abstraction + numeric guard
src/lib/actions/          Next.js server actions (thin wrappers over services)
src/app/(app)/            App Router pages (with navigation chrome)
src/app/(print)/          print sheets — separate root layout, no chrome
tests/                    service + compliance tests against real SQLite
```

Business logic lives in services, not in React components, so it is directly
testable. `tests/compliance.test.ts` fails the build if a prohibited integration
is ever reintroduced.
