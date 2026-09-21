/**
 * THE ONE MESSAGE /login SHOWS AFTER ACCOUNT SETUP (M39).
 *
 * The redirect carries a fixed flag, never the sentence itself: a query string
 * anyone can type into a link must not be able to put words of their choosing
 * on the sign-in page. Only the two values below mean anything; every other
 * value — including an array, an empty string or a prototype key — shows
 * nothing at all.
 *
 * Two values because a blank email is a real outcome of the setup form: the
 * login id is kept and only the password changes, and telling that person to
 * sign in with a "new email" would send them to a sign-in that fails.
 */

export const SETUP_NOTICE_PARAM = 'setup';

const EMAIL_AND_PASSWORD = 'Your account is set up. Sign in with your new email and password.';
const PASSWORD_ONLY = 'Your account is set up. Sign in with your login ID and your new password.';

export function loginAfterSetup(emailChanged: boolean): string {
  return `/login?${SETUP_NOTICE_PARAM}=${emailChanged ? 'complete' : 'password'}`;
}

export function setupNotice(value: unknown): string | null {
  if (value === 'complete') return EMAIL_AND_PASSWORD;
  if (value === 'password') return PASSWORD_ONLY;
  return null;
}

/**
 * A confirmation or password-reset link that Supabase refused — expired, or
 * already used. The auth callback sends the person to `/login?expired=1`;
 * without a sentence they could not tell whether their confirmation or reset
 * had worked. Fixed words chosen here, never text from the URL.
 */
export const EXPIRED_LINK_PARAM = 'expired';

const EXPIRED_LINK =
  'That link has expired or was already used. Sign in if you can — or use “Forgot your password?” below to get a new link.';

export function expiredLinkNotice(value: unknown): string | null {
  return value === '1' ? EXPIRED_LINK : null;
}
