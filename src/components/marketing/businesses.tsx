import { listPacks } from '@/lib/packs';
import { CARD_EYEBROW, Heading, Section } from './primitives';

/**
 * ONE PRODUCT, EVERY VERTICAL.
 *
 * The cards are read from `/packs` at build time, so this section can only
 * ever list the kinds of business Headway actually supports, with the first
 * question each one's customers actually see, the card it prints, and the
 * parts of the visit it asks about. Adding a vertical is a JSON file, and
 * the page follows.
 */
export function Businesses() {
  const packs = listPacks();
  return (
    <Section id="businesses" ground="white" labelledBy="businesses-heading">
      <Heading
        id="businesses-heading"
        eyebrow="For different businesses"
        title="Built around the way your business actually works."
        lead="Choose the kind of business at setup. Headway adapts what customers are asked, what the card says and what the reading can name — while the improvement system underneath stays exactly the same."
      />

      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
        {packs.map((pack) => {
          const question = pack.gateway?.headline || pack.kit?.headline || 'How was your experience?';
          const parts = (pack.gateway?.dimensions ?? []).map((d) => d.label);
          return (
            <li key={pack.id} className="hw-rise flex flex-col rounded-2xl border border-ink-200 bg-ink-50 p-5 sm:p-6">
              <h3 className="text-[18px] leading-tight font-semibold tracking-tight text-ink-900">{pack.label}</h3>
              <p className="mt-3 text-[20px] leading-snug font-semibold tracking-[-0.01em] text-ink-900">
                &ldquo;{question}&rdquo;
              </p>
              <p className="mt-1 text-[12px] text-ink-500">The first question customers see</p>
              {parts.length > 0 ? (
                <div className="mt-4">
                  <p className={CARD_EYEBROW}>They rate</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {parts.map((part) => (
                      <li
                        key={part}
                        className="rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-[12px] text-ink-700"
                      >
                        {part}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {pack.kit ? (
                <div className="mt-4 border-t border-dashed border-ink-200 pt-3">
                  <p className={CARD_EYEBROW}>The {pack.kit.assetLabel}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{pack.kit.placement}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="hw-rise mt-8 max-w-3xl text-[15px] leading-relaxed text-ink-600 sm:text-[16px]">
        The reading is deterministic and specific to the vertical: a clinic&rsquo;s themes are not a
        cafe&rsquo;s, and neither is guessed. Feedback can be left in English, Hindi or Marathi.
      </p>
    </Section>
  );
}
