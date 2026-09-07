# Headway final experience pass — September 2026 (M25)

Two deliverables, weighted equally: the owner portal as a decision interface,
and the customer feedback system — the page a customer opens, the card that
opens it, and what the owner sees of it. M24 made Home decide; this pass makes
every surface read in the order a person checks a decision (conclusion → why →
evidence → what to do → what Headway checks next), removes every repeated fact,
surfaces the one thing the feedback page collects that the portal never added
up, and rewrites the customer-facing words so they ask for the truth in plain
language and promise nothing that is not kept.

Everything below was rendered against a restored copy of the production
database (Corner Cafe, the rebuilt 87-record story), screenshotted through the
DevTools protocol at 375, 390, 768, 1024, 1366 and 1440 px, and — for the
customer flow — walked end to end in a browser against a production build of
this branch served from an isolated copy pointed at that same local database.

## A. The portal

### What the audit found

| Weakness | Where |
| --- | --- |
| The decision block ran RIGHT NOW → chips → button → reading → evidence → next step. The "why" came after the proof, the button came before the instruction, and the "Show me the evidence" reveal repeated the three quotes the 39 % chip already opened into. | Home |
| Four tallies at the foot of Home repeated the count read (already the basis line), the top issue (already the headline) and the top strength (already under Going well). | Home |
| "Headway is watching" rows hid the condition that brings each thing back behind a tap, so "I don't have to remember this" was a promise the owner could not check. | Home |
| The taps a customer makes on the feedback page — a rating for waiting, "For the food", "For the bill" — were shown one row at a time on Reviews and never added up anywhere. 22 of the 87 Corner Cafe records are these taps. | Customers, Home |
| The Customers opening repeated the card beneath it ("… 34 of the 87 pieces …", "2 other complaints are worth watching"). | Customers |
| Tapping a signal on Reviews showed the full filtered list, newest first; the three comments Headway quotes everywhere else were not the first thing seen. | Reviews |
| The check-in ended after DO / PROTECT / WATCH; what Headway would look for before the next one was behind a reveal. | Check-in |
| Every page but Home had two `h1`s (the business name in the banner and the page title). | All |

### What changed

**Home** — the block now reads, in this order and no other:

```
● RIGHT NOW                                  Needs attention · Compared with your previous check-in
Slow service is the one thing worth your attention.
Based on 87 pieces of feedback we have read.

WHY
Customers are not unhappy about your food taste and quality — 32 praised it.
What they keep raising is slow service, and it has come up more since your change.

[39% of feedback ›] [More often after your change ›] [At both recent check-ins ›]

WHAT TO DO
Check what else changed before undoing anything.
The original suggestion still stands: Set a target ticket time per course …
[See everything on slow service →]
Why this step ›

HEADWAY WILL CHECK NEXT
Headway is checking whether slow service comes up more or less at your next
check-in, and will flag a move of 2 or more mentions.
```

The button names its destination (the whole reading of the theme on
Customers) because the instruction itself is two lines up. The duplicate
evidence reveal is gone: the share chip is the evidence. The tallies are gone;
the public rating — the one number from outside the feedback — is stated once,
quietly, under "Your next check-in". Each watched row shows its flag condition
in the open. The conclusion is the page's `h1`.

**Customers** — each signal card gained two rows. *What customers tapped*:
"19 customers rated waiting on your feedback page: 3.0 out of 5 on average,
11 of them at 3 or below." with the specifics as counted chips (For the food 9 ·
To place the order 3 · For the bill 2 · For a table 1). *Headway will check
next*: the theme's own watch line. The row order is now: what customers are
saying → what customers tapped → what Headway sees → you told us → what to do
→ why → Headway will check next → source. The opening sentence about the
leading complaint no longer carries the count the card states directly
beneath it, and the "N other complaints are worth watching" line is gone (the
WATCHING group is that line).

**Reviews** — tapping a signal now shows **What Headway based this on →
Evidence for slow service → 34 comments; 3 that say it most plainly first**,
the same three the workspace quotes under every figure (same rule: recency,
one door at a time, a readable length), then **Show all 34 →** (`&all=1`).
Any other narrowing — a star, a search, a tone, a source, a later page —
shows the plain list as before. The link that clears the theme is "Clear
filter", so it cannot be confused with "Show all 34".

**Check-in** — a visible **HEADWAY WILL CHECK NEXT** block after the three
cards, carrying the engine's own condition ("Not yet. 5 pieces of feedback
have come in since your check-in on 28 Aug 2026; Headway will say when another
check-in would show something new.").

**Every page** — exactly one `h1`: the page title, or on Home the conclusion.
The business name in the banner is a paragraph.

State language appears where a state is stated and nowhere else: *Right now*,
*Why*, *What to do*, *Headway will check next*, *Headway is watching*, *What
Headway based this on*, *What customers tapped*, *What Headway sees*.

### Progressive disclosure, as it now stands

| Level | Home | Customers | Reviews |
| --- | --- | --- | --- |
| 1 · glance | conclusion, why, three chips, what to do | group + theme + count + direction per card | funnel, signal chips |
| 2 · tap | a chip: 34 of 87, three quotes; the two piles of a before/after | a card: quotes, taps, reading, what to do, why, check next, source | one signal: three representative comments |
| 3 · tap | "Why this step"; a watched row's why and what you told us | "What the feedback did afterwards" | "Show all 34" |
| 4 · tap | "What Headway knows about your business"; limits | "Show what changed"; "How Headway read this" | "What Headway found in them"; search |

## B. The feedback system

### The exact final flow (restaurant; every pack has the same shape)

```
[card]  How was your meal today?  ·  Tell us honestly — good, bad or somewhere between.  ·  [QR]  Scan — it takes about a minute

1 of 3   CORNER CAFE
         How was your meal today?
         Good, bad or somewhere between — we would like to hear it.
         Your rating (optional)   ☆ ☆ ☆ ☆ ☆          [Skip]  [Continue]
         (a tap on a star moves on by itself)

2 of 3   How did these go?
         Tap a rating. Skip anything that did not apply.
         Food and drink   ☆☆☆☆☆      → 4–5: "Anything the kitchen should hear?"
         Service          ☆☆☆☆☆      → 1–3: "What happened?" + chips
         Waiting          ☆☆☆☆☆      → 1–3: "Where was the wait?" + chips (For a table · To place the order · For the food · For the bill)
         Cleanliness      ☆☆☆☆☆
         Value for money  ☆☆☆☆☆
         Pick any that fit — or none.               [Back]  [Continue]

3 of 3   What should we keep doing?            ← every rating 4 or 5
         What would have made it better?       ← every rating 3 or below
         What would have made today better?    ← a mix (the pack's own words; "What worked, and what would have made it better?" elsewhere)
         Anything else?                        ← nothing rated
         Optional. A line or two is plenty.
         [textarea: The food, the service, the wait — anything at all.]
         English, Hindi or Marathi — whatever is easiest.
         [Send]  [Back]

         No name or number needed. This goes to the Corner Cafe team only.   (under every step)

done     ✓ Thank you.
         Your feedback has gone directly to the team.
         Honest feedback helps the kitchen and the floor team know what to keep and what to improve.

         Would you also like to share your experience publicly?        (only when the owner added a link;
         Entirely optional. Whatever you wrote here stays private.       identical for every customer)
         [Leave a Google review →]
         Not now? You can close this page.
```

Walked in a browser against the production build: 4 stars → "2 of 3"; Food 5
and Waiting 2 → the waiting chips appeared; "For the food" tapped; Continue →
"3 of 3 · What would have made today better?"; Send → the thank-you above; the
stored row was `stars 4 · {"food":5,"waiting":2} · ["for_food"] · ANALYSED`,
exactly the blueprint. Without JavaScript the same form shows every section
at once and one Send posts all of it.

### Question architecture, per pack

The dimensions and their keys are unchanged in every pack — production rows
store keys and resolve labels at read time, so nothing was orphaned. What
changed is wording.

| Pack | First question (card = page) | Parts rated |
| --- | --- | --- |
| restaurant | How was your meal today? | Food and drink · Service · Waiting · Cleanliness · Value for money |
| salon | How was your appointment? | The result · The person who served you · Waiting · Cleanliness · Value for money |
| clinic | How was your visit today? | Waiting time · Staff at the desk · Time with the doctor · Booking the appointment · Cleanliness |
| gym | How is the gym working for you? | Equipment · Cleanliness · Trainers and staff · How busy it was · Changing rooms and facilities |
| coaching | How are the classes going? | Teaching · The faculty · Keeping you informed · Classrooms and facilities · Value for the fee |
| real_estate | How did the process go? | Communication · Being straight with you · The properties shown · Site visits · Paperwork |
| wedding_vendor | How did we do on the day? | The work itself · Communication · Being on time · The team on the day · Value for the price |

Five taps is the whole analytical schema; none was removed, none added.
Vague specifics were reworded so a customer can pick them without guessing
(keys unchanged): *Manner of the staff* → **Rude or dismissive** (restaurant,
clinic, salon, gym); *Manner with students* → **Harsh or dismissive with
students**; *How the team behaved* → **Unprofessional behaviour**; *Products
used* → **Products did not suit me**; *Study material* → **Study material not
useful**; *Seating* → **Uncomfortable seating**. Leading first questions were
replaced by open ones: *Was today's visit helpful?* → **How was your visit
today?**; *Happy with how it turned out?* → **How was your appointment?**;
*How was the food today?* (narrowed to food while the form asks about five
things) → **How was your meal today?**; *Did we do right by you?* → **How did
we do on the day?**. The clinic asks nothing medical: the consultation
specifics are about explanation and time, not the condition.

### Effort, honesty, free text, public review

- **Effort.** Three screens, counted ("1 of 3"), one tap advances the first.
  About a minute, which the card promises and the flow keeps.
- **Honesty.** "Good, bad or somewhere between — we would like to hear it."
  under the question on every page; "No name or number needed. This goes to
  the {business} team only." under every step; "Skip anything that did not
  apply."; the star words are Poor / Not great / Okay / Good / Great.
- **Free text** is the last step and asks a question shaped by the taps —
  what to keep, what would have helped, or both — because "anything else?"
  is the question nobody answers. That is the only thing a rating changes on
  the page.
- **Public review** is offered to everyone or no one, in the same words,
  after feedback, with a plain way to decline. The thank-you page cannot see
  the rating (a compliance test pins it); the button names the destination
  ("Leave a Google review") rather than disguising it.
- **Nothing celebrated, nothing gated, nothing incentivised.** The "message to
  send" lines in six packs said "if today's visit was helpful, would you
  share…" and "an honest review helps other people decide" — a gate and a
  public-review pitch for a link that opens the private page. All twenty-one
  (English, Hinglish, Marathi × 7) now read "However today went, we would like
  to know — it takes about a minute and only we see it", and a compliance
  test now covers those fields.

## C. The QR and print kit

Geometry untouched: A4, two portrait tents, 88 × 123.2 mm faces, the QR
panel 40 mm square at 47 mm from the face top, cream / navy / gold. The QR as
drawn decodes (49 modules a side, 0.70 mm modules, 34.4 mm code, 4-module
quiet zone inside the white panel) for every vertical checked.

The card's words, top to bottom, restaurant:

```
CORNER CAFE
How was your meal today?                (bold 16 pt, one line)
Tell us honestly —                      (9 pt, two lines, broken at the dash)
good, bad or somewhere between.
[QR]
Scan — it takes about a minute          (8 pt)
Thank you                               (bold 11 pt, on the navy base)
This goes straight to the kitchen team. (8 pt)
```

The brief's proposals were adopted where they were stronger: "Tell us
honestly — good, bad or somewhere between." replaces "Scan and tell us
honestly — good or bad." on every card (it invites the middle); "About a
minute" moved to the caption under the code as "Scan — it takes about a
minute" (the verb belongs beside the code, and the base line already says
where the words go); the base line names the team on every pack and claims
only routing ("this goes straight to the clinic team"), never who reads it
when. The salon card asks "How was your appointment?" without "today" so the
question stays one line at 14.5 pt rather than two at 13 pt.

One rendering change: a two-line text now breaks at its own dash or colon,
else where the two lines come out most even, never greedily. The greedy
break set the new scan line as "…good, bad or somewhere" over "between.",
which on a printed card reads as a mistake. A new test renders every pack's
card and asserts the scan line ends above the QR panel with clearance.

The staff script was already neutral ("Whatever you thought of today, we
would like to hear it — it takes a minute and it goes straight to us") and is
unchanged.

## D. Demo data

Unchanged, and re-verified: 87 records (65 public reviews, 22 table-card
submissions), every table-card row shaped exactly as the current form stores
it, every tapped key one the current packs still carry. Relabelled specifics
resolve at read time, so the story now shows "Rude or dismissive" where it
stored `manner` — on a row whose written text describes exactly that. No
rebuild was needed and none was run; production was not touched.

## E. Engineering

**Changed:** `src/lib/gateway/copy.ts` (universal wording, three contextual
prompts, thank-you and share lines), `src/lib/packs.ts` (three optional
gateway prompts), all seven `packs/*.json` (wording only, keys unchanged),
`customer-form.tsx` (step count, mood-shaped last question, 44 px stars),
`thanks/page.tsx`, `src/lib/kit/tent.ts` (break rule), `src/lib/portal/view.ts`
(`PortalTapped` on every issue signal, from the dimension summary the analysis
layer already computed), `focus.ts` (no duplicate evidence block; the button
names its destination), `pages.ts` (Customers opening), `focus.tsx`,
`home.tsx`, `signal-board.tsx`, `reviews.tsx`, `checkin.tsx`,
`responsibility.tsx`, `workspace.tsx`, `portal-ui.tsx`. **Removed:**
`src/lib/portal/tallies.ts` and its tests (the figures it carried are all
stated once elsewhere).

**Verification:** `tsc` clean, `eslint` clean, the full suite green (72 files, 1,802 tests),
an isolated production build of the branch succeeds and served the customer
flow above. No horizontal overflow at 375 / 390 / 768 / 1024 / 1366 / 1440;
every link, button and summary at least 44 px on Home, Customers, Reviews,
Check-in, Improvements, the feedback form and the thank-you page (the one
16 px control is the checkbox inside the Reviews search form, whose label row
is 44 px); one `h1` per page.

**Performance:** Reviews now loads the evidence index it already shares with
every other page (one extra query, the same one Home and Customers make); no
other page gained a query. No client state was added to any owner page; the
customer form is the same client component with one derived value.

**Two hazards found and closed on the way:**

1. Six packs' copyable "message to send" lines gated the ask on a good
   outcome and pitched the private page as a public review; the earlier
   compliance guards covered the spoken script and the card, not these. Fixed
   in the packs; a compliance test now covers them.
2. Building in the isolated copy (`npm run build` = `prisma generate && next
   build`) regenerated the *shared* Prisma client with the copy's `.env` path,
   so every process in the repo loaded the copy's environment on import —
   eight gateway tests briefly failed with the copy's public address. The
   client was regenerated from the repo; the note is in the project memory.
   Production is unaffected (Vercel generates its own client).

**Not done, deliberately:** no new modules, no schema or RLS change, no
change to the tent geometry, no analytics, no rebuild of the demo.

## F. Scores

| Surface | Score | What keeps it from 10 |
| --- | --- | --- |
| Client portal | 9.8 | The Improvements page tells memory well but still does not say what Headway will check next for each change; the watch line per theme lives on Customers. A future pass could carry it onto the story card. |
| Feedback system | 9.8 | The mixed-visit question in the four "ongoing" verticals (gym, coaching, real estate, wedding) is the universal line, not a vertical's own phrasing. |
| QR / print kit | 9.8 | Two-line scan line at 9 pt on every card; a shorter universal line would set in one line at 10 pt, but the honest one is the longer one. |
| Overall | 9.8 | |

## G. Release

Not run in this pass. The steps are the M24 ones: `git merge --ff-only`
into `main`, push, watch the Vercel deployment, smoke-test Home / Customers /
Reviews / Improvements / Check-in / Account and one feedback submission
against the live card. No production data changes are needed.
