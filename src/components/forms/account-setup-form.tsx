'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { useT } from '@/components/portal/locale-provider';
import { completeAccountSetupAction } from '@/lib/actions/account-access';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * SET UP YOUR ACCOUNT (M39).
 *
 * Shown only while the signed-in owner is still on a temporary,
 * admin-issued credential. The login id itself is never asked for here and
 * never changes — only the password does — so `account.setup.loginIdNote`
 * says that plainly, matching the same style `Field`/`Notice` already use on
 * `account-forms.tsx`.
 */

const FIELD =
  'mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-ink-900 placeholder:text-ink-400';
const LABEL = 'block text-[14px] font-medium text-ink-800';
const BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink-900 px-4 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400 sm:w-auto';

function Field({
  name,
  label,
  type = 'text',
  state,
  required,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  state: ActionState;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const error = state.errors[name];
  return (
    <div>
      <label htmlFor={`setup-${name}`} className={LABEL}>
        {label}
      </label>
      <input
        id={`setup-${name}`}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={clsx(FIELD, error ? 'border-bad-600' : 'border-ink-300')}
      />
      {error ? <p className="mt-1 text-[13px] text-bad-700">{error}</p> : null}
    </div>
  );
}

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={clsx(
        'rounded-xl border px-4 py-3 text-[14px]',
        state.ok
          ? 'border-good-200 bg-good-50 text-good-700'
          : 'border-bad-200 bg-bad-50 text-bad-700',
      )}
    >
      {state.message}
    </p>
  );
}

export function AccountSetupForm({ clientId }: { clientId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(completeAccountSetupAction, IDLE);

  return (
    <div>
      <p className="text-[15px] leading-relaxed text-ink-700">{t('account.setup.intro')}</p>
      <form action={action} className="mt-5 space-y-5">
        <input type="hidden" name="clientId" value={clientId} />
        <Field name="name" label={t('common.form.yourName')} state={state} autoComplete="name" />
        <Field
          name="phone"
          label={t('common.form.setup.ownerPhone')}
          type="tel"
          state={state}
          autoComplete="tel"
        />
        <Field
          name="email"
          label={t('common.form.email')}
          type="email"
          state={state}
          autoComplete="email"
        />
        <Field
          name="password"
          label={t('common.form.auth.newPassword')}
          type="password"
          state={state}
          required
          autoComplete="new-password"
          placeholder={t('common.form.auth.passwordHint')}
        />
        <Field
          name="confirmPassword"
          label={t('account.setup.confirmPassword')}
          type="password"
          state={state}
          required
          autoComplete="new-password"
        />
        <Notice state={state} />
        <div>
          <button type="submit" disabled={pending} className={BUTTON}>
            {pending ? t('common.form.setup.settingUp') : t('common.form.setup.finish')}
          </button>
        </div>
      </form>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
        {t('account.setup.loginIdNote')}
      </p>
    </div>
  );
}
