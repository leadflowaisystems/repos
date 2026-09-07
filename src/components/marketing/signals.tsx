import clsx from 'clsx';
import { SIGNALS } from '@/lib/marketing/demo';
import { Chip, Heading, Section } from './primitives';

/**
 * THE FOUR SIGNALS.
 *
 * Every theme Headway reads lands in one of four places. Each is shown with
 * the Corner Cafe example the signal board actually files there, and the
 * chip the board uses for it, so the vocabulary on this page is the
 * vocabulary in the product.
 */

const CARDS = [
  {
    name: 'Loved',
    line: 'What customers consistently appreciate.',
    rule: 'border-good-600',
    chip: { tone: 'keep' as const, label: SIGNALS.loved.chip },
    example: SIGNALS.loved.label,
    fact: `${SIGNALS.loved.count} mentions · ${SIGNALS.loved.share} of feedback`,
    note: `Praised at both recent check-ins, and ${SIGNALS.loved.movement}.`,
  },
  {
    name: 'Unhappy',
    line: 'What repeatedly creates frustration.',
    rule: 'border-bad-600',
    chip: { tone: 'needs' as const, label: SIGNALS.unhappy.chip },
    example: SIGNALS.unhappy.label,
    fact: `${SIGNALS.unhappy.count} mentions · ${SIGNALS.unhappy.share} of feedback`,
    note: `Raised at both recent check-ins, and ${SIGNALS.unhappy.movement}.`,
  },
  {
    name: 'Changing',
    line: 'What is moving compared with earlier feedback.',
    rule: 'border-warn-600',
    chip: { tone: 'watch' as const, label: SIGNALS.changing.chip },
    example: SIGNALS.changing.label,
    fact: `${SIGNALS.changing.checkins.june} mentions at the June check-in, ${SIGNALS.changing.checkins.august} in August`,
    note: SIGNALS.changing.line,
  },
  {
    name: 'Attention',
    line: 'What deserves action now.',
    rule: 'border-ink-900',
    chip: { tone: 'needs' as const, label: SIGNALS.attention.chip },
    example: SIGNALS.attention.headline,
    fact: 'The one thing worth a decision, with its evidence and next step',
    note: 'Never more than one at a time. Everything else waits, watched, until it needs you.',
  },
] as const;

export function Signals() {
  return (
    <Section ground="cream" labelledBy="signals-heading">
      <Heading
        id="signals-heading"
        eyebrow="The four signals"
        title="Everything customers tell you lands in one of four places."
        lead="Headway does not hand you a list of themes and leave you to rank them. Each one is filed by what it means for you today."
      />

      <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
        {CARDS.map((card) => (
          <li
            key={card.name}
            className={clsx(
              'hw-rise flex flex-col rounded-2xl border border-ink-200 border-t-4 bg-white p-5 sm:p-6',
              card.rule,
            )}
          >
            <h3 className="text-[13px] font-semibold tracking-[0.18em] text-ink-900 uppercase">{card.name}</h3>
            <p className="mt-2 text-[16px] leading-snug text-ink-700">{card.line}</p>

            <div className="mt-6 border-t border-dashed border-ink-200 pt-4">
              <div className="flex items-center gap-2">
                <Chip tone={card.chip.tone}>{card.chip.label}</Chip>
                <span className="text-[11px] tracking-wide text-ink-500 uppercase">Corner Cafe</span>
              </div>
              <p className="mt-2.5 text-[17px] leading-snug font-semibold tracking-tight text-balance text-ink-900">
                {card.example}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-600 tabular-nums">{card.fact}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{card.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
