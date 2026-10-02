import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL_VAR } from '@/lib/auth/supabase';

/**
 * THE ONE FILE THAT HOLDS THE SERVICE-ROLE KEY (M39).
 *
 * Every other identity operation in RepOS goes through the anon-key client in
 * `@/lib/auth/supabase.ts`, which can only ever act as whoever the request's
 * own session belongs to. That is not enough for the handful of operations
 * here: the temporary-access flow needs to create a Supabase identity that is
 * USABLE IMMEDIATELY, with no confirmation email, because the address it is
 * issued under is synthetic and nobody can click a link sent to it. Only the
 * Auth admin API can pre-confirm an identity at creation time, and only the
 * service-role key can call it.
 *
 * SO THIS KEY NEVER TOUCHES POSTGRES. Every call in this file goes through
 * `supabase.auth.admin.*` — the identity provider's own admin surface, not a
 * database connection. It cannot read or write a single application row and
 * has no relationship to Row Level Security at all; RepOS's tenant isolation
 * is exactly as strong with this file present as without it.
 *
 * NOTHING HERE SENDS AN EMAIL. `createUser`, `updateUserById`, `getUserById`
 * and `deleteUser` never mail anyone, which is the point: handing over
 * temporary access costs the project's email allowance nothing. The one email
 * in the handover — confirming the owner's real address — is asked for by the
 * owner's own session, never from here, because an admin "confirm" would
 * trust an address nobody has proved they can read.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is read only here, only on the server, and only
 * for the narrow operations below. The compliance suite already
 * forbids `NEXT_PUBLIC_` anywhere and `process.env` inside any `'use client'`
 * file; nothing in this module is exported to, or importable from, a client
 * component.
 */

export const SUPABASE_SERVICE_ROLE_KEY_VAR = 'SUPABASE_SERVICE_ROLE_KEY';

function adminConfig(): { ok: true; url: string; key: string } | { ok: false; reason: string } {
  const url = (process.env[SUPABASE_URL_VAR] ?? '').trim();
  const key = (process.env[SUPABASE_SERVICE_ROLE_KEY_VAR] ?? '').trim();
  if (!url || !key) {
    return {
      ok: false,
      reason: `Set ${SUPABASE_URL_VAR} and ${SUPABASE_SERVICE_ROLE_KEY_VAR} to generate temporary credentials.`,
    };
  }
  return { ok: true, url, key };
}

/**
 * A fresh admin client per call rather than a cached singleton: this runs
 * rarely (generating or disabling one temporary credential), never in a hot
 * path, and a client held no longer than the call that needs it is one less
 * thing to reason about holding the most sensitive secret in the process.
 */
function adminClient() {
  const config = adminConfig();
  if (!config.ok) throw new Error(config.reason);
  return createClient(config.url, config.key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAccountAccessConfigured(): boolean {
  return adminConfig().ok;
}

/** "That identity is not there" — already deleted, or never existed. */
function isNotFound(error: { status?: number; code?: string; message: string }): boolean {
  return error.status === 404 || error.code === 'user_not_found' || /not.?found/i.test(error.message);
}

/**
 * A password nobody is ever given, that passes ANY password policy the
 * project could be configured with: upper and lower case, a digit and a
 * symbol are guaranteed by the prefix, and the random tail is 40 characters
 * of base64url. Supabase refuses a password that misses a configured
 * character class (GoTrue v2.197 checks it on admin writes too), and a
 * refusal here would leave a "disabled" login still holding its old password.
 */
function unguessablePassword(): string {
  return `Aa1-${randomBytes(30).toString('base64url')}`;
}

/**
 * Mints a new Supabase Auth identity, already confirmed.
 *
 * `email_confirm: true` is the whole reason this file exists: without it, a
 * synthetic address that can receive no mail would leave the identity
 * permanently unconfirmed, and password sign-in refuses an unconfirmed
 * account on this project. The email is never a real person's address — see
 * `src/lib/account-access/service.ts` for how it is generated. No email is
 * sent: the admin API never mails anyone.
 */
export async function createTempIdentity(
  email: string,
  password: string,
): Promise<{ authUserId: string }> {
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    // Message/code/status only — never the password this call was asked to set.
    console.error('createTempIdentity: Supabase Auth admin create failed', {
      code: error?.code,
      status: error?.status,
      message: error?.message,
    });
    throw new Error(error?.message ?? 'Could not create the temporary identity.');
  }
  return { authUserId: data.user.id };
}

export type PasswordFailure = 'WEAK_PASSWORD' | 'NOT_FOUND' | 'NOT_CONFIGURED' | 'UNKNOWN';

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; reason: PasswordFailure; message: string };

/**
 * Sets an identity's password through the admin API.
 *
 * Two things this does that the owner's own `updateUser` would not, and both
 * are why it is used where it is:
 *
 *   - it sends nothing — no "your password changed" notice to an address
 *     that, for a temporary login, cannot receive one;
 *   - Supabase ends EVERY session that identity holds (GoTrue's
 *     `UpdatePassword(tx, nil)`), so whoever was signed in with the old
 *     password — on any device — is signed out by the same call.
 *
 * Returns a classified refusal rather than throwing: a password the project's
 * policy rejects is a normal form error, not a server error.
 */
export async function setIdentityPassword(
  authUserId: string,
  password: string,
): Promise<SetPasswordResult> {
  const config = adminConfig();
  if (!config.ok) {
    console.error('setIdentityPassword: admin API not configured', { reason: config.reason });
    return { ok: false, reason: 'NOT_CONFIGURED', message: config.reason };
  }
  const supabase = adminClient();
  const { error } = await supabase.auth.admin.updateUserById(authUserId, { password });
  if (!error) return { ok: true };
  console.error('setIdentityPassword: Supabase Auth admin update failed', {
    authUserId,
    code: error.code,
    status: error.status,
    message: error.message,
  });
  if (isNotFound(error)) return { ok: false, reason: 'NOT_FOUND', message: error.message };
  if (error.code === 'weak_password' || /password/i.test(error.message)) {
    return { ok: false, reason: 'WEAK_PASSWORD', message: error.message };
  }
  return { ok: false, reason: 'UNKNOWN', message: error.message };
}

/**
 * Overwrites an identity's password with a fresh, discarded random value.
 *
 * Used when an admin disables temporary access BEFORE the owner has replaced
 * it. The generated value is never returned to any caller; nobody needs it,
 * and nobody sees it. Supabase also ends every session the identity holds
 * (see `setIdentityPassword`), so a browser that is already signed in with
 * the temporary password is signed out too, not just the next sign-in.
 *
 * An identity that is already gone counts as revoked: there is nothing left
 * that could sign in.
 */
export async function randomizeIdentityPassword(authUserId: string): Promise<void> {
  const result = await setIdentityPassword(authUserId, unguessablePassword());
  if (result.ok || result.reason === 'NOT_FOUND') return;
  throw new Error(result.message);
}

/** What Supabase itself currently says about one identity. Never a secret. */
export type IdentitySnapshot = {
  email: string;
  /**
   * An address the person asked to move to, with a live link waiting in its
   * inbox. Null once the link is gone (a password change drops it).
   */
  pendingEmail: string | null;
  lastSignInAt: string | null;
};

/**
 * The live sign-in email of one identity, and any change still waiting for
 * the owner to click the link — read from Supabase, which is the only place
 * that knows it, so the admin panel can never disagree with what actually
 * signs in. Null when the admin API is not configured or the read fails; the
 * caller falls back to RepOS's own record.
 */
export async function getIdentitySnapshot(authUserId: string): Promise<IdentitySnapshot | null> {
  if (!adminConfig().ok) return null;
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.getUserById(authUserId);
    if (error || !data.user) return null;
    return {
      email: (data.user.email ?? '').toLowerCase(),
      pendingEmail:
        data.user.new_email && data.user.email_change_sent_at ? data.user.new_email.toLowerCase() : null,
      lastSignInAt: data.user.last_sign_in_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Removes a Headway-generated identity for good, and SAYS whether it did.
 *
 * Used by exactly one caller: permanently deleting an archived business
 * (`purgeClient`). A temporary login that Headway minted for that business
 * and nobody ever claimed is the business's own data, and it has to stop
 * working before the business disappears — sign-in re-provisions a RepOS
 * user for any identity Supabase accepts, so a surviving one would open onto
 * a blank new account.
 *
 * Unlike `deleteIdentity` below, this reports failure rather than swallowing
 * it, because here the caller must NOT go on to delete anything when the
 * login could not be revoked. An identity that is already gone counts as
 * removed, so a retry after a half-finished attempt goes through.
 *
 * Never called for a person's own account: see `purgeClient` for the rule
 * that decides which identity, if any, this may be handed.
 */
export async function removeGeneratedIdentity(
  authUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = adminConfig();
  if (!config.ok) return { ok: false, message: config.reason };

  const supabase = adminClient();
  const { error } = await supabase.auth.admin.deleteUser(authUserId);
  if (!error) return { ok: true };
  if (isNotFound(error)) return { ok: true };
  console.error('removeGeneratedIdentity: Supabase Auth admin delete failed', {
    authUserId,
    code: error.code,
    status: error.status,
    message: error.message,
  });
  return { ok: false, message: error.message };
}

/**
 * Best-effort cleanup for a temporary identity that was created but whose
 * accompanying User/Membership/AccountAccess rows then failed to write.
 * Swallows its own failure — the caller is already on an error path
 * reporting a different problem to the admin — but logs it, so an orphaned
 * identity is at least findable.
 */
export async function deleteIdentity(authUserId: string): Promise<void> {
  try {
    const supabase = adminClient();
    const { error } = await supabase.auth.admin.deleteUser(authUserId);
    if (error && !isNotFound(error)) {
      console.error('deleteIdentity: orphaned temporary identity could not be removed', {
        authUserId,
        code: error.code,
        message: error.message,
      });
    }
  } catch (error) {
    console.error('deleteIdentity: orphaned temporary identity could not be removed', {
      authUserId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
