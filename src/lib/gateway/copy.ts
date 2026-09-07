import type { Pack } from '@/lib/packs';

/**
 * CUSTOMER-FACING WORDING — one page, every vertical (M14).
 *
 * There is one feedback page. What differs between a clinic and a cafe is a
 * handful of lines, and those come from the client's vertical pack under
 * /packs, never from a conditional here. A pack without a `gateway` block
 * still gets a complete, natural page from the defaults below.
 *
 * Nothing in this module reads the feedback, the rating or anything about
 * the customer. The same words are shown to everyone.
 *
 * THE TONE (final experience pass). The page asks for the truth and says so
 * in plain words: good, bad or somewhere between. It never celebrates, never
 * fishes for a score, and never claims more than it can keep — feedback goes
 * to the team, and that is the whole promise. The open box asks a question
 * shaped by how the visit was rated, so a customer who had a good time is
 * asked what to keep and one who did not is asked what would have helped,
 * but the thank-you and the public-review offer are identical for everyone,
 * because a page that treats an unhappy customer differently is not
 * measuring anything.
 */

export type GatewayCopy = {
  businessName: string;
  /** The question at the top: the same one printed on the card. */
  headline: string;
  /** One line under it: the honesty invitation. */
  prompt: string;
  ratingLabel: string;
  ratingOptional: string;
  textLabel: string;
  placeholder: string;
  languageHint: string;
  submitLabel: string;
  /** Above the vertical's own questions (M19). */
  dimensionsHeadline: string;
  dimensionsNote: string;
  /** Above the specifics offered after a rating. Never called a complaint. */
  signalsNote: string;
  /** The open box when nothing was rated: last and plainly optional. */
  textHeadline: string;
  textNote: string;
  /** The open box after a good visit, a poor one, and a mixed one. */
  askKeep: string;
  askBetter: string;
  askMixed: string;
  continueLabel: string;
  backLabel: string;
  /** Offered at every step, so nobody has to answer to get out. */
  skipLabel: string;
  /** The one reassurance the page makes. Plain words, no policy. */
  privacyLine: string;
  thanksHeadline: string;
  /** Where the words went. A fact, not a promise about who reads when. */
  thanksLine: string;
  /** Why it was worth doing, in the vertical's own words where it has them. */
  thanksNote: string;
  shareQuestion: string;
  shareNote: string;
  /** The honest way out of the public-review offer. */
  shareDecline: string;
  /** The last line when there is nothing else to offer. */
  closeLine: string;
  /**
   * What goes on the PRINTED piece.
   *
   * The pack keeps these apart from the on-screen wording, and it is right to:
   * a card on a table has one line to earn a scan, while the page that opens
   * is a form and asks its own question. Reading the gateway block here made
   * the printed card say the form's question instead of the vertical's own,
   * so the tent and the counter card now agree with the pack and with each
   * other — and the pack's gateway headline is written to match the card, so
   * a customer who scans "How was your meal today?" lands on that question.
   */
  printHeadline: string;
  printLine: string;
  /** Where the vertical pack says the card should sit. */
  placement: string;
  assetLabel: string;
};

function pick(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

export function buildGatewayCopy(pack: Pack, businessName: string): GatewayCopy {
  const g = pack.gateway;
  const kit = pack.kit;
  return {
    businessName: businessName.trim(),
    headline: pick(g?.headline, 'How was your experience?'),
    prompt: pick(g?.prompt, 'Good, bad or somewhere between — we would like to hear it.'),
    ratingLabel: 'Your rating',
    ratingOptional: 'optional',
    textLabel: 'What would you like us to know?',
    placeholder: pick(g?.placeholder, 'Anything at all — good or bad.'),
    languageHint: 'English, Hindi or Marathi — whatever is easiest.',
    submitLabel: 'Send',
    dimensionsHeadline: 'How did these go?',
    dimensionsNote: 'Tap a rating. Skip anything that did not apply.',
    signalsNote: 'Pick any that fit — or none.',
    textHeadline: 'Anything else?',
    textNote: 'Optional. A line or two is plenty.',
    askKeep: pick(g?.keepPrompt, 'What should we keep doing?'),
    askBetter: pick(g?.betterPrompt, 'What would have made it better?'),
    askMixed: pick(g?.mixedPrompt, 'What worked, and what would have made it better?'),
    continueLabel: 'Continue',
    backLabel: 'Back',
    skipLabel: 'Skip',
    privacyLine: `No name or number needed. This goes to the ${businessName.trim()} team only.`,
    thanksHeadline: 'Thank you.',
    thanksLine: 'Your feedback has gone directly to the team.',
    thanksNote: pick(g?.thankYou, 'Honest feedback helps us know what to keep and what to improve.'),
    // Everyone sees this, worded the same way, whatever they rated. It never
    // suggests the private feedback was sent anywhere but the team, and it
    // gives the customer a plain way to say no.
    shareQuestion: 'Would you also like to share your experience publicly?',
    shareNote: 'Entirely optional. Whatever you wrote here stays private.',
    shareDecline: 'Not now? You can close this page.',
    closeLine: 'You can close this page now.',
    printHeadline: pick(kit?.headline, g?.headline, 'How was your experience?'),
    printLine: pick(kit?.subhead, g?.printLine, 'Tell us honestly — good, bad or somewhere between.'),
    placement: pick(kit?.placement, 'Somewhere the customer looks while they are paying.'),
    assetLabel: pick(kit?.assetLabel, 'counter card'),
  };
}

/**
 * The button label for the public review link, from its address alone. The
 * link is a stored string the operator typed; nothing is fetched to find out
 * what it is.
 */
export function publicReviewLabel(url: string | null | undefined): string {
  if (!url) return 'Leave a public review';
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$|^g\.page$|(^|\.)g\.co$/.test(host)) {
      return 'Leave a Google review';
    }
  } catch {
    // Not a parseable address: the generic label is still correct.
  }
  return 'Leave a public review';
}
