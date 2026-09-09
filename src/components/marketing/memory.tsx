import clsx from 'clsx';
import { Population, Reveal } from '@/components/portal/disclose';
import { CAVEAT, IMPROVEMENT, MEASUREMENT, POPULATION } from '@/lib/marketing/demo';
import { formatDate } from '@/lib/format';
import { CARD_EYEBROW, Heading, Section } from './primitives';

/**
 * BUSINESS MEMORY.
 *
 * The most valuable thing Headway does is remember: what the problem was,
 * what the owner decided, what changed, what the feedback did afterwards,
 * where that leaves things now, and what is being watched. Told as one
 * chain, in the owner's own dates, with the two piles behind a tap — the
 * product's own before/after component, drawn one piece of feedback at a
 * time.
 */

const FORGETS = [
  'why something changed',
  'what customers were saying before',
  'what was tried',
  'whether it worked',
  'what still needs attention',
] as const;

type Moment = {
  label: string;
  who: 'Customer' | 'You' | 'Headway';
  when: Date | null;
  figure?: string;
  figureTone?: string;
  text: string;
  note?: string;
};

const CHAIN: Moment[] = [
  {
    label: 'Customer said',
    who: 'Customer',
    when: IMPROVEMENT.suggestedAt,
    figure: MEASUREMENT.before.share,
    text: `${MEASUREMENT.before.count} of the ${MEASUREMENT.before.total} feedback entries read by then mentioned slow service.`,
    note: `Headway suggested: ${IMPROVEMENT.suggested}`,
  },
  {
    label: 'You decided',
    who: 'You',
    when: IMPROVEMENT.decidedAt,
    text: `“${IMPROVEMENT.decision}”`,
  },
  {
    label: 'You changed it',
    who: 'You',
    when: IMPROVEMENT.doneAt,
    text: 'You told Headway the change was in place. From here on, new feedback is read against it.',
  },
  {
    label: 'What feedback did',
    who: 'Headway',
    when: IMPROVEMENT.measuredAt,
    figure: MEASUREMENT.after.share,
    figureTone: 'text-bad-700',
    text: `${MEASUREMENT.after.count} of the ${MEASUREMENT.after.total} feedback entries since the change mention it. ${IMPROVEMENT.whatHappened}.`,
    note: CAVEAT,
  },
  {
    label: 'Now',
    who: 'You',
    when: null,
    text: IMPROVEMENT.whatToDoNow,
    note: `You told us afterwards: “${IMPROVEMENT.learning}”`,
  },
  {
    label: 'Headway will watch',
    who: 'Headway',
    when: null,
    text: IMPROVEMENT.watching,
  },
];

const WHO: Record<Moment['who'], string> = {
  Customer: 'border-ink-900 bg-white text-ink-900',
  You: 'border-ink-900 bg-ink-900 text-white',
  Headway: 'border-brand-700 bg-brand-700 text-white',
};

export function Memory() {
  return (
    <Section ground="white" labelledBy="memory-heading">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <Heading
            id="memory-heading"
            eyebrow="Business memory"
            title="Your business should remember what it learned."
            lead="Businesses make changes all the time. But it is easy to forget:"
          />
          <ul className="hw-rise mt-5 space-y-2 text-[17px] text-ink-700">
            {FORGETS.map((item) => (
              <li key={item} className="flex items-baseline gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="hw-rise mt-8 text-[24px] leading-snug font-semibold tracking-[-0.02em] text-ink-900 sm:text-[28px]">
            Headway keeps that context together.
          </p>
          <p className="hw-rise mt-4 max-w-md text-[15px] leading-relaxed text-ink-600">
            Not a CRM, not a task list. One record per change &mdash; what customers said, what you did
            about it, and what happened next &mdash; kept beside the feedback it came from, in your own
            words and dates.
          </p>
        </div>

        <figure className="hw-rise min-w-0">
          <div className="rounded-2xl border border-ink-200 bg-ink-50 p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[20px] leading-tight font-semibold tracking-tight text-ink-900">{IMPROVEMENT.about}</p>
              <span className="text-[12px] font-medium tracking-wide text-ink-500 uppercase">Checked</span>
            </div>

            <ol className="mt-6">
              {CHAIN.map((moment, i) => {
                const last = i === CHAIN.length - 1;
                return (
                  <li key={moment.label} className="relative grid grid-cols-[2.25rem_1fr] gap-x-4">
                    {!last ? (
                      <span
                        aria-hidden
                        className="absolute top-9 bottom-0 left-[1.125rem] w-px -translate-x-1/2 bg-ink-200"
                      />
                    ) : null}
                    <span
                      aria-hidden
                      className={clsx(
                        'relative z-10 grid h-9 w-9 place-items-center rounded-full border text-[11px] font-semibold',
                        WHO[moment.who],
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className={clsx('min-w-0', last ? 'pb-1' : 'pb-7')}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                        <p className={CARD_EYEBROW}>{moment.label}</p>
                        {moment.when ? (
                          <p className="text-[12px] text-ink-500 tabular-nums">{formatDate(moment.when)}</p>
                        ) : null}
                      </div>
                      {moment.figure ? (
                        <p
                          className={clsx(
                            'mt-1.5 font-mono text-[32px] leading-none font-semibold tabular-nums',
                            moment.figureTone ?? 'text-ink-900',
                          )}
                        >
                          {moment.figure}
                        </p>
                      ) : null}
                      <p
                        className={clsx(
                          'mt-1.5 text-[15px] leading-relaxed text-ink-900',
                          moment.who === 'You' && !moment.figure && 'font-medium',
                        )}
                      >
                        {moment.text}
                      </p>
                      {moment.note ? (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{moment.note}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 border-t border-ink-200 pt-4">
              <Reveal summary="Show the two piles" tone="strong">
                <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
                  <Population population={POPULATION} />
                </div>
              </Reveal>
            </div>
          </div>
          <figcaption className={`${CARD_EYEBROW} mt-3`}>
            One change on the Improvements page &middot; Corner Cafe
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}
