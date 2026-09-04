import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import { buildIntelligence, type IntelligenceInput } from '@/lib/intelligence/engine';
import type {
  DimensionSummaryRow,
  ThemeSummary,
  ThemeSummaryRow,
} from '@/lib/feedback/analysis';
import type { Pulse } from '@/lib/health/health';
import {
  ACTION_STATUSES,
  ACTION_VERSION,
  STATUS_MEANINGS,
  TRANSITIONS,
  actionFromInsight,
  canTransition,
  decisionMinute,
  evidenceLine,
  transitionError,
  type ActionBaseline,
  type ActionStatus,
} from './model';
import {
  MEASUREMENT_VERSION,
  MIN_FEEDBACK_TO_MEASURE,
  MIN_SHARE_MOVE,
  measureAction,
  measurementNumbers,
  type MeasurableRow,
} from './measure';

_resetPackCache();

const clinic = getPackOrFallback('clinic');
// Local dates: the engine reports them the way the operator typed them.
const NOW = new Date(2026, 5, 1);
const AGREED = new Date(2026, 2, 1);
const DONE = new Date(2026, 3, 1);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function theme(
  key: string,
  label: string,
  kind: 'PRAISE' | 'ISSUE',
  count: number,
  severity: 'low' | 'medium' | 'high' = 'high',
): ThemeSummaryRow {
  return {
    key,
    label,
    kind,
    severity,
    count,
    itemIds: Array.from({ length: count }, (_, i) => `${key}-${i}`),
  };
}

function themes(
  praises: ThemeSummaryRow[],
  issues: ThemeSummaryRow[],
  analysedCount: number,
  dimensions: DimensionSummaryRow[] = [],
): ThemeSummary {
  return { praises, issues, analysedCount, dimensions };
}

const NO_PULSE: Pulse = {
  available: false,
  reason: 'Two snapshots are needed before periods can be compared.',
  direction: 'NONE',
  directionLabel: 'Not enough data',
  current: null,
  previous: null,
  periodDays: null,
  metrics: [],
  notableChanges: [],
  sampleWarning: null,
};

function intelligence(overrides: Partial<IntelligenceInput> = {}) {
  return buildIntelligence({
    client: { id: 'c1', businessName: 'Sunrise Dental Clinic', vertical: 'clinic' },
    pack: clinic,
    themes: themes(
      [theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12)],
      [theme('wait_time', 'Long waiting time', 'ISSUE', 9)],
      50,
    ),
    totalFeedback: 50,
    pulse: NO_PULSE,
    notes: [],
    ...overrides,
  });
}

/** A theme mention on a feedback row, in the shape the analysis layer stores. */
function row(id: string, at: string, themeKeys: string[] = []): MeasurableRow {
  const known = (key: string) => {
    const issue = clinic.issueTaxonomy.find((t) => t.key === key);
    if (issue) {
      return {
        key,
        label: issue.label,
        kind: 'ISSUE' as const,
        sentiment: 'NEGATIVE' as const,
        severity: issue.severity,
      };
    }
    const praise = clinic.praiseTaxonomy.find((t) => t.key === key);
    return {
      key,
      label: praise?.label ?? key,
      kind: 'PRAISE' as const,
      sentiment: 'POSITIVE' as const,
      severity: 'low' as const,
    };
  };

  return {
    id,
    analysisStatus: 'ANALYSED',
    evidenceAt: new Date(at),
    themesJson: JSON.stringify(themeKeys.map(known)),
  };
}

/** n rows on one date, the first `withTheme` of them mentioning the theme. */
function batch(
  prefix: string,
  at: string,
  count: number,
  withTheme: number,
  themeKey = 'wait_time',
): MeasurableRow[] {
  return Array.from({ length: count }, (_, i) =>
    row(`${prefix}-${i}`, at, i < withTheme ? [themeKey] : []),
  );
}

function baseline(overrides: Partial<ActionBaseline> = {}): ActionBaseline {
  return {
    count: 9,
    total: 50,
    itemIds: Array.from({ length: 9 }, (_, i) => `wait_time-${i}`),
    confidence: 'STRONG',
    capturedAt: AGREED,
    snapshotId: 's1',
    snapshotLabel: 'March check-in',
    ...overrides,
  };
}

function measure(
  rows: MeasurableRow[],
  overrides: { baseline?: ActionBaseline; sentiment?: 'PRAISE' | 'ISSUE' } = {},
) {
  return measureAction({
    pack: clinic,
    themeKey: 'wait_time',
    themeLabel: 'Long waiting time',
    sentiment: overrides.sentiment ?? 'ISSUE',
    baseline: overrides.baseline ?? baseline(),
    doneAt: DONE,
    rows,
    now: NOW,
  });
}

// ---------------------------------------------------------------------------

describe('an action freezes what RepOS said at the time', () => {
  it('copies the insight, the recommendation and the evidence onto the action', () => {
    const intel = intelligence();
    const insight = intel.attention;
    if (!insight) throw new Error('fixture has no attention insight');

    const draft = actionFromInsight(insight, {
      capturedAt: AGREED,
      snapshotId: 's1',
      snapshotLabel: 'March check-in',
    });

    expect(draft.provenance.insightId).toBe(insight.id);
    expect(draft.provenance.themeKey).toBe('wait_time');
    expect(draft.provenance.insightHeadline).toBe(insight.headline);
    expect(draft.provenance.signals).toEqual(insight.signals);
    expect(draft.provenance.intelligenceVersion).toBe(insight.version);

    // The pack's own advice, verbatim — RepOS does not write advice.
    expect(draft.provenance.recommendationText).toBe(
      clinic.issueTaxonomy.find((t) => t.key === 'wait_time')?.action,
    );

    expect(draft.baseline.count).toBe(9);
    expect(draft.baseline.total).toBe(50);
    expect(draft.baseline.itemIds.length).toBe(9);
    expect(draft.baseline.snapshotId).toBe('s1');
  });

  it('keeps the stable insight id, not just the theme key', () => {
    const insight = intelligence().attention;
    if (!insight) throw new Error('fixture has no attention insight');
    const draft = actionFromInsight(insight, {
      capturedAt: AGREED,
      snapshotId: null,
      snapshotLabel: null,
    });
    expect(draft.provenance.insightId).toBe('c1:ATTENTION:wait_time');
    expect(draft.provenance.insightId).not.toBe(draft.provenance.themeKey);
  });

  it('survives the intelligence changing its mind afterwards', () => {
    const before = intelligence().attention;
    if (!before) throw new Error('fixture has no attention insight');
    const frozen = actionFromInsight(before, {
      capturedAt: AGREED,
      snapshotId: null,
      snapshotLabel: null,
    });

    // Later, the theme has dropped below the naming floor entirely.
    const after = intelligence({
      themes: themes([], [theme('wait_time', 'Long waiting time', 'ISSUE', 1)], 60),
    });
    expect(after.attention).toBeNull();

    // The action still says what RepOS recommended and on what evidence.
    expect(frozen.baseline.count).toBe(9);
    expect(frozen.baseline.total).toBe(50);
    expect(frozen.provenance.recommendationText.length).toBeGreaterThan(0);
  });

  it('titles the problem, not the fix', () => {
    const insight = intelligence().attention;
    if (!insight) throw new Error('fixture has no attention insight');
    const draft = actionFromInsight(insight, {
      capturedAt: AGREED,
      snapshotId: null,
      snapshotLabel: null,
    });
    // What the business actually decides to do is a separate field, filled in
    // by a human later.
    expect(draft.title.toLowerCase()).toContain('long waiting time');
    expect(draft).not.toHaveProperty('description');
  });

  it('never prints a count without its denominator', () => {
    expect(evidenceLine(9, 50)).toBe('9 of 50 reviews (18%)');
    expect(evidenceLine(0, 12)).toBe('0 of 12 reviews (0%)');
    expect(evidenceLine(1, 1)).toBe('1 of 1 review (100%)');
    expect(evidenceLine(3, 0)).toBe('No feedback read for this period');
  });

  it('works the same way for every vertical', () => {
    for (const pack of listPacks()) {
      const intel = buildIntelligence({
        client: { id: `c-${pack.id}`, businessName: 'Test', vertical: pack.id },
        pack,
        themes: themes([], [theme('issue_x', 'Something complained about', 'ISSUE', 6)], 40),
        totalFeedback: 40,
        pulse: NO_PULSE,
        notes: [],
      });
      const insight = intel.attention;
      if (!insight) throw new Error(`no insight for ${pack.id}`);
      const draft = actionFromInsight(insight, {
        capturedAt: AGREED,
        snapshotId: null,
        snapshotLabel: null,
      });
      expect(draft.provenance.themeKey).toBe('issue_x');
      expect(draft.baseline.total).toBe(40);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the state machine is small and every state means one thing', () => {
  it('has exactly the six states, each with a stated meaning', () => {
    expect(ACTION_STATUSES).toEqual([
      'RECOMMENDED',
      'ACCEPTED',
      'DONE',
      'MEASURED',
      'PAUSED',
      'DECLINED',
    ]);
    for (const status of ACTION_STATUSES) {
      expect(STATUS_MEANINGS[status].length).toBeGreaterThan(20);
    }
  });

  it('says out loud that DONE is not proof anything worked', () => {
    expect(STATUS_MEANINGS.DONE).toMatch(/not evidence that it worked/i);
    expect(STATUS_MEANINGS.DONE).toMatch(/business says/i);
  });

  it('allows the loop: recommended, accepted, done, measured', () => {
    expect(canTransition('RECOMMENDED', 'ACCEPTED')).toBe(true);
    expect(canTransition('ACCEPTED', 'DONE')).toBe(true);
    expect(canTransition('DONE', 'MEASURED')).toBe(true);
    // Re-measured once more feedback comes in.
    expect(canTransition('MEASURED', 'MEASURED')).toBe(true);
  });

  it('allows declining and pausing', () => {
    expect(canTransition('RECOMMENDED', 'DECLINED')).toBe(true);
    expect(canTransition('ACCEPTED', 'DECLINED')).toBe(true);
    expect(canTransition('ACCEPTED', 'PAUSED')).toBe(true);
    expect(canTransition('PAUSED', 'ACCEPTED')).toBe(true);
    expect(canTransition('PAUSED', 'DECLINED')).toBe(true);
  });

  it('refuses to measure anything the business has not done', () => {
    for (const from of ['RECOMMENDED', 'ACCEPTED', 'PAUSED', 'DECLINED'] as ActionStatus[]) {
      expect(canTransition(from, 'MEASURED')).toBe(false);
    }
    expect(transitionError('ACCEPTED', 'MEASURED')).toMatch(/until the business says/i);
  });

  it('refuses to skip the human decision', () => {
    expect(canTransition('RECOMMENDED', 'DONE')).toBe(false);
    expect(canTransition('RECOMMENDED', 'MEASURED')).toBe(false);
  });

  it('leaves a declined action alone', () => {
    expect(TRANSITIONS.DECLINED).toEqual([]);
    expect(transitionError('DECLINED', 'ACCEPTED')).toMatch(/declined/i);
  });

  it('lets a mistaken "done" be taken back rather than trapping the operator', () => {
    expect(canTransition('DONE', 'ACCEPTED')).toBe(true);
  });

  it('invents no workflow state RepOS does not record', () => {
    const serialised = JSON.stringify({ ACTION_STATUSES, TRANSITIONS, STATUS_MEANINGS });
    expect(serialised).not.toMatch(
      /assigned|snoozed|overdue|escalated|waiting.for.client|in.progress|due.date/i,
    );
  });

  it('turns a decision into an ordinary minute rather than a second memory', () => {
    const minute = decisionMinute(
      {
        themeLabel: 'Long waiting time',
        description: 'Cut 6-8pm bookings to five an hour',
        recommendationText: 'Review appointment spacing.',
      },
      AGREED,
    );
    expect(minute.category).toBe('DECISION');
    expect(minute.title.length).toBeLessThanOrEqual(140);
    expect(minute.body).toContain('Cut 6-8pm bookings to five an hour');
    expect(minute.body).toContain('Review appointment spacing.');
  });

  it('is versioned so a rule change is a deliberate act', () => {
    expect(ACTION_VERSION).toBe(1);
    expect(MEASUREMENT_VERSION).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('measurement compares shares, never bare counts', () => {
  it('calls a clear fall in complaints an improvement', () => {
    // 9 of 50 (18%) before; 2 of 30 (7%) after.
    const result = measure(batch('after', '2026-05-01T00:00:00.000Z', 30, 2));

    expect(result.result).toBe('IMPROVED');
    expect(result.before.line).toBe('9 of 50 reviews (18%)');
    expect(result.after.line).toBe('2 of 30 reviews (7%)');
    expect(result.shareDelta).toBeLessThan(0);
  });

  it('calls a clear rise in complaints a worsening', () => {
    // 9 of 50 (18%) before; 12 of 30 (40%) after.
    const result = measure(batch('after', '2026-05-01T00:00:00.000Z', 30, 12));
    expect(result.result).toBe('WORSENED');
    expect(result.headline).toMatch(/more often since the change/i);
  });

  it('calls a small move no clear change', () => {
    // 18% before, 20% after: real but under the threshold.
    const result = measure(batch('after', '2026-05-01T00:00:00.000Z', 30, 6));
    expect(Math.abs(result.shareDelta ?? 0)).toBeLessThan(MIN_SHARE_MOVE);
    expect(result.result).toBe('NO_CLEAR_CHANGE');
    expect(result.headline).toMatch(/about as often as before/i);
  });

  it('reads praise the other way round', () => {
    const result = measureAction({
      pack: clinic,
      themeKey: 'doctor_care',
      themeLabel: "Doctor's care and explanation",
      sentiment: 'PRAISE',
      baseline: baseline({ count: 5, total: 50 }),
      doneAt: DONE,
      rows: batch('after', '2026-05-01T00:00:00.000Z', 30, 12, 'doctor_care'),
      now: NOW,
    });
    expect(result.result).toBe('IMPROVED');
    expect(result.headline).toMatch(/praising/i);
  });

  it('is not fooled by different sample sizes', () => {
    // Raw counts fall from 9 to 5, but the share rises from 18% to 50%.
    const result = measure(batch('after', '2026-05-01T00:00:00.000Z', 10, 5));
    expect(result.after.count).toBeLessThan(result.before.count);
    expect(result.result).toBe('WORSENED');
    expect(result.why.join(' ')).toContain('9 of 50 reviews (18%)');
    expect(result.why.join(' ')).toContain('5 of 10 reviews (50%)');
  });

  it('only counts feedback from after the change', () => {
    const rows = [
      ...batch('old', '2026-03-15T00:00:00.000Z', 20, 15),
      ...batch('new', '2026-05-01T00:00:00.000Z', 20, 1),
    ];
    const result = measure(rows);
    expect(result.after.total).toBe(20);
    expect(result.after.count).toBe(1);
    expect(result.result).toBe('IMPROVED');
  });

  it('ignores feedback that has not been read yet', () => {
    const rows = [
      ...batch('after', '2026-05-01T00:00:00.000Z', 20, 2),
      ...batch('unread', '2026-05-02T00:00:00.000Z', 40, 40).map((r) => ({
        ...r,
        analysisStatus: 'PENDING',
      })),
    ];
    const result = measure(rows);
    expect(result.after.total).toBe(20);
    expect(result.after.count).toBe(2);
  });

  it('never counts baseline feedback on the after side of its own comparison', () => {
    // A change agreed and recorded on the same morning: everything already in
    // the pile belongs to the baseline, and none of it may be counted again.
    const sameDay = new Date(2026, 2, 1, 9, 0);
    const result = measureAction({
      pack: clinic,
      themeKey: 'wait_time',
      themeLabel: 'Long waiting time',
      sentiment: 'ISSUE',
      baseline: baseline({ capturedAt: new Date(2026, 2, 1, 12, 0) }),
      doneAt: sameDay,
      rows: [
        ...batch('old', new Date(2026, 2, 1, 8, 0).toISOString(), 20, 15),
        ...batch('new', '2026-05-01T00:00:00.000Z', 20, 1),
      ],
      now: NOW,
    });

    expect(result.after.total).toBe(20);
    expect(result.after.count).toBe(1);
    expect(result.result).toBe('IMPROVED');
  });

  it('states the feedback that fell between the decision and the change', () => {
    const rows = [
      ...batch('between', '2026-03-15T00:00:00.000Z', 4, 3),
      ...batch('after', '2026-05-01T00:00:00.000Z', 20, 2),
    ];
    const result = measure(rows);
    expect(result.betweenCount).toBe(4);
    expect(result.limits.join(' ')).toMatch(/arrived between the decision and the change/i);
    // ...and it is in neither figure.
    expect(result.before.total).toBe(50);
    expect(result.after.total).toBe(20);
  });
});

// ---------------------------------------------------------------------------

describe('measurement refuses to guess', () => {
  it('says so when no feedback has arrived since the change', () => {
    const result = measure(batch('old', '2026-03-15T00:00:00.000Z', 20, 15));
    expect(result.result).toBe('INSUFFICIENT_DATA');
    expect(result.why.join(' ')).toMatch(/no new feedback/i);
    expect(result.limits.join(' ')).toMatch(/measure again/i);
  });

  it('says so when too little feedback has arrived since the change', () => {
    const result = measure(batch('after', '2026-05-01T00:00:00.000Z', 4, 0));
    expect(result.after.total).toBeLessThan(MIN_FEEDBACK_TO_MEASURE);
    expect(result.result).toBe('INSUFFICIENT_DATA');
  });

  it('does not call a theme vanishing from four reviews an improvement', () => {
    // The most flattering reading, and the least justified.
    const result = measure(batch('after', '2026-05-01T00:00:00.000Z', 4, 0));
    expect(result.result).not.toBe('IMPROVED');
    expect(result.why.join(' ')).toMatch(/too little feedback to read as an improvement/i);
    expect(result.why.join(' ')).toMatch(/nobody has mentioned it yet/i);
  });

  it('says so when the baseline itself was too thin to quote a share', () => {
    const result = measure(batch('after', '2026-05-01T00:00:00.000Z', 30, 1), {
      baseline: baseline({ count: 3, total: 6 }),
    });
    expect(result.result).toBe('INSUFFICIENT_DATA');
    expect(result.why.join(' ')).toMatch(/baseline rests on 6 read reviews/i);
  });

  it('uses the health engine floors rather than inventing its own', () => {
    expect(MIN_FEEDBACK_TO_MEASURE).toBe(10);
    expect(MIN_SHARE_MOVE).toBe(0.05);
  });
});

// ---------------------------------------------------------------------------

describe('the language never claims the change caused anything', () => {
  const results = [
    measure(batch('a', '2026-05-01T00:00:00.000Z', 30, 2)),
    measure(batch('b', '2026-05-01T00:00:00.000Z', 30, 12)),
    measure(batch('c', '2026-05-01T00:00:00.000Z', 30, 6)),
    measure(batch('d', '2026-05-01T00:00:00.000Z', 3, 0)),
  ];

  it('says "after", never "because"', () => {
    for (const result of results) {
      // Everything RepOS asserts. The limits are excluded because their whole
      // job is to say the word "caused" and then deny it.
      const claims = [result.headline, result.resultLabel, ...result.why].join(' ');
      expect(claims).not.toMatch(
        // Word boundaries matter: "improved" is a fact about feedback,
        // "proved" would be a claim about causation.
        /caused|because of (the|your) change|proved|proves|thanks to|as a result of|due to (the|your) change/i,
      );
      expect(claims).toMatch(/after the change|since the change|before the change/i);
    }
  });

  it('says plainly that it cannot show causation', () => {
    for (const result of results) {
      expect(result.limits.join(' ')).toMatch(/cannot show that the change caused/i);
    }
  });

  it('names the theme and both periods in every comparison', () => {
    const result = results[0]!;
    const prose = result.why.join(' ');
    expect(prose).toContain('Long waiting time');
    expect(prose).toContain('when the action was agreed');
    expect(prose).toContain('since the change on 1 Apr 2026');
  });

  it('states no number it cannot show the evidence for', () => {
    for (const result of results) {
      const allowed = measurementNumbers(result);
      // Dates are evidence of their own; the guard is about quantities.
      const prose = [result.headline, ...result.why, ...result.limits]
        .join(' ')
        .replace(/\d{1,2} [A-Z][a-z]{2} \d{4}/g, '');
      for (const figure of prose.match(/\d+/g) ?? []) {
        expect(allowed.has(figure), `${figure} is not backed by stored data`).toBe(true);
      }
    }
  });

  it('never promises anything about a customer', () => {
    for (const result of results) {
      const prose = [result.headline, ...result.why, ...result.limits].join(' ');
      expect(prose).not.toMatch(/guarantee|will improve|five.star|discount|refund|compensat/i);
    }
  });

  it('is stable and versioned', () => {
    const rows = batch('a', '2026-05-01T00:00:00.000Z', 30, 2);
    expect(measure(rows)).toEqual(measure(rows));
    expect(measure(rows).version).toBe(MEASUREMENT_VERSION);
  });
});
