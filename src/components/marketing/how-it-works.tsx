import clsx from 'clsx';
import { Heading, Section } from './primitives';

/**
 * FIVE STEPS, ONE LOOP — AND WHO DOES EACH ONE.
 *
 * The Smart Feedback lifecycle as the product actually runs it: customers
 * speak, Headway reads, Headway surfaces what matters, the owner decides, and
 * Headway checks what happened afterwards. Every step says whose work it is,
 * because "how much effort is this?" is the question an owner is really
 * asking when they read a how-it-works section.
 *
 * Every line is something the product does today: the one-minute page, the
 * reading as feedback arrives, the naming floor (a topic is named only once
 * three customers raise it — `MIN_MENTIONS_TO_NAME`), the decision buttons'
 * own words, and the before-and-after that runs once enough new feedback has
 * come in.
 */

type Who = 'Customers' | 'Headway' | 'You';

const STEPS: Array<{ n: string; name: string; line: string; yours: string; who: Who }> = [
  {
    n: '01',
    name: 'Customers give private feedback',
    line: 'A QR card on your counter or table — or your feedback link — opens a page that takes about a minute. No app, no account, no name.',
    yours: 'Put the card where customers can see it.',
    who: 'Customers',
  },
  {
    n: '02',
    name: 'Headway reads every response',
    line: 'The words, the stars and the taps, as each one arrives, grouped into the topics that matter for your kind of business.',
    yours: 'Nothing. This is Headway’s job.',
    who: 'Headway',
  },
  {
    n: '03',
    name: 'Headway shows what matters',
    line: 'Home leads with the one thing that needs your attention and what customers love, each with the count and the customers’ words behind it.',
    yours: 'Open Home on your phone.',
    who: 'Headway',
  },
  {
    n: '04',
    name: 'You decide what to do',
    line: 'Every suggestion comes with a choice: I’ll handle this, or Not doing this. When the change is made, tap Done.',
    yours: 'One tap per decision.',
    who: 'You',
  },
  {
    n: '05',
    name: 'Headway checks what changed',
    line: 'Once enough new feedback has come in, Headway compares it with the feedback before your change, and tells you whether the topic came up more or less often.',
    yours: 'Read the result.',
    who: 'Headway',
  },
];

const WHO_TONE: Record<Who, string> = {
  Customers: 'text-ink-600',
  Headway: 'text-brand-700',
  You: 'text-ink-900',
};

const LOOP = [
  { who: 'Customer', what: 'Customer said' },
  { who: 'You', what: 'You decided' },
  { who: 'You', what: 'You changed it' },
  { who: 'Headway', what: 'Headway compares' },
  { who: 'Customer', what: 'Feedback comes back' },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-heading">
      <Heading
        id="how-heading"
        eyebrow="How Headway works"
        title="Five steps. Most of them are Headway’s."
        lead="From a customer’s first tap to knowing whether your change helped — and what each step asks of you."
      />

      <ol className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-5">
        {STEPS.map((step) => (
          <li key={step.n} className="hw-rise flex flex-col border-t-2 border-ink-900 pt-5">
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[13px] text-brand-700 tabular-nums">{step.n}</span>
              <span className={clsx('text-[11px] font-semibold tracking-[0.14em] uppercase', WHO_TONE[step.who])}>
                {step.who}
              </span>
            </p>
            <h3 className="mt-2 text-[18px] leading-snug font-semibold tracking-[-0.01em] text-ink-900">
              {step.name}
            </h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-pretty text-ink-700">{step.line}</p>
            <p className="mt-auto pt-4 text-[13px] leading-snug text-ink-600">
              <span className="font-semibold text-ink-900">Your part:</span> {step.yours}
            </p>
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
