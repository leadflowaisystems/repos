import { signOutAction } from '@/lib/actions/account';

/**
 * Sign out. A form, not a link, because ending a session is a mutation and a
 * GET should never do one.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        Sign out
      </button>
    </form>
  );
}
