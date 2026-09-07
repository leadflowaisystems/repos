import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getEvidenceIndex, getReviewsView } from '@/lib/portal/service';
import { quotesFor } from '@/lib/portal/evidence';
import type { ReviewFilters, ReviewsView } from '@/lib/portal/pages';
import {
  PageIntro,
  Quiet,
  RatingBars,
  RatingStrip,
  ReviewRow,
  SentimentBar,
  StatusStrip,
} from '@/components/portal/portal-ui';
import { Reveal } from '@/components/portal/disclose';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reviews' };

/**
 * REVIEWS — the evidence cabinet (M24, completed in the final experience pass).
 *
 * The raw material, made to feel like what it is: the thing every conclusion
 * rests on. The page opens with the transformation Headway made of the pile —
 * everything read, the signals that recur, the mentions that stand alone, the
 * one that needs attention — each step a count of the same rows and a tap to
 * the rows behind it. Then the signals as one-tap filters, so an owner can
 * ask "what did Headway actually base this on?" and see only those comments:
 * three representative ones first, chosen the way every quote on the
 * workspace is chosen, and the whole list one tap further. The full inbox,
 * the ratings, the tones and the search are all still here, under the
 * intelligence rather than above it.
 */

type Search = Record<string, string | string[] | undefined>;

const SENTIMENTS = ['POSITIVE', 'MIXED', 'NEUTRAL', 'NEGATIVE'] as const;
const SENTIMENT_LABEL: Record<(typeof SENTIMENTS)[number], string> = {
  POSITIVE: 'Positive',
  MIXED: 'Mixed',
  NEUTRAL: 'Neutral',
  NEGATIVE: 'Negative',
};

/** How many comments stand for a signal before the owner asks for all of them. */
const REPRESENTATIVE = 3;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function parseFilters(search: Search): ReviewFilters {
  const stars = Number.parseInt(one(search.stars), 10);
  const sentiment = one(search.sentiment);
  return {
    q: one(search.q).slice(0, 120),
    stars: stars >= 1 && stars <= 5 ? stars : null,
    sentiment: (SENTIMENTS as readonly string[]).includes(sentiment) ? sentiment : null,
    theme: one(search.theme) || null,
    source: one(search.source) || null,
    needs: one(search.needs) === 'reply' ? 'reply' : null,
  };
}

const control =
  'h-11 w-full rounded-md border border-ink-300 bg-white px-2.5 text-[14px] text-ink-900 focus-visible:border-ink-500 focus-visible:ring-2 focus-visible:ring-ink-300 focus-visible:outline-none';
const label = 'flex flex-col gap-1 text-[11px] tracking-wide text-ink-500 uppercase';
const EYEBROW = 'text-[11px] font-medium tracking-widest text-ink-500 uppercase';

/**
 * 87 pieces read → 7 recurring signals → 6 isolated mentions → 1 needs attention.
 *
 * Four figures and three arrows, each a count of the same rows. The last
 * step names the theme, because "1" is not a finding and "slow service" is.
 */
function Funnel({ funnel, base }: { funnel: ReviewsView['funnel']; base: string }) {
  const steps: Array<{ value: string; label: string; href: string | null; tone: string }> = [
    { value: String(funnel.read), label: funnel.read === 1 ? 'piece read' : 'pieces read', href: base, tone: 'text-ink-900' },
    {
      value: String(funnel.signals),
      label: funnel.signals === 1 ? 'recurring signal' : 'recurring signals',
      href: `${base}#signals`,
      tone: 'text-ink-900',
    },
    {
      value: String(funnel.isolated),
      label: funnel.isolated === 1 ? 'isolated mention' : 'isolated mentions',
      href: null,
      tone: 'text-ink-500',
    },
    funnel.attention
      ? {
          value: '1',
          label: `needs attention · ${funnel.attention.label.toLowerCase()}`,
          href: `${base}?theme=${encodeURIComponent(funnel.attention.key)}`,
          tone: 'text-bad-700',
        }
      : { value: '0', label: 'need attention', href: null, tone: 'text-good-700' },
  ];
  return (
    <ol className="mb-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-0" aria-label="How Headway read this feedback">
      {steps.map((step, index) => {
        const body = (
          <>
            <span className={clsx('font-mono text-[26px] leading-none font-semibold tabular-nums sm:text-[34px]', step.tone)}>
              {step.value}
            </span>
            <span className="mt-1 block text-[13px] leading-snug text-ink-600">{step.label}</span>
          </>
        );
        return (
          <li key={step.label} className="flex items-stretch gap-2 sm:gap-0">
            {index > 0 ? (
              <span aria-hidden className="grid w-5 place-items-center text-[18px] text-ink-300 sm:w-10 sm:text-[22px]">
                <span className="sm:hidden">↓</span>
                <span className="hidden sm:inline">→</span>
              </span>
            ) : null}
            {step.href ? (
              <Link
                href={step.href}
                className="block min-h-11 flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 transition-colors hover:border-ink-400 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none sm:min-w-[9.5rem] sm:py-3"
              >
                {body}
              </Link>
            ) : (
              <span className="block flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 sm:min-w-[9.5rem] sm:py-3">
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Every recurring signal, as a one-tap filter, biggest first. */
function SignalChips({ signals, base }: { signals: ReviewsView['signals']; base: string }) {
  if (signals.length === 0) return null;
  return (
    <ul id="signals" className="flex scroll-mt-24 flex-wrap gap-2">
      {signals.map((s) => (
        <li key={s.key}>
          <Link
            href={s.active ? base : `${base}?theme=${encodeURIComponent(s.key)}`}
            aria-current={s.active ? 'page' : undefined}
            className={clsx(
              'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none',
              s.active
                ? 'border-ink-900 bg-ink-900 text-white'
                : s.kind === 'ISSUE'
                  ? 'border-bad-200 bg-bad-50 text-bad-700 hover:border-bad-600'
                  : 'border-good-200 bg-good-50 text-good-700 hover:border-good-600',
            )}
          >
            {s.label}
            <span className={clsx('rounded-full px-1.5 text-[12px] tabular-nums', s.active ? 'bg-white/20' : 'bg-white/80')}>
              {s.count}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function PortalReviews({
  clientId,
  basePath,
  searchParams,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  searchParams: Promise<Search>;
}) {
  const client = { id: clientId };
  const search = await searchParams;

  const filters = parseFilters(search);
  const page = Math.max(Number.parseInt(one(search.page), 10) || 1, 1);
  const all = one(search.all) === '1';
  const [view, evidence] = await Promise.all([
    getReviewsView(prisma, client.id, filters, { page }),
    getEvidenceIndex(prisma, client.id),
  ]);
  if (!view) notFound();

  const base = `${basePath}/reviews`;
  const filtered = view.filterSummary !== null;
  const issues = view.themeOptions.filter((t) => t.kind === 'ISSUE');
  const praise = view.themeOptions.filter((t) => t.kind === 'PRAISE');
  const inHand = view.waiting + view.processing;
  const activeSignal = view.signals.find((s) => s.active) ?? null;
  const searching = filters.q.trim().length > 0 || filters.sentiment !== null || filters.source !== null || filters.needs !== null;

  // One signal, nothing else narrowed, first page: the representative comments
  // lead — the same three the workspace quotes under the figure — and the
  // whole pile is one tap away. Any other narrowing shows the plain list.
  const representative =
    activeSignal !== null && !searching && filters.stars === null && page === 1 && !all;
  let items = view.items;
  if (representative && activeSignal) {
    const chosen = quotesFor(evidence, activeSignal.key, { limit: REPRESENTATIVE }).map((q) => q.id);
    const lead = chosen
      .map((id) => view.items.find((item) => item.id === id))
      .filter((item): item is ReviewsView['items'][number] => item !== undefined);
    for (const item of view.items) {
      if (lead.length >= REPRESENTATIVE) break;
      if (!lead.some((l) => l.id === item.id)) lead.push(item);
    }
    items = lead;
  }
  const showAllHref = activeSignal ? `${base}?theme=${encodeURIComponent(activeSignal.key)}&all=1` : base;

  return (
    <>
      <PageIntro
        eyebrow="Reviews"
        title="What your customers actually wrote"
        description={
          view.total === 0
            ? 'Your first customer signals will appear here. Headway is ready.'
            : view.analysed === 0 && inHand > 0
              ? 'Feedback has arrived and Headway is reading it now — usually done within a minute. Reload to see what it found.'
              : 'Every piece, as the customer gave it, and what Headway based its reading on.'
        }
      />

      {view.analysed > 0 ? <Funnel funnel={view.funnel} base={base} /> : null}

      {view.total > 0 ? (
        <StatusStrip
          items={[
            { label: 'collected', value: view.total },
            { label: 'read by Headway', value: view.analysed },
            ...(inHand > 0 ? [{ label: 'being read now', value: inHand, tone: 'warn' as const }] : []),
            ...(view.failed > 0
              ? [{ label: view.failed === 1 ? 'could not be read yet' : 'could not be read yet', value: view.failed, tone: 'bad' as const }]
              : []),
            ...(view.averageRating !== null
              ? [{ label: `average of ${view.withRating} ratings`, value: `${view.averageRating.toFixed(1)}★` }]
              : []),
          ]}
        />
      ) : null}

      {view.signals.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[11px] font-medium tracking-widest text-ink-500 uppercase">
            The signals · tap one to see only its evidence
          </h2>
          <SignalChips signals={view.signals} base={base} />
        </section>
      ) : null}

      {view.total > 0 ? (
        <RatingStrip base={base} ratings={view.ratings} active={view.filters.stars} />
      ) : null}

      {view.found.length > 0 ? (
        <div className="mb-6">
          <Reveal summary="What Headway found in them">
            <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
              <ul className="space-y-1.5">
                {view.found.map((f) => (
                  <li key={f} className="text-[14px] leading-relaxed text-ink-900">
                    {f}
                  </li>
                ))}
              </ul>
              {view.quick.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {view.quick.map((q) => (
                    <li key={q.query}>
                      <Link
                        href={`${base}?${q.query}`}
                        className="inline-flex min-h-11 items-center rounded-full border border-ink-300 px-3 text-[13px] text-ink-800 hover:border-ink-900 hover:text-ink-900"
                      >
                        {q.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {view.analysed > 0 ? (
                <section className="mt-5 grid grid-cols-1 gap-x-10 gap-y-6 border-t border-ink-200 pt-5 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-[11px] font-medium tracking-widest text-ink-500 uppercase">
                      By rating · {view.withRating} with a star rating
                    </h3>
                    <RatingBars ratings={view.ratings} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[11px] font-medium tracking-widest text-ink-500 uppercase">
                      By tone · all {view.analysed} read
                    </h3>
                    <SentimentBar sentiments={view.sentiments} />
                  </div>
                </section>
              ) : null}
            </div>
          </Reveal>
        </div>
      ) : null}

      {view.total > 0 ? (
        <div className="mb-6">
          <Reveal summary="Search and filter" open={searching}>
            <form method="get" action={base} className="border-y border-ink-200 py-4">
              {/* One grid that reads the same on every width: search full width,
                  then the pickers two to a row on a phone and in one row from
                  tablet up. Nothing here scrolls sideways. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                <label className={`${label} col-span-2 sm:col-span-4 lg:col-span-1`}>
                  Search
                  <input type="search" name="q" defaultValue={view.filters.q} placeholder="A word customers used" className={control} />
                </label>
                <label className={label}>
                  About
                  <select name="theme" defaultValue={view.filters.theme ?? ''} className={control}>
                    <option value="">Anything</option>
                    {issues.length > 0 ? (
                      <optgroup label="Complaints">
                        {issues.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </optgroup>
                    ) : null}
                    {praise.length > 0 ? (
                      <optgroup label="Praise">
                        {praise.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>
                <label className={label}>
                  Rating
                  <select name="stars" defaultValue={view.filters.stars ? String(view.filters.stars) : ''} className={control}>
                    <option value="">Any</option>
                    {[5, 4, 3, 2, 1].map((s) => (
                      <option key={s} value={s}>{s} star{s === 1 ? '' : 's'}</option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Tone
                  <select name="sentiment" defaultValue={view.filters.sentiment ?? ''} className={control}>
                    <option value="">Any</option>
                    {SENTIMENTS.map((s) => (
                      <option key={s} value={s}>{SENTIMENT_LABEL[s]}</option>
                    ))}
                  </select>
                </label>
                {view.sourceOptions.length > 1 ? (
                  <label className={label}>
                    From
                    <select name="source" defaultValue={view.filters.source ?? ''} className={control}>
                      <option value="">Anywhere</option>
                      {view.sourceOptions.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink-700">
                  <input type="checkbox" name="needs" value="reply" defaultChecked={view.filters.needs === 'reply'} className="h-4 w-4 rounded border-ink-300 accent-ink-900" />
                  Only ones that need your answer
                </label>
                <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-ink-900 px-3.5 text-[13px] font-medium text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:outline-none">
                  Show
                </button>
                {filtered ? (
                  <Link href={base} className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[13px] text-ink-500 hover:text-ink-900">Clear</Link>
                ) : null}
              </div>
            </form>
          </Reveal>
        </div>
      ) : null}

      {view.total === 0 ? (
        <Quiet>
          Each piece of feedback appears here as the customer gave it, with what Headway made of
          it alongside.
        </Quiet>
      ) : (
        <>
          {activeSignal ? (
            <div className="mb-1 border-l-2 border-ink-900 pl-4">
              <p className={EYEBROW}>What Headway based this on</p>
              <p className="mt-1 text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                Evidence for {activeSignal.label.toLowerCase()}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-600">
                {view.matching} {view.matching === 1 ? 'comment' : 'comments'} — this is what Headway based it on.
                {representative && view.matching > items.length
                  ? ` ${items.length === 1 ? 'The one that says it most plainly' : `${items.length} that say it most plainly`} first.`
                  : ''}{' '}
                <Link href={base} className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900">
                  Clear filter
                </Link>
              </p>
            </div>
          ) : (
            <p className="text-[14px] font-medium text-ink-900">
              {view.shown} {view.shown === 1 ? 'comment' : 'comments'}
              {filtered ? <span className="font-normal text-ink-600"> {view.filterSummary}</span> : null}
            </p>
          )}
          {items.length > 0 ? (
            <ul className="mt-2 divide-y divide-ink-200 border-t border-ink-200">
              {items.map((item) => (
                <ReviewRow key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <Quiet>
                Nothing matches.{' '}
                <Link href={base} className="text-ink-900 underline underline-offset-2">Clear the filters</Link>{' '}
                to see everything.
              </Quiet>
            </div>
          )}
          {representative && view.matching > items.length ? (
            <div className="mt-6 border-t border-ink-200 pt-5">
              <p className="text-[13px] text-ink-600">
                Showing {items.length} of {view.matching} comments about this.
              </p>
              <Link
                href={showAllHref}
                className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg border border-ink-300 px-4 text-[13px] font-medium text-ink-900 hover:border-ink-900"
              >
                Show all {view.matching} <span aria-hidden>→</span>
              </Link>
            </div>
          ) : view.hasMore ? (
            <div className="mt-6 border-t border-ink-200 pt-5">
              <p className="text-[13px] text-ink-600">
                Showing {view.shown} of {view.matching} comments.
              </p>
              <Link
                href={`${base}?${new URLSearchParams({
                  ...Object.fromEntries(
                    Object.entries(search).flatMap(([k, v]) =>
                      k === 'page' ? [] : [[k, one(v)]],
                    ),
                  ),
                  page: String(view.nextPage),
                }).toString()}`}
                className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-ink-300 px-4 text-[13px] font-medium text-ink-900 hover:border-ink-900"
              >
                Show more
              </Link>
            </div>
          ) : view.matching > 0 ? (
            <p className="mt-4 text-[12px] text-ink-500">
              {view.matching === 1
                ? 'That is the only comment matching this.'
                : `All ${view.matching} comments matching this.`}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
