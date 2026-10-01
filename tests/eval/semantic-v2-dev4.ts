import { v2, type V2Example } from './semantic-v2';

/**
 * DEVELOPMENT, ROUND FOUR (AI validation pass): 26 new examples for the general
 * classes still failing, in new words: a cause stated as a passive agent ("held
 * up by a power failure"), people placed by position ("the man behind me"),
 * trades that may or may not be the business (abstain or ask the second
 * reader, never guess), generic praise with no object ("worth it", "lovely
 * place"), pros and cons split by a semicolon in words the reader does not
 * know, "kind" as a quality rather than "kind of", and weight lost in other
 * words. Tuned against.
 */
const d = (...args: Parameters<typeof v2> extends [unknown, ...infer R] ? R : never) => v2('DEV', ...args);

export const SEMANTIC_V2_DEV4: V2Example[] = [
  // A cause stated as a passive agent.
  d('wy41', 'wedding_vendor', 'attribution', 'The ceremony was held up by a power failure.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['punctuality'], abstain: true }),
  d('ky41', 'coaching', 'attribution', 'The mock test was cancelled by the board because of the elections.', 3, 'NEUTRAL', { a: ['schedule_reliability'], abstain: true }),
  d('ey41', 'real_estate', 'attribution', 'Our registration was delayed by a court holiday.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['documentation_delay'], abstain: true }),
  d('ry41', 'restaurant', 'attribution', 'Our order was delayed by the kitchen staff forgetting it.', 2, 'NEGATIVE', { i: ['service_speed'], t: ['order_accuracy'] }),

  // People placed by position.
  d('ry42', 'restaurant', 'attribution', 'The man behind me in the queue was rude.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['staff_behaviour'], abstain: true }),
  d('sy41', 'salon', 'attribution', 'The lady next to me complained loudly the whole time.', 4, 'NEUTRAL', { also: ['POSITIVE', 'NEGATIVE'], a: ['staff_behaviour'], abstain: true }),
  d('cy41', 'clinic', 'attribution', 'The family in front of us shouted at the doctor.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['staff_behaviour', 'consultation_rush'], abstain: true }),

  // A trade that may or may not be the business: do not guess.
  d('wy42', 'wedding_vendor', 'attribution', 'Our DJ started an hour late.', 2, 'NEGATIVE', { also: ['NEUTRAL'], t: ['punctuality'] }),
  d('cy42', 'clinic', 'attribution', 'The lab took three days to send the report.', 2, 'NEGATIVE', { also: ['NEUTRAL'], t: ['followup_communication'] }),

  // Generic praise with no object names no topic.
  d('gy41', 'gym', 'vague', 'Totally worth it.', 5, 'POSITIVE', { x: ['value_pricing'], abstain: true }),
  d('gy42', 'gym', 'positive', 'Worth the money.', 5, 'POSITIVE', { p: ['value_pricing'] }),
  d('ry43', 'restaurant', 'vague', 'Lovely place.', 5, 'POSITIVE', { t: ['ambience'], abstain: true }),
  d('sy42', 'salon', 'positive', 'Good place, nice people.', 5, 'POSITIVE', { p: ['staff_warmth'], x: ['ambience'] }),
  d('cy43', 'clinic', 'vague', 'Great experience overall.', 5, 'POSITIVE', { abstain: true }),

  // Pros and cons split by a semicolon, in unfamiliar words.
  d('gy43', 'gym', 'clause', 'Patient trainers; the playlist is ear-splitting.', 3, 'MIXED', { p: ['trainer_quality'], t: ['atmosphere'] }),
  d('cy44', 'clinic', 'clause', 'Friendly nurses; the forms were endless.', 3, 'MIXED', { p: ['staff_friendly'] }),
  d('ey42', 'real_estate', 'clause', 'Clear about every cost; the paperwork was sluggish.', 3, 'MIXED', { p: ['transparency'], i: ['documentation_delay'] }),

  // "Kind" as a quality, not "kind of".
  d('cy45', 'clinic', 'clause', 'Kind nurse, rushed doctor.', 3, 'MIXED', { p: ['staff_friendly'], i: ['consultation_rush'], x: ['doctor_care'] }),
  d('ry44', 'restaurant', 'negative', 'What kind of service is this?', 1, 'NEGATIVE', { also: ['NEUTRAL'], x: ['staff_warmth', 'service_quality'], ai: true }),

  // Weight lost, in other words.
  d('gy44', 'gym', 'positive', 'Dropped 5 kg in two months.', 5, 'POSITIVE', { p: ['results'] }),
  d('gy45', 'gym', 'positive', 'Shed 4 kilos since joining.', 5, 'POSITIVE', { p: ['results'] }),

  // An ambiguous adjective attaches to its own thing.
  d('sy43', 'salon', 'clause', 'Neat haircut, but the staff were cold.', 3, 'MIXED', { p: ['stylist_skill'], i: ['staff_behaviour'], x: ['hygiene_praise'] }),
  d('ry45', 'restaurant', 'clause', 'Way too loud to talk, though the food was fine.', 3, 'MIXED', { also: ['NEGATIVE'], i: ['ambience_noise'], t: ['food_taste'] }),

  // Gate examples, as the gate states them.
  d('ry46', 'restaurant', 'mixed', 'Staff were lovely, but the bill took forever.', 3, 'MIXED', { p: ['staff_warmth'], i: ['service_speed'], t: ['billing_issue'] }),
  d('cy46', 'clinic', 'mixed', 'Doctor was excellent, but I waited an hour.', 3, 'MIXED', { p: ['doctor_care'], i: ['wait_time'] }),
  d('wy43', 'wedding_vendor', 'attribution', 'The weather delayed the ceremony.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['punctuality'], abstain: true }),
];
