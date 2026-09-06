import Link from 'next/link';
import clsx from 'clsx';
import type { PortalTally } from '@/lib/portal/tallies';
import type {
  PortalAction,
  PortalAdvice,
  PortalBucket,
  PortalFact,
  PortalKnown,
  PortalMood,
  PortalOutcome,
  PortalQuestion,
  PortalSignal,
  PortalSoFar,
  PortalWatch,
} from '@/lib/portal/view';
import { pieces } from '@/lib/portal/view';
import type { ReviewItem } from '@/lib/portal/pages';
import { formatDate } from '@/lib/format';

/**
 * PORTAL PRESENTATION (M12).
 *
 * Owner-facing components. They render what the view model already decided
 * and add nothing beyond headings and labels, so nothing can appear on screen
 * that the deterministic layers did not say first.
 *
 * The one idea every component serves: an advisor's page, not a dashboard.
 * A conclusion first, in a sentence; the fact beneath it, small; the reasons
 * one tap away; the customer words one tap further. Four kinds of statement
 * are visibly different so an owner never mistakes one for another —
 *
 *   CUSTOMERS SAY     what the feedback shows
 *   WHAT IT MEANS     RepOS's reading of it
 *   REPOS RECOMMENDS  what to consider doing
 *   YOU TOLD US       what the owner said
 *
 * Status colour is used only where direction genuinely matters. Rules and
 * spacing separate sections; cards are not nested in cards.
 */

// ---------------------------------------------------------------------------
// Page framing
// ---------------------------------------------------------------------------

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string | null;
}) {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">{eyebrow}</p>
      <h1 className="mt-1.5 text-[24px] leading-tight font-semibold tracking-tight text-ink-900 sm:text-[28px]">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-600">{description}</p>
      ) : null}
    </div>
  );
}

export function Section({
  eyebrow,
  title,
  note,
  children,
}: {
  eyebrow: string;
  title?: string;
  note?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">{eyebrow}</h2>
        {note ? <p className="text-[12px] text-ink-500">{note}</p> : null}
      </div>
      {title ? (
        <p className="mb-3 text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
          {title}
        </p>
      ) : null}
      {children}
    </section>
  );
}

const MOOD_DOT: Record<PortalMood, string> = {
  GOOD: 'bg-good-600',
  MIXED: 'bg-warn-600',
  NEEDS_WORK: 'bg-bad-600',
  TOO_EARLY: 'bg-ink-300',
};

/**
 * THE PICTURE — the largest type on the page, and a sentence rather than a number.
 *
 * Everything below it is support. If an owner reads one thing and closes the
 * tab, this is the thing, so it gets the width, the weight and the dot that
 * says in colour what the sentence says in words.
 */
export function Picture({
  mood,
  summary,
  basis,
}: {
  mood: PortalMood;
  summary: string;
  basis: string;
}) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className={clsx('h-2 w-2 rounded-full', MOOD_DOT[mood])} aria-hidden />
        <span className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
          Right now
        </span>
      </div>
      <p className="max-w-3xl text-[22px] leading-[1.24] font-semibold tracking-[-0.015em] text-balance text-ink-900 sm:text-[27px]">
        {summary}
      </p>
      <p className="mt-3 text-[13px] text-ink-500">{basis}</p>
    </section>
  );
}

/**
 * The two standing figures, on one rule.
 *
 * Direction is the only place on Home where a whole word is coloured, because
 * "Needs attention" and "Improving" are the two readings an owner acts on
 * differently. The pill is small and the ground is barely tinted: red here is
 * a status, not an alarm. Everything else on the strip stays navy.
 */
const DIRECTION_PILL: Array<[RegExp, string]> = [
  [/improving/i, 'border-good-200 bg-good-50 text-good-700'],
  [/needs attention|worsening/i, 'border-bad-200 bg-bad-50 text-bad-700'],
  [/steady/i, 'border-ink-200 bg-ink-100 text-ink-700'],
];

function pillFor(value: string): string | null {
  for (const [pattern, cls] of DIRECTION_PILL) if (pattern.test(value)) return cls;
  return null;
}

export function FactsLine({ facts }: { facts: PortalFact[] }) {
  return (
    <dl className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-ink-200 py-3.5">
      {facts.map((f) => {
        const pill = pillFor(f.value);
        return (
          <div key={f.label} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <dt className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
              {f.label}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-x-2">
              {pill ? (
                <span
                  className={clsx(
                    'rounded-full border px-2 py-0.5 text-[12px] font-semibold',
                    pill,
                  )}
                >
                  {f.value}
                </span>
              ) : (
                <span className="text-[16px] font-semibold text-ink-900 tabular-nums">
                  {f.value}
                </span>
              )}
              <span className="text-[12px] font-normal text-ink-500">{f.scope}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * THE FOUR FIGURES, AT THE BOTTOM WHERE THEY BELONG.
 *
 * How much was read, what the public listing says, the strongest complaint and
 * the strongest strength. Colour appears only on the last two, only as an icon
 * and a word, and only because a complaint and a strength are the two things an
 * owner treats differently. A movement arrow appears ONLY when the engine
 * actually compared two check-ins — no arrow is invented to make the row look
 * busy.
 */

const TALLY_ICON: Record<PortalTally['tone'], string> = {
  neutral: 'text-ink-400',
  good: 'text-good-600',
  bad: 'text-bad-600',
};

function TallyBody({ tally }: { tally: PortalTally }) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className={clsx('text-[13px] leading-none', TALLY_ICON[tally.tone])}
        >
          {tally.tone === 'good' ? '●' : tally.tone === 'bad' ? '▲' : '○'}
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">
          {tally.value}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-ink-600">{tally.label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
        {tally.movement ? (
          <span
            className={clsx(
              'font-medium',
              tally.movement === 'up'
                ? tally.tone === 'bad'
                  ? 'text-bad-600'
                  : 'text-good-600'
                : tally.tone === 'bad'
                  ? 'text-good-600'
                  : 'text-bad-600',
            )}
          >
            <span aria-hidden>{tally.movement === 'up' ? '↑' : '↓'}</span>
            <span className="sr-only">{tally.movement === 'up' ? 'up,' : 'down,'}</span>
          </span>
        ) : null}
        {tally.note}
      </p>
    </>
  );
}

export function Tallies({ tallies }: { tallies: PortalTally[] }) {
  if (tallies.length === 0) return null;
  return (
    <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tallies.map((t) =>
        t.href ? (
          <Link
            key={t.key}
            href={t.href}
            className="min-h-11 rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
          >
            <TallyBody tally={t} />
          </Link>
        ) : (
          <div key={t.key} className="rounded-xl border border-ink-200 bg-white p-4">
            <TallyBody tally={t} />
          </div>
        ),
      )}
    </section>
  );
}

export function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-relaxed text-ink-500">{children}</p>;
}

/**
 * A one-line conclusion behind a coloured rule.
 *
 * `bad` exists because `warn` stopped meaning "something is wrong" when the
 * palette moved: warn is now Headway's own gold emphasis. A check-in whose
 * summary is that things got worse needs red, and used to get amber.
 */
export function Callout({
  tone,
  children,
}: {
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  children: React.ReactNode;
}) {
  return (
    <p
      className={clsx(
        'border-l-2 pl-4 text-[15px] leading-relaxed font-medium text-ink-900',
        tone === 'good'
          ? 'border-good-600'
          : tone === 'bad'
            ? 'border-bad-600'
            : tone === 'warn'
              ? 'border-warn-600'
              : 'border-ink-300',
      )}
    >
      {children}
    </p>
  );
}

export function Limits({ limits }: { limits: string[] }) {
  if (limits.length === 0) return null;
  return (
    <section className="mt-12 border-t border-ink-200 pt-5">
      <h2 className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
        What we cannot tell you yet
      </h2>
      <ul className="mt-3 space-y-1.5">
        {limits.map((l) => (
          <li key={l} className="text-[12px] leading-relaxed text-ink-500">
            {l}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Labels that keep the four kinds of statement apart
// ---------------------------------------------------------------------------

export type LayerKind = 'fact' | 'meaning' | 'why' | 'recommend' | 'owner' | 'next' | 'watch';

const LAYER_LABELS: Record<LayerKind, string> = {
  fact: 'Customers say',
  meaning: 'What it means',
  why: 'Why it matters',
  recommend: 'Headway recommends',
  owner: 'You told us',
  next: 'Next',
  watch: 'Watching',
};

/** A labelled row. The label is the reader's guarantee of what kind of statement follows. */
export function Layer({
  kind,
  children,
  strong,
}: {
  kind: LayerKind;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-1.5 sm:grid-cols-[7.5rem_1fr]">
      <p className="pt-0.5 text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
        {LAYER_LABELS[kind]}
      </p>
      <div
        className={clsx(
          'text-[14px] leading-relaxed',
          strong ? 'font-medium text-ink-900' : 'text-ink-700',
          kind === 'owner' && 'italic text-ink-700',
        )}
      >
        {children}
      </div>
    </div>
  );
}

const BUCKET_TONE: Record<PortalBucket, string> = {
  FIRST: 'bg-ink-900 text-white',
  KEEP: 'bg-good-50 text-good-700 ring-1 ring-good-200 ring-inset',
  WATCH: 'bg-warn-50 text-warn-700 ring-1 ring-warn-200 ring-inset',
  EARLY: 'bg-ink-100 text-ink-600',
};

const ADVICE_TONE: Record<PortalAdvice, string> = {
  START: 'text-ink-900',
  HOLD: 'text-good-700',
  CONTINUE: 'text-ink-900',
  CHECKING: 'text-ink-700',
  KEEP_CHANGE: 'text-good-700',
  REVIEW_CHANGE: 'text-bad-700',
  PROTECT: 'text-good-700',
  WATCH: 'text-warn-700',
  WAIT: 'text-ink-500',
};

export function Tag({ bucket }: { bucket: PortalBucket }) {
  return (
    <span
      className={clsx(
        'inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase',
        BUCKET_TONE[bucket],
      )}
    >
      {bucket === 'FIRST'
        ? 'Do this first'
        : bucket === 'KEEP'
          ? 'Keep doing this'
          : bucket === 'WATCH'
            ? 'Watching'
            : 'Not enough evidence'}
    </span>
  );
}

export function EvidenceLink({
  basePath,
  themeKey,
  count,
  label,
}: {
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  themeKey: string;
  count?: number;
  label?: string;
}) {
  return (
    <Link
      href={`${basePath}/reviews?theme=${encodeURIComponent(themeKey)}`}
      className="inline-flex min-h-11 items-center gap-1.5 group text-[13px] font-medium text-ink-700 transition-colors hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {label ?? `Read the ${count} ${count === 1 ? 'comment' : 'comments'}`}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// The customer fact, compact
// ---------------------------------------------------------------------------

function Arrow({ signal }: { signal: PortalSignal }) {
  const d = signal.movementDirection;
  if (!d || d === 'STABLE') return null;
  const goodNews = signal.kind === 'ISSUE' ? d === 'IMPROVING' : d === 'IMPROVING';
  const glyph = signal.kind === 'ISSUE' ? (d === 'IMPROVING' ? '↓' : '↑') : d === 'IMPROVING' ? '↑' : '↓';
  return (
    <span className={clsx('font-semibold', goodNews ? 'text-good-700' : 'text-bad-700')}>
      {glyph}
    </span>
  );
}

/** "14 of 110 · 13% · ↓ 6 → 2 mentions at your last two check-ins" */
export function FactLine({ signal }: { signal: PortalSignal }) {
  return (
    <p className="text-[12px] text-ink-500 tabular-nums">
      {signal.evidenceCount} of {signal.evidenceTotal} · {signal.share}
      {signal.movementCounts ? (
        <>
          {' '}
          · <Arrow signal={signal} /> {signal.movementCounts} at your last two check-ins
        </>
      ) : null}
      {signal.recurrence ? <> · {signal.recurrence}</> : null}
    </p>
  );
}

/** A share, as a thin bar. Reads faster than the number alone. */
export function ShareBar({ signal }: { signal: PortalSignal }) {
  const pct = signal.evidenceTotal > 0 ? (signal.evidenceCount / signal.evidenceTotal) * 100 : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
      <div
        className={clsx('h-full rounded-full', signal.kind === 'ISSUE' ? 'bg-bad-600' : 'bg-good-600')}
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** Observational wording for a reading, and a restrained tone for it. */
function readingOf(outcome: PortalOutcome): { label: string; tone: string } {
  switch (outcome.result) {
    case 'IMPROVED':
      return { label: 'Less often after the change', tone: 'text-good-700' };
    case 'WORSENED':
      // Red, not gold. A theme that came up MORE after a change is the
      // definition of something getting worse, and gold means Headway is
      // watching — a different thing entirely. This read as gold for exactly
      // as long as it took to re-check every use of the token.
      return { label: 'More often after the change', tone: 'text-bad-700' };
    case 'NO_CLEAR_CHANGE':
      return { label: 'No clear change after the change', tone: 'text-ink-500' };
    default:
      return { label: 'Not enough feedback after the change', tone: 'text-ink-500' };
  }
}

/** "15% → 7% · less often after the change" in one line. The bars live on Improvements. */
function OutcomeLine({ outcome }: { outcome: PortalOutcome }) {
  const reading = readingOf(outcome);
  return (
    <span className="tabular-nums">
      {outcome.beforeShare && outcome.afterShare ? (
        <span className="font-mono font-semibold text-ink-900">
          {outcome.beforeShare} <span className="text-ink-300">→</span> {outcome.afterShare}
        </span>
      ) : null}
      <span className={clsx('ml-2 text-[11px] font-semibold tracking-wide uppercase', reading.tone)}>
        {reading.label}
      </span>
    </span>
  );
}

/** The reminder that travels with every reading. */
function OutcomeNote({ outcome }: { outcome: PortalOutcome }) {
  return <span className="block text-[12px] leading-relaxed text-ink-500">{outcome.note}</span>;
}

// ---------------------------------------------------------------------------
// One theme, explained
// ---------------------------------------------------------------------------

/**
 * The unit of the product: a theme read for the owner.
 *
 * `brief` (Home) says the conclusion, the fact, what was tried and the next
 * move. `full` (Customers) adds the complete reading, the engine's reasons,
 * the recommendation and the counterpart. Same theme, different job.
 */
export function ThemeStory({
  signal,
  basePath,
  depth,
  lead,
  untitled,
}: {
  signal: PortalSignal;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  depth: 'brief' | 'full';
  lead?: boolean;
  /** When the heading above already names the theme (M15), the story starts at the fact. */
  untitled?: boolean;
}) {
  const s = signal;
  return (
    <article
      className={clsx(
        untitled ? 'pt-1 pb-2' : 'py-5',
        !untitled && (lead ? 'border-l-2 border-ink-900 pl-5 sm:pl-6' : 'border-t border-ink-200 first:border-t-0 first:pt-0'),
      )}
    >
      {untitled ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3
            className={clsx(
              'leading-tight font-semibold tracking-tight text-ink-900',
              lead ? 'text-[22px] sm:text-[24px]' : 'text-[18px]',
            )}
          >
            {s.themeLabel}
          </h3>
          {depth === 'full' ? <Tag bucket={s.bucket} /> : null}
        </div>
      )}
      <div className={untitled ? '' : 'mt-1.5'}>
        <FactLine signal={s} />
      </div>
      {depth === 'full' ? (
        <div className="mt-2 max-w-md">
          <ShareBar signal={s} />
        </div>
      ) : null}

      <div className="mt-3 divide-y divide-dashed divide-ink-200">
        <Layer kind="meaning" strong>
          {depth === 'full' ? s.meaning : s.brief}
          {s.featuredBecause ? (
            <span className="block text-[13px] font-normal text-ink-500">{s.featuredBecause}</span>
          ) : null}
        </Layer>

        {depth === 'full' && s.why.length > 0 ? (
          <Layer kind="why">
            <ul className="space-y-0.5">
              {s.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Layer>
        ) : null}

        {/* Everything the owner told RepOS about this theme — the decision,
            the priority, the context — in one attributed row. Theirs, shown as
            theirs, never mixed into the reading above. */}
        {s.actionLine || s.ownerPriority || (depth === 'full' && s.ownerContext.length > 0) ? (
          <Layer kind="owner">
            {s.actionLine ? <span className="block">{s.actionLine}</span> : null}
            {/* The before/after belongs to Home's card; on Customers the loop
                is one link away and is not retold. */}
            {s.actionLine && s.outcome && depth === 'brief' ? (
              <span className="mt-1 mb-1.5 block not-italic">
                <OutcomeLine outcome={s.outcome} />
                <OutcomeNote outcome={s.outcome} />
              </span>
            ) : null}
            {s.actionLine && s.outcome && depth === 'full' ? (
              <span className="mt-1 mb-1.5 block not-italic">
                <Link
                  href={`${basePath}/improvements`}
                  className="inline-flex min-h-11 items-center text-[13px] font-medium text-ink-700 hover:text-ink-900"
                >
                  What the feedback did afterwards →
                </Link>
              </span>
            ) : null}
            {s.ownerPriority ? <span className="block">{s.ownerPriority}</span> : null}
            {depth === 'full'
              ? s.ownerContext.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))
              : null}
          </Layer>
        ) : null}

        {/* When nothing has been tried, the next step IS the recommendation,
            and is labelled as one. */}
        <Layer kind={s.kind === 'ISSUE' && s.actionState === 'NONE' && s.suggestion ? 'recommend' : 'next'}>
          <span className={clsx('font-medium', ADVICE_TONE[s.advice])}>{s.adviceLabel}.</span>{' '}
          {s.nextStep}
          {s.suggestionNote ? (
            <span className="mt-1 block text-[12px] leading-relaxed text-ink-500">{s.suggestionNote}</span>
          ) : null}
        </Layer>
      </div>

      <div className="mt-3">
        <EvidenceLink basePath={basePath} themeKey={s.themeKey} count={s.evidenceCount} />
      </div>
    </article>
  );
}

/**
 * A compact row for lists that should not become stories.
 *
 * `line` picks which one sentence follows the fact: the theme's reading
 * (Home's watch rows), the last-two-check-ins reading (pages about movement),
 * or nothing (lists where the fact line already says it all).
 */
export function ThemeRow({
  signal,
  basePath,
  line = 'brief',
  showWatch,
  showAction,
}: {
  signal: PortalSignal;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  line?: 'brief' | 'movement' | 'none';
  showWatch?: boolean;
  showAction?: boolean;
}) {
  const s = signal;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          href={`${basePath}/reviews?theme=${encodeURIComponent(s.themeKey)}`}
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-ink-900 hover:underline hover:underline-offset-2"
        >
          {s.themeLabel}
        </Link>
        <FactLine signal={s} />
      </div>
      {line === 'brief' ? (
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">{s.brief}</p>
      ) : line === 'movement' ? (
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">{s.movementBrief}</p>
      ) : null}
      {showAction && s.actionLine ? (
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600 italic">{s.actionLine}</p>
      ) : null}
      {showWatch ? (
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{s.watchLine}</p>
      ) : null}
    </li>
  );
}

export function ThemeRows({
  signals,
  basePath,
  line,
  showWatch,
  showAction,
}: {
  signals: PortalSignal[];
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  line?: 'brief' | 'movement' | 'none';
  showWatch?: boolean;
  showAction?: boolean;
}) {
  return (
    <ul className="divide-y divide-ink-200 border-y border-ink-200">
      {signals.map((s) => (
        <ThemeRow
          key={s.themeKey}
          signal={s}
          basePath={basePath}
          line={line}
          showWatch={showWatch}
          showAction={showAction}
        />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// The work RepOS did, the watch list, the one question
// ---------------------------------------------------------------------------

export function WorkList({ work }: { work: string[] }) {
  return (
    <ul className="space-y-1">
      {work.map((w) => (
        <li key={w} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-600">
          <span aria-hidden className="mt-[3px] text-[11px] text-ink-400">
            ✓
          </span>
          {w}
        </li>
      ))}
    </ul>
  );
}

export function WatchList({ items, basePath }: { items: PortalWatch[]; basePath: string }) {
  return (
    <ul className="divide-y divide-ink-200 border-y border-ink-200">
      {items.map((w) => (
        <li key={`${w.themeKey ?? 'early'}:${w.label}`} className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[1fr_auto] sm:items-baseline">
          <div>
            {w.themeKey ? (
              <Link
                href={`${basePath}/reviews?theme=${encodeURIComponent(w.themeKey)}`}
                className="inline-flex min-h-11 items-center text-[14px] font-medium text-ink-900 hover:underline hover:underline-offset-2"
              >
                {w.label}
              </Link>
            ) : (
              <span className="text-[14px] font-medium text-ink-900">{w.label}</span>
            )}
            <p className="text-[12px] leading-relaxed text-ink-500">{w.next}</p>
          </div>
          <span
            className={clsx(
              'text-[11px] font-semibold tracking-wide uppercase',
              w.tone === 'good' ? 'text-good-700' : w.tone === 'warn' ? 'text-bad-700' : 'text-ink-500',
            )}
          >
            {w.state}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** What the owner told RepOS, shown back to them. Their words, their label. */
export function Knows({ items, basePath }: { items: PortalKnown[]; basePath: string }) {
  return (
    <div>
      <ul className="divide-y divide-ink-200 border-y border-ink-200">
        {items.map((k) => (
          <li key={k.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <p className="text-[14px] leading-relaxed text-ink-800 italic">{k.line}</p>
            <span className="shrink-0 text-[12px] text-ink-500">
              {k.themeKey ? (
                <Link
                  href={`${basePath}/reviews?theme=${encodeURIComponent(k.themeKey)}`}
                  className="inline-flex min-h-11 items-center text-ink-700 hover:text-ink-900"
                >
                  the customer comments →
                </Link>
              ) : (
                formatDate(k.recordedAt)
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
        Headway keeps this apart from what customers said, and uses it to keep its suggestions
        practical. Tell your Headway contact if any of it is no longer true.
      </p>
    </div>
  );
}

export function Question({ q }: { q: PortalQuestion }) {
  return (
    <div className="border-l-2 border-warn-600 pl-4">
      <p className="text-[15px] leading-relaxed font-medium text-ink-900">{q.question}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{q.why}</p>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {q.options.map((o) => (
          <li
            key={o}
            className="rounded-full border border-ink-300 px-3 py-1 text-[13px] text-ink-800"
          >
            {o}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-500">
        Tell your Headway contact which fits at your next check-in. It is kept on record for the
        recommendations that follow.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The improvement loop
// ---------------------------------------------------------------------------

export function MemoryStrip({ memory }: { memory: NonNullable<PortalAction['memory']> }) {
  const cells: Array<[string, string]> = [
    ['Before', memory.then],
    ['You changed', memory.change],
    ['After', memory.now],
    ['Reading', memory.result],
  ];
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-ink-200 bg-ink-200 sm:grid-cols-4">
      {cells.map(([k, v], i) => (
        <li key={k} className="bg-white px-3 py-2">
          <p className="text-[11px] tracking-widest text-ink-400 uppercase">{k}</p>
          <p
            className={clsx(
              'mt-0.5 leading-snug',
              i === 1 ? 'text-[13px] text-ink-800' : 'text-[15px] font-semibold text-ink-900',
              i === 3 &&
                (memory.result === 'Less often'
                  ? 'text-good-700'
                  : memory.result === 'More often'
                    ? 'text-bad-700'
                    : 'text-ink-700'),
            )}
          >
            {v}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function BeforeAfter({ outcome }: { outcome: PortalOutcome }) {
  const pct = (s: string | null) => (s ? Number.parseInt(s, 10) : 0);
  const reading = readingOf(outcome);
  // Each pile is named with its own boundary, so the two can never be read
  // as one series.
  const rows: Array<[string, string | null, string, string]> = [
    ['Before', outcome.beforeShare, outcome.beforeLine, outcome.beforeScope],
    ['After', outcome.afterShare, outcome.afterLine, outcome.afterScope],
  ];
  return (
    <div>
      <dl className="space-y-2.5">
        {rows.map(([label, share, line, scope]) => (
          <div key={label} className="grid grid-cols-[3.5rem_1fr] items-start gap-3">
            <dt className="pt-0.5 text-[11px] tracking-wide text-ink-500 uppercase">{label}</dt>
            <dd>
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      label === 'After'
                        ? outcome.result === 'IMPROVED'
                          ? 'bg-good-600'
                          : outcome.result === 'WORSENED'
                            ? 'bg-bad-600'
                            : 'bg-ink-400'
                        : 'bg-ink-400',
                    )}
                    style={{ width: `${Math.max(2, Math.min(100, pct(share)))}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-[15px] font-semibold text-ink-900 tabular-nums">
                  {share ?? '—'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-500">
                {line} · {scope}
              </p>
            </dd>
          </div>
        ))}
      </dl>
      <p className={clsx('mt-3 text-[11px] font-semibold tracking-wide uppercase', reading.tone)}>
        {reading.label}
      </p>

      {/* Three labelled statements, so a reading and its limit are never one
          paragraph the eye can skim past. The limit is not tucked into small
          print: it sits at the same size as the finding, because "we cannot
          tell you this" is as much of the answer as the number is. */}
      <dl className="mt-3 space-y-2.5">
        <div>
          <dt className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">What we know</dt>
          <dd className="mt-0.5 text-[14px] leading-relaxed text-ink-900">{outcome.headline}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
            What we cannot tell you
          </dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-700">
            {outcome.note}
            {outcome.caveat ? <span className="block">{outcome.caveat}</span> : null}
          </dd>
        </div>
      </dl>
      <details className="mt-2 group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center list-none text-[12px] font-medium text-ink-600 hover:text-ink-900">
          Why Headway says this <span aria-hidden>›</span>
        </summary>
        <ul className="mt-1.5 space-y-1 border-l-2 border-ink-200 pl-3 text-[12px] leading-relaxed text-ink-600">
          {outcome.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Step({
  label,
  when,
  done,
  children,
}: {
  label: string;
  when: Date | null;
  done: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative pb-4 last:pb-0">
      <span
        aria-hidden
        className={clsx(
          'absolute top-1.5 -left-[25px] h-[9px] w-[9px] rounded-full ring-4 ring-ink-50',
          done ? 'bg-ink-900' : 'border border-ink-300 bg-white',
        )}
      />
      <div className="flex flex-wrap items-baseline gap-x-3">
        <p className={clsx('text-[12px] font-semibold', done ? 'text-ink-900' : 'text-ink-400')}>
          {label}
        </p>
        {when ? <span className="text-[11px] text-ink-400">{formatDate(when)}</span> : null}
      </div>
      {children ? (
        <div className="mt-0.5 text-[13px] leading-relaxed text-ink-700">{children}</div>
      ) : done ? null : (
        <p className="mt-0.5 text-[12px] text-ink-400">Not yet.</p>
      )}
    </li>
  );
}

/**
 * One improvement, end to end. The page's whole reason to exist:
 * problem → suggestion → your decision → change → before/after → result →
 * what we learned → what next. Owner statements are labelled as theirs.
 */
export function ActionStory({ action, basePath }: { action: PortalAction; basePath: string }) {
  const a = action;
  const declined = a.stage === 'NOT_DOING';
  return (
    <article className="border-t border-ink-200 py-7 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[19px] leading-tight font-semibold tracking-tight text-ink-900">
          {a.about}
        </h3>
        <span className="text-[12px] text-ink-500">{a.stageLabel}</span>
      </div>

      {a.memory ? (
        <div className="mt-4">
          <MemoryStrip memory={a.memory} />
        </div>
      ) : null}

      {a.returning ? (
        <div className="mt-4">
          <Callout tone="bad">
            This improved after your change but is starting to come up more again. Check whether
            the earlier conditions have returned before making another change.
          </Callout>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-[1fr_1fr]">
        <ol className="relative ml-1.5 border-l border-ink-200 pl-5">
          <Step label="The problem" when={a.suggestedAt} done>
            {a.problem}
          </Step>
          <Step label="Headway suggested" when={null} done>
            {a.suggested}
          </Step>
          <Step label={declined ? 'Not pursued' : 'You decided'} when={a.decidedAt} done={a.decidedAt !== null}>
            {declined ? (
              a.decisionNote ? (
                <>
                  <span className="text-ink-500">Reason recorded: </span>
                  <span className="italic">{a.decisionNote}</span>
                </>
              ) : (
                'You decided not to make this change.'
              )
            ) : a.decision ? (
              <span className="italic">{a.decision}</span>
            ) : (
              'You agreed to act on this.'
            )}
          </Step>
          {!declined ? (
            <Step label="Change made" when={a.doneAt} done={a.doneAt !== null}>
              {a.doneAt ? <span className="italic">You told us the change was in place.</span> : null}
            </Step>
          ) : null}
          {!declined ? (
            <Step label="Compared with feedback" when={a.measuredAt} done={a.outcome !== null}>
              {a.outcome ? 'Before and after the change — see the reading alongside.' : null}
            </Step>
          ) : null}
        </ol>

        <div className="space-y-5">
          {a.outcome ? (
            <div>
              <p className="mb-2 text-[11px] tracking-wide text-ink-500 uppercase">
                What the feedback did
              </p>
              <BeforeAfter outcome={a.outcome} />
            </div>
          ) : (
            <div>
              <p className="mb-1 text-[11px] tracking-wide text-ink-500 uppercase">Where this stands</p>
              <p className="text-[14px] leading-relaxed text-ink-700">{a.stageMeaning}</p>
              {a.awaiting ? (
                <p className="mt-1.5 text-[13px] text-ink-600 tabular-nums">
                  New feedback since the change: {a.awaiting.have} of the {a.awaiting.need} needed to
                  check it.
                </p>
              ) : null}
            </div>
          )}

          {a.sinceThen ? (
            <p className="text-[13px] leading-relaxed text-ink-600">{a.sinceThen}</p>
          ) : null}

          {a.learning ? (
            <div>
              <p className="mb-1 text-[11px] tracking-wide text-ink-500 uppercase">You told us</p>
              <p className="text-[14px] leading-relaxed text-ink-800 italic">{a.learning}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-1 text-[11px] tracking-wide text-ink-500 uppercase">What we recommend</p>
            <p className="text-[14px] leading-relaxed text-ink-900">{a.nextStep}</p>
          </div>

          <EvidenceLink basePath={basePath} themeKey={a.themeKey} label="Read the customer comments" />
        </div>
      </div>
    </article>
  );
}

/** A compact recap of a checked change, for the check-in. */
export function OutcomeRow({ action, basePath }: { action: PortalAction; basePath: string }) {
  const a = action;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          href={`${basePath}/improvements`}
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-ink-900 hover:underline hover:underline-offset-2"
        >
          {a.about}
        </Link>
        {a.outcome ? (
          <span className="text-[13px]">
            <OutcomeLine outcome={a.outcome} />
          </span>
        ) : a.awaiting ? (
          <span className="text-[12px] text-ink-500 tabular-nums">
            Waiting for feedback · {a.awaiting.have} of {a.awaiting.need}
          </span>
        ) : null}
      </div>
      {a.decision ? (
        <p className="mt-0.5 text-[13px] text-ink-600 italic">
          You changed: {a.decision}
          {a.doneAt ? <span className="not-italic text-ink-500"> · recorded {formatDate(a.doneAt)}</span> : null}
        </p>
      ) : null}
      {a.outcome ? (
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">
          {a.outcome.headline}
          <OutcomeNote outcome={a.outcome} />
        </p>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Reviews — the evidence
// ---------------------------------------------------------------------------

export function RatingBars({ ratings }: { ratings: Array<{ stars: number; count: number }> }) {
  const max = Math.max(1, ...ratings.map((r) => r.count));
  const total = ratings.reduce((s, r) => s + r.count, 0);
  return (
    <dl className="space-y-1.5">
      {ratings.map((r) => (
        <div key={r.stars} className="flex items-center gap-3">
          <dt className="w-6 text-right text-[12px] font-medium text-ink-600 tabular-nums">{r.stars}★</dt>
          <dd className="flex flex-1 items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className={clsx(
                  'h-full rounded-full',
                  r.stars >= 4 ? 'bg-good-600' : r.stars === 3 ? 'bg-ink-400' : 'bg-bad-600',
                )}
                style={{ width: `${(r.count / max) * 100}%` }}
                aria-hidden
              />
            </div>
            <span className="w-14 text-right text-[12px] text-ink-500 tabular-nums">
              {r.count}
              {total > 0 ? <span className="text-ink-400"> · {Math.round((r.count / total) * 100)}%</span> : null}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SentimentBar({
  sentiments,
}: {
  sentiments: Array<{ key: string; label: string; count: number }>;
}) {
  const total = sentiments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <Quiet>Nothing has been read yet.</Quiet>;
  const tone: Record<string, string> = {
    POSITIVE: 'bg-good-600',
    MIXED: 'bg-warn-600',
    NEUTRAL: 'bg-ink-300',
    NEGATIVE: 'bg-bad-600',
  };
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        {sentiments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div key={s.key} className={tone[s.key] ?? 'bg-ink-300'} style={{ width: `${(s.count / total) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
        {sentiments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-ink-600">
            <span className={clsx('h-2 w-2 rounded-full', tone[s.key])} aria-hidden />
            {s.label}
            <span className="text-ink-400 tabular-nums">
              {s.count} · {Math.round((s.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SENTIMENT_DOT: Record<string, string> = {
  POSITIVE: 'bg-good-600',
  MIXED: 'bg-warn-600',
  NEUTRAL: 'bg-ink-300',
  NEGATIVE: 'bg-bad-600',
};

function Stars({ value }: { value: number }) {
  return (
    <span className="font-medium text-warn-600" aria-label={`${value} out of 5`}>
      {'★'.repeat(value)}
      <span className="text-ink-300" aria-hidden>
        {'☆'.repeat(5 - value)}
      </span>
    </span>
  );
}

/**
 * One piece of feedback, in two columns that must never blur into each other.
 *
 * CUSTOMER GAVE is exactly what the person tapped and typed: the overall
 * rating, a rating for each part of the visit the vertical asks about, the
 * specifics they selected, and their words in quotation marks. Nothing here
 * is paraphrased, and a customer who wrote nothing is shown as having written
 * nothing.
 *
 * REPOS UNDERSTOOD is everything derived from that: the themes, the tone, how
 * it was sorted, and whether it needs an answer. Labelled as a reading, placed
 * beside the evidence rather than woven into it, so an owner can always check
 * the one against the other — and can never mistake "Slow service" for
 * something the customer literally said.
 */
export function ReviewRow({ item }: { item: ReviewItem }) {
  const { gave } = item;
  const tapped = gave.dimensions.length > 0 || gave.selected.length > 0;

  return (
    <li className="py-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
            Customer gave
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
            {item.stars !== null ? (
              <Stars value={item.stars} />
            ) : (
              <span className="italic">No overall rating</span>
            )}
            {item.at ? <span>{formatDate(item.at)}</span> : null}
            <span>{item.sourceLabel}</span>
          </div>

          {gave.dimensions.length > 0 ? (
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {gave.dimensions.map((d) => (
                <div
                  key={d.label}
                  className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink-200 pb-0.5 text-[13px]"
                >
                  <dt className="text-ink-700">{d.label}</dt>
                  <dd
                    className={clsx(
                      'font-semibold tabular-nums',
                      d.rating <= 2 ? 'text-bad-700' : d.rating === 3 ? 'text-ink-600' : 'text-good-700',
                    )}
                  >
                    {d.rating}
                    <span className="font-normal text-ink-400">/5</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {gave.selected.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">Selected</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {gave.selected.map((label) => (
                  <li
                    key={label}
                    className="rounded-full border border-ink-300 px-2.5 py-0.5 text-[12px] text-ink-800"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3">
            <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">Written</p>
            {item.text.length > 0 ? (
              <p className="mt-1 text-[14px] leading-relaxed text-ink-900">“{item.text}”</p>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500 italic">
                {tapped
                  ? 'Nothing written — the ratings above are the whole message.'
                  : 'A rating only — no written comment.'}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-dashed border-ink-200 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-6">
          <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
            Headway understood
          </p>
          {item.state === 'ANALYSED' ? (
            <div className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-ink-700">
              {item.themes.length > 0 ? (
                <p className="text-ink-900">{item.themes.join(' · ')}</p>
              ) : (
                <p className="text-ink-500">Nothing here matched a theme Headway tracks.</p>
              )}
              <p className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={clsx('h-1.5 w-1.5 rounded-full', SENTIMENT_DOT[item.sentiment] ?? 'bg-ink-300')}
                />
                {item.sentimentLabel} in tone
              </p>
              {item.classLabel ? (
                <p>
                  <span className="text-ink-500">Sorted as</span> {item.classLabel}
                </p>
              ) : null}
              {item.replyState === 'SUGGESTED' ? (
                <p className="font-medium text-warn-700">Needs your answer · draft ready</p>
              ) : item.replyState === 'YOURS' ? (
                <p className="font-medium text-warn-700">Needs your own reply</p>
              ) : item.replyState === 'DRAFT' ? (
                <p className="text-ink-500">Draft ready, optional</p>
              ) : item.replyState === 'ANSWERED' ? (
                <p className="text-good-700">Answered</p>
              ) : null}
              {item.suggestedReply ? (
                <details className="group pt-1">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center list-none text-[12px] font-medium text-ink-600 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none">
                    Suggested reply <span aria-hidden>›</span>
                  </summary>
                  <p className="mt-1.5 border-l-2 border-ink-200 pl-3 whitespace-pre-line text-ink-800">
                    {item.suggestedReply}
                  </p>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500 italic">
              {item.state === 'PROCESSING'
                ? 'Headway is reading this now.'
                : item.state === 'FAILED'
                  ? 'Headway could not read this one yet. It will try again on its own.'
                  : 'Waiting for Headway to read it — usually within a minute of arriving.'}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The five ratings as one-tap filters. An owner asking "what did the unhappy
 * people say?" should not have to operate a form to find out.
 */
export function RatingStrip({
  base,
  ratings,
  active,
}: {
  base: string;
  ratings: Array<{ stars: number; count: number }>;
  active: number | null;
}) {
  return (
    <nav aria-label="By rating" className="mb-5 flex flex-wrap items-center gap-1.5">
      <Link
        href={base}
        aria-current={active === null ? 'page' : undefined}
        className={clsx(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none',
          active === null
            ? 'border-ink-900 bg-ink-900 text-white'
            : 'border-ink-300 text-ink-700 hover:border-ink-900 hover:text-ink-900',
        )}
      >
        All
      </Link>
      {[...ratings]
        .sort((a, b) => b.stars - a.stars)
        .map((r) => (
        <Link
          key={r.stars}
          href={`${base}?stars=${r.stars}`}
          aria-current={active === r.stars ? 'page' : undefined}
          aria-label={`${r.stars} star${r.stars === 1 ? '' : 's'}, ${r.count} ${r.count === 1 ? 'piece' : 'pieces'} of feedback`}
          className={clsx(
            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-[13px] tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none',
            active === r.stars
              ? 'border-ink-900 bg-ink-900 text-white'
              : r.count === 0
                ? 'border-ink-200 text-ink-400'
                : 'border-ink-300 text-ink-700 hover:border-ink-900 hover:text-ink-900',
          )}
        >
          {r.stars}★ <span className={active === r.stars ? 'text-ink-300' : 'text-ink-400'}>{r.count}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * Check-in, This week and This month are three windows on one question, so
 * they are one control rather than three tabs.
 */
export function PeriodSwitch({
  basePath,
  current,
}: {
  basePath: string;
  current: 'checkin' | 'pulse' | 'review';
}) {
  const options = [
    { slug: 'checkin', label: 'Since last check-in' },
    { slug: 'pulse', label: 'This week' },
    { slug: 'review', label: 'This month' },
  ] as const;
  return (
    <nav aria-label="Period" className="mb-8 -mt-3 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Link
          key={o.slug}
          href={`${basePath}/${o.slug}`}
          aria-current={current === o.slug ? 'page' : undefined}
          className={clsx(
            'inline-flex min-h-11 items-center rounded-full border px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none',
            current === o.slug
              ? 'border-ink-900 bg-ink-900 text-white'
              : 'border-ink-300 text-ink-700 hover:border-ink-900 hover:text-ink-900',
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * A handful of numbers with their names, in one line. The header of a page
 * that is a place to work, not a paragraph to read.
 */
export function StatusStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; tone?: 'neutral' | 'good' | 'warn' | 'bad' }>;
}) {
  const tones = {
    neutral: 'text-ink-900',
    good: 'text-good-700',
    warn: 'text-warn-700',
    bad: 'text-bad-700',
  };
  return (
    <ul className="mb-5 flex flex-wrap gap-x-6 gap-y-2 border-y border-ink-200 py-3">
      {items.map((i) => (
        <li key={i.label} className="flex items-baseline gap-1.5">
          <span className={clsx('text-[15px] font-semibold tabular-nums', tones[i.tone ?? 'neutral'])}>
            {i.value}
          </span>
          <span className="text-[12px] text-ink-500">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * CURRENT SIGNALS: what customers are mentioning so far, counted and marked.
 *
 * Every chip is one tap from the comments behind it. A chip with the mark
 * has cleared the evidence floor and is a pattern; the others are mentions
 * RepOS is keeping an eye on. The note underneath says exactly that, so a
 * first week reads as a first week and never as a verdict.
 */
export function SoFar({ soFar, basePath }: { soFar: PortalSoFar; basePath: string }) {
  return (
    <div>
      <p className="text-[13px] leading-relaxed text-ink-600">
        {soFar.read > 0 ? `Read ${pieces(soFar.read)}.` : 'Nothing read yet.'}
        {soFar.waiting > 0
          ? ` ${soFar.waiting} more ${soFar.waiting === 1 ? 'is' : 'are'} being read now.`
          : ''}
      </p>

      {soFar.mentions.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {soFar.mentions.map((m) => (
            <li key={m.themeKey}>
              <Link
                href={`${basePath}/reviews?theme=${encodeURIComponent(m.themeKey)}`}
                className={clsx(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none',
                  m.kind === 'ISSUE'
                    ? 'border-bad-200 bg-bad-50 text-bad-700 hover:border-bad-600'
                    : 'border-good-200 bg-good-50 text-good-700 hover:border-good-600',
                  m.pattern && 'font-semibold',
                )}
                aria-label={`${m.label}, mentioned by ${m.count} ${m.count === 1 ? 'customer' : 'customers'}${m.pattern ? ', a pattern' : ''}`}
              >
                {m.pattern ? <span aria-hidden>●</span> : null}
                {m.label}
                <span className="rounded-full bg-white/80 px-1.5 text-[12px] tabular-nums">{m.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {soFar.rated.length > 0 ? (
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {soFar.rated.map((d) => (
            <div
              key={d.label}
              className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink-200 pb-0.5 text-[13px]"
            >
              <dt className="text-ink-700">{d.label}</dt>
              <dd className="tabular-nums">
                <span className={clsx('font-semibold', d.average <= 3 ? 'text-bad-700' : 'text-good-700')}>
                  {d.average.toFixed(1)}
                </span>
                <span className="text-ink-400">
                  /5 · {d.rated} {d.rated === 1 ? 'rating' : 'ratings'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-3 text-[12px] leading-relaxed text-ink-500">{soFar.note}</p>
    </div>
  );
}
