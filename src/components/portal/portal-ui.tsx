import { Link } from '@/components/portal/link';
import clsx from 'clsx';
import type {
  PortalAction,
  PortalAdvice,
  PortalBucket,

  PortalKnown,
  PortalOutcome,
  PortalQuestion,
  PortalSignal,
  PortalSoFar,
  PortalWatch,
} from '@/lib/portal/view';
import type { ReviewItem } from '@/lib/portal/pages';
import { formatDate } from '@/lib/format';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';
import type { Translator } from '@/lib/i18n/t';

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
 *   CUSTOMERS SAY       what the feedback shows
 *   WHAT IT MEANS       Headway's reading of it
 *   HEADWAY RECOMMENDS  what to consider doing
 *   YOU TOLD US         what the owner said
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

export async function Limits({ limits, collapsed = false }: { limits: string[]; collapsed?: boolean }) {
  if (limits.length === 0) return null;
  const t = await getTranslator();
  const list = (
    <ul className="mt-3 space-y-1.5">
      {limits.map((l) => (
        <li key={l} className="text-[12px] leading-relaxed text-ink-500">
          {l}
        </li>
      ))}
    </ul>
  );
  // Home summarises, so the limits sit behind one tap there; Customers is the
  // page that explains, so they are open on it. Same sentences either way.
  if (collapsed) {
    return (
      <details className="group mt-10 border-t border-ink-200 pt-4">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium tracking-widest text-ink-500 uppercase hover:text-ink-900">
          {t('common.limits.title')} <span aria-hidden>›</span>
        </summary>
        {list}
      </details>
    );
  }
  return (
    <section className="mt-12 border-t border-ink-200 pt-5">
      <h2 className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
        {t('common.limits.title')}
      </h2>
      {list}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Labels that keep the four kinds of statement apart
// ---------------------------------------------------------------------------

export type LayerKind = 'fact' | 'meaning' | 'why' | 'recommend' | 'owner' | 'next' | 'watch';

const LAYER_LABELS: Record<LayerKind, MessageKey> = {
  fact: 'common.layer.fact',
  meaning: 'common.layer.meaning',
  why: 'common.layer.why',
  recommend: 'common.layer.recommend',
  owner: 'common.layer.owner',
  next: 'common.layer.next',
  watch: 'common.state.watching',
};

/** A labelled row. The label is the reader's guarantee of what kind of statement follows. */
export async function Layer({
  kind,
  children,
  strong,
}: {
  kind: LayerKind;
  children: React.ReactNode;
  strong?: boolean;
}) {
  const t = await getTranslator();
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-1.5 sm:grid-cols-[7.5rem_1fr]">
      <p className="pt-0.5 text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
        {t(LAYER_LABELS[kind])}
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

export async function Tag({ bucket }: { bucket: PortalBucket }) {
  const t = await getTranslator();
  return (
    <span
      className={clsx(
        'inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase',
        BUCKET_TONE[bucket],
      )}
    >
      {bucket === 'FIRST'
        ? t('common.tag.first')
        : bucket === 'KEEP'
          ? t('common.tag.keep')
          : bucket === 'WATCH'
            ? t('common.state.watching')
            : t('common.tag.early')}
    </span>
  );
}

export async function EvidenceLink({
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
  const t = await getTranslator();
  return (
    <Link
      href={`${basePath}/reviews?theme=${encodeURIComponent(themeKey)}`}
      className="inline-flex min-h-11 items-center gap-1.5 group text-[13px] font-medium text-ink-700 transition-colors hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {label ??
        (count === undefined
          ? t('common.evidence.readCommentsAll')
          : t.plural('common.evidence.readComments', count))}
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
export async function FactLine({ signal }: { signal: PortalSignal }) {
  const t = await getTranslator();
  return (
    <p className="text-[12px] text-ink-500 tabular-nums">
      {t('common.fact.ofTotal', { count: signal.evidenceCount, total: signal.evidenceTotal })} ·{' '}
      {signal.share}
      {signal.movementCounts ? (
        <>
          {' '}
          · <Arrow signal={signal} />{' '}
          {t('common.fact.movement', { counts: signal.movementCounts })}
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
function readingOf(
  outcome: PortalOutcome,
  t: Translator<MessageKey>,
): { label: string; tone: string } {
  switch (outcome.result) {
    case 'IMPROVED':
      return { label: t('common.outcome.improved'), tone: 'text-good-700' };
    case 'WORSENED':
      // Red, not gold. A theme that came up MORE after a change is the
      // definition of something getting worse, and gold means Headway is
      // watching — a different thing entirely. This read as gold for exactly
      // as long as it took to re-check every use of the token.
      return { label: t('common.outcome.worsened'), tone: 'text-bad-700' };
    case 'NO_CLEAR_CHANGE':
      // "No clear difference", not "no difference": Headway failed to see one,
      // which is not the same as having measured its absence. All three
      // languages keep that distinction.
      return { label: t('common.outcome.noChange'), tone: 'text-ink-500' };
    default:
      return { label: t('common.outcome.tooEarly'), tone: 'text-ink-500' };
  }
}

/** "15% → 7% · mentioned less often after the change" in one line. The bars live on Improvements. */
async function OutcomeLine({ outcome }: { outcome: PortalOutcome }) {
  const t = await getTranslator();
  const reading = readingOf(outcome, t);
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
export async function ThemeStory({
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
  const t = await getTranslator();
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

        {/* Everything the owner told Headway about this theme — the decision,
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
                  {t('common.link.afterChange')} <span aria-hidden>→</span>
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
          {/* The advice label comes from the view model, so the full stop that
              closes it is printed here — and Hindi closes a sentence with the
              danda, not with a Latin dot. */}
          <span className={clsx('font-medium', ADVICE_TONE[s.advice])}>
            {s.adviceLabel}
            {t('common.punct.stop')}
          </span>{' '}
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
// The work Headway did, the watch list, the one question
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

/** What the owner told Headway, shown back to them. Their words, their label. */
export async function Knows({ items, basePath }: { items: PortalKnown[]; basePath: string }) {
  const t = await getTranslator();
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
                  {t('common.evidence.readCommentsAll')} <span aria-hidden>→</span>
                </Link>
              ) : (
                formatDate(k.recordedAt)
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-500">{t('common.knows.note')}</p>
    </div>
  );
}

export async function Question({ q }: { q: PortalQuestion }) {
  const t = await getTranslator();
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
      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-500">{t('common.question.note')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The improvement loop
// ---------------------------------------------------------------------------

/** A compact recap of a checked change, for the check-in. */
export async function OutcomeRow({ action, basePath }: { action: PortalAction; basePath: string }) {
  const t = await getTranslator();
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
            {t('common.outcome.awaiting', { have: a.awaiting.have, need: a.awaiting.need })}
          </span>
        ) : null}
      </div>
      {a.decision ? (
        <p className="mt-0.5 text-[13px] text-ink-600 italic">
          {t('common.outcome.youChanged', { decision: a.decision })}
          {a.doneAt ? (
            <span className="not-italic text-ink-500">
              {' · '}
              {t('common.outcome.recorded', { date: formatDate(a.doneAt) })}
            </span>
          ) : null}
        </p>
      ) : null}
      {a.outcome ? (
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">{a.outcome.headline}</p>
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

export async function SentimentBar({
  sentiments,
}: {
  sentiments: Array<{ key: string; label: string; count: number }>;
}) {
  const t = await getTranslator();
  const total = sentiments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <Quiet>{t('common.sofar.nothingRead')}</Quiet>;
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

async function Stars({ value }: { value: number }) {
  const t = await getTranslator();
  return (
    <span className="font-medium text-warn-600" aria-label={t('common.stars.aria', { value })}>
      {'★'.repeat(value)}
      <span className="text-ink-300" aria-hidden>
        {'☆'.repeat(5 - value)}
      </span>
    </span>
  );
}

/**
 * One feedback entry, in two columns that must never blur into each other.
 *
 * CUSTOMER GAVE is exactly what the person tapped and typed: the overall
 * rating, a rating for each part of the visit the vertical asks about, the
 * specifics they selected, and their words in quotation marks. Nothing here
 * is paraphrased, and a customer who wrote nothing is shown as having written
 * nothing.
 *
 * HEADWAY UNDERSTOOD is everything derived from that: the topics, the tone, how
 * it was sorted, and whether it needs an answer. Labelled as a reading, placed
 * beside the evidence rather than woven into it, so an owner can always check
 * the one against the other — and can never mistake "Slow service" for
 * something the customer literally said.
 */
export async function ReviewRow({ item }: { item: ReviewItem }) {
  const t = await getTranslator();
  const { gave } = item;
  const tapped = gave.dimensions.length > 0 || gave.selected.length > 0;

  return (
    <li className="py-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
            {t('common.review.gave')}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
            {item.stars !== null ? (
              <Stars value={item.stars} />
            ) : (
              <span className="italic">{t('common.review.noRating')}</span>
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
              <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
                {t('common.review.selected')}
              </p>
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
            <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
              {t('common.review.written')}
            </p>
            {item.text.length > 0 ? (
              <p className="mt-1 text-[14px] leading-relaxed text-ink-900">“{item.text}”</p>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500 italic">
                {tapped
                  ? t('common.review.noWordsTapped')
                  : t('common.review.ratingOnly')}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-dashed border-ink-200 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-6">
          <p className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
            {t('common.review.understood')}
          </p>
          {item.state === 'ANALYSED' ? (
            <div className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-ink-700">
              {item.themes.length > 0 ? (
                <p className="text-ink-900">{item.themes.join(' · ')}</p>
              ) : (
                <p className="text-ink-500">{t('common.review.noTopic')}</p>
              )}
              <p className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={clsx('h-1.5 w-1.5 rounded-full', SENTIMENT_DOT[item.sentiment] ?? 'bg-ink-300')}
                />
                {t('common.review.tone', { label: item.sentimentLabel })}
              </p>
              {item.classLabel ? (
                <p>
                  <span className="text-ink-500">{t('common.review.sortedAs')}</span>{' '}
                  {item.classLabel}
                </p>
              ) : null}
              {item.replyState === 'SUGGESTED' ? (
                <p className="font-medium text-warn-700">{t('common.review.needsAnswerDraft')}</p>
              ) : item.replyState === 'YOURS' ? (
                <p className="font-medium text-warn-700">{t('common.review.needsAnswerNoDraft')}</p>
              ) : item.replyState === 'DRAFT' ? (
                <p className="text-ink-500">{t('common.review.answerOptionalDraft')}</p>
              ) : item.replyState === 'ANSWERED' ? (
                <p className="text-good-700">{t('common.review.answered')}</p>
              ) : null}
              {item.suggestedReply ? (
                <details className="group pt-1">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center list-none text-[12px] font-medium text-ink-600 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none">
                    {t('common.review.suggestedReply')} <span aria-hidden>›</span>
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
                ? t('common.review.reading')
                : item.state === 'FAILED'
                  ? t('common.review.failed')
                  : t('common.review.waiting')}
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
export async function RatingStrip({
  base,
  ratings,
  active,
}: {
  base: string;
  ratings: Array<{ stars: number; count: number }>;
  active: number | null;
}) {
  const t = await getTranslator();
  return (
    <nav aria-label={t('common.rating.label')} className="mb-5 flex flex-wrap items-center gap-1.5">
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
        {t('common.rating.all')}
      </Link>
      {[...ratings]
        .sort((a, b) => b.stars - a.stars)
        .map((r) => (
        <Link
          key={r.stars}
          href={`${base}?stars=${r.stars}`}
          aria-current={active === r.stars ? 'page' : undefined}
          aria-label={t.plural('common.rating.filter', r.count, { stars: r.stars })}
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
export async function PeriodSwitch({
  basePath,
  current,
}: {
  basePath: string;
  current: 'checkin' | 'pulse' | 'review';
}) {
  const t = await getTranslator();
  // `label` holds the dictionary key, not the word: the three windows are
  // named in the owner's language while the three slugs stay put.
  const options = [
    { slug: 'checkin', label: 'nav.period.checkin' },
    { slug: 'pulse', label: 'nav.period.pulse' },
    { slug: 'review', label: 'nav.period.review' },
  ] as const satisfies ReadonlyArray<{ slug: string; label: MessageKey }>;
  return (
    <nav aria-label={t('nav.period.label')} className="mb-8 -mt-3 flex flex-wrap gap-1.5">
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
          {t(o.label)}
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
 * WHAT KEEPS COMING UP: what customers are mentioning so far, counted and marked.
 *
 * Every chip is one tap from the comments behind it. A chip with the mark
 * has cleared the mention floor and is a pattern; the others are mentions
 * Headway is keeping an eye on. The note underneath says exactly that, so a
 * first week reads as a first week and never as a verdict.
 */
export async function SoFar({
  soFar,
  basePath,
  explain = false,
}: {
  soFar: PortalSoFar;
  basePath: string;
  /** Customers explains what a pattern is; Home only shows the chips. */
  explain?: boolean;
}) {
  const t = await getTranslator();
  return (
    <div>
      <p className="text-[13px] leading-relaxed text-ink-600">
        {soFar.read > 0
          ? t.plural('common.sofar.read', soFar.read)
          : t('common.sofar.nothingRead')}
        {soFar.waiting > 0 ? ` ${t.plural('common.sofar.beingRead', soFar.waiting)}` : ''}
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
                aria-label={t.plural(
                  m.pattern ? 'common.sofar.chipPattern' : 'common.sofar.chip',
                  m.count,
                  { label: m.label },
                )}
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
                  /5 · {t.plural('common.sofar.ratings', d.rated)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {explain ? (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-500">{soFar.note}</p>
      ) : null}
    </div>
  );
}
