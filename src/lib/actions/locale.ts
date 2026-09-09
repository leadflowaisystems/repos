'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { currentActor } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABELS,
  toLocale,
} from '@/lib/i18n/locale';
import { failure, str, success, type ActionState } from './shared';

/**
 * CHOOSING THE PORTAL'S LANGUAGE.
 *
 * The smallest action in the codebase, and deliberately so. It changes how
 * words are drawn and nothing else: no row is written, no business record is
 * touched, no policy is consulted. An owner switching to Marathi is not
 * changing their account, so this must not be able to.
 *
 * It still requires a signed-in person — not because the language is a secret,
 * but because an endpoint that sets cookies for anybody who posts to it is a
 * loose end with no reason to exist.
 *
 * An unrecognised value is not an error to show somebody. `toLocale` turns
 * anything it does not know into English, which is the correct end state for a
 * request that asked for a language Headway does not speak.
 */
export async function setLocaleAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await currentActor(prisma);
  if (!actor) return failure('Please sign in again.');

  const locale = toLocale(str(form, 'locale'));

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  // Every portal page is force-dynamic, but the router still holds a rendered
  // copy of the page the owner is standing on. Without this they would change
  // the language and watch nothing happen until they clicked something else.
  //
  // The ROOT layout, not this page's. The language is read in
  // src/app/(workspace)/layout.tsx — it sets `lang` on the document and hands
  // the strings to every client component — and that layout sits above the
  // `/workspace/[clientId]` segment, so revalidating the segment alone would
  // re-render the page in Marathi inside a shell still holding English. This
  // costs nothing here: every portal page is force-dynamic already.
  revalidatePath('/', 'layout');

  // Confirmed in the language just chosen, which is the only confirmation that
  // actually proves the switch worked.
  return success(
    locale === 'hi'
      ? `भाषा बदलकर ${LOCALE_LABELS.hi} कर दी गई।`
      : locale === 'mr'
        ? `भाषा बदलून ${LOCALE_LABELS.mr} केली आहे.`
        : `Language changed to ${LOCALE_LABELS.en}.`,
  );
}
