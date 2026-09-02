/**
 * One-off maintenance script (M7).
 *
 * Taxonomy labels are category names for the operator's screens. Dropped into
 * a reply a customer reads, they are obviously machine-written:
 *
 *   "We are sorry about appointment / waiting problems."
 *
 * This adds `replyPhrase` to every taxonomy entry: the same theme written the
 * way a person would say it out loud.
 *
 *   ISSUE  — noun phrase, completes "We are sorry about ___"
 *   PRAISE — clause, completes "It is good to hear that ___"
 *
 * Run with: node scripts/add-reply-phrases.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packs');

const PHRASES = {
  clinic: {
    issue: {
      wait_time: 'the wait past your appointment time',
      appointment_scheduling: 'the trouble getting your appointment sorted',
      billing_clarity: 'the confusion over the bill',
      staff_behaviour: 'the way you were spoken to at the desk',
      cleanliness: 'the state of the clinic when you visited',
      consultation_rush: 'feeling rushed during your consultation',
      followup_communication: 'not hearing back from us',
      treatment_outcome: 'how things have gone since your visit',
      parking_access: 'how hard it was to park and get in',
      phone_unreachable: 'not being able to reach us on the phone',
    },
    praise: {
      doctor_care: 'the doctor took the time to explain things',
      staff_friendly: 'the team looked after you',
      clean_facility: 'the clinic felt clean and well kept',
      short_wait: 'you were seen on time',
      fair_pricing: 'the pricing was clear and fair',
      good_outcome: 'you are feeling better',
      modern_equipment: 'the facilities were up to standard',
    },
  },

  salon: {
    issue: {
      service_result: 'how your hair turned out',
      appointment_scheduling: 'the trouble with your appointment',
      pricing_transparency: 'being charged more than you were quoted',
      staff_behaviour: 'the way you were spoken to',
      hygiene: 'the cleanliness of the tools and towels',
      upselling_pressure: 'feeling pushed into extras you did not want',
      product_quality: 'the products used on you',
      wait_time: 'the wait even though you had booked',
      cleanliness_space: 'the state of the salon when you visited',
      phone_unreachable: 'not being able to get through to us',
    },
    praise: {
      stylist_skill: 'your stylist got it right',
      staff_warmth: 'the team made you feel welcome',
      hygiene_praise: 'the salon felt clean and hygienic',
      ambience: 'the place felt relaxing',
      value_pricing: 'the pricing felt fair',
      punctuality: 'you were seen on time',
      consultation: 'you were properly listened to first',
    },
  },

  restaurant: {
    issue: {
      food_quality: 'the food not being up to standard',
      service_speed: 'how long you waited to be served',
      order_accuracy: 'getting the wrong order',
      staff_behaviour: 'the way the staff dealt with you',
      cleanliness: 'the cleanliness of the place',
      pricing_value: 'feeling the bill was not worth it',
      wait_for_table: 'the wait for a table',
      ambience_noise: 'how uncomfortable it was to sit and eat',
      delivery_packaging: 'the state your order arrived in',
      billing_issue: 'the problem with your bill',
    },
    praise: {
      food_taste: 'the food hit the spot',
      service_quality: 'you were looked after properly',
      ambience: 'you enjoyed the atmosphere',
      value_for_money: 'it felt worth the money',
      cleanliness_praise: 'the place felt clean',
      staff_warmth: 'the team made you feel welcome',
      menu_variety: 'there was plenty to choose from',
    },
  },

  gym: {
    issue: {
      equipment_condition: 'equipment being out of action',
      crowding: 'how packed it gets at peak times',
      trainer_availability: 'not getting the guidance you needed',
      cleanliness: 'the state of the changing rooms',
      membership_billing: 'the problem with your membership',
      ac_ventilation: 'how stuffy it gets on the floor',
      staff_behaviour: 'the way you were dealt with at the desk',
      overcommitted_sales: 'being told one thing and finding another',
      class_schedule: 'classes not running as scheduled',
      parking_access: 'how hard it is to park',
    },
    praise: {
      trainer_quality: 'your trainer knows what they are doing',
      equipment_quality: 'the equipment is up to scratch',
      cleanliness_praise: 'the place is kept clean',
      atmosphere: 'the floor has a good atmosphere',
      value_pricing: 'the membership feels worth it',
      results: 'you are seeing results',
      timings: 'the timings work for you',
    },
  },

  coaching: {
    issue: {
      teaching_quality: 'the teaching not being what you expected',
      faculty_turnover: 'teachers changing mid-course',
      batch_size: 'the batch being too large for proper attention',
      fee_transparency: 'the confusion over fees',
      communication_parents: 'not being kept informed',
      schedule_reliability: 'classes being cancelled or moved',
      results_claims: 'the results not matching what was promised',
      facility_condition: 'the state of the classroom',
      study_material: 'the study material',
      safety_discipline: 'concerns about how things are run',
    },
    praise: {
      teaching_quality_praise: 'the teaching is working for you',
      individual_attention: 'the attention has been personal',
      results_praise: 'the marks are moving in the right direction',
      faculty_support: 'the faculty have been approachable',
      study_material_praise: 'the material has been useful',
      discipline: 'the classes run properly',
      fee_value: 'the fees feel fair',
    },
  },

  real_estate: {
    issue: {
      listing_accuracy: 'the property not matching what was shown',
      responsiveness: 'not hearing back quickly enough',
      hidden_charges: 'charges you were not told about upfront',
      site_visit_experience: 'how the site visit went',
      documentation_delay: 'the paperwork taking longer than it should',
      pressure_tactics: 'feeling pushed to decide quickly',
      token_refund: 'the delay in returning your money',
      post_deal_support: 'the drop in contact after the deal',
      professionalism: 'the way you were dealt with',
      unclear_pricing: 'the price changing on you',
    },
    praise: {
      transparency: 'the process was straight with you',
      responsiveness_praise: 'you could always get hold of us',
      market_knowledge: 'the local advice was useful',
      options_shown: 'the options shown were the right ones',
      paperwork_help: 'the paperwork was made easier',
      no_pressure: 'you were given room to decide',
      fair_brokerage: 'the brokerage felt fair',
    },
  },

  wedding_vendor: {
    issue: {
      delivery_delay: 'how long you have been waiting for the final files',
      quality_vs_sample: 'the work not matching what you were shown',
      team_substitution: 'a different team turning up on the day',
      communication: 'how hard it was to reach us',
      hidden_costs: 'costs that came up later',
      punctuality: 'arriving later than we should have',
      coverage_gaps: 'the moments that were missed',
      professionalism: 'how the team behaved on the day',
      revisions_refused: 'the changes you asked for not being made',
      advance_refund: 'the delay in returning your advance',
    },
    praise: {
      output_quality: 'you are happy with how the work turned out',
      team_conduct: 'the team handled the day well',
      communication_praise: 'you were kept in the loop',
      punctuality_praise: 'we were there on time',
      flexibility: 'we could work around you',
      value_pricing: 'it felt worth what you paid',
      delivery_speed: 'everything reached you on time',
    },
  },
};

let updated = 0;
let missing = 0;

for (const [pack, sets] of Object.entries(PHRASES)) {
  const file = join(packsDir, `${pack}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));

  for (const [taxonomyName, phrases] of [
    ['issueTaxonomy', sets.issue],
    ['praiseTaxonomy', sets.praise],
  ]) {
    for (const entry of data[taxonomyName] ?? []) {
      const phrase = phrases[entry.key];
      if (!phrase) {
        console.warn(`  MISSING ${pack}/${taxonomyName}/${entry.key}`);
        missing += 1;
        continue;
      }
      entry.replyPhrase = phrase;
      updated += 1;
    }
  }

  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${pack}: phrases written`);
}

console.log(`\n${updated} entries given a reply phrase; ${missing} missing.`);
if (missing > 0) process.exitCode = 1;
