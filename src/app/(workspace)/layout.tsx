import type { Metadata, Viewport } from 'next';
import { LocaleProvider } from '@/components/portal/locale-provider';
import { LOCALE_HTML_LANG } from '@/lib/i18n/locale';
import { getLocale } from '@/lib/i18n/request';
import { MESSAGES } from '@/lib/i18n/strings';
import { flattenFor } from '@/lib/i18n/t';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Headway',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * THE BUSINESS WORKSPACE ROOT (M20 Stage 8D).
 *
 * Its own root layout, deliberately — and this is not a cosmetic split.
 *
 * The workspace was first put under `(app)`, whose layout calls
 * `requireOperator()` as its third layer of defence. That is right for the
 * agency console and wrong for a customer: a BUSINESS_OWNER is not RepOS
 * staff, so the layout redirected them to `/login`, `/login` saw a valid
 * session and sent them back to their workspace, and the two bounced until
 * Chrome gave up with ERR_TOO_MANY_REDIRECTS. Signing in was the trigger,
 * because only an authenticated non-admin can reach the pair.
 *
 * So the two audiences get two roots. Nothing here is unguarded: the nested
 * `workspace/[clientId]/layout.tsx` runs the tenant gate, and every page under
 * it runs its own, because a layout is not a security boundary in the App
 * Router.
 *
 * The operator's navigation is absent from this tree entirely rather than
 * hidden with CSS, the same way the portal and the customer pages have always
 * worked. A business owner cannot see the shape of the agency's tool.
 *
 * IT IS ALSO WHERE THE PORTAL'S LANGUAGE IS DECIDED (M31). The owner's choice
 * is read once here, for the whole tree: `lang` on the document so browsers and
 * screen readers pronounce the page correctly, and the finished strings handed
 * to the interactive parts, which cannot read a cookie for themselves. Only the
 * chosen language crosses to the browser — an owner reading English never
 * downloads Hindi and Marathi.
 *
 * AND ONLY THE WORDS A BROWSER CAN READ. The dictionary is 1,700 phrases, and
 * almost all of them are read on the server: the generated sentences, every
 * vertical's taxonomy, the page headings. The interactive parts — the
 * navigation, the forms, the loading and error states — reach a few
 * namespaces. Handing over the whole dictionary put 137 KB of English, or
 * 250 KB of Hindi or Marathi, into every first load and into every language
 * switch, for words no client component could ask for. The same discipline
 * the sign-in page applies (`AUTH_NAMESPACES`), applied here.
 * `tests/perf.workspace-payload.test.ts` keeps the list honest: it fails if
 * a client component in this tree starts using a key outside it, which is
 * the failure that would otherwise put a raw key on an owner's screen.
 */
const WORKSPACE_NAMESPACES = [
  // The header, its nine doors and the footer.
  'nav.',
  // The loading and error states, which are client components.
  'errors.',
  // The forms: continuing with Headway and asking to extend access.
  'common.form.',
  // Choosing the language, on Account.
  'account.language.',
  // Ordering the printed kit and saying it arrived.
  'kit.amount',
  'kit.line.',
  'kit.order.',
  'kit.price.',
  'kit.quantity.',
  'kit.receipt.',
  'kit.summary.',
  // Inviting and managing the team.
  'team.',
] as const;

export default async function WorkspaceRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={LOCALE_HTML_LANG[locale]}>
      <body className="min-h-dvh bg-ink-50">
        <LocaleProvider locale={locale} strings={flattenFor(MESSAGES, locale, WORKSPACE_NAMESPACES)}>
          <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
