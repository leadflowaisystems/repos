/**
 * The client page's own loading boundary.
 *
 * There is a skeleton for the whole operator area one level up, but it replaces
 * everything — switching from one client to another blanked the entire shell.
 * Scoping a boundary here means the surrounding chrome stays put and only the
 * client's own content is replaced, which is what makes switching feel like
 * moving between two views rather than reloading the application.
 *
 * It also gives Next.js a boundary to stop at: the page's secondary panels
 * stream in behind their own Suspense boundaries, and this is what the browser
 * shows until the primary read resolves.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading this client…</span>
      <div className="h-7 w-72 animate-pulse rounded-lg bg-ink-100" />
      <div className="rounded-xl border border-ink-100 p-5">
        <div className="h-4 w-56 animate-pulse rounded bg-ink-100" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-ink-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-ink-100" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-ink-100 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
            <div className="mt-3 h-6 w-16 animate-pulse rounded bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
