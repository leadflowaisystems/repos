import { redactPii } from '@/lib/redact';
import type { EffectiveVoice } from './voice';

/**
 * REPLY SAFETY (M7).
 *
 * Every suggested reply passes through here before it is stored, whoever wrote
 * it. Nothing that fails a blocking check is ever persisted.
 *
 * The rules are not stylistic preferences. Each one exists because the reply
 * goes out under the business's name, in public, about a real customer:
 *
 *  - a review incentive breaks every platform's rules and can get a business
 *    penalised, so RepOS must never write one even if asked;
 *  - a refund, a compensation offer or a sacking is the owner's decision and
 *    not something a draft may commit them to;
 *  - a medical claim or a confirmation of someone's treatment is both a legal
 *    risk and a privacy breach;
 *  - a phone number or an address in a public reply is customer PII;
 *  - RepOS's own vocabulary (sentiment, themes, analysis) must never leak into
 *    something a customer reads.
 *
 * Checks are marked `blocking` when the text must be refused outright. The
 * non-blocking ones reject an AI draft (there is always a safe fallback) but
 * are only warnings on text a human typed themselves, because a person is
 * allowed to make a commitment on behalf of their own business.
 */

export type SafetyProblem = {
  code: string;
  /** Shown to the operator. Plain language, says what is wrong and why. */
  message: string;
  blocking: boolean;
};

export type SafetyContext = {
  voice: EffectiveVoice;
  /** The customer's own words. Numbers and commitments may be echoed from here. */
  sourceText: string;
  /** Business-supplied context a reply is allowed to restate. */
  allowedContext: string[];
  /**
   * Every figure this text is allowed to state (M8).
   *
   * An owner update legitimately quotes counts, so "did the customer say it?"
   * is the wrong test there. When this is supplied it replaces that test: a
   * number must appear in the deterministic insight or it is invented. Omit it
   * and the customer's own words remain the yardstick, as they are for replies.
   */
  allowedNumbers?: Set<string>;
  /** Owner updates are longer than a public reply. Defaults to reply length. */
  maxWords?: number;
};

export type SafetyResult = {
  ok: boolean;
  /** True when nothing blocking fired: safe to store, even if imperfect. */
  storable: boolean;
  problems: SafetyProblem[];
};

const MIN_WORDS = 6;
const MAX_WORDS = 160;
const MAX_CHARS = 1200;

// --- Patterns --------------------------------------------------------------

/** Review incentives and rating manipulation. Never allowed, in any vertical. */
const INCENTIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:5|five)[\s-]*star\b/i, 'asks for a 5-star rating'],
  [/\b(?:rate|rating)\s+us\b/i, 'asks the customer to rate the business'],
  [
    /\b(?:change|update|revise|edit|raise|improve)\s+(?:your|the)\s+(?:rating|review|star)/i,
    'asks the customer to change their review',
  ],
  [
    /\b(?:remove|delete|take\s+down|withdraw)\s+(?:your|the|this)\s+(?:rating|review|feedback|comment)/i,
    'asks the customer to remove their review',
  ],
  [
    /\b(?:discount|free|complimentary|voucher|coupon|cashback|gift|reward|offer)\b[^.!?]{0,60}\b(?:review|rating|feedback|star)\b/i,
    'offers something in exchange for a review',
  ],
  [
    /\b(?:review|rating|feedback|star)\b[^.!?]{0,60}\b(?:discount|free|complimentary|voucher|coupon|cashback|gift|reward)\b/i,
    'offers something in exchange for a review',
  ],
  [
    /\b(?:write|leave|post|give)\s+(?:us\s+)?(?:a\s+)?(?:good|positive|nice|better)\s+review/i,
    'asks for a positive review',
  ],
];

/** Commitments only the owner can make. */
const UNSAFE_PROMISE_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(?:we\s+(?:will|'ll|have|are going to)\s+refund|full\s+refund|refund\s+(?:you|your|the\s+(?:amount|money))|money\s+will\s+be\s+refunded)\b/i,
    'promises a refund',
  ],
  [
    /\b(?:compensat\w*|reimburse\w*|make\s+it\s+up\s+to\s+you\s+with|free\s+(?:visit|session|meal|treatment|service)\s+next\s+time)\b/i,
    'promises compensation',
  ],
  [
    /\b(?:we\s+have\s+)?(?:fired|sacked|terminated|dismissed|suspended)\s+(?:the|our|that)\s+\w+/i,
    'claims a staff member was dismissed',
  ],
  [
    /\b(?:we\s+(?:have|'ve)\s+(?:installed|hired|replaced|rebuilt|renovated|added\s+more)|starting\s+(?:tomorrow|next\s+week|monday)|from\s+next\s+(?:week|month))\b/i,
    'claims an operational change that may not have happened',
  ],
  [
    /\b(?:we\s+(?:accept|admit|acknowledge)\s+(?:full\s+)?(?:liability|responsibility\s+in\s+law|negligence)|legally\s+(?:liable|responsible)|our\s+fault\s+in\s+law)\b/i,
    'makes a legal admission',
  ],
  [
    /\b(?:guarantee\w*|assure\s+you\s+(?:that\s+)?this\s+will\s+never|promise\s+(?:you\s+)?(?:it|this)\s+will\s+never)\b/i,
    'gives a guarantee the business cannot keep',
  ],
];

/** Health claims and anything that confirms a person's care in public. */
const MEDICAL_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(?:cure[sd]?|cured|curing|healed|fully\s+recovered|no\s+side\s+effects?|100%\s+safe|completely\s+safe|risk[\s-]free)\b/i,
    'makes a medical claim',
  ],
  [
    /\b(?:your|the\s+patient'?s?)\s+(?:diagnosis|treatment|prescription|test\s+results?|reports?|condition|surgery|procedure|medication)\b/i,
    "confirms someone's medical details in public",
  ],
  [
    /\b(?:you\s+(?:were|are)\s+(?:diagnosed|treated|prescribed|operated)|as\s+your\s+(?:doctor|dentist|physician))\b/i,
    "confirms someone's medical details in public",
  ],
  [
    /\b(?:this\s+(?:medicine|treatment|procedure)\s+(?:will|does)\s+(?:cure|fix|solve))\b/i,
    'makes a medical claim',
  ],
];

/** RepOS's own vocabulary. A customer must never see any of it. */
const INTERNAL_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(?:repos|sentiment\s+(?:score|analysis)|taxonomy|classifier|our\s+(?:ai|analysis|system)\s+(?:flagged|detected|classified)|confidence\s+level|theme\s+key)\b/i,
    'mentions RepOS or its internal analysis',
  ],
  [
    /\b(?:as\s+an\s+ai|language\s+model|i\s+am\s+an\s+ai|generated\s+(?:reply|response)\b)/i,
    'reveals that it was machine-written',
  ],
];

/** Links: RepOS posts nothing, and a URL a model invented would be wrong. */
const LINK_RE = /\b(?:https?:\/\/|www\.)\S+/i;

/** Time commitments, digit or word form. */
const TIME_PROMISE_RE =
  /\b(?:within|in)\s+(?:\d{1,3}|one|two|three|four|five|six|seven|ten|a\s+few|couple\s+of)\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|working\s+days?)\b/gi;

const DIGIT_RE = /\d+(?:[.,]\d+)?/g;

/**
 * Redaction categories that clean pasted text rather than remove an identifier.
 * These must not make a message unpublishable.
 */
const NON_IDENTIFIER_REDACTIONS = new Set(['reviewer profile line']);

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

/** Word-ish containment, so "cure" does not fire inside "secure". */
function containsWord(haystack: string, needle: string): boolean {
  const trimmed = needle.trim().toLowerCase();
  if (trimmed.length === 0) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = /^[a-z0-9]/i.test(trimmed) ? '\\b' : '';
  const tail = /[a-z0-9]$/i.test(trimmed) ? '\\b' : '';
  try {
    return new RegExp(`${boundary}${escaped}${tail}`, 'i').test(haystack);
  } catch {
    return haystack.includes(trimmed);
  }
}

function words(text: string): number {
  const found = text.trim().match(/[\p{L}\p{N}]+/gu);
  return found ? found.length : 0;
}

/**
 * Checks a suggested reply.
 *
 * `sourceText` is the customer's own review: a number or a time frame the
 * customer themselves mentioned may be echoed back ("the 40 minutes you
 * waited"), but one that appears from nowhere is an invented fact.
 */
export function checkDraft(draft: string, context: SafetyContext): SafetyResult {
  const problems: SafetyProblem[] = [];
  const text = draft.trim();
  const lower = normalise(text);
  const haystack = normalise(
    [context.sourceText, ...context.allowedContext].join(' \n '),
  );

  const add = (code: string, message: string, blocking: boolean) => {
    if (!problems.some((p) => p.code === code)) problems.push({ code, message, blocking });
  };

  // --- Shape ---------------------------------------------------------------
  if (text.length === 0) {
    add('empty', 'The reply is empty.', true);
    return { ok: false, storable: false, problems };
  }

  const wordCount = words(text);
  const maxWords = context.maxWords ?? MAX_WORDS;
  const maxChars = Math.max(MAX_CHARS, maxWords * 12);
  if (wordCount < MIN_WORDS) {
    add('too_short', 'The message is too short to be worth sending.', false);
  }
  if (wordCount > maxWords || text.length > maxChars) {
    add('too_long', 'The message is far longer than it should be.', false);
  }

  // --- Never allowed -------------------------------------------------------
  for (const [pattern, what] of INCENTIVE_PATTERNS) {
    if (pattern.test(text)) {
      add('incentive', `The reply ${what}. RepOS never does that.`, true);
    }
  }

  for (const [pattern, what] of UNSAFE_PROMISE_PATTERNS) {
    if (pattern.test(text)) {
      add('unsafe_promise', `The reply ${what}, which is not yours to offer here.`, true);
    }
  }

  for (const [pattern, what] of MEDICAL_PATTERNS) {
    if (pattern.test(text)) {
      add('medical', `The reply ${what}.`, true);
    }
  }

  for (const [pattern, what] of INTERNAL_PATTERNS) {
    if (pattern.test(text)) {
      add('internal', `The reply ${what}.`, true);
    }
  }

  if (LINK_RE.test(text)) {
    add('link', 'The reply contains a link. Replies here carry no links.', true);
  }

  // --- Customer PII --------------------------------------------------------
  // The same redactor the intake layer uses, minus its cleaning heuristics.
  // "Reviewer profile line" strips things like "Local Guide · 50 reviews" out
  // of pasted text; it is a tidy-up rule, not an identifier, and an owner
  // update legitimately says "Based on 50 reviews". Only real identifiers
  // block here.
  const identifiers = redactPii(text).removed.filter(
    (label) => !NON_IDENTIFIER_REDACTIONS.has(label),
  );
  if (identifiers.length > 0) {
    add(
      'pii',
      `It contains personal details (${identifiers.join(', ')}), which must never be shared.`,
      true,
    );
  }

  // --- The business's own banned list --------------------------------------
  const banned = [...context.voice.bannedWords, ...context.voice.neverPromise];
  const hits = banned.filter((word) => containsWord(text, word));
  if (hits.length > 0) {
    add(
      'banned_word',
      `The reply uses wording this business does not use: ${hits.join(', ')}.`,
      true,
    );
  }

  // --- Invented facts ------------------------------------------------------
  const timePromises = text.match(TIME_PROMISE_RE) ?? [];
  const inventedTime = timePromises.filter(
    (phrase) => !haystack.includes(normalise(phrase)),
  );
  if (inventedTime.length > 0) {
    add(
      'invented_commitment',
      `The reply commits to a time frame nobody gave it: ${inventedTime.join(', ')}.`,
      false,
    );
  }

  const allowedDigits =
    context.allowedNumbers ?? new Set(haystack.match(DIGIT_RE) ?? []);
  const inventedDigits = [...new Set(text.match(DIGIT_RE) ?? [])].filter(
    (digit) => !allowedDigits.has(digit),
  );
  if (inventedDigits.length > 0) {
    add(
      'invented_number',
      `It states a figure nothing in the stored data supports: ${inventedDigits.join(', ')}.`,
      // An invented statistic in an owner update is worse than in a reply: the
      // owner will act on it. When the caller supplied the allowed figures it
      // means exactly this, so treat a miss as unpublishable.
      context.allowedNumbers !== undefined,
    );
  }

  // --- Repeating the review back -------------------------------------------
  // A reply that quotes most of the review reads as filler.
  if (context.sourceText.trim().length >= 40 && lower.includes(normalise(context.sourceText).slice(0, 40))) {
    add('parrots', 'The reply repeats the review back word for word.', false);
  }

  const blocking = problems.some((p) => p.blocking);
  return { ok: problems.length === 0, storable: !blocking, problems };
}

/** Convenience for the AI path, which requires a completely clean draft. */
export function isCleanDraft(draft: string, context: SafetyContext): boolean {
  return checkDraft(draft, context).ok;
}
