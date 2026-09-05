import { prisma } from '@/lib/db';
import { getPublicBaseUrl } from '@/lib/gateway/service';
import { requestOrigin } from '@/lib/gateway/origin';
import {
  checkPublicBaseUrl,
  isLoopbackAddress,
  isProduction,
  PUBLIC_BASE_URL_VAR,
} from '@/lib/config/public-url';

/**
 * WHERE SUPABASE SHOULD SEND PEOPLE BACK TO (M20 Stage 8A).
 *
 * An emailed auth link has to name an absolute address, and getting it wrong
 * is not a cosmetic problem: the link works, the person clicks it, and they
 * arrive at a server that is not running. Which is precisely what happened
 * before this existed — `signUp` passed no redirect at all, so Supabase fell
 * back to the project's Site URL and every confirmation email pointed at
 * whatever port that happened to be.
 *
 * The address comes from the same source of truth the printed QR codes use, so
 * a deployment cannot send customers to one origin and account emails to
 * another:
 *
 *   1. REPOS_PUBLIC_BASE_URL   the deployment says so explicitly
 *   2. the operator's setting  stored in AppSetting
 *   3. the request's origin    development only
 *
 * Step 3 returns null in production by design, so a forged Host header cannot
 * decide where a password-reset link points. If none of the three yields a
 * usable address, no redirect is sent at all and Supabase falls back to its own
 * Site URL — a value someone chose deliberately in the dashboard.
 *
 * ONE DELIBERATE DIFFERENCE FROM THE QR RULE. A printed QR code must be https:
 * it is opened by a stranger's phone, over a network, and plain http there is
 * indefensible. An auth redirect to a LOOPBACK address never crosses a network
 * at all — it is the machine talking to itself — so http is allowed there and
 * nowhere else. Without this, running the app locally in production mode
 * silently discards the redirect and reintroduces the exact bug this module
 * exists to fix.
 */
export async function authRedirectUrl(path: string): Promise<string | undefined> {
  const env = process.env;
  const configured = (env[PUBLIC_BASE_URL_VAR] ?? '').trim();
  const candidate = configured || (await getPublicBaseUrl(prisma)) || (await requestOrigin()) || '';
  if (candidate.length === 0) return undefined;

  const check = checkPublicBaseUrl(candidate, {
    requireHttps: isProduction(env) && !isLoopbackAddress(candidate),
  });
  if (!check.ok) return undefined;

  return `${check.url.replace(/\/+$/, '')}${path}`;
}

/**
 * A host that does not and cannot exist. Only ever used as a base to resolve a
 * candidate path against, so that "did this leave the site?" is answered by the
 * same parser the browser uses rather than by a hand-written prefix test.
 */
const SENTINEL_ORIGIN = 'https://repos.invalid';

/**
 * THE ONLY SAME-SITE CHECK IN REPOS.
 *
 * `next` decides where somebody lands after signing in or after opening an
 * emailed link. That is the exact shape of an open redirect: a link that looks
 * like RepOS, carries a real credential, and drops the person on a page
 * somebody else controls. There were three copies of this check and all three
 * were wrong in the same two ways, because all three asked the question with
 * string prefixes instead of with a URL parser.
 *
 * A BACKSLASH IS A SLASH. After the leading `/` the URL parser is in "relative
 * slash state", and there a backslash sends it to "special authority ignore
 * slashes state" — exactly as a second `/` would. So `/\evil.com` starts with
 * one slash, is not `//`, passes both old tests, and resolves to
 * `https://evil.com/`. Every browser does this; it is in the standard, not a
 * quirk.
 *
 * TABS AND NEWLINES ARE DELETED. The parser strips every ASCII tab, newline and
 * carriage return from its input BEFORE parsing. So `/` + TAB + `/evil.com` is
 * parsed as `//evil.com`, and again resolves off-site. Both variants arrive
 * decoded — `searchParams.get('next')` and Next's `searchParams` prop
 * percent-decode — so `?next=/%5Cevil.com` and `?next=/%09/evil.com` reach this
 * function as a literal backslash and a literal tab.
 *
 * So the check is done twice, deliberately. The character rules below reject
 * the shapes that only a browser's parser would mangle; then the value is
 * resolved against a sentinel origin and the origin must not have moved. That
 * second test is the load-bearing one — it is a whitelist of "stayed here"
 * rather than a blacklist of ways to leave — and what comes back is the
 * REPARSED path, so whatever a caller passes to `new URL(next, origin)` or to
 * `redirect(next)` has already survived the same parser those sinks use.
 *
 * `%5C` is rejected too. Nothing this application serves has a backslash in its
 * path, so the encoded form costs nothing to refuse, and refusing it means no
 * future sink that decodes before parsing can reopen this.
 *
 * Returns null for anything it will not vouch for. Callers decide what to do
 * with null; none of them may fall back to the raw input.
 */
function looksLikeOurPath(value: string): boolean {
  if (value.length === 0) return false;

  // C0 controls and DEL, anywhere: tab, LF and CR are removed by the parser,
  // and the rest have no business in a path RepOS generates.
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.includes('\\')) return false;
  if (/%5c/i.test(value)) return false;

  // Must be rooted, and must not be protocol-relative.
  if (value.charCodeAt(0) !== 47) return false;
  if (value.charCodeAt(1) === 47) return false;

  return true;
}

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!looksLikeOurPath(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value, SENTINEL_ORIGIN);
  } catch {
    return null;
  }
  if (parsed.origin !== SENTINEL_ORIGIN) return null;

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;

  // THE VALUE HANDED BACK IS NOT THE VALUE THAT WAS CHECKED, AND THAT GAP WAS A
  // HOLE.
  //
  // The parser normalises dot segments, and normalisation can MANUFACTURE a
  // protocol-relative path out of one that was not. `/..//evil.com` starts with
  // a single slash, holds no backslash and no control character, and its origin
  // is still the sentinel — the origin comes from the base, and path parsing
  // never touches it. But `..` shortens the path to empty and the following
  // empty segment is then appended, so `pathname` comes out as `//evil.com`.
  // Returned as-is that resolves to https://evil.com at every sink. `/.//`,
  // `/%2e%2e//` and `/clients/../..//` all arrive at the same place.
  //
  // So the OUTPUT goes through the same test as the input. That also makes the
  // function idempotent, which matters because the sign-in page validates a
  // value and the sign-in action then validates it again — a chain that was
  // silently load-bearing until this line existed.
  if (!looksLikeOurPath(path)) return null;
  if (new URL(path, SENTINEL_ORIGIN).origin !== SENTINEL_ORIGIN) return null;

  return path;
}

/** The one route that knows how to turn an emailed code into a session. */
export const AUTH_CALLBACK = '/auth/callback';

export function callbackFor(next: string): string {
  return `${AUTH_CALLBACK}?next=${encodeURIComponent(next)}`;
}
