import type { Pack } from '@/lib/packs';
import { classifyByKeywords, type Classification } from '@/lib/analysis/classify';

/**
 * WHETHER ONE PIECE OF FEEDBACK NEEDS AN LLM AT ALL.
 *
 * Headway's rule is that AI is an enhancement, never a dependency, and the
 * cheapest call is the one that is not made. This module is where that is
 * decided, once, per item, before any request is built.
 *
 * THREE LEVELS.
 *
 *   1. STRUCTURED INPUT IS NEVER SENT. A star rating, a per-dimension rating
 *      and a tapped signal are already in the taxonomy — they were chosen from
 *      it. Re-reading them through a model could only lose information, and
 *      most submissions to this product are exactly that: taps and no words.
 *
 *   2. CONFIDENT DETERMINISTIC READINGS ARE KEPT. The keyword classifier is
 *      not a fallback here, it is the first pass. When it matches the vertical
 *      taxonomy and the match agrees with the rating, there is nothing an LLM
 *      would add, so nothing is sent.
 *
 *   3. ONLY GENUINELY AMBIGUOUS FREE TEXT GOES OUT. Wording the keywords did
 *      not recognise, a comment that contradicts its own star rating, or text
 *      in a script the hint lists barely cover — those are the cases where a
 *      model earns its keep, and they are a minority of a minority.
 *
 * The decision is a pure function of one item so it can be unit-tested without
 * a database, a provider or a network, and so the reason is recordable.
 */

/** Below this many characters, a comment says no more than the rating does. */
export const MIN_TEXT_FOR_AI = 12;

/**
 * Non-ASCII scripts the keyword hints cover only thinly.
 *
 * The packs carry Devanagari hints (62 of the restaurant pack's 272), but they
 * are a hand-written list, not a language model. A Devanagari or mixed-script
 * comment that matched nothing is far more likely to be a gap in the hints
 * than a genuinely contentless remark, so it is worth a call.
 */
const NON_LATIN = /[ऀ-ॿ]/;

export type AiRouteReason =
  | 'NO_TEXT'
  | 'TEXT_TOO_SHORT'
  | 'KEYWORDS_CONFIDENT'
  | 'NO_KEYWORD_MATCH'
  | 'CONTRADICTS_RATING'
  | 'UNCOVERED_SCRIPT';

export type AiRoute = {
  /** True only for level 3: genuinely ambiguous free text. */
  needsAi: boolean;
  reason: AiRouteReason;
  /** The deterministic reading, always computed, always kept if AI is skipped. */
  keyword: Classification;
};

export type RoutableItem = {
  text: string;
  stars: number | null;
  /** Signal keys the customer tapped. Structured input; never sent anywhere. */
  signals?: string[] | null;
};

/**
 * Decides whether this item is worth an LLM call, and says why.
 *
 * Always runs the keyword pass first — the caller keeps that reading whatever
 * the answer, so a skipped call is never an unread item.
 */
export function routeForAi(item: RoutableItem, pack: Pack): AiRoute {
  const text = item.text.trim();
  const keyword = classifyByKeywords(text, item.stars, pack);

  // Level 1 — structured only. Taps carry their own meaning.
  if (text.length === 0) return { needsAi: false, reason: 'NO_TEXT', keyword };
  if (text.length < MIN_TEXT_FOR_AI) {
    return { needsAi: false, reason: 'TEXT_TOO_SHORT', keyword };
  }

  const tags = keyword.issueTags.length + keyword.praiseTags.length;

  // Level 3a — real words, nothing recognised. The likeliest miss.
  if (tags === 0) {
    return {
      needsAi: true,
      reason: NON_LATIN.test(text) ? 'UNCOVERED_SCRIPT' : 'NO_KEYWORD_MATCH',
      keyword,
    };
  }

  // Level 3b — the words and the stars disagree. "Lovely place" at one star,
  // or a list of faults at five. One of the two is carrying something the
  // other is not, and that is exactly the sentence worth reading properly.
  if (item.stars !== null && contradicts(item.stars, keyword)) {
    return { needsAi: true, reason: 'CONTRADICTS_RATING', keyword };
  }

  // Level 2 — the deterministic pass is confident. Nothing is sent.
  return { needsAi: false, reason: 'KEYWORDS_CONFIDENT', keyword };
}

/**
 * A high rating carrying only complaints, or a low one carrying only praise.
 *
 * Deliberately narrow: a mixed comment ("great food, slow service") matches
 * both lists and is NOT a contradiction — it is the ordinary case this product
 * exists to capture, and the keyword pass handles it correctly.
 */
function contradicts(stars: number, keyword: Classification): boolean {
  const onlyIssues = keyword.issueTags.length > 0 && keyword.praiseTags.length === 0;
  const onlyPraise = keyword.praiseTags.length > 0 && keyword.issueTags.length === 0;
  if (stars >= 4 && onlyIssues) return true;
  if (stars <= 2 && onlyPraise) return true;
  return false;
}

/**
 * How many of a set of items would go to a provider.
 *
 * Used by the pipeline to size a batch before building a prompt, and by the
 * tests that pin the "most feedback costs nothing" promise.
 */
export function countNeedingAi(items: RoutableItem[], pack: Pack): number {
  return items.reduce((n, item) => n + (routeForAi(item, pack).needsAi ? 1 : 0), 0);
}
