import clsx from 'clsx';
import { PRODUCT_RULES } from '@/lib/marketing/site';
import { Heading, Section } from './primitives';

/**
 * HOW MUCH WORK IT IS.
 *
 * The question every owner asks and most product pages avoid. Three columns:
 * what the owner does once, what they do when they choose to look, and what
 * Headway does all the time without being asked.
 *
 * The numbers in the last column are the product's own rules — the first read
 * begins at FIRST_READING_AT responses, and a pattern needs MIN_MENTIONS_TO_NAME
 * customers among EMERGING_AT read (`src/lib/portal/ladder.ts`) — quoted
 * through `PRODUCT_RULES`, which the marketing test holds equal to them, so the
 * page cannot promise a different threshold from the one the workspace applies.
 * Nothing here promises a countdown: the workspace shows what customers said
 * from the first response (evidence ladder pass, Oct 2026).
 */

const COLUMNS = [
  {
    when: 'Once',
    who: 'You',
    items: [
      'Sign up and answer four questions about your business.',
      'Order printed QR cards from your workspace, or copy your feedback link.',
      'Put the card where customers can see it.',
    ],
  },
  {
    when: 'When you like',
    who: 'You',
    items: [
      'Open Home: the one thing that needs your attention, and what customers love.',
      'Decide: I’ll handle this, or Not doing this — and Done when the change is made.',
      'Read any response in full, in the customer’s own words.',
    ],
  },
  {
    when: 'All the time',
    who: 'Headway',
    items: [
      'Reads every response as it arrives.',
      `Shows what customers said from the very first response, and gives a first read at ${PRODUCT_RULES.firstReadingAt}.`,
      `Calls something a pattern only once at least ${PRODUCT_RULES.namedAt} customers raise it among ${PRODUCT_RULES.patternReadAt} or more responses.`,
      'Compares the feedback before and after every change you mark done.',
    ],
  },
] as const;

export function Effort() {
  return (
    <Section ground="cream" labelledBy="effort-heading">
      <Heading
        id="effort-heading"
        eyebrow="Your time"
        title="A few minutes to set up. Then Headway does the reading."
        lead="No spreadsheets, no tagging, no reports to build. Here is everything Headway asks of you — and everything it does on its own."
      />

      <div className="mt-12 grid grid-cols-1 gap-5 lg:mt-16 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const headway = col.who === 'Headway';
          return (
            <div
              key={col.when}
              className={clsx(
                'hw-rise rounded-2xl p-6 sm:p-7',
                headway ? 'on-navy bg-ink-900 text-white' : 'border border-ink-200 bg-white',
              )}
            >
              <p
                className={clsx(
                  'text-[11px] font-semibold tracking-[0.18em] uppercase',
                  headway ? 'text-brand-400' : 'text-brand-700',
                )}
              >
                {col.who}
              </p>
              <h3
                className={clsx(
                  'mt-1.5 text-[24px] leading-tight font-semibold tracking-[-0.02em]',
                  headway ? 'text-white' : 'text-ink-900',
                )}
              >
                {col.when}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.items.map((item) => (
                  <li
                    key={item}
                    className={clsx(
                      'flex items-baseline gap-3 text-[15px] leading-relaxed',
                      headway ? 'text-ink-100' : 'text-ink-700',
                    )}
                  >
                    <span
                      aria-hidden
                      className={clsx('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', headway ? 'bg-brand-400' : 'bg-brand-500')}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
