'use client';

import { useT } from '@/components/portal/locale-provider';

/**
 * What an owner sees between pressing a tab and the page arriving.
 *
 * The workspace already had a loading state one level up, in
 * `src/app/(workspace)/loading.tsx` — and it did its job exactly once: on the
 * way IN, when the whole workspace, header and all, was still being rendered.
 * It never showed again, because moving between Home and Feedback does not
 * re-render the workspace shell; only the page under the header changes, and
 * the boundary that covers THAT slot is the one in this folder, which did not
 * exist. So a tap on a tab kept the previous page on screen, untouched, until
 * the next one had finished rendering on the server. Locally that is eighty
 * milliseconds and invisible. On a phone, through a real connection, it was
 * the "nothing happened" that made people tap again.
 *
 * This boundary is what makes a tab answer at once. The header, the
 * navigation and the footer stay where they are; the page's place shows the
 * same calm skeleton the outer boundary uses, and the page streams in over it.
 * Same words, same shapes, same rule about the one line that is read aloud.
 *
 * Adding a loading boundary also changes what `<Link>` prefetches — see
 * `src/components/portal/link.tsx` for why every link in this tree is one
 * that does not.
 */
export default function Loading() {
  const t = useT();

  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('errors.loading.label')}</span>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-ink-100" />
      <div className="grid gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-ink-100 p-5">
            <div className="h-4 w-40 animate-pulse rounded bg-ink-100" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-ink-100" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-ink-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
