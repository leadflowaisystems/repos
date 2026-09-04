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
 */

export type GatewayCopy = {
  businessName: string;
  /** The question at the top. Universal on purpose. */
  headline: string;
  /** One line under it, in the vertical's voice. */
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
  /** The open box, last and plainly optional. */
  textHeadline: string;
  textNote: string;
  continueLabel: string;
  backLabel: string;
  /** Offered at every step, so nobody has to answer to get out. */
  skipLabel: string;
  /** The one reassurance the page makes. Plain words, no policy. */
  privacyLine: string;
  thanksHeadline: string;
  /** The vertical's own thank-you line. */
  thanksLine: string;
  shareQuestion: string;
  shareNote: string;
  /** Printed under the QR on the counter card. */
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
    prompt: pick(g?.prompt, 'Tell us what went well, or what we could do better.'),
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
    continueLabel: 'Continue',
    backLabel: 'Back',
    skipLabel: 'Skip',
    privacyLine: `No name or number needed. This goes to the ${businessName.trim()} team only.`,
    thanksHeadline: 'Thank you. Your feedback has been received.',
    thanksLine: pick(g?.thankYou, kit?.thankYou, 'The team reads every one of these.'),
    shareQuestion: 'Want to share your experience publicly?',
    shareNote: 'Entirely optional. Whatever you wrote here stays private.',
    printHeadline: pick(g?.headline, 'How was your experience?'),
    printLine: pick(g?.printLine, 'Your feedback helps us improve.'),
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
