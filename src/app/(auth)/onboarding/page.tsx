import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/forms/account-forms';
import { currentActor } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';
import { landingPathFor, verticalChoices } from '@/lib/onboarding/service';
import { HeadwayWordmark } from '@/components/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Set up your business' };

/**
 * Onboarding.
 *
 * Four answers and a QR code. What this page must not become is a
 * questionnaire: RepOS exists to learn what a business's customers think, and
 * asking the owner to type that in at signup would contradict the product.
 *
 * Anyone who already has a business is sent to it — this page is a step, not a
 * destination, and returning to it should not offer to create a second one.
 */
export default async function OnboardingPage() {
  const actor = await currentActor(prisma);
  if (!actor) redirect('/login');

  const existing = actor.memberships.find((m) => m.status === 'ACTIVE');
  if (existing) redirect(landingPathFor(actor));

  return (
    <main>
      <HeadwayWordmark className="mb-8" />
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        Set up your business
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
        Four answers. Then your feedback page and QR code are ready to print.
      </p>

      <OnboardingForm verticals={verticalChoices()} />
    </main>
  );
}
