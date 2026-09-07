'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { NAV_LINKS, SIGN_IN } from './links';

/**
 * The menu on a phone.
 *
 * The only script the public site runs: a button that opens a list of the
 * four places on the page and the sign-in link, and closes it again when one
 * is chosen or Escape is pressed. The primary call to action is not in here —
 * it stays in the bar, beside this button, so it is never behind a tap.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-11 items-center rounded-lg border border-ink-300 bg-white px-3 text-[14px] font-medium text-ink-800 hover:border-ink-900"
      >
        {open ? 'Close' : 'Menu'}
      </button>
      {open ? (
        <nav
          id={panelId}
          aria-label="Site"
          className="absolute inset-x-0 top-full border-b border-ink-200 bg-white px-5 py-3 shadow-[0_12px_32px_rgb(15_18_26/0.08)]"
        >
          <ul className="space-y-1">
            {NAV_LINKS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-[16px] font-medium text-ink-800 hover:bg-ink-100 hover:text-ink-900"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="border-t border-ink-100 pt-1">
              <Link
                href={SIGN_IN.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-[16px] font-medium text-ink-800 hover:bg-ink-100 hover:text-ink-900"
              >
                {SIGN_IN.label}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
