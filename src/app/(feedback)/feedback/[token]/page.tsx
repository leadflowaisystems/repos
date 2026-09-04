import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CustomerFeedbackForm } from '@/components/feedback-gateway/customer-form';
import { prisma } from '@/lib/db';
import { resolvePublicGateway } from '@/lib/gateway/service';
import { newFormNonce } from '@/lib/gateway/throttle';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const gateway = await resolvePublicGateway(prisma, token);
  return { title: gateway ? gateway.businessName : 'Feedback' };
}

/**
 * The whole customer experience, first screen.
 *
 * The page knows the business's name and its vertical's wording. It does not
 * know — and cannot reach — anything the owner told RepOS, what other
 * customers said, or what RepOS concluded. Those live in modules this route
 * never imports, and a compliance test keeps it that way.
 */
export default async function CustomerFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gateway = await resolvePublicGateway(prisma, token);
  if (!gateway) notFound();

  const { copy } = gateway;

  return (
    <main>
      <p className="text-[12px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
        {gateway.businessName}
      </p>
      <h1 className="mt-3 text-[28px] leading-[1.15] font-semibold tracking-tight text-ink-900">
        {copy.headline}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{copy.prompt}</p>

      <CustomerFeedbackForm
        token={gateway.token}
        copy={copy}
        nonce={newFormNonce()}
        dimensions={gateway.dimensions}
      />
    </main>
  );
}
