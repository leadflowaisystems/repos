import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
// The customer has no account, so this page reaches the database through the
// privilege-less public role rather than the RLS-bound application one. That
// connection can call two token-scoped functions and read no table at all.
import { publicDb } from '@/lib/db-public';
import { resolvePublicGateway } from '@/lib/gateway/service';
import { HeadwayMark } from '@/components/brand';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const gateway = await resolvePublicGateway(publicDb(), token);
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
/**
 * The one mark on a customer's screen.
 *
 * Small, at the bottom, after the thing they came to do. This page belongs to
 * the business whose name is at the top; Headway is the tool behind it, and the
 * only reason to say so at all is that the card on the table carries the same
 * mark in the same place. A customer who scans a Headway tent should land on a
 * Headway page, or the two look like unrelated things.
 */
function PoweredByHeadway() {
  return (
    <p className="mt-12 flex items-center justify-center gap-1.5 border-t border-ink-200 pt-5 text-[11px] tracking-wide text-ink-400">
      <HeadwayMark className="h-3.5 w-3.5 opacity-70" />
      Feedback by Headway
    </p>
  );
}

export default async function ThanksPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gateway = await resolvePublicGateway(publicDb(), token);
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
      <PoweredByHeadway />
    </main>
  );
}
