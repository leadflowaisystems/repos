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
 * THE PRINT KIT, IN THE OWNER'S OWN WORKSPACE (M21, trimmed in M23).
 *
 * The owner needs four things from this page: the card, a way to get it, the
 * four words that are the whole assembly, and where to put it. Everything the
 * staff need to know — when to mention it, what to say, what never to do —
 * sits behind one clearly labelled disclosure, because the owner opens this
 * page to print a card and their staff read it once.
 *
 * PREVIEW IS THE FILE, NOT A PICTURE OF IT. The frame points at the same route
 * the download does, so what an owner approves is what a print shop receives.
 * On a phone the frame is replaced by the Preview button: a PDF in an iframe on
 * a small screen shows one page badly or nothing at all.
 */

const STEPS: Array<{ word: string; detail: string }> = [
  { word: 'Print', detail: 'One A4 sheet at 100%, on the heaviest paper you have. Not "fit to page".' },
  { word: 'Cut', detail: 'Cut out both cards along the dashed borders.' },
  { word: 'Fold', detail: 'Fold each card once along its dotted line, printed sides out.' },
  { word: 'Place', detail: 'Stand it up. No glue, no tape, no holder.' },
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
  const script = view.content.staffScript;

  return (
    <div className="max-w-3xl">
      <PageIntro
        eyebrow="Print kit"
        title="Your feedback card"
        description="Put it where customers naturally see it. Every scan is a customer telling you how it went."
      />

      {ready ? (
        <>
          <Section eyebrow="Your sheet" note="A4 · two standing cards">
            <div className="flex flex-wrap gap-3">
              <a
                href={`${href}?download=1`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
              >
                Download print kit
              </a>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ink-300 bg-white px-5 text-[15px] font-medium text-ink-900 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
              >
                Preview
              </a>
            </div>

            <div className="mt-5 hidden overflow-hidden rounded-xl border border-ink-200 bg-ink-50 sm:block">
              <iframe src={href} title="Your feedback card, A4 sheet" className="block h-[640px] w-full" />
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              The preview is the file itself. What you see is what the print shop gets.
            </p>
          </Section>

          <Section eyebrow="Print · Cut · Fold · Place" note="About a minute">
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
                    <p className="text-[15px] font-semibold tracking-tight text-ink-900">{step.word}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
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
                    <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">Never</p>
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
