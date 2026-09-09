import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getEvidenceIndex, getImprovementsView } from '@/lib/portal/service';
import { PageIntro, Quiet, Section } from '@/components/portal/portal-ui';
import { ImprovementStory } from '@/components/workspace/improvement-story';
import { SignalCard } from '@/components/workspace/signal-board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Improvements' };

/**
 * IMPROVEMENTS — what did we actually do, and did it help? (M24)
 *
 * The page that proves Headway remembers. Every change is told as three
 * moments — the problem, what you changed, what Headway found when it
 * checked again — with the before and after numbers as the largest things
 * on the page, then what happened, what it means and what to do now in three
 * labelled lines. The numbers, the evidence and how it started open on
 * request. Honest on purpose: feedback that got worse after a change says
 * so, and a change that helped and is slipping says that too.
 *
 * Reached through an authenticated workspace. Whoever renders this has already
 * decided the caller may see this business.
 */
export async function PortalImprovements({
  clientId,
  basePath,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
}) {
  const client = { id: clientId };
  const [view, evidence] = await Promise.all([
    getImprovementsView(prisma, client.id),
    getEvidenceIndex(prisma, client.id),
  ]);
  if (!view) notFound();

  const empty =
    view.open.length + view.checked.length + view.notPursued.length === 0 && !view.suggested;

  return (
    <div>
      <div className="max-w-3xl">
        <PageIntro
          eyebrow="Improvements"
          title="What you changed, and what happened next"
          description={view.record}
        />
      </div>

      {empty ? (
        <Quiet>
          Nothing here yet. When you make a change Headway suggested, this page will compare
          the feedback from before and after it.
        </Quiet>
      ) : null}

      {view.checked.length > 0 ? (
        <Section eyebrow="Changes compared" note="How often the topic came up before and after">
          <div className="space-y-5">
            {view.checked.map((a) => (
              <ImprovementStory key={a.id} action={a} evidence={evidence} basePath={basePath} />
            ))}
          </div>
        </Section>
      ) : null}

      {view.open.length > 0 ? (
        <Section eyebrow="In progress">
          <div className="space-y-5">
            {view.open.map((a) => (
              <ImprovementStory key={a.id} action={a} evidence={evidence} basePath={basePath} />
            ))}
          </div>
        </Section>
      ) : null}

      {view.suggested ? (
        <Section eyebrow="Waiting on your decision" note="Headway has suggested a change">
          <div className="max-w-3xl">
            <SignalCard signal={view.suggested} group="NEEDS_YOU" evidence={evidence} basePath={basePath} />
          </div>
        </Section>
      ) : null}

      {view.notPursued.length > 0 ? (
        <Section eyebrow="Not doing">
          <div className="space-y-5">
            {view.notPursued.map((a) => (
              <ImprovementStory key={a.id} action={a} evidence={evidence} basePath={basePath} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
