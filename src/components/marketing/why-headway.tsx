import clsx from 'clsx';
import { Heading, Section } from './primitives';

/**
 * WHAT EACH KIND OF TOOL TELLS YOU.
 *
 * Three honest sentences about three honest categories, and then Headway's.
 * Nobody is attacked: each of the first three does exactly what it says. The
 * last row is simply longer, because it answers more.
 */

const ROWS = [
  { name: 'Traditional feedback tools', says: 'Here are your responses.' },
  { name: 'Review tools', says: 'Here are your reviews.' },
  { name: 'Dashboards', says: 'Here are your numbers.' },
] as const;

export function WhyHeadway() {
  return (
    <Section ground="cream" labelledBy="why-heading">
      <Heading id="why-heading" eyebrow="Why Headway" title="What each kind of tool tells you." />

      <dl className="mt-12 lg:mt-16">
        {ROWS.map((row) => (
          <div
            key={row.name}
            className="hw-rise grid grid-cols-1 gap-x-8 gap-y-1 border-t border-ink-200 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
          >
            <dt className="text-[15px] font-medium text-ink-600">{row.name}</dt>
            <dd className="text-[20px] leading-snug text-ink-700 sm:text-[22px]">&ldquo;{row.says}&rdquo;</dd>
          </div>
        ))}
        <div
          className={clsx(
            'hw-rise on-navy mt-4 grid grid-cols-1 gap-x-8 gap-y-3 rounded-2xl bg-ink-950 px-6 py-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:px-8 sm:py-10',
          )}
        >
          <dt className="text-[15px] font-semibold text-brand-400">Headway</dt>
          <dd className="text-[22px] leading-snug font-semibold tracking-[-0.02em] text-balance text-white sm:text-[28px]">
            &ldquo;Here is what your customers are telling you, what matters, what you can do, and what happened
            after you changed it.&rdquo;
          </dd>
        </div>
      </dl>
    </Section>
  );
}
