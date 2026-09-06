import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/forms/account-forms';
import { HeadwayWordmark } from '@/components/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reset your password' };

/**
 * Asking for a reset.
 *
 * Always reports the same thing, whether or not the address has an account.
 * Whether a given person is a RepOS customer is not something this form is
 * willing to answer.
 */
export default function ForgotPasswordPage() {

  return (
    <main>
      <HeadwayWordmark className="mb-8" />
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        Reset your password
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">We will email you a link. The link works once and expires.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-[14px] text-ink-600">
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
