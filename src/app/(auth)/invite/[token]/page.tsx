import type { Metadata } from 'next';
import Link from 'next/link';
import { AcceptInviteForm } from '@/components/forms/team-forms';
import { currentActor } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Invitation' };

/**
 * ACCEPTING AN INVITATION (M20 Stage 4).
 *
 * This page deliberately knows almost nothing.
 *
 * It does NOT look the token up. A page that resolved the invitation before
 * anyone signed in would answer, for any token anyone cared to try, whether it
 * was real — and for a real one, which business it belonged to. So the token
 * stays an opaque string here and is only ever resolved inside the action,
 * which already checks that the signed-in account's email matches the address
 * the invitation was issued to.
 *
 * That means a wrong, expired, revoked, spent or invented token all look
 * identical until someone signs in and presses the button, and then they all
 * produce the same sentence.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const actor = await currentActor(prisma);

  return (
    <main>
      <div className="mb-8 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-ink-900 text-[15px] font-bold text-white">
          R
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">RepOS</span>
      </div>

      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        You have been invited to a RepOS workspace
      </h1>

      {actor ? (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
            Signed in as {actor.email}. An invitation only works for the address it was sent
            to, so if that is not you, sign out and sign in as the right account.
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
