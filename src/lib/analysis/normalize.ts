import type { Pack, TaxonomyEntry } from '@/lib/packs';
import { classifyByKeywords, keywordPolarity, type Sentiment } from './classify';
import { detectLanguage, type LanguageCode } from './language';

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
 */
export const ANALYSIS_VERSION = 2;

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
};

/** What an AI provider may contribute. Already sanitised against the taxonomy. */
export type AiSuggestion = {
  issueTags: string[];
  praiseTags: string[];
  sentiment: Sentiment | null;
};

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

/** Polarity implied by the text itself: what the customer actually said. */
function textPolarity(
  text: string,
  issueTags: string[],
  praiseTags: string[],
  aiSentiment: Sentiment | null,
): { polarity: Polarity; reason: string | null } {
  if (issueTags.length > 0 && praiseTags.length > 0) {
    return {
      polarity: 'MIXED',
      reason: 'They praised some things and complained about others.',
    };
  }
  if (issueTags.length > 0) {
    return { polarity: 'NEGATIVE', reason: 'They raised a problem.' };
  }
  if (praiseTags.length > 0) {
    return { polarity: 'POSITIVE', reason: 'They praised something specific.' };
  }

  // Nothing matched the vertical taxonomy. Fall back to plain polarity words.
  const { neg, pos } = keywordPolarity(text.toLowerCase());
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
    return { sentiment: 'MIXED', reason: 'Positive and negative in one review.' };
  }
  if (text === 'NONE') {
    if (rating === 'NONE') {
      return {
        sentiment: 'NEUTRAL',
        reason: 'Nothing in the wording or a rating to go on.',
      };
    }
    if (rating === 'MIXED') {
      return { sentiment: 'MIXED', reason: 'A middle rating with no detail given.' };
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
  // The rating and the wording disagree, or the rating sits in the middle.
  return {
    sentiment: 'MIXED',
    reason:
      rating === 'MIXED'
        ? 'A middle rating alongside a clear opinion in the wording.'
        : 'The star rating and the wording point in different directions.',
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
    return { confidence: 'HIGH', reason: 'Several clear signals point the same way.' };
  }
  return { confidence: 'MEDIUM', reason: 'One clear signal.' };
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

  const keyword = classifyByKeywords(text, stars, pack);
  const usingAi = Boolean(input.ai);

  // The two readers are combined rather than one overriding the other. The AI
  // catches meaning that literal matching misses (especially in mixed-language
  // text); the keyword reader catches explicit mentions the AI skipped. Both
  // have already been filtered against this vertical's taxonomy, so neither can
  // introduce a theme that does not exist — the union cannot fabricate.
  const issueTags = [
    ...new Set([...keyword.issueTags, ...(input.ai?.issueTags ?? [])]),
  ];
  const praiseTags = [
    ...new Set([...keyword.praiseTags, ...(input.ai?.praiseTags ?? [])]),
  ];
  const method: AnalysisMethod = usingAi ? 'AI' : 'KEYWORD';

  const themes = buildThemes(pack, issueTags, praiseTags);

  const text_ = textPolarity(text, issueTags, praiseTags, input.ai?.sentiment ?? null);
  const rating_ = ratingPolarity(stars);
  const composed = composeSentiment(text_.polarity, rating_);

  const graded = gradeConfidence({
    method,
    themeCount: themes.length,
    textPolarity: text_.polarity,
    ratingPolarity: rating_,
    textLength: text.trim().length,
  });

  const reasons: string[] = [];
  if (text_.reason) reasons.push(text_.reason);
  reasons.push(composed.reason);
  reasons.push(graded.reason);

  return {
    language: detectLanguage(text),
    sentiment: composed.sentiment,
    confidence: graded.confidence,
    themes,
    // Preserved in taxonomy order for the existing report engine.
    issueTags: themes.filter((t) => t.kind === 'ISSUE').map((t) => t.key),
    praiseTags: themes.filter((t) => t.kind === 'PRAISE').map((t) => t.key),
    method,
    reasons: [...new Set(reasons)],
    version: ANALYSIS_VERSION,
  };
}

/** Human labels used across the UI. No model or provider jargon. */
export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  POSITIVE: 'Positive',
  NEGATIVE: 'Negative',
  MIXED: 'Mixed',
  NEUTRAL: 'Neutral',
  UNKNOWN: 'Not analysed',
};

export function sentimentLabel(value: string): string {
  return SENTIMENT_LABELS[value as Sentiment] ?? 'Not analysed';
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
