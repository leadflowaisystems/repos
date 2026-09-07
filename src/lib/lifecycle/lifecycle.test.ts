import { describe, expect, it } from 'vitest';
import {
  QR_GRACE_DAYS,
  calendarDaysBetween,
  describeLifecycle,
  operatorLabel,
  qrGraceEnd,
  statusLabel,
  type LifecycleInput,
} from './service';

/**
 * THE LIFECYCLE ARITHMETIC (M28).
 *
 * A pure function, tested as one. Every case here is a date and a clock, and
 * the boundaries are tested from both sides — the value of a rule about
 * "exactly three days" is entirely in what happens on the fourth.
 *
 * Times are written in IST (+05:30) where the calendar day matters, because
 * that is the day the owner is looking at.
 */

/** 21 September 2026, 07:07 IST — the instant six real trials actually end. */
const ENDS = new Date('2026-09-21T01:37:09.026Z');
const STARTS = new Date('2026-09-02T07:41:36.100Z');

function at(iso: string): Date {
  return new Date(iso);
}

function base(overrides: Partial<LifecycleInput> = {}): LifecycleInput {
  return {
    subscriptionStatus: 'TRIAL',
    trialStartsAt: STARTS,
    trialEndsAt: ENDS,
    now: at('2026-09-08T06:00:00+05:30'),
    ...overrides,
  };
}

describe('days are counted as days, not as fractions of one', () => {
  it('gives the same answer all day, whatever time it is asked', () => {
    const morning = describeLifecycle(base({ now: at('2026-09-16T06:00:00+05:30') }));
    const night = describeLifecycle(base({ now: at('2026-09-16T23:59:00+05:30') }));
    expect(morning.daysRemaining).toBe(5);
    expect(night.daysRemaining).toBe(5);
    // The naive instant subtraction this replaces would have said 5 and then 4.
  });

  it('counts midnights, so the day of expiry is zero and the day after is minus one', () => {
    expect(calendarDaysBetween(at('2026-09-21T00:01:00+05:30'), ENDS)).toBe(0);
    expect(calendarDaysBetween(at('2026-09-21T23:59:00+05:30'), ENDS)).toBe(0);
    expect(calendarDaysBetween(at('2026-09-22T00:01:00+05:30'), ENDS)).toBe(-1);
    expect(calendarDaysBetween(at('2026-09-20T23:59:00+05:30'), ENDS)).toBe(1);
  });

  it('matches the worked example: 2 September to 21 September is 19 days', () => {
    const state = describeLifecycle(base({ now: at('2026-09-02T09:00:00+05:30') }));
    expect(state.daysRemaining).toBe(19);
  });
});

describe('the warnings, at five days and at two', () => {
  // 06:00, deliberately: the trial ends at 07:07 IST on the 21st, so asking at
  // 09:00 on day zero would be asking after it had already run out.
  const daysOut = (n: number) =>
    describeLifecycle(base({ now: at(`2026-09-${String(21 - n).padStart(2, '0')}T06:00:00+05:30`) }));

  it('says nothing at six days', () => {
    expect(daysOut(6).daysRemaining).toBe(6);
    expect(daysOut(6).warning).toBeNull();
  });

  it('starts at five and stays through three', () => {
    for (const n of [5, 4, 3]) {
      expect(daysOut(n).daysRemaining, String(n)).toBe(n);
      expect(daysOut(n).warning, String(n)).toBe('ENDING_SOON');
    }
  });

  it('gets stronger at two, and stays stronger through the last day', () => {
    for (const n of [2, 1, 0]) {
      expect(daysOut(n).warning, String(n)).toBe('ENDING_IMMINENTLY');
    }
  });

  it('never warns a paying business, an exempt one, or an overridden one', () => {
    const soon = at('2026-09-20T09:00:00+05:30');
    expect(describeLifecycle(base({ now: soon, subscriptionStatus: 'ACTIVE' })).warning).toBeNull();
    expect(describeLifecycle(base({ now: soon, serviceExemption: 'DEMO' })).warning).toBeNull();
    expect(describeLifecycle(base({ now: soon, accessOverrideAt: STARTS })).warning).toBeNull();
    expect(describeLifecycle(base({ now: soon, viewerIsPlatformAdmin: true })).warning).toBeNull();
  });
});

describe('the workspace closes when the stored instant passes, and not before', () => {
  it('is open one second before and shut one second after', () => {
    const justBefore = new Date(ENDS.getTime() - 1000);
    const justAfter = new Date(ENDS.getTime() + 1000);
    expect(describeLifecycle(base({ now: justBefore })).workspaceLocked).toBe(false);
    expect(describeLifecycle(base({ now: justBefore })).state).toBe('ACTIVE_TRIAL');
    expect(describeLifecycle(base({ now: justAfter })).workspaceLocked).toBe(true);
    expect(describeLifecycle(base({ now: justAfter })).state).toBe('TRIAL_EXPIRED');
  });

  it('uses the stored end date and nothing else', () => {
    // Two businesses, same clock, different stored dates. There is no global
    // number anywhere in this function to make them agree.
    const now = at('2026-09-25T09:00:00+05:30');
    const shortOne = describeLifecycle(base({ now, trialEndsAt: at('2026-09-21T07:07:00+05:30') }));
    const longOne = describeLifecycle(base({ now, trialEndsAt: at('2026-10-21T07:07:00+05:30') }));
    expect(shortOne.state).toBe('TRIAL_EXPIRED');
    expect(longOne.state).toBe('ACTIVE_TRIAL');
    expect(longOne.daysRemaining).toBe(26);
  });

  it('never expires a trial that has no end date', () => {
    const state = describeLifecycle(base({ trialEndsAt: null, now: at('2030-01-01T00:00:00Z') }));
    expect(state.state).toBe('ACTIVE_TRIAL');
    expect(state.workspaceLocked).toBe(false);
    expect(state.daysRemaining).toBeNull();
  });
});

describe('the QR grace: exactly three calendar days, and the fourth is dark', () => {
  // The brief's own worked example, transplanted onto 1 October. Midnight, so
  // that the WHOLE of the 1st is after expiry — which is what "expiry =
  // October 1, October 1 = active" means. Expiry itself is an instant, and a
  // trial ending at noon on the 1st is still open that morning; the grace only
  // starts once the instant has passed. The test below pins that separately.
  const OCT1 = at('2026-10-01T00:00:00+05:30');
  const october = (day: number, time = '12:00') =>
    describeLifecycle(base({ trialEndsAt: OCT1, now: at(`2026-10-${String(day).padStart(2, '0')}T${time}:00+05:30`) }));

  it('is live on the 1st, the 2nd and the 3rd', () => {
    for (const day of [1, 2, 3]) {
      expect(october(day).qrActive, `October ${day}`).toBe(true);
    }
  });

  it('is dark on the 4th', () => {
    expect(october(4).qrActive).toBe(false);
  });

  it('flips at IST midnight, not at some hour into the 4th', () => {
    expect(october(3, '23:59').qrActive).toBe(true);
    expect(october(4, '00:00').qrActive).toBe(false);
    expect(october(4, '00:01').qrActive).toBe(false);
  });

  it('reports the grace it is in, and when it ends', () => {
    const during = october(2);
    expect(during.state).toBe('TRIAL_EXPIRED');
    expect(during.workspaceLocked).toBe(true);
    expect(during.inQrGrace).toBe(true);
    expect(during.qrGraceEndsAt?.toISOString()).toBe(qrGraceEnd(OCT1).toISOString());
    // Midnight IST starting 4 October.
    expect(during.qrGraceEndsAt?.toISOString()).toBe('2026-10-03T18:30:00.000Z');

    const after = october(5);
    expect(after.inQrGrace).toBe(false);
    expect(after.qrActive).toBe(false);
  });

  it('keeps the workspace shut for the whole of the grace', () => {
    for (const day of [1, 2, 3]) {
      expect(october(day).workspaceLocked, `October ${day}`).toBe(true);
    }
  });

  it('counts the day of expiry as the first of the three', () => {
    expect(QR_GRACE_DAYS).toBe(3);
    // Expiry day + 3 whole days is the first dark instant.
    expect(qrGraceEnd(OCT1).getTime() - at('2026-10-01T00:00:00+05:30').getTime()).toBe(
      QR_GRACE_DAYS * 86_400_000,
    );
  });

  it('does not start the grace early: a trial ending at noon is open that morning', () => {
    const noon = at('2026-10-01T12:00:00+05:30');
    const morning = describeLifecycle(base({ trialEndsAt: noon, now: at('2026-10-01T09:00:00+05:30') }));
    expect(morning.state).toBe('ACTIVE_TRIAL');
    expect(morning.workspaceLocked).toBe(false);
    expect(morning.inQrGrace).toBe(false);

    const afternoon = describeLifecycle(base({ trialEndsAt: noon, now: at('2026-10-01T13:00:00+05:30') }));
    expect(afternoon.state).toBe('TRIAL_EXPIRED');
    expect(afternoon.workspaceLocked).toBe(true);
    expect(afternoon.qrActive).toBe(true);
    // Still the 4th that goes dark, because the grace is measured in whole days
    // from the calendar day of expiry, not from the hour.
    expect(afternoon.qrGraceEndsAt?.toISOString()).toBe('2026-10-03T18:30:00.000Z');
  });

  it('leaves the QR live for a trial that has not ended at all', () => {
    const state = describeLifecycle(base({ now: at('2026-09-10T09:00:00+05:30') }));
    expect(state.qrActive).toBe(true);
    expect(state.inQrGrace).toBe(false);
  });
});

describe('the states, and which of them open the door', () => {
  const expired = { now: at('2026-09-25T09:00:00+05:30') };

  it('a platform admin is never locked out', () => {
    const state = describeLifecycle(base({ ...expired, viewerIsPlatformAdmin: true }));
    expect(state.state).toBe('FOUNDER_EXEMPT');
    expect(state.workspaceLocked).toBe(false);
    expect(statusLabel(state)).toBe('Headway staff access');
  });

  it('the demonstration business never runs out and its QR never goes dark', () => {
    const state = describeLifecycle(base({ ...expired, serviceExemption: 'DEMO' }));
    expect(state.state).toBe('DEMO_EXEMPT');
    expect(state.workspaceLocked).toBe(false);
    expect(state.qrActive).toBe(true);
    expect(state.exempt).toBe(true);
    expect(operatorLabel(state)).toBe('Demo');
  });

  it('a hand lock shuts the workspace even while the trial is still running', () => {
    const state = describeLifecycle(base({ serviceLockedAt: at('2026-09-05T09:00:00+05:30') }));
    expect(state.state).toBe('MANUALLY_LOCKED');
    expect(state.workspaceLocked).toBe(true);
    // The customer at the table is not part of a billing conversation.
    expect(state.qrActive).toBe(true);
  });

  it('a hand lock still lets the QR follow the trial dates once they pass', () => {
    const locked = { serviceLockedAt: at('2026-09-05T09:00:00+05:30') };
    expect(describeLifecycle(base({ ...locked, now: at('2026-09-22T09:00:00+05:30') })).qrActive).toBe(true);
    expect(describeLifecycle(base({ ...locked, now: at('2026-09-24T09:00:00+05:30') })).qrActive).toBe(false);
  });

  it('an override opens the workspace after expiry without touching the dates', () => {
    const state = describeLifecycle(base({ ...expired, accessOverrideAt: at('2026-09-22T09:00:00+05:30') }));
    expect(state.state).toBe('ADMIN_OVERRIDE');
    expect(state.workspaceLocked).toBe(false);
    expect(state.trialEndsAt?.toISOString()).toBe(ENDS.toISOString());
    expect(state.trialStartsAt?.toISOString()).toBe(STARTS.toISOString());
  });

  it('a paying business is never described as being on a trial', () => {
    for (const status of ['ACTIVE', 'PAUSED', 'CANCELLED']) {
      const state = describeLifecycle(base({ ...expired, subscriptionStatus: status }));
      expect(state.state, status).toBe('ACTIVE_SERVICE');
      expect(state.workspaceLocked, status).toBe(false);
      expect(statusLabel(state), status).toBe('Active service');
    }
  });

  it('an ordinary expired trial is locked, and says so plainly', () => {
    const state = describeLifecycle(base(expired));
    expect(state.state).toBe('TRIAL_EXPIRED');
    expect(state.workspaceLocked).toBe(true);
    expect(statusLabel(state)).toBe('Trial ended');
    expect(state.daysRemaining).toBeLessThan(0);
  });

  it('tells the operator when an expired business is still inside its QR grace', () => {
    const inGrace = describeLifecycle(base({ now: at('2026-09-22T09:00:00+05:30') }));
    expect(operatorLabel(inGrace)).toBe('Expired · QR in grace');
    const after = describeLifecycle(base({ now: at('2026-09-25T09:00:00+05:30') }));
    expect(operatorLabel(after)).toBe('Expired');
  });

  it('labels a trial that is ending soon differently for the operator', () => {
    expect(operatorLabel(describeLifecycle(base({ now: at('2026-09-18T09:00:00+05:30') })))).toBe(
      'Trial ending soon',
    );
    expect(operatorLabel(describeLifecycle(base({ now: at('2026-09-08T09:00:00+05:30') })))).toBe(
      'Active trial',
    );
  });
});

describe('the global default cannot reach this function', () => {
  it('takes no database handle and reads no setting', () => {
    // Structural, because the guarantee is structural: there is nowhere in this
    // module for an AppSetting lookup to happen.
    expect(describeLifecycle.length).toBe(1);
    const source = describeLifecycle.toString();
    expect(source).not.toContain('prisma');
    expect(source).not.toContain('appSetting');
    expect(source).not.toContain('DEFAULT_TRIAL_DAYS');
  });

  it('gives two businesses different answers from their own stored dates alone', () => {
    const now = at('2026-09-20T09:00:00+05:30');
    const a = describeLifecycle(base({ now, trialStartsAt: at('2026-09-01T00:00:00+05:30'), trialEndsAt: at('2026-09-15T00:00:00+05:30') }));
    const b = describeLifecycle(base({ now, trialStartsAt: at('2026-09-01T00:00:00+05:30'), trialEndsAt: at('2026-10-01T00:00:00+05:30') }));
    expect(a.state).toBe('TRIAL_EXPIRED');
    expect(b.state).toBe('ACTIVE_TRIAL');
    expect(b.daysRemaining).toBe(11);
  });
});
