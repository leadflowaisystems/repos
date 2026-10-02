/**
 * WHAT A TEMPORARY-ACCESS ROW MEANS TODAY (M52).
 *
 * One definition, used by the admin panel, the owner's Account page and
 * `loadActor`, so the three can never disagree about whether a login is still
 * temporary, set up, or switched off. Pure: no database, no Supabase — which
 * is also why it lives apart from the service, so the tenancy layer can use it
 * without importing the Auth admin module.
 */

export type AccessStatus = 'TEMPORARY_ACTIVE' | 'SETUP_COMPLETE' | 'DISABLED';

/** Never a real address — the synthetic domain makes that visible on sight. */
export const TEMP_EMAIL_DOMAIN = 'access.headway.local';

/** Is this one of the temporary addresses Headway generates? */
export function isTemporaryEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${TEMP_EMAIL_DOMAIN}`);
}

/**
 * The shape of a generated temporary password (`Kq7m-x3pa-9fne-t2wd`). Setup
 * refuses it as the owner's "new" password: Supabase would answer "same
 * password", change nothing, and the password the admin handed over would
 * stay live behind a row saying setup is complete.
 */
export const TEMP_PASSWORD_SHAPE = /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/;

/**
 * Set up = the owner chose their own password (`setupCompletedAt`), or the
 * login already signs in with an address the owner typed — an older version of
 * setup could move the email in Supabase and then fail to record it. Either
 * way the login is the owner's own, whatever else the row says: it is never
 * "temporary", and never "disabled" in a way that locks a real owner out.
 */
export function accessStatusOf(
  row: { status: string; setupCompletedAt: Date | null; loginId: string },
  signInEmail: string,
): AccessStatus {
  if (row.setupCompletedAt !== null || row.status === 'SETUP_COMPLETE') return 'SETUP_COMPLETE';
  if (signInEmail.trim().toLowerCase() !== row.loginId.trim().toLowerCase()) return 'SETUP_COMPLETE';
  if (row.status === 'DISABLED') return 'DISABLED';
  return 'TEMPORARY_ACTIVE';
}
