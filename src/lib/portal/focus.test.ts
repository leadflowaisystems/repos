import { describe, expect, it } from 'vitest';
import { buildPortalView, type PortalView } from '@/lib/portal/view';
import {
  CAUSAL,
  INTERNALS,
  NOW,
  action,
  clinic,
  input,
  intel,
  pulseWith,
  theme,
  themes,
} from '@/lib/portal/test-fixtures';
import { buildIntelligence } from '@/lib/intelligence/engine';
import { buildResponsibility, type Responsibility, type ResponsibilityInput } from '@/lib/responsibility/engine';
import type { SnapshotListRow } from '@/lib/snapshots/service';
import { buildEvidenceIndex } from './evidence';
import { activityFacts, buildFocus, checkinPulse, populationFrom, proofsFor, type Focus } from './focus';

/**
 * THE FOCUS (M24), on the portal fixtures.
 *
 * A clinic with a clear strength (care, 12), a clear complaint (waiting, 9),
 * and the knobs the tests turn: a measured change, two check-ins, no data at
 * all. Every claim below is a sentence an owner reads in the first ten
 * seconds, so every one is pinned.
 */

const BASE = '/workspace/c1';
const text = (v: unknown) => JSON.stringify(v);

function checkin(id: string, capturedAt: Date, feedbackCount = 20): SnapshotListRow {
  return { id, label: null, capturedAt, rating: 4.4, reviewCount: 180, feedbackCount, isBaseline: false, narrativeSource: null };
}

const EVIDENCE = buildEvidenceIndex([
  {
    id: 'w1',
    text: 'Waited over an hour past my appointment and nobody said why.',
    stars: 2,
    reviewDate: new Date(2026, 4, 20),
    createdAt: new Date(2026, 4, 20),
    source: 'REP_OS_QR',
    themesJson: JSON.stringify([{ key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' }]),
  },
  {
    id: 'w2',
    text: 'Forty minutes past the slot, again.',
    stars: 2,
    reviewDate: new Date(2026, 4, 10),
    createdAt: new Date(2026, 4, 10),
    source: 'PUBLIC_REVIEW',
    themesJson: JSON.stringify([{ key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' }]),
  },
  {
    id: 'c1',
    text: 'The doctor explained everything clearly and listened.',
    stars: 5,
    reviewDate: new Date(2026, 4, 12),
    createdAt: new Date(2026, 4, 12),
    source: 'PUBLIC_REVIEW',
    themesJson: JSON.stringify([{ key: 'doctor_care', label: "Doctor's care and explanation", kind: 'PRAISE', sentiment: 'POSITIVE', severity: 'medium' }]),
  },
]);

function build(
  overrides: Partial<ResponsibilityInput> & { portal?: Parameters<typeof input>[0] } = {},
): { focus: Focus; r: Responsibility; view: PortalView } {
  const { portal, ...rest } = overrides;
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
  return { focus: buildFocus({ responsibility: r, view, evidence: EVIDENCE, basePath: BASE }), r, view };
}

// ---------------------------------------------------------------------------

describe('the headline', () => {
  it('names the one thing worth attention, and rests it on the pile', () => {
    const { focus } = build();
    expect(focus.headline).toBe('Long waiting time is the one thing worth your attention.');
    expect(focus.basis).toBe('Based on 50 pieces of feedback we have read.');
    expect(focus.theme).toEqual({ key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE' });
    expect(focus.state).toBe('DO_NOW');
  });

  it('says an honest no when nothing needs the owner', () => {
    const quiet = build({
      portal: {
        intelligence: intel({ themes: themes([theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12)], [], 50) }),
        themes: themes([theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12)], [], 50),
      },
    });
    expect(quiet.focus.headline).toBe('Nothing needs you right now.');
    expect(quiet.focus.synthesis).toBe(
      "Customers praise your doctor's care and explanation most — 12 of the 50 pieces of feedback read. Nothing is coming up often enough to call a weakness.",
    );
    expect(quiet.focus.proofs).toEqual([]);
    expect(quiet.focus.cta?.label).toBe('See what is going well');
    expect(quiet.focus.next?.headline).toMatch(/^Nothing to do\. Keep doing what customers describe/);
  });

  it('says so when there is nothing to go on, and manufactures nothing', () => {
    const empty = buildIntelligence({
      client: { id: 'c1', businessName: 'Sunrise Dental Clinic', vertical: 'clinic' },
      pack: clinic,
      themes: themes([], [], 0),
      totalFeedback: 0,
      pulse: { available: false, reason: '', direction: 'NONE', directionLabel: '', current: null, previous: null, periodDays: null, metrics: [], notableChanges: [], sampleWarning: null },
      notes: [],
    });
    const { focus } = build({ portal: { intelligence: empty, themes: themes([], [], 0) }, feedbackSince: { total: 0, read: 0, unread: 0, direct: 0 } });
    expect(focus.headline).toBe('No customer feedback yet.');
    expect(focus.proofs).toEqual([]);
    expect(focus.cta).toBeNull();
    expect(focus.synthesis).toBeNull();
    expect(focus.next).toBeNull();
  });
});

describe('the proofs', () => {
  it('opens the share into the count and three customers in their words', () => {
    const { focus } = build();
    const share = focus.proofs.find((p) => p.key === 'share');
    expect(share?.label).toBe('18% of feedback');
    expect(share?.detail).toBe('9 of the 50 pieces of feedback Headway has read mention it.');
    expect(share?.quotes.map((q) => q.id)).toEqual(['w1', 'w2']);
    expect(share?.seeAll).toEqual({ label: 'See all 9', href: `${BASE}/reviews?theme=wait_time` });
    expect(share?.tone).toBe('bad');
  });

  it('shows the two piles of a measured change, and their reading, without a cause', () => {
    const { focus } = build({ portal: { actions: [action('MEASURED', 'WORSENED')] } });
    const outcome = focus.proofs.find((p) => p.key === 'outcome');
    expect(outcome?.label).toBe('More often after your change');
    expect(outcome?.tone).toBe('bad');
    expect(outcome?.population?.before).toMatchObject({ count: 9, total: 50, share: '18%' });
    expect(outcome?.population?.after).toMatchObject({ count: 12, total: 30, share: '40%' });
    expect(outcome?.population?.reading).toBe('More often after the change');
    expect(outcome?.population?.caveat).toMatch(/cannot show that the change caused/);
    expect(text(focus)).not.toMatch(CAUSAL);
    expect(text(focus)).not.toMatch(INTERNALS);
  });

  it('reads a helped change as less often, in green, and shows it when nothing needs the owner', () => {
    const { focus, view } = build({ portal: { actions: [action('MEASURED', 'IMPROVED')] } });
    // A change that helped needs nobody; the block says so and still shows the evidence.
    expect(focus.headline).toBe('Nothing needs you right now.');
    expect(focus.synthesis).toMatch(/Long waiting time is still mentioned, but it has come up less often since your change\.$/);
    expect(focus.cta).toEqual({ label: 'See what changed', href: `${BASE}/analysis?open=wait_time#signal-wait_time` });
    const outcome = focus.proofs.find((p) => p.key === 'outcome');
    expect(outcome?.label).toBe('Less often after your change');
    expect(outcome?.tone).toBe('good');
    expect(outcome?.population?.reading).toBe('Less often after the change');
    const direct = proofsFor(view.unhappy.find((s) => s.themeKey === 'wait_time')!, view, EVIDENCE, BASE);
    expect(direct.map((p) => p.key)).toEqual(['share', 'outcome']);
  });

  it('shows movement only where two check-ins were actually compared', () => {
    const none = build();
    expect(none.focus.proofs.some((p) => p.key === 'movement')).toBe(false);

    const compared = build({
      portal: { intelligence: intel({ pulse: pulseWith({ waitThen: 3, waitNow: 9 }) }) },
      checkins: [checkin('s2', new Date(2026, 4, 1)), checkin('s1', new Date(2026, 2, 1))],
    });
    const movement = compared.focus.proofs.find((p) => p.key === 'movement');
    expect(movement?.label).toBe('More at your latest check-in');
    expect(movement?.comparison).toBe('3 → 9 mentions at your last two check-ins');
    expect(movement?.tone).toBe('bad');
  });

  it('never shows more than three, and the share always comes first', () => {
    const { focus } = build({
      portal: { intelligence: intel({ pulse: pulseWith({ waitThen: 3, waitNow: 9 }) }), actions: [action('MEASURED', 'WORSENED')] },
    });
    expect(focus.proofs.length).toBeLessThanOrEqual(3);
    expect(focus.proofs[0]?.key).toBe('share');
  });
});

describe('what Headway wants you to know, and the next step', () => {
  it('sets the strength against the complaint in one breath', () => {
    const { focus } = build();
    expect(focus.synthesis).toBe(
      "Customers are not unhappy about your doctor's care and explanation — 12 praised it. What they raise most is long waiting time.",
    );
    // The quotes live on the share chip and nowhere else in the block.
    expect('evidence' in focus).toBe(false);
    const share = focus.proofs.find((p) => p.key === 'share');
    expect(share?.seeAll).toEqual({ label: 'See all 9', href: `${BASE}/reviews?theme=wait_time` });
  });

  it("recommends the pack's own advice when nothing has been tried", () => {
    const { focus } = build();
    expect(focus.next?.headline).toBe(clinic.issueTaxonomy.find((t) => t.key === 'wait_time')?.action);
    expect(focus.next?.watching).toMatch(/^Headway is checking whether long waiting time/);
    expect(focus.cta).toEqual({
      label: 'See everything on long waiting time',
      href: `${BASE}/analysis?open=wait_time#signal-wait_time`,
    });
  });

  it('asks the owner to look again, not to undo, when a change read worse', () => {
    const { focus } = build({ portal: { actions: [action('MEASURED', 'WORSENED')] } });
    expect(focus.headline).toBe('Long waiting time is the one thing worth your attention.');
    expect(focus.synthesis).toMatch(/and it has come up more since your change\.$/);
    expect(focus.next?.headline).toBe('Check what else changed before undoing anything.');
    // The suggestion frozen on the action at the time, not the pack's current wording.
    expect(focus.next?.detail).toBe('The original suggestion still stands: Publish a realistic slot length.');
    expect(focus.next?.why[0]).toBe('Customers are mentioning long waiting time more often since the change.');
  });

  it('carries a follow-up on an agreed change as the next step', () => {
    const { focus, r } = build({ portal: { actions: [action('ACCEPTED')] } });
    expect(r.needsYou[0]?.state).toBe('FOLLOW_UP');
    expect(focus.headline).toBe('The change you agreed for long waiting time has not been made yet.');
    expect(focus.next?.headline).toMatch(/^Tell us once the change is in place/);
  });
});

describe('the check-in pulse', () => {
  it('counts what needs you, what needs watching and what held steady, in words', () => {
    const { r, view } = build({
      portal: { intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 9, careThen: 4, careNow: 4 }) }) },
      checkins: [checkin('s2', new Date(2026, 4, 1)), checkin('s1', new Date(2026, 2, 1))],
    });
    const pulse = checkinPulse(r, view, true);
    expect(pulse.sentence).toBe('One thing needs you. One thing needs watching. Two things are holding steady.');
    expect(pulse.blocks.map((b) => b.kind)).toEqual(['DO', 'PROTECT', 'WATCH']);
    expect(pulse.blocks[0]?.signal?.themeKey).toBe('wait_time');
    expect(pulse.blocks[1]?.signal?.themeKey).toBe('doctor_care');
    expect(pulse.blocks[2]?.signal?.themeKey).toBe('billing_clarity');
  });

  it('does not claim steadiness before two check-ins exist', () => {
    const { r, view } = build();
    const pulse = checkinPulse(r, view, false);
    expect(pulse.sentence).toBe('One thing needs you. One thing needs watching. A second check-in will show what is holding steady.');
  });

  it('says nothing needs you when nothing does', () => {
    const { r, view } = build({
      portal: {
        intelligence: intel({ themes: themes([theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12)], [], 50) }),
        themes: themes([theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12)], [], 50),
      },
    });
    expect(checkinPulse(r, view, false).sentence).toMatch(/^Nothing needs you\./);
  });
});

describe('the account activity', () => {
  it('counts only what the workspace already states', () => {
    const { r, view } = build({ portal: { actions: [action('MEASURED', 'WORSENED')] } });
    expect(activityFacts(view, r, BASE)).toEqual([
      { label: 'Pieces of feedback read', value: '50', href: `${BASE}/reviews` },
      { label: 'Recurring signals', value: '4', href: `${BASE}/analysis` },
      { label: 'Active issue', value: '1', href: BASE },
      { label: 'Improvement compared', value: '1', href: `${BASE}/improvements` },
    ]);
  });

  it('is empty rather than padded before anything arrives', () => {
    const empty = buildIntelligence({
      client: { id: 'c1', businessName: 'Sunrise Dental Clinic', vertical: 'clinic' },
      pack: clinic,
      themes: themes([], [], 0),
      totalFeedback: 0,
      pulse: { available: false, reason: '', direction: 'NONE', directionLabel: '', current: null, previous: null, periodDays: null, metrics: [], notableChanges: [], sampleWarning: null },
      notes: [],
    });
    const { r, view } = build({ portal: { intelligence: empty, themes: themes([], [], 0) }, feedbackSince: { total: 0, read: 0, unread: 0, direct: 0 } });
    expect(activityFacts(view, r, BASE)).toEqual([]);
  });
});

describe('the population behind a before/after', () => {
  it("is read from the engine's own lines, never recounted", () => {
    const measured = action('MEASURED', 'NO_CLEAR_CHANGE');
    const view = buildPortalView(input({ actions: [measured] }));
    const outcome = view.actions[0]?.outcome;
    expect(outcome).not.toBeNull();
    const population = populationFrom(outcome!, view.actions[0] ?? null);
    expect(population?.before).toMatchObject({ count: 9, total: 50, share: '18%' });
    expect(population?.after).toMatchObject({ count: 6, total: 30, share: '20%' });
    expect(population?.reading).toBe('No clear change after the change');
    expect(population?.tone).toBe('neutral');
    expect(population?.changeDate?.getTime()).toBe(new Date(2026, 3, 1).getTime());
  });
});
