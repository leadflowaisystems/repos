import { signOutAction } from '@/lib/actions/account';

/**
 * Sign out. A form, not a link, because ending a session is a mutation and a
 * GET should never do one — a prefetch or a link-scanner would otherwise log
 * people out by looking at the page.
 *
 * The action itself calls Supabase Auth's `signOut`, so the session is
 * genuinely ended rather than navigated away from.
 *
 * Two shapes for the two places it appears: a full-width row in the operator's
 * sidebar, and a quiet inline control in the business workspace header.
 */
const STYLES = {
  nav: 'w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900',
  inline:
    'rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900',
} as const;

export function SignOutButton({ variant = 'nav' }: { variant?: keyof typeof STYLES }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={STYLES[variant]}>
        Sign out
      </button>
    </form>
  );
}
