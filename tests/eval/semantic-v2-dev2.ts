import { v2, type V2Example } from './semantic-v2';

/**
 * DEVELOPMENT, ROUND TWO (final correctness gate): 38 new examples.
 *
 * Written for general failure classes the first development set did not
 * exercise: one opinion word attached to one named person or thing, states
 * bounded in time ("lovely for a week and then…"), elided predicates ("the
 * showers aren't"), complaints with no topic anchor, third parties named
 * through a qualifier ("the decorator from the venue"), and the gate's own
 * examples. Tuned against, like the first development set. No sentence is
 * taken from either blind set.
 */
const d = (...args: Parameters<typeof v2> extends [unknown, ...infer R] ? R : never) => v2('DEV', ...args);

export const SEMANTIC_V2_DEV2: V2Example[] = [
  // One opinion word, one named person or thing.
  d('rd01', 'restaurant', 'clause', 'The chef was friendly and came out to say hello.', 5, 'POSITIVE', { p: ['staff_warmth'] }),
  d('cd01', 'clinic', 'clause', 'Very gentle nurse, and a patient dentist.', 5, 'POSITIVE', { p: ['staff_friendly', 'doctor_care'] }),
  d('cd02', 'clinic', 'clause', 'The receptionist was kind but the doctor seemed rushed.', 3, 'MIXED', { p: ['staff_friendly'], i: ['consultation_rush'], x: ['doctor_care'] }),
  d('kd01', 'coaching', 'clause', 'Supportive management, but the maths teacher is boring.', 3, 'MIXED', { i: ['teaching_quality'], t: ['faculty_support'], x: ['teaching_quality_praise'] }),
  d('kd02', 'coaching', 'positive', 'Patient teachers who never make you feel stupid.', 5, 'POSITIVE', { p: ['faculty_support'], t: ['teaching_quality_praise'] }),
  d('sd01', 'salon', 'clause', 'The stylist listened carefully and the cut is exactly what I wanted.', 5, 'POSITIVE', { p: ['stylist_skill'], t: ['consultation', 'staff_warmth'] }),
  d('wd01', 'wedding_vendor', 'positive', 'Calm photographer, polite assistants.', 5, 'POSITIVE', { p: ['team_conduct'] }),
  d('gd01', 'gym', 'clause', 'Friendly trainers but the front desk is rude.', 3, 'MIXED', { p: ['trainer_quality'], i: ['staff_behaviour'] }),
  d('ed01', 'real_estate', 'attribution', 'Patient agent, impatient seller.', 4, 'POSITIVE', { also: ['MIXED'], t: ['no_pressure'], x: ['pressure_tactics'] }),

  // A state bounded in time: the later state is the current one.
  d('sd02', 'salon', 'temporal', 'The highlights were lovely for a week and then went brassy.', 2, 'NEGATIVE', { also: ['MIXED'], i: ['service_result'], x: ['stylist_skill'] }),
  d('gd02', 'gym', 'temporal', 'The new treadmills worked well at first, then broke within a month.', 2, 'NEGATIVE', { i: ['equipment_condition'], x: ['equipment_quality'] }),
  d('rd02', 'restaurant', 'temporal', 'Initially the service was quick, but these days it takes forever.', 2, 'NEGATIVE', { i: ['service_speed'], x: ['service_quality'] }),
  d('cd03', 'clinic', 'temporal', 'The pain went away for two days and then came back.', 2, 'NEGATIVE', { i: ['treatment_outcome'], x: ['good_outcome'] }),
  d('wd02', 'wedding_vendor', 'temporal', 'They replied quickly before the booking, then stopped responding.', 2, 'NEGATIVE', { i: ['communication'], x: ['communication_praise'] }),

  // Elided predicates: "X is good, Y isn't".
  d('gd03', 'gym', 'clause', "The equipment is good, the showers aren't.", 3, 'MIXED', { p: ['equipment_quality'], t: ['cleanliness'] }),
  d('rd03', 'restaurant', 'clause', 'Starters were great, the mains not so much.', 3, 'MIXED', { p: ['food_taste'], t: ['food_quality'] }),
  d('kd03', 'coaching', 'clause', "Physics is taught well; chemistry isn't.", 3, 'MIXED', { p: ['teaching_quality_praise'], t: ['teaching_quality'] }),

  // A complaint with no topic anchor still makes the response negative or mixed.
  d('wd03', 'wedding_vendor', 'negative', 'The lighting at the reception was sloppy.', 2, 'NEGATIVE', { t: ['quality_vs_sample', 'professionalism'] }),
  d('ed02', 'real_estate', 'negative', 'Hard to get him on the phone.', 2, 'NEGATIVE', { i: ['responsiveness'] }),
  d('cd04', 'clinic', 'negative', 'Difficult to reach the clinic by phone.', 2, 'NEGATIVE', { i: ['phone_unreachable'] }),
  d('sd03', 'salon', 'negative', 'The extra charge for the hair wash was never mentioned.', 2, 'NEGATIVE', { i: ['pricing_transparency'] }),
  d('wd04', 'wedding_vendor', 'rating_disagrees', 'Some of the couple portraits are out of focus.', 4, 'MIXED', { also: ['NEGATIVE'], t: ['quality_vs_sample'] }),

  // The gate's own examples, and generic praise that must stay generic.
  d('rd04', 'restaurant', 'positive', 'Great food. Will come again.', 5, 'POSITIVE', { p: ['food_taste'], x: ['service_quality', 'cleanliness_praise', 'staff_warmth', 'value_for_money', 'service_speed'] }),
  d('rd05', 'restaurant', 'clause', 'Food was excellent but the bill took forever.', 3, 'MIXED', { p: ['food_taste'], i: ['service_speed'], t: ['billing_issue'] }),
  d('gd04', 'gym', 'vague', 'Nice place, will renew.', 5, 'POSITIVE', { t: ['atmosphere', 'cleanliness_praise'] }),
  d('cd05', 'clinic', 'short', 'Good.', 5, 'POSITIVE', { abstain: true }),
  d('kd04', 'coaching', 'vague', 'Not happy with the progress.', 2, 'NEGATIVE', { t: ['results_claims', 'teaching_quality'], x: ['results_praise'] }),

  // Third parties, including ones named through a qualifier.
  d('rd06', 'restaurant', 'attribution', 'The courier dropped our order and it arrived squashed.', 2, 'NEGATIVE', { t: ['delivery_packaging'] }),
  d('cd06', 'clinic', 'attribution', "Another patient's child was crying the whole time, nothing the staff could do.", 4, 'NEUTRAL', { also: ['POSITIVE'], a: ['staff_behaviour'], abstain: true }),
  d('wd05', 'wedding_vendor', 'attribution', 'The decorator from the venue was rude, but our photographer handled it well.', 4, 'POSITIVE', { also: ['MIXED'], p: ['team_conduct'], a: ['professionalism'] }),
  d('ed03', 'real_estate', 'attribution', 'The society secretary was rude to us during the visit.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['professionalism'], abstain: true }),
  d('gd05', 'gym', 'attribution', 'Some members hog the machines for an hour.', 3, 'NEUTRAL', { also: ['NEGATIVE'], t: ['crowding'], a: ['equipment_condition'] }),
  d('sd04', 'salon', 'attribution', 'My appointment was moved because I asked for a later slot.', 4, 'NEUTRAL', { also: ['POSITIVE'], a: ['appointment_scheduling'], abstain: true }),
  d('kd05', 'coaching', 'attribution', 'The board changed the exam pattern, and the institute updated the notes quickly.', 5, 'POSITIVE', { t: ['study_material_praise'], a: ['schedule_reliability', 'study_material'] }),

  // Mixed, with a rating on one side.
  d('ed04', 'real_estate', 'mixed', 'Lovely flats shown, but the brokerage was much higher than he first said.', 4, 'MIXED', { p: ['options_shown'], i: ['hidden_charges'], t: ['unclear_pricing'] }),
  d('sd05', 'salon', 'mixed', 'Five stars for the facial, zero for the waiting.', 3, 'MIXED', { p: ['stylist_skill'], i: ['wait_time'], ai: true }),

  // Multilingual.
  d('rd07', 'restaurant', 'multilingual', 'खाना बढ़िया था लेकिन बिल में गलती थी।', 3, 'MIXED', { p: ['food_taste'], i: ['billing_issue'] }),
  d('gd06', 'gym', 'multilingual', 'ट्रेनर चांगले आहेत पण शॉवर घाणेरडे आहेत.', 3, 'MIXED', { p: ['trainer_quality'], i: ['cleanliness'], ai: true }),
];
