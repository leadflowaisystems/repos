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
    { href: `${base}/snapshots`, label: 'Snapshots', exact: false },
    { href: `${base}/minutes`, label: 'Minutes', exact: false },
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
