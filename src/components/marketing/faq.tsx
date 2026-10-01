import { PRODUCT_RULES } from '@/lib/marketing/site';
import { Heading, Section } from './primitives';

/**
 * THE QUESTIONS OWNERS ACTUALLY ASK.
 *
 * Each answer is a description of what the product does now, and each is
 * short enough to read standing up. Native <details>, so the page needs no
 * script for it and a keyboard or a screen reader gets the disclosure the
 * browser already knows how to announce.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: publish a price. There is no public price
 * list anywhere in Headway — what a business pays is agreed with it directly —
 * so the answer says how that happens instead of inventing a number.
 */

const FAQ = [
  {
    q: 'Is the feedback public?',
    a: 'No. Feedback left through your QR card or link goes to your business’s team only. After they send it, every customer — happy or not — is offered your public review link if you have one. Headway never posts anything anywhere.',
  },
  {
    q: 'Do customers need an app or an account?',
    a: 'No. They scan the code or open the link, and the page works in any phone browser. It takes about a minute, and nobody is asked for a name or a number.',
  },
  {
    q: 'What if I only have a few responses?',
    a: `Headway reads every response as it arrives, and some insights only appear when enough evidence supports them. It gives a first reading once you have ${PRODUCT_RULES.firstReadingAt} responses. Before that, your workspace shows how many responses have arrived and how many more it needs. Even then, a topic is named only once at least ${PRODUCT_RULES.namedAt} responses mention it, and a change over time is shown only when two check-ins each hold at least ${PRODUCT_RULES.compareAt} — Headway will not turn two comments into a trend.`,
  },
  {
    q: 'Does Headway contact my customers?',
    a: 'No. Customers stay anonymous, Headway keeps no customer names or numbers, and it never sends messages to your customers.',
  },
  {
    q: 'Which languages does it work in?',
    a: 'Customers can write in English, Hindi or Marathi. Your workspace can be read in English, हिन्दी or मराठी — you choose on your Account page.',
  },
  {
    q: 'What does it cost?',
    a: 'Your workspace starts on a free trial, with no card and no payment page. When you want to carry on, press Continue with Headway on your Account page and the Headway team agrees the rest with you directly. Printed QR cards are ordered from your workspace, priced per card.',
  },
  {
    q: 'Can I stop, and have my data deleted?',
    a: 'Yes. Ask the Headway team and your business’s workspace — its feedback, its topics, its changes and everything else it stores — is deleted permanently.',
  },
] as const;

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <Heading
          id="faq-heading"
          eyebrow="Questions"
          title="What owners ask before they start."
          lead="Anything else, ask us directly — the details are just below."
        />
        <ul className="hw-rise divide-y divide-ink-200 border-y border-ink-200">
          {FAQ.map((item) => (
            <li key={item.q}>
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] leading-snug font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink-300 text-[16px] leading-none text-ink-700 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-pretty text-ink-700">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
