# Smart Feedback — Intelligence Accuracy and Correctness Audit, September 2026

What was measured, what was wrong, what changed, and what is still wrong. Every number here comes from a test that can be re-run. The rules the code now follows are in [SMART_FEEDBACK_INTELLIGENCE_RULES.md](SMART_FEEDBACK_INTELLIGENCE_RULES.md).

**Scope.** Smart Feedback only. Front Desk is paused; no file of it was touched. No production data was read or changed, no migration is needed, and nothing has been deployed.

**Baseline.** `af572ed` (in production at the start of this audit).

---

## Part 3 — The final correctness gate

**Status: NOT READY.** AI accuracy not measured; acceptance incomplete. Two high-confidence unsafe errors remain on the last blind set. Details in 3.5.

### 3.1 How the gate was run

1. The locked set (blind #1) was frozen at its original hash. It had been run once already, at the end of Part 2. It was not edited, relabelled or tuned against.
2. Development cycle 1: 38 new development examples (round two) for general classes the first development set did not exercise. General fixes were made and verified on every development set and Part 1's corpus after each change.
3. Blind #2 (100 new examples): written after cycle 1, labelled, hashed, run once.
4. It showed high-confidence unsafe errors, so under the gate's final rule: development cycle 2, with 27 new development examples (round three) for the classes blind #2 exposed, written in new words. General fixes again.
5. Blind #3 (100 new examples): written after cycle 2, labelled, hashed, run once.
6. Stopped there, because acceptance cannot pass without measuring the AI reader, and no provider key is available here.

The three blind sets' SHA-256 hashes are pinned in `tests/m46.semantic-eval.test.ts`. None has changed since it was hashed.

### 3.2 What changed (general rules; rules doc C3, H, K)

- **Entity guard.** A generic opinion word attaches to the thing its clause names.
- **Strength.** Only generic words are weak evidence.
- **Time without "used to".** More dated-state markers. An opposite-polarity "then"/"until"/"now" turn makes the first half past, and the past keeps its things.
- **Elided negation.** "X is good, Y isn't".
- **"But" turns the other way.** Praise, then an unread half, is MIXED and goes to the second reader.
- **Qualified third parties.** "The decorator from the venue."
- **Look-alikes.** "Waiting staff" and "waiting chairs".
- **Sarcastic deeds.** "Well done …ing".
- **One polarity vocabulary** for both readers.
- **New aspects.** Treatment outcome and options shown, plus wider anchors.
- **Taxonomy round four.** "Kind" phrases out of doctor care; unreachable and "stopped responding" phrasings.
- **Confidence.** HIGH only on strong evidence with nothing set aside.
- **Only read responses are evidence, everywhere.** Trends had been counting unread rows in their denominators.
- **Check-in reviews are read by the same reader** at creation, so no second classification reaches any surface.
- **Wording.** The live line says exactly what it counts. The Trends page uses the gate's wording.

### 3.3 Results (deterministic reader)

| Set | Status | Exact | Mixed | Wrong attribution | Invented | Wrong polarity | HIGH and wrong |
|---|---|---:|---:|---:|---:|---:|---:|
| Development (200) | tuned | 155 | 47/48 | 0/25 | 0 | 0 | 0/56 |
| Development round two (38) | tuned | 37 | 11/12 | 0/6 | 0 | 0 | 0/10 |
| Development round three (27) | tuned | 27 | 12/12 | 0/0 | 0 | 0 | 0/11 |
| Part 1 corpus (292) | regression | 282 | 39/39 | n/a | 0 | 0 | 0 |
| Blind #1, locked | seen | 61 (56 on first run) | 27/27 | 0/15 | 1 | 0 | 1/30 (kl14) |
| Blind #2 | seen | 74 (**68 on first run**) | 18/22 (12/22 first) | 0/13 | 0 (4 first) | 0 (1 first) | 0/25 (2 first) |
| **Blind #3** | **run once** | **67** | **12/21** | **3/14** | **6** | **0** | **2/20** |

Blind #3 precision 87.0%, recall 59.7%, sentiment 87/100, no reversals, and 14 of 16 abstain-labelled sentences correctly abstained. 25 of its 33 misses go to the AI reader.

**Generalisation did not improve across cycles.** Blind #2's first run gave 68; blind #3's single run gives 67. Each development cycle closes the classes it saw, and the next unseen set brings new ones: a third party the lexicon has never met ("the patient *in front of* me"), a passive agent ("delayed *by a server outage*"), a receiving verb that hides who acted ("our caterer *served* late"). The development numbers are not evidence of accuracy. The blind-set numbers are.

### 3.4 The AI reader and the combined reader

**NOT MEASURED.** The harness covers all 565 synthetic examples:
- recording: `tests/m46.ai-reader-live.test.ts`;
- scoring of AI alone (B) and combined (C), per set, from the recording: `tests/m46.semantic-eval.test.ts`.

No provider key exists on this machine, and the production key was not pulled. **AI accuracy not measured; acceptance incomplete.** To measure:

```
REPOS_EVAL_AI_LIVE=1 GROQ_API_KEY=<key> npx vitest run tests/m46.ai-reader-live.test.ts
npx vitest run tests/m46.semantic-eval.test.ts
```

### 3.5 The acceptance gate

| Requirement | Status |
|---|---|
| No high-confidence wrong attribution | **Fails.** Blind #3 wg01, "Our caterer served late, but the decor crew had everything ready on time": the caterer's lateness filed against the vendor at HIGH. The "receiving is not doing" rule treated "served" as the vendor serving. |
| No high-confidence invented problem | **Met** on every blind set (every invented topic at HIGH was praise). But blind #3 gg01 invented value-for-money *praise* at HIGH from "the trainer still made it worth it". |
| No wrong polarity in an important case | **Met** on blind #3 (0). |
| No trend-mathematics error, no false trend, no unmeasured "stable" | **Met.** `tests/m45.trend-eval.test.ts` (44). Trends now also count read responses only. |
| No mixed-sentiment safety error | **Fails.** Blind #3: 12 of 21 mixed responses read as mixed. Several mixed responses read POSITIVE at MEDIUM (cg02, gg02, eg02, sg02) because their negative half's wording was unknown and was not joined by "but". |
| No cross-surface contradiction | **Met.** `tests/m45.consistency.test.ts`, `tests/m46.semantic-consistency.test.ts`. Unread rows and check-in reviews no longer bypass the shared reading. |
| AI reader measured | **Fails: not measured.** |
| Combined reader validated | **Fails: not validated** beyond the arbitration rules, which are tested on synthetic replies (18 tests). |

### 3.6 What would be needed

1. **A provider key**, then the two commands in 3.4. Until then nothing can be called production-ready.
2. **Attribution beyond word lists.** Three blind sets in a row found new third parties and constructions. A rule worth trying next: never let an attribution-sensitive topic ("late", "rude", "delayed") reach HIGH confidence unless the clause's subject is explicitly the business. That would turn the remaining class of high-confidence misattributions into medium-confidence ones without needing to know every third party. It needs its own development cycle and a **new** blind set; it has not been built or measured.
3. **Mixed responses without "but".** Semicolon and comma juxtaposition ("Supportive trainers; the music is way too loud") reads POSITIVE when the negative half's words are unknown. The AI reader is the intended remedy, and it is unmeasured.
4. After any further change, **a fresh blind set #4**. Blind #3 is now seen.

### 3.7 Verification

| Check | Result |
|---|---|
| Typecheck, lint | clean |
| Pinned semantic evaluation, every set (`m46.semantic-eval`) | 8 pass; AI/combined scoring skipped (no recording) |
| AI contract and arbitration (`m46.ai-contract`) | 18 pass |
| Rating × wording, every combination (`m46.rating-matrix`) | 140 pass |
| Cross-surface semantic consistency (`m46.semantic-consistency`) | 7 pass |
| Evidence ladder and live-line wording (`m47.evidence-levels`) | 7 pass |
| Trend and before/after mathematics (`m45.trend-eval`) | 44 pass |
| Full suite (local disposable Postgres) | 3,070 pass. The only 2 failures are the known pre-existing ones, unrelated to this work (clock-dependent continuity; backup's local SQLite file). |
| Production build (all database and auth variables dead) | succeeds |
| Deploy, push, production data, production re-read, production reader version, environment variables | none |

---

## Part 2 — The final semantic correctness pass

This part comes after the first audit (Part 1, below, sections 1–8). Part 1's semantic numbers were measured on a corpus partly tuned against. This part measures on a corpus written fresh, before any change, with a locked holdout run exactly once.

### 2.1 A new gold corpus, written before any change

`tests/eval/semantic-v2-dev.ts` (200) and `tests/eval/semantic-v2-locked.ts` (100). All seven verticals; hand-labelled. On top of Part 1's labels, each example can carry:

- **attribution traps:** topics that would blame the business for what someone else did;
- **abstain:** nothing in the sentence can safely be filed.

Categories: attribution, clause, negation, mixed, rating disagreement, sarcasm, idiom, multilingual, vague, temporal, causal, event, ambiguous, short, long and misspelt.

The locked file's SHA-256 was recorded before the first engine change. `tests/m46.semantic-eval.test.ts` fails if a byte of it changes.

Two development labels were corrected during tuning because they contradicted the stated contract. Both corrections are commented in the file:
- **gv02:** a 4★ with neutral words is POSITIVE under the rating rule.
- **sv28:** the salon pack defines "listened" as warmth.

No locked label was touched.

### 2.2 What was wrong, by category, before any change (development set)

| Category | Failures on the 200 | Example |
|---|---|---|
| Subject / blame attribution | 13 of 25 trap sentences misattributed | "The baraat ran two hours late" → vendor punctuality |
| Clause polarity | most of 19 mixed failures | "Decor was beautiful; coordination was poor" → POSITIVE |
| Quantified negation | 2 invented | "Not a single class was cancelled" → schedule complaint |
| Middle rating | 3★ + vague words read MIXED | "It was fine" (3★) → MIXED |
| Temporal | past praise counted now | "Equipment was new when I joined, now broken" → MIXED |
| Event vs business, deliverables | album "arrived early" → team punctuality | |
| Bare or shared hints | "quick", "kind", "value"; one hint on two topics | "the AC is not working" → broken equipment |
| Recall: idiom, sarcasm, misspelling, indirect, Devanagari | most of the rest | routed to the AI reader |

### 2.3 What changed: general rules, not sentences

| Change | Rule |
|---|---|
| **Scope** (`scope.ts`, new) | Who and when, clause by clause. A clause with an attribution-sensitive predicate whose subject is not the business is set aside and recorded, never re-assigned. Covers receiving vs doing, cause in both directions, subject carry-over, deliverables and the past-vs-now contrast. Rules doc C1. |
| Sarcastic openers | discounted and routed to the second reader |
| Quantified negation | "not a single", "not one", "not once", "none of" negate the clause, for hints and aspects |
| Absence complaints | "they never reply" is the complaint, not its denial |
| Clause polarity | overall sentiment reads every clause; praise plus an unmatched complaint is MIXED |
| Middle rating | 3★ with no opinion in the words is NEUTRAL |
| New aspects | paperwork, bill, communication, schedule, tool hygiene, parking; strength per topic (STRONG/WEAK) |
| Taxonomy round three | verdict-less single words removed; every hint shared by two topics in a pack removed (5); gym "not working" removed. Generated audit: [SMART_FEEDBACK_TAXONOMY_AUDIT.md](SMART_FEEDBACK_TAXONOMY_AUDIT.md) |
| AI contract 2 | per-topic polarity, attribution, confidence and verbatim evidence; validated and fail-closed; explicit abstention |
| Arbitration | the combined reader's precedence policy (rules doc F) |
| Abstention | "Not enough evidence to classify this safely." on the response itself; set-aside clauses explained in its stored reasons |

`ANALYSIS_VERSION` was **not** raised again in this pass. It is 3 in the code (raised in Part 1, never deployed); production still reads with 2.

### 2.4 Results

**A — the deterministic reader.** "Production" is today's reader at `af572ed`; "final" is the reader after this pass.

| Metric | Dev: production | Dev: final (tuned) | **Locked: production** | **Locked: final (blind, once)** |
|---|---:|---:|---:|---:|
| Exact | 69/200 | 154/200 | 30/100 | **56/100** |
| Sentiment right | 162 | 199 | 78 | **90** |
| Sentiment reversed | 0 | 0 | 0 | **0** |
| Mixed read as mixed | 35/48 | 47/48 | 20/27 | **22/27** |
| Topic precision | 75.9% | 100% | 81.0% | **95.2%** |
| Topic recall | 33.5% | 76.6% | 35.4% | **62.5%** |
| Wrong polarity (same concept, wrong side) | 3 | 0 | 0 | **1** |
| Invented topics | 21 | 0 | 8 | **3** (all praise) |
| **Wrong attribution** (trap sentences misread) | 12/25 | 0/25 | 3/15 | **0/15** |
| Forbidden readings | 16 | 0 | 3 | **0** |
| False high-confidence (HIGH and wrong) | 8/44 | 0/80 | 4/19 | **2/33** |
| Correct abstention (sentences labelled "abstain") | 25/29 | 29/29 | 13/14 | **14/14** |

The development and locked figures differ (77% against 56% exact) because the development set was tuned against. **56/100 is the generalisation figure.** It is nearly double production's 30/100 on the same blind sentences, but it is not high.

Of the 44 locked misses, 36 go to the AI second reader and 8 are kept by the router as confident.

**Part 1's corpus (292), as a regression check:** 281/292 exact, with zero invented topics, zero forbidden readings and zero wrong polarity. wx1, the baraat sentence that was the one safety failure in Part 1, now abstains. Its fresh set is 20/28: 15/28 on first blind sight last pass, scored but not tuned against since.

**B — the AI reader alone, and C — the combined reader: NOT MEASURED.** The harness is complete:
- `tests/eval/ai-reader-eval.ts` holds production's prompt, parser, validation, routing and arbitration;
- `tests/m46.ai-reader-live.test.ts` records provider replies for the 300 synthetic examples;
- `tests/m46.semantic-eval.test.ts` scores A, B and C separately from the recording, with every metric above.

No provider key existed on this machine: `.env.local`'s key is empty, and the production key in Vercel was not pulled. No AI accuracy figure is claimed. To measure:

```
REPOS_EVAL_AI_LIVE=1 GROQ_API_KEY=<key> npx vitest run tests/m46.ai-reader-live.test.ts
npx vitest run tests/m46.semantic-eval.test.ts
```

With no provider configured, or when the provider fails, production's combined reader **is** reader A, so A's numbers are the combined reader's floor today. The arbitration rules themselves are proven on synthetic replies (`tests/m46.ai-contract.test.ts`, 18 tests).

### 2.5 Against the acceptance standard (locked set)

| Requirement | Result |
|---|---|
| 0 wrong-polarity cases | **Not met: 1.** sl12, "The colour looked great for a day and then turned orange": the praise for the first day is kept. A time shape ("for a day and then") the past-versus-now rule does not cover. |
| 0 high-confidence invented problems | **Met.** No problem topic was invented. Two *praise* topics were invented at HIGH confidence: cl15 "gentle dentist" also filed as staff friendliness; kl14 "supportive teachers" also filed as teaching praise. Neither is a problem; both are wrong. |
| 0 high-confidence wrong attribution | **Met: 0 of 15.** |
| 0 mixed-sentiment failures | **Not met: 22 of 27.** gl03 "the changing rooms are not" (elided predicate); wl04 "sloppy stage lighting" (no anchor for lighting); el14 "hard to reach on weekends"; el07 and wl08, a complaint at 4★ read POSITIVE because no topic or polarity word was found. |
| No mathematical trend errors | **Met.** Part 1's rule, unchanged; `tests/m45.trend-eval.test.ts` (44). |
| Ambiguous cases abstain | **Met:** 14/14 sentences labelled "abstain" abstained. |
| Surfaces consistent | **Met.** `tests/m45.consistency.test.ts` (16) and `tests/m46.semantic-consistency.test.ts` (7): every aggregate equals the per-response topics, in every vertical. |

The code was not changed in response to any locked result.

### 2.6 What remains

1. **Generalisation is about 56%** for the deterministic reader on unseen wording; recall is 62.5%. Most misses name nothing rather than something wrong, and most are sent to the second reader, whose accuracy is unmeasured.
2. **Five locked mixed failures and one wrong-side praise**, described above. Each is a class: elided predicates, unanchored complaints, rating-only fallbacks, short-lived past states.
3. **Attribution is lexical.** It knows the subjects in its lists and the predicates that need one. A third party it has never seen ("the decorator's assistant") is treated as the business. That is the safe default for counting complaints, but it is not understanding.
4. **Sarcasm** is caught only at a sentence's opening. Sarcasm elsewhere goes to the second reader only when nothing else was found.
5. **Deploying** this code re-reads every stored response once, deterministically: production is on reader version 2, the code on 3. Topic counts will change. That is still a decision for you, as in Part 1, §7.

### 2.7 Verification

| Check | Result |
|---|---|
| Typecheck, lint | clean |
| Second corpus, pinned (`tests/m46.semantic-eval.test.ts`) | 8 pass; the AI/combined scoring skipped, as no recording exists |
| AI contract and arbitration (`tests/m46.ai-contract.test.ts`) | 18 pass |
| Rating × wording matrix (`tests/m46.rating-matrix.test.ts`) | 140 pass |
| Semantic consistency across surfaces (`tests/m46.semantic-consistency.test.ts`) | 7 pass |
| Trend evaluation, cross-surface consistency (`tests/m45.*`) | pass |
| Full suite, local disposable Postgres | 3,063 pass. The only 2 failures are the known pre-existing ones, unrelated to this pass: `responsibility.test.ts` "continuity" (clock-dependent) and `backup.service.test.ts` (expects a local SQLite file). |
| Production build (all database and auth variables pointed at nothing) | succeeds |
| Deploy, push, production data, production re-read, reader version | none: nothing deployed, pushed or re-read, and `ANALYSIS_VERSION` not raised in this pass |

---

# Part 1 — The first intelligence audit

## 1. The semantic reader

### How it was measured

`tests/eval/semantic-dataset.ts` holds 292 pieces of synthetic feedback across all seven verticals. Each carries a fixed human label: sentiment, the praise and problem topics it supports, the topics it must never be read as, and whether its wording is explicit enough for the keyword reader. Labels were written by hand before the engine was run on them. No model produces a label, at test time or otherwise.

It covers positive, negative, mixed, neutral, short, long, multi-issue, indirect, colloquial, misspelt, multilingual (Hindi, Marathi, Hinglish, Devanagari), ambiguous, must-not-infer, rating-disagrees-with-text and same-concept-different-words.

The corpus was written in four sets, and the difference between them is the honest part of this report:

| Set | Size | When written | Status |
|---|---|---|---|
| first | 118 | before any change | tuned against |
| second | 95 | before any change | tuned against |
| holdout | 51 | after round one, blind | scored once, then its misses fixed; **no longer blind** |
| fresh | 28 | after round two, blind | scored once, **never tuned against** |

What was scored: the **deterministic** reader, which production uses for every response the router does not escalate, and for all of them when no AI provider is set. The optional AI second reader cannot be scored offline.

### Results: the original reader against the reader now

Same 292 examples, same labels. "Before" is the committed engine and packs at `af572ed`.

| Metric (all 292) | Before | After |
|---|---:|---:|
| Exactly right (sentiment + all topics + nothing forbidden) | 164 (56%) | **276 (95%)** |
| Sentiment right | 250 | 289 |
| **Sentiment reversed** (positive read as negative or back) | **5** | **0** |
| Mixed responses read as mixed | 32 / 39 | 39 / 39 |
| Rating disagrees with words, read correctly | 9 / 11 | 11 / 11 |
| Problem topics found | 110 / 194 | 185 / 194 |
| Praise topics found | 97 / 144 | 138 / 144 |
| **Invented problem topics** | **10** | **1** |
| Invented praise topics | 1 | 0 |
| **Forbidden readings** | **10** | **1** |
| Topic on the wrong side of the same concept | 1 | 0 |
| **False strong** (invented problem, stated with HIGH confidence) | **5** | **1** |
| Wrong and kept as confident (no second reader) | 37 | 3 |
| **Serious problem missed silently** | **6** | **0** |

By set, exactly right:

| Set | Before | After | What it means |
|---|---:|---:|---|
| first (tuned) | 81 / 118 | 116 / 118 | fit |
| second (tuned) | 54 / 95 | 95 / 95 | fit |
| holdout | 24 / 51 | **29 / 51 on first blind sight**, 50 / 51 after fixing | generalisation of round one |
| fresh (blind) | 5 / 28 | **15 / 28** | generalisation of round two: **the honest figure** |

**Read this table carefully.** On wording it has not seen, the deterministic reader is exactly right about **54–57% of the time** (holdout first sight 57%, fresh 54%), up from **18%** on the fresh set before this pass. The 95% overall is fit to sets that were tuned against and must not be quoted as accuracy.

What makes the unseen-wording result acceptable rather than alarming is *how* it fails. Of the 13 fresh-set misses:

- 12 leave a topic unnamed, with the sentiment right. The reader says less, not something false.
- 10 of the 13 are routed to the AI second reader.
- 1 invents a topic (wx1, below).

A generalisation figure near 55% means the keyword vocabulary is still well short of how customers actually write. It will keep improving only as real feedback shows which phrasings are missing.

### The misses that remain (pinned by name in `tests/m45.semantic-eval.test.ts`)

| Id | Text (abridged) | Why | Second reader? |
|---|---|---|---|
| r18 | "By the time our mains arrived, the kids had fallen asleep." | slow service, implied | yes |
| c17 | "I came out with more questions than I went in with." | rushed consult, implied | yes |
| kh4 | "Mock tests every week really helped my daughter." | "helped" not anchored to study material | yes |
| rx1 | "The paneer tikka was smoky and perfectly spiced." | neither word in the food vocabulary | yes |
| cx2 | "Nobody at the front desk answered my calls…" | "nobody" negates the complaint | yes |
| **kx2** | "Notes are well organised and cover the whole syllabus." | read as discipline praise | **no** |
| kx3 | "They never inform parents when a test is postponed." | "never" negates the hint | yes |
| **gx3** | "Trainer designed a plan… lost 5 kg." | no opinion word near "trainer" | **no** |
| ex1 | "He knew every society in the area…" | knowledge, implied | yes |
| ex2 | "Brokerage was higher than what he said…" | "higher" not a price opinion word | yes |
| ex3 | "Registration papers are still stuck…" | no documentation-delay phrasing | yes |
| ex4 | "Did not rush us at all…" | negated pressure not read as praise | yes |
| sx1 | "My nails chipped within two days…" | no result vocabulary for nails | yes |
| sx3 | "The waxing strips looked reused, not hygienic." | negated praise not turned into the complaint | yes |
| **wx1** | "The team was calm even when the baraat ran two hours late." | **invents a punctuality complaint**: the lateness belongs to the baraat, not the vendor | **no** |
| wx4 | "Stopped answering our calls a week before the wedding." | not in the communication phrasing | yes |

**wx1 is the one safety failure left**, and it is a class, not a sentence. The reader does not know *who* a complaint is about. It will attach lateness, rudeness or a delay to the business when the sentence blames someone else. It is kept in the corpus as a failing example. It was not patched, because a patch for the sentence would hide the class.

### What changed in the reader

- **Aspect reading** (`src/lib/analysis/aspects.ts`, new). Clauses split at "but / though / lekin / पर"; an opinion attaches to the nearest named thing within five words. Negated praise becomes a complaint and a negated complaint is dropped. A clause saying both says nothing.
- **Negation** (`classify.ts`): degree words ("not very clean"), "hardly"/"barely", post-position Hindi/Marathi negators, clause negators ("nobody", "refused to").
- **Longest match wins** where hints overlap; neutral phrases ("no complaints") are masked.
- **Quantities as verdicts**: stated waits, "lost N kg", a deliverable three or more months late, a consultation of five minutes or less, a batch of 40+.
- **Rating against words**: a 3★ rating no longer turns a clear complaint or clear praise into MIXED.
- **AI guard**: the second reader cannot add a topic the deterministic reader refused as negated, or the opposite of one it found.
- **Taxonomy pass** (`scripts/taxonomy-quality-pass.mjs`, idempotent, two rounds recorded separately; round two alone changed 48 topics, and a second run changes nothing):
  - round one added common phrasings (English, Hinglish, Devanagari) and removed hints proven to invent readings;
  - round two removed every **bare word with no verdict** ("vibe", "flavour", "updates", "cancelled", "loan", "showed", "worked", "personal"…);
  - round two rebuilt the four **refund** topics, which filed "got my refund quickly" as a complaint and dropped "refused to refund" as negated.
- `ANALYSIS_VERSION` 2 → 3.

## 2. Trends and comparisons

### What was wrong: proven, not suspected

A topic's trend compared **raw mention counts** between two check-ins. It needed only 3 entries per check-in and a count change of 2. Any check-in that simply held more feedback looked worse.

| Case | Old verdict | Correct |
|---|---|---|
| 5/10 → 10/20 | WORSENING ("up 5") | STABLE: same half of customers |
| 5/10 → 15/20 | WORSENING | WORSENING |
| 15/20 → 5/20 | IMPROVING | IMPROVING |
| 5/10 → 5/20 | STABLE | IMPROVING: half, then a quarter |
| 0/10 → 1/20 | STABLE ("holding steady") | no trend: one mention |
| 1/5 → 2/20 | STABLE | no trend: five is too thin |
| 10/20 → 10/10 | STABLE | WORSENING: everyone, up from half |
| 10/20 → 12/40 | WORSENING | IMPROVING: 50% → 30% |
| 6/30 → 5/10 | STABLE | WORSENING: 20% → 50% |
| 3/3 → 5/5 | WORSENING | no trend: too thin |

The old rule got **2 of the 7 required cases** right.

The same fault, or a close cousin, was in four more places:

| Where | Fault |
|---|---|
| Weekly / monthly reports | raw counts over calendar windows of different sizes |
| Before/after measurement | shares, but no mention floor and no allowance for chance: "2 of 20 → 0 of 20" was IMPROVED |
| Health card, unhappy share | no allowance for chance: "1 of 10 → 2 of 10" counted as declining |
| Health card, overall | "holding steady" when **nothing** could be measured (no rating, too little feedback) |
| Trends page | "+100%" from counts (5 → 10 read as a doubling) |
| Volume caveat | claimed "some of this movement is just more feedback", which stops being true once shares are compared |

### What it is now

One rule, `compareShares` in `src/lib/health/compare.ts`, used by all of the above. Both sides need 10 entries and one side needs 3 mentions. A move under 5 points is STABLE. A move over 5 points must also clear a two-proportion z-score of 1.28 (80% two-sided), or it is "cannot tell yet". The rules document has the formula. `INTELLIGENCE_VERSION` 1 → 2 and `MEASUREMENT_VERSION` 1 → 2.

All ten cases above now give the correct verdict: at the rule, on the Trends page end to end, and, for the measurement cases, in `measureAction`. `tests/m45.trend-eval.test.ts` has 44 tests, all passing.

Every movement sentence now states both totals and both shares:

> 5 of 10 at your check-in on June (50%), 10 of 20 at August (50%). About the same share of feedback.

### What that costs, stated plainly

With 10 entries on each side, a topic has to move about 30 percentage points to be called a direction. Small businesses will see "cannot tell yet" often. That is the correct answer for their volume, not a defect. A 95% bar would silence nearly everything; a lower bar would report noise.

## 3. One truth across screens

**Found.** Home led with a complaint the engine graded EARLY (three mentions in five responses), with a suggestion and buttons, while Customers filed the same topic under "not yet clear".

**Fixed.**
- Home never leads with an early sign. From 5 to 9 responses it says "early reading", lists early signs as such, and uses a neutral dot, not the gold reserved for the one action.
- `tests/m45.consistency.test.ts` runs one set of check-ins through Home, Customers, Trends, Check-in and the readiness logic, across every verdict (better, worse, stable, cannot-tell, too few, too thin, one check-in, praise both ways). Each topic must read the same everywhere, and "was there a comparison" must have one answer everywhere.

## 4. What the owner is told as feedback arrives

- **Before:** the readiness screen promised "patterns and trends" at 5 responses. The site's FAQ did too. The Trends page showed a one-line blank until a second check-in. Three owner-facing lines told the owner to do check-ins, which only an operator can do.
- **After:** 5 responses give "a first reading". Patterns firm up at 10, and trends need two check-ins of 10+ each. The site now quotes all three thresholds from the code. The Trends page explains which condition is missing and shows the current patterns meanwhile. No owner-facing line asks the owner to make a check-in.

"Headway just read X": X counts entries read in the last 15 minutes that also arrived in the last 24 hours. The wording "just read X **new**" was checked against that definition and is accurate. An old entry re-read after an upgrade is not counted.

## 5. Other defects found on the way

| Defect | Fix |
|---|---|
| Hinglish "bahut wait karna pada" stopped being a waiting complaint when round one removed bare "wait" | common Hinglish waiting phrases added to clinic, salon and restaurant, negation intact |
| The weekly-report tests fed windows where every entry mentioned the complaint (100% both weeks), so they tested counts, not change | rebuilt with realistic windows; two tests added: a busier week at the same share is not worse, and a chance-sized move is "cannot tell" |
| The **wedding demo** claimed WORSENED on 10/24 → 15/28 (z = 0.86, well within chance) | three before-change reviews rewritten as other complaints: 7/24 → 15/28 (z = 1.78). The story now supports what it says; every other demo already did |

## 6. Remaining limitations

1. **Unseen-wording accuracy is about 55%** for the deterministic reader. The AI second reader's accuracy is unknown: it cannot be scored offline, and the corpus scores only what it would be *sent*.
2. **Subject attribution** (wx1). A complaint about a third party can be filed against the business.
3. **Three silent misses** (gx3, kx2, wx1) are kept by the router as confident, so no second reader sees them.
4. **Check-ins are operator-only.** Trends exist only as often as an operator records a check-in. The Trends page explains the wait, but the cadence is a process gap. Scheduling check-ins automatically is recommended and is not built.
5. **Frozen results keep their old verdicts.** Measurements taken under version 1 keep their stored verdict by design. That includes the wedding demo's WORSENED in any demo already provisioned; provisioning is idempotent and will not rewrite it unless the demo is rebuilt.
6. **Recurrence** ("keeps coming back") uses the naming floor (3 entries per check-in), not the 10-entry comparison floor. It is a count claim ("named at two check-ins"), not a comparison of shares.

## 7. Before deploying

- **Every stored response will be re-read.** `ANALYSIS_VERSION` 3 makes every stored entry out of date.
  - The re-read is **deterministic only**: history is never re-sent to the AI provider. It runs in batches of 50 per pipeline run.
  - Until it finishes, those entries count as not yet read on Home.
  - Topic counts in production **will change**: topics the old bare-word hints invented disappear, and topics an earlier AI reading added are replaced by the deterministic reading.
  - This is intended, but it should be a conscious decision, ideally at a quiet hour.
- No schema change and no migration.
- `MEASUREMENT_VERSION` 2 affects only measurements taken from now on.

## 8. Verification

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | clean |
| Lint (`eslint .`) | clean |
| Semantic evaluation, trend evaluation, consistency and readiness (`tests/m45.*`) | 72 / 72 |
| Full suite (local disposable Postgres) | all pass except 2 known pre-existing failures, unrelated to this pass, which also fail on a clean tree: `responsibility.test.ts` "continuity" (clock-dependent, 119 vs 120 days) and `backup.service.test.ts` (expects a local SQLite file) |
| Production build (all database and auth variables pointed at nothing) | succeeds |
