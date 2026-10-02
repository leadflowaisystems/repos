import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIntelligence } from '@/lib/intelligence/engine';
import { MESSAGES } from '@/lib/i18n/strings';
import { EN, translatorFor } from '@/lib/i18n/translator';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import {
  EARLY_SIGNAL_MENTIONS,
  EMERGING_AT,
  EMERGING_MENTIONS,
  FIRST_READ_AT,
  STRONG_AT,
  STRONG_MENTIONS,
  actionLevelOf,
  averageOf,
  buildEvidenceState,
  directionOf,
  evidenceNumbers,
  levelOf,
  pileFrom,
  stageOf,
  type PileFacts,
} from './ladder';
import { buildPortalView } from './view';
import { buildTrendReadiness, type TrendReadiness } from './trends';
import { NO_PULSE, clinic, input, intel, theme, themes } from './test-fixtures';

/**
 * THE EVIDENCE LADDER, UNIT BY UNIT (Oct 2026).
 *
 * The rungs are the engine's floors, the stages are counts of read responses,
 * and the words are calibrated to the rung. These hold each of those in place;
 * tests/m50.evidence-ladder.test.ts runs the whole ladder across every surface.
 */

const pile = (over: Partial<PileFacts> = {}): PileFacts => ({
  collected: 0,
  read: 0,
  waiting: 0,
  failed: 0,
  happy: 0,
  mixed: 0,
  unhappy: 0,
  rated: 0,
  ratingSum: 0,
  withWords: 0,
  ...over,
});

const readiness = (over: Partial<TrendReadiness> = {}): TrendReadiness => ({
  state: 'NO_CHECKIN',
  read: 0,
  checkins: 0,
  latest: null,
  previous: null,
  since: 0,
  needPerSide: 10,
  worthAt: 10,
  nextIsDue: false,
  periodMinResponses: 10,
  periodMinDays: 7,
  ...over,
});

describe('the stage is the read count, and only the read count', () => {
  it('has the five stages at the documented counts', () => {
    expect([FIRST_READ_AT, EMERGING_AT, STRONG_AT]).toEqual([5, 10, 25]);
    const at = (n: number) => stageOf(n);
    expect(at(0)).toBe('NONE');
    for (const n of [1, 2, 3, 4]) expect(at(n), `${n}`).toBe('PULSE');
    for (const n of [5, 6, 7, 9]) expect(at(n), `${n}`).toBe('FIRST_READ');
    for (const n of [10, 12, 15, 20, 24]) expect(at(n), `${n}`).toBe('EMERGING_PICTURE');
    for (const n of [25, 30, 50, 100, 5000]) expect(at(n), `${n}`).toBe('STRONG_PATTERNS');
  });

  it('treats nonsense as nothing read', () => {
    expect(stageOf(-3)).toBe('NONE');
    expect(stageOf(Number.NaN)).toBe('NONE');
    expect(stageOf(4.9)).toBe('PULSE');
  });
});

describe('each topic stands on the rung its evidence reached', () => {
  it('has the documented floors', () => {
    expect([EARLY_SIGNAL_MENTIONS, EMERGING_MENTIONS, STRONG_MENTIONS]).toEqual([2, 3, 6]);
  });

  it('names the rungs at their boundaries', () => {
    expect(levelOf(0, 10)).toBeNull();
    expect(levelOf(1, 1)).toBe('OBSERVATION');
    expect(levelOf(1, 100)).toBe('OBSERVATION');
    expect(levelOf(2, 3)).toBe('EARLY_SIGNAL');
    expect(levelOf(2, 100)).toBe('EARLY_SIGNAL');
    expect(levelOf(3, 9)).toBe('EARLY_SIGNAL'); // three, but under ten read: not a pattern
    expect(levelOf(3, 10)).toBe('EMERGING_PATTERN');
    expect(levelOf(5, 30)).toBe('EMERGING_PATTERN');
    expect(levelOf(6, 24)).toBe('EMERGING_PATTERN'); // six, but under twenty-five read
    expect(levelOf(6, 25)).toBe('STRONG_PATTERN');
  });

  it('agrees with the intelligence engine’s own confidence, everywhere it names a topic', () => {
    // The ladder adds two rungs BELOW the engine's naming floor; above it, it
    // must be the engine's rule exactly, or Home and Customers could disagree.
    for (let read = 1; read <= 60; read += 1) {
      for (let mentions = 1; mentions <= Math.min(read, 12); mentions += 1) {
        const i = buildIntelligence({
          client: { id: 'c1', businessName: 'Sunrise', vertical: 'clinic' },
          pack: clinic,
          themes: themes([], [theme('wait_time', 'Long waiting time', 'ISSUE', mentions)], read),
          totalFeedback: read,
          pulse: NO_PULSE,
          notes: [],
        });
        const named = i.unhappy.find((x) => x.themeKey === 'wait_time');
        const level = levelOf(mentions, read);
        if (mentions < EMERGING_MENTIONS) {
          expect(named, `${mentions}/${read}`).toBeUndefined();
          expect(level === 'OBSERVATION' || level === 'EARLY_SIGNAL', `${mentions}/${read}`).toBe(true);
          continue;
        }
        const expected =
          named?.confidence === 'STRONG' ? 'STRONG_PATTERN' : named?.confidence === 'MODERATE' ? 'EMERGING_PATTERN' : 'EARLY_SIGNAL';
        expect(level, `${mentions}/${read}`).toBe(expected);
      }
    }
  });

  it('scales the action with the evidence: watch, check, act — and keep for praise patterns', () => {
    expect(actionLevelOf('ISSUE', 'OBSERVATION')).toBe('WATCH');
    expect(actionLevelOf('ISSUE', 'EARLY_SIGNAL')).toBe('WATCH');
    expect(actionLevelOf('ISSUE', 'EMERGING_PATTERN')).toBe('CHECK');
    expect(actionLevelOf('ISSUE', 'STRONG_PATTERN')).toBe('ACT');
    expect(actionLevelOf('PRAISE', 'OBSERVATION')).toBeNull();
    expect(actionLevelOf('PRAISE', 'EARLY_SIGNAL')).toBeNull();
    expect(actionLevelOf('PRAISE', 'EMERGING_PATTERN')).toBe('KEEP');
    expect(actionLevelOf('PRAISE', 'STRONG_PATTERN')).toBe('KEEP');
  });
});

describe('the pulse counts one pile, and says so', () => {
  const row = (over: Partial<{ analysisStatus: string; analysisVersion: number; sentiment: string; stars: number | null; text: string }> = {}) => ({
    analysisStatus: 'ANALYSED',
    analysisVersion: ANALYSIS_VERSION,
    sentiment: 'POSITIVE',
    stars: 5,
    text: 'Loved it',
    ...over,
  });

  it('counts only read responses, folds neutral into mixed, and keeps the ratings on the same pile', () => {
    const p = pileFrom([
      row(),
      row({ stars: 4 }),
      row({ sentiment: 'NEUTRAL', stars: null, text: 'ok' }),
      row({ sentiment: 'NEGATIVE', stars: 1 }),
      row({ analysisStatus: 'PENDING', stars: 1 }), // arrived, not read: no rating counted
      row({ analysisStatus: 'FAILED', stars: 2 }),
      row({ analysisVersion: ANALYSIS_VERSION - 1, stars: 3 }), // read by an older reader
    ]);
    expect(p).toMatchObject({ collected: 7, read: 4, waiting: 3, failed: 1, happy: 2, mixed: 1, unhappy: 1, rated: 3 });
    expect(averageOf(p)).toBe(3.3); // (5 + 4 + 1) / 3
  });

  it('rounds the average to one decimal, half up: four ratings of 5,5,5,4 are 4.8', () => {
    expect(averageOf({ rated: 4, ratingSum: 19 })).toBe(4.8);
    expect(averageOf({ rated: 0, ratingSum: 0 })).toBeNull();
  });

  it('never states a five over an average of four', () => {
    const s = buildEvidenceState({
      view: { unhappy: [], loved: [], early: [] },
      themes: themes([], [], 5),
      pile: pile({ collected: 5, read: 5, happy: 4, mixed: 1, rated: 4, ratingSum: 19, withWords: 4 }),
      trendReadiness: readiness({ read: 5 }),
      pack: clinic,
    });
    expect(s.pulse.basis).toBe('Of 5 responses read');
    expect(s.pulse.ratings).toBe('4 star ratings · 4.8★ average');
    expect(s.pulse.counted).toBe(5);
  });
});

describe('which way things are moving, without a chore in it', () => {
  const CHORE = /\b(create|record|run|do|make|schedule|take|press|start) (a|your|another|the next|the first|one more) check-in|first check-in|waiting for your|check-in now/i;

  it('says what Headway is doing at every state, in every language', () => {
    const states: TrendReadiness[] = [
      readiness({ state: 'NO_CHECKIN', read: 0 }),
      readiness({ state: 'NO_CHECKIN', read: 5 }),
      readiness({ state: 'ONE_CHECKIN', read: 14, checkins: 1, latest: { label: '1 Oct 2026', held: 12, at: new Date(2026, 9, 1), automatic: true } }),
      readiness({
        state: 'TOO_THIN',
        read: 20,
        checkins: 2,
        latest: { label: '1 Oct', held: 12, at: new Date(2026, 9, 1), automatic: true },
        previous: { label: '1 Sep', held: 4, at: new Date(2026, 8, 1), automatic: false },
      }),
      readiness({
        state: 'READY',
        read: 30,
        checkins: 2,
        latest: { label: '1 Oct', held: 12, at: new Date(2026, 9, 1), automatic: true },
        previous: { label: '20 Sep', held: 14, at: new Date(2026, 8, 20), automatic: true },
      }),
    ];
    const expected = ['NOT_STARTED', 'BUILDING_BASELINE', 'BASELINE_SET', 'TOO_THIN', 'READY'];
    for (const locale of ['en', 'hi', 'mr'] as const) {
      const t = translatorFor(locale);
      states.forEach((r, i) => {
        const d = directionOf(r, t);
        expect(d.state).toBe(expected[i]);
        const words = [d.title, d.body, d.automatic ?? '', d.method].join(' ');
        expect(words, `${locale} ${d.state}`).not.toMatch(CHORE);
        expect(words, `${locale} ${d.state}`).not.toMatch(/\{\w+\}/);
        // Said only until a comparison exists.
        expect(d.automatic === null, `${d.state}`).toBe(d.state === 'READY');
      });
    }
  });

  it('states the comparable-period rule with its numbers', () => {
    expect(directionOf(readiness(), EN).method).toContain('at least 10 read responses collected over at least 7 days');
  });
});

describe('no countdowns, no unlocks, no chores — in any language, at any stage', () => {
  const COUNTDOWN = /more responses? to go|to unlock|unlock|responses? required|reviews? required|\d+ more (responses|reviews)|almost there|\d+\s*\/\s*\d+ responses/i;

  it('keeps every ladder phrase in all three languages', () => {
    const keys = Object.keys(MESSAGES).filter((k) => k.startsWith('ladder.'));
    expect(keys.length).toBeGreaterThan(60);
    for (const key of keys) {
      const phrase = MESSAGES[key as keyof typeof MESSAGES];
      expect(phrase.hi, `${key} has no Hindi`).toBeTruthy();
      expect(phrase.mr, `${key} has no Marathi`).toBeTruthy();
      expect(`${phrase.en} ${phrase.hi} ${phrase.mr}`, key).not.toMatch(COUNTDOWN);
    }
  });

  it('writes the same placeholders in all three languages', () => {
    for (const key of Object.keys(MESSAGES).filter((k) => k.startsWith('ladder.'))) {
      const phrase = MESSAGES[key as keyof typeof MESSAGES];
      const holes = (s: string | undefined) => [...(s ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      expect(holes(phrase.hi), `${key} hi`).toBe(holes(phrase.en));
      expect(holes(phrase.mr), `${key} mr`).toBe(holes(phrase.en));
    }
  });

  it('has no countdown anywhere a stage is worded, for 0 to 30 responses', () => {
    for (const locale of ['en', 'hi', 'mr'] as const) {
      const t = translatorFor(locale);
      for (let n = 0; n <= 30; n += 1) {
        const i = intel({ themes: themes([], [], n), totalFeedback: n, t });
        const v = buildPortalView(input({ intelligence: i, themes: themes([], [], n), t }));
        const s = buildEvidenceState({
          view: v,
          themes: themes([], [], n),
          pile: pile({ collected: n, read: n, happy: n }),
          trendReadiness: buildTrendReadiness(input({ intelligence: i, themes: themes([], [], n), t })),
          pack: clinic,
          t,
        });
        const words = [
          s.copy.eyebrow,
          s.copy.title,
          s.copy.intro,
          s.copy.notSure ?? '',
          s.copy.clearer ?? '',
          s.copy.nothingRepeated ?? '',
          ...s.copy.doing,
          s.direction.body,
          s.pulse.basis,
          s.pulse.ratings,
        ].join(' ');
        expect(words, `${locale} ${n}`).not.toMatch(COUNTDOWN);
        expect(words, `${locale} ${n}`).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe('every page reads the one evidence state', () => {
  // Source-level, so it fails the moment a surface goes back to deciding its
  // own readiness — which is how Home came to say "No strong pattern yet"
  // while Trends said "waiting for your first check-in".
  const ROOT = resolve(__dirname, '..', '..', '..');
  const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
  const SURFACES: Array<[string, string]> = [
    ['Home', 'src/components/workspace/home.tsx'],
    ['Customers', 'src/components/workspace/analysis.tsx'],
    ['Feedback', 'src/components/workspace/reviews.tsx'],
    ['Trends', 'src/components/workspace/improvements.tsx'],
    ['Check-in', 'src/components/workspace/checkin.tsx'],
    ['This week', 'src/app/(workspace)/workspace/[clientId]/pulse/page.tsx'],
    ['This month', 'src/app/(workspace)/workspace/[clientId]/review/page.tsx'],
  ];
  for (const [name, file] of SURFACES) {
    it(`${name} asks getEvidenceState`, () => {
      expect(read(file)).toMatch(/\bgetEvidenceState\(/);
    });
    it(`${name} has no countdown card and no readiness gate of its own`, () => {
      const src = read(file);
      expect(src).not.toMatch(/InsightsBuilding|TrendsNotReady|readinessOf\(|getReadiness\(/);
    });
  }
});

describe('every figure the reading states is a count the evidence holds', () => {
  // The numeric guard every generated sentence in Headway answers to: prose may
  // carry only numbers its evidence holds. The method sentence states the
  // comparison rule's own constants, and dates are dates, so both are left out.
  it('states no number the evidence does not hold, at any stage', () => {
    for (const [read, issue, praise] of [
      [1, 1, 0],
      [3, 2, 1],
      [5, 1, 2],
      [14, 3, 4],
      [30, 7, 9],
    ] as const) {
      const th = themes(
        praise > 0 ? [theme('doctor_care', "Doctor's care and explanation", 'PRAISE', praise)] : [],
        [theme('wait_time', 'Long waiting time', 'ISSUE', issue)],
        read,
      );
      const i = intel({ themes: th, totalFeedback: read });
      const core = input({ intelligence: i, themes: th });
      const s = buildEvidenceState({
        view: buildPortalView(core),
        themes: th,
        pile: pile({ collected: read, read, happy: read - issue, unhappy: issue, rated: read, ratingSum: read * 4 }),
        trendReadiness: buildTrendReadiness(core),
        pack: clinic,
      });
      const allowed = evidenceNumbers(s);
      const prose = [
        s.copy.title,
        s.copy.intro,
        s.copy.readLine,
        s.copy.nothingRepeated ?? '',
        s.standsOut?.title ?? '',
        s.standsOut?.line ?? '',
        s.pulse.basis,
        s.pulse.ratings,
        ...(s.firstResponse ?? []),
        ...s.findings.map((f) => f.line),
      ].join(' ');
      for (const n of prose.match(/\d+(?:\.\d+)?/g) ?? []) {
        expect(allowed.has(n), `${read}: "${n}" is not in the evidence`).toBe(true);
      }
    }
  });
});
