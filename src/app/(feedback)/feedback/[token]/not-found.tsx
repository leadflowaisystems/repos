/**
 * The same page for an unknown link, a paused one and a closed business.
 * It names nothing, so a guessed address learns nothing.
 */
export default function FeedbackNotFound() {
  return (
    <main>
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        This feedback link isn&rsquo;t active.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
        It may have been replaced. If you scanned a printed card, ask the team for the current one.
      </p>
    </main>
  );
}
