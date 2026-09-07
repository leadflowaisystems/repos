import { PathMotif } from './motif';
import { GET_STARTED, TALK_TO_US } from './links';
import { Cta } from './primitives';

/**
 * THE ASK.
 *
 * Deep navy, the path drawn large across it, two buttons. The same gold and
 * the same sentence shape as the rest of the page, and nothing that was not
 * already said — this is where a visitor who has read this far decides.
 */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="on-navy relative overflow-hidden bg-ink-950">
      <PathMotif
        className="pointer-events-none absolute right-0 bottom-0 left-0 w-full opacity-[0.45]"
        strokeWidth={10}
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28 lg:py-36">
        <div className="hw-rise max-w-3xl">
          <h2
            id="cta-heading"
            className="text-[34px] leading-[1.06] font-semibold tracking-[-0.03em] text-balance text-white sm:text-[46px] lg:text-[56px]"
          >
            Your next improvement is probably already hiding in your feedback.
          </h2>
          <p className="mt-5 text-[20px] leading-relaxed text-ink-300 sm:text-[24px]">Headway helps you find it.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Cta href={GET_STARTED.href}>{GET_STARTED.label}</Cta>
            <Cta href={TALK_TO_US.href} variant="secondary-dark">
              {TALK_TO_US.label}
            </Cta>
          </div>
        </div>
      </div>
    </section>
  );
}
