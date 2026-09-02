import { describe, expect, it } from 'vitest';
import { parseReviews, splitBlocks } from './parse-reviews';

/**
 * REVIEW BOUNDARY REGRESSION TESTS.
 *
 * M5 is the source of truth for every downstream statistic, so a wrong boundary
 * is not a cosmetic bug — it permanently distorts sentiment shares, theme counts
 * and trends. These tests pin the boundary rules in both directions: a wrapped
 * review must never be split, and separate reviews must never be merged.
 *
 * Every case here states the expected number of reviews explicitly.
 */

const REF = new Date('2026-03-15T00:00:00.000Z');

function texts(raw: string): string[] {
  return parseReviews(raw, REF).reviews.map((r) => r.text);
}

function count(raw: string): number {
  return parseReviews(raw, REF).reviews.length;
}

// ---------------------------------------------------------------------------
// The specified example
// ---------------------------------------------------------------------------

describe('the specified example', () => {
  const raw = [
    '5 stars',
    'The staff were very helpful and polite.',
    'The whole experience was smooth and comfortable.',
    '',
    '4 stars',
    'Good service, but I had to wait longer than expected.',
    '',
    '5 stars',
    'Very clean place and excellent service.',
  ].join('\n');

  it('produces exactly three reviews', () => {
    expect(count(raw)).toBe(3);
  });

  it('keeps the first review whole despite its physical line break', () => {
    const first = parseReviews(raw, REF).reviews[0];
    expect(first?.text).toContain('The staff were very helpful and polite.');
    expect(first?.text).toContain('The whole experience was smooth and comfortable.');
  });

  it('keeps each rating attached to its own review', () => {
    expect(parseReviews(raw, REF).reviews.map((r) => r.stars)).toEqual([5, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// Wrapped reviews must stay whole
// ---------------------------------------------------------------------------

describe('a single review wrapped across lines', () => {
  it('stays one item when the paste uses blank lines elsewhere', () => {
    const raw = [
      'The doctor took his time and explained the whole treatment plan.',
      'Reception was calm and nobody rushed us.',
      'We will definitely come back.',
      '',
      'Second review about parking being difficult.',
    ].join('\n');

    expect(count(raw)).toBe(2);
    expect(texts(raw)[0]).toContain('We will definitely come back.');
  });

  it('stays one item when separators are used elsewhere', () => {
    const raw = [
      'Lovely experience from start to finish.',
      'The whole team was welcoming.',
      '---',
      'Completely separate review here.',
    ].join('\n');

    expect(count(raw)).toBe(2);
    expect(texts(raw)[0]).toContain('The whole team was welcoming.');
  });

  it('stays one item when a mid-sentence wrap has no delimiters at all', () => {
    const raw = [
      'The staff were extremely helpful and',
      'polite throughout the entire visit',
    ].join('\n');

    expect(count(raw)).toBe(1);
  });

  it('stays one item when a line opens with a conjunction', () => {
    const raw = [
      'Treatment itself was good.',
      'But the waiting time was far too long.',
    ].join('\n');

    expect(count(raw)).toBe(1);
  });

  it('stays one item when the previous line ends mid-clause', () => {
    const raw = ['The clinic was clean, tidy and,', 'Above all, well organised'].join(
      '\n',
    );
    expect(count(raw)).toBe(1);
  });
});

describe('a wrapped review carrying a rating', () => {
  it('keeps the rating and all lines together', () => {
    const raw = [
      '5 stars',
      'Excellent from start to finish.',
      'The doctor explained every step.',
      'Reception was friendly too.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.stars).toBe(5);
    expect(reviews[0]?.text).toContain('Reception was friendly too.');
  });

  it('keeps a star-glyph header with its wrapped body', () => {
    const raw = [
      '★★★★☆',
      'Good haircut and a relaxed atmosphere.',
      'Slightly pricey but I would return.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.stars).toBe(4);
    expect(reviews[0]?.text).toContain('would return');
  });

  it('keeps a rating-and-date header with its wrapped body', () => {
    const raw = [
      '3 stars 2 weeks ago',
      'The food was fine but nothing special.',
      'Service was slow on a quiet evening.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.stars).toBe(3);
    expect(reviews[0]?.reviewDate?.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(reviews[0]?.text).toContain('Service was slow');
  });

  it('keeps a stacked name / rating / date header with its body', () => {
    const raw = [
      'Anita Desai',
      '5 stars',
      '2 weeks ago',
      'Wonderful experience, the team could not have been kinder.',
      'Everything ran exactly on time.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.stars).toBe(5);
    expect(reviews[0]?.text).not.toContain('Anita');
    expect(reviews[0]?.text).toContain('Everything ran exactly on time.');
  });
});

// ---------------------------------------------------------------------------
// Separate reviews must stay separate
// ---------------------------------------------------------------------------

describe('multiple one-line reviews', () => {
  it('keeps plain one-per-line reviews separate when no delimiters are used', () => {
    const raw = [
      'Clean and quick',
      'Rude reception staff',
      'Doctor was very kind',
    ].join('\n');

    expect(count(raw)).toBe(3);
  });

  it('keeps quoted one-per-line reviews separate', () => {
    const raw = [
      '"Excellent service, very clean."',
      '"Waited far too long for my appointment."',
      '"Staff were polite and helpful."',
    ].join('\n');

    expect(count(raw)).toBe(3);
  });

  it('keeps inline-star reviews separate even inside one blank-line block', () => {
    const raw = [
      'Header note that does not matter',
      '',
      '"★★★★★ Best salon in the area, very clean."',
      '"★☆☆☆☆ Charged me more than the price quoted."',
      '"★★★☆☆ Colour was fine but they pushed a membership."',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(4);
    expect(reviews.slice(1).map((r) => r.stars)).toEqual([5, 1, 3]);
  });

  it('keeps rating-headed reviews separate with no blank lines between them', () => {
    const raw = [
      '5 stars',
      'Very good service overall.',
      '4 stars',
      'Good but slightly slow.',
      '1 star',
      'Terrible experience.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(3);
    expect(reviews.map((r) => r.stars)).toEqual([5, 4, 1]);
  });

  it('keeps bulleted reviews separate and strips the bullet from the text', () => {
    const raw = [
      '- Clean and welcoming, staff were great',
      '- Waited far too long past my slot',
      '- Reasonable prices for the area',
    ].join('\n');

    expect(count(raw)).toBe(3);
    // The bullet is the operator's formatting, not something a customer wrote.
    expect(texts(raw)).toEqual([
      'Clean and welcoming, staff were great',
      'Waited far too long past my slot',
      'Reasonable prices for the area',
    ]);
  });

  it('keeps numbered reviews separate and strips the numbering', () => {
    const raw = [
      '1. Very professional and quick',
      '2. Had to wait but the result was good',
      '3. Would recommend to anyone',
    ].join('\n');

    expect(count(raw)).toBe(3);
    expect(texts(raw)).toEqual([
      'Very professional and quick',
      'Had to wait but the result was good',
      'Would recommend to anyone',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Several multiline reviews together
// ---------------------------------------------------------------------------

describe('multiple multiline reviews', () => {
  it('splits on blank lines and keeps each review whole', () => {
    const raw = [
      'The treatment was excellent.',
      'I felt looked after the whole time.',
      '',
      'Waited nearly an hour past my slot.',
      'Nobody at reception explained the delay.',
      '',
      'Clean, modern and well run.',
      'Would happily recommend it.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(3);
    expect(reviews[0]?.text).toContain('looked after');
    expect(reviews[1]?.text).toContain('explained the delay');
    expect(reviews[2]?.text).toContain('Would happily recommend it.');
  });

  it('handles ratings on each multiline review', () => {
    const raw = [
      '5 stars 2026-03-01',
      'Brilliant from start to finish.',
      'Everyone was friendly.',
      '',
      '2 stars 2026-02-01',
      'Long wait and poor communication.',
      'Nobody apologised.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(2);
    expect(reviews.map((r) => r.stars)).toEqual([5, 2]);
    expect(reviews.map((r) => r.reviewDate?.toISOString().slice(0, 10))).toEqual([
      '2026-03-01',
      '2026-02-01',
    ]);
  });
});

describe('mixed multiline and one-line batch', () => {
  it('gets every boundary right in one paste', () => {
    const raw = [
      '5 stars',
      'The staff were very helpful and polite.',
      'The whole experience was smooth and comfortable.',
      '',
      '"★★☆☆☆ Waited far too long past my appointment."',
      '"★★★★★ Spotless and very professional."',
      '',
      '4 stars',
      'Good service, but I had to wait longer than expected.',
      '---',
      'A final review that stands on its own.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(5);
    expect(reviews[0]?.text).toContain('smooth and comfortable');
    expect(reviews[0]?.stars).toBe(5);
    expect(reviews[1]?.stars).toBe(2);
    expect(reviews[2]?.stars).toBe(5);
    expect(reviews[3]?.stars).toBe(4);
    expect(reviews[4]?.text).toContain('stands on its own');
  });
});

// ---------------------------------------------------------------------------
// Multilingual
// ---------------------------------------------------------------------------

describe('Hindi, Marathi and Hinglish', () => {
  it('keeps a multiline Marathi review whole', () => {
    const raw = [
      '5 stars',
      'डॉक्टर खूप छान आहेत आणि सर्व काही समजावून सांगितले.',
      'स्टाफ पण मदत करणारा होता.',
      '',
      'दुसरा अभिप्राय वेगळा आहे.',
    ].join('\n');

    const reviews = parseReviews(raw, REF).reviews;
    expect(reviews).toHaveLength(2);
    expect(reviews[0]?.text).toContain('स्टाफ पण मदत करणारा होता.');
    expect(reviews[0]?.stars).toBe(5);
  });

  it('keeps separate Devanagari and Hinglish reviews separate with blank lines', () => {
    const raw = [
      'केस कापणे छान झाले पण खूप वेळ थांबावे लागले',
      '',
      'बहुत अच्छा अनुभव था, स्टाफ बहुत अच्छा है',
      '',
      'Staff bahut acche hain lekin waiting time thoda zyada hai',
    ].join('\n');

    expect(count(raw)).toBe(3);
  });

  it('keeps unmarked Devanagari lines separate when no delimiters are used', () => {
    const raw = [
      'केस कापणे छान झाले पण खूप वेळ थांबावे लागले',
      'बहुत अच्छा अनुभव था, स्टाफ बहुत अच्छा है',
      'Staff bahut acche hain lekin waiting time thoda zyada hai',
    ].join('\n');

    expect(count(raw)).toBe(3);
  });

  it('preserves the exact original wording of every language', () => {
    const raw = [
      'डॉक्टर छान आहेत पण खूप उशीर झाला',
      '',
      'बहुत अच्छा अनुभव था और स्टाफ अच्छा है',
    ].join('\n');

    expect(texts(raw)).toEqual([
      'डॉक्टर छान आहेत पण खूप उशीर झाला',
      'बहुत अच्छा अनुभव था और स्टाफ अच्छा है',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Determinism and the ambiguity rule
// ---------------------------------------------------------------------------

describe('boundary rules are deterministic and conservative', () => {
  it('produces identical output for identical input', () => {
    const raw = [
      '5 stars',
      'Wrapped review line one.',
      'Wrapped review line two.',
      '',
      '"★★★☆☆ A separate quoted one."',
    ].join('\n');

    expect(JSON.stringify(parseReviews(raw, REF))).toBe(
      JSON.stringify(parseReviews(raw, REF)),
    );
  });

  it('prefers keeping ambiguous lines together rather than inventing reviews', () => {
    // Two unmarked prose lines inside a blank-line-delimited paste. RepOS
    // cannot tell whether this is one wrapped review or two, so it keeps them
    // together rather than fabricating an extra review.
    const raw = [
      'First line of something.',
      'Second line of something.',
      '',
      'A clearly separate review.',
    ].join('\n');

    expect(count(raw)).toBe(2);
  });

  it('never returns an empty block', () => {
    for (const raw of ['', '   ', '\n\n\n', '---\n---']) {
      expect(splitBlocks(raw), JSON.stringify(raw)).toEqual([]);
    }
  });
});
