import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import type {
  DimensionSummaryRow,
  ThemeSummary,
  ThemeSummaryRow,
} from '@/lib/feedback/analysis';
import type { Pulse, PulsePeriod } from '@/lib/health/health';
import {
  HEADLINE_LIMIT,
  INTELLIGENCE_VERSION,
  MIN_CHANGE_TO_REPORT,
  MIN_MENTIONS_TO_NAME,
  MIN_PERIOD_FEEDBACK_TO_COMPARE,
  SIGNAL_WEIGHTS,
  buildIntelligence,
  comparisonWindowFrom,
  insightId,
  intelligenceNumbers,
  movementFor,
  overallTrendFrom,
  type ClientIntelligence,
  type Insight,
  type IntelligenceInput,
  type RecordedStep,
} from './engine';

_resetPackCache();

const clinic = getPackOrFallback('clinic');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function theme(
  key: string,
  label: string,
  kind: 'PRAISE' | 'ISSUE',
  count: number,
  severity: 'low' | 'medium' | 'high' = 'medium',
): ThemeSummaryRow {
  return {
    key,
    label,
    kind,
    severity,
    count,
    itemIds: Array.from({ length: count }, (_, i) => `${key}-item-${i}`),
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

/** A snapshot period as the pulse engine builds one. */
function period(
  id: string,
  label: string,
  feedbackCount: number,
  issues: Array<[string, string, number]> = [],
  praises: Array<[string, string, number]> = [],
): PulsePeriod {
  const counts = (rows: Array<[string, string, number]>) =>
    rows.map(([key, themeLabel, count]) => ({
      key,
      label: themeLabel,
      count,
      severity: 'high' as const,
      qualifies: count >= MIN_MENTIONS_TO_NAME,
    }));

  return {
    snapshotId: id,
    label,
    capturedAt: new Date('2026-03-01T00:00:00.000Z'),
    feedbackCount,
    distribution: {
      total: feedbackCount,
      counts: { POSITIVE: 0, NEGATIVE: 0, MIXED: 0, NEUTRAL: 0, UNKNOWN: 0 },
      shares: null,
      reliable: false,
      note: '',
    },
    rating: null,
    reviewCount: null,
    unansweredCount: null,
    topIssues: counts(issues),
    topPraises: counts(praises),
  };
}

const ONE_SNAPSHOT: Pulse = {
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

function pulse(
  previous: PulsePeriod,
  current: PulsePeriod,
  direction: Pulse['direction'] = 'STABLE',
): Pulse {
  return {
    ...ONE_SNAPSHOT,
    available: true,
    reason: '',
    direction,
    directionLabel: direction,
    previous,
    current,
    periodDays: 30,
  };
}

function input(overrides: Partial<IntelligenceInput> = {}): IntelligenceInput {
  return {
    client: { id: 'c1', businessName: 'Sunrise Dental Clinic', vertical: 'clinic' },
    pack: clinic,
    themes: themes(
      [
        theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12),
        theme('clean_facility', 'Clean, well-kept clinic', 'PRAISE', 4),
      ],
      [
        theme('wait_time', 'Long waiting time', 'ISSUE', 7, 'high'),
        theme('billing_clarity', 'Unclear or unexpected billing', 'ISSUE', 4, 'medium'),
      ],
      40,
    ),
    totalFeedback: 40,
    pulse: ONE_SNAPSHOT,
    notes: [],
    ...overrides,
  };
}

function build(overrides: Partial<IntelligenceInput> = {}): ClientIntelligence {
  return buildIntelligence(input(overrides));
}

function themeIn(list: Insight[], key: string): Insight {
  const found = list.find((i) => i.themeKey === key);
  if (!found) throw new Error(`no insight for ${key}`);
  return found;
}

// ---------------------------------------------------------------------------

describe('nothing is named without enough evidence behind it', () => {
  it('names a theme only once it clears the mention floor', () => {
    const intel = build({
      themes: themes(
        [theme('doctor_care', "Doctor's care", 'PRAISE', MIN_MENTIONS_TO_NAME)],
        [theme('wait_time', 'Long waiting time', 'ISSUE', MIN_MENTIONS_TO_NAME - 1)],
        20,
      ),
    });

    expect(intel.loved.map((i) => i.themeKey)).toEqual(['doctor_care']);
    expect(intel.unhappy).toEqual([]);
    expect(intel.attention).toBeNull();
  });

  it('says out loud what was mentioned once or twice rather than hiding it', () => {
    const intel = build({
      themes: themes(
        [],
        [
          theme('wait_time', 'Long waiting time', 'ISSUE', 2),
          theme('billing_clarity', 'Billing', 'ISSUE', 1),
        ],
        20,
      ),
    });

    expect(intel.unhappy).toEqual([]);
    expect(intel.limits.join(' ')).toMatch(/2 other things were mentioned once or twice/);
  });

  it('keeps the feedback ids behind every count', () => {
    const intel = build();
    for (const insight of [...intel.loved, ...intel.unhappy]) {
      expect(insight.evidence.itemIds.length).toBe(insight.evidence.count);
      expect(insight.evidence.itemIds.every((id) => id.startsWith(insight.themeKey))).toBe(
        true,
      );
    }
  });

  it('states the denominator with every count, never a bare number', () => {
    const intel = build();
    const insight = themeIn(intel.unhappy, 'wait_time');
    expect(insight.evidence.outOf).toBe(40);
    expect(insight.detail).toContain('7 mentions');
    expect(insight.detail).toContain('40 reviews');
    expect(insight.confidenceReason).toContain('40');
  });

  it('marks confidence honestly on a small pile', () => {
    const big = build();
    const small = build({
      themes: themes([], [theme('wait_time', 'Long waiting time', 'ISSUE', 3)], 6),
      totalFeedback: 6,
    });

    expect(themeIn(big.unhappy, 'wait_time').confidence).toBe('STRONG');
    expect(themeIn(small.unhappy, 'wait_time').confidence).toBe('EARLY');
    expect(small.evidence.enough).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('the ranking explains itself', () => {
  it('is the sum of its named signals and nothing else', () => {
    const intel = build();
    for (const insight of [...intel.loved, ...intel.unhappy]) {
      expect(insight.rank).toBe(
        insight.signals.reduce((sum, signal) => sum + signal.weight, 0),
      );
      for (const signal of insight.signals) {
        expect(signal.weight).toBeGreaterThan(0);
        expect(signal.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('lets a serious complaint outrank a louder harmless one', () => {
    const intel = build({
      themes: themes(
        [],
        [
          theme('infection_control', 'Hygiene and infection control', 'ISSUE', 3, 'high'),
          theme('parking', 'Parking / access', 'ISSUE', 20, 'low'),
        ],
        60,
      ),
      totalFeedback: 60,
    });

    expect(intel.unhappy[0]?.themeKey).toBe('infection_control');
    expect(intel.attention?.themeKey).toBe('infection_control');
    // ...and the reason the operator reads says why, in the pack's terms.
    expect(intel.attention?.signals.map((s) => s.key)).toContain('severity_high');
  });

  it('still lets volume decide between complaints of equal seriousness', () => {
    const intel = build({
      themes: themes(
        [],
        [
          theme('wait_time', 'Long waiting time', 'ISSUE', 9, 'medium'),
          theme('billing_clarity', 'Billing', 'ISSUE', 3, 'medium'),
        ],
        40,
      ),
    });
    expect(intel.unhappy[0]?.themeKey).toBe('wait_time');
  });

  it('caps how far volume alone can carry a theme', () => {
    const modest = build({
      themes: themes([], [theme('parking', 'Parking', 'ISSUE', 10, 'low')], 60),
    });
    const enormous = build({
      themes: themes([], [theme('parking', 'Parking', 'ISSUE', 200, 'low')], 400),
    });
    expect(themeIn(modest.unhappy, 'parking').rank).toBe(
      themeIn(enormous.unhappy, 'parking').rank,
    );
    expect(SIGNAL_WEIGHTS.mention_cap).toBeLessThan(SIGNAL_WEIGHTS.severity_high);
  });

  it('uses no score, model or probability anywhere in the object', () => {
    const serialised = JSON.stringify(build());
    expect(serialised).not.toMatch(/probability|confidence_score|\bmodel\b|prediction|ai_/i);
  });

  it('breaks a tie by name so the order never shuffles between refreshes', () => {
    const intel = build({
      themes: themes(
        [],
        [
          theme('zebra_issue', 'Zebra issue', 'ISSUE', 5, 'medium'),
          theme('alpha_issue', 'Alpha issue', 'ISSUE', 5, 'medium'),
        ],
        40,
      ),
    });
    expect(intel.unhappy.map((i) => i.themeLabel)).toEqual(['Alpha issue', 'Zebra issue']);
  });

  it('is stable: the same stored rows produce the same object', () => {
    expect(build()).toEqual(build());
    expect(build().version).toBe(INTELLIGENCE_VERSION);
    expect(build().loved.every((i) => i.version === INTELLIGENCE_VERSION)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('a trend is never manufactured', () => {
  it('reports insufficient data from a single snapshot, never "stable"', () => {
    const intel = build();
    expect(intel.overallTrend).toBe('INSUFFICIENT_DATA');
    expect(intel.overallTrendNote).not.toMatch(/stable|steady/i);
    expect(intel.window.available).toBe(false);
    expect(intel.changing).toEqual([]);
  });

  it('refuses to compare two check-ins that hold almost no feedback', () => {
    const window = comparisonWindowFrom(
      pulse(period('s1', '1 Feb', 2), period('s2', '1 Mar', 2)),
    );
    expect(window.available).toBe(false);
    expect(window.reason).toContain(String(MIN_PERIOD_FEEDBACK_TO_COMPARE));
    expect(window.reason).toContain('1 Feb');
    expect(window.reason).toContain('1 Mar');
  });

  it('calls a complaint that grew worsening, and one that shrank improving', () => {
    const worse = movementFor(
      pulse(
        period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 2]]),
        period('s2', '1 Mar', 20, [['wait_time', 'Long waiting time', 8]]),
      ),
      comparisonWindowFrom(
        pulse(
          period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 2]]),
          period('s2', '1 Mar', 20, [['wait_time', 'Long waiting time', 8]]),
        ),
      ),
      'ISSUE',
      'wait_time',
      'Long waiting time',
    );
    expect(worse.state).toBe('WORSENING');
    expect(worse.delta).toBe(6);
  });

  it('reads praise the other way round: more praise is improving', () => {
    const p = pulse(
      period('s1', '1 Feb', 20, [], [['doctor_care', "Doctor's care", 2]]),
      period('s2', '1 Mar', 20, [], [['doctor_care', "Doctor's care", 9]]),
    );
    const movement = movementFor(
      p,
      comparisonWindowFrom(p),
      'PRAISE',
      'doctor_care',
      "Doctor's care",
    );
    expect(movement.state).toBe('IMPROVING');
  });

  it('calls a small movement stable rather than a trend', () => {
    const p = pulse(
      period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 4]]),
      period('s2', '1 Mar', 20, [['wait_time', 'Long waiting time', 5]]),
    );
    const movement = movementFor(
      p,
      comparisonWindowFrom(p),
      'ISSUE',
      'wait_time',
      'Long waiting time',
    );
    expect(Math.abs(movement.delta ?? 0)).toBeLessThan(MIN_CHANGE_TO_REPORT);
    expect(movement.state).toBe('STABLE');
    expect(movement.available).toBe(true);
  });

  it('will not call two mentions dropping to none a direction', () => {
    // A big percentage of almost nothing. The naming floor applies to movement
    // for the same reason it applies to themes.
    const p = pulse(
      period('s1', '1 Feb', 20, [], [['staff', 'Friendly staff', 2]]),
      period('s2', '1 Mar', 20, [], [['staff', 'Friendly staff', 0]]),
    );
    const movement = movementFor(
      p,
      comparisonWindowFrom(p),
      'PRAISE',
      'staff',
      'Friendly staff',
    );
    expect(movement.available).toBe(true);
    expect(movement.delta).toBe(-2);
    expect(movement.state).toBe('INSUFFICIENT_DATA');
    expect(movement.note).toMatch(/too few either way/i);

    // ...and it never reaches "what is changing".
    const intel = build({
      pulse: p,
      themes: themes([theme('staff', 'Friendly staff', 'PRAISE', 4)], [], 30),
    });
    expect(intel.changing).toEqual([]);
  });

  it('says the movement once, not once per label', () => {
    const p = pulse(
      period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 9]]),
      period('s2', '12 Mar', 20, [['wait_time', 'Long waiting time', 3]]),
      'IMPROVING',
    );
    const change = themeIn(build({ pulse: p }).changing, 'wait_time');

    // The headline names the theme, so the sentence under it must not repeat it.
    expect(change.headline.toLowerCase()).toContain('long waiting time');
    expect(change.detail).toBe(change.movement.pointNote);
    expect(change.detail).not.toContain('Long waiting time');
    // The standalone form still carries the label, for use on its own.
    expect(change.movement.note).toContain('Long waiting time');
  });

  it('does not call a theme steady when neither check-in mentioned it', () => {
    const p = pulse(period('s1', '1 Feb', 20), period('s2', '1 Mar', 20));
    const movement = movementFor(
      p,
      comparisonWindowFrom(p),
      'ISSUE',
      'never_raised',
      'Something else',
    );
    expect(movement.available).toBe(false);
    expect(movement.state).toBe('INSUFFICIENT_DATA');
    expect(movement.note).toMatch(/has not come up/i);
  });

  it('takes the overall verdict from the pulse engine, which reads shares', () => {
    const window = comparisonWindowFrom(
      pulse(period('s1', '1 Feb', 20), period('s2', '1 Mar', 20)),
    );
    for (const [direction, expected] of [
      ['IMPROVING', 'IMPROVING'],
      ['DECLINING', 'WORSENING'],
      ['STABLE', 'STABLE'],
      ['NONE', 'INSUFFICIENT_DATA'],
    ] as const) {
      const p = pulse(period('s1', '1 Feb', 20), period('s2', '1 Mar', 20), direction);
      expect(overallTrendFrom(p, window).state).toBe(expected);
    }
  });

  it('never lets a jump in feedback volume read as customers being happier', () => {
    // Same complaint share, three times the feedback. The pulse engine reads
    // proportions, so it reports no direction; the engine must not invent one
    // from the mention counts having risen.
    const p = pulse(
      period('s1', '1 Feb', 10, [['wait_time', 'Long waiting time', 2]]),
      period('s2', '1 Mar', 30, [['wait_time', 'Long waiting time', 6]]),
      'STABLE',
    );
    const intel = build({ pulse: p });

    expect(intel.overallTrend).toBe('STABLE');
    expect(intel.overallTrendNote).not.toMatch(/improv|better/i);
    // The movement is still reported — with the caveat attached, never silently.
    expect(intel.window.volumeCaveat).toBeTruthy();
    expect(intel.limits.join(' ')).toMatch(/simply more feedback/);
  });
});

// ---------------------------------------------------------------------------

describe('before and after always names both points', () => {
  const p = pulse(
    period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 9]]),
    period('s2', '12 Mar', 22, [['wait_time', 'Long waiting time', 3]]),
    'IMPROVING',
  );

  it('names what changed, the direction, both check-ins and both counts', () => {
    const intel = build({ pulse: p });
    const change = themeIn(intel.changing, 'wait_time');

    expect(change.headline).toContain('Fewer customers');
    expect(change.headline.toLowerCase()).toContain('long waiting time');
    expect(change.movement.note).toContain('Long waiting time');
    expect(change.movement.note).toContain('1 Feb');
    expect(change.movement.note).toContain('12 Mar');
    expect(change.movement.note).toContain('9');
    expect(change.movement.note).toContain('3');
    expect(change.movement.note).toContain('down 6');
  });

  it('says which two check-ins the whole comparison is between', () => {
    const intel = build({ pulse: p });
    expect(intel.window.note).toContain('1 Feb');
    expect(intel.window.note).toContain('12 Mar');
    expect(intel.window.previousSnapshotId).toBe('s1');
    expect(intel.window.currentSnapshotId).toBe('s2');
    expect(intel.window.periodDays).toBe(30);
  });

  it('carries the snapshot references on every insight that compares anything', () => {
    const intel = build({ pulse: p });
    for (const insight of intel.changing) {
      expect(insight.window.previousSnapshotId).toBe('s1');
      expect(insight.window.currentSnapshotId).toBe('s2');
    }
  });

  it('reports nothing as changing when nothing moved by enough', () => {
    const flat = pulse(
      period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 4]]),
      period('s2', '12 Mar', 20, [['wait_time', 'Long waiting time', 5]]),
    );
    expect(build({ pulse: flat }).changing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('three signals at most, and honest when there are fewer', () => {
  it('never leads with more than three', () => {
    const intel = build({
      themes: themes(
        [
          theme('doctor_care', "Doctor's care", 'PRAISE', 12),
          theme('clean_facility', 'Clean clinic', 'PRAISE', 9),
          theme('short_wait', 'Little waiting', 'PRAISE', 7),
        ],
        [
          theme('wait_time', 'Long waiting time', 'ISSUE', 8, 'high'),
          theme('billing_clarity', 'Billing', 'ISSUE', 6, 'medium'),
          theme('parking', 'Parking', 'ISSUE', 5, 'low'),
        ],
        60,
      ),
      totalFeedback: 60,
    });
    expect(intel.headline.length).toBe(HEADLINE_LIMIT);
    expect(intel.headlineNote).not.toMatch(/only/i);
  });

  it('says "only 2 clear signals" rather than padding to three', () => {
    const intel = build({
      themes: themes(
        [theme('doctor_care', "Doctor's care", 'PRAISE', 12)],
        [theme('wait_time', 'Long waiting time', 'ISSUE', 5, 'high')],
        30,
      ),
      totalFeedback: 30,
    });
    expect(intel.headline.length).toBe(2);
    expect(intel.headlineNote).toContain('Only 2 clear signals');
  });

  it('never shows the same theme twice in the headline', () => {
    const p = pulse(
      period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 2]]),
      period('s2', '12 Mar', 20, [['wait_time', 'Long waiting time', 9]]),
      'DECLINING',
    );
    const intel = build({ pulse: p });
    const keys = intel.headline.map((i) => i.themeKey);
    expect(new Set(keys).size).toBe(keys.length);
    // It both needs attention and is getting worse: one headline, not two.
    expect(intel.headline[0]?.themeKey).toBe('wait_time');
    expect(intel.headline[0]?.kind).toBe('ATTENTION');
  });

  it('leads with the complaint that needs attention when there is one', () => {
    const intel = build();
    expect(intel.headline[0]?.kind).toBe('ATTENTION');
    expect(intel.headline[0]?.themeKey).toBe(intel.attention?.themeKey);
  });
});

// ---------------------------------------------------------------------------

describe('the empty and low-data states are honest', () => {
  const empty = () =>
    build({ themes: themes([], [], 0), totalFeedback: 0, pulse: ONE_SNAPSHOT });

  it('says nothing at all rather than something weak', () => {
    const intel = empty();
    expect(intel.headline).toEqual([]);
    expect(intel.loved).toEqual([]);
    expect(intel.unhappy).toEqual([]);
    expect(intel.changing).toEqual([]);
    expect(intel.attention).toBeNull();
    expect(intel.overallTrend).toBe('INSUFFICIENT_DATA');
    expect(intel.headlineNote).toMatch(/nothing has been said often enough/i);
  });

  it('explains what is missing instead of leaving a blank panel', () => {
    expect(empty().limits.join(' ')).toMatch(/no feedback has been read yet/i);
  });

  it('counts feedback that has been stored but not read as not counted', () => {
    const intel = build({
      themes: themes([], [theme('wait_time', 'Long waiting time', 'ISSUE', 4)], 10),
      totalFeedback: 25,
    });
    expect(intel.evidence.unread).toBe(15);
    expect(intel.limits.join(' ')).toMatch(/15 more pieces of feedback are being read now and are not counted above yet/);
  });

  it('warns that a small pile is an early signal, not a conclusion', () => {
    const intel = build({
      themes: themes([], [theme('wait_time', 'Long waiting time', 'ISSUE', 3)], 8),
      totalFeedback: 8,
    });
    expect(intel.limits.join(' ')).toMatch(/early signal, not a conclusion/i);
    expect(intel.evidence.tier).toBe('INSUFFICIENT');
  });

  it('explains why there is no comparison rather than showing an empty section', () => {
    expect(build().limits.join(' ')).toMatch(/two snapshots are needed/i);
  });
});

// ---------------------------------------------------------------------------

describe('operator notes are context, never customer evidence', () => {
  const notes: RecordedStep[] = [
    {
      id: 'm1',
      occurredAt: new Date('2026-02-20T00:00:00.000Z'),
      title: 'Owner agreed to add a second chair on Saturdays',
      category: 'DECISION',
    },
  ];

  it('keeps them out of every count and every insight', () => {
    const intel = build({ notes });

    expect(intel.contextNotes.length).toBe(1);
    for (const insight of [...intel.loved, ...intel.unhappy, ...intel.changing]) {
      expect(insight.evidence.itemIds).not.toContain('m1');
    }
    expect(intel.evidence.analysed).toBe(40);
    expect(JSON.stringify(intel.headline)).not.toContain('second chair');
  });

  it('labels them as operator memory, not something a customer said', () => {
    const note = build({ notes }).contextNotes[0];
    expect(note?.source).toBe('OPERATOR_NOTE');
    expect(note?.label).toMatch(/not something a customer said/i);
  });

  it('never claims a recorded step worked', () => {
    const serialised = JSON.stringify(build({ notes }));
    expect(serialised).not.toMatch(/worked|resolved|fixed it|because you|thanks to your/i);
  });
});

// ---------------------------------------------------------------------------

describe('one client can never see another', () => {
  it('namespaces every insight id by client', () => {
    const a = build();
    const b = buildIntelligence(
      input({
        client: { id: 'c2', businessName: 'Glow Salon', vertical: 'salon' },
        pack: getPackOrFallback('salon'),
      }),
    );

    expect(a.unhappy.every((i) => i.id.startsWith('c1:'))).toBe(true);
    expect(b.unhappy.every((i) => i.id.startsWith('c2:'))).toBe(true);
    expect(a.unhappy.map((i) => i.id)).not.toEqual(b.unhappy.map((i) => i.id));
    expect(insightId('c1', 'ATTENTION', 'wait_time')).toBe('c1:ATTENTION:wait_time');
  });

  it('carries the owning client on every insight', () => {
    const intel = build();
    for (const insight of [...intel.loved, ...intel.unhappy, ...intel.changing]) {
      expect(insight.clientId).toBe('c1');
    }
    expect(intel.attention?.clientId).toBe('c1');
  });
});

// ---------------------------------------------------------------------------

describe('it works the same way for every vertical', () => {
  it('produces insights for all seven packs with no per-vertical code', () => {
    for (const pack of listPacks()) {
      const intel = buildIntelligence(
        input({
          client: { id: `c-${pack.id}`, businessName: `Test ${pack.id}`, vertical: pack.id },
          pack,
          themes: themes(
            [theme('praise_x', 'Something praised', 'PRAISE', 8)],
            [theme('issue_x', 'Something complained about', 'ISSUE', 6, 'high')],
            40,
          ),
        }),
      );
      expect(intel.verticalLabel).toBe(pack.label);
      expect(intel.attention?.themeKey).toBe('issue_x');
      expect(intel.loved[0]?.themeKey).toBe('praise_x');
      expect(intel.attention?.signals.map((s) => s.reason).join(' ')).toContain(
        pack.label.toLowerCase(),
      );
    }
  });

  it('takes advice from the pack rather than writing its own', () => {
    const intel = build();
    const packAction = clinic.issueTaxonomy.find((t) => t.key === 'wait_time')?.action;
    expect(intel.attention?.recommendation).toBe(packAction);
  });

  it('offers no advice when the pack has none for that theme', () => {
    const intel = build({
      themes: themes([], [theme('made_up_theme', 'Something', 'ISSUE', 5)], 30),
    });
    expect(intel.attention?.recommendation).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('what the action loop will be able to read, and what it will not', () => {
  it('exposes a stable id, the evidence and the comparison for each insight', () => {
    const p = pulse(
      period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 2]]),
      period('s2', '12 Mar', 20, [['wait_time', 'Long waiting time', 8]]),
      'DECLINING',
    );
    const first = build({ pulse: p });
    const again = build({ pulse: p });

    const a = themeIn(first.changing, 'wait_time');
    const b = themeIn(again.changing, 'wait_time');
    expect(a.id).toBe(b.id);

    for (const key of [
      'id',
      'clientId',
      'themeKey',
      'sentiment',
      'evidence',
      'movement',
      'window',
      'signals',
      'confidence',
      'version',
    ] as const) {
      expect(a).toHaveProperty(key);
    }
  });

  it('tracks no action state, because nothing in RepOS records one yet', () => {
    const serialised = JSON.stringify(build());
    expect(serialised).not.toMatch(
      /"(status|completed|done|assignee|dueDate|snoozed|resolvedAt|outcome|reminder)"/i,
    );
  });

  it('only states numbers that came from the stored rows', () => {
    const p = pulse(
      period('s1', '1 Feb', 20, [['wait_time', 'Long waiting time', 2]]),
      period('s2', '12 Mar', 24, [['wait_time', 'Long waiting time', 8]]),
      'DECLINING',
    );
    const intel = build({ pulse: p });
    const numbers = intelligenceNumbers(intel);

    expect(numbers.has('40')).toBe(true); // the read pile
    expect(numbers.has('20')).toBe(true); // the previous check-in
    expect(numbers.has('24')).toBe(true); // the current check-in
    expect(numbers.has('8')).toBe(true); // the current mention count
    expect(numbers.has('999')).toBe(false);
  });
});
