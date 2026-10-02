'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { useT } from '@/components/portal/locale-provider';
import { changePasswordAction, requestEmailChangeAction } from '@/lib/actions/account-access';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * SIGNING IN, ON ACCOUNT (M52).
 *
 * Two small forms. One asks Supabase to email a confirmation link to the
 * owner's real address — only while they still sign in with the temporary
 * one. The other changes the password, and asks for the current one first.
 * Passwords go to the server and are never sent back.
 */

const FIELD =
  'mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-ink-900 placeholder:text-ink-400';
const LABEL = 'block text-[14px] font-medium text-ink-800';
const BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink-900 px-4 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400 sm:w-auto';

function Field({
  id,
  name,
  label,
  type = 'text',
  state,
  autoComplete,
  placeholder,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  state: ActionState;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  const error = state.errors[name];
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
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
      role={state.ok ? 'status' : 'alert'}
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

/** "Email me a link" — to a new address, or the same one again. */
export function SignInEmailForm({
  clientId,
  defaultEmail,
  again,
}: {
  clientId: string;
  defaultEmail: string;
  /** A link was already sent to `defaultEmail`; the button sends it again. */
  again: boolean;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(requestEmailChangeAction, IDLE);
  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      <Field
        id="signin-email"
        name="email"
        label={again ? t('account.signin.otherEmail') : t('account.signin.emailLabel')}
        type="email"
        state={state}
        autoComplete="email"
        defaultValue={state.data?.email ?? defaultEmail}
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending
          ? t('account.signin.sending')
          : again
            ? t('account.signin.sendAgain')
            : t('account.signin.sendLink')}
      </button>
    </form>
  );
}

export function ChangePasswordForm({ clientId }: { clientId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(changePasswordAction, IDLE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      <Field
        id="password-current"
        name="currentPassword"
        label={t('common.form.auth.currentPassword')}
        type="password"
        state={state}
        autoComplete="current-password"
      />
      <Field
        id="password-new"
        name="password"
        label={t('common.form.auth.newPassword')}
        type="password"
        state={state}
        autoComplete="new-password"
        placeholder={t('common.form.auth.passwordHint')}
      />
      <Field
        id="password-confirm"
        name="confirmPassword"
        label={t('common.form.auth.confirmPassword')}
        type="password"
        state={state}
        autoComplete="new-password"
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? t('common.form.auth.changing') : t('common.form.auth.changePassword')}
      </button>
    </form>
  );
}
