'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;

  // Ordered by how often the operator needs them. "Print kit" rather than
  // "Feedback kit" so it cannot be confused with the Feedback inbox next to it.
  const tabs = [
    { href: base, label: 'Overview', exact: true },
    { href: `${base}/feedback`, label: 'Feedback', exact: false },
    { href: `${base}/qr`, label: 'Feedback QR', exact: false },
    { href: `${base}/snapshots`, label: 'Snapshots', exact: false },
    { href: `${base}/minutes`, label: 'Minutes', exact: false },
    { href: `${base}/context`, label: 'Business context', exact: false },
    { href: `${base}/kit`, label: 'Print kit', exact: false },
    { href: `${base}/profile`, label: 'Profile', exact: false },
  ];

  return (
    <nav className="mb-6 -mx-1 flex gap-1 overflow-x-auto border-b border-ink-200 pb-px">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            // All eight destinations are per-client dynamic routes, and this
            // nav is rendered by the client layout — so it is on screen the
            // whole time an operator is inside a business. With Next's default
            // prefetch that means landing on any tab immediately asks the
            // server to render up to eight more, each one paying the full
            // client-detail cost against a database on another continent, and
            // the tab the operator actually clicked then queues behind them.
            // Measured in production: ~7s to open a client, 12-15s to switch
            // tabs — the switch being SLOWER than the first open is the
            // signature of the speculative work, not of the page itself.
            //
            // Same fix and same reasoning as command-card.tsx. Navigation is
            // unchanged; loading.tsx still draws the frame on click.
            prefetch={false}
            className={clsx(
              'shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
              active
                ? 'border-ink-900 text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
