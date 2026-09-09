import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import {
  InviteForm,
  MembershipControls,
  RevokeInviteButton,
} from '@/components/forms/team-forms';
import { PageIntro, Section } from '@/components/portal/portal-ui';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';
import { getTeam } from '@/lib/team/service';
import { ROLE_OWNER } from '@/lib/tenancy/service';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('team.meta.title') };
}

/**
 * TEAM (M20 Stage 4, trimmed in M24, put into three languages in M31).
 *
 * A utility page, and kept one: who can open this workspace, what each of
 * them can do, and how to add somebody. Nothing here competes with the pages
 * that carry the intelligence.
 *
 * Owner-level: the gate below asks for OWNER, so a staff member gets the same
 * 404 as somebody who guessed the id. That is the point — a staff member
 * should not learn that a team page exists, let alone who is on it.
 *
 * THE LINE UNDER THE TITLE USED TO BE ASSEMBLED, and no longer is. It was a
 * number, a verb chosen by that number, a clause, a second number and a second
 * verb, glued together in English word order — which is untranslatable, because
 * Hindi puts the verb at the end and Marathi agrees it with the noun. It is now
 * two whole sentences, each a phrase in the dictionary, each carrying its own
 * count as a placeholder.
 */

/** What each role may do, as dictionary keys rather than as sentences. */
const ROLE_CAN: Record<string, MessageKey> = {
  [ROLE_OWNER]: 'team.can.owner',
  BUSINESS_STAFF: 'team.can.staff',
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId, 'OWNER');

  const t = await getTranslator();
  const team = await getTeam(prisma, clientId);
  const active = team.members.filter((m) => m.status === 'ACTIVE').length;

  // Two finished sentences, not two halves of one. Each stands on its own in
  // every language, so the second can be left out without breaking the first.
  const description = [
    t.plural('team.intro.members', active),
    ...(team.invites.length > 0 ? [t.plural('team.intro.invites', team.invites.length)] : []),
  ].join(' ');

  return (
    <div className="max-w-3xl">
      <PageIntro
        eyebrow={t('team.eyebrow')}
        title={t('team.title')}
        description={description}
      />

      <Section eyebrow={t('team.members.eyebrow')}>
        <ul className="divide-y divide-ink-200 border-y border-ink-200">
          {team.members.map((m) => {
            const roleLabel = m.role === ROLE_OWNER ? t('team.role.owner') : t('team.role.staff');
            return (
              <li key={m.membershipId} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="text-[15px] font-medium text-ink-900">
                      {m.name ?? m.email}
                    </p>
                    {m.name ? <p className="text-[13px] text-ink-600">{m.email}</p> : null}
                  </div>
                  <p className="text-[13px] font-medium text-ink-800">
                    {m.status === 'ACTIVE'
                      ? roleLabel
                      : t('team.member.suspendedRole', { role: roleLabel })}
                  </p>
                </div>
                <p className="mt-1 text-[13px] text-ink-500">
                  {m.status === 'ACTIVE'
                    ? t(ROLE_CAN[m.role] ?? 'team.can.staff')
                    : t('team.can.suspended')}
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
            );
          })}
        </ul>
      </Section>

      <Section eyebrow={t('team.invite.eyebrow')}>
        <InviteForm clientId={clientId} />
      </Section>

      {team.invites.length > 0 ? (
        <Section eyebrow={t('team.pending.eyebrow')}>
          <ul className="divide-y divide-ink-200 border-y border-ink-200">
            {team.invites.map((i) => {
              const roleLabel =
                i.role === ROLE_OWNER ? t('team.role.owner') : t('team.role.staff');
              return (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                >
                  <div>
                    <p className="text-[14px] text-ink-900">{i.email}</p>
                    <p className="text-[13px] text-ink-600">
                      {i.expired
                        ? t('team.invite.expiredRole', { role: roleLabel })
                        : roleLabel}
                    </p>
                  </div>
                  <RevokeInviteButton clientId={clientId} inviteId={i.id} />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
