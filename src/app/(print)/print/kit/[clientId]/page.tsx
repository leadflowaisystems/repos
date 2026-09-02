import { notFound } from 'next/navigation';
import { PrintNowButton } from '@/components/copy-button';
import { prisma } from '@/lib/db';
import { getKitView } from '@/lib/kit/service';

export const dynamic = 'force-dynamic';

/**
 * The printable kit.
 *
 * Rendered locally and printed by the browser, which gives the operator a real
 * print preview and "Save as PDF" for free — no PDF service, no upload, no
 * account. Nothing on this page is fetched from anywhere.
 *
 * Four pieces, all driven by the client's vertical pack:
 *   1. A5 counter/table stand
 *   2. Eight small cards on one A4 sheet
 *   3. A6 sticker
 *   4. Staff instruction card
 */
export default async function PrintKitPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const kit = await getKitView(prisma, clientId);
  if (!kit) notFound();

  const { content, qr } = kit;
  const qrSvg = qr.ok ? qr.svg : null;

  return (
    <>
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <p className="text-[15px] font-semibold text-ink-900">
            {content.displayName} — {kit.verticalLabel} feedback kit
          </p>
          <p className="mt-0.5 text-[13px] text-ink-600">
            {qrSvg
              ? 'Print on plain A4. Use "Save as PDF" in the print dialog if you want a file.'
              : 'No review link has been added yet, so the QR areas are blank. Add the link first.'}
          </p>
        </div>
        <PrintNowButton />
      </div>

      {/* 1 — A5 counter stand ------------------------------------------- */}
      <section className="sheet sheet-a5 print-page print-avoid-break">
        <div
          className="flex h-full min-h-[210mm] flex-col items-center justify-center px-[14mm] py-[16mm] text-center"
          style={{ borderTop: `6mm solid ${kit.brandPrimary}` }}
        >
          <p
            className="text-[11pt] font-semibold tracking-[0.18em] uppercase"
            style={{ color: kit.brandSecondary }}
          >
            {content.displayName}
          </p>

          <h1
            className="mt-[10mm] text-[26pt] leading-tight font-bold"
            style={{ color: kit.brandPrimary }}
          >
            {content.headline}
          </h1>

          <p className="mt-[5mm] max-w-[95mm] text-[12pt] leading-relaxed text-ink-700">
            {content.subhead}
          </p>

          <QrBlock svg={qrSvg} size="62mm" />

          <p className="mt-[5mm] text-[11pt] font-medium text-ink-800">
            {content.qrCaption}
          </p>
          <p className="mt-auto text-[9pt] text-ink-500">{content.footerNote}</p>
        </div>
      </section>

      {/* 2 — 8-up cards on A4 -------------------------------------------- */}
      <section className="sheet sheet-a4 print-page">
        <div className="grid h-full min-h-[297mm] grid-cols-2 grid-rows-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="print-avoid-break flex flex-col items-center justify-center border border-dashed border-ink-300 px-[8mm] py-[6mm] text-center"
            >
              <p
                className="text-[7pt] font-semibold tracking-[0.14em] uppercase"
                style={{ color: kit.brandSecondary }}
              >
                {content.displayName}
              </p>
              <p
                className="mt-[3mm] text-[11pt] leading-snug font-semibold"
                style={{ color: kit.brandPrimary }}
              >
                {content.headline}
              </p>
              <QrBlock svg={qrSvg} size="28mm" compact />
              <p className="mt-[2mm] text-[7.5pt] text-ink-600">{content.qrCaption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — A6 sticker --------------------------------------------------- */}
      <section className="sheet sheet-a6 print-page print-avoid-break">
        <div
          className="flex h-full min-h-[148mm] flex-col items-center justify-center px-[10mm] py-[12mm] text-center"
          style={{ borderTop: `4mm solid ${kit.brandPrimary}` }}
        >
          <p
            className="text-[9pt] font-semibold tracking-[0.16em] uppercase"
            style={{ color: kit.brandSecondary }}
          >
            {content.displayName}
          </p>
          <p
            className="mt-[6mm] text-[16pt] leading-tight font-bold"
            style={{ color: kit.brandPrimary }}
          >
            {content.headline}
          </p>
          <QrBlock svg={qrSvg} size="44mm" />
          <p className="mt-[4mm] text-[9.5pt] text-ink-700">{content.qrCaption}</p>
        </div>
      </section>

      {/* 4 — Staff instruction card --------------------------------------- */}
      <section className="sheet sheet-a5 print-page print-avoid-break">
        <div className="px-[14mm] py-[14mm]">
          <p
            className="text-[9pt] font-semibold tracking-[0.16em] uppercase"
            style={{ color: kit.brandSecondary }}
          >
            Staff card — not for customers
          </p>
          <h2
            className="mt-[3mm] text-[17pt] leading-tight font-bold"
            style={{ color: kit.brandPrimary }}
          >
            {content.displayName}
          </h2>
          <p className="mt-[1mm] text-[9.5pt] text-ink-600">
            {kit.verticalLabel} · {content.assetLabel}
          </p>

          <StaffSection title="Where the card goes">{content.placement}</StaffSection>
          <StaffSection title="When to mention it">
            {content.staffScript.when}
          </StaffSection>

          <StaffSection title="What to say">
            <span className="block">&ldquo;{content.staffScript.english}&rdquo;</span>
            {content.staffScript.hinglish ? (
              <span className="mt-[2mm] block text-ink-700">
                &ldquo;{content.staffScript.hinglish}&rdquo;
              </span>
            ) : null}
            {content.staffScript.marathi ? (
              <span className="mt-[2mm] block text-ink-700">
                &ldquo;{content.staffScript.marathi}&rdquo;
              </span>
            ) : null}
          </StaffSection>

          <div className="mt-[8mm] rounded-md border-2 border-ink-900 px-[6mm] py-[5mm]">
            <p className="text-[9pt] font-bold tracking-wide uppercase">
              Never do these
            </p>
            <ul className="mt-[3mm] space-y-[2mm]">
              {content.rules.map((rule) => (
                <li key={rule} className="text-[9.5pt] leading-snug">
                  · {rule}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-[8mm] text-[8pt] leading-relaxed text-ink-500">
            Offer the same card to every customer, whatever they thought. Honest
            feedback is the point — a filtered five-star wall helps nobody and puts
            the listing at risk.
          </p>
        </div>
      </section>
    </>
  );
}

function QrBlock({
  svg,
  size,
  compact = false,
}: {
  svg: string | null;
  size: string;
  compact?: boolean;
}) {
  return (
    <div style={{ width: size, height: size }} className={compact ? 'mt-[3mm]' : 'mt-[8mm]'}>
      {svg ? (
        <div
          className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="grid h-full w-full place-items-center border border-dashed border-ink-400 p-2 text-center text-[7pt] leading-tight text-ink-400">
          Add the public review link to generate the QR
        </div>
      )}
    </div>
  );
}

function StaffSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-[7mm]">
      <p className="text-[8.5pt] font-semibold tracking-wide text-ink-500 uppercase">
        {title}
      </p>
      <p className="mt-[1.5mm] text-[10.5pt] leading-relaxed text-ink-900">
        {children}
      </p>
    </div>
  );
}

