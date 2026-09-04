import { randomBytes } from 'node:crypto';

/**
 * SECRET ADDRESSES (M14, generalised in M16).
 *
 * Two surfaces are authorized by a secret in their URL rather than by a login:
 * the customer feedback page, and the business owner's own workspace. Both use
 * exactly this token, so there is one implementation to reason about and one
 * to test.
 *
 * 22 characters from a 32-letter alphabet is 110 bits of randomness. The
 * alphabet drops the letters that print ambiguously on a card (i, l, o, 1), so
 * a token typed by hand from a photograph still resolves.
 *
 * A token is never a database id. Ids appear all over the operator's screens
 * and a cuid is a sortable timestamp, not a secret.
 */

export const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz023456789';
export const TOKEN_LENGTH = 22;

const ALPHABET_SET = new Set(TOKEN_ALPHABET);

/** A fresh, unguessable token. 256 is divisible by 32, so no byte is biased. */
export function newPublicToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = '';
  for (const byte of bytes) out += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return out;
}

/**
 * Shape check before anything touches the database. A path segment that is
 * not exactly a token never becomes a query.
 */
export function isPublicToken(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== TOKEN_LENGTH) return false;
  for (const char of value) if (!ALPHABET_SET.has(char)) return false;
  return true;
}
