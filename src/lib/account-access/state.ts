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
 * A generated temporary password (`Kq7m-x3pa-9fne-t2wd`) is refused as anyone's
 * own password — choosing one after a reset link, or changing one — because it
 * is printed on a handover sheet that the admin and whoever carried the sheet
 * have seen.
 */
export const TEMPORARY_PASSWORD_REFUSED = 'Choose your own password, not the temporary one from Headway.';

/**
 * The sixteen characters a generated temporary password is made of, separators
 * aside: the token alphabet (no i, l, o or 1 — `@/lib/tokens`, repeated here so
 * this file stays free of server-only imports).
 */
const TEMP_PASSWORD_BODY = /^[abcdefghjkmnpqrstuvwxyz023456789]{16}$/;

/**
 * A password that is, or is typed from, a handover sheet's temporary password:
 * the same sixteen characters with or without its hyphens, with spaces, in any
 * case. Anything with a character the generator never uses (i, l, o, 1, a
 * symbol) or another length is somebody's own.
 */
export function looksLikeTemporaryPassword(password: string): boolean {
  return TEMP_PASSWORD_BODY.test(password.replace(/[\s-]/g, '').toLowerCase());
}

/** Whether the temporary login signs in right now. */
export function temporaryStatusOf(
  row: { status: string; tempAuthId: string | null } | null | undefined,
): TemporaryStatus {
  if (!row) return 'NONE';
  return row.status === 'TEMPORARY_ACTIVE' && row.tempAuthId ? 'ACTIVE' : 'DISABLED';
}
