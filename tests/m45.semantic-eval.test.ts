import { describe, expect, it } from 'vitest';
import { getPackOrFallback } from '@/lib/packs';
import { SEMANTIC_DATASET as RAW_SEMANTIC_DATASET } from './eval/semantic-dataset';
import { withCafeRelabels } from './eval/cafe-relabel';

/** The corpus with the café taxonomy relabels applied (see eval/cafe-relabel.ts). */
const SEMANTIC_DATASET = withCafeRelabels(RAW_SEMANTIC_DATASET);
import {
  describeMiss,
  evaluateExample,
  isFresh,
  isHoldout,
  isSecondSet,
  summarise,
  type ExampleResult,
} from './eval/semantic-eval';

/**
 * M45 — THE SEMANTIC EVALUATION, PINNED (intelligence quality pass, Sep 2026).
 *
 * 292 pieces of synthetic feedback with fixed human labels, written in four
 * sets, scored against the DETERMINISTIC reader — what production does for
 * every response the router does not send to a second reader, and for all of
 * them when no provider is configured. No model runs here and no label is
 * produced at test time.
 *
 *   first set   (118)  written before any engine change
 *   second set   (95)  written before any engine change, used as a check
 *   holdout      (51)  written blind after the first round of fixes; scored
 *                      29/51 on first sight. Its misses were then fixed, so
 *                      it is no longer blind.
 *   fresh        (28)  written blind after the second round; scored 15/28 on
 *                      first sight and NOT tuned against since. This is the
 *                      honest generalisation figure, and it is low.
 *
 * What this pins:
 *
 *   1. The labels are sound: every key names a real topic in its pack.
 *   2. The safety metrics that cannot be bought with false positives stay at
 *      zero — no sentiment reversals, no wrong-polarity topic, no silent miss
 *      of a serious problem — except one documented invented topic (wx1).
 *   3. The exact list of misses. A new miss fails this test; so does a fixed
 *      one, so the list and the audit document stay true.
 *
 * Nothing here lowers the standard: a miss is recorded as a miss.
 */

/**
 * Every example the deterministic reader gets wrong today, and why. Anything
 * marked [AI] is sent to the second reader by the router; its answer cannot
 * be scored offline.
 */
const KNOWN_MISSES: Record<string, string> = {
  // Indirect: the complaint is implied, not stated. Sent to the second reader.
  r18: 'kids fell asleep before the mains arrived — slow service, implied',
  c17: 'more questions than I went in with — a rushed consult, implied',
  kh4: 'mock tests really helped — "helped" is not anchored to study material',
  // The fresh set, blind, left as scored.
  rx1: 'smoky, perfectly spiced — neither word is in the food vocabulary',
  cx2: 'nobody answered my calls — the "nobody" negator swallows the complaint',
  kx2: 'notes well organised — read as discipline praise, not study material',
  kx3: 'never inform parents — "never" negates the communication hint',
  gx3: 'trainer designed a plan — no opinion word near "trainer"',
  ex1: 'knew every society and their prices — market knowledge, implied',
  wx4: 'stopped answering our calls — not in the communication phrasing',
};

const results = SEMANTIC_DATASET.map(evaluateExample);
const byId = new Map(results.map((r) => [r.id, r]));
const pick = (f: (r: ExampleResult) => boolean) => {
  const rs = results.filter(f);
  return summarise(
    SEMANTIC_DATASET.filter((e) => rs.some((r) => r.id === e.id)),
    rs,
  );
};

describe('the gold set itself', () => {
  it('holds at least 200 labelled examples, across every vertical, with unique ids', () => {
    expect(SEMANTIC_DATASET.length).toBeGreaterThanOrEqual(200);
    expect(new Set(SEMANTIC_DATASET.map((e) => e.id)).size).toBe(SEMANTIC_DATASET.length);
    const packs = new Set(SEMANTIC_DATASET.map((e) => e.pack));
    expect([...packs].sort()).toEqual(
      ['clinic', 'coaching', 'gym', 'real_estate', 'restaurant', 'salon', 'wedding_vendor'],
    );
  });

  it('labels only topics that exist in the pack, on the right side', () => {
    const bad: string[] = [];
    for (const e of SEMANTIC_DATASET) {
      const pack = getPackOrFallback(e.pack);
      const issues = new Set(pack.issueTaxonomy.map((t) => t.key));
      const praise = new Set(pack.praiseTaxonomy.map((t) => t.key));
      for (const k of e.expected.issues) if (!issues.has(k)) bad.push(`${e.id}: issue ${k}`);
      for (const k of e.expected.praise) if (!praise.has(k)) bad.push(`${e.id}: praise ${k}`);
      for (const k of [...(e.expected.tolerated ?? []), ...(e.expected.prohibited ?? [])]) {
        if (!issues.has(k) && !praise.has(k)) bad.push(`${e.id}: ${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('splits into the four sets the audit reports', () => {
    const counts = {
      first: results.filter((r) => !isSecondSet(r.id) && !isHoldout(r.id) && !isFresh(r.id)).length,
      second: results.filter((r) => isSecondSet(r.id)).length,
      holdout: results.filter((r) => isHoldout(r.id)).length,
      fresh: results.filter((r) => isFresh(r.id)).length,
    };
    expect(counts).toEqual({ first: 118, second: 95, holdout: 51, fresh: 28 });
  });
});

describe('the safety metrics', () => {
  const all = summarise(SEMANTIC_DATASET, results);

  it('never reads a positive response as negative, or the reverse', () => {
    expect(all.sentimentReversals).toBe(0);
  });

  it('never files a topic on the wrong side of the same concept', () => {
    expect(all.wrongPolarity).toBe(0);
  });

  it('never silently misses a problem the pack calls serious', () => {
    expect(all.silentSeriousMisses).toBe(0);
  });

  it('invents no topic anywhere', () => {
    // wx1 ("the baraat ran two hours late") was the one invention until the
    // final semantic pass read who each clause is about.
    const inventing = results
      .filter((r) => r.extraIssues.length + r.extraPraise.length + r.prohibitedHit.length > 0)
      .map((r) => r.id);
    expect(inventing).toEqual([]);
    expect(all.falseStrong).toBe(0);
  });

  it('reads a star rating that disagrees with the words by the words', () => {
    expect(all.ratingConflicts.exact).toBe(all.ratingConflicts.total);
  });

  it('reads every response labelled mixed as mixed', () => {
    expect(all.mixed.correct).toBe(all.mixed.total);
  });
});

describe('the misses, by name', () => {
  it('are exactly the known ones — a new miss fails, and so does a silent fix', () => {
    const misses = results.filter((r) => !r.exact).map((r) => r.id).sort();
    const detail = results.filter((r) => !r.exact && !(r.id in KNOWN_MISSES)).map(describeMiss);
    expect(detail, 'new misses').toEqual([]);
    expect(misses).toEqual(Object.keys(KNOWN_MISSES).sort());
  });

  it('scores each set where the audit records it', () => {
    const first = pick((r) => !isSecondSet(r.id) && !isHoldout(r.id) && !isFresh(r.id));
    const second = pick((r) => isSecondSet(r.id));
    const holdout = pick((r) => isHoldout(r.id));
    const fresh = pick((r) => isFresh(r.id));
    expect([first.exact, first.total]).toEqual([116, 118]);
    expect([second.exact, second.total]).toEqual([95, 95]);
    expect([holdout.exact, holdout.total]).toEqual([50, 51]);
    // Blind, and deliberately not tuned against: the honest figure.
    // 15/28 on first blind sight (previous pass); scored, not tuned against, since.
    expect([fresh.exact, fresh.total]).toEqual([21, 28]);
  });

  it('keeps the known misses mostly where a second reader will see them', () => {
    const silent = Object.keys(KNOWN_MISSES).filter((id) => byId.get(id)!.silentMiss);
    // kx2 and gx3: kept by the router as confident. Listed in the audit.
    expect(silent.sort()).toEqual(['gx3', 'kx2']);
  });
});
