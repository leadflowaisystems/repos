'use client';

import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Link } from '@/components/portal/link';
import { HeadwayWordmark } from '@/components/brand';
import { useT } from '@/components/portal/locale-provider';
import type { MessageKey } from '@/lib/i18n/strings';

/**
 * WORKSPACE CHROME (M12).
 *
 * The one client component in the portal: the navigation needs to know which
 * page it is on. Everything else stays server-rendered.
 *
 * The header answers "where am I" and "how do I get back to the main answer"
 * on every page, which is what turns five routes into one workspace.
 */

/**
 * The order an owner reads in: where we are now, what moved, what needs them,
 * what they did about it, and the words behind all of it.
 *
 * Pulse, Review and Team exist only in the authenticated workspace. The
 * link-based portal is a read-only compatibility surface and never grew a team
 * page, so `extra` marks the sections that appear on one door and not the
 * other rather than being hidden by a role check the header cannot make.
 *
 * The `reviews` door is LABELLED "Feedback" on purpose. What it lists is
 * private customer feedback, which this product promises is never posted
 * publicly, so calling the door Reviews contradicted the promise on the one
 * screen every page shows. The slug stays `reviews` because a URL is not copy
 * and old links must keep working.
 *
 * `label` holds the dictionary key rather than the word itself (M31), so the
 * doors are named in the owner's language while the slugs — which are
 * addresses people have bookmarked and been sent — do not move.
 *
 * `orders` sits next to `kit` (M33) because it answers the question the Kit
 * page raises: I asked for cards, what happened to that. It is a workspace
 * door only — the shared link has no session, and an order belongs to a
 * business, not to whoever holds the link.
 */
const SECTIONS = [
  { slug: '', label: 'nav.section.home', extra: false },
  { slug: 'analysis', label: 'nav.section.customers', extra: false },
  { slug: 'reviews', label: 'nav.section.feedback', extra: false },
  { slug: 'improvements', label: 'nav.section.improvements', extra: false },
  { slug: 'checkin', label: 'nav.section.checkin', extra: false },
  // 'team' is deliberately absent for the pilot: email/team invitations are
  // not being used, so the door is hidden rather than opened onto a broken
  // invite flow. The route, the backend and the operator's own access to it
  // are untouched — see src/app/(workspace)/workspace/[clientId]/team/page.tsx.
  { slug: 'kit', label: 'nav.section.kit', extra: true },
  { slug: 'orders', label: 'nav.section.orders', extra: true },
  { slug: 'account', label: 'nav.section.account', extra: true },
] as const satisfies ReadonlyArray<{ slug: string; label: MessageKey; extra: boolean }>;

/**
 * Five doors on the shared link, nine in the workspace. The weekly Pulse and
 * the monthly Review are still
 * there — same routes, same reports — but they are two windows on the same
 * question Check-in answers ("what changed?"), so they live as a period
 * switch at the top of that page rather than as two more tabs an owner has to
 * scroll past on a phone. Landing on either keeps Check-in highlighted.
 */
const CHECKIN_FAMILY = new Set(['checkin', 'pulse', 'review']);

/**
 * The word on a tab, and whether that tab has been pressed.
 *
 * A workspace page is rendered on the server when it is asked for, and until
 * the answer arrives nothing on screen changed — so a tap on a slow connection
 * looked like a tap that did nothing, and the natural reaction was to tap
 * again, which asked the server for the same page twice. `useLinkStatus` is
 * Next's own word for "this link's navigation is in flight": the tab dims and
 * its underline appears the moment it is pressed, before any request has
 * answered, and returns to normal when the page lands. It has to live in a
 * component INSIDE the link, which is why the label is its own component.
 */
function TabLabel({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      data-pending={pending ? 'true' : undefined}
      className={clsx(
        'inline-flex min-h-11 items-center border-b-2 px-3 text-[13px] whitespace-nowrap transition-colors',
        // On navy now. Active is white and carries Headway's gold underline —
        // gold used as the one accent that means "you are here".
        active
          ? 'border-brand-400 font-semibold text-white'
          : pending
            ? 'border-white/40 text-white'
            : 'border-transparent text-ink-300 group-hover:border-white/30 group-hover:text-white',
        pending && !active && 'motion-safe:animate-pulse',
      )}
    >
      {label}
    </span>
  );
}

/**
 * THE APP BAR (final experience pass).
 *
 * Headway's own navy bar, edge to edge, on every page of the workspace. The
 * previous header was a small wordmark on the same cool grey as everything
 * else, which is to say it was the header of an admin panel: nothing on the
 * screen said whose product this was. Navy is the brand's authority colour and
 * this is the one place it is used at full strength on every page, so the
 * product is recognisable before a word is read.
 *
 * ON A PHONE it is two things: the mark, which goes Home, and the owner's own
 * initial, which opens More — account, language, sign out. The business name
 * is not repeated in the bar; Home greets the owner by it, and a bar that
 * shouts the name on every page is the product talking about itself.
 *
 * FROM TABLET UP it also carries the doors, in white with a gold underline for
 * the current one, pinned while the page scrolls. The phone uses the bottom
 * bar instead (`MobileTabBar`).
 *
 * `on-navy` flips the global focus ring to gold: the navy ring the rest of the
 * product uses would be invisible here.
 */
export function WorkspaceHeader({
  basePath,
  businessName,
  verticalLabel,
  showExtras = false,
  locked = false,
  signOut,
}: {
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  businessName: string;
  verticalLabel: string;
  /** True in the authenticated workspace, false on the shared link. */
  showExtras?: boolean;
  /**
   * The trial has ended (M28). Every other door redirects to Account anyway,
   * so showing seven tabs that all lead to the same place would be a menu of
   * disappointments. One door, and it is the one that can help.
   */
  locked?: boolean;
  /**
   * The sign-out control, passed in rather than imported.
   *
   * This header serves two doors. The authenticated workspace has a session to
   * end; the shared-link portal has none, and offering to sign out of
   * something nobody signed into would be a lie. So the control is a slot: the
   * workspace fills it, the portal leaves it empty.
   */
  signOut?: React.ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const base = `${basePath}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const currentSlug = rest.split('/').filter(Boolean)[0] ?? '';
  // The owner's own initial, as the handle to their account. A letter rather
  // than a person glyph: it is THEIR business, and a generic silhouette would
  // say "a user" instead.
  const initial = (businessName.trim().charAt(0) || 'H').toUpperCase();

  return (
    <header className="on-navy bg-ink-900 text-white sm:sticky sm:top-0 sm:z-30">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={base}
          aria-label={t('nav.home.aria')}
          className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1"
        >
          <HeadwayWordmark tone="dark" markClassName="h-7 w-7" nameClassName="text-[18px]" />
        </Link>

        {/* From tablet up: whose business this is, and the way out. */}
        <div className="hidden min-w-0 items-center gap-3 sm:flex">
          <span className="min-w-0 text-right">
            <span className="block truncate text-[13px] font-medium text-white">{businessName}</span>
            <span className="block truncate text-[11px] text-ink-300">{verticalLabel}</span>
          </span>
          {signOut}
        </div>

        {/* On a phone: the owner's account, one tap. When the workspace is
            locked More is not open, so the bar offers the way out directly —
            a locked owner must still be able to sign out. */}
        {locked ? (
          <div className="sm:hidden">{signOut}</div>
        ) : showExtras ? (
          <Link
            href={`${base}/more`}
            aria-label={t('nav.menu.aria', { business: businessName })}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full sm:hidden"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-full border border-brand-400/60 bg-white/5 text-[15px] font-semibold text-brand-200"
            >
              {initial}
            </span>
          </Link>
        ) : null}
      </div>

      {/* The doors, from tablet width up. On a phone they used to wrap into
          three rows of small text at the top of the screen — the far end from
          the hand holding it — and eight of them asked the owner to choose
          before they had read anything. The phone gets four doors on a bottom
          bar (`MobileTabBar`); this row is what desktop keeps, where there is
          room for the full set. */}
      <nav aria-label={t('nav.sections.label')} className="hidden border-t border-white/10 sm:block">
        <ul className="mx-auto flex max-w-5xl flex-wrap gap-x-1 px-4 sm:px-6">
          {SECTIONS.filter((s) => (locked ? s.slug === 'account' : showExtras || !s.extra)).map((s) => {
            const active =
              s.slug === 'checkin' ? CHECKIN_FAMILY.has(currentSlug) : currentSlug === s.slug;
            return (
              <li key={s.slug}>
                <Link
                  href={s.slug ? `${base}/${s.slug}` : base}
                  aria-current={active ? 'page' : undefined}
                  // The negative margin stays on the anchor so its box, and the
                  // focus ring drawn around it, still enclose the underline.
                  className="group -mb-px inline-flex"
                >
                  <TabLabel label={t(s.label)} active={active} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

/**
 * The bar that closes every page.
 *
 * Deep navy, edge to edge, and the only place on the surface where the mark
 * appears a second time. It carries the one sentence that says whose product
 * this is and who it serves: the customer leads, Headway follows them.
 *
 * IT CARRIED A TIMESTAMP FOR AN HOUR. "Last updated" was fed `new Date()` on a
 * force-dynamic page, so it printed the moment the page rendered, to the
 * minute, every time. A clock that can only ever say "now" answers nothing, and
 * this product has already settled what that phrase means elsewhere: it is the
 * date of the evidence, not of the render. Home says that honestly in
 * `view.basis`, so the footer says nothing.
 */
export function WorkspaceFooter({ businessName }: { businessName: string }) {
  const t = useT();
  return (
    <footer className="on-navy mt-12 bg-ink-950 px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <HeadwayWordmark tone="dark" markClassName="h-5 w-5" nameClassName="text-[15px]" />
          <span className="text-[13px] text-ink-300">{t('nav.footer.tagline')}</span>
        </div>
        <p className="text-[12px] text-ink-300">{businessName}</p>
      </div>
    </footer>
  );
}
