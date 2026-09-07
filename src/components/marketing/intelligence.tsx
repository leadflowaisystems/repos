import { Quotes, Row } from '@/components/portal/disclose';
import { DEMO_BUSINESS, SLOW_SERVICE, SLOW_SERVICE_QUOTES, TAPPED } from '@/lib/marketing/demo';
import { CARD_EYEBROW, Chip, Heading, Section } from './primitives';

/**
 * FROM THE PILE TO THE ONE THING.
 *
 * The left column is the reduction: everything read, the part that mentions
 * the complaint, the one decision. The right column is the product's own
 * signal card for that complaint — the customers' words, what they tapped,
 * what Headway sees, what to do, why, and what it checks next — built from
 * the same row and quote components the workspace uses.
 */

const FUNNEL = [
  { figure: String(DEMO_BUSINESS.total), label: 'pieces of feedback read', width: '100%', tone: 'bg-ink-900' },
  {
    figure: String(SLOW_SERVICE.count),
    label: `mention ${SLOW_SERVICE.label.toLowerCase()}`,
    width: SLOW_SERVICE.share,
    tone: 'bg-bad-600',
  },
  { figure: '1', label: 'thing worth your attention', width: '4%', tone: 'bg-brand-700' },
] as const;

export function Intelligence() {
  return (
    <Section id="product" ground="white" labelledBy="product-heading">
      <Heading
        id="product-heading"
        eyebrow="Product intelligence"
        title={
          <>
            From {DEMO_BUSINESS.total} pieces of feedback to one thing worth your attention.
          </>
        }
        lead="Headway reads every piece — the words, the ratings, the taps — groups what keeps coming up, and decides what deserves a decision. The evidence stays attached to the conclusion, so you can check it in a tap."
      />

      <div className="mt-12 grid grid-cols-1 gap-10 lg:mt-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
        <div className="hw-rise">
          <ol className="space-y-6">
            {FUNNEL.map((step) => (
              <li key={step.label}>
                <p className="flex items-baseline gap-3">
                  <span className="font-mono text-[40px] leading-none font-semibold text-ink-900 tabular-nums sm:text-[48px]">
                    {step.figure}
                  </span>
                  <span className="text-[15px] text-ink-600">{step.label}</span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
                  <div className={`h-full rounded-full ${step.tone}`} style={{ width: step.width }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[17px] leading-relaxed text-pretty text-ink-900 sm:text-[19px]">
            Instead of making you interpret the data, Headway helps you decide what deserves attention.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-600">
            Nothing is named until enough customers have raised it. Until then Headway says so, rather
            than dressing three comments up as a trend.
          </p>
        </div>

        <figure className="hw-rise min-w-0">
          <div className="rounded-2xl border border-ink-200 bg-white shadow-[0_1px_2px_rgb(15_18_26/0.04),0_24px_48px_-28px_rgb(16_42_67/0.25)]">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <Chip tone="needs">{'Needs you'}</Chip>
                <span className="text-[12px] text-ink-500">The one thing worth a decision</span>
              </div>
              <p className="mt-2.5 text-[20px] leading-tight font-semibold tracking-tight text-ink-900 sm:text-[22px]">
                {SLOW_SERVICE.label}
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[15px] font-semibold text-ink-900 tabular-nums">{SLOW_SERVICE.count} mentions</span>
                <span className="text-[13px] text-ink-500 tabular-nums">{SLOW_SERVICE.share}</span>
                <span className="text-[13px] font-medium text-bad-700">
                  <span aria-hidden>&uarr;</span>
                  <span className="sr-only">up,</span> {SLOW_SERVICE.trend}
                </span>
                <span className="text-[13px] font-medium text-bad-700">{SLOW_SERVICE.outcome}</span>
              </div>
              <div className="mt-2.5 h-1 w-full max-w-md overflow-hidden rounded-full bg-ink-100" aria-hidden>
                <div className="h-full rounded-full bg-bad-600" style={{ width: SLOW_SERVICE.share }} />
              </div>
            </div>

            <div className="divide-y divide-dashed divide-ink-200 border-t border-ink-200 px-4 pb-2 sm:px-5">
              <Row label="What customers are saying">
                <Quotes quotes={SLOW_SERVICE_QUOTES} />
              </Row>
              <Row label="What customers tapped">
                <p className="tabular-nums">
                  {TAPPED.rated} customers rated{' '}
                  <span className="font-medium text-ink-900">{TAPPED.label.toLowerCase()}</span> on your
                  feedback page: {TAPPED.average} out of 5 on average, {TAPPED.low} of them at 3 or below.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="What they tapped">
                  {TAPPED.specifics.map((s) => (
                    <li
                      key={s.label}
                      className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-ink-300 bg-white px-2.5 text-[12px] text-ink-800"
                    >
                      {s.label}
                      <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-medium text-ink-700 tabular-nums">
                        {s.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </Row>
              <Row label="What Headway sees" strong>
                {SLOW_SERVICE.meaning}
              </Row>
              <Row label="What to do" strong>
                {SLOW_SERVICE.whatToDo}{' '}
                <span className="font-normal text-ink-700">The original suggestion still stands: {SLOW_SERVICE.suggestion}</span>
              </Row>
              <Row label="Why">{SLOW_SERVICE.why}</Row>
              <Row label="Headway will check next">
                Headway is checking whether slow service comes up more or less at your next check-in, and will
                flag a move of 2 or more mentions.
              </Row>
              <Row label="Source">
                <span className="tabular-nums">{SLOW_SERVICE.source}</span>
                <span className="block text-[13px] text-ink-500">{SLOW_SERVICE.recurrence}</span>
                <span className="block text-[13px] text-ink-500 tabular-nums">
                  At your last two check-ins: {SLOW_SERVICE.checkins.june} mentions in June,{' '}
                  {SLOW_SERVICE.checkins.august} in August.
                </span>
              </Row>
            </div>
          </div>
          <figcaption className={`${CARD_EYEBROW} mt-3`}>
            One signal on the Customers page, opened &middot; {DEMO_BUSINESS.name}
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}
