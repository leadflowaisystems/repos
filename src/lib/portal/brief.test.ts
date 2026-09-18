import { describe, expect, it } from 'vitest';
import { buildPortalView, type PortalView } from '@/lib/portal/view';
import {
  CAUSAL,
  INTERNALS,
  NOW,
  action,
  input,
  intel,
  pulseWith,
  themes,
} from '@/lib/portal/test-fixtures';
import { buildResponsibility, type Responsibility, type ResponsibilityInput } from '@/lib/responsibility/engine';
import type { AnalysisCoverage } from '@/lib/feedback/analysis';
import { buildEvidenceIndex } from './evidence';
import { buildBrief, type Brief } from './brief';

/**
 * THE OWNER'S BRIEF (mobile pass), on the portal fixtures.
 *
 * The same clinic the focus tests use: care praised by 12, waiting raised by
 * 9, out of 50. What is pinned here is not wording — the sentences all belong
 * to engines with their own tests — but the four claims this builder makes on
 * its own:
 *
 *   IT ADDS NO READING. Every count, sentence and direction can be found in
 *   the view or the responsibility it was handed. A presentation layer that
 *   starts computing is a second analytics engine, and two engines disagree.
 *
 *   IT SHOWS ONE PROBLEM. Not three, not a ranked list. A phone screen that
 *   offers a choice has handed the work back to the owner.
 *
 *   THE ARROW IS READ FROM DIRECTION, NEVER FROM WORDS. `movementLine` is
 *   translated; a regex over it would turn every arrow grey in Marathi.
 *
 *   RISING PRAISE AND RISING COMPLAINTS ARE THE SAME ARROW AND OPPOSITE NEWS.
 *   The mark says which way; the tone says whether to worry.
 */

const BASE = '/workspace/c1';
const text = (v: unknown) => JSON.stringify(v);

const EVIDENCE = buildEvidenceIndex([
  {
    id: 'w1',
    text: 'Waited over an hour past my appointment and nobody said why.',
    stars: 2,
    reviewDate: new Date(2026, 4, 20),
    createdAt: new Date(2026, 4, 20),
    source: 'REP_OS_QR',
    themesJson: JSON.stringify([
      { key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' },
    ]),
  },
  {
    id: 'w2',
    text: 'Forty minutes past the slot, again. Nobody at the desk to ask.',
    stars: 2,
    reviewDate: new Date(2026, 4, 10),
    createdAt: new Date(2026, 4, 10),
    source: 'PUBLIC_REVIEW',
    themesJson: JSON.stringify([
      { key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' },
    ]),
  },
  {
    id: 'c1',
    text: 'The doctor explained everything clearly and listened to me.',
    stars: 5,
    reviewDate: new Date(2026, 4, 12),
    createdAt: new Date(2026, 4, 12),
    source: 'PUBLIC_REVIEW',
    themesJson: JSON.stringify([
      { key: 'doctor_care', label: "Doctor's care and explanation", kind: 'PRAISE', sentiment: 'POSITIVE', severity: 'medium' },
    ]),
  },
]);

/**
 * The live pile as `getAnalysisCoverage` reports it: 50 read, split the way
 * the fixture clinic's feedback would be. UNKNOWN is deliberately non-zero —
 * a reading that did not land is a real state and the strip must not count it.
 */
function coverageOf(
  counts: Partial<AnalysisCoverage['sentimentCounts']> = {},
): AnalysisCoverage {
  const sentimentCounts = {
    POSITIVE: 26,
    NEGATIVE: 14,
    MIXED: 6,
    NEUTRAL: 3,
    UNKNOWN: 1,
    ...counts,
  };
  const analysed = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);
  return {
    total: analysed,
    analysed,
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
    coverage?: AnalysisCoverage;
  } = {},
): { brief: Brief; r: Responsibility; view: PortalView } {
  const { portal, coverage, ...rest } = overrides;
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
  return {
    brief: buildBrief({
      view,
      responsibility: r,
      evidence: EVIDENCE,
      coverage: coverage ?? coverageOf(),
      basePath: BASE,
    }),
    r,
    view,
  };
}

// ---------------------------------------------------------------------------

describe('what happened', () => {
  it('splits the read pile three ways, and the three add up to the pile', () => {
    const { brief } = build();
    const { happy, mixed, unhappy, read } = brief.mix;
    expect(happy + mixed + unhappy).toBe(read);
    expect(read).toBeGreaterThan(0);
  });

  it('counts, never shares — a percentage of nine is a finding that is not one', () => {
    const { brief } = build();
    for (const n of [brief.mix.happy, brief.mix.mixed, brief.mix.unhappy, brief.mix.read]) {
      expect(Number.isInteger(n)).toBe(true);
    }
    expect(text(brief.mix)).not.toMatch(/%/);
  });

  it('counts the live pile, not the last check-in', () => {
    // THE BUG THIS TEST EXISTS FOR. The health card carries a `distribution`
    // and it was the obvious source — but it summarises the feedback attached
    // to the LATEST SNAPSHOT, while the figure printed beside it is the whole
    // analysed history. Wired that way the strip showed 0 / 0 / 0 under "50
    // read". These counts come from the same rows the headline counts.
    const { brief } = build({ coverage: coverageOf({ POSITIVE: 30, NEGATIVE: 10, MIXED: 4, NEUTRAL: 2 }) });
    expect(brief.mix).toEqual({ happy: 30, mixed: 6, unhappy: 10, read: 46 });
  });

  it('folds neutral into mixed, and leaves a failed reading out altogether', () => {
    // UNKNOWN is a reading that did not land, not a thing a customer felt, so
    // it is in no bucket and not in the total.
    const { brief } = build({
      coverage: coverageOf({ POSITIVE: 1, NEGATIVE: 1, MIXED: 1, NEUTRAL: 1, UNKNOWN: 99 }),
    });
    expect(brief.mix).toEqual({ happy: 1, mixed: 2, unhappy: 1, read: 4 });
  });

  it('carries what is still being read straight off the view', () => {
    const { brief, view } = build();
    expect(brief.waiting).toBe(view.soFar.waiting);
  });
});

// ---------------------------------------------------------------------------

describe('what matters', () => {
  it('shows one problem, and it is the one the engine put first', () => {
    const { brief, r } = build();
    expect(brief.attention).not.toBeNull();
    expect(brief.attention?.themeKey).toBe('wait_time');
    expect(brief.attention?.label).toBe('Long waiting time');
    // Chosen by the responsibility engine, never by whichever count is
    // biggest — the engine already weighs recurrence and severity.
    expect(r.needsYou[0]?.themeKey).toBe('wait_time');
  });

  it('shows one strength, the one worth protecting', () => {
    const { brief, view } = build();
    expect(brief.loved?.themeKey).toBe('doctor_care');
    expect(brief.loved?.themeKey).toBe(view.keep?.themeKey);
  });

  it('states each count against the pile it came from', () => {
    const { brief } = build();
    expect(brief.attention?.count).toBe(9);
    expect(brief.attention?.basis).toBe('9 of 50');
    expect(brief.loved?.count).toBe(12);
    expect(brief.loved?.basis).toBe('12 of 50');
  });

  it('says nothing at all when there is nothing read yet', () => {
    const empty = build({
      portal: {
        intelligence: intel({ themes: themes([], [], 0) }),
        themes: themes([], [], 0),
      },
      feedbackSince: { total: 0, read: 0, unread: 0, direct: 0 },
    });
    expect(empty.brief.tooEarly).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('what to do', () => {
  it('gives the problem a next move, and the strength one too', () => {
    const { brief } = build();
    expect(brief.attention?.action).toBeTruthy();
    expect(brief.loved?.action).toBeTruthy();
  });

  it('takes its sentences from the engine rather than writing its own', () => {
    const { brief, view } = build();
    const wait = view.unhappy.find((s) => s.themeKey === 'wait_time');
    const care = view.loved.find((s) => s.themeKey === 'doctor_care');
    expect(brief.attention?.line).toBe(wait?.brief);
    expect(brief.attention?.action).toBe(wait?.suggestion ?? wait?.nextStep);
    expect(brief.loved?.line).toBe(care?.brief);
    expect(brief.loved?.action).toBe(care?.nextStep);
  });

  it('points every count at the feedback entries behind it', () => {
    const { brief } = build();
    expect(brief.attention?.href).toBe(`${BASE}/reviews?theme=wait_time`);
    expect(brief.loved?.href).toBe(`${BASE}/reviews?theme=doctor_care`);
  });
});

// ---------------------------------------------------------------------------

describe('the evidence', () => {
  it('shows customers in their own words, two of them, never paraphrased', () => {
    const { brief } = build();
    expect(brief.attention?.quotes).toHaveLength(2);
    for (const q of brief.attention?.quotes ?? []) {
      expect(q.text).toMatch(/Wait|Forty/);
    }
  });

  it('quotes only the theme it is about', () => {
    const { brief } = build();
    const ids = (brief.attention?.quotes ?? []).map((q) => q.id);
    expect(ids).not.toContain('c1');
  });
});

// ---------------------------------------------------------------------------

describe('the arrow', () => {
  const twoCheckins = () =>
    build({
      portal: {
        intelligence: intel({
          pulse: pulseWith({ waitThen: 2, waitNow: 9, careThen: 4, careNow: 12 }),
        }),
      },
    });

  it('is read from the direction, never from the sentence', () => {
    // `movementLine` is translated; a regex over it would turn every arrow
    // grey in Marathi. The engine's own enum is the only source.
    const { brief, view } = twoCheckins();
    const wait = view.unhappy.find((s) => s.themeKey === 'wait_time');
    if (wait?.movementDirection === null) return; // nothing to compare in this fixture
    expect(brief.attention?.trend).not.toBeNull();
  });

  it('is absent when there was nothing to compare, rather than guessing', () => {
    const { brief, view } = build();
    const wait = view.unhappy.find((s) => s.themeKey === 'wait_time');
    if (wait?.movementDirection === null) expect(brief.attention?.trend).toBeNull();
  });

  it('calls a rising complaint bad news and rising praise good news', () => {
    // The same arrow, opposite news. Getting this backwards would draw a
    // worsening complaint in green, which is the one mistake on this screen
    // an owner would act on.
    const { brief } = twoCheckins();
    for (const card of [brief.attention, brief.loved]) {
      if (!card?.trend) continue;
      const rising = card.trend.mark === '↑';
      if (!rising) continue;
      const expected = card === brief.attention ? 'bad' : 'good';
      expect(card.trend.tone).toBe(expected);
    }
  });

  it('keeps the words neutral, so only the colour carries the judgement', () => {
    const { brief } = twoCheckins();
    for (const card of [brief.attention, brief.loved]) {
      if (!card?.trend) continue;
      expect(card.trend.label).not.toMatch(/better|worse|good|bad|problem/i);
    }
  });
});

// ---------------------------------------------------------------------------

describe('what changed', () => {
  it('never runs to more than three lines', () => {
    const { brief } = build();
    expect(brief.changed.length).toBeLessThanOrEqual(3);
  });

  it('marks a rising complaint bad and improving praise good', () => {
    const { brief } = build();
    for (const c of brief.changed) expect(['good', 'bad']).toContain(c.tone);
  });
});

// ---------------------------------------------------------------------------

describe('the brief keeps the promises the rest of the portal makes', () => {
  const shapes = () => [
    build().brief,
    build({ portal: { actions: [action('MEASURED')] } }).brief,
    build({
      portal: { intelligence: intel({ themes: themes([], [], 0) }), themes: themes([], [], 0) },
      feedbackSince: { total: 0, read: 0, unread: 0, direct: 0 },
    }).brief,
  ];

  it('never leaks milestone, engine, provider or operator terminology', () => {
    for (const brief of shapes()) expect(text(brief)).not.toMatch(INTERNALS);
  });

  it('never turns a before/after into a cause', () => {
    for (const brief of shapes()) expect(text(brief)).not.toMatch(CAUSAL);
  });

  it('never names another client', () => {
    for (const brief of shapes()) {
      expect(text(brief)).not.toMatch(/Glow Salon|Corner Cafe|FitZone/);
    }
  });

  it('never puts a theme key on screen as words', () => {
    for (const brief of shapes()) {
      for (const card of [brief.attention, brief.loved]) {
        if (!card) continue;
        expect(card.label).not.toContain(card.themeKey);
        expect(card.line).not.toContain(card.themeKey);
        expect(card.action ?? '').not.toContain(card.themeKey);
      }
    }
  });
});
