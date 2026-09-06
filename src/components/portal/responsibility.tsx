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
          'inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase',
          STATE_TONE[item.state],
        )}
      >
        {item.stateLabel}
      </span>
      <span className="text-[12px] font-medium text-ink-600">{item.instruction}</span>
    </span>
  );
}

const ANSWER_CARD: Record<ResponsibilityState, string> = {
  DO_NOW: 'border-ink-900 bg-white',
  FOLLOW_UP: 'border-warn-200 bg-warn-50',
  WATCH: 'border-ink-200 bg-white',
  KEEP_DOING: 'border-good-200 bg-good-50',
  WAITING_FOR_EVIDENCE: 'border-ink-200 bg-white',
  CLEAR: 'border-good-200 bg-good-50',
};

/**
 * The answer, as the one card on the page — and a door.
 *
 * When something needs the owner, the card names it and links straight to
 * the comments behind it, so "yes" is never a sentence to scroll away from.
 */
export function Answer({ r, basePath }: { r: Responsibility; basePath: string }) {
  const top = r.needsYou[0] ?? null;
  const evidence = top?.themeKey
    ? `${basePath}/reviews?theme=${encodeURIComponent(top.themeKey)}`
    : top
      ? `${basePath}/reviews?needs=reply`
      : null;
  return (
    <section className={clsx('mb-8 rounded-xl border p-4 sm:p-5', ANSWER_CARD[r.state])}>
      <div className="mb-2 flex items-center gap-2">
        <span className={clsx('h-2 w-2 rounded-full', ANSWER_DOT[r.state])} aria-hidden />
        <h2 className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
          Do I need to do anything?
        </h2>
      </div>
      <p className="text-[20px] leading-snug font-semibold tracking-tight text-ink-900 sm:text-[22px]">
        {r.answer}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{r.answerDetail}</p>
      {top && evidence ? (
        <Link
          href={evidence}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-ink-900 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
        >
          {top.themeLabel ? `Read what customers said about ${top.themeLabel.toLowerCase()}` : 'Read the comments that need you'}{' '}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </section>
  );
}

/** The continuity thread: what customers said → what you decided → what happened → now → next. */
function Thread({ steps }: { steps: ThreadStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-3 space-y-1.5 border-l border-ink-200 pl-4">
      {steps.map((s) => (
        <li key={s.key} className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_1fr]">
          <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
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
            className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-ink-700 hover:text-ink-900"
          >
            Read them <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {item.thread.length > 1 ? (
        <details className="mt-3 group">
          <summary className="inline-flex min-h-9 cursor-pointer items-center list-none text-[12px] font-medium text-ink-600 hover:text-ink-900">
            How we got here <span aria-hidden>›</span>
          </summary>
          <Thread steps={item.thread} />
        </details>
      ) : null}

      {item.relatedAction ? (
        <div className="mt-2">
          <Link
            href={`${basePath}/improvements`}
            className="inline-flex min-h-9 items-center text-[13px] font-medium text-ink-700 hover:text-ink-900"
          >
            See the improvement →
          </Link>
        </div>
      ) : null}
    </article>
  );
}

/**
 * A compact row for what RepOS is carrying.
 *
 * Three things an owner needs to be able to stop thinking about a topic:
 * WHAT it is, WHY it is worth carrying at all, and WHEN RepOS will say
 * something. Each is labelled, so the promise is explicit — "I don't have to
 * remember this; RepOS will" is only true if the owner can see the condition
 * that brings it back.
 */
function WatchingRow({ item, basePath }: { item: ResponsibilityItem; basePath: string }) {
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <StateChip item={item} />
        {item.evidence ? (
          <span className="text-[12px] text-ink-500 tabular-nums">
            {item.evidence.count} of {item.evidence.outOf}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[15px] leading-snug font-semibold text-ink-900">{item.headline}</p>
      <dl className="mt-1.5 space-y-1">
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[5.5rem_1fr]">
          <dt className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">Why</dt>
          <dd className="text-[13px] leading-relaxed text-ink-700">{item.whyItMatters}</dd>
        </div>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[5.5rem_1fr]">
          <dt className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
            We&rsquo;ll flag it
          </dt>
          <dd className="text-[13px] leading-relaxed text-ink-700">{item.watching}</dd>
        </div>
        {item.contextUsed.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[5.5rem_1fr]">
            <dt className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
              You told us
            </dt>
            <dd className="text-[13px] leading-relaxed text-ink-700 italic">{item.contextUsed[0]}</dd>
          </div>
        ) : null}
      </dl>
      {item.themeKey ? (
        <div className="mt-2">
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

/**
 * A strength, with the proof. Not a badge and not a score: the customers'
 * count, RepOS's reading of why it matters, and one tap to the words.
 */
function StrengthRow({ item, basePath }: { item: ResponsibilityItem; basePath: string }) {
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <StateChip item={item} />
        {item.evidence ? (
          <span className="text-[12px] text-ink-500 tabular-nums">
            {item.evidence.count} of {item.evidence.outOf}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[15px] leading-snug font-semibold text-ink-900">{item.headline}</p>
      {item.evidence ? (
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{item.evidence.line}</p>
      ) : null}
      <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{item.recommendedNextStep}</p>
      {item.themeKey ? (
        <div className="mt-1.5">
          <EvidenceLink basePath={basePath} themeKey={item.themeKey} count={item.evidence?.count} />
        </div>
      ) : null}
    </li>
  );
}

export function StrengthsList({ items, basePath }: { items: ResponsibilityItem[]; basePath: string }) {
  return (
    <ul className="divide-y divide-ink-200 border-y border-ink-200">
      {items.map((item) => (
        <StrengthRow key={item.id} item={item} basePath={basePath} />
      ))}
    </ul>
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
