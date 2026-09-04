import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getImprovementsView } from '@/lib/portal/service';
import {
  ActionStory,
  Limits,
  PageIntro,
  Quiet,
  Section,
  ThemeStory,
} from '@/components/portal/portal-ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Improvements' };

/**
 * IMPROVEMENTS — what did we actually do, and did it help? (M12)
 *
 * The loop, end to end, for every change: problem → what RepOS suggested →
 * what you decided → the change → before → after → reading → what we learned
 * → what next. Honest on purpose: feedback that got worse after a change says
 * so, and a change that helped and is slipping says that too. The page is
 * also where the next decision starts.
 */
/**
 * The improvements page, as one implementation behind two doors (M20).
 *
 * Reached either through the owner's secret link (/portal/[token]) or through
 * an authenticated workspace (/workspace/[clientId]). Both resolve to a client
 * id first and neither is trusted here: whoever renders this has already
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
  const view = await getImprovementsView(prisma, client.id);
  if (!view) notFound();

  const empty =
    view.open.length + view.checked.length + view.notPursued.length === 0 && !view.suggested;

  return (
    <>
      <PageIntro
        eyebrow="Improvements"
        title="What you changed, and what happened next"
        description={view.record}
      />

      {empty ? (
        <Quiet>
          Nothing here yet. When you agree to act on something RepOS suggested, it appears here,
          and once enough new feedback has come in we compare how often it comes up before and
          after the change.
        </Quiet>
      ) : null}

      {view.suggested ? (
        <Section eyebrow="Waiting on your decision">
          <ThemeStory signal={view.suggested} basePath={basePath} depth="brief" />
        </Section>
      ) : null}

      {view.open.length > 0 ? (
        <Section eyebrow="In progress">
          <div>
            {view.open.map((a) => (
              <ActionStory key={a.id} action={a} basePath={basePath} />
            ))}
          </div>
        </Section>
      ) : null}

      {view.checked.length > 0 ? (
        <Section eyebrow="Compared with feedback">
          <div>
            {view.checked.map((a) => (
              <ActionStory key={a.id} action={a} basePath={basePath} />
            ))}
          </div>
        </Section>
      ) : null}

      {view.notPursued.length > 0 ? (
        <Section eyebrow="Not pursued">
          <div>
            {view.notPursued.map((a) => (
              <ActionStory key={a.id} action={a} basePath={basePath} />
            ))}
          </div>
        </Section>
      ) : null}

      <Limits
        limits={
          view.checked.length > 0
            ? [
                'A comparison shows how often a theme came up before and after a change. It cannot show that the change caused the difference.',
              ]
            : []
        }
      />
    </>
  );
}
