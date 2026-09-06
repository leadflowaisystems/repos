import clsx from 'clsx';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/** Shared primitives. Deliberately small: one operator, no design system. */

export function Card({
  children,
  className,
  ...rest
}: ComponentProps<'section'>) {
  return (
    <section
      className={clsx(
        'rounded-xl border border-ink-200 bg-white shadow-[0_1px_2px_rgb(15_18_26/0.04)]',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: ComponentProps<'div'>) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  // brand-700, not brand-600: white on #A67C34 is 3.78:1 and this is 13px
  // label text, which needs 4.5. #8A6529 is 5.28:1 and still unmistakably gold.
  primary:
    'bg-brand-700 text-white hover:bg-brand-900 disabled:bg-brand-700/50 border-transparent',
  secondary:
    'bg-white text-ink-800 hover:bg-ink-50 border-ink-300 disabled:text-ink-400',
  ghost:
    'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900 border-transparent',
  danger:
    'bg-white text-bad-700 hover:bg-bad-50 border-bad-200 disabled:text-bad-600/50',
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed';

export function Button({
  variant = 'secondary',
  className,
  ...rest
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return (
    <button
      className={clsx(BUTTON_BASE, BUTTON_STYLES[variant], className)}
      {...rest}
    />
  );
}

export function LinkButton({
  variant = 'secondary',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      className={clsx(BUTTON_BASE, BUTTON_STYLES[variant], className)}
      {...rest}
    />
  );
}

const FIELD_BASE =
  'w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-400 disabled:bg-ink-100';

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-700">
        {label}
        {required ? <span className="ml-0.5 text-bad-600">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[12px] leading-relaxed text-ink-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={clsx(FIELD_BASE, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={clsx(FIELD_BASE, 'min-h-24 resize-y leading-relaxed', className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={clsx(FIELD_BASE, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  good: 'bg-good-50 text-good-700 border-good-200',
  warn: 'bg-warn-50 text-warn-700 border-warn-200',
  bad: 'bg-bad-50 text-bad-700 border-bad-200',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-ink-800">{title}</p>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-500">
        {description}
      </p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[12px] font-medium tracking-wide text-ink-500 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const valueTone =
    tone === 'good'
      ? 'text-good-700'
      : tone === 'bad'
        ? 'text-bad-700'
        : tone === 'warn'
          ? 'text-warn-700'
          : 'text-ink-900';
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className="text-[12px] font-medium text-ink-500">{label}</p>
      <p className={clsx('mt-1 text-xl font-semibold tabular-nums', valueTone)}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[12px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Notice({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: Tone;
  title?: ReactNode;
  children: ReactNode;
}) {
  const tones: Record<Tone, string> = {
    neutral: 'border-ink-200 bg-ink-50 text-ink-700',
    brand: 'border-brand-200 bg-brand-50 text-brand-900',
    good: 'border-good-200 bg-good-50 text-good-700',
    warn: 'border-warn-200 bg-warn-50 text-warn-700',
    bad: 'border-bad-200 bg-bad-50 text-bad-700',
  };
  return (
    <div className={clsx('rounded-lg border px-4 py-3 text-[13px] leading-relaxed', tones[tone])}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

/** Definition row used across the read-only profile views. */
export function DataRow({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-ink-100 py-2.5 last:border-0 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-[13px] break-words text-ink-900">{children}</dd>
    </div>
  );
}
