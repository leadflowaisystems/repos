'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * When a workspace page fails to render.
 *
 * Calm, and honest about what it knows: the page could not be shown, nothing
 * is lost, and here are two ways on. Like every error surface in RepOS it
 * shows no message, digest or path — the reason belongs in the server log,
 * not on an owner's phone.
 */
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ clientId?: string }>();
  const home = params?.clientId ? `/workspace/${params.clientId}` : '/';

  return (
    <div className="mx-auto max-w-xl py-16" role="alert">
      <p className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">Something went wrong</p>
      <h1 className="mt-2 text-[22px] leading-snug font-semibold tracking-tight text-ink-900">
        This page could not be shown just now.
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
        Your feedback and everything Headway has read are safe. Try again in a moment, or go back to
        Home.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-lg bg-ink-900 px-4 text-[14px] font-medium text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Try again
        </button>
        <Link
          href={home}
          className="inline-flex min-h-11 items-center rounded-lg border border-ink-300 px-4 text-[14px] font-medium text-ink-900 hover:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
