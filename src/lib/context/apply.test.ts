import { describe, expect, it } from 'vitest';
import { getPackOrFallback, _resetPackCache } from '@/lib/packs';
import {
  EMPTY_CONTEXT,
  answerFor,
  applyConstraints,
  contextForTheme,
  ownerPriority,
  packEntry,
  youToldUs,
  type ContextItem,
  type ContextSet,
} from './apply';

_resetPackCache();
const cafe = getPackOrFallback('restaurant');
const clinic = getPackOrFallback('clinic');

function item(kind: ContextItem['kind'], text: string, extra: Partial<ContextItem> = {}): ContextItem {
  return {
    id: `${kind}-${text.length}`,
    kind,
    provenance: 'OWNER_TOLD_US',
    text,
    themeKey: null,
    constraintKey: null,
    questionKey: null,
    actionId: null,
    recordedAt: new Date(2026, 6, 1),
    ...extra,
  };
}

const set = (...items: ContextItem[]): ContextSet => ({ items });

describe('constraints choose between the pack\'s own advice, never invent it', () => {
  it('leaves the pack action alone when nothing is ruled out', () => {
    const a = applyConstraints(packEntry(cafe, 'service_speed'), EMPTY_CONTEXT);
    expect(a.text).toMatch(/^Set a target ticket time per course/);
    expect(a.constraint).toBeNull();
    expect(a.note).toBeNull();
    expect(a.blocked).toBe(false);
  });

  it('swaps in the pack alternative when the owner ruled out what the action needs', () => {
    const noStaff = item('CONSTRAINT', 'We cannot add anyone right now', { constraintKey: 'STAFF' });
    const a = applyConstraints(packEntry(cafe, 'service_speed'), set(noStaff));
    expect(a.text).toBe(cafe.issueTaxonomy.find((t) => t.key === 'service_speed')?.alternativeAction);
    expect(a.constraint?.id).toBe(noStaff.id);
    expect(a.note).toBe(
      'You told us extra staff is not possible right now, so this is the version that does not need it.',
    );
    expect(a.blocked).toBe(false);
  });

  it('ignores a constraint the action does not touch', () => {
    const noDiscount = item('CONSTRAINT', 'No discounts', { constraintKey: 'DISCOUNT' });
    const a = applyConstraints(packEntry(cafe, 'service_speed'), set(noDiscount));
    expect(a.constraint).toBeNull();
    expect(a.text).toMatch(/^Set a target ticket time per course/);
  });

  it('keeps the action and says so when the pack has no alternative', () => {
    const entry = { ...packEntry(clinic, 'wait_time')!, actionNeeds: ['SPEND' as const], alternativeAction: undefined };
    const noSpend = item('CONSTRAINT', 'No spending this quarter', { constraintKey: 'SPEND' });
    const a = applyConstraints(entry, set(noSpend));
    expect(a.blocked).toBe(true);
    expect(a.text).toBe(entry.action);
    expect(a.note).toMatch(/^You told us extra spending is not possible right now\. This suggestion needs it/);
  });

  it('ignores retired-style or derived items: only what the owner told us counts', () => {
    const derived: ContextItem = { ...item('CONSTRAINT', 'x', { constraintKey: 'STAFF' }), provenance: 'DERIVED_FROM_ACTION' };
    const a = applyConstraints(packEntry(cafe, 'service_speed'), set(derived));
    expect(a.constraint).toBeNull();
  });
});

describe('context is attributed to the owner, always', () => {
  it('reads every kind as "You told us"', () => {
    expect(youToldUs(item('PRIORITY', 'Reduce waiting time'))).toBe(
      'You told us what matters most right now: reduce waiting time.',
    );
    expect(youToldUs(item('FOCUS', 'Slow service is my biggest concern right now.'))).toBe(
      'You told us your current focus: slow service is my biggest concern right now.',
    );
    expect(youToldUs(item('OPERATING', 'Friday and Saturday evenings are much busier'))).toBe(
      'You told us: Friday and Saturday evenings are much busier.',
    );
    expect(youToldUs(item('CONSTRAINT', 'No discounts please', { constraintKey: 'DISCOUNT' }))).toBe(
      'You told us: no discounts please. Headway will not suggest a discount or offer.',
    );
    expect(youToldUs(item('CONSTRAINT', 'Nothing that needs a licence', { constraintKey: 'OTHER' }))).toBe(
      'You told us: nothing that needs a licence.',
    );
    expect(youToldUs(item('TRIED', 'We put a sign up at reception'))).toBe(
      'You told us you already tried this: we put a sign up at reception.',
    );
    expect(youToldUs(item('ANSWER', 'Weekday evenings'))).toBe('You told us: Weekday evenings.');
    expect(youToldUs(item('ANSWER', 'Weekday evenings'), 'When is it most crowded?')).toBe(
      'Asked "When is it most crowded?", you told us: weekday evenings.',
    );
  });

  it('never phrases owner context as something customers said', () => {
    for (const kind of ['PRIORITY', 'FOCUS', 'OPERATING', 'CONSTRAINT', 'TRIED', 'DEFINITION', 'ANSWER'] as const) {
      expect(youToldUs(item(kind, 'Friday is our busiest day', { constraintKey: 'OTHER' }))).toMatch(/^You told us/);
      expect(youToldUs(item(kind, 'Friday is our busiest day', { constraintKey: 'OTHER' }))).not.toMatch(/customers (say|said|mention)/i);
    }
  });

  it('finds what the owner said about one theme, the priority, and the answer', () => {
    const s = set(
      item('OPERATING', 'One doctor in the evening', { themeKey: 'wait_time' }),
      item('PRIORITY', 'Waiting time', { themeKey: 'wait_time' }),
      item('ANSWER', 'The doctor runs late', { themeKey: 'wait_time', questionKey: 'wait_time' }),
      item('OPERATING', 'Unrelated', { themeKey: 'billing_clarity' }),
    );
    expect(contextForTheme(s, 'wait_time').map((i) => i.kind)).toEqual(['OPERATING', 'ANSWER']);
    expect(ownerPriority(s, 'wait_time')?.text).toBe('Waiting time');
    expect(ownerPriority(s, 'billing_clarity')).toBeNull();
    expect(answerFor(s, 'wait_time')?.text).toBe('The doctor runs late');
    expect(answerFor(s, 'billing_clarity')).toBeNull();
  });
});
