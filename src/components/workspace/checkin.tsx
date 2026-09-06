import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCheckinView } from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import {
  Callout,
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
 * A recurring ritual, not a report. The owner should leave with one
 * conclusion, one action if there is one, one thing to protect, and one thing
 * Headway will watch next — so those four are said first, in four lines, and
 * the movement is laid out underneath for anyone who wants it. Home already
 * gives the picture; this page gives the delta.
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
  const r = bundle.responsibility;

  const moved = view.better.length + view.worse.length + view.returning.length + view.checked.length > 0;
  // The page's own intro already names the two check-ins compared.
  const since = {
    ...r,
    did: r.did.filter((line) => !line.startsWith('Compared your check-ins')),
  };

  // The four lines an owner leaves with.
  const act = r.needsYou[0] ?? null;
  const protect = r.watching.find((i) => i.state === 'KEEP_DOING') ?? null;
  const next = view.next[0] ?? r.watching.find((i) => i.state !== 'KEEP_DOING') ?? null;
  const nextLabel = next ? ('label' in next ? next.label : next.themeLabel) : null;
  const nextLine = next ? ('next' in next ? next.next : next.watching) : null;

  return (
    <div className="max-w-3xl">
      <PageIntro eyebrow="Check-in" title={view.title} description={view.periodNote} />
      <PeriodSwitch basePath={basePath} current="checkin" />

      <div className="mb-8">
        <Callout tone={view.worse.length > 0 || view.returning.length > 0 ? 'bad' : moved ? 'good' : 'neutral'}>
          {view.movementLine}
        </Callout>
        {view.unchangedNote ? (
          <p className="mt-2 pl-4 text-[13px] leading-relaxed text-ink-500">{view.unchangedNote}</p>
        ) : null}
      </div>

      {act || protect || nextLabel ? (
        <dl className="mb-10 divide-y divide-ink-200 border-y border-ink-200">
          {act ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[7rem_1fr]">
              <dt className="text-[11px] font-semibold tracking-widest text-bad-700 uppercase">Do</dt>
              <dd className="text-[15px] leading-snug text-ink-900">
                {act.headline}{' '}
                <Link
                  href={basePath}
                  className="inline-flex min-h-11 items-center text-[13px] font-medium text-ink-700 hover:text-ink-900 sm:min-h-0"
                >
                  See what to decide →
                </Link>
              </dd>
            </div>
          ) : null}
          {protect ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[7rem_1fr]">
              <dt className="text-[11px] font-semibold tracking-widest text-good-700 uppercase">Protect</dt>
              <dd className="text-[15px] leading-snug text-ink-900">
                {protect.themeLabel ?? protect.headline}
                {protect.evidence ? (
                  <span className="text-[13px] text-ink-500"> · {protect.evidence.count} of {protect.evidence.outOf}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {nextLabel ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[7rem_1fr]">
              <dt className="text-[11px] font-semibold tracking-widest text-brand-700 uppercase">Watching</dt>
              <dd className="text-[15px] leading-snug text-ink-900">
                {nextLabel}
                {nextLine ? <span className="block text-[13px] leading-relaxed text-ink-600">{nextLine}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

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

      {view.next.length > 1 ? (
        <Section eyebrow="Also being watched">
          <WatchList items={view.next.slice(1)} basePath={basePath} />
        </Section>
      ) : null}

      {!moved && view.sinceCheckin.length === 0 && view.made.length === 0 ? (
        <Quiet>Nothing needs a decision from this check-in.</Quiet>
      ) : null}

      {since.did.length > 0 || r.basedOn > 0 ? (
        <Section eyebrow={since.sinceLabel} note="What Headway did">
          <SinceThen r={since} />
        </Section>
      ) : null}
    </div>
  );
}
