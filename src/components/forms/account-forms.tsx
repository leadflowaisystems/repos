'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
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
  const [state, action, pending] = useActionState(signUpAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <Field name="email" label="Email" type="email" state={state} required autoComplete="email" />
      <Field
        name="password"
        label="Password"
        type="password"
        state={state}
        required
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <Field name="email" label="Email" type="email" state={state} required autoComplete="email" />
      <Field
        name="password"
        label="Password"
        type="password"
        state={state}
        required
        autoComplete="current-password"
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      {/* No origin field: where the email points is resolved on the server
          from the deployment's own configuration, never from the browser. */}
      <Field name="email" label="Email" type="email" state={state} required autoComplete="email" />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <Field
        name="password"
        label="New password"
        type="password"
        state={state}
        required
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />
      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? 'Saving…' : 'Set password'}
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
  const [state, action, pending] = useActionState(completeOnboardingAction, IDLE);
  return (
    <form action={action} className="mt-8 space-y-5">
      <Field
        name="businessName"
        label="Business name"
        state={state}
        required
        placeholder="The name customers know you by"
      />

      <div>
        <label htmlFor="vertical" className={LABEL}>
          What kind of business is it?
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
            Choose one
          </option>
          {verticals.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px] text-ink-500">
          This sets what your customers are asked about, so it is worth getting right.
        </p>
        {state.errors.vertical ? (
          <p className="mt-1 text-[13px] text-bad-700">{state.errors.vertical}</p>
        ) : null}
      </div>

      <Field
        name="areaLabel"
        label="Area"
        state={state}
        placeholder="Neighbourhood or city"
      />
      <Field name="ownerName" label="Your name" state={state} />
      <Field name="ownerPhone" label="Your phone" state={state} placeholder="Optional" />

      <div>
        <label htmlFor="context" className={LABEL}>
          Anything we should keep in mind?
        </label>
        <textarea
          id="context"
          name="context"
          rows={3}
          maxLength={500}
          placeholder="One line is plenty — what you are trying to fix, or what matters most right now."
          className={clsx(FIELD, 'resize-y leading-relaxed', 'border-ink-300')}
        />
      </div>

      <Notice state={state} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? 'Setting up…' : 'Finish setup'}
      </button>
    </form>
  );
}
