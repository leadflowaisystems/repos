import clsx from 'clsx';
import { buildGatewayCopy } from '@/lib/gateway/copy';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { DEMO_BUSINESS } from '@/lib/marketing/demo';
import { findPack } from '@/lib/packs';
import { CARD_EYEBROW, Heading, Section } from './primitives';

/**
 * THE FEEDBACK EXPERIENCE.
 *
 * The card, the three screens and the thank-you, in the words the product
 * actually uses: the copy comes from the same module that writes the real
 * page (`buildGatewayCopy`) and the restaurant pack, so a customer who scans
 * a Headway card lands on exactly what is drawn here.
 *
 * The card is the real one. The two photographs are the printed Headway
 * card for the demo business in the two forms a business can order from its
 * workspace — the same files, at the same widths, that the Kit page shows
 * (`src/lib/kit/catalogue.ts`). Until the website refresh this was an HTML
 * drawing of an older, cream card that Headway no longer prints.
 */

/** What the photographs show, in the words the Kit page uses for them. */
const KIT_PHOTOS: Record<(typeof KIT_PRODUCTS)[number]['key'], { name: string; alt: string }> = {
  'card-qr-stand': {
    name: 'Card in a clear stand',
    alt: 'The Headway feedback card for Corner Cafe, standing in a clear acrylic holder on a cafe table.',
  },
  'folded-tent': {
    name: 'Folded tent card',
    alt: 'The Headway feedback card for Corner Cafe, folded into a standing tent on a cafe table.',
  },
};

const PHONE =
  'flex min-w-0 flex-col rounded-[22px] border border-ink-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_18_26/0.04),0_20px_40px_-24px_rgb(16_42_67/0.25)] sm:p-5';

const DARK_BUTTON =
  'inline-flex min-h-10 items-center justify-center rounded-xl bg-ink-900 px-4 text-[13px] font-semibold text-white';

function StepCount({ step, total }: { step: number; total: number }) {
  return (
    <p className="text-[11px] font-medium tracking-wide text-ink-500 tabular-nums">
      {step} of {total}
    </p>
  );
}

function StarRow({ value, size = 'sm' }: { value: number | null; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={clsx('inline-flex items-center gap-0.5', size === 'lg' ? 'text-[26px]' : 'text-[20px]')}
      aria-hidden
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={value !== null && star <= value ? 'text-warn-600' : 'text-ink-300'}>
          {value !== null && star <= value ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

const POINTS = [
  { name: 'Quick', line: 'Three screens, counted. A single tap moves the first one on. About a minute.' },
  {
    name: 'Simple',
    line: 'A rating, a rating for each part of the visit, and a specific or two if something was off. No keyboard needed.',
  },
  { name: 'Honest', line: 'The page asks for the truth and says so. Nothing is celebrated, nothing is fished for.' },
  {
    name: 'Private',
    line: 'No name or number needed. What a customer writes goes to the business’s team only.',
  },
  {
    name: 'Not a survey',
    line: 'The open box comes last, is optional, and asks one question shaped by what was tapped.',
  },
] as const;

export function FeedbackExperience() {
  const pack = findPack('restaurant');
  if (!pack) throw new Error('The restaurant pack is required to draw the feedback experience.');
  const copy = buildGatewayCopy(pack, DEMO_BUSINESS.name);
  const dimensions = pack.gateway?.dimensions ?? [];
  const waiting = dimensions.find((d) => d.key === 'waiting') ?? null;

  const total = dimensions.length > 0 ? 3 : 2;

  return (
    <Section id="feedback" labelledBy="feedback-heading">
      <Heading
        id="feedback-heading"
        eyebrow="The feedback experience"
        title="Feedback customers will actually give."
        lead="A card on the table or the counter, a QR code, and a page that takes about a minute. No app, no account, no name."
      />

      <div className="mt-12 grid grid-cols-1 gap-12 lg:mt-16 lg:grid-cols-[minmax(0,7fr)_auto] lg:gap-20">
        <div className="hw-rise min-w-0">
          <ul className="divide-y divide-ink-200 border-y border-ink-200">
            {POINTS.map((point) => (
              <li key={point.name} className="grid grid-cols-[6.5rem_1fr] gap-4 py-4">
                <h3 className="text-[12px] font-semibold tracking-[0.16em] text-ink-900 uppercase">{point.name}</h3>
                <p className="text-[15px] leading-relaxed text-ink-700">{point.line}</p>
              </li>
            ))}
          </ul>
          <blockquote className="mt-8 border-l-2 border-brand-500 pl-4">
            <p className="text-[22px] leading-snug font-semibold tracking-[-0.02em] text-ink-900 sm:text-[24px]">
              Good, bad or somewhere between &mdash; every signal matters.
            </p>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-600">
              Everyone sees the same page and the same thank-you, whatever they rated. Headway never routes
              unhappy customers somewhere quieter, and never asks only the happy ones for a public review.
            </p>
          </blockquote>
        </div>

        <figure className="hw-rise min-w-0 lg:w-[22rem]">
          <figcaption className={CARD_EYEBROW}>The card Headway prints</figcaption>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {KIT_PRODUCTS.map((product) => (
              <li key={product.key} className="overflow-hidden rounded-xl border border-ink-200 bg-white">
                {/* A plain <img> for the same reason as the Kit page: images
                    run unoptimized here, and this lets the browser choose the
                    720 or 960 px copy instead of the 1312 px master. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.photo}
                  srcSet={product.photoSrcSet}
                  sizes="(min-width: 1024px) 176px, 50vw"
                  alt={KIT_PHOTOS[product.key].alt}
                  width={product.photoWidth}
                  height={product.photoHeight}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full bg-ink-50 object-cover"
                />
                <p className="px-3 py-2 text-[12px] font-medium text-ink-800">{KIT_PHOTOS[product.key].name}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
            {DEMO_BUSINESS.name}&rsquo;s card. Yours carries your business&rsquo;s name and its own QR code,
            and is ordered from your workspace.
          </p>
        </figure>
      </div>

      <figure className="hw-rise mt-12 min-w-0 lg:mt-16">
        <p className={CARD_EYEBROW}>The page it opens</p>
        <div className="mt-3 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1 of 3 */}
          <div className={PHONE}>
            <StepCount step={1} total={total} />
            <p className="mt-2 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{copy.businessName}</p>
            <p className="mt-1.5 text-[18px] leading-tight font-semibold tracking-tight text-ink-900">{copy.headline}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600">{copy.prompt}</p>
            <p className="mt-5 text-[12px] font-medium text-ink-800">
              {copy.ratingLabel} <span className="font-normal text-ink-500">({copy.ratingOptional})</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <StarRow value={4} size="lg" />
              <span className="text-[12px] text-ink-600">Good</span>
            </p>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-500 underline underline-offset-4">{copy.skipLabel}</span>
              <span className={DARK_BUTTON}>{copy.continueLabel}</span>
            </div>
          </div>

          {/* 2 of 3 */}
          <div className={PHONE}>
            <StepCount step={2} total={total} />
            <p className="mt-2 text-[15px] leading-snug font-semibold tracking-tight text-ink-900">{copy.dimensionsHeadline}</p>
            <p className="mt-1 text-[11px] text-ink-500">{copy.dimensionsNote}</p>
            <ul className="mt-3 divide-y divide-ink-100 border-y border-ink-100">
              {dimensions.map((dimension) => {
                const value =
                  dimension.key === 'food' ? 5 : dimension.key === 'waiting' ? 2 : dimension.key === 'service' ? 4 : null;
                const low = dimension.key === 'waiting';
                return (
                  <li key={dimension.key} className="py-2">
                    <p className="text-[12px] font-medium text-ink-800">{dimension.label}</p>
                    <StarRow value={value} />
                    {low && waiting ? (
                      <div className="mt-1.5">
                        <p className="text-[11px] text-ink-600">{waiting.improvePrompt}</p>
                        <p className="text-[10px] text-ink-500">{copy.signalsNote}</p>
                        <ul className="mt-1.5 flex flex-wrap gap-1">
                          {waiting.signals.map((signal) => (
                            <li
                              key={signal.key}
                              className={clsx(
                                'rounded-full border px-2 py-0.5 text-[10.5px]',
                                signal.key === 'for_food'
                                  ? 'border-ink-900 bg-ink-900 text-white'
                                  : 'border-ink-300 bg-white text-ink-700',
                              )}
                            >
                              {signal.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-500 underline underline-offset-4">{copy.backLabel}</span>
              <span className={DARK_BUTTON}>{copy.continueLabel}</span>
            </div>
          </div>

          {/* 3 of 3 */}
          <div className={PHONE}>
            <StepCount step={total} total={total} />
            <p className="mt-2 text-[15px] leading-snug font-semibold tracking-tight text-ink-900">{copy.askMixed}</p>
            <p className="mt-1 text-[11px] text-ink-500">{copy.textNote}</p>
            <div className="mt-3 min-h-16 rounded-xl border border-ink-300 bg-white px-3 py-2 text-[12px] text-ink-400">
              {copy.placeholder}
            </div>
            <p className="mt-1.5 text-[10px] text-ink-500">{copy.languageHint}</p>
            <span className={clsx(DARK_BUTTON, 'mt-4 w-full')}>{copy.submitLabel}</span>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-ink-500">{copy.privacyLine}</p>
          </div>

          {/* The thank-you, the same for everyone */}
          <div className={PHONE}>
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-good-700 text-[12px] font-bold text-white"
              >
                ✓
              </span>
              <div>
                <p className="text-[18px] leading-tight font-semibold tracking-tight text-ink-900">{copy.thanksHeadline}</p>
                <p className="mt-1 text-[12px] leading-snug font-medium text-ink-900">{copy.thanksLine}</p>
                <p className="mt-1 text-[11px] leading-snug text-ink-600">{copy.thanksNote}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 px-3 py-3">
              <p className="text-[12px] font-semibold text-ink-900">{copy.shareQuestion}</p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-ink-600">{copy.shareNote}</p>
              <span className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-[11px] font-medium text-ink-900">
                Leave a public review &rarr;
              </span>
              <p className="mt-1.5 text-[10px] text-ink-500">{copy.shareDecline}</p>
            </div>
          </div>
        </div>
        <figcaption className="mt-4 max-w-3xl text-[12px] leading-relaxed text-ink-500">
          The restaurant version. Offered to every customer in the same words, whatever they rated. A rating
          is shown here as an example; the real page starts empty.
        </figcaption>
      </figure>
    </Section>
  );
}
