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
 *
 * The word is passed in by the workspace, which knows the owner's language,
 * and left to its English default by the operator console, which is not
 * localized by design (M38). A server component, so it cannot read the
 * provider itself; a prop is the honest shape.
 */
const STYLES = {
  nav: 'w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900',
  inline:
    'inline-flex min-h-11 items-center rounded-lg px-2.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900',
} as const;

export function SignOutButton({
  variant = 'nav',
  label = 'Sign out',
}: {
  variant?: keyof typeof STYLES;
  /** The word on the button, in the reader's language. */
  label?: string;
}) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={STYLES[variant]}>
        {label}
      </button>
    </form>
  );
}
