'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { tenantGate } from '@/lib/auth/guard';
import { currentActor } from '@/lib/auth/authorize';
import { inviteMember, revokeInvite, setMembership } from '@/lib/team/service';
import { acceptInviteViaResolver } from '@/lib/team/service';
import { deliverInvitation, invitationLink, roleLabel } from '@/lib/invite/email';
import { failure, str, success, type ActionState } from './shared';

/**
 * Team actions.
 *
 * All owner-level: staff work inside a business, they do not decide who else
 * gets in. The one exception is accepting an invitation, which is authorized
 * by the token and the matching email rather than by an existing membership —
 * the person is not on the team yet, which is the whole point.
 */

function revalidateTeam(clientId: string) {
  revalidatePath(`/workspace/${clientId}/team`);
  revalidatePath(`/clients/${clientId}`);
}

export async function inviteMemberAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await inviteMember(prisma, clientId, {
    email: str(form, 'email'),
    role: str(form, 'role'),
    invitedById: gate.actor.userId,
  });
  if (!result.ok) return failure(result.message, result.errors);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { businessName: true },
  });

  // The invitation exists either way. Sending is reported separately, and only
  // "sent" when the email provider actually accepted the message — an owner who
  // is told an email went out and then waits for a reply that never comes is
  // worse off than one who was told to send the link themselves.
  const delivery = await deliverInvitation({
    email: result.data.email,
    token: result.data.token,
    businessName: client?.businessName ?? 'your business',
    roleLabel: roleLabel(result.data.role),
    expiresAt: result.data.expiresAt,
  });

  // Shown once, because only the hash is stored. Absolute, so it can be pasted
  // into a message and work; the relative path this used to return could not.
  const link = (await invitationLink(result.data.token)) ?? `/invite/${result.data.token}`;

  revalidateTeam(clientId);
  return {
    ok: true,
    message: delivery.sent
      ? `Invitation email sent to ${result.data.email}.`
      : `Invitation created for ${result.data.email}, but no email was sent. ${delivery.reason}`,
    errors: {},
    data: { link, email: result.data.email, sent: delivery.sent ? 'yes' : 'no' },
  };
}

export async function revokeInviteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await revokeInvite(prisma, clientId, str(form, 'inviteId'));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateTeam(clientId);
  return success('That invitation no longer works.');
}

export async function setMembershipAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const role = str(form, 'role');
  const status = str(form, 'status');
  const result = await setMembership(prisma, clientId, str(form, 'membershipId'), {
    role: role || undefined,
    status: status || undefined,
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateTeam(clientId);
  return success('Updated.');
}

export async function acceptInviteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await currentActor(prisma);
  if (!actor) return failure('Please sign in to accept this invitation.');

  const result = await acceptInviteViaResolver(prisma, str(form, 'token'), actor.userId);
  if (!result.ok) return failure(result.message, result.errors);

  // Now that they are a member, the business is theirs to see — so name it.
  // Before accepting, this page cannot say which business invited them, and
  // deliberately does not: see the note on the invitation page about what an
  // unauthenticated lookup would tell anyone trying tokens.
  const client = await prisma.client.findUnique({
    where: { id: result.data.clientId },
    select: { businessName: true },
  });

  revalidateTeam(result.data.clientId);
  return {
    ok: true,
    message: client ? `You have joined ${client.businessName}.` : 'You have joined the team.',
    errors: {},
    data: { workspace: `/workspace/${result.data.clientId}` },
  };
}
