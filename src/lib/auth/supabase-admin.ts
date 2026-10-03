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
 * in the handover — the link with which the owner proves their address and
 * chooses their password — is an ordinary password-reset email, asked for
 * from Account, never from here: an admin "confirm" would trust an address
 * nobody has proved they can read.
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
 *
 * `options.email` also puts the identity back on that address, confirmed, in
 * the same call. For a TEMPORARY login: whoever held it could have moved its
 * address to an inbox of their own straight through Supabase (an email
 * change needs only a session), and a password reset to that inbox would let
 * them back in. Every time temporary access is switched on or off, the
 * address goes back to the Headway-made one with the password.
 */
export async function setIdentityPassword(
  authUserId: string,
  password: string,
  options: { email?: string } = {},
): Promise<SetPasswordResult> {
  const config = adminConfig();
  if (!config.ok) {
    console.error('setIdentityPassword: admin API not configured', { reason: config.reason });
    return { ok: false, reason: 'NOT_CONFIGURED', message: config.reason };
  }
  const supabase = adminClient();
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password,
    ...(options.email ? { email: options.email, email_confirm: true } : {}),
  });
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
export async function randomizeIdentityPassword(authUserId: string, email?: string): Promise<void> {
  const result = await setIdentityPassword(authUserId, unguessablePassword(), email ? { email } : {});
  if (result.ok || result.reason === 'NOT_FOUND') return;
  throw new Error(result.message);
}

/** What Supabase itself currently says about one identity. Never a secret. */
export type IdentitySnapshot = {
  email: string;
  /** The owner opened the confirmation link: this login can sign in. */
  confirmed: boolean;
  /**
   * A confirmation link has gone out for this login and not been replaced
   * since. Supabase records it only once the email is actually sent (a new
   * password clears it, along with the old link).
   */
  confirmationSent: boolean;
  /** A password-reset link has gone out to this login (how an owner proves their address since M53). */
  recoverySent: boolean;
  lastSignInAt: string | null;
};

/** Supabase says this identity does not exist (deleted, or never made). */
export const IDENTITY_MISSING = 'missing' as const;

/**
 * The live email of one identity and whether it is confirmed — read from
 * Supabase, the only place that knows, so the admin panel and Account can
 * never disagree with what actually signs in.
 *
 * Three answers, kept apart on purpose: the snapshot; `IDENTITY_MISSING` when
 * Supabase says there is no such identity; and null when Supabase could not
 * be asked (not configured, or the read failed) — which says nothing either
 * way, so no caller may treat it as "confirmed" or as "gone".
 */
export async function getIdentitySnapshot(
  authUserId: string,
): Promise<IdentitySnapshot | typeof IDENTITY_MISSING | null> {
  if (!adminConfig().ok) return null;
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.getUserById(authUserId);
    if (error) {
      if (isNotFound(error)) return IDENTITY_MISSING;
      console.error('getIdentitySnapshot: Supabase Auth admin read failed', {
        code: error.code,
        status: error.status,
        message: error.message,
      });
      return null;
    }
    if (!data.user) return IDENTITY_MISSING;
    return {
      email: (data.user.email ?? '').toLowerCase(),
      confirmed: Boolean(data.user.email_confirmed_at),
      confirmationSent: Boolean(data.user.confirmation_sent_at),
      recoverySent: Boolean(data.user.recovery_sent_at),
      lastSignInAt: data.user.last_sign_in_at ?? null,
    };
  } catch (error) {
    console.error('getIdentitySnapshot: Supabase Auth admin read threw', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export type OwnerIdentityFailure = 'EMAIL_TAKEN' | 'EMAIL_REFUSED' | 'NOT_CONFIGURED' | 'UNKNOWN';

export type OwnerIdentityResult =
  | { ok: true; authUserId: string }
  | { ok: false; reason: OwnerIdentityFailure; message: string };

/**
 * THE OWNER'S OWN LOGIN, MADE BY HEADWAY (M53): a new Supabase identity on the
 * address Headway recorded for the owner — NOT confirmed, and with no
 * password anybody knows (none is passed, so Supabase makes a long random one
 * itself). Nothing can sign in with it. It starts working only when the owner
 * opens a link Supabase emails to that address and chooses a password there:
 * whoever holds the temporary login can ask for that link, but it only ever
 * goes to this address, so only the person who reads that inbox can finish it.
 * This call itself sends no email.
 *
 * The admin API refuses an address ANY identity already holds, confirmed or
 * not, so the identity returned is always a brand-new one, never somebody
 * else's. `id`, when given, is the id it is made with: a caller that never
 * hears back can then look it up rather than leave it unaccounted for.
 */
export async function createPendingOwnerIdentity(email: string, id?: string): Promise<OwnerIdentityResult> {
  const config = adminConfig();
  if (!config.ok) return { ok: false, reason: 'NOT_CONFIGURED', message: config.reason };
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      ...(id ? { id } : {}),
      email,
      email_confirm: false,
      // Says, in Supabase itself, what this login is: should a failure ever
      // leave one behind, it can be found and told apart from a person's own.
      app_metadata: { headway_pending_owner: true },
    });
    if (!error && data.user) return { ok: true, authUserId: data.user.id };
    console.error('createPendingOwnerIdentity: Supabase Auth admin create failed', {
      code: error?.code,
      status: error?.status,
      message: error?.message,
    });
    const message = error?.message ?? 'Could not create the login.';
    if (error?.code === 'email_exists' || /already been registered|already registered/i.test(message)) {
      return { ok: false, reason: 'EMAIL_TAKEN', message };
    }
    if (error?.code === 'email_address_invalid' || error?.code === 'validation_failed') {
      return { ok: false, reason: 'EMAIL_REFUSED', message };
    }
    return { ok: false, reason: 'UNKNOWN', message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('createPendingOwnerIdentity: Supabase Auth admin create threw', { message });
    return { ok: false, reason: 'UNKNOWN', message };
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
  // Once more on a failure: a blip here would otherwise leave an identity
  // holding an address (and a password) that nothing in RepOS points at.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const supabase = adminClient();
      const { error } = await supabase.auth.admin.deleteUser(authUserId);
      if (!error || isNotFound(error)) return;
      console.error('deleteIdentity: orphaned identity could not be removed', {
        authUserId,
        attempt,
        code: error.code,
        message: error.message,
      });
    } catch (error) {
      console.error('deleteIdentity: orphaned identity could not be removed', {
        authUserId,
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
