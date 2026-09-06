import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from '@/components/forms/account-forms';
import { HeadwayWordmark } from '@/components/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Create your account' };

/**
 * Sign up.
 *
 * Says nothing about the installation: not how many businesses exist, not
 * whether an address is already registered. Supabase Auth verifies the
 * identity; RepOS creates the user row behind it and nothing more.
 */
export default function SignUpPage() {

  return (
    <main>
      <HeadwayWordmark className="mb-8" />
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        Create your account
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">One business, one account. It takes about a minute.</p>
      <SignUpForm />
      <p className="mt-6 text-[14px] text-ink-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
