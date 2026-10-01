import { describe, expect, it } from 'vitest';
import { buildPortalView, type PortalSignal } from '@/lib/portal/view';
import { buildAnalysisView, buildCheckinView, buildImprovementsView } from '@/lib/portal/pages';
import { buildBrief, trendOf } from '@/lib/portal/brief';
import { buildEvidenceIndex } from '@/lib/portal/evidence';
import { buildTrendReadiness } from '@/lib/portal/trends';
import { FIRST_READING_AT, readinessOf } from '@/lib/portal/readiness';
import { buildResponsibility } from '@/lib/responsibility/engine';
import type { AnalysisCoverage } from '@/lib/feedback/analysis';
import type { SnapshotListRow } from '@/lib/snapshots/service';
import { EN } from '@/lib/i18n/translator';
import { NOW, runScenario, type Scenario } from './eval/trend-scenarios';

/**
 * M45 — ONE TRUTH ON EVERY SCREEN (intelligence quality pass, Sep 2026).
 *
 * The same feedback is read by Home, Customers, Trends, Check-in and the
 * owner's list of changes. Each builds its own view, so each could drift into
 * its own story — and one did: Home led with a complaint the engine graded
 * EARLY while Customers filed the same topic under "not yet clear". This runs
 * one set of controlled check-ins through every builder and requires them to
 * agree, topic by topic.
 *
 * Then the owner's experience as feedback arrives: what each screen is
 * allowed to claim at 0, 1–4, 5, 6–9, 10 and 20+ responses, with no check-in,
 * one, two thin ones and two that can be compared.
 */

type Surface = {
  engine: string | null;
  view: PortalSignal['movementDirection'];
  trendsShelf: 'WORSE' | 'BETTER' | 'STABLE' | 'NONE';
  checkinSays: 'BETTER' | 'WORSE' | 'NONE';
  customersSays: 'BETTER' | 'WORSE' | 'STEADY' | 'NONE';
  homeTone: 'good' | 'bad' | 'neutral' | null;
  compared: { engine: boolean; trends: boolean; checkin: boolean; readiness: boolean };
  homeLeadIsEarly: boolean;
};

function coverageFor(total: number): AnalysisCoverage {
  return {
    total,
    analysed: total,
    needsAnalysis: 0,
    failed: 0,
    processing: 0,
    outOfDate: 0,
    sentimentCounts: { POSITIVE: 0, NEGATIVE: total, MIXED: 0, NEUTRAL: 0, UNKNOWN: 0 },
    upToDate: true,
  };
}

function everySurface(scenario: Scenario): Surface {
  const kind = scenario.kind ?? 'ISSUE';
  const key = kind === 'ISSUE' ? 'service_speed' : 'food_taste';
  const result = runScenario(scenario);
  const input = result.input;
  const intel = result.intelligence;
  const view = buildPortalView(input);
  const signal = [...view.unhappy, ...view.loved, ...view.early].find((s) => s.themeKey === key) ?? null;

  const checkins: SnapshotListRow[] = [...input.snapshots]
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())
    .map((s) => ({
      id: s.id,
      label: s.label,
      capturedAt: s.capturedAt,
      rating: null,
      reviewCount: null,
      feedbackCount: s.feedback.length,
      isBaseline: false,
      narrativeSource: null,
    }));
  const checkin = buildCheckinView({ ...input, checkins });
  const analysis = buildAnalysisView(input);
  const improvements = buildImprovementsView(input);

  const total = intel.evidence.total;
  const responsibility = buildResponsibility({
    view,
    intelligence: intel,
    actions: input.actions,
    checkins: [],
    feedbackSince: { total, read: total, unread: 0, direct: 0 },
    needsYourWords: 0,
    gateway: { enabled: true, received: total },
    archived: false,
    now: NOW,
  });
  const brief = buildBrief({
    view,
    responsibility,
    evidence: buildEvidenceIndex([]),
    coverage: coverageFor(total),
    basePath: '/workspace/c1',
    now: NOW,
  });
  const leadSignal = brief.attention
    ? [...view.unhappy, ...view.early].find((s) => s.themeKey === brief.attention!.themeKey)
    : null;

  const on = (xs: PortalSignal[]) => xs.some((s) => s.themeKey === key);
  return {
    engine: result.state,
    view: signal?.movementDirection ?? null,
    trendsShelf: result.shelf,
    checkinSays: on(checkin.better) ? 'BETTER' : on(checkin.worse) ? 'WORSE' : 'NONE',
    customersSays: on(analysis.better) ? 'BETTER' : on(analysis.worse) ? 'WORSE' : on(analysis.steady) ? 'STEADY' : 'NONE',
    homeTone: signal ? (trendOf(signal, EN)?.tone ?? null) : null,
    compared: {
      engine: intel.window.available,
      trends: improvements.trends.comparable,
      checkin: checkin.compared,
      readiness: buildTrendReadiness(input).state === 'READY',
    },
    homeLeadIsEarly: leadSignal?.bucket === 'EARLY',
  };
}

const MATRIX: Array<{ name: string; scenario: Scenario }> = [
  { name: 'same share on more feedback', scenario: { previous: { mentions: 5, total: 10 }, current: { mentions: 10, total: 20 } } },
  { name: 'a larger share', scenario: { previous: { mentions: 5, total: 10 }, current: { mentions: 15, total: 20 } } },
  { name: 'a smaller share', scenario: { previous: { mentions: 15, total: 20 }, current: { mentions: 5, total: 20 } } },
  { name: 'more mentions, smaller share', scenario: { previous: { mentions: 10, total: 20 }, current: { mentions: 12, total: 40 } } },
  { name: 'a move that could be chance', scenario: { previous: { mentions: 5, total: 20 }, current: { mentions: 7, total: 20 } } },
  { name: 'too few mentions', scenario: { previous: { mentions: 0, total: 10 }, current: { mentions: 1, total: 20 } } },
  { name: 'a thin earlier check-in', scenario: { previous: { mentions: 1, total: 5 }, current: { mentions: 6, total: 20 } } },
  { name: 'one check-in only', scenario: { previous: null, current: { mentions: 6, total: 20 } } },
  { name: 'praise that grew', scenario: { previous: { mentions: 5, total: 10 }, current: { mentions: 15, total: 20 }, kind: 'PRAISE' } },
  { name: 'praise that fell', scenario: { previous: { mentions: 15, total: 20 }, current: { mentions: 5, total: 20 }, kind: 'PRAISE' } },
];

describe('every screen tells the same story about a topic', () => {
  it('covers every verdict, so the agreement below is never vacuous', () => {
    const states = new Set(MATRIX.map(({ scenario }) => runScenario(scenario).state ?? 'NOT_NAMED'));
    for (const s of ['IMPROVING', 'WORSENING', 'STABLE', 'INSUFFICIENT_DATA']) expect(states).toContain(s);
  });

  for (const { name, scenario } of MATRIX) {
    it(name, () => {
      const s = everySurface(scenario);

      // Whether a comparison exists at all: one answer everywhere.
      const compared = s.compared.engine;
      expect(s.compared).toEqual({ engine: compared, trends: compared, checkin: compared, readiness: compared });

      // The engine's verdict, carried unchanged to the view...
      const readable = s.engine === 'IMPROVING' || s.engine === 'WORSENING' || s.engine === 'STABLE';
      expect(s.view).toBe(readable ? s.engine : null);

      // ...onto the Trends shelf, the Check-in page, Customers and Home.
      const want = {
        IMPROVING: { shelf: 'BETTER', checkin: 'BETTER', customers: 'BETTER', home: 'good' },
        WORSENING: { shelf: 'WORSE', checkin: 'WORSE', customers: 'WORSE', home: 'bad' },
        STABLE: { shelf: 'STABLE', checkin: 'NONE', customers: 'STEADY', home: 'neutral' },
      } as const;
      if (readable) {
        const w = want[s.engine as keyof typeof want];
        expect(s.trendsShelf).toBe(w.shelf);
        expect(s.checkinSays).toBe(w.checkin);
        expect(s.customersSays).toBe(w.customers);
        expect(s.homeTone).toBe(w.home);
      } else {
        expect(s.trendsShelf).toBe('NONE');
        expect(s.checkinSays).toBe('NONE');
        expect(['NONE']).toContain(s.customersSays);
        expect(s.homeTone).toBeNull();
      }

      // Home never leads with what Customers calls an early sign.
      expect(s.homeLeadIsEarly).toBe(false);
    });
  }
});

describe('what an owner is told as feedback arrives', () => {
  it('shows no reading below five responses, and a first reading at five', () => {
    expect(FIRST_READING_AT).toBe(5);
    expect(readinessOf(0).state).toBe('NONE');
    for (const n of [1, 2, 3, 4]) {
      const r = readinessOf(n);
      expect(r.state, `${n}`).toBe('BUILDING');
      expect(r.remaining, `${n}`).toBe(5 - n);
    }
    for (const n of [5, 6, 9, 10, 20, 250]) expect(readinessOf(n).state, `${n}`).toBe('READY');
  });

  it('never promises trends at five responses, in any language', () => {
    for (const t of [EN]) {
      const text = [t('readiness.promise', { target: 5 }), t.plural('readiness.almost.body', 4, { target: 5 })].join(' ');
      expect(text).not.toMatch(/patterns and trends|how it changes over time/i);
      expect(text).toMatch(/first reading/i);
    }
  });

  it('calls five to nine responses an early reading on Home, never a full one', () => {
    for (const total of [5, 6, 9]) {
      const s = runScenario({ previous: null, current: null, since: { mentions: 3, total } });
      const view = buildPortalView(s.input);
      expect(view.basedOn, `${total}`).toBeLessThan(10);
      // Three mentions in under ten responses is an early sign, never a pattern.
      expect(view.unhappy.every((x) => x.bucket === 'EARLY'), `${total}`).toBe(true);
      const brief = buildBrief({
        view,
        responsibility: buildResponsibility({
          view,
          intelligence: s.intelligence,
          actions: [],
          checkins: [],
          feedbackSince: { total, read: total, unread: 0, direct: 0 },
          needsYourWords: 0,
          gateway: { enabled: true, received: total },
          archived: false,
          now: NOW,
        }),
        evidence: buildEvidenceIndex([]),
        coverage: coverageFor(total),
        basePath: '/workspace/c1',
        now: NOW,
      });
      expect(brief.thin, `${total}`).toBe(true);
      expect(brief.attention, `${total}`).toBeNull();
      expect(brief.earlySigns.map((e) => e.themeKey), `${total}`).toContain('service_speed');
    }
  });

  it('names a pattern once ten are read and three mention it', () => {
    const s = runScenario({ previous: null, current: null, since: { mentions: 4, total: 12 } });
    const view = buildPortalView(s.input);
    expect(view.unhappy.some((x) => x.themeKey === 'service_speed' && x.bucket !== 'EARLY')).toBe(true);
  });

  it('explains why there is no trend yet, at every stage, and never tells the owner to make a check-in', () => {
    const stages: Array<[string, Scenario, string]> = [
      ['no check-in', { previous: null, current: null, since: { mentions: 3, total: 12 } }, 'NO_CHECKIN'],
      ['one check-in', { previous: null, current: { mentions: 3, total: 12 } }, 'ONE_CHECKIN'],
      ['two thin check-ins', { previous: { mentions: 2, total: 6 }, current: { mentions: 3, total: 8 } }, 'TOO_THIN'],
      ['two check-ins that compare', { previous: { mentions: 3, total: 12 }, current: { mentions: 4, total: 14 } }, 'READY'],
    ];
    for (const [name, scenario, state] of stages) {
      const s = runScenario(scenario);
      expect(buildTrendReadiness(s.input).state, name).toBe(state);
      const improvements = buildImprovementsView(s.input);
      expect(improvements.trendReadiness.state, name).toBe(state);
    }
    // The owner-facing copy for every not-ready state.
    const keys = [
      'improvements.notReady.body',
      'improvements.notReady.next.none',
      'improvements.notReady.next.oneWaiting',
      'improvements.notReady.next.oneDue',
      'improvements.notReady.next.thin',
      'evidence.recurrence.noCheckin',
    ] as const;
    for (const k of keys) {
      const line = EN(k as never, { count: 3, need: 10, since: 4, date: '1 Sept', label: 'Check-in', target: 10 } as never);
      expect(line, k).not.toMatch(/\b(create|record|run|do|make|schedule) (a|your|another|the next) check-in/i);
    }
  });
});
