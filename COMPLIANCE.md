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
- **No review gating.** **[enforced]** Every printed piece carries exactly one
  address: the business's own private feedback page. There is no branching, no
  "how did we do?" pre-screen, and no path that sends happy and unhappy
  customers to different places. The optional public review link is offered
  after a customer has already sent their feedback, to every one of them,
  whatever they wrote.
- **No gating in the words either (M17).** **[enforced]** The one place real
  sentiment gating ever existed in RepOS was not in code: every vertical's
  staff script told staff to mention the QR *after* the customer had signalled
  they were pleased — "once the client has seen the finished result", "if you
  are happy with how it turned out" — on the same printed sheet as a box saying
  never to do that. Staff follow the script, not the box. Every script is now
  unconditional, and a test fails the build if a conditional cue reappears in
  any pack, in any of its three languages.
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

### The customer feedback gateway (M14)

**[enforced]** RepOS now has a page customers themselves open: they scan a QR
on a counter card, say what they think, and it enters the same feedback pile
the operator pastes into. It is a front door, not a back channel.

- **No review gating, structurally.** Everyone sees one page with one question.
  The thank-you page is reached by token alone — it is handed nothing about the
  rating or the words, so it *cannot* treat a happy customer differently from
  an unhappy one, and a compliance test asserts that page reads no rating,
  sentiment or search parameter. The optional public review link is shown to
  every customer or to none.
- **No selective routing and no steering.** The page never says "5 stars",
  "positive review", "happy customers" or "rate us", in any vertical. A test
  walks every pack's wording and fails on that language.
- **No review is written for anyone.** RepOS never copies private feedback into
  a public review, never pre-fills one, and has no path to post one. The public
  review link is an ordinary link the operator typed, opened by the customer's
  own tap.
- **No Google anything.** No API, no OAuth, no lookup, no fetch, no
  verification. The stored link is a plain string; the button's label is read
  from the address the operator pasted and nothing else.
- **No outbound call anywhere in the gateway.** `src/lib/gateway/` contacts
  nothing, not even an AI provider — the QR is encoded offline by the `qrcode`
  package. A public page cannot trigger a model call: reading feedback stays a
  button the operator presses. Tested.
- **The public address is a random token, not an identity.** 110 bits from a
  32-letter alphabet, unique per client, stable for the life of the client, and
  never a database id. A malformed token is rejected on shape before any query
  runs, and an unknown token, a paused page and an archived client all return
  the same not-found page, which names nothing.
- **Client isolation is absolute.** One token resolves to one business or to
  nothing, and every write is scoped to the client that token resolved to.
  Tested adversarially against a real database with two clients: one QR cannot
  create the other's feedback, show its name, or carry its link or QR.
- **Private feedback is never treated as a review to answer.** Nobody gave a
  name or a contact, so there is nothing to reply to. Those items are filed as
  needing no response with that reason attached, rather than sitting in a reply
  queue for a reply that has nowhere to go. Harm, money-back and escalation
  language is still flagged for a person, because that flag is about attention.

### Responsibility (M15)

**[enforced]** RepOS now answers "do I need to do anything?" on every open. It
answers from stored rows, and only from them.

- **No timer, no background process, no notification.** The state is computed
  when a page asks for it. `src/lib/responsibility/` schedules nothing, polls
  nothing and queues nothing. Tested.
- **No outbound call and no AI provider.** Every state is application code
  placing judgements the intelligence, action and view layers already made.
  Tested.
- **No second engine.** The engine reads M10's ranked insights, M11's action
  progress and M12's view; a compliance test fails if it counts themes,
  reads sentiment, compares shares or declares a threshold of its own.
- **Nothing is stored.** No responsibility table, no cached state. Tested.
- **No causal claim.** The thread that connects what customers said, what the
  owner decided and what the feedback did afterwards uses the measurement
  engine's own wording and carries its no-causation note; the causal-wording
  guard runs over every state the engine can produce.
- **Owner context is labelled as the owner's, in every place it appears.**
  Each reason and each thread step carries its source — customers, the owner,
  or RepOS — and a test asserts owner words never appear in a customer-sourced
  line.

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
- **The customer feedback page asks for nothing about the person.** **[enforced]**
  No account, no name, no phone, no email, no address — there is no field for
  any of them, and no column to put them in. What a customer volunteers in free
  text goes through the same `redactPii()` before storage as pasted review text.
  A test asserts the gateway and feedback tables carry no identity column at
  all.
- **No network address is stored, logged or written anywhere.** **[enforced]**
  The submission ceilings that keep a public page from being flooded are counted
  in memory only, keyed by a SHA-256 hash salted with a value regenerated every
  time the application starts — so a key cannot be joined back to an address
  later, by anyone, including from the disk. Entries expire inside their own
  window. There is no CAPTCHA, no fingerprinting and no tracking of any kind.
- **Delete on request.** Deleting a client removes every related row by cascade:
  knowledge profile, policies, competitors, all snapshots, all stored feedback,
  the kit configuration and all time entries. See "Delete permanently" on the
  client edit page.

## Data handling

- **Local storage only.** One SQLite file at `data/repos.db` on the operator's
  laptop. No external database, no cloud hosting, no sync.
- **No telemetry or analytics.** **[enforced]** Nothing measures usage, and
  `poweredByHeader` is off.
- **One operator, one password (M16).** **[enforced]** RepOS is a
  single-operator application and now says so with a lock rather than an
  assumption. There are no accounts, no teams, no roles, no invitations and no
  sign-up — the password is set from a terminal with `npm run set-password` and
  stored as a scrypt hash in `.env.local`. There is no customer or owner login,
  because RepOS holds no customer or owner credentials.
- **Secrets.** API keys live only in `.env.local`, which is gitignored. RepOS
  defines **zero** `NEXT_PUBLIC_*` variables **[enforced]**, and no `'use client'`
  module reads `process.env` **[enforced]**, so no key can reach the browser.
  `.env` holds only the local SQLite path and no secrets. The operator password
  hash and the session secret are never written to the database **[enforced]**,
  so a stolen backup contains no credential.
- **Backups stay on this computer (M16).** **[enforced]** "Take a backup now"
  writes a `VACUUM INTO` copy to `backups/`, outside the folder holding the live
  database and never inside `public/`. Nothing is uploaded anywhere, nothing is
  scheduled, and no existing copy is ever overwritten.

## Operator access and public addresses (M16)

### Who is authorized, and by what

| Who | Credential | Reaches |
| --- | --- | --- |
| The operator | a password, then a signed session cookie | everything |
| A business owner | one secret 110-bit link per business | that business's own view, read-only |
| A customer | the gateway token in the QR | one page where they can leave feedback |

- **Every server action checks the operator itself.** **[enforced]** Server
  Actions are POSTs addressed by an internal action id rather than by the page
  path, so a path-matching middleware rule cannot be the gate. `requireOperator()`
  is the first statement of every action, the operator layouts check again, and
  middleware is only an early bounce to `/login`. A compliance test walks every
  exported action in `src/lib/actions/` and fails if one is missing the check.
- **Exactly three actions are unguarded, by name.** Signing in, signing out, and
  a customer submitting feedback. The third is authorized by the gateway token in
  the URL, is rate-limited, and can only write against the client that token
  resolves to.
- **Permanent deletion needs both.** **[enforced]** An authenticated operator
  *and* the business name typed exactly, as it has since M1.
- **The owner's link is a secret, not an identifier.** **[enforced]** Until M16
  the portal was addressed by the client's database id, which is printed on
  every operator screen and is a sortable timestamp rather than a secret. It is
  now a 110-bit random token from the same alphabet the feedback gateway uses.
  Its shape is checked before any query runs, and an unknown token, a malformed
  token, a retired token and an archived client are all the same neutral 404.
- **A link can be taken back.** Issuing a new one retires the old address
  immediately, on every page of the portal.
- **The owner's path only reads.** **[enforced]** Issuing and revoking a link are
  operator operations and live in `src/lib/clients/service.ts`; nothing reachable
  from `src/lib/portal/` writes to the database.

### The address customers open

- **One explicit address, or none.** **[enforced]** In production
  `REPOS_PUBLIC_BASE_URL` is required and must be `https://`. RepOS never derives
  a customer-facing address from a request header in production, because a
  `Host` or `X-Forwarded-Host` header can be set by anyone who can reach the
  server — and a forged one would be printed permanently into a QR code.
- **No address, no QR.** When the address is missing or unusable, the Feedback QR
  page and the printable card show a plain configuration error and draw nothing.
  A wrong card is worse than no card.
- **Restarting changes nothing.** The address, the feedback tokens and the owner
  links all survive a restart, so printed cards keep working.
- **The canonical flow is unchanged.** A scanned QR still opens RepOS's own
  feedback page, every customer still sees the same thank-you page, and the
  optional public review link is still offered to everyone regardless of what
  they wrote. **[enforced]**

### What is deliberately not built

- No Google or Meta integration of any kind: no OAuth, no review fetching, no
  reply publishing, no push subscriptions.
- No email, SMS, WhatsApp or notifications.
- No second user, no roles, no invitations, no customer accounts, no billing.
- No password for the business owner — their link is the credential, and RepOS
  therefore holds no owner credentials at all.
- No cloud backup, no upload, no telemetry, no scheduled job.
- No server-side session store. The cookie is signed and expires by itself;
  there is nothing to revoke a single stolen cookie from. Rotating
  `REPOS_SESSION_SECRET` ends every session at once, and that is the lever.

## A business needs no Google to be served (M17)

RepOS's product direction is locked: it is a Customer Feedback → Business
Improvement System, and the primary customer-voice channel is private feedback
through the business's own QR. Google reviews are a secondary, optional,
manually-supplied destination and nothing more.

- **One QR, and it is RepOS.** **[enforced]** The M3 printed kit used to encode
  whatever public review link the operator had pasted in, while the words above
  it said "scan and tell us honestly — good or bad". A customer read a promise
  of a private channel and was handed a public one, and a business running that
  kit generated zero rows in the product it was paying for. The kit, the
  feedback card, the on-screen QR and the downloaded image are now all built
  from the same gateway token and the same installation address.
- **A card can be printed on day one.** **[enforced]** Kit readiness needs a
  business name and an installation address. It does not need a public listing,
  a review link, or an account anywhere.
- **One public review link, not three.** It is stored on the gateway row —
  the one the customer's thank-you page actually reads — and writing it from
  either operator screen updates both. Clearing it clears both. Before M17 the
  same link lived in three columns that silently drifted apart, so the kit could
  point one way while customers were offered another.
- **The optional link cannot point back at RepOS.** **[enforced]** An operator
  who works out that the QR should open RepOS naturally pastes the feedback
  address into the public-review field, which would loop a customer who had just
  left feedback straight back to the form. That is refused with an explanation.
- **A check-in sees the feedback that arrived in its window.** **[enforced]**
  Until M17 a check-in could only see feedback pasted directly into it, which
  made sense when reviews arrived in batches copied off a listing. Under the
  QR-first direction roughly two thirds of a real client's feedback — including
  every QR submission — was invisible to health, to the trend and to every
  before-and-after comparison, while the intelligence engine read all of it.
  Two halves of the product answering the same question from different evidence.
  A check-in now covers what arrived after the previous one, up to its own
  moment. Feedback that arrived after the most recent check-in belongs to the
  next one, so a stale check-in can never quietly absorb what a customer said
  months later.
- **Nothing tells the owner they are missing something.** **[enforced]** A test
  runs a business with no public listing end to end — create, print, collect,
  read, group, recommend, decide, do, measure, report — and asserts that the
  words "Google", "listing", "star rating" and "public review" never reach the
  owner's view.

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
