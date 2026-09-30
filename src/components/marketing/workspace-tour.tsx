import { Chip, Heading, Section } from './primitives';

/**
 * WHAT THE OWNER ACTUALLY SEES — THE WORKSPACE, TAB BY TAB.
 *
 * The five doors of the business workspace, named exactly as the workspace
 * names them (`nav.section.*` in the dictionary), each with the one job it
 * does. Then the few things behind "More". Nothing here describes a screen
 * that does not exist, and nothing is promised that a business cannot open
 * on the day it signs up.
 *
 * The four Customers piles are shown with the product's own chip and the
 * product's own names, so the vocabulary on this page is the vocabulary in
 * the workspace.
 */

const TABS = [
  {
    name: 'Home',
    job: 'Your brief',
    line: 'The one thing that needs your attention, what customers love, the newest responses and your own changes — on one phone screen.',
  },
  {
    name: 'Customers',
    job: 'Why',
    line: 'Every topic customers raise, filed by what it means for you, each opening into the customers’ own words and the count behind it.',
  },
  {
    name: 'Feedback',
    job: 'The evidence',
    line: 'Every response in full, newest first: the stars, what was tapped and what was written. Search it, or filter by topic or rating.',
  },
  {
    name: 'Trends',
    job: 'What changed',
    line: 'What is getting better or worse, and each change you made with what happened in the feedback after it.',
  },
  {
    name: 'Check-in',
    job: 'The rhythm',
    line: 'Since your last check-in, this week or this month: what to do, what to protect, and what Headway is watching.',
  },
] as const;

const PILES = [
  { tone: 'needs', label: 'Needs your attention', line: 'Raised often enough to act on.' },
  { tone: 'watch', label: 'Watching', line: 'Coming up, not yet urgent.' },
  { tone: 'keep', label: 'Going well', line: 'What to keep doing.' },
  { tone: 'early', label: 'Not yet clear', line: 'Mentioned, but not by enough customers to name.' },
] as const;

const MORE = [
  { name: 'Kit & orders', line: 'Order printed QR cards and stands, and follow each order.' },
  { name: 'Account', line: 'Your trial, your login, and the language: English, हिन्दी or मराठी.' },
  { name: 'On your phone', line: 'Add Headway to your home screen and it opens like an app.' },
] as const;

export function WorkspaceTour() {
  return (
    <Section id="product" ground="cream" labelledBy="product-heading">
      <Heading
        id="product-heading"
        eyebrow="What you see"
        title="Five tabs. Each one answers one question."
        lead="Not a wall of charts. Your workspace opens on what to do today, and every figure in it opens into the customers who said it."
      />

      <ol className="mt-12 divide-y divide-ink-200 border-y border-ink-200 lg:mt-16">
        {TABS.map((tab, i) => (
          <li
            key={tab.name}
            className="hw-rise grid grid-cols-[2.25rem_1fr] gap-x-4 gap-y-1 py-5 sm:grid-cols-[3rem_minmax(0,3fr)_minmax(0,7fr)] sm:gap-x-8 sm:py-6"
          >
            <span className="font-mono text-[13px] leading-[1.9] text-brand-700 tabular-nums" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink-900">{tab.name}</h3>
              <p className="mt-0.5 text-[12px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{tab.job}</p>
            </div>
            <p className="col-start-2 text-[16px] leading-relaxed text-pretty text-ink-700 sm:col-start-3 sm:pt-1">
              {tab.line}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:mt-16 lg:grid-cols-2 lg:gap-14">
        <div className="hw-rise">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-700 uppercase">On the Customers tab</p>
          <p className="mt-2 text-[20px] leading-snug font-semibold tracking-[-0.01em] text-ink-900">
            Every topic lands in one of four piles.
          </p>
          <ul className="mt-5 space-y-3">
            {PILES.map((pile) => (
              <li key={pile.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Chip tone={pile.tone}>{pile.label}</Chip>
                <span className="text-[15px] text-ink-700">{pile.line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="hw-rise">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-700 uppercase">Behind More</p>
          <ul className="mt-4 divide-y divide-ink-200 border-y border-ink-200">
            {MORE.map((item) => (
              <li key={item.name} className="grid grid-cols-[8.5rem_1fr] gap-4 py-3.5">
                <span className="text-[15px] font-semibold text-ink-900">{item.name}</span>
                <span className="text-[15px] leading-relaxed text-ink-700">{item.line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
