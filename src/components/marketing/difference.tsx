import { CAVEAT, IMPROVEMENT, IN_SHORT, MEASUREMENT, RIGHT_NOW, SLOW_SERVICE } from '@/lib/marketing/demo';
import { CARD_EYEBROW, Heading, Section } from './primitives';

/**
 * NOT A DASHBOARD.
 *
 * Four questions a business owner actually has, each answered the way
 * Headway answered it for the demo business. The last one is the whole
 * difference, so it is the largest thing in the section.
 */

const QUESTIONS = [
  {
    n: '1',
    q: 'What are customers saying?',
    a: (
      <>
        <p>{IN_SHORT.strengths}</p>
        <p className="mt-2 font-medium text-ink-900">{IN_SHORT.shortfall}</p>
      </>
    ),
  },
  {
    n: '2',
    q: 'What keeps coming up?',
    a: (
      <p>
        <span className="font-medium text-ink-900">{SLOW_SERVICE.label}</span> &middot; {SLOW_SERVICE.count}{' '}
        mentions &middot; {SLOW_SERVICE.share} of feedback &middot; {SLOW_SERVICE.recurrence}
      </p>
    ),
  },
  {
    n: '3',
    q: 'What should I do about it?',
    a: <p className="font-medium text-ink-900">{SLOW_SERVICE.suggestion}</p>,
  },
] as const;

export function Difference() {
  return (
    <Section ground="white" labelledBy="difference-heading">
      <Heading
        id="difference-heading"
        eyebrow="The difference"
        title="Not another dashboard full of numbers."
        lead="Headway does not just collect feedback or draw charts from it. It reads what customers said and answers the four questions a business owner actually has — with the evidence one tap away."
      />

      <ol className="mt-12 divide-y divide-ink-200 border-y border-ink-200 lg:mt-16">
        {QUESTIONS.map((item) => (
          <li
            key={item.n}
            className="hw-rise grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-3 py-7 sm:grid-cols-[3.5rem_minmax(0,5fr)_minmax(0,7fr)] sm:gap-x-8 sm:py-8"
          >
            <span className="font-mono text-[15px] leading-[1.6] text-brand-700 tabular-nums" aria-hidden>
              {item.n.padStart(2, '0')}
            </span>
            <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink-900 sm:text-[26px]">
              {item.q}
            </h3>
            <div className="col-start-2 text-[15px] leading-relaxed text-ink-600 sm:col-start-3 sm:text-[16px]">
              <p className={`${CARD_EYEBROW} mb-2`}>Headway answers</p>
              {item.a}
            </div>
          </li>
        ))}

        <li className="hw-rise grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-4 py-9 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-8 sm:py-12">
          <span className="font-mono text-[15px] leading-[1.6] text-brand-700 tabular-nums" aria-hidden>
            04
          </span>
          <div className="min-w-0">
            <h3 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink-900 sm:text-[48px] lg:text-[60px]">
              Did it get better?
            </h3>
            <div className="mt-6 grid grid-cols-1 gap-6 rounded-2xl border border-ink-200 bg-ink-50 p-5 sm:p-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
              <div>
                <p className={CARD_EYEBROW}>What happened</p>
                <p className="mt-2 text-[22px] leading-tight font-semibold tracking-tight text-bad-700 sm:text-[24px]">
                  {IMPROVEMENT.whatHappened}
                </p>
                <p className="mt-4 flex items-baseline gap-3 font-mono text-[34px] leading-none font-semibold tabular-nums sm:text-[40px]">
                  <span className="text-ink-900">{MEASUREMENT.before.share}</span>
                  <span className="text-[24px] text-ink-300" aria-hidden>
                    &rarr;
                  </span>
                  <span className="sr-only">then</span>
                  <span className="text-bad-700">{MEASUREMENT.after.share}</span>
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-600 tabular-nums">
                  {MEASUREMENT.before.count} of {MEASUREMENT.before.total} feedback entries before the change,{' '}
                  {MEASUREMENT.after.count} of {MEASUREMENT.after.total} after.
                </p>
              </div>
              <div className="text-[15px] leading-relaxed text-ink-700">
                <p className={CARD_EYEBROW}>What this means</p>
                <p className="mt-2 text-ink-900">{IMPROVEMENT.whatItMeans}</p>
                <p className="mt-2">{CAVEAT}</p>
                <p className={`${CARD_EYEBROW} mt-5`}>Headway will check next</p>
                <p className="mt-2">{RIGHT_NOW.next.watching}</p>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <p className="hw-rise mt-8 max-w-3xl text-[15px] leading-relaxed text-ink-600 sm:text-[16px]">
        Every figure Headway shows is counted from the feedback it has read &mdash; never estimated,
        never invented. When there is not enough to say something, it says so.
      </p>
    </Section>
  );
}
