import type { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { ACTIVE, ROLE_OWNER, ROLE_STAFF } from '@/lib/tenancy/service';
import { withRlsContext } from '@/lib/db';

/**
 * TEAM MANAGEMENT (M20 Stage 3).
 *
 * A business is usually more than one person: the owner, and whoever actually
 * reads the feedback on a Tuesday. This is the smallest thing that supports
 * that honestly — see who is here, invite someone, take access away.
 *
 * Two rules the caller cannot opt out of, because they are enforced here
 * rather than in the form:
 *
 *   A business can never be left with nobody who can administer it. The last
 *   active owner cannot be removed or demoted, by anyone, including themselves.
 *
 *   Nothing in this module can grant platform admin. That privilege is not a
 *   membership, is not a role, and does not appear in any signature here.
 *
 * DELIVERY LIVES NEXT DOOR, in `@/lib/invite/email`. It used to live nowhere:
 * this module produced a token and a link and said, in a comment here, that
 * putting that link in front of the person was the operator's job "until the
 * Supabase project exists". It exists, so the invitation is emailed — through
 * Supabase Auth, the same mechanism the product already sends password resets
 * with, and never from this module, which stays pure enough to test against a
 * database and nothing else.
 *
 * Sending is not allowed to decide whether the invitation was created. An
 * invitation whose email bounced is still a valid invitation with a working
 * link, and the owner is told exactly that.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

/** Invitations expire; a link found in an old inbox should not still work. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TeamMember = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  /** True when removing or demoting this person would orphan the business. */
  isLastOwner: boolean;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  expired: boolean;
};

export type TeamView = { members: TeamMember[]; invites: PendingInvite[] };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Who is on this business's team, and who has been asked to join. */
export async function getTeam(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<TeamView> {
  const now = options.now ?? new Date();

  const memberships = await db.membership.findMany({
    where: { clientId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      user: { select: { email: true, name: true } },
    },
  });

  const activeOwners = memberships.filter(
    (m) => m.role === ROLE_OWNER && m.status === ACTIVE,
  ).length;

  const invites = await db.invitation.findMany({
    where: { clientId, acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, role: true, expiresAt: true },
  });

  return {
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      status: m.status,
      isLastOwner: m.role === ROLE_OWNER && m.status === ACTIVE && activeOwners === 1,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt,
      expired: i.expiresAt.getTime() < now.getTime(),
    })),
  };
}

/**
 * Invites someone to this business.
 *
 * Returns the token exactly once, because only its hash is stored. If the
 * caller loses it, the invitation has to be issued again — which is the point.
 */
export async function inviteMember(
  db: PrismaClient,
  clientId: string,
  input: { email: string; role: string; invitedById: string },
  options: { now?: Date } = {},
): Promise<ServiceResult<{ inviteId: string; token: string; email: string; role: string; expiresAt: Date }>> {
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email.includes('@') || email.length < 3) {
    return err('Some fields need attention.', { email: 'Add a valid email address.' });
  }
  // Only the two business roles exist here. Anything else — including a
  // browser inventing "REP_OS_ADMIN" — becomes staff.
  const role = input.role === ROLE_OWNER ? ROLE_OWNER : ROLE_STAFF;
  const now = options.now ?? new Date();

  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return err('That business no longer exists.');

  const already = await db.membership.findFirst({
    where: { clientId, user: { email }, status: ACTIVE },
    select: { id: true },
  });
  if (already) {
    return err('Some fields need attention.', { email: 'They are already on this team.' });
  }

  // One live invitation per address per business. Re-inviting replaces the
  // old one rather than leaving two working links behind.
  await db.invitation.updateMany({
    where: { clientId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  const invite = await db.invitation.create({
    data: {
      clientId,
      email,
      role,
      tokenHash: hashToken(token),
      expiresAt,
      invitedById: input.invitedById,
    },
    select: { id: true },
  });

  return { ok: true, data: { inviteId: invite.id, token, email, role, expiresAt } };
}

/**
 * Accepts an invitation on behalf of an authenticated person.
 *
 * The email on the invitation must be the email of the account accepting it,
 * so a leaked link is not a way into someone else's business.
 */
export async function acceptInvite(
  db: PrismaClient,
  token: string,
  userId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; role: string }>> {
  const now = options.now ?? new Date();
  const invite = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token ?? '') },
    select: {
      id: true,
      clientId: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  // One answer for a wrong, spent, revoked or expired token.
  const bad = err('That invitation is no longer valid.');
  if (!invite || invite.acceptedAt || invite.revokedAt) return bad;
  if (invite.expiresAt.getTime() < now.getTime()) return bad;

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) return bad;

  // See onboarding: a raw transaction client carries no identity of its own.
  await withRlsContext(db, async (tx) => {
    await tx.membership.upsert({
      where: { userId_clientId: { userId, clientId: invite.clientId } },
      create: { userId, clientId: invite.clientId, role: invite.role, status: ACTIVE },
      update: { role: invite.role, status: ACTIVE },
    });
    await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: now } });
  });

  return { ok: true, data: { clientId: invite.clientId, role: invite.role } };
}

/**
 * Accepting an invitation, through the one door Row Level Security leaves open.
 *
 * The policies make this impossible to do directly, and they are right to:
 * `invitation_read` asks whether the caller already belongs to the business,
 * and `membership_write` asks the same, while the entire purpose of accepting
 * is that they do not yet. An invitee could never read the invitation that
 * exists to admit them.
 *
 * `app.accept_invitation` resolves that in one place, under the owner's rights,
 * and refuses unless every condition this module already required is met -- the
 * token unknown, spent, revoked or expired, or addressed to a different email,
 * all answer the same way. It is handed the token's HASH, never the token.
 *
 * The direct path below it is not a weaker alternative; it is the same rules
 * expressed in TypeScript, and it only ever runs where RLS is not binding the
 * connection -- the test suite, and any install that has not applied the DDL.
 * Once the policies apply, it returns nothing and the function is the only way
 * through.
 */
export async function acceptInviteViaResolver(
  db: PrismaClient,
  token: string,
  userId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; role: string }>> {
  const now = options.now ?? new Date();
  try {
    const rows = await db.$queryRaw<{ client_id: string; member_role: string }[]>`
      SELECT * FROM app.accept_invitation(
        ${hashToken(token ?? '')}::text, ${userId}::text, ${now.toISOString()}::text)`;
    const accepted = rows[0];
    // One answer for a wrong, spent, revoked, expired or misaddressed token.
    if (!accepted) return err('That invitation is no longer valid.');
    return { ok: true, data: { clientId: accepted.client_id, role: accepted.member_role } };
  } catch (error) {
    // 42883 is "no such function" - the DDL is not applied here. Anything else
    // is a real failure and must not be reinterpreted as "try the other way".
    if (!String(error).includes('42883')) throw error;
    return acceptInvite(db, token, userId, options);
  }
}

export async function revokeInvite(
  db: PrismaClient,
  clientId: string,
  inviteId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ inviteId: string }>> {
  const now = options.now ?? new Date();
  // Scoped by clientId as well as id: an invitation belonging to another
  // business is not findable, let alone revocable.
  const result = await db.invitation.updateMany({
    where: { id: inviteId, clientId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });
  if (result.count === 0) return err('That invitation is no longer valid.');
  return { ok: true, data: { inviteId } };
}

/** Suspends or restores someone's access, or changes what they may do. */
export async function setMembership(
  db: PrismaClient,
  clientId: string,
  membershipId: string,
  changes: { role?: string; status?: string },
): Promise<ServiceResult<{ membershipId: string }>> {
  const membership = await db.membership.findFirst({
    where: { id: membershipId, clientId },
    select: { id: true, role: true, status: true },
  });
  if (!membership) return err('That team member is no longer here.');

  const role = changes.role === undefined ? membership.role : changes.role === ROLE_OWNER ? ROLE_OWNER : ROLE_STAFF;
  const status = changes.status === ACTIVE || changes.status === 'SUSPENDED' ? changes.status : membership.status;

  // The last active owner keeps their keys. A business with nobody who can
  // administer it cannot be repaired from inside the product.
  const losingOwner =
    membership.role === ROLE_OWNER &&
    membership.status === ACTIVE &&
    (role !== ROLE_OWNER || status !== ACTIVE);
  if (losingOwner) {
    const owners = await db.membership.count({
      where: { clientId, role: ROLE_OWNER, status: ACTIVE },
    });
    if (owners <= 1) {
      return err('This is the only owner. Make someone else an owner first.');
    }
  }

  await db.membership.update({ where: { id: membership.id }, data: { role, status } });
  return { ok: true, data: { membershipId: membership.id } };
}
