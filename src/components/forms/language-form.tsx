'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { setLocaleAction } from '@/lib/actions/locale';
import { IDLE, type ActionState } from '@/lib/actions/shared';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/locale';
import { useT } from '@/components/portal/locale-provider';

/**
 * CHOOSING THE PORTAL'S LANGUAGE.
 *
 * Three buttons, no dropdown. A select on a phone hides two of the three
 * options behind a tap, and the one thing this control must do is be readable
 * by somebody who has not found their language yet — so all three are on the
 * screen at once, each written in its own script.
 *
 * One button per language, each submitting its own value. That means it works
 * with JavaScript switched off and needs no client state to track a pending
 * selection: the server sets the cookie, the layout re-renders, and the newly
 * chosen language is already on the screen by the time the answer arrives.
 *
 * The confirmation comes back in the language just chosen, which is the only
 * confirmation that actually proves the switch worked.
 */

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={clsx(
        'mt-4 rounded-xl border px-4 py-3 text-[15px] leading-relaxed break-words',
        state.ok
          ? 'border-good-200 bg-good-50 text-good-700'
          : 'border-bad-200 bg-bad-50 text-bad-700',
      )}
    >
      {state.message}
    </p>
  );
}

export function LanguageForm({
  clientId,
  current,
}: {
  clientId: string;
  current: Locale;
}) {
  const [state, action, pending] = useActionState(setLocaleAction, IDLE);
  const t = useT();

  return (
    <form action={action}>
      <input type="hidden" name="clientId" value={clientId} />

      <p className="text-[15px] leading-relaxed text-ink-700">{t('account.language.help')}</p>

      <div
        role="group"
        aria-label={t('account.language.title')}
        className="mt-4 flex flex-wrap gap-3"
      >
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              type="submit"
              name="locale"
              value={locale}
              disabled={pending}
              aria-current={active ? 'true' : undefined}
              // The label says which language the button switches to, so a
              // screen reader hears a choice rather than a bare word.
              aria-label={t('account.language.choose', { language: LOCALE_LABELS[locale] })}
              className={clsx(
                'inline-flex min-h-12 min-w-24 items-center justify-center rounded-xl border px-5 text-[16px] transition-colors focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none disabled:opacity-60',
                active
                  ? 'border-ink-900 bg-ink-900 font-semibold text-white'
                  : 'border-ink-300 bg-white font-medium text-ink-800 hover:border-ink-900',
              )}
            >
              {LOCALE_LABELS[locale]}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
        {t('account.language.current')}: {LOCALE_LABELS[current]}
        {pending ? ` · ${t('account.language.saving')}` : ''}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
        {t('account.language.scope')} {t('account.language.numbersNote')}
      </p>

      <Notice state={state} />
    </form>
  );
}
