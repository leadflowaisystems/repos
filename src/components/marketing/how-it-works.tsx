import clsx from 'clsx';
import { Heading, Section } from './primitives';

/**
 * FOUR STEPS, ONE LOOP.
 *
 * The steps are what a visitor reads; the loop is what they should remember.
 * Most tools stop after the first step. Headway is built around the whole
 * circle, and the drawing says so: the last stop leads back to the first.
 */

const STEPS = [
  {
    n: '01',
    name: 'Listen',
    line: 'Give customers a simple, honest way to tell you what they experienced.',
  },
  {
    n: '02',
    name: 'Understand',
    line: 'Headway finds recurring themes, changes over time, praise, frustration and signals that deserve attention.',
  },
  {
    n: '03',
    name: 'Act',
    line: 'Turn the important signal into one clear, practical next step.',
  },
  {
    n: '04',
    name: 'Improve',
    line: 'Keep watching after you make a change so you can see what happened next.',
  },
] as const;

const LOOP = [
  { who: 'Customer', what: 'Customer said' },
  { who: 'You', what: 'You decided' },
  { who: 'You', what: 'You changed it' },
  { who: 'Headway', what: 'Headway watches' },
  { who: 'Customer', what: 'Feedback comes back' },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-heading">
      <Heading id="how-heading" eyebrow="How Headway works" title="Four steps. One loop." />

      <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li key={step.n} className="hw-rise border-t-2 border-ink-900 pt-5">
            <p className="font-mono text-[13px] text-brand-700 tabular-nums">{step.n}</p>
            <h3 className="mt-2 text-[13px] font-semibold tracking-[0.18em] text-ink-900 uppercase">
              {step.name}
            </h3>
            <p className="mt-3 text-[16px] leading-relaxed text-pretty text-ink-700">{step.line}</p>
          </li>
        ))}
      </ol>

      <figure className="hw-rise mt-16 rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 lg:mt-24 lg:p-10">
        <figcaption className="max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-700 uppercase">The loop</p>
          <p className="mt-2 text-[22px] leading-snug font-semibold tracking-[-0.02em] text-ink-900 sm:text-[26px]">
            A change is never the end of the story. It is what the next feedback gets compared with.
          </p>
        </figcaption>

        <ol className="relative mt-8 grid grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-0">
          {LOOP.map((stop, i) => {
            const last = i === LOOP.length - 1;
            return (
              <li key={stop.what} className="relative flex items-center gap-3 lg:block lg:pr-6">
                <span
                  aria-hidden
                  className={clsx(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[12px] font-semibold tabular-nums',
                    stop.who === 'Headway'
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : 'border-ink-900 bg-white text-ink-900',
                  )}
                >
                  {i + 1}
                </span>
                <div className="lg:mt-3">
                  <p className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">{stop.who}</p>
                  <p className="text-[16px] leading-snug font-semibold text-ink-900">{stop.what}</p>
                </div>
                {!last ? (
                  <span
                    aria-hidden
                    className="absolute top-1/2 right-2 hidden -translate-y-1/2 text-[22px] text-ink-300 lg:top-[18px] lg:block"
                  >
                    &rarr;
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* The way back to the start: the path itself, rising from the last
            stop to the first, so the loop closes on the page as it does in the
            product. */}
        <div className="mt-6 flex items-center gap-3 text-[14px] text-ink-600">
          <svg viewBox="0 0 120 20" className="h-5 w-30 shrink-0" aria-hidden focusable="false">
            <path
              d="M116 16 C 90 16, 40 14, 6 4"
              stroke="#B78A3B"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M12 1 L 4 4 L 10 10" stroke="#B78A3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <p>
            &hellip;and it comes back around. What customers say next is read against what you changed, not
            on its own.
          </p>
        </div>
      </figure>
    </Section>
  );
}
