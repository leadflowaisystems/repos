/**
 * THE THREE LANGUAGES THE CLIENT PORTAL SPEAKS.
 *
 * Headway's owners are local business people in Maharashtra and beyond. Plenty
 * of them read English comfortably; plenty read Hindi or Marathi far more
 * comfortably, and were quietly doing extra work every time they opened a
 * report about their own shop. So the portal speaks all three, and the owner
 * picks.
 *
 * ENGLISH IS THE DEFAULT AND STAYS THE DEFAULT. A portal that guessed from a
 * browser header would change language under people who never asked it to, and
 * an owner who opens Headway tomorrow expecting the screen they saw yesterday
 * is right to expect that. Nothing here reads Accept-Language. The only way the
 * portal stops being English is that somebody chose Hindi or Marathi in
 * Account.
 *
 * ENGLISH IS ALSO THE SOURCE. Every phrase is written in English first and
 * translated from it, never the other way round, so there is exactly one place
 * a meaning is decided.
 */

export const LOCALES = ['en', 'hi', 'mr'] as const;

export type Locale = (typeof LOCALES)[number];

/** What a portal shows before anybody has chosen anything. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Where the choice is remembered.
 *
 * A cookie rather than a column, deliberately. The language a screen is read in
 * is a property of the reading, not of the business: a salon owner who reads
 * Marathi and a manager who reads English share one workspace and should not
 * have to share one language. It also means choosing a language touches no
 * table, no row-level policy and no grant — nothing about switching to Marathi
 * can put a business's data at risk.
 *
 * The cost is honest and worth stating: the choice lives on the device that
 * made it, so signing in on a new phone starts from English again.
 */
export const LOCALE_COOKIE = 'headway_locale';

/** One year. Long enough that an owner never meets the question twice. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * How each language names ITSELF.
 *
 * A person looking for Marathi is looking for "मराठी", not for "Marathi" — the
 * whole point of the list is to be readable by someone who has not found their
 * language yet, so every option is written in its own script whatever the
 * portal is currently set to.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  mr: 'मराठी',
};

/**
 * The `lang` attribute for the document, so screen readers and browsers
 * pronounce and hyphenate the page correctly.
 */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Anything at all in, a language out.
 *
 * Never throws and never leaves a caller holding a broken value: a cookie
 * somebody edited by hand, a stale value from an older release, an empty
 * string, undefined — all of them mean English, which is the one answer that
 * is always readable.
 */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
