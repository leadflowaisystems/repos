import { describe, expect, it } from 'vitest';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { getPackOrFallback } from '@/lib/packs';

/**
 * M46 — THE STAR RATING AGAINST THE WORDS, EVERY COMBINATION.
 *
 * 1–5 stars × positive / negative / mixed / neutral wording, in every
 * vertical. The rating is evidence; it never erases what was written:
 *
 *   the topics come from the words alone, at every rating;
 *   clear wording + agreeing rating       → that direction
 *   clear wording + a middle (3★) rating  → the wording's direction
 *   clear wording + an opposite rating    → MIXED, both kept
 *   mixed wording                         → MIXED at every rating
 *   neutral wording                       → the rating's direction, and
 *                                           NEUTRAL for a middle rating
 */

const TEXTS: Record<string, { positive: string; negative: string; mixed: string; neutral: string; praise: string; issue: string }> = {
  restaurant: {
    positive: 'The biryani was delicious.',
    negative: 'Service was painfully slow.',
    mixed: 'The biryani was delicious but service was painfully slow.',
    neutral: 'We came for lunch on Sunday.',
    praise: 'food_taste',
    issue: 'service_speed',
  },
  clinic: {
    positive: 'The doctor was very thorough.',
    negative: 'The washroom was dirty.',
    mixed: 'The doctor was very thorough but the washroom was dirty.',
    neutral: 'I visited for a routine check-up.',
    praise: 'doctor_care',
    issue: 'cleanliness',
  },
  coaching: {
    positive: 'The teachers explain concepts clearly.',
    negative: 'Fees are too high.',
    mixed: 'The teachers explain concepts clearly but fees are too high.',
    neutral: 'My son joined the evening batch.',
    praise: 'teaching_quality_praise',
    issue: 'fee_transparency',
  },
  gym: {
    positive: 'The trainers are knowledgeable.',
    negative: 'Half the machines are broken.',
    mixed: 'The trainers are knowledgeable but half the machines are broken.',
    neutral: 'I go in the mornings.',
    praise: 'trainer_quality',
    issue: 'equipment_condition',
  },
  real_estate: {
    positive: 'Very transparent about every cost.',
    negative: 'Documentation took forever.',
    mixed: 'Very transparent about every cost but documentation took forever.',
    neutral: 'We were looking for a 2BHK.',
    praise: 'transparency',
    issue: 'documentation_delay',
  },
  salon: {
    positive: 'Great haircut.',
    negative: 'The combs were dirty.',
    mixed: 'Great haircut but the combs were dirty.',
    neutral: 'I went in for a trim.',
    praise: 'stylist_skill',
    issue: 'hygiene',
  },
  wedding_vendor: {
    positive: 'The photos are stunning.',
    negative: 'The album took eight months.',
    mixed: 'The photos are stunning but the album took eight months.',
    neutral: 'They covered our reception.',
    praise: 'output_quality',
    issue: 'delivery_delay',
  },
};

const expected = (kind: 'positive' | 'negative' | 'mixed' | 'neutral', stars: number): string => {
  if (kind === 'mixed') return 'MIXED';
  const rating = stars >= 4 ? 'POSITIVE' : stars <= 2 ? 'NEGATIVE' : 'MIDDLE';
  if (kind === 'neutral') return rating === 'MIDDLE' ? 'NEUTRAL' : rating;
  const words = kind === 'positive' ? 'POSITIVE' : 'NEGATIVE';
  if (rating === 'MIDDLE' || rating === words) return words;
  return 'MIXED';
};

describe('the rating is evidence; it never erases the words', () => {
  for (const [packId, t] of Object.entries(TEXTS)) {
    const pack = getPackOrFallback(packId);
    for (const kind of ['positive', 'negative', 'mixed', 'neutral'] as const) {
      for (const stars of [1, 2, 3, 4, 5]) {
        it(`${packId} · ${kind} words · ${stars}★`, () => {
          const n = normalizeFeedback({ text: t[kind], stars, pack, ai: null });
          expect(n.sentiment).toBe(expected(kind, stars));
          // The topics come from the words, at every rating.
          const wantPraise = kind === 'positive' || kind === 'mixed' ? [t.praise] : [];
          const wantIssue = kind === 'negative' || kind === 'mixed' ? [t.issue] : [];
          expect(n.praiseTags).toEqual(wantPraise);
          expect(n.issueTags).toEqual(wantIssue);
        });
      }
    }
  }
});
