import { account } from './account';
import { checkin } from './checkin';
import { common } from './common';
import { customers } from './customers';
import { errors } from './errors';
import { feedback } from './feedback';
import { focus } from './focus';
import { home } from './home';
import { improvements } from './improvements';
import { kit } from './kit';
import { lifecycle } from './lifecycle';
import { nav } from './nav';
import { pulse } from './pulse';
import { review } from './review';
import { team } from './team';

/**
 * THE ONE DICTIONARY.
 *
 * Every word the client portal says to a business owner is here, in English,
 * Hindi and Marathi, and nowhere else. That is the point of the file: a phrase
 * that lives in a component can be changed in English without anybody noticing
 * the other two languages now disagree with it, and after enough of those the
 * portal is saying three different things in three languages. Keeping the three
 * next to each other makes drift visible at the moment it is introduced.
 *
 * ONE FILE PER SECTION OF THE PORTAL, composed here. The split is for the
 * people editing it, not for the runtime — there is exactly one flat namespace
 * of keys, so a phrase used on four pages is defined once, in `common`, and the
 * four pages cannot drift apart.
 */
export const MESSAGES = {
  ...common,
  ...nav,
  ...home,
  ...customers,
  ...feedback,
  ...improvements,
  ...checkin,
  ...pulse,
  ...review,
  ...team,
  ...kit,
  ...account,
  ...focus,
  ...lifecycle,
  ...errors,
};

/**
 * Every key that exists, as a type.
 *
 * This is what makes a missing key a compile error instead of a stray
 * `home.focus.headline` on somebody's screen. Nothing outside this module
 * should ever type a key as a bare string.
 */
export type MessageKey = keyof typeof MESSAGES;
