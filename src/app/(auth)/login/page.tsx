import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignInForm } from '@/components/forms/account-forms';
import { currentActor } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';
import { landingPathFor } from '@/lib/onboarding/service';

export const dynamic = 'force-dynamic';

/**
 * Sign in.
 *
 * Says nothing about the installation: not how many clients exist, not whether
 * a password is configured, not which provider is set up. A signed-out visitor
 * sees a wordmark and one field.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await currentActor(prisma);
  if (actor) redirect(landingPathFor(actor));

  const query = await searchParams;
  const raw = Array.isArray(query.next) ? query.next[0] : query.next;
  const next = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  return (
    <main>
      <div className="mb-8 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-ink-900 text-[15px] font-bold text-white">
          R
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-ink-900">RepOS</span>
      </div>

      <h1 className="mb-1.5 text-[22px] leading-tight font-semibold tracking-tight text-ink-900">
        Sign in
      </h1>
      <p className="mb-6 text-[13px] leading-relaxed text-ink-500">
        This tool is for the operator. Customers and business owners have their own links and do
        not sign in here.
      </p>

      <SignInForm next={next} />

      <div className="mt-6 space-y-1.5 text-[14px] text-ink-600">
        <p>
          <Link
            href="/forgot-password"
            className="font-medium text-ink-900 underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        </p>
        <p>
          New to RepOS?{' '}
          <Link href="/signup" className="font-medium text-ink-900 underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
