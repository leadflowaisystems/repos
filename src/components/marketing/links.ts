/**
 * EVERY DESTINATION THE PUBLIC SITE OFFERS.
 *
 * One primary call to action with one label, one secondary, one way in for
 * people who already have an account, and four places on the page itself.
 * Nothing on the site links anywhere else — no external site, no messaging
 * deep link — and `tests/m26.marketing-site.test.ts` checks every href on
 * the page against this list.
 */

export const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Businesses', href: '#businesses' },
  { label: 'Contact', href: '#contact' },
] as const;

/** Self-service signup exists, so the primary action starts the product. */
export const GET_STARTED = { label: 'Get started', href: '/signup' } as const;

export const SIGN_IN = { label: 'Sign in', href: '/login' } as const;

export const TALK_TO_US = { label: 'Talk to us', href: '#contact' } as const;

export const SEE_HOW = { label: 'See how it works', href: '#how-it-works' } as const;
