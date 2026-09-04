import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/forms/account-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reset your password' };

/**
 * Asking for a reset.
 *
 * Always reports the same thing, whether or not the address has an account.
 * Whether a given person is a RepOS customer is not something this form is
 * willing to answer.
 */
export default async function ForgotPasswordPage() {
  // The reset link has to come back to this deployment, whatever its domain.
  const host = (await headers()).get('host') ?? '';
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  const origin = host ? `${protocol}://${host}` : '';

  return (
    <main>
      <div className="mb-8 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-ink-900 text-[15px] font-bold text-white">
          R
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">RepOS</span>
      </div>
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        Reset your password
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">We will email you a link. The link works once and expires.</p>
      <ForgotPasswordForm origin={origin} />
      <p className="mt-6 text-[14px] text-ink-600">
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
