'use client';

/**
 * When the customer feedback page fails to load or to send.
 *
 * A customer standing at the counter needs two facts: nothing was sent, and
 * trying again is safe. No message, digest or path is shown — those belong in
 * the server log. A response is stored only once it is safely saved, so a
 * retry never double-counts and never silently drops what they wrote.
 */
export default function FeedbackError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16" role="alert">
      <h1 className="text-[20px] leading-snug font-semibold tracking-tight text-ink-900">
        Sorry, something went wrong.
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
        Your feedback was not sent. Please try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink-900 px-4 text-[16px] font-semibold text-white hover:bg-ink-800"
      >
        Try again
      </button>
    </div>
  );
}
