# Smart Feedback — Intelligence Rules

The contract every Smart Feedback screen follows: what goes in, what comes out, how much evidence each claim needs, and when Headway says nothing. It describes the code as it stands after the quality and correctness passes of September 2026. Where a number appears here, the code has a named constant with the same value, and a test holds the two together.

Front Desk is paused and out of scope. Nothing here applies to it.

---

## A. Input

One **feedback entry** is one response. It can be a QR or link submission, or a public review a check-in captured. It carries:

- the customer's text (optional; any of English, Hindi, Marathi, romanised Hindi/Marathi)
- a 1–5 star rating (optional)
- the date the customer gave, or the date it arrived

Customers are anonymous. "Customers" in owner-facing copy means feedback entries; one person can leave more than one.

## B. Reading one entry (per-entry output)

`src/lib/analysis/normalize.ts` → `normalizeFeedback`, version `ANALYSIS_VERSION = 3`.

| Output | Values | How it is decided |
|---|---|---|
| problem topics | keys from the vertical pack's `issueTaxonomy` | C, E, F |
| praise topics | keys from the pack's `praiseTaxonomy` | C, E, F |
| sentiment | POSITIVE · NEGATIVE · MIXED · NEUTRAL | D |
| confidence | HIGH · MEDIUM · LOW | agreement of wording, rating and topics. HIGH only when every topic rests on STRONG evidence from the first reader, nothing was set aside, no "but" (or 3★ semicolon) was left unread, the subject of every who-did-it clause is plainly the business, and no topic rests on the second reader alone; LOW when the two readers conflicted |
| method | KEYWORD · AI | whether a second reader contributed |
| abstentions | clauses set aside, each with its reason | C1 |
| conflicts | concepts the two readers disagreed on, filed on neither side | F |
| unclassified | true when nothing in the words could be classified safely | G |
| reasons | plain sentences, stored and shown to the operator | all of the above |

A topic can only be a key the pack declares. Nothing outside the taxonomy is ever stored as a topic.

## C. The deterministic reader

`src/lib/analysis/classify.ts` (`readTopics`), `scope.ts` and `aspects.ts`, in this order.

### C1. Scope: what the words are about (`scope.ts`)

Before any topic is matched, each clause is asked **who** it is about and **when** it is true. A clause that is not about the business now is blanked and recorded as an **abstention**. It is never re-assigned to someone else.

**Who.** A clause is set aside when both of these hold:

1. It carries an **attribution-sensitive** predicate: lateness, a delay, rudeness, shouting, a cancellation, a postponement, a loss, forgetting, missing, a change, a closure, "took two hours", "went wrong". These are statements whose meaning depends entirely on who did it.
2. Its subject is plainly **not the business**. That means one of:
   - the customer themself (I, we);
   - their family or friends;
   - other customers ("another patient", "the client before me");
   - another trade or institution (driver, DJ, bank, builder, seller, board; the venue, hall or caterer for a wedding vendor; the school for coaching; the lab or pharmacy for a clinic);
   - an event or circumstance (the event, the wedding, an exam, traffic, rain, a strike, a power cut).

An unknown or missing subject is the business, as in nearly every review ("came late, no updates").

Further rules:

- **Receiving is not doing.** "We got our food late" and "the guests were served late" are about the business.
- **Cause travels both ways.**
  - "The event started late *because* the guests arrived late": both clauses are set aside.
  - "I forgot my reports, *so* the consultation took longer": both clauses are set aside.
  - A cause that *is* the business makes the effect the business's: "we missed the pheras *because* the photographer was busy eating" is a coverage complaint.
- **A clause with no subject after "and"/"but" shares the previous one.** "Our album is beautiful and arrived early" is about the album.
- **A deliverable's timing is delivery, not punctuality.** For the wedding pack, "arrived early" and "came late" about an album, video or photos file under delivery speed or delay.
- **The business waiting for the customer is courtesy, not a wait.** "He waited patiently for us" is not a complaint.

What a set-aside clause would have supported is kept as a **refused** topic: no second reader may add it back. The response's stored reasons say what was set aside and why, in plain words.

**When.** A past state contrasted with now ("used to", "when I joined", "two years ago" … "now", "anymore", "lately") is set aside up to the contrast: "the equipment was new when I joined, now half of it is broken" says the equipment is broken.

**Sarcasm.** A sentence that opens with "Great,", "Wonderful,", "Amazing how", "Thanks for the", "Loved waiting…" and then complains has that opener discounted. The response is routed to the second reader (`POSSIBLE_SARCASM`).

### C2. Topics

1. **Masking.** Look-alike phrases ("waiting area", "late night", "slow learners", "worth the wait") are blanked.
2. **Pack hints.** Whole-word matches (plural allowed; a trailing `*` matches any word it begins). Devanagari matches as a substring.
3. **Negation.** A hint is refused, and recorded as refused, when any of these holds:
   - it follows a negator ("not", "no", "never", "hardly", "barely", "nahi", with a degree word or article between: "not very clean", "not the best");
   - it precedes a Hindi/Marathi post-negator;
   - it follows a clause negator: "nobody", "nothing", "didn't", "refused to", or a **quantified negation** ("not a single", "not one", "not once", "none of").
   - **Absence complaints are the exception.** A problem hint that names an action whose absence *is* the complaint (reply, respond, answer, call back, inform, update, show up, refund) counts when negated: "they never reply".
4. **Longest match wins** where hints overlap.
5. **Aspects.** In each clause, a named *thing* with an *opinion word* within five words. The things are food, portion, price, speed, wait, staff, doctor, teacher, material, trainer, equipment, facility, atmosphere, cleanliness, hygiene (tools and towels), ambience, noise, result, output, team, parking, paperwork, bill, communication and schedule.
   - A negated positive becomes a complaint ("not clean").
   - A negated complaint is dropped ("not rude").
   - A clause that says both says nothing.
6. **Quantities.** A stated wait or lateness in minutes or hours, "lost 8 kg", a deliverable three or more months late, a consultation of five minutes or less, a batch of 40 or more, silence "after the deal" (post-deal support).

**Strength.** Every topic found is STRONG or WEAK:
- **STRONG:** a multi-word phrase, an aspect's own opinion word ("bland"), or a quantity.
- **WEAK:** a single-word hint, or only a generic word ("good", "bad").

The combined reader (F) uses it.

**No bare word without a verdict.** Three rounds of `scripts/taxonomy-quality-pass.mjs` removed hints that name a subject rather than an opinion: "vibe", "flavour", "refund", "cancelled", "quick", "kind", "value", "guidance" and others. They also removed every hint shared by two topics of one pack. [SMART_FEEDBACK_TAXONOMY_AUDIT.md](SMART_FEEDBACK_TAXONOMY_AUDIT.md) is generated from the code and lists, for each of the 119 topics, its phrases, its weak single words, its aspect route, what was removed and whether it is attribution-sensitive (56 are).

### C3. Rules added by the final correctness gate

| Rule | What it does |
|---|---|
| **Entity guard** | A hint that is only a *generic* opinion ("gentle", "was kind", "good") does not file its topic when its clause names a different thing whose aspect maps elsewhere. "The receptionist was kind" is not doctor care. A word specific to one kind of thing ("slow", "rude", "overpriced") already says what it is about, and is not guarded. |
| **Strength** | Generic opinion words are WEAK evidence. A multi-word phrase, a topic-specific word, an aspect's own word or a quantity is STRONG. |
| **Time, without "used to"** | Markers for a dated state: "until we signed", "before we paid", "on day one", "in January", "during booking", "for the first month", "for a week". When "then", "until" or "now" joins two halves of opposite polarity, the earlier half is past. The past half keeps its *things* and loses its *opinions*, so "the bikes were great in January, then half of them stopped working" still knows what stopped working. |
| **Elided negation** | "X is good, Y isn't" and "X is taught well; Y isn't" count as negative wording. |
| **"But" turns the other way** | Praise, then "but", then a half with nothing the reader recognises ("lovely ambience, but the rotis were chewy") makes the response MIXED. Confidence is capped and the response goes to the second reader (`CONTRAST_UNREAD`). A "but" between facts, or after a complaint, infers nothing. |
| **Qualified third parties** | "The decorator *from the venue*", "the society's secretary": whose people they are decides the subject. |
| **Look-alikes** | "waiting" before a place or the people who serve ("waiting staff", "waiting chairs") is not a wait. Only the word "waiting" is masked; the noun stays. |
| **Sarcastic deeds** | "Well done / great job / nice work" + a verb in -ing ("…serving us raw chicken") is not praise. It goes to the second reader. |
| **One vocabulary** | Plain polarity words and the aspect reader's generic words are one list. |

### C4. Rules added by the AI validation pass

| Rule | What it does |
|---|---|
| **Passive agents** | "Was delayed / held up / cancelled / postponed **by** X": when X is impersonal (a holiday, an outage, a power failure, a court, the weather) or a third party, the clause is set aside. "Delayed by the kitchen staff" stays the business's. |
| **More predicates depend on who acted** | "stopped", "halted", "suspended", "crying", "screaming", "noisy", "loud" join "late", "rude" and "delayed". So "classes stopped because of the strike" and "another patient's child was crying" are set aside. "Stopped responding / replying / answering" stays the business going quiet. |
| **Unsure attribution is never HIGH** | A kept clause whose words depend on who acted, but whose subject is not plainly the business (its people, its pronouns, or one of the pack's own things), is still read as the business's, the likelier reading, but the response's confidence is capped at MEDIUM. "Our caterer served late" in a wedding-vendor review is read, never at HIGH. |
| **Generic praise names nothing** | "Worth it", "lovely place", "good place", "nice", "great experience": no topic. "Worth" files value only with its money ("worth the money", "worth every rupee", "worth the fee"). Generic opinion words cannot reach ambience through the word "place"; appearance words ("beautiful", "stunning") and ambience words ("calm", "cosy") can. |
| **"Kind"** | "Kind of" and "kinds of" are masked as quantifiers; "kind" left over is kindness ("kind nurse"). |
| **A semicolon at a middle rating** | Praise, a semicolon, then a half the reader cannot read ("Friendly nurses; the forms were endless") is MIXED at 3★ and goes to the second reader. At 4–5★ the semicolon infers nothing. |
| **Weight lost, in other words** | "Dropped / shed N kg" is a result, like "lost N kg". |
| **Ambiguous adjectives** | In salons "neat" no longer files hygiene by itself; it describes the cut ("neat haircut") or, through its anchor, the salon ("the salon was neat"). People can be "cold", "curt", "abrupt", "condescending". |

## D. Sentiment: the rating and the words

**Text polarity reads every clause.** Praise in one clause and a complaint in another is MIXED, even when only one of them matched a topic ("decor was beautiful; coordination was poor"). Plain polarity words are read from the scoped text, so a set-aside clause adds nothing either way.

| Wording | Rating | Result |
|---|---|---|
| mixed | any | MIXED |
| none | none | NEUTRAL |
| none | 3★ | **NEUTRAL**: a middle rating alone is neither praise nor complaint |
| none | 1–2★ / 4–5★ | the rating's direction |
| clear | none | the wording's direction |
| clear | agrees | that direction |
| clear | 3★ | the wording's direction |
| clear | opposite (5★ + complaint, 1★ + praise) | MIXED: both kept |

**The rating never erases what the customer wrote.** Topics come from the words alone, at every rating. All 140 combinations (7 verticals × 4 kinds of wording × 5 ratings) are pinned in `tests/m46.rating-matrix.test.ts`.

## E. The second reader (AI), contract 2

`src/lib/ai/route.ts` decides deterministically which responses a second reader sees:

| Route | When |
|---|---|
| no AI: NO_TEXT / TEXT_TOO_SHORT | nothing, or too little, to read |
| no AI: KEYWORDS_CONFIDENT | topics found, agreeing with the rating |
| **AI:** NO_KEYWORD_MATCH | real text, no topic found |
| **AI:** CONTRADICTS_RATING | 4–5★ with only complaints, 1–2★ with only praise |
| **AI:** UNCOVERED_SCRIPT | a script the vocabulary does not cover |
| **AI:** POSSIBLE_SARCASM | a sarcastic opener was discounted |
| **AI:** CONTRAST_UNREAD | praise, then a "but" whose other half was not understood; or, at 3★, a semicolon whose other half was not understood |

The model (`classify-reviews.ts`, `AI_READER_VERSION = 2`, temperature 0, JSON) returns, per response:

```json
{"i":0,"abstain":false,"sentiment":"MIXED","confidence":"HIGH",
 "topics":[{"key":"service_speed","polarity":"NEGATIVE","about":"BUSINESS",
            "confidence":"HIGH","evidence":"service was painfully slow"}]}
```

`validateReading` accepts a proposed topic only if all of these hold. Anything else is dropped and recorded with its reason.

| Check | Rejected as |
|---|---|
| key is in the pack's taxonomy | NOT_IN_TAXONOMY |
| polarity is the key's own side (never flipped) | WRONG_POLARITY |
| it is about the business | NOT_ABOUT_BUSINESS |
| confidence is MEDIUM or HIGH | LOW_CONFIDENCE |
| evidence is given, and found verbatim in the response | NO_EVIDENCE / EVIDENCE_NOT_IN_TEXT |

Other rules:
- An **abstaining** response contributes nothing.
- A reply in the old shape (bare topic lists, no evidence) is not trusted.
- A reply that is not JSON fails closed: the deterministic reading stands.
- The model's sentiment is used only when the words themselves carry no polarity, and never when any of its topics was refused, uncorroborated or in conflict.
- Batches of **10** responses, with up to **4,000** output tokens. At the earlier 20 and 2,600, a reply was cut off mid-JSON (13 of 20 parsed) and the whole batch failed closed.
- Re-reading history after an engine upgrade is **deterministic only**: history is never re-sent to a provider.

## F. The combined reader: arbitration

`arbitrate` in `normalize.ts`:

1. **The words have the last say on what they deny or set aside.** A negated or set-aside topic is refused, whatever the second reader says.
2. A LOW-confidence suggestion is dropped; so is everything when the second reader abstained.
3. Agreement is accepted. **A topic on a concept the first reader did not touch must be corroborated** (AI validation pass):
   - its evidence must not lie inside a clause the first reader set aside;
   - a MEDIUM suggestion needs the rating or the wording to lean the same way (a complaint: 1–3★ or negative wording; praise: 3–5★ or positive wording);
   - where the first reader set part of the response aside as about someone else, a new topic must not contradict the rating (a complaint at 4–5★, praise at 1–2★).

   A topic only the second reader found, or one where it overruled a WEAK first reading, is one reader's word: **the response is then never HIGH.**
4. **A contradiction** (the same concept on the opposite side) is settled by strength:

   | First reader | Second reader | Outcome |
   |---|---|---|
   | STRONG | any | the first reader stands |
   | WEAK | HIGH | the second reader replaces it |
   | WEAK | MEDIUM | neither is filed: recorded as a conflict, confidence LOW |

5. A topic the first reader found and the second did not mention stays. Silence is not a contradiction.

Pinned in `tests/m46.ai-contract.test.ts`.

## G. Abstention: when Headway declines to classify

| Situation | Output |
|---|---|
| nothing in the words can be classified (no topic, no polarity) | `unclassified: true`; the reading's first reason is **"Not enough evidence to classify this safely."** |
| a clause about someone other than the business | that clause set aside: "… is about someone other than the business, so it was not counted for or against it." |
| a clause about a past state contrasted with now | set aside: "… describes how things used to be, so it was not counted as how they are now." |
| the two readers contradict and neither is strong | neither side filed; confidence LOW |
| the second reader is unsure, unattributed or ungrounded | its suggestion dropped |
| the second reader proposes something nothing corroborates | dropped, and its sentiment is not used |
| an ambiguous single word | WEAK evidence, overruled by a confident contradiction |

A missed topic is preferred to a false one, by design.

## H. From entries to patterns

`src/lib/intelligence/engine.ts` (`INTELLIGENCE_VERSION = 2`).

| Claim | Rule | Constant |
|---|---|---|
| An **individual signal** | any entry mentioning a topic; shown on that entry, never summarised | — |
| A topic is **named** at all | at least 3 entries mention it | `MIN_MENTIONS_TO_NAME = 3` |
| Confidence **EARLY** | named, but fewer than 10 entries read | `TIER_LIMITED_MIN = 10` |
| Confidence **MODERATE** | ≥ 3 mentions **and** ≥ 10 read | |
| Confidence **STRONG** | ≥ 6 mentions **and** ≥ 25 read | `TIER_STANDARD_MIN = 25` |
| A **pattern** an owner is asked to act on | a complaint at MODERATE or STRONG | view bucket FIRST / WATCH |
| **Praise to protect** | ≥ 6 mentions (the "strength" signal) at MODERATE or better | bucket KEEP |
| An **early sign** | anything named at EARLY, or praise below 6 | bucket EARLY: listed as "early signs", never led with, never given a suggestion or buttons |

Every figure an owner sees is stated with its denominator ("18 of 87").

**The evidence ladder.**

| Level | Rule |
|---|---|
| per-response reading | every response, as soon as it is read |
| emerging signal | 3+ responses mention it, fewer than 10 read: an early sign |
| recurring pattern | 3+ responses mention it, 10+ read (MODERATE) |
| strong pattern | 6+ responses mention it, 25+ read (STRONG) |
| actionable issue | a complaint pattern at MODERATE or STRONG, chosen as the lead |
| trend | two check-ins with 10+ read in each, and a share move the comparison rule accepts |

Pinned in `tests/m47.evidence-levels.test.ts`.

**The unit is the response, not the customer.** Customers are anonymous: no identity, device or contact is kept. "Minimum distinct customers" therefore cannot be measured. The guards that exist are:
- a response counts at most once per topic, however many times it names it;
- byte-identical text (after normalising case and punctuation) is refused at ingestion.

One person submitting several *different* responses would count several times. That is a documented limitation.

**Only read responses are evidence.** Every surface counts rows whose reading is complete: Customers, Home, Trends, Check-in, the before/after measurement, the reports and the operator board. An unread response is not a response that "did not mention" every topic.

Reviews pasted into a check-in are read at creation by the same reader (`normalizeFeedback`, the AI suggestion arbitrated the same way) and stored as read. No second classification of the same sentence reaches any surface.

## I. Trends: comparing two check-ins

A **check-in** is a Snapshot. **Only an operator creates one**, from the console (`/clients/[id]/snapshots/new`). Each check-in holds the feedback that arrived after the previous check-in, up to its own date. Feedback after the latest check-in belongs to no check-in yet.

A topic's trend compares its **share** of each check-in's feedback, never the raw count. `src/lib/health/compare.ts` (`compareShares`), the one rule every comparison uses. The first rule that applies is the answer:

| Verdict | Condition | Constant |
|---|---|---|
| TOO_THIN | either check-in holds fewer than 10 entries | `MIN_FEEDBACK_FOR_TREND_CLAIMS = 10` |
| TOO_FEW_MENTIONS | neither side has 3 mentions | `MIN_MENTIONS_FOR_TREND_CLAIMS = 3` |
| FLAT → **STABLE** | the share moved less than 5 points | `TREND_SHARE_DELTA = 0.05` |
| UNCLEAR → **cannot tell yet** | moved ≥ 5 points but \|z\| < 1.28 | `TREND_MIN_Z = 1.28` |
| ROSE / FELL → **WORSENING / IMPROVING** | moved ≥ 5 points and \|z\| ≥ 1.28 | |

```
p₁ = m₁/n₁    p₂ = m₂/n₂    p̄ = (m₁+m₂)/(n₁+n₂)
z  = (p₂ − p₁) / √( p̄(1−p̄)(1/n₁ + 1/n₂) )
```

"Improving" always means good news for the business: a complaint's share fell, or a praise's share rose.

**1.28 is the 80% two-sided bar, deliberately.** At the volumes a local business collects, a 95% bar would almost never be met. What keeps 80% honest: both totals are always stated, the move must also clear five points, and a direction is worded as what the feedback shows, never as a cause.

| Required case | Verdict |
|---|---|
| 5/10 → 10/20 | STABLE |
| 5/10 → 15/20 | WORSENING (z = 1.37) |
| 15/20 → 5/20 | IMPROVING |
| 5/10 → 5/20 | IMPROVING (z = −1.37) |
| 0/10 → 1/20 | no trend (too few mentions) |
| 1/5 → 2/20 | no trend (5 is too thin) |
| 10/20 → 10/10 | WORSENING, not stable |

All are pinned in `tests/m45.trend-eval.test.ts`, both at the rule and end to end on the Trends page.

The same rule decides:

- a topic between two check-ins (Trends, Check-in, Customers, Home arrows, owner updates)
- a topic this week against last, or this month against last (period reports)
- the unhappy share on the Health card
- a change's before/after measurement (G2)

### I1. When trends appear

A Trends page never shows a blank. Until a comparison exists it shows *why* (`buildTrendReadiness`):

| State | Condition | What the owner sees |
|---|---|---|
| NO_CHECKIN | no check-in yet | current patterns; "no check-in has been recorded yet" |
| ONE_CHECKIN | one check-in | current patterns; how many responses since, of the 10 the next comparison needs |
| TOO_THIN | two check-ins, one under 10 | current patterns; both totals and the floor |
| READY | two check-ins of 10+ each | the trend shelves |

No owner-facing sentence tells the owner to create or run a check-in; check-ins are the operator's.

**Recurrence** ("keeps coming back") is a count claim, not a share comparison. A topic named (3+ mentions) at two or more check-ins, each holding at least 3 entries.

### I2. Before and after a change

`src/lib/improve/measure.ts` (`MEASUREMENT_VERSION = 2`). The baseline is the topic's count and total frozen when the owner agreed the change. The after side is the feedback since the change was marked done. Each side needs 10 entries (`MIN_FEEDBACK_TO_MEASURE`); otherwise the result is INSUFFICIENT_DATA. Then `compareShares`: ROSE/FELL → IMPROVED/WORSENED; FLAT, TOO_FEW_MENTIONS and UNCLEAR → NO_CLEAR_CHANGE, each with its own reason sentence. Every result states each side as count, total and share ("9 of 50 (18%)"), its direction, and an **evidence level**: clear, comparable but not conclusive, or too little feedback yet. Every result also carries "this does not prove the change caused it". A result frozen under version 1 keeps its verdict.

## J. What each stage of an account shows

| Responses read | Home | Customers | Trends |
|---|---|---|---|
| 0 | "waiting for your first feedback" | — | not ready |
| 1–4 | insights building, *n of 5*; responses readable in full | building | building |
| 5–9 | **first reading**, marked early; topics at 3+ mentions listed as *early signs*; nothing led with | early signs under "not yet clear" | not ready + current early signs |
| 10–24 | patterns at MODERATE; one problem led with, if any | patterns with denominators | ready only with two check-ins of 10+ |
| 25+ | STRONG where ≥ 6 mentions | | |

Five responses unlock a first reading, never "patterns and trends". The readiness copy and the marketing site both say so; the site quotes `firstReadingAt = 5`, `namedAt = 3` and `compareAt = 10`, held equal to the code by `tests/m26.marketing-site.test.ts`.

## K. "Headway just read X"

Home's live line. X counts entries that were **read in the last 15 minutes** (`JUST_READ_MS`) **and arrived in the last 24 hours** (`NEW_WINDOW_MS`). The wording says so: "Headway just read 3 customer responses from the last day". An older entry re-read after an engine upgrade is not counted.

The other states of the same line count something different, and name it differently: "3 customer responses not read yet · Headway is reading them" (or "· reading is paused"). That is every unread response, of any age. The "since your last check-in" count on Home is a third number, and says so.

## L. When Headway says nothing

- fewer than 5 responses: no reading
- a topic under 3 mentions: listed on its entries only, never named as a pattern
- under 10 read: every named topic is an early sign; no lead problem, no suggestion
- a comparison with either side under 10, or under 3 mentions, or a move within chance: no direction
- no rating, no measurable feedback between two check-ins: overall trend is "not enough to compare", **never "holding steady"**
- a response whose words cannot be classified safely: "Not enough evidence to classify this safely." (G)
- a clause about someone other than the business, or a past contrasted with now: set aside (C1)
- the two readers contradict and neither is strong: neither side filed (F)
- the second reader fails, abstains or gives an ungrounded answer: the deterministic reading stands

## M. Deterministic vs AI

Deterministic: every count, share, threshold, confidence level, bucket, comparison, trend, measurement, readiness state and the ranking. AI (optional): topics, with evidence and attribution, for the entries routed in E, validated and arbitrated as in E and F; its tone only where the words carry none. AI never decides a pattern, a trend or a result.

## N. Where it is tested

| Area | File |
|---|---|
| Semantic evaluation: 292 labelled entries, pinned misses, safety metrics | `tests/m45.semantic-eval.test.ts` |
| Trend and measurement maths: required cases, unequal samples | `tests/m45.trend-eval.test.ts` |
| One truth across Home, Customers, Trends, Check-in; readiness at each stage | `tests/m45.consistency.test.ts` |
| Weekly and monthly reports on shares | `tests/m20.stage4.test.ts` |
| Second corpus: 291 development examples in four rounds, four blind sets of 100; attribution traps, abstention, pinned blind results; the AI reader (B) and the combined reader (C) scored from the recording | `tests/m46.semantic-eval.test.ts` |
| AI contract validation and combined-reader arbitration | `tests/m46.ai-contract.test.ts` |
| Recording the AI reader on synthetic data (off by default; `node scripts/eval-ai-reader.mjs`) | `tests/m46.ai-reader-live.test.ts` |
| Rating × wording, every combination | `tests/m46.rating-matrix.test.ts` |
| Every surface counts the topics each response shows | `tests/m46.semantic-consistency.test.ts` |
| The evidence ladder and the live-line wording | `tests/m47.evidence-levels.test.ts` |
