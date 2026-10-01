import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getPackOrFallback } from '@/lib/packs';
import { SEMANTIC_V2_DEV as RAW_V2_DEV } from './eval/semantic-v2-dev';
import { SEMANTIC_V2_DEV2 as RAW_V2_DEV2 } from './eval/semantic-v2-dev2';
import { SEMANTIC_V2_DEV3 as RAW_V2_DEV3 } from './eval/semantic-v2-dev3';
import { SEMANTIC_V2_LOCKED as RAW_V2_LOCKED } from './eval/semantic-v2-locked';
import { SEMANTIC_V2_FRESH2 as RAW_V2_FRESH2 } from './eval/semantic-v2-fresh2';
import { SEMANTIC_V2_FRESH3 as RAW_V2_FRESH3 } from './eval/semantic-v2-fresh3';
import type { V2Example } from './eval/semantic-v2';
import { withCafeRelabels } from './eval/cafe-relabel';

/** The corpora with the café taxonomy relabels applied (see eval/cafe-relabel.ts); the files themselves are untouched. */
const SEMANTIC_V2_DEV = withCafeRelabels(RAW_V2_DEV);
const SEMANTIC_V2_DEV2 = withCafeRelabels(RAW_V2_DEV2);
const SEMANTIC_V2_DEV3 = withCafeRelabels(RAW_V2_DEV3);
const SEMANTIC_V2_LOCKED = withCafeRelabels(RAW_V2_LOCKED);
const SEMANTIC_V2_FRESH2 = withCafeRelabels(RAW_V2_FRESH2);
const SEMANTIC_V2_FRESH3 = withCafeRelabels(RAW_V2_FRESH3);
import { line, scoreReading, summariseReader, type Scored } from './eval/reader-eval';
import {
  aiOnlyReading,
  combinedReading,
  deterministicReading,
  loadRecording,
  parsedFromRecording,
} from './eval/ai-reader-eval';

/**
 * M46 — THE SECOND GOLD CORPUS, PINNED (final semantic pass and correctness gate).
 *
 *   DEV      200 + 38 + 27   tuned against, in three rounds
 *   LOCKED   100             blind #1. First run (after the final semantic
 *                            pass): 56/100. SEEN since: re-scored, never tuned.
 *   FRESH2   100             blind #2. First run (gate cycle 1): 68/100.
 *                            SEEN since: re-scored, never tuned.
 *   FRESH3   100             blind #3. First and only run (gate cycle 2):
 *                            67/100 — the current generalisation figure.
 *
 * Every number below is pinned as it comes out of the current code, including
 * every failure. A blind set's misses are a record, never a target.
 *
 * The AI reader (B) and the combined reader (C) are scored from recorded
 * provider replies when tests/eval/ai-recordings.json exists. It does not yet:
 * no provider key was available. They are reported as NOT MEASURED.
 */

/** SHA-256 of each blind set as written, before its first run (LF line endings). */
const HASHES: Record<string, string> = {
  'tests/eval/semantic-v2-locked.ts': 'cb6004a14a33e951482a940afe59d04ce3fc88748e107a0b5995ebf4be5cefec',
  'tests/eval/semantic-v2-fresh2.ts': 'fe6c91fed295f392d7c2745f2b5688acaa3f3a8a42789f91cb6e10744fd4aede',
  'tests/eval/semantic-v2-fresh3.ts': '78b3402c8ec483da89449f385c6726b1921c104b4ac1907fe548e20242ec8af3',
};

const DEV_MISSES = [
  'rv11', 'rv18', 'cv07', 'cv13', 'cv14', 'cv16', 'cv17', 'cv20', 'cv24', 'cv29', 'kv11', 'kv13', 'kv16', 'kv24', 'kv27',
  'gv13', 'gv14', 'gv15', 'gv17', 'gv20', 'gv23', 'gv27', 'ev02', 'ev12', 'ev13', 'ev15', 'ev16', 'ev19', 'ev22', 'ev27',
  'sv10', 'sv11', 'sv14', 'sv16', 'sv23', 'sv27', 'wv05', 'wv14', 'wv15', 'wv17', 'wv18', 'wv23', 'wv24', 'wv25', 'wv28',
];
const LOCKED_MISSES = [
  'rl01', 'rl14', 'cl06', 'cl09', 'cl11', 'kl02', 'kl04', 'kl05', 'kl08', 'kl09', 'kl12', 'kl14', 'gl06', 'gl08', 'gl09',
  'gl10', 'el05', 'el06', 'el07', 'el08', 'el10', 'el12', 'el13', 'sl02', 'sl03', 'sl06', 'sl07', 'sl08', 'sl09', 'sl10',
  'sl12', 'sl13', 'wl02', 'wl07', 'wl09', 'wl12', 'wl13', 'wl14',
];
const FRESH2_MISSES = [
  'rf14', 'cf02', 'cf07', 'kf02', 'kf06', 'kf08', 'kf11', 'kf12', 'gf04', 'gf05', 'gf06', 'gf11', 'ef03', 'ef04',
  'ef05', 'ef07', 'ef08', 'ef11', 'ef14', 'sf02', 'sf04', 'sf06', 'sf07', 'sf12', 'wf06',
];
const FRESH3_MISSES = [
  'rg02', 'rg07', 'rg08', 'rg09', 'cg07', 'cg11', 'cg13', 'kg06', 'gg07', 'gg08', 'gg11', 'gg14', 'eg05', 'eg07', 'eg08',
  'eg11', 'sg02', 'sg04', 'sg06', 'sg07', 'sg11', 'wg01', 'wg02', 'wg04', 'wg06', 'wg07', 'wg12',
];

const score = (set: V2Example[]): Scored[] => set.map((e) => scoreReading(e, deterministicReading(e)));
const ids = (xs: Scored[], f: (s: Scored) => boolean) => xs.filter(f).map((s) => s.id);

describe('the corpus itself', () => {
  it('has the sizes the audit reports, with unique ids, across all seven verticals', () => {
    expect([SEMANTIC_V2_DEV.length, SEMANTIC_V2_DEV2.length, SEMANTIC_V2_DEV3.length]).toEqual([200, 38, 27]);
    expect([SEMANTIC_V2_LOCKED.length, SEMANTIC_V2_FRESH2.length, SEMANTIC_V2_FRESH3.length]).toEqual([100, 100, 100]);
    const all = [...SEMANTIC_V2_DEV, ...SEMANTIC_V2_DEV2, ...SEMANTIC_V2_DEV3, ...SEMANTIC_V2_LOCKED, ...SEMANTIC_V2_FRESH2, ...SEMANTIC_V2_FRESH3];
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    for (const set of [SEMANTIC_V2_LOCKED, SEMANTIC_V2_FRESH2, SEMANTIC_V2_FRESH3]) expect(new Set(set.map((e) => e.pack)).size).toBe(7);
  });

  it('has not edited a blind set since it was hashed', () => {
    for (const [file, sha] of Object.entries(HASHES)) {
      const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      expect(createHash('sha256').update(text).digest('hex'), file).toBe(sha);
    }
  });

  it('labels only topics that exist in the pack', () => {
    const bad: string[] = [];
    for (const e of [...SEMANTIC_V2_DEV, ...SEMANTIC_V2_DEV2, ...SEMANTIC_V2_DEV3, ...SEMANTIC_V2_LOCKED, ...SEMANTIC_V2_FRESH2, ...SEMANTIC_V2_FRESH3]) {
      const pack = getPackOrFallback(e.pack);
      const issues = new Set(pack.issueTaxonomy.map((t) => t.key));
      const praise = new Set(pack.praiseTaxonomy.map((t) => t.key));
      for (const k of e.expected.issues) if (!issues.has(k)) bad.push(`${e.id}: issue ${k}`);
      for (const k of e.expected.praise) if (!praise.has(k)) bad.push(`${e.id}: praise ${k}`);
      for (const k of [...(e.expected.tolerated ?? []), ...(e.expected.prohibited ?? [])]) if (!issues.has(k) && !praise.has(k)) bad.push(`${e.id}: ${k}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('A — the deterministic reader, development (tuned against)', () => {
  const dev = score(SEMANTIC_V2_DEV);
  const dev2 = score(SEMANTIC_V2_DEV2);
  const dev3 = score(SEMANTIC_V2_DEV3);

  it('scores 155/200, 37/38 and 27/27, with nothing unsafe', () => {
    for (const [name, set, s] of [['dev', SEMANTIC_V2_DEV, dev], ['dev2', SEMANTIC_V2_DEV2, dev2], ['dev3', SEMANTIC_V2_DEV3, dev3]] as const) {
      const sum = summariseReader(set, s);
      console.log(line(`A ${name}`, sum));
      expect(sum.reversals, name).toBe(0);
      expect(sum.wrongPolarity, name).toBe(0);
      expect(sum.topics.invented, name).toBe(0);
      expect(sum.attribution.misattributed, name).toBe(0);
      expect(sum.falseHigh, name).toBe(0);
    }
    expect(ids(dev, (s) => !s.exact)).toEqual(DEV_MISSES);
    expect(ids(dev2, (s) => !s.exact)).toEqual(['sd05']);
    expect(ids(dev3, (s) => !s.exact)).toEqual([]);
  });
});

describe('A — the deterministic reader, blind sets', () => {
  it('blind #1 (locked; seen): 62/100, one high-confidence invented praise', () => {
    const s = score(SEMANTIC_V2_LOCKED);
    const sum = summariseReader(SEMANTIC_V2_LOCKED, s);
    console.log(line('A locked', sum));
    expect(ids(s, (x) => !x.exact)).toEqual(LOCKED_MISSES);
    expect(sum.attribution).toEqual({ withTraps: 15, misattributed: 0 });
    expect(sum.reversals).toBe(0);
    expect(sum.mixed).toEqual({ total: 27, correct: 27 });
    expect(ids(s, (x) => x.falseHigh)).toEqual(['kl14']);
  });

  it('blind #2 (seen): 75/100 now (68/100 on its first run), nothing unsafe', () => {
    const s = score(SEMANTIC_V2_FRESH2);
    const sum = summariseReader(SEMANTIC_V2_FRESH2, s);
    console.log(line('A fresh2', sum));
    expect(ids(s, (x) => !x.exact)).toEqual(FRESH2_MISSES);
    expect(sum.attribution).toEqual({ withTraps: 13, misattributed: 0 });
    expect(sum.falseHigh).toBe(0);
    expect(sum.topics.invented).toBe(0);
    expect(sum.mixed).toEqual({ total: 22, correct: 18 });
  });

  it('blind #3 (seen since; 67/100 on its only blind run): 73/100 now, and what is still wrong, stated exactly', () => {
    const s = score(SEMANTIC_V2_FRESH3);
    const sum = summariseReader(SEMANTIC_V2_FRESH3, s);
    console.log(line('A fresh3', sum));
    expect(ids(s, (x) => !x.exact)).toEqual(FRESH3_MISSES);
    expect(sum.reversals).toBe(0);
    expect(sum.wrongPolarity).toBe(0);
    // No HIGH-confidence error is left (gg01 and wg01 were, on its blind run).
    // Two MEDIUM misattributions remain, both third parties the lexicon has
    // never met: "the patient in front of me argued" (cg11) and "our caterer
    // served late" (wg01). Re-scored after the café handover pass; never tuned.
    expect(ids(s, (x) => x.falseHigh)).toEqual([]);
    expect(ids(s, (x) => x.misattributed.length > 0)).toEqual(['cg11', 'wg01']);
    expect(ids(s, (x) => x.invented.length > 0)).toEqual(['cg11', 'wg01']);
    expect(sum.mixed).toEqual({ total: 21, correct: 15 });
  });
});

describe('B and C — the AI reader and the combined reader', () => {
  const recording = loadRecording();

  it.skipIf(recording !== null)('are NOT MEASURED: no recorded provider replies exist yet', () => {
    // Stated as a test so it cannot be forgotten: acceptance is incomplete
    // until m46.ai-reader-live.test.ts is run with a provider key.
    expect(recording).toBeNull();
  });

  it.skipIf(recording === null)('are scored from the recording, separately, on every set', () => {
    const sets = [
      ['dev', [...SEMANTIC_V2_DEV, ...SEMANTIC_V2_DEV2, ...SEMANTIC_V2_DEV3]],
      ['locked', SEMANTIC_V2_LOCKED],
      ['fresh2', SEMANTIC_V2_FRESH2],
      ['fresh3', SEMANTIC_V2_FRESH3],
    ] as const;
    const parsed = parsedFromRecording(recording!, sets.flatMap(([, s]) => [...s]));
    for (const [name, set] of sets) {
      const b = set.map((e) => scoreReading(e, aiOnlyReading(parsed.get(e.id))));
      const c = set.map((e) => scoreReading(e, combinedReading(e, parsed.get(e.id))));
      console.log(line(`B ${name} (AI alone, ${recording!.model})`, summariseReader([...set], b)));
      console.log(line(`C ${name} (combined)`, summariseReader([...set], c)));
    }
  });
});
