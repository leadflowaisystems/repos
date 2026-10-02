import clsx from 'clsx';
import { Link } from '@/components/portal/link';
import { Reveal } from '@/components/portal/disclose';
import { getTranslator } from '@/lib/i18n/request';
import type { PortalTranslator } from '@/lib/i18n/translator';
import { quotesFor, type EvidenceIndex } from '@/lib/portal/evidence';
import {
  headlineOf,
  homeLists,
  type Direction,
  type EvidenceState,
  type Finding,
  type FindingLevel,
  type StandsOut,
} from '@/lib/portal/ladder';

/**
 * THE EVIDENCE LADDER, DRAWN (Oct 2026; quieter ladder pass).
 *
 * One reading, from the one evidence state (`src/lib/portal/ladder.ts`),
 * drawn at the density each page needs:
 *
 *   HOME        a briefing — the strongest truth, at most a few rows per list,
 *               one line on how sure Headway is. Scan the headings and the
 *               numbers and stop.
 *   CUSTOMERS   the whole picture — every topic on its rung, with its counts,
 *               a customer's words for a pattern, and what to do.
 *   TRENDS      change over time — the current picture in one line, and the
 *               direction as the headline.
 *
 * The first version of this file drew the same reading everywhere, with four
 * stacked blocks that said one idea ("nothing has repeated yet", "not sure
 * yet", "what more feedback will show", "what Headway is doing"). They are one
 * line now (`copy.note`), and the longer reasoning is behind "How Headway
 * decides" — still on the page, never in the way.
 *
 * The rung is always said in words ("Mentioned once", "Early signal",
 * "Emerging pattern") on a chip beside the topic; the evidence line beside it
 * is counts with the denominator ("2 of 5 customers"). The component decides
 * nothing: what earns a row on Home is `homeLists`, tested on its own.
 */

const EYEBROW = 'text-[11px] font-semibold tracking-[0.14em] uppercase';

const LEVEL_TONE: Record<FindingLevel, string> = {
  OBSERVATION: 'bg-ink-50 text-ink-600 ring-ink-200',
  EARLY_SIGNAL: 'bg-brand-50 text-brand-700 ring-brand-200',
  EMERGING_PATTERN: 'bg-ink-100 text-ink-900 ring-ink-300',
  STRONG_PATTERN: 'bg-ink-900 text-white ring-ink-900',
};

const TONE_TEXT = { good: 'text-good-700', bad: 'text-bad-700', neutral: 'text-ink-900' } as const;

/** The rung, as a small labelled chip. Words always; colour only repeats them. */
export function LevelChip({ finding }: { finding: Finding }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset',
        LEVEL_TONE[finding.level],
      )}
    >
      {finding.levelLabel}
    </span>
  );
}

function Mark({ finding, t }: { finding: Finding; t: PortalTranslator }) {
  if (!finding.movement) return null;
  // The engine's verdict is good-or-bad news; the arrow is the share's own
  // direction, recovered exactly as Home's `trendOf` recovers it.
  const rose = finding.kind === 'ISSUE' ? finding.movement === 'WORSENING' : finding.movement === 'IMPROVING';
  const mark = finding.movement === 'STABLE' ? '→' : rose ? '↑' : '↓';
  const tone =
    finding.movement === 'IMPROVING' ? 'text-good-700' : finding.movement === 'WORSENING' ? 'text-bad-700' : 'text-ink-500';
  const words =
    finding.movement === 'STABLE' ? t('brief.trend.same') : finding.movement === 'IMPROVING' ? t('brief.trend.better') : t('brief.trend.worse');
  return (
    <span className={clsx('text-[13px] font-semibold whitespace-nowrap', tone)}>
      <span aria-hidden>{mark}</span> {words}
    </span>
  );
}

/** Counts, shown only when they add something: "Mentioned once" already says one. */
function Counts({ finding }: { finding: Finding }) {
  if (finding.level === 'OBSERVATION') return null;
  return <span className="text-[13px] text-ink-600 tabular-nums">{finding.line}</span>;
}

// ---------------------------------------------------------------------------
// Customers: every topic, in full
// ---------------------------------------------------------------------------

/**
 * One topic, in full: its name, its rung, its counts, a customer's own words
 * for a pattern, and — only where the evidence earns it — what to do. The
 * whole name opens the feedback behind it.
 */
export function FindingRow({
  finding,
  basePath,
  evidence,
  t,
}: {
  finding: Finding;
  basePath: string;
  /** With it, a pattern carries one customer's own words. */
  evidence?: EvidenceIndex;
  t: PortalTranslator;
}) {
  const quote =
    evidence && (finding.level === 'EMERGING_PATTERN' || finding.level === 'STRONG_PATTERN')
      ? (quotesFor(evidence, finding.key, { limit: 1 })[0] ?? null)
      : null;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link
          href={`${basePath}/reviews?theme=${encodeURIComponent(finding.key)}`}
          className="text-[16px] leading-snug font-semibold text-ink-900 underline decoration-ink-200 underline-offset-4 hover:decoration-ink-900"
        >
          {finding.label}
        </Link>
        <LevelChip finding={finding} />
        <Counts finding={finding} />
        <Mark finding={finding} t={t} />
      </div>
      {quote ? (
        <blockquote className="mt-1.5 line-clamp-2 border-l-2 border-brand-400 pl-3 text-[14px] leading-snug text-ink-700">
          “{quote.text}”
        </blockquote>
      ) : null}
      {finding.action ? (
        finding.action.eyebrow ? (
          <div className="mt-2 rounded-lg bg-canvas px-3 py-2">
            <p className={clsx(EYEBROW, 'text-ink-500')}>{finding.action.eyebrow}</p>
            <p className="mt-0.5 text-[14px] leading-snug font-medium text-ink-900">{finding.action.text}</p>
          </div>
        ) : (
          <p className={clsx('mt-1 text-[13px] font-medium', finding.action.level === 'KEEP' ? 'text-good-700' : 'text-ink-600')}>
            {finding.action.text}
          </p>
        )
      ) : null}
    </li>
  );
}

/**
 * EVERY TOPIC MENTIONED, each on its rung — for the page whose job is the
 * whole picture (Customers). Complaints first, then praise.
 */
export async function AllFindings({
  state,
  basePath,
  evidence,
  title,
  exclude,
  className,
}: {
  state: EvidenceState;
  basePath: string;
  evidence?: EvidenceIndex;
  title?: string;
  /** Topics already shown in full elsewhere on the page, by key. */
  exclude?: ReadonlySet<string>;
  className?: string;
}) {
  const t = await getTranslator();
  const rows = [...state.concerns, ...state.likes].filter((f) => !exclude?.has(f.key));
  if (rows.length === 0) return null;
  return (
    <section className={className}>
      <h2 className={clsx(EYEBROW, 'text-ink-500')}>{title ?? t('ladder.section.everything')}</h2>
      <ul className="mt-1 divide-y divide-ink-100 border-y border-ink-200">
        {rows.map((f) => (
          <FindingRow key={`${f.kind}:${f.key}`} finding={f} basePath={basePath} evidence={evidence} t={t} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Home: the briefing
// ---------------------------------------------------------------------------

/**
 * One topic as one line: name, rung, counts, movement. A pattern that has a
 * suggestion carries it underneath — from ten read, Home is meant to be more
 * useful, not just longer.
 */
function TopicLine({ finding, basePath, t, withAction }: { finding: Finding; basePath: string; t: PortalTranslator; withAction: boolean }) {
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link
          href={`${basePath}/reviews?theme=${encodeURIComponent(finding.key)}`}
          className="text-[15px] leading-snug font-semibold text-ink-900 underline decoration-ink-200 underline-offset-4 hover:decoration-ink-900"
        >
          {finding.label}
        </Link>
        <LevelChip finding={finding} />
        <Counts finding={finding} />
        <Mark finding={finding} t={t} />
      </div>
      {withAction && finding.action?.eyebrow ? (
        <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-ink-700">
          <span className="font-semibold text-ink-900">{finding.action.eyebrow}:</span> {finding.action.text}
        </p>
      ) : null}
    </li>
  );
}

function TopicList({
  title,
  findings,
  basePath,
  t,
  tone,
  withAction = false,
}: {
  title: string;
  findings: Finding[];
  basePath: string;
  t: PortalTranslator;
  tone: 'good' | 'bad' | 'neutral';
  withAction?: boolean;
}) {
  if (findings.length === 0) return null;
  return (
    <section className="mt-5">
      <h3
        className={clsx(
          EYEBROW,
          'flex items-center gap-2',
          tone === 'good' ? 'text-good-700' : tone === 'bad' ? 'text-bad-700' : 'text-ink-500',
        )}
      >
        <span
          aria-hidden
          className={clsx('h-1.5 w-1.5 rounded-full', tone === 'good' ? 'bg-good-600' : tone === 'bad' ? 'bg-bad-600' : 'bg-ink-400')}
        />
        {title}
      </h3>
      <ul className="mt-0.5 divide-y divide-ink-100">
        {findings.map((f) => (
          <TopicLine key={`${f.kind}:${f.key}`} finding={f} basePath={basePath} t={t} withAction={withAction} />
        ))}
      </ul>
    </section>
  );
}

/** The strongest truth, as a headline: a sentence for a mood, a topic and its rung for a finding. */
function Headline({ headline, eyebrow, t }: { headline: StandsOut; eyebrow: boolean; t: PortalTranslator }) {
  return (
    <div>
      {eyebrow ? <p className={clsx(EYEBROW, 'text-ink-500')}>{t('ladder.section.standsOut')}</p> : null}
      <p
        className={clsx(
          'font-display text-[22px] leading-[1.2] font-semibold tracking-[-0.01em] text-balance sm:text-[24px]',
          eyebrow && 'mt-1',
          TONE_TEXT[headline.tone],
        )}
      >
        {headline.title}
      </p>
      {headline.finding ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <LevelChip finding={headline.finding} />
          <Counts finding={headline.finding} />
        </p>
      ) : null}
    </div>
  );
}

/**
 * HOW SURE, IN ONE LINE — and the reasoning one tap down. The note is the
 * whole answer an owner needs; "How Headway decides" holds what used to be
 * three blocks on every page, for the owner who asks.
 */
function Confidence({
  state,
  t,
  reveal = true,
  className,
}: {
  state: EvidenceState;
  t: PortalTranslator;
  /** Off where the page has its own "How Headway decides" (Check-in's direction card), so one label never means two things. */
  reveal?: boolean;
  className?: string;
}) {
  const { copy } = state;
  const reasons = reveal ? [copy.notSure, copy.clearer, ...copy.doing].filter((x): x is string => Boolean(x)) : [];
  if (!copy.note && reasons.length === 0) return null;
  return (
    <div className={className}>
      {copy.note ? <p className="text-[14px] leading-snug font-medium text-ink-700">{copy.note}</p> : null}
      {reasons.length > 0 ? (
        <Reveal summary={t('ladder.how.title')} className="mt-1">
          <ul className="max-w-2xl space-y-1 text-[13px] leading-relaxed text-ink-600">
            {reasons.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Reveal>
      ) : null}
    </div>
  );
}

/**
 * HOME'S READING — the briefing (quieter ladder pass).
 *
 *   1 response    what they told you, a line each
 *   2 and up      what stands out, in one sentence
 *   then          what keeps coming up (patterns), what customers like (praise
 *                 that has repeated), what is worth watching — a few rows each,
 *                 by `homeLists`, so one compliment never fills a row
 *   last          how sure Headway is, in one line
 *
 * Density follows the evidence: at five there may be two rows; at thirty there
 * are patterns with what to do about them. `omit` is the topic Home's story
 * card already tells in full.
 */
export async function HomeReading({
  state,
  basePath,
  omit = null,
  className,
}: {
  state: EvidenceState;
  basePath: string;
  omit?: string | null;
  className?: string;
}) {
  const t = await getTranslator();
  const headline = headlineOf(state, omit);
  const lists = homeLists(state, omit);
  const rows = lists.patterns.length + lists.likes.length + lists.watching.length;
  // With the story card above telling the one topic there is, and nothing
  // else to list, the card would hold only a reveal: say nothing instead.
  if (!state.firstResponse && !headline && rows === 0 && !state.copy.note) return null;
  return (
    <section
      aria-label={t('ladder.section.standsOut')}
      className={clsx('rounded-2xl border border-ink-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,42,67,0.04)] sm:p-6', className)}
    >
      {state.firstResponse ? (
        <div>
          <p className={clsx(EYEBROW, 'text-ink-500')}>{t('ladder.section.first')}</p>
          <ul className="mt-1.5 space-y-0.5">
            {state.firstResponse.map((line) => (
              <li key={line} className="text-[16px] leading-snug font-medium text-ink-900">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : headline ? (
        <Headline headline={headline} eyebrow t={t} />
      ) : null}

      {state.read > 1 ? (
        <>
          <TopicList title={t('ladder.section.patterns')} findings={lists.patterns} basePath={basePath} t={t} tone="bad" withAction />
          <TopicList title={t('ladder.section.watching')} findings={lists.watching} basePath={basePath} t={t} tone="neutral" />
          <TopicList title={t('ladder.section.likes')} findings={lists.likes} basePath={basePath} t={t} tone="good" />
          {/* What Home left out is one tap away, and says how much there is,
              so a topic kept off Home is never a topic hidden. */}
          {lists.more > 0 ? (
            <Link
              href={`${basePath}/analysis`}
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-700 hover:text-ink-900"
            >
              {t.plural('ladder.more.topics', lists.more)} <span aria-hidden>→</span>
            </Link>
          ) : null}
        </>
      ) : null}

      <Confidence state={state} t={t} className="mt-4 border-t border-ink-100 pt-4" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// The summary every other page opens with
// ---------------------------------------------------------------------------

/**
 * THE READING IN ONE BLOCK — the pulse, the headline, the one confidence line.
 * Customers, Check-in and the period reports open with it and then do their
 * own job; none of them repeats Home's lists.
 */
export async function ReadingSummary({
  state,
  reasons = true,
  className,
}: {
  state: EvidenceState;
  /** Whether to offer "How Headway decides" — off where the page offers its own. */
  reasons?: boolean;
  className?: string;
}) {
  const t = await getTranslator();
  const headline = headlineOf(state);
  return (
    <section className={className}>
      <PulseLine state={state} className="mb-3" />
      {headline ? <Headline headline={headline} eyebrow={false} t={t} /> : null}
      <Confidence state={state} t={t} reveal={reasons} className="mt-2" />
    </section>
  );
}

/**
 * BEFORE ANYTHING IS READ — how feedback arrives, and the way to the card.
 * From the first read response, every page shows the summary instead.
 */
export async function EvidenceReading({
  state,
  basePath,
  className,
}: {
  state: EvidenceState;
  basePath: string;
  className?: string;
}) {
  if (state.stage !== 'NONE') return <ReadingSummary state={state} className={className} />;
  const t = await getTranslator();
  return (
    <section
      aria-labelledby="evidence-start"
      className={clsx('rounded-2xl border border-ink-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,42,67,0.04)] sm:p-6', className)}
    >
      <h2 id="evidence-start" className="font-display text-[24px] leading-[1.15] font-semibold text-balance text-ink-900 sm:text-[26px]">
        {state.copy.title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-700">{state.copy.intro}</p>
      <Link
        href={`${basePath}/kit`}
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-ink-900 underline decoration-brand-400 underline-offset-4 hover:decoration-ink-900"
      >
        {t('ladder.cta.kit')} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Direction and pulse
// ---------------------------------------------------------------------------

/**
 * WHICH WAY THINGS ARE MOVING — answered in the title ("Not enough history
 * yet"), explained in one sentence, reassured in one more, and the method one
 * tap down. Trends' and Check-in's job, never Home's.
 */
export async function DirectionPanel({
  direction,
  title = true,
  className,
}: {
  direction: Direction;
  /** Off where the page heading already says the state (Check-in's "Nothing compared yet"). */
  title?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={title ? 'direction-title' : undefined}
      className={clsx('rounded-2xl border border-ink-200 bg-white p-5 sm:p-6', className)}
    >
      {title ? (
        <h2 id="direction-title" className="font-display text-[22px] leading-[1.15] font-semibold text-ink-900 sm:text-[24px]">
          {direction.title}
        </h2>
      ) : null}
      <p className={clsx('max-w-2xl text-[15px] leading-relaxed text-ink-700', title && 'mt-2')}>{direction.body}</p>
      {direction.automatic ? <p className="mt-2 text-[14px] leading-snug text-ink-600">{direction.automatic}</p> : null}
      <Reveal summary={direction.methodTitle} className="mt-2">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-600">{direction.method}</p>
      </Reveal>
    </section>
  );
}

/**
 * HOW CUSTOMERS FEEL, COMPACTLY: "First read · 5 responses", the three counts,
 * and "4.8★ from 4 ratings" — each figure once, with its denominator.
 */
export async function PulseLine({
  state,
  eyebrow = true,
  className,
}: {
  state: EvidenceState;
  /** The stage and the count above the figures; off where the page heading says them. */
  eyebrow?: boolean;
  className?: string;
}) {
  const t = await getTranslator();
  if (state.read === 0) return null;
  const tiles = [
    { key: 'happy', label: t('brief.today.happy'), value: state.pulse.happy, dot: 'bg-good-600' },
    { key: 'mixed', label: t('brief.today.mixed'), value: state.pulse.mixed, dot: 'bg-brand-400' },
    { key: 'unhappy', label: t('brief.today.unhappy'), value: state.pulse.unhappy, dot: 'bg-bad-600' },
  ];
  return (
    <div className={className}>
      {eyebrow ? (
        <p className={clsx(EYEBROW, 'flex flex-wrap items-center gap-x-2 text-brand-700')}>
          <span>{state.copy.eyebrow}</span>
          <span className="font-medium tracking-normal text-ink-500 normal-case">· {state.copy.countLine}</span>
        </p>
      ) : null}
      <dl className={clsx('flex flex-wrap items-center gap-x-4 gap-y-1', eyebrow && 'mt-1.5')}>
        {tiles.map((tile) => (
          <div key={tile.key} className="flex items-baseline gap-1.5">
            <span aria-hidden className={clsx('h-2 w-2 shrink-0 self-center rounded-full', tile.dot)} />
            <dd className="text-[16px] font-semibold text-ink-900 tabular-nums">{tile.value}</dd>
            <dt className="text-[13px] text-ink-600">{tile.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[12px] text-ink-500 tabular-nums">{state.pulse.from}</p>
    </div>
  );
}
