import { describe, expect, it } from 'vitest';
import { buildPortalView } from './view';
import { CAUSAL, INTERNALS, action, input, told } from './test-fixtures';

/**
 * Business context on the owner's pages (M13): shown as theirs, used to make
 * suggestions practical, and kept away from every number.
 */

const with3 = () =>
  input({
    context: {
      items: [
        told('OPERATING', 'Friday and Saturday evenings are much busier than other days', { themeKey: 'wait_time' }),
        told('FOCUS', 'Waiting time is my biggest concern right now', { themeKey: 'wait_time' }),
        told('CONSTRAINT', 'Do not recommend discounts', { constraintKey: 'DISCOUNT' }),
      ],
    },
  });

describe('what the owner told Headway, on their pages', () => {
  it('is listed as "You told us", priorities first, and linked to its theme', () => {
    const v = buildPortalView(with3());
    expect(v.knows.map((k) => k.line)).toEqual([
      'You told us your current focus: waiting time is my biggest concern right now.',
      'You told us: Friday and Saturday evenings are much busier than other days.',
      'You told us: do not recommend discounts. Headway will not suggest a discount or offer.',
    ]);
    expect(v.knows[0]?.themeKey).toBe('wait_time');
    expect(v.knows[2]?.themeKey).toBeNull();
  });

  it('sits on the theme it is about, and nowhere else', () => {
    const v = buildPortalView(with3());
    expect(v.first?.ownerPriority).toBe('You told us your current focus: waiting time is my biggest concern right now.');
    expect(v.first?.ownerContext).toEqual([
      'You told us: Friday and Saturday evenings are much busier than other days.',
    ]);
    expect(v.watch[0]?.ownerContext).toEqual([]);
    expect(v.keep?.ownerPriority).toBeNull();
  });

  it('changes no count, share, movement, bucket or picture', () => {
    const plain = buildPortalView(input());
    const told3 = buildPortalView(with3());
    for (const [a, b] of [
      [plain.first, told3.first],
      [plain.keep, told3.keep],
    ] as const) {
      expect(b?.evidenceCount).toBe(a?.evidenceCount);
      expect(b?.share).toBe(a?.share);
      expect(b?.movementCounts).toBe(a?.movementCounts);
      expect(b?.bucket).toBe(a?.bucket);
      expect(b?.brief).toBe(a?.brief);
    }
    expect(told3.summary).toBe(plain.summary);
    expect(told3.watch.map((s) => s.themeKey)).toEqual(plain.watch.map((s) => s.themeKey));
    expect(told3.work).toEqual(plain.work);
  });

  it('never reads owner words as customer words, and never as a cause', () => {
    const text = JSON.stringify(buildPortalView({ ...with3(), actions: [action('MEASURED', 'IMPROVED')] }));
    expect(text).not.toMatch(/customers (say|said|mention|report)[^"]*(Friday|busier|concern)/i);
    expect(text).not.toMatch(CAUSAL);
    expect(text).not.toMatch(INTERNALS);
    expect(text).not.toMatch(/OWNER_TOLD_US|provenance|questionKey|constraintKey/);
  });

  it('keeps the pack advice when the constraint does not touch it, and swaps to the alternative when it does', () => {
    const noDiscount = buildPortalView(with3());
    expect(noDiscount.first?.suggestion).toMatch(/^Fix the waiting-time expectation/);
    expect(noDiscount.first?.suggestionNote).toBeNull();

    const noStaff = buildPortalView(
      input({ context: { items: [told('CONSTRAINT', 'Cannot hire', { constraintKey: 'STAFF' })] } }),
    );
    // The clinic's waiting-time advice needs no staff, so it stands; phone cover does.
    expect(noStaff.first?.suggestionNote).toBeNull();
  });

  it('stops asking a question once it is answered, and shows the answer as the owner\'s', () => {
    const asked = buildPortalView(input());
    expect(asked.question?.themeKey).toBe('wait_time');
    const answered = buildPortalView(
      input({
        context: {
          items: [told('ANSWER', 'The doctor runs late', { themeKey: 'wait_time', questionKey: 'wait_time' })],
        },
      }),
    );
    expect(answered.question).toBeNull();
    expect(answered.first?.ownerContext).toEqual([
      'Asked "Where does the waiting mostly happen?", you told us: the doctor runs late.',
    ]);
    expect(answered.knows[0]?.line).toBe(
      'Asked "Where does the waiting mostly happen?", you told us: the doctor runs late.',
    );
  });

  it('is empty, not broken, for an owner who has told Headway nothing', () => {
    const v = buildPortalView(input());
    expect(v.knows).toEqual([]);
    expect(v.first?.ownerContext).toEqual([]);
    expect(v.first?.ownerPriority).toBeNull();
    expect(v.first?.suggestionNote).toBeNull();
  });
});
