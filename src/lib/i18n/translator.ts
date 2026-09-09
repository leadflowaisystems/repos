import { DEFAULT_LOCALE, type Locale } from './locale';
import { MESSAGES, type MessageKey } from './strings';
import { makeTranslator, type Translator } from './t';

/**
 * THE TRANSLATOR THE GENERATION LAYER IS HANDED.
 *
 * Separate from `request.ts` on purpose. That module reads the request's
 * cookies, so it can only run inside a Next request — and the modules that
 * actually write Headway's sentences (`portal/view.ts`, `portal/focus.ts`,
 * `responsibility/engine.ts`, `improve/*`, `intelligence/engine.ts`) are pure
 * functions that must stay testable without a server, a request or a database.
 * So the pure half lives here and `request.ts` re-exports it.
 *
 * HOW THE LANGUAGE REACHES A GENERATED SENTENCE. It is passed in, once, as
 * `t` on the input object each builder already takes — never looked up, never
 * sniffed, and never branched on. There is no `if (locale === 'hi')` anywhere
 * in the generation layer, and there must never be one: a builder that asks
 * what language it is in would have to be edited again for the fourth language,
 * and every such branch is a place for English to leak back in.
 */

/** A translator typed to the keys that exist. */
export type PortalTranslator = Translator<MessageKey>;

export function translatorFor(locale: Locale): PortalTranslator {
  return makeTranslator(MESSAGES, locale) as PortalTranslator;
}

/**
 * English, ready-made.
 *
 * The default wherever a translator is not supplied, which is not a fallback
 * so much as a decision: the OPERATOR CONSOLE is not localized and should not
 * be. Staff read one language, the console is full of internal vocabulary, and
 * translating it would be work nobody asked for. So `src/lib/clients/detail.ts`
 * and the operator's own pages call these builders without a `t` and get
 * English, deliberately.
 *
 * The client portal always passes one. `tests/m31b.generated-i18n.test.ts`
 * checks that every portal call site does, so "forgot to pass it" is a failing
 * test rather than a page that quietly stays English.
 */
export const EN: PortalTranslator = translatorFor(DEFAULT_LOCALE);
