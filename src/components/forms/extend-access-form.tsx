'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { useT } from '@/components/portal/locale-provider';
import { requestContinuationAction } from '@/lib/actions/continuation';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * ASKING TO CONTINUE (M28) — which means ASK, and never pretends otherwise.
 *
 * Two fields. A phone number, because that is how a small business actually
 * gets reached, and an email only if they want to give one. No name field: the
 * person is signed in, so Headway already knows which business is asking, and
 * asking them to retype what is on the screen above would be theatre.
 *
 * NOTHING HERE CHARGES ANYTHING. There is no card field, no amount, no plan and
 * no payment page, because RepOS takes no payments — the operator agrees a
 * number by hand. The button says what happens next and the confirmation says
 * it again. The label used to read "Extend access", which is exactly what a
 * customer would take as "my trial just got longer": pressing it sends a
 * message, and nothing about the account moves until a person has spoken to
 * them, so the button asks and never promises.
 *
 * The fields sit behind a disclosure so the page leads with the decision rather
 * than the form. `<details>` rather than React state, so it opens without
 * JavaScript and a screen reader hears a button that expands.
 */

const PRIMARY =
  'inline-flex min-h-12 cursor-pointer list-none items-center justify-center rounded-xl bg-brand-700 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-brand-900 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none';
const SUBMIT =
  'inline-flex min-h-12 items-center justify-center rounded-xl bg-ink-900 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400';

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
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

export function ExtendAccessForm({
  clientId,
  ownerPhone,
  ownerEmail,
  label,
}: {
  clientId: string;
  ownerPhone: string;
  ownerEmail: string;
  /** The disclosure's own label. "Ask to continue" in every state, running trial
   *  or ended, because asking is the same act either way. Left unset it reads
   *  that phrase in the owner's own language. */
  label?: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(requestContinuationAction, IDLE);

  // Once it has gone through, the form is no longer the point: the confirmation
  // is. The page re-renders in its pending state underneath.
  if (state.ok) {
    return (
      <div>
        <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
          {t('common.form.continue.received')}
        </p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
          {t('common.form.continue.receivedBody')}
        </p>
      </div>
    );
  }

  return (
    <details className="group" open={state.message ? true : undefined}>
      <summary className={PRIMARY}>{label ?? t('common.form.continue.ask')}</summary>

      <form action={action} className="mt-5 max-w-xl">
        <input type="hidden" name="clientId" value={clientId} />
        <p className="mb-4 text-[14px] leading-relaxed text-ink-600">
          {t('common.form.continue.help')}
        </p>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="continuation-phone" className="block text-[14px] font-medium text-ink-800">
              {t('common.form.continue.phone')}{' '}
              <span className="font-normal text-ink-500">{t('common.form.required')}</span>
            </label>
            <input
              id="continuation-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              required
              defaultValue={ownerPhone}
              autoComplete="tel"
              aria-invalid={state.errors.phone ? true : undefined}
              aria-describedby={state.errors.phone ? 'continuation-phone-error' : undefined}
              className={clsx(
                'mt-1.5 min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-[16px] text-ink-900 placeholder:text-ink-400',
                state.errors.phone ? 'border-bad-600' : 'border-ink-300',
              )}
            />
            {state.errors.phone ? (
              <p id="continuation-phone-error" className="mt-1 text-[13px] text-bad-700">
                {state.errors.phone}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="continuation-email" className="block text-[14px] font-medium text-ink-800">
              {t('common.form.email')}{' '}
              <span className="font-normal text-ink-500">{t('common.form.optional')}</span>
            </label>
            <input
              id="continuation-email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={ownerEmail}
              autoComplete="email"
              aria-invalid={state.errors.email ? true : undefined}
              aria-describedby={state.errors.email ? 'continuation-email-error' : undefined}
              className={clsx(
                'mt-1.5 min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-[16px] text-ink-900 placeholder:text-ink-400',
                state.errors.email ? 'border-bad-600' : 'border-ink-300',
              )}
            />
            {state.errors.email ? (
              <p id="continuation-email-error" className="mt-1 text-[13px] text-bad-700">
                {state.errors.email}
              </p>
            ) : null}
          </div>
        </div>

        <button type="submit" disabled={pending} className={clsx(SUBMIT, 'mt-5')}>
          {pending ? t('common.form.sending') : t('common.form.continue.submit')}
        </button>

        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
          {t('common.form.continue.noCharge')}
        </p>

        <Notice state={state} />
      </form>
    </details>
  );
}
