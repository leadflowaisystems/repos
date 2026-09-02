/**
 * One-off maintenance script (companion to clean-praise-hints.mjs).
 *
 * That script removed neutral nouns from PRAISE hints on the assumption that
 * issue hints could keep them, "because an issue bucket is entered via a
 * complaint word". That assumption was wrong: the classifier matches every
 * taxonomy hint independently, with no sentiment gate. So a bare noun in an
 * issue list fires on happy reviews too, and
 *
 *   "Absolutely loved my haircut ... I have already booked my next appointment"
 *
 * came back as MIXED, complaining about the result and the appointment.
 *
 * This replaces bare neutral nouns in ISSUE taxonomies with phrases that carry
 * the complaint themselves. The rule for a hint, in either taxonomy: on its
 * own, it must mean the thing the bucket claims.
 *
 * Run with: node scripts/clean-issue-hints.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packs');

/**
 * pack -> theme -> { drop: hints to remove, add: complaint phrases to add }.
 * Anything not listed is already phrase-shaped and stays as it is.
 */
const EDITS = {
  clinic: {
    appointment_scheduling: {
      drop: ['appointment', 'booking', 'slot', 'cancel'],
      add: [
        'appointment was cancelled', 'appointment cancelled', 'cancelled my appointment',
        'cancelled without', 'no slot', 'slot not available', 'no appointment available',
        'could not get an appointment', "couldn't get an appointment", 'booking problem',
      ],
    },
    billing_clarity: {
      drop: ['bill', 'billing', 'charge', 'charged', 'paisa', 'paise'],
      add: [
        'wrong bill', 'bill was wrong', 'billing error', 'extra charge', 'charged extra',
        'charged more', 'unexpected bill', 'bill zyada', 'extra paise',
      ],
    },
    staff_behaviour: {
      drop: ['behaviour', 'behavior', 'reception', 'staff'],
      add: [
        'bad behaviour', 'bad behavior', 'rude behaviour', 'poor behaviour',
        'staff was rude', 'staff were rude', 'staff are rude', 'reception was rude',
        'receptionist was rude', 'shrugged', 'no one at the desk', 'nobody at the desk',
      ],
    },
    cleanliness: {
      drop: ['hygiene', 'washroom', 'toilet', 'safai'],
      add: [
        'poor hygiene', 'no hygiene', 'bad hygiene', 'hygiene issue',
        'dirty washroom', 'washroom was dirty', 'washroom not clean',
        'toilet was dirty', 'toilet not clean', 'safai nahi',
      ],
    },
    followup_communication: {
      drop: ['report', 'follow up', 'followup', 'test result'],
      add: [
        'no report', 'report not', 'report was delayed', 'still waiting for the report',
        'no follow up', 'never followed up', 'no followup', 'test result not',
      ],
    },
    parking_access: {
      drop: ['parking', 'park', 'stairs', 'gaadi'],
      add: [
        'no parking', 'parking problem', 'nowhere to park', 'hard to park',
        'parking nahi', 'too many stairs', 'only stairs', 'gaadi kahan',
      ],
    },
  },

  salon: {
    service_result: {
      drop: ['haircut', 'colour', 'color'],
      add: [
        'bad haircut', 'haircut was bad', 'ruined my hair', 'hair was ruined',
        'colour was wrong', 'color was wrong', 'colour came out', 'not what i wanted',
      ],
    },
    appointment_scheduling: {
      // "waited" belongs to wait_time; keeping it here double-counted every
      // late appointment as two separate complaints.
      drop: ['appointment', 'booking', 'slot', 'waiting', 'waited', 'late', 'der'],
      add: [
        'appointment was cancelled', 'cancelled my appointment', 'past my appointment',
        'late for my appointment', 'booking problem', 'no slot', 'slot not available',
        'could not get an appointment',
      ],
    },
    pricing_transparency: {
      drop: ['price', 'bill', 'paise', 'quoted'],
      add: [
        'than quoted', 'than the price quoted', 'price was different', 'price changed',
        'charged extra', 'extra charge', 'wrong bill', 'extra paise',
      ],
    },
    staff_behaviour: {
      drop: ['behaviour', 'behavior'],
      add: [
        'bad behaviour', 'bad behavior', 'rude behaviour',
        'staff was rude', 'staff were rude', 'staff are rude',
      ],
    },
    hygiene: {
      drop: ['towel', 'hygiene', 'safai'],
      add: [
        'dirty towel', 'same towel', 'towel was not', 'poor hygiene', 'no hygiene',
        'hygiene issue', 'safai nahi',
      ],
    },
    upselling_pressure: {
      drop: ['sell', 'package', 'membership'],
      add: [
        'tried to sell', 'kept trying to sell', 'sell me', 'pushed a package',
        'forced package', 'pushed membership', 'membership pushed',
      ],
    },
    product_quality: {
      drop: ['product', 'brand'],
      add: [
        'cheap products', 'duplicate product', 'expired product', 'product was bad',
        'local product', 'fake product', 'cheap brand',
      ],
    },
    cleanliness_space: {
      drop: ['washroom', 'toilet'],
      add: [
        'dirty washroom', 'washroom was dirty', 'washroom not clean',
        'toilet was dirty', 'toilet not clean',
      ],
    },
  },

  restaurant: {
    food_quality: {
      drop: ['taste', 'quality', 'swad', 'khana'],
      add: [
        'no taste', 'poor quality', 'bad quality', 'quality was bad', 'quality has gone',
        'khana bekar', 'khana thanda', 'swad nahi', 'khane mein',
      ],
    },
    staff_behaviour: {
      drop: ['waiter', 'server'],
      add: [
        'waiter was rude', 'rude waiter', 'waiter forgot', 'waiter did not',
        "waiter didn't", 'waiter ignored', 'server was rude', 'no one came to the table',
      ],
    },
    cleanliness: {
      drop: ['hygiene', 'washroom', 'toilet', 'safai', 'fly'],
      add: [
        'poor hygiene', 'no hygiene', 'hygiene issue', 'dirty washroom',
        'washroom was dirty', 'toilet was dirty', 'safai nahi', 'a fly in',
      ],
    },
    pricing_value: {
      // "value for money" is how people praise a place, not complain about it.
      drop: ['charge', 'paise', 'value for money'],
      add: [
        'not value for money', 'no value for money', 'extra charge', 'charged extra',
        'service charge added', 'overcharged', 'paise waste',
      ],
    },
    wait_for_table: {
      drop: ['full', 'reservation'],
      add: [
        'table not available', 'had to wait for a table', 'no reservation',
        'reservation was not', 'despite the reservation',
      ],
    },
    ambience_noise: {
      drop: ['music', 'seating', 'hot'],
      add: [
        'loud music', 'music was too loud', 'cramped seating', 'seating was cramped',
        'uncomfortable seating', 'too hot inside', 'no ac',
      ],
    },
    delivery_packaging: {
      drop: ['delivery', 'packaging', 'packing', 'parcel', 'swiggy', 'zomato'],
      add: [
        'delivery was late', 'late delivery', 'delivery delayed', 'poor packaging',
        'bad packaging', 'packaging was', 'packing was bad', 'parcel was',
      ],
    },
    billing_issue: {
      drop: ['bill', 'billing'],
      add: [
        'wrong bill', 'bill was wrong', 'billing error', 'added to the bill',
        'extra in the bill',
      ],
    },
  },

  gym: {
    equipment_condition: {
      drop: ['equipment', 'treadmill', 'dumbbell', 'maintenance', 'repair'],
      add: [
        'broken equipment', 'equipment is broken', 'equipment not working',
        'treadmill not working', 'treadmill was broken', 'dumbbells missing',
        'needs maintenance', 'no maintenance', 'never repaired', 'not repaired',
      ],
    },
    crowding: {
      drop: ['peak hour', 'rush'],
      add: ['crowded at peak', 'too crowded', 'rush at peak'],
    },
    trainer_availability: {
      drop: ['trainer', 'coach', 'personal training'],
      add: [
        'trainer was not', 'trainer never', 'no coach', 'trainer ignored',
        'no one to guide', 'trainer nahi', 'no personal training',
      ],
    },
    cleanliness: {
      drop: ['washroom', 'toilet', 'changing room', 'shower', 'hygiene', 'sweat', 'safai'],
      add: [
        'dirty washroom', 'washroom was dirty', 'toilet was dirty',
        'changing room was dirty', 'dirty changing room', 'shower not working',
        'poor hygiene', 'no hygiene', 'smells of sweat', 'sweat smell', 'safai nahi',
      ],
    },
    membership_billing: {
      drop: ['membership', 'fees', 'charged', 'renewal', 'auto debit', 'cancel', 'paise'],
      add: [
        'no refund', 'refund not', 'charged again', 'charged extra',
        'auto debit without', 'renewed without asking', 'membership not cancelled',
        'cancelled but charged', 'paise wapas nahi',
      ],
    },
    ac_ventilation: {
      drop: ['hot', 'fan', 'ventilation'],
      add: [
        'too hot', 'very hot inside', 'fan not working', 'no fan',
        'no ventilation', 'poor ventilation',
      ],
    },
    staff_behaviour: {
      drop: ['staff', 'behaviour', 'behavior'],
      add: [
        'staff was rude', 'staff were rude', 'staff are rude',
        'bad behaviour', 'bad behavior', 'rude behaviour',
      ],
    },
    overcommitted_sales: {
      drop: ['sales', 'told me'],
      add: ['pushy sales', 'sales promise', 'promised but'],
    },
    class_schedule: {
      drop: ['class', 'schedule', 'zumba', 'yoga', 'batch'],
      add: [
        'class was cancelled', 'classes cancelled', 'class timing changed',
        'schedule keeps changing', 'zumba was cancelled', 'yoga class cancelled',
        'batch changed', 'no classes',
      ],
    },
    parking_access: {
      drop: ['parking', 'park', 'gaadi'],
      add: ['no parking', 'parking problem', 'nowhere to park', 'parking nahi'],
    },
  },

  coaching: {
    teaching_quality: {
      drop: ['teaching', 'teacher', 'faculty', 'doubt', 'concept', 'shikav'],
      add: [
        'poor teaching', 'teaching is not', 'teacher does not', 'teacher did not',
        'faculty is not', 'doubts not cleared', 'doubt not cleared',
        'concepts not clear', 'concept not clear', 'nahi shikav',
      ],
    },
    fee_transparency: {
      drop: ['fees', 'fee', 'paise'],
      add: [
        'fees increased', 'fee was increased', 'extra fees', 'no refund of fees',
        'fees wapas nahi',
      ],
    },
    communication_parents: {
      drop: ['communication', 'parent meeting'],
      add: [
        'poor communication', 'no communication', 'never informed the parents',
        'no parent meeting', 'parents were not informed',
      ],
    },
    results_claims: {
      drop: ['result', 'rank', 'selection'],
      add: [
        'no results', 'results did not', 'marks did not improve', 'no selection',
        'rank not', 'no rank',
      ],
    },
    facility_condition: {
      drop: ['classroom', 'fan', 'ac', 'seating', 'bench', 'washroom', 'toilet', 'hot'],
      add: [
        'classroom was dirty', 'small classroom', 'crowded classroom',
        'fan not working', 'no fan', 'ac not working', 'no ac', 'too hot',
        'seating is uncomfortable', 'broken bench', 'dirty washroom',
        'washroom was dirty', 'toilet was dirty',
      ],
    },
    study_material: {
      drop: ['material', 'notes', 'books', 'photocopy'],
      add: [
        'no material', 'material not provided', 'notes were not', 'poor notes',
        'books not provided', 'bad photocopy', 'photocopy quality',
      ],
    },
    safety_discipline: {
      drop: ['safety', 'discipline'],
      add: ['not safe', 'safety issue', 'no discipline', 'poor discipline'],
    },
  },

  real_estate: {
    hidden_charges: {
      drop: ['brokerage', 'commission', 'charges', 'paise'],
      add: [
        'extra brokerage', 'high brokerage', 'more brokerage', 'hidden commission',
        'extra charges', 'hidden charges', 'extra paise',
      ],
    },
    site_visit_experience: {
      drop: ['site visit', 'keys'],
      add: [
        'site visit was cancelled', 'no one came for the site visit', 'no keys',
        'keys were not', 'forgot the keys',
      ],
    },
    documentation_delay: {
      drop: ['agreement', 'documents', 'paperwork', 'registration', 'noc'],
      add: [
        'agreement was delayed', 'documents were delayed', 'paperwork is pending',
        'registration delayed', 'noc pending', 'still waiting for the documents',
      ],
    },
    pressure_tactics: {
      drop: ['urgent', 'token amount'],
      add: ['created urgency', 'token amount pressure'],
    },
    token_refund: {
      drop: ['token', 'advance', 'deposit', 'booking amount'],
      add: [
        'token not refunded', 'token amount not returned', 'advance not returned',
        'advance not refunded', 'deposit not returned', 'booking amount not returned',
      ],
    },
    professionalism: {
      drop: ['behaviour', 'behavior'],
      add: ['bad behaviour', 'bad behavior', 'rude behaviour'],
    },
    unclear_pricing: {
      drop: ['quoted', 'negotiat'],
      add: ['than quoted', 'quoted a different', 'different from the quoted'],
    },
  },

  wedding_vendor: {
    delivery_delay: {
      drop: ['album', 'months'],
      add: [
        'album not delivered', 'still waiting for the album', 'after months',
        'several months', 'many months',
      ],
    },
    quality_vs_sample: {
      drop: ['portfolio', 'quality'],
      add: [
        'not like the portfolio', 'different from the portfolio', 'poor quality',
        'quality was not', 'bad quality',
      ],
    },
    hidden_costs: {
      drop: ['additional', 'quotation', 'paise'],
      add: [
        'additional charge', 'additional cost', 'more than the quotation',
        'different from the quotation', 'extra paise',
      ],
    },
    professionalism: {
      drop: ['behaviour', 'behavior'],
      add: ['bad behaviour', 'bad behavior', 'rude behaviour'],
    },
    revisions_refused: {
      drop: ['revision', 'edit', 'changes', 'reject'],
      add: [
        'no revisions', 'revisions refused', 'refused to edit', 'refused any changes',
        'would not make changes', 'rejected our request',
      ],
    },
    advance_refund: {
      drop: ['advance', 'deposit', 'booking amount', 'cancelled'],
      add: [
        'advance not returned', 'advance not refunded', 'deposit not returned',
        'booking amount not returned', 'cancelled but no refund',
      ],
    },
  },
};

/**
 * The same pass for Devanagari hints. Marathi and Hindi reviews were hitting
 * issue buckets on neutral nouns too — "वेळ" (time), "बिल" (bill), "स्टाफ" —
 * and a bare noun could even be cancelled by its own negator, so "सफाई नाही"
 * ("no cleanliness") counted as nothing at all.
 */
const DEVANAGARI_EDITS = {
  clinic: {
    wait_time: {
      drop: ['वेळ', 'वाट'],
      add: ['वेळ जास्त', 'वेळ लागला', 'खूप वेळ', 'वाट पाहावी', 'वाट बघावी', 'उशीर झाला'],
    },
    appointment_scheduling: {
      drop: ['अपॉइंटमेंट', 'बुकिंग'],
      add: ['अपॉइंटमेंट मिळाली नाही', 'अपॉइंटमेंट रद्द', 'बुकिंग रद्द', 'अपॉइंटमेंट नाही'],
    },
    billing_clarity: {
      drop: ['बिल', 'पैसे', 'शुल्क'],
      add: ['बिल चुकीचे', 'बिल जास्त', 'जास्त बिल', 'पैसे जास्त घेतले', 'अतिरिक्त शुल्क'],
    },
    staff_behaviour: {
      drop: ['व्यवहार', 'वागणूक', 'स्टाफ'],
      add: ['वाईट वागणूक', 'उद्धट वागणूक', 'वाईट व्यवहार', 'स्टाफ उद्धट'],
    },
    cleanliness: {
      drop: ['सफाई', 'स्वच्छता'],
      add: ['सफाई नाही', 'सफाई नव्हती', 'स्वच्छता नाही'],
    },
    followup_communication: {
      drop: ['रिपोर्ट', 'फोन'],
      add: ['रिपोर्ट मिळाला नाही', 'रिपोर्ट उशीरा', 'फोन आला नाही'],
    },
    parking_access: {
      drop: ['पार्किंग', 'जागा', 'लिफ्ट', 'जिना'],
      add: ['पार्किंग नाही', 'पार्किंगची अडचण', 'जागा नाही', 'लिफ्ट नाही', 'फक्त जिना'],
    },
    phone_unreachable: {
      drop: ['संपर्क'],
      add: ['संपर्क होत नाही', 'संपर्क झाला नाही'],
    },
  },

  salon: {
    appointment_scheduling: {
      drop: ['अपॉइंटमेंट', 'वाट', 'उशीर', 'इंतजार'],
      add: ['अपॉइंटमेंट रद्द', 'अपॉइंटमेंट मिळाली नाही', 'बुकिंग रद्द'],
    },
    wait_time: {
      drop: ['वाट'],
      add: ['वाट पाहावी', 'वाट बघावी', 'वेळ जास्त', 'वेळ लागला', 'खूप वेळ', 'उशीर झाला'],
    },
    pricing_transparency: {
      drop: ['किंमत', 'दाम'],
      add: ['किंमत वेगळी', 'जास्त किंमत', 'सांगितलेली किंमत'],
    },
    staff_behaviour: {
      drop: ['व्यवहार', 'वागणूक'],
      add: ['वाईट वागणूक', 'उद्धट वागणूक', 'वाईट व्यवहार'],
    },
    hygiene: {
      drop: ['सफाई', 'स्वच्छता', 'टॉवेल'],
      add: ['सफाई नाही', 'स्वच्छता नाही', 'टॉवेल घाण', 'तोच टॉवेल'],
    },
    upselling_pressure: {
      drop: ['पॅकेज'],
      add: ['पॅकेज घ्यायला लावले', 'पॅकेजसाठी जबरदस्ती'],
    },
    product_quality: {
      drop: ['उत्पादन', 'प्रॉडक्ट'],
      add: ['प्रॉडक्ट खराब', 'स्वस्त प्रॉडक्ट', 'डुप्लिकेट प्रॉडक्ट'],
    },
  },

  restaurant: {
    food_quality: {
      drop: ['चव', 'स्वाद', 'खाना'],
      add: ['चव नाही', 'चव खराब', 'स्वाद नहीं', 'खाना खराब', 'खाना थंड'],
    },
    service_speed: {
      drop: ['वेळ'],
      add: ['वेळ जास्त', 'वेळ लागला', 'खूप वेळ'],
    },
    staff_behaviour: {
      drop: ['व्यवहार', 'वागणूक', 'वेटर'],
      add: ['वाईट वागणूक', 'उद्धट वागणूक', 'वेटर उद्धट'],
    },
    cleanliness: {
      drop: ['सफाई', 'स्वच्छता'],
      add: ['सफाई नाही', 'स्वच्छता नाही'],
    },
    pricing_value: {
      drop: ['किंमत', 'पैसे'],
      add: ['किंमत जास्त', 'पैसे वाया'],
    },
    wait_for_table: {
      drop: ['टेबल'],
      add: ['टेबल मिळाले नाही', 'टेबलसाठी वाट'],
    },
    ambience_noise: {
      drop: ['आवाज', 'जागा'],
      add: ['खूप आवाज', 'आवाज जास्त', 'जागा कमी'],
    },
    delivery_packaging: {
      drop: ['पार्सल', 'पॅकिंग', 'डिलिव्हरी', 'डिलीवरी'],
      add: ['पॅकिंग खराब', 'डिलिव्हरी उशीरा', 'पार्सल गळत'],
    },
    billing_issue: {
      drop: ['बिल', 'शुल्क'],
      add: ['बिल चुकीचे', 'जास्त बिल'],
    },
  },

  gym: {
    equipment_condition: {
      drop: ['मशीन'],
      add: ['मशीन खराब', 'मशीन बंद', 'मशीन तुटली'],
    },
    trainer_availability: {
      drop: ['ट्रेनर', 'मार्गदर्शन', 'कोच'],
      add: ['ट्रेनर नाही', 'ट्रेनर नसतो', 'मार्गदर्शन नाही', 'कोच नाही'],
    },
    cleanliness: {
      drop: ['सफाई', 'स्वच्छता'],
      add: ['सफाई नाही', 'स्वच्छता नाही'],
    },
    membership_billing: {
      drop: ['बिल', 'पैसे', 'फी'],
      add: ['पैसे परत नाही', 'फी जास्त', 'बिल चुकीचे'],
    },
    ac_ventilation: {
      drop: ['हवा', 'एसी'],
      add: ['एसी बंद', 'एसी चालत नाही', 'हवा नाही'],
    },
    staff_behaviour: {
      drop: ['व्यवहार', 'वागणूक'],
      add: ['वाईट वागणूक', 'उद्धट वागणूक'],
    },
    class_schedule: {
      drop: ['क्लास', 'वेळापत्रक', 'बॅच', 'समय'],
      add: ['क्लास रद्द', 'क्लास बंद', 'वेळापत्रक बदलले', 'बॅच बदलला', 'समय बदल'],
    },
    parking_access: {
      drop: ['पार्किंग', 'जागा', 'गाडी'],
      add: ['पार्किंग नाही', 'जागा नाही', 'गाडी लावायला जागा'],
    },
  },

  coaching: {
    teaching_quality: {
      drop: ['पढ़ाई', 'शिकवत', 'शिक्षक'],
      add: ['नीट शिकवत नाही', 'शिकवत नाही', 'शिक्षक नीट नाही', 'पढ़ाई अच्छी नहीं'],
    },
    faculty_turnover: { drop: ['फैकल्टी'], add: ['फैकल्टी बदल'] },
    batch_size: { drop: ['बॅच'], add: ['बॅच मोठा', 'बॅचमध्ये गर्दी'] },
    fee_transparency: {
      drop: ['फी', 'शुल्क', 'पैसे'],
      add: ['फी जास्त', 'फी वाढवली', 'अतिरिक्त शुल्क', 'पैसे परत नाही'],
    },
    communication_parents: {
      drop: ['संपर्क'],
      add: ['संपर्क नाही', 'पालकांना कळवले नाही'],
    },
    schedule_reliability: {
      drop: ['क्लास', 'वेळापत्रक'],
      add: ['क्लास रद्द', 'वेळापत्रक बदलले'],
    },
    results_claims: {
      drop: ['निकाल'],
      add: ['निकाल चांगला नाही', 'निकाल लागला नाही'],
    },
    facility_condition: {
      drop: ['वर्ग', 'बाक', 'पंखा', 'स्वच्छता'],
      add: ['वर्ग लहान', 'बाक तुटलेले', 'पंखा बंद', 'स्वच्छता नाही'],
    },
    study_material: {
      drop: ['साहित्य', 'नोट्स', 'पुस्तक', 'मटेरियल'],
      add: [
        'साहित्य मिळाले नाही',
        'नोट्स मिळाल्या नाहीत',
        'पुस्तक मिळाले नाही',
        'मटेरियल उशीरा',
      ],
    },
    safety_discipline: { drop: ['सुरक्षा'], add: ['सुरक्षा नाही', 'सुरक्षित नाही'] },
  },

  real_estate: {
    listing_accuracy: {
      drop: ['फोटो', 'वेगळे'],
      add: ['फोटो वेगळे', 'दाखवले तसे नाही'],
    },
    hidden_charges: {
      drop: ['दलाली', 'कमिशन', 'पैसे'],
      add: ['दलाली जास्त', 'जास्त कमिशन', 'जास्त पैसे मागितले'],
    },
    site_visit_experience: {
      drop: ['साइट', 'भेट'],
      add: ['साइट भेट रद्द', 'भेटीसाठी आले नाहीत'],
    },
    documentation_delay: {
      drop: ['कागदपत्र', 'करार', 'दस्तऐवज'],
      add: ['कागदपत्रे उशिरा', 'करार उशिरा', 'दस्तऐवज प्रलंबित'],
    },
    token_refund: {
      drop: ['टोकन', 'आगाऊ', 'परत'],
      add: ['टोकन परत नाही', 'आगाऊ रक्कम परत नाही', 'पैसे परत नाही'],
    },
    professionalism: {
      drop: ['व्यवहार', 'वागणूक'],
      add: ['वाईट वागणूक', 'उद्धट वागणूक'],
    },
    unclear_pricing: {
      drop: ['किंमत', 'कीमत'],
      add: ['किंमत बदलली', 'किंमत वेगळी'],
    },
  },

  wedding_vendor: {
    quality_vs_sample: {
      drop: ['गुणवत्ता', 'वेगळे', 'अपेक्षेपेक्षा'],
      add: [
        'गुणवत्ता कमी',
        'गुणवत्ता चांगली नाही',
        'अपेक्षेपेक्षा कमी',
        'दाखवले त्यापेक्षा वेगळे',
      ],
    },
    team_substitution: {
      drop: ['दुसरा'],
      add: ['दुसरा फोटोग्राफर', 'दुसरी टीम'],
    },
    communication: { drop: ['संपर्क'], add: ['संपर्क होत नाही'] },
    hidden_costs: { drop: ['अतिरिक्त'], add: ['अतिरिक्त शुल्क', 'अतिरिक्त पैसे'] },
    coverage_gaps: {
      drop: ['मिस', 'राहिले'],
      add: ['फोटो राहिले', 'क्षण राहिले', 'मिस झाले'],
    },
    professionalism: {
      drop: ['व्यवहार', 'वागणूक'],
      add: ['वाईट वागणूक', 'उद्धट वागणूक'],
    },
    revisions_refused: {
      drop: ['बदल', 'दुरुस्ती', 'संशोधन'],
      add: ['बदल करायला नकार', 'दुरुस्ती नाकारली', 'संशोधन नाकारले'],
    },
    advance_refund: {
      drop: ['आगाऊ', 'परत', 'रद्द'],
      add: ['आगाऊ रक्कम परत नाही', 'पैसे परत नाही', 'रद्द केल्यावर परत नाही'],
    },
  },
};

// Both passes have the same shape, so they merge and run through one loop.
for (const [pack, themes] of Object.entries(DEVANAGARI_EDITS)) {
  EDITS[pack] ??= {};
  for (const [key, edit] of Object.entries(themes)) {
    const existing = EDITS[pack][key];
    EDITS[pack][key] = existing
      ? { drop: [...existing.drop, ...edit.drop], add: [...existing.add, ...edit.add] }
      : edit;
  }
}

let changed = 0;

for (const [pack, themes] of Object.entries(EDITS)) {
  const file = join(packsDir, `${pack}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));

  for (const entry of data.issueTaxonomy ?? []) {
    const edit = themes[entry.key];
    if (!edit) continue;

    const drop = new Set(edit.drop.map((h) => h.toLowerCase()));
    const before = entry.hints.length;
    entry.hints = entry.hints.filter((h) => !drop.has(h.toLowerCase().trim()));
    for (const phrase of edit.add) {
      if (!entry.hints.some((h) => h.toLowerCase() === phrase)) entry.hints.push(phrase);
    }
    changed += 1;
    console.log(`${pack}/${entry.key}: ${before} -> ${entry.hints.length} hints`);
  }

  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log(`\nUpdated ${changed} issue themes across ${Object.keys(EDITS).length} packs.`);
