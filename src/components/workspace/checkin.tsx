import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCheckinView } from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import {
  Callout,
  Limits,
  OutcomeRow,
  PageIntro,
  PeriodSwitch,
  Quiet,
  Section,
  ThemeRows,
  WatchList,
} from '@/components/portal/portal-ui';
import { SinceThen } from '@/components/portal/responsibility';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check-in' };

/**
 * CHECK-IN — what changed since the previous check-in? (M12, with M15's
 * "since then" thread)
 *
 * Movement only. Home already gives the picture; this page gives the delta:
 * what improved, what got worse, what came back, what was compared, and what
 * RepOS will look at next for the things that moved. When nothing moved, it
 * says so in one line. At the end, what RepOS did since this check-in and
 * when the next one would actually show something.
 */
/**
 * The checkin page, as one implementation behind two doors (M20).
 *
 * Reached either through the owner's secret link (/portal/[token]) or through
 * an authenticated workspace (/workspace/[clientId]). Both resolve to a client
 * id first and neither is trusted here: whoever renders this has already
 * decided the caller may see this business.
 */
export async function PortalCheckin({
  clientId,
  basePath,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
}) {
  const client = { id: clientId };
  const [view, bundle] = await Promise.all([
    getCheckinView(prisma, client.id),
    getResponsibility(prisma, client.id),
  ]);
  if (!view || !bundle) notFound();

  const moved = view.better.length + view.worse.length + view.returning.length + view.checked.length > 0;
  // The page's own intro already names the two check-ins compared.
  const since = {
    ...bundle.responsibility,
    did: bundle.responsibility.did.filter((line) => !line.startsWith('Compared your check-ins')),
  };

  return (
    <>
      <PageIntro eyebrow="Check-in" title={view.title} description={view.periodNote} />
      <PeriodSwitch basePath={basePath} current="checkin" />

      <div className="mb-10">
        <Callout tone={view.worse.length > 0 || view.returning.length > 0 ? 'warn' : moved ? 'good' : 'neutral'}>
          {view.movementLine}
        </Callout>
        {view.unchangedNote ? (
          <p className="mt-2 pl-4 text-[13px] leading-relaxed text-ink-500">{view.unchangedNote}</p>
        ) : null}
      </div>

      {view.returning.length > 0 ? (
        <Section eyebrow="Coming back">
          <ThemeRows signals={view.returning} basePath={basePath} line="movement" showWatch />
        </Section>
      ) : null}

      {view.worse.length > 0 ? (
        <Section eyebrow="Got worse">
          <ThemeRows signals={view.worse} basePath={basePath} line="movement" />
        </Section>
      ) : null}

      {view.better.length > 0 ? (
        <Section eyebrow="Improved">
          <ThemeRows signals={view.better} basePath={basePath} line="movement" />
        </Section>
      ) : null}

      {view.checked.length > 0 || view.made.length > 0 ? (
        <Section eyebrow="Changes you made">
          <ul className="divide-y divide-ink-200 border-y border-ink-200">
            {view.checked.map((a) => (
              <OutcomeRow key={a.id} action={a} basePath={basePath} />
            ))}
            {view.made.map((a) => (
              <OutcomeRow key={a.id} action={a} basePath={basePath} />
            ))}
          </ul>
        </Section>
      ) : null}

      {view.sinceCheckin.length > 0 ? (
        <Section eyebrow="Compared since this check-in" note="After the check-in above was recorded">
          <ul className="divide-y divide-ink-200 border-y border-ink-200">
            {view.sinceCheckin.map((a) => (
              <OutcomeRow key={a.id} action={a} basePath={basePath} />
            ))}
          </ul>
        </Section>
      ) : null}

      {view.next.length > 0 ? (
        <Section eyebrow="What RepOS will look at next">
          <WatchList items={view.next} basePath={basePath} />
        </Section>
      ) : null}

      {!moved && view.sinceCheckin.length === 0 && view.made.length === 0 ? (
        <Quiet>
          Nothing needs a decision from this check-in. The picture and the priorities are on Home.
        </Quiet>
      ) : null}

      {since.did.length > 0 || bundle.responsibility.basedOn > 0 ? (
        <Section eyebrow={since.sinceLabel} note="What RepOS did">
          <SinceThen r={since} />
        </Section>
      ) : null}

      <Limits limits={view.limits} />
    </>
  );
}
