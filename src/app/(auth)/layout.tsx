import type { Metadata, Viewport } from 'next';
import { LocaleProvider } from '@/components/portal/locale-provider';
import { LOCALE_HTML_LANG } from '@/lib/i18n/locale';
import { getLocale } from '@/lib/i18n/request';
import { MESSAGES } from '@/lib/i18n/strings';
import { flattenFor } from '@/lib/i18n/t';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Sign in · Headway',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * The login page has its own root layout, the way the portal, the print sheets
 * and the customer feedback page do — so the operator's navigation is absent
 * from the tree rather than hidden by CSS. A signed-out visitor cannot see the
 * shape of the tool, let alone its client list.
 *
 * IT ALSO SPEAKS THE OWNER'S LANGUAGE (M31). Signing in and setting the
 * business up are the first two screens a business owner ever reads, and they
 * sit outside the workspace tree — so the language cookie is read here as well,
 * and the forms below are handed their words the same way the portal's are. An
 * owner who chose Marathi and then signed out would otherwise be met in English
 * at the one screen they cannot skip.
 */
/**
 * The only namespaces a client component under this layout can reach.
 *
 * `(auth)` renders exactly two translated client components — the sign-in and
 * setup forms in `components/forms/account-forms.tsx` (common.form.*) and the
 * invitation form in `components/forms/team-forms.tsx` (team.*). Everything
 * else in the dictionary is either portal chrome or, in the case of the four
 * largest namespaces, sentences the SERVER-side builders write and no browser
 * ever reads.
 *
 * Sending the whole dictionary here put ~130KB of it into the sign-in page —
 * a page an unauthenticated visitor has to finish downloading before they can
 * type anything, very often on a phone. `tests/m32.auth-payload.test.ts` keeps
 * this list honest: it fails if either form starts using a key outside it.
 */
const AUTH_NAMESPACES = ['common.', 'team.'] as const;

export default async function AuthRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={LOCALE_HTML_LANG[locale]}>
      <body className="min-h-dvh bg-ink-50">
        <LocaleProvider locale={locale} strings={flattenFor(MESSAGES, locale, AUTH_NAMESPACES)}>
          <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
            {children}
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
