import { checkPublicBaseUrl, PUBLIC_BASE_URL_VAR } from '@/lib/config/public-url';

/**
 * THE PUBLIC WEBSITE'S CONFIGURATION.
 *
 * The marketing site is the one surface a stranger reaches without a QR code,
 * an invitation or an account. It reads nothing from the database and holds
 * no state: everything on it is either written in the components or comes from
 * the environment variables below, read once when the page is built.
 *
 * Nothing here is NEXT_PUBLIC_. The values are rendered into HTML on the
 * server, which is the only place they are ever read.
 */

export const SITE_NAME = 'Headway';
export const SITE_TITLE = 'Headway — Turn customer feedback into better decisions';
export const SITE_DESCRIPTION =
  'Headway helps businesses turn customer feedback into clear actions, track what changes, and see whether the customer experience actually improves.';

/**
 * How a visitor reaches the people behind Headway.
 *
 * The details are written here, so the front door never shows a blank where
 * a contact should be; the two variables override them for a deployment that
 * needs different ones. Everything is plain text. The site never builds a
 * mailto:, tel: or wa.me link from them — RepOS constructs no messaging deep
 * link anywhere, and the compliance suite enforces that — so a visitor copies
 * the address or the number the way an operator copies a reply.
 */
export const CONTACT_EMAIL_VAR = 'REPOS_CONTACT_EMAIL';
export const CONTACT_PHONE_VAR = 'REPOS_CONTACT_PHONE';

export const DEFAULT_CONTACT = {
  email: 'hello.headwayco@gmail.com',
  /** As a person reads it. */
  phone: '+91 7972755279',
} as const;

export type SiteContact = {
  email: string;
  phone: string;
  /** The same number with nothing but the plus and the digits, for a WhatsApp search. */
  whatsapp: string;
};

/** One address, one mailbox, nothing that could be a header injection or a link. */
const EMAIL_SHAPE = /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/;
/** Digits with the punctuation people actually write phone numbers with. */
const PHONE_SHAPE = /^\+?[\d\s().-]{6,30}$/;

function cleanEmail(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (value.length === 0 || value.length > 120) return null;
  return EMAIL_SHAPE.test(value) ? value : null;
}

function cleanPhone(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (value.length === 0) return null;
  return PHONE_SHAPE.test(value) ? value : null;
}

/** "+91 7972755279" → "+917972755279". */
export function dialable(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * The details the page shows: the environment's when it names a usable one,
 * the built-in ones otherwise. A malformed override is ignored rather than
 * rendered, because a wrong address on the front door is worse than none.
 */
export function siteContact(env: NodeJS.ProcessEnv = process.env): SiteContact {
  const email = cleanEmail(env[CONTACT_EMAIL_VAR]) ?? DEFAULT_CONTACT.email;
  const phone = cleanPhone(env[CONTACT_PHONE_VAR]) ?? DEFAULT_CONTACT.phone;
  return { email, phone, whatsapp: dialable(phone) };
}

/**
 * The absolute address of the site, for the canonical link, the social
 * preview and the QR code drawn on the example card.
 *
 * The same setting the printed QR codes use, so the website and the cards can
 * never name two different homes. Null when it is not configured: the page
 * still renders, and the parts that need an absolute address leave it out.
 */
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = (env[PUBLIC_BASE_URL_VAR] ?? '').trim();
  if (configured.length === 0) return null;
  const check = checkPublicBaseUrl(configured);
  return check.ok ? check.url : null;
}
