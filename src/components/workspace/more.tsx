import { Link } from '@/components/portal/link';
import { getTranslator } from '@/lib/i18n/request';
import { HeadwayMark } from '@/components/brand';
import type { MessageKey } from '@/lib/i18n/strings';

export const metadata = { title: 'More' };

/**
 * MORE — everything that is not the daily loop (mobile pass).
 *
 * The workspace had eight doors along the top, and six of them were things an
 * owner does once a quarter: look at the whole signal board, read the month's
 * report, order more cards, check an order, manage the team, change the
 * language. None of those is a reason to open the app, and all six were
 * competing for the same strip of screen as the three that are.
 *
 * So they are here, one tap from anywhere, grouped by what a person is trying
 * to do rather than by which part of the system owns them:
 *
 *   LOOK DEEPER   the signal board and the check-in — the same pages, still
 *                 the whole reading, for the visit where an owner has time
 *   YOUR CARDS    the print kit and what happened to an order
 *   YOUR ACCOUNT  the team, the language, the subscription
 *
 * NOTHING MOVED ADDRESS. Every link here points at the route it always did,
 * so a bookmark, an email link and the operator's own link all still work.
 * This page is a menu, not a redirect.
 *
 * IT IS A LIST, NOT A GRID OF CARDS. Six cards with icons is the shape this
 * would take in most products, and it would be worse: an icon nobody can name
 * is decoration, and a card is a lot of screen to spend on a word. Rows are
 * scannable, they wrap properly in Devanagari, and the tap target is the whole
 * width of the phone.
 */

type Door = {
  slug: string;
  label: MessageKey;
  /** What this door is FOR, in one short line. Not a description of the page. */
  hint: MessageKey;
};

const GROUPS: ReadonlyArray<{ title: MessageKey; doors: readonly Door[] }> = [
  {
    title: 'more.group.deeper',
    doors: [
      { slug: 'analysis', label: 'nav.section.customers', hint: 'more.hint.customers' },
      { slug: 'checkin', label: 'nav.section.checkin', hint: 'more.hint.checkin' },
    ],
  },
  {
    title: 'more.group.cards',
    doors: [
      { slug: 'kit', label: 'nav.section.kit', hint: 'more.hint.kit' },
      { slug: 'orders', label: 'nav.section.orders', hint: 'more.hint.orders' },
    ],
  },
  {
    title: 'more.group.account',
    doors: [{ slug: 'account', label: 'nav.section.account', hint: 'more.hint.account' }],
  },
];

export async function PortalMore({
  basePath,
  signOut,
  business,
}: {
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  /**
   * The control that ends the session, passed in rather than imported.
   *
   * Same slot the header uses, for the same reason: the shared-link portal has
   * no session to end, and offering to sign out of something nobody signed
   * into would be a lie.
   */
  signOut?: React.ReactNode;
  /**
   * Whose account this is. On a phone the app bar shows only the owner's
   * initial, so this page is where the business is named in full — the same
   * place an app keeps its profile.
   */
  business?: { name: string; verticalLabel: string };
}) {
  const t = await getTranslator();
  const initial = (business?.name.trim().charAt(0) || 'H').toUpperCase();
  return (
    <div className="max-w-2xl">
      {/* The owner's own place: their business, named, with the initial the
          app bar uses as the way here — so the tap and the page agree. */}
      {business ? (
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink-900 font-display text-[24px] font-semibold text-brand-200"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[26px] leading-tight font-semibold text-ink-900">
              {business.name}
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-500">{business.verticalLabel}</p>
          </div>
        </div>
      ) : (
        <h1 className="font-display text-[26px] leading-tight font-semibold text-ink-900">
          {t('nav.section.more')}
        </h1>
      )}

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-8">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
            {t(group.title)}
          </h2>
          <ul className="mt-2 divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white">
            {group.doors.map((door) => (
              <li key={door.slug}>
                <Link
                  href={`${basePath}/${door.slug}`}
                  // The whole row taps, and it is 60px tall — comfortably past
                  // the 44px floor without being a button. The ring is drawn
                  // inside the row, because the list clips its edges.
                  className="hw-focus-inset flex min-h-15 items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50"
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium text-ink-900">
                      {t(door.label)}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-500">
                      {t(door.hint)}
                    </span>
                  </span>
                  <span aria-hidden className="text-[18px] text-ink-300">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* The way out, at the foot of the owner's own page — where a phone
          app keeps it — rather than in the bar on every screen. */}
      {signOut ? (
        <div className="mt-8 overflow-hidden rounded-xl border border-ink-200 bg-white">{signOut}</div>
      ) : null}

      {/* The one quiet line that says whose product this is. */}
      <p className="mt-10 flex items-center justify-center gap-2 text-[12px] text-ink-500">
        <HeadwayMark className="h-4 w-4" />
        {t('nav.footer.tagline')}
      </p>
    </div>
  );
}
