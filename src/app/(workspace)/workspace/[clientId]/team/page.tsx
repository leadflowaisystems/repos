import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  InviteForm,
  MembershipControls,
  RevokeInviteButton,
} from '@/components/forms/team-forms';
import { Section } from '@/components/portal/portal-ui';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { getTeam } from '@/lib/team/service';
import { ROLE_OWNER } from '@/lib/tenancy/service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Team' };

/**
 * TEAM (M20 Stage 4).
 *
 * Owner-level: the gate below asks for OWNER, so a staff member gets the same
 * 404 as somebody who guessed the id. That is the point — a staff member
 * should not learn that a team page exists, let alone who is on it.
 */
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

  return (
    <div>
      <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight text-ink-900">
        Team
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
        Who can open this workspace, and what they can do in it.
      </p>

      <Section eyebrow="Members">
        <ul className="divide-y divide-ink-100 border-y border-ink-100">
          {team.members.map((m) => (
            <li key={m.membershipId} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="text-[15px] font-medium text-ink-900">
                    {m.name ?? m.email}
                  </p>
                  {m.name ? <p className="text-[13px] text-ink-600">{m.email}</p> : null}
                </div>
                <p className="text-[13px] text-ink-600">
                  {m.role === ROLE_OWNER ? 'Owner' : 'Staff'}
                  {m.status === 'ACTIVE' ? '' : ' · suspended'}
                </p>
              </div>
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
          <ul className="divide-y divide-ink-100 border-y border-ink-100">
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
