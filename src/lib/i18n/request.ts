import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, toLocale, type Locale } from './locale';
import { MESSAGES } from './strings';
import { makeTranslator, type Translator } from './t';
import type { MessageKey } from './strings';

/**
 * READING THE OWNER'S CHOSEN LANGUAGE, SERVER-SIDE.
 *
 * Server components only — it reads the request's cookies, so it cannot run in
 * the browser. Client components are handed the language as a prop by the
 * workspace shell instead; see LocaleProvider.
 *
 * Every portal page is already `force-dynamic`, so reading a cookie here costs
 * nothing that was not already being paid.
 */

/** The language this request should be answered in. English unless chosen. */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return toLocale(store.get(LOCALE_COOKIE)?.value);
  } catch {
    // Rendered outside a request (a build-time pass, a test). English is the
    // only sensible answer and is never wrong enough to fail a render over.
    return DEFAULT_LOCALE;
  }
}

/** The language and a translator for it, which is what most pages want. */
export async function getTranslator(): Promise<Translator<MessageKey>> {
  return makeTranslator(MESSAGES, await getLocale()) as Translator<MessageKey>;
}

/** A translator for a language already in hand — no cookie read. */
export function translatorFor(locale: Locale): Translator<MessageKey> {
  return makeTranslator(MESSAGES, locale) as Translator<MessageKey>;
}
