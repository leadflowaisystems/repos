/**
 * WHAT TEMPORARY ACCESS MEANS TODAY (M52).
 *
 * Two separate Supabase logins can open a business's owner account:
 *
 *   the TEMPORARY login  `…@access.headway.local` + a generated password,
 *                        `AccountAccess.tempAuthId`; an admin switches it on
 *                        and off at any time
 *   the owner's OWN login their real email + their own password,
 *                        `User.authProviderId`; made at setup, never touched
 *                        by switching temporary access on or off
 *
 * Pure: no database, no Supabase — so pages, services and the tenancy layer
 * can all use it without importing the Auth admin module.
 */

export type TemporaryStatus = 'NONE' | 'ACTIVE' | 'DISABLED';

/** Never a real address — the synthetic domain makes that visible on sight. */
export const TEMP_EMAIL_DOMAIN = 'access.headway.local';

/** Is this one of the temporary addresses Headway generates? */
export function isTemporaryEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${TEMP_EMAIL_DOMAIN}`);
}

/**
 * The shape of a generated temporary password (`Kq7m-x3pa-9fne-t2wd`). Setup
 * refuses it as the owner's own password: the admin has seen it.
 */
export const TEMP_PASSWORD_SHAPE = /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/;

/** Whether the temporary login signs in right now. */
export function temporaryStatusOf(
  row: { status: string; tempAuthId: string | null } | null | undefined,
): TemporaryStatus {
  if (!row) return 'NONE';
  return row.status === 'TEMPORARY_ACTIVE' && row.tempAuthId ? 'ACTIVE' : 'DISABLED';
}
