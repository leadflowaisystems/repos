import type { EvalExample, EvalSentiment } from './semantic-dataset';

/**
 * THE EARLIER CORPORA, RELABELLED FOR THE CAFÉ TAXONOMY (October 2026).
 *
 * The café handover pass gave the restaurant pack its own topics for what a
 * café is judged on most: "Served cold / not hot" (out of "Food & taste"),
 * "Small portions" (out of "Pricing / value for money"), "Coffee & drinks" /
 * "Great coffee & drinks", and "Generous portions". Crowding moved from
 * "Long wait for a table" to "Ambience / noise / seating".
 *
 * The earlier corpora were labelled against the old restaurant topics. Their
 * MEANING is unchanged — "cold food" is still a complaint that the food was
 * cold — so only the topic key it lands on moves. Each restaurant example the
 * change touches is listed here, with its new label, and applied when the
 * corpora are loaded. The frozen corpus files themselves are not edited, so
 * their pinned hashes still prove they were never tuned against.
 *
 * Nothing outside the restaurant pack is relabelled.
 */
type Relabel = Partial<Pick<EvalExample['expected'], 'praise' | 'issues' | 'tolerated' | 'prohibited'>> & {
  alsoAccept?: EvalSentiment[];
  why: string;
};

export const CAFE_RELABELS: Record<string, Relabel> = {
  r07: { issues: ['served_cold', 'staff_behaviour'], why: '"food was cold" is served cold' },
  r10: { issues: ['served_cold', 'order_accuracy', 'cleanliness'], why: '"cold food" is served cold' },
  r15: { issues: ['served_cold', 'service_speed'], why: '"खाना ठंडा था" is served cold' },
  r30: { issues: ['portion_size', 'cleanliness'], why: '"portions were small" is small portions' },
  r33: { issues: ['served_cold', 'staff_behaviour'], why: '"cold food" is served cold' },
  r35: { praise: ['drink_praise'], prohibited: ['drink_quality', 'served_cold'], why: '"the cold coffee" is the drink, praised' },
  r37: {
    tolerated: ['ambience_noise', 'food_taste'],
    alsoAccept: ['MIXED'],
    why: 'crowding is filed under ambience now, not a wait for a table; noting it is a mild negative',
  },
  rx4: { issues: ['served_cold', 'service_speed'], why: '"arrived cold" is served cold' },
  rv16: { issues: ['served_cold', 'staff_behaviour'], why: '"cold food" is served cold' },
  rv21: { issues: ['served_cold'], why: '"खाना ठंडा था" is served cold' },
  rv27: { praise: ['value_for_money', 'generous_portions'], why: '"portions were generous" is generous portions' },
  rl03: { issues: ['served_cold'], why: '"starters were cold" is served cold' },
  rl04: { issues: ['portion_size'], tolerated: ['pricing_value'], why: '"portions were tiny for the price" is small portions, and arguably value' },
  rl09: { issues: ['service_speed', 'served_cold'], why: '"cold pizza" is served cold' },
  rf07: { issues: ['served_cold', 'service_speed'], why: '"cold food" is served cold' },
  // The café attribution rule (handover requirement): an order that travelled
  // with a delivery partner and arrived cold or damaged is not filed against
  // the café unless the response says the café caused it, and the courier's
  // part does not count against the café's tone.
  rv01: {
    issues: [],
    tolerated: ['served_cold'],
    alsoAccept: ['NEUTRAL'],
    why: 'the delivery partner was late; that the food arrived cold is not the café’s on these words',
  },
  rd06: { alsoAccept: ['NEUTRAL'], why: 'the courier dropped the order; nothing here is about the café' },
};

/** The examples with the café relabels applied. Copies; the corpus objects are untouched. */
export function withCafeRelabels<T extends { id: string; pack: string; expected: EvalExample['expected'] }>(examples: T[]): T[] {
  return examples.map((e) => {
    const r = CAFE_RELABELS[e.id];
    if (!r || e.pack !== 'restaurant') return e;
    const { why: _why, alsoAccept, ...labels } = r;
    return {
      ...e,
      expected: {
        ...e.expected,
        ...labels,
        alsoAccept: alsoAccept ? [...new Set([...(e.expected.alsoAccept ?? []), ...alsoAccept])] : e.expected.alsoAccept,
      },
    };
  });
}
