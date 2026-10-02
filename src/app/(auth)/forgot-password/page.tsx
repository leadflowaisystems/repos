import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/forms/account-forms';
import { HeadwayWordmark } from '@/components/brand';
import { RESET_LINK_PARAM, resetLinkNotice } from '@/lib/auth/setup-notice';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reset your password' };

/**
 * Asking for a reset.
 *
 * Always reports the same thing, whether or not the address has an account.
 * Whether a given person is a RepOS customer is not something this form is
 * willing to answer. A reset link that did not work comes back here, with a
 * fixed sentence saying why, next to the form that gets a new one.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const notice = resetLinkNotice((await searchParams)[RESET_LINK_PARAM]);

  return (
    <main>
      <HeadwayWordmark className="mb-8" />
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        Reset your password
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">We will email you a link. The link works once and expires.</p>
      {notice ? (
        <p
          role="status"
          className="mt-5 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-[14px] leading-relaxed text-warn-700"
        >
          {notice}
        </p>
      ) : null}
      <ForgotPasswordForm />
      <p className="mt-6 text-[14px] text-ink-600">
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
