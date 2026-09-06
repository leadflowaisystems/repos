import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/format';
import { PORTAL_VERSION, buildPortalView, spoken } from './view';
import {
  CAUSAL,
  INTERNALS,
  action,
  input,
  intel,
  pulseAfterChange,
  pulseWith,
  theme,
  themes,
} from './test-fixtures';

const text = (v: unknown) => JSON.stringify(v);

// ---------------------------------------------------------------------------

describe('the owner sees their business, not the tool', () => {
  const full = () => buildPortalView(input({ actions: [action('MEASURED')] }));

  it('never leaks milestone, engine, provider or operator terminology', () => {
    expect(text(full())).not.toMatch(INTERNALS);
  });

  it('never names another client', () => {
    expect(text(full())).not.toMatch(/Glow Salon|Corner Cafe|FitZone/);
  });

  it('never turns a before/after into a cause', () => {
    for (const result of ['IMPROVED', 'WORSENED', 'NO_CLEAR_CHANGE', 'INSUFFICIENT_DATA'] as const) {
      expect(text(buildPortalView(input({ actions: [action('MEASURED', result)] })))).not.toMatch(CAUSAL);
    }
  });

  it('keeps the theme key only where a link needs it, never as visible text', () => {
    const v = full();
    for (const s of [v.first, v.keep].filter(Boolean)) {
      expect(s!.meaning).not.toContain(s!.themeKey);
      expect(s!.nextStep).not.toContain(s!.themeKey);
    }
  });

  it('says pack labels the way a person would, inside a sentence', () => {
    expect(spoken('AC / ventilation / temperature')).toBe('AC, ventilation and temperature');
    expect(spoken('Appointment / waiting problems')).toBe('appointment and waiting problems');
    expect(spoken("Doctor's care and explanation")).toBe("doctor's care and explanation");
  });
});

// ---------------------------------------------------------------------------

describe('the picture', () => {
  it('leads with the strength, then the clearest weakness, without claiming persistence it cannot see', () => {
    const v = buildPortalView(input());
    expect(v.summary).toBe(
      "Customers praise your doctor's care and explanation most. The clearest weakness is long waiting time.",
    );
    expect(v.mood).toBe('MIXED');
  });

  it('names the comparison when it says the weakness eased since the change', () => {
    const v = buildPortalView(input({ actions: [action('MEASURED', 'IMPROVED')] }));
    expect(v.summary).toMatch(
      /The clearest weakness is still long waiting time, although it has come up less in the feedback after your change\.$/,
    );
    const worse = buildPortalView(input({ actions: [action('MEASURED', 'WORSENED')] }));
    expect(worse.summary).toMatch(/and it has come up more in the feedback after your change\.$/);
  });

  it('reads a plural pack label naturally in the picture', () => {
    const plural = intel({
      themes: themes(
        [theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12)],
        [theme('appointment_scheduling', 'Appointment / booking problems', 'ISSUE', 9)],
        50,
      ),
    });
    const v = buildPortalView(input({ intelligence: plural }));
    expect(v.summary).toMatch(/The clearest weakness is appointment and booking problems\.$/);
  });

  it('says praise is increasing only when the engine saw it grow', () => {
    const v = buildPortalView(
      input({ intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 9, careThen: 4, careNow: 9 }) }) }),
    );
    expect(v.summary).toMatch(/^Customers are increasingly praising your doctor's care and explanation\./);
  });

  it('is honest when there is almost nothing to go on', () => {
    const thin = intel({ themes: themes([], [], 0), totalFeedback: 0 });
    const v = buildPortalView(input({ intelligence: thin, themes: themes([], [], 0) }));
    expect(v.mood).toBe('TOO_EARLY');
    expect(v.first).toBeNull();
    expect(v.keep).toBeNull();
    expect(v.watching).toEqual([]);
    expect(v.work).toEqual([]);
    expect(v.suggestedNow).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('priorities come from the engine, not from raw counts', () => {
  it('puts the ranked complaint first, the strength under keep, the rest under watch or early', () => {
    const v = buildPortalView(input());
    expect(v.first?.themeKey).toBe('wait_time');
    expect(v.first?.bucket).toBe('FIRST');
    expect(v.keep?.themeKey).toBe('doctor_care');
    expect(v.keep?.bucket).toBe('KEEP');
    expect(v.watch.map((s) => s.themeKey)).toEqual(['billing_clarity']);
    expect(v.early.map((s) => s.themeKey)).toEqual(['staff_friendly']);
    expect(v.suggestedNow?.themeKey).toBe('wait_time');
  });

  it('does not let a bigger raw count outrank a growing strength, and says why', () => {
    const grown = intel({
      themes: themes(
        [
          theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12),
          theme('short_wait', 'Little or no waiting', 'PRAISE', 20),
        ],
        [theme('wait_time', 'Long waiting time', 'ISSUE', 9)],
        50,
      ),
      pulse: pulseWith({ waitThen: 9, waitNow: 9, careThen: 3, careNow: 8 }),
    });
    const v = buildPortalView(input({ intelligence: grown }));
    expect(v.keep?.themeKey).toBe('doctor_care');
    expect(v.keep?.featuredBecause).toMatch(/mentioning it more than before/);
  });

  it('reads the two faces of one experience together, counting comments not people', () => {
    const both = intel({
      themes: themes(
        [theme('short_wait', 'Little or no waiting', 'PRAISE', 8)],
        [theme('wait_time', 'Long waiting time', 'ISSUE', 9)],
        50,
      ),
    });
    const v = buildPortalView(input({ intelligence: both }));
    expect(v.first?.counterpart?.themeKey).toBe('short_wait');
    expect(v.first?.meaning).toMatch(
      /^Little or no waiting is mostly a strength — 8 comments praised it — but 9 comments said the opposite\./,
    );
    expect(v.keep?.counterpart?.themeKey).toBe('wait_time');
    expect(v.keep?.meaning).toMatch(/Not universal: 9 comments said the opposite — long waiting time\./);
  });

  it('never invents a counterpart the pack did not declare', () => {
    const v = buildPortalView(input());
    expect(v.watch[0]?.counterpart).toBeNull();
    expect(v.early[0]?.counterpart).toBeNull();
  });

  it('holds rather than pushes when the leading complaint is easing on its own', () => {
    const v = buildPortalView(input({ intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 3 }) }) }));
    expect(v.first?.advice).toBe('HOLD');
    expect(v.first?.nextStep).toMatch(/^It is coming up less on its own, so decide whether to act now or wait\. If it climbs again, start here:/);
  });
});

// ---------------------------------------------------------------------------

describe('every theme carries its layers, kept apart', () => {
  it('states the fact with its denominator', () => {
    const v = buildPortalView(input());
    expect(v.first?.fact).toBe('9 of the 50 pieces of feedback we have read mention it.');
    expect(v.first?.share).toBe('18%');
  });

  it('gives the differentiating engine reasons as why, without the count or the floor', () => {
    const v = buildPortalView(input());
    expect(v.first?.why).toEqual(['This is a serious complaint for a clinic.']);
    expect(v.early[0]?.why).toEqual([]);
  });

  it('recommends the pack\'s own advice when nothing has been tried', () => {
    const v = buildPortalView(input());
    expect(v.first?.advice).toBe('START');
    expect(v.first?.nextStep).toMatch(/^Start here: Fix the waiting-time expectation/);
    expect(v.first?.actionLine).toBeNull();
    expect(v.first?.actionState).toBe('NONE');
  });

  it('does not tell a watch theme to start anything', () => {
    const v = buildPortalView(input());
    expect(v.watch[0]?.advice).toBe('WATCH');
    expect(v.watch[0]?.brief).toBe('Raised often enough to be a pattern, but not the complaint that needs you first.');
    expect(v.watch[0]?.nextStep).toMatch(/^No action needed yet\. If you want to get ahead of it, the usual fix is:/);
  });

  it('carries the owner\'s decision and the reading on the theme, naming both piles and the change date', () => {
    const v = buildPortalView(input({ actions: [action('MEASURED', 'IMPROVED')] }));
    const changed = formatDate(new Date(2026, 3, 1));
    expect(v.first?.actionState).toBe('CHECKED');
    expect(v.first?.actionLine).toBe('You changed: Cut evening bookings to five an hour');
    expect(v.first?.outcome?.beforeShare).toBe('18%');
    expect(v.first?.outcome?.afterShare).toBe('7%');
    expect(v.first?.outcome?.beforeScope).toBe(`Feedback read up to ${formatDate(new Date(2026, 2, 1))}`);
    expect(v.first?.outcome?.afterScope).toBe(`Feedback after the change, recorded ${changed}`);
    expect(v.first?.outcome?.resultLabel).toBe('Mentioned less often after the change');
    expect(v.first?.outcome?.note).toBe('This does not show the change caused the difference.');
    expect(v.first?.advice).toBe('KEEP_CHANGE');
    expect(v.first?.brief).toBe(
      `In the feedback after your change on ${changed} it has come up less often (18% of feedback before, 7% after), but it is still the complaint Headway would watch most closely.`,
    );
    expect(v.first?.meaning).toMatch(/This does not show the change caused the difference\.$/);
    expect(v.first?.nextStep).toMatch(/^Nothing in the feedback after the change says to undo it\./);
  });

  it('asks the owner to look again, not to undo, when a theme came up more after a change', () => {
    const v = buildPortalView(input({ actions: [action('MEASURED', 'WORSENED')] }));
    expect(v.first?.advice).toBe('REVIEW_CHANGE');
    expect(v.first?.brief).toMatch(/^In the feedback after your change on .* it has come up more often \(18% of feedback before, 40% after\)\.$/);
    expect(v.first?.meaning).toMatch(/This does not show the change caused the difference\. Worth looking at again\.$/);
    expect(v.first?.nextStep).toMatch(
      /^It came up more often in the feedback after the change\. That does not show the change caused it — before undoing anything, check what else changed\./,
    );
    expect(v.first?.nextStep).toMatch(/The original suggestion still stands:/);
    expect(v.first?.outcome?.resultLabel).toBe('Mentioned more often after the change');
  });

  it('waits for feedback after a change rather than guessing', () => {
    const v = buildPortalView(input({ actions: [action('DONE')] }));
    expect(v.first?.actionState).toBe('IN_PROGRESS');
    expect(v.first?.advice).toBe('CHECKING');
    // Never "48 of the 10 needed" once the threshold is passed (M18).
    expect(v.first?.nextStep).not.toMatch(/1[1-9]\d* of the 10/);
    expect(v.first?.nextStep).toMatch(/4 of the 10 needed so far/);
    expect(buildPortalView(input({ actions: [action('ACCEPTED')] })).first?.advice).toBe('CONTINUE');
  });

  it('never restates the advice inside the next step', () => {
    for (const status of ['RECOMMENDED', 'ACCEPTED', 'DONE', 'MEASURED', 'DECLINED'] as const) {
      const s = buildPortalView(input({ actions: [action(status)] })).first!;
      expect(s.nextStep.toLowerCase().startsWith(s.adviceLabel.toLowerCase())).toBe(false);
    }
  });

  it('shows movement only when the engine could read a direction or a genuine steady', () => {
    const v = buildPortalView(input({ intelligence: intel({ pulse: pulseWith({ waitThen: 2, waitNow: 0 }) }) }));
    expect(v.first?.movementCounts).toBeNull();
    expect(v.first?.movementDirection).toBeNull();
    expect(v.first?.movementBrief).toBe('Too few mentions at one of your last two check-ins to compare.');
  });

  it('keeps a declined suggestion on record without repeating the decision', () => {
    const v = buildPortalView(input({ actions: [action('DECLINED')] }));
    expect(v.first?.actionState).toBe('DECLINED');
    expect(v.first?.actionLine).toBe('You decided not to pursue this.');
    expect(v.first?.nextStep).toBe('The suggestion stays on record in case it comes up again.');
  });

  it('notices when an improved problem starts coming back — only at check-ins after the change', () => {
    const before = buildPortalView(
      input({ intelligence: intel({ pulse: pulseWith({ waitThen: 3, waitNow: 9 }) }), actions: [action('MEASURED', 'IMPROVED')] }),
    );
    expect(before.actions[0]?.returning).toBe(false);
    expect(before.actions[0]?.sinceThen).toBeNull();

    const after = buildPortalView(
      input({ intelligence: intel({ pulse: pulseAfterChange({ waitThen: 3, waitNow: 9 }) }), actions: [action('MEASURED', 'IMPROVED')] }),
    );
    expect(after.first?.returning).toBe(true);
    expect(after.first?.meaning).toMatch(/starting to come up more again/);
    expect(after.first?.nextStep).toMatch(/earlier conditions have returned/);
    expect(after.actions[0]?.sinceThen).toMatch(/^At check-ins after the change: 3 mentions/);
    expect(after.watching.find((w) => w.themeKey === 'wait_time')?.state).toBe('coming back');
  });

  it('calls praise early rather than a strength until six comments agree', () => {
    const v = buildPortalView(input());
    expect(v.early[0]?.themeKey).toBe('staff_friendly');
    expect(v.early[0]?.brief).toBe(
      'Positive, and mentioned by a few customers, but not yet often enough to call it a strength.',
    );
    expect(v.early[0]?.advice).toBe('WAIT');
    expect(v.early[0]?.watchLine).toMatch(/calls it one once 6 comments have/);
  });

  it('does not call a theme new when it had mentions at the check-in before', () => {
    const v = buildPortalView(
      input({
        intelligence: intel({ pulse: pulseWith({ waitThen: 1, waitNow: 9 }) }),
        snapshots: [],
      }),
    );
    expect(v.first?.isNew).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('the invisible work, the watch list and the one question', () => {
  it('states what Headway did, with the real numbers', () => {
    const v = buildPortalView(input({ actions: [action('MEASURED')] }));
    expect(v.work).toEqual([
      'Read 50 pieces of feedback.',
      'Grouped them into 4 things customers keep raising, and set aside 1 topic mentioned only once or twice.',
      'Compared the feedback before and after 1 change you made.',
    ]);
  });

  it('mentions the comparison only when two check-ins were compared, by date', () => {
    const v = buildPortalView(input({ intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 9 }) }) }));
    expect(v.work).toContain(
      `Compared your check-ins of ${formatDate(new Date(2026, 2, 1))} and ${formatDate(new Date(2026, 4, 1))}.`,
    );
  });

  it('watches the first and the keep themes with full sentences, without repeating the watch rows', () => {
    const v = buildPortalView(input());
    expect(v.watching.map((w) => w.themeKey)).toEqual(['wait_time', 'doctor_care', null]);
    expect(v.watching[0]?.next).toMatch(/^Headway is checking whether long waiting time comes up more or less at your next check-in, and will flag a move of 2 or more mentions\./);
    expect(v.watching[1]?.next).toMatch(/will flag it if the praise drops by 2 or more/);
    expect(v.watching[2]?.label).toBe('Friendly, helpful staff');
    expect(v.watch[0]?.watchLine).toMatch(/will flag a move of 2 or more mentions/);
  });

  it('keeps watching a change that is waiting for feedback', () => {
    const v = buildPortalView(input({ actions: [action('DONE')] }));
    expect(v.watching[0]?.state).toBe('change in progress');
    expect(v.watching[0]?.next).toMatch(/^Headway is waiting for feedback that arrives after your change/);
  });

  it('asks the one question the pack has for the leading complaint, only before anything is tried, without claiming to have read the answer', () => {
    const v = buildPortalView(input());
    expect(v.question?.themeKey).toBe('wait_time');
    expect(v.question?.options).toHaveLength(3);
    expect(v.question?.why).toBe(
      '9 comments mention long waiting time. Headway cannot tell from the feedback alone which of these fits best, and it shapes what to try first.',
    );
    expect(buildPortalView(input({ actions: [action('ACCEPTED')] })).question).toBeNull();
    expect(buildPortalView(input({ actions: [action('DECLINED')] })).question).toBeNull();
  });

  it('says plainly what is not worth the owner\'s time, once', () => {
    const v = buildPortalView(input());
    expect(v.noAction).toBe(
      'Nothing else needs your attention first. Friendly, helpful staff has come up, but not often enough to act on yet. 1 other topic was mentioned once or twice. Headway is not recommending action on any of these until more customers raise them.',
    );
    expect(v.quietNote).toBe('1 other topic was mentioned once or twice — not enough to call a pattern.');
    expect(v.limits.some((l) => /once or twice/.test(l))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('the improvement loop, told end to end', () => {
  it('keeps the frozen problem by pile and date, the suggestion, the decision and the memory strip', () => {
    const v = buildPortalView(input({ actions: [action('MEASURED', 'IMPROVED')] }));
    const a = v.actions[0]!;
    expect(a.problem).toBe(
      `9 of the 50 pieces of feedback read by ${formatDate(new Date(2026, 2, 1))} (18%) mentioned it.`,
    );
    expect(a.suggested).toBe('Publish a realistic slot length.');
    expect(a.decision).toBe('Cut evening bookings to five an hour');
    expect(a.memory).toEqual({
      then: '18%',
      change: 'Cut evening bookings to five an hour',
      now: '7%',
      result: 'Less often',
    });
    expect(a.learning).toBe('Evenings feel calmer.');
    expect(a.steps.every((s) => s.done)).toBe(true);
    expect(a.sinceThen).toBeNull();
  });

  it('says how much feedback a made change is still waiting for', () => {
    const v = buildPortalView(input({ actions: [action('DONE')] }));
    expect(v.actions[0]?.awaiting).toEqual({ have: 4, need: 10 });
    expect(v.actions[0]?.memory).toBeNull();
  });

  it('is versioned and stable for the same input', () => {
    expect(buildPortalView(input())).toEqual(buildPortalView(input()));
    expect(buildPortalView(input()).version).toBe(PORTAL_VERSION);
    expect(PORTAL_VERSION).toBe(3);
  });
});
