'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { tenantGate } from '@/lib/auth/guard';
import { currentActor } from '@/lib/auth/authorize';
import { inviteMember, revokeInvite, setMembership } from '@/lib/team/service';
import { acceptInviteViaResolver } from '@/lib/team/service';
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

  revalidateTeam(clientId);
  // The link is returned to the person who created it, once. RepOS sends
  // nothing: delivery is the operator's job until an email provider exists,
  // and the token is not stored anywhere it could be read again.
  return success(
    `Invitation ready for ${result.data.email}. Send them this link: /invite/${result.data.token}`,
  );
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

  revalidateTeam(result.data.clientId);
  return success('You have joined the team.');
}
