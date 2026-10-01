import type { Pack, TaxonomyEntry } from '@/lib/packs';
import {
  GENERIC_NEGATIVE,
  GENERIC_POSITIVE,
  anchorsOfTopic,
  issuesFromQuantities,
  namedInClause,
  readAspects,
  resultFromWeight,
  topicHasAspect,
  waitFromDuration,
} from './aspects';
import { DELIVERABLE_REMAP, scopeText } from './scope';

/**
 * Local, deterministic keyword classifier.
 *
 * Two jobs:
 *  1. It is the classifier when no AI provider is configured, so RepOS is fully
 *     usable offline — and it is the FIRST reader for everything, AI or not.
 *  2. It is the validator for AI output — any tag the model returns that is not
 *     in the vertical taxonomy is discarded (see `sanitiseTags`), and any tag
 *     the text explicitly negates is refused (see `negatedTags`).
 *
 * It never produces counts. Counting happens in aggregate.ts.
 *
 * WHAT IT READS (intelligence quality pass, Sep 2026):
 *
 *   PACK HINTS    the vertical's own phrases, matched as whole words with a
 *                 plural allowed ("concept" finds "concepts"), and as a prefix
 *                 where the pack writes a stem with a trailing "*"
 *                 ("pressur*" finds "pressure", "pressuring").
 *   ASPECTS       a thing and an opinion about it in the same clause — "the
 *                 paneer was fantastic", "the price felt high", "not very
 *                 clean" (see `aspects.ts`).
 *   PATTERNS      a wait stated as a duration, a weight lost.
 *
 * And three guards, all against inventing a reading:
 *
 *   NEGATION      "no waiting", "not very clean", "nothing is broken",
 *                 "जास्त वेळ लागला नाही" — a negated hint does not count.
 *   MASKING       phrases that only LOOK like a topic — "waiting area",
 *                 "late at night", "slow-cooked", "cold coffee" — are blanked
 *                 before anything is matched.
 *   LONGEST WINS  when one topic's hint sits inside a longer hint of another
 *                 ("delayed" inside "report was delayed"), the longer, more
 *                 specific reading wins and the shorter is dropped.
 */

export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NEUTRAL' | 'UNKNOWN';

export type Classification = {
  issueTags: string[];
  praiseTags: string[];
  sentiment: Sentiment;
  /**
   * The second reader's structured, validated reading (AI contract 2), when
   * it produced one. Carried to `normalizeFeedback`, which arbitrates it
   * against the deterministic reading. Absent for a keyword classification.
   */
  ai?: import('./normalize').AiSuggestion;
  /** A sarcastic opener was found and neutralised: worth a second reader. */
  sarcasm?: boolean;
  /** A "but" whose other side this reader could not read: worth a second reader. */
  unreadContrast?: boolean;
  /** The same across a semicolon; worth a second reader at a middle rating. */
  unreadAfterPause?: boolean;
};

const regexCache = new Map<string, RegExp>();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when every character is ASCII, which decides whether word-boundary
 * matching is safe. Written as a code-point scan rather than a regex: a
 * control-character range in a literal is unreadable and lint-flagged.
 */
function isAsciiHint(hint: string): boolean {
  for (let i = 0; i < hint.length; i += 1) {
    if (hint.charCodeAt(i) > 127) return false;
  }
  return true;
}

/**
 * Negators that appear BEFORE the thing they negate (English, romanised),
 * optionally across one degree word: "not clean", "not VERY clean",
 * "never REALLY friendly".
 */
const PRE_NEGATORS =
  /(?:\b(?:not|no|never|without|n't|nahi|nahin|nai|hardly|barely)\s+(?:(?:very|so|too|that|really|quite|particularly|much|even|the|a|an)\s+)?|\bdidn'?t\s+|\bdoesn'?t\s+|\bwasn'?t\s+|\bisn'?t\s+|\baren'?t\s+|\bweren'?t\s+|\b(?:wernt|dint|didn|wasn|isn|wsnt|wznt)\s+|\b(?:bina|binaa|bagair|baghair)\s+(?:(?:kisi|koi|any)\s+)?)$/i;

/** Negators that appear AFTER the thing they negate (Hindi/Marathi order). */
const POST_NEGATORS =
  /^\s*(?:नाही|नव्हते|नव्हता|नव्हती|नव्हतं|नव्हत्या|नाहीये|नाहीत|नहीं|नही|ना\b|nahi\b|nahin\b|nai\b|navhta\b|navhti\b|navhte\b|navhata\b|nahiye\b)/i;

/**
 * Negators strong enough to flip anything later in the same clause.
 *
 * "Nobody at the desk explained why" sits too far from "explained" for the
 * adjacent check above, but nothing after "nobody" in that clause is a
 * compliment. "Nothing is broken" is the same shape for a complaint.
 * Deliberately narrow: a bare "not" is excluded, because "not only was the
 * staff friendly" is praise.
 */
const CLAUSE_NEGATORS =
  /\b(?:nobody|no one|noone|nothing|never|didn'?t|did not|doesn'?t|does not|wasn'?t|was not|weren'?t|were not|wernt|isn'?t|is not|hasn'?t|has not|haven'?t|have not|won'?t|will not|refused to|failed to|forgot to|not a single|not one|not even one|not once|not any|none of|(?:couldn'?t|could not|can'?t|cannot) (?:find|see|get|spot) (?:a single|even one|one|any))\b/i;

/**
 * ABSENCE COMPLAINTS. Some problems are the absence of an action — no reply,
 * no update, nobody answering, not turning up. For a problem hint that
 * STARTS with one of these actions, a negator in front is the complaint
 * itself, not its denial: "they never reply" and "nobody answers" are the
 * responsiveness problem; "not rude" is still the denial of rudeness.
 */
const ABSENCE_ACTION =
  /^(?:reply|replies|replied|respond\w*|answer\w*|pick(?:s|ed)? up|call(?:s|ed)? back|inform\w*|update\w*|tell|told|explain\w*|show(?:s|ed)? up|turn(?:s|ed)? up|refund\w*|return\w*|deliver\w*|attend\w*|listen\w*|help\w*|come|came|fix\w*|clean\w*)\b/;

/** Clause boundaries, so a negator does not leak into the next thought. */
const CLAUSE_BREAK = /[.!?;,\n।]|\b(?:and|but|though|although|however|while)\b/gi;

/**
 * PHRASES THAT ONLY LOOK LIKE A TOPIC.
 *
 * Each is blanked — replaced by spaces of the same length, so every other
 * position in the text is unchanged — before any hint, aspect or pattern is
 * read. The list is short on purpose: a phrase belongs here only when it is
 * almost never a complaint, whatever the vertical.
 */
const MASKED = [
  'waiting area', 'waiting room', 'waiting hall', 'waiting lounge',
  'late evening', 'late at night', 'late night', 'open late', 'till late',
  'slow-cooked', 'slow cooked', 'slow-roasted', 'slow roasted',
  "can't wait", 'cant wait', 'cannot wait', 'can not wait', 'could not wait to', "couldn't wait to",
  'waiting for it to cool', 'wait for it to cool', 'effort of waiting',
  // A café's own smell is praise more often than not; a bad one says so.
  'smell of coffee', 'smells of coffee', 'smell of fresh', 'smells of fresh', 'smells amazing', 'smells great',
  'smells good', 'smells so good', 'smelled amazing', 'smelt amazing', 'smells divine', 'smelled great', 'smelled good',
  'i was in a hurry', 'i am in a hurry', "i'm in a hurry", 'we were in a hurry', 'in a hurry, but', 'writing this in a hurry',
  'worth the wait', 'worth waiting', 'worth every minute',
  'good crowd', 'lovely crowd', 'nice crowd', 'great crowd',
  'slow learner', 'slow learners',
  // "What kind of service", "kind of slow": a quantifier, not kindness.
  'kind of', 'kinds of',
];

/** "Waiting" naming a place or the people who serve, not a wait. */
const WAITING_LOOKALIKE = /\bwaiting (?:staff|chairs?|sofas?|benches?|bench|seats?|areas?|rooms?|halls?|lounges?|zones?|sections?|space|lobby)\b/g;

/**
 * A drink NAMED by its temperature: "cold coffee", "iced tea", "thandi
 * coffee", "cold brew". The adjective is blanked and the drink kept, so
 * "the cold coffee was amazing" is coffee praise and never a complaint that
 * something was served cold. "The coffee was cold" puts the temperature
 * after the drink and is untouched.
 */
const DRINK_NAMED_BY_TEMPERATURE =
  /\b(?:cold|iced|ice|chilled|thandi|thanda|thande)(?=\s+(?:coffees?|cofees?|coffes?|cofes?|kofis?|brews?|drinks?|beverages?|teas?|lattes?|americanos?|mochas?|chocolates?|shakes?|milkshakes?|cappuccinos?|capucinos?|frappes?)\b)/g;

/**
 * Speed words about something the café does not serve: "the wifi was slow",
 * "slow internet". Blanked so they never read as slow service.
 */
const NOT_SERVICE_SPEED =
  /\b(?:wi-?fi|internet|network|connection|signal|lift|elevator|fan|music)\b[^.,!?;\n]{0,15}?\bslow\w*\b|\bslow\w*\s+(?:wi-?fi|internet|network|connection|signal|music|song|songs)\b/g;

/** "A good 20 minutes" measures a wait; it does not praise anything. */
const GOOD_AS_QUANTITY = /\ba good(?=\s+(?:\d+|few|ten|fifteen|twenty|thirty|forty|half an?|hour|hours|while)\b)/g;

export function maskNeutralPhrases(lowerText: string): string {
  let out = lowerText.replace(WAITING_LOOKALIKE, (m) => ' '.repeat('waiting'.length) + m.slice('waiting'.length));
  out = out.replace(GOOD_AS_QUANTITY, (m) => ' '.repeat(m.length));
  out = out.replace(DRINK_NAMED_BY_TEMPERATURE, (m) => ' '.repeat(m.length));
  out = out.replace(NOT_SERVICE_SPEED, (m) => ' '.repeat(m.length));
  for (const phrase of MASKED) {
    let idx = out.indexOf(phrase);
    while (idx !== -1) {
      out = out.slice(0, idx) + ' '.repeat(phrase.length) + out.slice(idx + phrase.length);
      idx = out.indexOf(phrase, idx + phrase.length);
    }
  }
  return out;
}

/** Where the clause containing `idx` starts. */
function clauseStart(lowerText: string, idx: number): number {
  CLAUSE_BREAK.lastIndex = 0;
  let start = 0;
  let m: RegExpExecArray | null = CLAUSE_BREAK.exec(lowerText);
  while (m !== null && m.index < idx) {
    start = m.index + m[0].length;
    m = CLAUSE_BREAK.exec(lowerText);
  }
  return start;
}

type Found = { index: number; length: number };

/**
 * Where `hint` occurs inside `lowerText`, and how long the match is.
 *
 * Latin hints match whole words, with a plural "s"/"es" allowed on the last
 * word; a hint ending in "*" is a stem and matches any word it begins. Other
 * scripts match as a plain substring, because word boundaries are unreliable
 * around Devanagari combining marks.
 */
function findHintAt(hint: string, lowerText: string): Found | null {
  const raw = hint.toLowerCase().trim();
  if (raw.length === 0) return null;
  const stem = raw.endsWith('*');
  const needle = stem ? raw.slice(0, -1) : raw;
  if (needle.length === 0) return null;

  if (!isAsciiHint(needle)) {
    const index = lowerText.indexOf(needle);
    return index === -1 ? null : { index, length: needle.length };
  }

  const key = `${stem ? 'S' : 'W'}:${needle}`;
  let re = regexCache.get(key);
  if (!re) {
    const tail = stem ? '[a-z]*' : /[a-z]$/.test(needle) ? '(?:s|es)?' : '';
    re = new RegExp(`(?:^|[^a-z0-9])(${escapeRegex(needle)}${tail})(?:[^a-z0-9]|$)`, 'i');
    regexCache.set(key, re);
  }
  const m = re.exec(lowerText);
  if (!m || m[1] === undefined) return null;
  return { index: m.index + m[0].indexOf(m[1]), length: m[1].length };
}

function negatedAround(lowerText: string, found: Found): boolean {
  const before = lowerText.slice(Math.max(0, found.index - 24), found.index);
  if (PRE_NEGATORS.test(before)) return true;
  const after = lowerText.slice(found.index + found.length, found.index + found.length + 16);
  if (POST_NEGATORS.test(after)) return true;
  // A strong negator earlier in the same clause counts too.
  return CLAUSE_NEGATORS.test(lowerText.slice(clauseStart(lowerText, found.index), found.index));
}

/**
 * True when the hint occurs and is not negated.
 *
 * "the place was not clean" must not count as a cleanliness compliment, and
 * "उशीर झाला नाही" ("there was no delay") must not count as a delay complaint.
 */
export function hintMatches(hint: string, lowerText: string): boolean {
  const found = findHintAt(hint, lowerText);
  return found !== null && !negatedAround(lowerText, found);
}

type TopicMatch = { key: string; kind: 'ISSUE' | 'PRAISE'; spans: Found[] };

/** A match of two or more words is a specific phrase; a single word is weaker evidence. */
/**
 * A phrase of two or more words is specific evidence, and so is a single word
 * that can only mean one kind of thing ("bland", "rude", "overpriced"). Only a
 * GENERIC opinion word ("good", "nice", "gentle") is weak: it says something
 * was liked, not what.
 */
function isStrongSpan(lowerText: string, span: Found): boolean {
  const matched = lowerText.slice(span.index, span.index + span.length).trim();
  return /\s/.test(matched) || !OPINION_ONLY.has(matched);
}

/**
 * Every taxonomy entry whose hints occur un-negated, with where; and the keys
 * whose hints occur ONLY negated — the topics the customer said did not
 * happen, which no second reader may put back.
 */
function matchEntries(
  entries: TaxonomyEntry[],
  kind: 'ISSUE' | 'PRAISE',
  lowerText: string,
): { matched: TopicMatch[]; negated: string[] } {
  const matched: TopicMatch[] = [];
  const negated: string[] = [];
  for (const entry of entries) {
    const spans: Found[] = [];
    let sawNegated = false;
    for (const hint of entry.hints) {
      const found = findHintAt(hint, lowerText);
      if (!found) continue;
      const absence = kind === 'ISSUE' && ABSENCE_ACTION.test(hint.toLowerCase().replace(/\*$/, ''));
      if (negatedAround(lowerText, found) && !absence) sawNegated = true;
      else spans.push(found);
    }
    if (spans.length > 0) matched.push({ key: entry.key, kind, spans });
    else if (sawNegated) negated.push(entry.key);
  }
  return { matched, negated };
}

/**
 * LONGEST WINS. A topic whose every match sits inside a longer match of a
 * different topic is the shorter, vaguer reading of the same words, and is
 * dropped: "report was delayed" is a follow-up problem, not a waiting-room
 * one, and "no individual attention" is not praise for attention.
 */
function longestWins(matches: TopicMatch[]): TopicMatch[] {
  return matches.filter((m) =>
    !m.spans.every((span) =>
      matches.some(
        (other) =>
          other.key !== m.key &&
          other.spans.some(
            (o) =>
              o.length > span.length &&
              o.index <= span.index &&
              o.index + o.length >= span.index + span.length,
          ),
      ),
    ),
  );
}

export type TopicStrength = 'STRONG' | 'WEAK';

export type Abstention = {
  reason: 'NOT_ABOUT_BUSINESS' | 'PAST';
  /** The clause set aside, as written (lowercased). */
  text: string;
};

export type TopicReading = {
  issueTags: string[];
  praiseTags: string[];
  /** Topics the text names only to negate. A second reader may not add them. */
  negatedTags: string[];
  /**
   * Topics the words would have supported had a clause been about the
   * business now — "the baraat ran late" would have been punctuality. Refused
   * like a negation: no second reader may add them.
   */
  unattributedTags: string[];
  /** How specific the evidence for each found topic is. */
  strength: Record<string, TopicStrength>;
  /** The clauses set aside, and why. */
  abstentions: Abstention[];
  /** The text the reading was taken from: lowercased, masked, scoped. */
  scopedText: string;
  /** A sarcastic opener was neutralised. */
  sarcasm: boolean;
  /** Elided negations ("the showers aren't"): negative wording with its words left out. */
  elidedNegatives: number;
  /**
   * A "but" with an opinion on one side and nothing this reader recognises
   * on the other. The other side goes the other way — that is what "but"
   * means — so the response is mixed, and worth a second reader.
   */
  unreadContrast: boolean;
  /**
   * The same, across a semicolon: "friendly nurses; the forms were endless".
   * A semicolon does not turn the way "but" does, so this counts only where
   * the rating says the response was not all praise.
   */
  unreadAfterPause: boolean;
  /** See `ScopedText.unsureAttribution`: never HIGH. */
  unsureAttribution: boolean;
  /**
   * The response puts its problem on whoever carried the order, or says the
   * café was not at fault, and nothing names the café as the cause. Its star
   * rating is then not evidence against the café on its own.
   */
  blamedElsewhere: boolean;
};

type OneReading = {
  issueSet: Set<string>;
  praiseSet: Set<string>;
  negated: string[];
  strength: Record<string, TopicStrength>;
};

function readOnce(lower: string, pack: Pack, deliverables: Array<{ start: number; end: number }>): OneReading {
  const issues = matchEntries(pack.issueTaxonomy, 'ISSUE', lower);
  const praise = matchEntries(pack.praiseTaxonomy, 'PRAISE', lower);
  const kept = longestWins([...issues.matched, ...praise.matched]);

  const strength: Record<string, TopicStrength> = {};
  const mark = (key: string, s: TopicStrength) => {
    if (s === 'STRONG' || !strength[key]) strength[key] = s;
  };
  const issueSet = new Set<string>();
  const praiseSet = new Set<string>();
  const issueKeys = new Set(pack.issueTaxonomy.map((e) => e.key));
  const praiseKeys = new Set(pack.praiseTaxonomy.map((e) => e.key));

  for (const raw of kept) {
    // THE ENTITY GUARD. A hint that names no thing of its own, in a clause
    // that names a different thing, belongs to that thing: "the receptionist
    // was kind" is not the doctor's kindness, "gentle dentist" is not the
    // front desk's. Only for a topic the vertical can name through a thing;
    // where it cannot, there is nothing to check against and the hint stands.
    const spans = topicHasAspect(pack.id, raw.key)
      ? raw.spans.filter((s) => {
          const hint = lower.slice(s.index, s.index + s.length);
          // Only a hint that is itself just an opinion ("gentle", "was kind");
          // a phrase that says what happened ("nobody called") names its event.
          if (!OPINION_ONLY.has(hint.trim())) return true;
          // A hint that names its own thing ("food was good") is self-evidently about it.
          const words = hint.split(/\s+/);
          const namesItself = anchorsOfTopic(pack.id, raw.key).some((a) =>
            a.split(/\s+/).every((w) => words.some((h) => h === w || h === `${w}s` || h === `${w}es`)),
          );
          if (namesItself) return true;
          const named = namedInClause(lower, s.index, pack.id);
          return !named.anyThing || named.topics.has(raw.key);
        })
      : raw.spans;
    if (spans.length === 0) continue;
    const m = { ...raw, spans };
    // An album that "arrived early" is fast delivery, not a punctual team.
    const inDeliverable = m.spans.every((s) => deliverables.some((d) => s.index >= d.start && s.index < d.end));
    const remapped = inDeliverable ? DELIVERABLE_REMAP[m.key] : undefined;
    const key = remapped && (issueKeys.has(remapped) || praiseKeys.has(remapped)) ? remapped : m.key;
    (issueKeys.has(key) ? issueSet : praiseSet).add(key);
    mark(key, m.spans.some((s) => isStrongSpan(lower, s)) ? 'STRONG' : 'WEAK');
  }

  const aspects = readAspects(lower, pack);
  for (const key of aspects.issueTags) issueSet.add(key);
  for (const key of aspects.praiseTags) praiseSet.add(key);
  for (const [key, s] of Object.entries(aspects.strength)) mark(key, s);
  const wait = waitFromDuration(lower, pack);
  if (wait) {
    issueSet.add(wait);
    mark(wait, 'STRONG');
  }
  const result = resultFromWeight(lower, pack);
  if (result) {
    praiseSet.add(result);
    mark(result, 'STRONG');
  }
  for (const key of issuesFromQuantities(lower, pack)) {
    issueSet.add(key);
    mark(key, 'STRONG');
  }

  return { issueSet, praiseSet, negated: [...issues.negated, ...praise.negated], strength };
}

const CONTRAST = /\b(?:but|however|though|although|yet|except)\b/;

/** See `TopicReading.unreadContrast` and `unreadAfterPause`. */
function unreadContrast(scopedText: string, pack: Pack, at: RegExp = CONTRAST): boolean {
  const m = at.exec(scopedText);
  if (!m) return false;
  const sides = [scopedText.slice(0, m.index), scopedText.slice(m.index + m[0].length)];
  // Only praise, then an unread half: "lovely ambience, but the rotis were
  // chewy". A "but" between two facts ("the listing said 1000 sq ft but the
  // flat was smaller") or after a complaint turns nothing we can read.
  const before = keywordPolarity(sides[0]!);
  const read = readOnce(sides[0]!, pack, []);
  const praised = before.pos + read.praiseSet.size > 0 && before.neg + read.issueSet.size === 0;
  const after = keywordPolarity(sides[1]!);
  const afterRead = readOnce(sides[1]!, pack, []);
  const unread = after.pos + after.neg + afterRead.issueSet.size + afterRead.praiseSet.size === 0;
  const content = (sides[1]!.match(/[a-z\u0900-\u097F]+/g) ?? []).filter((w) => !FUNCTION_WORDS.has(w)).length;
  return praised && unread && content >= 2;
}

const FUNCTION_WORDS = new Set([
  'of', 'the', 'a', 'an', 'to', 'in', 'on', 'at', 'for', 'it', 'is', 'was', 'were', 'are', 'and', 'so', 'because',
  'i', 'we', 'me', 'my', 'our', 'they', 'he', 'she', 'you', 'still', 'also', 'just',
]);

/**
 * Every topic the deterministic reader finds in this text, in taxonomy order.
 *
 * First the text is SCOPED (`scope.ts`): a clause about someone other than
 * the business, or about a past that has ended, is set aside and recorded as
 * an abstention. Then hints, aspects and patterns are read from what is left.
 *
 * Pure: no database, no network, no clock. The same sentence always reads
 * the same way.
 */
export function readTopics(text: string, pack: Pack, stars: number | null = null): TopicReading {
  const masked = maskNeutralPhrases(text.toLowerCase());
  // Polarity of a span, for the scope reader's change-over-time rule: the
  // plain opinion words plus the topics the span alone supports.
  const polarityOf = (span: string) => {
    const words = keywordPolarity(span);
    const topics = readOnce(span, pack, []);
    return words.pos + topics.praiseSet.size - (words.neg + topics.issueSet.size);
  };
  const scope = scopeText(masked, pack, polarityOf);
  const now = readOnce(scope.text, pack, scope.deliverables);

  // What the set-aside clauses would have added: refused, not reassigned.
  let unattributedTags: string[] = [];
  let unsureAttribution = scope.unsureAttribution;
  if (scope.setAside.length > 0) {
    const all = readOnce(masked, pack, scope.deliverables);
    unattributedTags = [...all.issueSet, ...all.praiseSet].filter((k) => !now.issueSet.has(k) && !now.praiseSet.has(k));
  }
  // AN ORDER THAT TRAVELLED WITH SOMEONE ELSE. When the response names a
  // delivery partner or app, or says the café was not at fault, lateness,
  // an order that arrived cold and a spill may have been the café's or the
  // ride's — and the words rarely say which. Those three are not filed
  // against the café ("the rider took 50 minutes, my mocha was ice cold")
  // unless the response says the café caused it ("…because the restaurant
  // wasn't ready" is still slow service). Refused, so no second reader adds
  // them back either.
  let blamedElsewhere = false;
  let scopedText = scope.text;
  const abstentions = scope.setAside.map((s) => ({ reason: s.reason, text: s.text }));
  if (pack.issueTaxonomy.some((e) => e.key === 'delivery_packaging')) {
    const lower = masked;
    const elsewhere = THIRD_PARTY_DELIVERY.test(lower) || NOT_THE_CAFES_FAULT.test(lower);
    if (elsewhere && !CAFE_CAUSED.test(lower)) {
      blamedElsewhere = true;
      for (const key of DELIVERY_CONSEQUENCES) {
        if (now.issueSet.delete(key)) {
          unattributedTags.push(key);
          unsureAttribution = true;
        }
      }
      // The sentences about the ride say nothing about the café's tone
      // either: "the rider took 40 minutes" is not the café being late.
      scopedText = scopedText
        .split(/([.!?;\n।]+)/)
        .map((part) => {
          if (!(THIRD_PARTY_DELIVERY.test(part) || NOT_THE_CAFES_FAULT.test(part)) || !part.trim()) return part;
          abstentions.push({ reason: 'NOT_ABOUT_BUSINESS', text: part.trim() });
          return ' '.repeat(part.length);
        })
        .join('');
    }
  }
  // AN ITEM THAT WAS NOT AVAILABLE IS NOT A WRONG ORDER. "The croissants
  // were finished", "half the menu was not available": refused as a wrong or
  // missing order unless the response also says the order itself went wrong.
  if (pack.issueTaxonomy.some((e) => e.key === 'order_accuracy') && UNAVAILABLE.test(masked) && !ORDER_WENT_WRONG.test(masked)) {
    if (!now.issueSet.has('order_accuracy')) unattributedTags.push('order_accuracy');
  }
  // A WAIT FOR A TABLE IS NOT SLOW SERVICE. Where the pack files the two
  // apart, a waiting word inside a clause about getting a table files the
  // table wait only.
  if (now.issueSet.has('wait_for_table') && now.issueSet.has('service_speed')) {
    const withoutTables = scope.text
      .split(/([.!?;\n।]+)/)
      .map((part) => (TABLE_WAIT_CLAUSE.test(part) ? ' '.repeat(part.length) : part))
      .join('');
    if (!readOnce(withoutTables, pack, scope.deliverables).issueSet.has('service_speed')) now.issueSet.delete('service_speed');
  }

  // A topic found by an aspect or pattern overrides an earlier negated
  // mention of the same hint, but a topic that ONLY appears negated stays
  // refused.
  const negatedTags = [...new Set(now.negated)].filter((key) => !now.issueSet.has(key) && !now.praiseSet.has(key));

  const issueTags = pack.issueTaxonomy.filter((e) => now.issueSet.has(e.key)).map((e) => e.key);
  // A SARCASTIC RESPONSE'S PRAISE NEEDS ITS STARS. Once a response is caught
  // saying the opposite of what it means ("Love how a group took over the
  // whole section… Very peaceful Sunday coffee, thanks."), its remaining
  // praise is filed only when the rating says it was a good visit.
  if (scope.sarcasm && !(stars !== null && stars >= 4)) {
    for (const key of [...now.praiseSet]) now.praiseSet.delete(key);
  }
  const praiseTags = pack.praiseTaxonomy.filter((e) => now.praiseSet.has(e.key)).map((e) => e.key);
  const strength: Record<string, TopicStrength> = {};
  for (const k of [...issueTags, ...praiseTags]) strength[k] = now.strength[k] ?? 'WEAK';

  return {
    issueTags,
    praiseTags,
    negatedTags,
    unattributedTags,
    strength,
    abstentions,
    scopedText,
    sarcasm: scope.sarcasm,
    elidedNegatives: scope.elidedNegatives,
    unreadContrast: unreadContrast(scopedText, pack),
    unreadAfterPause: unreadContrast(scopedText, pack, /;/),
    unsureAttribution,
    blamedElsewhere,
  };
}

/** Whoever carried the order, when it was not the café. */
const THIRD_PARTY_DELIVERY =
  /\b(?:delivery (?:partner|boy|guy|man|person|executive|agent|rider|wala|walla|bhaiya)s?|rider|riders|swiggy|zomato|dunzo|zepto|blinkit|ubereats|courier)\b/;
/** "Not the café's fault", "can't blame the cafe". */
const NOT_THE_CAFES_FAULT =
  /\b(?:not (?:the |their )?(?:cafe|café|restaurant|outlet|shop|staff)'?s? fault|(?:can'?t|cannot|won'?t|not) (?:really )?blam(?:e|ing) (?:the |them|the staff|the (?:cafe|café|restaurant))|no fault of (?:the |theirs|theirs)|cafe ki galti nahi|cafe chi chuk nahi)\b/;
/** The café named as the cause: "…because the restaurant wasn't ready", "the kitchen took 40 minutes". */
const CAFE_CAUSED =
  /\b(?:cafe|café|restaurant|kitchen|outlet|counter)\b[^.!?;]{0,30}\b(?:wasn'?t ready|was not ready|weren'?t ready|not ready|took (?:a long|forever|ages|\d+)|delayed|forgot|was late|were late)\b|\bbecause (?:the )?(?:cafe|café|restaurant|kitchen|outlet)\b/;
/** What a late or rough delivery can do to an order, whoever made it. */
const DELIVERY_CONSEQUENCES = ['served_cold', 'delivery_packaging', 'service_speed'];
/** An item the café did not have. */
const UNAVAILABLE =
  /\b(?:sold out|out of stock|not available|unavailable|wasn'?t available|weren'?t available|were finished|was finished|had finished|finished already|already finished|ran out of|run out of|khatam|nahi hai|available nahi|उपलब्ध नहीं|संपल)\b/;
/** The order itself went wrong. */
const ORDER_WENT_WRONG =
  /\b(?:wrong order|order (?:was |came )?wrong|not what i ordered|missing (?:item|from)|forgot (?:my|our|the) order|never (?:came|arrived)|galat order|order galat|order chukicha|चुकीची ऑर्डर|गलत ऑर्डर)\b/;
/** A clause about getting a table. */
const TABLE_WAIT_CLAUSE = /\b(?:for|to get) (?:a |our |the |any )?(?:table|seat)s?\b|\bto be seated\b|\bwait ?list\b|\bget one\b/;

const NEGATIVE_WORDS = [
  'bad','worst','poor','terrible','awful','horrible','disappoint*','never again','waste','avoid',
  'paani jaisi','pani jaisi','paani jaisa','pani jaisa','chipchipa','chip chipa','bekaar','ghatiya',
  'pathetic','rude','dirty','slow','late','wrong','refuse','refused','cheat','fraud','scam','unhappy',
  'angry','complaint','useless','filthy','lie','broken','not working','stopped working','ignor*','faded',
  'not be returning','not returning','not coming back','never coming back',"won't be back",'will not be back','not coming again',
  'chaos','chaotic','impossible','nightmare','damp','downhill','burnt','burned','disgusting','unacceptable','worse',
  'hate','hated','annoying','mistake','mistakes','overpriced','crooked','uneven','stale','mess','messy','blurry',
  'washed out','took forever','took ages','too long','too slow','too crowded','too expensive','too high','no response',
  'no reply','went silent','nobody answers','missing','pushy','pushed us','pushed me','boring','out of focus',
  'hard to get','hard to reach','difficult to reach','hard to contact','difficult to contact','never mentioned',
  'never discussed','not mentioned','without telling','without informing','never agreed','never asked for',
  'without asking','keep rising','keeps rising','going up','keeps going up','went quiet',
  'bekar','kharab','ganda','galat','galti','bura','faltu',
  'गलती','धीमी','धीमा','हळू','वाईट','खराब','नको','चुकीचे','घाण','निराश','बेकार','गंदा','बुरा','धोका',
];

const POSITIVE_WORDS = [
  'good','great','excellent','amazing','best','wonderful','love','loved','happy',
  'satisfied','recommend','recommended','friendly','clean','helpful','perfect',
  'thank','thanks','fantastic','superb','awesome','nice','beautiful','lovely','stunning',
  'brilliant','outstanding','delicious','tasty','gorgeous','polite','caring','calm','smooth','spotless','relaxing',
  'enjoyed','appreciated','appreciate','reasonable','affordable','professional',
  'accha','acha','achha','acche','mast','badhiya','shandar','sundar','chhan',
  'छान','चांगले','उत्तम','सुंदर','आवडले','धन्यवाद','अच्छा','बढ़िया','शानदार',
];

/**
 * ONE VOCABULARY (final correctness gate). The aspect reader's generic
 * opinion words were a second, different list: "sloppy" was negative next to
 * a thing and invisible on its own. Both readers now use the union. "patient"
 * is left out of the global list, where it is far more often the noun.
 */
const NEGATIVE_VOCABULARY = [...new Set([...NEGATIVE_WORDS, ...GENERIC_NEGATIVE.filter((w) => w !== 'complaint')])];
const POSITIVE_VOCABULARY = [...new Set([...POSITIVE_WORDS, ...GENERIC_POSITIVE.filter((w) => w !== 'patient')])];

/**
 * Hints that are nothing but a GENERIC opinion — words that can describe any
 * thing ("good", "gentle", "was kind"). The entity guard applies only to
 * these: a word specific to one kind of thing ("slow", "overpriced", "rude",
 * "took ages") already says what it is about.
 */
const OPINION_ONLY = new Set([...GENERIC_POSITIVE, ...GENERIC_NEGATIVE].map((w) => w.toLowerCase()));

/**
 * Counts plain positive and negative wording. Exported so the normalization
 * layer can use it as a fallback when nothing matched the vertical taxonomy.
 */
export function keywordPolarity(lowerText: string): { neg: number; pos: number } {
  const text = maskNeutralPhrases(lowerText);
  let neg = 0;
  let pos = 0;
  for (const w of NEGATIVE_VOCABULARY) if (hintMatches(w, text)) neg += 1;
  for (const w of POSITIVE_VOCABULARY) if (hintMatches(w, text)) pos += 1;
  return { neg, pos };
}

/**
 * Sentiment for one review, from the rating and the topics alone.
 *
 * The AI path's fallback. The full composition — wording first, the rating
 * corroborating — lives in `normalize.ts` and is what is stored.
 */
export function deriveSentiment(
  stars: number | null,
  issueTags: string[],
  praiseTags: string[],
  text: string,
): Sentiment {
  if (stars !== null) {
    if (stars >= 4) return issueTags.length > 0 ? 'MIXED' : 'POSITIVE';
    if (stars <= 2) return praiseTags.length > 0 ? 'MIXED' : 'NEGATIVE';
    return 'MIXED';
  }

  if (issueTags.length > 0 && praiseTags.length > 0) return 'MIXED';
  if (issueTags.length > 0) return 'NEGATIVE';
  if (praiseTags.length > 0) return 'POSITIVE';

  const { neg, pos } = keywordPolarity(text.toLowerCase());
  if (neg > pos) return 'NEGATIVE';
  if (pos > neg) return 'POSITIVE';
  if (pos > 0 && neg > 0) return 'MIXED';
  return 'NEUTRAL';
}

/** Classifies one review against the vertical taxonomy, with no AI involved. */
export function classifyByKeywords(
  text: string,
  stars: number | null,
  pack: Pack,
): Classification {
  const { issueTags, praiseTags, scopedText, sarcasm, unreadContrast: contrast, unreadAfterPause } = readTopics(text, pack, stars);
  return {
    issueTags,
    praiseTags,
    // The scoped text: a clause about someone else says nothing about the business's tone either.
    sentiment: deriveSentiment(stars, issueTags, praiseTags, scopedText),
    sarcasm,
    unreadContrast: contrast,
    unreadAfterPause,
  };
}

/**
 * Keeps only tags that exist in this vertical's taxonomy, de-duplicated and in
 * taxonomy order. Everything an AI provider returns passes through here, so a
 * hallucinated tag can never reach the database or a count.
 */
export function sanitiseTags(
  candidate: unknown,
  entries: TaxonomyEntry[],
): string[] {
  if (!Array.isArray(candidate)) return [];
  const valid = new Set(entries.map((e) => e.key));
  const seen = new Set<string>();
  for (const raw of candidate) {
    if (typeof raw !== 'string') continue;
    const key = raw.trim();
    if (valid.has(key)) seen.add(key);
  }
  return entries.filter((e) => seen.has(e.key)).map((e) => e.key);
}

const SENTIMENTS: Sentiment[] = [
  'POSITIVE',
  'NEGATIVE',
  'MIXED',
  'NEUTRAL',
  'UNKNOWN',
];

export function sanitiseSentiment(candidate: unknown): Sentiment | null {
  if (typeof candidate !== 'string') return null;
  const upper = candidate.trim().toUpperCase() as Sentiment;
  return SENTIMENTS.includes(upper) ? upper : null;
}
