import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/forms/account-forms';
import { HeadwayWordmark } from '@/components/brand';
import { currentAuthUserId } from '@/lib/db';
import { supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import { isRecoverySession } from '@/lib/auth/recovery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Set a new password' };

/**
 * Finishing a reset.
 *
 * Reachable only through a reset link: the auth callback opens a session from
 * it and sends the person here. Without such a session — none at all, an
 * ordinary signed-in one, or a link opened more than an hour ago — there is
 * nothing this form may set, so the page says so instead of offering a form
 * that cannot work. The action applies the same rule (`isRecoverySession`).
 * Setting the password ends every other session the account had open, and
 * then this one.
 */
export default async function ResetPasswordPage() {
  const signedIn =
    supabaseConfig().ok &&
    (await currentAuthUserId()) !== null &&
    (await isRecoverySession(await supabaseServerClient()));

  return (
    <main>
      <HeadwayWordmark className="mb-8" />
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        Set a new password
      </h1>
      {signedIn ? (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
            Choose something you have not used elsewhere.
          </p>
          <ResetPasswordForm />
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
            That reset link has expired or was already used.
          </p>
          <p className="mt-6 text-[14px] text-ink-600">
            <Link
              href="/forgot-password"
              className="font-medium text-ink-900 underline underline-offset-4"
            >
              Ask for a new link
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
