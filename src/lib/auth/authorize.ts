import type { PrismaClient } from '@prisma/client';
import {
  canManage,
  canRead,
  loadActor,
  roleFor,
  type Actor,
  type Role,
} from '@/lib/tenancy/service';
import { cache } from 'react';
import { currentAuthUserId } from '@/lib/db';

/**
 * AUTHORIZATION PRIMITIVES (M20).
 *
 * Five checks, one shape, one refusal. Every protected server action goes
 * through one of these rather than writing its own rule, because forty-four
 * hand-written rules is forty-four chances to forget one.
 *
 * ONE REFUSAL, deliberately. A caller is told DENIED whether the business does
 * not exist, exists and is not theirs, or is theirs but needs a role they do
 * not have. Distinguishing those would let anyone enumerate RepOS's customer
 * list by trying ids and reading the error, so they are the same answer here
 * and the same message on screen.
 */

export type Denial = { ok: false; reason: 'UNAUTHENTICATED' | 'DENIED' };
export type Granted<T> = { ok: true } & T;
export type Authz<T> = Granted<T> | Denial;

/** What every refusal says out loud. Never mentions what was asked for. */
export const DENIED_MESSAGE = 'You do not have access to that.';
export const SIGN_IN_MESSAGE = 'Please sign in.';

const UNAUTHENTICATED: Denial = { ok: false, reason: 'UNAUTHENTICATED' };
const DENIED: Denial = { ok: false, reason: 'DENIED' };

// ---------------------------------------------------------------------------
// The primitives. Pure functions of an Actor, so every branch is testable
// without a browser, a cookie or an identity provider.
// ---------------------------------------------------------------------------

export function requireAuthenticatedUser(actor: Actor | null): Authz<{ actor: Actor }> {
  if (!actor) return UNAUTHENTICATED;
  return { ok: true, actor };
}

export function requirePlatformAdmin(actor: Actor | null): Authz<{ actor: Actor }> {
  if (!actor) return UNAUTHENTICATED;
  if (!actor.isPlatformAdmin) return DENIED;
  return { ok: true, actor };
}

/**
 * The default gate for anything belonging to one business: the actor must be
 * able to see it. Read access, in other words — staff included.
 */
export function requireTenantMembership(
  actor: Actor | null,
  clientId: string,
): Authz<{ actor: Actor; clientId: string; role: Role | null }> {
  if (!actor) return UNAUTHENTICATED;
  if (typeof clientId !== 'string' || clientId.trim().length === 0) return DENIED;
  if (!canRead(actor, clientId)) return DENIED;
  return { ok: true, actor, clientId, role: roleFor(actor, clientId) };
}

/** Reshaping the business: its details, its team, its settings. */
export function requireTenantOwner(
  actor: Actor | null,
  clientId: string,
): Authz<{ actor: Actor; clientId: string; role: Role | null }> {
  if (!actor) return UNAUTHENTICATED;
  if (typeof clientId !== 'string' || clientId.trim().length === 0) return DENIED;
  if (!canManage(actor, clientId)) return DENIED;
  return { ok: true, actor, clientId, role: roleFor(actor, clientId) };
}

/**
 * Day-to-day work inside a business. The same test as membership today, named
 * separately because the two answer different questions and will diverge the
 * first time a role sits between staff and owner.
 */
export function requireTenantStaffOrOwner(
  actor: Actor | null,
  clientId: string,
): Authz<{ actor: Actor; clientId: string; role: Role | null }> {
  return requireTenantMembership(actor, clientId);
}

// ---------------------------------------------------------------------------
// Request-bound wrappers. The only place the Supabase session is read.
// ---------------------------------------------------------------------------

/**
 * The actor behind the current request, or null.
 *
 * `getUser()` rather than `getSession()` on purpose: getSession trusts the
 * cookie as it stands, while getUser re-verifies it with the auth server. A
 * forged or stale cookie must not be able to name a user. That verification is
 * a network call to Supabase, measured at 50-110 ms, and it used to happen
 * here on top of the one `db.ts` already makes for the RLS context -- so a
 * page paid for the same answer twice.
 *
 * `currentAuthUserId` is the same call, memoised per request by React's
 * `cache()`. Reusing it changes nothing about what is verified or how often a
 * revoked session is caught: within one request the cookie cannot change, and
 * the next request verifies again from scratch.
 */
export async function currentActor(db: PrismaClient): Promise<Actor | null> {
  const authProviderId = await currentAuthUserId();
  if (!authProviderId) return null;
  return actorFor(db, authProviderId);
}

/**
 * The actor row, read once per request.
 *
 * The (app) layout asks for it to decide whether this is an operator, and a
 * tenant gate asks again for the same request. Same user, same row, same
 * answer -- so it is fetched once. Request-scoped: another request, another
 * store, and nothing survives the response.
 */
const actorFor = cache(
  async (db: PrismaClient, authProviderId: string): Promise<Actor | null> =>
    loadActor(db, authProviderId),
);
