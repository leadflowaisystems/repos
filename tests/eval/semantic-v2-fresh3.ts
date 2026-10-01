import { v2, type V2Example } from './semantic-v2';

/**
 * BLIND SET #3: 100 examples, the generalisation test for the second cycle.
 *
 * Written after the second development cycle was finished, labelled before any
 * reader saw it, hashed, and run once. Never tuned against.
 */
const f = (...args: Parameters<typeof v2> extends [unknown, ...infer R] ? R : never) => v2('FRESH2', ...args);

export const SEMANTIC_V2_FRESH3: V2Example[] = [
  // ---------------------------------------------------------------- restaurant
  f('rg01', 'restaurant', 'attribution', 'A drunk guest at the next table kept shouting, and the manager asked him to leave.', 4, 'POSITIVE', { also: ['NEUTRAL', 'MIXED'], a: ['staff_behaviour', 'ambience_noise'] }),
  f('rg02', 'restaurant', 'clause', 'Crispy dosas, though the sambar was watery.', 3, 'MIXED', { p: ['food_taste'], t: ['food_quality'] }),
  f('rg03', 'restaurant', 'negation', 'Nothing on the menu disappointed us.', 5, 'POSITIVE', { also: ['NEUTRAL'], t: ['food_taste', 'menu_variety'], x: ['food_quality'] }),
  f('rg04', 'restaurant', 'temporal', 'The pizza was excellent last summer, now it arrives burnt every time.', 2, 'NEGATIVE', { i: ['food_quality'], x: ['food_taste'] }),
  f('rg05', 'restaurant', 'quantitative', 'Took an hour and ten minutes to get our main course.', 1, 'NEGATIVE', { i: ['service_speed'] }),
  f('rg06', 'restaurant', 'mixed', 'Warm welcome, tasty kebabs, but the AC was barely working.', 3, 'MIXED', { p: ['staff_warmth', 'food_taste'], t: ['ambience_noise'] }),
  f('rg07', 'restaurant', 'rating_disagrees', 'The tables were sticky and the floor was greasy.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['cleanliness'] }),
  f('rg08', 'restaurant', 'sarcasm', 'Fantastic, the third time this month they messed up our order.', 1, 'NEGATIVE', { i: ['order_accuracy'], ai: true }),
  f('rg09', 'restaurant', 'multilingual', 'Seva bahut dheere thi, ek ghanta laga.', 2, 'NEGATIVE', { i: ['service_speed'], ai: true }),
  f('rg10', 'restaurant', 'vague', 'Not sure what to say.', 3, 'NEUTRAL', { abstain: true }),
  f('rg11', 'restaurant', 'event', 'There was a cricket match on the big screen, which was fun.', 5, 'POSITIVE', { t: ['ambience'] }),
  f('rg12', 'restaurant', 'attribution', 'My husband ordered the wrong dish himself, the waiter swapped it without fuss.', 5, 'POSITIVE', { t: ['staff_warmth', 'service_quality'], a: ['order_accuracy'] }),
  f('rg13', 'restaurant', 'positive', 'Amazing biryani. Highly recommend.', 5, 'POSITIVE', { p: ['food_taste'], x: ['service_quality', 'staff_warmth', 'value_for_money', 'cleanliness_praise'] }),
  f('rg14', 'restaurant', 'negative', 'They added a service charge without telling us.', 1, 'NEGATIVE', { i: ['billing_issue'], t: ['pricing_value'] }),
  f('rg15', 'restaurant', 'indirect', 'We ended up eating at home after leaving here.', 2, 'NEGATIVE', { also: ['NEUTRAL'], ai: true, abstain: true }),

  // -------------------------------------------------------------------- clinic
  f('cg01', 'clinic', 'attribution', 'The ambulance took forever to arrive, but the doctor was ready the moment we got in.', 4, 'POSITIVE', { also: ['MIXED'], t: ['doctor_care', 'short_wait'], a: ['wait_time'] }),
  f('cg02', 'clinic', 'clause', 'Kind receptionist, cold and hurried doctor.', 3, 'MIXED', { p: ['staff_friendly'], i: ['consultation_rush'], x: ['doctor_care'] }),
  f('cg03', 'clinic', 'negation', 'Did not feel rushed at any point.', 5, 'POSITIVE', { t: ['doctor_care'], x: ['consultation_rush'] }),
  f('cg04', 'clinic', 'temporal', 'The cough eased for a week, then returned worse than before.', 2, 'NEGATIVE', { i: ['treatment_outcome'], x: ['good_outcome'] }),
  f('cg05', 'clinic', 'quantitative', 'Waited two and a half hours with an appointment.', 1, 'NEGATIVE', { i: ['wait_time'], t: ['appointment_scheduling'] }),
  f('cg06', 'clinic', 'rating_disagrees', 'The toilets smelled terrible.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['cleanliness'] }),
  f('cg07', 'clinic', 'sarcasm', 'Love how nobody ever answers the clinic phone.', 1, 'NEGATIVE', { i: ['phone_unreachable'], ai: true }),
  f('cg08', 'clinic', 'multilingual', 'डॉक्टरांनी खूप घाई केली, नीट ऐकलं नाही.', 2, 'NEGATIVE', { i: ['consultation_rush'], ai: true }),
  f('cg09', 'clinic', 'vague', 'It was a visit.', null, 'NEUTRAL', { abstain: true }),
  f('cg10', 'clinic', 'event', 'The lift was under repair so we took the stairs, no big deal.', 4, 'POSITIVE', { also: ['NEUTRAL'], abstain: true }),
  f('cg11', 'clinic', 'attribution', 'The patient in front of me argued with the nurse for ages.', 3, 'NEUTRAL', { also: ['NEGATIVE'], a: ['staff_behaviour'], abstain: true }),
  f('cg12', 'clinic', 'short', 'Caring doctor.', 5, 'POSITIVE', { p: ['doctor_care'] }),
  f('cg13', 'clinic', 'negative', 'Nobody told us the test would cost extra.', 2, 'NEGATIVE', { i: ['billing_clarity'] }),
  f('cg14', 'clinic', 'mixed', 'Very clean clinic, but the doctor came forty minutes late.', 3, 'MIXED', { p: ['clean_facility'], i: ['wait_time'] }),
  f('cg15', 'clinic', 'ambiguous', 'The treatment was intense.', null, 'NEUTRAL', { also: ['POSITIVE', 'NEGATIVE'], t: ['treatment_outcome', 'good_outcome'], abstain: true }),

  // ------------------------------------------------------------------ coaching
  f('kg01', 'coaching', 'attribution', 'My son forgot his assignment twice, the teacher gave him extra time.', 5, 'POSITIVE', { p: ['individual_attention'], t: ['faculty_support'], a: ['teaching_quality'] }),
  f('kg02', 'coaching', 'clause', 'Brilliant maths faculty, but the chemistry classes are rushed.', 3, 'MIXED', { p: ['teaching_quality_praise'], t: ['teaching_quality'] }),
  f('kg03', 'coaching', 'negation', 'Not one class has started late this term.', 5, 'POSITIVE', { t: ['discipline'], x: ['schedule_reliability'] }),
  f('kg04', 'coaching', 'temporal', 'The study material was updated at the start, then never revised again.', 2, 'NEGATIVE', { also: ['MIXED'], t: ['study_material'], x: ['study_material_praise'] }),
  f('kg05', 'coaching', 'quantitative', 'Around 85 students share one teacher in my batch.', 2, 'NEGATIVE', { i: ['batch_size'] }),
  f('kg06', 'coaching', 'rating_disagrees', 'Nobody informed us that the test was cancelled.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['communication_parents'], t: ['schedule_reliability'] }),
  f('kg07', 'coaching', 'sarcasm', 'Brilliant, the mock test answer key is wrong again.', 1, 'NEGATIVE', { t: ['study_material'], ai: true }),
  f('kg08', 'coaching', 'multilingual', 'Fees bahut zyada badha di bina bataye.', 1, 'NEGATIVE', { i: ['fee_transparency'], t: ['communication_parents'], ai: true }),
  f('kg09', 'coaching', 'vague', 'Will see how it goes.', 3, 'NEUTRAL', { abstain: true }),
  f('kg10', 'coaching', 'event', 'The board exam dates moved, and the centre rearranged revision classes quickly.', 5, 'POSITIVE', { t: ['discipline', 'faculty_support'], a: ['schedule_reliability'] }),
  f('kg11', 'coaching', 'negative', 'The teacher mocks students who ask questions.', 1, 'NEGATIVE', { t: ['safety_discipline', 'teaching_quality'] }),
  f('kg12', 'coaching', 'mixed', 'Regular tests, but no feedback on mistakes.', 3, 'MIXED', { p: ['discipline'], t: ['individual_attention', 'teaching_quality'] }),
  f('kg13', 'coaching', 'vague', 'Decent place to study.', 4, 'POSITIVE', { abstain: true }),
  f('kg14', 'coaching', 'attribution', 'A few senior students tease the juniors outside the gate.', 3, 'NEUTRAL', { also: ['NEGATIVE'], t: ['safety_discipline'] }),

  // ----------------------------------------------------------------------- gym
  f('gg01', 'gym', 'attribution', 'My gym partner skipped the session, the trainer still made it worth it.', 5, 'POSITIVE', { t: ['trainer_quality'], a: ['class_schedule', 'trainer_availability'] }),
  f('gg02', 'gym', 'clause', 'Supportive trainers; the music is way too loud.', 3, 'MIXED', { p: ['trainer_quality'], t: ['atmosphere'] }),
  f('gg03', 'gym', 'negation', 'The showers are never clean.', 2, 'NEGATIVE', { i: ['cleanliness'], x: ['cleanliness_praise'] }),
  f('gg04', 'gym', 'temporal', 'The steam room was lovely when we joined, now it is always shut.', 2, 'NEGATIVE', { t: ['equipment_condition'] }),
  f('gg05', 'gym', 'quantitative', 'Only two working treadmills for forty people at 7 pm.', 2, 'NEGATIVE', { t: ['crowding', 'equipment_condition'] }),
  f('gg06', 'gym', 'rating_disagrees', 'The weights are rusty and some plates are cracked.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['equipment_condition'] }),
  f('gg07', 'gym', 'sarcasm', 'Great job charging me twice this month.', 1, 'NEGATIVE', { i: ['membership_billing'], x: ['value_pricing'], ai: true }),
  f('gg08', 'gym', 'multilingual', 'जिम मध्ये उपकरणं चांगली आहेत.', 5, 'POSITIVE', { p: ['equipment_quality'], ai: true }),
  f('gg09', 'gym', 'vague', 'Comme ci comme ça.', 3, 'NEUTRAL', { abstain: true }),
  f('gg10', 'gym', 'event', 'The power went out mid-workout and the generator took over within a minute.', 4, 'POSITIVE', { also: ['NEUTRAL'], abstain: true }),
  f('gg11', 'gym', 'negative', 'The front desk refused to freeze my membership during surgery.', 1, 'NEGATIVE', { i: ['membership_billing'], t: ['staff_behaviour'] }),
  f('gg12', 'gym', 'mixed', 'Great value, though the changing rooms are tiny.', 3, 'MIXED', { p: ['value_pricing'], t: ['crowding'] }),
  f('gg13', 'gym', 'positive', 'Love the energy here.', 5, 'POSITIVE', { p: ['atmosphere'] }),
  f('gg14', 'gym', 'positive', 'Down 9 kg in four months thanks to the coaching.', 5, 'POSITIVE', { p: ['results'], t: ['trainer_quality'] }),

  // --------------------------------------------------------------- real estate
  f('eg01', 'real_estate', 'attribution', 'The builder missed the possession date, our agent got us compensation.', 5, 'POSITIVE', { t: ['post_deal_support', 'responsiveness_praise'], a: ['documentation_delay'] }),
  f('eg02', 'real_estate', 'clause', 'Honest about the flaws; sluggish with paperwork.', 3, 'MIXED', { p: ['transparency'], i: ['documentation_delay'] }),
  f('eg03', 'real_estate', 'negation', 'He never pressured us to close.', 5, 'POSITIVE', { p: ['no_pressure'], x: ['pressure_tactics'] }),
  f('eg04', 'real_estate', 'temporal', 'Super helpful while we were looking, then disappeared after the token.', 2, 'NEGATIVE', { i: ['post_deal_support'], x: ['responsiveness_praise'] }),
  f('eg05', 'real_estate', 'quantitative', 'Took six weeks just to get the sale agreement drafted.', 2, 'NEGATIVE', { i: ['documentation_delay'] }),
  f('eg06', 'real_estate', 'rating_disagrees', 'Kept pushing us to pay the token the same day.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['pressure_tactics'] }),
  f('eg07', 'real_estate', 'sarcasm', 'Wonderful, the "sea-facing" flat faces a wall.', 1, 'NEGATIVE', { i: ['listing_accuracy'], ai: true }),
  f('eg08', 'real_estate', 'multilingual', 'Broker ne har cheez saaf saaf batayi.', 5, 'POSITIVE', { p: ['transparency'], ai: true }),
  f('eg09', 'real_estate', 'vague', 'Usual broker stuff.', 3, 'NEUTRAL', { abstain: true }),
  f('eg10', 'real_estate', 'event', 'Registration was delayed by a server outage at the office; he kept us posted.', 4, 'POSITIVE', { t: ['responsiveness_praise'], a: ['documentation_delay'] }),
  f('eg11', 'real_estate', 'negative', 'The carpet area was far less than what the listing claimed.', 1, 'NEGATIVE', { i: ['listing_accuracy'] }),
  f('eg12', 'real_estate', 'mixed', 'Good market sense, but hard to pin down for visits.', 3, 'MIXED', { t: ['market_knowledge', 'site_visit_experience', 'responsiveness'] }),
  f('eg13', 'real_estate', 'vague', 'Nice guy.', 4, 'POSITIVE', { abstain: true }),
  f('eg14', 'real_estate', 'attribution', "The owner's lawyer kept delaying the papers; our agent followed up daily.", 4, 'POSITIVE', { also: ['MIXED'], t: ['responsiveness_praise', 'paperwork_help'], a: ['documentation_delay'] }),

  // --------------------------------------------------------------------- salon
  f('sg01', 'salon', 'attribution', 'My toddler cried throughout, the staff were so patient with us.', 5, 'POSITIVE', { p: ['staff_warmth'], a: ['staff_behaviour'] }),
  f('sg02', 'salon', 'clause', 'Neat threading, rough with the waxing.', 3, 'MIXED', { p: ['stylist_skill'], t: ['service_result', 'staff_behaviour'] }),
  f('sg03', 'salon', 'negation', 'No one tried to sell me products.', 5, 'POSITIVE', { x: ['upselling_pressure'] }),
  f('sg04', 'salon', 'temporal', 'The perm looked fabulous on day one, then fell flat within a week.', 2, 'NEGATIVE', { i: ['service_result'], x: ['stylist_skill'] }),
  f('sg05', 'salon', 'quantitative', 'An hour late for a booked slot, again.', 1, 'NEGATIVE', { i: ['wait_time'], t: ['appointment_scheduling'] }),
  f('sg06', 'salon', 'rating_disagrees', 'They reused the same cotton for everyone.', 5, 'MIXED', { also: ['NEGATIVE'], i: ['hygiene'] }),
  f('sg07', 'salon', 'sarcasm', 'Well done burning my scalp with the dryer.', 1, 'NEGATIVE', { i: ['service_result'], x: ['stylist_skill'], ai: true }),
  f('sg08', 'salon', 'multilingual', 'Staff bahut rude tha.', 1, 'NEGATIVE', { i: ['staff_behaviour'] }),
  f('sg09', 'salon', 'vague', 'Hmm.', 3, 'NEUTRAL', { abstain: true }),
  f('sg10', 'salon', 'event', 'It was a festival rush, still they gave me my slot on time.', 5, 'POSITIVE', { p: ['punctuality'] }),
  f('sg11', 'salon', 'negative', 'The price on the bill was double the rate card.', 1, 'NEGATIVE', { i: ['pricing_transparency'] }),
  f('sg12', 'salon', 'mixed', 'Lovely colour, but they pushed a membership hard.', 3, 'MIXED', { p: ['stylist_skill'], i: ['upselling_pressure'] }),
  f('sg13', 'salon', 'vague', 'Good place.', 4, 'POSITIVE', { abstain: true }),
  f('sg14', 'salon', 'ambiguous', 'The stylist took her time.', null, 'NEUTRAL', { also: ['POSITIVE', 'NEGATIVE'], t: ['stylist_skill', 'wait_time'], abstain: true }),

  // ------------------------------------------------------------ wedding vendor
  f('wg01', 'wedding_vendor', 'attribution', 'Our caterer served late, but the decor crew had everything ready on time.', 5, 'POSITIVE', { also: ['MIXED'], p: ['punctuality_praise'], a: ['punctuality'] }),
  f('wg02', 'wedding_vendor', 'clause', 'Dreamy candids; the album design was cluttered.', 3, 'MIXED', { p: ['output_quality'], t: ['quality_vs_sample'] }),
  f('wg03', 'wedding_vendor', 'negation', 'There was no hidden cost anywhere.', 5, 'POSITIVE', { t: ['value_pricing'], x: ['hidden_costs'] }),
  f('wg04', 'wedding_vendor', 'temporal', 'They sent updates every week at first, then nothing for two months.', 2, 'NEGATIVE', { i: ['communication'], x: ['communication_praise'] }),
  f('wg05', 'wedding_vendor', 'quantitative', 'The wedding film reached us after ten months.', 1, 'NEGATIVE', { i: ['delivery_delay'] }),
  f('wg06', 'wedding_vendor', 'rating_disagrees', 'A different, inexperienced photographer showed up.', 4, 'MIXED', { also: ['NEGATIVE'], i: ['team_substitution'] }),
  f('wg07', 'wedding_vendor', 'sarcasm', 'Thanks for missing the varmala entirely.', 1, 'NEGATIVE', { i: ['coverage_gaps'], ai: true }),
  f('wg08', 'wedding_vendor', 'multilingual', 'Team bahut samay par aayi aur sab sambhal liya.', 5, 'POSITIVE', { t: ['punctuality_praise', 'team_conduct'], ai: true }),
  f('wg09', 'wedding_vendor', 'vague', 'Fine overall.', 3, 'NEUTRAL', { also: ['POSITIVE'], abstain: true }),
  f('wg10', 'wedding_vendor', 'event', 'A storm knocked down the outdoor stage, and they rebuilt it indoors in an hour.', 5, 'POSITIVE', { t: ['flexibility', 'team_conduct'], a: ['quality_vs_sample'] }),
  f('wg11', 'wedding_vendor', 'negative', 'They charged extra for the drone shots after the event.', 1, 'NEGATIVE', { i: ['hidden_costs'] }),
  f('wg12', 'wedding_vendor', 'mixed', 'Gorgeous mandap, but the team was rude to my parents.', 3, 'MIXED', { p: ['output_quality'], i: ['professionalism'] }),
  f('wg13', 'wedding_vendor', 'positive', 'Beautiful photos.', 5, 'POSITIVE', { p: ['output_quality'] }),
  f('wg14', 'wedding_vendor', 'attribution', 'The bride\'s uncle shouted at the crew, and they stayed calm and polite.', 5, 'POSITIVE', { p: ['team_conduct'], a: ['professionalism'] }),
];
