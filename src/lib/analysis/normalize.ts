import type { Pack, TaxonomyEntry } from '@/lib/packs';
import { keywordPolarity, maskNeutralPhrases, readTopics, type Abstention, type Sentiment, type TopicReading } from './classify';
import { detectLanguage, type LanguageCode } from './language';
import { GENERIC_NEGATIVE, GENERIC_POSITIVE } from './aspects';

/**
 * FEEDBACK NORMALIZATION — the understanding layer.
 *
 * Turns one sanitised feedback item into a normalized representation: language,
 * themes with their own sentiment, an overall sentiment, a confidence, and the
 * reasons behind the call.
 *
 * Deterministic by construction. A language model may propose which taxonomy
 * themes a review touches — that is genuinely a semantic judgement, especially
 * for mixed Hindi/Marathi/Hinglish text — but it never decides the overall
 * sentiment and never invents a theme: every tag is filtered against the
 * client's vertical pack, and the sentiment is composed here, in code.
 *
 * The original sanitised text is never altered, never translated and never
 * replaced. It stays the evidence behind every conclusion.
 */

/**
 * Bump when the taxonomy, sentiment composition or prompt changes in a way that
 * should cause previously analysed feedback to be reprocessed. Existing items
 * keep their stored version until re-analysis is requested, so the Feedback
 * page simply reports them as not read yet and one click brings them up to date.
 *
 * 2 - neutral nouns removed from the issue taxonomies and negation widened to
 *     the clause, so "loved my haircut ... booked my next appointment" no
 *     longer reads as a complaint.
 * 3 - the intelligence quality pass: plural and stem matching, negation across
 *     degree words ("not very clean"), masked look-alike phrases ("waiting
 *     area"), longest match wins, aspect polarity ("the price felt high"),
 *     durations as waits, AI suggestions refused where the text negates them,
 *     and a middle rating no longer cancels a clear opinion. See
 *     docs/SMART_FEEDBACK_INTELLIGENCE_RULES.md.
 */
export const ANALYSIS_VERSION = 3;

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type AnalysisMethod = 'KEYWORD' | 'AI';
export type ThemeKind = 'PRAISE' | 'ISSUE';

/** One thing a customer mentioned, with the sentiment they mentioned it in. */
export type NormalizedTheme = {
  key: string;
  label: string;
  kind: ThemeKind;
  /** Praise themes are positive, issue themes negative. Never guessed. */
  sentiment: 'POSITIVE' | 'NEGATIVE';
  severity: 'low' | 'medium' | 'high';
};

export type NormalizedFeedback = {
  language: LanguageCode;
  sentiment: Sentiment;
  confidence: Confidence;
  themes: NormalizedTheme[];
  /** Kept for the existing report engine, which reads these two arrays. */
  issueTags: string[];
  praiseTags: string[];
  method: AnalysisMethod;
  /** Plain-language reasons, shown to the operator. No jargon. */
  reasons: string[];
  version: number;
  /**
   * Clauses Headway set aside rather than file: about someone other than the
   * business, or about a past that has ended. Silence, not a guess.
   */
  abstentions: Abstention[];
  /**
   * Concepts on which the two readers disagreed and neither was allowed to
   * win. Headway files nothing about them.
   */
  conflicts: string[];
  /** Nothing in the words could be classified safely. */
  unclassified: boolean;
};

/** One topic a second reader proposed, with how sure it was and the words behind it. */
export type AiTopicSuggestion = {
  key: string;
  kind: 'ISSUE' | 'PRAISE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** The customer's own words that support it, already checked to be in the text. */
  evidence: string | null;
};

/** What an AI provider may contribute. Already sanitised against the taxonomy. */
export type AiSuggestion = {
  issueTags: string[];
  praiseTags: string[];
  sentiment: Sentiment | null;
  /**
   * The structured reading (AI contract 2): each topic with its confidence
   * and evidence. When absent, every tag above counts as MEDIUM confidence.
   */
  topics?: AiTopicSuggestion[];
  /** The second reader declined to classify this response. */
  abstain?: boolean;
};

/** A plain sentence for the reading when nothing could be filed safely. */
export const NOT_ENOUGH_EVIDENCE = 'Not enough evidence to classify this safely.';

type Polarity = 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'NONE';

function labelOf(entries: TaxonomyEntry[], key: string): string {
  return entries.find((e) => e.key === key)?.label ?? key;
}

function severityOf(entries: TaxonomyEntry[], key: string): 'low' | 'medium' | 'high' {
  return entries.find((e) => e.key === key)?.severity ?? 'medium';
}

/** Themes in taxonomy order, so output is stable regardless of tag ordering. */
function buildThemes(
  pack: Pack,
  issueTags: string[],
  praiseTags: string[],
): NormalizedTheme[] {
  const praise: NormalizedTheme[] = pack.praiseTaxonomy
    .filter((entry) => praiseTags.includes(entry.key))
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      kind: 'PRAISE' as const,
      sentiment: 'POSITIVE' as const,
      severity: entry.severity ?? ('medium' as const),
    }));

  const issues: NormalizedTheme[] = pack.issueTaxonomy
    .filter((entry) => issueTags.includes(entry.key))
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      kind: 'ISSUE' as const,
      sentiment: 'NEGATIVE' as const,
      severity: entry.severity ?? ('medium' as const),
    }));

  return [...praise, ...issues];
}

/**
 * THE COMBINED READER: how a second reader's suggestion meets the first.
 *
 *   1. The words have the last say on what they deny. A topic the text
 *      negates ("no waiting") or sets aside as not about the business ("the
 *      baraat ran late") is refused, whatever the second reader says.
 *   2. A LOW-confidence suggestion is dropped. So is anything when the second
 *      reader abstained.
 *   3. Agreement is accepted. A concept the first reader did not touch is
 *      accepted when it is CORROBORATED (AI validation pass):
 *        - its evidence names something: "totally worth it", "lovely
 *          place" are opinions with no object, so they file no topic;
 *        - its evidence is not inside a clause the first reader set aside
 *          ("classes stopped for a week" in "… because of the strike");
 *        - a MEDIUM suggestion needs the rating or the wording to lean the
 *          same way — "the paneer was different from last time", with no
 *          rating and no opinion word, files nothing;
 *        - where the first reader set part of the response aside as about
 *          someone else, a new topic must not contradict the rating ("another
 *          patient's child was crying, nothing the staff could do" at four
 *          stars is not a staff complaint).
 *      A topic only the second reader found is one reader's word: the
 *      reading that includes it is never HIGH.
 *   4. A contradiction — the same concept on the opposite side — is settled
 *      by how specific each reading is:
 *        first reader STRONG (a specific phrase, a specific opinion word)
 *          → the first reader stands; the suggestion is dropped.
 *        first reader WEAK (a single word, "good"/"bad") and the second
 *          reader HIGH → the second reader's reading replaces it.
 *        anything else → neither is filed. The concept is recorded as a
 *          conflict and the reading's confidence drops to LOW.
 *   5. A topic the first reader found and the second did not mention stays:
 *      silence is not a contradiction.
 */
/**
 * Topics whose meaning is a stated fact: a second reader's evidence for one
 * must state it. The evidence is masked first, so "a cold coffee" (the drink)
 * is not a temperature.
 */
const GROUNDING: Record<string, RegExp> = {
  served_cold: /\b(?:cold|colder|lukewarm|luke ?warm|not (?:hot|warm)|wasn'?t (?:hot|warm)|room temp\w*|thand\w*|melted|gaar)\b|थंड|ठंड|गार|गरम नहीं|गरम नव्हत/,
};

function arbitrate(
  pack: Pack,
  keyword: TopicReading,
  ai: AiSuggestion | null | undefined,
  stars: number | null = null,
): { issueTags: string[]; praiseTags: string[]; conflicts: string[]; usedAi: boolean; uncorroborated: string[]; capped: string[]; deferred: string[] } {
  const issues = new Set(keyword.issueTags);
  const praise = new Set(keyword.praiseTags);
  const conflicts: string[] = [];
  const uncorroborated: string[] = [];
  const capped: string[] = [];
  /** Second-reader topics not filed because the first reader had already filed that side. */
  const deferred: string[] = [];
  if (!ai || ai.abstain) return { issueTags: [...issues], praiseTags: [...praise], conflicts, usedAi: Boolean(ai), uncorroborated, capped, deferred };

  // What can corroborate a new topic: the rating, and the opinion words left
  // after scoping. A middle rating says there was some of each.
  const words = keywordPolarity(keyword.scopedText);
  const leans = (kind: 'ISSUE' | 'PRAISE') =>
    kind === 'ISSUE'
      ? (stars !== null && stars <= 3) || words.neg > 0 || keyword.elidedNegatives > 0
      : (stars !== null && stars >= 3) || words.pos > 0;
  const contradictsRating = (kind: 'ISSUE' | 'PRAISE') =>
    stars !== null && (kind === 'ISSUE' ? stars >= 4 : stars <= 2);
  const setAside = keyword.abstentions.filter((a) => a.reason === 'NOT_ABOUT_BUSINESS').map((a) => squashed(a.text));
  // Evidence from a clause the first reader set aside — about someone else,
  // or about an earlier visit — files nothing about the business now.
  const asideAtAll = keyword.abstentions.map((a) => squashed(a.text));
  const insideSetAside = (evidence: string | null) => {
    if (!evidence) return false;
    const e = squashed(evidence);
    return e.length > 0 && asideAtAll.some((a) => a.includes(e) || e.includes(a));
  };
  // The sides the first reader already filed. A second reader may fill a side
  // the first left empty — the half of a mixed response it could not read —
  // but not add a competing label to words the first reader already filed:
  // on the café corpus that was nearly every error the second reader made
  // ("bill said 90" filed as a wrong order, hair in the coffee as coffee
  // quality).
  const firstFiled = { ISSUE: keyword.issueTags.length > 0, PRAISE: keyword.praiseTags.length > 0 };

  const topics: AiTopicSuggestion[] =
    ai.topics ??
    [
      ...ai.issueTags.map((key) => ({ key, kind: 'ISSUE' as const, confidence: 'MEDIUM' as const, evidence: null })),
      ...ai.praiseTags.map((key) => ({ key, kind: 'PRAISE' as const, confidence: 'MEDIUM' as const, evidence: null })),
    ];
  const refused = new Set([...keyword.negatedTags, ...keyword.unattributedTags]);
  const counterpartOfIssue = new Map(pack.issueTaxonomy.map((e) => [e.key, e.counterpart ?? null]));
  const issueKeys = new Set(pack.issueTaxonomy.map((e) => e.key));
  const praiseKeys = new Set(pack.praiseTaxonomy.map((e) => e.key));

  for (const t of topics) {
    if (t.kind === 'ISSUE' ? !issueKeys.has(t.key) : !praiseKeys.has(t.key)) continue;
    if (refused.has(t.key)) {
      uncorroborated.push(t.key);
      continue;
    }
    if (t.confidence === 'LOW') continue;
    // The opposite side of the same concept, as the first reader has it.
    const opposite =
      t.kind === 'ISSUE'
        ? (() => {
            const c = counterpartOfIssue.get(t.key);
            return c && praise.has(c) ? c : null;
          })()
        : ([...issues].find((i) => counterpartOfIssue.get(i) === t.key) ?? null);
    if (!opposite) {
      const known = issues.has(t.key) || praise.has(t.key);
      if (!known) {
        if (insideSetAside(t.evidence) || (t.evidence !== null && !namesSomething(t.evidence))) {
          uncorroborated.push(t.key);
          continue;
        }
        if (firstFiled[t.kind]) {
          deferred.push(t.key);
          continue;
        }
        // In a response caught being sarcastic, praise needs the stars behind
        // it — from either reader.
        if (t.kind === 'PRAISE' && keyword.sarcasm && !(stars !== null && stars >= 4)) {
          uncorroborated.push(t.key);
          continue;
        }
        // A topic whose meaning is a stated fact needs that fact in its
        // evidence: "served cold" needs a temperature, and "a cold coffee"
        // (the drink) is not one.
        const grounding = GROUNDING[t.key];
        if (grounding && (t.evidence === null || !grounding.test(maskNeutralPhrases(t.evidence.toLowerCase())))) {
          uncorroborated.push(t.key);
          continue;
        }
        if (t.confidence !== 'HIGH' && !leans(t.kind)) {
          uncorroborated.push(t.key);
          continue;
        }
        if (setAside.length > 0 && contradictsRating(t.kind)) {
          uncorroborated.push(t.key);
          continue;
        }
        // Accepted, but on one reader's word: never HIGH.
        capped.push(t.key);
      }
      (t.kind === 'ISSUE' ? issues : praise).add(t.key);
      continue;
    }
    const strength = keyword.strength[opposite] ?? 'WEAK';
    if (strength === 'STRONG') continue;
    // Unresolved: the first reader rests on one general word and the second
    // reads the opposite. Neither is filed. (A HIGH second reading used to
    // replace the first; on the café corpus the second reader alone was
    // confidently wrong too often for its confidence to settle anything.)
    (t.kind === 'ISSUE' ? praise : issues).delete(opposite);
    conflicts.push(t.key, opposite);
  }
  return { issueTags: [...issues], praiseTags: [...praise], conflicts: [...new Set(conflicts)], usedAi: true, uncorroborated, capped, deferred };
}

/**
 * Words that name nothing: function words, intensifiers, generic opinion
 * words and generic nouns ("place", "experience"). Evidence made only of
 * these is an opinion with no object.
 */
const NAMES_NOTHING = new Set([
  ...GENERIC_POSITIVE.filter((w) => !/\s/.test(w)),
  ...GENERIC_NEGATIVE.filter((w) => !/\s/.test(w)),
  'a', 'an', 'the', 'it', "it's", 'its', 'is', 'was', 'were', 'are', 'be', 'been', 'this', 'that', 'so', 'very', 'really',
  'totally', 'absolutely', 'truly', 'quite', 'super', 'too', 'just', 'all', 'overall', 'and', 'but', 'of', 'for', 'to',
  'in', 'at', 'with', 'my', 'our', 'we', 'i', 'me', 'us', 'worth', 'place', 'experience', 'everything', 'thing', 'things',
  'time', 'visit', 'one', 'highly', 'recommend', 'recommended', 'thanks', 'thank', 'you', 'ok', 'okay', 'fine',
]);

function namesSomething(evidence: string): boolean {
  const words = squashed(evidence).split(' ').filter(Boolean);
  return words.some((w) => !NAMES_NOTHING.has(w));
}

/** Lowercased, punctuation dropped, whitespace collapsed: for comparing evidence with set-aside clauses. */
const squashed = (t: string) => t.toLowerCase().replace(/[^a-z0-9ऀ-ॿ' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Polarity implied by the text itself: what the customer actually said. */
function textPolarity(
  scopedText: string,
  elidedNegatives: number,
  contrast: boolean,
  issueTags: string[],
  praiseTags: string[],
  aiSentiment: Sentiment | null,
): { polarity: Polarity; reason: string | null } {
  // EVERY CLAUSE COUNTS (final semantic pass). Praise in one clause and a
  // complaint in another is MIXED even when only one of them matched a
  // topic: "decor was beautiful; coordination was poor" is not a positive
  // review because the pack has a topic for decor. The plain polarity words
  // are read from the SCOPED text, so a clause about someone else adds
  // nothing either way.
  const counted = keywordPolarity(scopedText);
  const neg = counted.neg + elidedNegatives;
  const pos = counted.pos;
  const positive = praiseTags.length > 0 || pos > 0;
  const negative = issueTags.length > 0 || neg > 0;
  if (issueTags.length > 0 && praiseTags.length > 0) {
    return {
      polarity: 'MIXED',
      reason: 'They praised some things and complained about others.',
    };
  }
  if (contrast && (positive || negative) && !(positive && negative)) {
    return {
      polarity: 'MIXED',
      reason: 'One half of the response, after a "but" (or, at a middle rating, a semicolon), was not understood. It turns the other way, so this is read as mixed, and nothing was filed for that half.',
    };
  }
  if (positive && negative) {
    return {
      polarity: 'MIXED',
      reason: issueTags.length > 0 || praiseTags.length > 0
        ? 'Besides what was matched to a topic, the wording goes the other way too.'
        : 'The wording is both positive and negative.',
    };
  }
  if (issueTags.length > 0) {
    return { polarity: 'NEGATIVE', reason: 'They raised a problem.' };
  }
  if (praiseTags.length > 0) {
    return { polarity: 'POSITIVE', reason: 'They praised something specific.' };
  }
  if (neg > 0 && pos > 0) {
    return { polarity: 'MIXED', reason: 'The wording is both positive and negative.' };
  }
  if (neg > pos) return { polarity: 'NEGATIVE', reason: 'The wording is negative.' };
  if (pos > neg) return { polarity: 'POSITIVE', reason: 'The wording is positive.' };

  // Still nothing. An AI reading is the last text-based signal available.
  if (aiSentiment && aiSentiment !== 'UNKNOWN' && aiSentiment !== 'NEUTRAL') {
    return {
      polarity:
        aiSentiment === 'MIXED'
          ? 'MIXED'
          : (aiSentiment as 'POSITIVE' | 'NEGATIVE'),
      reason: 'Read from the wording as a whole.',
    };
  }
  return { polarity: 'NONE', reason: null };
}

/** Polarity implied by the star rating alone. */
function ratingPolarity(stars: number | null): Polarity {
  if (stars === null) return 'NONE';
  if (stars >= 4) return 'POSITIVE';
  if (stars <= 2) return 'NEGATIVE';
  return 'MIXED';
}

/**
 * Composes the overall sentiment.
 *
 * The text leads and the rating corroborates. A rating on its own is used only
 * when the wording gives nothing at all, because "4 stars, but the staff were
 * rude" is not a positive review and "Food was excellent but the wait was
 * terrible" is not a positive one either, whatever the stars say.
 */
function composeSentiment(
  text: Polarity,
  rating: Polarity,
): { sentiment: Sentiment; reason: string } {
  if (text === 'MIXED') {
    return { sentiment: 'MIXED', reason: 'Positive and negative in the same comment.' };
  }
  if (text === 'NONE') {
    if (rating === 'NONE') {
      return {
        sentiment: 'NEUTRAL',
        reason: 'Nothing in the wording or a rating to go on.',
      };
    }
    // A middle rating on its own is neither praise nor a complaint. Calling
    // it MIXED claimed the customer said good and bad things; they said
    // neither (final semantic pass).
    if (rating === 'MIXED') {
      return { sentiment: 'NEUTRAL', reason: 'A middle rating, with nothing in the wording either way.' };
    }
    return {
      sentiment: rating as Sentiment,
      reason: 'Only the star rating was available to go on.',
    };
  }
  if (rating === 'NONE') {
    return { sentiment: text as Sentiment, reason: 'Based on the wording; no rating given.' };
  }
  if (rating === text) {
    return { sentiment: text as Sentiment, reason: 'The rating agrees with the wording.' };
  }
  // A middle rating — three stars, "okay" — is not an opinion of its own, so
  // it neither confirms nor cancels a clear one in the wording. "Terrible, cold
  // food and rude staff" at three stars is a complaint; reading it as MIXED
  // would let the rating erase what the customer actually wrote.
  if (rating === 'MIXED') {
    return { sentiment: text as Sentiment, reason: 'A middle rating does not outweigh a clear opinion in the wording.' };
  }
  // The rating and the wording point in opposite directions: both are kept,
  // and the reading says so rather than picking one.
  return {
    sentiment: 'MIXED',
    reason: 'The star rating and the wording point in different directions.',
  };
}

function gradeConfidence(input: {
  method: AnalysisMethod;
  themeCount: number;
  textPolarity: Polarity;
  ratingPolarity: Polarity;
  textLength: number;
}): { confidence: Confidence; reason: string } {
  const { method, themeCount, textLength } = input;
  const agrees =
    input.textPolarity !== 'NONE' &&
    input.ratingPolarity !== 'NONE' &&
    input.textPolarity === input.ratingPolarity;

  if (input.textPolarity === 'NONE' && input.ratingPolarity === 'NONE') {
    return { confidence: 'LOW', reason: 'No rating and no recognisable wording.' };
  }
  if (themeCount === 0) {
    return {
      confidence: 'LOW',
      reason: 'Nothing specific enough to match a known topic.',
    };
  }
  if (themeCount >= 2 || agrees || (method === 'AI' && textLength >= 40)) {
    return { confidence: 'HIGH', reason: 'Several things point the same way.' };
  }
  return { confidence: 'MEDIUM', reason: 'Only one thing points this way.' };
}

export type NormalizeInput = {
  text: string;
  stars: number | null;
  pack: Pack;
  /** Optional, already sanitised against the taxonomy by the caller. */
  ai?: AiSuggestion | null;
};

/**
 * Normalizes one feedback item. Pure: no database, no network, no clock.
 */
export function normalizeFeedback(input: NormalizeInput): NormalizedFeedback {
  const { text, stars, pack } = input;

  const keyword = readTopics(text, pack, stars);

  // The two readers are combined by explicit arbitration (see `arbitrate`):
  // the words have the last say on what they deny or set aside, agreement
  // and new concepts are accepted, and a contradiction is settled by how
  // specific each reading is — or, when neither is, by filing nothing.
  const combined = arbitrate(pack, keyword, input.ai, stars);
  const issueTags = combined.issueTags;
  const praiseTags = combined.praiseTags;
  const method: AnalysisMethod = combined.usedAi ? 'AI' : 'KEYWORD';
  // A second reading refused for want of corroboration, or in conflict with
  // the first, lends nothing to the tone either.
  const aiSentiment =
    input.ai && !input.ai.abstain && combined.uncorroborated.length === 0 && combined.conflicts.length === 0
      ? input.ai.sentiment
      : null;

  const themes = buildThemes(pack, issueTags, praiseTags);

  // A low rating on a response that blames the delivery and names no café
  // complaint is the delivery's rating, not the café's.
  const ratingAboutSomeoneElse = keyword.blamedElsewhere && issueTags.length === 0 && ratingPolarity(stars) === 'NEGATIVE';
  const rating_ = ratingAboutSomeoneElse ? 'NONE' : ratingPolarity(stars);
  // An unread half after a semicolon counts only at a middle rating: there
  // the stars say not everything was praise, and the unread half is where
  // the rest went.
  const unread = keyword.unreadContrast || (keyword.unreadAfterPause && rating_ === 'MIXED');
  // The unread half still turns the response unless the second reader read
  // the whole of it as one-sided: it agreeing "MIXED" while filing nothing
  // for that half leaves the inference standing.
  const contrastStands = unread && (aiSentiment === null || aiSentiment === 'MIXED' || aiSentiment === 'UNKNOWN');
  const text_ = textPolarity(keyword.scopedText, keyword.elidedNegatives, contrastStands, issueTags, praiseTags, aiSentiment);
  const composed = composeSentiment(text_.polarity, rating_);

  const graded = gradeConfidence({
    method,
    themeCount: themes.length,
    textPolarity: text_.polarity,
    ratingPolarity: rating_,
    textLength: text.trim().length,
  });
  // Anything set aside or contested caps how sure the reading may claim to
  // be — and so does any topic resting on WEAK evidence (a single word, a
  // generic "good"): HIGH is only for a reading whose every topic is specific.
  const aiStrong = new Set((input.ai?.topics ?? []).filter((t) => t.confidence === 'HIGH').map((t) => t.key));
  const weakTopic = themes.some((t) => (keyword.strength[t.key] ?? (aiStrong.has(t.key) ? 'STRONG' : 'WEAK')) === 'WEAK');
  const guarded =
    combined.conflicts.length > 0
      ? { confidence: 'LOW' as const, reason: 'The two readings disagreed about part of this, so that part was not filed.' }
      : (keyword.abstentions.length > 0 || weakTopic || unread || combined.capped.length > 0 || keyword.unsureAttribution) && graded.confidence === 'HIGH'
        ? {
            confidence: 'MEDIUM' as const,
            reason: weakTopic
              ? 'Part of this rests on a single general word.'
              : keyword.unsureAttribution
                ? 'It does not say plainly who was responsible.'
                : graded.reason,
          }
        : graded;
  const unclassified = text.trim().length > 0 && themes.length === 0 && text_.polarity === 'NONE';

  const reasons: string[] = [];
  if (unclassified) reasons.push(NOT_ENOUGH_EVIDENCE);
  for (const a of keyword.abstentions) {
    reasons.push(
      a.reason === 'PAST'
        ? `"${a.text}" describes how things used to be, so it was not counted as how they are now.`
        : `"${a.text}" is about someone other than the business, so it was not counted for or against it.`,
    );
  }
  if (text_.reason) reasons.push(text_.reason);
  if (ratingAboutSomeoneElse) reasons.push('The low rating is about the delivery, which the response does not blame on the business.');
  reasons.push(composed.reason);
  reasons.push(guarded.reason);

  return {
    language: detectLanguage(text),
    sentiment: composed.sentiment,
    confidence: guarded.confidence,
    themes,
    // Preserved in taxonomy order for the existing report engine.
    issueTags: themes.filter((t) => t.kind === 'ISSUE').map((t) => t.key),
    praiseTags: themes.filter((t) => t.kind === 'PRAISE').map((t) => t.key),
    method,
    reasons: [...new Set(reasons)],
    version: ANALYSIS_VERSION,
    abstentions: keyword.abstentions,
    conflicts: combined.conflicts,
    unclassified,
  };
}

/**
 * Human labels used across the UI. No model or provider jargon.
 *
 * UNKNOWN is not a tone, it is the absence of one, so it says what actually
 * happened: Headway has not read this piece of feedback yet. "Analysed" is
 * the code's word for that work; "read" is the word every screen uses.
 */
export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  POSITIVE: 'Positive',
  NEGATIVE: 'Negative',
  MIXED: 'Mixed',
  NEUTRAL: 'Neutral',
  UNKNOWN: 'Not read yet',
};

export function sentimentLabel(value: string): string {
  return SENTIMENT_LABELS[value as Sentiment] ?? 'Not read yet';
}

export const LANGUAGE_LABELS_UI: Record<LanguageCode, string> = {
  en: 'English',
  hi: 'Hindi',
  mr: 'Marathi',
  mixed: 'Mixed / Hinglish',
  unknown: 'Unknown',
};

export function languageLabel(value: string | null): string {
  if (!value) return 'Unknown';
  return LANGUAGE_LABELS_UI[value as LanguageCode] ?? 'Unknown';
}

export function labelForIssue(pack: Pack, key: string): string {
  return labelOf(pack.issueTaxonomy, key);
}

export function labelForPraise(pack: Pack, key: string): string {
  return labelOf(pack.praiseTaxonomy, key);
}

export function severityForIssue(pack: Pack, key: string) {
  return severityOf(pack.issueTaxonomy, key);
}
