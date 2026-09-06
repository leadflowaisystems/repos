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
 * CUSTOMERS — what are my customers collectively telling me? (M12)
 *
 * Every theme read in full: what customers say, what it means, why it
 * matters, what Headway recommends, and the evidence — plus what moved, what
 * keeps coming back, and what is not yet clear. This is the one page that
 * explains the method (what a pattern is, what was compared), so the other
 * pages do not have to.
 *
 * Reached through an authenticated workspace. Whoever renders this has already
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
  // The two-check-in comparison is Check-in's page. It is repeated here only
  // when there is movement to show; "we need two check-ins" is said there.
  const compared = changing || view.steadyLine !== null;
  const acrossCheckins = view.recurring.length + view.fresh.length > 0;

  return (
    <div className="max-w-3xl">
      <PageIntro eyebrow="Customers" title="What your customers are telling you" description={view.basis} />

      {view.soFar.read > 0 || view.soFar.waiting > 0 ? (
        <Section eyebrow="Current signals" note="What customers are mentioning, pattern or not">
          <SoFar soFar={view.soFar} basePath={basePath} explain />
        </Section>
      ) : null}

      {view.telling.length > 0 ? (
        <Section eyebrow="In short">
          <div className="space-y-2">
            {view.telling.map((t) => (
              <p key={t} className="text-[16px] leading-relaxed text-ink-900">
                {t}
              </p>
            ))}
          </div>
        </Section>
      ) : null}

      <Section eyebrow="Strengths" note="Praised by three or more customers">
        {view.loved.length > 0 ? (
          <div>
            {view.loved.map((s) => (
              <ThemeStory key={s.themeKey} signal={s} basePath={basePath} depth="full" />
            ))}
          </div>
        ) : (
          <Quiet>Nothing praised by three or more customers yet.</Quiet>
        )}
      </Section>

      <Section eyebrow="Issues" note="Raised by three or more customers">
        {view.unhappy.length > 0 ? (
          <div>
            {view.unhappy.map((s) => (
              <ThemeStory key={s.themeKey} signal={s} basePath={basePath} depth="full" />
            ))}
          </div>
        ) : (
          <Quiet>No complaint has come up often enough to name, in the feedback read so far.</Quiet>
        )}
      </Section>

      {compared ? (
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
          ) : (
            <>
              <Quiet>{view.steadyLine}</Quiet>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{view.changedNote}</p>
            </>
          )}
        </Section>
      ) : null}

      <Section eyebrow="Across your check-ins" note={acrossCheckins ? 'Complaints that recur, and new ones' : null}>
        {view.recurrenceNote ? (
          <Quiet>{view.recurrenceNote}</Quiet>
        ) : acrossCheckins ? (
          <div className="space-y-6">
            {view.recurring.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-700 uppercase">
                  Keeps coming back
                </p>
                <ThemeRows signals={view.recurring} basePath={basePath} line="none" />
              </div>
            ) : null}
            {view.fresh.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-700 uppercase">
                  New at your latest check-in
                </p>
                <ThemeRows signals={view.fresh} basePath={basePath} line="none" />
              </div>
            ) : null}
          </div>
        ) : (
          <Quiet>No complaint has been a pattern at more than one check-in, and none is new.</Quiet>
        )}
      </Section>

      {view.early.length > 0 ? (
        <Section eyebrow="Not yet clear" note="Mentioned, but not often enough to act on">
          <div className="mb-3">
            <ThemeRows signals={view.early} basePath={basePath} />
          </div>
          <Quiet>{view.noAction}</Quiet>
        </Section>
      ) : null}

      {view.work.length > 0 ? (
        <Section eyebrow="How Headway read this">
          <WorkList work={view.work} />
        </Section>
      ) : null}

      <Limits limits={view.limits} />
    </div>
  );
}
