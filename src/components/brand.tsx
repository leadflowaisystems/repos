import clsx from 'clsx';

/**
 * THE HEADWAY MARK.
 *
 * Two navy uprights and a gold path that starts low on the left, crosses both,
 * and leaves higher on the right. Read as a letter it is an H. Read as a
 * picture it is the only thing this product claims to do: a business moving
 * forward because it heard something.
 *
 * The crossbar IS the path. There is no separate swoosh laid over a finished
 * letterform, which is what keeps it a mark rather than a logo with a graphic
 * next to it, and what lets it survive at sixteen pixels.
 *
 * Deliberately absent: a sparkle, a speech bubble, and a rising bar chart.
 *
 * ONE COMPONENT, FOUR JOBS. `icon` is the mark alone, for a favicon or a tab.
 * `wordmark` is the mark and the name, which is what a page header wants.
 * `tone` picks the treatment: navy uprights on a light ground, cream uprights
 * on a dark one. Nothing else varies, so the mark cannot drift between
 * surfaces.
 */

export type BrandTone = 'light' | 'dark';

const UPRIGHT: Record<BrandTone, string> = {
  light: '#102A43',
  dark: '#FAF7EF',
};

/** Gold holds on both grounds, so it does not change. */
const PATH_COLOUR = '#B78A3B';

export function HeadwayMark({
  tone = 'light',
  className,
  title,
}: {
  tone?: BrandTone;
  className?: string;
  /** Given only when the mark stands alone as the link back to Home. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* The two uprights. Squared, with the smallest radius that stops them
          looking like they were drawn by a rectangle tool. */}
      <rect x="4.5" y="6" width="5.2" height="28" rx="1.2" fill={UPRIGHT[tone]} />
      <rect x="30.3" y="6" width="5.2" height="28" rx="1.2" fill={UPRIGHT[tone]} />
      {/* The crossbar, which is also the path. It leaves the left upright low
          and meets the right one higher, so the letter itself carries the
          motion — nothing is laid over a finished H. Four earlier drafts put
          the rise outside the letter; each one read as a swoosh next to an
          initial, and stopped being an H at sixteen pixels. */}
      <path
        d="M4.5 23 C 15 23, 25 21.5, 35.5 17"
        stroke={PATH_COLOUR}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function HeadwayWordmark({
  tone = 'light',
  className,
  markClassName,
  nameClassName,
}: {
  tone?: BrandTone;
  className?: string;
  markClassName?: string;
  nameClassName?: string;
}) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <HeadwayMark tone={tone} className={clsx('h-7 w-7 shrink-0', markClassName)} />
      <span
        className={clsx(
          'text-[19px] leading-none font-semibold tracking-[-0.02em]',
          tone === 'dark' ? 'text-white' : 'text-ink-900',
          nameClassName,
        )}
      >
        Headway
      </span>
    </span>
  );
}

/**
 * The line under the name, used once per surface at most.
 *
 * It is a promise about behaviour, not a slogan about outcomes: Headway reads,
 * decides what matters, and remembers what changed. Kept out of the wordmark
 * itself so it never appears twice on one screen.
 */
export const HEADWAY_TAGLINE = 'Insights. Action. Progress.';

/** What the customer-facing surfaces say. The customer is the one leading. */
export const HEADWAY_CUSTOMER_LINE = 'Customers lead the way.';
