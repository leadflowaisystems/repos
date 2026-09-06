'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { HeadwayWordmark, HEADWAY_CUSTOMER_LINE } from '@/components/brand';

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
 */
const SECTIONS = [
  { slug: '', label: 'Home', extra: false },
  { slug: 'analysis', label: 'Customers', extra: false },
  { slug: 'reviews', label: 'Reviews', extra: false },
  { slug: 'improvements', label: 'Improvements', extra: false },
  { slug: 'checkin', label: 'Check-in', extra: false },
  { slug: 'team', label: 'Team', extra: true },
  { slug: 'kit', label: 'Print kit', extra: true },
  { slug: 'account', label: 'Account', extra: true },
] as const;

/**
 * Five doors on the shared link, eight in the workspace. The weekly Pulse and
 * the monthly Review are still
 * there — same routes, same reports — but they are two windows on the same
 * question Check-in answers ("what changed?"), so they live as a period
 * switch at the top of that page rather than as two more tabs an owner has to
 * scroll past on a phone. Landing on either keeps Check-in highlighted.
 */
const CHECKIN_FAMILY = new Set(['checkin', 'pulse', 'review']);

export function WorkspaceHeader({
  basePath,
  businessName,
  verticalLabel,
  showExtras = false,
  signOut,
}: {
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  businessName: string;
  verticalLabel: string;
  /** True in the authenticated workspace, false on the shared link. */
  showExtras?: boolean;
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
  const pathname = usePathname();
  const base = `${basePath}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const currentSlug = rest.split('/').filter(Boolean)[0] ?? '';

  return (
    <header className="mb-6 sm:mb-8">
      {/* Whose software this is, then whose business it is about. Two rows
          rather than one, because on a phone a wordmark and a business name
          fighting for the same line makes both of them small. */}
      <div className="flex items-center justify-between gap-4">
        <HeadwayWordmark markClassName="h-6 w-6" nameClassName="text-[17px]" />
        {signOut}
      </div>
      <div className="mt-3 min-w-0">
        <h1 className="truncate text-[20px] leading-tight font-semibold tracking-tight text-ink-900 sm:text-[22px]">
          {businessName}
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-500">{verticalLabel}</p>
      </div>

      {/* The doors, always on screen. On a phone they wrap into rows
          rather than scrolling sideways — a tab nobody can see is a page
          nobody opens. From tablet width up the row stays put while the page
          scrolls, so "where am I" and "where else can I go" never leave. */}
      <nav
        aria-label="Sections"
        className="-mx-4 mt-4 border-b border-ink-200 bg-ink-50/95 px-4 backdrop-blur sm:sticky sm:top-0 sm:z-30 sm:mx-0 sm:px-0"
      >
        <ul className="flex flex-wrap gap-x-1">
          {SECTIONS.filter((s) => showExtras || !s.extra).map((s) => {
            const active =
              s.slug === 'checkin' ? CHECKIN_FAMILY.has(currentSlug) : currentSlug === s.slug;
            return (
              <li key={s.slug}>
                <Link
                  href={s.slug ? `${base}/${s.slug}` : base}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    '-mb-px inline-flex min-h-11 items-center border-b-2 px-2.5 text-[13px] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none sm:px-3',
                    active
                      ? 'border-ink-900 font-semibold text-ink-900'
                      : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800',
                  )}
                >
                  {s.label}
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
  return (
    <footer className="on-navy -mx-4 mt-12 bg-ink-950 px-4 py-4 sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <HeadwayWordmark tone="dark" markClassName="h-5 w-5" nameClassName="text-[15px]" />
          <span className="text-[13px] text-ink-300">{HEADWAY_CUSTOMER_LINE}</span>
        </div>
        <p className="text-[12px] text-ink-300">{businessName}</p>
      </div>
    </footer>
  );
}
