import { describe, expect, it } from 'vitest';
import { parseReaderBatch, validateReading } from '@/lib/ai/classify-reviews';
import { NOT_ENOUGH_EVIDENCE, normalizeFeedback, type AiSuggestion } from '@/lib/analysis/normalize';
import { getPackOrFallback } from '@/lib/packs';
import { routeForAi } from '@/lib/ai/route';

/**
 * M46 — THE AI READER CONTRACT AND THE COMBINED READER (final semantic pass).
 *
 * What the second reader may contribute, proved on synthetic replies: every
 * rule by which a proposed topic is refused, and every rule by which the
 * combined reader settles a disagreement. No provider is called.
 */

const restaurant = getPackOrFallback('restaurant');
const wedding = getPackOrFallback('wedding_vendor');

const topic = (key: string, polarity: string, extra: Record<string, unknown> = {}) => ({
  key,
  polarity,
  about: 'BUSINESS',
  confidence: 'HIGH',
  evidence: 'service was painfully slow',
  ...extra,
});

describe('validation: a proposed topic survives only if it is sound', () => {
  const review = { text: 'Food was excellent but service was painfully slow.', stars: 3 };

  it('accepts a grounded, business, high-confidence topic on its own side', () => {
    const r = validateReading({ sentiment: 'MIXED', confidence: 'HIGH', topics: [topic('service_speed', 'NEGATIVE')] }, review, restaurant);
    expect(r.suggestion?.issueTags).toEqual(['service_speed']);
    expect(r.rejected).toEqual([]);
  });

  it('refuses a key outside the taxonomy', () => {
    const r = validateReading({ topics: [topic('parking_nightmare', 'NEGATIVE')] }, review, restaurant);
    expect(r.suggestion?.issueTags).toEqual([]);
    expect(r.rejected).toEqual([{ key: 'parking_nightmare', why: 'NOT_IN_TAXONOMY' }]);
  });

  it('refuses a key on the wrong side, rather than flipping it', () => {
    const r = validateReading({ topics: [topic('service_speed', 'POSITIVE')] }, review, restaurant);
    expect(r.suggestion?.issueTags).toEqual([]);
    expect(r.suggestion?.praiseTags).toEqual([]);
    expect(r.rejected[0]?.why).toBe('WRONG_POLARITY');
  });

  it('refuses a topic about someone other than the business', () => {
    const late = { text: 'The baraat ran two hours late.', stars: null };
    const r = validateReading({ topics: [topic('punctuality', 'NEGATIVE', { about: 'OTHER', evidence: 'ran two hours late' })] }, late, wedding);
    expect(r.suggestion?.issueTags).toEqual([]);
    expect(r.rejected[0]?.why).toBe('NOT_ABOUT_BUSINESS');
  });

  it('refuses a low-confidence topic', () => {
    const r = validateReading({ topics: [topic('service_speed', 'NEGATIVE', { confidence: 'LOW' })] }, review, restaurant);
    expect(r.rejected[0]?.why).toBe('LOW_CONFIDENCE');
  });

  it('refuses a topic whose evidence is not the customer’s own words', () => {
    const r = validateReading({ topics: [topic('service_speed', 'NEGATIVE', { evidence: 'waited an hour for the bill' })] }, review, restaurant);
    expect(r.rejected[0]?.why).toBe('EVIDENCE_NOT_IN_TEXT');
    const none = validateReading({ topics: [topic('service_speed', 'NEGATIVE', { evidence: '' })] }, review, restaurant);
    expect(none.rejected[0]?.why).toBe('NO_EVIDENCE');
  });

  it('honours an abstention: nothing is accepted', () => {
    const r = validateReading({ abstain: true, sentiment: 'NEGATIVE', topics: [topic('service_speed', 'NEGATIVE')] }, review, restaurant);
    expect(r.suggestion?.abstain).toBe(true);
    expect(r.suggestion?.issueTags).toEqual([]);
    expect(r.suggestion?.sentiment).toBeNull();
  });

  it('does not trust a reply in the old shape, which carries no evidence', () => {
    const r = validateReading({ issues: ['service_speed'], praises: ['food_taste'], sentiment: 'MIXED' }, review, restaurant);
    expect(r.suggestion?.issueTags).toEqual([]);
    expect(r.suggestion?.praiseTags).toEqual([]);
    expect(r.rejected.map((x) => x.why)).toEqual(['NO_EVIDENCE', 'NO_EVIDENCE']);
  });

  it('parses a whole batch, and fails closed on a reply that is not JSON', () => {
    const batch = [review, { text: 'Lovely food.', stars: 5 }];
    const ok = parseReaderBatch(
      JSON.stringify({ results: [{ i: 0, topics: [topic('service_speed', 'NEGATIVE')] }, { i: 1, topics: [topic('food_taste', 'POSITIVE', { evidence: 'lovely food' })] }] }),
      batch,
      restaurant,
    );
    expect(ok?.map((r) => r.suggestion?.issueTags.concat(r.suggestion.praiseTags))).toEqual([['service_speed'], ['food_taste']]);
    expect(parseReaderBatch('I cannot help with that.', batch, restaurant)).toBeNull();
  });
});

describe('the combined reader: arbitration', () => {
  const ai = (topics: AiSuggestion['topics'], extra: Partial<AiSuggestion> = {}): AiSuggestion => ({
    issueTags: (topics ?? []).filter((t) => t.kind === 'ISSUE').map((t) => t.key),
    praiseTags: (topics ?? []).filter((t) => t.kind === 'PRAISE').map((t) => t.key),
    sentiment: null,
    topics,
    ...extra,
  });

  it('never lets the second reader add what the words deny', () => {
    const n = normalizeFeedback({
      text: 'No waiting at all, and the food was lovely.',
      stars: 5,
      pack: restaurant,
      ai: ai([{ key: 'service_speed', kind: 'ISSUE', confidence: 'HIGH', evidence: 'no waiting' }]),
    });
    expect(n.issueTags).toEqual([]);
  });

  it('never lets the second reader add what the words set aside as someone else’s', () => {
    const n = normalizeFeedback({
      text: 'The baraat ran two hours late.',
      stars: null,
      pack: wedding,
      ai: ai([{ key: 'punctuality', kind: 'ISSUE', confidence: 'HIGH', evidence: 'ran two hours late' }]),
    });
    expect(n.issueTags).toEqual([]);
    expect(n.abstentions[0]?.reason).toBe('NOT_ABOUT_BUSINESS');
  });

  it('accepts agreement, and a new concept the first reader missed', () => {
    const n = normalizeFeedback({
      text: 'The biryani was out of this world.',
      stars: 5,
      pack: restaurant,
      ai: ai([{ key: 'food_taste', kind: 'PRAISE', confidence: 'HIGH', evidence: 'out of this world' }]),
    });
    expect(n.praiseTags).toEqual(['food_taste']);
    expect(n.method).toBe('AI');
  });

  it('keeps a STRONG first reading against a contradicting suggestion', () => {
    // "painfully slow" is a specific opinion on service: the model cannot flip it.
    const n = normalizeFeedback({
      text: 'Service was painfully slow.',
      stars: 2,
      pack: restaurant,
      ai: ai([{ key: 'service_quality', kind: 'PRAISE', confidence: 'HIGH', evidence: 'service was' }]),
    });
    expect(n.issueTags).toEqual(['service_speed']);
    expect(n.praiseTags).toEqual([]);
  });

  it('lets a HIGH-confidence suggestion replace a WEAK first reading', () => {
    // 'nice' is a generic word, so the praise it gives is WEAK.
    const text = 'The paneer was nice, said nobody ever. Cold and bland.';
    const first = normalizeFeedback({ text, stars: 1, pack: restaurant, ai: null });
    expect(first.praiseTags).toEqual(['food_taste']);
    const n = normalizeFeedback({
      text,
      stars: 1,
      pack: restaurant,
      ai: ai([{ key: 'food_quality', kind: 'ISSUE', confidence: 'HIGH', evidence: 'cold and bland' }]),
    });
    expect(n.issueTags).toContain('food_quality');
    expect(n.praiseTags).not.toContain('food_taste');
  });

  it('files neither side when a WEAK first reading meets a MEDIUM contradiction', () => {
    const text = 'The paneer was nice.';
    const first = normalizeFeedback({ text, stars: null, pack: restaurant, ai: null });
    expect(first.praiseTags).toEqual(['food_taste']);
    const n = normalizeFeedback({
      text,
      stars: null,
      pack: restaurant,
      ai: ai([{ key: 'food_quality', kind: 'ISSUE', confidence: 'MEDIUM', evidence: 'the paneer was nice' }]),
    });
    expect(n.praiseTags).toEqual([]);
    expect(n.issueTags).toEqual([]);
    expect(n.conflicts.sort()).toEqual(['food_quality', 'food_taste']);
    expect(n.confidence).toBe('LOW');
  });

  it('keeps a first-reader topic the second reader did not mention', () => {
    const n = normalizeFeedback({
      text: 'Food was excellent but service was painfully slow.',
      stars: 3,
      pack: restaurant,
      ai: ai([{ key: 'food_taste', kind: 'PRAISE', confidence: 'HIGH', evidence: 'food was excellent' }]),
    });
    expect(n.issueTags).toEqual(['service_speed']);
    expect(n.praiseTags).toEqual(['food_taste']);
  });

  it('adds nothing from an abstaining second reader', () => {
    const n = normalizeFeedback({
      text: 'It was different from last time.',
      stars: null,
      pack: restaurant,
      ai: ai([{ key: 'food_quality', kind: 'ISSUE', confidence: 'HIGH', evidence: 'different from last time' }], { abstain: true }),
    });
    expect(n.issueTags).toEqual([]);
  });

  it('says so, in plain words, when nothing could be classified safely', () => {
    const n = normalizeFeedback({ text: 'It is what it is.', stars: null, pack: restaurant, ai: null });
    expect(n.unclassified).toBe(true);
    expect(n.reasons[0]).toBe(NOT_ENOUGH_EVIDENCE);
    expect(n.themes).toEqual([]);
  });
});

describe('the combined reader: corroboration and calibration (AI validation pass)', () => {
  const clinic = getPackOrFallback('clinic');
  const gym = getPackOrFallback('gym');
  const coaching = getPackOrFallback('coaching');
  const ai = (topics: AiSuggestion['topics'], extra: Partial<AiSuggestion> = {}): AiSuggestion => ({
    issueTags: (topics ?? []).filter((t) => t.kind === 'ISSUE').map((t) => t.key),
    praiseTags: (topics ?? []).filter((t) => t.kind === 'PRAISE').map((t) => t.key),
    sentiment: null,
    topics,
    ...extra,
  });

  it('files nothing from evidence that names nothing', () => {
    const n = normalizeFeedback({
      text: 'Totally worth it.',
      stars: 5,
      pack: gym,
      ai: ai([{ key: 'value_pricing', kind: 'PRAISE', confidence: 'HIGH', evidence: 'totally worth it' }]),
    });
    expect(n.praiseTags).toEqual([]);
  });

  it('refuses a new topic whose evidence is a clause about someone else, and its tone', () => {
    const n = normalizeFeedback({
      text: 'Classes stopped for a week because of the city-wide strike.',
      stars: 3,
      pack: coaching,
      ai: ai([{ key: 'schedule_reliability', kind: 'ISSUE', confidence: 'HIGH', evidence: 'Classes stopped for a week' }], { sentiment: 'NEGATIVE' }),
    });
    expect(n.issueTags).toEqual([]);
    expect(n.sentiment).toBe('NEUTRAL');
  });

  it('refuses a new complaint that contradicts the rating where someone else is in the story', () => {
    const n = normalizeFeedback({
      text: "Another patient's child was crying the whole time, nothing the staff could do.",
      stars: 4,
      pack: clinic,
      ai: ai([{ key: 'staff_behaviour', kind: 'ISSUE', confidence: 'HIGH', evidence: 'nothing the staff could do' }]),
    });
    expect(n.issueTags).toEqual([]);
  });

  it('needs the rating or the wording to back a MEDIUM suggestion', () => {
    const unbacked = normalizeFeedback({
      text: 'The paneer was different from last time.',
      stars: null,
      pack: restaurant,
      ai: ai([{ key: 'food_quality', kind: 'ISSUE', confidence: 'MEDIUM', evidence: 'different from last time' }]),
    });
    expect(unbacked.issueTags).toEqual([]);
    const backed = normalizeFeedback({
      text: 'The paneer was different from last time.',
      stars: 2,
      pack: restaurant,
      ai: ai([{ key: 'food_quality', kind: 'ISSUE', confidence: 'MEDIUM', evidence: 'different from last time' }]),
    });
    expect(backed.issueTags).toEqual(['food_quality']);
  });

  it('never makes a reading HIGH on the second reader alone', () => {
    const n = normalizeFeedback({
      text: 'The biryani was out of this world.',
      stars: 5,
      pack: restaurant,
      ai: ai([{ key: 'food_taste', kind: 'PRAISE', confidence: 'HIGH', evidence: 'out of this world' }]),
    });
    expect(n.praiseTags).toEqual(['food_taste']);
    expect(n.confidence).not.toBe('HIGH');
  });

  it('never makes a reading HIGH when the subject of a who-did-it clause is not plainly the business', () => {
    const n = normalizeFeedback({ text: 'Our caterer served dinner an hour late.', stars: 2, pack: wedding, ai: null });
    expect(n.confidence).not.toBe('HIGH');
    const plain = normalizeFeedback({ text: 'The photographer arrived an hour late.', stars: 1, pack: wedding, ai: null });
    expect(plain.issueTags).toEqual(['punctuality']);
  });

  it('sets aside a cause stated as a passive agent, but not the business as agent', () => {
    const outage = normalizeFeedback({ text: 'Our registration was delayed by a court holiday.', stars: 3, pack: getPackOrFallback('real_estate'), ai: null });
    expect(outage.issueTags).toEqual([]);
    expect(outage.abstentions[0]?.reason).toBe('NOT_ABOUT_BUSINESS');
    const kitchen = normalizeFeedback({ text: 'Our order was delayed by the kitchen staff forgetting it.', stars: 2, pack: restaurant, ai: null });
    expect(kitchen.issueTags).toContain('service_speed');
  });

  it('reads praise, a semicolon and an unread half as mixed at a middle rating, and asks the second reader', () => {
    const n = normalizeFeedback({ text: 'Friendly nurses; the forms were endless.', stars: 3, pack: clinic, ai: null });
    expect(n.sentiment).toBe('MIXED');
    expect(routeForAi({ text: 'Friendly nurses; the forms were endless.', stars: 3 }, clinic).reason).toBe('CONTRAST_UNREAD');
    const five = normalizeFeedback({ text: 'Friendly nurses; the forms were endless.', stars: 5, pack: clinic, ai: null });
    expect(five.sentiment).toBe('POSITIVE');
  });
});
