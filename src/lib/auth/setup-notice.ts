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
