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

const RESULT_WORD: Record<string, string> = {
  IMPROVED: 'improved',
  WORSENED: 'got worse',
  NO_CLEAR_CHANGE: 'showed no clear change',
  INSUFFICIENT_DATA: 'has not been mentioned enough to tell yet',
};

function arrivedLine(since: SinceLastVisit): string | null {
  if (since.arrived === 0) return null;
  const items = since.arrived === 1 ? '1 customer' : `${since.arrived} customers`;
  if (since.read >= since.arrived) {
    return `${items} left feedback, and RepOS has read all of it.`;
  }
  if (since.read === 0) {
    return `${items} left feedback. RepOS is reading it now.`;
  }
  return `${items} left feedback. ${since.read} read so far, the rest is being read now.`;
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
      ? `${since.done === 1 ? 'One improvement' : `${since.done} improvements`} moved to done.`
      : null;

  return (
    <section className="mb-8 border-l-2 border-ink-300 pl-4">
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
            Read what they said
          </Link>
        </p>
      ) : null}

      {since.measured.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {since.measured.map((m) => (
            <li key={m.id} className="text-[15px] leading-relaxed text-ink-900">
              RepOS checked <span className="font-medium">{m.title}</span> against the feedback
              that has come in since, and it{' '}
              {RESULT_WORD[m.result] ?? 'has been measured'}.{' '}
              <Link
                href={`${basePath}/improvements`}
                className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
              >
                See the result
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {done ? <p className="mt-2 text-[15px] leading-relaxed text-ink-900">{done}</p> : null}
    </section>
  );
}
