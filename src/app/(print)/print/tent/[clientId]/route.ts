import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { tenantGateFor } from '@/lib/auth/guard';
import { getKitView } from '@/lib/kit/service';
import { renderTentSheet } from '@/lib/kit/tent';
import { requestOrigin } from '@/lib/gateway/origin';

export const dynamic = 'force-dynamic';

/**
 * THE TABLE TENT, AS A FILE.
 *
 * Every other printed piece in RepOS is an HTML page the operator prints from
 * a browser. That is fine when the operator is the one printing. It is not
 * what an owner needs when the job is "send this to the print shop down the
 * road" — a shop wants a PDF at a known page size with the marks already on
 * it, and cannot be sent instructions about turning off Fit to Page.
 *
 * So this is a file, not a page: one A4 sheet, two cards, cut and fold marks,
 * and the four steps printed in the margin that gets trimmed away.
 *
 * `?download=1` returns the identical bytes as an attachment. That is the only
 * difference between the owner's Preview and their Download.
 *
 * AUTHORIZATION. The client id in the URL is a request, not a permission. The
 * gate answers it, and Row Level Security answers it again underneath — a
 * business somebody does not belong to is a 404, the same answer as a business
 * that does not exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) return new NextResponse('Not found', { status: 404 });

  const view = await getKitView(prisma, clientId, { requestOrigin: await requestOrigin() });
  if (!view) return new NextResponse('Not found', { status: 404 });

  // A printed card is permanent. If RepOS cannot say what address the QR would
  // open, it refuses to produce the file rather than print a QR that opens
  // nothing — the same rule the HTML print pages already follow.
  const url = view.content.feedbackUrl;
  if (!url) {
    return new NextResponse(
      view.addressError ??
        'RepOS does not know what address a customer would open, so there is no card to print yet.',
      { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const pdf = renderTentSheet({
    businessName: view.content.displayName || view.businessName,
    headline: view.content.headline,
    subhead: view.content.subhead,
    qrCaption: view.content.qrCaption,
    thankYou: view.content.footerNote,
    placement: view.content.placement,
    feedbackUrl: url,
    brandPrimary: view.brandPrimary,
    brandSecondary: view.brandSecondary,
  });

  // The same bytes either way. `inline` so the owner's Preview shows the sheet
  // in the page; `attachment` so their Download button produces a file with a
  // name a print shop can read, rather than a tab they have to save by hand.
  const download = new URL(request.url).searchParams.get('download') === '1';
  const name = `${slug(view.businessName)}-feedback-tent.pdf`;
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
      // The QR and the wording follow the client's settings, so a stale copy
      // in a proxy would be a card pointing at the wrong address.
      'Cache-Control': 'no-store',
    },
  });
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'business'
  );
}
