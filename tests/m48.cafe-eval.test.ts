import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { explain, scoreReading } from './eval/reader-eval';
import { combinedReading, deterministicReading } from './eval/ai-reader-eval';
import { cafeLine, isUnsafe, loadCafeSet, summariseCafe, toV2, unsafeOf } from './eval/cafe/cafe-eval';
import { loadCafeRecording, parseCafeRecording } from './eval/cafe/cafe-ai';

/**
 * M48 — THE CAFÉ EVALUATION, PINNED (café handover pass, October 2026).
 *
 * The café corpus (tests/eval/cafe) is labelled in meaning, written by one
 * annotator, labelled again blind by a second and reconciled by a third.
 *
 *   dev       208   tuned against
 *   blind-1   128   frozen and hashed before any change; run once, then SEEN
 *   blind-2   128   frozen and hashed before any change; run once, then SEEN
 *
 * THE FIRST, BLIND RUNS — the generalisation figures, never tuned:
 *
 *   blind-1  deterministic  exact 30/128, P 88.5%, unsafe 13 (HIGH 1)
 *            combined       exact 47/128, P 91.1%, R 57.2%, unsafe 13 (HIGH 1)
 *   blind-2  deterministic  exact 38/128, P 92.1%, unsafe 10 (HIGH 1)
 *            combined       exact 62/128, P 92.3%, R 59.1%, unsafe 10 (HIGH 2)
 *
 * After each blind run its error CLASSES (not its sentences) were fixed —
 * sarcasm with a count ("only had to wave six times"), "love how", habitual
 * praise against today, delivery and parking delays, a reservation given
 * away, Marathi and Hinglish words — and every set re-scored. The numbers
 * below are those re-scores. They are no longer blind and are not quoted as
 * accuracy; they pin that the classes stay fixed.
 *
 * THE GATE THIS FILE HOLDS: on every café set, no reading that is unsafe —
 * reversed, misattributed, invented — at HIGH confidence, from either the
 * deterministic or the combined reader; and on the development set, no
 * unsafe reading at all. The combined reader is scored from recorded replies
 * of openai/gpt-oss-20b (low reasoning effort), the production model.
 */

const HASHES: Record<string, string> = {
  'tests/eval/cafe/blind-1.json': 'dac83d2c1dd14789f9f9943763cb3c1eedde4e82bf07c2ca8bd7eb0c605bb0e7',
  'tests/eval/cafe/blind-2.json': 'ad5e51e38962b063c74995c82def1036e18acb2216a101c874dce42af4fd612e',
};

const MODEL = { model: 'openai/gpt-oss-20b', effort: 'low' as const };

function run(set: string) {
  const examples = loadCafeSet(`tests/eval/cafe/${set}.json`);
  const conv = examples.map((e) => toV2(e));
  const rec = loadCafeRecording(set, MODEL);
  const readings = rec ? parseCafeRecording(rec, examples).readings : new Map();
  const a = conv.map((c) => scoreReading(c.v2, deterministicReading(c.v2)));
  const c = conv.map((x) => scoreReading(x.v2, combinedReading(x.v2, readings.get(x.v2.id))));
  return { examples, conv, rec, a, c, sa: summariseCafe(conv, a), sc: summariseCafe(conv, c) };
}

describe('the café corpus', () => {
  it('blind sets are exactly as frozen before their first run (LF line endings, as hashed)', () => {
    for (const [path, hash] of Object.entries(HASHES)) {
      const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
      expect(createHash('sha256').update(text).digest('hex'), path).toBe(hash);
    }
  });

  it('has 208 development and 2 × 128 blind examples, with recorded replies for all three', () => {
    for (const [set, n] of [['dev', 208], ['blind-1', 128], ['blind-2', 128]] as const) {
      const r = run(set);
      expect(r.examples.length).toBe(n);
      expect(r.rec, `${set} recording`).not.toBeNull();
    }
  });
});

describe('the café gate', () => {
  for (const set of ['dev', 'blind-1', 'blind-2']) {
    it(`${set}: no HIGH-confidence unsafe reading, deterministic or combined`, () => {
      const r = run(set);
      console.log(cafeLine(`A ${set}`, r.sa));
      console.log(cafeLine(`C ${set}`, r.sc));
      const highUnsafe = [...r.a, ...r.c].filter((s) => s.reading.confidence === 'HIGH' && isUnsafe(unsafeOf(s)));
      expect(highUnsafe.map(explain)).toEqual([]);
    });
  }

  it('dev: nothing unsafe at all, and the combined reader is never less safe than the deterministic one', () => {
    const r = run('dev');
    expect(r.sa.unsafe.any).toBe(0);
    expect(r.sc.unsafe.any).toBe(0);
    expect(r.sa.precision).toBe(1);
    expect(r.sc.precision).toBe(1);
  });

  it('pins the re-scored figures (seen sets; not accuracy)', () => {
    const d = run('dev');
    const b1 = run('blind-1');
    const b2 = run('blind-2');
    expect([d.sa.exact, d.sc.exact]).toEqual([87, 115]);
    expect([b1.sa.exact, b1.sc.exact, b1.sa.unsafe.any, b1.sc.unsafe.any]).toEqual([32, 49, 4, 3]);
    expect([b2.sa.exact, b2.sc.exact, b2.sa.unsafe.any, b2.sc.unsafe.any]).toEqual([40, 65, 5, 1]);
    for (const r of [d, b1, b2]) {
      // The combined reader adds the AI where it reads more, never where it
      // makes the reading less safe than the deterministic one alone.
      expect(r.sc.unsafe.any).toBeLessThanOrEqual(r.sa.unsafe.any);
      expect(r.sc.attribution.misattributed).toBe(0);
      expect(r.sc.abstainLabelled.correct).toBe(r.sc.abstainLabelled.total);
    }
  });
});
