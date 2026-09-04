'use client';

import { Button } from '@/components/ui';

/**
 * Something went wrong inside RepOS (M16).
 *
 * Deliberately says almost nothing. React hands this component a message that
 * in production is already replaced by a digest, but even so nothing from the
 * error object is rendered — a page is not the place for file paths, table
 * names or query text. The full error is in the server's own log, where only
 * the person running RepOS can read it.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-[20px] font-semibold text-ink-900">Something went wrong.</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
        Nothing was lost — RepOS could not finish drawing this page. Try again, and if it keeps
        happening, take a backup before doing anything else.
      </p>
      <div className="mt-6">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
