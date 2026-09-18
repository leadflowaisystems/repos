'use client';

import { HeadwayMark } from '@/components/brand';
import { useT } from '@/components/portal/locale-provider';

/**
 * THE SHAPE OF THE NEXT SCREEN, WHILE IT ARRIVES (final experience pass).
 *
 * This replaces three grey boxes that could have belonged to any product. It
 * is shaped like what is coming — the brief's navy band, one story, a short
 * list — so the page that streams in lands on the layout the owner was already
 * looking at, rather than jumping.
 *
 * IT CLAIMS NOTHING. The words read aloud say the page is loading, because
 * that is what is happening. "Headway is reading your feedback" would be true
 * only when a reading run is actually going, and a loading screen has no way
 * to know that — so it does not say it. The pages themselves say "being read
 * now" with a count, when there is something being read.
 *
 * `motion-safe:` on every pulse: someone who has asked their system for less
 * motion gets a still placeholder, not a flickering one.
 */
export function BriefSkeleton({ withBar = false }: { withBar?: boolean }) {
  const t = useT();
  const block = 'rounded-lg bg-ink-100 motion-safe:animate-pulse';
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('errors.loading.label')}</span>

      {/* On the way IN the shell is not there yet, so this draws the bar too:
          the mark is the first thing an owner sees, even before the page. */}
      {withBar ? (
        <div className="bg-ink-900 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <HeadwayMark tone="dark" className="h-6 w-6" />
            <span className="h-3 w-20 rounded bg-white/15" />
          </div>
        </div>
      ) : null}

      <div className={withBar ? 'mx-auto max-w-5xl px-4 sm:px-6' : ''}>
        {/* The brief's band. */}
        <div className="-mx-4 bg-ink-900 px-4 pt-2 pb-6 sm:mx-0 sm:mt-2 sm:rounded-2xl sm:px-6 sm:pt-6">
          <div className="h-3 w-24 rounded bg-white/15 motion-safe:animate-pulse" />
          <div className="mt-3 h-7 w-56 rounded bg-white/20 motion-safe:animate-pulse" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/10 motion-safe:animate-pulse" />
            ))}
          </div>
        </div>

        {/* The one story. */}
        <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-5">
          <div className={`h-3 w-32 ${block}`} />
          <div className={`mt-3 h-6 w-48 ${block}`} />
          <div className={`mt-3 h-8 w-24 ${block}`} />
          <div className={`mt-4 h-3 w-full ${block}`} />
          <div className={`mt-2 h-3 w-4/5 ${block}`} />
          <div className={`mt-5 h-12 w-40 ${block}`} />
        </div>

        {/* What follows it. */}
        <div className="mt-6 space-y-3">
          <div className={`h-3 w-28 ${block}`} />
          <div className={`h-14 w-full ${block}`} />
        </div>
      </div>
    </div>
  );
}
