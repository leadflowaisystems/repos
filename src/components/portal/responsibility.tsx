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
import { Chevron } from './disclose';
import { EvidenceLink, ThemeStory } from './portal-ui';

/**
 * RESPONSIBILITY, AS THE OWNER SEES IT (M15, compacted in M24).
 *
 * The things Headway is carrying for the owner and the things going well,
 * each as one line an owner can scan, opening into why it is being carried
 * and exactly what would make Headway interrupt them about it. The one thing
 * that needs the owner is no longer here: it is the focus block at the top
 * of Home. What remains is the counterweight that makes the focus block's
 * "no" believable — here is what we are holding, and here is the condition
 * that brings it back to you.
 *
 * Renders what the responsibility object already decided and adds nothing.
 */

/**
 * The state chips.
 *
 * Only DO_NOW keeps a saturated fill, and it is navy: white on #102A43 is
 * 14.6:1 and it is the one chip that should stop an owner. The rest became pale
 * grounds with dark type, for two reasons that arrived together. White on gold
 * is 3.1:1 and on green 3.3:1 — both fail — and a second saturated gold chip a
 * few hundred pixels under the gold call to action was competing with the one
 * thing gold is supposed to mean.
 */
const STATE_TONE: Record<ResponsibilityState, string> = {
  DO_NOW: 'bg-ink-900 text-white',
  FOLLOW_UP: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 ring-inset',
  WATCH: 'bg-ink-100 text-ink-700',
  KEEP_DOING: 'bg-good-50 text-good-700 ring-1 ring-good-200 ring-inset',
  WAITING_FOR_EVIDENCE: 'bg-ink-100 text-ink-600',
  CLEAR: 'bg-ink-100 text-ink-600',
};

const SOURCE_LABELS: Record<ThreadStep['source'], string> = {
  CUSTOMERS: 'Customers',
  YOU: 'You',
  REPOS: 'Headway',
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
 * A second thing that needs the owner, after the focus block has taken the
 * first. The theme's own story (M12) sits under the state that put it here;
 * the thread and the watch line are what this layer adds. Items with no
 * theme — feedback that needs the owner's words — get a compact block instead.
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
        lead ? 'border-l-2 border-ink-900 pl-5 sm:pl-6' : 'border-t border-ink-200 first:border-t-0 first:pt-0',
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
            className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-700 hover:text-ink-900"
          >
            Read them <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {item.thread.length > 1 ? (
        <details className="mt-3 group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center list-none text-[12px] font-medium text-ink-600 hover:text-ink-900">
            How we got here <span aria-hidden>›</span>
          </summary>
          <Thread steps={item.thread} />
        </details>
      ) : null}

      {item.relatedAction ? (
        <div className="mt-2">
          <Link
            href={`${basePath}/improvements`}
            className="inline-flex min-h-11 items-center text-[13px] font-medium text-ink-700 hover:text-ink-900"
          >
            See the improvement →
          </Link>
        </div>
      ) : null}
    </article>
  );
}

const SUMMARY =
  'flex min-h-11 cursor-pointer list-none flex-col gap-1 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none';

/**
 * A compact row for what Headway is carrying.
 *
 * One line to scan: the state, the count, the headline. One tap for the
 * three things an owner needs to stop thinking about a topic — WHY it is
 * worth carrying at all, WHEN Headway will say something, and what they told
 * Headway that shaped it. The promise is explicit: "I don't have to remember
 * this; Headway will" is only true if the owner can see the condition that
 * brings it back.
 */
function WatchingRow({ item, basePath }: { item: ResponsibilityItem; basePath: string }) {
  return (
    <li className="py-3">
      <details className="group">
        <summary className={SUMMARY}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <StateChip item={item} />
            {item.evidence ? (
              <span className="text-[12px] text-ink-500 tabular-nums">
                {item.evidence.count} of {item.evidence.outOf}
              </span>
            ) : null}
          </div>
          <p className="text-[15px] leading-snug font-semibold text-ink-900">
            {item.headline} <Chevron />
          </p>
        </summary>
        <dl className="hw-reveal mt-2 space-y-1.5 border-l-2 border-ink-200 pl-3">
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
          {item.themeKey ? (
            <div className="pt-1">
              <EvidenceLink
                basePath={basePath}
                themeKey={item.themeKey}
                count={item.evidence?.count}
                label={item.evidence ? undefined : 'Read the comments'}
              />
            </div>
          ) : null}
        </dl>
      </details>
    </li>
  );
}

/**
 * A strength, with the proof. Not a badge and not a score: the customers'
 * count, Headway's reading of why it matters, and one tap to the words.
 */
function StrengthRow({ item, basePath }: { item: ResponsibilityItem; basePath: string }) {
  return (
    <li className="py-3">
      <details className="group">
        <summary className={SUMMARY}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <StateChip item={item} />
            {item.evidence ? (
              <span className="text-[12px] text-ink-500 tabular-nums">
                {item.evidence.count} of {item.evidence.outOf}
              </span>
            ) : null}
          </div>
          <p className="text-[15px] leading-snug font-semibold text-ink-900">
            {item.headline} <Chevron />
          </p>
        </summary>
        <div className="hw-reveal mt-2 border-l-2 border-ink-200 pl-3">
          {item.evidence ? (
            <p className="text-[12px] leading-relaxed text-ink-500">{item.evidence.line}</p>
          ) : null}
          <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{item.recommendedNextStep}</p>
          {item.themeKey ? (
            <div className="mt-1">
              <EvidenceLink basePath={basePath} themeKey={item.themeKey} count={item.evidence?.count} />
            </div>
          ) : null}
        </div>
      </details>
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

/** What Headway did since the last check-in, and when the next check would show something. */
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
