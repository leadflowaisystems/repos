import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  InviteForm,
  MembershipControls,
  RevokeInviteButton,
} from '@/components/forms/team-forms';
import { PageIntro, Section } from '@/components/portal/portal-ui';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { getTeam } from '@/lib/team/service';
import { ROLE_OWNER } from '@/lib/tenancy/service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Team' };

/**
 * TEAM (M20 Stage 4, trimmed in M24).
 *
 * A utility page, and kept one: who can open this workspace, what each of
 * them can do, and how to add somebody. Nothing here competes with the pages
 * that carry the intelligence.
 *
 * Owner-level: the gate below asks for OWNER, so a staff member gets the same
 * 404 as somebody who guessed the id. That is the point — a staff member
 * should not learn that a team page exists, let alone who is on it.
 */

const ROLE_CAN: Record<string, string> = {
  [ROLE_OWNER]: 'Reads everything, and can change the team and the account.',
  BUSINESS_STAFF: 'Reads everything. Cannot change the team or the account.',
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const gate = await tenantGateFor(clientId, 'OWNER');
  if (!gate.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  const team = await getTeam(prisma, clientId);
  const active = team.members.filter((m) => m.status === 'ACTIVE').length;

  return (
    <div className="max-w-3xl">
      <PageIntro
        eyebrow="Team"
        title="Who has access"
        description={`${active} ${active === 1 ? 'person can' : 'people can'} open this workspace${
          team.invites.length > 0 ? `, and ${team.invites.length} ${team.invites.length === 1 ? 'invitation is' : 'invitations are'} waiting to be accepted` : ''
        }.`}
      />

      <Section eyebrow="Members">
        <ul className="divide-y divide-ink-200 border-y border-ink-200">
          {team.members.map((m) => (
            <li key={m.membershipId} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="text-[15px] font-medium text-ink-900">
                    {m.name ?? m.email}
                  </p>
                  {m.name ? <p className="text-[13px] text-ink-600">{m.email}</p> : null}
                </div>
                <p className="text-[13px] font-medium text-ink-800">
                  {m.role === ROLE_OWNER ? 'Owner' : 'Staff'}
                  {m.status === 'ACTIVE' ? '' : ' · suspended'}
                </p>
              </div>
              <p className="mt-1 text-[13px] text-ink-500">
                {m.status === 'ACTIVE' ? (ROLE_CAN[m.role] ?? ROLE_CAN.BUSINESS_STAFF) : 'Cannot open the workspace until restored.'}
              </p>
              <div className="mt-2.5">
                <MembershipControls
                  clientId={clientId}
                  membershipId={m.membershipId}
                  role={m.role}
                  status={m.status}
                  isLastOwner={m.isLastOwner}
                />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Invite someone">
        <InviteForm clientId={clientId} />
      </Section>

      {team.invites.length > 0 ? (
        <Section eyebrow="Waiting to be accepted">
          <ul className="divide-y divide-ink-200 border-y border-ink-200">
            {team.invites.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
              >
                <div>
                  <p className="text-[14px] text-ink-900">{i.email}</p>
                  <p className="text-[13px] text-ink-600">
                    {i.role === ROLE_OWNER ? 'Owner' : 'Staff'}
                    {i.expired ? ' · expired' : ''}
                  </p>
                </div>
                <RevokeInviteButton clientId={clientId} inviteId={i.id} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
