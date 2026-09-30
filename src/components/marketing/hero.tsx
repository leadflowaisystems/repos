import { PathMotif } from './motif';
import { GET_STARTED, SEE_HOW } from './links';
import { Cta, Eyebrow } from './primitives';
import { HomePreview } from './home-preview';

/**
 * THE FIRST SCREEN.
 *
 * Five seconds: what Headway is, who it is for, and what the owner actually
 * gets. The words are on the left; on the right is the screen an owner opens
 * every morning, drawn for the demo business. On a phone the words come first
 * and the screen follows, so the value is never pushed below a picture.
 *
 * The three facts under the buttons are the effort question answered before
 * anybody asks it, and each is something the product actually does: no card
 * at signup, four questions to set up, and a printed card Headway sends.
 */

const FACTS = [
  'Starts with a free trial — no card',
  'Set up in four answers',
  'Headway prints and sends your QR cards',
] as const;

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-heading" className="relative overflow-hidden bg-ink-50">
      <PathMotif className="pointer-events-none absolute -top-8 -right-32 hidden w-[880px] opacity-[0.10] lg:block" />
      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-12 lg:py-24 xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
        <div className="max-w-2xl">
          <Eyebrow>Smart Feedback for local businesses</Eyebrow>
          <h1
            id="hero-heading"
            className="mt-4 text-[38px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance text-ink-900 sm:text-[50px] lg:text-[56px]"
          >
            Your customers are already telling you what to improve.
          </h1>
          <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-pretty text-ink-600 sm:text-[20px]">
            Customers give private feedback through your own QR code. Headway reads every response, shows
            you what they love and the one thing that needs your attention &mdash; then checks whether
            your change helped.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Cta href={GET_STARTED.href}>{GET_STARTED.label}</Cta>
            <Cta href={SEE_HOW.href} variant="secondary">
              {SEE_HOW.label}
            </Cta>
          </div>
          <ul className="mt-7 flex flex-col gap-2 text-[14px] text-ink-600 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-center gap-2">
                <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-good-50 text-[10px] font-bold text-good-700 ring-1 ring-good-200">
                  ✓
                </span>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <HomePreview />
      </div>
    </section>
  );
}
