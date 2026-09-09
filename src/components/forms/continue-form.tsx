'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { useT } from '@/components/portal/locale-provider';
import { continueWithHeadwayAction, updateOwnerContactAction } from '@/lib/actions/commercial';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * THE OWNER'S HALF OF THE COMMERCIAL CONVERSATION (M21, reshaped in M23).
 *
 * One form, two jobs. In `continue` mode it is how an owner asks to carry on
 * with Headway after the trial: the button opens three prefilled fields — the
 * name to ask for, the address to write to, the number to message — and one
 * press sends them. It asks; it does not buy, and the label says so. In
 * `update` mode the same fields keep those details right, and nothing else
 * happens.
 *
 * It carries no amount, no plan, no card field and no payment page, because
 * RepOS takes no payments: the operator agrees a number by hand and sends the
 * payment details and the payment QR to the details confirmed here. That QR is
 * the one to pay with — never the feedback card customers scan.
 *
 * The fields sit behind a disclosure so the page leads with the decision, not
 * with a form. `<details>` rather than state, so it opens without JavaScript
 * and a screen reader hears a button that expands.
 */

const PRIMARY =
  'inline-flex min-h-12 cursor-pointer list-none items-center justify-center rounded-xl bg-brand-700 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-brand-900 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none';
const QUIET =
  'inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-ink-300 bg-white px-4 text-[14px] font-medium text-ink-800 transition-colors hover:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none';
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

function Field({
  id,
  name,
  label,
  type,
  defaultValue,
  error,
  autoComplete,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  type: string;
  defaultValue: string;
  error?: string;
  autoComplete: string;
  inputMode?: 'tel' | 'email';
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-medium text-ink-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={clsx(
          'mt-1.5 min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-[16px] text-ink-900 placeholder:text-ink-400',
          error ? 'border-bad-600' : 'border-ink-300',
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[13px] text-bad-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContinueWithHeadwayForm({
  clientId,
  ownerName,
  ownerEmail,
  ownerPhone,
  mode,
}: {
  clientId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  /** `continue` asks to carry on; `update` only keeps the details current. */
  mode: 'continue' | 'update';
}) {
  const t = useT();
  const [state, action, pending] = useActionState(
    mode === 'continue' ? continueWithHeadwayAction : updateOwnerContactAction,
    IDLE,
  );

  // Once the request has gone through, the details are no longer the point:
  // the confirmation is. The page re-renders in its new state underneath.
  if (mode === 'continue' && state.ok) {
    return <Notice state={state} />;
  }

  return (
    <details className="group" open={state.message ? true : undefined}>
      <summary className={mode === 'continue' ? PRIMARY : QUIET}>
        {mode === 'continue'
          ? t('common.form.continue.ask')
          : t('common.form.contact.update')}
      </summary>

      <form action={action} className="mt-5 max-w-xl">
        <input type="hidden" name="clientId" value={clientId} />
        <p className="mb-4 text-[14px] leading-relaxed text-ink-600">
          {mode === 'continue'
            ? t('common.form.contact.continueHelp')
            : t('common.form.contact.updateHelp')}
        </p>
        <div className="grid grid-cols-1 gap-4">
          <Field
            id="account-owner-name"
            name="ownerName"
            label={t('common.form.yourName')}
            type="text"
            defaultValue={ownerName}
            error={state.errors.name}
            autoComplete="name"
          />
          <Field
            id="account-owner-email"
            name="ownerEmail"
            label={t('common.form.email')}
            type="email"
            inputMode="email"
            defaultValue={ownerEmail}
            error={state.errors.email}
            autoComplete="email"
          />
          <Field
            id="account-owner-phone"
            name="ownerPhone"
            label={t('common.form.contact.phone')}
            type="tel"
            inputMode="tel"
            defaultValue={ownerPhone}
            error={state.errors.phone}
            autoComplete="tel"
          />
        </div>

        <button type="submit" disabled={pending} className={clsx(SUBMIT, 'mt-5')}>
          {pending
            ? t('common.form.sending')
            : mode === 'continue'
              ? t('common.form.contact.send')
              : t('common.form.save')}
        </button>

        <Notice state={state} />
      </form>
    </details>
  );
}
