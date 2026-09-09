'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { useT } from '@/components/portal/locale-provider';
import {
  completeOnboardingAction,
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from '@/lib/actions/account';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * ACCOUNT FORMS (M20).
 *
 * Plain forms posting to server actions. There is deliberately no Supabase
 * client in the browser: the project URL and key never leave the server, and
 * these components know nothing about how identity is verified.
 */

const FIELD =
  'mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-ink-900 placeholder:text-ink-400';
const LABEL = 'block text-[14px] font-medium text-ink-800';
const BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink-900 px-4 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400';

function Field({
  name,
  label,
  type = 'text',
  state,
  required,
  placeholder,
  autoComplete,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  state: ActionState;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  const error = state.errors[name];
  return (
    <div>
      <label htmlFor={name} className={LABEL}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
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

export function SignUpForm() {
  const t = useT();
  const [state, action, pending] = useActionState(signUpAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <Field
        name="email"
        label={t('common.form.email')}
        type="email"
        state={state}
        required
        autoComplete="email"
      />
      <Field
        name="password"
        label={t('common.form.password')}
        type="password"
        state={state}
        required
        autoComplete="new-password"
        placeholder={t('common.form.auth.passwordHint')}
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? t('common.form.auth.creating') : t('common.form.auth.createAccount')}
      </button>
    </form>
  );
}

export function SignInForm({ next }: { next: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(signInAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <Field
        name="email"
        label={t('common.form.email')}
        type="email"
        state={state}
        required
        autoComplete="email"
      />
      <Field
        name="password"
        label={t('common.form.password')}
        type="password"
        state={state}
        required
        autoComplete="current-password"
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? t('common.form.auth.signingIn') : t('common.form.auth.signIn')}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useT();
  const [state, action, pending] = useActionState(requestPasswordResetAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      {/* No origin field: where the email points is resolved on the server
          from the deployment's own configuration, never from the browser. */}
      <Field
        name="email"
        label={t('common.form.email')}
        type="email"
        state={state}
        required
        autoComplete="email"
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? t('common.form.sending') : t('common.form.auth.sendResetLink')}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useT();
  const [state, action, pending] = useActionState(updatePasswordAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <Field
        name="password"
        label={t('common.form.auth.newPassword')}
        type="password"
        state={state}
        required
        autoComplete="new-password"
        placeholder={t('common.form.auth.passwordHint')}
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? t('common.form.saving') : t('common.form.auth.setPassword')}
      </button>
    </form>
  );
}

/**
 * Four answers, in the order an owner can give them without stopping to think.
 * Everything else RepOS learns from that business's own customers.
 */
export function OnboardingForm({
  verticals,
}: {
  verticals: Array<{ value: string; label: string }>;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(completeOnboardingAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <Field
        name="businessName"
        label={t('common.form.setup.businessName')}
        state={state}
        required
        placeholder={t('common.form.setup.businessNameHint')}
      />

      <div>
        <label htmlFor="vertical" className={LABEL}>
          {t('common.form.setup.kind')}
        </label>
        <select
          id="vertical"
          name="vertical"
          required
          defaultValue=""
          aria-invalid={state.errors.vertical ? true : undefined}
          className={clsx(FIELD, state.errors.vertical ? 'border-bad-600' : 'border-ink-300')}
        >
          <option value="" disabled>
            {t('common.form.setup.chooseOne')}
          </option>
          {verticals.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px] text-ink-500">{t('common.form.setup.kindHint')}</p>
        {state.errors.vertical ? (
          <p className="mt-1 text-[13px] text-bad-700">{state.errors.vertical}</p>
        ) : null}
      </div>

      <Field
        name="areaLabel"
        label={t('common.form.setup.area')}
        state={state}
        placeholder={t('common.form.setup.areaHint')}
      />
      <Field name="ownerName" label={t('common.form.yourName')} state={state} />
      <Field
        name="ownerPhone"
        label={t('common.form.setup.ownerPhone')}
        state={state}
        placeholder={t('common.form.setup.optional')}
      />

      <div>
        <label htmlFor="context" className={LABEL}>
          {t('common.form.setup.context')}
        </label>
        <textarea
          id="context"
          name="context"
          rows={3}
          maxLength={500}
          placeholder={t('common.form.setup.contextHint')}
          className={clsx(FIELD, 'resize-y leading-relaxed', 'border-ink-300')}
        />
      </div>

      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? t('common.form.setup.settingUp') : t('common.form.setup.finish')}
      </button>
    </form>
  );
}
