'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HeadwayWordmark } from '@/components/brand';

const ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/minutes', label: 'Minutes' },
  { href: '/settings', label: 'Settings' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({
  aiNote,
  signOut,
}: {
  aiNote: string;
  /** Rendered by the layout, so the sign-out action stays server-side. */
  signOut?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = ITEMS.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={clsx(
        'block rounded-lg px-3 py-2 text-[14px] font-medium transition-colors',
        isActive(pathname, item.href)
          ? 'bg-ink-900 text-white'
          : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
      )}
    >
      {item.label}
    </Link>
  ));

  return (
    <>
      {/* Mobile bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="repos-mobile-nav"
          className="rounded-lg border border-ink-300 px-3 py-1.5 text-[13px] font-medium text-ink-700"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open ? (
        <nav
          id="repos-mobile-nav"
          className="border-b border-ink-200 bg-white px-4 py-3 md:hidden"
        >
          <div className="space-y-1">{links}</div>
          {signOut ? <div className="mt-2 border-t border-ink-100 pt-2">{signOut}</div> : null}
        </nav>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-ink-200 bg-white md:flex md:flex-col">
        <div className="px-5 py-5">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3">{links}</nav>
        {signOut ? <div className="px-3 pb-2">{signOut}</div> : null}
        <div className="border-t border-ink-100 px-5 py-4">
          <p className="text-[11px] leading-relaxed text-ink-400">{aiNote}</p>
        </div>
      </aside>
    </>
  );
}

function Wordmark() {
  return <HeadwayWordmark markClassName="h-6 w-6" nameClassName="text-[16px]" />;
}
