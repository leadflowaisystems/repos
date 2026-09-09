'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { makeFlatTranslator, type Translator } from '@/lib/i18n/t';
import type { MessageKey } from '@/lib/i18n/strings';

/**
 * THE OWNER'S LANGUAGE, MADE AVAILABLE TO THE INTERACTIVE PARTS.
 *
 * Most of the portal is server-rendered and simply reads the cookie. The forms
 * and buttons cannot: they run in the browser, where there is no request to
 * read. So the workspace shell resolves the language once on the server and
 * hands the finished strings down through this provider.
 *
 * What crosses the wire is a plain map of key to sentence, already in the
 * chosen language, already fallen back to English where a translation is
 * missing. No dictionary, no fallback logic and no other language travels with
 * it — an owner reading English never downloads Marathi.
 */

type LocaleValue = {
  locale: Locale;
  strings: Record<string, string>;
};

const LocaleContext = createContext<LocaleValue>({
  locale: DEFAULT_LOCALE,
  strings: {},
});

export function LocaleProvider({
  locale,
  strings,
  children,
}: {
  locale: Locale;
  strings: Record<string, string>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, strings }), [locale, strings]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Which language this part of the tree is being read in. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/**
 * A translator for a client component.
 *
 * Outside a provider it answers in English rather than throwing. A form that
 * renders in a test harness, or in some corner of the app that never got a
 * shell, should show readable English — not a crash, and not a screen of keys.
 */
export function useT(): Translator<MessageKey> {
  const { locale, strings } = useContext(LocaleContext);
  return useMemo(
    () => makeFlatTranslator(strings, locale) as Translator<MessageKey>,
    [strings, locale],
  );
}
