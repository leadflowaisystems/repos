/**
 * PUBLIC FEEDBACK TOKENS AND ADDRESSES (M14, hardened in M16).
 *
 * The one thing a customer's phone ever sees is a token. It identifies exactly
 * one business, and nothing else: not a database id, not a name, not a
 * sequence number, not anything a person could guess from another token.
 *
 * The token primitives moved to `@/lib/tokens` in M16 so the owner's portal
 * could use the same 110-bit shape. They are re-exported here because this is
 * where M14 and its tests have always found them.
 */

export {
  TOKEN_ALPHABET,
  TOKEN_LENGTH,
  isPublicToken,
  newPublicToken,
} from '@/lib/tokens';

export type BaseUrlCheck = { ok: true; url: string } | { ok: false; reason: string };

/**
 * The address customers open, as the operator configured it.
 *
 * Only an origin is accepted — scheme, host and port — because the feedback
 * path is appended by RepOS. Plain http is allowed on purpose: on the shop's
 * own Wi-Fi the address is this computer's network address, and there is no
 * certificate for that.
 */
export function checkBaseUrl(raw: string | null | undefined): BaseUrlCheck {
  const value = (raw ?? '').trim();
  if (value.length === 0) return { ok: false, reason: 'No address has been set.' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false,
      reason: 'That is not a complete address. It needs to start with http:// or https://',
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'The address must start with http:// or https://' };
  }
  if (parsed.hostname.length === 0) {
    return { ok: false, reason: 'That address has no computer name or number in it.' };
  }
  if ((parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
    return {
      ok: false,
      reason: 'Enter just the address, without anything after the port — Headway adds the rest.',
    };
  }
  return { ok: true, url: parsed.origin };
}

/** The customer-facing path for a token. */
export function feedbackPath(token: string): string {
  return `/feedback/${token}`;
}

/** The full customer-facing address: what the QR encodes and the operator copies. */
export function feedbackUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${feedbackPath(token)}`;
}

/**
 * True when the address only works on this computer. A QR printed with it
 * would open nothing on a customer's phone, so the operator is told.
 */
export function isLoopbackAddress(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}
