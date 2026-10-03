/**
 * THE FIXED SENTENCES THE SIGN-IN AND RESET PAGES SHOW (M39, M52).
 *
 * Each redirect carries a fixed flag, never the sentence itself: a query string
 * anyone can type into a link must not be able to put words of their choosing
 * on these pages. Only the values below mean anything; every other value —
 * including an array, an empty string or a prototype key — shows nothing.
 */

/** After a password reset: the new password is set, and every session ended. */
export const RESET_NOTICE_PARAM = 'reset';

const RESET_DONE = 'Your password has been changed. Sign in with your new password.';

export function resetNotice(value: unknown): string | null {
  return value === 'done' ? RESET_DONE : null;
}

/**
 * A "confirm your new email address" link opened in a browser that is not
 * signed in — on a phone, say, after setting up on a laptop. Supabase changed
 * the address when the link was opened; signing in is all that is left.
 */
export const EMAIL_NOTICE_PARAM = 'email';

const EMAIL_CONFIRMED = 'Your new email address is confirmed. Sign in with it and your password.';
const EMAIL_INCOMPLETE =
  'We could not finish confirming your new email address. Sign in with your current email and password, and contact Headway.';

const EMAIL_LINK_EXPIRED =
  'That confirmation link has expired or was already used. If you have a password, sign in with your email and that password. If not, use “Forgot password?” below with the same email: its link confirms your address and lets you choose one.';

export function emailNotice(value: unknown): string | null {
  if (value === 'confirmed') return EMAIL_CONFIRMED;
  if (value === 'incomplete') return EMAIL_INCOMPLETE;
  if (value === 'expired') return EMAIL_LINK_EXPIRED;
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
  'That link has expired or was already used. Sign in if you can — or use “Forgot password?” below to get a new link.';

export function expiredLinkNotice(value: unknown): string | null {
  return value === '1' ? EXPIRED_LINK : null;
}

/** What the forgot-password page says about a reset link that did not work. */
export const RESET_LINK_PARAM = 'link';

const RESET_LINK_EXPIRED = 'That reset link has expired or was already used. Ask for a new one below.';
const RESET_LINK_OTHER_BROWSER =
  'That reset link has to be opened in the same browser you asked for it from. Ask for a new one below, on the device you will open the email on.';

export function resetLinkNotice(value: unknown): string | null {
  if (value === 'expired') return RESET_LINK_EXPIRED;
  if (value === 'other-browser') return RESET_LINK_OTHER_BROWSER;
  return null;
}
