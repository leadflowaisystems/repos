import Link from 'next/link';
import clsx from 'clsx';
import type { Focus } from '@/lib/portal/focus';
import type { PortalFact, PortalMood } from '@/lib/portal/view';
import { ProofChips, Quotes, Reveal } from '@/components/portal/disclose';

/**
 * RIGHT NOW — the one block an owner can stop after (M24).
 *
 * The largest text on Home is a sentence naming the one thing worth their
 * attention. Under it, three figures that open into the evidence behind
 * them; then one gold button; then what Headway makes of it, in a sentence;
 * then the evidence itself, on request; then the one next step.
 *
 * Nothing in this block is a reading of its own. `buildFocus` chose every
 * sentence from judgements the engines had already made, and the block adds
 * only order and size. The dot carries the mood; the sentence carries the
 * meaning; the button carries the way out.
 */

const MOOD_DOT: Record<PortalMood, string> = {
  GOOD: 'bg-good-600',
  MIXED: 'bg-warn-600',
  NEEDS_WORK: 'bg-bad-600',
  TOO_EARLY: 'bg-ink-300',
};

const DIRECTION_PILL: Array<[RegExp, string]> = [
  [/improving/i, 'border-good-200 bg-good-50 text-good-700'],
  [/needs attention|worsening/i, 'border-bad-200 bg-bad-50 text-bad-700'],
  [/steady/i, 'border-ink-200 bg-ink-100 text-ink-700'],
];

function pillFor(value: string): string {
  for (const [pattern, cls] of DIRECTION_PILL) if (pattern.test(value)) return cls;
  return 'border-ink-200 bg-ink-100 text-ink-600';
}

/** The direction, once, on one rule, as a pill beside the eyebrow. */
function Direction({ fact }: { fact: PortalFact }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={clsx('rounded-full border px-2 py-0.5 text-[12px] font-semibold', pillFor(fact.value))}>
        {fact.value}
      </span>
      <span className="text-[12px] text-ink-500">{fact.scope}</span>
    </span>
  );
}

const EYEBROW = 'text-[11px] font-medium tracking-widest text-ink-500 uppercase';

export function FocusBlock({ focus, direction }: { focus: Focus; direction: PortalFact | null }) {
  return (
    <section
      aria-labelledby="focus-heading"
      className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-7 lg:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className={clsx('h-2 w-2 rounded-full', MOOD_DOT[focus.mood])} aria-hidden />
          <h2 id="focus-heading" className={EYEBROW}>
            Right now
          </h2>
        </div>
        {direction ? <Direction fact={direction} /> : null}
      </div>

      <p className="mt-3 max-w-3xl text-[26px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-ink-900 sm:text-[34px] lg:text-[38px]">
        {focus.headline}
      </p>
      <p className="mt-2 text-[13px] text-ink-500">{focus.basis}</p>

      {focus.proofs.length > 0 ? (
        <div className="mt-5">
          <ProofChips proofs={focus.proofs} />
        </div>
      ) : null}

      {focus.cta ? (
        <Link
          href={focus.cta.href}
          className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand-700 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-900 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none"
        >
          {focus.cta.label} <span aria-hidden>&rarr;</span>
        </Link>
      ) : null}

      {focus.synthesis ? (
        <div className="mt-7 border-t border-ink-200 pt-5">
          <p className={EYEBROW}>What Headway wants you to know</p>
          <p className="mt-2 max-w-2xl text-[17px] leading-snug font-medium text-ink-900 sm:text-[19px]">
            {focus.synthesis}
          </p>
          {focus.evidence ? (
            <Reveal summary="Show me the evidence" className="mt-2">
              <Quotes
                quotes={focus.evidence.quotes}
                seeAll={{
                  label: `See all ${focus.evidence.count} comments`,
                  href: focus.evidence.href,
                }}
              />
            </Reveal>
          ) : null}
        </div>
      ) : null}

      {focus.next ? (
        <div className="mt-6 border-t border-ink-200 pt-5">
          <p className={EYEBROW}>Your next step</p>
          <p className="mt-2 max-w-2xl text-[16px] leading-relaxed font-medium text-ink-900">
            {focus.next.headline}
          </p>
          {focus.next.detail ? (
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-600">{focus.next.detail}</p>
          ) : null}
          {focus.next.why.length > 0 || focus.next.watching ? (
            <Reveal summary="Why, and what Headway checks next" className="mt-1">
              <ul className="space-y-1 border-l-2 border-ink-200 pl-3 text-[13px] leading-relaxed text-ink-600">
                {focus.next.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {focus.next.watching ? (
                  <li>
                    <span className="font-medium text-ink-800">Watching.</span> {focus.next.watching}
                  </li>
                ) : null}
              </ul>
            </Reveal>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
