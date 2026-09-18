import { describe, expect, it } from 'vitest';
import type { FeedbackRow } from '@/lib/feedback/service';
import { translatorFor } from '@/lib/i18n/translator';
import { getPackOrFallback } from '@/lib/packs';
import { reviewItemOf } from './pages';

/**
 * A CUSTOMER'S OWN SIGNALS OUTRANK A TONE READING (owner UX pass).
 *
 * The trust break this pins: a customer rated 5/5 AND tapped "Spice level was
 * wrong", and the entry said "Positive in tone · Sorted as Praise". The overall
 * tone is composed from stars and words; the problems a customer taps never
 * reach it. So the entry now says both halves — the rating stays what it was,
 * and nothing stored is rewritten.
 */

const en = translatorFor('en');

function row(overrides: Partial<FeedbackRow>): FeedbackRow {
  return {
    id: 'r1',
    clientId: 'c1',
    text: '',
    preview: '',
    stars: 5,
    reviewDate: new Date('2026-09-01T10:00:00Z'),
    source: 'REP_OS_QR',
    sourceLabel: 'Feedback card',
    redacted: false,
    redactions: [],
    analysed: true,
    state: 'ANALYSED',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    sentiment: 'POSITIVE',
    themes: [],
    confidence: 'HIGH',
    reasons: [],
    language: 'en',
    analysisError: null,
    responseClass: 'PRAISE',
    responseAction: 'REPLY_OPTIONAL',
    priorityBand: 'LOW',
    priorityRank: 0,
    priorityReasons: [],
    draftText: null,
    draftLanguage: null,
    draftSource: 'NONE',
    draftStatus: 'NONE',
    draftCurrent: false,
    draftNotes: [],
    draftError: null,
    handledAt: null,
    answers: [],
    ...overrides,
  } as unknown as FeedbackRow;
}

const food = (rating: number, signals: string[] = [], positiveSignals: string[] = []) => ({
  key: 'food',
  label: 'Food',
  rating,
  signals,
  positiveSignals,
});
const service = (rating: number, signals: string[] = [], positiveSignals: string[] = []) => ({
  key: 'service',
  label: 'Service',
  rating,
  signals,
  positiveSignals,
});

describe('a good rating with a problem is never shown as pure praise', () => {
  it('5/5 + "Spice level was wrong" says both halves, and is not sorted as Praise', () => {
    const item = reviewItemOf(row({ answers: [food(5, ['Spice level was wrong'])] }), en);
    expect(item.stars).toBe(5);
    expect(item.sentimentLabel).toBe('Positive overall, with one problem: Spice level was wrong');
    expect(item.sentimentLabel).not.toBe('Positive');
    expect(item.classLabel).not.toBe('Praise');
    expect(item.sentiment).toBe('MIXED');
    expect(item.gave.selected).toEqual(['Food: Spice level was wrong']);
  });

  it('4/5 + "Rude or dismissive" + "Felt rushed" counts both problems', () => {
    const item = reviewItemOf(
      row({ stars: 4, answers: [service(3, ['Rude or dismissive', 'Felt rushed'])] }),
      en,
    );
    expect(item.sentimentLabel).toBe('Positive overall, with 2 problems mentioned');
    expect(item.classLabel).not.toBe('Praise');
  });

  it('a part rated 1 or 2 is a problem even when nothing was tapped', () => {
    const item = reviewItemOf(row({ answers: [food(5), service(2)] }), en);
    expect(item.sentimentLabel).toBe('Positive overall, with one problem: Service');
  });

  it('leaves genuine praise alone', () => {
    const item = reviewItemOf(row({ answers: [food(5, [], ['Great taste'])] }), en);
    expect(item.sentimentLabel).toBe('Positive');
    expect(item.classLabel).toBe('Praise');
    expect(item.sentiment).toBe('POSITIVE');
    // And keeps what they liked, which used to be dropped.
    expect(item.gave.liked).toEqual(['Food: Great taste']);
  });

  it('never softens a negative reading because the customer also liked something', () => {
    const item = reviewItemOf(
      row({ stars: 2, sentiment: 'NEGATIVE', responseClass: 'COMPLAINT', answers: [food(4, [], ['Great taste']), service(1, ['Felt rushed'])] }),
      en,
    );
    expect(item.sentiment).toBe('NEGATIVE');
    expect(item.classLabel).toBe('Complaint');
  });

  it('says it in Hindi and Marathi too', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const item = reviewItemOf(row({ answers: [food(5, ['Spice level was wrong'])] }), translatorFor(locale));
      expect(item.sentimentLabel).toMatch(/[ऀ-ॿ]/);
      expect(item.sentimentLabel).toContain('Spice level was wrong');
    }
  });
});

describe('one name for one subject, whichever side of the ledger', () => {
  it('names food the same in a complaint and in praise, under two different keys', () => {
    const pack = getPackOrFallback('restaurant');
    const complaint = pack.issueTaxonomy.find((t) => t.key === 'food_quality')!;
    const praise = pack.praiseTaxonomy.find((t) => t.key === 'food_taste')!;
    expect(complaint.label).toBe(praise.label);
    expect(complaint.key).not.toBe(praise.key);
    for (const locale of ['en', 'hi', 'mr'] as const) {
      const t = translatorFor(locale);
      expect(t.soft('pack.restaurant.food_quality')).toBe(t.soft('pack.restaurant.food_taste'));
    }
  });
});
