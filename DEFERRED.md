# DEFERRED

Things deliberately not built in V1, and why. This is a decision log, not a
backlog commitment.

## Ruled out permanently under the V1 constraints

| Item | Reason |
| --- | --- |
| Google Business Profile / Places / Maps APIs | Requires a Google account, platform approval and ongoing permission. Prohibited by the V1 hard rules. |
| Gemini as an AI fallback | Google-operated endpoint. Removed in M2 — see COMPLIANCE.md. |
| Gmail / IMAP ingestion | Requires OAuth and mailbox access. |
| Meta / WhatsApp APIs | Requires business verification and platform approval. |
| Scraping listings | Terms-of-service exposure, and it breaks constantly. |
| Automatic review-reply posting | Needs platform write access, and auto-posting on a client's behalf is the single riskiest thing this product could do. |
| Cloud hosting / multi-tenancy | Local-first by design. |
| Telemetry / analytics | Not needed by a single operator; adds a data-handling obligation for nothing. |

## Deferred past Day 1 (M5–M15)

- Reply drafting workflow with voice-profile enforcement and banned-word checks.
- Owner-facing monthly delivery pack (the PDF the client actually receives).
- Action tracking: recording that the owner *did* the recommended thing, rather
  than inferring it from the next snapshot.
- Multi-snapshot trend charts beyond the current period-over-period comparison.
- Bulk client operations and cross-client portfolio views.
- Content calendar and post drafting.
- Staff training material generation.
- Import of previously exported snapshots.

## Decisions taken during M3

**Printing goes through the browser, not Playwright.** The technical baseline
listed Playwright for local HTML to PDF rendering. M3 instead renders the kit as
a real print stylesheet and uses the browser's own print dialog, which gives the
operator a live preview, their choice of paper size and "Save as PDF" for free —
with no browser binary to install and nothing to go wrong offline. The
`playwright-core` dependency is therefore currently unused. It has been left in
place rather than removed unilaterally: it would be the right tool if RepOS ever
needs to write PDF *files* without a dialog (for example batch-generating a
month of client packs). Remove it if that never happens.

**Feedback kit assets are print sheets, not image downloads.** The kit prints an
A5 counter/table stand, eight cards on one A4 sheet, an A6 sticker and a staff
instruction card. A separate PNG export was not built because the print dialog
already produces both paper and PDF.

## Decisions taken during M4

**"Minutes" means recorded memory, not minutes of time.** M4 introduced a
`Minute` model — a short record of what happened with a client (conversation,
issue, decision, action, follow-up). The pre-existing `TimeEntry` model, which
stores minutes *spent* per client, is untouched but has been relabelled "Time
logged" everywhere in the UI so the two stop colliding.

**Time entry still has no screen.** `TimeEntry` rows can only be created
programmatically. The dashboard shows the KPI honestly as `0m — No time-entry
screen yet` rather than pretending. Either build the entry screen or drop the
stat; it should not stay in this state indefinitely.

**M4 records but does not track.** A minute has no done/open status and no due
date. Categories mark an entry as forward-looking (Decision / Action /
Follow-up) and that only changes how it is coloured. The real action loop is
M11.

## Decisions taken during M5

**Feedback reuses `ReviewItem` rather than adding a second model.** The model
already represented a piece of feedback; it was extended so every item belongs
to exactly one CLIENT (`clientId`, required) and *optionally* to a snapshot
(`snapshotId`, now nullable). The 44 existing snapshot-attached rows were
backfilled, not dropped, and now appear in the client's feedback inbox.

**Intake does not classify.** Items are stored with `sentiment=UNCLASSIFIED`,
`classifiedBy=NONE`, no language and `analysedAt=null`. Sentiment, themes and
language are the analysis layer's job.

**Deduplication is exact, not fuzzy.** A SHA-256 fingerprint of the normalised
text (lowercased, punctuation stripped, whitespace collapsed, NFKC) scoped per
client. Ratings and dates play no part.

## Review boundary rules (M5)

Item boundaries are the foundation of every downstream statistic, so the parser
uses structural signals in strict priority order and no length-based guessing:

1. `---` / `___` / `===` / `***` lines are hard boundaries.
2. Blank lines are hard boundaries.
3. Inside a block, a MARKER line starts a new review: a rating/date/name header
   on its own line, a leading quotation mark, a leading inline rating, or a
   bullet or list number. A marker only closes the previous review once that
   review already has text, so stacked headers stay attached to the body below.
   A review opened by a bare header stays open until the next marker, so its
   wrapped body is never split.
4. A block with no markers is ambiguous, and is resolved by how the operator
   structured the whole paste:
   - delimiters used anywhere -> unmarked lines are one wrapped review;
   - no delimiters at all -> the line break is the delimiter, one review per
     line, except lines that are plainly fragments (leading conjunction, or a
     previous line ending mid-clause).

## Decisions taken during M6

**Understanding extends `ReviewItem`; there is no second table.** Analysis
columns (`analysisStatus`, `themesJson`, `confidence`, `analysisReasonsJson`,
`analysisError`, `analysisVersion`, `analysedAt`) sit on the row the intake
layer already wrote. One item, one row, one place to look.

**The deterministic pipeline is the classifier, not the fallback.** Reading a
review always runs: language -> taxonomy match with negation -> sentiment
composition -> confidence. An AI suggestion is one more input to that pipeline.
It cannot introduce a tag outside the client's pack, and it cannot set the
stored sentiment — that is always recomposed by the same code.

**A rating alone never decides sentiment.** The wording leads and the rating
corroborates. Text and rating each produce a polarity, and the pair is composed:
agreement keeps the polarity, disagreement gives Mixed, a rating with no
recognisable wording is used on its own but says so. Every outcome carries a
plain-language reason.

**Analysis runs in the request, not in a fake background job.** RepOS is
local-first and has no worker. "Read N new" does the work while the button says
"Reading…", capped at 200 items per click so one press stays bounded. The
operator presses it again if more is waiting.

**A failed item fails alone.** Each item is analysed in its own try/catch and
marked `FAILED` with the error text. Successes in the same batch are kept, and
the failed item is picked up by the next run.

**A hint has to mean the thing on its own.** `clean-praise-hints.mjs` (M3) had
removed neutral nouns from praise taxonomies on the reasoning that issue buckets
"are entered via a complaint word". That was wrong — the classifier matches
every taxonomy hint independently, with no sentiment gate — and a five-star
salon review came back as Mixed, complaining about the haircut and the
appointment it praised. `clean-issue-hints.mjs` applies the same rule to issue
taxonomies in both English and Devanagari: bare nouns out, complaint phrases in.

**Negation is read across the clause, not just the adjacent words.** "Nobody at
the desk explained why" put its negator too far from "explained" for the
adjacent check, so it counted as a compliment. A narrow list of strong negators
(nobody, never, didn't, refused to, ...) now suppresses hints for the rest of
the clause, bounded by punctuation and by "and"/"but"/"though"/"however". A bare
"not" is deliberately excluded, because "not only was the staff friendly" is
praise.

**Pack edits do not silently leave stale readings behind.** `ANALYSIS_VERSION`
is bumped when a change should cause reprocessing. Stored rows keep their
version and are counted as not read yet — headline, filters, badges and theme
chips all agree — so the operator sees "49 still to read" and one click fixes
it. Nothing is rewritten behind their back.

## Decisions taken during M7

**Replies extend `ReviewItem` too.** Triage and draft columns sit on the row
the intake and analysis layers already wrote. One item, one row.

**Triage reads the stored analysis and never re-reads the text for sentiment.**
M6 already decided that and explained it; doing it twice would risk two
different answers to the same question.

**NEEDS_HUMAN is deliberately narrow.** Only escalation language (legal action,
police, consumer court), harm and safety language, or a demand for money back.
An angry one-star review listing three problems is exactly what a suggested
reply is FOR. An early version also flagged those, and a test caught that it
fired on most complaints — a flag that always fires tells the operator nothing.

**Priority is a sum of named signals, not a score.** Each signal has a fixed
weight and a plain-language reason, and the item page lists every one that
fired. Praise scores above zero on purpose: a business that never thanks the
people who liked it loses them.

**Two writers, one safety gate.** The deterministic writer composes from the
business's voice and the themes already found, so it cannot invent anything.
The assisted writer reads better. Both pass the same checks, and any failure at
all means the deterministic reply is used and the operator is told why.

**A draft is never partially accepted.** If an assisted draft trips any check
it is discarded whole, not patched.

**Theme labels never reach a customer.** "We are sorry about appointment /
waiting problems" is how a machine writes. Taxonomy entries now carry
`replyPhrase` — the same theme written the way a person would say it — in
English, romanised Hinglish and Marathi (`scripts/add-reply-phrases.mjs` and
`scripts/add-reply-phrases-intl.mjs`). A reply names ONE thing, the most
serious, rather than reading out an inventory.

**Voice rows are created empty, so the pack stays live.** This was the M3 kit
bug repeating itself: `createClient` copied the pack's voice preset into every
new client's `VoiceProfile`, which froze it. A salon whose pack speaks Hinglish
was replying in English because a months-old copy said `ENGLISH`. Blank now
means "follow the pack", exactly as it does for the kit, and the enum columns
default to `""` so they can be blank at all.

**Nothing is sent, ever.** There is no send/post/publish path, no messaging
deep link, and no scheduling. The batch button writes drafts; the operator
copies them. Guard tests in `tests/compliance.test.ts` fail the build if that
changes.

## Decisions taken during M8

**One insight object, many messages.** Everything an owner-facing message says
comes from `src/lib/comms/insight.ts`: themes with counts and evidence ids, the
change between the last two check-ins, the pack's advice for the top issue, and
what the operator recorded doing. The composer only phrases it. That split is
what makes the future client portal cheap — it renders the same object rather
than recomputing anything.

**Nothing is persisted and nothing is scheduled.** A prepared message exists
while it is on screen. A message table, an outbox or a reminder record would be
storage without a reader until the recurring pulse (M12) needs one, so the
reminder persistence layer is deliberately deferred and the follow-up text is
simply copyable — exactly as the milestone allowed.

**The owner update and the review reply are composed by different code.** One is
private, analytical and full of numbers; the other is public, short and about
one customer. Sharing a composer between them would have meant a stream of
conditionals and eventual leakage of analytics into a public reply.

**The recommended step is chosen, never written.** RepOS picks which of the
vertical pack's existing pieces of advice applies, based on which theme was
mentioned most. It does not compose advice, so it cannot invent an operational
change a business never agreed to.

**What was done is quoted; whether it worked is not claimed.** Recorded
decisions and actions from Minutes are shown for context. M8 has no before/after
measurement and says so — the closing line is always forward-looking ("we will
check the next batch"), never a claim of improvement.

**Owner messages carry numbers, so the numeric guard changes shape.** For a
review reply the yardstick is "did the customer say it?". For an owner update it
is "is it in the insight?" — `checkDraft` now takes an explicit allowed-number
set, and a miss there is blocking rather than a warning, because the owner acts
on what the message says.

**Reviewer-profile boilerplate stopped counting as PII.** The intake redactor
strips lines like "Local Guide · 50 reviews" when cleaning pasted text. That is
a tidy-up rule, not an identifier, and it was blocking every owner update that
said "Based on 50 reviews". Only real identifiers block now.

**Hindi was added as a fifth language.** The milestone requires owner
communication in English, Hindi, Hinglish and Marathi, and the voice enum only
had four options. Adding it widened `LanguageMix` everywhere, including the
reply writer, which now has Hindi sentence frames.

## Decisions taken during M9

**The board composes; it does not compute.** Health, themes, reply states,
recommendations and memory all come from the engines that already own them. Two
pure helpers were extracted so nothing had to be duplicated —
`summariseThemeRows` and `replyCoverageOf` — and tests assert the board agrees
with the health and reply layers rather than merely resembling them.

**Four queries, not one per client.** Clients, snapshots, feedback and minutes
are loaded once and grouped in memory. A per-client loop would have been easier
to write and would fall over at the point the operator actually has a portfolio.

**Priority is named signals with fixed weights, and shows its working.** The
same pattern the reply layer and the health engine already use. There is no
model anywhere near the ordering.

**A noted follow-up is never called outstanding.** Minutes record what happened;
nothing in RepOS tracks whether a follow-up was closed. The signal says "noted
N days ago and nothing recorded since", and a test asserts the wording never
drifts into "overdue" or "unresolved".

**No workflow states were invented.** Every next action maps to a screen that
exists, asserted by a compliance test against the real route list. There is no
snooze, no assignment and no due date, because none of those are stored.

**A missing snapshot is not low data.** The first cut showed a "No snapshot yet"
warning box beside a named complaint with real counts, which read as a
contradiction. Low data now means only what it says — no feedback, nothing read,
or below the naming floor — and the missing snapshot is stated once, in the
reasons.

**The health badge is scoped on the card.** It reads "Health: Insufficient
data", because that status is about snapshots. Unscoped, it looked like a
verdict on a client who had plenty of feedback and an obvious problem.

## Decisions taken during M10

**M10 introduced a separate intelligence model; M8 now projects from it.** The
owner insight object was shaped for composing a message — flat theme lists, one
top issue, message-safe numbers. Intelligence needs ranked signals with named
reasons, per-theme movement, evidence ids and stable ids. Rather than bend one
object to two jobs or run two calculations, `buildIntelligence` became the
single calculation and `buildInsight` a projection of it. The command centre
uses the same ranking. One verdict, three presentations.

**The pulse gained `topPraises`.** Its periods already counted issue themes;
praise was computed by the same helper and simply not kept. An owner deserves
to hear "the food is being praised more", not only "waits are worse".

**Ranking is named signals with fixed weights, and severity can beat volume.**
A pack-declared serious complaint named by three customers outranks a harmless
theme named by twenty, because that is the judgement a good operator would
make. Volume is capped so it can never run away with the ordering, and every
point carries the sentence that explains it.

**The naming floor applies to movement too.** Two mentions falling to none is a
large percentage of almost nothing. Such a movement is reported as compared but
too small to read as a direction, rather than as an improvement.

**A theme absent from both check-ins is not "holding steady".** The check-ins
hold observed reviews; theme counts on an insight come from the feedback pile.
A theme can be well evidenced in one and absent from the other, and calling that
steady would be a claim about reviews that never mentioned it.

**The overall trend still comes from the pulse engine.** Its direction is built
from rating, negative share and unanswered share — all proportions — so a client
who merely collected more feedback can never be reported as improving. Mention
counts describe individual themes, with the volume caveat attached whenever the
two check-ins hold very different amounts of feedback.

**"Owner update ready" now means there is something to say.** The board used to
offer it whenever any theme row existed, which sent the operator to copy a
message reading "nothing is coming up often enough yet". It now asks the
intelligence engine whether anything cleared the evidence floor.

**Three things at most, and honest when there are fewer.** The panel says "Only
2 clear signals so far" rather than padding to three, and a theme that both
needs attention and is getting worse is one headline, not two.

## Decisions taken during M11

**The action freezes what RepOS said, and never recomputes it.** Intelligence is
rebuilt on every page load. An action written in March has to keep saying what
RepOS recommended in March, on the evidence it had, even after the theme drops
below the naming floor. Three blocks are copied onto the row and never touched:
the insight (with its stable M10 id), the recommendation, and the baseline.

**The recommendation and the decision are different fields.** RepOS may say
"review booking capacity"; the owner decides "cut 6-8pm to five an hour". The
second one is what actually happened and what has to be remembered, so accepting
without describing it is refused.

**Six states, and nothing else.** RECOMMENDED, ACCEPTED, DONE, MEASURED, plus
DECLINED and PAUSED. No assignment, no snooze, no due date, no escalation —
because RepOS records none of those things. DONE -> ACCEPTED exists only so a
mis-click is correctable without destroying the history.

**"Done" means the business says it happened.** That sentence is the stored
meaning of the state, is printed on the card, and is asserted by a compliance
test. Whether customers noticed is a different question with a different answer.

**Measurement compares shares, and defaults to "not enough yet".** Both sides
are a proportion of their own denominator, both need ten read items, and the
share has to move by five points before a direction is called. All three numbers
are the health engine's existing floors rather than new ones invented here.

**A theme vanishing from four new reviews is not success.** It is the most
flattering reading available and the least justified, so it is reported as
insufficient data with that reason spelled out.

**The after window never overlaps the baseline.** It starts at the later of "the
change was made" and "the baseline was frozen". Without that floor, an action
agreed and marked done on the same morning would count its own baseline evidence
on the other side of its own comparison.

**Nothing says "because".** The engine describes what happened after a change
and states in every result that it cannot show causation. With one business, no
control group and self-selected reviews, nobody could.

**A decision becomes an ordinary Minute.** Actions keep no second memory system;
accepting one optionally writes a DECISION minute and stores its id, which the
owner-update layer already reads.

**The numeric guard lets the operator's own words through.** The guard exists to
stop RepOS stating a statistic it cannot evidence. A sentence a human typed and
is about to send themselves is not that — without the exemption, "cut 6-8pm
bookings" made the whole message unsendable.

**A re-measure is offered only when something new has been read.** Otherwise the
button would return the answer already on screen.

## Known limitations accepted for now

- **Intelligence is recomputed on every page load.** For a single operator with
  a portfolio of local businesses this is a few milliseconds of arithmetic over
  rows already being read. Caching it would introduce the one failure mode this
  milestone exists to prevent: an insight outliving its evidence.
- **Theme movement compares snapshot reviews, not the feedback pile.** The two
  are different piles with different scopes, and both are labelled wherever they
  appear — "across the 50 reviews read so far" against "at your check-in on
  February 2026". Attaching feedback to a period would be a data-model change,
  not an intelligence one.
- **Nothing tracks whether an insight was acted on.** The insight ids are stable
  and the evidence, comparison and snapshot references are all exposed for the
  action loop to key off, but no completion state, outcome or reminder exists.
  That is M11.
- **An action measures one theme.** A change that improves waiting times and
  worsens billing is two actions, or one action and an operator note. Modelling
  multi-theme effects would need attribution RepOS cannot honestly do.
- **The before/after boundary is a date, not an exposure window.** A customer
  who visited before the change but wrote afterwards counts as "after". At SMB
  review volumes the alternative — asking the operator to date every visit — is
  worse than the imprecision, and the limitation is stated on every result.
- **Nothing recomputes a frozen result.** A measurement stays as it was reported
  until the operator measures again. That is deliberate: an owner has already
  been told the number.
- **No AI anywhere in the loop.** Optional AI phrasing of a learning note was
  considered and left out. Deterministic text was sufficient, and a model in
  this particular path would put a generated sentence next to an evidence claim.
- **The command centre has no filtering, search or saved views.** It is one
  ordered list. At the scale a single operator works at, sorting by what is
  most pressing is the whole feature; filters would be furniture.
- **Nothing on the board refreshes on its own.** It is computed when the page
  is requested. There is no polling, no websocket and no revalidation timer,
  which is also what keeps the no-telemetry and no-background-work rules easy
  to prove.
- **Theme names stay in English inside a Hindi or Marathi owner update.** The
  sentences around them are localised; the category labels are not. Translating
  a hundred and nineteen category names badly would read worse than an English
  label inside a Marathi sentence, which is how these businesses already write.
  Adding per-language labels is pack data, not code.
- **The owner is written to in the same language the business replies to
  customers in.** There is one language preference per client, not two. A
  one-click switch on the panel covers the case where the owner prefers
  something different, without adding a setting nobody would maintain.
- **An owner update has no per-period totals of its own.** Theme counts are
  across all analysed feedback; the comparison section is between the last two
  snapshots. Both are stated with their scope so they cannot be read as
  contradicting each other, but a true monthly figure needs the monthly report
  (M14).
- **The deterministic writer is a composer, not an author.** Two complaints
  about the same theme get the same suggested reply, because it assembles fixed
  sentences around one theme phrase. It is a safe starting point the operator
  edits, not a finished reply; with an assistant configured the wording varies
  properly.
- **Only the lead theme is named in a reply.** A review raising three problems
  is answered about the most serious one. Naming all three reads like a summary
  rather than a reply, and the operator can add the rest when editing.
- **Reply phrasing exists in English, Hinglish and Marathi only.** A client set
  to a language RepOS has no phrasing for would get a general acknowledgement
  rather than a named one. Adding a language is a pack-data change.
- **The taxonomy reader is a phrase matcher, not a language model.** It handles
  negation, clauses and Devanagari, and it is deliberately biased toward saying
  nothing over saying something wrong. It will miss phrasings nobody has added
  to a pack yet: recall grows by adding hints, and a miss shows up as a theme
  that simply is not listed, never as a wrong one.
- **`real_estate` has no generic "the agent was good" praise theme.** Its praise
  taxonomy is built from specific qualities (honest, responsive, knows the
  area), so a review that only says "the broker was good" registers as positive
  with no theme. Adding such a theme is a taxonomy decision, not a hint fix.
- **Pack edits between versions need a manual "Read again".** `ANALYSIS_VERSION`
  covers changes to the engine. Editing a pack's hints without bumping it leaves
  earlier readings in place until the operator asks for a re-read.
- **The keyword classifier is a fallback, not a peer of the AI classifier.** It
  handles negation and Devanagari, but it is a heuristic. Reports label which
  classifier ran.
- **Pulse periods are snapshot-to-snapshot, not calendar months.** A period is
  whatever the operator actually measured. Calendar windows would require data
  RepOS does not have.
- **Star ratings and dates are only used when the pasted text contains them.**
  Neither is ever inferred.
- **Health status is recomputed from stored review rows, not from the frozen
  report JSON.** Changing a client's vertical therefore changes future health
  theme labels, while already-generated snapshot reports keep the taxonomy they
  were built with.
- **Kit wording follows the vertical pack live.** Kit override fields are stored
  blank so a later improvement to a pack reaches every client already onboarded.
  An operator who types an override is opting that client out of future pack
  improvements for that one field.
- **Unmarked lines inside a delimited block are kept together.** If the paste
  uses blank lines or `---` anywhere, those are treated as the operator's chosen
  delimiter, so several unmarked prose lines inside one block are read as a
  single wrapped review. Separating them is done by adding a blank line. This
  follows the rule that when the parser cannot tell, it preserves the text
  rather than inventing extra reviews.
- **Copy-to-clipboard needs a secure context.** Over plain http on the LAN the
  Clipboard API may be unavailable; the copy buttons fall back to the older
  selection method, which works but is less reliable in some mobile browsers.
