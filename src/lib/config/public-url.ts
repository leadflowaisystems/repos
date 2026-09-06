/**
 * THE ADDRESS CUSTOMERS OPEN (M16).
 *
 * A printed QR is the most permanent thing RepOS produces. Once a card is on a
 * counter, the address inside it cannot be changed — so the address must come
 * from one explicit, stable setting, never from whatever host header happened
 * to arrive with the request that rendered the card.
 *
 * Precedence, and the reasoning:
 *
 *   1. REPOS_PUBLIC_BASE_URL — the production answer. Explicit, in the
 *      environment, identical on every restart and every deploy.
 *   2. The stored setting — the development and shop-Wi-Fi answer from M14.
 *   3. The address RepOS was opened on — development only, and never trusted
 *      in production, because a forwarded host header is attacker-controlled.
 *
 * In production, 1 is required and must be HTTPS. Missing or plain-http
 * configuration is a clear error, not a silently wrong QR code.
 */

export const PUBLIC_BASE_URL_VAR = 'REPOS_PUBLIC_BASE_URL';

export type BaseUrlSource = 'ENV' | 'SETTING' | 'REQUEST';

export type BaseUrlCheck = { ok: true; url: string } | { ok: false; reason: string };

export type BaseUrlResolution =
  | { ok: true; url: string; source: BaseUrlSource; loopback: boolean }
  | { ok: false; reason: string };

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Validates an address a customer's phone will open.
 *
 * Only an origin is accepted — scheme, host and port — because RepOS appends
 * the path. `requireHttps` is on in production: a QR that opens a plain-http
 * page across the internet is not something to print.
 */
export function checkPublicBaseUrl(
  raw: string | null | undefined,
  options: { requireHttps?: boolean } = {},
): BaseUrlCheck {
  const value = (raw ?? '').trim();
  if (value.length === 0) return { ok: false, reason: 'No address has been set.' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false,
      reason: 'That is not a complete address. It needs to start with https://',
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'The address must start with http:// or https://' };
  }
  if (options.requireHttps && parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason:
        'A public address must start with https:// — a customer’s phone will refuse to trust anything else.',
    };
  }
  if (parsed.hostname.length === 0) {
    return { ok: false, reason: 'That address has no computer name or number in it.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'The address must not contain a username or password.' };
  }
  if ((parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
    return {
      ok: false,
      reason: 'Enter just the address, without anything after the port — Headway adds the rest.',
    };
  }
  return { ok: true, url: parsed.origin };
}

/** True when the address only works on the computer RepOS is running on. */
export function isLoopbackAddress(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export type ResolveInput = {
  /** The stored M14 setting, already validated, or null. */
  setting: string | null;
  /** The address this request arrived on. Ignored in production. */
  requestOrigin: string | null;
  env?: NodeJS.ProcessEnv;
};

/**
 * The one address every QR, every owner link and every printed card uses.
 */
export function resolvePublicBaseUrl(input: ResolveInput): BaseUrlResolution {
  const env = input.env ?? process.env;
  const production = isProduction(env);
  const configured = (env[PUBLIC_BASE_URL_VAR] ?? '').trim();

  if (configured.length > 0) {
    const check = checkPublicBaseUrl(configured, { requireHttps: production });
    if (!check.ok) {
      return {
        ok: false,
        reason: `${PUBLIC_BASE_URL_VAR} is not usable: ${check.reason}`,
      };
    }
    return {
      ok: true,
      url: check.url,
      source: 'ENV',
      loopback: isLoopbackAddress(check.url),
    };
  }

  if (production) {
    return {
      ok: false,
      reason: `${PUBLIC_BASE_URL_VAR} is not set. A production install must state the address customers open — for example https://repos.example.com — so printed QR codes keep working across restarts.`,
    };
  }

  if (input.setting) {
    return {
      ok: true,
      url: input.setting,
      source: 'SETTING',
      loopback: isLoopbackAddress(input.setting),
    };
  }

  if (input.requestOrigin) {
    const check = checkPublicBaseUrl(input.requestOrigin);
    if (check.ok) {
      return {
        ok: true,
        url: check.url,
        source: 'REQUEST',
        loopback: isLoopbackAddress(check.url),
      };
    }
  }

  return {
    ok: false,
    reason: 'Headway could not work out the address customers would open.',
  };
}
