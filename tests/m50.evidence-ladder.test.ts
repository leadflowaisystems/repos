import { describe, expect, it } from 'vitest';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { getPackOrFallback } from '@/lib/packs';
import { EN, translatorFor } from '@/lib/i18n/translator';
import { levelOf, stageOf, type EvidenceState, type Finding } from '@/lib/portal/ladder';
import {
  AMBIGUOUS_BANK,
  COMPLAINT_BANK,
  CONTRADICTORY_BANK,
  LADDER_COUNTS,
  MIXED_BANK,
  MIXES,
  MULTILINGUAL_BANK,
  NEUTRAL_BANK,
  PRAISE_BANK,
  RATING_ONLY_BANK,
  THIRD_PARTY_BANK,
  cycle,
  runLadder,
  spread,
  type LadderRun,
} from './eval/ladder-scenarios';

/**
 * M50 — THE EVIDENCE LADDER, AT EVERY COUNT (Oct 2026).
 *
 * The owner portal used to be useful only past a threshold: a countdown card
 * below five responses, "No strong pattern yet" from five to nine, and Trends
 * "waiting for your first check-in" whatever the count. The ladder replaced the
 * gate. These run real customer words through the whole product, at
 *
 *   0 1 2 3 4 5 6 7 9 10 12 15 20 24 25 30 50 100 responses,
 *
 * for ten kinds of feedback — positive-only, negative-only, mixed, neutral,
 * ratings with no words, multi-topic, multilingual, ambiguous, about a third
 * party, and a rating that contradicts its words — and require, at every one:
 *
 *   - something useful is shown from the first response (never an empty state);
 *   - every topic stands exactly on the rung its evidence reached, on every
 *     surface — Home, Feedback, Customers, Trends — with the same count;
 *   - no pattern below ten read, no strong pattern below twenty-five;
 *   - nothing is led with, suggested or acted on below the evidence for it;
 *   - a trend appears only with two comparable periods;
 *   - no countdown, no unlock, and no check-in chore, in any language.
 */

const COUNTDOWN = /more responses? to go|to unlock|\bunlock|responses? required|reviews? required|\d+ more (responses|reviews)|almost there|\d+\s*\/\s*\d+ responses/i;
const CHORE = /\b(create|record|run|do|make|schedule|take|press) (a|your|another|the next|the first|one more) check-in|first check-in|waiting for your|check-in now|worth a check-in/i;

function words(s: EvidenceState): string {
  return [
    s.copy.eyebrow,
    s.copy.title,
    s.copy.intro,
    s.copy.readLine,
    s.copy.nothingRepeated ?? '',
    s.copy.notSure ?? '',
    s.copy.clearer ?? '',
    ...s.copy.doing,
    s.pulse.basis,
    s.pulse.ratings,
    s.direction.title,
    s.direction.body,
    s.direction.automatic ?? '',
    s.standsOut?.title ?? '',
    s.standsOut?.line ?? '',
    ...(s.firstResponse ?? []),
    ...s.findings.flatMap((f) => [f.levelLabel, f.line, f.action?.eyebrow ?? '', f.action?.text ?? '']),
  ].join('\n');
}

const RUNS = new Map<string, LadderRun>();
function run(mix: string, n: number): LadderRun {
  const key = `${mix}:${n}`;
  let r = RUNS.get(key);
  if (!r) {
    r = runLadder(cycle(MIXES[mix]!, n, mix.slice(0, 2)));
    RUNS.set(key, r);
  }
  return r;
}

describe('the sentence banks still mean what the matrix says they mean', () => {
  // A bank that drifts would quietly change every assertion below, so each
  // line's reading is pinned here, through the real reader.
  const pack = getPackOrFallback('restaurant');
  const read = (text: string, stars: number | null) => normalizeFeedback({ text, stars, pack, ai: null });

  it('praise is praise, with a topic', () => {
    for (const r of PRAISE_BANK) {
      const n = read(r.text, r.stars);
      expect(n.sentiment, r.text).toBe('POSITIVE');
      expect(n.praiseTags.length, r.text).toBeGreaterThan(0);
      expect(n.issueTags, r.text).toEqual([]);
    }
  });

  it('complaints are complaints, with a topic', () => {
    for (const r of COMPLAINT_BANK) {
      const n = read(r.text, r.stars);
      expect(n.sentiment, r.text).toBe('NEGATIVE');
      expect(n.issueTags.length, r.text).toBeGreaterThan(0);
      expect(n.praiseTags, r.text).toEqual([]);
    }
  });

  it('mixed responses keep both halves', () => {
    for (const r of MIXED_BANK) {
      const n = read(r.text, r.stars);
      expect(n.sentiment, r.text).toBe('MIXED');
      expect(n.issueTags.length, r.text).toBeGreaterThan(0);
      expect(n.praiseTags.length, r.text).toBeGreaterThan(0);
    }
  });

  it('a middle rating with nothing in the words is neutral, and files no topic', () => {
    for (const r of NEUTRAL_BANK) {
      const n = read(r.text, r.stars);
      expect(n.sentiment, r.text).toBe('NEUTRAL');
      expect(n.unclassified, r.text).toBe(true);
    }
  });

  it('a rating alone is a tone, never a topic', () => {
    expect(read('', 5).sentiment).toBe('POSITIVE');
    expect(read('', 1).sentiment).toBe('NEGATIVE');
    for (const r of RATING_ONLY_BANK) expect(read(r.text, r.stars).themes, `${r.stars}`).toEqual([]);
  });

  it('Hindi, Marathi and Hinglish are read for what they say', () => {
    expect(read(MULTILINGUAL_BANK[0]!.text, 5).praiseTags).toEqual(['food_taste']);
    expect(read(MULTILINGUAL_BANK[1]!.text, 5).praiseTags).toEqual(['food_taste']);
    const hinglish = read(MULTILINGUAL_BANK[2]!.text, 3);
    expect(hinglish.sentiment).toBe('MIXED');
    expect(hinglish.issueTags).toEqual(['service_speed']);
    expect(read(MULTILINGUAL_BANK[3]!.text, 2).issueTags).toEqual(['service_speed']);
    expect(read(MULTILINGUAL_BANK[4]!.text, 2).issueTags).toEqual(['service_speed']);
  });

  it('ambiguous wording abstains rather than guess', () => {
    for (const r of AMBIGUOUS_BANK) {
      const n = read(r.text, r.stars);
      expect(n.unclassified, r.text).toBe(true);
      expect(n.themes, r.text).toEqual([]);
    }
  });

  it('a third party’s lateness or rudeness is set aside, never counted against the business', () => {
    for (const r of THIRD_PARTY_BANK) {
      const n = read(r.text, r.stars);
      expect(n.issueTags, r.text).toEqual([]);
      expect(n.reasons.join(' '), r.text).toMatch(/someone other than the business/);
    }
  });

  it('five stars over a complaint keeps the complaint', () => {
    const n = read(CONTRADICTORY_BANK[0]!.text, 5);
    expect(n.sentiment).toBe('MIXED');
    expect(n.issueTags).toEqual(['service_speed']);
  });
});

describe('the evidence ladder at every count, for every kind of feedback', () => {
  for (const mix of Object.keys(MIXES)) {
    for (const n of LADDER_COUNTS) {
      it(`${mix} at ${n}`, () => {
        const r = run(mix, n);
        const s = r.state;

        // ---- the stage is the count -------------------------------------
        expect(s.read).toBe(n);
        expect(s.stage).toBe(stageOf(n));
        expect(s.pulse.counted).toBeLessThanOrEqual(n);
        expect(s.pulse.happy + s.pulse.mixed + s.pulse.unhappy).toBe(s.pulse.counted);

        // ---- something useful from the first response ---------------------
        if (n === 0) {
          expect(s.findings).toEqual([]);
          expect(s.copy.title).toBe('Ready for your first customer');
        } else {
          expect(s.copy.title.length).toBeGreaterThan(0);
          const concrete = s.findings.length > 0 || s.standsOut !== null || (s.firstResponse?.length ?? 0) > 0;
          expect(concrete, 'a reading with nothing concrete in it').toBe(true);
          expect(s.copy.title).not.toMatch(/no strong pattern yet/i);
        }
        if (n === 1) expect(s.firstResponse?.length).toBeGreaterThan(0);
        if (n >= 2) expect(s.standsOut).not.toBeNull();

        // ---- every topic on its rung, never above it ------------------------
        for (const f of s.findings) {
          expect(f.read).toBe(n);
          expect(f.mentions).toBeLessThanOrEqual(n);
          expect(f.level, f.key).toBe(levelOf(f.mentions, n));
          if (n < 10) expect(f.level === 'EMERGING_PATTERN' || f.level === 'STRONG_PATTERN', f.key).toBe(false);
          if (n < 25) expect(f.level, f.key).not.toBe('STRONG_PATTERN');
        }
        if (n < 10) expect(s.patterns).toEqual([]);

        // ---- actions scale with the evidence -------------------------------
        for (const f of s.concerns) {
          if (f.level === 'OBSERVATION' || f.level === 'EARLY_SIGNAL') expect(f.action, f.key).toBeNull();
          if (f.level === 'EMERGING_PATTERN' && f.action) expect(f.action.level, f.key).toBe('CHECK');
          if (f.level === 'STRONG_PATTERN' && f.action) expect(f.action.level, f.key).toBe('ACT');
        }
        for (const f of s.likes) {
          if (f.level === 'OBSERVATION' || f.level === 'EARLY_SIGNAL') expect(f.action, f.key).toBeNull();
        }

        // ---- nothing is led with below the evidence for it ------------------
        if (n < 10) {
          expect(r.brief.attention, 'Home leads with a complaint under ten read').toBeNull();
          expect(r.view.first).toBeNull();
          expect(r.reviews.funnel.attention).toBeNull();
          expect(r.responsibility.needsYou.filter((i) => i.state === 'DO_NOW')).toEqual([]);
        }
        if (r.brief.attention) {
          const lead = s.findings.find((f) => f.kind === 'ISSUE' && f.key === r.brief.attention?.themeKey);
          expect(lead?.level === 'EMERGING_PATTERN' || lead?.level === 'STRONG_PATTERN', 'Home leads with an early sign').toBe(true);
        }

        // ---- one story on every surface --------------------------------------
        const byKey = new Map(s.findings.map((f) => [`${f.kind}:${f.key}`, f] as const));
        for (const sig of [...r.view.unhappy, ...r.view.loved, ...r.view.early]) {
          // Named topics: the view's count is the evidence state's count.
          expect(byKey.get(`${sig.kind}:${sig.themeKey}`)?.mentions, sig.themeKey).toBe(sig.evidenceCount);
        }
        for (const row of r.reviews.signals) {
          expect(byKey.get(`${row.kind}:${row.key}`)?.mentions, row.key).toBe(row.count);
        }
        for (const sig of [...r.analysis.loved, ...r.analysis.unhappy]) {
          expect(byKey.get(`${sig.kind}:${sig.themeKey}`)?.mentions, sig.themeKey).toBe(sig.evidenceCount);
        }
        // Customers files exactly the evidence state's patterns as named
        // topics above "not yet clear".
        const patternKeys = new Set(s.patterns.map((f) => `${f.kind}:${f.key}`));
        for (const sig of r.improvements.current.patterns) {
          expect(patternKeys.has(`${sig.kind}:${sig.themeKey}`) || sig.bucket !== 'EARLY', sig.themeKey).toBe(true);
        }

        // ---- direction is its own question ---------------------------------
        expect(r.improvements.trends.comparable).toBe(s.direction.state === 'READY');
        // Every response here arrived within a few days: no comparable period
        // can have closed, so no trend may be shown.
        expect(s.direction.state === 'READY').toBe(false);

        // ---- the words: no countdown, no chore -----------------------------
        expect(words(s)).not.toMatch(COUNTDOWN);
        expect(words(s)).not.toMatch(CHORE);
        expect(r.responsibility.nextUsefulCheck).not.toMatch(CHORE);
        expect(words(s)).not.toMatch(/\{\w+\}/);
      });
    }
  }
});

describe('what each rung is allowed to say', () => {
  const findingLines = (r: LadderRun) => r.state.findings.map((f) => `${f.level}: ${f.line}`);

  it('one response: the customer heard, line by line — never a pattern', () => {
    const r = runLadder([{ text: 'Loved the cappuccino, but the service was slow.', stars: null }]);
    expect(r.state.copy.title).toBe('Your first customer has been heard');
    expect(r.state.firstResponse).toEqual(['No star rating', 'Praised: Great coffee & drinks', 'Problem: Slow service']);
    const slow = r.state.findings.find((f) => f.key === 'service_speed');
    expect(slow?.level).toBe('OBSERVATION');
    expect(slow?.levelLabel).toBe('Mentioned once');
    expect(slow?.action).toBeNull();
    expect(r.state.copy.note).toBe('One customer’s view — not a pattern.');
    expect(r.state.copy.notSure).toBe('One response is one customer’s view, so Headway draws no conclusion from it.');
  });

  it('a 5★ first response with praise says so', () => {
    const r = runLadder([{ text: 'Loved the coffee, really smooth', stars: 5 }]);
    expect(r.state.firstResponse).toEqual(['Rated 5★', 'Praised: Great coffee & drinks']);
  });

  it('two of three mention slow service: an early signal, still early, watched — not a pattern', () => {
    const r = runLadder([
      { text: 'Service was very slow, we waited 40 minutes (a)', stars: 2 },
      { text: 'Loved the coffee but the service was slow (b)', stars: 4 },
      { text: 'The food was delicious and fresh (c)', stars: 5 },
    ]);
    const slow = r.state.findings.find((f) => f.key === 'service_speed');
    expect(slow?.level).toBe('EARLY_SIGNAL');
    expect(slow?.line).toBe('2 of 3 customers');
    expect(slow?.levelLabel).toBe('Early signal');
    expect(r.state.copy.note).toBe('Still early — nothing is a pattern yet.');
    expect(r.state.standsOut).toMatchObject({ kind: 'FINDING', findingKey: 'service_speed', tone: 'bad' });
    expect(r.state.patterns).toEqual([]);
    expect(findingLines(r).join(' ')).not.toMatch(/major problem|recurring|pattern:/i);
  });

  it('nothing repeated at four responses: said plainly, with the customer pulse still shown', () => {
    const r = runLadder([
      { text: 'Loved the coffee, really smooth (a)', stars: 5 },
      { text: 'The washroom was dirty (b)', stars: 2 },
      { text: 'Staff were warm and welcoming (c)', stars: 5 },
      { text: '', stars: 4 },
    ]);
    expect(r.state.repeated).toBe(false);
    expect(r.state.copy.nothingRepeated).toBe('Nothing has repeated yet. Each topic so far has come from one customer.');
    expect(r.state.standsOut).toMatchObject({ kind: 'MOOD', title: 'Most customers so far were happy.' });
    expect(r.state.copy.note).toBe('Still early — nothing has repeated yet.');
    expect(r.state.pulse.ratings).toBe('4 star ratings · 4.0★ average');
    expect(r.state.pulse.from).toBe('4.0★ from 4 ratings');
  });

  it('three of fourteen: an emerging pattern, with the count, the share, and "worth checking"', () => {
    const r = runLadder([
      ...cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 1 }], 3, 's'),
      ...cycle(PRAISE_BANK, 11, 'p'),
    ]);
    const slow = r.state.findings.find((f) => f.key === 'service_speed');
    expect(r.state.stage).toBe('EMERGING_PICTURE');
    expect(slow?.level).toBe('EMERGING_PATTERN');
    expect(slow?.line).toBe('3 of 14 customers · 21%');
    expect(slow?.levelLabel).toBe('Emerging pattern');
    expect(slow?.action).toMatchObject({ level: 'CHECK', eyebrow: 'Worth checking' });
    expect(slow?.action?.text).toMatch(/ticket time/i); // the pack's own suggestion
    // And Home now leads with it, as the one thing worth deciding.
    expect(r.brief.attention?.themeKey).toBe('service_speed');
  });

  it('ten or more read with nothing repeated enough: said plainly, never an empty state', () => {
    const r = runLadder(cycle(PRAISE_BANK, 4, 'p').concat(cycle(RATING_ONLY_BANK, 8, 'r')));
    expect(r.state.read).toBe(12);
    expect(r.state.patterns).toEqual([]);
    expect(r.state.copy.nothingRepeated).toBe(
      'You have enough feedback for Headway to start looking for patterns, but nothing has repeated enough yet to call a recurring problem.',
    );
  });

  it('seven of thirty: a strong recurring pattern, with what to do', () => {
    const r = runLadder([
      ...cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 1 }], 7, 's'),
      ...cycle(PRAISE_BANK, 23, 'p'),
    ]);
    const slow = r.state.findings.find((f) => f.key === 'service_speed');
    expect(r.state.stage).toBe('STRONG_PATTERNS');
    expect(slow?.level).toBe('STRONG_PATTERN');
    expect(slow?.line).toBe('7 of 30 customers · 23%');
    expect(slow?.levelLabel).toBe('Strong pattern');
    expect(slow?.action).toMatchObject({ level: 'ACT', eyebrow: 'What to do' });
  });

  it('twenty-five read is not permission to call a pattern: five mentions stay emerging', () => {
    const r = runLadder([
      ...cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 1 }], 5, 's'),
      ...cycle(PRAISE_BANK, 25, 'p'),
    ]);
    expect(r.state.findings.find((f) => f.key === 'service_speed')?.level).toBe('EMERGING_PATTERN');
  });

  it('nine identical complaints in nine responses is still an early signal: the total is too small', () => {
    const r = runLadder(cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 1 }], 9, 's'));
    expect(r.state.findings.find((f) => f.key === 'service_speed')?.level).toBe('EARLY_SIGNAL');
    expect(r.brief.attention).toBeNull();
  });

  it('praise and complaint about the same part of the visit stay on their own sides — nothing nets out', () => {
    const r = runLadder([
      ...cycle([{ text: 'The food was delicious and fresh', stars: 5 }], 4, 'g'),
      ...cycle([{ text: 'The food arrived cold', stars: 2 }], 4, 'c'),
      ...cycle(NEUTRAL_BANK, 4, 'n'),
    ]);
    const praise = r.state.likes.find((f) => f.key === 'food_taste');
    const complaint = r.state.concerns.find((f) => f.key === 'served_cold');
    expect(praise?.mentions).toBe(4);
    expect(complaint?.mentions).toBe(4);
    expect(praise?.level).toBe('EMERGING_PATTERN');
    expect(complaint?.level).toBe('EMERGING_PATTERN');
  });

  it('unread responses are waiting, never counted as read, and never shift a denominator', () => {
    const r = runLadder(cycle(PRAISE_BANK, 5, 'p'), { unread: [{ text: 'Service was very slow', stars: 1 }] });
    expect(r.state.read).toBe(5);
    expect(r.state.waiting).toBe(1);
    expect(r.state.pulse.basis).toBe('Of 5 responses read');
    expect(r.state.findings.every((f) => f.read === 5)).toBe(true);
    expect(r.state.findings.some((f) => f.key === 'service_speed')).toBe(false);
  });
});

describe('trends stay strict, and become available by themselves', () => {
  it('two comparable periods, drawn automatically, give a direction — the same verdict on Home, Trends and Customers', () => {
    // Two weeks of a busy café: slow service in 2 of 12, then in 9 of 12.
    const before = spread(
      [...cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 1 }], 2, 'a'), ...cycle(PRAISE_BANK, 10, 'b')],
      7,
      new Date('2026-09-17T12:00:00.000Z'),
    );
    const after = spread(
      [...cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 1 }], 9, 'c'), ...cycle(PRAISE_BANK, 3, 'd')],
      7,
      new Date('2026-09-30T12:00:00.000Z'),
    );
    const r = runLadder([...before, ...after]);
    expect(r.periods.length).toBe(2);
    expect(r.state.direction.state).toBe('READY');
    expect(r.improvements.trends.comparable).toBe(true);
    expect(r.improvements.trends.worse.map((t) => t.key)).toContain('service_speed');
    expect(r.state.findings.find((f) => f.key === 'service_speed')?.movement).toBe('WORSENING');
    expect(r.view.unhappy.find((s) => s.themeKey === 'service_speed')?.movementDirection).toBe('WORSENING');
  });

  it('a busy first week is one period, not a trend between lunch and dinner', () => {
    const r = runLadder(spread(cycle(PRAISE_BANK, 40, 'p'), 3));
    expect(r.periods.length).toBe(0);
    expect(r.state.direction.state).toBe('BUILDING_BASELINE');
    expect(r.improvements.trends.comparable).toBe(false);
  });
});

describe('no countdown and no chore in Hindi or Marathi either', () => {
  for (const locale of ['hi', 'mr'] as const) {
    it(`${locale}: the ladder is written in Devanagari at every stage, with every number intact`, () => {
      for (const n of [0, 1, 3, 5, 12, 30]) {
        const r = runLadder(cycle(MIXES.mixed!, n, 'm'), { t: translatorFor(locale) });
        const en = runLadder(cycle(MIXES.mixed!, n, 'm'), { t: EN });
        const text = words(r.state);
        expect(text, `${locale} ${n}`).toMatch(/[ऀ-ॿ]/);
        expect(text).not.toMatch(/\{\w+\}/);
        // The same figures in every language: the counts are not the words.
        expect(r.state.findings.map((f: Finding) => [f.key, f.mentions, f.level])).toEqual(
          en.state.findings.map((f: Finding) => [f.key, f.mentions, f.level]),
        );
        expect(r.state.pulse.counted).toBe(en.state.pulse.counted);
      }
    });
  }
});
