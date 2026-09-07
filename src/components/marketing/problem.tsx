import clsx from 'clsx';
import { DEMO_BUSINESS, PILE, RIGHT_NOW, SLOW_SERVICE, type PileItem } from '@/lib/marketing/demo';
import { CARD_EYEBROW, Heading, Section, Stars } from './primitives';

/**
 * THE PROBLEM, THEN THE TRANSITION.
 *
 * On the left, feedback the way it arrives: eight real records from the
 * demo dataset, in three languages, one of them nothing but taps. On the
 * right, what Headway made of the whole pile: one sentence and one step. The
 * arrow between them is the product.
 */

function Piece({ item }: { item: PileItem }) {
  if (item.kind === 'taps') {
    return (
      <li className="rounded-lg border border-ink-200 bg-white px-3.5 py-3">
        <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
          <Stars value={item.stars} />
          <span>Feedback QR &middot; taps only, no words</span>
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Each part of the visit, rated">
          {item.parts.map((part) => (
            <li
              key={part.label}
              className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-700 tabular-nums"
            >
              {part.label} <span className="font-semibold text-ink-900">{part.value}/5</span>
            </li>
          ))}
          {item.specifics.map((specific) => (
            <li
              key={specific}
              className="inline-flex items-center rounded-full border border-ink-900 bg-ink-900 px-2 py-0.5 text-[11px] text-white"
            >
              {specific}
            </li>
          ))}
        </ul>
      </li>
    );
  }
  return (
    <li className="rounded-lg border border-ink-200 bg-white px-3.5 py-3">
      <p className="text-[14px] leading-snug text-ink-900">&ldquo;{item.text}&rdquo;</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
        {item.stars !== null ? <Stars value={item.stars} /> : <span className="italic">No rating</span>}
        <span>&middot; {item.source}</span>
      </p>
    </li>
  );
}

export function Problem() {
  return (
    <Section id="problem" ground="cream" labelledBy="problem-heading">
      <Heading
        id="problem-heading"
        eyebrow="The problem"
        title={
          <>
            You don&rsquo;t need more feedback.
            <br className="hidden sm:block" /> You need to know what to do with it.
          </>
        }
        lead="Customer feedback is everywhere: reviews, comments, ratings, suggestions and conversations. It arrives in the middle of a working day, in whatever language the customer thinks in, one piece at a time."
      />
      <div className="hw-rise mt-6 max-w-3xl">
        <p className="text-[16px] leading-relaxed text-pretty text-ink-700 sm:text-[17px]">
          Reading all of it takes time you do not have. Finding the pattern takes longer. Deciding what
          matters most is a judgement call. And checking, weeks later, whether the change you made
          actually worked is the step almost nobody gets to.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:mt-16 lg:grid-cols-[minmax(0,6fr)_auto_minmax(0,5fr)] lg:gap-8">
        <figure className="hw-rise min-w-0">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className={CARD_EYEBROW}>What comes in</span>
            <span className="text-[12px] text-ink-500">
              Eight of {DEMO_BUSINESS.name}&rsquo;s {DEMO_BUSINESS.total} pieces of feedback, as they arrived
            </span>
          </figcaption>
          <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-label="Feedback as it arrived">
            {PILE.map((item, i) => (
              <Piece key={i} item={item} />
            ))}
          </ul>
        </figure>

        <div className="flex items-center justify-center lg:flex-col" aria-hidden>
          <span className="text-[34px] leading-none text-brand-500 lg:hidden">&darr;</span>
          <span className="hidden text-[40px] leading-none text-brand-500 lg:block">&rarr;</span>
        </div>

        <figure className="hw-rise flex min-w-0 flex-col">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className={CARD_EYEBROW}>What Headway says</span>
            <span className="text-[12px] text-ink-500">
              Read from all {DEMO_BUSINESS.total}
            </span>
          </figcaption>
          <div className="mt-3 flex flex-1 flex-col justify-center rounded-2xl border border-ink-200 bg-white p-6 shadow-[0_1px_2px_rgb(15_18_26/0.04)] sm:p-8">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-bad-600" aria-hidden />
              <p className={CARD_EYEBROW}>Right now</p>
            </div>
            <p className="mt-3 text-[26px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-ink-900 sm:text-[30px]">
              {RIGHT_NOW.headline}
            </p>
            <p className="mt-2 text-[12px] text-ink-500">{RIGHT_NOW.basis}</p>
            <div className="mt-6 border-t border-ink-200 pt-5">
              <p className={CARD_EYEBROW}>What to do</p>
              <p className="mt-1.5 text-[15px] leading-snug font-semibold text-pretty text-ink-900">
                {SLOW_SERVICE.suggestion}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
                What Headway suggested to {DEMO_BUSINESS.name} on 23 Jul 2026, with the {SLOW_SERVICE.count}{' '}
                comments behind it one tap away.
              </p>
            </div>
          </div>
        </figure>
      </div>

      <p
        className={clsx(
          'hw-rise mt-14 text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] text-ink-900 sm:text-[36px] lg:mt-20 lg:text-[44px]',
        )}
      >
        Headway does that work for you.
      </p>
    </Section>
  );
}
