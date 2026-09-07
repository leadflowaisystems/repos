import clsx from 'clsx';

/**
 * THE PATH.
 *
 * The one graphic motif the public site allows itself is the crossbar of the
 * Headway mark: a gold line that starts low on the left and leaves higher on
 * the right. On the mark it is the letter's own stroke; here it is drawn on
 * its own, large and faint, as the thing every section is about — a business
 * moving forward because it heard something.
 *
 * Always decorative, always hidden from assistive technology, never carrying
 * a meaning the words beside it do not.
 */
export function PathMotif({ className, strokeWidth = 14 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 800 220" className={clsx('block', className)} aria-hidden focusable="false">
      <path
        d="M0 190 C 240 190, 480 160, 800 30"
        stroke="#B78A3B"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** A short rule that rises the way the path does: the site's section marker. */
export function PathRule({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 14" className={clsx('block h-3.5 w-20', className)} aria-hidden focusable="false">
      <path d="M2 11 C 26 11, 50 9, 78 3" stroke="#B78A3B" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
