import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignInForm } from '@/components/forms/account-forms';
import { currentActor } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';
import { landingPathFor } from '@/lib/onboarding/service';
import { safeNextPath } from '@/lib/auth/redirect';

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
  const query = await searchParams;
  const raw = Array.isArray(query.next) ? query.next[0] : query.next;
  // Empty, not '/', when nothing was requested. '/' is the operator console,
  // and defaulting to it sent every business owner somewhere they may not go —
  // the sign-in action treats an empty value as "you decide" and asks their
  // memberships instead.
  //
  // The third copy of the same-site check used to live here as an inline prefix
  // test, and it had the same two holes as the other two. It matters here even
  // though this page does not redirect: whatever survives is rendered into the
  // hidden `next` field and posted straight back to the sign-in action. The
  // action re-checks it — this is not the only line of defence — but laundering
  // an attacker's value through our own form is not something to leave standing.
  const next = safeNextPath(raw) ?? '';

  /**
   * The circuit breaker.
   *
   * `next` is set by exactly one thing: middleware turning away a request it
   * would not authenticate. So its presence means middleware has already
   * decided this caller has no usable session. If the check below then
   * disagreed and sent them onward, middleware would turn them straight back —
   * which is the redirect loop, and no amount of correct cookie handling makes
   * a disagreement impossible.
   *
   * When the two disagree, the sign-in form is the safe answer: it costs an
   * authenticated person one click and it cannot loop.
   */
  const bouncedByMiddleware = typeof raw === 'string' && raw.length > 0;
  if (!bouncedByMiddleware) {
    const actor = await currentActor(prisma);
    if (actor) redirect(landingPathFor(actor));
  }

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
