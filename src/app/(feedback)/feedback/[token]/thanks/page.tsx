import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolvePublicGateway } from '@/lib/gateway/service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const gateway = await resolvePublicGateway(prisma, token);
  return { title: gateway ? `Thank you · ${gateway.businessName}` : 'Thank you' };
}

/**
 * After sending.
 *
 * This page is reached by token alone. It has no way of knowing what was
 * just written or how it was rated, so it shows every customer the same
 * thing: thanks, and — only when the operator added one — the same public
 * review link, offered the same way to everyone.
 */
export default async function ThanksPage({
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
      <div className="mt-6 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-good-600 text-[16px] font-bold text-white"
        >
          ✓
        </span>
        <div>
          <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
            {copy.thanksHeadline}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{copy.thanksLine}</p>
        </div>
      </div>

      {gateway.publicReviewUrl ? (
        <section className="mt-10 rounded-2xl border border-ink-200 bg-ink-50 px-5 py-5">
          <p className="text-[16px] font-semibold text-ink-900">{copy.shareQuestion}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{copy.shareNote}</p>
          <a
            href={gateway.publicReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-ink-300 bg-white px-4 text-[15px] font-medium text-ink-900 hover:bg-ink-100"
          >
            {gateway.publicReviewLabel}
          </a>
        </section>
      ) : null}

      <p className="mt-10 text-[13px] text-ink-500">You can close this page now.</p>
    </main>
  );
}
