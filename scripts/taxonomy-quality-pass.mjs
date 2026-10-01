#!/usr/bin/env node
/**
 * THE TAXONOMY QUALITY PASS (Sep 2026) — applied once, kept for the record.
 *
 * Every edit to the vertical packs' hints made in the intelligence quality
 * pass, in one place, with the reason for each group. Run from the repository
 * root:  node scripts/taxonomy-quality-pass.mjs
 *
 * Idempotent: adding a hint that is already there, or removing one that is not,
 * changes nothing. It rewrites only `hints`, and writes each pack back in the
 * same two-space JSON it was read in.
 *
 *   add     common phrasings and synonyms customers actually use, in English,
 *           romanised Hindi/Marathi and Devanagari, for a topic that already
 *           exists. No new topic is created here.
 *   remove  hints proven to invent a reading: a bare word that matches far
 *           more than the topic ("wait" as a noun in "the wait was short"), or
 *           a phrase that belongs to a different topic ("missed the").
 *   stem    a partial word the old matcher could never match as a whole word
 *           ("pressur"), rewritten with the trailing "*" that now means
 *           "any word beginning with this".
 */
import { readFileSync, writeFileSync } from 'node:fs';

const EDITS = {
  restaurant: {
    service_speed: {
      add: ['took forever', 'takes forever', 'took ages', 'took so long', 'took too long', 'took a long time', 'long wait', 'still waiting', 'देर से', 'बहुत देर', 'bahut der', 'late aaya'],
    },
    staff_behaviour: {
      add: ['nobody came', 'no one came', 'nobody took our order', 'no one took our order', 'nobody attended', 'no one attended', 'nobody served', 'had to call the waiter', 'could not find a waiter', 'dismissive', 'arrogant', 'बदतमीज', 'बदतमीज़'],
    },
    food_quality: {
      add: ['ठंडा', 'undercooked', 'overcooked', 'too salty', 'too oily', 'rice was stale', 'food was not good', 'food was bad'],
    },
    order_accuracy: { add: ['forgot our', 'never arrived', 'wrong dish', 'missing item'] },
    cleanliness: { add: ['hair in', 'a hair in', 'insect in', 'cockroach in', 'filthy', 'smells', 'smelly'] },
    pricing_value: { add: ['pricey', 'too expensive', 'very expensive', 'portions were small', 'small portion', 'small portions', 'not worth the money', 'price felt high', 'price is high', 'prices are high', 'महंगा'] },
    billing_issue: { add: ['बिल गलत', 'bill galat', 'wrong amount'] },
    ambience_noise: { add: ['could not talk', 'too noisy', 'very loud'] },
    food_taste: { add: ['delicous', 'delicios', 'finger licking', 'lip smacking', 'loved the dal', 'loved the biryani', 'best meal', 'best dosa', 'best biryani'] },
    value_for_money: { add: ['paisa vasool', 'paisa wasool', 'paise vasool', 'worth the money', 'worth every rupee', 'good value'] },
    service_quality: { add: ['fast service', 'served quickly', 'came quickly', 'attentive staff'] },
  },
  clinic: {
    wait_time: {
      remove: ['wait'],
      add: ['long wait', 'had to wait', 'kept waiting', 'waited for hours', 'इंतज़ार', 'बहुत इंतजार'],
    },
    staff_behaviour: { add: ['बदतमीज़ी', 'बदतमीजी', 'बदतमीज', 'dismissive', 'arrogant', 'shouted at'] },
    phone_unreachable: { add: ['nobody answers', 'no one answers', 'nobody picks up', 'no one picks up', 'did not pick up', "didn't pick up", 'not picking up', 'never answers', 'does not answer'] },
    billing_clarity: { add: ['charged me extra', 'charged us extra', 'charged me more', 'फी जास्त', 'fees are high', 'fee is high', 'too expensive'] },
    treatment_outcome: { add: ['no improvement', 'pain is still', 'still in pain', 'still have pain', 'no difference', 'did not help', "didn't help"] },
    consultation_rush: { add: ['जल्दी-जल्दी', 'in a hurry', 'barely examined', 'did not examine', "didn't examine"] },
    followup_communication: { add: ['report was late', 'reports were delayed', 'no updates', 'never called back', 'no one called back'] },
    doctor_care: { add: ['thorough', 'very patient', 'patiently', 'examined properly'] },
    staff_friendly: { add: ['gentle', 'very kind', 'nurse was kind', 'nurse was gentle'] },
    appointment_scheduling: { remove: ['reschedul'], add: ['reschedul*'] },
  },
  coaching: {
    faculty_turnover: { add: ['teacher was changed', 'teachers keep changing', 'teacher keeps changing', 'changed the teacher', 'teacher left', 'teachers left', 'teacher changes'] },
    fee_transparency: { add: ['fees were increased', 'increased the fees', 'fee hike', 'hiked the fees', 'fees are too high', 'fees too high', 'fee is too high', 'too expensive'] },
    communication_parents: { add: ['without telling', 'without informing', 'not told', 'never told us', 'no information'] },
    facility_condition: { add: ['fan was not working', 'ac does not work', 'ac is not working', 'room gets very hot', 'वर्ग खूप लहान', 'classroom is small'] },
    study_material: { add: ['material came late', 'notes came late', 'material was late', 'books came late', 'no study material'] },
    safety_discipline: { add: ['beats students', 'beat students', 'beats the students', 'hits students', 'slapped', 'scared to go'], remove: ['misbehav', 'harass'], add2: ['misbehav*', 'harass*'] },
    results_claims: { add: ['they claimed', 'total lie', 'false promise', 'fake promise', 'fake claims'] },
    results_praise: { remove: ['rank'], add: ['got a rank', 'good rank', 'rank improved', 'secured a rank', 'cleared the exam', 'got selected'] },
    teaching_quality_praise: { add: ['explain concepts', 'explains concepts', 'concepts clearly', 'good teachers', 'great teachers', 'chhan shikav', 'chhan shikavtat', 'छान शिकवतात'] },
    individual_attention: { add: ['personal attention', 'doubt sessions', 'doubt session'] },
    discipline: { add: ['never cancelled', 'classes are regular'] },
    batch_size: { add: ['too many kids', 'overcrowded batch', 'huge batch'] },
  },
  gym: {
    trainer_availability: { add: ['trainer changes', 'trainer keeps changing', 'trainer changed', 'new trainer every', 'milta nahi', 'trainer milta nahi', 'never around', 'never available', 'trainer is never'] },
    trainer_quality: { add: ['pushes you', 'pushes me', 'motivates', 'corrects form', 'personal attention'] },
    cleanliness: { add: ['filthy', 'smells', 'smelly', 'stinks'] },
    ac_ventilation: { add: ['ac never works', 'ac does not work', 'ac not working', 'no proper ventilation', 'too hot inside'] },
    equipment_condition: { add: ['machines are broken', 'मशीन खराब आहेत'] },
    staff_behaviour: { remove: ['misbehav'], add: ['misbehav*', 'desk were rude', 'desk was rude'] },
    equipment_quality: { add: ['great equipment', 'good equipment', 'always working'] },
  },
  real_estate: {
    listing_accuracy: { add: ['nothing like the photos', 'nothing like the pictures', 'nothing like the listing', 'not like the photos', 'different from the photos', 'much smaller', 'smaller than', 'looked different'] },
    pressure_tactics: { remove: ['pressur'], add: ['pressur*', 'pushy', 'kept calling', 'close the deal fast', 'rushed us'] },
    responsiveness: { add: ['never called back', 'does not pick up', 'did not pick up', 'no reply', 'never replied'] },
    post_deal_support: { add: ['stopped responding', 'after we paid', 'disappeared after'] },
    professionalism: { remove: ['misbehav'], add: ['misbehav*'] },
    site_visit_experience: { add: ['late to the site visit', 'late for the site visit', 'late for the visit', 'visit was cancelled'] },
    transparency: { add: ['clear bataya', 'sab clear', 'told us the flaws', 'honest guy', 'honest broker'] },
    responsiveness_praise: { add: ['answered every call', 'answers every call', 'always answered', 'always picks up', 'replies quickly'] },
    no_pressure: { add: ['gave us time', 'no pressure at all'] },
    options_shown: { add: ['exactly the kind', 'exactly what we wanted', 'good options'] },
  },
  salon: {
    upselling_pressure: { remove: ['pressur'], add: ['pressur*', 'kept pushing', 'keeps pushing', 'kept selling', 'pushing a membership', 'pushing a package'] },
    product_quality: { add: ['rash', 'itching', 'itchy', 'burning sensation', 'irritation', 'allergic', 'breakout'] },
    pricing_transparency: { add: ['higher than what', 'than what they quote', 'than they quoted', 'more than quoted', 'prices are higher'] },
    phone_unreachable: { add: ['nobody answers', 'no one answers', 'nobody picks up', 'did not pick up', 'never answers'] },
    wait_time: { add: ['इंतजार', 'इंतज़ार', 'kept waiting', 'had to wait'] },
    staff_behaviour: { remove: ['misbehav'], add: ['misbehav*'] },
    service_result: { add: ['uneven', 'did not like the result', 'not happy with the cut'] },
    stylist_skill: { add: ['great facial', 'good facial', 'lovely colour', 'lovely color', 'exactly what i asked', 'haircut mast', 'mast hua'] },
    staff_warmth: { add: ['स्टाफ बहुत अच्छा', 'staff bahut acha'] },
    hygiene: { add: ['not very clean'] },
    cleanliness_space: { add: ['not very clean', 'salon was dirty', 'salon is dirty'] },
    ambience: { add: ['relaxing massage', 'head massage'] },
  },
  wedding_vendor: {
    punctuality: { remove: ['missed the'], add: ['hours late', 'came late on the day'] },
    coverage_gaps: { add: ['not a single photo', 'no photo of', 'not even one photo', 'missed the'] },
    hidden_costs: { add: ['charged extra', 'charged us extra', 'charged me extra', 'never mentioned'] },
    communication: { add: ['never replied', 'never responded', 'did not reply', "didn't reply", 'not replying', 'no reply'] },
    quality_vs_sample: { add: ['nothing like the samples', 'nothing like the sample', 'not like the samples', 'nothing like what they showed'] },
    professionalism: { remove: ['misbehav'], add: ['misbehav*', 'rude to our guests', 'rude to the guests'] },
    delivery_speed: { remove: ['arrived on time'], add: ['album arrived on time', 'album on time', 'within a month', 'got the album on time'] },
    punctuality_praise: { add: ['time pe', 'time par', 'on-time'] },
    output_quality: { add: ['sundar', 'photos came out', 'album came out beautiful'] },
  },
};

/**
 * ROUND TWO — after the blind holdout (tests/eval, ids like "rh1").
 *
 * The holdout scored 29 of 51 before any of this; that number is the honest
 * one and is recorded in docs/SMART_FEEDBACK_INTELLIGENCE_AUDIT_2026-09.md.
 * It exposed two general faults, fixed here for every pack rather than for
 * the sentences that showed them:
 *
 *   A bare word that carries no verdict filed as a verdict. "vibe",
 *   "atmosphere", "flavour", "updates", "doubt", "personal", "loan", "showed",
 *   "regular", "concept", "worked" and "suggested" are praise only with an
 *   opinion attached — which the aspect reader already requires — and
 *   "cancelled", "replaced", "pushed" and "disappointed" are a specific
 *   problem only with the thing named. Each is replaced by anchored phrasings.
 *
 *   "refund" filed as a complaint whether or not one was given, and dropped as
 *   "negated" when it plainly was not ("refused to refund"). A refund topic is
 *   a complaint about an absence, so only phrasings that say it was withheld
 *   count now.
 */
const REFUND_WITHHELD = [
  'no refund', 'refund not', 'not refunded', 'never refunded', 'refused to refund', 'refused a refund',
  'refused the refund', 'refund refused', 'refund denied', 'denied a refund', 'denied refund',
  'did not refund', "didn't refund", 'won\'t refund', 'will not refund', 'refund pending', 'refund still pending',
  'waiting for my refund', 'waiting for the refund', 'waiting for refund', 'still no refund', 'asked for a refund',
  'asking for a refund', 'refund is pending', 'refund has not', 'refund hasn\'t',
];
/** Bare "wait" came out in round one; the Hinglish ways of saying it went with it. */
const HINGLISH_WAIT = ['wait karna pada', 'wait karna padta', 'wait karna padega', 'wait karaya', 'wait karwaya', 'bahut wait', 'itna wait', 'kaafi wait', 'wait karte rahe'];
const ROUND_TWO = {
  restaurant: {
    food_taste: { remove: ['flavour', 'flavor'], add: ['full of flavour', 'full of flavor', 'flavourful', 'flavorful'] },
    ambience: { remove: ['vibe', 'beautiful'], add: ['beautiful place', 'beautiful decor', 'beautiful interiors', 'lovely ambience', 'great vibe', 'good vibe', 'nice vibe'] },
    staff_warmth: { remove: ['hospitality'], add: ['great hospitality', 'warm hospitality', 'good hospitality', 'lovely hospitality', 'excellent hospitality'] },
    staff_behaviour: { remove: ['ignored', 'misbehav'], add: ['ignor*', 'misbehav*'] },
    order_accuracy: { add: ['order wrong', 'wrong order', 'order was wrong', 'got our order wrong', 'got the order wrong', 'mixed up our order', 'order was mixed up', 'order got mixed up'] },
    service_speed: { add: HINGLISH_WAIT },
    ambience_noise: { add: ['ac was not working', 'ac not working', 'ac is not working', 'ac was off', 'no ac', 'too hot inside', 'fan was not working'] },
  },
  clinic: {
    good_outcome: { remove: ['worked'], add: ['medicine worked', 'medicines worked', 'treatment worked', 'it worked', 'therapy worked', 'worked well', 'worked for me'] },
    staff_behaviour: { remove: ['misbehav'], add: ['misbehav*'] },
    wait_time: { add: HINGLISH_WAIT },
    billing_clarity: { add: ['unexplained charges', 'charges i did not understand', 'did not understand the charges', 'did not understand the bill', 'bill was confusing', 'confusing bill', 'no breakdown', 'charges were not explained', 'charges not explained'] },
  },
  coaching: {
    schedule_reliability: {
      remove: ['cancelled', 'canceled'],
      add: ['class cancelled', 'class canceled', 'classes cancelled', 'classes canceled', 'class was cancelled', 'classes were cancelled', 'classes get cancelled', 'class gets cancelled', 'lecture cancelled', 'lectures cancelled', 'lecture was cancelled', 'cancelled the class', 'cancelled classes', 'cancelled lectures', 'start late', 'starts late', 'started late', 'late start', 'never start on time', 'never starts on time'],
    },
    faculty_turnover: { remove: ['replaced'], add: ['teacher replaced', 'teacher was replaced', 'teachers were replaced', 'faculty replaced', 'replaced the teacher', 'replaced our teacher'] },
    fee_transparency: { remove: ['refund'], add: [...REFUND_WITHHELD, 'refund of fees'] },
    results_claims: { remove: ['promised'], add: ['promised a rank', 'promised selection', 'promised results', 'promised 100', 'guaranteed selection', 'guaranteed rank', 'promised a top'] },
    teaching_quality_praise: { remove: ['concept'], add: ['explains clearly', 'explains very clearly', 'explained clearly', 'explains every topic', 'explains well'] },
    individual_attention: { remove: ['personal', 'doubt'], add: ['clear every doubt', 'clears every doubt', 'clears doubts', 'doubts are cleared', 'doubt clearing', 'solve doubts', 'solves doubts', 'personal guidance'] },
    discipline: { remove: ['regular'], add: ['regular classes', 'very regular', 'regular tests'] },
    batch_size: { add: ['overcrowded', 'too many students', 'no one gets attention', 'nobody gets attention'] },
    study_material_praise: { add: ['mock tests helped', 'tests really helped', 'test series helped', 'weekly tests helped'] },
  },
  gym: {
    class_schedule: {
      remove: ['cancelled', 'canceled'],
      add: ['class cancelled', 'class canceled', 'classes cancelled', 'classes were cancelled', 'classes get cancelled', 'session cancelled', 'sessions cancelled', 'session was cancelled', 'cancelled the class', 'cancelled the session', 'cancelled classes', 'batch cancelled'],
    },
    membership_billing: { remove: ['refund'], add: [...REFUND_WITHHELD, 'charged my card', 'charged me again', 'charged twice', 'double charged', 'still charged', 'kept charging', 'charged after', 'after i cancelled', 'cancelled my membership', 'cancelled the membership', 'auto-debit'] },
    atmosphere: { remove: ['atmosphere', 'vibe', 'energy', 'community'], add: ['great atmosphere', 'good atmosphere', 'great vibe', 'good vibe', 'positive vibe', 'great energy', 'good energy', 'positive energy', 'great community', 'friendly community'] },
    results: { remove: ['results'], add: ['great results', 'good results', 'seeing results', 'saw results', 'visible results', 'amazing results', 'real results'] },
    crowding: { add: ['packed', 'jam packed', 'overcrowded', 'too many people', 'hardly move', 'no space to'] },
    trainer_availability: { remove: ['ignored'], add: ['ignor*'] },
  },
  real_estate: {
    paperwork_help: { remove: ['loan'], add: ['loan sanctioned', 'loan approved', 'helped with the loan', 'helped us with the loan', 'helped with the home loan', 'helped us with the home loan', 'loan paperwork', 'loan process'] },
    options_shown: { remove: ['showed', 'matched'], add: ['showed us good', 'showed us exactly', 'showed us many', 'showed us several', 'matched our budget', 'matched our needs', 'matched what we wanted'] },
    market_knowledge: { remove: ['suggested'], add: ['suggested the right', 'good advice', 'great advice', 'sound advice'] },
    token_refund: { remove: ['refund'], add: REFUND_WITHHELD },
    responsiveness: { remove: ['ignored'], add: ['ignor*', 'went silent', 'gone silent', 'stopped replying', 'ghosted'] },
    site_visit_experience: { add: ['never turned up', 'did not turn up', "didn't turn up", 'never showed up', 'did not show up', "didn't show up", 'no show'] },
    unclear_pricing: { add: ['changing the price', 'changed the price', 'price kept changing', 'price changed', 'kept changing the price', 'price went up'] },
    listing_accuracy: { add: ['different flat', 'different property', 'different apartment', 'fake photos', 'old photos'] },
  },
  salon: {
    consultation: { remove: ['suggested'], add: ['suggested the right', 'suggested a style', 'suggested what suits'] },
    upselling_pressure: { remove: ['pushed'], add: ['pushed me to', 'pushed us to', 'pushed products', 'pushed a package', 'pushed a membership'] },
    product_quality: { remove: ['chemical'], add: ['harsh chemical', 'harsh chemicals', 'too much chemical'] },
    staff_behaviour: { remove: ['ignored'], add: ['ignor*'] },
    wait_time: { add: HINGLISH_WAIT },
    stylist_skill: { add: ['the look i wanted', 'exactly the look', 'exactly what i wanted'] },
    service_result: { add: ['colour faded', 'color faded', 'faded within', 'faded quickly', 'faded in', 'faded after'] },
  },
  wedding_vendor: {
    quality_vs_sample: { remove: ['disappointed'], add: ['disappointed with the photos', 'disappointed with the video', 'disappointed with the album', 'disappointed with the quality'] },
    communication_praise: { remove: ['updates'], add: ['regular updates', 'kept us updated', 'constant updates', 'timely updates'] },
    flexibility: { remove: ['helped'], add: ['accommodated', 'accommodate every', 'accommodated all'] },
    advance_refund: { remove: ['refund'], add: REFUND_WITHHELD },
    communication: { remove: ['ignored'], add: ['ignor*'] },
    team_substitution: { add: ['different team', 'different photographer', 'another team', 'sent someone else', 'sent juniors', 'sent a junior'] },
    coverage_gaps: { add: ['photos are missing', 'photos were missing', 'photos missing', 'missing photos', 'missing from the album'] },
  },
};

/**
 * ROUND THREE — the final semantic correctness pass.
 *
 * Two faults, found on the development half of the second corpus and fixed
 * for every pack rather than for its sentences:
 *
 *   More single words that are not a verdict on their own: "quick" (a quick
 *   consultation is a rushed one), "kind" ("what kind of service"), "value",
 *   "guidance", "advice", "knowledge", "consultation", "improvement",
 *   "scored", "comfortable", "handled". Each needs its opinion attached.
 *
 *   One hint on TWO topics of the same pack, so one of the two is always
 *   invented: "well maintained" (equipment or cleanliness), "motivating"
 *   (trainer or atmosphere), "extra charge" (pricing or the bill), "गंदा" and
 *   "not very clean" (tool hygiene or the premises). The aspect reader now
 *   decides by what the word is attached to; the hint goes.
 *
 * And one phrase that files anything as broken equipment: the gym's bare
 * "not working" ("the AC is not working").
 */
const ROUND_THREE = {
  clinic: {
    short_wait: { remove: ['quick'], add: ['quick appointment', 'seen quickly', 'saw me quickly', 'seen immediately', 'no waiting', 'seen on time'] },
    doctor_care: { remove: ['kind'], add: ['very kind', 'so kind', 'was kind', 'is kind', 'kind doctor'] },
    fair_pricing: { remove: ['value'], add: ['good value', 'great value', 'value for money'] },
    followup_communication: { add: ['nobody called', 'no one called', 'never called', 'no follow up', 'no follow-up'] },
  },
  coaching: {
    results_praise: { remove: ['improvement', 'scored'], add: ['big improvement', 'improvement in marks', 'marks improved', 'scored well', 'scored high', 'improved in'] },
    fee_value: { remove: ['value'], add: ['good value', 'great value', 'value for money'] },
    faculty_turnover: { add: ['teachers change', 'teacher change', 'faculty change', 'faculty keeps changing'] },
    individual_attention: { add: ['extra time', 'extra attention', 'extra classes', 'available for doubts'] },
    batch_size: { add: ['खूप मुलं', 'बहुत सारे बच्चे', 'bahut bachche'] },
  },
  gym: {
    equipment_condition: { remove: ['not working'] },
    equipment_quality: { remove: ['well maintained', 'motivating'] },
    cleanliness_praise: { remove: ['well maintained'] },
    trainer_quality: { remove: ['guidance', 'motivating'], add: ['good guidance', 'great guidance', 'proper guidance', 'care about form', 'cares about form'] },
    atmosphere: { remove: ['motivating'] },
    parking_access: { remove: ['जागा नाही'], add: ['पार्किंगला जागा नाही', 'parking ke liye jagah nahi'] },
    value_pricing: { remove: ['value'], add: ['good value', 'great value', 'value for money'] },
  },
  real_estate: {
    market_knowledge: { remove: ['knowledge', 'advice', 'guidance'], add: ['good knowledge', 'great knowledge', 'local knowledge', 'knows the market', 'knew the market', 'knowledge of the area', 'good guidance'] },
    no_pressure: { remove: ['comfortable'], add: ['made us comfortable', 'felt comfortable', 'never felt pressured', 'never pressured', 'never rushed', 'never pushed', 'did not rush', "didn't rush", 'never forced'] },
    pressure_tactics: { add: ['pushed us', 'pushed me', 'pushing us'] },
  },
  restaurant: {
    pricing_value: { remove: ['extra charge'] },
    wait_for_table: { add: ['waiting for a table', 'wait for a table', 'waited for a table'] },
  },
  salon: {
    punctuality: { remove: ['quick'], add: ['on time', 'no waiting', 'took me on time'] },
    consultation: { remove: ['consultation', 'advice', 'recommendation'], add: ['good advice', 'great advice', 'helpful advice', 'good consultation', 'proper consultation'] },
    hygiene: { remove: ['गंदा', 'घाण', 'not very clean'] },
    value_pricing: { remove: ['value'], add: ['good value', 'great value', 'value for money'] },
  },
  wedding_vendor: {
    team_conduct: { remove: ['handled'], add: ['handled everything', 'handled it well', 'handled it perfectly', 'handled the rain', 'well handled', 'handled perfectly'] },
    value_pricing: { remove: ['value'], add: ['good value', 'great value', 'value for money'] },
    communication: { add: ['went silent', 'gone silent', 'stopped replying'] },
    team_substitution: { add: ['trainee'] },
    delivery_delay: { add: ['missed the deadline'] },
  },
};

/**
 * ROUND FOUR — the final correctness gate.
 *
 * "was kind", "very kind" and the like came out of doctor care: they name no
 * person, and the entity guard plus the aspect reader now give them to whoever
 * the clause is about. And the common ways of saying someone cannot be
 * reached, or stopped answering, for every topic that is about that.
 */
const UNREACHABLE = ['hard to reach', 'difficult to reach', 'hard to get', 'hard to contact', 'difficult to contact', 'hard to get through'];
const ROUND_FOUR = {
  clinic: {
    doctor_care: { remove: ['very kind', 'so kind', 'was kind', 'is kind'] },
    phone_unreachable: { add: UNREACHABLE },
  },
  coaching: {
    teaching_quality_praise: { add: ['taught well', 'teaches well', 'explained well'] },
  },
  real_estate: {
    responsiveness: { add: [...UNREACHABLE, 'stopped responding', 'went quiet'] },
    hidden_charges: { add: ['added charges', 'charges we never agreed', 'never agreed to', 'extra charges'] },
  },
  salon: {
    phone_unreachable: { add: UNREACHABLE },
  },
  wedding_vendor: {
    communication: { add: [...UNREACHABLE, 'stopped responding', 'went quiet', 'gone quiet'] },
  },
};

// Every round is applied in memory, in order, and each pack is compared with
// what it was before: a later round removing what an earlier one added wins,
// and a second run changes nothing.
// Round five (AI validation pass): "worth" alone is "worth it", "worth a
// visit", "worth the wait" — an opinion with no price in it. Value is named
// only when the money is.
const WORTH_MONEY = ['worth the money', 'worth every rupee', 'worth every penny', 'worth the price', 'worth the cost', 'worth paying'];
const ROUND_FIVE = {
  coaching: { fee_value: { remove: ['worth'], add: [...WORTH_MONEY, 'worth the fee', 'worth the fees'] } },
  gym: { value_pricing: { remove: ['worth'], add: [...WORTH_MONEY, 'worth the membership', 'worth the fee', 'worth the fees'] } },
  real_estate: {
    fair_brokerage: { remove: ['worth'], add: [...WORTH_MONEY, 'worth the brokerage', 'worth the commission'] },
    transparency: { add: ['clear about every cost', 'clear about the costs', 'clear about costs', 'clear about the charges', 'clear about charges', 'clear about the fees'] },
  },
  restaurant: { value_for_money: { remove: ['worth'], add: WORTH_MONEY } },
  salon: {
    value_pricing: { remove: ['worth'], add: WORTH_MONEY },
    // "Neat" alone is a neat haircut as often as a neat salon: the clean
    // aspect still reads "the salon was neat" through its anchor.
    hygiene_praise: { remove: ['neat'] },
  },
};

export const ROUNDS = [EDITS, ROUND_TWO, ROUND_THREE, ROUND_FOUR, ROUND_FIVE];

// Imported by the taxonomy audit for its history; applied only when run.
const runDirectly = (process.argv[1] ?? '').split('\\').join('/').endsWith('scripts/taxonomy-quality-pass.mjs');
let changed = 0;
for (const packId of runDirectly ? [...new Set(ROUNDS.flatMap((r) => Object.keys(r)))] : []) {
  const path = `packs/${packId}.json`;
  const raw = readFileSync(path, 'utf8');
  const pack = JSON.parse(raw);
  const entryOf = (key) => [...pack.issueTaxonomy, ...pack.praiseTaxonomy].find((e) => e.key === key);
  const before = new Map([...pack.issueTaxonomy, ...pack.praiseTaxonomy].map((e) => [e.key, JSON.stringify(e.hints)]));
  for (const round of ROUNDS) {
    for (const [key, edit] of Object.entries(round[packId] ?? {})) {
      const entry = entryOf(key);
      if (!entry) throw new Error(`${packId}: no topic "${key}"`);
      const remove = new Set((edit.remove ?? []).map((h) => h.toLowerCase()));
      entry.hints = entry.hints.filter((h) => !remove.has(h.toLowerCase()));
      for (const hint of [...(edit.add ?? []), ...(edit.add2 ?? [])]) {
        if (!entry.hints.some((h) => h.toLowerCase() === hint.toLowerCase())) entry.hints.push(hint);
      }
    }
  }
  for (const e of [...pack.issueTaxonomy, ...pack.praiseTaxonomy]) if (before.get(e.key) !== JSON.stringify(e.hints)) changed += 1;
  const out = JSON.stringify(pack, null, 2) + '\n';
  const unix = (t) => t.replace(/\r\n/g, '\n');
  if (unix(out) !== unix(raw)) writeFileSync(path, raw.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out);
}
if (runDirectly) console.log(`${changed} topics updated.`);
