import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getAnalysisView, getEvidenceIndex } from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { Callout, Limits, PageIntro, Quiet, Section, SoFar, ThemeRows, WorkList } from '@/components/portal/portal-ui';
import { Reveal } from '@/components/portal/disclose';
import { SignalBoard, type SignalGroup } from '@/components/workspace/signal-board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customers' };

type Search = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/**
 * CUSTOMERS — the signal board (M24).
 *
 * What customers are collectively telling the business, by importance:
 * NEEDS YOU, WATCHING, PROTECT, NOT YET CLEAR. Each signal is a card an owner
 * scans in a second — the theme, the count, the share, the direction where
 * two check-ins were compared — and opens in place into the whole reading:
 * three customers in their words, what Headway sees, what to do, why, and
 * where the number came from. Nobody has to leave the page to understand
 * one signal.
 *
 * The movement between check-ins and the method sit behind two reveals. This
 * is still the one page that explains how Headway read the feedback, so the
 * method is here and not on any other page — it just no longer comes first.
 */
export async function PortalAnalysis({
  clientId,
  basePath,
  searchParams,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  searchParams?: Promise<Search>;
}) {
  const client = { id: clientId };
  const [view, bundle, evidence, search] = await Promise.all([
    getAnalysisView(prisma, client.id),
    getResponsibility(prisma, client.id),
    getEvidenceIndex(prisma, client.id),
    searchParams ?? Promise.resolve({} as Search),
  ]);
  if (!view || !bundle) notFound();
  const r = bundle.responsibility;
  const open = one(search.open).slice(0, 80) || null;

  const needsYou = new Set(r.needsYou.map((i) => i.themeKey).filter((k): k is string => k !== null));
  const groups: SignalGroup[] = [
    {
      key: 'NEEDS_YOU',
      label: 'Needs you',
      note: 'The one thing worth a decision',
      signals: view.unhappy.filter((s) => needsYou.has(s.themeKey)),
    },
    {
      key: 'WATCHING',
      label: 'Watching',
      note: 'Patterns Headway is carrying for you',
      signals: [
        ...view.unhappy.filter((s) => !needsYou.has(s.themeKey) && s.bucket !== 'EARLY'),
        ...view.loved.filter((s) => s.bucket === 'WATCH'),
      ],
    },
    {
      key: 'PROTECT',
      label: 'Protect',
      note: 'Praised by three or more customers',
      signals: view.loved.filter((s) => s.bucket === 'KEEP' || (s.bucket !== 'WATCH' && s.bucket !== 'EARLY')),
    },
    {
      key: 'EARLY',
      label: 'Not yet clear',
      note: 'Mentioned, but not often enough to act on',
      signals: view.early,
    },
  ];
  const named = groups.some((g) => g.signals.length > 0);

  const changing = view.better.length + view.worse.length > 0;
  const compared = changing || view.steadyLine !== null;

  return (
    <div className="max-w-3xl">
      <PageIntro eyebrow="Customers" title="What your customers are telling you" description={view.basis} />

      {view.telling.length > 0 ? (
        <div className="mb-8 max-w-2xl">
          {view.telling.map((t, index) => (
            <p
              key={t}
              className={
                index === 0
                  ? 'text-[17px] leading-snug font-medium text-ink-900 sm:text-[19px]'
                  : 'mt-2 text-[15px] leading-relaxed text-ink-700'
              }
            >
              {t}
            </p>
          ))}
        </div>
      ) : null}

      {named ? (
        <SignalBoard groups={groups} evidence={evidence} basePath={basePath} open={open} />
      ) : view.soFar.read > 0 || view.soFar.waiting > 0 ? (
        <Section eyebrow="Current signals" note="What customers are mentioning, pattern or not">
          <SoFar soFar={view.soFar} basePath={basePath} explain />
        </Section>
      ) : (
        <Quiet>Your first customer signals will appear here. Headway is ready.</Quiet>
      )}

      {view.early.length > 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">{view.noAction}</p>
      ) : null}

      {compared ? (
        <div className="mt-10">
          <Reveal summary="Show what changed between your check-ins" tone="strong">
            <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
              <p className="text-[12px] leading-relaxed text-ink-500">{view.changedNote}</p>
              {changing ? (
                <div className="mt-4 space-y-6">
                  {view.worse.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-bad-700 uppercase">
                        Getting worse
                      </p>
                      <ThemeRows signals={view.worse} basePath={basePath} line="movement" />
                    </div>
                  ) : null}
                  {view.better.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-good-700 uppercase">
                        Getting better
                      </p>
                      <ThemeRows signals={view.better} basePath={basePath} line="movement" />
                    </div>
                  ) : null}
                  {view.steady.length > 0 ? (
                    <p className="text-[13px] leading-relaxed text-ink-500">
                      Holding steady: {view.steady.map((s) => s.themeLabel).join('; ')}.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3">
                  <Callout tone="neutral">{view.steadyLine}</Callout>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      ) : null}

      {named ? (
        <div className="mt-6">
          <Reveal summary="How Headway read this">
            <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
              {view.work.length > 0 ? <WorkList work={view.work} /> : null}
              {view.recurrenceNote ? (
                <p className="mt-3 text-[13px] leading-relaxed text-ink-500">{view.recurrenceNote}</p>
              ) : null}
              <div className="mt-4 border-t border-ink-200 pt-4">
                <p className="mb-2 text-[11px] font-medium tracking-widest text-ink-500 uppercase">
                  Everything mentioned, pattern or not
                </p>
                <SoFar soFar={view.soFar} basePath={basePath} explain />
              </div>
            </div>
          </Reveal>
        </div>
      ) : null}

      <Limits limits={view.limits} />
    </div>
  );
}
