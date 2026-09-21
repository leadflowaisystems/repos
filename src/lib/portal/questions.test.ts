import { describe, expect, it } from 'vitest';
import type { FeedbackRow } from '@/lib/feedback/service';
import { translatorFor } from '@/lib/i18n/translator';
import { getPackOrFallback } from '@/lib/packs';
import { reviewItemOf } from './pages';

/**
 * EVERY QUESTION, WITH ITS OWN TAGS.
 *
 * A response that came through the feedback form is read against the whole
 * form: every question the business asks, in the form's order, with the
 * customer's rating — or null when they skipped it, never a guessed value —
 * and exactly the tags they tapped under that question. A pasted public
 * review was asked no questions and lists none. Same code for every business.
 */

const en = translatorFor('en');
const restaurant = getPackOrFallback('restaurant');
const asked = (restaurant.gateway?.dimensions ?? []).map((d) => d.label);

function row(overrides: Partial<FeedbackRow>): FeedbackRow {
  return {
    id: 'r1',
    clientId: 'c1',
    text: '',
    stars: 4,
    reviewDate: new Date('2026-09-01T10:00:00Z'),
    source: 'REP_OS_QR',
    sourceLabel: 'Feedback card',
    state: 'ANALYSED',
    sentiment: 'POSITIVE',
    themes: [],
    responseClass: 'PRAISE',
    answers: [],
    ...overrides,
  } as unknown as FeedbackRow;
}

describe('each response lists every question of the form', () => {
  it('lists all the questions in the form’s order, answered or not', () => {
    const item = reviewItemOf(
      row({
        answers: [
          { key: 'waiting', label: 'Waiting', rating: 2, signals: ['For the food'], positiveSignals: [] },
          { key: 'food', label: 'Food and drink', rating: 5, signals: [], positiveSignals: ['Great taste', 'Fresh'] },
        ],
      }),
      en,
      restaurant.id,
    );
    expect(asked).toHaveLength(5);
    expect(item.gave.questions.map((q) => q.label)).toEqual(asked);
    const by = Object.fromEntries(item.gave.questions.map((q) => [q.label, q]));
    expect(by['Food and drink']).toEqual({ label: 'Food and drink', rating: 5, liked: ['Great taste', 'Fresh'], problems: [] });
    expect(by['Waiting']).toEqual({ label: 'Waiting', rating: 2, liked: [], problems: ['For the food'] });
    // Skipped questions are skipped: no rating, no tags, nothing invented.
    for (const label of ['Service', 'Cleanliness', 'Value for money']) {
      expect(by[label]).toEqual({ label, rating: null, liked: [], problems: [] });
    }
  });

  it('shows a rating-only form response as every question skipped', () => {
    const item = reviewItemOf(row({ answers: [] }), en, restaurant.id);
    expect(item.gave.questions).toHaveLength(5);
    expect(item.gave.questions.every((q) => q.rating === null && q.liked.length === 0 && q.problems.length === 0)).toBe(true);
  });

  it('lists no questions for a pasted public review', () => {
    const item = reviewItemOf(row({ source: 'PUBLIC_REVIEW', text: 'Lovely food.', answers: [] }), en, restaurant.id);
    expect(item.gave.questions).toEqual([]);
  });

  it('works the same for every vertical', () => {
    for (const vertical of ['clinic', 'coaching', 'gym', 'real_estate', 'salon', 'wedding_vendor']) {
      const pack = getPackOrFallback(vertical);
      const item = reviewItemOf(row({ answers: [] }), en, pack.id);
      expect(item.gave.questions.map((q) => q.label), vertical).toEqual((pack.gateway?.dimensions ?? []).map((d) => d.label));
    }
  });
});
