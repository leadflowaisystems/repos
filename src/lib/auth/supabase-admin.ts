import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL_VAR } from '@/lib/auth/supabase';

/**
 * THE ONE FILE THAT HOLDS THE SERVICE-ROLE KEY (M39).
 *
 * Every other identity operation in RepOS goes through the anon-key client in
 * `@/lib/auth/supabase.ts`, which can only ever act as whoever the request's
 * own session belongs to. That is not enough for exactly one operation: the
 * pilot's temporary-credential flow needs to create a Supabase identity that
 * is USABLE IMMEDIATELY, with no confirmation email, because the address it
 * is issued under is synthetic and nobody can click a link sent to it. Only
 * the Auth admin API can pre-confirm an identity at creation time, and only
 * the service-role key can call it.
 *
 * SO THIS KEY NEVER TOUCHES POSTGRES. Every call in this file goes through
 * `supabase.auth.admin.*` — the identity provider's own admin surface, not a
 * database connection. It cannot read or write a single application row and
 * has no relationship to Row Level Security at all; RepOS's tenant isolation
 * is exactly as strong with this file present as without it.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is read only here, only on the server, and only
 * for the three narrow operations below. The compliance suite already
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

/**
 * Mints a new Supabase Auth identity, already confirmed.
 *
 * `email_confirm: true` is the whole reason this file exists: without it, a
 * synthetic address that can receive no mail would leave the identity
 * permanently unconfirmed, and password sign-in refuses an unconfirmed
 * account on this project. The email is never a real person's address — see
 * `src/lib/account-access/service.ts` for how it is generated.
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
    throw new Error(error?.message ?? 'Could not create the temporary identity.');
  }
  return { authUserId: data.user.id };
}

/**
 * Overwrites an identity's password with a fresh, discarded random value.
 *
 * Used only when an admin disables temporary access BEFORE the owner has
 * replaced it with their own — at that point the temporary password is
 * still the only credential that works, and flipping `AccountAccess.status`
 * alone would not stop it authenticating through the ordinary login page.
 * The generated value is never returned to any caller; nobody needs it, and
 * nobody sees it. After setup is complete this call is unnecessary: the
 * owner already overwrote the temporary password themselves.
 */
export async function randomizeIdentityPassword(authUserId: string): Promise<void> {
  const supabase = adminClient();
  const random = crypto.randomUUID() + crypto.randomUUID();
  const { error } = await supabase.auth.admin.updateUserById(authUserId, { password: random });
  if (error) throw new Error(error.message);
}

/**
 * Finishing setup: the owner's own password, and their own login email when
 * they gave one, on the SAME identity `createTempIdentity` minted.
 *
 * The anon-key `supabase.auth.updateUser({ email })` a signed-in session can
 * call itself was deliberately not used for the email half: this project
 * requires confirming an email change before it takes effect, which would
 * leave the owner's newly-typed address pending a link on an inbox nobody
 * checks mid-handover — the same reliability problem the temporary identity
 * exists to route around in the first place. `email_confirm: true` is safe
 * here for the same reason it is on `createTempIdentity`: this identity is
 * already bound, by the AccountAccess row that gated this call, to the one
 * Membership the person completing the form has been signed in as all
 * along — there is no other claimant's ownership this is bypassing.
 *
 * Returns a message rather than throwing on failure: the one expected case
 * (the address is already some other Supabase identity's) is a normal form
 * rejection, not a server error.
 */
export async function setPermanentCredentials(
  authUserId: string,
  password: string,
  email?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = adminClient();
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password,
    ...(email ? { email, email_confirm: true } : {}),
  });
  if (error) {
    // Never swallowed: this is the ONE signal that says why a real Supabase
    // rejection happened (an email already claimed elsewhere, a password
    // policy this project enforces server-side that RepOS's own zod schema
    // does not know about, and so on). Message/code/status only — never the
    // key, never the password, never anything this call was asked to set.
    console.error('setPermanentCredentials: Supabase Auth admin update failed', {
      authUserId,
      hadEmail: Boolean(email),
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

/**
 * Best-effort cleanup for a temporary identity that was created but whose
 * accompanying User/Membership/AccountAccess rows then failed to write.
 * Deliberately swallows its own failure: the caller is already on an error
 * path reporting a different problem to the admin, and an orphaned,
 * unreferenced Supabase identity that nothing in RepOS ever reads is a much
 * smaller issue than masking the real failure with a cleanup failure.
 */
export async function deleteIdentity(authUserId: string): Promise<void> {
  try {
    const supabase = adminClient();
    await supabase.auth.admin.deleteUser(authUserId);
  } catch {
    // Best-effort only — see the comment above.
  }
}
