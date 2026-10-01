/**
 * WHAT THE WORDS ARE ABOUT (final semantic correctness pass, Sep 2026).
 *
 * Before any topic is matched, every clause is asked two questions:
 *
 *   WHO is it about?   A negative word does not make a complaint about the
 *                      business. "The baraat ran two hours late" is about the
 *                      baraat; "I arrived late" is about the customer; "the
 *                      builder delayed possession" is about the builder. Filing
 *                      any of them against the business manufactures an
 *                      accusation from a sentence that makes none.
 *
 *   WHEN is it true?   "The equipment was new when I joined, now half of it is
 *                      broken" says the equipment is broken. The praise is for
 *                      a past that has ended.
 *
 * A clause that is not about the business now is BLANKED — replaced by spaces
 * of the same length, so nothing else moves — and recorded as an abstention
 * with its reason. Nothing is ever re-assigned to someone else, because the
 * packs have no topics for "the guests" or "the bank": the honest output is
 * silence about that clause, not a guess.
 *
 * The rules are deliberately narrow:
 *
 *   1. A clause is only set aside when it carries an ATTRIBUTION-SENSITIVE
 *      predicate — lateness, rudeness, a delay, a cancellation, a loss, a
 *      change — the kinds of statement whose meaning depends entirely on who
 *      did it. "The guests loved the food" is kept: praise of the food is
 *      praise of the business whoever says it.
 *   2. Only a clause whose subject is plainly NOT the business is set aside:
 *      the customer themself (I, we), their family and friends, other
 *      customers, other businesses and institutions (venue, DJ, bank, builder,
 *      board), and events and circumstances (the event, traffic, rain, a
 *      strike). An unknown or missing subject is the business, as it is in
 *      nearly every review ("came late, no updates").
 *   3. Receiving is not doing: "we got our food late" and "the guests were
 *      served late" are about the business, whoever is the grammatical subject.
 *   4. Cause travels: "the event started late because the guests arrived
 *      late" and "I forgot my reports, so the consultation took longer" are
 *      about the guests and the customer, both halves.
 *
 * Pure: no database, no network, no clock.
 */

import type { Pack } from '@/lib/packs';
import { anchorWords } from './aspects';

export type Actor = 'BUSINESS' | 'SELF' | 'THIRD_PARTY' | 'EVENT' | 'DELIVERABLE' | 'UNSTATED';

export type SetAside = {
  start: number;
  end: number;
  /** The clause as written (lowercased), for the reasons shown to the operator. */
  text: string;
  reason: 'NOT_ABOUT_BUSINESS' | 'PAST';
  actor: Actor | null;
};

export type ScopedText = {
  /** The text with every set-aside clause blanked. Same length as the input. */
  text: string;
  setAside: SetAside[];
  /** Spans whose subject is a deliverable (an album, a video): see `remapForDeliverable`. */
  deliverables: Array<{ start: number; end: number }>;
  /** A sarcastic opener was neutralised ("Great, another hour waiting"). */
  sarcasm: boolean;
  /**
   * Elided negations: "the showers aren't", "the mains not so much" after
   * a clause that praised something. Each is a complaint with its words left
   * out, and counts as negative wording.
   */
  elidedNegatives: number;
  /**
   * A clause kept as the business's whose words depend on who acted ("late",
   * "rude", "delayed"), but whose subject is not plainly the business: an
   * unfamiliar noun ("our caterer served late") or no subject at all. Kept,
   * because the business is the likelier subject, but never at HIGH
   * confidence.
   */
  unsureAttribution: boolean;
};

/**
 * Subjects that are plainly the business, in every vertical: its people and
 * the pronouns a review uses for them. A pack's own things (its aspect
 * anchors: "food", "trainer", "album") count too.
 */
const BUSINESS_SUBJECTS = new Set([
  'they', 'he', 'she', 'staff', 'team', 'owner', 'owners', 'manager', 'management', 'reception', 'receptionist',
  'service', 'everyone', 'everybody', 'nobody', 'no one', 'someone', 'their', 'agent', 'broker', 'vendor', 'stylist',
  'stylists', 'trainer', 'trainers', 'coach', 'coaches', 'teacher', 'teachers', 'faculty', 'sir', 'madam', 'doctor',
  'dr', 'nurse', 'nurses', 'photographer', 'photographers', 'planner', 'planners', 'waiter', 'waiters', 'chef',
  'kitchen', 'you', 'your', 'institute', 'academy', 'clinic', 'gym', 'salon', 'restaurant', 'cafe', 'studio',
]);

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Whatever someone other than the business did wrong, these are the words for it. */
const SENSITIVE =
  /\b(?:late|later|delay\w*|early|on time|punctual\w*|rude\w*|shout\w*|yell\w*|argu\w*|misbehav\w*|lie|lied|lies|lying|lost(?!\s+\d+(?:\.\d+)?\s*(?:kg|kgs|kilo|kilos|kilograms|pounds|lbs|inches|cm))|forgot|forget\w*|cancel\w*|postpon\w*|skip\w*|miss(?:ed|es|ing)?|overslept|chang\w*|closed|clash\w*|ran out|took (?:a )?long\w*|took longer|took forever|took ages|took (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|few|\d+) (?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)|slow\w*|wrong|mess\w*|spill\w*|leak\w*|dropped|broke|broken|stole|stolen|delayed|stopped(?!\s+(?:respond|repl|answer|pick|call|return|messag)\w*)|halted|suspended|shut|cry\w*|cried|scream\w*|noisy|loud|dead|no ac|not working|wasn't working|no power|no electricity|went off|stuck)\b/;

/** True when a phrase's meaning depends on who did it. Used by the taxonomy audit. */
export function isAttributionSensitive(phrase: string): boolean {
  return SENSITIVE.test(phrase.toLowerCase());
}

/** Receiving is not doing: the business did this to them. */
const RECEIVED = /\b(?:(?:got)(?!\s+(?:lost|late|delayed|stuck|confused))|get|gets|received|receive|served|given|seated|attended|seen|called|told|informed|delivered|handed|charged|billed)\b/;

const SELF = new Set(['i', 'we', 'me', 'us', "i'm", 'im', "i've", "we're", "we've", 'myself', 'ourselves']);

/** People who are never the business. */
const THIRD_PARTY_PEOPLE = new Set([
  'customer', 'customers', 'guest', 'guests', 'someone', 'somebody', 'stranger', 'strangers', 'neighbour', 'neighbours',
  'group', 'groups', 'gang', 'crowd', 'bday', 'birthday',
  'neighbor', 'neighbors', 'thief',
  // family and friends
  'husband', 'wife', 'son', 'daughter', 'kid', 'kids', 'child', 'children', 'baby', 'mother', 'father', 'mom', 'mum', 'dad',
  'parent', 'friend', 'friends', 'family', 'relative', 'relatives', 'cousin', 'cousins', 'brother', 'sister', 'uncle',
  'aunt', 'aunty', 'inlaws', 'in-laws', 'bride', 'groom', 'baraat',
  // other trades and institutions
  'driver', 'cab', 'auto', 'rider', 'pandit', 'priest', 'dj',
  'bank', 'builder', 'builders', 'developer', 'seller', 'sellers', 'landlord', 'society', 'office', 'board', 'government',
  'authority', 'authorities', 'municipality', 'corporation', 'police', 'court', 'registrar', 'insurance',
]);

/**
 * Third parties only in one vertical: to a restaurant "the hall" is itself,
 * to a wedding vendor it is someone else's premises.
 */
const THIRD_PARTY_BY_PACK: Record<string, Set<string>> = {
  wedding_vendor: new Set(['venue', 'hall', 'banquet', 'band', 'caterer', 'caterers', 'hotel', 'resort']),
  coaching: new Set(['school', 'college', 'university']),
  clinic: new Set(['lab', 'laboratory', 'pharmacy', 'chemist']),
  // A café's orders often travel with someone else: the delivery app and its
  // rider are not the café. "The kitchen took 40 minutes" still is.
  restaurant: new Set([
    'swiggy', 'zomato', 'dunzo', 'zepto', 'blinkit', 'uber', 'ubereats', 'rapido', 'ola', 'magicpin', 'eatsure',
    'riders', 'app', 'courier', 'mall', 'parking', 'valet', 'neighbouring', 'neighboring',
  ]),
};

/** "The delivery partner", "the delivery boy": the person carrying the order, not the café. */
const DELIVERY_PERSON = /^(?:partner|boy|guy|man|person|executive|agent|rider|driver|wala|walla|bhaiya|bhai)s?$/;

/** Customer-type nouns that are third parties only with a marker: "the previous client", "another patient". */
const OTHER_CUSTOMER = new Set(['client', 'clients', 'patient', 'patients', 'member', 'members', 'student', 'students', 'owner', 'owners', 'people', 'person', 'lady', 'man', 'woman']);
const OTHER_MARKER = new Set(['other', 'another', 'previous', 'next', 'some', 'few']);

/** Events and circumstances. Nobody's in particular, and not the business's. */
const EVENTS = new Set([
  'event', 'function', 'ceremony', 'muhurat', 'muhurtham', 'programme', 'program', 'exam', 'exams', 'festival', 'holiday',
  'holidays', 'rain', 'rains', 'weather', 'traffic', 'strike', 'lockdown', 'power', 'electricity', 'storm', 'flood', 'wedding',
  'sangeet', 'haldi', 'mehendi',
]);

/** Causes nobody at the business chose: "delayed by a server outage". */
const IMPERSONAL_CAUSE = new Set([
  ...EVENTS, 'outage', 'outages', 'failure', 'failures', 'shortage', 'breakdown', 'cut', 'cuts', 'jam', 'accident',
  'court', 'courts', 'government', 'authority', 'authorities', 'municipality', 'corporation', 'police', 'board',
  'election', 'elections', 'bandh', 'protest', 'protests', 'curfew', 'bank', 'registrar',
]);

/**
 * A cause stated as a passive agent: "the ceremony was held up by a power
 * failure", "our order was delayed by the kitchen". Group 1 is the agent.
 */
const PASSIVE_AGENT =
  /\b(?:was|were|got|been|is|are|being)\s+(?:\w+\s+)?(?:delayed|held up|postponed|cancelled|canceled|disrupted|interrupted|stopped|ruined|affected|pushed back|slowed(?: down)?)\s+(?:\w+\s+)?by\s+((?:[a-z'-]+\s*){1,4})/;

/** Things the business hands over. Their lateness is delivery, not punctuality. */
const DELIVERABLES = new Set([
  'album', 'albums', 'photos', 'photo', 'pictures', 'pics', 'video', 'videos', 'teaser', 'edit', 'edits', 'film', 'reel',
  'highlights', 'prints', 'deliverables',
]);

/** A noun followed by one of these is the business's department: "customer service". */
const OWNED = new Set(['service', 'care', 'support', 'desk', 'team', 'staff', 'executive', 'manager']);

/** Verbs that commonly open a subjectless clause. */
const VERB_FIRST = new Set([
  'came', 'went', 'took', 'left', 'kept', 'got', 'gave', 'made', 'said', 'told', 'showed', 'did', "didn't", 'never',
  'always', 'has', 'had', 'have', 'keeps', 'gets', 'takes', 'makes', 'gives', 'does', "doesn't", 'charges', 'forgets',
]);

/** Words that open a clause without being its subject. */
const LEADING = new Set([
  'but', 'and', 'though', 'although', 'however', 'while', 'whereas', 'because', 'since', 'so', 'when', 'whenever', 'until',
  'after', 'then', 'also', 'even', 'still', 'yet', 'just', 'only', 'the', 'a', 'an', 'our', 'my', 'their', 'his', 'her',
  'its', 'this', 'that', 'these', 'those', 'all', 'of', 'at', 'in', 'on', 'for', 'it', 'it\'s', 'there', 'was', 'is',
  'were', 'are', 'due', 'to', 'by', 'city-wide', 'citywide', 'whole', 'entire', 'really', 'very',
]);

/** Where one clause ends and the next begins. Relative "who"/"which" are NOT boundaries. */
const BOUNDARY = /[.!?;,\n।:]|\b(?:and|but|though|although|however|while|whereas|because|since|so|when|whenever|until|after|due to)\b/g;
const SENTENCE = /[.!?;\n।]/g;

/** A cause that follows: "B because A", "B due to A", "B since A". */
const CAUSE_FOLLOWS = /^(?:because|due to|since)$/;
/** A consequence that follows: "A so B". */
const EFFECT_FOLLOWS = /^(?:so)$/;

const PAST_MARKER =
  /\b(?:used to|earlier|previously|at first|initially|in the beginning|(?:\d+|a|one|two|three|four|five|six|few|couple of) (?:years?|months?) ago|last year|when (?:i|we) (?:first )?(?:joined|started|came)|for (?:a|an|one|two|three|four|five|a few|a couple of) (?:days?|weeks?|months?|hours?)|before the (?:booking|deal|payment|wedding|event|registration)|(?:until|before) we (?:signed|paid|booked|bought|moved in|joined)|(?:on|after|during|at) (?:our|my|the) (?:first|last|previous) (?:visit|day|session|trip|time|order)|on day one|for the first (?:week|month|few (?:days|weeks|months))|during (?:the )?booking|in (?:january|february|march|april|may|june|july|august|september|october|november|december|winter|summer))\b/;
const NOW_MARKER = /\b(?:now|anymore|any more|these days|lately|recently|nowadays|since then|then|after that|soon after|this time|this visit)\b/;

/**
 * A past visit told in its own sentence and contrasted with this one in a
 * later sentence: "My first visit the pasta came lukewarm. This time it was
 * piping hot." The earlier visit is history, not how the café is now.
 */
const PREVIOUS_VISIT =
  /\b(?:(?:on|after|during|at) (?:our|my|the) (?:first|last|previous) (?:visit|time|trip|order)|(?:my|our) (?:first|last|previous) visit|last time|first time (?:i|we) (?:came|visited|ordered|went)|used to|previously)\b/;
const THIS_VISIT = /\b(?:this time|this visit|today|now|these days|on (?:my|our) second (?:visit|time)|second time)\b/;

/** What usually happens. */
const HABITUAL = /\b(?:usually|normally|generally|always|every time|everytime|har baar|harbaar|hamesha|nehmi|nehmich|regularly|roz|daily|every day|everyday)\b/;
/** This visit, against the usual. */
const TODAY = /\b(?:today|yesterday|this time|this visit|aaj|kal|aj)\b/;

/** "My bad", "my fault": the customer owns what follows in that sentence. */
const SELF_FAULT = /(?:^|[\s,(])(?:(?:it was |that was |totally |completely |entirely )?(?:my|our) (?:bad|fault|mistake|own fault)|meri galti|majhi chuk|maajhi chuk|apni galti)\b/;

/** An outage or the weather, named anywhere in a clause, is the clause's cause. */
const CIRCUMSTANCE = /\b(?:power cut|power outage|power failure|load shedding|no electricity|light (?:gone|gayi|geli|went)|heavy rain|rains?|traffic jam)\b/;
/** "X isn't", "X not so much": a contrast whose complaint is left unsaid. */
const ELIDED = /^\s*(?:the\s+)?[a-z\u0900-\u097F' -]{2,40}?\s+(?:(?:is|are|was|were)\s+not|isn't|aren't|wasn't|weren't|not so much|not really|not at all|not)\s*$/;

const SARCASTIC_OPENER =
  /^\s*(?:great|wonderful|fantastic|brilliant|amazing|awesome|perfect|lovely|nice|super|thanks|thank you)(?:\s+(?:job|work))?\s*[,!]|^\s*amazing how\b|^\s*great job\b|^\s*thanks for the\b|^\s*(?:loved|love|enjoyed)\s+(?:spending|paying|waiting|sitting|standing|getting|being)\b|^\s*(?:wah|waah|wa+h+|kya baat)\b[^,!.?]{0,30}(?:[,!]|$)|^\s*(?:kay|kya|what an?|wow,? what an?)\s+(?:fast|quick|great|amazing|mast|bhari|chhan|badhiya|awesome|superb|wonderful)\b[^,!.?]{0,30}(?:[,!]|$)/;
/** "Love how…", "gotta love how…": sarcastic when a complaint follows. */
const LOVE_HOW = /^\s*(?:i\s+)?(?:just\s+|really\s+|absolutely\s+)?(?:love|loved|gotta love|got to love|have to love)\s+how\b/;
/** "only had to wave six times", "fakt 50 minute ubha hoto": group 1 the count, group 2 its unit. */
const ONLY_COUNT =
  /\b(?:only|just|sirf|fakt|bas|barely)\b[^.!?]{0,40}?\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|forty-five|fifty|sixty|an|a)\s*(times|mins?|minutes?|minute|hours?|hrs?|baar|vela)\b/;
const COUNT_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15,
  twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60,
};
/** "…provided you've got nowhere to be", "…if you have an hour to spare": praise taken back. */
const CONDITION_TAKES_IT_BACK =
  /^\s*(?:provided|if|as long as|assuming|only if)\b[^.!?]{0,50}\b(?:nowhere to be|all day|an hour|hours to|time to kill|patience|not in a hurry|in no hurry|no rush)\b/;

/** Three times, twenty minutes or an hour: a count that is a complaint. */
function troubleCount(n: string, unit: string): boolean {
  const v = COUNT_WORDS[n] ?? Number(n);
  if (!Number.isFinite(v)) return false;
  if (/^(?:times|baar|vela)$/.test(unit)) return v >= 3;
  if (/^(?:hours?|hrs?)$/.test(unit)) return v >= 1;
  return v >= 20;
}

/** Praise for a verb of damage needs no further evidence: "well done serving us raw chicken". */
const SARCASTIC_DEED = /^\s*(?:well done|(?:great|nice|good|brilliant|fantastic) (?:job|work))\s+[a-z]+ing\b/;

// ---------------------------------------------------------------------------

type Clause = { start: number; end: number; opener: string };

function clausesOf(text: string, from: number, to: number): Clause[] {
  const out: Clause[] = [];
  const re = new RegExp(BOUNDARY.source, 'g');
  re.lastIndex = from;
  let start = from;
  let opener = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && m.index < to) {
    if (m.index > start) out.push({ start, end: m.index, opener });
    start = m.index + m[0].length;
    opener = /[a-z]/.test(m[0]) ? m[0] : '';
  }
  if (to > start) out.push({ start, end: to, opener });
  return out;
}

function tokens(s: string): string[] {
  return s.split(/[^a-z0-9'\-ऀ-ॿ]+/).filter(Boolean);
}

/** Who a clause is about, from its first content words. */
export function actorOf(clause: string, packId = ''): Actor {
  const toks = tokens(clause);
  const content: string[] = [];
  for (const t of toks) {
    if (content.length === 0 && LEADING.has(t)) continue;
    content.push(t);
    if (content.length >= 3) break;
  }
  if (content.length === 0) return 'UNSTATED';
  if (CIRCUMSTANCE.test(clause)) return 'EVENT';
  // Named through a qualifier: "the decorator from the venue", "the
  // society's secretary". Whose people they are decides it.
  const byPackQualifier = THIRD_PARTY_BY_PACK[packId];
  const qualifier = /^\s*(?:the\s+|our\s+|a\s+)?[a-z]+\s+(?:from|of|at)\s+(?:the\s+)?([a-z]+)/.exec(clause) ??
    /^\s*(?:the\s+)?([a-z]+)'s\s+[a-z]+/.exec(clause);
  if (qualifier) {
    const owner = qualifier[1]!;
    if (THIRD_PARTY_PEOPLE.has(owner) || byPackQualifier?.has(owner) || EVENTS.has(owner)) return 'THIRD_PARTY';
  }
  const first = content[0]!;
  if (SELF.has(first)) return 'SELF';
  // A deliverable anywhere in the subject decides it: "the wedding album".
  if (content.some((t) => DELIVERABLES.has(t.replace(/'s$/, '')))) return 'DELIVERABLE';
  const byPack = THIRD_PARTY_BY_PACK[packId];
  for (let i = 0; i < content.length; i += 1) {
    const raw = content[i]!;
    const word = raw.replace(/'s$/, '');
    const next = content[i + 1];
    if (next && OWNED.has(next)) return 'BUSINESS';
    if (EVENTS.has(word)) return 'EVENT';
    if (THIRD_PARTY_PEOPLE.has(word) || byPack?.has(word)) return 'THIRD_PARTY';
    if (OTHER_CUSTOMER.has(word)) {
      if (i > 0 && OTHER_MARKER.has(content[i - 1]!)) return 'THIRD_PARTY';
      // "the patient before me", "the client ahead of us"
      if (new RegExp(`\\b${word}\\s+(?:before|after|ahead of|next to|behind)\\s+(?:me|us)\\b`).test(clause)) return 'THIRD_PARTY';
    }
    if (OTHER_MARKER.has(word)) continue;
    // "The delivery partner", "the swiggy delivery guy", "the delivery boy".
    if (word === 'delivery' && next && DELIVERY_PERSON.test(next)) return 'THIRD_PARTY';
    // A clause that opens with a verb has no subject of its own: "arrived
    // early", "charged extra", "never replied".
    if (i === 0 && (VERB_FIRST.has(word) || /^[a-z]{3,}ed$/.test(word))) return 'UNSTATED';
    // The first real noun decides; an unknown one is the business.
    return 'BUSINESS';
  }
  return 'BUSINESS';
}

function blank(text: string, start: number, end: number): string {
  return text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);
}

/**
 * The text with every clause that is not about the business now blanked, and
 * a record of what was set aside and why.
 */
/**
 * `polarityOf` (optional) scores a span: above zero positive, below negative.
 * It is handed in by the topic reader, so this module needs no reader of its
 * own, and it lets a change over time be seen without a "used to".
 */
export function scopeText(lowerText: string, pack: Pack, polarityOf?: (span: string) => number): ScopedText {
  let text = lowerText;
  const setAside: SetAside[] = [];
  const deliverables: Array<{ start: number; end: number }> = [];
  let sarcasm = false;
  let elidedNegatives = 0;
  let unsureAttribution = false;
  const anchors = anchorWords(pack.id);
  const plainlyBusiness = (clause: string): boolean => {
    for (const t of tokens(clause)) {
      if (LEADING.has(t)) continue;
      const w = t.replace(/'s$/, '');
      return BUSINESS_SUBJECTS.has(w) || anchors.has(w) || anchors.has(w.replace(/e?s$/, ''));
    }
    return false;
  };

  // Sentence by sentence: attribution and time never reach across a full stop.
  const sentences: Array<{ start: number; end: number }> = [];
  {
    const re = new RegExp(SENTENCE.source, 'g');
    let start = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lowerText)) !== null) {
      if (m.index > start) sentences.push({ start, end: m.index });
      start = m.index + m[0].length;
    }
    if (lowerText.length > start) sentences.push({ start, end: lowerText.length });
  }

  for (const sentence of sentences) {
    const clauses = clausesOf(lowerText, sentence.start, sentence.end);
    const actors = clauses.map((c) => actorOf(lowerText.slice(c.start, c.end), pack.id));
    // A clause with no subject of its own after "and"/"but" shares the one
    // before it: "our album is beautiful and arrived early".
    for (let i = 1; i < clauses.length; i += 1) {
      if (actors[i] === 'UNSTATED' && /^(?:and|but)$/.test(clauses[i]!.opener)) actors[i] = actors[i - 1]!;
    }
    // "My bad, forgot to tell them no sugar": the customer owns the slip.
    if (SELF_FAULT.test(lowerText.slice(sentence.start, sentence.end))) {
      clauses.forEach((c, i) => {
        if (i === 0 || actors[i] === 'UNSTATED' || !plainlyBusiness(lowerText.slice(c.start, c.end))) actors[i] = 'SELF';
      });
    }
    // The business waiting for the customer is courtesy, not a wait:
    // "he waited patiently for us".
    clauses.forEach((c, i) => {
      if (actors[i] !== 'BUSINESS') return;
      const body = lowerText.slice(c.start, c.end);
      const m = /\bwaited\b(?=.*\bfor (?:us|me)\b)/.exec(body);
      if (m) text = blank(text, c.start + m.index, c.start + m.index + m[0].length);
    });
    const sensitive = clauses.map((c) => SENSITIVE.test(lowerText.slice(c.start, c.end)));
    const received = clauses.map((c) => RECEIVED.test(lowerText.slice(c.start, c.end)));
    const notBusiness = (i: number) =>
      (actors[i] === 'SELF' || actors[i] === 'THIRD_PARTY' || actors[i] === 'EVENT') && !received[i];

    const out = clauses.map((_, i) => notBusiness(i) && sensitive[i]);

    // A passive agent names the cause in the same clause: "was delayed by a
    // court holiday" is the court's, "was delayed by the kitchen" stays the
    // business's.
    clauses.forEach((c, i) => {
      const m = PASSIVE_AGENT.exec(lowerText.slice(c.start, c.end));
      if (!m || received[i]) return;
      const agent = m[1]!.trim();
      const agentActor = actorOf(agent, pack.id);
      if (tokens(agent).some((t) => IMPERSONAL_CAUSE.has(t))) actors[i] = 'EVENT';
      else if (agentActor === 'THIRD_PARTY' || agentActor === 'SELF' || agentActor === 'EVENT') actors[i] = agentActor;
      else return;
      out[i] = true;
    });

    // Cause travels, both ways: "B because A", "A so B".
    for (let i = 1; i < clauses.length; i += 1) {
      const opener = clauses[i]!.opener;
      if (CAUSE_FOLLOWS.test(opener) && notBusiness(i) && (sensitive[i] || actors[i] === 'EVENT') && sensitive[i - 1] && !received[i - 1]) {
        out[i - 1] = true;
      }
      // "The food came late, but that's because we were waiting for a
      // friend": the cause points back past a bare "that's".
      if (
        i >= 2 &&
        CAUSE_FOLLOWS.test(opener) &&
        notBusiness(i) &&
        (sensitive[i] || actors[i] === 'EVENT') &&
        /^\s*(?:tbh\s+|honestly\s+|to be fair\s+)?(?:that'?s|thats|that was|it was|this was|it'?s)\s*$/.test(lowerText.slice(clauses[i - 1]!.start, clauses[i - 1]!.end)) &&
        sensitive[i - 2] &&
        !received[i - 2]
      ) {
        out[i - 2] = true;
      }
      // And a cause that IS the business makes the effect the business's:
      // "we missed the pheras because the photographer was busy eating".
      if (CAUSE_FOLLOWS.test(opener) && actors[i] === 'BUSINESS') out[i - 1] = false;
      // An outage or the weather as the cause: "a power cut, so no AC".
      // An outage named anywhere earlier in the sentence is the cause too:
      // "a power cut when we went, so no AC".
      const eventEarlier = actors.slice(0, i).some((a) => a === 'EVENT');
      if (EFFECT_FOLLOWS.test(opener) && (out[i - 1] || eventEarlier) && sensitive[i] && !received[i]) out[i] = true;
    }

    // Kept as the business's, on a guess: see `unsureAttribution`. A clause
    // with no subject of its own takes the sentence's.
    clauses.forEach((c, i) => {
      if (out[i] || !sensitive[i] || actors[i] === 'DELIVERABLE') return;
      const own = lowerText.slice(c.start, c.end);
      const subject = actors[i] === 'UNSTATED' || /^\s*(?:and|but|then)?\s*(?:was|were|is|are|had|has|did|got)\b/.test(own)
        ? lowerText.slice(clauses[0]!.start, clauses[0]!.end)
        : own;
      if (!plainlyBusiness(subject)) unsureAttribution = true;
    });

    clauses.forEach((c, i) => {
      if (actors[i] === 'DELIVERABLE') deliverables.push({ start: c.start, end: c.end });
      if (!out[i]) return;
      setAside.push({ start: c.start, end: c.end, text: lowerText.slice(c.start, c.end).trim(), reason: 'NOT_ABOUT_BUSINESS', actor: actors[i]! });
      text = blank(text, c.start, c.end);
    });

    // Elided negations: "X is great, Y isn't" — or "X is taught well; Y
    // isn't", where the semicolon starts a new sentence but not a new thought.
    const afterSemicolon = sentence.start > 0 && lowerText[sentence.start - 1] === ';';
    for (let i = afterSemicolon ? 0 : 1; i < clauses.length; i += 1) {
      if (ELIDED.test(lowerText.slice(clauses[i]!.start, clauses[i]!.end))) elidedNegatives += 1;
    }

    // WHEN: a past state contrasted with now. Split only at commas, contrasts
    // and "then", so "when I joined" stays with the clause it dates.
    const sentenceText = lowerText.slice(sentence.start, sentence.end);
    const parts = sentenceText.split(/(,|\bbut\b|\bhowever\b|\bthough\b|\balthough\b|\bwhile\b|\bwhereas\b|\band then\b|\bthen\b|\buntil\b)/);
    let offset = sentence.start;
    const spans: Array<{ start: number; end: number; body: string }> = [];
    for (const part of parts) {
      spans.push({ start: offset, end: offset + part.length, body: part });
      offset += part.length;
    }
    let pastIdx = spans.findIndex((s) => PAST_MARKER.test(s.body));
    let nowIdx = spans.findIndex((s, i) => i > pastIdx && pastIdx !== -1 && NOW_MARKER.test(s.body));
    // What usually happens, against what happened today: "har baar the cold
    // coffee is the best, but aaj it was too sweet". Only when the two halves
    // point opposite ways — "they always forget, and today too" is one
    // complaint, not a change.
    if ((pastIdx === -1 || nowIdx === -1) && polarityOf) {
      const h = spans.findIndex((s) => HABITUAL.test(s.body));
      const n = h === -1 ? -1 : spans.findIndex((s, i) => i > h && TODAY.test(s.body));
      if (h !== -1 && n !== -1) {
        const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
        const before = spans.slice(0, n).map((s) => s.body).join('');
        const after = spans.slice(n).map((s) => s.body).join('');
        if (sign(polarityOf(before)) * sign(polarityOf(after)) < 0) {
          pastIdx = h;
          nowIdx = n;
        }
      }
    }
    // No "used to", but a change all the same: two halves joined by "then",
    // "until" or "now" that say opposite things — "great in January, then
    // half of them stopped working". The later half is how it is now.
    if ((pastIdx === -1 || nowIdx === -1) && polarityOf) {
      const turn = spans.findIndex((s, i) => i > 0 && /^(?:then|and then|until)$|\bnow\b|\bthese days\b|\banymore\b/.test(s.body.trim()));
      if (turn > 0) {
        const before = spans.slice(0, turn).map((s) => s.body).join('');
        const after = spans.slice(turn).map((s) => s.body).join('');
        const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
        if (sign(polarityOf(before)) * sign(polarityOf(after)) < 0) {
          pastIdx = 0;
          nowIdx = turn;
        }
      }
    }
    if (pastIdx !== -1 && nowIdx !== -1) {
      // The past keeps its THINGS and loses its opinions: "the highlights
      // were lovely for a week and then went brassy" still says what went
      // brassy. Separators between then and now go too, so the thing and
      // its present opinion are read together.
      for (let i = 0; i < nowIdx; i += 1) {
        const s = spans[i]!;
        if (!s.body.trim()) continue;
        const separator = /^(,|but|however|though|although|while|whereas|and then|then|until)$/.test(s.body.trim());
        if (!separator) setAside.push({ start: s.start, end: s.end, text: s.body.trim(), reason: 'PAST', actor: null });
        const re = /[a-z\u0900-\u097F']+|[^a-z\u0900-\u097F'\s]+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(s.body)) !== null) {
          const word = m[0];
          const named = anchors.has(word) || anchors.has(word.replace(/e?s$/, ''));
          if (separator || !named) text = blank(text, s.start + m.index, s.start + m.index + m[0].length);
        }
      }
      // A "then"/"until" that opens the present half is a separator too.
      const head = spans[nowIdx]!;
      const lead = /^\s*(?:and then|then|until)\b/.exec(head.body);
      if (lead) text = blank(text, head.start, head.start + lead[0].length);
    }

    // A sarcastic opener — "Great, another forty minutes waiting" — is not
    // praise. Only when the rest of the sentence complains.
    const deed = SARCASTIC_DEED.exec(sentenceText);
    if (deed) {
      text = blank(text, sentence.start + deed.index, sentence.start + deed.index + deed[0].length - (deed[0].match(/[a-z]+ing$/)?.[0].length ?? 0));
      sarcasm = true;
    }
    const opener = deed ? null : SARCASTIC_OPENER.exec(sentenceText);
    if (opener && /\b(?:another|again|cold|late|lost|losing|waiting|hours?|minutes?|mins?|surprise|extra|nobody|bald|queue|only|third|change|hasn't|haven't|whole morning|whole day|baar|tab jaake|tab jake|finally|room temperature|jhale|zale|nahi|ajun|still)\b/.test(sentenceText.slice(opener[0].length) + ' ' + lowerText.slice(sentence.end, sentence.end + 120))) {
      // "Loved waiting 25 minutes": only the praise word is discounted; the
      // waiting is what the sentence is about.
      const gerund = /^(\s*(?:loved|love|enjoyed))\s+(?:spending|paying|waiting|sitting|standing|getting|being)\b/.exec(opener[0]);
      const end = gerund ? opener.index + gerund[1]!.length : opener.index + opener[0].length;
      text = blank(text, sentence.start + opener.index, sentence.start + end);
      sarcasm = true;
    }
    if (polarityOf) {
      // "Love how the barista spent ten minutes on his phone": praise for a
      // complaint. Only when what follows is a complaint.
      const loveHow = LOVE_HOW.exec(sentenceText);
      if (loveHow) {
        const rest = sentenceText.slice(loveHow[0].length);
        if (SENSITIVE.test(rest) || polarityOf(rest) <= 0) {
          text = blank(text, sentence.start + loveHow.index, sentence.start + loveHow.index + loveHow[0].length);
          sarcasm = true;
        }
      }
      // "Super attentive staff, only had to wave at them six times": praise,
      // then "only"/"just" and a count of the trouble it took. Only for a
      // count that is trouble (three times, twenty minutes, an hour): "great
      // service, only waited five minutes" means what it says.
      const comma = sentenceText.indexOf(',');
      if (comma > 2) {
        const head = sentenceText.slice(0, comma);
        const count = ONLY_COUNT.exec(sentenceText.slice(comma + 1));
        const takenBack = CONDITION_TAKES_IT_BACK.test(sentenceText.slice(comma + 1));
        if (((count && troubleCount(count[1]!, count[2]!)) || takenBack) && polarityOf(head) > 0) {
          text = blank(text, sentence.start, sentence.start + comma);
          sarcasm = true;
        }
      }
    }
  }

  // A past visit in a sentence of its own, contrasted with this visit in a
  // later one ("My first visit the pasta came lukewarm. This time it was
  // piping hot."): the past sentence keeps its things and loses its opinions,
  // exactly as a past half does within one sentence.
  sentences.forEach((s, k) => {
    const body = lowerText.slice(s.start, s.end);
    const later = sentences.slice(k + 1).map((t) => lowerText.slice(t.start, t.end));
    const previousVisit = PREVIOUS_VISIT.test(body) && !THIS_VISIT.test(body) && later.some((t) => THIS_VISIT.test(t));
    // "Normally the chai is mast. Aaj …": the usual, set against today, only
    // when today says the opposite.
    const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
    const usual =
      !previousVisit &&
      polarityOf !== undefined &&
      HABITUAL.test(body) &&
      !TODAY.test(body) &&
      later.some((t) => TODAY.test(t) && sign(polarityOf(body)) * sign(polarityOf(t)) < 0);
    if (!previousVisit && !usual) return;
    setAside.push({ start: s.start, end: s.end, text: body.trim(), reason: 'PAST', actor: null });
    const re = /[a-zऀ-ॿ']+|[^a-zऀ-ॿ'\s]+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const word = m[0];
      const named = anchors.has(word) || anchors.has(word.replace(/e?s$/, ''));
      if (!named) text = blank(text, s.start + m.index, s.start + m.index + word.length);
    }
  });

  return { text, setAside, deliverables, sarcasm, elidedNegatives, unsureAttribution };
}

/**
 * The same event, said of a deliverable: an album that "arrived early" is
 * fast delivery, not a punctual team.
 */
export const DELIVERABLE_REMAP: Record<string, string> = {
  punctuality_praise: 'delivery_speed',
  punctuality: 'delivery_delay',
};
