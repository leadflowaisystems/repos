'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { requestPaymentDetailsAction } from '@/lib/actions/commercial';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * THE OWNER'S HALF OF THE COMMERCIAL CONVERSATION (M21).
 *
 * One form, and it collects nothing RepOS does not already need: the name to
 * ask for, the address to write to, and the number to message. It carries no
 * amount, no plan, no card field and no payment page, because RepOS takes no
 * payments — the operator agrees a number by hand and sends the UPI or bank
 * details to the address confirmed here.
 *
 * The button says what it does. "Request payment details" is a request for
 * information, and pressing it commits the business to nothing.
 */

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400';

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={clsx(
        'mt-4 rounded-xl border px-4 py-3 text-[14px] break-words',
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
  hint,
  type,
  defaultValue,
  error,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  type: string;
  defaultValue: string;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-medium text-ink-800">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-[12px] text-ink-500">{hint}</p> : null}
      <input
        id={id}
        name={name}
        type={type}
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

export function RequestPaymentDetailsForm({
  clientId,
  ownerName,
  ownerEmail,
  ownerPhone,
  alreadyAsked,
}: {
  clientId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  /** True once a request has been recorded, so the button reads honestly. */
  alreadyAsked: boolean;
}) {
  const [state, action, pending] = useActionState(requestPaymentDetailsAction, IDLE);

  return (
    <form action={action} className="mt-4 max-w-xl">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid grid-cols-1 gap-4">
        <Field
          id="account-owner-name"
          name="ownerName"
          label="Who should we ask for"
          type="text"
          defaultValue={ownerName}
          error={state.errors.name}
          autoComplete="name"
        />
        <Field
          id="account-owner-email"
          name="ownerEmail"
          label="Email"
          hint="Where we send what this costs and how to pay."
          type="email"
          defaultValue={ownerEmail}
          error={state.errors.email}
          autoComplete="email"
        />
        <Field
          id="account-owner-phone"
          name="ownerPhone"
          label="Mobile or WhatsApp"
          hint="For anything quicker than email."
          type="tel"
          defaultValue={ownerPhone}
          error={state.errors.phone}
          autoComplete="tel"
        />
      </div>

      <button type="submit" disabled={pending} className={clsx(BUTTON, 'mt-5')}>
        {pending
          ? 'Sending…'
          : alreadyAsked
            ? 'Update my details and ask again'
            : 'Request payment details'}
      </button>

      <Notice state={state} />
    </form>
  );
}
