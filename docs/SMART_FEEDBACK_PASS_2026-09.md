# The Smart Feedback improvement pass — September 2026

Three changes to the live Smart Feedback product. Front Desk is paused and
nothing here touches it.

## 1. Before the first reading: one shared "insights are building" state

A new business with one to four responses used to open a workspace that was
honest page by page but read, as a whole, like a product that was broken or
not set up — and some pages would still draw a pattern off three entries.

There is now one answer to "is there enough to show a reading?":

| Usable responses | State | What every reading page shows |
| --- | --- | --- |
| 0 | `NONE` | *Waiting for your first feedback* — how feedback arrives, where the card and link are |
| 1–3 | `BUILDING` | *Your insights are still building* — "You've received N responses so far…", `N / 5 responses`, "M more responses to go" |
| 4 | `BUILDING`, almost | *Almost there* — "…once you reach 5 responses" |
| 5+ | `READY` | the page exactly as before |

*Usable* is every response the business holds minus those whose reading
failed. Responses still being read count.

- Decided in `src/lib/portal/readiness.ts` (pure: the threshold, the state and
  the copy), read by `getReadiness` in `src/lib/portal/service.ts` from the
  request-memoised ledger every page already loads — no extra query.
- Rendered by one component, `src/components/workspace/insights-building.tsx`,
  in English, Hindi and Marathi (`src/lib/i18n/strings/readiness.ts`).
- Asked first by Home, Customers, Check-in, This week, This month and
  Improvements. Below the line none of them shows a count split, a problem,
  a strength, a trend, a movement or a suggestion. The customers' own words
  (Home's *Latest from customers*, the Feedback tab) are still shown — they
  are facts, not a reading. Changes a business already recorded stay on
  Improvements.
- It is a presentation floor in front of the pages, not a new analytical rule.
  `MIN_MENTIONS_TO_NAME` and every other safeguard are unchanged and still
  decide what may be named at 5 responses and at 500.

## 2. Permanently deleting an archived client

The Archive list now offers **Delete permanently** beside **Restore**. It
opens a dialog — *Delete [Business] permanently?* — whose button stays
disabled until the business name is typed exactly. The edit page offers the
same dialog, and only for an archived client.

`purgeClient` (`src/lib/clients/service.ts`) re-checks, on the server:
the client exists, **is archived**, and the typed name matches exactly.

**What is removed.** The `Client` row, and with it — by the database's own
`ON DELETE CASCADE` on every tenant table, verified against the production
catalogue snapshot of 21 Sep 2026 — its feedback, check-ins, improvement
actions, business context, voice profile, policies, competitors, kit
configuration, kit orders, QR gateway and token, portal token, minutes, time
entries, commercial terms, continuation requests, invitations, memberships and
temporary access. There is no file storage, no client-scoped setting and no
client id in the AI tally, so nothing else holds tenant data.

**What is not.** People. Every sign-in account is kept; each member only loses
their membership of the deleted business, so a person who also works with
another business keeps it untouched. The single exception is the temporary
login Headway generated for that business (M39) when **nobody ever claimed
it** — setup never completed, still the synthetic login id, no other
membership, not staff. That identity is revoked in Supabase Auth **first**; if
that fails nothing is deleted. Its `User` row then goes in the same
transaction as the business.

**The database refuses the rest for itself.** A new RESTRICTIVE policy,
`client_delete_admin_archived`, means a `DELETE` on `Client` needs a platform
admin **and** an archived row. Before it, `client_write` (`FOR ALL`) let a
business owner's connection delete its own business.

### To apply to production — by hand, after review

The application works without it (the service already enforces the same
rule); the policy is defence in depth. See `prisma/m20/README.md`:

```bash
psql -X -1 -v ON_ERROR_STOP=1 -c "SET lock_timeout = '5s'" -f prisma/m44/migration.sql
```

## 3. The public website, rebuilt around today's product

The site was last built on 7–10 Sep; the workspace was redesigned on 18–19 Sep.

- **Hero** draws today's Home — the navy band, *Needs your attention*, the
  count and trend, *What to do*, *Latest from customers*, the four doors — for
  Corner Cafe, the demonstration business. Only figures the dataset can stand
  behind are drawn; the mood split and "N things need your attention" count
  are left off rather than guessed.
- **New:** *Headway in one minute* (the five questions), *Your time* (what the
  owner does once, when they like, and what Headway does all the time),
  *Questions* (an FAQ — including the five-response line and permanent
  deletion).
- **Rebuilt:** *How it works* is the five-step lifecycle with each step's owner;
  the retired *four signals* section is now a tour of the five real tabs and
  the four Customers piles, named exactly as the workspace names them.
- **Real pictures:** the printed card is now the two kit photographs the Kit
  page uses, in place of an HTML drawing of an older cream card. `kit/` is
  exempt from the middleware so a signed-out visitor can load them;
  `print-kit/` is not.
- **Removed:** the old *Right now / Why / What to do* block and its chips
  (*Needs you*, *Protect*).
- **Metadata:** new description; title, Open Graph image and canonical unchanged.

`tests/m26.marketing-site.test.ts` holds all of it to the product: the tab and
pile names against the dictionary, the drawn Home against the dataset, the two
thresholds against `FIRST_READING_AT` and `MIN_MENTIONS_TO_NAME`, the photos
against the files, and no database, session or outside link on any site file.
