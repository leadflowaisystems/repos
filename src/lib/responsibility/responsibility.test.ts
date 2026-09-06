import { describe, expect, it } from 'vitest';
import { getPackOrFallback } from '@/lib/packs';
import { buildPortalView, type PortalView } from '@/lib/portal/view';
import {
  CAUSAL,
  INTERNALS,
  NOW,
  action,
  input,
  intel,
  pulseAfterChange,
  pulseWith,
  theme,
  themes,
  told,
} from '@/lib/portal/test-fixtures';
import type { ActionProgress } from '@/lib/improve/service';
import type { SnapshotListRow } from '@/lib/snapshots/service';
import {
  RESPONSIBILITY_VERSION,
  STATE_LABELS,
  buildResponsibility,
  responsibilityNumbers,
  type FeedbackSince,
  type Responsibility,
  type ResponsibilityInput,
} from './engine';

/**
 * THE RESPONSIBILITY LAYER (M15), on the portal fixtures.
 *
 * A clinic with a clear strength (care, 12), a clear complaint (waiting, 9),
 * a secondary complaint (billing, 4), an early praise (friendly staff, 3),
 * and the knobs the tests turn: an action at any stage, a measured result of
 * any kind, two check-ins, what the owner said.
 */

const text = (v: unknown) => JSON.stringify(v);

function checkin(id: string, capturedAt: Date, feedbackCount = 20): SnapshotListRow {
  return {
    id,
    label: null,
    capturedAt,
    rating: 4.4,
    reviewCount: 180,
    feedbackCount,
    isBaseline: false,
    narrativeSource: null,
  };
}

const NO_NEW: FeedbackSince = { total: 0, read: 0, unread: 0, direct: 0 };

function build(overrides: Partial<ResponsibilityInput> & { portal?: Parameters<typeof input>[0] } = {}): Responsibility {
  const { portal, ...rest } = overrides;
  const core = input(portal ?? {});
  const view: PortalView = buildPortalView(core);
  return buildResponsibility({
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
}

function measurable(status: 'DONE' | 'MEASURED', canMeasure: boolean): ActionProgress {
  return { ...action(status), newFeedbackSinceDone: 30, newFeedbackSinceMeasured: 5, canMeasure };
}

// ---------------------------------------------------------------------------

describe('do I need to do anything?', () => {
  it('1. with no data at all, says so honestly and manufactures nothing', () => {
    const empty = intel({ themes: themes([], [], 0), totalFeedback: 0 });
    const r = build({ portal: { intelligence: empty, themes: themes([], [], 0) }, feedbackSince: NO_NEW });
    expect(r.state).toBe('WAITING_FOR_EVIDENCE');
    expect(r.answer).toBe('Nothing to decide yet.');
    expect(r.needsYou).toEqual([]);
    expect(r.watching).toEqual([]);
    expect(r.did).toEqual([]);
    expect(r.nextUsefulCheck).toMatch(/^Once feedback starts coming in/);
  });

  it('2. a healthy business gets "nothing needs you", not an invented problem', () => {
    const healthy = intel({
      themes: themes([theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 14)], [], 30),
      totalFeedback: 30,
    });
    const r = build({ portal: { intelligence: healthy, themes: healthy && themes([theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 14)], [], 30) } });
    expect(r.state).toBe('CLEAR');
    expect(r.answer).toBe('Nothing needs you right now.');
    expect(r.needsYou).toEqual([]);
    expect(r.watching.map((i) => i.state)).toEqual(['KEEP_DOING']);
    expect(r.did).toContain('Found no new issue strong enough to recommend action.');
  });

  it('3. a clear recurring complaint is the one thing to decide on', () => {
    const r = build();
    expect(r.state).toBe('DO_NOW');
    expect(r.answer).toBe('Yes — one thing needs a decision from you.');
    const top = r.needsYou[0];
    expect(top?.themeKey).toBe('wait_time');
    expect(top?.instruction).toBe('Decide what to change');
    expect(top?.headline).toBe('Long waiting time is the clearest thing customers are unhappy about.');
    expect(top?.recommendedNextStep).toMatch(/^Start here: /);
    expect(top?.evidence).toMatchObject({ count: 9, outOf: 50 });
    expect(top?.evidence?.line).toBe('9 of the 50 pieces of feedback we have read mention it.');
    expect(top?.relatedInsight).toBe('c1:UNHAPPY:wait_time');
  });

  it('4. a worsening complaint ranks above the same complaint holding steady', () => {
    const steady = build({ portal: { intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 9 }) }) } });
    const worse = build({ portal: { intelligence: intel({ pulse: pulseWith({ waitThen: 4, waitNow: 9, direction: 'DECLINING' }) }) } });
    expect(worse.needsYou[0]?.priority).toBeGreaterThan(steady.needsYou[0]?.priority ?? 0);
    expect(worse.needsYou[0]?.reasons.some((s) => /coming up more than last time/.test(s.reason) && s.source === 'CUSTOMERS')).toBe(true);
  });

  it('5. an agreed change nobody has made yet is something to follow through on', () => {
    const r = build({ portal: { actions: [action('ACCEPTED')] } });
    expect(r.state).toBe('FOLLOW_UP');
    expect(r.answer).toBe('One thing to follow through on.');
    const top = r.needsYou[0];
    expect(top?.instruction).toBe('Finish the change you agreed');
    expect(top?.headline).toBe('The change you agreed for long waiting time has not been made yet.');
    expect(top?.reasons.some((s) => /has not been made yet/.test(s.reason) && s.source === 'YOU')).toBe(true);
    expect(top?.relatedAction).toBe('a1');
  });

  it('6. a change made with enough feedback after it is a comparison due', () => {
    const r = build({ portal: { actions: [measurable('DONE', true)] } });
    expect(r.state).toBe('FOLLOW_UP');
    expect(r.needsYou[0]?.instruction).toBe('A comparison is due');
    expect(r.nextUsefulCheck).toMatch(/^A comparison is due now/);

    const notYet = build({ portal: { actions: [action('DONE')] } });
    expect(notYet.state).toBe('CLEAR');
    const waiting = notYet.watching.find((i) => i.themeKey === 'wait_time');
    expect(waiting?.state).toBe('WAITING_FOR_EVIDENCE');
    expect(waiting?.instruction).toBe('Change made, not yet checked');
  });

  it('7. a change that read well afterwards is something to keep in place, not to act on', () => {
    const r = build({ portal: { actions: [action('MEASURED', 'IMPROVED')] } });
    expect(r.state).toBe('CLEAR');
    expect(r.needsYou).toEqual([]);
    const kept = r.watching.find((i) => i.themeKey === 'wait_time');
    expect(kept?.state).toBe('KEEP_DOING');
    expect(kept?.instruction).toBe('Keep the change in place');
    expect(kept?.headline).toBe('Long waiting time came up less often in the feedback after your change.');
  });

  it('8. a change that read worse afterwards needs looking at again', () => {
    const r = build({ portal: { actions: [action('MEASURED', 'WORSENED')] } });
    expect(r.state).toBe('DO_NOW');
    const top = r.needsYou[0];
    expect(top?.instruction).toBe('Look at this again');
    expect(top?.reasons.some((s) => /came up more often in the feedback after your change/.test(s.reason))).toBe(true);
    expect(top?.recommendedNextStep).toMatch(/That does not show the change caused it/);
  });

  it('9. a complaint that eased after a change and is rising again is a real alert', () => {
    const r = build({
      portal: {
        intelligence: intel({ pulse: pulseAfterChange({ waitThen: 3, waitNow: 8 }) }),
        actions: [action('MEASURED', 'IMPROVED')],
      },
    });
    expect(r.state).toBe('DO_NOW');
    const top = r.needsYou[0];
    expect(top?.headline).toBe('Long waiting time is coming back after your change.');
    expect(top?.reasons.some((s) => /starting to come up more again/.test(s.reason))).toBe(true);
    expect(top?.thread.find((s) => s.key === 'now')?.text).toMatch(/starting to come up more again/);
  });

  it('10. a strong, consistent strength is something to keep doing', () => {
    const r = build();
    const keep = r.watching.find((i) => i.themeKey === 'doctor_care');
    expect(keep?.state).toBe('KEEP_DOING');
    expect(keep?.headline).toBe("Customers praise your doctor's care and explanation.");
    expect(keep?.watching).toMatch(/^RepOS is checking that doctor's care and explanation keeps being praised/);
  });

  it('11. too little feedback overall is said plainly, with nothing recommended', () => {
    const thin = intel({
      themes: themes([theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 2)], [theme('wait_time', 'Long waiting time', 'ISSUE', 2)], 5),
      totalFeedback: 5,
    });
    const r = build({ portal: { intelligence: thin }, feedbackSince: { total: 5, read: 5, unread: 0, direct: 0 } });
    expect(r.state).toBe('WAITING_FOR_EVIDENCE');
    expect(r.answer).toBe('Not enough feedback yet to say.');
    expect(r.needsYou).toEqual([]);
    expect(r.did).not.toContain('Found no new issue strong enough to recommend action.');
  });
});

// ---------------------------------------------------------------------------

describe('what the owner told RepOS', () => {
  const restaurant = getPackOrFallback('restaurant');
  const cafeThemes = themes(
    [theme('food_quality', 'Food taste and quality', 'PRAISE', 10)],
    [theme('service_speed', 'Slow service', 'ISSUE', 9)],
    40,
  );
  const cafeIntel = () =>
    intel({
      client: { id: 'c2', businessName: 'Corner Cafe', vertical: 'restaurant' },
      pack: restaurant,
      themes: cafeThemes,
      totalFeedback: 40,
    });

  it('12. a stated priority raises relevance and is shown as theirs', () => {
    const plain = build();
    const prioritised = build({
      portal: { context: { items: [told('PRIORITY', 'Reduce waiting time', { themeKey: 'wait_time' })] } },
    });
    const a = plain.needsYou[0]!;
    const b = prioritised.needsYou[0]!;
    expect(b.priority).toBeGreaterThan(a.priority);
    expect(b.reasons.find((s) => /matters most right now/.test(s.reason))?.source).toBe('YOU');
    expect(b.contextUsed).toContain('You told us what matters most right now: reduce waiting time.');
    expect(b.headline).toBe(a.headline);
  });

  it('13. a constraint changes the suggestion only where the pack has an alternative', () => {
    const free = build({ portal: { intelligence: cafeIntel(), pack: restaurant, themes: cafeThemes } });
    const noStaff = build({
      portal: {
        intelligence: cafeIntel(),
        pack: restaurant,
        themes: cafeThemes,
        context: { items: [told('CONSTRAINT', 'No new staff right now', { constraintKey: 'STAFF' })] },
      },
    });
    expect(free.needsYou[0]?.recommendedNextStep).toContain('assign one person to track tables');
    expect(noStaff.needsYou[0]?.recommendedNextStep).toContain('call out any table waiting past it');
    expect(noStaff.needsYou[0]?.recommendedNextStep).not.toContain('assign one person');
    expect(noStaff.needsYou[0]?.contextNote).toBe(
      'You told us extra staff is not possible right now, so this is the version that does not need it.',
    );
    // A constraint the pack cannot honour changes nothing but the note.
    const noDiscount = build({
      portal: {
        intelligence: cafeIntel(),
        pack: restaurant,
        themes: cafeThemes,
        context: { items: [told('CONSTRAINT', 'No discounts', { constraintKey: 'DISCOUNT' })] },
      },
    });
    expect(noDiscount.needsYou[0]?.recommendedNextStep).toBe(free.needsYou[0]?.recommendedNextStep);
    expect(noDiscount.needsYou[0]?.contextNote).toBeNull();
  });

  it('14. never changes a customer count, a share or a state', () => {
    const plain = build();
    const told3 = build({
      portal: {
        context: {
          items: [
            told('PRIORITY', 'Reduce waiting time', { themeKey: 'wait_time' }),
            told('OPERATING', 'One doctor covers evenings', { themeKey: 'wait_time' }),
            told('CONSTRAINT', 'No new staff', { constraintKey: 'STAFF' }),
          ],
        },
      },
    });
    for (const [a, b] of [
      [plain.needsYou[0], told3.needsYou[0]],
      [plain.watching[0], told3.watching[0]],
    ] as const) {
      expect(b?.evidence).toEqual(a?.evidence);
      expect(b?.state).toBe(a?.state);
      expect(b?.headline).toBe(a?.headline);
    }
    expect(told3.answer).toBe(plain.answer);
    expect(told3.did).toEqual(plain.did);
  });

  it('never lets owner words read as customer words', () => {
    const r = build({
      portal: {
        context: {
          items: [told('OPERATING', 'Friday evenings are chaos at the desk', { themeKey: 'wait_time' })],
        },
      },
    });
    const top = r.needsYou[0]!;
    expect(top.contextUsed).toEqual(['You told us: Friday evenings are chaos at the desk.']);
    expect(top.headline).not.toContain('Friday');
    expect(top.whyItMatters).not.toContain('Friday');
    expect(top.evidence?.line).not.toContain('Friday');
    for (const step of top.thread) {
      if (step.text.includes('Friday')) expect(step.source).toBe('YOU');
    }
    expect(text(r)).not.toMatch(/customers (say|said|mention|report)[^"]*Friday/i);
  });
});

// ---------------------------------------------------------------------------

describe('honesty', () => {
  it('15. never claims a change caused anything, in any state', () => {
    for (const result of ['IMPROVED', 'WORSENED', 'NO_CLEAR_CHANGE', 'INSUFFICIENT_DATA'] as const) {
      expect(text(build({ portal: { actions: [action('MEASURED', result)] } }))).not.toMatch(CAUSAL);
    }
    const returning = build({
      portal: {
        intelligence: intel({ pulse: pulseAfterChange({ waitThen: 3, waitNow: 8 }) }),
        actions: [action('MEASURED', 'IMPROVED')],
      },
    });
    expect(text(returning)).not.toMatch(CAUSAL);
  });

  it('16. shows the owner their business, not the tool', () => {
    for (const status of ['RECOMMENDED', 'ACCEPTED', 'PAUSED', 'DONE', 'MEASURED', 'DECLINED'] as const) {
      const r = build({ portal: { actions: [action(status)] } });
      expect(text(r)).not.toMatch(INTERNALS);
      // The state names are the object's own vocabulary; what the owner reads
      // is the label, the instruction and the sentences, and none of those
      // may carry an internal name.
      const prose = [
        r.answer,
        r.answerDetail,
        ...r.did,
        r.nextUsefulCheck,
        ...r.limitations,
        ...[...r.needsYou, ...r.watching].flatMap((i) => [
          i.stateLabel,
          i.instruction,
          i.headline,
          i.whyItMatters,
          i.recommendedNextStep,
          i.watching,
          ...i.contextUsed,
          ...i.limitations,
          ...i.reasons.map((s) => s.reason),
          ...i.thread.map((s) => `${s.label} ${s.text}`),
        ]),
      ].join(' ');
      expect(prose).not.toMatch(/DO_NOW|FOLLOW_UP|KEEP_DOING|WAITING_FOR_EVIDENCE|\bCLEAR\b|\bWATCH\b|[a-z]+_[a-z]+/);
    }
  });

  it('18. states no number the data does not hold', () => {
    const cases: Array<Partial<ResponsibilityInput> & { portal?: Parameters<typeof input>[0] }> = [
      {},
      { portal: { actions: [action('MEASURED', 'IMPROVED')] } },
      { portal: { actions: [action('DONE')] } },
      { checkins: [checkin('s2', new Date(2026, 4, 1)), checkin('s1', new Date(2026, 2, 1))], feedbackSince: { total: 7, read: 6, unread: 1, direct: 2 } },
      { checkins: [checkin('s1', new Date(2026, 2, 1))], feedbackSince: { total: 12, read: 12, unread: 0, direct: 0 } },
    ];
    for (const c of cases) {
      const { portal, ...rest } = c;
      const core = input(portal ?? {});
      const view = buildPortalView(core);
      const inp: ResponsibilityInput = {
        view,
        intelligence: core.intelligence,
        actions: core.actions,
        checkins: [],
        feedbackSince: { total: 50, read: 50, unread: 0, direct: 0 },
        needsYourWords: 0,
        gateway: null,
        archived: false,
        now: NOW,
        ...rest,
      };
      const r = buildResponsibility(inp);
      const allowed = responsibilityNumbers(inp);
      // The answer counts its own items; those are structural, not evidence.
      for (const n of [r.needsYou.length, r.watching.length, r.needsYou.length + r.watching.length]) {
        allowed.add(String(n));
      }
      // Percentages and dates are the measurement engine's and the calendar's.
      const prose = [
        r.answer,
        r.answerDetail,
        ...r.did,
        r.nextUsefulCheck,
        ...[...r.needsYou, ...r.watching].flatMap((i) => [i.headline, i.whyItMatters, i.recommendedNextStep, i.watching, ...i.reasons.map((s) => s.reason)]),
      ]
        .join(' ')
        .replace(/\d+%/g, '')
        .replace(/\d{1,2} [A-Z][a-z]{2,8} \d{4}/g, '');
      for (const figure of prose.match(/\d+/g) ?? []) {
        expect(allowed.has(figure), `${figure} is not backed by stored data in: ${prose}`).toBe(true);
      }
    }
  });

  it('19. orders the same way every time, and breaks ties by name', () => {
    const a = build();
    const b = build();
    expect([...a.needsYou, ...a.watching].map((i) => i.id)).toEqual([...b.needsYou, ...b.watching].map((i) => i.id));
    // Two secondary complaints with the same severity and count: alphabetical.
    const tied = intel({
      themes: themes(
        [theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12)],
        [
          theme('wait_time', 'Long waiting time', 'ISSUE', 9),
          theme('parking_access', 'Parking / access difficulty', 'ISSUE', 4, 'medium'),
          theme('billing_clarity', 'Unclear or unexpected billing', 'ISSUE', 4, 'medium'),
        ],
        50,
      ),
    });
    const r = build({ portal: { intelligence: tied } });
    const watch = r.watching.filter((i) => i.state === 'WATCH').map((i) => i.themeLabel);
    expect(watch).toEqual(['Parking / access difficulty', 'Unclear or unexpected billing']);
  });

  it('20. never lists the same theme twice, whatever lists it sits in upstream', () => {
    const r = build({
      portal: {
        intelligence: intel({ pulse: pulseWith({ waitThen: 4, waitNow: 9, careThen: 2, careNow: 6, direction: 'DECLINING' }) }),
        actions: [action('ACCEPTED')],
      },
    });
    const items = [...r.needsYou, ...r.watching];
    const keys = items.map((i) => i.themeKey).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    const labels = items.map((i) => i.themeLabel).filter(Boolean);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('carries a version and owner labels for every state', () => {
    expect(build().version).toBe(RESPONSIBILITY_VERSION);
    for (const label of Object.values(STATE_LABELS)) expect(label).not.toMatch(/_/);
  });
});

// ---------------------------------------------------------------------------

describe('continuity', () => {
  it('connects what customers said, what you decided, what happened, and what RepOS watches', () => {
    const r = build({ portal: { actions: [action('MEASURED', 'IMPROVED')] } });
    const item = r.watching.find((i) => i.themeKey === 'wait_time')!;
    expect(item.thread.map((s) => `${s.key}:${s.source}`)).toEqual([
      'observed:CUSTOMERS',
      'decided:YOU',
      'changed:YOU',
      'result:CUSTOMERS',
      'now:REPOS',
      'next:REPOS',
    ]);
    expect(item.thread.find((s) => s.key === 'decided')?.text).toBe('Cut evening bookings to five an hour');
    expect(item.thread.find((s) => s.key === 'result')?.text).toMatch(
      /^Customers are mentioning long waiting time less often since the change\. This does not show the change caused the difference\.$/,
    );
    expect(item.thread.find((s) => s.key === 'next')?.text).toMatch(/^RepOS is checking whether long waiting time keeps coming up less often/);
  });

  it('records a declined decision as the owner\'s, and keeps watching without nagging', () => {
    const r = build({ portal: { actions: [action('DECLINED')] } });
    expect(r.state).toBe('CLEAR');
    const item = r.watching.find((i) => i.themeKey === 'wait_time')!;
    expect(item.state).toBe('WATCH');
    expect(item.headline).toBe('Long waiting time is still the clearest complaint. You decided not to pursue a change.');
    expect(item.thread.find((s) => s.key === 'decided')).toMatchObject({
      source: 'YOU',
      text: 'Not to pursue this. Hiring a second receptionist first.',
    });
  });

  it('says "since your check-in" only when there is a check-in to be since', () => {
    const none = build({ feedbackSince: { total: 50, read: 50, unread: 0, direct: 3 } });
    expect(text(none)).not.toMatch(/since your check-in/i);
    expect(none.sinceLabel).toBe('Since feedback started coming in');
    expect(none.did[0]).toBe('Read 50 pieces of feedback — 3 of them sent through your feedback page.');

    const one = build({
      checkins: [checkin('s1', new Date(2026, 2, 1))],
      feedbackSince: { total: 7, read: 6, unread: 1, direct: 2 },
    });
    expect(one.sinceLabel).toBe('Since your check-in on 01 Mar 2026');
    expect(one.did[0]).toBe('Since your check-in on 01 Mar 2026, read 6 pieces of feedback — 2 of them sent through your feedback page.');
    expect(one.did[1]).toBe('1 more is being read now.');
    expect(one.did).toContain('Checked whether long waiting time is still coming up in the new feedback.');
    expect(one.lastCheckinAt?.getTime()).toBe(new Date(2026, 2, 1).getTime());
  });

  it('does not pretend to have worked when nothing new came in', () => {
    const quiet = build({ checkins: [checkin('s1', new Date(2026, 2, 1))], feedbackSince: NO_NEW });
    expect(quiet.did[0]).toBe('No new feedback has come in since your check-in on 01 Mar 2026.');
    expect(quiet.did.some((l) => l.startsWith('Checked whether'))).toBe(false);
    expect(quiet.did).not.toContain('Found no new issue strong enough to recommend action.');
  });

  it('says when the next check would show something, as a condition, never a countdown', () => {
    expect(build().nextUsefulCheck).toBe('A first check-in now would give RepOS something to compare your next one against.');
    const one = build({ checkins: [checkin('s1', new Date(2026, 2, 1))], feedbackSince: { total: 4, read: 4, unread: 0, direct: 0 } });
    expect(one.nextUsefulCheck).toBe(
      'A second check-in will show what changed. So far 4 of the 10 pieces of new feedback that make a comparison worthwhile have come in.',
    );
    const enough = build({ checkins: [checkin('s1', new Date(2026, 2, 1))], feedbackSince: { total: 12, read: 12, unread: 0, direct: 0 } });
    expect(enough.nextUsefulCheck).toBe('A second check-in now would let RepOS show what changed — 12 pieces of feedback have come in since the first.');
    const two = build({
      checkins: [checkin('s2', new Date(2026, 4, 20)), checkin('s1', new Date(2026, 2, 1))],
      feedbackSince: { total: 3, read: 3, unread: 0, direct: 0 },
    });
    expect(two.nextUsefulCheck).toBe(
      'Not yet. 3 pieces of feedback have come in since your check-in on 20 May 2026; RepOS will say when another check-in would show something new.',
    );
    const stale = build({
      checkins: [checkin('s2', new Date(2026, 1, 1)), checkin('s1', new Date(2025, 11, 1))],
      feedbackSince: { total: 2, read: 2, unread: 0, direct: 0 },
    });
    expect(stale.nextUsefulCheck).toMatch(/^Worth a check-in now: it has been 120 days since your last one/);
    for (const r of [one, enough, two, stale]) {
      expect(r.nextUsefulCheck).not.toMatch(/days left|remaining|due in|countdown|streak/i);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the edges', () => {
  it('a paused feedback page is a stated limitation, not a task', () => {
    const r = build({ gateway: { enabled: false, received: 4 } });
    expect(r.limitations).toContain(
      'Your feedback page is paused, so nothing new is arriving through the QR until it is switched back on.',
    );
    expect([...r.needsYou, ...r.watching].some((i) => /paused/i.test(i.headline))).toBe(false);
    expect(build({ gateway: { enabled: true, received: 4 } }).limitations.some((l) => /paused/.test(l))).toBe(false);
    expect(build({ gateway: null }).limitations.some((l) => /paused/.test(l))).toBe(false);
  });

  it('an archived business is said to be inactive, and still computes', () => {
    const r = build({ archived: true });
    expect(r.limitations).toContain('This account is no longer active, so RepOS is not collecting anything new for it.');
    expect(r.needsYou.length).toBe(1);
  });

  it('feedback that needs the owner\'s own words is a follow-up with nothing invented', () => {
    const r = build({ needsYourWords: 2 });
    const words = r.needsYou.find((i) => i.id.endsWith('needs-your-words'))!;
    expect(words.state).toBe('FOLLOW_UP');
    expect(words.headline).toBe('2 pieces of feedback need your own words.');
    expect(words.evidence).toBeNull();
    expect(words.thread).toEqual([]);
    expect(r.answer).toBe('Yes — 1 thing needs a decision, 1 to follow through on.');
    expect(build({ needsYourWords: 0 }).needsYou.some((i) => i.id.endsWith('needs-your-words'))).toBe(false);
  });

  it('a one-check-in business is told what the second one will do', () => {
    const r = build({ portal: { snapshots: [] }, checkins: [checkin('s1', new Date(2026, 4, 1))], feedbackSince: { total: 5, read: 5, unread: 0, direct: 0 } });
    expect(r.nextUsefulCheck).toMatch(/^A second check-in will show what changed/);
    expect(text(r)).not.toMatch(/holding steady|held steady/);
  });

  it('a change made and measured on too little feedback is waited for, not judged', () => {
    const r = build({ portal: { actions: [action('MEASURED', 'INSUFFICIENT_DATA')] } });
    expect(r.state).toBe('CLEAR');
    const item = r.watching.find((i) => i.themeKey === 'wait_time')!;
    expect(item.state).toBe('WAITING_FOR_EVIDENCE');
    expect(item.headline).toBe('Not enough feedback after your change for long waiting time to compare yet.');
  });

  it('a change with no clear result is watched, with the loop still attached', () => {
    const r = build({ portal: { actions: [action('MEASURED', 'NO_CLEAR_CHANGE')] } });
    const item = r.watching.find((i) => i.themeKey === 'wait_time')!;
    expect(item.state).toBe('WATCH');
    expect(item.instruction).toBe('Keep collecting feedback');
    expect(item.relatedAction).toBe('a1');
  });

  it('everything below the evidence floor is one calm line, not a list of alarms', () => {
    const r = build();
    const early = r.watching.filter((i) => i.state === 'WAITING_FOR_EVIDENCE');
    expect(early).toHaveLength(1);
    expect(early[0]?.headline).toBe('Friendly, helpful staff is praised, but not yet often enough to call a strength.');
    expect(early[0]?.recommendedNextStep).toBe('Nothing to do. RepOS will say so when any of these clears the floor.');
  });
});
