'use client';

import clsx from 'clsx';
import {
  createContext,
  useActionState,
  useContext,
  type ReactNode,
} from 'react';
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * One form wrapper for the whole app.
 *
 * Server actions return an `ActionState`; this puts it on context so any field
 * can show its own message. Validation errors are always shown next to the
 * input that caused them, never as a bare "invalid input" banner.
 */

const FormStateContext = createContext<ActionState>(IDLE);

export function useFieldError(name: string): string | undefined {
  return useContext(FormStateContext).errors[name];
}

export function ActionForm({
  action,
  children,
  submitLabel = 'Save',
  submittingLabel = 'Saving…',
  submitVariant = 'primary',
  submitDisabled = false,
  secondaryAction,
  className,
  footerNote,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  submittingLabel?: string;
  submitVariant?: 'primary' | 'danger';
  /** Client-side guard only — every action re-validates on the server. */
  submitDisabled?: boolean;
  secondaryAction?: ReactNode;
  className?: string;
  footerNote?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <FormStateContext.Provider value={state}>
      <form action={formAction} className={clsx('space-y-5', className)}>
        {children}

        {state.message ? (
          <Notice tone={state.ok ? 'good' : 'bad'}>{state.message}</Notice>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
          <Button
            type="submit"
            variant={submitVariant}
            disabled={pending || submitDisabled}
          >
            {pending ? submittingLabel : submitLabel}
          </Button>
          {secondaryAction}
          {footerNote ? (
            <p className="text-[12px] text-ink-500">{footerNote}</p>
          ) : null}
        </div>
      </form>
    </FormStateContext.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  if (!error) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12px] font-medium text-bad-700">
      {error}
    </p>
  );
}

type BaseFieldProps = {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
};

export function TextField({
  name,
  label,
  hint,
  required,
  className,
  ...rest
}: BaseFieldProps & React.ComponentProps<'input'>) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} required={required} className={className}>
      <Input
        name={name}
        aria-invalid={error ? true : undefined}
        className={error ? 'border-bad-600' : undefined}
        {...rest}
      />
      <FieldError name={name} />
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  required,
  className,
  ...rest
}: BaseFieldProps & React.ComponentProps<'textarea'>) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} required={required} className={className}>
      <Textarea
        name={name}
        aria-invalid={error ? true : undefined}
        className={error ? 'border-bad-600' : undefined}
        {...rest}
      />
      <FieldError name={name} />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  required,
  className,
  options,
  ...rest
}: BaseFieldProps &
  React.ComponentProps<'select'> & {
    options: ReadonlyArray<{ value: string; label: string }>;
  }) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} required={required} className={className}>
      <Select
        name={name}
        aria-invalid={error ? true : undefined}
        className={error ? 'border-bad-600' : undefined}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <FieldError name={name} />
    </Field>
  );
}

/** Two- and three-column grids used throughout the forms. */
export function FormGrid({
  cols = 2,
  children,
}: {
  cols?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'grid gap-4',
        cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
      )}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">{title}</legend>
      <div>
        <h3 className="text-[14px] font-semibold text-ink-900">{title}</h3>
        {description ? (
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-500">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}
