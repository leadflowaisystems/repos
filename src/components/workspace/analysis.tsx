import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getAnalysisView } from '@/lib/portal/service';
import {
  Limits,
  PageIntro,
  Quiet,
  Section,
  SoFar,
  ThemeRows,
  ThemeStory,
  WorkList,
} from '@/components/portal/portal-ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customers' };

/**
 * CUSTOMERS — why is RepOS saying this? (M12)
 *
 * Every theme read in full: what customers say, what it means, why it
 * matters, what RepOS recommends, and the evidence — plus the movement, the
 * recurrence, the new, and the not-yet-clear. The owner does the synthesis
 * nowhere; it is done here.
 */
/**
 * The analysis page, as one implementation behind two doors (M20).
 *
 * Reached either through the owner's secret link (/portal/[token]) or through
 * an authenticated workspace (/workspace/[clientId]). Both resolve to a client
 * id first and neither is trusted here: whoever renders this has already
 * decided the caller may see this business.
 */
export async function PortalAnalysis({
  clientId,
  basePath,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
}) {
  const client = { id: clientId };
  const view = await getAnalysisView(prisma, client.id);
  if (!view) notFound();

  const changing = view.better.length + view.worse.length > 0;

  return (
    <div className="max-w-3xl">
      <PageIntro eyebrow="Customers" title="Why RepOS is saying this" description={view.basis} />

      {view.soFar.read > 0 || view.soFar.waiting > 0 ? (
        <Section
          eyebrow="What customers are mentioning so far"
          note="Current signals, not conclusions"
        >
          <SoFar soFar={view.soFar} basePath={basePath} />
        </Section>
      ) : null}

      {view.work.length > 0 ? (
        <Section eyebrow="What RepOS did with your feedback">
          <WorkList work={view.work} />
        </Section>
      ) : null}

      {view.telling.length > 0 ? (
        <Section eyebrow="Customers are telling you">
          <div className="space-y-2">
            {view.telling.map((t) => (
              <p key={t} className="text-[16px] leading-relaxed text-ink-900">
                {t}
              </p>
            ))}
          </div>
        </Section>
      ) : null}

      <Section eyebrow="What customers love">
        {view.loved.length > 0 ? (
          <div>
            {view.loved.map((s) => (
              <ThemeStory key={s.themeKey} signal={s} basePath={basePath} depth="full" />
            ))}
          </div>
        ) : (
          <Quiet>
            Nothing has been praised often enough yet to name. We call something a strength
            once at least three customers have mentioned it.
          </Quiet>
        )}
      </Section>

      <Section eyebrow="Where the experience falls short">
        {view.unhappy.length > 0 ? (
          <div>
            {view.unhappy.map((s) => (
              <ThemeStory key={s.themeKey} signal={s} basePath={basePath} depth="full" />
            ))}
          </div>
        ) : (
          <Quiet>
            No complaint has come up often enough to name. That is good news, with one caveat:
            it only covers the feedback we have read.
          </Quiet>
        )}
      </Section>

      <Section eyebrow="Between your last two check-ins" note={changing ? view.changedNote : null}>
        {changing ? (
          <div className="space-y-6">
            {view.better.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-good-700 uppercase">
                  Getting better
                </p>
                <ThemeRows signals={view.better} basePath={basePath} line="movement" />
              </div>
            ) : null}
            {view.worse.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-bad-700 uppercase">
                  Getting worse
                </p>
                <ThemeRows signals={view.worse} basePath={basePath} line="movement" />
              </div>
            ) : null}
            {view.steady.length > 0 ? (
              <p className="text-[13px] leading-relaxed text-ink-500">
                Holding steady: {view.steady.map((s) => s.themeLabel).join('; ')}.
              </p>
            ) : null}
          </div>
        ) : view.steadyLine ? (
          <>
            <Quiet>{view.steadyLine}</Quiet>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{view.changedNote}</p>
          </>
        ) : (
          <Quiet>{view.changedNote}</Quiet>
        )}
      </Section>

      <Section eyebrow="Complaints that keep coming back">
        {view.recurrenceNote ? (
          <Quiet>{view.recurrenceNote}</Quiet>
        ) : view.recurring.length > 0 ? (
          <ThemeRows signals={view.recurring} basePath={basePath} line="none" />
        ) : (
          <Quiet>
            No complaint has been a pattern (3 or more mentions) at more than one check-in yet.
          </Quiet>
        )}
      </Section>

      {!view.recurrenceNote ? (
        <Section eyebrow="New complaints">
          {view.fresh.length > 0 ? (
            <ThemeRows signals={view.fresh} basePath={basePath} line="none" />
          ) : (
            <Quiet>No complaint reached a pattern at your latest check-in for the first time.</Quiet>
          )}
        </Section>
      ) : null}

      {view.early.length > 0 ? (
        <Section eyebrow="Not yet clear">
          <div className="mb-3">
            <ThemeRows signals={view.early} basePath={basePath} />
          </div>
          <Quiet>{view.noAction}</Quiet>
        </Section>
      ) : null}

      <Limits limits={view.limits} />
    </div>
  );
}
