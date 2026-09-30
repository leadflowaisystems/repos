import { CONTAINER } from './primitives';

/**
 * THE FIVE QUESTIONS, ANSWERED BEFORE THE PAGE GOES DEEPER.
 *
 * A busy owner decides in the first scroll whether this is for them, and the
 * five things they need to know to decide are always the same. So they are
 * answered here, in a sentence or two each, and every section below is the
 * longer version of one of these answers for anybody who wants it.
 *
 * Each answer describes something the product does today. Nothing here is a
 * plan.
 */

const ANSWERS = [
  {
    q: 'What is Headway?',
    a: 'A private feedback system for local businesses. Customers tell you how their visit went; Headway turns it into what to keep doing and what to fix.',
  },
  {
    q: 'How does it work?',
    a: 'A QR card on your counter opens a one-minute feedback page. Headway reads each response as it arrives and groups what keeps coming up.',
  },
  {
    q: 'What do you see?',
    a: 'A short brief on your phone: what needs your attention, what customers love, the newest responses, and what happened after your last change.',
  },
  {
    q: 'Why is it useful?',
    a: 'You stop guessing. Every suggestion comes with the customers’ own words, and after you act, Headway compares the feedback before and after.',
  },
  {
    q: 'How much work is it?',
    a: 'Four answers to set up. After that, open Home when you like: read one card, make one decision. Headway does the reading.',
  },
] as const;

export function AtAGlance() {
  return (
    <section aria-labelledby="glance-heading" className="border-y border-ink-200 bg-white py-14 sm:py-16 lg:py-20">
      <div className={CONTAINER}>
        <h2 id="glance-heading" className="text-[13px] font-semibold tracking-[0.18em] text-brand-700 uppercase">
          Headway in one minute
        </h2>
        <ol className="mt-8 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {ANSWERS.map((item, i) => (
            <li key={item.q} className="hw-rise border-t-2 border-ink-900 pt-4">
              <p className="font-mono text-[12px] text-brand-700 tabular-nums" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-1.5 text-[18px] leading-snug font-semibold tracking-[-0.01em] text-ink-900">
                {item.q}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-pretty text-ink-600">{item.a}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
