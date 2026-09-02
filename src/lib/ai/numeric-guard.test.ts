import { describe, expect, it } from 'vitest';
import { collectAllowedNumbers, guardFields, guardNumbers } from './numeric-guard';

describe('collectAllowedNumbers', () => {
  it('collects numbers from nested objects, arrays and strings', () => {
    const allowed = collectAllowedNumbers({
      count: 7,
      nested: { rating: 4.2 },
      list: [{ label: '12 of 40 reviews' }],
    });
    expect(allowed.has('7')).toBe(true);
    expect(allowed.has('4.2')).toBe(true);
    expect(allowed.has('12')).toBe(true);
    expect(allowed.has('40')).toBe(true);
  });

  it('permits the whole-percentage form of a share', () => {
    const allowed = collectAllowedNumbers({ share: 0.23 });
    expect(allowed.has('23')).toBe(true);
  });
});

describe('guardNumbers', () => {
  const allowed = collectAllowedNumbers({ count: 6, total: 26, share: 0.23 });

  it('accepts prose that only restates supplied figures', () => {
    expect(guardNumbers('6 of 26 reviews (23%) mention the wait', allowed).ok).toBe(true);
  });

  it('rejects an invented figure', () => {
    const r = guardNumbers('Roughly 45% of customers complained', allowed);
    expect(r.ok).toBe(false);
    expect(r.offending).toContain('45');
  });

  it('accepts text with no digits at all', () => {
    expect(guardNumbers('Customers repeatedly raise the waiting time.', allowed).ok).toBe(true);
  });
});

describe('guardFields', () => {
  const fallback = { a: 'deterministic A', b: 'deterministic B' };
  const allowed = collectAllowedNumbers({ n: 6, total: 26 });

  it('takes AI wording when every figure checks out', () => {
    const { value, rejected } = guardFields(
      { a: '6 of 26 reviews mention it', b: 'No figures here' },
      fallback,
      allowed,
    );
    expect(value.a).toBe('6 of 26 reviews mention it');
    expect(value.b).toBe('No figures here');
    expect(rejected).toHaveLength(0);
  });

  it('keeps the deterministic wording for any field with an unsupported figure', () => {
    const { value, rejected } = guardFields(
      { a: 'About 73% of customers said this', b: 'clean wording' },
      fallback,
      allowed,
    );
    expect(value.a).toBe('deterministic A');
    expect(value.b).toBe('clean wording');
    expect(rejected[0]).toContain('73');
  });

  it('ignores non-string and empty AI values', () => {
    const { value } = guardFields({ a: 42, b: '   ' }, fallback, allowed);
    expect(value).toEqual(fallback);
  });
});
