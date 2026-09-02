import { describe, expect, it } from 'vitest';
import { cleanReviewText, looksLikePersonName, redactPii } from './redact';

describe('redactPii', () => {
  it('removes email addresses', () => {
    const r = redactPii('Great service, contact me at rahul.sharma@gmail.com anytime');
    expect(r.text).not.toContain('rahul.sharma@gmail.com');
    expect(r.text).toContain('[email removed]');
    expect(r.redacted).toBe(true);
  });

  it('removes Indian phone numbers in several shapes', () => {
    for (const phone of ['+91 98765 43210', '09876543210', '98765-43210', '9876543210']) {
      const r = redactPii(`Call me on ${phone} for details`);
      expect(r.text, phone).not.toMatch(/\d{5}/);
      expect(r.redacted, phone).toBe(true);
    }
  });

  it('removes social handles without eating an email', () => {
    const r = redactPii('Follow @drmehta_clinic and mail admin@clinic.in');
    expect(r.text).not.toContain('@drmehta_clinic');
    expect(r.text).not.toContain('admin@clinic.in');
  });

  it('strips reviewer profile boilerplate', () => {
    const r = redactPii('Local Guide - 42 reviews\nFood was excellent');
    expect(r.text.toLowerCase()).not.toContain('local guide');
    expect(r.text).toContain('Food was excellent');
  });

  it('leaves ordinary review text untouched', () => {
    const input = 'The doctor explained everything clearly and the clinic was clean.';
    const r = redactPii(input);
    expect(r.text).toBe(input);
    expect(r.redacted).toBe(false);
  });

  it('does not destroy star ratings written as small numbers', () => {
    const r = redactPii('Rating 5 out of 5, very good');
    expect(r.text).toContain('5');
  });
});

describe('looksLikePersonName', () => {
  it('accepts short capitalised name lines', () => {
    expect(looksLikePersonName('Rahul Sharma')).toBe(true);
    expect(looksLikePersonName('Priya')).toBe(true);
    expect(looksLikePersonName('Anil Kumar Verma')).toBe(true);
  });

  it('rejects review sentences', () => {
    expect(looksLikePersonName('Great service and very clean')).toBe(false);
    expect(looksLikePersonName('The food was cold.')).toBe(false);
    expect(looksLikePersonName('Excellent')).toBe(false);
    expect(looksLikePersonName('5 stars')).toBe(false);
  });

  it('rejects Devanagari lines rather than guessing', () => {
    expect(looksLikePersonName('राहुल शर्मा')).toBe(false);
  });
});

describe('cleanReviewText', () => {
  it('drops a leading reviewer name line from a multi-line block', () => {
    const r = cleanReviewText('Rahul Sharma\nThe waiting time was very long today');
    expect(r.text).toBe('The waiting time was very long today');
    expect(r.removed).toContain('reviewer name line');
  });

  it('keeps a single-line review intact', () => {
    const r = cleanReviewText('Rahul Sharma');
    expect(r.text).toBe('Rahul Sharma');
  });
});
