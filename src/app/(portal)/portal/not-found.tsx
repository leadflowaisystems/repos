/**
 * The same page for a mistyped link, a link that has been replaced, and a
 * business that is no longer a client (M16).
 *
 * It names nothing and confirms nothing. Someone trying addresses learns only
 * that this one does not open anything — never whether a real business sits
 * behind a near miss.
 *
 * It sits one level above `[token]` on purpose. The token is resolved in the
 * layout, and a layout that calls notFound() is caught by its PARENT segment —
 * a not-found file inside `[token]` would never be reached.
 */
export default function PortalNotFound() {
  return (
    <main>
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        This link doesn&rsquo;t open anything.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
        It may have been replaced with a newer one. Ask whoever sent it to you for the current
        link.
      </p>
    </main>
  );
}
