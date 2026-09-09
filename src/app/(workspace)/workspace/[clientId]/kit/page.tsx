import Image from 'next/image';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { requestOrigin } from '@/lib/gateway/origin';
import { getKitView } from '@/lib/kit/service';
import { CopyButton } from '@/components/copy-button';
import { PageIntro, Quiet, Section, StatusStrip } from '@/components/portal/portal-ui';
import { PRINT_SHEETS } from '@/lib/kit/sheets';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Print kit' };

/**
 * THE PRINT KIT, IN THE OWNER'S OWN WORKSPACE (M21, trimmed in M23, put onto
 * the approved print masters in M29).
 *
 * TWO SHEETS, AND ONLY TWO. Both are the signed-off Headway artwork:
 *
 *   1. 4 × 6 in insert card — A4, two cards, for an acrylic stand
 *   2. Legal joined pair    — Legal, two pairs, folds to a tent or cuts to two
 *
 * Nothing on this page draws or re-renders them. The download route opens the
 * approved PDF, swaps in this business's name and its own QR, and leaves every
 * other byte of the file alone — so what a print shop receives is the artwork
 * somebody said yes to, with the right business on it.
 *
 * WHY THE PREVIEW IS AN IMAGE. It used to be an iframe pointing at the PDF
 * route, and that never rendered: `next.config.ts` sets
 * `Content-Security-Policy: frame-ancestors 'none'` on every response, which
 * blocks framing even from the same origin, so the owner saw an empty box. The
 * previews here are stills of the two masters, so they show the layout rather
 * than this business's own card — which is what the note under the list says.
 */

export default async function WorkspaceKitPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId);

  const [view, through] = await Promise.all([
    getKitView(prisma, clientId, { requestOrigin: await requestOrigin() }),
    // How much has actually come through the card: the one figure that says
    // whether the system is working, and the reason to print another.
    prisma.reviewItem.count({ where: { clientId, source: 'REP_OS_QR' } }),
  ]);
  if (!view) notFound();

  const ready = Boolean(view.content.feedbackUrl);
  const script = view.content.staffScript;

  return (
    <div className="max-w-3xl">
      <PageIntro
        eyebrow="Print kit"
        title="Your feedback card"
        description="Put it where customers will see it. Every scan is a customer telling you how it went."
      />

      {ready ? (
        <>
          {/*
            THE STRIP PRINTS THE VALUE FIRST AND THE LABEL AFTER IT, so each
            label has to finish the phrase its value starts: "Live feedback
            page", "Ready to print". Repeating the state word in the label read
            back as "Live feedback page, live".
          */}
          <StatusStrip
            items={[
              {
                label: 'feedback page',
                value: view.gatewayPaused ? 'Paused' : 'Live',
                tone: view.gatewayPaused ? 'warn' : 'good',
              },
              { label: 'to print', value: 'Ready' },
              {
                label: through === 1 ? 'piece of feedback through the card' : 'pieces of feedback through the card',
                value: through,
                tone: through > 0 ? 'good' : 'neutral',
              },
            ]}
          />

          <Section eyebrow="Your sheets" note="Two ways to stand it up">
            <p className="mb-5 text-[14px] leading-relaxed text-ink-600">
              Both sheets carry the same card. Pick the one that suits where it will stand.
              Print it at 100%, then check that the ruler bar on the sheet measures 100 mm.
            </p>

            <ul className="space-y-5">
              {PRINT_SHEETS.map((sheet) => (
                <li
                  key={sheet.key}
                  className="overflow-hidden rounded-xl border border-ink-200 bg-white"
                >
                  <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
                    <a
                      href={`/print/sheet/${clientId}/${sheet.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block shrink-0 self-start overflow-hidden rounded-lg border border-ink-200 bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none sm:w-[176px]"
                    >
                      <Image
                        src={sheet.preview}
                        alt={`${sheet.label} — a picture of the sheet`}
                        width={sheet.previewWidth}
                        height={sheet.previewHeight}
                        className="block h-auto w-full"
                      />
                    </a>

                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] leading-snug font-semibold tracking-tight text-ink-900">
                        {sheet.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-500">{sheet.sheetNote}</p>
                      <p className="mt-2 text-[14px] leading-relaxed text-ink-800">{sheet.what}</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{sheet.finish}</p>
                      <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{sheet.spec}</p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={`/print/sheet/${clientId}/${sheet.key}?download=1`}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
                        >
                          Download
                        </a>
                        <a
                          href={`/print/sheet/${clientId}/${sheet.key}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ink-300 bg-white px-5 text-[15px] font-medium text-ink-900 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
                        >
                          Open to print
                        </a>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/*
            THE PREVIEWS ARE STILLS OF THE MASTERS, so the picture on this page
            still shows the placeholder name and code. The file does not. Said
            once, under the list — an owner who scans the picture instead of the
            print and lands somewhere odd should not have to work out why.
          */}
          <Section eyebrow="What you get">
            <p className="text-[15px] leading-relaxed text-ink-900">
              The pictures above show the layout, not your own card. The file you download
              carries your business name, and its QR opens your feedback page. Check the QR by
              scanning a printed card, not the picture on this page.
            </p>
            <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-4">
              <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">
                Where the QR goes
              </p>
              <p className="mt-1.5 font-mono text-[13px] break-all text-ink-900">
                {view.content.feedbackUrl}
              </p>
              <div className="mt-3">
                <CopyButton value={view.content.feedbackUrl ?? ''} label="Copy link" />
              </div>
            </div>
          </Section>

          <Section eyebrow="Where to put it">
            <p className="text-[15px] leading-relaxed text-ink-900">{view.content.placement}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
              Offer it to everyone, the same way, whatever kind of visit they had. Honest answers
              are the point.
            </p>

            <details className="group mt-5 rounded-xl border border-ink-200 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[14px] font-medium text-ink-900 hover:text-ink-700">
                Staff guidance
                <span aria-hidden className="text-ink-400 transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="space-y-4 border-t border-ink-200 px-4 py-4 text-[14px] leading-relaxed text-ink-800">
                {view.content.moment ? (
                  <div>
                    <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">When to mention it</p>
                    <p className="mt-1">{view.content.moment}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">What to say</p>
                  <p className="mt-1">&ldquo;{script.english}&rdquo;</p>
                  {script.hinglish ? <p className="mt-1 text-ink-700">&ldquo;{script.hinglish}&rdquo;</p> : null}
                  {script.marathi ? <p className="mt-1 text-ink-700">&ldquo;{script.marathi}&rdquo;</p> : null}
                </div>
                {view.content.rules.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">What never to do</p>
                    <ul className="mt-1 space-y-1">
                      {view.content.rules.map((rule) => (
                        <li key={rule} className="flex gap-2">
                          <span aria-hidden className="text-ink-400">
                            ·
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          </Section>
        </>
      ) : (
        <Section eyebrow="Your sheets">
          <Quiet>
            {view.addressError ??
              'Your feedback page does not have a web address yet, so there is no card to print. Headway is setting it up.'}
          </Quiet>
        </Section>
      )}
    </div>
  );
}
