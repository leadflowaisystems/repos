import { describe, expect, it } from 'vitest';
import { buildPortalView } from '@/lib/portal/view';
import { NOW, action, input, intel, pulseWith, themes } from '@/lib/portal/test-fixtures';
import { buildResponsibility, type ResponsibilityInput } from '@/lib/responsibility/engine';
import type { AnalysisCoverage } from '@/lib/feedback/analysis';
import type { SinceLastVisit } from '@/lib/retention/service';
import { EN } from '@/lib/i18n/translator';
import { buildEvidenceIndex } from './evidence';
import { buildBrief, trendOf } from './brief';

/**
 * THE BRIEF, AS THE FINAL EXPERIENCE PASS SHAPED IT.
 *
 * `brief.test.ts` pins the reading order and the promises every portal page
 * makes. This file pins what the final pass added to the brief — the band's
 * header, the calm state, the one recorded fact behind a problem, and the
 * owner's record of changes — and, directly and in every combination, the
 * one bug that pass found in a shipped screen: praise that had FALLEN drawn
 * as a green arrow pointing up.
 */

const BASE = '/workspace/c1';
const EVIDENCE = buildEvidenceIndex([]);

function coverage(): AnalysisCoverage {
  const sentimentCounts = { POSITIVE: 26, NEGATIVE: 14, MIXED: 6, NEUTRAL: 3, UNKNOWN: 1 };
  return {
    total: 50,
    analysed: 50,
    needsAnalysis: 0,
    failed: 0,
    processing: 0,
    outOfDate: 0,
    sentimentCounts,
    upToDate: true,
  };
}

function build(
  overrides: Partial<ResponsibilityInput> & {
    portal?: Parameters<typeof input>[0];
    since?: SinceLastVisit | null;
  } = {},
) {
  const { portal, since = null, ...rest } = overrides;
  const core = input(portal ?? {});
  const view = buildPortalView(core);
  const r = buildResponsibility({
    view,
    intelligence: core.intelligence,
    actions: core.actions,
    checkins: [],
    feedbackSince: { total: 50, read: 50, unread: 0, direct: 0 },
    needsYourWords: 0,
    gateway: { enabled: true, received: 0 },
    archived: false,
    now: NOW,
    ...rest,
  });
  const brief = buildBrief({
    view,
    responsibility: r,
    evidence: EVIDENCE,
    coverage: coverage(),
    basePath: BASE,
    since,
    now: NOW,
  });
  return { brief, view };
}

describe('trendOf: the arrow is the count, the colour is the news', () => {
  // The engine's `movementDirection` is GOOD-OR-BAD for the owner, not
  // up-or-down: for praise, IMPROVING means the count ROSE.
  const signal = (
    kind: 'ISSUE' | 'PRAISE',
    direction: 'IMPROVING' | 'WORSENING' | 'STABLE' | null,
  ) => {
    const { view } = build();
    const base = kind === 'ISSUE' ? view.unhappy[0]! : view.loved[0]!;
    return { ...base, kind, movementDirection: direction, movementCounts: '4 → 9 mentions' };
  };

  it('draws a complaint that rose as up, and bad news', () => {
    expect(trendOf(signal('ISSUE', 'WORSENING'), EN)).toMatchObject({ mark: '↑', tone: 'bad' });
  });

  it('draws a complaint that fell as down, and good news', () => {
    expect(trendOf(signal('ISSUE', 'IMPROVING'), EN)).toMatchObject({ mark: '↓', tone: 'good' });
  });

  it('draws praise that rose as up, and good news', () => {
    expect(trendOf(signal('PRAISE', 'IMPROVING'), EN)).toMatchObject({ mark: '↑', tone: 'good' });
  });

  it('draws praise that FELL as down and bad news — the shipped bug drew it green and rising', () => {
    const trend = trendOf(signal('PRAISE', 'WORSENING'), EN);
    expect(trend).toMatchObject({ mark: '↓', tone: 'bad' });
    expect(trend!.label).toBe(EN('brief.trend.worse'));
  });

  it('draws no movement as a level arrow, in neutral', () => {
    expect(trendOf(signal('ISSUE', 'STABLE'), EN)).toMatchObject({ mark: '→', tone: 'neutral' });
    expect(trendOf(signal('PRAISE', 'STABLE'), EN)).toMatchObject({ mark: '→', tone: 'neutral' });
  });

  it('draws nothing when there was nothing to compare', () => {
    expect(trendOf(signal('ISSUE', null), EN)).toBeNull();
    expect(trendOf(signal('PRAISE', null), EN)).toBeNull();
  });

  it('carries the real counts, never a percentage', () => {
    expect(trendOf(signal('ISSUE', 'WORSENING'), EN)!.counts).toBe('4 → 9 mentions');
  });
});

describe('the band: whose brief this is, and what Headway did', () => {
  const away = (arrived: number, measured: SinceLastVisit['measured'] = []): SinceLastVisit => ({
    lastSeenAt: new Date(NOW.getTime() - 3 * 86_400_000),
    daysAgo: 3,
    arrived,
    read: arrived,
    measured,
    done: 0,
  });

  it('names the business, and counts the topics Headway is following', () => {
    const { brief, view } = build();
    expect(brief.header.businessName).toBe(view.businessName);
    expect(brief.header.watching).toBe(view.unhappy.length + view.loved.length);
  });

  it('says how much arrived while they were away, only when something did', () => {
    expect(build({ since: away(6) }).brief.header.arrivedSinceVisit).toBe(6);
    expect(build({ since: away(0, [{ id: 'm', title: 'Waiting', result: 'IMPROVED' }]) }).brief.header.arrivedSinceVisit).toBeNull();
    expect(build().brief.header.arrivedSinceVisit).toBeNull();
  });

  it('reports a change checked while they were away with the verdict the engine gave', () => {
    const { brief } = build({
      since: away(0, [
        { id: 'a', title: 'Waiting', result: 'IMPROVED' },
        { id: 'b', title: 'Noise', result: 'WORSENED' },
        { id: 'c', title: 'Parking', result: 'NO_CLEAR_CHANGE' },
      ]),
    });
    expect(brief.header.checkedWhileAway.map((c) => c.better)).toEqual([true, false, null]);
  });
});

describe('the calm state: nothing needs you, said plainly', () => {
  it('is not calm while there is a problem to act on', () => {
    const { brief } = build();
    expect(brief.attention).not.toBeNull();
    expect(brief.calm).toBe(false);
  });

  it('is never calm before there is anything to read: that is too early, not calm', () => {
    const { brief } = build({
      portal: { intelligence: intel({ themes: themes([], [], 0) }), themes: themes([], [], 0) },
      feedbackSince: { total: 0, read: 0, unread: 0, direct: 0 },
    });
    expect(brief.tooEarly).toBe(true);
    expect(brief.calm).toBe(false);
  });

  it('is calm exactly when the story would be empty and it is not too early', () => {
    for (const { brief } of [build(), build({ portal: { actions: [action('MEASURED')] } })]) {
      expect(brief.calm).toBe(!brief.tooEarly && brief.attention === null);
    }
  });
});

describe('what this means: a recorded fact, or nothing', () => {
  it('never offers a reason Headway has no data for', () => {
    const { brief, view } = build();
    const card = brief.attention!;
    const signal = view.unhappy.find((s) => s.themeKey === card.themeKey)!;
    const tapped = signal.tapped?.specifics[0];
    if (tapped && tapped.count > 0) {
      expect(card.meaning).toContain(tapped.label);
    } else {
      // No tapped specific: the recurrence line the history module wrote, or nothing.
      expect(card.meaning).toBe(signal.recurrence);
    }
  });
});

describe('your changes: the record, from what the loop stored', () => {
  it('does not exist until a change has actually been made', () => {
    expect(build().brief.memory).toBeNull();
    expect(build({ portal: { actions: [action('ACCEPTED')] } }).brief.memory).toBeNull();
    expect(build({ portal: { actions: [action('DECLINED')] } }).brief.memory).toBeNull();
  });

  it('shows a made change as being watched, with no counts it does not have', () => {
    const memory = build({ portal: { actions: [action('DONE')] } }).brief.memory!;
    expect(memory.recent[0]!.state).toBe('WATCHING');
    expect(memory.recent[0]!.before).toBeNull();
    expect(memory.recent[0]!.after).toBeNull();
    expect(memory.last30.watching).toBe(1);
  });

  it('shows a checked change with the two counts the engine measured, never a share', () => {
    const memory = build({ portal: { actions: [action('MEASURED', 'IMPROVED')] } }).brief.memory!;
    expect(memory.biggest).toMatchObject({ state: 'BETTER', before: '9/50', after: '2/30', awaiting: null });
    // Said once: the month's biggest change is not repeated in the list under it.
    expect(memory.recent.some((c) => c.key === memory.biggest!.key)).toBe(false);
    expect(JSON.stringify(memory)).not.toMatch(/%/);
  });

  it('names the month’s biggest change only from a measured improvement, with its counts', () => {
    expect(build({ portal: { actions: [action('DONE')] } }).brief.memory!.biggest).toBeNull();
    expect(build({ portal: { actions: [action('MEASURED', 'WORSENED')] } }).brief.memory!.biggest).toBeNull();
    expect(build({ portal: { actions: [action('MEASURED', 'NO_CLEAR_CHANGE')] } }).brief.memory!.biggest).toBeNull();
    const biggest = build({ portal: { actions: [action('MEASURED', 'IMPROVED')] } }).brief.memory!.biggest!;
    expect(biggest).toMatchObject({ state: 'BETTER', before: '9/50', after: '2/30' });
  });

  it('keeps a worse result on the record too — a record of wins only would be a brochure', () => {
    const memory = build({ portal: { actions: [action('MEASURED', 'WORSENED')] } }).brief.memory!;
    expect(memory.recent[0]!.state).toBe('WORSE');
  });
});

describe('what changed: one row per topic, never the same line twice', () => {
  it('names each topic that moved, once, with its counts', () => {
    const { brief, view } = build({
      portal: { intelligence: intel({ pulse: pulseWith({ waitThen: 2, waitNow: 9, careThen: 4, careNow: 12 }) }) },
    });
    expect(brief.changed.length).toBeGreaterThan(0);
    const keys = brief.changed.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    const labels = new Map([...view.unhappy, ...view.loved].map((s) => [s.themeKey, s.themeLabel]));
    for (const row of brief.changed) {
      // The topic's own name, not the engine's generic sentence.
      expect(row.label).toBe(labels.get(row.key));
      expect(row.kind === 'ISSUE' ? row.tone : 'good').toBe(row.kind === 'ISSUE' ? 'bad' : 'good');
    }
    expect(brief.changed.length).toBeLessThanOrEqual(3);
  });
});
