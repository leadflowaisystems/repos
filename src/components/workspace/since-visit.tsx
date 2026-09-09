import Link from 'next/link';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';
import type { Translator } from '@/lib/i18n/t';
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
 *
 * THE WORDS LIVE IN THE DICTIONARY (M31), under `pulse.since.*`, in English,
 * Hindi and Marathi. Each line is one whole sentence with the numbers as holes
 * in it, so a translation can put the number where its own grammar wants it.
 */

/**
 * The four readings, as dictionary keys.
 *
 * The tail is the point: "after the change" puts the reading next to the
 * change in time and stops there. The words this replaced — improved, got
 * worse — read as a verdict on the change itself, which is more than counting
 * mentions before and after can carry.
 */
const RESULT_WORD: Record<string, MessageKey> = {
  IMPROVED: 'pulse.since.result.improved',
  WORSENED: 'pulse.since.result.worsened',
  NO_CLEAR_CHANGE: 'pulse.since.result.noChange',
  INSUFFICIENT_DATA: 'pulse.since.result.notEnough',
};

function arrivedLine(since: SinceLastVisit, t: Translator<MessageKey>): string | null {
  if (since.arrived === 0) return null;
  // Counted in feedback entries, not customers: this counts what arrived,
  // and one customer can leave several.
  if (since.read >= since.arrived) {
    return t.plural('pulse.since.arrived.read', since.arrived);
  }
  if (since.read === 0) {
    return t.plural('pulse.since.arrived.reading', since.arrived);
  }
  return t('pulse.since.arrived.partial', { count: since.arrived, read: since.read });
}

export async function SinceVisit({
  since,
  basePath,
}: {
  since: SinceLastVisit;
  basePath: string;
}) {
  const t = await getTranslator();
  const arrived = arrivedLine(since, t);
  const done = since.done > 0 ? t.plural('pulse.since.done', since.done) : null;
  // One key holds the whole sentence, so Hindi and Marathi can put the name of
  // the change where their own grammar wants it. The component splits the
  // finished sentence at that one hole to keep the name emphasised; it never
  // assembles the sentence out of parts.
  const measured = t('pulse.since.measured').split('{title}');

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
            {t('pulse.since.link.feedback')} <span aria-hidden>→</span>
          </Link>
        </p>
      ) : null}

      {since.measured.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {since.measured.map((m) => (
            <li key={m.id} className="text-[15px] leading-relaxed text-ink-900">
              {measured[0]}
              <span className="font-medium">{m.title}</span>
              {measured[1]} {t(RESULT_WORD[m.result] ?? 'pulse.since.result.none')}{' '}
              <Link
                href={`${basePath}/improvements`}
                className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
              >
                {t('pulse.since.link.result')} <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {done ? <p className="mt-2 text-[15px] leading-relaxed text-ink-900">{done}</p> : null}
    </section>
  );
}
