import { describe, expect, it } from 'vitest';
import { parseReviews, splitBlocks } from './parse-reviews';

const REF = new Date('2026-03-15T00:00:00.000Z');

describe('splitBlocks', () => {
  it('splits on blank lines when present', () => {
    expect(splitBlocks('one review\n\ntwo review\n\nthree')).toHaveLength(3);
  });

  it('falls back to one review per line', () => {
    expect(splitBlocks('one\ntwo\nthree')).toHaveLength(3);
  });

  it('splits on --- separators', () => {
    expect(splitBlocks('first\nline two\n---\nsecond review')).toHaveLength(2);
  });

  it('returns nothing for empty input', () => {
    expect(splitBlocks('   \n  ')).toHaveLength(0);
  });
});

describe('parseReviews', () => {
  it('extracts star ratings in several notations', () => {
    const raw = [
      '5 stars - excellent doctor',
      '★★★☆☆ average experience overall',
      'Rating: 2 the wait was far too long',
      '4/5 clean and quick',
    ].join('\n');
    const out = parseReviews(raw, REF);
    expect(out.reviews.map((r) => r.stars)).toEqual([5, 3, 2, 4]);
    expect(out.withStars).toBe(4);
  });

  it('never invents a star rating when none is present', () => {
    const out = parseReviews('The staff were polite and helpful', REF);
    expect(out.reviews[0]?.stars).toBeNull();
    expect(out.withStars).toBe(0);
  });

  it('resolves relative dates against the reference date, not now', () => {
    const out = parseReviews('2 weeks ago - very long wait at reception', REF);
    expect(out.reviews[0]?.reviewDate?.toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  it('parses absolute dates in day-first and ISO form', () => {
    const out = parseReviews('12/02/2026 clean clinic\n---\n2026-01-05 rude staff', REF);
    expect(out.reviews[0]?.reviewDate?.toISOString().slice(0, 10)).toBe('2026-02-12');
    expect(out.reviews[1]?.reviewDate?.toISOString().slice(0, 10)).toBe('2026-01-05');
  });

  it('is deterministic — same input gives the same output', () => {
    const raw = '5 stars a month ago great service\n\n1 star 3 days ago terrible wait';
    expect(JSON.stringify(parseReviews(raw, REF))).toBe(
      JSON.stringify(parseReviews(raw, REF)),
    );
  });

  it('redacts PII inside pasted blocks and flags it', () => {
    const out = parseReviews('Call 9876543210 for booking, service was fine', REF);
    expect(out.reviews[0]?.text).not.toContain('9876543210');
    expect(out.redactedCount).toBe(1);
  });

  it('drops a reviewer name line inside a multi-line block', () => {
    const out = parseReviews('Rahul Sharma\n5 stars\nDoctor explained everything well', REF);
    expect(out.reviews).toHaveLength(1);
    expect(out.reviews[0]?.text).not.toContain('Rahul');
    expect(out.reviews[0]?.stars).toBe(5);
  });

  it('detects Marathi, Hindi and mixed feedback', () => {
    const out = parseReviews(
      ['डॉक्टर खूप छान आहेत आणि सेवा चांगली आहे', 'बहुत अच्छा अनुभव था और स्टाफ अच्छा है', 'Staff bahut accha hai, waiting thoda zyada'].join('\n'),
      REF,
    );
    expect(out.reviews[0]?.language).toBe('mr');
    expect(out.reviews[1]?.language).toBe('hi');
    expect(out.reviews[2]?.language).toBe('mixed');
  });

  it('skips blocks that are empty after cleaning', () => {
    const out = parseReviews('9876543210\n\nGood service', REF);
    expect(out.reviews).toHaveLength(1);
    expect(out.skippedEmpty).toBe(1);
  });
});

describe('blocks that hold several one-per-line reviews', () => {
  it('splits consecutive quoted reviews inside a blank-line block', () => {
    const raw = [
      '5 stars',
      '"Loved my haircut, the stylist listened."',
      '',
      '"★★★★★ Best salon in the area, very clean."',
      '"★☆☆☆☆ Charged me more than the price quoted."',
      '"★★★☆☆ Colour was fine but they pushed a membership."',
    ].join('\n');

    const out = parseReviews(raw, REF);
    expect(out.reviews).toHaveLength(4);
    expect(out.reviews.map((r) => r.stars)).toEqual([5, 5, 1, 3]);
  });

  it('keeps unmarked lines together when the paste uses blank lines to delimit', () => {
    // The operator chose blank lines as the delimiter, so unmarked lines inside
    // one block are treated as a single wrapped review rather than three
    // invented ones. Separating them is done by adding blank lines.
    const raw = [
      '4 stars',
      'Tools were sanitised in front of me which I appreciated.',
      '',
      'केस कापणे छान झाले पण खूप वेळ थांबावे लागले',
      'बहुत अच्छा अनुभव था, स्टाफ बहुत अच्छा है',
      'Staff bahut acche hain lekin waiting time thoda zyada hai',
    ].join('\n');

    const out = parseReviews(raw, REF);
    expect(out.reviews).toHaveLength(2);
    expect(out.reviews[0]?.stars).toBe(4);
    // No text is lost — the three lines are preserved inside one item.
    expect(out.reviews[1]?.text).toContain('केस कापणे छान झाले');
    expect(out.reviews[1]?.text).toContain('बहुत अच्छा अनुभव था');
    expect(out.reviews[1]?.text).toContain('Staff bahut acche hain');
  });

  it('separates those same lines once blank lines are added between them', () => {
    const raw = [
      '4 stars',
      'Tools were sanitised in front of me which I appreciated.',
      '',
      'केस कापणे छान झाले पण खूप वेळ थांबावे लागले',
      '',
      'बहुत अच्छा अनुभव था, स्टाफ बहुत अच्छा है',
      '',
      'Staff bahut acche hain lekin waiting time thoda zyada hai',
    ].join('\n');

    const out = parseReviews(raw, REF);
    expect(out.reviews).toHaveLength(4);
    expect(out.reviews.map((r) => r.text)).toContain(
      'बहुत अच्छा अनुभव था, स्टाफ बहुत अच्छा है',
    );
  });

  it('keeps a review wrapped across short lines as ONE item', () => {
    const raw = 'Great place.\nWould come again.\n\nSeparate review about the wait.';
    const out = parseReviews(raw, REF);
    expect(out.reviews).toHaveLength(2);
    // The line break is part of the original text and is preserved as-is.
    expect(out.reviews[0]?.text).toBe(['Great place.', 'Would come again.'].join('\n'));
  });

  it('keeps a rating line attached to the review below it', () => {
    const raw = '5 stars\n"Very good service, staff were polite."\n\n4 stars\n"Good but slow."';
    const out = parseReviews(raw, REF);
    expect(out.reviews).toHaveLength(2);
    expect(out.reviews.map((r) => r.stars)).toEqual([5, 4]);
    expect(out.reviews[0]?.text).toBe('Very good service, staff were polite.');
  });

  it('strips wrapping quotes of every common kind', () => {
    const out = parseReviews(
      ['"Straight quoted review here"', '\u201cCurly quoted review here\u201d'].join('\n'),
      REF,
    );
    expect(out.reviews.map((r) => r.text)).toEqual([
      'Straight quoted review here',
      'Curly quoted review here',
    ]);
  });
});
