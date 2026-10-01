import { v2, type V2Example } from './semantic-v2';

/**
 * BLIND SET #4: 100 examples, the generalisation test for the AI validation pass.
 *
 * Written after every change of the pass was finished, labelled before any
 * reader — deterministic or AI — saw it, hashed, and run once. Never tuned
 * against. Every vertical; every category the gate names: attribution
 * (people, couriers, weather, other customers, self), time, mixed with and
 * without "but", generic praise, negation, sarcasm, quantities, Hinglish,
 * Hindi and Marathi, misspellings, and ratings that disagree with the words.
 */
const f = (...args: Parameters<typeof v2> extends [unknown, ...infer R] ? R : never) => v2('FRESH2', ...args);

export const SEMANTIC_V2_FRESH4: V2Example[] = [
  // ---------------------------------------------------------------- restaurant
  f('rq01', 'restaurant', 'attribution', 'The delivery rider took a wrong turn, so the food reached us forty minutes late.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['service_speed', 'delivery_packaging'], abstain: true }),
  f('rq02', 'restaurant', 'mixed', 'The biryani was fragrant and generous; the waiter forgot our raita twice.', 3, 'MIXED', { p: ['food_taste'], i: ['order_accuracy'], t: ['value_for_money', 'service_speed', 'staff_behaviour'] }),
  f('rq03', 'restaurant', 'temporal', 'Service used to drag on weekends, now they have it sorted.', 5, 'POSITIVE', { t: ['service_quality'], x: ['service_speed'] }),
  f('rq04', 'restaurant', 'negation', 'The waiters were never anything but polite.', 5, 'POSITIVE', { p: ['staff_warmth'], x: ['staff_behaviour'], ai: true }),
  f('rq05', 'restaurant', 'sarcasm', 'Loved waiting forty minutes for a cold coffee.', 1, 'NEGATIVE', { i: ['service_speed'], t: ['wait_for_table'], ai: true }),
  f('rq06', 'restaurant', 'vague', 'Nice.', 5, 'POSITIVE', { abstain: true }),
  f('rq07', 'restaurant', 'quantitative', 'We were charged for three naans but only got two.', 2, 'NEGATIVE', { i: ['billing_issue'], t: ['order_accuracy'] }),
  f('rq08', 'restaurant', 'rating_disagrees', 'Tasty food, friendly staff.', 1, 'MIXED', { also: ['POSITIVE'], p: ['food_taste', 'staff_warmth'], ai: true }),
  f('rq09', 'restaurant', 'attribution', 'The family at the next table let their kids run around screaming.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['ambience_noise', 'staff_behaviour'], abstain: true }),
  f('rq10', 'restaurant', 'idiom', 'The gulab jamun was to die for.', 5, 'POSITIVE', { p: ['food_taste'], ai: true }),
  f('rq11', 'restaurant', 'clause', 'Pleasant music, but the chairs were wobbly.', 3, 'MIXED', { i: ['ambience_noise'], t: ['ambience'] }),
  f('rq12', 'restaurant', 'multilingual', 'Khana bahut swadisht tha lekin bill mein galti thi.', 3, 'MIXED', { p: ['food_taste'], i: ['billing_issue'] }),
  f('rq13', 'restaurant', 'vague', 'It was okay, nothing special.', 3, 'NEUTRAL', { also: ['MIXED'], abstain: true }),
  f('rq14', 'restaurant', 'negative', 'Hair in my soup and nobody apologised.', 1, 'NEGATIVE', { i: ['food_quality'], t: ['staff_behaviour', 'cleanliness'] }),
  f('rq15', 'restaurant', 'negative', 'The paneer tikka was dry and overpriced.', 2, 'NEGATIVE', { i: ['food_quality', 'pricing_value'] }),

  // -------------------------------------------------------------------- clinic
  f('cq01', 'clinic', 'attribution', 'The pharmacy downstairs was out of my medicine.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['treatment_outcome', 'followup_communication'], abstain: true }),
  f('cq02', 'clinic', 'mixed', 'Dr. Shah listened patiently, but the receptionist was curt with my mother.', 3, 'MIXED', { p: ['doctor_care'], i: ['staff_behaviour'] }),
  f('cq03', 'clinic', 'temporal', 'For the first week the rash got worse, then it cleared up completely.', 5, 'POSITIVE', { p: ['good_outcome'], x: ['treatment_outcome'] }),
  f('cq04', 'clinic', 'quantitative', 'Waited almost two hours past my appointment time.', 1, 'NEGATIVE', { i: ['wait_time'], t: ['appointment_scheduling'] }),
  f('cq05', 'clinic', 'vague', 'Gentle and supportive.', 5, 'POSITIVE', { abstain: true }),
  f('cq06', 'clinic', 'negation', 'No one explained what the tests were for.', 2, 'NEGATIVE', { t: ['followup_communication', 'consultation_rush'], ai: true }),
  f('cq07', 'clinic', 'quantitative', 'The doctor gave me barely three minutes.', 2, 'NEGATIVE', { i: ['consultation_rush'] }),
  f('cq08', 'clinic', 'sarcasm', 'Brilliant, the clinic billed me twice for the same visit.', 1, 'NEGATIVE', { i: ['billing_clarity'], ai: true }),
  f('cq09', 'clinic', 'attribution', 'The lady before me took forever with the doctor.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['wait_time', 'consultation_rush'], abstain: true }),
  f('cq10', 'clinic', 'misspelt', 'Verry clean clinik and frendly staf.', 5, 'POSITIVE', { p: ['clean_facility', 'staff_friendly'] }),
  f('cq11', 'clinic', 'multilingual', 'डॉक्टर बहुत अच्छे हैं पर पार्किंग की बड़ी दिक्कत है।', 3, 'MIXED', { p: ['doctor_care'], i: ['parking_access'] }),
  f('cq12', 'clinic', 'positive', 'The fever was gone in two days.', 5, 'POSITIVE', { p: ['good_outcome'] }),
  f('cq13', 'clinic', 'rating_disagrees', 'Reception never picks up the phone.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['phone_unreachable'], ai: true }),
  f('cq14', 'clinic', 'causal', 'I missed my slot because my train was late.', 3, 'NEUTRAL', { a: ['appointment_scheduling', 'wait_time'], abstain: true }),

  // ------------------------------------------------------------------ coaching
  f('kq01', 'coaching', 'attribution', 'Our school exams clashed with the test series, so my son missed two tests.', 3, 'NEUTRAL', { a: ['schedule_reliability'], abstain: true }),
  f('kq02', 'coaching', 'mixed', 'Physics is taught brilliantly; chemistry is a mess.', 3, 'MIXED', { p: ['teaching_quality_praise'], i: ['teaching_quality'] }),
  f('kq03', 'coaching', 'temporal', 'Initially the batches were huge, now they cap it at 25.', 5, 'POSITIVE', { t: ['individual_attention'], x: ['batch_size'] }),
  f('kq04', 'coaching', 'negation', 'Not once did a teacher skip a class.', 5, 'POSITIVE', { t: ['discipline'], x: ['schedule_reliability'] }),
  f('kq05', 'coaching', 'quantitative', 'Sixty students crammed in one batch.', 2, 'NEGATIVE', { i: ['batch_size'] }),
  f('kq06', 'coaching', 'vague', 'Very good.', 5, 'POSITIVE', { abstain: true }),
  f('kq07', 'coaching', 'idiom', 'The maths sir is a walking encyclopedia.', 5, 'POSITIVE', { p: ['teaching_quality_praise'], ai: true }),
  f('kq08', 'coaching', 'negative', 'Fees went up mid-year without any notice.', 1, 'NEGATIVE', { i: ['fee_transparency'], t: ['communication_parents'] }),
  f('kq09', 'coaching', 'negative', 'Some boys in my class bully the younger kids.', 2, 'NEGATIVE', { also: ['NEUTRAL'], t: ['safety_discipline'] }),
  f('kq10', 'coaching', 'multilingual', 'Teachers bahut dhyan dete hain har bacche pe.', 5, 'POSITIVE', { p: ['individual_attention'], t: ['faculty_support'] }),
  f('kq11', 'coaching', 'clause', 'Notes are detailed, though the classroom fan barely works.', 3, 'MIXED', { p: ['study_material_praise'], i: ['facility_condition'] }),
  f('kq12', 'coaching', 'sarcasm', 'Thanks for telling us about the holiday the morning of the class.', 1, 'NEGATIVE', { i: ['communication_parents'], t: ['schedule_reliability'], ai: true }),
  f('kq13', 'coaching', 'positive', 'My daughter scored 96 in boards thanks to them.', 5, 'POSITIVE', { p: ['results_praise'] }),
  f('kq14', 'coaching', 'event', 'Classes were suspended during the floods.', 3, 'NEUTRAL', { a: ['schedule_reliability'], abstain: true }),

  // ----------------------------------------------------------------------- gym
  f('gq01', 'gym', 'attribution', 'Some guy hogged the bench press for forty minutes.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['equipment_condition', 'staff_behaviour', 'trainer_availability'], t: ['crowding'], abstain: true }),
  f('gq02', 'gym', 'mixed', 'Trainers know their stuff, but the treadmills keep breaking down.', 3, 'MIXED', { p: ['trainer_quality'], i: ['equipment_condition'] }),
  f('gq03', 'gym', 'temporal', "The changing room was filthy for months; since the new manager it's spotless.", 4, 'POSITIVE', { also: ['MIXED'], p: ['cleanliness_praise'], x: ['cleanliness'] }),
  f('gq04', 'gym', 'quantitative', 'Lost 6 kg in ten weeks.', 5, 'POSITIVE', { p: ['results'] }),
  f('gq05', 'gym', 'vague', 'Love it!', 5, 'POSITIVE', { abstain: true }),
  f('gq06', 'gym', 'negation', 'No pressure to buy supplements at all.', 5, 'POSITIVE', { x: ['overcommitted_sales'], abstain: true }),
  f('gq07', 'gym', 'sarcasm', 'Great, the AC is broken again in June.', 1, 'NEGATIVE', { i: ['ac_ventilation'], ai: true }),
  f('gq08', 'gym', 'negative', 'They kept charging my card after I cancelled.', 1, 'NEGATIVE', { i: ['membership_billing'] }),
  f('gq09', 'gym', 'negative', 'Impossible to get a squat rack after 6pm.', 2, 'NEGATIVE', { i: ['crowding'], t: ['equipment_condition'] }),
  f('gq10', 'gym', 'multilingual', 'जिम स्वच्छ आहे आणि ट्रेनर खूप मदत करतात.', 5, 'POSITIVE', { p: ['cleanliness_praise', 'trainer_quality'] }),
  f('gq11', 'gym', 'rating_disagrees', 'Showers are cold and the lockers are broken.', 5, 'MIXED', { also: ['NEGATIVE'], t: ['equipment_condition', 'cleanliness'], ai: true }),
  f('gq12', 'gym', 'attribution', 'I skipped most sessions because of my knee injury.', 3, 'NEUTRAL', { a: ['trainer_availability', 'class_schedule'], abstain: true }),
  f('gq13', 'gym', 'positive', 'The 6am batch fits my schedule perfectly.', 5, 'POSITIVE', { p: ['timings'] }),
  f('gq14', 'gym', 'clause', 'Cheap membership, but the place stinks of sweat.', 3, 'MIXED', { p: ['value_pricing'], i: ['cleanliness'] }),

  // --------------------------------------------------------------- real estate
  f('eq01', 'real_estate', 'attribution', "The builder's site office was closed when we went.", 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['site_visit_experience'], abstain: true }),
  f('eq02', 'real_estate', 'mixed', 'Knew every lane in the area; pushed us hard to close that weekend.', 3, 'MIXED', { p: ['market_knowledge'], i: ['pressure_tactics'] }),
  f('eq03', 'real_estate', 'temporal', 'He was responsive until we paid the token; then nothing.', 1, 'NEGATIVE', { i: ['post_deal_support'], t: ['responsiveness'], x: ['responsiveness_praise'] }),
  f('eq04', 'real_estate', 'negation', "Never once tried to push a flat we didn't like.", 5, 'POSITIVE', { p: ['no_pressure'], x: ['pressure_tactics'] }),
  f('eq05', 'real_estate', 'quantitative', 'Took 3 months to get our token money back.', 2, 'NEGATIVE', { i: ['token_refund'] }),
  f('eq06', 'real_estate', 'vague', 'Helpful guy.', 5, 'POSITIVE', { abstain: true }),
  f('eq07', 'real_estate', 'attribution', 'The bank took six weeks to approve our loan.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['documentation_delay'], abstain: true }),
  f('eq08', 'real_estate', 'negative', 'The photos online were nothing like the actual flat.', 1, 'NEGATIVE', { i: ['listing_accuracy'] }),
  f('eq09', 'real_estate', 'sarcasm', "Lovely surprise, a 'maintenance deposit' nobody mentioned.", 1, 'NEGATIVE', { i: ['hidden_charges'], ai: true }),
  f('eq10', 'real_estate', 'multilingual', 'Agent ne saare documents time pe ready karwa diye.', 5, 'POSITIVE', { p: ['paperwork_help'] }),
  f('eq11', 'real_estate', 'positive', 'Showed us twelve flats in two days, all within budget.', 5, 'POSITIVE', { p: ['options_shown'] }),
  f('eq12', 'real_estate', 'clause', 'Honest about the flaws, though slow to reply on WhatsApp.', 3, 'MIXED', { p: ['transparency'], i: ['responsiveness'] }),
  f('eq13', 'real_estate', 'rating_disagrees', 'Brokerage was fair and he was upfront.', 2, 'MIXED', { also: ['POSITIVE'], p: ['fair_brokerage', 'transparency'], ai: true }),
  f('eq14', 'real_estate', 'causal', 'We lost the deal because the seller backed out.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['professionalism', 'pressure_tactics'], abstain: true }),

  // --------------------------------------------------------------------- salon
  f('sq01', 'salon', 'attribution', 'My friend was late, so we lost our slot.', 3, 'NEUTRAL', { a: ['appointment_scheduling', 'wait_time'], abstain: true }),
  f('sq02', 'salon', 'mixed', 'Gorgeous balayage, but they rushed the blow-dry.', 3, 'MIXED', { p: ['stylist_skill'], i: ['service_result'] }),
  f('sq03', 'salon', 'temporal', 'The first cut was a disaster; the redo was perfect.', 4, 'POSITIVE', { also: ['MIXED'], p: ['stylist_skill'], t: ['service_result'] }),
  f('sq04', 'salon', 'negation', "Didn't push any products on me.", 5, 'POSITIVE', { x: ['upselling_pressure'], abstain: true }),
  f('sq05', 'salon', 'quantitative', 'Kept me waiting 50 minutes even with a booking.', 1, 'NEGATIVE', { i: ['wait_time'], t: ['appointment_scheduling'] }),
  f('sq06', 'salon', 'vague', 'Super!', 5, 'POSITIVE', { abstain: true }),
  f('sq07', 'salon', 'sarcasm', 'Nice touch, the burnt ends on my hair.', 1, 'NEGATIVE', { i: ['service_result'], ai: true }),
  f('sq08', 'salon', 'negative', 'They charged extra for the hair wash without telling me.', 1, 'NEGATIVE', { i: ['pricing_transparency'] }),
  f('sq09', 'salon', 'multilingual', 'Facial एकदम मस्त झालं.', 5, 'POSITIVE', { p: ['stylist_skill'] }),
  f('sq10', 'salon', 'negative', 'Combs were dirty and towels looked reused.', 1, 'NEGATIVE', { i: ['hygiene'], t: ['cleanliness_space'] }),
  f('sq11', 'salon', 'clause', 'Warm staff; the colour faded within a week.', 3, 'MIXED', { p: ['staff_warmth'], i: ['service_result'] }),
  f('sq12', 'salon', 'positive', 'She asked exactly what I wanted before starting.', 5, 'POSITIVE', { p: ['consultation'] }),
  f('sq13', 'salon', 'attribution', 'The customer in the next chair kept yelling on her phone.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['staff_behaviour', 'ambience'], abstain: true }),
  f('sq14', 'salon', 'rating_disagrees', 'Uneven cut and rude stylist.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['service_result', 'staff_behaviour'], ai: true }),

  // ------------------------------------------------------------ wedding vendor
  f('wq01', 'wedding_vendor', 'attribution', 'The baraat reached two hours late, and the photographers waited patiently.', 5, 'POSITIVE', { also: ['NEUTRAL'], a: ['punctuality'], t: ['team_conduct'] }),
  f('wq02', 'wedding_vendor', 'attribution', 'Our caterer served dinner an hour late.', 2, 'NEGATIVE', { also: ['NEUTRAL'], t: ['punctuality'] }),
  f('wq03', 'wedding_vendor', 'mixed', 'Stunning candids, but the album came four months late.', 3, 'MIXED', { p: ['output_quality'], i: ['delivery_delay'] }),
  f('wq04', 'wedding_vendor', 'temporal', 'They were slow to reply before the booking, but on the day they were flawless.', 4, 'POSITIVE', { also: ['MIXED'], p: ['team_conduct'], t: ['communication', 'punctuality_praise'] }),
  f('wq05', 'wedding_vendor', 'quantitative', 'Still waiting for the wedding video after seven months.', 1, 'NEGATIVE', { i: ['delivery_delay'] }),
  f('wq06', 'wedding_vendor', 'vague', 'Amazing people.', 5, 'POSITIVE', { t: ['team_conduct'], abstain: true }),
  f('wq07', 'wedding_vendor', 'negation', 'Not a single moment was missed.', 5, 'POSITIVE', { t: ['output_quality'], x: ['coverage_gaps'] }),
  f('wq08', 'wedding_vendor', 'sarcasm', 'Thank you for sending a different photographer than the one we booked.', 1, 'NEGATIVE', { i: ['team_substitution'], ai: true }),
  f('wq09', 'wedding_vendor', 'event', 'Rain forced the mehendi indoors at the last minute.', 4, 'NEUTRAL', { also: ['POSITIVE'], a: ['punctuality', 'professionalism'], t: ['flexibility'], abstain: true }),
  f('wq10', 'wedding_vendor', 'multilingual', 'Photographer bhaiya ne bahut acche photos liye.', 5, 'POSITIVE', { p: ['output_quality'] }),
  f('wq11', 'wedding_vendor', 'negative', 'They asked for extra money for drone shots on the wedding day.', 1, 'NEGATIVE', { i: ['hidden_costs'] }),
  f('wq12', 'wedding_vendor', 'clause', 'Edits were beautiful; the team kept checking their phones during the pheras.', 3, 'MIXED', { p: ['output_quality'], i: ['professionalism'] }),
  f('wq13', 'wedding_vendor', 'positive', 'They happily reshuffled the schedule when our muhurat changed.', 5, 'POSITIVE', { p: ['flexibility'] }),
  f('wq14', 'wedding_vendor', 'attribution', 'The DJ from the venue played the wrong song for our entry.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['professionalism', 'coverage_gaps'], abstain: true }),
  f('wq15', 'wedding_vendor', 'rating_disagrees', 'Pictures were blurry in half the album.', 5, 'MIXED', { also: ['NEGATIVE'], t: ['quality_vs_sample'], ai: true }),
];
