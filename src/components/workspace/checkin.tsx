import { Link } from '@/components/portal/link';
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
import { getTranslator } from '@/lib/i18n/request';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check-in' };

/**
 * CHECK-IN — the recurring pulse (M24).
 *
 * A ritual, not a report. The whole check-in fits above the fold: the month,
 * one sentence with three counts in it, and three blocks — DO, PROTECT,
 * WATCH — each opening into its own evidence, then the one condition Headway
 * is waiting for before the next check-in is worth opening. The movement
 * between the two check-ins and everything Headway did in between sit behind
 * two reveals for anyone who wants the detail. Home already gives the
 * picture; this page gives the delta, and it gives it first.
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

/**
 * The label an owner reads on each block, in their own language.
 *
 * The block already knows its own kind, and the kind is what the label says —
 * so the phrase is looked up from the dictionary here rather than carried
 * across from the engine as an English string that no translation can reach.
 */
const BLOCK_LABEL = {
  DO: 'checkin.block.do',
  PROTECT: 'checkin.block.protect',
  WATCH: 'checkin.block.watch',
} as const satisfies Record<CheckinBlock['kind'], string>;

/** A block whose item has no theme card to open: the words are the whole of it. */
async function PlainBlock({ block, basePath }: { block: { kind: CheckinBlock['kind']; label: string; item: ResponsibilityItem }; basePath: string }) {
  const { item } = block;
  const t = await getTranslator();
  return (
    <details className="group rounded-xl border border-ink-200 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-2 p-4 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none sm:p-5">
        <span className={clsx('text-[11px] font-semibold tracking-widest uppercase', BLOCK_TONE[block.kind])}>
          {t(BLOCK_LABEL[block.kind])}
        </span>
        <p className="text-[18px] leading-snug font-semibold tracking-tight text-ink-900">
          {item.headline} <Chevron />
        </p>
      </summary>
      <div className="hw-reveal border-t border-ink-200 px-4 py-4 text-[14px] leading-relaxed text-ink-700 sm:px-5">
        <p>{item.whyItMatters}</p>
        <p className="mt-2 text-ink-900">
          <span className="font-medium">{t('checkin.block.next')}</span> {item.recommendedNextStep}
        </p>
        <p className="mt-2 text-[13px] text-ink-500">{item.watching}</p>
        {item.themeKey ? null : (
          <Link
            href={`${basePath}/reviews?needs=reply`}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4"
          >
            {t('checkin.block.needsReply')} <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </details>
  );
}

async function Blocks({ blocks, evidence, basePath }: { blocks: CheckinBlock[]; evidence: EvidenceIndex; basePath: string }) {
  if (blocks.length === 0) return null;
  const t = await getTranslator();
  return (
    <div className={clsx('grid grid-cols-1 items-start gap-3', blocks.length > 1 && 'lg:grid-cols-3')}>
      {blocks.map((block) => (
        <div key={block.kind}>
          <p className={clsx('mb-2 text-[13px] font-semibold tracking-widest uppercase', BLOCK_TONE[block.kind])}>
            {t(BLOCK_LABEL[block.kind])}
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
  const t = await getTranslator();
  const [view, bundle, evidence] = await Promise.all([
    getCheckinView(prisma, client.id, { t }),
    getResponsibility(prisma, client.id, { t }),
    getEvidenceIndex(prisma, client.id),
  ]);
  if (!view || !bundle) notFound();
  const r = bundle.responsibility;

  const moved = view.better.length + view.worse.length + view.returning.length + view.checked.length > 0;
  // Was: a regex over the English of `movementLine`. The view now says so with
  // a flag, so rewording the sentence cannot silently switch the pulse off.
  const compared = view.compared;
  // In the owner's language: the sentence was staying English in Hindi.
  const pulse = checkinPulse(r, bundle.view, compared, t);
  // The page's own intro already names the two check-ins compared.
  const since = {
    ...r,
    // By kind, not by English prefix. This block already names the two
    // check-ins itself, so the engine's "Compared your check-ins…" line would
    // say it twice — but a startsWith on English said it twice in Hindi too,
    // because it matched nothing there.
    did: r.did.filter((_, i) => r.didKinds[i] !== 'compared'),
  };
  const hasDetail =
    moved || view.sinceCheckin.length > 0 || view.made.length > 0 || view.unchangedNote.length > 0;

  return (
    <div>
      <div className="max-w-3xl">
        <PageIntro eyebrow={t('checkin.title')} title={view.title} description={view.periodNote} />
        <PeriodSwitch basePath={basePath} current="checkin" />
      </div>

      {r.basedOn > 0 ? (
        <p className="mb-6 max-w-3xl text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] text-balance text-ink-900 sm:text-[27px]">
          {pulse.sentence}
        </p>
      ) : (
        <div className="mb-6 max-w-3xl">
          <Quiet>{t('checkin.empty')}</Quiet>
        </div>
      )}

      <Blocks blocks={pulse.blocks} evidence={evidence} basePath={basePath} />

      {r.basedOn > 0 ? (
        <section aria-label={t('checkin.nextCheck.title')} className="mt-8 max-w-3xl border-l-2 border-ink-300 pl-4">
          <p className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">{t('checkin.nextCheck.title')}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-800">{r.nextUsefulCheck}</p>
        </section>
      ) : null}

      <div className="mt-10 max-w-3xl space-y-6">
        <Reveal summary={t('checkin.reveal.changed')} tone="strong">
          <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
            <Callout tone={view.worse.length > 0 || view.returning.length > 0 ? 'bad' : moved ? 'good' : 'neutral'}>
              {view.movementLine}
            </Callout>
            {view.unchangedNote ? (
              <p className="mt-2 pl-4 text-[13px] leading-relaxed text-ink-500">{view.unchangedNote}</p>
            ) : null}

            {view.returning.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-bad-700 uppercase">{t('checkin.moved.returning')}</p>
                <ThemeRows signals={view.returning} basePath={basePath} line="movement" showWatch />
              </div>
            ) : null}
            {view.worse.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-bad-700 uppercase">{t('checkin.moved.worse')}</p>
                <ThemeRows signals={view.worse} basePath={basePath} line="movement" />
              </div>
            ) : null}
            {view.better.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-good-700 uppercase">{t('checkin.moved.better')}</p>
                <ThemeRows signals={view.better} basePath={basePath} line="movement" />
              </div>
            ) : null}

            {view.checked.length > 0 || view.made.length > 0 ? (
              <div className="mt-6">
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-700 uppercase">{t('checkin.changes.yours')}</p>
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
                  {t('checkin.changes.comparedSince')}
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
                <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-700 uppercase">{t('checkin.alsoWatching')}</p>
                <WatchList items={view.next.slice(1)} basePath={basePath} />
              </div>
            ) : null}

            {!hasDetail ? (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-500">{t('checkin.nothingToDecide')}</p>
            ) : null}
          </div>
        </Reveal>

        {since.did.length > 0 || r.basedOn > 0 ? (
          <Reveal summary={t('checkin.reveal.did', { since: since.sinceLabel.replace(/^Since /, 'since ') })}>
            <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
              <SinceThen r={since} />
            </div>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}
