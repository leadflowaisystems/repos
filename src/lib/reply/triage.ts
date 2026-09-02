import type { Pack } from '@/lib/packs';
import type { NormalizedTheme } from '@/lib/analysis/normalize';

/**
 * TRIAGE (M7).
 *
 * Turns "what the customer said" (M6) into "what should happen about it".
 *
 * Everything here is deterministic and explainable. There is no score a model
 * produced: priority is the sum of a fixed list of NAMED signals, and every
 * signal that fired is shown to the operator in plain words next to the number
 * it contributed. If the operator disagrees, they can see exactly why.
 *
 * This layer reads the stored analysis. It never re-reads the text for
 * sentiment — that decision was already made and explained in M6.
 */

/** Bump when the rules below change in a way that should re-triage stored rows. */
export const TRIAGE_VERSION = 1;

export type ResponseClass =
  | 'PRAISE'
  | 'COMPLAINT'
  | 'MIXED'
  | 'QUESTION'
  | 'NEUTRAL';

export type ResponseAction =
  | 'REPLY_RECOMMENDED'
  | 'REPLY_OPTIONAL'
  | 'NO_RESPONSE_NEEDED'
  | 'NEEDS_HUMAN';

export type PriorityBand = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export type PrioritySignal = {
  key: string;
  weight: number;
  /** Shown to the operator verbatim. No jargon, no key names. */
  reason: string;
};

export type Triage = {
  responseClass: ResponseClass;
  responseAction: ResponseAction;
  priorityBand: PriorityBand;
  priorityRank: number;
  signals: PrioritySignal[];
  /** Plain-language reasons, in weight order. */
  reasons: string[];
  version: number;
};

export type TriageInput = {
  text: string;
  stars: number | null;
  reviewDate: Date | null;
  sentiment: string;
  confidence: string;
  themes: NormalizedTheme[];
  pack: Pack;
  /** Anchors "recent". Injected so tests are reproducible. */
  now?: Date;
};

// ---------------------------------------------------------------------------
// Signals in the text
// ---------------------------------------------------------------------------

/**
 * The customer is asking something rather than only reporting.
 *
 * A question can sit inside praise or a complaint, so it is detected on its own
 * and takes precedence when classifying: an unanswered question is the one case
 * where silence is clearly the wrong response.
 */
const QUESTION_MARKERS = [
  // English interrogatives and requests
  'can you', 'could you', 'can i', 'could i', 'do you', 'does anyone', 'are you',
  'is there', 'is it possible', 'how do i', 'how can i', 'how much', 'how long',
  'what time', 'what are your', 'when will', 'when can', 'where is', 'where can',
  'please let me know', 'please confirm', 'please tell', 'let me know', 'kindly confirm',
  'would like to know', 'want to know', 'need to know', 'any idea',
  // Romanised Hindi / Marathi
  'kya aap', 'kaise', 'kab tak', 'kahan', 'kitna', 'kitne', 'batao', 'bataye',
  'kaay', 'kuthe', 'kasa', 'kiti', 'kadhi', 'sanga',
  // Devanagari
  'क्या आप', 'कैसे', 'कब', 'कहाँ', 'कहां', 'कितना', 'कितने', 'बताइए', 'बताएं',
  'कसे', 'कुठे', 'किती', 'कधी', 'सांगा', 'का आहे',
];

/**
 * Language that means a person has to decide, not a drafted reply.
 * Deliberately narrow: over-flagging would make the flag meaningless.
 */
const ESCALATION_MARKERS = [
  'legal action', 'legal notice', 'lawyer', 'advocate', 'consumer court',
  'consumer forum', 'police', 'fir', 'sue you', 'suing', 'court case',
  'take this further', 'media', 'news channel', 'defamation',
  'कोर्ट', 'पोलीस', 'पुलिस', 'वकील', 'कायदेशीर', 'कानूनी',
];

/** Harm, safety and money-back language. A draft must never answer these alone. */
const SENSITIVE_MARKERS = [
  'infection', 'infected', 'hospitalised', 'hospitalized', 'admitted to hospital',
  'allergic', 'allergy', 'reaction', 'side effect', 'food poisoning', 'poisoning',
  'injured', 'injury', 'burnt my', 'burned my', 'unsafe', 'assault', 'harass',
  'harassment', 'molest', 'abuse', 'bullying', 'stolen', 'theft', 'robbed',
  'fraud', 'cheated', 'scam', 'refund my money', 'want my money back',
  'return my money', 'money back',
  'संसर्ग', 'इन्फेक्शन', 'ऍलर्जी', 'एलर्जी', 'दुखापत', 'चोरी', 'फसवणूक', 'धोखा',
  'पैसे परत', 'पैसे वापस',
];

function containsAny(haystack: string, needles: string[]): string | null {
  for (const needle of needles) {
    if (haystack.includes(needle)) return needle;
  }
  return null;
}

function looksLikeQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  if (containsAny(lower, QUESTION_MARKERS) !== null) return true;
  // A bare "?" is only a question when there is something before it to ask.
  return /\?/.test(text) && text.replace(/[^\p{L}\p{N}]/gu, '').length >= 8;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * What kind of message this is.
 *
 * A question outranks the sentiment buckets because it changes what the
 * operator has to do: answer it. Everything else follows the sentiment the
 * analysis layer already decided and explained.
 */
export function classifyResponse(input: {
  text: string;
  sentiment: string;
}): ResponseClass {
  if (looksLikeQuestion(input.text)) return 'QUESTION';

  switch (input.sentiment) {
    case 'POSITIVE':
      return 'PRAISE';
    case 'NEGATIVE':
      return 'COMPLAINT';
    case 'MIXED':
      return 'MIXED';
    default:
      return 'NEUTRAL';
  }
}

/** Words a customer actually wrote, ignoring punctuation. */
function wordCount(text: string): number {
  const words = text.trim().match(/[\p{L}\p{N}]+/gu);
  return words ? words.length : 0;
}

/**
 * Whether replying is worth the operator's minutes.
 *
 * NEEDS_HUMAN is reserved for the cases where handing over a drafted reply
 * would be the wrong thing to do: someone is threatening to escalate, someone
 * describes harm, or someone is asking for their money back. A high-severity
 * theme on its own is NOT enough — most complaints carry one, and a flag that
 * fires on everything tells the operator nothing.
 */
export function recommendResponse(input: {
  responseClass: ResponseClass;
  text: string;
  stars: number | null;
  themes: NormalizedTheme[];
}): { action: ResponseAction; reason: string | null } {
  const lower = input.text.toLowerCase();

  if (containsAny(lower, ESCALATION_MARKERS) !== null) {
    return {
      action: 'NEEDS_HUMAN',
      reason: 'The customer mentions taking this further. Handle this one yourself.',
    };
  }
  if (containsAny(lower, SENSITIVE_MARKERS) !== null) {
    return {
      action: 'NEEDS_HUMAN',
      reason:
        'This mentions harm, safety or money back. It needs a person, not a suggested reply.',
    };
  }

  // Nothing else reaches NEEDS_HUMAN. An angry one-star review listing three
  // problems is exactly what a suggested reply is FOR; flagging it would make
  // the flag fire on most complaints and therefore mean nothing.
  const words = wordCount(input.text);

  switch (input.responseClass) {
    case 'COMPLAINT':
    case 'MIXED':
    case 'QUESTION':
      return { action: 'REPLY_RECOMMENDED', reason: null };

    case 'PRAISE':
      // Specific praise is worth thanking by name. A bare "Good" is not.
      return input.themes.length > 0 || words >= 8
        ? { action: 'REPLY_RECOMMENDED', reason: null }
        : { action: 'REPLY_OPTIONAL', reason: null };

    default:
      if (words < 4 && input.themes.length === 0) {
        return { action: 'NO_RESPONSE_NEEDED', reason: null };
      }
      return { action: 'REPLY_OPTIONAL', reason: null };
  }
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

const RECENT_DAYS = 14;

const BAND_HIGH = 40;
const BAND_MEDIUM = 15;

/**
 * Named signals with fixed weights.
 *
 * Positive feedback deliberately scores above zero: praise that nobody ever
 * thanks anyone for is how a business loses the people who liked it. It simply
 * ranks below an operational complaint, which is the honest ordering.
 */
export function prioritySignals(input: {
  responseClass: ResponseClass;
  responseAction: ResponseAction;
  text: string;
  stars: number | null;
  reviewDate: Date | null;
  themes: NormalizedTheme[];
  confidence: string;
  now: Date;
}): PrioritySignal[] {
  const signals: PrioritySignal[] = [];
  const issues = input.themes.filter((t) => t.kind === 'ISSUE');
  const praises = input.themes.filter((t) => t.kind === 'PRAISE');
  const serious = issues.filter((t) => t.severity === 'high');

  if (input.responseAction === 'NEEDS_HUMAN') {
    signals.push({
      key: 'needs_human',
      weight: 50,
      reason: 'Flagged for you to handle personally.',
    });
  }

  if (serious.length > 0) {
    const first = serious[0];
    signals.push({
      key: 'serious_issue',
      weight: 30,
      reason: `Raises ${(first?.label ?? 'a serious problem').toLowerCase()}, which matters a lot to this kind of business.`,
    });
  }

  if (input.stars !== null && input.stars <= 2) {
    signals.push({
      key: 'low_rating',
      weight: 20,
      reason: `Rated ${input.stars} star${input.stars === 1 ? '' : 's'}.`,
    });
  } else if (input.stars === 3) {
    signals.push({ key: 'middling_rating', weight: 10, reason: 'Rated 3 stars.' });
  }

  if (input.responseClass === 'QUESTION') {
    signals.push({
      key: 'question',
      weight: 18,
      reason: 'The customer asked something and is waiting for an answer.',
    });
  }

  if (input.responseClass === 'COMPLAINT') {
    signals.push({ key: 'complaint', weight: 15, reason: 'This is a complaint.' });
  } else if (input.responseClass === 'MIXED') {
    signals.push({
      key: 'mixed',
      weight: 8,
      reason: 'Praise and a problem in the same review.',
    });
  }

  if (issues.length >= 2) {
    signals.push({
      key: 'several_issues',
      weight: 10,
      reason: `Raises ${issues.length} separate problems.`,
    });
  }

  if (input.reviewDate) {
    const days = (input.now.getTime() - input.reviewDate.getTime()) / 86_400_000;
    if (days >= 0 && days <= RECENT_DAYS) {
      signals.push({
        key: 'recent',
        weight: 6,
        reason: 'Left in the last two weeks, so a reply still looks timely.',
      });
    }
  }

  if (praises.length > 0) {
    signals.push({
      key: 'specific_praise',
      weight: 5,
      reason: `Praises ${(praises[0]?.label ?? 'something').toLowerCase()} — worth thanking them for.`,
    });
  } else if (input.responseClass === 'PRAISE') {
    signals.push({
      key: 'general_praise',
      weight: 2,
      reason: 'A kind word, even without detail.',
    });
  }

  if (input.confidence === 'LOW' && input.responseAction !== 'NO_RESPONSE_NEEDED') {
    signals.push({
      key: 'unclear',
      weight: 3,
      reason: 'The wording was hard to read, so it is worth your eyes.',
    });
  }

  return signals;
}

export function bandFor(rank: number): PriorityBand {
  if (rank >= BAND_HIGH) return 'HIGH';
  if (rank >= BAND_MEDIUM) return 'MEDIUM';
  if (rank > 0) return 'LOW';
  return 'NONE';
}

/** The whole triage decision for one analysed item. */
export function triageFeedback(input: TriageInput): Triage {
  const now = input.now ?? new Date();
  const responseClass = classifyResponse({
    text: input.text,
    sentiment: input.sentiment,
  });

  const recommendation = recommendResponse({
    responseClass,
    text: input.text,
    stars: input.stars,
    themes: input.themes,
  });

  const signals = prioritySignals({
    responseClass,
    responseAction: recommendation.action,
    text: input.text,
    stars: input.stars,
    reviewDate: input.reviewDate,
    themes: input.themes,
    confidence: input.confidence,
    now,
  });

  const priorityRank = signals.reduce((sum, s) => sum + s.weight, 0);
  const ordered = [...signals].sort((a, b) => b.weight - a.weight);
  const reasons = recommendation.reason
    ? [recommendation.reason, ...ordered.filter((s) => s.key !== 'needs_human').map((s) => s.reason)]
    : ordered.map((s) => s.reason);

  return {
    responseClass,
    responseAction: recommendation.action,
    priorityBand: bandFor(priorityRank),
    priorityRank,
    signals,
    reasons,
    version: TRIAGE_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Labels — the only wording the UI uses. No technical terms anywhere.
// ---------------------------------------------------------------------------

export const RESPONSE_CLASS_LABELS: Record<string, string> = {
  PRAISE: 'Praise',
  COMPLAINT: 'Complaint',
  MIXED: 'Mixed',
  QUESTION: 'Question',
  NEUTRAL: 'General comment',
  UNCLASSIFIED: 'Not sorted yet',
};

export const RESPONSE_ACTION_LABELS: Record<string, string> = {
  REPLY_RECOMMENDED: 'Reply to this review',
  REPLY_OPTIONAL: 'Reply if you have a minute',
  NO_RESPONSE_NEEDED: 'No reply needed',
  NEEDS_HUMAN: 'Handle this one yourself',
  NONE: 'Not sorted yet',
};

export const PRIORITY_BAND_LABELS: Record<string, string> = {
  HIGH: 'Do this first',
  MEDIUM: 'Worth doing',
  LOW: 'When you have time',
  NONE: 'Nothing needed',
};

export function responseClassLabel(value: string): string {
  return RESPONSE_CLASS_LABELS[value] ?? RESPONSE_CLASS_LABELS.UNCLASSIFIED ?? '';
}

export function responseActionLabel(value: string): string {
  return RESPONSE_ACTION_LABELS[value] ?? RESPONSE_ACTION_LABELS.NONE ?? '';
}

export function priorityBandLabel(value: string): string {
  return PRIORITY_BAND_LABELS[value] ?? PRIORITY_BAND_LABELS.NONE ?? '';
}

/** True when a suggested reply is worth generating for this item. */
export function wantsDraft(action: string): boolean {
  return action === 'REPLY_RECOMMENDED' || action === 'REPLY_OPTIONAL';
}
