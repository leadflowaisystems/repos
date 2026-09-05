'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

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
  { slug: 'pulse', label: 'This week', extra: true },
  { slug: 'review', label: 'This month', extra: true },
  { slug: 'analysis', label: 'Customers', extra: false },
  { slug: 'improvements', label: 'Improvements', extra: false },
  { slug: 'reviews', label: 'Reviews', extra: false },
  { slug: 'checkin', label: 'Check-in', extra: false },
  { slug: 'team', label: 'Team', extra: true },
] as const;

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
    <header className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight text-ink-900">
            {businessName}
          </p>
          <p className="text-[12px] text-ink-500">{verticalLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-medium tracking-widest text-ink-400 uppercase">
            Prepared by RepOS
          </p>
          {signOut}
        </div>
      </div>

      <nav
        aria-label="Sections"
        className="-mx-4 mt-4 overflow-x-auto overflow-y-hidden border-b border-ink-200 px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-1">
          {SECTIONS.filter((s) => showExtras || !s.extra).map((s) => {
            const active = currentSlug === s.slug;
            return (
              <li key={s.slug}>
                <Link
                  href={s.slug ? `${base}/${s.slug}` : base}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    '-mb-px inline-block border-b-2 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none',
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
