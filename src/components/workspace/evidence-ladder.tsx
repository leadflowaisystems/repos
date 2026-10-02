import clsx from 'clsx';
import { Link } from '@/components/portal/link';
import { Reveal } from '@/components/portal/disclose';
import { HeadwayMark } from '@/components/brand';
import { getTranslator } from '@/lib/i18n/request';
import type { PortalTranslator } from '@/lib/i18n/translator';
import { quotesFor, type EvidenceIndex } from '@/lib/portal/evidence';
import type { Direction, EvidenceState, Finding, FindingLevel } from '@/lib/portal/ladder';

/**
 * THE EVIDENCE LADDER, DRAWN (Oct 2026).
 *
 * One reading, from the one evidence state (`src/lib/portal/ladder.ts`),
 * drawn the same way wherever it appears: Home, Customers, Trends, Check-in
 * and the period reports. It replaces two cards that made Headway look idle —
 * the countdown ("3 more responses to go") and "Trends aren't ready yet" — with
 * what the evidence already supports at every stage:
 *
 *   WHAT WE KNOW NOW      what stands out, what customers seem to like
 *   WHAT WE ARE WATCHING  complaints mentioned, not yet a pattern
 *   NOT SURE YET          said out loud, with why
 *   WHAT MORE WILL SHOW   what becomes clearer, never a number to reach
 *   WHAT HEADWAY DOES     reads, keeps one-offs apart, compares by itself
 *
 * Every row says its rung in words ("Early signal", "Emerging pattern") and
 * its evidence in counts with the denominator. The component decides nothing:
 * every sentence and every list arrives built.
 */

const EYEBROW = 'text-[11px] font-semibold tracking-[0.14em] uppercase';

const LEVEL_TONE: Record<FindingLevel, string> = {
  OBSERVATION: 'bg-ink-50 text-ink-600 ring-ink-200',
  EARLY_SIGNAL: 'bg-brand-50 text-brand-700 ring-brand-200',
  EMERGING_PATTERN: 'bg-ink-100 text-ink-900 ring-ink-300',
  STRONG_PATTERN: 'bg-ink-900 text-white ring-ink-900',
};

/** The rung, as a small labelled chip. Words always; colour only repeats them. */
export function LevelChip({ finding }: { finding: Finding }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
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
    <span className={clsx('text-[13px] font-semibold', tone)}>
      <span aria-hidden>{mark}</span> {words}
    </span>
  );
}

/**
 * One topic, as one row: its name, its rung, the evidence sentence, and —
 * scaled to the rung — what the owner might do. The whole name opens the
 * feedback behind it.
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
        <Mark finding={finding} t={t} />
      </div>
      <p className="mt-1 max-w-2xl text-[14px] leading-snug text-ink-700 tabular-nums">{finding.line}</p>
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
          <p
            className={clsx(
              'mt-1 text-[13px] font-medium',
              finding.action.level === 'KEEP' ? 'text-good-700' : 'text-ink-600',
            )}
          >
            {finding.action.text}
          </p>
        )
      ) : null}
    </li>
  );
}

function FindingList({
  title,
  findings,
  basePath,
  evidence,
  t,
  tone = 'neutral',
}: {
  title: string;
  findings: Finding[];
  basePath: string;
  evidence?: EvidenceIndex;
  t: PortalTranslator;
  tone?: 'good' | 'bad' | 'neutral';
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
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            tone === 'good' ? 'bg-good-600' : tone === 'bad' ? 'bg-bad-600' : 'bg-ink-400',
          )}
        />
        {title}
      </h3>
      <ul className="mt-1 divide-y divide-ink-100">
        {findings.map((f) => (
          <FindingRow key={`${f.kind}:${f.key}`} finding={f} basePath={basePath} evidence={evidence} t={t} />
        ))}
      </ul>
    </section>
  );
}

/** How many rows a list shows on a card. The rest are one tap away on Customers. */
const ROWS = 3;

/**
 * THE READING — what Headway knows right now, at whatever stage this is.
 *
 * `omit` leaves out a topic another block on the same page already tells in
 * full (Home's story card), so no topic is said twice on one screen.
 */
export async function EvidenceReading({
  state,
  basePath,
  evidence,
  omit = null,
  calm = null,
  variant = 'card',
  headingLevel = 2,
  lists = true,
  eyebrow = true,
  className,
}: {
  state: EvidenceState;
  basePath: string;
  evidence?: EvidenceIndex;
  omit?: string | null;
  /** A sentence to open with when nothing needs the owner — only ever earned at 10+ read. */
  calm?: string | null;
  /** `card` on Home; `page` sits on a page that has its own heading; `compact` keeps to the essentials. */
  variant?: 'card' | 'page' | 'compact';
  headingLevel?: 2 | 3;
  /**
   * Whether to list the topics here. A page that lists every topic in full
   * below (Customers' board) keeps the reading to its summary, so no topic is
   * listed twice.
   */
  lists?: boolean;
  /**
   * Whether to open with the stage and the read count. Home's band already
   * says both, one line above, so Home's card leaves them out.
   */
  eyebrow?: boolean;
  className?: string;
}) {
  const t = await getTranslator();
  const { copy } = state;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const skip = (f: Finding) => f.key !== omit;
  const stood = state.standsOut?.kind === 'FINDING' ? state.standsOut.findingKey : null;
  // Three lists, by what they are to the owner: complaints customers keep
  // raising (a pattern), everything they praise (strongest first, patterns
  // included), and complaints only being watched. Praise is never filed under
  // a heading — or a colour — meant for complaints.
  const patterns = state.patterns.filter((f) => f.kind === 'ISSUE').filter(skip).filter((f) => f.key !== stood);
  const likes = state.likes.filter(skip).filter((f) => f.key !== stood);
  const watching = state.watching.filter(skip).filter((f) => f.key !== stood);
  const compact = variant === 'compact';
  const rows = compact ? 2 : ROWS;

  return (
    <section
      aria-labelledby={`evidence-reading-${variant}`}
      className={clsx(
        variant === 'card' && 'rounded-2xl border border-ink-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,42,67,0.04)] sm:p-6',
        className,
      )}
    >
      {eyebrow ? (
        <p className={clsx(EYEBROW, 'mb-1.5 flex flex-wrap items-center gap-x-2 text-brand-700')}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          <span>{copy.eyebrow}</span>
          {state.read > 0 ? <span className="font-medium text-ink-500 normal-case tracking-normal">· {copy.readLine}</span> : null}
        </p>
      ) : null}
      <H
        id={`evidence-reading-${variant}`}
        className={clsx(
          'font-display leading-[1.15] font-semibold text-balance text-ink-900',
          compact ? 'text-[20px]' : 'text-[24px] sm:text-[26px]',
        )}
      >
        {calm ?? copy.title}
      </H>
      <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-700">{copy.intro}</p>

      {state.stage === 'NONE' ? (
        <div className="mt-4 flex flex-wrap gap-x-6">
          <Link
            href={`${basePath}/kit`}
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-ink-900 underline decoration-brand-400 underline-offset-4 hover:decoration-ink-900"
          >
            {t('ladder.cta.kit')} <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}

      {state.firstResponse ? (
        <section className="mt-5">
          <h3 className={clsx(EYEBROW, 'text-ink-500')}>{t('ladder.section.first')}</h3>
          <ul className="mt-1.5 space-y-1">
            {state.firstResponse.map((line) => (
              <li key={line} className="text-[15px] leading-snug text-ink-800">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.standsOut && !(state.standsOut.findingKey && state.standsOut.findingKey === omit) ? (
        <section className="mt-5 rounded-xl bg-canvas px-4 py-3">
          <h3 className={clsx(EYEBROW, 'text-ink-500')}>{t('ladder.section.standsOut')}</h3>
          <p
            className={clsx(
              'mt-1 text-[17px] leading-snug font-semibold',
              state.standsOut.tone === 'good' ? 'text-good-700' : state.standsOut.tone === 'bad' ? 'text-bad-700' : 'text-ink-900',
            )}
          >
            {state.standsOut.title}
          </p>
          {state.standsOut.line ? (
            <p className="mt-0.5 text-[14px] leading-snug text-ink-700 tabular-nums">{state.standsOut.line}</p>
          ) : null}
        </section>
      ) : null}

      {lists && state.read > 1 ? (
        <>
          <FindingList
            title={t('ladder.section.patterns')}
            findings={patterns.slice(0, rows)}
            basePath={basePath}
            evidence={evidence}
            t={t}
            tone="bad"
          />
          <FindingList
            title={t('ladder.section.likes')}
            findings={likes.slice(0, rows)}
            basePath={basePath}
            evidence={evidence}
            t={t}
            tone="good"
          />
          <FindingList
            title={t('ladder.section.watching')}
            findings={watching.slice(0, rows)}
            basePath={basePath}
            evidence={evidence}
            t={t}
          />
        </>
      ) : null}

      {copy.nothingRepeated ? (
        <p className="mt-4 border-l-2 border-ink-300 pl-3 text-[14px] leading-snug text-ink-700">{copy.nothingRepeated}</p>
      ) : null}

      {state.stage !== 'NONE' && (copy.notSure || copy.clearer) ? (
        <dl className="mt-5 grid gap-3 border-t border-ink-200 pt-4 sm:grid-cols-2">
          {copy.notSure ? (
            <div>
              <dt className={clsx(EYEBROW, 'text-ink-500')}>{t('ladder.section.notSure')}</dt>
              <dd className="mt-1 text-[14px] leading-snug text-ink-700">{copy.notSure}</dd>
            </div>
          ) : null}
          {copy.clearer ? (
            <div>
              <dt className={clsx(EYEBROW, 'text-ink-500')}>{t('ladder.section.clearer')}</dt>
              <dd className="mt-1 text-[14px] leading-snug text-ink-700">{copy.clearer}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {!compact && state.stage !== 'NONE' ? (
        <div className="mt-4 flex items-start gap-3">
          <HeadwayMark className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className={clsx(EYEBROW, 'text-ink-500')}>{t('ladder.section.doing')}</p>
            <ul className="mt-1 space-y-0.5">
              {copy.doing.map((line) => (
                <li key={line} className="text-[13px] leading-snug text-ink-600">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {state.collected > 0 ? (
        <Link
          href={`${basePath}/reviews#entries`}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
        >
          {t('ladder.reviews.cta')} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </section>
  );
}

/**
 * EVERY TOPIC MENTIONED, each on its rung — for the pages whose job is the
 * whole picture (Customers, Trends). Complaints first, then praise.
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

/**
 * WHICH WAY THINGS ARE MOVING — the direction's own readiness, without a
 * chore in it. Replaces "Trends aren't ready yet", which listed "responses
 * waiting for your first check-in" as if the owner owed Headway one.
 */
export async function DirectionPanel({
  direction,
  basePath,
  variant = 'full',
  className,
}: {
  direction: Direction;
  basePath: string;
  /** `compact` is Home's side note, with the way to Trends. */
  variant?: 'full' | 'compact';
  className?: string;
}) {
  const t = await getTranslator();
  return (
    <section
      aria-labelledby={`direction-${variant}`}
      className={clsx('rounded-2xl border border-ink-200 bg-white p-5 sm:p-6', className)}
    >
      <h2
        id={`direction-${variant}`}
        className={clsx(
          'font-display leading-[1.15] font-semibold text-ink-900',
          variant === 'compact' ? 'text-[18px]' : 'text-[22px] sm:text-[24px]',
        )}
      >
        {direction.title}
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">{direction.body}</p>
      {direction.automatic ? (
        <p className="mt-2 border-l-2 border-brand-400 pl-3 text-[14px] leading-snug text-ink-700">{direction.automatic}</p>
      ) : null}
      {variant === 'full' ? (
        <Reveal summary={direction.methodTitle} className="mt-3">
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-600">{direction.method}</p>
        </Reveal>
      ) : (
        <Link
          href={`${basePath}/improvements`}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
        >
          {t('ladder.direction.see')} <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}

/**
 * HOW MUCH, AND HOW IT SPLIT — the pulse with its denominators said out
 * loud: "Of 5 responses read", and the ratings counted on their own ("4 star
 * ratings · 4.8★ average"), so a five never sits over an average of four.
 */
export async function PulseLine({ state, className }: { state: EvidenceState; className?: string }) {
  const t = await getTranslator();
  if (state.read === 0) return null;
  const tiles = [
    { key: 'happy', label: t('brief.today.happy'), value: state.pulse.happy, dot: 'bg-good-600' },
    { key: 'mixed', label: t('brief.today.mixed'), value: state.pulse.mixed, dot: 'bg-brand-400' },
    { key: 'unhappy', label: t('brief.today.unhappy'), value: state.pulse.unhappy, dot: 'bg-bad-600' },
  ];
  return (
    <div className={className}>
      <p className={clsx(EYEBROW, 'flex flex-wrap items-center gap-x-2 text-brand-700')}>
        <span>{state.copy.eyebrow}</span>
        <span className="font-medium text-ink-500 normal-case tracking-normal">· {state.copy.readLine}</span>
      </p>
      <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex items-baseline gap-1.5">
            <span aria-hidden className={clsx('h-2 w-2 shrink-0 self-center rounded-full', tile.dot)} />
            <dd className="text-[16px] font-semibold text-ink-900 tabular-nums">{tile.value}</dd>
            <dt className="text-[13px] text-ink-600">{tile.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[12px] text-ink-500 tabular-nums">
        {state.pulse.basis} · {state.pulse.ratings}
      </p>
    </div>
  );
}
