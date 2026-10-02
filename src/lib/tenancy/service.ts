import type { PrismaClient } from '@prisma/client';
import { isIdentityConflict, isMissingDbFunction, withRlsContext } from '@/lib/db';

/**
 * TENANT RESOLUTION (M20).
 *
 * One rule, and everything else follows from it:
 *
 *   A client id that arrived from a browser is a REQUEST, never a PERMISSION.
 *
 * A URL, a form field and a hidden input can all say `clientId=abc`. None of
 * them is evidence of anything. The only evidence is a Membership row joining
 * the authenticated person to that business, and the only authenticated person
 * is the one Supabase Auth verified. So the chain runs one way and one way
 * only:
 *
 *   Supabase session -> auth user id -> User.authProviderId -> Membership -> Client
 *
 * Everything in this module is a pure function of an Actor, which is loaded
 * once per request. That keeps the decision in one place, makes every branch
 * testable without a browser or an identity provider, and means a new server
 * action cannot accidentally invent its own weaker rule.
 */

export const ROLE_OWNER = 'BUSINESS_OWNER';
export const ROLE_STAFF = 'BUSINESS_STAFF';

export type Role = typeof ROLE_OWNER | typeof ROLE_STAFF;

export const ACTIVE = 'ACTIVE';

export type ActorMembership = {
  clientId: string;
  role: string;
  status: string;
};

/**
 * "That email is already somebody else's account."
 *
 * Thrown by `provisionUser` instead of letting a raw Postgres unique
 * violation escape — see `isIdentityConflict` in `@/lib/db` for the two
 * distinct situations this covers. Every caller catches it and answers with
 * whatever generic failure message it already gives for other refusals: the
 * point is that this never becomes a distinct "that email already has an
 * account" message anywhere, which would tell a stranger something RepOS
 * otherwise never discloses.
 */
export class IdentityConflictError extends Error {
  constructor(message = 'That email belongs to a different account.') {
    super(message);
    this.name = 'IdentityConflictError';
  }
}

/** Everything a request may know about who is asking. Loaded once, then read. */
export type Actor = {
  userId: string;
  email: string;
  /** RepOS staff. Never settable by a signup, an invitation or a form. */
  isPlatformAdmin: boolean;
  status: string;
  memberships: ActorMembership[];
  /**
   * Set when this request signed in with a business's TEMPORARY login (M52)
   * rather than a login of the person's own: the business it opens.
   */
  temporaryAccessClientId?: string | null;
  /**
   * The business whose temporary access this person is signed in with while
   * its owner has no login of their own yet. Sign-in sends them straight to
   * that business's Account page, where setup lives.
   */
  setupPendingClientId?: string | null;
};

/**
 * The person behind a verified Supabase identity, or nothing.
 *
 * Nothing means: no such user, or a suspended one. A suspended account keeps
 * its rows and its history — it simply stops being an actor.
 *
 * `authEmail` is the address Supabase itself says this session's identity
 * has. Every caller that has it passes it: a temporary login is only itself
 * while it still carries the Headway-made address it was issued under.
 */
export async function loadActor(
  db: PrismaClient,
  authProviderId: string | null | undefined,
  authEmail?: string | null,
): Promise<Actor | null> {
  const id = (authProviderId ?? '').trim();
  if (id.length === 0) return null;

  // The person's OWN login — everyone's, the owner's included once set up.
  const own = await db.user.findUnique({ where: { authProviderId: id }, select: ACTOR_SELECT });
  if (own) return own.status === ACTIVE ? toActor(own, null) : null;

  // A TEMPORARY LOGIN (M52): a second Supabase identity that signs in as its
  // business's owner User — and only while an admin has it switched on.
  // Switched off it is nobody, on every page and action, the moment the row
  // says so (Supabase also has its password scrambled and its sessions ended,
  // but that is a second system). The owner's own login above is never
  // affected by any of this.
  const temporary = await db.accountAccess.findUnique({
    where: { tempAuthId: id },
    select: { clientId: true, status: true, loginId: true, user: { select: ACTOR_SELECT } },
  });
  if (!temporary || temporary.status !== 'TEMPORARY_ACTIVE') return null;
  if (temporary.user.status !== ACTIVE) return null;
  // Its address moved (a holder can ask Supabase for that with nothing but a
  // session): it is no longer the login Headway handed over, and a password
  // reset to wherever it went must not open the business.
  if (authEmail !== undefined && (authEmail ?? '').trim().toLowerCase() !== temporary.loginId.toLowerCase()) {
    return null;
  }
  // It opens ONE business, and never with staff authority: whoever holds the
  // handover sheet inherits neither. An owner User who is platform staff or
  // belongs anywhere else is not reachable through it at all — the same line
  // `app.user_id_for_auth` holds in the database.
  if (temporary.user.isPlatformAdmin) return null;
  if (temporary.user.memberships.some((m) => m.clientId !== temporary.clientId)) return null;
  return toActor(temporary.user, temporary.clientId);
}

const ACTOR_SELECT = {
  id: true,
  email: true,
  isPlatformAdmin: true,
  status: true,
  authProviderId: true,
  memberships: { select: { clientId: true, role: true, status: true } },
} as const;

function toActor(
  user: {
    id: string;
    email: string;
    isPlatformAdmin: boolean;
    status: string;
    authProviderId: string | null;
    memberships: ActorMembership[];
  },
  temporaryClientId: string | null,
): Actor {
  return {
    userId: user.id,
    email: user.email,
    isPlatformAdmin: user.isPlatformAdmin,
    status: user.status,
    memberships: user.memberships,
    temporaryAccessClientId: temporaryClientId,
    // Signed in with temporary access to a business whose owner has no login
    // of their own yet: sign-in goes straight to setup.
    setupPendingClientId: temporaryClientId && user.authProviderId === null ? temporaryClientId : null,
  };
}

/** Only memberships that currently grant anything. */
function activeMemberships(actor: Actor): ActorMembership[] {
  return actor.memberships.filter((m) => m.status === ACTIVE);
}

/** The businesses this actor may open at all. */
export function accessibleClientIds(actor: Actor): string[] {
  return activeMemberships(actor).map((m) => m.clientId);
}

/**
 * This actor's role at one business, or null.
 *
 * Null for a platform admin too: an admin has no role AT a business, they have
 * authority OVER all of them. Callers that care about the difference ask
 * `isPlatformAdmin` rather than reading a role that was never really there.
 */
export function roleFor(actor: Actor, clientId: string): Role | null {
  const membership = activeMemberships(actor).find((m) => m.clientId === clientId);
  if (!membership) return null;
  return membership.role === ROLE_OWNER ? ROLE_OWNER : ROLE_STAFF;
}

/** May this actor see this business at all? */
export function canRead(actor: Actor, clientId: string): boolean {
  if (actor.isPlatformAdmin) return true;
  return roleFor(actor, clientId) !== null;
}

/**
 * May this actor change the business itself — its details, its team, its
 * settings? Owners and platform admins only; staff work inside a business
 * without being able to reshape it.
 */
export function canManage(actor: Actor, clientId: string): boolean {
  if (actor.isPlatformAdmin) return true;
  return roleFor(actor, clientId) === ROLE_OWNER;
}

/**
 * Links a verified Supabase identity to a RepOS user, creating one if needed.
 *
 * Called after Supabase has already authenticated someone, so the identity is
 * trusted; what is NOT trusted is anything the browser sent alongside it.
 * `isPlatformAdmin` is absent from both the create and the update on purpose:
 * signing up can never make anyone RepOS staff, and neither can signing in
 * again with a doctored payload. Promotion is an operator action and lives
 * nowhere near this function.
 */
export async function provisionUser(
  db: PrismaClient,
  identity: { providerId: string; email: string; name?: string | null },
  options: { now?: Date } = {},
): Promise<{ userId: string; created: boolean }> {
  const providerId = identity.providerId.trim();
  const email = identity.email.trim().toLowerCase();
  if (providerId.length === 0 || email.length === 0) {
    throw new Error('provisionUser needs a verified identity');
  }
  const now = options.now ?? new Date();
  const name = identity.name?.trim() || null;

  // Under the real runtime role this HAS to be the definer function, because
  // signing up is the one write that cannot satisfy the policy it is checked
  // against: `user_self_or_admin` compares the new row to `app.user_id`, and
  // the row being inserted is the thing that identity will eventually name.
  // The reads below are subject to the same policy, so they see nothing and
  // the insert is refused outright. See `app.provision_user`.
  try {
    const rows = await db.$queryRaw<{ user_id: string; was_created: boolean }[]>`
      SELECT * FROM app.provision_user(
        ${providerId}::text, ${email}::text, ${name}::text, ${now.toISOString()}::text)`;
    const row = rows[0];
    // The function either returns a row or raises. Nothing at all would mean a
    // signature that no longer matches this call, which is a deployment fault
    // rather than something to paper over with the direct path.
    if (!row) throw new Error('provision_user returned no identity');
    return { userId: row.user_id, created: row.was_created };
  } catch (error) {
    // `app.provision_user` can raise 23505 two ways: its own deliberate
    // refusal when this email is already bound to a different identity, and
    // the plain race of two concurrent calls for the same brand-new email
    // both passing its "not found" checks before one loses at the INSERT.
    // Either way the caller gets a named, catchable error instead of a raw
    // Prisma exception — see IdentityConflictError's own comment.
    if (isIdentityConflict(error)) throw new IdentityConflictError();
    if (!isMissingDbFunction(error)) throw error;
  }

  return provisionUserDirect(db, { providerId, email, name }, now);
}

/**
 * The same provisioning without the definer function.
 *
 * Only reachable where `rls.sql` has not been applied — the per-file schemas
 * the test suite creates, where the connection owns its own tables and RLS is
 * not in the way. It is deliberately identical in behaviour so the two paths
 * cannot drift into meaning different things.
 */
async function provisionUserDirect(
  db: PrismaClient,
  identity: { providerId: string; email: string; name: string | null },
  now: Date,
): Promise<{ userId: string; created: boolean }> {
  const { providerId, email } = identity;

  // A temporary login (M52) is a second identity for an existing owner User:
  // never a new User, and never its synthetic address over the owner's email.
  const temporary = await db.accountAccess.findUnique({
    where: { tempAuthId: providerId },
    select: { userId: true },
  });
  if (temporary) return { userId: temporary.userId, created: false };

  const existing = await db.user.findUnique({
    where: { authProviderId: providerId },
    select: { id: true },
  });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { email, lastSignInAt: now },
    });
    return { userId: existing.id, created: false };
  }

  // An invitation may have created the row before the account existed: the
  // address is known, the identity is not. Claim it rather than colliding on
  // the unique email and leaving the person unable to sign in.
  const byEmail = await db.user.findUnique({ where: { email }, select: { id: true, authProviderId: true } });
  if (byEmail && !byEmail.authProviderId) {
    await db.user.update({
      where: { id: byEmail.id },
      data: { authProviderId: providerId, lastSignInAt: now, emailVerifiedAt: now },
    });
    return { userId: byEmail.id, created: false };
  }

  const created = await db.user.create({
    data: {
      email,
      name: identity.name,
      authProviderId: providerId,
      emailVerifiedAt: now,
      lastSignInAt: now,
    },
    select: { id: true },
  });
  return { userId: created.id, created: true };
}

/**
 * Ends every session this person currently holds.
 *
 * `sessionVersion` is deliberately absent from the column grant `repos_app`
 * holds on `User`: it is a decision made ABOUT a user, not BY one, and a
 * column privilege is what stops a self-service update from reaching it. So the
 * bump goes through the definer function that already existed for exactly this,
 * and which checks the caller is either that person or a platform admin before
 * touching anything.
 *
 * The identity it checks against is the transaction's `app.user_id`, which is
 * why this runs inside `withRlsContext` rather than as a bare statement: a raw
 * query does not pass through the identity extension, so without the wrapper it
 * would arrive anonymous and be refused.
 */
export async function bumpSessionVersion(db: PrismaClient, userId: string): Promise<void> {
  try {
    await withRlsContext(db, async (tx) => {
      // $executeRaw, not $queryRaw: the function returns void, and Prisma
      // cannot deserialise a void column into a row.
      await tx.$executeRaw`SELECT app.bump_session_version(${userId}::text)`;
    });
    return;
  } catch (error) {
    if (!isMissingDbFunction(error)) throw error;
  }

  await db.user.updateMany({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

/** Anything that can issue a raw statement: the client, or a transaction of it. */
type RawCapable = Pick<PrismaClient, '$queryRaw' | '$executeRaw'>;

/**
 * Creates a business, and the ownership that makes it somebody's.
 *
 * The one write in RepOS that no policy can admit on its own: `client_write`
 * asks whether the caller already owns the row, and for a business being
 * created that ownership does not exist yet — it is created BY this. So it goes
 * through `app.create_client`, which takes no owner parameter at all. Whoever
 * the transaction's `app.user_id` says is asking is who ends up owning it, and
 * that value comes from a verified Supabase session and from nowhere else.
 *
 * Everything else about the business is an ordinary write on the far side of
 * this call, because by then the row exists and the caller owns it.
 *
 * Must be called inside `withRlsContext` — the function reads the identity from
 * the transaction, and a raw statement outside one carries none.
 */
export async function createClientRow(
  tx: RawCapable,
  input: {
    businessName: string;
    vertical: string;
    /** True for self-service signup; false is the operator's list, admins only. */
    asOwner: boolean;
    /** Honoured only when `asOwner` is false. An owner cannot pick either. */
    status?: string | null;
    plan?: string | null;
  },
  now: Date,
): Promise<string> {
  const rows = await tx.$queryRaw<{ create_client: string | null }[]>`
    SELECT app.create_client(
      ${input.businessName}::text,
      ${input.vertical}::text,
      ${input.asOwner}::boolean,
      ${input.status ?? null}::text,
      ${input.plan ?? null}::text,
      ${now.toISOString()}::text
    ) AS create_client`;

  const id = rows[0]?.create_client;
  if (!id) throw new Error('create_client returned no business');
  return id;
}

/**
 * Sets the two columns that belong to the platform rather than to the customer.
 *
 * `plan` is what a business is billed for and `status` is the operator's own
 * sales pipeline, so `repos_app` holds no column privilege on either — which is
 * correct, and which broke every admin flow that writes them. The capability
 * lives in `app.set_client_commercials` instead, where it can be gated on being
 * platform staff rather than on being somebody's business owner.
 *
 * A null argument leaves that column alone, so archiving can move `status`
 * without having an opinion about `plan`.
 *
 * Must be called inside `withRlsContext`: the function reads the caller's
 * identity from the transaction to decide whether they are an administrator.
 */
export async function setClientCommercials(
  tx: RawCapable,
  clientId: string,
  status: string | null,
  plan: string | null,
  now: Date,
): Promise<void> {
  // $executeRaw, not $queryRaw: the function returns void, and Prisma cannot
  // deserialise a void column into a row.
  await tx.$executeRaw`
    SELECT app.set_client_commercials(
      ${clientId}::text, ${status}::text, ${plan}::text, ${now.toISOString()}::text
    )`;
}
