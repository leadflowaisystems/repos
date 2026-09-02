/**
 * Deterministic PII redaction.
 *
 * RepOS never stores end-customer personal information, and never sends it to
 * an AI provider. Every piece of pasted review text passes through `redactPii`
 * BEFORE it is written to SQLite, so the database itself never holds an email,
 * a phone number or an @handle. See COMPLIANCE.md.
 *
 * This is a safety net, not a licence to paste PII: the UI also tells the
 * operator to paste review text only.
 */

export type RedactionResult = {
  text: string;
  redacted: boolean;
  /** Human-readable categories that were removed, for operator feedback. */
  removed: string[];
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** +91 98765 43210, 09876543210, 98765-43210, (022) 2345 6789 … */
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d(?:[\s.-]?\d){8,13}/g;

/** Any remaining run of 7+ digits (account numbers, IDs, order numbers). */
const LONG_DIGITS_RE = /\d[\d\s.-]{6,}\d/g;

/** Social handles. Runs after emails so it cannot eat an address. */
const HANDLE_RE = /(^|[^\w@])@[a-z0-9._]{2,30}\b/gi;

/**
 * Address-like patterns. Each requires a digit in the identifier, so ordinary
 * business text ("the shop was clean", "room for improvement") is untouched.
 */
const ADDRESS_UNIT_RE =
  /\b(?:flat|plot|house|door|building|apartment|apt)\s*(?:no\.?|number|#)?\s*[-:]?\s*(?=[\w/-]*\d)[\w/-]{1,12}\b/gi;

/** Weaker words need an explicit "no./number/#" marker before they count. */
const ADDRESS_UNIT_MARKED_RE =
  /\b(?:shop|room|block|gala|survey)\s*(?:no\.?|number|#)\s*[-:]?\s*(?=[\w/-]*\d)[\w/-]{1,12}\b/gi;

/** "12 MG Road", "45/2 Shivaji Nagar", "8 Baker Street". */
const STREET_RE =
  /\b\d{1,4}[a-z]?(?:[/-]\d{1,4})?,?\s+(?:[A-Za-z][\w.]*\s+){0,3}(?:road|rd|street|st|lane|ln|marg|nagar|colony|society|apartments?|towers?|chowk|cross|gali|peth|wadi|vihar|enclave)\b/gi;

/** Only with an explicit pin/zip marker — a bare 6-digit number is not an address. */
const PINCODE_RE = /\b(?:pin\s*code|pincode|pin|postal\s*code|zip)\s*[:#-]?\s*\d{6}\b/gi;

/**
 * Booking / order / patient references. The marker word AND a digit are both
 * required, so "the bill was too high" is left alone but "bill no 4471" is not.
 */
const REFERENCE_RE =
  /\b(?:order|booking|invoice|bill|patient|appointment|reference|ref|ticket|token|receipt)\s*(?:id|no\.?|number|#)\s*[:#-]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9][A-Za-z0-9-]{2,}\b/gi;

/** Review-platform boilerplate that identifies a reviewer profile. */
const PROFILE_BOILERPLATE_RE =
  /\b(?:local\s+guide|top\s+contributor)\b[^\n]{0,60}/gi;

const REVIEW_COUNT_BOILERPLATE_RE =
  /\b\d+\s+(?:reviews?|photos?|contributions?)\b/gi;

/**
 * Strips personal identifiers from free text. Order matters: emails first so
 * the phone and digit passes cannot chew through an address.
 */
export function redactPii(input: string): RedactionResult {
  const removed: string[] = [];
  let text = input;

  const apply = (
    re: RegExp,
    replacement: string,
    label: string,
    keepGroup1 = false,
  ) => {
    let hit = false;
    text = text.replace(re, (match, g1: string | undefined) => {
      hit = true;
      return keepGroup1 ? `${g1 ?? ''}${replacement}` : replacement;
    });
    if (hit) removed.push(label);
  };

  apply(PROFILE_BOILERPLATE_RE, '', 'reviewer profile line');
  apply(REVIEW_COUNT_BOILERPLATE_RE, '', 'reviewer profile line');
  apply(EMAIL_RE, '[email removed]', 'email address');
  apply(HANDLE_RE, '[handle removed]', 'social handle', true);

  // Addresses and references run BEFORE the digit passes, so a house number is
  // recognised as part of an address rather than swallowed as a stray number.
  apply(PINCODE_RE, '[address removed]', 'postal code');
  apply(STREET_RE, '[address removed]', 'street address');
  apply(ADDRESS_UNIT_RE, '[address removed]', 'address');
  apply(ADDRESS_UNIT_MARKED_RE, '[address removed]', 'address');
  apply(REFERENCE_RE, '[reference removed]', 'booking or order reference');

  apply(PHONE_RE, '[number removed]', 'phone number');
  apply(LONG_DIGITS_RE, '[number removed]', 'long number');

  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return {
    text,
    redacted: removed.length > 0,
    removed: [...new Set(removed)],
  };
}

const NAME_STOPWORDS = new Set([
  'the','a','an','and','or','but','very','good','bad','nice','great','best','worst',
  'service','food','staff','doctor','clinic','place','experience','review','visit',
  'thanks','thank','excellent','poor','amazing','awful','recommend','recommended',
  'star','stars','rating','rated','overall','value','money','time','quality','team',
]);

/**
 * True when a line looks like a pasted reviewer name rather than review text.
 *
 * Deliberately conservative: 1-4 capitalised words, no sentence punctuation,
 * short, and containing no review vocabulary. When in doubt it returns false
 * and the line is kept (and still redacted).
 */
export function looksLikePersonName(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  if (/[.!?,;:"“”()]/.test(trimmed)) return false;
  if (/\d/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;

  for (const word of words) {
    if (NAME_STOPWORDS.has(word.toLowerCase())) return false;
    // Must start with an uppercase Latin letter; Devanagari text is never
    // treated as a name because we cannot tell reliably.
    if (!/^[A-Z][a-zA-Z'’.-]*$/.test(word)) return false;
  }
  return true;
}

/**
 * Removes a leading reviewer-name line from a pasted review block.
 * Returns the block unchanged when nothing name-like is found, or when the
 * block is a single line (that line is the review itself).
 */
export function stripLeadingNameLine(block: string): {
  text: string;
  removedName: boolean;
} {
  const lines = block.split('\n');
  if (lines.length < 2) return { text: block, removedName: false };

  const first = lines[0];
  if (first !== undefined && looksLikePersonName(first)) {
    return { text: lines.slice(1).join('\n').trim(), removedName: true };
  }
  return { text: block, removedName: false };
}

/**
 * Full ingest cleaning for one pasted review block: drop a reviewer name line,
 * then redact any remaining identifiers.
 */
export function cleanReviewText(block: string): RedactionResult {
  const { text, removedName } = stripLeadingNameLine(block);
  const result = redactPii(text);
  if (removedName) {
    return {
      ...result,
      redacted: true,
      removed: [...new Set([...result.removed, 'reviewer name line'])],
    };
  }
  return result;
}
