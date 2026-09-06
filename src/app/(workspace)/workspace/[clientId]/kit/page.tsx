import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { requestOrigin } from '@/lib/gateway/origin';
import { getKitView } from '@/lib/kit/service';
import { PageIntro, Quiet, Section } from '@/components/portal/portal-ui';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Print kit' };

/**
 * THE PRINT KIT, IN THE OWNER'S OWN WORKSPACE (M21).
 *
 * The table tent already existed as a file behind `/print/tent/<clientId>`,
 * and that was a route an operator knew about. An owner did not, which made
 * the one physical object in the whole product something they had to be sent
 * rather than something they had.
 *
 * So it is a section: see it, download it, and read the four words that are the
 * entire assembly. Nothing about the card itself changes here — the same route
 * renders the same bytes, and this page is a door onto it.
 *
 * PREVIEW IS THE FILE, NOT A PICTURE OF IT. The frame below points at the same
 * route the Download button does, so what an owner approves is what a print
 * shop receives. A rendered mock-up that drifted from the PDF would be worse
 * than no preview at all.
 */

const STEPS: Array<{ word: string; detail: string }> = [
  {
    word: 'Print',
    detail:
      'One A4 sheet, on the heaviest paper your printer takes. Print at 100% — turn off Fit to Page, or the card comes out the wrong size.',
  },
  {
    word: 'Cut',
    detail:
      'Cut out both cards along their dashed borders. The line down the middle separates the pair.',
  },
  {
    word: 'Fold',
    detail:
      'Each card once, along its dotted line. The two printed faces end up back to back, facing out.',
  },
  {
    word: 'Place',
    detail: 'Stand it up. It holds its own shape — no glue, no tape, no holder.',
  },
];

export default async function WorkspaceKitPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  const view = await getKitView(prisma, clientId, { requestOrigin: await requestOrigin() });
  if (!view) notFound();

  const href = `/print/tent/${clientId}`;
  const ready = Boolean(view.content.feedbackUrl);

  return (
    <div>
      <PageIntro
        eyebrow="Print kit"
        title="The card that goes on your tables"
        description="One A4 sheet makes two. Each one folds down the middle into a standing card with your QR code on both sides, so a customer sees it whichever way they are facing."
      />

      <Section eyebrow="How it goes together" note="Four steps, about a minute">
        <ol className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.word} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-900 text-[11px] font-semibold text-white"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold tracking-tight text-ink-900">
                  {step.word}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {ready ? (
        <>
          <Section eyebrow="Your sheet" note="A4 · two cards · ready to print">
            <div className="flex flex-wrap gap-3">
              <a
                href={`${href}?download=1`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
              >
                Download the PDF
              </a>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink-300 bg-white px-5 text-[15px] font-medium text-ink-900 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
              >
                Open in a new tab
              </a>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
              <iframe
                src={href}
                title="Table tent, A4 sheet"
                className="block h-[540px] w-full sm:h-[720px]"
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              This preview is the file itself. What you see is what the print shop gets.
            </p>
          </Section>

          <Section eyebrow="Where to put it" note="For a business like yours">
            <p className="text-[15px] leading-relaxed text-ink-900">{view.content.placement}</p>
            {view.content.moment ? (
              <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
                {view.content.moment}
              </p>
            ) : null}
            <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
              Offer it to everyone, the same way, whether or not the visit went well. The card
              asks the customer to tell you honestly — that is the whole point of it, and
              showing it only to happy customers would make the answers worthless.
            </p>
          </Section>
        </>
      ) : (
        <Section eyebrow="Your sheet">
          <Quiet>
            {view.addressError ??
              'Headway does not yet know what address a customer would open, so there is no card to print. The team is setting this up.'}
          </Quiet>
        </Section>
      )}
    </div>
  );
}
