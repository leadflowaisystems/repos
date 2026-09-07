# Headway command-centre pass — September 2026 (M24)

The owner-facing workspace, rebuilt around one question: can a busy owner who
has never seen Headway understand their business from the largest text on the
screen, and find the proof, the reason and the next step without reading?
M23 made the portal honest and shorter. This pass makes it decide.

Everything below was rendered against a restored copy of the production
database with the Corner Cafe story rebuilt (see §6), measured in the browser
at 375, 390, 768, 1024 and 1366 px, and screenshotted through the DevTools
protocol at exact viewport widths.

## 1. The problems found

The M23 portal was useful and credible, and it still read as a report:

| Problem | Where it showed |
| --- | --- |
| **Equal weight.** Home opened with a picture, then a decision card, then a cream "watching" panel, then the thing itself in four labelled layers, then strengths, then figures. Every block honest; every block the same size. | Home |
| **Explanation before conclusion.** Every theme was told as CUSTOMERS SAY → WHAT IT MEANS → WHY IT MATTERS → NEXT, one under the other, on Home and again on Customers. | Home, Customers |
| **Numbers without evidence.** "34 of 87" was a link to another page. The owner had to leave the page to see one customer say it. | Everywhere |
| **The loop as a form.** Improvements told the problem, the suggestion, the decision, the change, the comparison, the reading, the learning and the next step as a timeline of labelled steps beside a bar chart. Accurate, and nobody felt remembered. | Improvements |
| **The check-in as a delta report.** Movement lists, outcome rows and a five-line "what Headway did" — with the four lines an owner needs (Do / Protect / Watching) added at the top in M23, but small. | Check-in |
| **Reviews as an inbox.** Counts, filters, charts, then 87 comments. Nothing said what Headway had made of the pile. | Reviews |
| **Sparse utility pages.** Account had two sections and a button; Team a list; Print kit a download. | Account, Team, Print kit |
| **Demo data from an older product.** 82 of Corner Cafe's 87 records were public reviews built from seven templates with closers ("… this time", "… on our last visit"); 4 of the 5 QR records carried no structured answers at all, because they were seeded before the M19 form existed. | The demo |

## 2. The interaction model

One rule, applied everywhere: **a conclusion first, in a sentence; the proof on
request; the method last, behind a tap.** The mechanics are deliberately
plain:

* **Every disclosure is a native `<details>`** (`src/components/portal/disclose.tsx`).
  It opens without JavaScript, a screen reader hears a button that expands,
  and closed content is simply not on the page. No client state anywhere in
  the owner pages.
* **Proof chips.** A figure that matters — "39% of feedback", "More often after
  your change", "At both recent check-ins" — is a chip. Tapping it opens, in
  place, what it counts: "34 of the 87 pieces of feedback Headway has read
  mention it", three customers in their own words with the door each came
  through, and "See all 34 →".
* **The population.** A before/after opens into its two piles, drawn one piece
  of feedback at a time (44 squares, 14 red; 43 squares, 20 red), with each
  pile's share, its boundary, the reading ("More often after the change"), the
  one sentence about what that cannot prove, and "Why Headway says this" for
  the engine's own reasons.
* **Signal cards.** A theme is a card: the group it sits in, the label, the
  count, the share, the direction where two check-ins were actually compared,
  and what the feedback did after a change. It opens into WHAT CUSTOMERS ARE
  SAYING · WHAT HEADWAY SEES · YOU TOLD US · WHAT TO DO · WHY · SOURCE. Arriving
  with `?open=<theme>` opens one card; every "Look at this first" on Home does.
* **Motion is brief and only ever reveals** — a fifth of a second for a panel,
  a stagger for the population — and `prefers-reduced-motion` switches it off.
  No confetti, badges, streaks, countdowns or notifications; a source-level
  test keeps it that way.

Nothing new is computed. `src/lib/portal/focus.ts` chooses and words from
judgements the responsibility layer, the view and the measurement engine
already made; `src/lib/portal/evidence.ts` picks quotes from rows the analysis
already themed (newest first, one door at a time, readable over long, never a
row with no words). Both are pure and tested without React.

## 3. How Home now guides attention

Seven questions, in this order, and one block is dominant:

1. **RIGHT NOW** — the largest text on the page is a sentence: "Slow service is
   the one thing worth your attention." Under it, small: "Based on 87 pieces of
   feedback we have read." Beside the eyebrow, the direction pill.
2. **DO I NEED TO ACT?** — the same block. Three proof chips ("39% of feedback",
   "More often after your change", "At both recent check-ins"), then the one
   gold button: **Look at this first →**, which opens the signal on Customers.
3. **WHAT EXACTLY?** — still the same block: *What Headway wants you to know*
   ("Customers are not unhappy about your food taste and quality — 32 praised
   it. What they keep raising is slow service, and it has come up more since
   your change."), *Show me the evidence* (three quotes, "See all 34 comments"),
   *Your next step* ("Check what else changed before undoing anything."), and
   *Why, and what Headway checks next* behind a tap.
4. **HEADWAY IS WATCHING** — compact rows: chip, count, one line; why and "we'll
   flag it" open on tap.
5. **GOING WELL** — the same, for strengths.
6. **SINCE YOU WERE LAST HERE** — only when something happened (unchanged).
7. **WHAT'S NEXT** — "Next check." and the link to Check-in (unchanged).

Then the four tiles, then "What Headway knows about your business" and "What
we cannot tell you yet" behind one tap each. On a phone the block is first
and the gold button sits in the first screen with the chips closed; the
evidence opens inline. Home is 2,638 px tall at 375 with everything closed.

The block adapts to the state: "Nothing needs you right now." with the
strength as the reading and "See what is going well"; a change that helped
shows "Less often after your change" with the population and "See what
changed"; "Still early days" and "No customer feedback yet." say so and show
nothing invented.

## 4. The other pages

| Page | Before | Now |
| --- | --- | --- |
| **Customers** | "In short", then every strength and every issue as a four-layer story, then check-in movement, recurrence, not-yet-clear, method, limits. | The two-sentence reading, then the **signal board** — NEEDS YOU · WATCHING · PROTECT · NOT YET CLEAR — each a card that opens in place. "Show what changed between your check-ins" and "How Headway read this" (the method, the full mention list) behind two taps. Limits at the foot, as before. |
| **Reviews** | Counts, rating filters, "what Headway found", charts, a form, the list. | The **funnel** first: 87 pieces read → 7 recurring signals → 6 isolated mentions → 1 needs attention · slow service, each a count of the same rows and a link. Then every signal as a one-tap chip; a tapped signal heads the list with "Evidence for slow service — 34 comments, this is what Headway based it on." The counts, ratings, tones and the search are all still there, under two reveals. |
| **Improvements** | A step timeline beside a bar chart, with What we know / What we cannot tell you / What we recommend. | Three moments with the numbers large — THE PROBLEM **32%** (14 of 44, 23 Jul) → YOU CHANGED "Added a second server on Friday and Saturday evenings" (1 Aug) → HEADWAY CHECKED AGAIN **47%** (20 of 43, 1 Sep) — then WHAT HAPPENED (More often after the change), WHAT THIS MEANS (the finding and the one sentence it cannot prove), WHAT TO DO NOW (Check what else changed before undoing anything). *Why?* opens the population; *Show evidence* opens quotes after and before the change; *What was recommended?* opens the suggestion, the decision, the owner's note. |
| **Check-in** | Callout, four labelled lines, movement lists, outcome rows, "what Headway did". | "August check-in", then one sentence: **"One thing needs you. Two things need watching. Two things are holding steady."**, then three blocks — DO / PROTECT / WATCH — each a signal card. *Show what changed* and *What Headway did* behind two taps. |
| **Account** | Headline, "What Headway has done for you", "Carrying on". | Three sections: **Your Headway service** (14-day trial · Ends 21 Sept 2026), **Your Headway activity** (87 pieces read · 7 recurring signals · 1 active issue · 1 improvement compared), **Carrying on** (unchanged: the continuation). No price, no countdown. |
| **Team** | "Team — who can open this workspace." | "Who has access — 2 people can open this workspace", each member with what their role can do. |
| **Print kit** | The sheet, the four steps, placement, staff guidance. | The same, with a status strip first: feedback page **Live** · card **Ready** · **22** pieces of feedback through the card. |

Copy that was removed was not deleted: "What we cannot tell you" became the
sentence beside every reading and the population's caveat; "How Headway got
here" became a reveal; the four-layer story survives only for a second thing
needing the owner, under the focus block.

## 5. Mobile, desktop, accessibility

Measured in the browser at 375, 390, 768, 1024 and 1366 px on Home,
Customers, Reviews, Improvements, Check-in and Account: `scrollWidth` equals
`innerWidth` on every page at every width (no horizontal scrolling); one
`main` per page; every link, button, input, select and summary is at least
44 px tall and wide (the 16 px checkbox on Reviews sits inside a 44 px label,
as before). Cards stack to one column under 768 px; the three improvement
moments stack with the arrows hidden; the funnel turns vertical. Colour never
carries meaning alone: arrows and dots are `aria-hidden` beside words, the
population is `aria-hidden` beside its counts, disclosures are native.

## 6. The demo, audited against the feedback blueprint

The current blueprint, read from the code rather than assumed:

* **Table-card feedback** (`REP_OS_QR`): an overall rating 1–5 (optional), a
  rating 1–5 for each of the restaurant pack's five questions — food, service,
  waiting, cleanliness, value — (each optional), the specifics tapped after a
  rating of 3 or below (keys from the pack, dropped unless their question was
  rated), up to 1,500 characters of words (optional), and at least one of the
  three. Stored as `stars`, `dimensionsJson`, `signalsJson`, `text`, with the
  customer's own date, through `parseStructured` and `prepareIngest`.
* **Public reviews** (`PUBLIC_REVIEW`): the words the operator pasted, a
  rating where the listing showed one, a date. No structure, because a public
  listing asks none.

Against that, the old Corner Cafe dataset failed in three ways: 4 of its 5 QR
records carried no structured answers (seeded before M19); 82 public reviews
came from seven templates with rotating closers; and the two doors were not
distinguishable as evidence.

**Every one of the 87 records was replaced.** The story now lives as data in
`scripts/demo/corner-cafe.ts` and is seeded through the real services by
`scripts/demo-seed.ts --client "Corner Cafe" --replace --yes` (dry run without
`--yes`): 65 public reviews (20 pasted May–June, 14 observed at the June
check-in, 10 pasted July, 8 pasted August, 13 observed at the August
check-in) and 22 table-card submissions from 2 August to 6 September — 18 with
words, 4 without, 1 with an overall rating only, 3 answering all five
questions, 12 with tapped specifics, three languages (English, Hinglish,
Marathi), no two texts sharing their first six words, no template closers, no
personal details. The one genuine-shaped QR record already in production
("Improve service", 5 September, five ratings and three specifics) is kept as
a record in the story.

Read through the real deterministic reader — the same one production used for
all 87 old rows — the story lands where the pages say it does:

| Figure | Value |
| --- | --- |
| Pieces read | 87 (65 public, 22 through the card) |
| Slow service | 34 of 87 (39%) — needs you; raised at both check-ins; 9 → 24 mentions between them |
| Before / after the change | 14 of 44 (32%) → 20 of 43 (47%): mentioned more often |
| Food taste and quality | 32 of 87 (37%) — the strength to protect; praised at both check-ins |
| Wrong or missing items | 12 of 87 — watching, up at the latest check-in |
| Food quality / taste | 5 of 87 — watching |
| Warm staff · value · ambience | 12 · 11 · 8 — protect |
| Isolated mentions | 6 topics mentioned once or twice |
| Rated on the card | waiting 3.0/5 (19 answers, 11 at 3 or below), service 3.3/5, value 3.7/5, food 4.2/5, cleanliness 4.6/5 |
| Check-ins | 27 Jun 2026 (4.0★, 210 reviews) and 28 Aug 2026 (3.6★, 244 reviews) |
| The change | suggested 23 Jul · agreed 25 Jul · made 1 Aug · compared 1 Sep, worsened |

Every date is in the past and in the order it could have happened (the test
`tests/m24.command-center.test.ts` pins the order, the blueprint conformance
of every QR record, the absence of templates and personal details, and the
reading above). The client row, its memberships, its feedback page and its
printed QR token are never touched by the rebuild.

## 7. Tests, build

* `tsc --noEmit` clean; `eslint .` clean.
* Full suite: 72 files, 1,805 tests, both database roles. New:
  `src/lib/portal/focus.test.ts` (19), `src/lib/portal/evidence.test.ts` (6),
  `tests/m24.command-center.test.ts` (29). Updated for the new hierarchy:
  `tests/m20.workspace-ux.test.ts`, `tests/m22.headway-identity.test.ts`
  (the gold fill now lives in the focus block), `src/lib/portal/pages.test.ts`
  (the check-in title). M23's own tests are untouched and green.
* Cold `next build` in an isolated copy: success, 42 routes, first-load JS
  103–131 kB, no new dependency. Schema unchanged; no migration.

## 8. Production — the demo rebuild is handed over, as M23's SQL was

The schema is unchanged and no migration is needed. Two things reach
production from this pass, and both are the owner's to run:

**The demo data.** Running the rebuild against the production database from a
tool call was refused by the auto-mode classifier, in the same way M23's
migration was. So, as then, the change ships as a guarded script rehearsed in
both directions on a restored copy of production:

```bash
node scripts/rebuild-demo-production.mjs backups/prod-2026-09-07-141755
```

is the dry run (prints the counts it would remove and stops), and

```bash
node scripts/rebuild-demo-production.mjs backups/prod-2026-09-07-141755 --yes
```

rebuilds Corner Cafe. The script reads `DIRECT_DATABASE_URL` from `.env.local`,
refuses unless that database is the one `backups/prod-2026-09-07-141755/manifest.json`
records AND the folder's `verification.json` says `pass: true` (it does: taken
14:17:55 today, 397 rows in 17 tables, restored twice locally, every table's
digest equal), removes the demo client's 87 feedback rows, 2 check-ins, 1
improvement, 4 minutes and 3 context lines, and seeds the story through the
real services with the deterministic reader. Expected result, printed at the
end: `REP_OS_QR 22, PUBLIC_REVIEW 65 (0 unread), check-ins 2, minutes 4,
context 4` and `action Slow service: MEASURED → WORSENED (baseline 14 of 44;
14 of 44 reviews (32%) → 20 of 43 reviews (47%))`. The client row, the
membership-less ownership, the feedback page and the printed QR token
`dhkqubf0mbd7fu9tvd3bt2` are not touched. Roughly a minute over the session
pooler.

To put the old rows back exactly as they were:

```bash
node scripts/rebuild-demo-production.mjs backups/prod-2026-09-07-141755 --restore
```

Both directions were run against `repos_demo_rehearsal` (a `pg_restore` of the
post-M23 backup) and checked: 82 + 5 rows back after `--restore`, 65 + 22 after
`--yes`, zero unread, token unchanged, no date in the future, trial window
unchanged.

**The code.** Merging `m24-command-center` into `main` and pushing deploys it
(Vercel builds on push). The new pages read the same rows the old ones did, so
the order of the two steps does not matter: the rebuilt story looks right on
the M23 pages, and the M23 story is readable on the M24 pages. Nothing in the
code depends on the demo data.
