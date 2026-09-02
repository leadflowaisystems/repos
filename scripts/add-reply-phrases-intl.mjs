/**
 * One-off maintenance script (M7), companion to add-reply-phrases.mjs.
 *
 * Three of the seven packs speak Hinglish by default and any client can be set
 * to Marathi, so English-only phrasing meant those businesses got a reply that
 * acknowledged the customer without ever naming what they actually said.
 *
 * This adds the same phrase in romanised Hinglish and in Marathi.
 *
 *   HINGLISH issue  — noun phrase before "ke liye humein khed hai"
 *   HINGLISH praise — clause after "Achha laga ki"
 *   MARATHI  issue  — phrase ending in -बद्दल, before "आम्हाला खेद आहे"
 *   MARATHI  praise — clause before "हे ऐकून बरे वाटले"
 *
 * Run with: node scripts/add-reply-phrases-intl.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packs');

/** key -> [hinglish, marathi] */
const PHRASES = {
  clinic: {
    issue: {
      wait_time: ['lambe intezaar', 'झालेल्या उशिराबद्दल'],
      appointment_scheduling: [
        'appointment mein hui pareshani',
        'अपॉइंटमेंटमध्ये झालेल्या गैरसोयीबद्दल',
      ],
      billing_clarity: ['bill mein hue confusion', 'बिलाबाबत झालेल्या गोंधळाबद्दल'],
      staff_behaviour: ['counter par hue vyavhaar', 'काउंटरवरील वागणुकीबद्दल'],
      cleanliness: ['safai ki kami', 'स्वच्छतेच्या कमतरतेबद्दल'],
      consultation_rush: [
        'consultation mein hui jaldbaazi',
        'तपासणीत झालेल्या घाईबद्दल',
      ],
      followup_communication: [
        'humari taraf se jawab na milne',
        'आमच्याकडून उत्तर न मिळाल्याबद्दल',
      ],
      treatment_outcome: [
        'visit ke baad hui pareshani',
        'भेटीनंतर झालेल्या त्रासाबद्दल',
      ],
      parking_access: ['parking mein hui dikkat', 'पार्किंगमध्ये झालेल्या अडचणीबद्दल'],
      phone_unreachable: [
        'phone par sampark na ho paane',
        'फोनवर संपर्क न झाल्याबद्दल',
      ],
    },
    praise: {
      doctor_care: [
        'doctor ne sab kuch aaram se samjhaya',
        'डॉक्टरांनी सर्व नीट समजावून सांगितले',
      ],
      staff_friendly: [
        'team ne aapka acche se dhyan rakha',
        'टीमने तुमची चांगली काळजी घेतली',
      ],
      clean_facility: ['clinic saaf suthra laga', 'क्लिनिक स्वच्छ वाटले'],
      short_wait: ['aapko samay par dekha gaya', 'तुम्हाला वेळेवर पाहिले गेले'],
      fair_pricing: ['kharcha saaf aur uchit raha', 'खर्च स्पष्ट आणि योग्य होता'],
      good_outcome: [
        'aap ab behtar mehsoos kar rahe hain',
        'तुम्हाला आता बरे वाटत आहे',
      ],
      modern_equipment: ['suvidhaayein theek thaak lagin', 'सुविधा चांगल्या वाटल्या'],
    },
  },

  salon: {
    issue: {
      service_result: ['baalon ke result', 'केसांच्या रिझल्टबद्दल'],
      appointment_scheduling: [
        'appointment mein hui gadbad',
        'अपॉइंटमेंटमधील गोंधळाबद्दल',
      ],
      pricing_transparency: [
        'bataye gaye daam se zyada charge hone',
        'सांगितलेल्यापेक्षा जास्त पैसे घेतल्याबद्दल',
      ],
      staff_behaviour: ['staff ke vyavhaar', 'स्टाफच्या वागणुकीबद्दल'],
      hygiene: ['tools aur towel ki safai', 'साधने आणि टॉवेलच्या स्वच्छतेबद्दल'],
      upselling_pressure: [
        'extra package ke liye dabaav',
        'अतिरिक्त पॅकेजच्या आग्रहाबद्दल',
      ],
      product_quality: ['istemaal kiye gaye products', 'वापरलेल्या उत्पादनांबद्दल'],
      wait_time: [
        'booking ke baad bhi karna pade intezaar',
        'बुकिंग असूनही झालेल्या उशिराबद्दल',
      ],
      cleanliness_space: ['salon ki safai', 'सलूनच्या स्वच्छतेबद्दल'],
      phone_unreachable: [
        'phone par sampark na ho paane',
        'फोनवर संपर्क न झाल्याबद्दल',
      ],
    },
    praise: {
      stylist_skill: [
        'stylist ne bilkul waise hi kiya jaisa aap chahte the',
        'स्टायलिस्टने तुम्हाला हवे तसेच केले',
      ],
      staff_warmth: [
        'team ne aapko comfortable mehsoos karaya',
        'टीमने तुम्हाला आपुलकीने वागवले',
      ],
      hygiene_praise: ['salon saaf aur hygienic laga', 'सलून स्वच्छ वाटले'],
      ambience: ['mahaul relaxing laga', 'वातावरण आरामदायी वाटले'],
      value_pricing: ['daam uchit lage', 'दर योग्य वाटले'],
      punctuality: ['aapko samay par liya gaya', 'तुम्हाला वेळेवर घेतले गेले'],
      consultation: [
        'pehle aapki baat dhyan se suni gayi',
        'आधी तुमचे म्हणणे नीट ऐकले गेले',
      ],
    },
  },

  restaurant: {
    issue: {
      food_quality: ['khane ki quality', 'जेवणाच्या दर्जाबद्दल'],
      service_speed: ['service mein lage waqt', 'सेवेला लागलेल्या वेळेबद्दल'],
      order_accuracy: ['galat order aane', 'चुकीची ऑर्डर आल्याबद्दल'],
      staff_behaviour: ['staff ke vyavhaar', 'स्टाफच्या वागणुकीबद्दल'],
      cleanliness: ['safai ki kami', 'स्वच्छतेच्या कमतरतेबद्दल'],
      pricing_value: ['bill paise vasool na lagne', 'बिल योग्य न वाटल्याबद्दल'],
      wait_for_table: [
        'table ke liye karna pade intezaar',
        'टेबलसाठी झालेल्या प्रतीक्षेबद्दल',
      ],
      ambience_noise: ['baithne mein hui asuvidha', 'बसण्यात झालेल्या गैरसोयीबद्दल'],
      delivery_packaging: [
        'order ki packing aur haalat',
        'ऑर्डरच्या पॅकिंग आणि अवस्थेबद्दल',
      ],
      billing_issue: ['bill mein hui gadbad', 'बिलातील चुकीबद्दल'],
    },
    praise: {
      food_taste: ['khana pasand aaya', 'जेवण आवडले'],
      service_quality: [
        'aapka acche se dhyan rakha gaya',
        'तुमची चांगली काळजी घेतली गेली',
      ],
      ambience: ['mahaul aapko pasand aaya', 'वातावरण तुम्हाला आवडले'],
      value_for_money: ['paise vasool lage', 'पैसे योग्य खर्च झाले असे वाटले'],
      cleanliness_praise: ['jagah saaf suthri lagi', 'जागा स्वच्छ वाटली'],
      staff_warmth: [
        'team ne aapka swaagat acche se kiya',
        'टीमने तुमचे चांगले स्वागत केले',
      ],
      menu_variety: ['choose karne ko kaafi kuch tha', 'निवडण्यासाठी भरपूर पर्याय होते'],
    },
  },

  gym: {
    issue: {
      equipment_condition: ['machine kharab hone', 'मशीन बंद असल्याबद्दल'],
      crowding: ['peak time par hui bheed', 'गर्दीच्या वेळेतील अडचणीबद्दल'],
      trainer_availability: ['sahi guidance na milne', 'योग्य मार्गदर्शन न मिळाल्याबद्दल'],
      cleanliness: ['changing room ki safai', 'चेंजिंग रूमच्या स्वच्छतेबद्दल'],
      membership_billing: ['membership mein hui gadbad', 'मेंबरशिपमधील गोंधळाबद्दल'],
      ac_ventilation: ['hall mein hui ghutan', 'हॉलमधील उकाड्याबद्दल'],
      staff_behaviour: ['desk par hue vyavhaar', 'डेस्कवरील वागणुकीबद्दल'],
      overcommitted_sales: [
        'joining ke waqt kahi gayi baat alag nikalne',
        'सांगितलेले आणि प्रत्यक्षातील फरकाबद्दल',
      ],
      class_schedule: ['class time par na hone', 'क्लास वेळेवर न झाल्याबद्दल'],
      parking_access: ['parking mein hui dikkat', 'पार्किंगमधील अडचणीबद्दल'],
    },
    praise: {
      trainer_quality: [
        'trainer ko apna kaam aata hai',
        'ट्रेनरला त्यांचे काम चांगले येते',
      ],
      equipment_quality: ['equipment theek thaak hai', 'उपकरणे चांगली आहेत'],
      cleanliness_praise: ['jagah saaf rakhi jaati hai', 'जागा स्वच्छ ठेवली जाते'],
      atmosphere: ['floor ka mahaul acha hai', 'जिमचे वातावरण चांगले आहे'],
      value_pricing: ['membership paise vasool lagti hai', 'मेंबरशिप योग्य वाटते'],
      results: ['aapko result dikh raha hai', 'तुम्हाला परिणाम दिसत आहेत'],
      timings: [
        'timings aapke liye theek baithti hain',
        'वेळा तुम्हाला सोयीच्या वाटतात',
      ],
    },
  },

  coaching: {
    issue: {
      teaching_quality: ['padhai ke standard', 'शिकवण्याच्या दर्जाबद्दल'],
      faculty_turnover: [
        'beech course mein teacher badalne',
        'कोर्समध्ये शिक्षक बदलल्याबद्दल',
      ],
      batch_size: [
        'batch bade hone se dhyan na milne',
        'बॅच मोठा असल्याने लक्ष न दिल्याबद्दल',
      ],
      fee_transparency: ['fees ko lekar hue confusion', 'फीबाबत झालेल्या गोंधळाबद्दल'],
      communication_parents: [
        'jaankari time par na milne',
        'वेळेवर माहिती न मिळाल्याबद्दल',
      ],
      schedule_reliability: ['class cancel hone', 'क्लास रद्द झाल्याबद्दल'],
      results_claims: [
        'result waise na aane jaise kahe gaye the',
        'सांगितल्याप्रमाणे निकाल न आल्याबद्दल',
      ],
      facility_condition: ['classroom ki haalat', 'वर्गाच्या अवस्थेबद्दल'],
      study_material: ['study material', 'अभ्यास साहित्याबद्दल'],
      safety_discipline: [
        'vyavastha ko lekar hui chinta',
        'व्यवस्थेबाबतच्या काळजीबद्दल',
      ],
    },
    praise: {
      teaching_quality_praise: [
        'padhai aapke liye kaam kar rahi hai',
        'शिकवणे तुमच्यासाठी उपयोगी ठरत आहे',
      ],
      individual_attention: [
        'har student par alag dhyan diya gaya',
        'प्रत्येकाकडे स्वतंत्र लक्ष दिले गेले',
      ],
      results_praise: ['marks behtar ho rahe hain', 'गुण सुधारत आहेत'],
      faculty_support: ['teachers approachable rahe', 'शिक्षक मदतीसाठी उपलब्ध राहिले'],
      study_material_praise: ['material kaam aaya', 'साहित्य उपयोगी पडले'],
      discipline: ['classes theek se chalti hain', 'वर्ग नीट चालतात'],
      fee_value: ['fees uchit lagti hai', 'फी योग्य वाटते'],
    },
  },

  real_estate: {
    issue: {
      listing_accuracy: [
        'property waisi na nikalne jaisi dikhayi gayi thi',
        'दाखवल्याप्रमाणे मालमत्ता नसल्याबद्दल',
      ],
      responsiveness: ['jawab time par na milne', 'वेळेवर उत्तर न मिळाल्याबद्दल'],
      hidden_charges: [
        'pehle se na bataye gaye kharche',
        'आधी न सांगितलेल्या खर्चाबद्दल',
      ],
      site_visit_experience: ['site visit ke anubhav', 'साइट भेटीच्या अनुभवाबद्दल'],
      documentation_delay: ['kaagzi kaam mein hui deri', 'कागदपत्रांच्या उशिराबद्दल'],
      pressure_tactics: [
        'jaldi faisla lene ka dabaav',
        'लवकर निर्णय घेण्याच्या दबावाबद्दल',
      ],
      token_refund: [
        'paise wapas milne mein hui deri',
        'पैसे परत मिळण्यास झालेल्या उशिराबद्दल',
      ],
      post_deal_support: [
        'deal ke baad sampark kam hone',
        'व्यवहारानंतर संपर्क कमी झाल्याबद्दल',
      ],
      professionalism: ['vyavhaar', 'वागणुकीबद्दल'],
      unclear_pricing: ['daam badalte rehne', 'किंमत बदलत राहिल्याबद्दल'],
    },
    praise: {
      transparency: [
        'poori baat saaf saaf rakhi gayi',
        'सर्व व्यवहार पारदर्शक ठेवला गेला',
      ],
      responsiveness_praise: [
        'aapko hamesha sampark mil gaya',
        'तुम्हाला नेहमी संपर्क मिळाला',
      ],
      market_knowledge: ['ilaake ki salah kaam aayi', 'भागाची माहिती उपयोगी पडली'],
      options_shown: ['sahi options dikhaye gaye', 'योग्य पर्याय दाखवले गेले'],
      paperwork_help: [
        'kaagzi kaam aasaan kar diya gaya',
        'कागदपत्रांचे काम सोपे केले गेले',
      ],
      no_pressure: [
        'aapko soch samajh kar faisla lene diya gaya',
        'तुम्हाला विचार करून निर्णय घेऊ दिला गेला',
      ],
      fair_brokerage: ['brokerage uchit lagi', 'दलाली योग्य वाटली'],
    },
  },

  wedding_vendor: {
    issue: {
      delivery_delay: [
        'final files milne mein hui deri',
        'अंतिम फाइल्स मिळण्यास झालेल्या उशिराबद्दल',
      ],
      quality_vs_sample: [
        'kaam waisa na hone jaisa dikhaya gaya tha',
        'दाखवल्याप्रमाणे काम न झाल्याबद्दल',
      ],
      team_substitution: ['din par doosri team aane', 'दिवशी दुसरी टीम आल्याबद्दल'],
      communication: ['sampark mein hui dikkat', 'संपर्कात आलेल्या अडचणीबद्दल'],
      hidden_costs: ['baad mein aaye extra kharche', 'नंतर आलेल्या अतिरिक्त खर्चाबद्दल'],
      punctuality: ['der se pahunchne', 'उशिरा पोहोचल्याबद्दल'],
      coverage_gaps: ['chhoot gaye moments', 'निसटलेल्या क्षणांबद्दल'],
      professionalism: [
        'din par team ke vyavhaar',
        'त्या दिवशीच्या टीमच्या वागणुकीबद्दल',
      ],
      revisions_refused: ['maange gaye badlaav na hone', 'मागितलेले बदल न झाल्याबद्दल'],
      advance_refund: [
        'advance wapas milne mein hui deri',
        'आगाऊ रक्कम परत मिळण्यास झालेल्या उशिराबद्दल',
      ],
    },
    praise: {
      output_quality: ['kaam aapko pasand aaya', 'काम तुम्हाला आवडले'],
      team_conduct: ['team ne din acche se sambhala', 'टीमने दिवस चांगला सांभाळला'],
      communication_praise: [
        'aapko har update milta raha',
        'तुम्हाला सर्व माहिती मिळत राहिली',
      ],
      punctuality_praise: ['hum time par pahunche', 'आम्ही वेळेवर पोहोचलो'],
      flexibility: [
        'hum aapke hisaab se adjust kar paaye',
        'आम्ही तुमच्यानुसार जुळवून घेऊ शकलो',
      ],
      value_pricing: ['kharche ke hisaab se theek laga', 'खर्चाच्या मानाने योग्य वाटले'],
      delivery_speed: ['sab kuch time par pahunch gaya', 'सर्व वेळेवर पोहोचले'],
    },
  },
};

let updated = 0;
let missing = 0;

for (const [pack, sets] of Object.entries(PHRASES)) {
  const file = join(packsDir, `${pack}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));

  for (const [taxonomyName, table] of [
    ['issueTaxonomy', sets.issue],
    ['praiseTaxonomy', sets.praise],
  ]) {
    for (const entry of data[taxonomyName] ?? []) {
      const pair = table[entry.key];
      if (!pair) {
        console.warn(`  MISSING ${pack}/${taxonomyName}/${entry.key}`);
        missing += 1;
        continue;
      }
      entry.replyPhraseHinglish = pair[0];
      entry.replyPhraseMarathi = pair[1];
      updated += 1;
    }
  }

  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${pack}: Hinglish and Marathi phrases written`);
}

console.log(`\n${updated} entries translated; ${missing} missing.`);
if (missing > 0) process.exitCode = 1;
