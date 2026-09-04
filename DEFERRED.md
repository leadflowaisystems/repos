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

## Decisions taken during M14

**The public address is a random token on the existing client, not a new
identity.** A `FeedbackGateway` row per client holds a 22-character token from a
32-letter alphabet (110 bits), unique and stable for the life of the client. The
database id is never in a customer-facing URL. The alphabet drops `i`, `l`, `o`
and `1` so a token read off a photographed card still resolves.

**QR feedback is a source value, not a second pipeline.** `source` on
`ReviewItem` gained `REP_OS_QR` alongside the four the operator already picks
from. One row, one reading, one intelligence, one set of owner pages. A future
public-review or messaging source is a new value in `DIRECT_SOURCES` and a
caller of the same `ingestFeedback`, not a new table.

**Intake grew a source-neutral entry point rather than a branch.**
`src/lib/feedback/ingest.ts` redacts, decides duplication and writes one row.
The paste box keeps its own path because it parses many reviews out of one
blob; both end at the same columns.

**Duplicate rules differ by source, because they have to.** Pasted reviews stay
`EXACT_FOREVER`: identical wording for a client is the same review pasted twice.
The public page uses a window instead — identical wording within ten minutes is
one person tapping twice, and the same words a fortnight later are two customers
who both wrote "good". A rating with no words dedupes over thirty seconds only.
Nobody is asked who they are, so time is the only honest signal, and it is used
narrowly rather than as fuzzy matching.

**A rating with no words is stored with empty text, not invented text.** The row
keeps `text: ''` and every list shows "Rating only — no written comment." in its
place. Writing a sentence into the customer's mouth would corrupt the evidence
the whole product rests on.

**Private feedback is not a review to answer.** Nobody gave a name or a contact,
so triage files QR items as needing no response with that reason attached rather
than parking them in a reply queue forever. Harm, money-back and escalation
language still reaches the operator, because that flag is about attention rather
than about replying. `hasReplyChannel(source)` is the one place that decision
lives.

**The thank-you page is deliberately ignorant.** It is reached by token alone and
is handed nothing about the rating or the words, so review gating is impossible
by construction rather than by policy. The optional public review link is shown
to every customer or to none.

**Abuse protection is in-memory and forgets by design.** Per-page and
per-address sliding windows, a per-render form nonce, a honeypot field, a
two-link ceiling and a length cap. Keys are hashed with a salt regenerated at
every application start, so a counter cannot be joined back to an address later.
No CAPTCHA, no external service, no fingerprinting, and no address written
anywhere.

**The QR encodes an address RepOS cannot discover for itself.** The operator
saves one public base address for the whole installation, offered as one-tap
choices read from this computer's own network interfaces. Until they do, the
address RepOS was opened on is used and the page says plainly when that would
only work on this computer. Cards already printed keep the address they were
printed with — nothing rewrites a QR someone laminated.

**The print kit and the feedback card are different assets on purpose.** M3's
kit QR sends a customer straight to a public review page. M14's card opens
RepOS's own page, where anything can be said privately and the public review
link is offered afterwards. Both exist because they answer different questions,
and the operator page says which is which.

## Decisions taken during M15

**Responsibility is a placement, not a calculation.** The engine takes the
owner's view M12 already built — buckets, advice stages, outcomes, watch lines,
owner context — and places each theme in one of six states: needs a decision,
needs following through, being protected, being watched, waiting for evidence,
or nothing. No count, share, sentiment or threshold is produced in
`src/lib/responsibility/`; a compliance test asserts it reads M10, M11 and M12
and re-derives none of them.

**One item per theme, and severity still beats volume.** Ordering is the state
first, then M10's own rank with its named reasons, then a handful of named
signals about the loop or the owner (came back after improving, read worse after
the change, agreed but not made, comparison due, the owner said this matters
most). Ties break by name, so the order is stable between refreshes.

**A quiet business gets "nothing needs you", not a manufactured task.** CLEAR
is a first-class answer. So is "not enough feedback yet to say": below the
evidence tier nothing is recommended, and everything below the naming floor is
one calm line rather than a list of alarms.

**"Keep the change in place" is the answer to a measured improvement.** A
complaint that read better after a change is something to protect, not
something to act on again, so it sits with the strengths and the owner is told
nothing needs them. It becomes a decision again only when it starts coming back
— which is its own named reason.

**A declined suggestion is remembered as the owner's call.** RepOS keeps
watching the complaint and says so, but does not ask again. Nagging is not
proactivity.

**"Since your check-in" is said only when there is a check-in to be since.**
The work lines count feedback by evidence date after the latest check-in — read,
unread, and how many came through the feedback page — and say "no new feedback
has come in" when that is the truth. Nothing pretends work happened on data that
did not arrive.

**The next useful check is a condition, never a countdown.** It reuses the
floors that already exist: a comparison is due when the measurement floor is
met; a check-in is worth taking when enough new feedback has arrived or the
snapshot has gone stale by the command centre's own rule.

**The strengths carried on Home are the featured one, plus any the owner named
or that has a change attached.** Every strength is still on Customers; listing
five "keep doing this" rows on Home was noise, not responsibility.

**The operator sees the same object.** The client overview opens with the same
answer the owner's Home opens with, so the two can never disagree about what
needs doing. The operator's own queue stays on the command centre.

## Decisions taken during M16

**The password lives in `.env.local`, not in the database.** A credentials table
would mean either a public first-run setup page — a race anyone who found the
server could win — or a seeding step that is easy to skip. It would also put a
password hash inside every backup. Keeping it in the environment file means
RepOS simply cannot be signed into until the operator has run
`npm run set-password` on the machine itself, and a stolen backup is worth
nothing to an attacker.

**The stored hash is colon-separated, not the usual `$`-separated PHC shape.**
Found the hard way in the production test: the env loader expands `$NAME` inside
a value, so `scrypt$N=32768,r=8,p=3$salt$hash` reaches the application as
`scrypt=32768,r=8,p=3`. The operator would have been locked out by a password
that was in fact correct. Colons cannot be corrupted by any quoting rule and
never appear in base64url.

**scrypt from `node:crypto`, not bcrypt or argon2.** Both of those are
dependencies with native builds; scrypt is in the standard library and is a
memory-hard KDF. N=2^15, r=8, p=3 follows current OWASP guidance and costs about
a seventh of a second per attempt — invisible once a day, punishing in bulk.
`maxmem` has to be set explicitly, because Node's 32 MiB default rejects N=2^15
even though 128·N·r is exactly that.

**Middleware is a courtesy; the action is the gate.** A Server Action POST is
addressed by an internal action id, not by the page path, so no path-matching
middleware rule can decide whether it runs. `requireOperator()` is therefore the
first statement of all 41 guarded actions, with a compliance test that walks
every exported action and fails if one is missing it. Middleware only saves an
unauthenticated visitor from watching a page render before being bounced.

**The session is a signed cookie, with no server-side store.** Adding a session
table would let a single stolen cookie be revoked, at the cost of a write on
every request and a second thing to back up. For one operator on one laptop the
honest trade is: the cookie expires in eight hours, and rotating
`REPOS_SESSION_SECRET` ends every session at once. That is the lever, and it is
documented rather than hidden.

**The owner's link is the credential, and there is no owner password.** Giving
business owners accounts would mean RepOS holding their credentials, resetting
them, and answering for them. A 110-bit secret link, revocable in one click, is
the same security property with none of that surface — and it is the same
mechanism the customer feedback page has used since M14.

**Issuing and revoking a link live with the operator's client operations, not
with the portal.** The M12 rule that nothing on the owner's path writes to the
database is enforced by a test that scans `src/lib/portal/`. Rather than weaken
that guard with an exemption, the two write functions moved to
`src/lib/clients/service.ts` — which is where they belong anyway, since both are
things the operator does to a client row.

**An archived client's link goes quiet.** Archiving means RepOS no longer serves
that business, and its owner link stopping is the safe reading. Restoring the
client brings the same link back.

**A missing public address produces no QR at all.** The alternative — falling
back to `localhost` or to whatever `Host` header arrived — puts an address into
a printed card that can never be corrected. A configuration error the operator
can see and fix is strictly better than a card that opens nothing.

**`REPOS_PUBLIC_BASE_URL` also configures Server Action origins.** Next compares
`Origin` against `Host` before running an action, which breaks behind a reverse
proxy unless the public host is declared. Deriving it from the same variable the
QR codes use means there is one address to configure and no way for the two to
disagree.

**Backups use `VACUUM INTO`, not a file copy.** SQLite writes the copy itself
inside a read transaction, so it is a single consistent moment even if RepOS is
in use — which a file copy cannot promise — and it refuses to overwrite, which
is the guarantee a backup feature needs most. The copy is written under a
temporary name, checked with `PRAGMA integrity_check` through an `ATTACH`, and
only then given its real name, so a file in `backups/` is always one that passed.

**Backups are manual.** A scheduler would be a background process, a failure
mode nobody watches, and a promise RepOS cannot keep when the laptop is closed.
The operator presses a button, or runs `npm run backup` from a scheduled task
they own.

**The portal's not-found page sits above `[token]`, not inside it.** The token is
resolved in the layout, and a layout that calls `notFound()` is caught by its
parent segment — a file inside `[token]` is never reached. Found in the
production test, where the generic root 404 was rendering instead.

**The schema change is two nullable columns.** `portalToken` and `portalTokenAt`
are added to `Client`, nothing is dropped or renamed, and tokens are issued
lazily the first time a client's page is opened — so an existing installation
needs no migration step anybody could forget to run.

**`playwright-core` was removed.** It has had no importer since the print work
moved to browser printing, and an unused dependency with a native browser
download is not something to carry into a security milestone.

## Decisions taken during M17

**The printed kit's QR now opens RepOS, not a public review site.** This is the
single change M17 exists for. The M3 kit predates the M14 feedback gateway, so
it encoded whatever public review link the operator had pasted in — while the
words printed above it said "scan and tell us honestly, good or bad". The card
promised a private channel and delivered a public one, and a business running
that kit generated no rows at all in the product it was paying for, while its
health, intelligence, action loop and owner portal all read from that empty
pile. This file previously recorded the two QRs as a deliberate choice. Under
the locked direction that choice is wrong, and it was the decision producing
every other contradiction in the area.

**Kit readiness no longer requires a public review link.** It required one, with
the blocker text "Add the public review link — open the business's public
listing yourself". A business with no listing could never print a card, and its
client page showed a permanent "setup still to do" box naming two things it
would never do.

**The staff scripts were rewritten in all seven verticals.** Every one made the
ask conditional on the customer already being pleased — "after the guest said
they enjoyed the meal", "if you are happy with how it turned out", "once the
client confirms the process went smoothly" — and asked for something that
"helps other people decide", which is a public-review ask by definition. The
same printed sheet carried "Never show the QR only to guests who looked happy".
Staff follow the script and the timing cue, not the box; this was the one real
sentiment-gating risk in the product and no test caught it. A compliance guard
now fails the build if a conditional cue reappears, in any pack, in any of the
three languages.

**A check-in covers the feedback that arrived in its window.** Measured on the
real database: 198 of 332 stored feedback items, including every QR submission,
were invisible to the health card and to every before-and-after comparison,
because a check-in could only see feedback pasted directly into it. For a
QR-only client that meant the comparison window was never available, every
insight's movement read INSUFFICIENT_DATA, and the health card said "no snapshot
has been taken yet" regardless of how much private feedback had arrived — while
the intelligence engine, reading the same rows, produced a high-severity
insight. This changes which evidence a period contains, not what any of it
means: no count is reweighted, no sentiment reinterpreted, and the health engine
itself is untouched.

**Feedback arriving after the newest check-in belongs to no check-in.** The
first attempt gave the newest check-in an open upper bound, on the reasoning
that it represents the present. It does not: a check-in taken in March would
then quietly absorb what a customer said in September and keep re-reading itself
as current. A test caught it.

**Handled is one field.** `setHandled` used to write both `handledAt` and
`draftStatus`, so reopening an item RepOS had written every word of relabelled
it EDITED — the operator's own wording — and permanently exempted it from being
rewritten under newer rules. One mis-click was silently unrecoverable. Handled
and who-wrote-this are separate facts and are now stored separately.

**"Still to handle" counts outstanding work, not what triage decided.**
`needsReply` is a population count that never moves, so an operator who drafted,
copied and marked twelve replies watched the headline sit at 12. Worse, the
owner's portal already dropped handled items from its own count, so the two
sides of the product disagreed about the same work. The population counts are
kept — they are the right number for a filter chip — and `replyOutstanding` and
`youOutstanding` were added for the headlines.

**Mark handled is reachable for every item.** It lived inside the draft panel,
so for the two categories that most need closing off — the ones RepOS
deliberately writes nothing for, and the ones needing no reply at all — there
was no button anywhere in the product. Anonymous QR feedback has nobody to write
to, so marking it handled is the only way it can ever stop asking.

**The command centre knows about setup.** It had no field for the gateway, the
portal link or onboarding at all, so a client collecting nothing because nobody
printed the card looked identical to one whose card is on the counter and simply
quiet — and the board could tell the operator to "bring in feedback" for a
client whose feedback page it did not know was switched off. The board's first
instruction for a brand-new client was "paste the reviews you have collected",
which a business with no listing has none of.

**Client status caps how urgent a client can look.** `Client.status` was read by
nobody. A prospect being pitched and a paused client nobody is billing ranked
alongside a paying business with a complaint pattern, which at twenty clients
makes the lower bands worthless. Nothing is hidden; the ceiling only stops them
outranking the businesses actually being served.

**Clients with nothing waiting are named, not detailed.** The NOTHING band was
defined and never rendered, so fourteen calm businesses meant fourteen full
cards under a heading reading "lower priority", each saying nothing is flagging.

**A new client gets its feedback page at creation.** The gateway row was created
lazily, the first time somebody opened one particular tab, so a client could be
created, profiled, given a baseline and marked active while having no front door
at all — and nothing said so.

**"The owner has been sent their link" is recorded.** A token existing is not a
business being onboarded: RepOS mints one the first time the operator opens the
client page, so `portalTokenAt` records a page view. `portalLinkSentAt` records
the handover, which is what makes "which of my twenty clients have I actually
onboarded?" answerable.

**The vertical must be chosen.** The select fell back to the first option, so an
operator who tabbed past the field onboarded a restaurant with clinic taxonomy,
clinic wording and clinic banned words — and `required` never fired, because
something was already selected.

**The setup checklist was rebuilt around what the direction says matters.** It
scored a client on a baseline rating, a competitor and a printable review kit —
all of which need a public listing — and checked nothing about the feedback QR
being live, the cards being out, or the owner having their link.

**The grouping line reaches the owner.** "Grouped them into 5 things customers
keep raising, and set aside 4 topics mentioned only once or twice" was computed
and dropped on the floor, along with the whole `PortalView.work` list and the
`WorkList` component built to render it. It is the clearest statement of the
work the owner would otherwise be doing by hand, which is the thing they are
paying for.

**Backwards-compatible throughout.** One additive nullable column
(`portalLinkSentAt`). No column was dropped or renamed, and the schema change
was tested on a copy of the live database before being applied to it.

## Decisions taken during M18

**The evidence page pages, and every filter moved into the query.** The owner's
Reviews page shipped up to 300 comments in full — 742KB, 455KB of it the
serialised React payload, on a phone. It now sends 25 with a Show more, and the
operator's own queue sends 50. More importantly the theme filter, the text
search and "needs your answer" all moved into SQL: they used to run in memory
AFTER the row limit, so a theme chip reading "40" could open a list of twelve,
silently, on the one page whose entire job is proof.

**The count beside a filter and the list it opens are now one predicate.**
`replyWorth` was counted with `handledAt: null` plus a priority test, while the
filter also excluded `NO_RESPONSE_NEEDED`. The number and the list could
therefore disagree. Both now call `countClientFeedback`/`listClientFeedback`
with the same `worthReply` filter.

**Theme labels resolve from the pack, not from the stored row.** Analysis froze
the label into each item's `themesJson`, so improving a vertical's wording
reached new clients and never existing ones. The KEY stays authoritative and
stored; only the wording is looked up as the pack stands today, with the stored
label kept as a fallback for a key the pack no longer carries. This is what made
the nine label fixes below reach 4,933 already-analysed items with no
re-analysis.

**Nine praise labels were adjectives, not things.** Every praise label is
rendered inside "Customers praise your <label>", which produced "Customers
praise your clean and well-kept" as the first line of the owner's Home page.
Rewritten as noun phrases, with a guard so an adjective cannot come back.

**"48 of the 10 pieces needed so far."** Real output on every busy client, on
four surfaces, because the have/need sentence was never clamped. Once enough
feedback has arrived it now says so.

**"Found no new issue strong enough to recommend action" printed above a live
follow-up.** The test was `!hasDoNow`, so any other state in "Needs you" — a
comparison due, for instance — still counted as a clear read. It now tests
whether anything at all is waiting on the owner.

**"0 at Check-in 1 and 0 at Check-in 2" told an owner with 261 comments that
RepOS had nothing.** True, and unreadable: everything had arrived after the last
check-in, which is what the M17 window rule means. It now says that, and names
the fix — another check-in.

**Copy for WhatsApp and Copy for Email.** One body, two framings: WhatsApp gets
the text untouched, email gets a subject, greeting and sign-off in the owner's
own language. No fact differs between them, so the safety check that runs on the
body covers both. RepOS still sends nothing, and the panel says so.

**The backup test stopped sharing one temp directory.** It cleared a
pid-keyed directory between cases; on Windows, removing a directory whose SQLite
file was just attached and detached fails while the handle closes, which made a
dozen tests fail at random under parallel load. Each case now gets its own.

**A messaging-deep-link guard was tightened, not loosened.** M18 added a field
named `whatsapp` holding copy-ready text, which tripped a guard matching the
bare string `whatsapp:`. The guard now matches URI schemes in string and href
position only — and a second test proves it still catches `wa.me`,
`whatsapp://send`, `mailto:?body=`, `sms:?body=` and `api.whatsapp.com`.

## Known limitations accepted for now

- **Server latency was measured under two different machine conditions and the
  two runs are not comparable.** Payload sizes are deterministic properties of
  the response and the reduction is real; the wall-clock numbers are not a
  before/after. Every route measured under 400ms with 20 clients and 4,933
  feedback items, the slowest being the command centre and the QR page, whose
  cost is SVG and PNG generation.
- **`getBoard` still loads every review of every snapshot** to use the newest
  two per client. Fine at 4,933 items; a scaling risk at ten times that.
- **Feedback that arrives after the newest check-in belongs to no comparison
  window** until the next check-in is taken. Honest and deliberate (M17), but it
  means the comparison layer always lags the intelligence layer by one check-in.
- **The operator's feedback queue still has no next/previous.** Back returns to
  the filtered list, and the list now pages, but working twenty items is still
  twenty opens and twenty backs.

- **The M17 audit found far more than M17 fixed.** A subsystem-by-subsystem
  audit produced roughly 120 findings. M17 acted on the ones that block the
  locked product direction or contradict it outright, and deliberately left the
  rest. The larger ones still open, in rough order of value:
  - **No cross-client work queue.** Reading feedback, drafting replies and
    preparing owner updates are one-client-at-a-time button presses. The monthly
    cycle for twenty clients is twenty rounds of open-read-draft-review-copy.
  - **No next/previous inside a feedback queue.** M17 made Back return to the
    filtered list it came from; working twenty items is still twenty opens and
    twenty backs.
  - **"Send the owner update" can never be cleared.** Nothing records that an
    update was sent, so the prompt fires forever for every client with a
    headline. The operator learns to ignore the one button that represents the
    delivered service.
  - **The customer-facing feedback page is English-only.** The pack `gateway`
    block has no Hinglish or Marathi fields, unlike `kit`. The primary
    customer-voice channel for Indian local SMBs asks in English.
  - **The board loads every review of every snapshot of every client** in order
    to use the newest two per client. Correct, and wasteful at twenty clients.
  - **No client search or switcher.** The alphabetical client list is the only
    way from one client to another.
  - **No batch printing.** Twenty businesses is twenty tabs and twenty print
    dialogs.
  - **M13 context is collected and barely used.** "Already tried" is recorded,
    shown, and then ignored by the recommendation layer; the owner's answer to
    RepOS's own question changes nothing. Constraint coverage is 8 of 70 issue
    themes, and zero for three of the seven verticals.
  - **The owner cannot answer their own question or accept a recommendation.**
    The portal is strictly read-only, so every decision costs an operator
    conversation plus an operator click.
  - **The Reviews page filters in memory after a hard limit of 300 rows,** so
    past 300 stored items an evidence link can show fewer comments than the
    count that sent the owner there.
  - **`getPortfolioHealth` is dead code** with no callers anywhere.

- **A stolen session cookie cannot be revoked individually.** There is no
  server-side session list, by choice. The cookie expires after eight hours, and
  rotating `REPOS_SESSION_SECRET` ends every session at once.
- **There is no rate limit on sign-in attempts.** scrypt at these parameters
  costs about a seventh of a second per attempt, which is the brake. A counter
  would need shared state that a single-process local application does not have,
  and a lockout would be a way to lock the operator out of their own tool.
- **The login page names the missing variable when the install is misconfigured.**
  A stranger who reaches `/login` on a half-configured server learns that no
  password is set. They still cannot get in, and the alternative — a generic
  "wrong password" — would strand the operator with no way to diagnose it.
- **RepOS does not terminate TLS itself.** It expects a reverse proxy in front of
  it in production. Certificates, renewal and HSTS are that proxy's job, which is
  why RepOS sets no `Strict-Transport-Security` header of its own.
- **Backups are only as safe as where they sit.** RepOS writes them beside the
  installation and says so on the Settings page, but copying them onto another
  drive is the operator's step, and nothing checks that it happened.

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
- **A customer's phone has to be able to reach this computer.** The feedback
  page is served by the same local application as everything else, so on a
  shop's own Wi-Fi it works and away from it does not. That is a hosting
  decision, not a gateway one, and hosting is out of scope by rule. The
  operator page states the limitation rather than hiding it.
- **The public page has no rate limit that survives a restart.** Counters live
  in memory, deliberately, because the alternative is writing something
  per-visitor to disk. A restart resets the ceilings; the duplicate window,
  which is stored, still holds.
- **A determined person can submit repeatedly.** Without an account, a CAPTCHA
  or tracking — all three ruled out — the ceilings are the honest limit. They
  stop a stuck finger, a double tap and a crude flood, which is what a counter
  actually sees. The operator can pause a client's page in one click.
- **Nothing notifies the operator when feedback arrives.** The Feedback QR tab
  shows what came in and how much is unread, and the dashboard already
  surfaces unread feedback. There is no push, no email and no timer, by rule.
- **QR feedback carries no rating unless the customer gave one.** Ratings are
  optional by design, so the average rating on the owner's pages is over the
  items that have one, exactly as it already was for pasted reviews.
- **One public base address for the whole installation.** A client-by-client
  address would be a second setting to maintain for a case one operator on one
  laptop does not have.
- **The responsibility state exists when a page is opened, not before.** It is
  computed from stored rows on every read, by rule: no timer, no background
  process, no notification. That is deliberate — the state is the local product
  fact a later delivery channel would carry — and it means nobody is told
  anything until they open RepOS.
- **"Needs your own words" counts what the reply engine flagged, nothing
  more.** A review the reply engine handed to a person (harm, money back,
  escalation) is a follow-up until it is marked handled. RepOS does not judge
  whether the owner has dealt with it outside the tool.
- **A theme's "last seen" date is not carried.** The evidence rows are one
  link away and the movement is stated at check-in level; a per-theme latest
  date would need the evidence dates joined to every theme on every read, for
  a line that would rarely change what the owner does.
- **The responsibility of an archived business is still computed.** Its
  workspace stays readable, so the state is shown with the inactive note
  rather than hidden.
- **A cafe runs on the restaurant pack and a spa on the salon pack.** Both are
  served well by them: the questions a cafe customer answers are the food, the
  service, the wait, the cleanliness and the value, which is exactly what the
  restaurant pack asks. A dedicated pack is roughly twenty kilobytes of
  hand-written taxonomy, staff script and kit copy per vertical, and writing
  one before an actual cafe client exists would be guessing at wording nobody
  has read out loud yet.
- **The owner cannot turn a question off, reorder them or reword one.** The
  vertical pack decides what a business asks and in what order. Per-client
  overrides need somewhere to store them, an editor to change them, and a rule
  for what happens to ratings already collected against a question the owner
  later removes — a small admin system for a choice the operator can make by
  editing the pack. The gateway reads the pack at request time, so a pack edit
  already reaches every client on that vertical immediately.
- **A customer without JavaScript can rate everything but cannot tap a
  specific.** The whole form is server-rendered and posts in one go, so the
  overall rating, every one of the vertical's questions and the open box all
  work. The quick specifics appear once a question is rated poorly, which
  needs a browser that runs the page — and someone in that position still has
  the text box for the same detail.
