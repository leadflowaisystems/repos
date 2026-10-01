import { v2, type V2Example } from './semantic-v2';

/**
 * DEVELOPMENT, ROUND THREE (final correctness gate, second cycle): 27 new
 * examples for the general classes the second blind set exposed, written in
 * new words — never its sentences:
 *
 *   a state that changes over time with no "used to" ("…in January, then…",
 *   "…until we signed, now…"); a "but" whose second half uses a word the
 *   reader has never seen; pros and cons joined by a semicolon; look-alikes
 *   such as "waiting staff"; sarcasm built on "well done" / "great work" and a
 *   verb; a deliverable's delay told as "the delivery came after…".
 */
const d = (...args: Parameters<typeof v2> extends [unknown, ...infer R] ? R : never) => v2('DEV', ...args);

export const SEMANTIC_V2_DEV3: V2Example[] = [
  // A state that changed: the later one is current.
  d('gx31', 'gym', 'temporal', 'The new bikes were great in January, then half of them stopped working.', 2, 'NEGATIVE', { i: ['equipment_condition'], x: ['equipment_quality'] }),
  d('cx31', 'clinic', 'temporal', 'The swelling went down at first, then it came back worse.', 2, 'NEGATIVE', { i: ['treatment_outcome'], x: ['good_outcome'] }),
  d('sx31', 'salon', 'temporal', 'My nails looked perfect on day one, then chipped by day three.', 2, 'NEGATIVE', { i: ['service_result'], x: ['stylist_skill'] }),
  d('ex31', 'real_estate', 'temporal', 'He was quick to reply until we signed, now he never picks up.', 1, 'NEGATIVE', { i: ['post_deal_support'], t: ['responsiveness'], x: ['responsiveness_praise'] }),
  d('wx31', 'wedding_vendor', 'temporal', 'The coordinator was very responsive during booking, then went quiet before the wedding.', 2, 'NEGATIVE', { i: ['communication'], x: ['communication_praise'] }),
  d('kx31', 'coaching', 'temporal', 'Classes were regular for the first month, then got cancelled every week.', 2, 'NEGATIVE', { i: ['schedule_reliability'], x: ['discipline'] }),
  d('rx31', 'restaurant', 'temporal', 'The biryani was delicious on our first visit, then bland every time after.', 2, 'NEGATIVE', { i: ['food_quality'], x: ['food_taste'] }),

  // "But": the second half is the other way, even when its words are unfamiliar.
  d('rx32', 'restaurant', 'mixed', 'Lovely ambience, but the rotis were chewy.', 3, 'MIXED', { p: ['ambience'], t: ['food_quality'] }),
  d('cx32', 'clinic', 'mixed', 'The nurse was sweet, but the consent form was confusing.', 3, 'MIXED', { p: ['staff_friendly'] }),
  d('gx32', 'gym', 'mixed', 'Great trainers, though the stretching zone is cramped.', 3, 'MIXED', { p: ['trainer_quality'], t: ['crowding'] }),
  d('sx32', 'salon', 'mixed', 'Good haircut, however the wash basin area was dusty.', 3, 'MIXED', { p: ['stylist_skill'], t: ['cleanliness_space'] }),
  d('wx32', 'wedding_vendor', 'mixed', 'Gorgeous photos, but the delivery took four months.', 3, 'MIXED', { p: ['output_quality'], i: ['delivery_delay'] }),
  d('kx32', 'coaching', 'mixed', 'Helpful teachers, but the fees keep rising.', 3, 'MIXED', { t: ['faculty_support', 'teaching_quality_praise', 'fee_transparency'] }),
  d('ex32', 'real_estate', 'mixed', 'Nice options, but he added charges we never agreed to.', 3, 'MIXED', { p: ['options_shown'], i: ['hidden_charges'] }),
  d('rx33', 'restaurant', 'mixed', 'Friendly owner, but the portions shrank.', 3, 'MIXED', { p: ['staff_warmth'], t: ['pricing_value'] }),

  // Pros and cons joined by a semicolon.
  d('cx33', 'clinic', 'clause', 'Thorough doctor; chaotic reception.', 3, 'MIXED', { p: ['doctor_care'], t: ['staff_behaviour'] }),
  d('gx33', 'gym', 'clause', 'Spotless floors; soggy towels.', 3, 'MIXED', { p: ['cleanliness_praise'], t: ['cleanliness'] }),

  // Look-alikes: "waiting" that is not a wait.
  d('sx33', 'salon', 'negation', 'The waiting sofa was torn.', 3, 'NEGATIVE', { also: ['NEUTRAL'], t: ['cleanliness_space'], x: ['wait_time'] }),
  d('cx34', 'clinic', 'positive', 'Waiting chairs are comfortable and clean.', 5, 'POSITIVE', { t: ['clean_facility'], x: ['wait_time'] }),
  d('rx34', 'restaurant', 'positive', 'The waiting staff were lovely.', 5, 'POSITIVE', { p: ['staff_warmth'], x: ['service_speed'] }),

  // Sarcasm built on "well done" / "great work" and a verb.
  d('rx35', 'restaurant', 'sarcasm', 'Well done serving us raw chicken.', 1, 'NEGATIVE', { i: ['food_quality'], x: ['food_taste', 'service_quality'], ai: true }),
  d('gx34', 'gym', 'sarcasm', 'Nice job losing my locker key twice.', 1, 'NEGATIVE', { t: ['staff_behaviour'], x: ['trainer_quality', 'equipment_quality'], ai: true }),
  d('wx33', 'wedding_vendor', 'sarcasm', 'Great work cutting off half our faces in the photos.', 1, 'NEGATIVE', { t: ['quality_vs_sample', 'coverage_gaps'], x: ['output_quality'], ai: true }),

  // A deliverable's delay, told as "the delivery came after…".
  d('wx34', 'wedding_vendor', 'quantitative', 'The final delivery came after seven months.', 1, 'NEGATIVE', { i: ['delivery_delay'] }),
  d('wx35', 'wedding_vendor', 'quantitative', 'Delivery of the album took almost a year.', 2, 'NEGATIVE', { i: ['delivery_delay'] }),

  // A rating against words the reader does not know.
  d('gx35', 'gym', 'rating_disagrees', 'The rowing machine squeaks and wobbles.', 5, 'MIXED', { also: ['NEGATIVE'], t: ['equipment_condition'] }),
  d('kx33', 'coaching', 'rating_disagrees', 'Half the syllabus was rushed through in the last week.', 4, 'MIXED', { also: ['NEGATIVE'], t: ['teaching_quality'] }),
];
