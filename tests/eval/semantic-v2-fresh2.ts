import { v2, type V2Example } from './semantic-v2';

/**
 * BLIND SET #2: 100 examples, the final generalisation test.
 *
 * Written after all development tuning in the final correctness gate was
 * finished, labelled before any reader saw it, hashed, and run once. It is
 * never tuned against: a miss here is recorded, not fixed against.
 */
const f = (...args: Parameters<typeof v2> extends [unknown, ...infer R] ? R : never) => v2('FRESH2', ...args);

export const SEMANTIC_V2_FRESH2: V2Example[] = [
  // ---------------------------------------------------------------- restaurant
  f('rf01', 'restaurant', 'attribution', 'My cousin spilled his drink on the waiter, who was very gracious about it.', 5, 'POSITIVE', { t: ['staff_warmth'], a: ['staff_behaviour'] }),
  f('rf02', 'restaurant', 'clause', 'The naan was soft and fresh but the curry was far too salty.', 3, 'MIXED', { p: ['food_taste'], i: ['food_quality'] }),
  f('rf03', 'restaurant', 'negation', "The music wasn't too loud for once.", 4, 'POSITIVE', { also: ['NEUTRAL'], t: ['ambience'], x: ['ambience_noise'] }),
  f('rf04', 'restaurant', 'temporal', 'Their thali used to be great, now it is just average.', 2, 'NEGATIVE', { also: ['NEUTRAL'], t: ['food_quality'], x: ['food_taste'] }),
  f('rf05', 'restaurant', 'quantitative', 'We waited 50 minutes for two dosas.', 1, 'NEGATIVE', { i: ['service_speed'] }),
  f('rf06', 'restaurant', 'mixed', 'Polite waiters, clean tables, but the paneer was rubbery.', 3, 'MIXED', { p: ['staff_warmth', 'cleanliness_praise'], i: ['food_quality'] }),
  f('rf07', 'restaurant', 'rating_disagrees', 'Cold food and a long wait for the bill.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['food_quality', 'service_speed'] }),
  f('rf08', 'restaurant', 'sarcasm', 'Wonderful, they forgot our dessert again.', 1, 'NEGATIVE', { i: ['order_accuracy'], ai: true }),
  f('rf09', 'restaurant', 'multilingual', 'Paneer tikka ekdum bekar tha.', 1, 'NEGATIVE', { i: ['food_quality'] }),
  f('rf10', 'restaurant', 'vague', 'Okayish.', 3, 'NEUTRAL', { abstain: true }),
  f('rf11', 'restaurant', 'event', 'It was raining heavily so we ate inside, which was cosy.', 5, 'POSITIVE', { p: ['ambience'] }),
  f('rf12', 'restaurant', 'attribution', 'The delivery rider took a wrong turn and the food came 20 minutes late.', 3, 'NEGATIVE', { also: ['NEUTRAL', 'MIXED'], t: ['service_speed', 'delivery_packaging'] }),
  f('rf13', 'restaurant', 'positive', 'Great food. Lovely evening.', 5, 'POSITIVE', { p: ['food_taste'], x: ['service_quality', 'staff_warmth', 'value_for_money', 'cleanliness_praise'] }),
  f('rf14', 'restaurant', 'negative', 'Overcharged us for the drinks.', 1, 'NEGATIVE', { i: ['billing_issue'], t: ['pricing_value'] }),
  f('rf15', 'restaurant', 'indirect', "I won't be bringing my parents here again.", 2, 'NEGATIVE', { ai: true, abstain: true }),

  // -------------------------------------------------------------------- clinic
  f('cf01', 'clinic', 'attribution', 'My mother forgot her prescription, the pharmacist called the doctor to confirm it.', 5, 'POSITIVE', { t: ['staff_friendly'], a: ['followup_communication'] }),
  f('cf02', 'clinic', 'clause', 'Dr. Rao was thorough; the billing desk was confusing.', 3, 'MIXED', { p: ['doctor_care'], i: ['billing_clarity'] }),
  f('cf03', 'clinic', 'negation', 'Not a single nurse wore gloves.', 1, 'NEGATIVE', { t: ['cleanliness', 'staff_behaviour'], ai: true }),
  f('cf04', 'clinic', 'temporal', 'The rash cleared up for a few days and then got worse.', 2, 'NEGATIVE', { i: ['treatment_outcome'], x: ['good_outcome'] }),
  f('cf05', 'clinic', 'quantitative', 'Saw the doctor for barely three minutes.', 2, 'NEGATIVE', { i: ['consultation_rush'] }),
  f('cf06', 'clinic', 'rating_disagrees', 'The waiting room was filthy.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['cleanliness'] }),
  f('cf07', 'clinic', 'sarcasm', 'Brilliant, my reports went missing again.', 1, 'NEGATIVE', { i: ['followup_communication'], ai: true }),
  f('cf08', 'clinic', 'multilingual', 'डॉक्टर बहुत अच्छे हैं, बहुत ध्यान से देखते हैं।', 5, 'POSITIVE', { p: ['doctor_care'] }),
  f('cf09', 'clinic', 'vague', 'As expected.', 3, 'NEUTRAL', { abstain: true }),
  f('cf10', 'clinic', 'event', 'There was a power cut, but the staff kept everyone calm.', 4, 'POSITIVE', { t: ['staff_friendly'], x: ['cleanliness'] }),
  f('cf11', 'clinic', 'attribution', 'Another patient jumped the queue and the receptionist let it happen.', 2, 'NEGATIVE', { t: ['staff_behaviour', 'wait_time'] }),
  f('cf12', 'clinic', 'short', 'Good doctor.', 5, 'POSITIVE', { p: ['doctor_care'] }),
  f('cf13', 'clinic', 'negative', 'They never called back with my test results.', 1, 'NEGATIVE', { i: ['followup_communication'] }),
  f('cf14', 'clinic', 'mixed', 'Short wait, but the fees keep going up.', 3, 'MIXED', { p: ['short_wait'], i: ['billing_clarity'] }),
  f('cf15', 'clinic', 'ambiguous', 'The doctor talks a lot.', null, 'NEUTRAL', { also: ['POSITIVE', 'NEGATIVE'], t: ['doctor_care', 'consultation_rush'], abstain: true }),

  // ------------------------------------------------------------------ coaching
  f('kf01', 'coaching', 'attribution', 'My son lost his books on the bus, the institute gave him new notes for free.', 5, 'POSITIVE', { t: ['study_material_praise', 'faculty_support'], a: ['study_material'] }),
  f('kf02', 'coaching', 'clause', 'Tests are well planned; the classrooms are cramped.', 3, 'MIXED', { i: ['facility_condition'], t: ['study_material_praise', 'discipline'] }),
  f('kf03', 'coaching', 'negation', 'No teacher has left this year.', 4, 'POSITIVE', { also: ['NEUTRAL'], x: ['faculty_turnover'] }),
  f('kf04', 'coaching', 'temporal', 'The batch was small when we joined, now there are sixty students.', 2, 'NEGATIVE', { i: ['batch_size'] }),
  f('kf05', 'coaching', 'quantitative', 'There are 70 kids in one batch.', 2, 'NEGATIVE', { i: ['batch_size'] }),
  f('kf06', 'coaching', 'rating_disagrees', 'The fees doubled with no warning.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['fee_transparency'], t: ['communication_parents'] }),
  f('kf07', 'coaching', 'sarcasm', 'Great, another holiday announced the night before.', 1, 'NEGATIVE', { t: ['schedule_reliability', 'communication_parents'], ai: true }),
  f('kf08', 'coaching', 'multilingual', 'Teacher bahut ache se samjhate hain.', 5, 'POSITIVE', { p: ['teaching_quality_praise'] }),
  f('kf09', 'coaching', 'vague', 'Fine for now.', 3, 'NEUTRAL', { abstain: true }),
  f('kf10', 'coaching', 'event', 'Classes went online during the floods, and the teachers managed it well.', 4, 'POSITIVE', { t: ['teaching_quality_praise', 'faculty_support'], a: ['schedule_reliability'] }),
  f('kf11', 'coaching', 'negative', 'The physics teacher keeps skipping chapters.', 2, 'NEGATIVE', { i: ['teaching_quality'] }),
  f('kf12', 'coaching', 'mixed', "Good notes, but nobody answers parents' calls.", 3, 'MIXED', { p: ['study_material_praise'], i: ['communication_parents'] }),
  f('kf13', 'coaching', 'vague', 'Nice institute.', 4, 'POSITIVE', { abstain: true }),
  f('kf14', 'coaching', 'attribution', 'Some students bully others and the staff stepped in quickly.', 3, 'MIXED', { also: ['POSITIVE', 'NEUTRAL'], t: ['safety_discipline', 'discipline'] }),

  // ----------------------------------------------------------------------- gym
  f('gf01', 'gym', 'attribution', 'My friend dropped a dumbbell on his foot, the trainer helped right away.', 4, 'POSITIVE', { t: ['trainer_quality'], a: ['equipment_condition'] }),
  f('gf02', 'gym', 'clause', 'Clean washrooms; the cardio area is cramped.', 3, 'MIXED', { p: ['cleanliness_praise'], t: ['crowding'] }),
  f('gf03', 'gym', 'negation', 'Not once did a trainer check my form.', 2, 'NEGATIVE', { t: ['trainer_availability'], x: ['trainer_quality'], ai: true }),
  f('gf04', 'gym', 'temporal', 'The AC worked fine in winter, now in May it barely cools.', 2, 'NEGATIVE', { i: ['ac_ventilation'] }),
  f('gf05', 'gym', 'quantitative', 'Waited 20 minutes for a bench every evening.', 2, 'NEGATIVE', { i: ['crowding'], t: ['equipment_condition'] }),
  f('gf06', 'gym', 'rating_disagrees', 'The treadmill belts keep slipping.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['equipment_condition'] }),
  f('gf07', 'gym', 'sarcasm', 'Love how the music is louder than the instructor.', 2, 'NEGATIVE', { t: ['atmosphere'], ai: true }),
  f('gf08', 'gym', 'multilingual', 'Gym mein bahut bheed hoti hai shaam ko.', 2, 'NEGATIVE', { i: ['crowding'] }),
  f('gf09', 'gym', 'vague', "It's a gym.", null, 'NEUTRAL', { abstain: true }),
  f('gf10', 'gym', 'event', 'The gym shut for a day for a wedding in the hall downstairs.', 3, 'NEUTRAL', { a: ['class_schedule'], abstain: true }),
  f('gf11', 'gym', 'negative', 'They auto-renewed my membership without asking.', 1, 'NEGATIVE', { i: ['membership_billing'] }),
  f('gf12', 'gym', 'mixed', 'Affordable, but the lockers are broken.', 3, 'MIXED', { p: ['value_pricing'], i: ['equipment_condition'] }),
  f('gf13', 'gym', 'positive', 'Great place to work out.', 5, 'POSITIVE', { t: ['atmosphere'] }),
  f('gf14', 'gym', 'positive', "My trainer pushes me hard and I've lost 7 kg.", 5, 'POSITIVE', { p: ['trainer_quality', 'results'] }),

  // --------------------------------------------------------------- real estate
  f('ef01', 'real_estate', 'attribution', 'The landlord delayed the agreement, but our broker kept pushing him.', 4, 'POSITIVE', { t: ['responsiveness_praise'], a: ['documentation_delay', 'pressure_tactics'] }),
  f('ef02', 'real_estate', 'clause', 'Fair commission; slow on documents.', 3, 'MIXED', { p: ['fair_brokerage'], i: ['documentation_delay'] }),
  f('ef03', 'real_estate', 'negation', 'Never once hid a cost from us.', 5, 'POSITIVE', { p: ['transparency'], x: ['hidden_charges'] }),
  f('ef04', 'real_estate', 'temporal', 'He answered every call before we paid, now he ignores us.', 1, 'NEGATIVE', { i: ['post_deal_support'], t: ['responsiveness'], x: ['responsiveness_praise'] }),
  f('ef05', 'real_estate', 'quantitative', 'Showed us twelve flats in two days.', 5, 'POSITIVE', { p: ['options_shown'] }),
  f('ef06', 'real_estate', 'rating_disagrees', 'Pushy and kept calling at night.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['pressure_tactics'] }),
  f('ef07', 'real_estate', 'sarcasm', "Thanks for the 'small' extra fee of fifty thousand.", 1, 'NEGATIVE', { i: ['hidden_charges'], ai: true }),
  f('ef08', 'real_estate', 'multilingual', 'Agent ne sab documents time pe karwa diye.', 5, 'POSITIVE', { p: ['paperwork_help'], ai: true }),
  f('ef09', 'real_estate', 'vague', 'Alright.', 3, 'NEUTRAL', { abstain: true }),
  f('ef10', 'real_estate', 'event', 'The bank changed its loan rules midway, he found us another lender.', 5, 'POSITIVE', { t: ['paperwork_help', 'market_knowledge'], a: ['documentation_delay'] }),
  f('ef11', 'real_estate', 'negative', 'The flat photos were heavily edited.', 2, 'NEGATIVE', { i: ['listing_accuracy'] }),
  f('ef12', 'real_estate', 'mixed', 'Knows the area well but rude on the phone.', 3, 'MIXED', { p: ['market_knowledge'], i: ['professionalism'] }),
  f('ef13', 'real_estate', 'vague', 'Good broker.', 5, 'POSITIVE', { abstain: true }),
  f('ef14', 'real_estate', 'attribution', 'The previous tenant left the flat dirty, the agent got it cleaned before we moved in.', 5, 'POSITIVE', { t: ['post_deal_support', 'responsiveness_praise'], a: ['listing_accuracy'] }),

  // --------------------------------------------------------------------- salon
  f('sf01', 'salon', 'attribution', 'My sister was late for her slot, they kindly adjusted mine instead.', 5, 'POSITIVE', { t: ['staff_warmth', 'punctuality'], a: ['appointment_scheduling', 'wait_time'] }),
  f('sf02', 'salon', 'clause', 'Lovely pedicure; the waiting chairs were dusty.', 3, 'MIXED', { p: ['stylist_skill'], i: ['cleanliness_space'] }),
  f('sf03', 'salon', 'negation', "Didn't push any extra treatments.", 5, 'POSITIVE', { x: ['upselling_pressure'] }),
  f('sf04', 'salon', 'temporal', 'The keratin looked silky for two days, then my hair went frizzy.', 2, 'NEGATIVE', { i: ['service_result'], x: ['stylist_skill'] }),
  f('sf05', 'salon', 'quantitative', 'Kept me waiting 45 minutes past my booking.', 1, 'NEGATIVE', { i: ['wait_time'], t: ['appointment_scheduling'] }),
  f('sf06', 'salon', 'rating_disagrees', 'They used an old towel on me.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['hygiene'] }),
  f('sf07', 'salon', 'sarcasm', 'Great job turning my brown hair green.', 1, 'NEGATIVE', { i: ['service_result'], ai: true }),
  f('sf08', 'salon', 'multilingual', 'हेअरकट खूप छान झाला.', 5, 'POSITIVE', { p: ['stylist_skill'], ai: true }),
  f('sf09', 'salon', 'vague', 'Meh, average.', 3, 'NEUTRAL', { also: ['NEGATIVE'], abstain: true }),
  f('sf10', 'salon', 'event', 'Their card machine was down, so I paid by UPI, no issue.', 4, 'POSITIVE', { also: ['NEUTRAL'], x: ['pricing_transparency'], abstain: true }),
  f('sf11', 'salon', 'negative', 'The receptionist was dismissive and rude.', 1, 'NEGATIVE', { i: ['staff_behaviour'] }),
  f('sf12', 'salon', 'mixed', 'Great facial, but they charged for a mask I never asked for.', 3, 'MIXED', { p: ['stylist_skill'], i: ['pricing_transparency'], t: ['upselling_pressure'] }),
  f('sf13', 'salon', 'vague', 'Nice salon.', 5, 'POSITIVE', { abstain: true }),
  f('sf14', 'salon', 'ambiguous', 'The stylist changed my look completely.', null, 'NEUTRAL', { also: ['POSITIVE', 'NEGATIVE'], t: ['stylist_skill', 'service_result'], abstain: true }),

  // ------------------------------------------------------------ wedding vendor
  f('wf01', 'wedding_vendor', 'attribution', 'The pandit arrived an hour late, the photographer waited patiently and covered everything.', 5, 'POSITIVE', { t: ['output_quality', 'team_conduct'], a: ['punctuality'] }),
  f('wf02', 'wedding_vendor', 'clause', 'Beautiful album; the delivery took five months.', 3, 'MIXED', { p: ['output_quality'], i: ['delivery_delay'] }),
  f('wf03', 'wedding_vendor', 'negation', 'Not one family member was missed in the group photos.', 5, 'POSITIVE', { t: ['output_quality'], x: ['coverage_gaps'] }),
  f('wf04', 'wedding_vendor', 'temporal', 'They were punctual for the haldi, then arrived late for the reception.', 2, 'NEGATIVE', { i: ['punctuality'], x: ['punctuality_praise'] }),
  f('wf05', 'wedding_vendor', 'quantitative', 'Got our photos after nine months.', 1, 'NEGATIVE', { i: ['delivery_delay'] }),
  f('wf06', 'wedding_vendor', 'rating_disagrees', 'The team swapped our lead photographer without telling us.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['team_substitution'], t: ['communication'] }),
  f('wf07', 'wedding_vendor', 'sarcasm', 'Loved paying extra for a drone that never flew.', 1, 'NEGATIVE', { t: ['hidden_costs', 'coverage_gaps'], ai: true }),
  f('wf08', 'wedding_vendor', 'multilingual', 'Photographer ne har pal capture kiya, bahut sundar photos.', 5, 'POSITIVE', { p: ['output_quality'] }),
  f('wf09', 'wedding_vendor', 'vague', 'Decent.', 3, 'NEUTRAL', { also: ['POSITIVE'], abstain: true }),
  f('wf10', 'wedding_vendor', 'event', 'The rain delayed the pheras, and the crew adjusted the lights quickly.', 5, 'POSITIVE', { t: ['flexibility', 'team_conduct'], a: ['punctuality'] }),
  f('wf11', 'wedding_vendor', 'negative', 'They refused to share the raw footage.', 2, 'NEGATIVE', { t: ['revisions_refused', 'communication'] }),
  f('wf12', 'wedding_vendor', 'mixed', 'Stunning decor but the team argued with my father.', 3, 'MIXED', { p: ['output_quality'], i: ['professionalism'] }),
  f('wf13', 'wedding_vendor', 'positive', 'Amazing work.', 5, 'POSITIVE', { t: ['output_quality'] }),
  f('wf14', 'wedding_vendor', 'attribution', "The groom's friends were rude to the photographer, who stayed professional.", 5, 'POSITIVE', { p: ['team_conduct'], a: ['professionalism'] }),
];
