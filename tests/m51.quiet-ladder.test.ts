import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN, translatorFor } from '@/lib/i18n/translator';
import {
  EARLY_SIGNAL_MENTIONS,
  EMERGING_AT,
  HOME_LIMITS,
  headlineOf,
  homeLists,
  isPattern,
  levelOf,
  type EvidenceState,
} from '@/lib/portal/ladder';
import { INTERNALS } from '@/lib/portal/test-fixtures';
import {
  COMPLAINT_BANK,
  CRAZY_CHEESY,
  LADDER_COUNTS,
  MIXES,
  NEUTRAL_BANK,
  PRAISE_BANK,
  cycle,
  runLadder,
  type Response,
} from './eval/ladder-scenarios';

/**
 * THE QUIETER LADDER (Oct 2026) — compress the communication, not the
 * intelligence.
 *
 * The evidence ladder gave owners value from the first response, and then said
 * it four times on every page: "nothing has repeated yet", "not sure yet",
 * "what more feedback will show", "what Headway is doing" — plus Trends
 * repeating Home's whole first read. This pass keeps every rung and every
 * threshold exactly where they were and changes only what each page has room
 * for:
 *
 *   HOME        the strongest truth in one sentence, a few rows per list
 *               chosen by `homeLists`, one line on how sure Headway is
 *   CUSTOMERS   every topic, on its rung, with its counts
 *   TRENDS      the direction as the headline; the current picture in a line
 *
 * These tests hold the hierarchy in place so a later change cannot quietly
 * bring the essay back, and hold the quality rules so the quiet never turns
 * into overclaiming.
 */

const ROOT = join(__dirname, '..');
const source = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

function homeShown(state: EvidenceState, omit: string | null = null) {
  const headline = headlineOf(state, omit);
  const lists = homeLists(state, omit);
  const keys = [
    ...(headline?.findingKey ? [headline.findingKey] : []),
    ...lists.patterns.map((f) => f.key),
    ...lists.likes.map((f) => f.key),
    ...lists.watching.map((f) => f.key),
  ];
  return { headline, lists, keys };
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

describe('the Crazy Cheesy first read, quietly', () => {
  const r = runLadder(CRAZY_CHEESY);
  const s = r.state;
  const { headline, lists } = homeShown(s);

  it('says the strongest true thing in one short sentence, with the counts beside it once', () => {
    expect(s.stage).toBe('FIRST_READ');
    expect(headline).toMatchObject({ kind: 'MOOD', title: 'Most customers are happy.', tone: 'good' });
    expect(`${s.copy.eyebrow} · ${s.copy.countLine}`).toBe('First read · 5 responses');
    expect([s.pulse.happy, s.pulse.mixed, s.pulse.unhappy]).toEqual([4, 1, 0]);
    expect(s.pulse.from).toBe('4.8★ from 4 ratings');
  });

  it('keeps the useful early signals and the one complaint, and leaves single compliments for Customers', () => {
    expect(lists.watching.map((f) => [f.key, f.levelLabel])).toEqual([['service_speed', 'Mentioned once']]);
    expect(lists.likes.map((f) => [f.key, f.levelLabel, f.line])).toEqual([['drink_praise', 'Early signal', '2 of 5 customers']]);
    expect(lists.patterns).toEqual([]);
    // Food and staff, praised once each, are one tap away and counted.
    expect(lists.more).toBe(2);
    expect(s.likes.map((f) => f.key)).toEqual(expect.arrayContaining(['food_taste', 'staff_warmth']));
  });

  it('states its confidence once, in one line — and keeps the reasoning for "How Headway decides"', () => {
    expect(s.copy.note).toBe('Still early — nothing is a pattern yet.');
    expect(s.copy.notSure).toBeTruthy();
    expect(s.copy.clearer).toBeTruthy();
    expect(s.copy.doing.length).toBeGreaterThan(0);
  });

  it('reads the same in Hindi and Marathi: same headline kind, same rows, same order', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const local = runLadder(CRAZY_CHEESY, { t: translatorFor(locale) });
      const shown = homeShown(local.state);
      expect(shown.headline?.kind, locale).toBe('MOOD');
      expect(shown.headline?.tone, locale).toBe('good');
      expect(shown.lists.watching.map((f) => f.key), locale).toEqual(['service_speed']);
      expect(shown.lists.likes.map((f) => f.key), locale).toEqual(['drink_praise']);
      expect(local.state.copy.note, locale).not.toBe(s.copy.note);
      expect(local.state.copy.note, locale).toBeTruthy();
    }
  });
});

describe('the production Crazy Cheesy shape: one compliment, nothing repeated', () => {
  const r = runLadder([
    { text: 'Very attentive staff', stars: 5 },
    { text: '', stars: 5 },
    { text: '', stars: 5 },
    { text: '', stars: 4 },
    { text: 'Okay', stars: null },
  ]);
  it('is not an empty state: the mood leads, and nothing single is dressed up as a row', () => {
    const { headline, lists } = homeShown(r.state);
    expect(headline?.title).toBe('Most customers are happy.');
    expect(lists.likes).toEqual([]);
    expect(lists.watching).toEqual([]);
    expect(lists.more).toBe(r.state.findings.length);
    expect(r.state.copy.note).toBe('Still early — nothing has repeated yet.');
  });
});

describe('Home’s rows, at every count and for every kind of feedback', () => {
  for (const mix of Object.keys(MIXES)) {
    for (const n of LADDER_COUNTS) {
      it(`${mix} at ${n}`, () => {
        const s = runLadder(cycle(MIXES[mix]!, n, mix.slice(0, 2))).state;
        const { headline, lists, keys } = homeShown(s);

        // ---- the budget ---------------------------------------------------
        expect(lists.patterns.length).toBeLessThanOrEqual(HOME_LIMITS.patterns);
        expect(lists.likes.length).toBeLessThanOrEqual(HOME_LIMITS.likes);
        expect(lists.watching.length).toBeLessThanOrEqual(HOME_LIMITS.watching);

        // ---- no topic twice, and nothing lost --------------------------------
        expect(new Set(keys).size, keys.join()).toBe(keys.length);
        expect(keys.length + lists.more).toBe(s.findings.length);

        // ---- what earns a row ---------------------------------------------
        for (const f of lists.patterns) expect(f.kind === 'ISSUE' && isPattern(f.level), f.key).toBe(true);
        for (const f of lists.likes) {
          expect(f.kind, f.key).toBe('PRAISE');
          expect(f.mentions, `${f.key}: a single compliment is not on Home`).toBeGreaterThanOrEqual(EARLY_SIGNAL_MENTIONS);
        }
        for (const f of lists.watching) {
          expect(f.kind, f.key).toBe('ISSUE');
          expect(isPattern(f.level), f.key).toBe(false);
          if (n >= EMERGING_AT) expect(f.level, `${f.key}: a one-off at ${n} is not on Home`).not.toBe('OBSERVATION');
        }
        // A complaint pattern is never left off Home for lack of room.
        const complaintPatterns = s.concerns.filter((f) => isPattern(f.level));
        if (complaintPatterns.length <= HOME_LIMITS.patterns) {
          for (const f of complaintPatterns) expect(keys, f.key).toContain(f.key);
        }

        // ---- the headline never outruns its evidence -------------------------
        if (n >= 2) expect(headline, 'a headline from two read').not.toBeNull();
        if (headline?.kind === 'FINDING') {
          const f = headline.finding!;
          expect(f.level === 'EARLY_SIGNAL' || isPattern(f.level), f.key).toBe(true);
          expect(f.level).toBe(levelOf(f.mentions, n));
          if (f.level === 'EARLY_SIGNAL') expect(f.kind).toBe('ISSUE');
        }
        if (headline?.kind === 'MOOD' && /^Most customers/.test(headline.title)) {
          // "Most": two in three, or a majority the other side barely contests.
          const happyLed = /are happy|were happy/.test(headline.title);
          const [top, against] = happyLed ? [s.pulse.happy, s.pulse.unhappy] : [s.pulse.unhappy, s.pulse.happy];
          const total = s.pulse.counted;
          expect(top * 2, headline.title).toBeGreaterThan(total);
          expect(top * 3 >= total * 2 || against * 5 <= total, `"most" overstated: ${headline.title}`).toBe(true);
        }

        // ---- the evidence line is counts, and never says the rung again ------
        for (const f of s.findings) {
          expect(f.line, f.key).toMatch(new RegExp(`^${f.mentions} of ${n} customers`));
          expect(f.line, f.key).not.toMatch(/pattern|signal|once|watching/i);
          if (!isPattern(f.level)) expect(f.line, f.key).not.toMatch(/%/);
        }

        // ---- one short line on how sure ----------------------------------------
        const issuePatterns = complaintPatterns.length;
        if (n === 0) expect(s.copy.note).toBeNull();
        else if (n >= EMERGING_AT && issuePatterns > 0) expect(s.copy.note).toBeNull();
        else {
          expect(s.copy.note, `${n}`).toBeTruthy();
          expect(words(s.copy.note!), s.copy.note!).toBeLessThanOrEqual(10);
          expect(s.copy.note!.split(/(?<=[.?!])\s+/).length, s.copy.note!).toBe(1);
        }
        if (n > 0 && n < EMERGING_AT) expect(s.copy.note).toMatch(/early|One customer/i);

        // ---- nothing below a pattern asks the owner to do anything -------------
        for (const f of s.concerns) if (!isPattern(f.level)) expect(f.action, f.key).toBeNull();

        // ---- and no internal word reaches the owner ------------------------------
        const said = [headline?.title ?? '', s.copy.note ?? '', s.direction.title, s.direction.body, s.direction.automatic ?? ''].join(' ');
        expect(said).not.toMatch(INTERNALS);
        expect(said).not.toMatch(/check-in|unlock|to go\b|countdown/i);
      });
    }
  }
});

describe('the mood sentence says no more than the counts', () => {
  const mood = (responses: Response[]) => runLadder(responses).state.mood;
  it('a contested majority is "more happy than unhappy", never "most"', () => {
    const m = mood([...cycle(PRAISE_BANK, 13, 'h'), ...cycle(COMPLAINT_BANK, 11, 'u')]);
    expect(m?.title).toBe('More customers are happy than unhappy.');
  });
  it('an uncontested majority is "most"', () => {
    expect(mood([...cycle(PRAISE_BANK, 3, 'h'), ...cycle(NEUTRAL_BANK, 2, 'n')])?.title).toBe('Most customers are happy.');
  });
  it('an even split is a split', () => {
    expect(mood([...cycle(PRAISE_BANK, 6, 'h'), ...cycle(COMPLAINT_BANK, 6, 'u')])?.title).toBe('Customers are split.');
  });
  it('below five read it is "so far"', () => {
    expect(mood([...cycle(PRAISE_BANK, 2, 'h'), ...cycle(COMPLAINT_BANK, 1, 'u')])?.title).toBe('Most customers so far were happy.');
  });
});

describe('the page grows with the evidence', () => {
  const cafe: Response[] = [
    ...PRAISE_BANK,
    COMPLAINT_BANK[0]!,
    { text: 'Loved the coffee but the service was slow', stars: 4 },
    COMPLAINT_BANK[1]!,
    { text: 'It was okay', stars: 3 },
    { text: '', stars: 5 },
  ];
  const at = (n: number) => runLadder(cycle(cafe, n, 'g')).state;

  it('one response is what that customer said, never a headline about "customers"', () => {
    const s = at(1);
    expect(s.firstResponse?.length).toBeGreaterThan(0);
    expect(headlineOf(s)).toBeNull();
    expect(s.copy.note).toBe('One customer’s view — not a pattern.');
  });

  it('from ten read, a complaint that keeps coming up is named as a pattern with what to check', () => {
    const s = at(14);
    const { lists, headline } = homeShown(s);
    const slow = [headline?.finding, ...lists.patterns].find((f) => f?.key === 'service_speed');
    expect(slow?.level).toBe('EMERGING_PATTERN');
    expect(slow?.line).toMatch(/· \d+%$/);
  });

  it('from twenty-five, the strongest complaint is a strong pattern with what to do', () => {
    const s = at(40);
    const slow = s.findings.find((f) => f.key === 'service_speed');
    expect(slow?.level).toBe('STRONG_PATTERN');
    expect(slow?.action?.eyebrow).toBe('What to do');
  });
});

describe('Trends answers in its title, and only Trends explains direction', () => {
  it('names the state, never the mechanism', () => {
    const titles = new Set<string>();
    for (const n of [0, 5, 30]) titles.add(runLadder(cycle(PRAISE_BANK, n, 'd')).state.direction.title);
    expect([...titles]).toEqual(expect.arrayContaining(['No history yet', 'Not enough history yet']));
    for (const title of titles) expect(title).not.toMatch(/baseline|check-in|snapshot|period/i);
  });

  it('keeps the method one tap down', () => {
    const d = runLadder(cycle(PRAISE_BANK, 5, 'd')).state.direction;
    expect(d.methodTitle).toBe('How Headway decides');
    expect(d.method).toMatch(/comparable set/);
    expect(d.automatic).toBe('Headway keeps collecting feedback automatically.');
  });
});

describe('each page has one job (source structure)', () => {
  const brief = source('src', 'components', 'workspace', 'brief.tsx');
  const owner = brief.slice(brief.indexOf('export async function OwnerBrief('));
  const trends = source('src', 'components', 'workspace', 'improvements.tsx');
  const customers = source('src', 'components', 'workspace', 'analysis.tsx');
  const ladderUi = source('src', 'components', 'workspace', 'evidence-ladder.tsx');

  it('Home briefs: the reading, the latest words — and no direction essay', () => {
    expect(owner).toContain('<HomeReading');
    expect(owner).not.toContain('<DirectionPanel');
    expect(owner).not.toContain('<EvidenceReading');
  });

  it('Trends does not repeat Home’s reading', () => {
    expect(trends).not.toMatch(/<EvidenceReading|<HomeReading|<ReadingSummary/);
    expect(trends).toContain('<DirectionPanel');
  });

  it('Customers lists every topic, opening with the summary rather than Home’s lists', () => {
    expect(customers).toContain('<ReadingSummary');
    expect(customers).toContain('<AllFindings');
    expect(customers).not.toContain('<HomeReading');
  });

  it('the four blocks that said one idea are one line and a reveal', () => {
    expect(ladderUi).not.toMatch(/ladder\.section\.(notSure|clearer|doing)/);
    expect(ladderUi).toContain("t('ladder.how.title')");
  });
});

describe('Hindi and Marathi say the same quieter things', () => {
  for (const locale of ['hi', 'mr'] as const) {
    it(`${locale}: every new line exists and keeps its numbers`, () => {
      const t = translatorFor(locale);
      const en = runLadder(cycle(MIXES.mixed!, 12, 'm'), { t: EN }).state;
      const local = runLadder(cycle(MIXES.mixed!, 12, 'm'), { t }).state;
      expect(local.copy.countLine).toContain('12');
      expect(local.pulse.from).toContain(en.pulse.average!.toFixed(1));
      expect(local.copy.note === null).toBe(en.copy.note === null);
      expect(local.findings.map((f) => f.key)).toEqual(en.findings.map((f) => f.key));
      for (const [i, f] of local.findings.entries()) {
        expect(f.line).toContain(String(en.findings[i]!.mentions));
        expect(f.line).toContain('12');
      }
      expect(local.direction.title).not.toBe(en.direction.title);
    });
  }
});

describe('review fixes: the quiet never contradicts itself', () => {
  it('the note names its subject, so it never reads as being about a praise pattern above it', () => {
    const s = runLadder([
      ...cycle([{ text: 'Loved the coffee, really smooth', stars: 5 }], 4, 'c'),
      ...cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 2 }], 2, 's'),
      ...cycle(NEUTRAL_BANK, 6, 'n'),
    ]).state;
    expect(headlineOf(s)?.finding?.level).toBe('EMERGING_PATTERN');
    expect(s.copy.note).toBe('No problem is a pattern yet.');
  });

  it('with the story card telling the topic that stands out, Home adds no second headline', () => {
    const s = runLadder([...cycle([{ text: 'Service was very slow, we waited 40 minutes', stars: 1 }], 3, 's'), ...cycle(PRAISE_BANK, 11, 'p')]).state;
    expect(s.standsOut?.findingKey).toBe('service_speed');
    expect(headlineOf(s, 'service_speed')).toBeNull();
    expect(headlineOf(s)).not.toBeNull();
  });

  it('a story topic the ladder does not hold is not counted as shown', () => {
    const s = runLadder(cycle(MIXES.mixed!, 30, 'm')).state;
    expect(homeLists(s, 'not_a_finding').more).toBe(homeLists(s, null).more);
  });

  it('the direction never claims a set exists before one does', () => {
    const d = runLadder(cycle(PRAISE_BANK, 5, 'p')).state.direction;
    expect(d.state).toBe('BUILDING_BASELINE');
    expect(d.body).not.toMatch(/another/i);
    expect(d.body).toMatch(/two comparable sets/);
  });
});
