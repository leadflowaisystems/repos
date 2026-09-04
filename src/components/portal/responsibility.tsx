import Link from 'next/link';
import clsx from 'clsx';
import type {
  Responsibility,
  ResponsibilityItem,
  ResponsibilityState,
  ThreadStep,
} from '@/lib/responsibility/engine';
import type { PortalSignal } from '@/lib/portal/view';
import { formatDate } from '@/lib/format';
import { EvidenceLink, ThemeStory } from './portal-ui';

/**
 * RESPONSIBILITY, AS THE OWNER SEES IT (M15).
 *
 * The spine of Home. One answer at the top — do I need to do anything? — then
 * the things that need the owner, then the things RepOS is carrying for them,
 * then what RepOS did since the last check-in and when the next check would
 * actually show something.
 *
 * Renders what the responsibility object already decided and adds nothing.
 * The theme stories underneath are M12's own components: the same four
 * labelled layers, placed under the state that explains why they are here.
 */

const STATE_TONE: Record<ResponsibilityState, string> = {
  DO_NOW: 'bg-ink-900 text-white',
  FOLLOW_UP: 'bg-warn-600 text-white',
  WATCH: 'bg-ink-100 text-ink-700',
  KEEP_DOING: 'bg-good-600 text-white',
  WAITING_FOR_EVIDENCE: 'bg-ink-100 text-ink-600',
  CLEAR: 'bg-ink-100 text-ink-600',
};

const ANSWER_DOT: Record<ResponsibilityState, string> = {
  DO_NOW: 'bg-bad-600',
  FOLLOW_UP: 'bg-warn-600',
  WATCH: 'bg-ink-400',
  KEEP_DOING: 'bg-good-600',
  WAITING_FOR_EVIDENCE: 'bg-ink-300',
  CLEAR: 'bg-good-600',
};

const SOURCE_LABELS: Record<ThreadStep['source'], string> = {
  CUSTOMERS: 'Customers',
  YOU: 'You',
  REPOS: 'RepOS',
};

function StateChip({ item }: { item: ResponsibilityItem }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        className={clsx(
          'inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
          STATE_TONE[item.state],
        )}
      >
        {item.stateLabel}
      </span>
      <span className="text-[12px] font-medium text-ink-600">{item.instruction}</span>
    </span>
  );
}

/** The answer, in the largest type after the picture. */
export function Answer({ r }: { r: Responsibility }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <span className={clsx('h-2 w-2 rounded-full', ANSWER_DOT[r.state])} aria-hidden />
        <span className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
          Do I need to do anything?
        </span>
      </div>
      <p className="text-[20px] leading-snug font-semibold tracking-tight text-ink-900 sm:text-[22px]">
        {r.answer}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{r.answerDetail}</p>
    </div>
  );
}

/** The continuity thread: what customers said → what you decided → what happened → now → next. */
function Thread({ steps }: { steps: ThreadStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-3 space-y-1.5 border-l border-ink-200 pl-4">
      {steps.map((s) => (
        <li key={s.key} className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]">
          <p className="text-[10px] font-semibold tracking-widest text-ink-400 uppercase">
            {s.label}
            <span className="ml-1 font-normal normal-case tracking-normal text-ink-400">
              · {SOURCE_LABELS[s.source]}
            </span>
          </p>
          <p className={clsx('text-[13px] leading-relaxed', s.source === 'YOU' ? 'text-ink-700 italic' : 'text-ink-700')}>
            {s.text}
            {s.at ? <span className="ml-1.5 text-[11px] text-ink-400 not-italic">{formatDate(s.at)}</span> : null}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * One thing that needs the owner. The theme's own story (M12) sits under the
 * state that put it here; the thread and the watch line are what this layer
 * adds. Items with no theme — feedback that needs the owner's words — get a
 * compact block instead.
 */
export function NeedsYouItem({
  item,
  signal,
  basePath,
  lead,
}: {
  item: ResponsibilityItem;
  signal: PortalSignal | null;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  lead: boolean;
}) {
  return (
    <article
      className={clsx(
        'py-5',
        lead ? 'border-l-2 border-ink-900 pl-5 sm:pl-6' : 'border-t border-ink-200',
      )}
    >
      <StateChip item={item} />
      <h3 className="mt-2 text-[18px] leading-snug font-semibold tracking-tight text-ink-900 sm:text-[20px]">
        {item.headline}
      </h3>

      {signal ? (
        <div className="mt-2">
          <ThemeStory signal={signal} basePath={basePath} depth="brief" untitled />
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-[14px] leading-relaxed text-ink-700">{item.whyItMatters}</p>
          <p className="text-[14px] leading-relaxed text-ink-900">
            <span className="font-medium">Next.</span> {item.recommendedNextStep}
          </p>
          <Link
            href={`${basePath}/reviews?needs=reply`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-700 hover:text-ink-900"
          >
            Read them <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {item.thread.length > 1 ? (
        <details className="mt-3 group">
          <summary className="cursor-pointer list-none text-[12px] font-medium text-ink-600 hover:text-ink-900">
            How we got here <span aria-hidden>›</span>
          </summary>
          <Thread steps={item.thread} />
        </details>
      ) : null}

      {item.relatedAction ? (
        <div className="mt-2">
          <Link
            href={`${basePath}/improvements`}
            className="text-[13px] font-medium text-ink-700 hover:text-ink-900"
          >
            See the improvement →
          </Link>
        </div>
      ) : null}
    </article>
  );
}

/** A compact row for what RepOS is carrying: watching, protecting, waiting. */
function WatchingRow({ item, basePath }: { item: ResponsibilityItem; basePath: string }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <StateChip item={item} />
        {item.evidence ? (
          <span className="text-[12px] text-ink-500 tabular-nums">
            {item.evidence.count} of {item.evidence.outOf}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[15px] leading-snug font-semibold text-ink-900">{item.headline}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{item.watching}</p>
      {item.contextUsed.length > 0 ? (
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600 italic">{item.contextUsed[0]}</p>
      ) : null}
      {item.themeKey ? (
        <div className="mt-1.5">
          <EvidenceLink
            basePath={basePath}
            themeKey={item.themeKey}
            count={item.evidence?.count}
            label={item.evidence ? undefined : 'Read the comments'}
          />
        </div>
      ) : null}
    </li>
  );
}

export function WatchingList({ items, basePath }: { items: ResponsibilityItem[]; basePath: string }) {
  return (
    <ul className="divide-y divide-ink-200 border-y border-ink-200">
      {items.map((item) => (
        <WatchingRow key={item.id} item={item} basePath={basePath} />
      ))}
    </ul>
  );
}

/** What RepOS did since the last check-in, and when the next check would show something. */
export function SinceThen({ r }: { r: Responsibility }) {
  return (
    <div>
      {r.did.length > 0 ? (
        <ul className="space-y-1">
          {r.did.map((line) => (
            <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-600">
              <span aria-hidden className="mt-[3px] text-[11px] text-ink-400">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 border-l-2 border-ink-300 pl-3 text-[13px] leading-relaxed text-ink-700">
        <span className="font-medium text-ink-900">Next check.</span> {r.nextUsefulCheck}
      </p>
    </div>
  );
}
