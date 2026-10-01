import { describe, expect, it } from 'vitest';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { summariseThemeRows } from '@/lib/feedback/analysis';
import { buildPortalView } from '@/lib/portal/view';
import { JUST_READ_MS, NEW_WINDOW_MS } from '@/lib/portal/fresh';
import { MIN_MENTIONS_TO_NAME, MIN_PERIOD_FEEDBACK_TO_COMPARE } from '@/lib/intelligence/engine';
import { TIER_LIMITED_MIN, TIER_STANDARD_MIN } from '@/lib/analysis/aggregate';
import { MESSAGES } from '@/lib/i18n/strings';
import { getPackOrFallback } from '@/lib/packs';
import { runScenario } from './eval/trend-scenarios';

/**
 * M47 — THE EVIDENCE LADDER (final correctness gate).
 *
 *   per-response reading   every response, at once
 *   emerging signal        3+ responses mention it, but fewer than 10 read
 *   recurring pattern      3+ responses mention it, 10+ read
 *   strong pattern         6+ responses, 25+ read
 *   actionable issue       a complaint pattern the owner is asked to act on
 *   trend                  two check-ins, 10+ read in each, and a share move
 *                          the comparison rule accepts
 *
 * Customers are anonymous: "responses" are the unit, a response counts at
 * most once per topic however many times it names it, and byte-identical
 * text is refused at ingestion. No level can be reached by one response.
 */

const restaurant = getPackOrFallback('restaurant');

describe('one response is one mention', () => {
  it('counts a topic once per response, however many ways it is named', () => {
    const n = normalizeFeedback({
      text: 'Service was slow, so slow, painfully slow, we waited forever and it took ages.',
      stars: 1,
      pack: restaurant,
      ai: null,
    });
    const summary = summariseThemeRows([{ id: 'r1', themesJson: JSON.stringify(n.themes) }], restaurant);
    expect(summary.issues.find((t) => t.key === 'service_speed')?.count).toBe(1);
  });
});

describe('each level has its own floor', () => {
  it('names nothing below three mentions', () => {
    expect(MIN_MENTIONS_TO_NAME).toBe(3);
    const s = runScenario({ previous: null, current: null, since: { mentions: 2, total: 40 } });
    expect(s.named).toBe(false);
  });

  it('calls three mentions in fewer than ten read an emerging signal, never a pattern', () => {
    expect(TIER_LIMITED_MIN).toBe(10);
    const s = runScenario({ previous: null, current: null, since: { mentions: 3, total: 8 } });
    const view = buildPortalView(s.input);
    const signal = [...view.unhappy, ...view.early].find((x) => x.themeKey === 'service_speed');
    expect(signal?.bucket).toBe('EARLY');
    expect(view.first).toBeNull();
  });

  it('calls three mentions in ten or more read a recurring pattern, at moderate confidence', () => {
    const s = runScenario({ previous: null, current: null, since: { mentions: 3, total: 12 } });
    const insight = s.intelligence.unhappy.find((i) => i.themeKey === 'service_speed');
    expect(insight?.confidence).toBe('MODERATE');
  });

  it('calls a pattern strong only at six mentions in twenty-five read', () => {
    expect(TIER_STANDARD_MIN).toBe(25);
    const five = runScenario({ previous: null, current: null, since: { mentions: 5, total: 30 } });
    expect(five.intelligence.unhappy.find((i) => i.themeKey === 'service_speed')?.confidence).toBe('MODERATE');
    const six = runScenario({ previous: null, current: null, since: { mentions: 6, total: 25 } });
    expect(six.intelligence.unhappy.find((i) => i.themeKey === 'service_speed')?.confidence).toBe('STRONG');
  });

  it('shows a trend only with two check-ins of ten or more read each', () => {
    expect(MIN_PERIOD_FEEDBACK_TO_COMPARE).toBe(10);
    expect(runScenario({ previous: { mentions: 5, total: 9 }, current: { mentions: 9, total: 20 } }).comparable).toBe(false);
    expect(runScenario({ previous: { mentions: 2, total: 10 }, current: { mentions: 9, total: 20 } }).comparable).toBe(true);
  });
});

describe('"Headway just read X" says what it counts', () => {
  it('counts responses read in the last fifteen minutes that arrived in the last day, and says "from the last day"', () => {
    expect(JUST_READ_MS).toBe(15 * 60_000);
    expect(NEW_WINDOW_MS).toBe(24 * 60 * 60_000);
    expect(MESSAGES['brief.live.justRead.other'].en).toMatch(/from the last day/);
    // The unread count is a different number with a different name.
    expect(MESSAGES['brief.live.reading.other'].en).toMatch(/not read yet/);
    expect(MESSAGES['brief.live.reading.other'].en).not.toMatch(/\bnew\b/);
  });
});
