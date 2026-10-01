/**
 * THE SEMANTIC ACCURACY EVALUATION SET (intelligence audit, Sep 2026).
 *
 * 292 synthetic pieces of feedback across all seven vertical packs, each with
 * the reading a careful PERSON would give it: the overall sentiment, the
 * praise and problem topics from that pack's own taxonomy, the part of the
 * visit each is about, what must NOT be inferred, and whether the wording is
 * explicit enough for the keyword reader or needs a second reader.
 *
 * THE LABELS ARE FIXED, AND THEY ARE NOT THE ENGINE'S ANSWERS. They were
 * written by hand before the engine was run on them, from the sentence alone.
 * Nothing here is generated at run time and no model is consulted. Where the
 * engine disagrees with a label, the engine is wrong until somebody argues the
 * label — see `KNOWN_MISSES` in the evaluation test, which lists every
 * disagreement by id so that neither a regression nor an improvement can pass
 * unnoticed.
 *
 * No real customer wrote any of this and no real business is described.
 */

export type EvalSentiment = 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL';

export type EvalCategory =
  | 'positive'
  | 'negative'
  | 'mixed'
  | 'neutral'
  | 'short'
  | 'long'
  | 'multi_issue'
  | 'indirect'
  | 'colloquial'
  | 'misspelt'
  | 'multilingual'
  | 'ambiguous'
  | 'must_not_infer'
  | 'rating_disagrees'
  | 'same_concept';

export type EvalExample = {
  id: string;
  pack: 'restaurant' | 'clinic' | 'coaching' | 'gym' | 'real_estate' | 'salon' | 'wedding_vendor';
  text: string;
  stars: number | null;
  category: EvalCategory;
  expected: {
    sentiment: EvalSentiment;
    /** Other overall readings a person would also accept for this sentence. */
    alsoAccept?: EvalSentiment[];
    /** Praise topics (pack taxonomy keys) the sentence genuinely supports. */
    praise: string[];
    /** Problem topics (pack taxonomy keys) the sentence genuinely supports. */
    issues: string[];
    /** Topics a person could defend either way: neither required nor an error. */
    tolerated?: string[];
    /** Topics that would be an invented reading. Never acceptable. */
    prohibited?: string[];
    /**
     * The parts of the visit the sentence is about, as the pack's own rating
     * dimensions where it has one, with which way the customer spoke of each.
     */
    dimensions: Array<{ key: string; polarity: 'positive' | 'negative' }>;
    /**
     * KEYWORD: the wording is explicit; the keyword reader should be enough.
     * AI: indirect, contradictory or uncovered wording; a second reader is
     * warranted. Judged from the sentence, not from the router.
     */
    routing: 'KEYWORD' | 'AI';
  };
  note?: string;
};

const ex = (
  id: string,
  pack: EvalExample['pack'],
  category: EvalCategory,
  text: string,
  stars: number | null,
  expected: EvalExample['expected'],
  note?: string,
): EvalExample => ({ id, pack, category, text, stars, expected, ...(note ? { note } : {}) });

const pos = (key: string) => ({ key, polarity: 'positive' as const });
const neg = (key: string) => ({ key, polarity: 'negative' as const });

export const SEMANTIC_DATASET: EvalExample[] = [
  // =========================================================================
  // RESTAURANT / CAFE
  // =========================================================================
  ex('r01', 'restaurant', 'mixed', 'Food was excellent but we waited 30 minutes for the bill.', null, {
    sentiment: 'MIXED',
    praise: ['food_taste'],
    issues: ['service_speed'],
    dimensions: [pos('food'), neg('waiting')],
    routing: 'KEYWORD',
  }, 'Named failure mode: praise for one part, a complaint about another.'),
  ex('r02', 'restaurant', 'mixed', 'Staff were lovely but nobody came to take our order.', null, {
    sentiment: 'MIXED',
    praise: ['staff_warmth'],
    issues: ['staff_behaviour'],
    tolerated: ['service_speed'],
    dimensions: [pos('service'), neg('service')],
    routing: 'AI',
  }, 'Named failure mode: the complaint carries no complaint keyword.'),
  ex('r03', 'restaurant', 'must_not_infer', 'Great food. Will come again.', 5, {
    sentiment: 'POSITIVE',
    praise: ['food_taste'],
    issues: [],
    prohibited: ['service_speed', 'staff_behaviour', 'cleanliness', 'pricing_value', 'order_accuracy'],
    dimensions: [pos('food')],
    routing: 'KEYWORD',
  }, 'Named failure mode: no service, cleanliness or value issue may be invented.'),
  ex('r04', 'restaurant', 'must_not_infer', 'Everything was fine.', null, {
    sentiment: 'NEUTRAL',
    alsoAccept: ['POSITIVE'],
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'Named failure mode: no topic may be manufactured.'),
  ex('r05', 'restaurant', 'ambiguous', 'Not bad.', null, {
    sentiment: 'NEUTRAL',
    alsoAccept: ['MIXED'],
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'Named failure mode: must not read as strongly positive — or as negative.'),
  ex('r06', 'restaurant', 'mixed', 'The room was clean but check-in took forever.', null, {
    sentiment: 'MIXED',
    praise: ['cleanliness_praise'],
    issues: ['service_speed'],
    dimensions: [pos('cleanliness'), neg('waiting')],
    routing: 'KEYWORD',
  }, 'Named failure mode. There is no hospitality pack; read with the closest one.'),
  ex('r07', 'restaurant', 'rating_disagrees', 'Food was cold and the waiter was rude.', 5, {
    sentiment: 'MIXED',
    praise: [],
    issues: ['food_quality', 'staff_behaviour'],
    dimensions: [neg('food'), neg('service')],
    routing: 'AI',
  }, 'Five stars on a list of faults: the wording and the rating disagree.'),
  ex('r08', 'restaurant', 'rating_disagrees', 'Lovely ambience and tasty food.', 2, {
    sentiment: 'MIXED',
    praise: ['ambience', 'food_taste'],
    issues: [],
    dimensions: [pos('food')],
    routing: 'AI',
  }, 'Two stars on nothing but praise.'),
  ex('r09', 'restaurant', 'indirect', 'We left hungry and will not be returning.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: [],
    tolerated: ['food_quality', 'pricing_value'],
    dimensions: [],
    routing: 'AI',
  }, 'Negative with no explicit keyword.'),
  ex('r10', 'restaurant', 'multi_issue', 'Cold food, wrong order and a dirty table.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['food_quality', 'order_accuracy', 'cleanliness'],
    dimensions: [neg('food'), neg('cleanliness')],
    routing: 'KEYWORD',
  }, 'Three problems in one sentence.'),
  ex('r11', 'restaurant', 'same_concept', 'The service was painfully slow.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_speed'],
    dimensions: [neg('waiting')],
    routing: 'KEYWORD',
  }, 'Slow service, said plainly.'),
  ex('r12', 'restaurant', 'same_concept', 'It took ages for our food to arrive.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_speed'],
    dimensions: [neg('waiting')],
    routing: 'AI',
  }, 'Slow service, said idiomatically.'),
  ex('r13', 'restaurant', 'same_concept', 'Humein khana aane mein bahut der lagi.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_speed'],
    prohibited: ['food_quality'],
    dimensions: [neg('waiting')],
    routing: 'KEYWORD',
  }, 'Slow service, in romanised Hindi.'),
  ex('r14', 'restaurant', 'multilingual', 'जेवण खूप चवदार होतं आणि सेवा पण छान.', null, {
    sentiment: 'POSITIVE',
    praise: ['food_taste', 'service_quality'],
    issues: [],
    dimensions: [pos('food'), pos('service')],
    routing: 'KEYWORD',
  }, 'Marathi: the food was very tasty and the service was nice too.'),
  ex('r15', 'restaurant', 'multilingual', 'खाना ठंडा था और बहुत देर से आया।', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['food_quality', 'service_speed'],
    dimensions: [neg('food'), neg('waiting')],
    routing: 'KEYWORD',
  }, 'Hindi: the food was cold and came very late.'),
  ex('r16', 'restaurant', 'misspelt', 'Foood was delicous but servise was vry slow.', null, {
    sentiment: 'MIXED',
    praise: ['food_taste'],
    issues: ['service_speed'],
    dimensions: [pos('food'), neg('waiting')],
    routing: 'AI',
  }, 'Spelling mistakes on the praise half.'),
  ex('r17', 'restaurant', 'colloquial', 'Paisa vasool! Mast biryani, ekdum zabardast.', null, {
    sentiment: 'POSITIVE',
    praise: ['food_taste', 'value_for_money'],
    issues: [],
    dimensions: [pos('food'), pos('value')],
    routing: 'KEYWORD',
  }, 'Colloquial Hinglish praise.'),
  ex('r18', 'restaurant', 'indirect', 'By the time our mains arrived, the kids had fallen asleep.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_speed'],
    dimensions: [neg('waiting')],
    routing: 'AI',
  }, 'A wait described without any waiting word.'),
  ex('r19', 'restaurant', 'must_not_infer', 'We did not wait at all, seated straight away.', null, {
    sentiment: 'POSITIVE',
    alsoAccept: ['NEUTRAL'],
    praise: [],
    issues: [],
    tolerated: ['service_quality'],
    prohibited: ['service_speed', 'wait_for_table'],
    dimensions: [pos('waiting')],
    routing: 'KEYWORD',
  }, 'A negated wait is not a wait complaint.'),
  ex('r20', 'restaurant', 'must_not_infer', 'The food was not cold and the staff were not rude at all.', null, {
    sentiment: 'POSITIVE',
    alsoAccept: ['NEUTRAL'],
    praise: [],
    issues: [],
    prohibited: ['food_quality', 'staff_behaviour'],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'Two negated complaints.'),
  ex('r21', 'restaurant', 'long', 'We came for my mother’s birthday on Saturday evening. The paneer tikka and dal were delicious and the place looks beautiful with the new lights. Only complaint is that it has become quite expensive for the portion size.', 4, {
    sentiment: 'MIXED',
    praise: ['food_taste', 'ambience'],
    issues: ['pricing_value'],
    dimensions: [pos('food'), neg('value')],
    routing: 'KEYWORD',
  }, 'A long comment with two compliments and one complaint.'),
  ex('r22', 'restaurant', 'neutral', 'Do you have a separate section for families?', null, {
    sentiment: 'NEUTRAL',
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'A question, not an opinion.'),
  ex('r23', 'restaurant', 'short', 'Tasty', 5, {
    sentiment: 'POSITIVE',
    praise: ['food_taste'],
    issues: [],
    dimensions: [pos('food')],
    routing: 'KEYWORD',
  }),
  ex('r24', 'restaurant', 'short', 'Slow.', 2, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_speed'],
    dimensions: [neg('waiting')],
    routing: 'KEYWORD',
  }),
  ex('r25', 'restaurant', 'ambiguous', 'The biryani was something else.', null, {
    sentiment: 'NEUTRAL',
    alsoAccept: ['POSITIVE'],
    praise: [],
    issues: [],
    tolerated: ['food_taste'],
    prohibited: ['food_quality'],
    dimensions: [],
    routing: 'AI',
  }, 'Could be high praise or a complaint; no direction may be asserted as a problem.'),
  ex('r26', 'restaurant', 'indirect', 'Great, another 40 minute wait. Just what we needed.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_speed'],
    tolerated: ['wait_for_table'],
    dimensions: [neg('waiting')],
    routing: 'AI',
  }, 'Sarcasm: "great" is not praise here.'),
  ex('r27', 'restaurant', 'rating_disagrees', 'Best dosa in town, we come every week.', 1, {
    sentiment: 'MIXED',
    praise: ['food_taste'],
    issues: [],
    dimensions: [pos('food')],
    routing: 'AI',
  }, 'One star on glowing praise, most likely a mis-tap; must be flagged, not averaged.'),
  ex('r28', 'restaurant', 'negative', 'Waiter forgot our drinks twice.', 3, {
    sentiment: 'MIXED',
    alsoAccept: ['NEGATIVE'],
    praise: [],
    issues: ['staff_behaviour', 'order_accuracy'],
    dimensions: [neg('service')],
    routing: 'KEYWORD',
  }),

  // =========================================================================
  // CLINIC / HEALTHCARE
  // =========================================================================
  ex('c01', 'clinic', 'positive', 'Doctor explained everything patiently and the clinic was very clean.', 5, {
    sentiment: 'POSITIVE',
    praise: ['doctor_care', 'clean_facility'],
    issues: [],
    dimensions: [pos('consultation'), pos('cleanliness')],
    routing: 'KEYWORD',
  }),
  ex('c02', 'clinic', 'negative', 'Waited two hours past my appointment time.', 2, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['wait_time'],
    tolerated: ['appointment_scheduling'],
    dimensions: [neg('waiting')],
    routing: 'KEYWORD',
  }),
  ex('c03', 'clinic', 'mixed', 'Doctor was good but the receptionist was rude and the bill was confusing.', 3, {
    sentiment: 'MIXED',
    praise: ['doctor_care'],
    issues: ['staff_behaviour', 'billing_clarity'],
    dimensions: [pos('consultation'), neg('staff')],
    routing: 'KEYWORD',
  }),
  ex('c04', 'clinic', 'negative', 'No improvement even after three visits, the pain is still there.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['treatment_outcome'],
    prohibited: ['good_outcome'],
    dimensions: [],
    routing: 'KEYWORD',
  }, '"No improvement" must not read as the praise topic "improved".'),
  ex('c05', 'clinic', 'must_not_infer', 'Doctor ne acha samjhaya, koi jaldi nahi thi.', null, {
    sentiment: 'POSITIVE',
    praise: ['doctor_care'],
    issues: [],
    prohibited: ['consultation_rush'],
    dimensions: [pos('consultation')],
    routing: 'KEYWORD',
  }, 'Hinglish: explained well, there was no hurry. A negated rush.'),
  ex('c06', 'clinic', 'multilingual', 'डॉक्टरांनी नीट समजावून सांगितले पण खूप वेळ वाट पाहावी लागली.', null, {
    sentiment: 'MIXED',
    praise: ['doctor_care'],
    issues: ['wait_time'],
    dimensions: [pos('consultation'), neg('waiting')],
    routing: 'KEYWORD',
  }, 'Marathi: explained well, but had to wait a long time.'),
  ex('c07', 'clinic', 'multilingual', 'रिसेप्शन पर बैठी मैडम ने बहुत बदतमीज़ी से बात की।', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['staff_behaviour'],
    dimensions: [neg('staff')],
    routing: 'AI',
  }, 'Hindi: the woman at reception spoke very rudely.'),
  ex('c08', 'clinic', 'multi_issue', 'Could not get an appointment for a week and nobody answers the phone.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['appointment_scheduling', 'phone_unreachable'],
    dimensions: [neg('booking')],
    routing: 'KEYWORD',
  }),
  ex('c09', 'clinic', 'must_not_infer', 'The injection did not hurt at all.', null, {
    sentiment: 'POSITIVE',
    alsoAccept: ['NEUTRAL'],
    praise: [],
    issues: [],
    prohibited: ['treatment_outcome'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('c10', 'clinic', 'neutral', 'Clinic is on the second floor.', null, {
    sentiment: 'NEUTRAL',
    praise: [],
    issues: [],
    prohibited: ['parking_access'],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'A fact about the building, not a complaint about access.'),
  ex('c11', 'clinic', 'must_not_infer', 'There was no waiting, I was seen immediately.', 5, {
    sentiment: 'POSITIVE',
    praise: ['short_wait'],
    issues: [],
    prohibited: ['wait_time'],
    dimensions: [pos('waiting')],
    routing: 'KEYWORD',
  }),
  ex('c12', 'clinic', 'negative', 'They charged me extra for a test I never asked for.', 2, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['billing_clarity'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('c13', 'clinic', 'negative', 'Report was delayed by four days and no one called back.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['followup_communication'],
    prohibited: ['wait_time'],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'A late report is a follow-up problem, not time spent in the waiting room.'),
  ex('c14', 'clinic', 'short', 'ok', 3, {
    sentiment: 'NEUTRAL',
    alsoAccept: ['MIXED'],
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('c15', 'clinic', 'rating_disagrees', 'Doctor rushed through in two minutes and did not listen.', 5, {
    sentiment: 'MIXED',
    praise: [],
    issues: ['consultation_rush'],
    prohibited: ['doctor_care'],
    dimensions: [neg('consultation')],
    routing: 'AI',
  }, '"did not listen" must not read as the praise topic "listened".'),
  ex('c16', 'clinic', 'colloquial', 'Doctor sahab bahut acche hain, staff bhi helpful.', null, {
    sentiment: 'POSITIVE',
    praise: ['doctor_care', 'staff_friendly'],
    issues: [],
    dimensions: [pos('consultation'), pos('staff')],
    routing: 'KEYWORD',
  }),
  ex('c17', 'clinic', 'indirect', 'I came out with more questions than I went in with.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['consultation_rush'],
    dimensions: [neg('consultation')],
    routing: 'AI',
  }),

  // =========================================================================
  // COACHING / TUITION
  // =========================================================================
  ex('k01', 'coaching', 'positive', 'Teachers explain concepts clearly and clear every doubt.', 5, {
    sentiment: 'POSITIVE',
    praise: ['teaching_quality_praise'],
    issues: [],
    tolerated: ['individual_attention'],
    dimensions: [pos('teaching')],
    routing: 'KEYWORD',
  }),
  ex('k02', 'coaching', 'negative', 'Maths teacher was changed twice in three months.', 2, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['faculty_turnover'],
    dimensions: [neg('faculty')],
    routing: 'KEYWORD',
  }),
  ex('k03', 'coaching', 'must_not_infer', 'Too many students in one batch, my son gets no individual attention.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['batch_size'],
    prohibited: ['individual_attention'],
    dimensions: [],
    routing: 'KEYWORD',
  }, '"no individual attention" must not read as the praise topic of that name.'),
  ex('k04', 'coaching', 'multi_issue', 'Fees were increased mid-year without telling parents.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['fee_transparency', 'communication_parents'],
    dimensions: [neg('value'), neg('communication')],
    routing: 'KEYWORD',
  }),
  ex('k05', 'coaching', 'positive', 'My daughter’s marks improved from 60 to 85 percent.', 5, {
    sentiment: 'POSITIVE',
    praise: ['results_praise'],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('k06', 'coaching', 'colloquial', 'Sir chhan shikavtat, mulila sagla samajta.', null, {
    sentiment: 'POSITIVE',
    praise: ['teaching_quality_praise'],
    issues: [],
    dimensions: [pos('teaching')],
    routing: 'AI',
  }, 'Romanised Marathi: sir teaches well, my daughter understands everything.'),
  ex('k07', 'coaching', 'multilingual', 'शिक्षक नीट शिकवत नाही आणि वर्ग खूप लहान आहे.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['teaching_quality', 'facility_condition'],
    dimensions: [neg('teaching'), neg('facilities')],
    routing: 'KEYWORD',
  }, 'Marathi: the teacher does not teach properly and the classroom is very small.'),
  ex('k08', 'coaching', 'negative', 'Classes get cancelled at the last minute almost every week.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['schedule_reliability'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('k09', 'coaching', 'must_not_infer', 'They promised a top 100 rank but there were no results.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['results_claims'],
    prohibited: ['results_praise'],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'A promised rank that never came is not praise for results.'),
  ex('k10', 'coaching', 'positive', 'Notes and test series are very well prepared.', null, {
    sentiment: 'POSITIVE',
    praise: ['study_material_praise'],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('k11', 'coaching', 'mixed', 'Good teachers but the classroom fan was not working all summer.', 3, {
    sentiment: 'MIXED',
    praise: ['teaching_quality_praise'],
    issues: ['facility_condition'],
    dimensions: [pos('teaching'), neg('facilities')],
    routing: 'KEYWORD',
  }),
  ex('k12', 'coaching', 'must_not_infer', 'No complaints at all.', null, {
    sentiment: 'NEUTRAL',
    alsoAccept: ['POSITIVE'],
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('k13', 'coaching', 'neutral', 'Is there a weekend batch for class 10?', null, {
    sentiment: 'NEUTRAL',
    praise: [],
    issues: [],
    prohibited: ['batch_size'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('k14', 'coaching', 'rating_disagrees', 'Excellent faculty, very supportive.', 2, {
    sentiment: 'MIXED',
    praise: ['teaching_quality_praise', 'faculty_support'],
    issues: [],
    dimensions: [pos('teaching')],
    routing: 'AI',
  }),
  ex('k15', 'coaching', 'negative', 'A teacher shouted at my child in front of the whole class.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['safety_discipline'],
    dimensions: [],
    routing: 'KEYWORD',
  }),

  // =========================================================================
  // GYM / FITNESS
  // =========================================================================
  ex('g01', 'gym', 'positive', 'Trainers are great and the place is always clean.', 5, {
    sentiment: 'POSITIVE',
    praise: ['trainer_quality', 'cleanliness_praise'],
    issues: [],
    dimensions: [pos('trainers'), pos('cleanliness')],
    routing: 'KEYWORD',
  }),
  ex('g02', 'gym', 'negative', 'Half the treadmills are out of order.', 2, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['equipment_condition'],
    dimensions: [neg('equipment')],
    routing: 'KEYWORD',
  }),
  ex('g03', 'gym', 'negative', 'Too crowded in the evenings, had to wait for every machine.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['crowding'],
    dimensions: [neg('crowding')],
    routing: 'KEYWORD',
  }),
  ex('g04', 'gym', 'mixed', 'Great equipment but the changing room smells and the AC never works.', 3, {
    sentiment: 'MIXED',
    praise: ['equipment_quality'],
    issues: ['cleanliness', 'ac_ventilation'],
    dimensions: [pos('equipment'), neg('cleanliness'), neg('facilities')],
    routing: 'KEYWORD',
  }),
  ex('g05', 'gym', 'negative', 'They renewed my membership without asking and refused a refund.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['membership_billing'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('g06', 'gym', 'positive', 'Lost 8 kg in four months, trainer really pushes you.', 5, {
    sentiment: 'POSITIVE',
    praise: ['results', 'trainer_quality'],
    issues: [],
    dimensions: [pos('trainers')],
    routing: 'KEYWORD',
  }),
  ex('g07', 'gym', 'colloquial', 'Machine kharab hai aur trainer kabhi milta nahi.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['equipment_condition', 'trainer_availability'],
    dimensions: [neg('equipment'), neg('trainers')],
    routing: 'KEYWORD',
  }, 'Hinglish: the machine is broken and the trainer is never around.'),
  ex('g08', 'gym', 'multilingual', 'जिम स्वच्छ आहे आणि ट्रेनर चांगले मार्गदर्शन करतात.', null, {
    sentiment: 'POSITIVE',
    praise: ['cleanliness_praise', 'trainer_quality'],
    issues: [],
    dimensions: [pos('cleanliness'), pos('trainers')],
    routing: 'KEYWORD',
  }, 'Marathi: the gym is clean and the trainers guide well.'),
  ex('g09', 'gym', 'must_not_infer', 'Nothing is broken, everything works.', null, {
    sentiment: 'POSITIVE',
    alsoAccept: ['NEUTRAL'],
    praise: [],
    issues: [],
    tolerated: ['equipment_quality'],
    prohibited: ['equipment_condition'],
    dimensions: [pos('equipment')],
    routing: 'KEYWORD',
  }, '"Nothing is broken" must not read as broken equipment.'),
  ex('g10', 'gym', 'negative', 'Sales guy promised a free diet plan, never got it.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['overcommitted_sales'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('g11', 'gym', 'negative', 'Zumba class timing changed three times this month.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['class_schedule'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('g12', 'gym', 'misspelt', 'gud gym', null, {
    sentiment: 'POSITIVE',
    alsoAccept: ['NEUTRAL'],
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'Too short and too loosely spelt to file under anything.'),
  ex('g13', 'gym', 'positive', 'Open till 11 pm which suits my shift.', null, {
    sentiment: 'POSITIVE',
    praise: ['timings'],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('g14', 'gym', 'rating_disagrees', 'Dirty washroom and rude staff.', 5, {
    sentiment: 'MIXED',
    praise: [],
    issues: ['cleanliness', 'staff_behaviour'],
    dimensions: [neg('cleanliness')],
    routing: 'AI',
  }),
  ex('g15', 'gym', 'ambiguous', 'It is okay for the price.', 3, {
    sentiment: 'MIXED',
    alsoAccept: ['NEUTRAL'],
    praise: [],
    issues: [],
    tolerated: ['value_pricing'],
    dimensions: [],
    routing: 'KEYWORD',
  }),

  // =========================================================================
  // REAL ESTATE
  // =========================================================================
  ex('e01', 'real_estate', 'must_not_infer', 'Very honest broker, no hidden charges and showed us good options.', 5, {
    sentiment: 'POSITIVE',
    praise: ['transparency', 'options_shown'],
    issues: [],
    prohibited: ['hidden_charges'],
    dimensions: [pos('transparency'), pos('options')],
    routing: 'KEYWORD',
  }, '"no hidden charges" is praise, not a hidden-charges complaint.'),
  ex('e02', 'real_estate', 'negative', 'Flat looked nothing like the photos.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['listing_accuracy'],
    dimensions: [neg('options')],
    routing: 'KEYWORD',
  }),
  ex('e03', 'real_estate', 'negative', 'He never called back after taking the token amount.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['responsiveness'],
    tolerated: ['post_deal_support', 'token_refund'],
    dimensions: [neg('communication')],
    routing: 'KEYWORD',
  }),
  ex('e04', 'real_estate', 'multi_issue', 'Agreement was delayed by a month and brokerage was higher than quoted.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['documentation_delay', 'unclear_pricing'],
    tolerated: ['hidden_charges'],
    dimensions: [neg('paperwork'), neg('transparency')],
    routing: 'KEYWORD',
  }),
  ex('e05', 'real_estate', 'negative', 'Kept pressuring us to pay the token the same day.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['pressure_tactics'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('e06', 'real_estate', 'negative', 'Site visit was cancelled twice, once we waited an hour outside.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['site_visit_experience'],
    dimensions: [neg('visits')],
    routing: 'KEYWORD',
  }),
  ex('e07', 'real_estate', 'negative', 'Token not refunded even after the deal fell through.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['token_refund'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('e08', 'real_estate', 'must_not_infer', 'Broker ne sab kuch clear bataya, koi extra paise nahi maange.', null, {
    sentiment: 'POSITIVE',
    praise: ['transparency'],
    issues: [],
    prohibited: ['hidden_charges'],
    dimensions: [pos('transparency')],
    routing: 'AI',
  }, 'Hinglish: explained everything clearly, asked for no extra money.'),
  ex('e09', 'real_estate', 'multilingual', 'फोन उचलत नाही आणि करार उशिरा झाला.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['responsiveness', 'documentation_delay'],
    dimensions: [neg('communication'), neg('paperwork')],
    routing: 'KEYWORD',
  }, 'Marathi: does not pick up the phone and the agreement was late.'),
  ex('e10', 'real_estate', 'must_not_infer', 'Knows the area well and was patient, never pushy.', null, {
    sentiment: 'POSITIVE',
    praise: ['market_knowledge', 'no_pressure'],
    issues: [],
    prohibited: ['pressure_tactics'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('e11', 'real_estate', 'neutral', '2BHK in Baner, budget 80 lakh.', null, {
    sentiment: 'NEUTRAL',
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }, 'A requirement, not feedback.'),
  ex('e12', 'real_estate', 'negative', 'Price changed after we agreed.', 2, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['unclear_pricing'],
    dimensions: [neg('transparency')],
    routing: 'KEYWORD',
  }),
  ex('e13', 'real_estate', 'rating_disagrees', 'Rude and unprofessional, came late to every visit.', 4, {
    sentiment: 'MIXED',
    praise: [],
    issues: ['professionalism'],
    tolerated: ['site_visit_experience'],
    dimensions: [neg('visits')],
    routing: 'AI',
  }),
  ex('e14', 'real_estate', 'positive', 'Smooth process, got the loan sanctioned with his help.', null, {
    sentiment: 'POSITIVE',
    praise: ['paperwork_help'],
    issues: [],
    dimensions: [pos('paperwork')],
    routing: 'KEYWORD',
  }),

  // =========================================================================
  // SALON / SPA
  // =========================================================================
  ex('s01', 'salon', 'must_not_infer', 'Loved my haircut, stylist listened to exactly what I wanted.', 5, {
    sentiment: 'POSITIVE',
    praise: ['stylist_skill', 'staff_warmth'],
    issues: [],
    prohibited: ['service_result'],
    dimensions: [pos('result'), pos('stylist')],
    routing: 'KEYWORD',
  }),
  ex('s02', 'salon', 'negative', 'Colour came out completely different from what I asked for.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_result'],
    dimensions: [neg('result')],
    routing: 'KEYWORD',
  }),
  ex('s03', 'salon', 'negative', 'Waited 40 minutes even with an appointment.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['wait_time'],
    tolerated: ['appointment_scheduling'],
    dimensions: [neg('waiting')],
    routing: 'KEYWORD',
  }),
  ex('s04', 'salon', 'negative', 'Charged 500 more than the price quoted on the phone.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['pricing_transparency'],
    dimensions: [neg('value')],
    routing: 'KEYWORD',
  }),
  ex('s05', 'salon', 'mixed', 'Great facial but they kept trying to sell me a package.', 3, {
    sentiment: 'MIXED',
    praise: ['stylist_skill'],
    issues: ['upselling_pressure'],
    dimensions: [pos('result')],
    routing: 'KEYWORD',
  }),
  ex('s06', 'salon', 'must_not_infer', 'Same towel used for two customers, not hygienic.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['hygiene'],
    prohibited: ['hygiene_praise'],
    dimensions: [neg('cleanliness')],
    routing: 'KEYWORD',
  }, '"not hygienic" must not read as praise for hygiene.'),
  ex('s07', 'salon', 'colloquial', 'Haircut mast hua, staff bhi bahut polite tha.', null, {
    sentiment: 'POSITIVE',
    praise: ['stylist_skill', 'staff_warmth'],
    issues: [],
    dimensions: [pos('result'), pos('stylist')],
    routing: 'KEYWORD',
  }),
  ex('s08', 'salon', 'multilingual', 'केस खराब केले आणि जास्त पैसे घेतले.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_result', 'pricing_transparency'],
    dimensions: [neg('result'), neg('value')],
    routing: 'KEYWORD',
  }, 'Marathi: ruined the hair and charged more.'),
  ex('s09', 'salon', 'indirect', 'My scalp was itching for two days after the treatment.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['product_quality'],
    dimensions: [],
    routing: 'AI',
  }),
  ex('s10', 'salon', 'must_not_infer', 'No waiting, started right on time.', 5, {
    sentiment: 'POSITIVE',
    praise: ['punctuality'],
    issues: [],
    prohibited: ['wait_time'],
    dimensions: [pos('waiting')],
    routing: 'KEYWORD',
  }),
  ex('s11', 'salon', 'short', 'nice', 4, {
    sentiment: 'POSITIVE',
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('s12', 'salon', 'neutral', 'Do you do bridal makeup?', null, {
    sentiment: 'NEUTRAL',
    praise: [],
    issues: [],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('s13', 'salon', 'rating_disagrees', 'Rude staff and dirty floor.', 5, {
    sentiment: 'MIXED',
    praise: [],
    issues: ['staff_behaviour', 'cleanliness_space'],
    tolerated: ['hygiene'],
    dimensions: [neg('stylist')],
    routing: 'AI',
  }),
  ex('s14', 'salon', 'negative', 'She ruined my hair, it is completely uneven now.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['service_result'],
    dimensions: [neg('result')],
    routing: 'KEYWORD',
  }),
  ex('s15', 'salon', 'positive', 'Calm, relaxing place and reasonable prices.', null, {
    sentiment: 'POSITIVE',
    praise: ['ambience', 'value_pricing'],
    issues: [],
    dimensions: [pos('value')],
    routing: 'KEYWORD',
  }),

  // =========================================================================
  // WEDDING VENDOR
  // =========================================================================
  ex('w01', 'wedding_vendor', 'positive', 'Photos were stunning and the team was very professional.', 5, {
    sentiment: 'POSITIVE',
    praise: ['output_quality', 'team_conduct'],
    issues: [],
    dimensions: [pos('quality'), pos('team')],
    routing: 'KEYWORD',
  }),
  ex('w02', 'wedding_vendor', 'negative', 'Still waiting for the album after five months.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['delivery_delay'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('w03', 'wedding_vendor', 'negative', 'A junior photographer turned up instead of the person we booked.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['team_substitution'],
    dimensions: [neg('team')],
    routing: 'KEYWORD',
  }),
  ex('w04', 'wedding_vendor', 'negative', 'They missed the varmala completely.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['coverage_gaps'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('w05', 'wedding_vendor', 'mixed', 'Beautiful decor but they came two hours late on the wedding day.', 3, {
    sentiment: 'MIXED',
    praise: ['output_quality'],
    issues: ['punctuality'],
    dimensions: [pos('quality'), neg('punctuality')],
    routing: 'KEYWORD',
  }),
  ex('w06', 'wedding_vendor', 'negative', 'Asked for extra money after the event, more than the quotation.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['hidden_costs'],
    dimensions: [neg('value')],
    routing: 'KEYWORD',
  }),
  ex('w07', 'wedding_vendor', 'colloquial', 'Photos bahut sundar aaye, team time pe aayi.', null, {
    sentiment: 'POSITIVE',
    praise: ['output_quality', 'punctuality_praise'],
    issues: [],
    dimensions: [pos('quality'), pos('punctuality')],
    routing: 'AI',
  }, 'Hinglish: the photos came out beautiful, the team arrived on time.'),
  ex('w08', 'wedding_vendor', 'multilingual', 'फोटो खूप छान आले पण अल्बम अजून मिळाले नाही.', null, {
    sentiment: 'MIXED',
    praise: ['output_quality'],
    issues: ['delivery_delay'],
    dimensions: [pos('quality')],
    routing: 'KEYWORD',
  }, 'Marathi: the photos came out lovely but the album has still not arrived.'),
  ex('w09', 'wedding_vendor', 'must_not_infer', 'There was no delay, the album arrived on time.', null, {
    sentiment: 'POSITIVE',
    praise: ['delivery_speed'],
    issues: [],
    tolerated: ['punctuality_praise'],
    prohibited: ['delivery_delay', 'punctuality'],
    dimensions: [pos('punctuality')],
    routing: 'KEYWORD',
  }),
  ex('w10', 'wedding_vendor', 'negative', 'Refused to make any changes to the video edit.', null, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['revisions_refused'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('w11', 'wedding_vendor', 'negative', 'Advance not returned after we cancelled.', 1, {
    sentiment: 'NEGATIVE',
    praise: [],
    issues: ['advance_refund'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('w12', 'wedding_vendor', 'neutral', 'What are your charges for a two-day wedding?', null, {
    sentiment: 'NEUTRAL',
    praise: [],
    issues: [],
    prohibited: ['hidden_costs'],
    dimensions: [],
    routing: 'KEYWORD',
  }),
  ex('w13', 'wedding_vendor', 'rating_disagrees', 'Amazing photos, everyone loved the album.', 2, {
    sentiment: 'MIXED',
    praise: ['output_quality'],
    issues: [],
    dimensions: [pos('quality')],
    routing: 'AI',
  }),
  ex('w14', 'wedding_vendor', 'positive', 'Coordinator was calm and handled the last minute changes smoothly.', null, {
    sentiment: 'POSITIVE',
    praise: ['team_conduct', 'flexibility'],
    issues: [],
    dimensions: [pos('team')],
    routing: 'KEYWORD',
  }),

  // =========================================================================
  // SECOND SET — written before any engine change in the quality pass, as a
  // check on whether fixes generalise rather than fit the first 118.
  // Adversarial wording, conjunctions, intensifiers, hedged wording, the
  // named cases from the brief, and 3-star ratings on clear opinions.
  // =========================================================================

  // ---- restaurant ----------------------------------------------------------
  ex('r29', 'restaurant', 'mixed', 'Food was amazing but the bill took forever.', null, {
    sentiment: 'MIXED', praise: ['food_taste'], issues: ['service_speed'], prohibited: ['billing_issue'],
    dimensions: [pos('food'), neg('waiting')], routing: 'KEYWORD',
  }, 'Named case. A slow bill is slowness, not a billing error.'),
  ex('r30', 'restaurant', 'multi_issue', 'The food was excellent, portions were small and the washroom was dirty.', null, {
    sentiment: 'MIXED', praise: ['food_taste'], issues: ['pricing_value', 'cleanliness'],
    dimensions: [pos('food'), neg('value'), neg('cleanliness')], routing: 'KEYWORD',
  }, 'Named case. Small portions are a value complaint in this taxonomy.'),
  ex('r31', 'restaurant', 'multi_issue', 'The food was good, service was slow, and the price felt high.', null, {
    sentiment: 'MIXED', praise: ['food_taste'], issues: ['service_speed', 'pricing_value'],
    dimensions: [pos('food'), neg('waiting'), neg('value')], routing: 'KEYWORD',
  }, 'Named case.'),
  ex('r32', 'restaurant', 'rating_disagrees', 'Absolutely loved it, the best meal we have had in months.', 3, {
    sentiment: 'POSITIVE', alsoAccept: ['MIXED'], praise: ['food_taste'], issues: [],
    dimensions: [pos('food')], routing: 'KEYWORD',
  }, 'Three stars on glowing words: a middle rating does not cancel a clear opinion.'),
  ex('r33', 'restaurant', 'rating_disagrees', 'Terrible experience, cold food and rude staff.', 3, {
    sentiment: 'NEGATIVE', alsoAccept: ['MIXED'], praise: [], issues: ['food_quality', 'staff_behaviour'],
    dimensions: [neg('food'), neg('service')], routing: 'KEYWORD',
  }, 'Three stars on a clear complaint.'),
  ex('r34', 'restaurant', 'must_not_infer', 'Loved the slow-cooked dal.', 5, {
    sentiment: 'POSITIVE', praise: ['food_taste'], issues: [], prohibited: ['service_speed'],
    dimensions: [pos('food')], routing: 'KEYWORD',
  }, 'Misleading keyword: "slow" describes the cooking, not the service.'),
  ex('r35', 'restaurant', 'must_not_infer', 'The cold coffee is the best thing on the menu.', 5, {
    sentiment: 'POSITIVE', praise: ['food_taste'], issues: [], prohibited: ['food_quality'],
    dimensions: [pos('food')], routing: 'KEYWORD',
  }, 'Misleading keyword: cold coffee is a drink, not cold food.'),
  ex('r36', 'restaurant', 'must_not_infer', 'Waiting area had comfortable sofas.', null, {
    sentiment: 'POSITIVE', alsoAccept: ['NEUTRAL'], praise: [], issues: [], tolerated: ['ambience'],
    prohibited: ['service_speed', 'wait_for_table'], dimensions: [], routing: 'KEYWORD',
  }, 'Misleading keyword: the waiting AREA, not a wait.'),
  ex('r37', 'restaurant', 'mixed', 'Although the place was crowded, our food came quickly and hot.', null, {
    sentiment: 'POSITIVE', alsoAccept: ['MIXED'], praise: ['service_quality'], issues: [],
    tolerated: ['wait_for_table', 'food_taste'], prohibited: ['service_speed'],
    dimensions: [pos('waiting')], routing: 'KEYWORD',
  }, '"Although": the concession is not the point.'),
  ex('r38', 'restaurant', 'mixed', 'Staff were a bit slow but very polite.', null, {
    sentiment: 'MIXED', praise: ['staff_warmth'], issues: ['service_speed'],
    dimensions: [neg('waiting'), pos('service')], routing: 'KEYWORD',
  }, 'A softened complaint is still a complaint.'),
  ex('r39', 'restaurant', 'negative', 'Extremely rude manager.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['staff_behaviour'], dimensions: [neg('service')], routing: 'KEYWORD',
  }, 'Intensifier.'),
  ex('r40', 'restaurant', 'ambiguous', 'Maybe slightly pricey for what you get.', null, {
    sentiment: 'NEGATIVE', alsoAccept: ['MIXED'], praise: [], issues: ['pricing_value'],
    dimensions: [neg('value')], routing: 'KEYWORD',
  }, 'Hedged, but a value complaint all the same.'),
  ex('r41', 'restaurant', 'must_not_infer', 'I am writing this in a hurry, but the paneer was fantastic.', 5, {
    sentiment: 'POSITIVE', praise: ['food_taste'], issues: [], prohibited: ['service_speed', 'staff_behaviour'],
    dimensions: [pos('food')], routing: 'KEYWORD',
  }, 'Irrelevant keyword: the customer is in a hurry, not the kitchen.'),
  ex('r42', 'restaurant', 'must_not_infer', 'Bill was fine, no hidden charges.', null, {
    sentiment: 'POSITIVE', alsoAccept: ['NEUTRAL'], praise: [], issues: [], tolerated: ['value_for_money'],
    prohibited: ['billing_issue', 'pricing_value'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('r43', 'restaurant', 'multi_issue', 'Parcel leaked all over the bag and the rice was stale.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['delivery_packaging', 'food_quality'],
    dimensions: [neg('food')], routing: 'KEYWORD',
  }),
  ex('r44', 'restaurant', 'negative', 'Music was so loud we could not talk.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['ambience_noise'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('r45', 'restaurant', 'negative', 'Found a hair in the soup.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['cleanliness'], tolerated: ['food_quality'],
    dimensions: [neg('cleanliness')], routing: 'AI',
  }),
  ex('r46', 'restaurant', 'positive', 'Service was quick and the waiter was attentive.', 5, {
    sentiment: 'POSITIVE', praise: ['service_quality'], issues: [], tolerated: ['staff_warmth'],
    dimensions: [pos('service'), pos('waiting')], routing: 'KEYWORD',
  }),
  ex('r47', 'restaurant', 'multilingual', 'खाना बहुत स्वादिष्ट था लेकिन बिल गलत बना।', null, {
    sentiment: 'MIXED', praise: ['food_taste'], issues: ['billing_issue'],
    dimensions: [pos('food')], routing: 'KEYWORD',
  }, 'Hindi: the food was very tasty but the bill was made wrong.'),
  ex('r48', 'restaurant', 'colloquial', 'Khana mast tha par service bahut slow thi.', null, {
    sentiment: 'MIXED', praise: ['food_taste'], issues: ['service_speed'],
    dimensions: [pos('food'), neg('waiting')], routing: 'KEYWORD',
  }, 'Hinglish: the food was great but the service was very slow.'),
  ex('r49', 'restaurant', 'negative', 'We were told there was no table despite our reservation.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['wait_for_table'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('r50', 'restaurant', 'short', 'Nice place.', 4, {
    sentiment: 'POSITIVE', praise: [], issues: [], tolerated: ['ambience'], dimensions: [], routing: 'KEYWORD',
  }),

  // ---- clinic --------------------------------------------------------------
  ex('c18', 'clinic', 'must_not_infer', 'The waiting area was clean and the wait was short.', 5, {
    sentiment: 'POSITIVE', praise: ['clean_facility', 'short_wait'], issues: [], prohibited: ['wait_time'],
    dimensions: [pos('cleanliness'), pos('waiting')], routing: 'KEYWORD',
  }, 'Misleading keyword: "waiting area", and a short wait.'),
  ex('c19', 'clinic', 'negative', 'Doctor was extremely rude and dismissive.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['staff_behaviour'], tolerated: ['consultation_rush'],
    prohibited: ['doctor_care'], dimensions: [neg('staff')], routing: 'KEYWORD',
  }),
  ex('c20', 'clinic', 'mixed', 'Although we waited a bit, the doctor was very thorough.', 4, {
    sentiment: 'MIXED', alsoAccept: ['POSITIVE'], praise: ['doctor_care'], issues: ['wait_time'],
    dimensions: [neg('waiting'), pos('consultation')], routing: 'KEYWORD',
  }),
  ex('c21', 'clinic', 'positive', 'Medicines worked and I feel much better now.', 5, {
    sentiment: 'POSITIVE', praise: ['good_outcome'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('c22', 'clinic', 'multi_issue', 'Clinic smells of damp and the chairs are broken.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['cleanliness'], dimensions: [neg('cleanliness')], routing: 'KEYWORD',
  }, 'Broken chairs have no category of their own in this pack.'),
  ex('c23', 'clinic', 'negative', 'Receptionist did not pick up the phone for two days.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['phone_unreachable'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('c24', 'clinic', 'positive', 'Consultation fee was reasonable.', null, {
    sentiment: 'POSITIVE', praise: ['fair_pricing'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('c25', 'clinic', 'must_not_infer', 'It was late evening so parking was easy.', null, {
    sentiment: 'POSITIVE', alsoAccept: ['NEUTRAL'], praise: [], issues: [],
    prohibited: ['wait_time', 'parking_access'], dimensions: [], routing: 'KEYWORD',
  }, 'Misleading keyword: "late" is the time of day.'),
  ex('c26', 'clinic', 'multilingual', 'मुझे लगा डॉक्टर ने जल्दी-जल्दी में देखा।', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['consultation_rush'], dimensions: [neg('consultation')], routing: 'KEYWORD',
  }, 'Hindi: I felt the doctor saw me in a hurry.'),
  ex('c27', 'clinic', 'multilingual', 'डॉक्टर खूप छान आहेत पण फी जास्त आहे.', null, {
    sentiment: 'MIXED', praise: ['doctor_care'], issues: ['billing_clarity'],
    dimensions: [pos('consultation')], routing: 'KEYWORD',
  }, 'Marathi: the doctor is very good but the fee is high.'),
  ex('c28', 'clinic', 'positive', 'no complaints, good experience', null, {
    sentiment: 'POSITIVE', alsoAccept: ['NEUTRAL'], praise: [], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('c29', 'clinic', 'positive', 'The nurse was very gentle with my son.', 5, {
    sentiment: 'POSITIVE', praise: ['staff_friendly'], issues: [], dimensions: [pos('staff')], routing: 'KEYWORD',
  }),
  ex('c30', 'clinic', 'must_not_infer', 'Got my reports on the same day.', 5, {
    sentiment: 'POSITIVE', praise: [], issues: [], tolerated: ['short_wait'],
    prohibited: ['followup_communication'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('c31', 'clinic', 'negative', 'Had to wait 3 hours, no updates at all.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['wait_time'], tolerated: ['followup_communication'],
    dimensions: [neg('waiting')], routing: 'KEYWORD',
  }),

  // ---- coaching ------------------------------------------------------------
  ex('k16', 'coaching', 'mixed', 'Teaching is good but fees are too high.', 3, {
    sentiment: 'MIXED', praise: ['teaching_quality_praise'], issues: ['fee_transparency'],
    dimensions: [pos('teaching'), neg('value')], routing: 'KEYWORD',
  }),
  ex('k17', 'coaching', 'must_not_infer', 'The batch is small so the teacher gives personal attention.', 5, {
    sentiment: 'POSITIVE', praise: ['individual_attention'], issues: [], prohibited: ['batch_size'],
    dimensions: [], routing: 'KEYWORD',
  }),
  ex('k18', 'coaching', 'must_not_infer', 'Classes are never cancelled, very regular.', 5, {
    sentiment: 'POSITIVE', praise: ['discipline'], issues: [], prohibited: ['schedule_reliability'],
    dimensions: [], routing: 'KEYWORD',
  }),
  ex('k19', 'coaching', 'negative', 'My son is scared to go because the sir beats students.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['safety_discipline'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('k20', 'coaching', 'negative', 'Study material came two months late.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['study_material'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('k21', 'coaching', 'must_not_infer', 'Parents are kept informed through regular WhatsApp updates.', 5, {
    sentiment: 'POSITIVE', praise: [], issues: [], tolerated: ['discipline'], prohibited: ['communication_parents'],
    dimensions: [pos('communication')], routing: 'KEYWORD',
  }, 'Taxonomy gap: coaching has no praise topic for keeping parents informed.'),
  ex('k22', 'coaching', 'neutral', 'Results were average, nothing special.', 3, {
    sentiment: 'NEUTRAL', alsoAccept: ['MIXED'], praise: [], issues: [], prohibited: ['results_praise'],
    dimensions: [], routing: 'KEYWORD',
  }),
  ex('k23', 'coaching', 'multilingual', 'मुलाचे मार्क वाढले, शिक्षक खूप मेहनत घेतात.', null, {
    sentiment: 'POSITIVE', praise: ['results_praise'], issues: [], tolerated: ['faculty_support', 'teaching_quality_praise'],
    dimensions: [], routing: 'KEYWORD',
  }, 'Marathi: the child’s marks went up, the teachers work very hard.'),
  ex('k24', 'coaching', 'negative', 'AC does not work and the room gets very hot.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['facility_condition'], dimensions: [neg('facilities')], routing: 'KEYWORD',
  }),
  ex('k25', 'coaching', 'positive', 'Doubt sessions every Saturday are really helpful.', 5, {
    sentiment: 'POSITIVE', praise: ['individual_attention'], issues: [], tolerated: ['teaching_quality_praise', 'faculty_support'],
    dimensions: [], routing: 'KEYWORD',
  }),
  ex('k26', 'coaching', 'negative', 'Teacher left in the middle of the year.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['faculty_turnover'], dimensions: [neg('faculty')], routing: 'KEYWORD',
  }),
  ex('k27', 'coaching', 'negative', 'They claimed 100% selection, total lie.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['results_claims'], dimensions: [], routing: 'KEYWORD',
  }),

  // ---- gym -----------------------------------------------------------------
  ex('g16', 'gym', 'must_not_infer', 'Treadmills are always working and well maintained.', 5, {
    sentiment: 'POSITIVE', praise: ['equipment_quality'], issues: [], tolerated: ['cleanliness_praise'],
    prohibited: ['equipment_condition'], dimensions: [pos('equipment')], routing: 'KEYWORD',
  }),
  ex('g17', 'gym', 'negative', 'The trainer ignored me for the whole session.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['trainer_availability'], dimensions: [neg('trainers')], routing: 'KEYWORD',
  }),
  ex('g18', 'gym', 'negative', 'Too hot inside, no proper ventilation.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['ac_ventilation'], dimensions: [neg('facilities')], routing: 'KEYWORD',
  }),
  ex('g19', 'gym', 'must_not_infer', 'Lovely crowd and great energy in the morning batch.', 5, {
    sentiment: 'POSITIVE', praise: ['atmosphere'], issues: [], prohibited: ['crowding'],
    dimensions: [], routing: 'KEYWORD',
  }, 'Misleading keyword: a good crowd is not overcrowding.'),
  ex('g20', 'gym', 'positive', 'Membership fee is reasonable for the facilities.', null, {
    sentiment: 'POSITIVE', praise: ['value_pricing'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('g21', 'gym', 'negative', 'Staff at the desk were rude when I asked for a freeze.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['staff_behaviour'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('g22', 'gym', 'must_not_infer', 'Gym is not crowded after 9 pm.', null, {
    sentiment: 'POSITIVE', alsoAccept: ['NEUTRAL'], praise: [], issues: [], prohibited: ['crowding'],
    dimensions: [pos('crowding')], routing: 'KEYWORD',
  }),
  ex('g23', 'gym', 'negative', 'Locker room is filthy and smells.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['cleanliness'], dimensions: [neg('cleanliness')], routing: 'KEYWORD',
  }),
  ex('g24', 'gym', 'mixed', 'I have lost 5 kg but the trainer changes every month.', 4, {
    sentiment: 'MIXED', praise: ['results'], issues: ['trainer_availability'],
    dimensions: [neg('trainers')], routing: 'AI',
  }),
  ex('g25', 'gym', 'negative', 'Yoga class was cancelled without notice.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['class_schedule'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('g26', 'gym', 'multilingual', 'जिममध्ये खूप गर्दी असते आणि मशीन खराब आहेत.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['crowding', 'equipment_condition'],
    dimensions: [neg('crowding'), neg('equipment')], routing: 'KEYWORD',
  }, 'Marathi: the gym is very crowded and the machines are broken.'),
  ex('g27', 'gym', 'short', 'Good gym', 4, {
    sentiment: 'POSITIVE', praise: [], issues: [], dimensions: [], routing: 'KEYWORD',
  }),

  // ---- real estate ---------------------------------------------------------
  ex('e15', 'real_estate', 'must_not_infer', 'He answered every call, even late at night.', 5, {
    sentiment: 'POSITIVE', praise: ['responsiveness_praise'], issues: [], prohibited: ['professionalism', 'responsiveness'],
    dimensions: [pos('communication')], routing: 'KEYWORD',
  }, 'Misleading keyword: "late" at night is praise here.'),
  ex('e16', 'real_estate', 'negative', 'Asked for extra brokerage at the last moment.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['hidden_charges'], dimensions: [neg('transparency')], routing: 'KEYWORD',
  }),
  ex('e17', 'real_estate', 'positive', 'Showed us exactly the kind of flats we wanted.', 5, {
    sentiment: 'POSITIVE', praise: ['options_shown'], issues: [], dimensions: [pos('options')], routing: 'KEYWORD',
  }),
  ex('e18', 'real_estate', 'negative', 'Documents are still pending after three months.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['documentation_delay'], dimensions: [neg('paperwork')], routing: 'KEYWORD',
  }),
  ex('e19', 'real_estate', 'negative', 'Pushy and kept calling to close the deal fast.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['pressure_tactics'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('e20', 'real_estate', 'must_not_infer', 'No pressure at all, gave us time to think.', 5, {
    sentiment: 'POSITIVE', praise: ['no_pressure'], issues: [], prohibited: ['pressure_tactics'],
    dimensions: [], routing: 'KEYWORD',
  }),
  ex('e21', 'real_estate', 'negative', 'The listing said 1000 sq ft but the flat was much smaller.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['listing_accuracy'], dimensions: [neg('options')], routing: 'AI',
  }),
  ex('e22', 'real_estate', 'negative', 'After we paid he stopped responding completely.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['post_deal_support'], tolerated: ['responsiveness'],
    dimensions: [neg('communication')], routing: 'KEYWORD',
  }),
  ex('e23', 'real_estate', 'positive', 'Honest guy, told us the flaws of every flat.', 5, {
    sentiment: 'POSITIVE', praise: ['transparency'], issues: [], dimensions: [pos('transparency')], routing: 'KEYWORD',
  }),
  ex('e24', 'real_estate', 'multilingual', 'दलाली जास्त घेतली आणि फोन उचलत नाही.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['hidden_charges', 'responsiveness'],
    dimensions: [neg('transparency'), neg('communication')], routing: 'KEYWORD',
  }, 'Marathi: charged high brokerage and does not pick up the phone.'),
  ex('e25', 'real_estate', 'negative', 'Agent came late to the site visit twice.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['site_visit_experience'], tolerated: ['professionalism'],
    dimensions: [neg('visits')], routing: 'KEYWORD',
  }),
  ex('e26', 'real_estate', 'neutral', 'Looking for a 2BHK near the station.', null, {
    sentiment: 'NEUTRAL', praise: [], issues: [], dimensions: [], routing: 'KEYWORD',
  }),

  // ---- salon ---------------------------------------------------------------
  ex('s16', 'salon', 'must_not_infer', 'Haircut was great but the salon was not very clean.', 3, {
    sentiment: 'MIXED', praise: ['stylist_skill'], issues: ['cleanliness_space'], tolerated: ['hygiene'],
    prohibited: ['hygiene_praise'], dimensions: [pos('result'), neg('cleanliness')], routing: 'KEYWORD',
  }, '"not very clean" must not read as praise for cleanliness.'),
  ex('s17', 'salon', 'positive', 'She did exactly what I asked, lovely colour.', 5, {
    sentiment: 'POSITIVE', praise: ['stylist_skill'], issues: [], prohibited: ['service_result'],
    dimensions: [pos('result')], routing: 'KEYWORD',
  }),
  ex('s18', 'salon', 'negative', 'Kept pushing a membership card on me.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['upselling_pressure'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('s19', 'salon', 'negative', 'I got a rash after the facial.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['product_quality'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('s20', 'salon', 'negative', 'Prices are higher than what they quote on the phone.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['pricing_transparency'], dimensions: [neg('value')], routing: 'KEYWORD',
  }),
  ex('s21', 'salon', 'positive', 'Appointment was on time and the staff were polite.', 5, {
    sentiment: 'POSITIVE', praise: ['punctuality', 'staff_warmth'], issues: [],
    dimensions: [pos('waiting'), pos('stylist')], routing: 'KEYWORD',
  }),
  ex('s22', 'salon', 'positive', 'Very relaxing head massage.', 5, {
    sentiment: 'POSITIVE', praise: ['ambience'], issues: [], tolerated: ['stylist_skill'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('s23', 'salon', 'negative', 'Nobody answers the salon phone.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['phone_unreachable'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('s24', 'salon', 'negative', 'The cut was uneven on one side.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['service_result'], dimensions: [neg('result')], routing: 'KEYWORD',
  }),
  ex('s25', 'salon', 'multilingual', 'स्टाफ बहुत अच्छा था लेकिन इंतजार बहुत करना पड़ा।', null, {
    sentiment: 'MIXED', praise: ['staff_warmth'], issues: ['wait_time'],
    dimensions: [pos('stylist'), neg('waiting')], routing: 'KEYWORD',
  }, 'Hindi: the staff were very good but we had to wait a lot.'),
  ex('s26', 'salon', 'ambiguous', 'Not bad for the price.', 3, {
    sentiment: 'NEUTRAL', alsoAccept: ['MIXED', 'POSITIVE'], praise: [], issues: [], tolerated: ['value_pricing'],
    prohibited: ['pricing_transparency'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('s27', 'salon', 'positive', 'Clean towels, clean tools, very hygienic.', 5, {
    sentiment: 'POSITIVE', praise: ['hygiene_praise'], issues: [], dimensions: [pos('cleanliness')], routing: 'KEYWORD',
  }),

  // ---- wedding vendor ------------------------------------------------------
  ex('w15', 'wedding_vendor', 'must_not_infer', 'The album came out beautiful, worth the wait.', 5, {
    sentiment: 'POSITIVE', praise: ['output_quality'], issues: [], tolerated: ['value_pricing'],
    prohibited: ['delivery_delay'], dimensions: [pos('quality')], routing: 'KEYWORD',
  }),
  ex('w16', 'wedding_vendor', 'positive', 'Team arrived on time and handled everything calmly.', 5, {
    sentiment: 'POSITIVE', praise: ['punctuality_praise', 'team_conduct'], issues: [],
    dimensions: [pos('punctuality'), pos('team')], routing: 'KEYWORD',
  }),
  ex('w17', 'wedding_vendor', 'negative', 'Photographer was rude to our guests.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['professionalism'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('w18', 'wedding_vendor', 'negative', 'They charged extra for drone coverage that was never mentioned.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['hidden_costs'], prohibited: ['coverage_gaps'],
    dimensions: [neg('value')], routing: 'KEYWORD',
  }),
  ex('w19', 'wedding_vendor', 'negative', 'Video was nothing like the samples they showed us.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['quality_vs_sample'], dimensions: [neg('quality')], routing: 'KEYWORD',
  }),
  ex('w20', 'wedding_vendor', 'positive', 'Delivered the album within a month, as promised.', 5, {
    sentiment: 'POSITIVE', praise: ['delivery_speed'], issues: [], prohibited: ['delivery_delay'],
    dimensions: [], routing: 'KEYWORD',
  }),
  ex('w21', 'wedding_vendor', 'negative', 'Not a single photo of my grandmother.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['coverage_gaps'], dimensions: [], routing: 'AI',
  }),
  ex('w22', 'wedding_vendor', 'mixed', 'The decorator was late but the setup looked stunning.', 4, {
    sentiment: 'MIXED', praise: ['output_quality'], issues: ['punctuality'],
    dimensions: [neg('punctuality'), pos('quality')], routing: 'KEYWORD',
  }),
  ex('w23', 'wedding_vendor', 'multilingual', 'शादी के फोटो बहुत शानदार थे।', 5, {
    sentiment: 'POSITIVE', praise: ['output_quality'], issues: [], dimensions: [pos('quality')], routing: 'KEYWORD',
  }, 'Hindi: the wedding photos were superb.'),
  ex('w24', 'wedding_vendor', 'negative', 'Never replied to our messages before the wedding.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['communication'], dimensions: [neg('communication')], routing: 'KEYWORD',
  }),
  ex('w25', 'wedding_vendor', 'positive', 'Reasonable package and flexible with timings.', 5, {
    sentiment: 'POSITIVE', praise: ['value_pricing', 'flexibility'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),

  // =========================================================================
  // HOLDOUT — written AFTER the taxonomy pass, blind to the engine's output,
  // in wording deliberately different from the hints added in that pass. It
  // is the honest measure of how well the fixes generalise; its first score
  // is recorded in docs/SMART_FEEDBACK_INTELLIGENCE_AUDIT_2026-09.md before
  // anything was changed in response to it.
  // =========================================================================
  ex('rh1', 'restaurant', 'positive', 'The dosa was crisp and the chutney tasted fresh.', 5, {
    sentiment: 'POSITIVE', praise: ['food_taste'], issues: [], dimensions: [pos('food')], routing: 'KEYWORD',
  }),
  ex('rh2', 'restaurant', 'negative', 'We waited nearly an hour and a half for our starters.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['service_speed'], dimensions: [neg('waiting')], routing: 'KEYWORD',
  }),
  ex('rh3', 'restaurant', 'negative', 'Service staff kept ignoring our table.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['staff_behaviour'], dimensions: [neg('service')], routing: 'KEYWORD',
  }),
  ex('rh4', 'restaurant', 'negative', 'Tables were sticky and there were flies around.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['cleanliness'], dimensions: [neg('cleanliness')], routing: 'KEYWORD',
  }),
  ex('rh5', 'restaurant', 'positive', 'Good food at a fair price.', 5, {
    sentiment: 'POSITIVE', praise: ['food_taste', 'value_for_money'], issues: [], dimensions: [pos('food'), pos('value')], routing: 'KEYWORD',
  }),
  ex('rh6', 'restaurant', 'multi_issue', 'The biryani was bland and overpriced.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['food_quality', 'pricing_value'], dimensions: [neg('food'), neg('value')], routing: 'KEYWORD',
  }),
  ex('rh7', 'restaurant', 'mixed', 'Friendly staff but the AC was not working.', 3, {
    sentiment: 'MIXED', praise: ['staff_warmth'], issues: ['ambience_noise'], dimensions: [pos('service')], routing: 'KEYWORD',
  }, 'The restaurant pack files a broken AC under ambience / noise / seating.'),
  ex('rh8', 'restaurant', 'negative', 'Not the best experience, the waiter got our order wrong.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['order_accuracy'], tolerated: ['staff_behaviour'],
    prohibited: ['food_taste'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('rh9', 'restaurant', 'must_not_infer', 'Honestly nothing to complain about.', null, {
    sentiment: 'POSITIVE', alsoAccept: ['NEUTRAL'], praise: [], issues: [], dimensions: [], routing: 'KEYWORD',
  }),

  ex('ch1', 'clinic', 'positive', 'Dr. Mehta listened carefully and explained the reports.', 5, {
    sentiment: 'POSITIVE', praise: ['doctor_care'], issues: [], dimensions: [pos('consultation')], routing: 'KEYWORD',
  }),
  ex('ch2', 'clinic', 'positive', 'The receptionist was very helpful with the insurance forms.', 5, {
    sentiment: 'POSITIVE', praise: ['staff_friendly'], issues: [], dimensions: [pos('staff')], routing: 'KEYWORD',
  }),
  ex('ch3', 'clinic', 'negative', 'Waited almost 90 minutes even though I had booked a slot.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['wait_time'], tolerated: ['appointment_scheduling'],
    dimensions: [neg('waiting')], routing: 'KEYWORD',
  }),
  ex('ch4', 'clinic', 'negative', 'Bill had charges I did not understand.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['billing_clarity'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('ch5', 'clinic', 'must_not_infer', 'The toilet was not clean.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['cleanliness'], prohibited: ['clean_facility'],
    dimensions: [neg('cleanliness')], routing: 'KEYWORD',
  }),
  ex('ch6', 'clinic', 'negative', 'Doctor saw me for barely two minutes.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['consultation_rush'], dimensions: [neg('consultation')], routing: 'KEYWORD',
  }),
  ex('ch7', 'clinic', 'mixed', 'Great doctor, but the clinic is always overcrowded and you wait forever.', 3, {
    sentiment: 'MIXED', praise: ['doctor_care'], issues: ['wait_time'], dimensions: [pos('consultation'), neg('waiting')], routing: 'KEYWORD',
  }),

  ex('kh1', 'coaching', 'positive', 'The physics sir explains every topic very clearly.', 5, {
    sentiment: 'POSITIVE', praise: ['teaching_quality_praise'], issues: [], dimensions: [pos('teaching')], routing: 'KEYWORD',
  }),
  ex('kh2', 'coaching', 'negative', 'Our batch has almost 80 students, no one gets attention.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['batch_size'], prohibited: ['individual_attention'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('kh3', 'coaching', 'negative', 'They refused to refund the fees after my son left.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['fee_transparency'], prohibited: ['faculty_turnover'],
    dimensions: [neg('value')], routing: 'KEYWORD',
  }, 'The son left, not a teacher.'),
  ex('kh4', 'coaching', 'positive', 'Mock tests every week really helped my daughter.', 5, {
    sentiment: 'POSITIVE', praise: ['study_material_praise'], issues: [], tolerated: ['results_praise'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('kh5', 'coaching', 'negative', 'Classes start late almost every day.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['schedule_reliability'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('kh6', 'coaching', 'positive', 'Teachers are supportive and very patient with slow learners.', 5, {
    sentiment: 'POSITIVE', praise: ['faculty_support'], issues: [], tolerated: ['teaching_quality_praise'], dimensions: [pos('teaching')], routing: 'KEYWORD',
  }),
  ex('kh7', 'coaching', 'negative', 'No updates to parents about attendance.', null, {
    sentiment: 'NEGATIVE', praise: [], issues: ['communication_parents'], dimensions: [neg('communication')], routing: 'KEYWORD',
  }),

  ex('gh1', 'gym', 'positive', 'Clean gym, good machines and helpful trainers.', 5, {
    sentiment: 'POSITIVE', praise: ['cleanliness_praise', 'equipment_quality', 'trainer_quality'], issues: [],
    dimensions: [pos('cleanliness'), pos('equipment'), pos('trainers')], routing: 'KEYWORD',
  }),
  ex('gh2', 'gym', 'negative', 'The cable machine has been broken for weeks.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['equipment_condition'], dimensions: [neg('equipment')], routing: 'KEYWORD',
  }),
  ex('gh3', 'gym', 'negative', 'Evening slots are packed, you can hardly move.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['crowding'], dimensions: [neg('crowding')], routing: 'KEYWORD',
  }),
  ex('gh4', 'gym', 'negative', 'Trainer is never on the floor when you need help.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['trainer_availability'], dimensions: [neg('trainers')], routing: 'KEYWORD',
  }),
  ex('gh5', 'gym', 'negative', 'They charged my card again after I cancelled.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['membership_billing'], prohibited: ['class_schedule'], dimensions: [], routing: 'KEYWORD',
  }, 'A cancelled membership, not a cancelled class.'),
  ex('gh6', 'gym', 'negative', 'Showers are dirty and there is no hot water.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['cleanliness'], dimensions: [neg('cleanliness')], routing: 'KEYWORD',
  }),
  ex('gh7', 'gym', 'must_not_infer', 'Not crowded in the mornings and the staff are friendly.', 5, {
    sentiment: 'POSITIVE', praise: [], issues: [], tolerated: ['atmosphere'], prohibited: ['crowding'], dimensions: [pos('crowding')], routing: 'KEYWORD',
  }, 'Taxonomy gap: the gym pack has no praise topic for friendly staff.'),

  ex('eh1', 'real_estate', 'positive', 'He was very transparent about all costs.', 5, {
    sentiment: 'POSITIVE', praise: ['transparency'], issues: [], prohibited: ['hidden_charges'], dimensions: [pos('transparency')], routing: 'KEYWORD',
  }),
  ex('eh2', 'real_estate', 'negative', 'The agent never turned up for the site visit.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['site_visit_experience'], dimensions: [neg('visits')], routing: 'KEYWORD',
  }),
  ex('eh3', 'real_estate', 'negative', 'Kept changing the price every time we spoke.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['unclear_pricing'], dimensions: [neg('transparency')], routing: 'KEYWORD',
  }),
  ex('eh4', 'real_estate', 'must_not_infer', 'Very patient, never forced us to decide.', 5, {
    sentiment: 'POSITIVE', praise: ['no_pressure'], issues: [], prohibited: ['pressure_tactics'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('eh5', 'real_estate', 'negative', 'Took our token and then went silent.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['responsiveness'], tolerated: ['post_deal_support', 'token_refund'],
    dimensions: [neg('communication')], routing: 'KEYWORD',
  }),
  ex('eh6', 'real_estate', 'positive', 'Helped us with the home loan paperwork end to end.', 5, {
    sentiment: 'POSITIVE', praise: ['paperwork_help'], issues: [], dimensions: [pos('paperwork')], routing: 'KEYWORD',
  }),
  ex('eh7', 'real_estate', 'negative', 'Photos in the listing were from a different flat.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['listing_accuracy'], dimensions: [neg('options')], routing: 'KEYWORD',
  }),

  ex('sh1', 'salon', 'positive', 'The stylist gave me exactly the look I wanted.', 5, {
    sentiment: 'POSITIVE', praise: ['stylist_skill'], issues: [], prohibited: ['service_result'], dimensions: [pos('result')], routing: 'KEYWORD',
  }),
  ex('sh2', 'salon', 'negative', 'My hair colour faded within a week.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['service_result'], tolerated: ['product_quality'], dimensions: [neg('result')], routing: 'KEYWORD',
  }),
  ex('sh3', 'salon', 'negative', 'They charged more than the rate card.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['pricing_transparency'], dimensions: [neg('value')], routing: 'KEYWORD',
  }),
  ex('sh4', 'salon', 'positive', 'Very hygienic, fresh towels for everyone.', 5, {
    sentiment: 'POSITIVE', praise: ['hygiene_praise'], issues: [], dimensions: [pos('cleanliness')], routing: 'KEYWORD',
  }),
  ex('sh5', 'salon', 'negative', 'Had to wait 30 minutes past my booking.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['wait_time'], tolerated: ['appointment_scheduling'], dimensions: [neg('waiting')], routing: 'KEYWORD',
  }),
  ex('sh6', 'salon', 'negative', 'The girl doing my pedicure was rude and in a hurry.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['staff_behaviour'], tolerated: ['service_result'], dimensions: [neg('stylist')], routing: 'KEYWORD',
  }),
  ex('sh7', 'salon', 'positive', 'Lovely ambience and very calm music.', 5, {
    sentiment: 'POSITIVE', praise: ['ambience'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),

  ex('wh1', 'wedding_vendor', 'positive', 'The candid shots were breathtaking.', 5, {
    sentiment: 'POSITIVE', praise: ['output_quality'], issues: [], dimensions: [pos('quality')], routing: 'KEYWORD',
  }),
  ex('wh2', 'wedding_vendor', 'negative', 'We got the edited video after eight months.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['delivery_delay'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('wh3', 'wedding_vendor', 'negative', 'They sent a completely different team on the day.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['team_substitution'], dimensions: [neg('team')], routing: 'KEYWORD',
  }),
  ex('wh4', 'wedding_vendor', 'must_not_infer', 'No hidden charges, exactly what was quoted.', 5, {
    sentiment: 'POSITIVE', praise: ['value_pricing'], issues: [], prohibited: ['hidden_costs'], dimensions: [pos('value')], routing: 'KEYWORD',
  }),
  ex('wh5', 'wedding_vendor', 'negative', 'The photographer arrived an hour late for the haldi.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['punctuality'], dimensions: [neg('punctuality')], routing: 'KEYWORD',
  }),
  ex('wh6', 'wedding_vendor', 'positive', 'They were flexible and accommodated all our requests.', 5, {
    sentiment: 'POSITIVE', praise: ['flexibility'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('wh7', 'wedding_vendor', 'negative', 'Half the family photos are missing from the album.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['coverage_gaps'], dimensions: [], routing: 'KEYWORD',
  }),
  // =========================================================================
  // FRESH SET — written after round two of the taxonomy pass, blind to it,
  // four per vertical. The holdout above stopped being blind once its misses
  // were fixed; this set is the generalisation check for that round, and its
  // first score is the one recorded in the audit.
  // =========================================================================
  ex('rx1', 'restaurant', 'positive', 'The paneer tikka was smoky and perfectly spiced.', 5, {
    sentiment: 'POSITIVE', praise: ['food_taste'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('rx2', 'restaurant', 'negative', 'Bill came with a service charge we never agreed to.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['billing_issue'], tolerated: ['pricing_value'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('rx3', 'restaurant', 'mixed', 'Place was spotless but the music was far too loud to talk.', 3, {
    sentiment: 'MIXED', praise: ['cleanliness_praise'], issues: ['ambience_noise'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('rx4', 'restaurant', 'multi_issue', 'Our food arrived cold after a 50 minute wait.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['food_quality', 'service_speed'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('cx1', 'clinic', 'positive', 'Nurse was gentle while taking blood, did not hurt at all.', 5, {
    sentiment: 'POSITIVE', praise: ['staff_friendly'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('cx2', 'clinic', 'negative', 'Nobody at the front desk answered my calls for two days.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['phone_unreachable'], tolerated: ['staff_behaviour'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('cx3', 'clinic', 'negative', 'The medicine prescribed made no difference to my cough.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['treatment_outcome'], prohibited: ['good_outcome'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('cx4', 'clinic', 'positive', 'Consultation fee is reasonable and the doctor is thorough.', 5, {
    sentiment: 'POSITIVE', praise: ['fair_pricing', 'doctor_care'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('kx1', 'coaching', 'negative', 'Our teacher left mid-year and the new one is struggling.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['faculty_turnover'], tolerated: ['teaching_quality'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('kx2', 'coaching', 'positive', 'Notes are well organised and cover the whole syllabus.', 5, {
    sentiment: 'POSITIVE', praise: ['study_material_praise'], issues: [], tolerated: ['discipline'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('kx3', 'coaching', 'negative', 'They never inform parents when a test is postponed.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['communication_parents'], tolerated: ['schedule_reliability'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('kx4', 'coaching', 'positive', 'Fees are affordable for the quality of teaching.', 5, {
    sentiment: 'POSITIVE', praise: ['fee_value'], issues: [], tolerated: ['teaching_quality_praise'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('gx1', 'gym', 'negative', 'Half the treadmills are out of order.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['equipment_condition'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('gx2', 'gym', 'negative', 'Locker room smells awful.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['cleanliness'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('gx3', 'gym', 'positive', 'Trainer designed a plan that actually fit my schedule, lost 5 kg.', 5, {
    sentiment: 'POSITIVE', praise: ['trainer_quality', 'results'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('gx4', 'gym', 'must_not_infer', 'The salesperson promised a free personal training session that never happened.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['overcommitted_sales'], prohibited: ['trainer_quality'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('ex1', 'real_estate', 'positive', 'He knew every society in the area and their resale prices.', 5, {
    sentiment: 'POSITIVE', praise: ['market_knowledge'], issues: [], dimensions: [], routing: 'AI',
  }),
  ex('ex2', 'real_estate', 'negative', 'Brokerage was higher than what he said at first.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['hidden_charges'], tolerated: ['unclear_pricing'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('ex3', 'real_estate', 'negative', 'Registration papers are still stuck, nobody tells us why.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['documentation_delay'], tolerated: ['responsiveness'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('ex4', 'real_estate', 'must_not_infer', 'Did not rush us at all, we took three months to decide.', 5, {
    sentiment: 'POSITIVE', praise: ['no_pressure'], issues: [], prohibited: ['pressure_tactics'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('sx1', 'salon', 'negative', 'My nails chipped within two days of the gel manicure.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['service_result'], tolerated: ['product_quality'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('sx2', 'salon', 'positive', 'Staff were warm and remembered how I like my coffee.', 5, {
    sentiment: 'POSITIVE', praise: ['staff_warmth'], issues: [], dimensions: [], routing: 'KEYWORD',
  }),
  ex('sx3', 'salon', 'must_not_infer', 'The waxing strips looked reused, not hygienic.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['hygiene'], prohibited: ['hygiene_praise'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('sx4', 'salon', 'negative', 'They kept pushing a hair spa I did not want.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['upselling_pressure'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('wx1', 'wedding_vendor', 'must_not_infer', 'The team was calm even when the baraat ran two hours late.', 5, {
    sentiment: 'POSITIVE', praise: ['team_conduct'], issues: [], prohibited: ['punctuality'], dimensions: [], routing: 'AI',
  }, 'The baraat was late, not the vendor.'),
  ex('wx2', 'wedding_vendor', 'negative', 'Final bill had an extra 40k for travel they never mentioned.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['hidden_costs'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('wx3', 'wedding_vendor', 'negative', 'They refused to fix the colour grading in the video.', 2, {
    sentiment: 'NEGATIVE', praise: [], issues: ['revisions_refused'], tolerated: ['quality_vs_sample'], dimensions: [], routing: 'KEYWORD',
  }),
  ex('wx4', 'wedding_vendor', 'negative', 'Stopped answering our calls a week before the wedding.', 1, {
    sentiment: 'NEGATIVE', praise: [], issues: ['communication'], dimensions: [], routing: 'KEYWORD',
  }),
];
