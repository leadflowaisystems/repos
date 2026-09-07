import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * THE PUBLIC SITE'S FEW PRIMITIVES.
 *
 * A section with a ground, an eyebrow, a heading, two buttons and a row of
 * stars. Deliberately small, and deliberately the product's own materials —
 * the same navy, the same gold, the same eyebrow — so that the page a
 * visitor reads and the workspace they sign into are recognisably one thing.
 */

export const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

const GROUNDS = {
  page: 'bg-ink-50',
  white: 'bg-white',
  cream: 'bg-brand-50',
  navy: 'on-navy bg-ink-950 text-ink-100',
} as const;

export type Ground = keyof typeof GROUNDS;

export function Section({
  id,
  ground = 'page',
  labelledBy,
  className,
  children,
}: {
  id?: string;
  ground?: Ground;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={clsx('scroll-mt-16 py-16 sm:py-20 lg:py-28', GROUNDS[ground], className)}
    >
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}

export function Eyebrow({
  children,
  tone = 'gold',
  className,
}: {
  children: ReactNode;
  tone?: 'gold' | 'dark' | 'quiet';
  className?: string;
}) {
  return (
    <p
      className={clsx(
        'text-[11px] font-semibold tracking-[0.18em] uppercase',
        tone === 'gold' && 'text-brand-700',
        tone === 'dark' && 'text-brand-400',
        tone === 'quiet' && 'text-ink-500',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Heading({
  id,
  eyebrow,
  title,
  lead,
  tone = 'light',
  align = 'left',
  className,
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  tone?: 'light' | 'dark';
  align?: 'left' | 'center';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div className={clsx('hw-rise max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? <Eyebrow tone={dark ? 'dark' : 'gold'}>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className={clsx(
          'mt-3 text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance sm:text-[38px] lg:text-[44px]',
          dark ? 'text-white' : 'text-ink-900',
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={clsx(
            'mt-5 text-[17px] leading-relaxed text-pretty sm:text-[19px]',
            dark ? 'text-ink-300' : 'text-ink-600',
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

const BUTTON = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-[15px] font-semibold transition-colors';

const BUTTONS = {
  // brand-700, not brand-500: white on Headway gold passes only at this
  // shade, and it is still unmistakably gold. The same rule the product's
  // one gold button follows.
  primary: 'bg-brand-700 text-white hover:bg-brand-900',
  secondary: 'border border-ink-300 bg-white text-ink-900 hover:border-ink-900',
  'secondary-dark': 'border border-ink-300/60 bg-transparent text-white hover:border-white hover:bg-white/5',
} as const;

/**
 * A call to action. An anchor for a place on this page; a link for a route.
 * Routes are never prefetched — sign-in and sign-up are dynamic pages that
 * check a session, and a visitor hovering a button is not a reason to run one.
 */
export function Cta({
  href,
  variant = 'primary',
  children,
  className,
}: {
  href: string;
  variant?: keyof typeof BUTTONS;
  children: ReactNode;
  className?: string;
}) {
  const cls = clsx(BUTTON, BUTTONS[variant], className);
  if (href.startsWith('#')) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={false} className={cls}>
      {children}
    </Link>
  );
}

/** A rating, drawn the way the product draws one under a quotation. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={clsx('text-warn-600', className)} aria-label={`${value} out of 5`}>
      {'★'.repeat(value)}
      <span className="text-ink-300" aria-hidden>
        {'☆'.repeat(5 - value)}
      </span>
    </span>
  );
}

const CHIPS = {
  needs: 'bg-ink-900 text-white',
  watch: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 ring-inset',
  keep: 'bg-good-50 text-good-700 ring-1 ring-good-200 ring-inset',
  early: 'bg-ink-100 text-ink-600',
} as const;

/** The product's own group chip: Needs you, Watching, Protect, Not yet clear. */
export function Chip({ tone, children }: { tone: keyof typeof CHIPS; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase',
        CHIPS[tone],
      )}
    >
      {children}
    </span>
  );
}

/** The eyebrow the product uses inside a card: small, spaced, secondary. */
export const CARD_EYEBROW = 'text-[11px] font-medium tracking-widest text-ink-500 uppercase';
