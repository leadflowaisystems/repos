import Link from 'next/link';
import clsx from 'clsx';
import type { PortalSignal } from '@/lib/portal/view';
import { pieces } from '@/lib/portal/view';
import { quotesFor, type EvidenceIndex } from '@/lib/portal/evidence';
import { Chevron, Quotes, Row } from '@/components/portal/disclose';
import { ShareBar } from '@/components/portal/portal-ui';

/**
 * THE SIGNAL BOARD (M24, completed in the final experience pass).
 *
 * Customers used to read as a written analysis: every theme told in four
 * labelled layers, one under the other, strengths then issues then movement
 * then recurrence. All true, all the same size. The board shows the same
 * themes by importance instead — NEEDS YOU, WATCHING, GOING WELL, NOT YET
 * CLEAR — as cards an owner scans in a few seconds, and each card opens in
 * place into exactly the reading the old page laid out: what customers are
 * saying (in their words), what they tapped on the feedback page, what
 * Headway sees, what to do, why, what Headway will check next, and what
 * Headway based it on. Nobody has to leave the page to understand one signal.
 */

export type SignalGroupKey = 'NEEDS_YOU' | 'WATCHING' | 'PROTECT' | 'EARLY';

export type SignalGroup = {
  key: SignalGroupKey;
  label: string;
  note: string | null;
  signals: PortalSignal[];
};

const GROUP_CHIP: Record<SignalGroupKey, string> = {
  NEEDS_YOU: 'bg-ink-900 text-white',
  WATCHING: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 ring-inset',
  PROTECT: 'bg-good-50 text-good-700 ring-1 ring-good-200 ring-inset',
  EARLY: 'bg-ink-100 text-ink-600',
};

/**
 * One word for one pile, portal-wide: Home, Customers and this board all call
 * the good-news group "Going well". "Protect" is an order; "Going well" says
 * what the pile actually is, which is what a heading is for.
 */
const GROUP_WORD: Record<SignalGroupKey, string> = {
  NEEDS_YOU: 'Needs you',
  WATCHING: 'Watching',
  PROTECT: 'Going well',
  EARLY: 'Not yet clear',
};

/** Two labels only, and both name what tapping does — never a task to do. */
const GROUP_CTA: Record<SignalGroupKey, string> = {
  NEEDS_YOU: 'See why',
  WATCHING: 'See why',
  PROTECT: 'See why',
  EARLY: 'See the mentions',
};

function mentions(n: number): string {
  return `${n} ${n === 1 ? 'mention' : 'mentions'}`;
}

/** The direction, only where the engine actually compared two check-ins. */
function Trend({ signal }: { signal: PortalSignal }) {
  const d = signal.movementDirection;
  if (!d) return null;
  const issue = signal.kind === 'ISSUE';
  if (d === 'STABLE') return <span className="text-[13px] text-ink-500">→ about the same</span>;
  const rose = issue ? d === 'WORSENING' : d === 'IMPROVING';
  const good = d === 'IMPROVING';
  // What moved is how often customers mentioned it, not whether the thing
  // itself got better or worse — so the words only ever say how often.
  const word = rose ? 'more often' : 'less often';
  return (
    <span className={clsx('text-[13px] font-medium', good ? 'text-good-700' : 'text-bad-700')}>
      <span aria-hidden>{rose ? '↑' : '↓'}</span>
      <span className="sr-only">Mentioned</span> {word}
    </span>
  );
}

/**
 * The four readings, worded exactly as the rest of the portal words them.
 * "after the change" is the whole guarantee: Headway says what came next, not
 * what the change caused, and the last reading says the feedback is missing —
 * never that the change failed.
 */
function outcomeWord(signal: PortalSignal): { text: string; tone: string } | null {
  const r = signal.outcome?.result;
  if (!r) return null;
  if (r === 'IMPROVED') return { text: 'Mentioned less often after the change', tone: 'text-good-700' };
  if (r === 'WORSENED') return { text: 'Mentioned more often after the change', tone: 'text-bad-700' };
  if (r === 'NO_CLEAR_CHANGE') return { text: 'No clear difference after the change', tone: 'text-ink-600' };
  return { text: 'Not enough feedback after the change', tone: 'text-ink-600' };
}

/**
 * What customers tapped on the feedback page, added up. The ratings are the
 * majority of what the card collects and, until now, the only place they
 * appeared was one row at a time in the feedback list.
 */
function Tapped({ tapped }: { tapped: NonNullable<PortalSignal['tapped']> }) {
  return (
    <div>
      <p className="tabular-nums">
        {tapped.rated === 1 ? 'One customer' : `${tapped.rated} customers`} rated{' '}
        <span className="font-medium text-ink-900">{tapped.label.toLowerCase()}</span> on your feedback
        page:{' '}
        {tapped.rated === 1
          ? `${Math.round(tapped.average)} out of 5.`
          : `${tapped.average.toFixed(1)} out of 5 on average, ${
              tapped.low === 0 ? 'none' : tapped.low === tapped.rated ? 'all of them' : `${tapped.low} of them`
            } at 3 or below.`}
      </p>
      {tapped.specifics.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="What they tapped">
          {tapped.specifics.map((s) => (
            <li
              key={s.label}
              className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-ink-300 bg-white px-2.5 text-[12px] text-ink-800"
            >
              {s.label}
              <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-medium text-ink-700 tabular-nums">
                {s.count}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SignalCard({
  signal,
  group,
  evidence,
  basePath,
  open,
}: {
  signal: PortalSignal;
  group: SignalGroupKey;
  evidence: EvidenceIndex;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  open?: boolean;
}) {
  const s = signal;
  const quotes = quotesFor(evidence, s.themeKey, { limit: 3 });
  const reviews = `${basePath}/reviews?theme=${encodeURIComponent(s.themeKey)}`;
  const outcome = outcomeWord(s);
  const why = s.why[0] ?? s.featuredBecause ?? s.brief;
  const issue = s.kind === 'ISSUE';

  return (
    <details
      id={`signal-${s.themeKey}`}
      open={open}
      className="group scroll-mt-24 rounded-xl border border-ink-200 bg-white open:border-ink-400 open:shadow-[0_1px_2px_rgb(15_18_26/0.06)]"
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-2.5 p-4 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className={clsx(
              'inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase',
              GROUP_CHIP[group],
            )}
          >
            {GROUP_WORD[group]}
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-700">
            <span className="group-open:hidden">{GROUP_CTA[group]}</span>
            <span className="hidden group-open:inline">Close</span>
            <Chevron />
          </span>
        </div>
        <p className="text-[20px] leading-tight font-semibold tracking-tight text-ink-900 sm:text-[22px]">
          {s.themeLabel}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[15px] font-semibold text-ink-900 tabular-nums">{mentions(s.evidenceCount)}</span>
          <span className="text-[13px] text-ink-500 tabular-nums">{s.share}</span>
          <Trend signal={s} />
          {outcome ? <span className={clsx('text-[13px] font-medium', outcome.tone)}>{outcome.text}</span> : null}
        </div>
        <div className="max-w-md">
          <ShareBar signal={s} />
        </div>
      </summary>

      <div className="hw-reveal divide-y divide-dashed divide-ink-200 border-t border-ink-200 px-4 pb-2 sm:px-5">
        <Row label="What customers are saying">
          <Quotes
            quotes={quotes}
            seeAll={{ label: 'See the mentions', href: reviews }}
            empty={
              issue
                ? 'Nobody has written about this yet. It comes from what customers tapped on your feedback page.'
                : 'Nobody has written about this yet.'
            }
          />
        </Row>
        {s.tapped ? (
          <Row label="What customers tapped">
            <Tapped tapped={s.tapped} />
          </Row>
        ) : null}
        <Row label="What Headway sees" strong>
          {s.meaning}
        </Row>
        {s.actionLine || s.ownerPriority || s.ownerContext.length > 0 ? (
          <Row label="You told us">
            <span className="italic">
              {s.actionLine ? <span className="block">{s.actionLine}</span> : null}
              {s.ownerPriority ? <span className="block">{s.ownerPriority}</span> : null}
              {s.ownerContext.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
            {s.actionLine && s.outcome ? (
              <Link
                href={`${basePath}/improvements`}
                className="mt-1 inline-flex min-h-11 items-center text-[13px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
              >
                See what happened after the change →
              </Link>
            ) : null}
          </Row>
        ) : null}
        <Row label={issue ? 'What to do' : 'What to protect'} strong>
          {s.nextStep}
          {s.suggestionNote ? (
            <span className="mt-1 block text-[12px] font-normal leading-relaxed text-ink-500">{s.suggestionNote}</span>
          ) : null}
        </Row>
        <Row label="Why">{why}</Row>
        <Row label="Headway will check next">{s.watchLine}</Row>
        <Row label="What Headway based this on">
          <span className="tabular-nums">
            {s.evidenceCount} of the {pieces(s.evidenceTotal)} Headway has read
          </span>
          {s.recurrence ? <span className="block text-[13px] text-ink-500">{s.recurrence}</span> : null}
          {s.movementLine ? (
            <span className="block text-[13px] text-ink-500">At your last two check-ins: {s.movementLine}</span>
          ) : null}
        </Row>
      </div>
    </details>
  );
}

export function SignalBoard({
  groups,
  evidence,
  basePath,
  open,
}: {
  groups: SignalGroup[];
  evidence: EvidenceIndex;
  basePath: string;
  /** The theme to arrive with open, from `?open=`. */
  open?: string | null;
}) {
  const shown = groups.filter((g) => g.signals.length > 0);
  if (shown.length === 0) return null;
  return (
    <div className="space-y-8">
      {shown.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">{g.label}</h2>
            {g.note ? <p className="text-[12px] text-ink-500">{g.note}</p> : null}
          </div>
          <div
            className={clsx(
              'grid grid-cols-1 items-start gap-3',
              g.key !== 'NEEDS_YOU' && g.signals.length > 1 && 'md:grid-cols-2',
            )}
          >
            {g.signals.map((s) => (
              <SignalCard
                key={s.themeKey}
                signal={s}
                group={g.key}
                evidence={evidence}
                basePath={basePath}
                open={open === s.themeKey}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
