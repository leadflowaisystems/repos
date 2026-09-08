import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { tenantGateFor } from '@/lib/auth/guard';
import { getKitView } from '@/lib/kit/service';
import { requestOrigin } from '@/lib/gateway/origin';
import { PRINT_SHEETS, type PrintSheet } from '@/lib/kit/sheets';
import { personaliseSheet } from '@/lib/kit/personalise';

export const dynamic = 'force-dynamic';
// Reading and rewriting a master is CPU work on a 120 KB file, not I/O.
export const runtime = 'nodejs';

/**
 * ONE APPROVED SHEET, WITH THIS BUSINESS ON IT.
 *
 * The two masters under `public/print-kit` are signed-off artwork. This route
 * hands one of them over with exactly two things filled in — the business name
 * and the business's own Headway QR — and every other byte of the file
 * untouched. See `src/lib/kit/personalise.ts` for how, and for why that is the
 * only honest way to personalise a print master.
 *
 * `?download=1` returns the identical bytes as an attachment. That is the only
 * difference between the owner's Open and their Download.
 *
 * AUTHORIZATION. The client id in the URL is a request, not a permission. The
 * gate answers it, and Row Level Security answers it again underneath — a
 * business somebody does not belong to is a 404, the same answer as a business
 * that does not exist.
 */

/** The masters, read once per process rather than once per download. */
const masters = new Map<string, Uint8Array>();

async function master(sheet: PrintSheet): Promise<Uint8Array> {
  const cached = masters.get(sheet.key);
  if (cached) return cached;
  // `public/` ships with the deployment; next.config.ts names this directory in
  // outputFileTracingIncludes so the file is beside the function, not only
  // beside the static assets.
  const bytes = new Uint8Array(await readFile(join(process.cwd(), 'public', ...sheet.file.split('/').filter(Boolean))));
  masters.set(sheet.key, bytes);
  return bytes;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string; sheet: string }> },
) {
  const { clientId, sheet: key } = await params;

  const sheet = PRINT_SHEETS.find((s) => s.key === key);
  if (!sheet) return new NextResponse('Not found', { status: 404 });

  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) return new NextResponse('Not found', { status: 404 });

  const view = await getKitView(prisma, clientId, { requestOrigin: await requestOrigin() });
  if (!view) return new NextResponse('Not found', { status: 404 });

  // A printed card is permanent. If Headway cannot say what address the QR
  // would open, it refuses to produce the file rather than hand over a sheet
  // whose code opens nothing — the same rule every other print surface follows.
  const url = view.content.feedbackUrl;
  if (!url) {
    return new NextResponse(
      view.addressError ??
        'Headway does not know what address a customer would open, so there is no card to print yet.',
      { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const businessName = view.content.displayName || view.businessName;

  let pdf: Uint8Array<ArrayBuffer>;
  try {
    pdf = personaliseSheet(await master(sheet), { businessName, feedbackUrl: url }).pdf;
  } catch (error) {
    // A half-personalised print master is the worst possible output, because it
    // looks finished. Refusing is the safe answer.
    console.error('[print-kit] could not personalise a sheet', { clientId, key, error });
    return new NextResponse(
      'Headway could not prepare this sheet. Nothing is wrong with your account — please tell the team.',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const download = new URL(request.url).searchParams.get('download') === '1';
  const name = `${slug(businessName)}-${sheet.downloadAs.replace(/^headway-/, '')}`;
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
      // The name and the code follow the client's own record, so a stale copy
      // in a proxy would be a card pointing at the wrong business.
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
