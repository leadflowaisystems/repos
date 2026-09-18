import { Link } from '@/components/portal/link';
import clsx from 'clsx';
import type { Brief, BriefCard, BriefChange, BriefMemory, BriefTrend } from '@/lib/portal/brief';
import { getTranslator } from '@/lib/i18n/request';
import { Quotes } from '@/components/portal/disclose';
import { HeadwayMark } from '@/components/brand';
import { OwnerDecision } from '@/components/workspace/owner-decision';
import { Greeting } from '@/components/workspace/greeting';
import { LiveRefresh } from '@/components/workspace/live-refresh';
import { movesFor } from '@/lib/improve/owner-moves';
import { whenSaid, type FreshFeed, type LatestEntry, type LiveState } from '@/lib/portal/fresh';
import { formatDate } from '@/lib/format';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * YOUR HEADWAY BRIEF — the screen an owner opens (final experience pass).
 *
 * The previous Home was correct and flat: four blocks of the same weight on
 * the same grey, the business named nowhere on it, and nothing to say that
 * Headway had been doing anything since the owner last looked. This is the
 * same information, composed like a briefing prepared for one business:
 *
 *   THE BAND      navy, edge to edge on a phone. Good morning, the business's
 *                 own name, what Headway is doing for it, and how customers
 *                 feel — the one place on Home where the brand speaks.
 *   THE STORY     the one thing that matters: its name, its count, which way it
 *                 moved, one customer in their own words, what it means, what
 *                 Headway suggests, and the decision. The largest thing on the
 *                 page after the band.
 *   OR, CALM      when nothing needs the owner, Home says so plainly instead of
 *                 manufacturing a problem to fill the space.
 *   THE LATEST    the newest customers in their own words, read or not yet
 *                 read, each a tap from the whole entry (freshness pass).
 *   THE REST      what customers love, what changed, and the owner's own record
 *                 of changes — set as type on the canvas, not as more cards.
 *
 * EVERY FIGURE IS STILL A COUNT OF STORED ROWS and every one opens into them.
 * Nothing on this screen is computed here; `buildBrief` carried it all across
 * from the engines that decide what feedback means.
 *
 * NO CHARTS, NO SCORES. Three labelled numbers say how customers feel more
 * plainly than any chart that would fit on a phone, and a score would be a
 * number Headway invented.
 */

const EYEBROW = 'text-[11px] font-semibold tracking-[0.14em] uppercase';

const TREND_TONE: Record<BriefTrend['tone'], string> = {
  good: 'text-good-700',
  bad: 'text-bad-700',
  neutral: 'text-ink-500',
};

/** The arrow, and the real counts behind it when the engine could read both. */
async function Trend({ trend }: { trend: BriefTrend }) {
  return (
    <span className={clsx('inline-flex items-baseline gap-1.5 text-[13px] font-medium', TREND_TONE[trend.tone])}>
      <span aria-hidden className="text-[15px] leading-none">
        {trend.mark}
      </span>
      <span>{trend.counts ?? trend.label}</span>
      {trend.counts ? <span className="font-normal text-ink-500">· {trend.label}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

/**
 * THE LIVE LINE — the newest feedback, and where Headway is with it.
 *
 * A live region, and always in the document even when it is empty, so a
 * screen reader hears "Headway just read 3 new feedback entries" at the
 * moment the page refreshes into it. The pulse on the dot is the only motion,
 * it runs only while rows are genuinely being read, and it is off for anyone
 * who has asked for reduced motion.
 */
function LiveLine({
  live,
  arrivedSinceVisit,
  t,
}: {
  live: LiveState;
  arrivedSinceVisit: number | null;
  t: PortalTranslator;
}) {
  return (
    <p aria-live="polite" className="flex min-h-[1.25rem] items-center gap-2">
      {live?.kind === 'READING' ? (
        <>
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 motion-safe:animate-pulse" />
          <span className="text-white">{t.plural('brief.live.reading', live.count)}</span>
        </>
      ) : live?.kind === 'HELD' ? (
        <>
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
          {t.plural('brief.live.held', live.count)}
        </>
      ) : live?.kind === 'JUST_READ' ? (
        <>
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-good-200" />
          <span className="text-white">{t.plural('brief.live.justRead', live.count)}</span>
        </>
      ) : arrivedSinceVisit ? (
        <span className="pl-3.5">{t.plural('brief.status.arrived', arrivedSinceVisit)}</span>
      ) : null}
    </p>
  );
}

/**
 * THE BAND — whose brief this is, and what Headway has been doing.
 *
 * Navy continues straight down from the app bar on a phone, so the top of Home
 * reads as one branded surface rather than a header with a page under it.
 * From tablet up it becomes a panel in the column, because a full-width navy
 * slab on a laptop is a banner, not a brief.
 *
 * The status line is the proactive part: the number of topics Headway is
 * following for this business, and what arrived since the owner last looked.
 * Both are counts the product already keeps. When Headway checked a change
 * while the owner was away, that is said here first, because it is the moment
 * the whole product exists to produce.
 */
async function Band({ brief, live }: { brief: Brief; live: LiveState }) {
  const t = await getTranslator();
  const { header, mix } = brief;
  const tiles = [
    {
      key: 'happy',
      label: t('brief.today.happy'),
      value: mix.happy,
      dot: 'bg-good-600',
    },
    {
      key: 'mixed',
      label: t('brief.today.mixed'),
      value: mix.mixed,
      dot: 'bg-brand-400',
    },
    {
      key: 'unhappy',
      label: t('brief.today.unhappy'),
      value: mix.unhappy,
      dot: 'bg-bad-600',
    },
  ];
  return (
    <section
      aria-labelledby="brief-hello"
      className="on-navy -mx-4 -mt-5 bg-ink-900 px-4 pt-4 pb-6 text-white sm:mx-0 sm:mt-0 sm:rounded-2xl sm:px-7 sm:pt-7 sm:pb-7"
    >
      <Greeting />
      <h1
        id="brief-hello"
        className="mt-1.5 font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.01em] text-balance text-white sm:text-[36px]"
      >
        {header.businessName}
      </h1>

      {/* What Headway is doing for this business, in counts it already keeps.
          Two facts on two lines: run together they wrapped mid-phrase on a
          phone and left a separator hanging at the end of the first line. */}
      <div className="mt-2.5 space-y-0.5 text-[13px] leading-snug text-ink-300">
        <p className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
          {header.watching > 0 ? t.plural('brief.status.watching', header.watching) : t('brief.status.patterns')}
        </p>
        <LiveLine live={live} arrivedSinceVisit={header.arrivedSinceVisit} t={t} />
      </div>

      {/* The reward, arriving: a change Headway checked while they were away. */}
      {header.checkedWhileAway.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {header.checkedWhileAway.slice(0, 2).map((c) => (
            <li key={c.id} className="rounded-lg bg-white/[0.07] px-3 py-2.5 text-[14px] leading-snug text-white">
              <span className="font-semibold">{c.title}</span>{' '}
              <span
                className={c.better === true ? 'text-good-200' : c.better === false ? 'text-bad-200' : 'text-ink-300'}
              >
                {c.better === true
                  ? t('brief.away.better')
                  : c.better === false
                    ? t('brief.away.worse')
                    : t('brief.away.checked')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* How customers feel. Three labelled figures; the dot is decoration and
          the word carries the meaning, so colour is never the only signal. */}
      <p className={clsx(EYEBROW, 'mt-6 text-ink-300')}>{t('brief.mood.title')}</p>
      <dl className="mt-2.5 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-xl bg-white/[0.07] px-3 py-3">
            <dd className="font-mono text-[28px] leading-none font-semibold text-white tabular-nums">{tile.value}</dd>
            <dt className="mt-1.5 flex items-center gap-1.5 text-[12px] leading-tight text-ink-200">
              <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', tile.dot)} />
              {tile.label}
            </dt>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[12px] text-ink-300">
        {t.plural('brief.mood.basis', mix.read)}
        {brief.waiting > 0 ? ` · ${t.plural('brief.today.waiting', brief.waiting)}` : ''}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The story
// ---------------------------------------------------------------------------

/**
 * THE STORY — pattern, size, direction, a customer, meaning, suggestion, act.
 *
 * One customer is quoted in the open, under the count, because a number with
 * a person behind it is believed and a number on its own is studied. The rest
 * of what customers said stays one tap away.
 *
 * The decision closes it. The state of the loop — "You said you would handle
 * this", "You decided not to do this" — sits directly above the buttons it
 * explains, so "Revisit this" is never a button without a reason.
 */
async function Story({ card, clientId, basePath }: { card: BriefCard; clientId?: string; basePath: string }) {
  const t = await getTranslator();
  const [lead, ...rest] = card.quotes;
  const choices = movesFor(card.loop.status);
  return (
    <section
      aria-labelledby={`story-${card.themeKey}`}
      className="rounded-2xl border border-ink-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,42,67,0.04)] sm:p-6"
    >
      <p className={clsx(EYEBROW, 'flex items-center gap-2 text-bad-700')}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-bad-600" />
        {t('brief.attention.title')}
      </p>

      <h2
        id={`story-${card.themeKey}`}
        className="mt-2 font-display text-[26px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance text-ink-900"
      >
        {card.label}
      </h2>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={card.href}
          // 44px tall, not the 32px the figure alone occupies: the count is a
          // link into the rows it counts, and a small link is a missed tap.
          // `-my-1.5` gives the height back to the layout.
          className="-my-1.5 inline-flex min-h-11 items-baseline gap-1.5 rounded"
        >
          <span className="font-mono text-[34px] leading-none font-semibold text-ink-900 tabular-nums">
            {card.count}
          </span>
          <span className="text-[13px] text-ink-500 underline decoration-ink-300 underline-offset-4">{card.basis}</span>
        </Link>
        {card.trend ? <Trend trend={card.trend} /> : null}
      </div>

      <p className="mt-3 max-w-2xl text-[15px] leading-snug text-ink-800">{card.line}</p>

      {/* One customer, in their own words, before anything Headway concludes. */}
      {lead ? (
        <blockquote className="mt-4 border-l-2 border-brand-500 pl-3 text-[15px] leading-snug text-ink-900">
          “{lead.text}”
        </blockquote>
      ) : null}

      {card.meaning ? (
        <div className="mt-4">
          <p className={clsx(EYEBROW, 'text-ink-500')}>{t('brief.meaning.title')}</p>
          <p className="mt-1 max-w-2xl text-[15px] leading-snug text-ink-800">{card.meaning}</p>
        </div>
      ) : null}

      {card.action ? (
        <div className="mt-5 border-t border-ink-200 pt-4">
          <p className={clsx(EYEBROW, 'text-ink-500')}>{t('brief.suggest.title')}</p>
          <p className="mt-1.5 max-w-2xl text-[17px] leading-snug font-semibold text-ink-900">{card.action}</p>
        </div>
      ) : null}

      {card.loop.line ? (
        <p className="mt-4 border-l-2 border-ink-300 pl-3 text-[13px] leading-snug text-ink-600">{card.loop.line}</p>
      ) : null}

      {clientId && choices.length > 0 ? (
        <OwnerDecision
          clientId={clientId}
          themeKey={card.themeKey}
          actionId={card.loop.actionId}
          choices={choices}
          lead
        />
      ) : null}

      {/* The rest of the evidence: present on the page, one tap from the
          screen. The way to the whole list lives inside it, quietly. */}
      {rest.length > 0 ? (
        <details className="group mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-ink-700 hover:text-ink-900">
            {t('brief.evidence.title')}
            <span aria-hidden className="text-ink-400 transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <div className="hw-reveal mt-3">
            <Quotes
              quotes={rest}
              seeAll={{
                label: t.plural('brief.evidence.all', card.count),
                href: card.href,
              }}
              hrefFor={(id) => `${basePath}/reviews/${id}?from=home`}
            />
          </div>
        </details>
      ) : (
        <Link
          href={card.href}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-700 hover:text-ink-900"
        >
          {t.plural('brief.evidence.all', card.count)} <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}

/**
 * NOTHING NEEDS YOUR ATTENTION — said plainly, and meant.
 *
 * The product that tells an owner something needs them every day is the one
 * they stop believing. When no problem is strong enough to act on, Home says
 * so, says what Headway is still watching, and stops. Nothing is invented to
 * fill the space the story would have taken.
 */
async function Calm({ brief }: { brief: Brief }) {
  const t = await getTranslator();
  return (
    <section aria-labelledby="brief-calm" className="rounded-2xl border border-good-200 bg-white p-5 sm:p-6">
      <p className={clsx(EYEBROW, 'flex items-center gap-2 text-good-700')}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good-600" />
        {t('brief.calm.eyebrow')}
      </p>
      <h2 id="brief-calm" className="mt-2 font-display text-[24px] leading-[1.15] font-semibold text-ink-900">
        {t('brief.calm.title')}
      </h2>
      <p className="mt-2 text-[15px] leading-snug text-ink-700">
        {brief.waiting > 0 ? t('brief.calm.reading') : t('brief.calm.body')}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// What follows the story
// ---------------------------------------------------------------------------

/**
 * LATEST FROM CUSTOMERS — the newest few, in their own words (freshness pass).
 *
 * The brief is Headway's reading; this is what it is reading. Three rows, the
 * newest first, including what has not been read yet — that is exactly the
 * feedback no summary can show, and an owner who just watched a customer fill
 * in the card should find it here. Each row opens the whole entry. The count
 * under it is everything the business holds, one tap away. Not a feed: three,
 * and the way to the rest.
 */
async function Latest({ fresh, basePath, now }: { fresh: FreshFeed; basePath: string; now: Date }) {
  const t = await getTranslator();
  if (fresh.latest.length === 0) return null;
  const held = fresh.live?.kind === 'HELD';
  return (
    <section aria-labelledby="brief-latest">
      <h2 id="brief-latest" className={clsx(EYEBROW, 'text-ink-500')}>
        {t('brief.latest.title')}
      </h2>
      <ul className="mt-2 divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white">
        {fresh.latest.map((entry) => (
          <li key={entry.id}>
            <LatestRow entry={entry} href={`${basePath}/reviews/${entry.id}?from=home`} now={now} t={t} held={held} />
          </li>
        ))}
      </ul>
      <Link
        href={`${basePath}/reviews#entries`}
        className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-700 hover:text-ink-900"
      >
        {t.plural('brief.latest.all', fresh.total)} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

function LatestRow({
  entry,
  href,
  now,
  t,
  held,
}: {
  entry: LatestEntry;
  href: string;
  now: Date;
  t: PortalTranslator;
  held: boolean;
}) {
  return (
    <Link
      href={href}
      className="hw-focus-inset flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50"
    >
      <span className="min-w-0 flex-1">
        {entry.text ? (
          <span className="line-clamp-2 block text-[15px] leading-snug text-ink-900">“{entry.text}”</span>
        ) : (
          <span className="block text-[14px] leading-snug text-ink-500 italic">{t('brief.latest.noWords')}</span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-500">
          {entry.stars !== null ? (
            <span className="text-warn-600">
              <span className="sr-only">{t('common.stars.aria', { value: entry.stars })}</span>
              <span aria-hidden>
                {'★'.repeat(entry.stars)}
                <span className="text-ink-300">{'☆'.repeat(Math.max(0, 5 - entry.stars))}</span>
              </span>
            </span>
          ) : null}
          <span className="tabular-nums">{whenSaid(entry, now, t, formatDate)}</span>
          {entry.state === 'NEW' ? (
            <span className="inline-flex items-center gap-1 font-medium text-brand-700">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-pulse" />
              {held ? t('brief.latest.held') : t('brief.latest.new')}
            </span>
          ) : entry.state === 'FAILED' ? (
            <span className="text-ink-600">{t('brief.latest.failed')}</span>
          ) : entry.topics.length > 0 ? (
            <span className="text-ink-600">· {entry.topics.map((topic) => topic.label).join(', ')}</span>
          ) : null}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-[18px] leading-none text-ink-300">
        ›
      </span>
    </Link>
  );
}

/** CUSTOMERS LOVE — one row, the width of the phone, not another card. */
async function Loved({ card }: { card: BriefCard }) {
  const t = await getTranslator();
  return (
    <section aria-labelledby="brief-love">
      <h2 id="brief-love" className={clsx(EYEBROW, 'text-good-700')}>
        {t('brief.love.title')}
      </h2>
      <Link
        href={card.href}
        className="mt-2 flex min-h-14 items-center gap-3 border-y border-ink-200 py-3 hover:bg-white/60"
      >
        <span aria-hidden className="h-9 w-1 shrink-0 rounded-full bg-good-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] leading-snug font-semibold text-ink-900">{card.label}</span>
          {card.action ? (
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-600">{card.action}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-[22px] leading-none font-semibold text-good-700 tabular-nums">
            {card.count}
          </span>
          {card.trend ? (
            <span className={clsx('mt-1 text-[12px]', TREND_TONE[card.trend.tone])}>
              <span aria-hidden>{card.trend.mark}</span> {card.trend.label}
            </span>
          ) : null}
        </span>
      </Link>
    </section>
  );
}

/** WHAT CHANGED — movement since the last check-in, as lines. */
async function Changed({ brief }: { brief: Brief }) {
  const t = await getTranslator();
  if (brief.changed.length === 0) return null;
  return (
    <section aria-labelledby="brief-changed">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="brief-changed" className={clsx(EYEBROW, 'text-ink-500')}>
          {t('brief.changed.title')}
        </h2>
        <p className="text-[12px] text-ink-500">{t.plural('brief.changed.count', brief.changedTotal)}</p>
      </div>
      <ul className="mt-2 space-y-2">
        {brief.changed.map((c) => (
          <li
            key={c.key}
            className={clsx(
              'border-l-2 pl-3 text-[14px] leading-snug text-ink-800',
              c.tone === 'bad' ? 'border-bad-600' : 'border-good-600',
            )}
          >
            {c.line}
          </li>
        ))}
      </ul>
    </section>
  );
}

const CHANGE_STATE: Record<
  BriefChange['state'],
  {
    key:
      | 'brief.memory.state.better'
      | 'brief.memory.state.worse'
      | 'brief.memory.state.noChange'
      | 'brief.memory.state.notEnough'
      | 'brief.memory.state.watching';
    tone: string;
  }
> = {
  BETTER: { key: 'brief.memory.state.better', tone: 'text-good-700' },
  WORSE: { key: 'brief.memory.state.worse', tone: 'text-bad-700' },
  NO_CHANGE: { key: 'brief.memory.state.noChange', tone: 'text-ink-600' },
  NOT_ENOUGH: { key: 'brief.memory.state.notEnough', tone: 'text-ink-600' },
  WATCHING: { key: 'brief.memory.state.watching', tone: 'text-brand-700' },
};

/**
 * YOUR CHANGES — the owner's own record.
 *
 * The answer to "what has Headway actually done for me?", built only from what
 * the improvement loop stored: what they changed, and what customers did after
 * it. The before and after are counts of feedback entries; the verdict is the
 * measurement engine's, which never claims the change caused it.
 */
async function Memory({ memory, basePath }: { memory: BriefMemory; basePath: string }) {
  const t = await getTranslator();
  const { last30 } = memory;
  // Each part is said only when it is not zero. Included by condition, not
  // filtered out afterwards: nothing on this screen computes over a list.
  const summary: string[] = [
    ...(last30.made > 0 ? [t.plural('brief.memory.made', last30.made)] : []),
    ...(last30.better > 0 ? [t.plural('brief.memory.better', last30.better)] : []),
    ...(last30.watching > 0 ? [t.plural('brief.memory.watching', last30.watching)] : []),
  ];
  return (
    <section aria-labelledby="brief-memory">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="brief-memory" className={clsx(EYEBROW, 'text-ink-500')}>
          {t('brief.memory.title')}
        </h2>
        <Link
          href={`${basePath}/improvements`}
          className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-700 hover:text-ink-900"
        >
          {t('brief.memory.all')} <span aria-hidden>→</span>
        </Link>
      </div>
      {summary.length > 0 ? (
        <p className="text-[13px] text-ink-600">
          <span className="font-medium text-ink-800">{t('brief.memory.last30')}</span> {summary.join(' · ')}
        </p>
      ) : null}
      {memory.biggest ? (
        <div className="mt-3 rounded-xl border border-good-200 bg-white px-4 py-3">
          <p className={clsx(EYEBROW, 'text-good-700')}>{t('brief.memory.biggest')}</p>
          <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[16px] font-semibold text-ink-900">{memory.biggest.about}</span>
            <span className="font-mono text-[18px] font-semibold tabular-nums">
              <span className="text-ink-500">{memory.biggest.before}</span>{' '}
              <span aria-hidden className="text-good-700">
                →
              </span>{' '}
              <span className="text-good-700">{memory.biggest.after}</span>
            </span>
          </p>
          <p className="mt-0.5 text-[13px] text-good-700">{t('brief.memory.state.better')}</p>
        </div>
      ) : null}
      {memory.recent.length > 0 ? (
        <ul className="mt-2 divide-y divide-ink-200 border-y border-ink-200">
          {memory.recent.map((c) => {
            const state = CHANGE_STATE[c.state];
            return (
              <li key={c.key} className="flex min-h-14 items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-[15px] leading-snug font-semibold text-ink-900">{c.about}</span>
                  <span className={clsx('mt-0.5 block text-[13px] font-medium', state.tone)}>{t(state.key)}</span>
                </span>
                {c.before && c.after ? (
                  <span className="shrink-0 font-mono text-[15px] font-semibold text-ink-900 tabular-nums">
                    <span className="text-ink-500">{c.before}</span>{' '}
                    <span aria-hidden className="text-ink-400">
                      →
                    </span>{' '}
                    {c.after}
                  </span>
                ) : c.awaiting ? (
                  <span className="shrink-0 text-right text-[12px] leading-tight text-ink-600 tabular-nums">
                    {t.plural('loop.waiting.need', c.awaiting.need, {
                      have: c.awaiting.have,
                      need: c.awaiting.need,
                    })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Not enough to brief on yet: the brand, one honest line, and — the moment the
 * first customer has written — what they wrote. In a first week the early
 * words ARE the news, so they are not hidden until there is a pattern.
 */
async function BriefEmpty({
  brief,
  fresh,
  basePath,
  now,
}: {
  brief: Brief;
  fresh: FreshFeed | null;
  basePath: string;
  now: Date;
}) {
  const t = await getTranslator();
  const some = (fresh?.total ?? 0) > 0;
  return (
    <>
      <section
        aria-labelledby="brief-hello"
        className="on-navy -mx-4 -mt-5 bg-ink-900 px-4 pt-4 pb-6 text-white sm:mx-0 sm:mt-0 sm:rounded-2xl sm:px-7 sm:pt-7 sm:pb-7"
      >
        <Greeting />
        <h1
          id="brief-hello"
          className="mt-1.5 font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.01em] text-white sm:text-[36px]"
        >
          {brief.header.businessName}
        </h1>
        <div className="mt-2.5 space-y-0.5 text-[13px] leading-snug text-ink-300">
          <p className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            {!some
              ? t('brief.status.ready')
              : brief.header.watching > 0
                ? t.plural('brief.status.watching', brief.header.watching)
                : t('brief.status.patterns')}
          </p>
          <LiveLine live={fresh?.live ?? null} arrivedSinceVisit={brief.header.arrivedSinceVisit} t={t} />
        </div>
      </section>
      <section className="mt-6 flex items-start gap-4 rounded-2xl border border-ink-200 bg-white p-5">
        <HeadwayMark className="mt-0.5 h-8 w-8 shrink-0" />
        <div>
          <h2 className="font-display text-[22px] leading-tight font-semibold text-ink-900">
            {some ? t('brief.early.someTitle') : t('brief.early.title')}
          </h2>
          <p className="mt-1.5 text-[15px] leading-snug text-ink-700">
            {some ? t('brief.early.someBody') : t('brief.early.body')}
          </p>
        </div>
      </section>
      {fresh ? (
        <div className="mt-8">
          <Latest fresh={fresh} basePath={basePath} now={now} />
        </div>
      ) : null}
    </>
  );
}

/** The whole brief, in reading order. */
export async function OwnerBrief({
  brief,
  clientId,
  basePath,
  fresh = null,
  stamp,
  now = new Date(),
}: {
  brief: Brief;
  clientId?: string;
  /** Where this door lives, so the record can link to the full action centre. */
  basePath: string;
  /** The newest feedback and where Headway is with it. See `portal/fresh.ts`. */
  fresh?: FreshFeed | null;
  /**
   * Identifies this server render, so a copy the browser restores later can
   * be told apart from a fresh one. See `LiveRefresh`.
   */
  stamp?: string;
  /** The moment this page was rendered: the clock "2 min ago" is measured on. */
  now?: Date;
}) {
  const watcher = stamp ? <LiveRefresh stamp={stamp} reading={fresh?.live?.kind === 'READING'} /> : null;
  if (brief.tooEarly) {
    return (
      <>
        {watcher}
        <BriefEmpty brief={brief} fresh={fresh} basePath={basePath} now={now} />
      </>
    );
  }
  return (
    <>
      {watcher}
      <Band brief={brief} live={fresh?.live ?? null} />
      <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-8">
          {brief.attention ? (
            <Story card={brief.attention} clientId={clientId} basePath={basePath} />
          ) : brief.calm ? (
            <Calm brief={brief} />
          ) : null}
          {fresh ? <Latest fresh={fresh} basePath={basePath} now={now} /> : null}
        </div>
        <div className="min-w-0 space-y-8">
          {brief.loved ? <Loved card={brief.loved} /> : null}
          <Changed brief={brief} />
          {brief.memory ? <Memory memory={brief.memory} basePath={basePath} /> : null}
        </div>
      </div>
    </>
  );
}
