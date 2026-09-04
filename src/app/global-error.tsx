'use client';

import './globals.css';

/**
 * The last resort (M16).
 *
 * Only reached when a root layout itself fails, so it brings its own document.
 * Like every other error surface in RepOS it shows no detail: not the message,
 * not the digest, not a path.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink-50">
        <main className="mx-auto w-full max-w-xl px-6 py-24">
          <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
            Something went wrong.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
            This page could not be shown. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-ink-900 px-4 py-2 text-[14px] font-medium text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
