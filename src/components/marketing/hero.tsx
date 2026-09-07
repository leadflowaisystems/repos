import { PathMotif } from './motif';
import { GET_STARTED, SEE_HOW } from './links';
import { Cta, Eyebrow } from './primitives';
import { RightNow } from './right-now';

/**
 * THE FIRST SCREEN.
 *
 * Five seconds: who this is for, what it does, and what it looks like. The
 * words are on the left, and on the right is not a picture of the product
 * but the product — the Home block for the demo business, with its evidence
 * one tap away. On a phone the words come first and the block follows; the
 * value proposition is never pushed below a picture.
 */
export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-heading" className="relative overflow-hidden bg-ink-50">
      <PathMotif className="pointer-events-none absolute -top-8 -right-32 hidden w-[880px] opacity-[0.10] lg:block" />
      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-12 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:py-24">
        <div className="max-w-2xl lg:pt-10">
          <Eyebrow>Customer intelligence for better businesses</Eyebrow>
          <h1
            id="hero-heading"
            className="mt-4 text-[38px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance text-ink-900 sm:text-[50px] lg:text-[56px]"
          >
            Your customers are already telling you what to improve.
          </h1>
          <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-pretty text-ink-600 sm:text-[20px]">
            Headway turns customer feedback into clear actions &mdash; and helps you see whether
            those actions actually improve the customer experience.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Cta href={GET_STARTED.href}>{GET_STARTED.label}</Cta>
            <Cta href={SEE_HOW.href} variant="secondary">
              {SEE_HOW.label}
            </Cta>
          </div>
          <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-ink-500">
            Your workspace starts on a trial &mdash; no card, no payment page. Four answers, and your
            feedback page and QR code are ready to print.
          </p>
        </div>

        <RightNow />
      </div>
    </section>
  );
}
