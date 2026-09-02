import { createHash } from 'node:crypto';

/**
 * Duplicate detection.
 *
 * Deliberately NOT fuzzy. Two feedback items are duplicates only when their
 * text is byte-identical once case, punctuation and whitespace are normalised.
 * "Very good service!" and "very good service" collide; "Very good service" and
 * "Very good staff" do not, and never will.
 *
 * The rating and date play no part: the same review pasted twice, once with a
 * rating and once without, is still the same review.
 */

/**
 * Lowercase, strip punctuation and symbols, collapse whitespace.
 *
 * Uses NFKC (composed), not NFKD. Decomposing would split Devanagari into base
 * letters plus combining marks, and stripping the marks would turn "डॉक्टर"
 * into "ड क टर" — collapsing genuinely different Marathi and Hindi reviews onto
 * the same fingerprint and silently discarding real feedback as a "duplicate".
 * Combining marks (\p{M}) are therefore kept alongside letters and numbers.
 */
export function normaliseForFingerprint(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stable hash of the normalised text. Same text always yields the same
 * fingerprint, on any machine, forever — it is stored and compared later.
 */
export function fingerprintFeedback(text: string): string {
  const normalised = normaliseForFingerprint(text);
  if (normalised.length === 0) return '';
  return createHash('sha256').update(normalised, 'utf8').digest('hex').slice(0, 32);
}
