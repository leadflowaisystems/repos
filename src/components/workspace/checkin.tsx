import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCheckinView, getEvidenceIndex } from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { checkinPulse, type CheckinBlock } from '@/lib/portal/focus';
import type { ResponsibilityItem } from '@/lib/responsibility/engine';
import {
  Callout,
  OutcomeRow,
  PageIntro,
  PeriodSwitch,
  Quiet,
  ThemeRows,
  WatchList,
} from '@/components/portal/portal-ui';
import { Chevron, Reveal } from '@/components/portal/disclose';
import { SinceThen } from '@/components/portal/responsibility';
import { SignalCard, type SignalGroupKey } from '@/components/workspace/signal-board';
import type { EvidenceIndex } from '@/lib/portal/evidence';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check-in' };

/**
 * CHECK-IN — the recurring pulse (M24).
 *
 * A ritual, not a report. The whole check-in fits above the fold: the month,
 * one sentence with three counts in it, and three blocks — DO, PROTECT,
 * WATCH — each opening into its own evidence. The movement between the two
 * check-ins and everything Headway did in between sit behind two reveals for
 * anyone who wants the detail. Home already gives the picture; this page
 * gives the delta, and it gives it first.
 */

const BLOCK_GROUP: Record<CheckinBlock['kind'], SignalGroupKey> = {
  DO: 'NEEDS_YOU',
  PROTECT: 'PROTECT',
  WATCH: 'WATCHING',
};

const BLOCK_TONE: Record<CheckinBlock['kind'], string> = {
  DO: 'text-bad-700',
  PROTECT: 'text-good-700',
  WATCH: 'text-brand-700',
};

/** A block whose item has no theme card to open: the words are the whole of it. */
function PlainBlock({ block, basePath }: { block: { kind: CheckinBlock['kind']; label: string; item: ResponsibilityItem }; basePath: string }) {
  const { item } = block;
  return (
    <details className="group rounded-xl border border-ink-200 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-2 p-4 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none sm:p-5">
        <span className={clsx('text-[11px] font-semibold tracking-widest uppercase', BLOCK_TONE[block.kind])}>
          {block.label}
        </span>
        <p className="text-[18px] leading-snug font-semibold tracking-tight text-ink-900">
          {item.headline} <Chevron />
        </p>
      </summary>
      <div className="hw-reveal border-t border-ink-200 px-4 py-4 text-[14px] leading-relaxed text-ink-700 sm:px-5">
        <p>{item.whyItMatters}</p>
        <p className="mt-2 text-ink-900">
          <span className="font-medium">Next.</span> {item.recommendedNextStep}
        </p>
        <p className="mt-2 text-[13px] text-ink-500">{item.watching}</p>
        {item.themeKey ? null : (
          <Link
            href={`${basePath}/reviews?needs=reply`}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4"
          >
            Read them <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </details>
  );
}

function Blocks({ blocks, evidence, basePath }: { blocks: CheckinBlock[]; evidence: EvidenceIndex; basePath: string }) {
  if (blocks.length === 0) return null;
  return (
    <div className={clsx('grid grid-cols-1 items-start gap-3', blocks.length > 1 && 'lg:grid-cols-3')}>
      {blocks.map((block) => (
        <div key={block.kind}>
          <p className={clsx('mb-2 text-[13px] font-semibold tracking-widest uppercase', BLOCK_TONE[block.kind])}>
            {block.label}
          </p>
          {block.signal ? (
            <SignalCard signal={block.signal} group={BLOCK_GROUP[block.kind]} evidence={evidence} basePath={basePath} />
          ) : (
            <PlainBlock block={block} basePath={basePath} />
          )}
        </div>
      ))}
    </div>
  );
}

export async function PortalCheckin({
  clientId,
  basePath,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
}) {
  const client = { id: clientId };
  const [view, bundle, evidence] = await Promise.all([
    getCheckinView(prisma, client.id),
    getResponsibility(prisma, client.id),
    getEvidenceIndex(prisma, client.id),
  ]);
  if (!view || !bundle) notFound();
  const r = bundle.responsibility;

  const moved = view.better.length + view.worse.length + view.returning.length + view.checked.length > 0;
  const compared = /^Since your check-in|^Nothing moved enough/.test(view.movementLine);
  const pulse = checkinPulse(r, bundle.view, compared);
  // The page's own intro already names the two check-ins compared.
  const since = {
    ...r,
    did: r.did.filter((line) => !line.startsWith('Compared your check-ins')),
  };
  const hasDetail =
    moved || view.sinceCheckin.length > 0 || view.made.length > 0 || view.unchangedNote.length > 0;

  return (
    <div>
      <div className="max-w-3xl">
        <PageIntro eyebrow="Check-in" title={view.title} description={view.periodNote} />
        <PeriodSwitch basePath={basePath} current="checkin" />
      </div>

      {r.basedOn > 0 ? (
        <p className="mb-6 max-w-3xl text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] text-balance text-ink-900 sm:text-[27px]">
          {pulse.sentence}
        </p>
      ) : (
        <div className="mb-6 max-w-3xl">
          <Quiet>Once feedback starts coming in, each check-in says what needs you, what to protect and what Headway is watching.</Quiet>
        </div>
      )}

      <Blocks blocks={pulse.blocks} evidence={evidence} basePath={basePath} />

      <div className="mt-10 max-w-3xl space-y-6">
        <Reveal summary="Show what changed" tone="strong">
          <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
            <Callout tone={view.worse.length > 0 || view.returning.length > 0 ? 'bad' : moved ? 'good' : 'neutral'}>
              {view.movementLine}
            </Callout>
            {view.unchangedNote ? (
              <p className="mt-2 pl-4 text-[13px] leading-relaxed text-ink-500">{view.unchangedNote}</p>
            ) : null}

            {view.returning.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-bad-700 uppercase">Coming back</p>
                <ThemeRows signals={view.returning} basePath={basePath} line="movement" showWatch />
              </div>
            ) : null}
            {view.worse.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-bad-700 uppercase">Got worse</p>
                <ThemeRows signals={view.worse} basePath={basePath} line="movement" />
              </div>
            ) : null}
            {view.better.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-good-700 uppercase">Improved</p>
                <ThemeRows signals={view.better} basePath={basePath} line="movement" />
              </div>
            ) : null}

            {view.checked.length > 0 || view.made.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-700 uppercase">Changes you made</p>
                <ul className="divide-y divide-ink-200 border-y border-ink-200">
                  {view.checked.map((a) => (
                    <OutcomeRow key={a.id} action={a} basePath={basePath} />
                  ))}
                  {view.made.map((a) => (
                    <OutcomeRow key={a.id} action={a} basePath={basePath} />
                  ))}
                </ul>
              </div>
            ) : null}

            {view.sinceCheckin.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-700 uppercase">
                  Compared since this check-in
                </p>
                <ul className="divide-y divide-ink-200 border-y border-ink-200">
                  {view.sinceCheckin.map((a) => (
                    <OutcomeRow key={a.id} action={a} basePath={basePath} />
                  ))}
                </ul>
              </div>
            ) : null}

            {view.next.length > 1 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-700 uppercase">Also being watched</p>
                <WatchList items={view.next.slice(1)} basePath={basePath} />
              </div>
            ) : null}

            {!hasDetail ? (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-500">Nothing needs a decision from this check-in.</p>
            ) : null}
          </div>
        </Reveal>

        {since.did.length > 0 || r.basedOn > 0 ? (
          <Reveal summary={`What Headway did · ${since.sinceLabel.replace(/^Since /, 'since ')}`}>
            <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
              <SinceThen r={since} />
            </div>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}
