import Link from 'next/link';
import type { SinceLastVisit } from '@/lib/retention/service';
import { sinceLabel } from '@/lib/retention/service';

/**
 * SINCE YOU WERE LAST HERE.
 *
 * The one thing on Home that exists to be a reason to come back, and it is
 * built to be a fact rather than a hook. It appears only when something
 * actually happened while the owner was away, says what it was in a sentence,
 * and points at the page where the detail lives. When the week was quiet it
 * renders nothing — not "0 new", not "keep it up", not a streak.
 *
 * Deliberately absent: any number that decays, any language that implies a
 * cost to not returning, and any count that would still be here tomorrow.
 */

/**
 * The four readings, in the words the rest of the portal uses for them.
 *
 * The tail is the point: "after the change" puts the reading next to the
 * change in time and stops there. The words this replaced — improved, got
 * worse — read as a verdict on the change itself, which is more than counting
 * mentions before and after can carry.
 */
const RESULT_WORD: Record<string, string> = {
  IMPROVED: 'Mentioned less often after the change.',
  WORSENED: 'Mentioned more often after the change.',
  NO_CLEAR_CHANGE: 'No clear difference after the change.',
  INSUFFICIENT_DATA: 'Not enough feedback after the change.',
};

function arrivedLine(since: SinceLastVisit): string | null {
  if (since.arrived === 0) return null;
  // Counted in pieces of feedback, not customers: this counts what arrived,
  // and one customer can leave several.
  const one = since.arrived === 1;
  const items = one ? '1 piece of feedback' : `${since.arrived} pieces of feedback`;
  if (since.read >= since.arrived) {
    return one
      ? `${items} came in, and Headway has read it.`
      : `${items} came in, and Headway has read them all.`;
  }
  if (since.read === 0) {
    return one
      ? `${items} came in. Headway is reading it now.`
      : `${items} came in. Headway is reading them now.`;
  }
  return `${items} came in. Headway has read ${since.read} so far and is reading the rest.`;
}

export function SinceVisit({
  since,
  basePath,
}: {
  since: SinceLastVisit;
  basePath: string;
}) {
  const arrived = arrivedLine(since);
  const done =
    since.done > 0
      ? since.done === 1
        ? 'One improvement is now done.'
        : `${since.done} improvements are now done.`
      : null;

  return (
    <section className="mb-8 max-w-3xl border-l-2 border-brand-400 pl-4">
      <h2 className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
        {sinceLabel(since.daysAgo)}
      </h2>

      {arrived ? (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-900">
          {arrived}{' '}
          <Link
            href={`${basePath}/reviews`}
            className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
          >
            Read the comments <span aria-hidden>→</span>
          </Link>
        </p>
      ) : null}

      {since.measured.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {since.measured.map((m) => (
            <li key={m.id} className="text-[15px] leading-relaxed text-ink-900">
              Headway checked <span className="font-medium">{m.title}</span> against the feedback
              that has come in since. {RESULT_WORD[m.result] ?? 'No result yet.'}{' '}
              <Link
                href={`${basePath}/improvements`}
                className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
              >
                See the result <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {done ? <p className="mt-2 text-[15px] leading-relaxed text-ink-900">{done}</p> : null}
    </section>
  );
}
