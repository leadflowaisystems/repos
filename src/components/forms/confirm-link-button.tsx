'use client';

import { useState, type ReactNode } from 'react';

/**
 * THE ONE BUTTON ON /auth/confirm (M53), pressed once.
 *
 * A plain HTML form that POSTs to the auth callback — it works with no script
 * at all. With script, the button turns itself off the moment the form goes,
 * so a second tap during a slow first answer cannot send the token again
 * (it would be spent already, and only say "expired").
 */

const BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink-900 px-4 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400';

export function ConfirmLinkButton({ label, children }: { label: string; children: ReactNode }) {
  const [sent, setSent] = useState(false);
  return (
    <form method="post" action="/auth/callback" className="mt-8" onSubmit={() => setSent(true)}>
      {children}
      <button type="submit" disabled={sent} aria-busy={sent} className={BUTTON}>
        {label}
      </button>
    </form>
  );
}
