import clsx from 'clsx';
import { HeadwayWordmark } from '@/components/brand';
import { ProofChips } from '@/components/portal/disclose';
import { DEMO_BUSINESS, PROOFS, RIGHT_NOW } from '@/lib/marketing/demo';
import { CARD_EYEBROW, Chip } from './primitives';

/**
 * HOME, FOR THE DEMO BUSINESS.
 *
 * The block an owner reads in ten seconds, drawn with the same bones as the
 * real one: RIGHT NOW, WHY, three figures that open into what they count,
 * WHAT TO DO, and what Headway will check next. The chips are the product's
 * own disclosure component, so tapping "39% of feedback" here shows the same
 * three customers, and "More often after your change" the same two piles,
 * that an owner would see.
 *
 * Two things are different on purpose. The headline is a paragraph, because
 * a public page has one heading and this is not it. And the gold button is a
 * picture of a button: the whole reading it leads to lives inside a
 * workspace, and a control that goes nowhere is worse than one that is
 * plainly part of the illustration.
 */

const TABS = ['Home', 'Customers', 'Reviews', 'Improvements', 'Check-in'] as const;

function MiniRow({
  eyebrow,
  chip,
  chipTone,
  note,
  text,
  count,
}: {
  eyebrow: string;
  chip: string;
  chipTone: 'watch' | 'keep';
  note: string;
  text: string;
  count: string;
}) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className={CARD_EYEBROW}>{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2">
          <Chip tone={chipTone}>{chip}</Chip>
          <span className="text-[12px] text-ink-600">{note}</span>
        </span>
        <span className="text-[12px] text-ink-500 tabular-nums">{count}</span>
      </div>
      <p className="mt-1.5 text-[14px] leading-snug font-medium text-ink-900">{text}</p>
    </div>
  );
}

export function RightNow() {
  return (
    <figure className="hw-rise min-w-0">
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_1px_2px_rgb(15_18_26/0.04),0_28px_56px_-28px_rgb(16_42_67/0.28)]">
        {/* The workspace chrome, reduced: whose software, whose business, which door. */}
        <div className="border-b border-ink-200 bg-ink-50 px-5 pt-4 sm:px-6">
          <HeadwayWordmark markClassName="h-5 w-5" nameClassName="text-[14px]" />
          <p className="mt-2.5 text-[16px] leading-tight font-semibold tracking-tight text-ink-900">
            {DEMO_BUSINESS.name}
          </p>
          <p className="text-[12px] text-ink-500">{DEMO_BUSINESS.verticalLabel}</p>
          <ul className="mt-3 flex gap-4 overflow-hidden text-[12px]" aria-hidden>
            {TABS.map((tab, i) => (
              <li
                key={tab}
                className={clsx(
                  '-mb-px border-b-2 pb-2 whitespace-nowrap',
                  i === 0 ? 'border-ink-900 font-semibold text-ink-900' : 'border-transparent text-ink-500',
                  i === TABS.length - 1 && 'hidden sm:block',
                )}
              >
                {tab}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-bad-600" aria-hidden />
              <p className={CARD_EYEBROW}>Right now</p>
            </div>
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span className="rounded-full border border-bad-200 bg-bad-50 px-2 py-0.5 text-[11px] font-semibold text-bad-700">
                {RIGHT_NOW.direction.value}
              </span>
              <span className="text-[11px] text-ink-500">{RIGHT_NOW.direction.scope}</span>
            </span>
          </div>

          <p className="mt-3 max-w-md text-[24px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-ink-900 sm:text-[28px]">
            {RIGHT_NOW.headline}
          </p>
          <p className="mt-2 text-[12px] text-ink-500">{RIGHT_NOW.basis}</p>

          <div className="mt-5">
            <p className={CARD_EYEBROW}>Why</p>
            <p className="mt-1.5 text-[15px] leading-snug font-medium text-pretty text-ink-900">
              {RIGHT_NOW.why}
            </p>
          </div>

          <div className="mt-4">
            <ProofChips proofs={PROOFS} />
          </div>

          <div className="mt-6 border-t border-ink-200 pt-4">
            <p className={CARD_EYEBROW}>What to do</p>
            <p className="mt-1.5 text-[15px] leading-snug font-semibold text-ink-900">{RIGHT_NOW.next.headline}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600">{RIGHT_NOW.next.detail}</p>
            <span
              aria-hidden
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-[13px] font-semibold text-white"
            >
              {RIGHT_NOW.next.cta} <span>&rarr;</span>
            </span>
          </div>

          <div className="mt-5 border-t border-ink-200 pt-4">
            <p className={CARD_EYEBROW}>Headway will check next</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-700">{RIGHT_NOW.next.watching}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-ink-200 border-t border-ink-200 bg-ink-50 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <MiniRow
            eyebrow="Headway is watching"
            chip="Watching"
            chipTone="watch"
            note="Important, not urgent"
            text={RIGHT_NOW.watching.label}
            count={RIGHT_NOW.watching.count}
          />
          <MiniRow
            eyebrow="Going well"
            chip="Keep doing this"
            chipTone="keep"
            note="Protect this"
            text={RIGHT_NOW.goingWell.label}
            count={RIGHT_NOW.goingWell.count}
          />
        </div>
      </div>
      <figcaption className="mt-3 text-[12px] leading-relaxed text-ink-500">
        Corner Cafe is Headway&rsquo;s demonstration business: {DEMO_BUSINESS.total} pieces of feedback, one
        change, one measurement. Every figure on this page comes from it. Tap a figure to see what it
        counts.
      </figcaption>
    </figure>
  );
}
