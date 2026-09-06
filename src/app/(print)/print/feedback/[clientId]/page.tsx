import { notFound } from 'next/navigation';
import { PrintNowButton } from '@/components/copy-button';
import { prisma } from '@/lib/db';
import { getGatewayView } from '@/lib/gateway/service';
import { requestOrigin } from '@/lib/gateway/origin';

export const dynamic = 'force-dynamic';

/**
 * The printable feedback card (M14).
 *
 * Printed by the browser, so the operator gets a preview and "Save as PDF"
 * with nothing to install. Three pieces, all from the same QR:
 *
 *   1. A5 counter or table stand
 *   2. Four cards on one A4 sheet
 *   3. A6 sticker
 *
 * Only what a customer needs is on the card: the question, one line, the
 * QR. No statistics, no instructions, no software.
 */
export default async function PrintFeedbackCardPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const view = await getGatewayView(prisma, clientId, { requestOrigin: await requestOrigin() });
  if (!view) notFound();

  const { copy, qr } = view;

  // A card is permanent once it leaves the printer. If RepOS cannot say what
  // address the QR should open, it prints nothing at all.
  if (!qr) {
    return (
      <div className="no-print mx-auto max-w-[150mm] px-4 py-16">
        <p className="text-[15px] font-semibold text-ink-900">
          These cards are not ready to print yet.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
          {view.baseUrlError ??
            'Headway does not know what address a customer would open.'}{' '}
          Until that is set, a printed QR would open nothing — so Headway has not made one.
        </p>
      </div>
    );
  }

  const live = view.enabled && !view.archived;

  return (
    <>
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <p className="text-[15px] font-semibold text-ink-900">
            {view.businessName} — feedback card
          </p>
          <p className="mt-0.5 text-[13px] text-ink-600">
            {!live
              ? 'This feedback page is paused or archived. The QR would open a "not active" page.'
              : view.baseUrlLoopback
                ? 'The QR points at this computer only. Set the address on the Feedback QR tab before printing.'
                : 'Print on plain A4. Use "Save as PDF" in the print dialog if you want a file.'}
          </p>
        </div>
        <PrintNowButton />
      </div>

      {/* 1 — A5 counter stand ------------------------------------------- */}
      <section className="sheet sheet-a5 print-page print-avoid-break">
        <div className="flex h-full min-h-[210mm] flex-col items-center justify-center border-t-[5mm] border-ink-900 px-[14mm] py-[16mm] text-center">
          <p className="text-[10.5pt] font-semibold tracking-[0.18em] text-ink-600 uppercase">
            {view.businessName}
          </p>
          <h1 className="mt-[9mm] text-[26pt] leading-tight font-bold text-ink-900">
            {copy.printHeadline}
          </h1>
          <p className="mt-[4mm] max-w-[95mm] text-[12pt] leading-relaxed text-ink-700">
            {copy.printLine}
          </p>
          <Qr svg={qr.svg} size="64mm" className="mt-[9mm]" />
          <p className="mt-[5mm] text-[10.5pt] font-medium text-ink-800">
            Scan with your phone camera
          </p>
          <p className="mt-auto text-[9pt] text-ink-500">No name or number needed. It takes a minute.</p>
        </div>
      </section>

      {/* 2 — Four cards on A4 ------------------------------------------- */}
      <section className="sheet sheet-a4 print-page">
        <div className="grid h-full min-h-[297mm] grid-cols-2 grid-rows-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="print-avoid-break flex flex-col items-center justify-center border border-dashed border-ink-300 px-[10mm] py-[8mm] text-center"
            >
              <p className="text-[8pt] font-semibold tracking-[0.16em] text-ink-600 uppercase">
                {view.businessName}
              </p>
              <p className="mt-[4mm] text-[15pt] leading-snug font-bold text-ink-900">
                {copy.printHeadline}
              </p>
              <p className="mt-[2mm] max-w-[70mm] text-[9pt] leading-relaxed text-ink-700">
                {copy.printLine}
              </p>
              <Qr svg={qr.svg} size="42mm" className="mt-[5mm]" />
              <p className="mt-[3mm] text-[8pt] text-ink-600">Scan with your phone camera</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — A6 sticker --------------------------------------------------- */}
      <section className="sheet sheet-a6 print-page print-avoid-break">
        <div className="flex h-full min-h-[148mm] flex-col items-center justify-center border-t-[4mm] border-ink-900 px-[10mm] py-[12mm] text-center">
          <p className="text-[8.5pt] font-semibold tracking-[0.16em] text-ink-600 uppercase">
            {view.businessName}
          </p>
          <p className="mt-[5mm] text-[16pt] leading-tight font-bold text-ink-900">
            {copy.printHeadline}
          </p>
          <Qr svg={qr.svg} size="46mm" className="mt-[6mm]" />
          <p className="mt-[4mm] text-[9pt] text-ink-700">{copy.printLine}</p>
        </div>
      </section>
    </>
  );
}

function Qr({ svg, size, className }: { svg: string; size: string; className?: string }) {
  return (
    <div style={{ width: size, height: size }} className={className}>
      <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
