import Link from 'next/link';
import { HeadwayWordmark } from '@/components/brand';
import { MobileNav } from './mobile-nav';
import { GET_STARTED, NAV_LINKS, SIGN_IN } from './links';

/**
 * The bar at the top of the public site.
 *
 * Four places on the page, a way in for people with an account, and the one
 * call to action — which stays visible at every width, including beside the
 * menu button on a phone, so the thing the page exists to offer is never
 * more than a tap away.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-ink-50/90 backdrop-blur">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#top" className="inline-flex min-h-11 items-center" aria-label="Headway — top of page">
          <HeadwayWordmark markClassName="h-7 w-7" nameClassName="text-[19px]" />
        </a>

        <nav aria-label="Site" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-[14px] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={SIGN_IN.href}
            prefetch={false}
            className="hidden min-h-11 items-center rounded-lg px-3 text-[14px] font-medium text-ink-700 transition-colors hover:text-ink-900 sm:inline-flex"
          >
            {SIGN_IN.label}
          </Link>
          <Link
            href={GET_STARTED.href}
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-900"
          >
            {GET_STARTED.label}
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
