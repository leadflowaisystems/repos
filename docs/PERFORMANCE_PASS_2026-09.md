# Performance pass — the workspace stays quick as Headway grows (2026-09-11)

Symptoms reported: the client portal was sometimes slow, laggy, freezing,
unresponsive after switching sections quickly, and slow after changing
language.

Everything below was measured, not estimated. The rig was a private
PostgreSQL 16 with the production schema and `prisma/m20/rls.sql` applied,
connected as `repos_app`, every Prisma operation wrapped exactly as
`src/lib/db.ts` wraps it. Three target businesses (100 / 1,000 / 10,000
pieces of feedback) and 0 → 500 other businesses with 200 each. Browser
figures come from a production build of this tree.

## What was actually wrong

1. **Eight scans of the client's feedback per page.** Home, Customers and
   Check-in each read the business's whole `ReviewItem` table eight times —
   theme summary (twice), health, improvement progress, responsibility rows,
   reply coverage, evidence index, since-your-visit — each with its own
   projection of the same rows. 21 Prisma operations, 85 SQL statements. For
   a 10,000-row business: 80,016 rows and 13 MB out of Postgres for one screen.
2. **The core loaded twice** on Customers and Check-in (`getResponsibility`
   and the page's own view each called `loadCore`), and the client row was
   read three times per page, the lifecycle row twice per full load.
3. **The whole dictionary went to the browser.** The workspace root layout
   handed `LocaleProvider` all 1,736 phrases: 137 KB of English, 250 KB of
   Hindi or Marathi, on every first load and on every language switch
   (`revalidatePath('/', 'layout')` re-sends the root). Client components can
   reach a handful of namespaces. A language switch moved 259 KB.
4. **No loading state inside the workspace.** The only `loading.tsx` wrapped
   the header, so it never showed on a tab change; the previous page stayed
   on screen, unchanged, until the server had finished. Nothing said the tap
   had registered.
5. **Eight prefetch requests per page view** once hydrated (one per tab,
   ~230 bytes each, every one through the middleware's session check).
6. Not a cause, measured anyway: the two `getUser` calls per request
   (middleware, then render) add ~10–40 ms on production. Left alone —
   removing one would change what is verified where.

Also found on the way, and fixed because the QA criterion was "no
wrong-language content": the Account headline, status and activity labels,
and the Check-in pulse sentence were written without the translator and
stayed English in Hindi and Marathi.

## What changed

- `src/lib/feedback/ledger.ts`: one request-scoped read of the client's
  feedback, the union of the columns the eight readers used, keyed on the
  client id. Each reader filters and projects in memory with the predicate
  it used to send to the database. Rows, counts, thresholds, evidence rules:
  unchanged by construction.
- `loadCore`, `findClient` and the lifecycle row read are memoised per
  request (`loadCore` keyed on client + language, like `loadIntelligence`).
- `(workspace)/layout.tsx` ships `WORKSPACE_NAMESPACES` only.
- `components/portal/link.tsx`: the workspace's `Link`, which never
  prefetches; every `next/link` import in the tree switched to it.
- `workspace/[clientId]/loading.tsx`: the skeleton for the page slot under
  the header. The header marks the pressed tab via `useLinkStatus`.
- Kit photos: 720 px and 960 px WebP variants with a `srcset`.
- Tests: `tests/perf.client-scoped.test.ts`,
  `tests/perf.workspace-payload.test.ts`,
  `tests/perf.workspace-navigation.test.ts`.

## Before → after (server, local Postgres, median of 3)

| page      | history | ops | statements | rows      | bytes    | ms        |
|-----------|---------|-----|------------|-----------|----------|-----------|
| Home      | 1k      | 21→11 | 85→44   | 8016→1014 | 1.3→0.8 MB | 244→152 |
| Customers | 1k      | 21→8  | 85→32   | 8021→1013 | 1.3→0.8 MB | 219→108 |
| Feedback  | 1k      | 14→7  | 57→28   | 6029→1028 | 1.1→0.8 MB | 169→124 |
| Check-in  | 1k      | 21→8  | 85→32   | 8021→1013 | 1.3→0.8 MB | 235→118 |
| Account   | 1k      | 17→10 | 69→40   | 6015→1014 | 0.8→0.8 MB | 349→133 |
| Home      | 10k     | 21→11 | 85→44   | 80016→10014 | 13→7.7 MB | 429→520 |

At 10,000 rows the wall time is now Prisma materialising 10,000 wide rows
(~250 ms; Postgres itself is 2 ms), so the page is CPU-bound at roughly
0.4–0.5 s server-side. That is inside the budget and O(the business's own
history); it is the remaining bottleneck (see below).

## Other clients do not change the target's cost

Target business fixed at 1,000 rows; other businesses added at 200 rows each.

| other businesses | rows in DB | Home ops / statements / rows / KB | Home ms |
|------------------|------------|-----------------------------------|---------|
| 0                | 11,100     | 11 / 44 / 1014 / 775              | 157     |
| 10               | 13,100     | 11 / 44 / 1014 / 775              | 166     |
| 50               | 21,100     | 11 / 44 / 1014 / 775              | 147     |
| 100              | 31,100     | 11 / 44 / 1014 / 775              | 165     |
| 500              | 111,100    | 11 / 44 / 1014 / 775              | 151     |

The query shape is identical at every step (it was before the pass too —
tenant scoping was never the problem). `EXPLAIN ANALYZE` as `repos_app` at
500 businesses: index scan on `clientId`, the RLS subplan hashed once,
0.5–2 ms per statement. No index or migration is needed.

## Browser (production build)

- Language switch: 259 KB → 19–26 KB per switch, one request, settles in
  ~100–220 ms locally; ten consecutive switches, correct language on the
  document, the navigation, the headline and the confirmation every time,
  heap flat.
- Document weight: Team 156 → 26 KB, Account 174 → 43 KB, Home 246 → 115 KB
  (English); Hindi Home 143 KB.
- Rapid navigation: 24 taps in 3.0 s → exactly 24 requests, the final page
  is the last one tapped, no intermediate page lands afterwards, no long
  tasks, heap delta 0 (desktop and 375 px).
- Prefetch: 8 requests per page view → 0.
- Every navigation shows the skeleton inside the chrome and the pressed tab.
- Kit photos at 375 px / DPR 2: 354 KB → 155 KB.

## Remaining limitations, stated plainly

- Work is O(the business's own feedback history), once per page. A business
  with 10,000+ pieces of feedback pays ~0.4 s of server CPU per intelligence
  page, dominated by materialising the rows. The next step, if it is ever
  needed, is SQL aggregation for the counting readers or a per-business
  summary maintained by the pipeline — a change to how the engines take
  their input, not attempted here.
- The App Router does not cancel a superseded navigation's request: rapid
  tapping is one bounded render per tap, discarded on arrival if stale.
- `sinceLabel` (the "Since your last visit, N days ago" heading) has no
  dictionary phrases and is English in every language. Needs Hindi and
  Marathi copy written by a person.
- Found, not fixed, out of scope: the Team page throws for a non-admin owner
  whose business has a second member, because the `User` row policy is
  self-or-admin and the membership→user join returns null. Needs an RLS
  change (a migration), tracked separately.
