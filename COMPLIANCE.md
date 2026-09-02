# COMPLIANCE

This document records the boundaries RepOS V1 operates inside, and how each one
is enforced in code. It is not a legal opinion.

> **This V1 is designed to minimise platform and compliance exposure. It does
> not, and cannot, guarantee legal compliance.** Software cannot make a
> guarantee like that. What it can do is make the risky things impossible to do
> by accident, and that is what the rules below are for.

Every rule marked **[enforced]** has a test in `tests/compliance.test.ts` that
fails the build if the rule is broken.

---

## Review integrity

RepOS must never be used to manufacture reputation.

- **No review buying.** There is no payment, incentive or reward mechanism
  anywhere in the product.
- **No review incentives.** Every vertical playbook under `/packs` carries an
  explicit `doNot` list telling staff never to offer a discount, gift, free
  service or loyalty benefit for a review. This is checked by a test in
  `src/lib/packs.test.ts`.
- **No review gating.** The feedback kit points at exactly one destination URL
  that the operator supplies by hand. There is no branching, no "how did we
  do?" pre-screen, and no path that sends happy and unhappy customers to
  different places.
- **No selective routing.** The staff scripts require the same QR to be offered
  to every customer, not only the ones who look pleased.
- **No writing reviews on a customer's behalf.** Stated explicitly in every
  pack's `doNot` list.
- **No asking anyone to remove or edit a review.**

## Platform access

- **No Google APIs of any kind.** **[enforced]** No Business Profile API, no
  Places API, no Maps API, no Google account access, no Google Manager access,
  no OAuth. There is no Google-operated endpoint anywhere in the runtime.
- **No Gmail or IMAP.** **[enforced]**
- **No Meta or WhatsApp APIs.** **[enforced]**
- **No scraping.** RepOS never requests a listing page.
- **No automatic external fetching.** **[enforced]** The only outbound network
  call in the entire codebase is to the configured AI provider, and only when
  the operator saves a snapshot with an API key present.
- **No automatic posting.** RepOS publishes nothing, anywhere, ever. Replies and
  content are produced for the operator to copy and send themselves.
- **Platform links are inert references.** `mapsUrl` and `reviewLinkUrl` are
  stored strings the operator can click. RepOS never opens them.

### AI providers

V1 registers exactly **one** provider: **Groq**, reached over plain HTTPS with
an API key in a header. No SDK, no OAuth, no account linkage.

Gemini was specified in the original technical baseline as a fallback. It has
been **removed**, because its endpoint (`generativelanguage.googleapis.com`) is
Google-operated and the "no Google APIs of any kind" rule takes precedence. The
provider abstraction in `src/lib/ai/` is unchanged and still supports adding a
future non-Google provider in one file.

A stale `REPOS_AI_FALLBACK="gemini"` left in an old `.env.local` is ignored
rather than guessed at — there is a test for exactly that.

RepOS is fully usable with no AI key at all. Without one it reads feedback with
the local keyword taxonomy and writes report prose from templates. Analysis is
never blocked, degraded into an error state, or left half-done because a
provider was missing or failed: a failure is recorded on the individual item and
the rest of the batch still lands.

## Replies never leave this machine

**[enforced]** RepOS drafts replies. It does not send them.

- **No send, post, publish or schedule exists anywhere.** A suggested reply is
  text on screen with a Copy button. The operator pastes it wherever they
  choose. A guard test fails the build if any action named send/post/publish
  is ever added.
- **No messaging deep links. [enforced]** No `wa.me`, no `whatsapp:`, no
  `sms:`, no `mailto:`, no Meta endpoint of any kind. Tested.
- **One outbound call in the whole reply layer.** Only the drafting adapter
  (`src/lib/ai/draft-reply.ts`) talks to a provider, and only to Groq. Tested.

### Owner communication (M8)

**[enforced]** RepOS prepares messages for the business owner. It sends none of
them, and there is no code path by which it could.

- **No outbound call anywhere in the communication layer.** Owner updates are
  composed entirely from stored rows: `src/lib/comms/` contacts nothing, not
  even an AI provider. Tested.
- **No scheduler, queue, worker or notification.** Tested.
- **No messaging deep link.** Already covered by the reply-layer guard, which
  scans the whole runtime for `wa.me`, `whatsapp:`, `sms:` and `mailto:`.
- **Nothing is stored either.** A prepared message lives on screen until the
  operator copies it. There is no outbox to leak.

Owner messages pass the **same safety gate** as customer replies, with one
addition: every figure must exist in the deterministic insight object. A
statistic RepOS cannot evidence makes the message unpublishable rather than
merely flagged, because the owner will act on it.

The review-incentive ban applies to owner messages too. RepOS will not write
"tell your happy customers they get a discount for a five-star review", and
will not suggest rewarding a rating change or the removal of criticism, whoever
is being written to.

### Customer intelligence (M10)

**[enforced]** What RepOS says customers are telling a business is ordinary
application code reading stored rows. No model decides any of it.

- **No outbound call anywhere in the intelligence layer.** `src/lib/intelligence/`
  contacts nothing, not even an AI provider, and the engine produces a complete
  verdict with no key configured at all. Tested both ways.
- **Nothing is stored.** There is no intelligence table, no cached insight and
  no derived row. The object is recomputed from the feedback and the snapshots
  on every read, so a stale insight cannot outlive its evidence. Tested.
- **Every insight carries its evidence.** The ids of the feedback it was counted
  from, the two snapshots it compared, and the named signals that ranked it.
  "Why did RepOS say this?" is answerable without trusting anything.
- **No number without a source.** A compliance test walks every sentence the
  engine writes and fails on any figure that is not in the stored data.
- **No trend from one check-in.** With a single snapshot the answer is
  "not enough to compare", never "stable". Tested.
- **Client isolation.** Every query is scoped by client and every insight id is
  namespaced by client. Tested against a real database with two clients.
- **Operator notes are not customer evidence.** Minutes are carried in their own
  field, with their own source label, and are never counted, ranked or quoted
  as something a customer said. Tested.

### The action loop (M11)

**[enforced]** RepOS records what a business decided to change and compares the
feedback before and after. It decides nothing itself and claims nothing it
cannot evidence.

- **No outbound call anywhere in the loop.** `src/lib/improve/` contacts
  nothing, not even an AI provider. No model is ever asked whether a change
  worked, whether a trend is real, or whether the evidence is sufficient.
  Tested.
- **No new feedback is fetched.** The loop reads only what the operator pasted
  in. It cannot write a feedback row, and a compliance test enforces that.
- **No scheduler, queue, worker or reminder.** Nothing fires on a timer.
- **Human confirmation on every step.** RepOS proposes; a person accepts,
  declines, marks done and asks for the measurement. There is no path where a
  business action is recorded without someone pressing a button.
- **"Done" is never evidence.** The stored meaning of that state says so
  explicitly, and a compliance test asserts the wording never softens.
- **No causal claim, ever.** Every sentence the measurement engine writes says
  "after the change", never "because of it", and every result states out loud
  that it cannot show causation. Tested across all four outcomes.
- **Shares, never bare counts.** Both sides of a comparison are a proportion of
  their own denominator, with a floor of ten read items on each side — the same
  floor the health engine uses.
- **Insufficient data is the default.** A theme absent from a handful of new
  reviews is not an improvement; it is unmeasured. Tested.
- **History is frozen.** The insight, the recommendation and the baseline are
  copied onto the action and never recomputed, so a later intelligence version
  cannot rewrite what RepOS originally said.
- **Client isolation.** Every read and write is scoped by client, and an action
  cannot be read or changed through another client's id. Tested.
- **Operator conclusions are not customer evidence.** The learning note is
  stored, labelled and displayed as a business observation, never as something
  a customer said.

### What a reply may never contain

Every suggested reply passes `src/lib/reply/safety.ts` before it is stored —
whether RepOS wrote it, an assistant wrote it, or the operator typed it. These
are refused outright, never "warned about":

- **Review incentives and rating manipulation. [enforced]** Asking for a
  five-star rating, asking for a review to be changed, removed or improved, or
  offering anything at all in exchange for one. This breaks every platform's
  rules and can get a business penalised, so RepOS will not write it even if
  asked to.
- **Refunds, compensation, dismissals and operational changes.** Those are the
  owner's decisions, not a draft's.
- **Legal admissions.**
- **Medical claims, and any confirmation of a person's treatment, diagnosis,
  prescription, test results or condition.** Healthcare replies stay general
  and professional. The vertical pack's medical bans ("cure", "guaranteed",
  "100% safe") cannot be turned off by a client's own word list — the two
  lists merge, they do not override.
- **Customer PII.** The draft goes through the same redactor as intake; if it
  finds a phone number, email or address to strip, the draft is refused.
- **Links.**
- **RepOS's own vocabulary.** Sentiment, themes, analysis, "as an AI" — none of
  it may reach a customer.

Figures and time frames that appear from nowhere are flagged too. A number may
be echoed only if the customer used it, or it comes from the business's own
stored policy.

If even RepOS's deterministic wording would break one of these rules — usually
a word the business itself banned — nothing is stored and the item is handed
back with the reason. RepOS does not quietly ignore an instruction.

## Customer privacy

- **No customer PII.** There is no database column anywhere for an end
  customer's name, phone number or email. The only contact fields belong to the
  business owner or operator we contract with.
- **Feedback is anonymous by default.** Pasted review text passes through
  `redactPii()` in `src/lib/redact.ts` *before* it is written to SQLite. Emails,
  phone numbers, long digit runs, social handles, reviewer-profile boilerplate,
  leading reviewer-name lines, address-like patterns (flat/plot/house numbers,
  street addresses, explicit pin codes) and booking/order/patient references are
  all stripped at ingest. Redaction is deterministic and tested in both
  directions: it must remove real identifiers AND leave ordinary business
  language ("the bill was too high", "the shop was clean") untouched.
- **No customer PII in AI prompts.** Classification receives the already-redacted
  text, so identifiers never reach a provider — they were removed before the
  text was stored.
- **Delete on request.** Deleting a client removes every related row by cascade:
  knowledge profile, policies, competitors, all snapshots, all stored feedback,
  the kit configuration and all time entries. See "Delete permanently" on the
  client edit page.

## Data handling

- **Local storage only.** One SQLite file at `data/repos.db` on the operator's
  laptop. No external database, no cloud hosting, no sync.
- **No telemetry or analytics.** **[enforced]** Nothing measures usage, and
  `poweredByHeader` is off.
- **No authentication.** Single-operator local application by design.
- **Secrets.** API keys live only in `.env.local`, which is gitignored. RepOS
  defines **zero** `NEXT_PUBLIC_*` variables **[enforced]**, and no `'use client'`
  module reads `process.env` **[enforced]**, so no key can reach the browser.
  `.env` holds only the local SQLite path and no secrets.

## Honesty of the reporting

The product's value depends on the owner being able to trust the numbers.

- **AI may classify and phrase. It may never decide.** Whether a review needs a
  reply, how urgent it is, and why, are all computed in application code
  (`src/lib/reply/triage.ts`) from named signals with fixed weights. There is
  no model-produced score anywhere, and every signal that fired is shown to the
  operator in plain words.
- **AI may classify and phrase. It may never count.** Every count, share,
  average, threshold, comparison and recommendation is computed in application
  code (`src/lib/analysis/aggregate.ts`, `src/lib/analysis/normalize.ts` and
  `src/lib/health/health.ts`).
- **No review is sent off and taken at its word.** Reading a review runs the
  deterministic pipeline first — language, taxonomy match with negation
  handling, sentiment composition, confidence. An AI suggestion, when one is
  available, is an extra input to that pipeline and never a replacement for it.
  The sentiment stored is always the one the pipeline composed.
- **A rating alone never decides sentiment.** The wording leads; the rating
  corroborates. When they disagree the answer is Mixed, and the reason is shown
  to the operator in plain words.
- **Every reading explains itself.** Each analysed item carries the reasons it
  reached its conclusion, the themes it found and how clear the reading was, and
  every theme count on the Feedback page links back to the exact reviews behind
  it.
- **Tags are validated against the taxonomy.** Anything a model returns that is
  not a real key in the vertical pack is discarded.
- **AI prose passes a numeric guard.** Any figure in AI-written text that does
  not already exist in the deterministic analysis causes that sentence to be
  rejected and the deterministic wording used instead.
- **An owner update states nothing the data cannot support.** Themes are named
  only after three mentions, a period comparison appears only when two
  snapshots exist, and a recommended step appears only when a theme clears the
  floor. What was already done is quoted from the operator's own Minutes and is
  never described as having worked — that measurement belongs to a later
  milestone and RepOS does not claim it early.
- **Evidence floors are enforced, not advisory.** Under 10 stored reviews RepOS
  refuses to claim a pattern. Themes need at least 3 mentions. Trend claims
  require comparable history on both sides.
- **Missing data is reported as missing.** Never imputed, never estimated,
  never filled with a default.
