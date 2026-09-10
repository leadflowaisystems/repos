import Link from 'next/link';
import { HEADWAY_CUSTOMER_LINE, HeadwayWordmark } from '@/components/brand';
import { GET_STARTED, NAV_LINKS, SIGN_IN } from './links';

/**
 * The bar that closes the page: the same deep navy, the same mark and the
 * same sentence that close every page of the workspace, so the last thing a
 * visitor sees is the first thing an owner sees.
 */
export function SiteFooter() {
  return (
    <footer className="on-navy bg-ink-950 text-ink-300">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-10 py-14 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-16">
          <div>
            <HeadwayWordmark tone="dark" />
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-300">
              Customer intelligence and improvement for businesses that care about getting better.
            </p>
            {/* One line, not a section (M37). The portal itself is translated;
                this is only so a prospect knows before they ask. */}
            <p className="mt-3 text-[13px] text-ink-400">
              Available in English, Hindi and Marathi.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-[15px] text-ink-100 transition-colors hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href={SIGN_IN.href}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center text-[15px] text-ink-100 transition-colors hover:text-white"
                >
                  {SIGN_IN.label}
                </Link>
              </li>
              <li>
                <Link
                  href={GET_STARTED.href}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center text-[15px] text-ink-100 transition-colors hover:text-white"
                >
                  {GET_STARTED.label}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/10 py-5 text-[13px] text-ink-300">
          <span>{HEADWAY_CUSTOMER_LINE}</span>
          <span>Feedback left through Headway goes to the business&rsquo;s team only.</span>
        </div>
      </div>
    </footer>
  );
}
