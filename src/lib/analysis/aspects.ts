import type { Pack } from '@/lib/packs';

/**
 * WHAT A CUSTOMER SAID ABOUT WHICH PART OF THE VISIT — polarity per aspect.
 *
 * The pack hints recognise PHRASES: "food was excellent", "staff were rude".
 * Customers do not write in the pack's phrases. They write "the paneer was
 * fantastic", "the price felt high", "the salon was not very clean" — a
 * THING (an anchor) and an OPINION about it (a polarity word) somewhere near
 * each other. This module reads exactly that, deterministically, and nothing
 * more.
 *
 *   1. The text is cut into clauses at punctuation and at contrast words —
 *      "but", "although", "lekin", "लेकिन" — because the opinion before a
 *      "but" is not the opinion after it.
 *   2. Within a clause, every opinion word is attached to the NEAREST anchor
 *      it may describe, at most MAX_DISTANCE words away. A generic word
 *      ("great", "छान") may describe any anchor that accepts generic words; an
 *      aspect's own words ("slow", "high", "dirty", "small") describe only that
 *      aspect.
 *   3. A negator shortly before the opinion ("not", "never", "not very"), or a
 *      Hindi/Marathi negator after it, flips praise into a complaint — "not
 *      very clean" is a cleanliness complaint. A negated COMPLAINT is dropped,
 *      never turned into praise: "not rude" is not a compliment anybody paid.
 *   4. The pack decides what the aspect is called: the restaurant's FOOD
 *      praise is `food_taste`, the clinic's STAFF complaint `staff_behaviour`.
 *      An aspect a vertical does not map says nothing for that vertical.
 *
 * IT ONLY ADDS. It never removes what the pack hints found and never decides
 * the overall sentiment; `normalize.ts` composes that from the union. When a
 * clause holds both praise and a complaint for the same aspect, it says
 * nothing for that aspect — unclear is left unclear.
 *
 * No model, no network, no clock. The same sentence always reads the same.
 */

export type AspectId =
  | 'OUTCOME'
  | 'OPTIONS'
  | 'PARKING'
  | 'PAPERWORK'
  | 'BILL'
  | 'COMMS'
  | 'SCHEDULE'
  | 'HYGIENE'
  | 'FOOD'
  | 'DRINK'
  | 'TEMP'
  | 'PORTION'
  | 'PRICE'
  | 'SPEED'
  | 'WAIT'
  | 'SERVICE'
  | 'STAFF'
  | 'DOCTOR'
  | 'TEACHER'
  | 'MATERIAL'
  | 'TRAINER'
  | 'EQUIPMENT'
  | 'FACILITY'
  | 'ATMOSPHERE'
  | 'CLEAN'
  | 'AMBIENCE'
  | 'NOISE'
  | 'RESULT'
  | 'OUTPUT'
  | 'TEAM';

type AspectDef = {
  /** Words that name this part of the visit. Lowercase; Latin words match whole, with a plural "s". */
  anchors: string[];
  /** This aspect's own opinion words, which describe nothing else. */
  positive: string[];
  negative: string[];
  /** Whether generic words — good, bad, छान, खराब — may describe this aspect. */
  generic: boolean;
  /**
   * When true, the aspect's own positive words need no anchor: "came quickly"
   * is about speed wherever it appears. Only for words that cannot be about
   * anything else.
   */
  selfAnchoredPositive?: string[];
  /**
   * Anchors only this aspect's own words may use. "A good place" is the
   * business as a whole; "a calm place" is its ambience.
   */
  ownWordsOnly?: string[];
  /** Generic words this aspect does not take, though it takes the rest. */
  notGeneric?: string[];
};

/** Words for how people behave. Said of "the service", they describe the staff. */
const MANNER_WORDS = ['friendly', 'polite', 'kind', 'was kind', 'were kind', 'is kind', 'are kind', 'very kind', 'so kind', 'caring', 'gentle', 'patient', 'warm', 'sweet'];

export const GENERIC_POSITIVE = [
  // "kind of" is masked before reading, so "kind" left over is kindness.
  'kind', 'was kind', 'were kind', 'is kind', 'are kind', 'very kind', 'so kind',
  'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful', 'superb', 'lovely',
  'nice', 'best', 'perfect', 'outstanding', 'brilliant', 'loved', 'love', 'liked', 'enjoyed', 'fabulous',
  'beautiful', 'thorough', 'gentle', 'caring', 'patient', 'helpful', 'friendly', 'polite',
  'breathtaking', 'incredible', 'gorgeous',
  'accha', 'acha', 'achha', 'acche', 'achhe', 'achchha', 'badhiya', 'mast', 'zabardast', 'shandar', 'sundar',
  'chhan', 'chan', 'changla', 'changle', 'bhari', 'jhakas', 'zakas', 'lajawab',
  'अच्छा', 'अच्छे', 'अच्छी', 'बढ़िया', 'शानदार', 'छान', 'चांगले', 'चांगला', 'चांगली', 'उत्तम', 'सुंदर', 'मस्त',
];

export const GENERIC_NEGATIVE = [
  'complaint', 'bad', 'poor', 'boring', 'chewy', 'soggy', 'rubbery', 'greasy', 'cramped', 'dusty', 'confusing', 'torn',
  'sluggish', 'squeaky', 'squeaks', 'wobbly', 'wobbles', 'shrank', 'shrunk', 'rushed through', 'patchy', 'terrible', 'awful', 'horrible', 'worst', 'pathetic', 'disappointing', 'useless',
  'mediocre', 'disgusting', 'downhill', 'chaos', 'chaotic', 'nightmare', 'shoddy', 'sloppy', 'bekar', 'bekaar', 'kharab', 'bura', 'faltu',
  'बेकार', 'खराब', 'बुरा', 'वाईट',
];

const ASPECTS: Record<AspectId, AspectDef> = {
  OUTCOME: {
    anchors: ['pain', 'symptoms', 'problem', 'infection', 'cough', 'fever', 'swelling', 'allergy', 'treatment', 'medicine', 'medicines'],
    positive: ['gone', 'went away', 'better', 'cured', 'healed', 'improved', 'worked'],
    negative: ['came back', 'returned', 'worse', 'persists', 'still there', 'no difference', 'not better'],
    generic: false,
  },
  OPTIONS: {
    anchors: ['flats', 'flat', 'options', 'properties', 'property', 'homes', 'apartments', 'apartment'],
    positive: ['lovely', 'good', 'great', 'nice', 'beautiful', 'excellent', 'perfect', 'shortlisted'],
    negative: [],
    generic: false,
  },
  PAPERWORK: {
    anchors: ['documentation', 'documents', 'paperwork', 'papers', 'registration', 'sale deed', 'agreement', 'noc', 'loan process'],
    positive: ['smooth', 'quick', 'fast', 'seamless', 'sorted', 'hassle-free'],
    negative: ['forever', 'delayed', 'pending', 'slow', 'stuck', 'longer', 'ages'],
    generic: true,
  },
  BILL: {
    anchors: ['bill', 'billing', 'invoice', 'receipt', 'बिल'],
    positive: ['clear', 'transparent', 'itemised', 'itemized'],
    negative: ['mistake', 'mistakes', 'galti', 'wrong', 'error', 'errors', 'incorrect', 'extra', 'overcharged', 'inflated', 'गलती'],
    generic: false,
  },
  COMMS: {
    anchors: ['communication', 'coordination', 'updates', 'update', 'replies', 'reply', 'response', 'responses', 'follow up', 'follow-up', 'followup'],
    positive: ['regular', 'prompt', 'clear', 'timely', 'quick', 'constant'],
    negative: ['silent', 'slow', 'lacking', 'zero', 'nil', 'missing', 'late'],
    generic: true,
  },
  SCHEDULE: {
    anchors: ['timing', 'timings', 'schedule', 'schedules', 'batch timing', 'class timing', 'classes', 'class', 'lecture', 'lectures', 'sessions'],
    positive: ['flexible', 'convenient', 'regular', 'fixed', 'consistent', 'punctual'],
    negative: ['changed', 'changing', 'cancelled', 'canceled', 'postponed', 'irregular', 'rescheduled'],
    generic: false,
  },
  HYGIENE: {
    anchors: [
      'towel', 'towels', 'tools', 'tool', 'combs', 'comb', 'scissors', 'razor', 'razors', 'brushes', 'sheets', 'strips',
      'instruments', 'linen', 'bedsheet', 'gloves', 'needles',
    ],
    positive: ['clean', 'fresh', 'sanitised', 'sanitized', 'sterilised', 'sterilized', 'disposable', 'new'],
    negative: ['dirty', 'rusty', 'reused', 'unsterilised', 'unsterilized', 'unhygienic', 'stained', 'गंदा', 'घाण'],
    generic: false,
  },
  PARKING: {
    anchors: ['parking', 'parking space', 'parking spot', 'parking spots', 'parking lot'],
    positive: ['easy', 'ample', 'plenty', 'available', 'convenient'],
    negative: ['impossible', 'difficult', 'limited', 'hard', 'tough', 'nightmare', 'terrible', 'hopeless'],
    generic: true,
  },
  FOOD: {
    anchors: [
      'food', 'dish', 'meal', 'khana', 'khaana', 'jevan', 'biryani', 'dal', 'paneer', 'thali', 'dosa', 'idli',
      'curry', 'starter', 'dessert', 'snack', 'pizza', 'burger', 'rice', 'roti', 'naan',
      'soup', 'sandwich', 'mains', 'breakfast', 'lunch', 'dinner', 'menu', 'taste', 'flavour', 'flavor',
      // What a café serves
      'pasta', 'waffle', 'pancake', 'croissant', 'cake', 'cheesecake', 'brownie', 'cookie', 'muffin', 'bagel', 'wrap',
      'salad', 'fries', 'nachos', 'toast', 'eggs', 'omelette', 'maggi', 'misal', 'poha', 'upma', 'vada pav', 'pav bhaji',
      'frankie', 'momos', 'noodles', 'pastry', 'pastries', 'bun', 'maska', 'bread', 'quiche', 'tacos', 'burrito', 'paratha',
      'bakery', 'dessert', 'desserts', 'bites', 'platter',
      'खाना', 'जेवण', 'भोजन',
    ],
    positive: ['delicious', 'tasty', 'yummy', 'fresh', 'flavourful', 'flavorful', 'authentic', 'jhanjhanit', 'चमचमीत', 'स्वादिष्ट', 'चवदार'],
    negative: ['bland', 'stale', 'tasteless', 'oily', 'burnt', 'undercooked', 'overcooked', 'karpla', 'karapla', 'karpat', 'jalleli', 'jalla', 'jala hua', 'करपला', 'करपलेला', 'जळलेला', 'बेचव', 'बासी',
      'kadak', 'juna', 'juni', 'shila', 'shilla', 'over toasted', 'overtoasted', 'nearly black', 'शिळा', 'शिळे', 'जुना'],
    generic: true,
  },
  /**
   * Coffee, tea and every other drink: a café's own product, judged apart
   * from the food (café handover pass). "Cold coffee", "iced tea" and
   * "cold brew" are drinks, not temperatures: their adjective is masked
   * before reading (classify.ts), so the noun still names the drink.
   */
  DRINK: {
    anchors: [
      'coffee', 'cappuccino', 'latte', 'espresso', 'americano', 'mocha', 'macchiato', 'flat white', 'frappe', 'frappuccino',
      'brew', 'cortado', 'filter coffee', 'chai', 'tea', 'shake', 'milkshake', 'smoothie', 'juice', 'lemonade', 'mojito',
      'drink', 'beverage', 'hot chocolate', 'kaapi', 'कॉफी', 'कॉफ़ी', 'चहा', 'चाय',
      // as phones spell them
      'capucino', 'cappucino', 'capuccino', 'cappuchino', 'expresso', 'coffe', 'cofee', 'cofe', 'kofi', 'chaai', 'chay', 'chaha',
    ],
    positive: ['smooth', 'aromatic', 'refreshing', 'creamy', 'perfectly brewed', 'well brewed', 'kadak', 'कडक'],
    negative: ['watery', 'weak', 'bitter', 'burnt', 'sour', 'diluted', 'too sweet', 'too strong', 'too milky', 'bland', 'kadu', 'panchat', 'jalleli', 'कडू', 'पाणचट', 'जळलेली', 'chipchipa',
      'zyada meethi', 'jyada meethi', 'zyada meetha', 'jyada meetha', 'bahut meethi', 'too much sugar', 'patli', 'patla', 'paani jaisi', 'pani jaisi'],
    generic: true,
  },
  /**
   * Served too cold. Its anchors are the food and the drinks; its words are
   * temperatures. "Not hot" is a complaint by the ordinary negation rule;
   * "hot" on its own files nothing, as no praise topic is mapped to it.
   */
  TEMP: {
    anchors: [
      'food', 'dish', 'meal', 'khana', 'khaana', 'jevan', 'pizza', 'burger', 'sandwich', 'soup', 'fries', 'rice', 'dosa',
      'snack', 'mains', 'starter', 'breakfast', 'toast', 'paratha', 'maggi', 'misal', 'poha', 'pasta', 'noodles',
      'coffee', 'cappuccino', 'latte', 'espresso', 'americano', 'mocha', 'chai', 'chaha', 'tea', 'kaapi', 'hot chocolate',
      'खाना', 'जेवण', 'कॉफी', 'कॉफ़ी', 'चहा', 'चाय',
    ],
    positive: ['hot', 'piping hot', 'steaming', 'garam', 'गरम'],
    negative: [
      'cold', 'lukewarm', 'luke warm', 'luke wrm', 'room temperature', 'room temp', 'thanda', 'thandi', 'thande', 'thand', 'gaar',
      'थंड', 'ठंडा', 'ठंडी', 'ठंडे', 'गार',
    ],
    generic: false,
  },
  PORTION: {
    anchors: ['portion', 'quantity', 'serving', 'qty'],
    positive: ['generous', 'large', 'big', 'filling', 'enough', 'huge', 'sufficient', 'bharpur', 'भरपूर'],
    negative: ['small', 'tiny', 'less', 'skimpy', 'little', 'kam', 'kami', 'कम', 'कमी', 'insufficient'],
    generic: false,
  },
  PRICE: {
    anchors: ['price', 'pricing', 'rate', 'cost', 'fee', 'charge', 'brokerage', 'commission', 'package', 'किंमत', 'दर', 'फी', 'फीस', 'भाव', 'दलाली'],
    positive: ['reasonable', 'fair', 'affordable', 'cheap', 'worth', 'वाजवी', 'किफायती'],
    negative: [
      'high', 'higher', 'steep', 'expensive', 'costly', 'pricey', 'overpriced', 'went up', 'increased', 'hiked', 'rising', 'going up',
      'जास्त', 'महाग', 'महंगा', 'ज़्यादा', 'ज्यादा', 'mehnga', 'zyada', 'jyada',
    ],
    generic: false,
  },
  SPEED: {
    anchors: ['service', 'order', 'bill', 'delivery', 'सर्व्हिस', 'सर्विस', 'सेवा'],
    positive: ['quick', 'quickly', 'fast', 'prompt', 'promptly', 'speedy', 'patkan', 'lavkar', 'jaldi', 'fatafat', 'jhatpat', 'लगेच', 'पटकन'],
    negative: ['slow', 'slowly', 'delayed', 'forever', 'ages', 'हळू', 'धीमी', 'धीमा'],
    generic: false,
    selfAnchoredPositive: ['quickly', 'promptly'],
  },
  WAIT: {
    anchors: ['wait', 'waiting', 'waiting time', 'wait time'],
    positive: ['short', 'quick', 'minimal'],
    negative: [
      'long', 'endless', 'forever', 'terrible', 'horrible', 'awful', 'ridiculous', 'unbearable', 'insane', 'crazy',
      'too much', 'way too long', 'zyada', 'jyada', 'jast', 'jaast', 'ज़्यादा', 'ज्यादा', 'जास्त',
    ],
    generic: false,
  },
  SERVICE: {
    anchors: ['service', 'सेवा'],
    positive: ['attentive', 'courteous'],
    negative: [],
    generic: true,
    // "The service was friendly" is about the people's manner, not how the
    // service ran: those words go to STAFF (which reads "service" for them).
    notGeneric: MANNER_WORDS,
  },
  STAFF: {
    anchors: [
      'staff', 'waiter', 'waitress', 'server', 'manager', 'receptionist', 'reception', 'nurse', 'people', 'owner',
      'chef', 'barista', 'cook', 'bartender', 'cashier', 'स्टाफ', 'service',
    ],
    ownWordsOnly: ['service'],
    positive: ['welcoming', 'courteous', 'warm', 'sweet', 'attentive', 'friendly', 'polite', 'kind', 'gode', 'गोड'],
    negative: [
      'rude', 'arrogant', 'dismissive', 'unprofessional', 'unhelpful', 'careless', 'badtameez', 'उद्धट', 'बदतमीज',
      'argued', 'shouted', 'yelled', 'ignored', 'ignoring', 'misbehaved', 'cold', 'curt', 'abrupt', 'condescending', 'snobbish', 'indifferent',
      'urmat', 'urmatpane', 'उर्मट', 'उर्मटपणे', 'उर्मटपणाने',
    ],
    generic: true,
  },
  DOCTOR: {
    anchors: ['doctor', 'dr', 'doc', 'physician', 'dentist', 'डॉक्टर'],
    positive: ['thorough', 'experienced', 'knowledgeable', 'explain', 'explains', 'explained', 'listens', 'listened', 'takes time'],
    negative: [],
    generic: true,
  },
  TEACHER: {
    anchors: ['teacher', 'teaching', 'faculty', 'tutor', 'sir', 'madam', 'maam', 'शिक्षक'],
    positive: ['clear', 'clearly', 'supportive', 'dedicated', 'patiently'],
    negative: ['boring', 'confusing', 'unclear'],
    generic: true,
  },
  MATERIAL: {
    anchors: ['notes', 'material', 'books', 'test series', 'worksheets'],
    positive: ['prepared', 'useful'],
    negative: ['late', 'delayed', 'outdated'],
    generic: true,
  },
  TRAINER: {
    anchors: ['trainer', 'coach', 'instructor', 'ट्रेनर'],
    positive: ['knowledgeable', 'motivating', 'supportive'],
    negative: [],
    generic: true,
  },
  EQUIPMENT: {
    anchors: ['equipment', 'machine', 'machines', 'treadmill', 'weights', 'dumbbell', 'bike', 'bikes', 'cycles', 'rower', 'मशीन'],
    positive: ['new', 'modern', 'maintained'],
    negative: ['broken', 'broke', 'old', 'faulty', 'rusty', 'kharab', 'खराब', 'not working', 'stopped working', 'never works', 'out of order'],
    generic: true,
  },
  FACILITY: {
    anchors: ['ac', 'fan', 'ventilation', 'air conditioning', 'classroom', 'bench', 'room', 'lift', 'elevator', 'building', 'stairs', 'lights', 'projector'],
    positive: [],
    negative: [
      'hot', 'stuffy', 'suffocating', 'cramped', 'broken', 'not working', 'never works', 'does not work', "doesn't work",
      "wasn't working", 'was not working', "isn't working", "didn't work", 'did not work', 'stopped working',
    ],
    generic: false,
  },
  ATMOSPHERE: {
    anchors: ['atmosphere', 'vibe', 'energy', 'crowd', 'community'],
    positive: ['motivating'],
    negative: [],
    generic: true,
  },
  CLEAN: {
    anchors: [
      'place', 'washroom', 'toilet', 'restroom', 'bathroom', 'floor', 'table', 'room', 'clinic', 'gym', 'salon',
      'kitchen', 'premises', 'locker room', 'changing room', 'classroom', 'showers', 'shower', 'chairs',
    ],
    positive: ['clean', 'spotless', 'neat', 'hygienic', 'tidy', 'maintained', 'well maintained', 'स्वच्छ', 'साफ'],
    negative: ['dirty', 'filthy', 'unclean', 'smelly', 'smells', 'smelled', 'stinks', 'damp', 'musty', 'messy', 'unhygienic', 'घाण', 'गंदा', 'अस्वच्छ'],
    generic: false,
  },
  AMBIENCE: {
    anchors: ['ambience', 'ambiance', 'atmosphere', 'vibe', 'decor', 'interior', 'seating', 'place'],
    positive: ['cosy', 'cozy', 'relaxing', 'peaceful', 'calm', 'beautiful', 'gorgeous', 'stunning', 'pretty'],
    negative: [],
    generic: true,
    ownWordsOnly: ['place'],
  },
  NOISE: {
    anchors: ['music', 'noise', 'sound'],
    positive: [],
    negative: ['loud', 'noisy', 'deafening'],
    generic: false,
  },
  RESULT: {
    anchors: [
      'haircut', 'cut', 'hair', 'colour', 'color', 'facial', 'styling', 'makeup', 'massage', 'treatment',
      'manicure', 'pedicure', 'blow dry', 'stylist', 'look', 'highlights', 'streaks', 'perm', 'keratin', 'smoothening',
      'rebonding', 'nails', 'nail', 'gel', 'केस', 'बाल',
    ],
    positive: ['exactly right', 'spot on', 'neat', 'sharp', 'clean'],
    negative: ['uneven', 'patchy', 'ruined', 'botched', 'damaged', 'brassy', 'faded', 'chipped', 'chipping', 'peeled', 'peeling', 'lifted'],
    generic: true,
  },
  OUTPUT: {
    anchors: [
      'photos', 'photo', 'pictures', 'pics', 'shots', 'candids', 'candid', 'frames', 'album', 'video', 'film', 'reel',
      'coverage', 'portraits', 'portrait',
      'teaser', 'decor', 'decoration', 'setup', 'work', 'फोटो', 'अल्बम',
    ],
    positive: ['stunning', 'gorgeous', 'breathtaking', 'magical'],
    negative: ['blurry', 'dull', 'dark', 'grainy', 'out of focus', 'washed out'],
    generic: true,
  },
  TEAM: {
    anchors: ['team', 'photographer', 'crew', 'coordinator', 'staff'],
    positive: ['professional', 'calm', 'organised', 'organized'],
    negative: ['rude', 'unprofessional', 'arrogant'],
    generic: true,
  },
};

type Mapping = { praise?: string; issue?: string };

/**
 * WHICH TOPIC EACH ASPECT IS, VERTICAL BY VERTICAL.
 *
 * Only where the pack has a topic that honestly IS that aspect. A clinic has
 * no praise topic for "the service was good", so SERVICE is not mapped there
 * and a clinic comment saying so adds nothing — it is not squeezed into the
 * nearest-sounding topic.
 */
const PACK_ASPECTS: Record<string, Partial<Record<AspectId, Mapping>>> = {
  restaurant: {
    FOOD: { praise: 'food_taste', issue: 'food_quality' },
    DRINK: { praise: 'drink_praise', issue: 'drink_quality' },
    TEMP: { issue: 'served_cold' },
    PORTION: { praise: 'generous_portions', issue: 'portion_size' },
    PRICE: { praise: 'value_for_money', issue: 'pricing_value' },
    SPEED: { praise: 'service_quality', issue: 'service_speed' },
    WAIT: { issue: 'service_speed' },
    SERVICE: { praise: 'service_quality' },
    STAFF: { praise: 'staff_warmth', issue: 'staff_behaviour' },
    CLEAN: { praise: 'cleanliness_praise', issue: 'cleanliness' },
    AMBIENCE: { praise: 'ambience' },
    NOISE: { issue: 'ambience_noise' },
    BILL: { issue: 'billing_issue' },
    // The pack files a broken AC or a stuffy room under ambience / seating.
    FACILITY: { issue: 'ambience_noise' },
  },
  clinic: {
    OUTCOME: { praise: 'good_outcome', issue: 'treatment_outcome' },
    PARKING: { issue: 'parking_access' },
    BILL: { issue: 'billing_clarity' },
    COMMS: { issue: 'followup_communication' },
    HYGIENE: { praise: 'clean_facility', issue: 'cleanliness' },
    DOCTOR: { praise: 'doctor_care' },
    STAFF: { praise: 'staff_friendly', issue: 'staff_behaviour' },
    CLEAN: { praise: 'clean_facility', issue: 'cleanliness' },
    PRICE: { praise: 'fair_pricing', issue: 'billing_clarity' },
    WAIT: { praise: 'short_wait', issue: 'wait_time' },
  },
  coaching: {
    SCHEDULE: { praise: 'discipline', issue: 'schedule_reliability' },
    COMMS: { issue: 'communication_parents' },
    TEACHER: { praise: 'teaching_quality_praise', issue: 'teaching_quality' },
    PRICE: { praise: 'fee_value', issue: 'fee_transparency' },
    MATERIAL: { praise: 'study_material_praise', issue: 'study_material' },
    FACILITY: { issue: 'facility_condition' },
    CLEAN: { issue: 'facility_condition' },
  },
  gym: {
    PARKING: { issue: 'parking_access' },
    SCHEDULE: { praise: 'timings', issue: 'class_schedule' },
    HYGIENE: { praise: 'cleanliness_praise', issue: 'cleanliness' },
    TRAINER: { praise: 'trainer_quality' },
    EQUIPMENT: { praise: 'equipment_quality', issue: 'equipment_condition' },
    CLEAN: { praise: 'cleanliness_praise', issue: 'cleanliness' },
    PRICE: { praise: 'value_pricing' },
    FACILITY: { issue: 'ac_ventilation' },
    ATMOSPHERE: { praise: 'atmosphere' },
    STAFF: { issue: 'staff_behaviour' },
  },
  real_estate: {
    OPTIONS: { praise: 'options_shown' },
    PRICE: { praise: 'fair_brokerage', issue: 'hidden_charges' },
    PAPERWORK: { praise: 'paperwork_help', issue: 'documentation_delay' },
    COMMS: { praise: 'responsiveness_praise', issue: 'responsiveness' },
  },
  salon: {
    HYGIENE: { praise: 'hygiene_praise', issue: 'hygiene' },
    RESULT: { praise: 'stylist_skill', issue: 'service_result' },
    STAFF: { praise: 'staff_warmth', issue: 'staff_behaviour' },
    CLEAN: { praise: 'hygiene_praise', issue: 'cleanliness_space' },
    PRICE: { praise: 'value_pricing', issue: 'pricing_transparency' },
    WAIT: { praise: 'punctuality', issue: 'wait_time' },
    AMBIENCE: { praise: 'ambience' },
  },
  wedding_vendor: {
    COMMS: { praise: 'communication_praise', issue: 'communication' },
    OUTPUT: { praise: 'output_quality', issue: 'quality_vs_sample' },
    TEAM: { praise: 'team_conduct', issue: 'professionalism' },
    PRICE: { praise: 'value_pricing' },
  },
};

/**
 * Which aspects can file each topic in a vertical, with their words. Read
 * only, for the taxonomy audit document; the reader itself uses the tables
 * above directly.
 */
export function aspectRoutes(packId: string): Array<{
  aspect: AspectId;
  topic: string;
  kind: 'PRAISE' | 'ISSUE';
  anchors: string[];
  opinion: string[];
  generic: boolean;
}> {
  const mapping = PACK_ASPECTS[packId] ?? {};
  const out: ReturnType<typeof aspectRoutes> = [];
  for (const [id, map] of Object.entries(mapping) as Array<[AspectId, Mapping]>) {
    const def = ASPECTS[id];
    if (map.praise) out.push({ aspect: id, topic: map.praise, kind: 'PRAISE', anchors: def.anchors, opinion: def.positive, generic: def.generic });
    if (map.issue) out.push({ aspect: id, topic: map.issue, kind: 'ISSUE', anchors: def.anchors, opinion: def.negative, generic: def.generic });
  }
  return out;
}

/**
 * Every single-word anchor in a vertical: the words that name a thing.
 * Used by the scope reader, which keeps the thing and drops the old opinion
 * when a sentence moves from then to now.
 */
export function anchorWords(packId: string): Set<string> {
  const out = new Set<string>();
  for (const id of Object.keys(PACK_ASPECTS[packId] ?? {}) as AspectId[]) {
    for (const a of ASPECTS[id].anchors) for (const w of a.split(/\s+/)) out.add(w);
  }
  return out;
}

/** An opinion word this many words from its anchor, or nearer. */
export const MAX_DISTANCE = 5;

const PRE_NEGATION = new Set([
  'not', 'no', 'never', 'hardly', 'barely', 'nahi', 'nahin', 'nai', "didn't", 'didnt', "wasn't", 'wasnt',
  "isn't", 'isnt', "aren't", 'arent', "weren't", 'werent', 'wernt', 'dint', "doesn't", 'doesnt', "don't", 'dont', "won't", 'wont',
  "couldn't", 'couldnt', 'without', 'nobody', 'none', 'bina', 'binaa', 'bagair', 'baghair',
]);
const POST_NEGATION = new Set([
  'नाही', 'नहीं', 'नही', 'nahi', 'nahin', 'nai', 'नव्हते', 'नव्हता', 'नव्हती', 'नव्हतं', 'नव्हत्या', 'नाहीये', 'नाहीत',
  'navhta', 'navhti', 'navhte', 'navhata', 'navhati', 'nahiye', 'nahit', 'nasta', 'nasto',
]);
/** Words a negator may sit across: "not VERY clean", "not THAT good", "no ONE helped". */
const DEGREE = new Set([
  'very', 'so', 'too', 'that', 'really', 'quite', 'particularly', 'much', 'at', 'all', 'even', 'bahut', 'khup', 'खूप', 'बहुत',
  'the', 'a', 'an',
  // "no ONE helped": the negator is the pair.
  'one',
]);

/**
 * Contrast words and punctuation that end one opinion and start another.
 * Marathi "पण" is deliberately absent: it means "but" and also "too"
 * ("सेवा पण छान" is "the service was nice TOO"), and splitting on it would cut
 * that sentence in half. Proximity carries it instead.
 */
const CLAUSE_SPLIT = /[.!?;,\n।]+|\b(?:but|though|although|however|while|whereas|lekin|magar|par|except)\b|\s(?:लेकिन|मगर|परंतु|पर)\s/giu;

/**
 * WHICH THINGS A CLAUSE NAMES (the entity guard). For the clause of `text`
 * around `index`: the topics of every aspect whose thing is named in it, and
 * whether any thing is named at all. A hint that names no thing ("was kind",
 * "gentle") must not file a topic about one thing when its clause names a
 * different one ("the receptionist was kind" is not about the doctor).
 */
export function namedInClause(text: string, index: number, packId: string): { topics: Set<string>; anyThing: boolean } {
  const re = new RegExp(CLAUSE_SPLIT.source, 'giu');
  let start = 0;
  let end = text.length;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index + m[0].length <= index) start = m.index + m[0].length;
    else if (m.index >= index) {
      end = m.index;
      break;
    }
  }
  const toks = tokens(text.slice(start, end));
  const topics = new Set<string>();
  let anyThing = false;
  for (const [id, map] of Object.entries(PACK_ASPECTS[packId] ?? {}) as Array<[AspectId, Mapping]>) {
    if (!ASPECTS[id].anchors.some((a) => positions(toks, a).length > 0)) continue;
    anyThing = true;
    if (map.praise) topics.add(map.praise);
    if (map.issue) topics.add(map.issue);
  }
  return { topics, anyThing };
}

/** Whether a topic can be named through any aspect in this vertical. */
export function topicHasAspect(packId: string, topic: string): boolean {
  return Object.values(PACK_ASPECTS[packId] ?? {}).some((m) => m?.praise === topic || m?.issue === topic);
}

/** Every anchor phrase, for checking whether a hint names its own thing. */
export function anchorsOfTopic(packId: string, topic: string): string[] {
  const out: string[] = [];
  for (const [id, map] of Object.entries(PACK_ASPECTS[packId] ?? {}) as Array<[AspectId, Mapping]>) {
    if (map.praise === topic || map.issue === topic) out.push(...ASPECTS[id].anchors);
  }
  return out;
}

/** Words, keeping Devanagari (with its combining marks) and apostrophes. */
function tokens(clause: string): string[] {
  return clause.toLowerCase().match(/[a-z0-9']+|[ऀ-ॿ]+/g) ?? [];
}

function latin(word: string): boolean {
  return /^[a-z0-9' ]+$/.test(word);
}

/** Positions in `toks` where `phrase` (one or more words) starts. Latin words may carry a plural "s"/"es". */
function positions(toks: string[], phrase: string): number[] {
  const parts = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  const out: number[] = [];
  for (let i = 0; i + parts.length <= toks.length; i += 1) {
    let ok = true;
    for (let j = 0; j < parts.length; j += 1) {
      const want = parts[j]!;
      const got = toks[i + j]!;
      const last = j === parts.length - 1;
      const match =
        got === want || (last && latin(want) && (got === `${want}s` || got === `${want}es`));
      if (!match) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

function negatedAt(toks: string[], at: number, length: number): boolean {
  // Look back past degree words for a negator: "not very clean".
  let k = at - 1;
  let hops = 0;
  while (k >= 0 && hops < 3) {
    const w = toks[k]!;
    if (PRE_NEGATION.has(w) || w.endsWith("n't")) return true;
    if (!DEGREE.has(w)) break;
    k -= 1;
    hops += 1;
  }
  // Hindi and Marathi put the negator after: "अच्छा नहीं", "chhan nahi".
  for (let f = at + length; f < Math.min(toks.length, at + length + 2); f += 1) {
    if (POST_NEGATION.has(toks[f]!)) return true;
  }
  // A quantified negation opens the clause and covers all of it: "not a
  // single class was cancelled", "never once was the food cold".
  const before = toks.slice(0, at).join(' ');
  return /\b(?:not a single|not one|not even one|not once|none of|no one|nobody|nothing|never|(?:couldn't|couldnt|could not|can't|cant|cannot) (?:find|see|get|spot) (?:a single|even one|one|any))\b/.test(before);
}

type Hit = { at: number; length: number; polarity: 'positive' | 'negative'; aspects: AspectId[]; generic: boolean; word: string };

export type AspectReading = {
  praiseTags: string[];
  issueTags: string[];
  /**
   * STRONG when an opinion word specific to the aspect decided it ("the
   * food was bland"), WEAK when only a generic word did ("the food was
   * good"). The combined reader lets a confident second reader overrule a
   * weak reading, never a strong one.
   */
  strength: Record<string, 'STRONG' | 'WEAK'>;
};

/**
 * The praise and problem topics this text supports, by aspect and polarity,
 * for this vertical. Empty for a vertical with no aspect map.
 */
export function readAspects(text: string, pack: Pack): AspectReading {
  const mapping = PACK_ASPECTS[pack.id];
  if (!mapping) return { praiseTags: [], issueTags: [], strength: {} };
  const aspects = Object.keys(mapping) as AspectId[];

  const praise = new Set<string>();
  const issues = new Set<string>();
  const strength: Record<string, 'STRONG' | 'WEAK'> = {};
  const mark = (key: string, strong: boolean) => {
    if (strong || !strength[key]) strength[key] = strong ? 'STRONG' : 'WEAK';
  };

  for (const clause of text.split(CLAUSE_SPLIT)) {
    if (!clause || !clause.trim()) continue;
    const toks = tokens(clause);
    if (toks.length === 0) continue;

    // Anchors: where each aspect is named in this clause.
    const anchorsAt = new Map<AspectId, Array<{ at: number; length: number; ownOnly: boolean }>>();
    for (const id of aspects) {
      for (const anchor of ASPECTS[id].anchors) {
        const length = anchor.split(/\s+/).length;
        for (const at of positions(toks, anchor)) {
          const list = anchorsAt.get(id) ?? [];
          list.push({ at, length, ownOnly: (ASPECTS[id].ownWordsOnly ?? []).includes(anchor) });
          anchorsAt.set(id, list);
        }
      }
    }

    // Opinion words, and which aspects each may describe.
    const hits: Hit[] = [];
    const addWords = (words: string[], polarity: 'positive' | 'negative', only: AspectId[], generic = false) => {
      for (const word of words) {
        const length = word.split(/\s+/).length;
        for (const at of positions(toks, word)) hits.push({ at, length, polarity, aspects: only, generic, word });
      }
    };
    const genericAspects = aspects.filter((id) => ASPECTS[id].generic);
    addWords(GENERIC_POSITIVE, 'positive', genericAspects, true);
    addWords(GENERIC_NEGATIVE, 'negative', genericAspects, true);
    for (const id of aspects) {
      addWords(ASPECTS[id].positive, 'positive', [id]);
      addWords(ASPECTS[id].negative, 'negative', [id]);
    }

    // Per aspect: which polarities this clause expresses about it.
    const seen = new Map<AspectId, Set<'positive' | 'negative'>>();
    const specific = new Set<AspectId>();
    const note = (id: AspectId, polarity: 'positive' | 'negative', own = false) => {
      const set = seen.get(id) ?? new Set();
      set.add(polarity);
      seen.set(id, set);
      if (own) specific.add(id);
    };

    for (const hit of hits) {
      // An opinion word that is itself an anchor ("service" is not an opinion)
      // never happens by construction; an anchor that is ALSO an opinion
      // word of another aspect is simply both.
      let best: { id: AspectId; distance: number } | null = null;
      for (const id of hit.aspects) {
        if (hit.generic && ASPECTS[id].notGeneric?.includes(hit.word)) continue;
        for (const anchor of anchorsAt.get(id) ?? []) {
          if (anchor.at === hit.at) continue;
          if (anchor.ownOnly && hit.generic) continue;
          const distance =
            anchor.at < hit.at ? hit.at - (anchor.at + anchor.length - 1) : anchor.at - (hit.at + hit.length - 1);
          if (distance > MAX_DISTANCE) continue;
          if (!best || distance < best.distance) best = { id, distance };
        }
      }
      const negated = negatedAt(toks, hit.at, hit.length);
      let polarity: 'positive' | 'negative' | null = hit.polarity;
      if (negated) polarity = hit.polarity === 'positive' ? 'negative' : null;
      // "Not the best coffee in town" is a hedge, not a complaint.
      if (negated && hit.polarity === 'positive' && /^(?:best|greatest|finest|perfect)$/.test(toks[hit.at]!)) polarity = null;
      if (polarity === null) continue;

      if (best) {
        note(best.id, polarity, hit.aspects.length === 1);
        continue;
      }
      // Words that can only be about one thing need no anchor: "came quickly".
      if (polarity === 'positive' && !negated) {
        for (const id of hit.aspects) {
          const own = ASPECTS[id].selfAnchoredPositive ?? [];
          if (own.some((w) => positions(toks, w).includes(hit.at))) note(id, 'positive', true);
        }
      }
    }

    for (const [id, polarities] of seen) {
      if (polarities.size !== 1) continue; // both ways in one clause: unclear, say nothing
      const map = mapping[id];
      if (!map) continue;
      const key = polarities.has('positive') ? map.praise : map.issue;
      if (!key) continue;
      (polarities.has('positive') ? praise : issues).add(key);
      mark(key, specific.has(id));
    }
  }

  return { praiseTags: [...praise], issueTags: [...issues], strength };
}

/**
 * WAITS STATED AS A DURATION — "waited 30 minutes", "another 40 minute wait",
 * "2 hours past my appointment" — for the verticals whose pack asks about
 * waiting. The number alone is never enough: a waiting word has to be in the
 * same clause, so "delivered in 30 minutes" says nothing.
 */
const DURATION = /\b(?:(?:\d+|ten|fifteen|twenty|thirty|forty|forty-five|fifty|sixty|two|three|four|an|one|half an|a couple of)\s*-?\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)|for hours)\b/i;
const WAIT_CONTEXT = /\b(?:wait|waited|waiting|took|to take|late|before (?:anyone|anybody|someone)|past (?:my|our|the) (?:appointment|slot|time)|for (?:the|our) (?:bill|food|order|table|mains|starters?|drinks?)|jhale|jhali|zale|zali|ho gaye|ho gaya|lagle|lagla|lage|laga|thambava|thambla|thambave|thamba|rukna pada|intezaar|intezar)\b|\b(?:came|arrived|served|reached|got (?:it|our|my))\b[^.!?;]{0,40}\bafter\b/i;
/**
 * Time spent on something that is not the café's service: parking, traffic,
 * finding the place, a delivery rider. "Took 25 mins just to find parking" is
 * not slow service.
 */
const NOT_THE_CAFES_TIME = /\b(?:sat|sitting|stayed|spent|chilled|hung out|worked from|park|parking|traffic|road|metro|stuck|find (?:the )?(?:place|cafe|café|address|it|us)|get out|rider|delivery (?:boy|guy|partner|person|man|executive|agent)|swiggy|zomato|cab|auto|uber|ola|bus|train|flight)\b/i;

/** Anything the café serves, by name: a wait for it is a wait for the order. */
const ORDER_ANCHORS = ['poha', 'misal', 'bite', 'snack', 'pizza', 'pasta', 'sandwich', 'coffee', 'chai', 'brownie', 'cake', 'waffle', 'fries', 'burger', 'frankie', 'dosa', 'thali', 'latte', 'cappuccino', 'shake'];

/** Words that make a wait about the order, not the table. */
const ABOUT_THE_ORDER = /\b(?:food|order|orders|coffee|dish|drink|drinks|meal|bill|served|serve|chai|tea|sandwich|pizza|burger|waffle|pasta|starter|mains|dessert|parcel|takeaway)\b/;

/** A wait to be seated, where the pack files it apart from slow service. */
const FOR_A_TABLE =
  /\b(?:for|to get) (?:a |our |the |any )?(?:table|seat)s?\b|\bto be seated\b|\bbefore (?:we were|being) seated\b|\bwait ?list\b|\btable (?:sathi|saathi|ke liye|keliye|milayla|milne|milne mein|milaala)\b/i;

export function waitFromDuration(text: string, pack: Pack): string | null {
  const theme = pack.gateway?.dimensions.find((d) => d.key === 'waiting')?.themeKey ?? null;
  if (!theme) return null;
  const tableTheme = pack.issueTaxonomy.some((e) => e.key === 'wait_for_table') ? 'wait_for_table' : null;
  for (const sentence of text.split(/[.!?;\n।]+/)) for (const clause of sentence.split(/\b(?:and then|then|but)\b/)) {
    if (!DURATION.test(clause) || !WAIT_CONTEXT.test(clause) || NOT_THE_CAFES_TIME.test(clause)) continue;
    // The duration and the wait must be about the same thing: near each
    // other, and not a time of day ("reached 10 min before closing").
    const durationAt = clause.search(DURATION);
    const waitAt = clause.search(WAIT_CONTEXT);
    if (Math.abs(durationAt - waitAt) > 45 || /before (?:closing|close|they closed|it closed|last order)/i.test(clause)) continue;
    // "so we waited 15 min to get one": the one is the table the sentence named.
    const forTable =
      FOR_A_TABLE.test(clause) ||
      (/\b(?:get|for) one\b/.test(clause) && /\btables?\b/.test(sentence)) ||
      // "I had reserved a table … took 15 min to sort out": a wait about the
      // table, in a sentence about the table, that names no food or order.
      (/\b(?:reserv\w*|booking|booked|tables?)\b/.test(sentence) &&
        !ABOUT_THE_ORDER.test(clause) &&
        !ORDER_ANCHORS.some((a) => new RegExp(`\\b${a}s?\\b`).test(clause)) &&
        !/\b(?:reach(?:ed)?|came to|arrive[ds]? (?:at|to)) (?:the|our) table\b/.test(clause));
    const toks = tokens(clause);
    // "did not wait even 5 minutes" is not a complaint about waiting.
    const negator = toks.findIndex((w) => PRE_NEGATION.has(w) || w.endsWith("n't"));
    const waitWord = toks.findIndex((w) => /^(wait|waited|waiting|took)$/.test(w));
    if (negator !== -1 && waitWord !== -1 && negator < waitWord && waitWord - negator <= 3) continue;
    return tableTheme && forTable ? tableTheme : theme;
  }
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};
const COUNT = '(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
const countOf = (word: string): number => NUMBER_WORDS[word] ?? Number(word);

const LATE_DELIVERY = new RegExp(`\\b(?:after|took|nearly|almost|over|more than)\\s+${COUNT}\\s+(months?|years?)\\b|\\b(months|a year) later\\b`, 'i');
const DELIVERABLE = /\b(?:album|albums|video|videos|film|photos|pictures|pics|edits?|edited|teaser|highlights|reel|deliverables?|delivery)\b/i;
const SHORT_CONSULT = new RegExp(`\\b(?:barely|only|just|hardly|not even|less than)\\s+${COUNT}\\s*(?:min|mins|minute|minutes)\\b`, 'i');
const CONSULT_CONTEXT = /\b(?:doctor|dr|doc|consultation|consulted|saw me|saw us|checked me|examined|spent)\b/i;
const HEADCOUNT = new RegExp(`\\b(?:almost|nearly|over|around|about|more than)?\\s*${COUNT}\\+?\\s+(?:students|kids|children)\\b`, 'i');
const BATCH_CONTEXT = /\b(?:batch|class|classroom|room|section)\b/i;
/** Silence, once the deal is done: a post-deal problem, not general responsiveness. */
const AFTER_DEAL = /\b(?:after (?:the|our) (?:deal|sale|payment|registration|booking|agreement)|after we (?:paid|signed|bought|booked)|once we (?:paid|signed)|we (?:paid|signed|bought|booked)\b[^.!?;]{0,20}\bnow)\b/i;
const SILENCE = /\b(?:reply|replied|respond\w*|answer\w*|call\w*|silent|quiet|disappeared|ignor\w*|stopped|vanished|message\w*|pick\w* up)\b/i;
/** A batch this size or larger, stated as a number, is the complaint. */
export const LARGE_BATCH = 40;
/** The menu's price and the bill's, side by side. */
const BILL_NOT_MENU = /\bmenu (?:says|said|price|shows|showed|has|had)\b[^.!?;]{0,60}\bbill (?:said|says|showed|shows|charged|had|was)\b|\bcharged (?:us |me )?(?:more|extra) than (?:the )?menu\b/i;

/**
 * PROBLEMS STATED AS A QUANTITY, where the number carries the verdict and a
 * named topic would otherwise be missed:
 *
 *   "got the edited video after eight months"     late delivery   (≥ 3 months)
 *   "the doctor saw me for barely two minutes"     rushed consult  (≤ 5 minutes)
 *   "our batch has almost 80 students"             batch too big   (≥ 40)
 *
 * Each needs its context word in the same clause — a deliverable, a
 * consultation, a class — so "waited only 5 minutes" is not a rushed
 * consultation and "80 students cleared JEE" is not a crowded batch. Only for a
 * pack that has the topic.
 */
export function issuesFromQuantities(text: string, pack: Pack): string[] {
  const has = (key: string) => pack.issueTaxonomy.some((e) => e.key === key);
  const found = new Set<string>();
  for (const clause of text.split(/[.!?;\n।]+/)) {
    if (has('delivery_delay') && DELIVERABLE.test(clause)) {
      const m = LATE_DELIVERY.exec(clause);
      if (m && (m[3] !== undefined || /^year/i.test(m[2] ?? '') || countOf((m[1] ?? '').toLowerCase()) >= 3)) {
        found.add('delivery_delay');
      }
    }
    if (has('consultation_rush') && CONSULT_CONTEXT.test(clause) && !WAIT_CONTEXT.test(clause)) {
      const m = SHORT_CONSULT.exec(clause);
      if (m && countOf((m[1] ?? '').toLowerCase()) <= 5) found.add('consultation_rush');
    }
    if (has('post_deal_support') && AFTER_DEAL.test(clause) && SILENCE.test(clause)) found.add('post_deal_support');
    // "Menu says masala chai is 60, bill said 90": a price on the bill that
    // is not the menu's.
    if (has('billing_issue') && BILL_NOT_MENU.test(clause)) found.add('billing_issue');
    if (has('batch_size') && BATCH_CONTEXT.test(clause)) {
      const m = HEADCOUNT.exec(clause);
      if (m && countOf((m[1] ?? '').toLowerCase()) >= LARGE_BATCH) found.add('batch_size');
    }
  }
  return [...found];
}

/** "Lost 8 kg" — a result, in the verticals that name one. */
export function resultFromWeight(text: string, pack: Pack): string | null {
  if (!pack.praiseTaxonomy.some((e) => e.key === 'results')) return null;
  return /\b(?:lost|dropped|shed)\s+\d+(?:\.\d+)?\s*(?:kg|kgs|kilo|kilos|kilograms|pounds|lbs)\b/i.test(text) ? 'results' : null;
}
