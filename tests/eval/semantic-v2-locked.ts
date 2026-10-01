import { v2, type V2Example } from './semantic-v2';

/**
 * THE LOCKED HOLDOUT: 100 examples.
 *
 * Written before any code change in the final semantic pass, alongside the
 * development set, and not run by any reader until every change was finished.
 * Its first run is the result reported in the audit. It is never patched to
 * pass: a miss here is recorded, not fixed against.
 */
const l = (...args: Parameters<typeof v2> extends [unknown, ...infer R] ? R : never) => v2('LOCKED', ...args);

export const SEMANTIC_V2_LOCKED: V2Example[] = [
  // ---------------------------------------------------------------- restaurant
  l('rl01', 'restaurant', 'attribution', 'The kids spilled juice everywhere and the staff cleaned it up with a smile.', 5, 'POSITIVE', { p: ['staff_warmth'], a: ['cleanliness'] }),
  l('rl02', 'restaurant', 'attribution', 'Our driver got lost, so we reached an hour late, but they kept our table.', 5, 'POSITIVE', { t: ['staff_warmth', 'service_quality'], a: ['service_speed', 'wait_for_table'] }),
  l('rl03', 'restaurant', 'clause', 'Starters were cold, mains were delicious.', 3, 'MIXED', { p: ['food_taste'], i: ['food_quality'] }),
  l('rl04', 'restaurant', 'clause', 'Service was quick; the portions were tiny for the price.', 3, 'MIXED', { p: ['service_quality'], i: ['pricing_value'] }),
  l('rl05', 'restaurant', 'negation', 'The waiter never came back to refill our water.', 2, 'NEGATIVE', { t: ['staff_behaviour', 'service_speed'], ai: true }),
  l('rl06', 'restaurant', 'negation', "Wasn't overpriced for this quality.", 4, 'POSITIVE', { t: ['value_for_money'], x: ['pricing_value'] }),
  l('rl07', 'restaurant', 'negation', "The dal wasn't fresh.", 2, 'NEGATIVE', { i: ['food_quality'], x: ['food_taste'] }),
  l('rl08', 'restaurant', 'rating_disagrees', 'Rude manager, never coming back.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['staff_behaviour'] }),
  l('rl09', 'restaurant', 'sarcasm', 'Loved waiting an hour for cold pizza.', 1, 'NEGATIVE', { i: ['service_speed', 'food_quality'], x: ['food_taste'], ai: true }),
  l('rl10', 'restaurant', 'multilingual', 'सर्विस बहुत धीमी थी पर खाना स्वादिष्ट था।', 3, 'MIXED', { p: ['food_taste'], i: ['service_speed'] }),
  l('rl11', 'restaurant', 'multilingual', 'Bill mein extra charge laga diya bina bataye.', 2, 'NEGATIVE', { i: ['billing_issue'] }),
  l('rl12', 'restaurant', 'vague', 'Meh.', 2, 'NEGATIVE', { also: ['NEUTRAL'], abstain: true }),
  l('rl13', 'restaurant', 'event', 'The fire alarm went off during dinner, staff evacuated everyone calmly.', 4, 'POSITIVE', { also: ['NEUTRAL'], t: ['staff_warmth', 'service_quality'], x: ['ambience_noise'] }),
  l('rl14', 'restaurant', 'temporal', 'Food quality has dropped since the new chef joined.', 2, 'NEGATIVE', { i: ['food_quality'] }),
  l('rl15', 'restaurant', 'mixed', 'Great ambience and music, average food, and the bill had a mistake.', 3, 'MIXED', { p: ['ambience'], i: ['billing_issue'], t: ['food_quality'] }),

  // -------------------------------------------------------------------- clinic
  l('cl01', 'clinic', 'attribution', 'The lab outside the clinic lost my sample, the doctor helped me sort it out.', 4, 'POSITIVE', { t: ['doctor_care', 'staff_friendly'], a: ['followup_communication', 'treatment_outcome'] }),
  l('cl02', 'clinic', 'attribution', 'I forgot my old reports at home, so the consultation took longer.', 4, 'NEUTRAL', { also: ['POSITIVE'], a: ['consultation_rush', 'wait_time', 'followup_communication'], abstain: true }),
  l('cl03', 'clinic', 'attribution', 'Another patient was shouting at the reception, but the staff stayed calm.', 4, 'POSITIVE', { also: ['MIXED'], t: ['staff_friendly'], a: ['staff_behaviour'] }),
  l('cl04', 'clinic', 'clause', 'Clean waiting area, but the washroom was filthy.', 3, 'MIXED', { p: ['clean_facility'], i: ['cleanliness'] }),
  l('cl05', 'clinic', 'clause', 'The doctor was kind; the pharmacy staff were rude.', 3, 'MIXED', { p: ['doctor_care'], i: ['staff_behaviour'] }),
  l('cl06', 'clinic', 'negation', 'The fees were not explained at all.', 2, 'NEGATIVE', { i: ['billing_clarity'] }),
  l('cl07', 'clinic', 'negation', 'Never felt rushed during the consultation.', 5, 'POSITIVE', { t: ['doctor_care'], x: ['consultation_rush'] }),
  l('cl08', 'clinic', 'rating_disagrees', 'Gave me the wrong medicine dosage.', 5, 'MIXED', { also: ['NEGATIVE'], t: ['treatment_outcome'], ai: true }),
  l('cl09', 'clinic', 'sarcasm', 'Fantastic, three hours in the queue for a two-minute chat.', 1, 'NEGATIVE', { i: ['wait_time', 'consultation_rush'], ai: true }),
  l('cl10', 'clinic', 'multilingual', 'रिसेप्शन वाले बहुत बदतमीज़ थे।', 1, 'NEGATIVE', { i: ['staff_behaviour'] }),
  l('cl11', 'clinic', 'multilingual', 'Doctor ne dhyaan se suna aur sab samjhaya.', 5, 'POSITIVE', { p: ['doctor_care'], ai: true }),
  l('cl12', 'clinic', 'vague', 'Nothing special.', 3, 'NEUTRAL', { also: ['NEGATIVE'], abstain: true }),
  l('cl13', 'clinic', 'temporal', 'Pain came back a week after the treatment.', 2, 'NEGATIVE', { i: ['treatment_outcome'] }),
  l('cl14', 'clinic', 'negative', 'No parking anywhere near the clinic.', 3, 'NEGATIVE', { i: ['parking_access'] }),
  l('cl15', 'clinic', 'mixed', 'Quick appointment, gentle dentist, reasonable fees.', 5, 'POSITIVE', { p: ['short_wait', 'doctor_care', 'fair_pricing'] }),

  // ------------------------------------------------------------------ coaching
  l('kl01', 'coaching', 'attribution', "My daughter didn't do her homework, so she struggled in the test.", 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['teaching_quality', 'study_material'], abstain: true }),
  l('kl02', 'coaching', 'attribution', "The school exams clashed with the coaching schedule, nobody's fault.", 4, 'NEUTRAL', { a: ['schedule_reliability'], abstain: true }),
  l('kl03', 'coaching', 'clause', 'Good teachers, terrible management.', 3, 'MIXED', { p: ['teaching_quality_praise'], t: ['communication_parents', 'schedule_reliability'] }),
  l('kl04', 'coaching', 'clause', 'Doubts are cleared quickly, but the notes are full of mistakes.', 3, 'MIXED', { p: ['individual_attention'], i: ['study_material'] }),
  l('kl05', 'coaching', 'negation', 'The teacher never explains anything twice.', 2, 'NEGATIVE', { i: ['teaching_quality'], ai: true }),
  l('kl06', 'coaching', 'negation', 'No complaints about the faculty.', 4, 'POSITIVE', { also: ['NEUTRAL'], t: ['teaching_quality_praise'], x: ['teaching_quality'] }),
  l('kl07', 'coaching', 'rating_disagrees', 'Fees were hiked mid-year without notice.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['fee_transparency'], t: ['communication_parents'] }),
  l('kl08', 'coaching', 'sarcasm', 'Brilliant planning, the syllabus will finish after the exam.', 1, 'NEGATIVE', { t: ['teaching_quality', 'schedule_reliability'], ai: true }),
  l('kl09', 'coaching', 'multilingual', 'Batch mein 90 bachche hain, koi dhyan nahi deta.', 2, 'NEGATIVE', { i: ['batch_size'] }),
  l('kl10', 'coaching', 'multilingual', 'सर खूप छान शिकवतात.', 5, 'POSITIVE', { p: ['teaching_quality_praise'] }),
  l('kl11', 'coaching', 'vague', "It's alright.", 3, 'NEUTRAL', { abstain: true }),
  l('kl12', 'coaching', 'temporal', 'Scores went from 60 to 85 in six months.', 5, 'POSITIVE', { p: ['results_praise'], ai: true }),
  l('kl13', 'coaching', 'negative', 'The building has no fire exit and the stairs are broken.', 1, 'NEGATIVE', { i: ['facility_condition'], t: ['safety_discipline'] }),
  l('kl14', 'coaching', 'mixed', 'Regular classes, supportive teachers, but the fees are too high.', 4, 'MIXED', { p: ['discipline', 'faculty_support'], i: ['fee_transparency'] }),

  // ----------------------------------------------------------------------- gym
  l('gl01', 'gym', 'attribution', 'Someone stole my shoes from the locker room, the staff helped me look.', 3, 'NEUTRAL', { also: ['MIXED', 'NEGATIVE'], a: ['cleanliness'], abstain: true }),
  l('gl02', 'gym', 'attribution', 'I injured my back lifting too much on my own, the trainer had warned me.', 4, 'NEUTRAL', { also: ['POSITIVE'], t: ['trainer_quality'], a: ['trainer_availability'], abstain: true }),
  l('gl03', 'gym', 'clause', 'Trainers are great, the changing rooms are not.', 3, 'MIXED', { p: ['trainer_quality'], t: ['cleanliness'] }),
  l('gl04', 'gym', 'clause', 'Affordable membership; the weights section is always packed.', 3, 'MIXED', { p: ['value_pricing'], i: ['crowding'] }),
  l('gl05', 'gym', 'negation', 'The trainer does not correct your form.', 2, 'NEGATIVE', { t: ['trainer_availability'], x: ['trainer_quality'] }),
  l('gl06', 'gym', 'negation', 'Not once was the AC working this month.', 1, 'NEGATIVE', { i: ['ac_ventilation'], ai: true }),
  l('gl07', 'gym', 'rating_disagrees', 'Broken treadmills everywhere.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['equipment_condition'] }),
  l('gl08', 'gym', 'sarcasm', 'Brilliant, the only working treadmill has a queue of ten people.', 1, 'NEGATIVE', { i: ['equipment_condition', 'crowding'], ai: true }),
  l('gl09', 'gym', 'multilingual', 'Membership cancel karne ke baad bhi paise kaat liye.', 1, 'NEGATIVE', { i: ['membership_billing'], x: ['class_schedule'] }),
  l('gl10', 'gym', 'multilingual', 'ट्रेनर खूप मदत करतात.', 5, 'POSITIVE', { p: ['trainer_quality'] }),
  l('gl11', 'gym', 'vague', 'Not my kind of place.', 2, 'NEGATIVE', { also: ['NEUTRAL'], abstain: true }),
  l('gl12', 'gym', 'temporal', 'Since the renovation the place has been spotless.', 5, 'POSITIVE', { p: ['cleanliness_praise'] }),
  l('gl13', 'gym', 'negative', 'Sales guy promised free personal training and then denied it.', 1, 'NEGATIVE', { i: ['overcommitted_sales'], x: ['trainer_quality'] }),
  l('gl14', 'gym', 'mixed', 'Great classes at convenient timings, but the parking is a nightmare.', 4, 'MIXED', { p: ['timings'], i: ['parking_access'] }),

  // --------------------------------------------------------------- real estate
  l('el01', 'real_estate', 'attribution', 'The previous owner lied about the leakage, our broker had no way of knowing.', 4, 'NEUTRAL', { also: ['POSITIVE'], a: ['listing_accuracy'], abstain: true }),
  l('el02', 'real_estate', 'attribution', 'The bank took a month to approve the loan, he chased them for us.', 5, 'POSITIVE', { t: ['paperwork_help', 'responsiveness_praise'], a: ['documentation_delay'] }),
  l('el03', 'real_estate', 'clause', 'Honest advice, slow paperwork.', 3, 'MIXED', { p: ['transparency'], i: ['documentation_delay'], t: ['market_knowledge'] }),
  l('el04', 'real_estate', 'clause', 'He answered every call; the photos on the listing were misleading though.', 3, 'MIXED', { p: ['responsiveness_praise'], i: ['listing_accuracy'] }),
  l('el05', 'real_estate', 'negation', 'He never once pushed us.', 5, 'POSITIVE', { p: ['no_pressure'], x: ['pressure_tactics'] }),
  l('el06', 'real_estate', 'negation', 'The flat did not match the description at all.', 1, 'NEGATIVE', { i: ['listing_accuracy'] }),
  l('el07', 'real_estate', 'rating_disagrees', 'Charged us a brokerage that was never discussed.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['hidden_charges'] }),
  l('el08', 'real_estate', 'sarcasm', 'Great, a site visit to a flat that was already sold.', 1, 'NEGATIVE', { i: ['listing_accuracy'], t: ['site_visit_experience'], ai: true }),
  l('el09', 'real_estate', 'multilingual', 'Agent bahut patient tha, koi pressure nahi diya.', 5, 'POSITIVE', { p: ['no_pressure'], x: ['pressure_tactics'] }),
  l('el10', 'real_estate', 'multilingual', 'टोकन रक्कम अजून परत मिळाली नाही.', 1, 'NEGATIVE', { i: ['token_refund'], ai: true }),
  l('el11', 'real_estate', 'vague', 'Could have been smoother.', 3, 'NEUTRAL', { also: ['NEGATIVE'], abstain: true }),
  l('el12', 'real_estate', 'temporal', 'Two months after registration we are still waiting for the sale deed.', 2, 'NEGATIVE', { i: ['documentation_delay'] }),
  l('el13', 'real_estate', 'negative', 'He shouted at us when we asked for a discount.', 1, 'NEGATIVE', { i: ['professionalism'] }),
  l('el14', 'real_estate', 'mixed', 'Great local knowledge and fair commission, but hard to reach on weekends.', 4, 'MIXED', { p: ['market_knowledge', 'fair_brokerage'], i: ['responsiveness'] }),

  // --------------------------------------------------------------------- salon
  l('sl01', 'salon', 'attribution', "The previous client's colour took longer than planned, they apologised for the delay.", 4, 'NEUTRAL', { also: ['POSITIVE', 'MIXED'], t: ['wait_time', 'staff_warmth'], x: ['service_result'] }),
  l('sl02', 'salon', 'attribution', "My daughter wouldn't sit still, but the stylist was so patient with her.", 5, 'POSITIVE', { p: ['staff_warmth'], t: ['stylist_skill'], a: ['staff_behaviour'] }),
  l('sl03', 'salon', 'clause', 'Great blow dry, overpriced products.', 3, 'MIXED', { p: ['stylist_skill'], i: ['pricing_transparency'], t: ['upselling_pressure', 'product_quality'] }),
  l('sl04', 'salon', 'clause', 'Clean chairs, rusty scissors.', 3, 'MIXED', { p: ['hygiene_praise'], i: ['hygiene'] }),
  l('sl05', 'salon', 'negation', "The threading didn't hurt at all.", 5, 'POSITIVE', { also: ['NEUTRAL'], t: ['stylist_skill'], x: ['service_result'] }),
  l('sl06', 'salon', 'negation', 'They did not sterilise the tools in front of me.', 2, 'NEGATIVE', { i: ['hygiene'] }),
  l('sl07', 'salon', 'rating_disagrees', 'My fringe was cut crooked.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['service_result'] }),
  l('sl08', 'salon', 'sarcasm', 'Thanks for the bonus bald patch.', 1, 'NEGATIVE', { i: ['service_result'], ai: true }),
  l('sl09', 'salon', 'multilingual', 'Staff ne bahut pyaar se baat ki.', 5, 'POSITIVE', { p: ['staff_warmth'], ai: true }),
  l('sl10', 'salon', 'multilingual', 'फेशियल के बाद चेहरे पर दाने निकल आए।', 1, 'NEGATIVE', { i: ['product_quality'], t: ['service_result'], ai: true }),
  l('sl11', 'salon', 'vague', 'So-so.', 3, 'NEUTRAL', { abstain: true }),
  l('sl12', 'salon', 'temporal', 'The colour looked great for a day and then turned orange.', 2, 'NEGATIVE', { also: ['MIXED'], i: ['service_result'], t: ['product_quality'] }),
  l('sl13', 'salon', 'negative', 'Booked for 4, they took me at 5.', 2, 'NEGATIVE', { i: ['wait_time'], t: ['appointment_scheduling'] }),
  l('sl14', 'salon', 'mixed', 'Relaxing head massage, sweet staff, fair prices.', 5, 'POSITIVE', { p: ['ambience', 'staff_warmth', 'value_pricing'] }),

  // ------------------------------------------------------------ wedding vendor
  l('wl01', 'wedding_vendor', 'attribution', 'The DJ arrived late and the sound was awful, but the photographer captured everything.', 4, 'POSITIVE', { also: ['MIXED'], t: ['output_quality', 'team_conduct'], a: ['punctuality'] }),
  l('wl02', 'wedding_vendor', 'attribution', "The groom's side delayed the muhurat by an hour.", 4, 'NEUTRAL', { also: ['NEGATIVE'], a: ['punctuality'], abstain: true }),
  l('wl03', 'wedding_vendor', 'attribution', 'Our relatives were rude to the crew, and they stayed polite throughout.', 5, 'POSITIVE', { p: ['team_conduct'], a: ['professionalism'] }),
  l('wl04', 'wedding_vendor', 'clause', 'Beautiful mandap, sloppy stage lighting.', 3, 'MIXED', { p: ['output_quality'], t: ['quality_vs_sample', 'professionalism'] }),
  l('wl05', 'wedding_vendor', 'clause', 'Delivered on time; the colours in the album look washed out.', 3, 'MIXED', { p: ['delivery_speed'], t: ['quality_vs_sample'] }),
  l('wl06', 'wedding_vendor', 'negation', 'The photographer did not leave until the last guest had gone.', 5, 'POSITIVE', { t: ['team_conduct'], x: ['coverage_gaps', 'professionalism'], ai: true }),
  l('wl07', 'wedding_vendor', 'negation', 'Not one update in three months.', 1, 'NEGATIVE', { i: ['communication'] }),
  l('wl08', 'wedding_vendor', 'rating_disagrees', 'Half the family portraits are out of focus.', 4, 'MIXED', { also: ['NEGATIVE'], t: ['quality_vs_sample', 'coverage_gaps'] }),
  l('wl09', 'wedding_vendor', 'sarcasm', "Loved paying extra for 'fuel' that nobody mentioned.", 1, 'NEGATIVE', { i: ['hidden_costs'], ai: true }),
  l('wl10', 'wedding_vendor', 'multilingual', 'Team ekdum professional thi, sab time pe hua.', 5, 'POSITIVE', { p: ['team_conduct', 'punctuality_praise'] }),
  l('wl11', 'wedding_vendor', 'multilingual', 'फोटो ठीक हैं लेकिन वीडियो अभी तक नहीं मिला।', 2, 'NEGATIVE', { also: ['MIXED'], i: ['delivery_delay'], t: ['output_quality'], ai: true }),
  l('wl12', 'wedding_vendor', 'vague', 'Could be worse.', 3, 'NEUTRAL', { also: ['POSITIVE'], abstain: true }),
  l('wl13', 'wedding_vendor', 'temporal', 'They promised the album by Diwali; it is now March.', 1, 'NEGATIVE', { i: ['delivery_delay'], ai: true }),
  l('wl14', 'wedding_vendor', 'mixed', 'Gorgeous decor and a sweet team, but they refused to make any changes to the video edit.', 3, 'MIXED', { p: ['output_quality', 'team_conduct'], i: ['revisions_refused'] }),
];
