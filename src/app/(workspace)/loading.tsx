'use client';

import { useT } from '@/components/portal/locale-provider';

/**
 * What the business owner sees while their workspace is still loading.
 *
 * Without this file Next.js keeps the PREVIOUS page on screen, at the previous
 * URL, until the new one has finished rendering — so a click on a slow page
 * looks like a click that did nothing. That is not a theory: it is exactly how
 * a successful portal-token rotation appeared to fail, because the redirect was
 * still in flight and nothing on screen had changed.
 *
 * A skeleton is not decoration here. It is the acknowledgement.
 *
 * The one line of text is read aloud rather than seen, and it is translated
 * like everything else. It is read from the provider the workspace shell has
 * already filled, so this still renders in one pass with nothing to wait for —
 * a fallback that had to fetch its own words would defeat the whole file.
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
