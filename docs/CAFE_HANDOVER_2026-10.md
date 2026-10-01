# Café handover pass — October 2026

Smart Feedback for a café (`packs/restaurant.json`), from QR to the owner's screens. Front Desk untouched. Every number here comes from a test or a script that can be re-run; the gate is `tests/m48.cafe-eval.test.ts`.

## 1. What was wrong

| Area | Defect | Effect on a café owner |
|---|---|---|
| AI reader | The configured `GROQ_MODEL=llama-3.3-70b-versatile` (`.env.local`) returns **404 model_not_found** (retired 2026-08-16). Production's own usage log shows its calls succeeding with the code default (`gpt-oss-120b`) on 9, 17 and 30 September, so production was most likely not overriding with the retired id; 651 of its 654 stored responses had nonetheless been read by the keyword reader alone (most are seeded demo data, which is never sent to a provider). | A configured model that disappears would have disabled the AI reader silently. |
| AI reader | Truncated replies (`finish_reason: length`) and Groq's "Failed to validate JSON" were not distinguished; a reply whose rows lost their indexes could be matched by position to the wrong reviews. | A whole batch fell back; in the worst case a reading could land on the wrong review. |
| Café taxonomy | No coffee/drinks topic, no portion topic, no "served cold" topic; "cold coffee" (the drink) hidden by a mask; `smell` filed coffee aroma as a hygiene complaint; `wifi was slow` filed as slow service. | Café complaints lumped into "Food & taste"; invented problems. |
| Attribution | "Swiggy delivery guy was rude" filed against the staff; delivery-partner lateness and cold-on-arrival filed against the café; "power cut, so no AC" against the café. | The café blamed for someone else. |
| Combined reader | The AI's adjacent-topic mistakes ("bill said 90" → wrong order; hair in coffee → coffee quality) were merged in; a HIGH-confidence AI reading could overrule the keyword reader. | On the café corpus the combined reader was **less safe** than the keyword reader (36 vs 30 unsafe readings). |
| Read definition | Two definitions of "read" (status only vs current reader version). | After the reader upgrade, Home would say "0 read" beside patterns built from the same rows; trends could compare old readings with new ones. |
| Re-read queue | Upgrade re-reads were queued oldest first, 50 per run, ahead of new feedback. | A customer's new response waited hours behind the backlog. |
| Measurement | Before/after compared a baseline frozen under the old reader with today's reading. | A false "IMPROVED" for a food change, saved permanently (cold food moved to "Served cold"). |
| Customer flow | A QR response's first line was deleted when it looked like a name ("Cappuccino"); clock times erased as "long numbers"; the form's nonce was used before the save (a failed save then said "thank you" and stored nothing); identical short text from two customers within 10 minutes collapsed; 15 responses per 10 min per network address (one café Wi-Fi); typed text wiped on any error. | Lost or altered customer feedback, silently. |

## 2. What changed

- **AI.** `DEFAULT_MODEL = openai/gpt-oss-20b` (measured; see 4). Retired-model 404 falls back once to the default and logs `[ai] GROQ_MODEL … Update GROQ_MODEL`. Low reasoning effort. Truncated or invalid-JSON replies are never parsed; the batch is split and retried down to one review, then read deterministically. One short rate-limit wait. Rows without indexes are refused unless one-to-one.
- **Taxonomy** (restaurant pack): new *Coffee & drinks*, *Served cold / not hot*, *Small portions*, *Great coffee & drinks*, *Generous portions*; *Billing & payment problems*; crowding filed under ambience. Hints and aspects for café, Hinglish and Marathi language. Labels translated (hi/mr).
- **Reader** (`scope.ts`, `classify.ts`, `aspects.ts`): delivery apps and riders are third parties; a delivery order's lateness, cold-on-arrival and spills are not the café's unless the response says the café caused it; outages earlier in a sentence; self-blame ("my bad", "our fault for coming late"); past visits and habitual praise against today; sarcasm with a count ("only had to wave six times"), "love how", conditional praise; table waits vs slow service; stays vs waits; unavailable items vs wrong orders; Marathi/Hindi negators.
- **Combined reader** (`normalize.ts`): the AI may fill a side (problems or praise) the keyword reader left empty, never add a competing label to a side it already filed; an unresolved contradiction files neither side; "served cold" needs a stated temperature; in a sarcastic response praise needs 4–5 stars.
- **One definition of read** everywhere (`analysedRows` = current reader version), including the weekly/monthly reports.
- **Queue**: never-read responses first; re-reads deterministic, up to 4× the run limit.
- **Measurement**: when the reader has changed under a baseline, the before side is recounted from the same rows as read now; auto-measure waits while anything is being read.
- **Customer flow**: QR text keeps its first line; clock times kept; nonce keyed to the response and recorded only after a successful save; a failed save says "please tap Send again" and keeps the typed text; text duplicate window 60 s; 40 per 10 min per address; an error page with a retry.
- **Catch-up script**: `scripts/reread-after-upgrade.ts` re-reads every business's stored rows deterministically right after deploy.

## 3. Evaluation (café corpus, `tests/eval/cafe`)

208 development + two blind sets of 128, labelled in meaning by one annotator, labelled again blind by a second, reconciled by a third. Blind sets hashed before any change (`dac83d2c…`, `ad5e51e3…`).

**First (blind) runs — the generalisation figures:**

| Set | Reader | Exact | Precision | Recall | Unsafe (HIGH) |
|---|---|---:|---:|---:|---:|
| blind-1 | deterministic | 30/128 | 88.5% | 39.5% | 13 (1) |
| blind-1 | gpt-oss-20b alone | 52/128 | 91.8% | 57.2% | 11 (11) |
| blind-1 | combined | 47/128 | 91.1% | 57.2% | 13 (1) |
| blind-2 | deterministic | 38/128 | 92.1% | 34.5% | 10 (1) |
| blind-2 | gpt-oss-20b alone | 60/128 | 88.5% | 57.1% | 15 (15) |
| blind-2 | combined | 62/128 | 92.3% | 59.1% | 10 (2) |

**After fixing the error classes each blind run exposed** (sets now seen; pinned in `m48.cafe-eval`):

| Set | Deterministic unsafe (HIGH) | Combined exact | Combined P / R | Combined unsafe (HIGH) |
|---|---:|---:|---:|---:|
| dev | 0 (0) | 115/208 | 100% / 68.4% | 0 (0) |
| blind-1 | 4 (0) | 49/128 | 99.2% / 57.2% | 3 (0) |
| blind-2 | 5 (0) | 65/128 | 99.2% / 64.5% | 1 (0) |

Correct abstention: every set 100% of abstain-labelled responses. Misattribution after fixes: 0 on every café set. The earlier corpora (all verticals) are unchanged or better, with no new unsafe reading.

## 4. Model

Groq models available to the production key: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`. Qwen's output limit on this account is 1,000 tokens/minute (unusable). gpt-oss-120b's 200,000-token daily allowance was spent by an earlier evaluation, so it could not be measured end to end. **gpt-oss-20b, low effort**: median 2.4 s per 10-review batch, max 13 s; output median 1.5k tokens, max 2.4k of the 4k limit (no truncation); 2 of 47 batches returned invalid JSON (now split and retried). Daily allowance 200k tokens (about 80 batches, 800 ambiguous responses); per-minute 8k.

## 5. Production verification (1 October 2026)

- **Deploy**: `9b73dd9` (Vercel "Deployment has completed", 09:06 UTC), then the follow-up below. A verified backup was taken first (`backups/prod-2026-10-01-020420`, restore check `pass: true`).
- **Re-read**: `scripts/reread-after-upgrade.ts` re-read all 654 stored responses of 12 businesses deterministically; none left waiting; no provider call.
- **Test café**: "Headway QA Café (test)" (restaurant pack), created as the platform administrator; its QR page resolves; 24 synthetic responses in two comparable past periods, each closed by a check-in; three real submissions through the public page on a 375×812 viewport.
- **Customer flow**: rating → part ratings with tappable specifics → words (prompt adapts to the rating) → "Thank you"; no console errors; the first line "Cappuccino" kept.
- **Processing**: every response read on Vercel within seconds of the submission that triggered it; production's AI usage log shows `openai/gpt-oss-20b`, 0 failures.
- **Owner views** (rendered by the same server functions as the pages): 25 read, 0 waiting; Home leads with "Served cold / not hot — Getting better, 7 of 12 → 1 of 12 · 58% → 8%" and a practical next step; "Great coffee & drinks" rising (8% → 33%) but "not often enough yet to call it a strength"; a single "Slow service" mention watched, not a pattern; Trends comparable, two better, none worse.
- **Tenant isolation**: as the runtime role, another identity sees 0 of the test café's rows and not the business; no identity sees nothing.
- **Found by the smoke test and fixed** (reader version 4): soggy fries in the same sentence as a late Swiggy rider were filed against the café; Marathi "बिल मध्ये चूक" (a mistake in the bill) was filed as a wrong order; "barely warm" was not read as served cold.

## 6. Remaining risks

1. On unseen wording about 1 response in 13 still carries an unsafe element (blind first runs), mostly MEDIUM or LOW confidence and mostly sentiment; patterns need 3+ mentions, so a single misreading does not become a pattern.
2. A response that fails the AI pass is read by the keyword reader and not retried with the AI later.
3. Check-ins are operator-created; trends appear only when an operator records them.
4. Operator console pages under `(app)` rely on the layout's staff check (RLS still limits rows to the viewer's own business).
5. The old corpora's café examples were relabelled for the new topics (`tests/eval/cafe-relabel.ts`); the frozen files are untouched.
