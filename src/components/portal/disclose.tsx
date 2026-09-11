import { Link } from '@/components/portal/link';
import clsx from 'clsx';
import type { Quote } from '@/lib/portal/evidence';
import type { FocusProof, ProofPopulation } from '@/lib/portal/focus';
import { formatDate } from '@/lib/format';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';

/**
 * PROGRESSIVE DISCLOSURE (M24).
 *
 * The workspace says a conclusion first and shows its evidence on request.
 * Everything here is built on the native `<details>` element, on purpose:
 * it opens without JavaScript, a screen reader hears a button that expands,
 * the browser remembers nothing between visits, and the content inside is
 * simply not on the page until the owner asks for it — which is what keeps a
 * screen from turning back into an article.
 *
 * Three pieces:
 *
 *   Reveal      a labelled disclosure — "Show evidence", "Why Headway says this".
 *   Quotes      customers in their own words, with the door each came
 *               through and a way to the full list. Never paraphrased.
 *   Population  the two piles behind a before/after, drawn one feedback
 *               entry at a time so the owner SEES 14 of 44 become 20 of
 *               43 rather than reading a percentage.
 *
 * Movement is brief and only ever reveals; nothing counts down, nothing
 * pulses for attention, and `prefers-reduced-motion` switches it all off.
 */

export function Chevron() {
  return (
    <span aria-hidden className="text-ink-400 transition-transform group-open:rotate-90">
      ›
    </span>
  );
}

const SUMMARY =
  'inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-ink-700 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none';

export function Reveal({
  summary,
  children,
  open,
  id,
  className,
  tone = 'quiet',
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  id?: string;
  className?: string;
  /** `strong` draws the summary as a bordered control, for the one reveal a block leads with. */
  tone?: 'quiet' | 'strong';
}) {
  return (
    <details id={id} open={open} className={clsx('group', className)}>
      <summary
        className={clsx(
          SUMMARY,
          tone === 'strong' &&
            'rounded-lg border border-ink-300 bg-white px-4 text-[14px] text-ink-900 hover:border-ink-900',
        )}
      >
        {summary} <Chevron />
      </summary>
      <div className="hw-reveal mt-2">{children}</div>
    </details>
  );
}

async function SmallStars({ value }: { value: number }) {
  const t = await getTranslator();
  return (
    <span className="text-warn-600" aria-label={t('common.stars.aria', { value })}>
      {'★'.repeat(value)}
      <span className="text-ink-300" aria-hidden>
        {'☆'.repeat(5 - value)}
      </span>
    </span>
  );
}

/**
 * Customers, in their own words.
 *
 * Quoted, dated, and marked with the door they came through — a feedback
 * entry from the card and a public review are different kinds of evidence
 * and the owner should see which is which. The full list is one link away.
 */
export async function Quotes({
  quotes,
  seeAll,
  empty,
}: {
  quotes: Quote[];
  seeAll?: { label: string; href: string } | null;
  /** What to say when nobody wrote anything: star ratings can carry a topic with no words. */
  empty?: string;
}) {
  const t = await getTranslator();
  if (quotes.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-500">{empty ?? t('common.quotes.empty')}</p>
    );
  }
  return (
    <div>
      <ul className="space-y-3">
        {quotes.map((q) => (
          <li key={q.id} className="border-l-2 border-ink-200 pl-3">
            <p className="text-[14px] leading-relaxed text-ink-900">“{q.text}”</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
              {q.stars !== null ? (
                <SmallStars value={q.stars} />
              ) : (
                <span className="italic">{t('common.review.noRating')}</span>
              )}
              <span>{formatDate(q.at)}</span>
              <span>· {q.sourceLabel}</span>
            </p>
          </li>
        ))}
      </ul>
      {seeAll ? (
        <Link
          href={seeAll.href}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
        >
          {seeAll.label} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

const TONE_FILL: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'bg-good-600',
  bad: 'bg-bad-600',
  neutral: 'bg-ink-400',
};

const TONE_TEXT: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'text-good-700',
  bad: 'text-bad-700',
  neutral: 'text-ink-600',
};

/** Above this many entries the dots stop being countable, and a bar says it better. */
const MAX_DOTS = 120;

function Dots({
  count,
  total,
  tone,
  startDelay,
}: {
  count: number;
  total: number;
  tone: 'good' | 'bad' | 'neutral';
  startDelay: number;
}) {
  if (total <= 0) return null;
  if (total > MAX_DOTS) {
    const pct = Math.max(2, Math.min(100, (count / total) * 100));
    return (
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <div className={clsx('hw-grow h-full rounded-full', TONE_FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={clsx('hw-dot h-2.5 w-2.5 rounded-[3px]', i < count ? TONE_FILL[tone] : 'bg-ink-200')}
          style={{ animationDelay: `${startDelay + Math.min(i, 60) * 10}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * The two piles behind a before/after. Each side is named with its own
 * boundary, so the two can never be read as one series, and the reading is
 * followed by the one sentence that says what the comparison cannot show.
 */
export async function Population({
  population: p,
  why = true,
}: {
  population: ProofPopulation;
  why?: boolean;
}) {
  const t = await getTranslator();
  // `label` holds the dictionary key rather than the word itself.
  const sides = [
    { key: 'before', label: 'common.population.before' as MessageKey, ...p.before, tone: 'neutral' as const, delay: 0 },
    { key: 'after', label: 'common.population.after' as MessageKey, ...p.after, tone: p.tone, delay: 220 },
  ];
  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8">
        {sides.map((side) => (
          <div key={side.key}>
            <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">
              {t(side.label)}
            </p>
            <p
              className={clsx(
                'mt-1 font-mono text-[30px] leading-none font-semibold tabular-nums sm:text-[36px]',
                side.key === 'after' ? TONE_TEXT[side.tone] : 'text-ink-900',
              )}
            >
              {side.share}
            </p>
            {/* One key, not three fragments: Hindi and Marathi put the total
                first ("44 में से 14"), so the count cannot be a separate span
                glued in front of the word "of". */}
            <p className="mt-1.5 text-[13px] font-medium text-ink-900 tabular-nums">
              {t('common.evidence.count', { count: side.count, total: side.total })}
            </p>
            <Dots count={side.count} total={side.total} tone={side.tone} startDelay={side.delay} />
            <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{side.scope}</p>
          </div>
        ))}
      </div>
      <p className={clsx('mt-4 text-[12px] font-semibold tracking-wide uppercase', TONE_TEXT[p.tone])}>{p.reading}</p>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-700">{p.caveat}</p>
      {why && p.why.length > 0 ? (
        <Reveal summary={t('common.reveal.why')} className="mt-1">
          <ul className="space-y-1 border-l-2 border-ink-200 pl-3 text-[13px] leading-relaxed text-ink-600">
            {p.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Reveal>
      ) : null}
    </div>
  );
}

const CHIP_TONE: Record<'good' | 'bad' | 'neutral', string> = {
  bad: 'border-bad-200 bg-bad-50 text-bad-700 hover:border-bad-600',
  good: 'border-good-200 bg-good-50 text-good-700 hover:border-good-600',
  neutral: 'border-ink-200 bg-ink-100 text-ink-700 hover:border-ink-500',
};

/**
 * A figure that opens into what it counts.
 *
 * "39% of feedback" is the chip; tapping it shows "34 of 87 feedback
 * entries mention it", three of those comments, and the way to all
 * thirty-four. The chip row keeps its shape while one is open: the open one
 * takes the full width and the others move under it.
 */
export function ProofChips({ proofs, open }: { proofs: FocusProof[]; open?: FocusProof['key'] | null }) {
  if (proofs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {proofs.map((proof) => (
        <details key={proof.key} open={open === proof.key} className="group open:basis-full">
          <summary
            className={clsx(
              'inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold transition-colors select-none focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none',
              CHIP_TONE[proof.tone],
            )}
          >
            {proof.label} <Chevron />
          </summary>
          <div className="hw-reveal mt-3 rounded-xl border border-ink-200 bg-ink-50 p-4 sm:p-5">
            <p className="text-[14px] leading-relaxed text-ink-900">{proof.detail}</p>
            {proof.comparison ? <p className="mt-1 text-[13px] text-ink-600 tabular-nums">{proof.comparison}</p> : null}
            {proof.key === 'share' ? (
              <div className="mt-3">
                <Quotes quotes={proof.quotes} seeAll={proof.seeAll} />
              </div>
            ) : null}
            {proof.population ? (
              <div className="mt-4">
                <Population population={proof.population} />
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

/** A labelled row inside an opened card: the label is the guarantee of what kind of statement follows. */
export function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-1 py-3 sm:grid-cols-[10rem_1fr]">
      <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">{label}</p>
      <div className={clsx('text-[14px] leading-relaxed', strong ? 'font-medium text-ink-900' : 'text-ink-700')}>
        {children}
      </div>
    </div>
  );
}
