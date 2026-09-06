import type { Metadata } from 'next';
import Link from 'next/link';
import { AcceptInviteForm } from '@/components/forms/team-forms';
import { currentActor } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';
import { invitationPreview } from '@/lib/team/service';
import { HeadwayWordmark } from '@/components/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Invitation' };

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * ACCEPTING AN INVITATION (M20 Stage 4, extended in M21).
 *
 * This page deliberately knows almost nothing until it knows who is asking.
 *
 * FOR A SIGNED-OUT VISITOR it does NOT look the token up, and that has not
 * changed. A page that resolved the invitation before anyone signed in would
 * answer, for any token anyone cared to try, whether it was real — and for a
 * real one, which business it belonged to. So a wrong, expired, revoked, spent
 * or invented token all look identical here.
 *
 * FOR THE PERSON THE INVITATION NAMES that argument does not apply: they could
 * press Accept and find out. So once somebody is signed in, the invitation is
 * resolved for their address only, inside the database, and the page can say
 * what they are actually being asked to join. Which it must — "you have been
 * invited to a workspace" above an Accept button is not something a careful
 * person should press.
 *
 * Anyone else signed in sees the same nothing a stranger sees.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const actor = await currentActor(prisma);
  const invite = actor ? await invitationPreview(prisma, token, actor.userId) : null;

  return (
    <main>
      <HeadwayWordmark className="mb-8" />

      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        {invite
          ? `Join ${invite.businessName} on Headway`
          : 'You have been invited to a Headway workspace'}
      </h1>

      {actor && invite ? (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
            You have been invited to {invite.businessName} as{' '}
            {invite.role === 'BUSINESS_OWNER' ? 'an owner' : 'a team member'}. Headway reads what
            this business&rsquo;s customers say and tells you what needs you.
          </p>

          <dl className="mt-6 divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Business</dt>
              <dd className="text-right font-medium text-ink-900">{invite.businessName}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Your role</dt>
              <dd className="text-right font-medium text-ink-900">
                {invite.role === 'BUSINESS_OWNER' ? 'Owner' : 'Team member'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Invitation for</dt>
              <dd className="text-right font-medium text-ink-900">{actor.email}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Valid until</dt>
              <dd className="text-right font-medium text-ink-900">
                {DATE.format(invite.expiresAt)}
              </dd>
            </div>
          </dl>

          <AcceptInviteForm token={token} />

          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            Accepting adds this business to your account. It works once, and only for{' '}
            {actor.email}.
          </p>
        </>
      ) : actor ? (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
            Signed in as {actor.email}. An invitation only works for the address it was sent
            to, so if that is not you, sign out and sign in as the right account. An invitation
            that has already been used, been withdrawn or run out of time will not open either.
          </p>
          <AcceptInviteForm token={token} />
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
            Sign in — or create an account with the address the invitation was sent to — and
            then open this link again.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink-900 px-6 text-[16px] font-semibold text-white hover:bg-ink-800"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ink-300 bg-white px-6 text-[16px] font-medium text-ink-900 hover:bg-ink-50"
            >
              Create an account
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
