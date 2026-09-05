import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getReviewsView } from '@/lib/portal/service';
import type { ReviewFilters } from '@/lib/portal/pages';
import {
  PageIntro,
  Quiet,
  RatingBars,
  RatingStrip,
  ReviewRow,
  Section,
  SentimentBar,
} from '@/components/portal/portal-ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reviews' };

/**
 * REVIEWS — what is the evidence? (M12)
 *
 * The customer words behind every conclusion, with the reading attached to
 * each one. What RepOS found sits above the list, so reading it is optional;
 * the filters are plain links and a plain form, so a conclusion anywhere in
 * the workspace is one tap from the comments it came from.
 */

type Search = Record<string, string | string[] | undefined>;

const SENTIMENTS = ['POSITIVE', 'MIXED', 'NEUTRAL', 'NEGATIVE'] as const;
const SENTIMENT_LABEL: Record<(typeof SENTIMENTS)[number], string> = {
  POSITIVE: 'Positive',
  MIXED: 'Mixed',
  NEUTRAL: 'Neutral',
  NEGATIVE: 'Negative',
};

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
  'h-9 rounded-md border border-ink-300 bg-white px-2.5 text-[13px] text-ink-900 focus-visible:border-ink-500 focus-visible:ring-2 focus-visible:ring-ink-300 focus-visible:outline-none';

/**
 * The reviews page, as one implementation behind two doors (M20).
 *
 * Reached either through the owner's secret link (/portal/[token]) or through
 * an authenticated workspace (/workspace/[clientId]). Both resolve to a client
 * id first and neither is trusted here: whoever renders this has already
 * decided the caller may see this business.
 */
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
  const view = await getReviewsView(prisma, client.id, filters, { page });
  if (!view) notFound();

  const base = `${basePath}/reviews`;
  const filtered = view.filterSummary !== null;
  const issues = view.themeOptions.filter((t) => t.kind === 'ISSUE');
  const praise = view.themeOptions.filter((t) => t.kind === 'PRAISE');

  return (
    <>
      <PageIntro
        eyebrow="Reviews"
        title="What your customers actually wrote"
        description={
          view.total === 0
            ? 'Your first customer signals will appear here. RepOS is ready.'
            : `${view.total} pieces of feedback collected · ${view.analysed} read${
                view.averageRating !== null
                  ? ` · ${view.averageRating.toFixed(1)}★ average of the ratings attached to them`
                  : ''
              }`
        }
      />

      {view.total > 0 ? (
        <RatingStrip base={base} ratings={view.ratings} active={view.filters.stars} />
      ) : null}

      {view.found.length > 0 ? (
        <Section eyebrow="What RepOS found in them">
          <ul className="space-y-1.5">
            {view.found.map((f) => (
              <li key={f} className="text-[15px] leading-relaxed text-ink-900">
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
                    className="inline-block rounded-full border border-ink-300 px-3 py-1 text-[13px] text-ink-800 hover:border-ink-900 hover:text-ink-900"
                  >
                    {q.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {view.total > 0 ? (
        <section className="mb-8 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 text-[11px] font-medium tracking-widest text-ink-500 uppercase">
              By rating · {view.withRating} with a star rating
            </h2>
            <RatingBars ratings={view.ratings} />
          </div>
          <div>
            <h2 className="mb-3 text-[11px] font-medium tracking-widest text-ink-500 uppercase">
              By tone · all {view.analysed} read
            </h2>
            <SentimentBar sentiments={view.sentiments} />
          </div>
        </section>
      ) : null}

      {view.total > 0 ? (
        <form method="get" action={base} className="mb-6 border-y border-ink-200 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[11px] tracking-wide text-ink-500 uppercase">
              Search
              <input type="search" name="q" defaultValue={view.filters.q} placeholder="A word customers used" className={control} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] tracking-wide text-ink-500 uppercase">
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
            <label className="flex flex-col gap-1 text-[11px] tracking-wide text-ink-500 uppercase">
              Rating
              <select name="stars" defaultValue={view.filters.stars ? String(view.filters.stars) : ''} className={control}>
                <option value="">Any</option>
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>{s} star{s === 1 ? '' : 's'}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] tracking-wide text-ink-500 uppercase">
              Tone
              <select name="sentiment" defaultValue={view.filters.sentiment ?? ''} className={control}>
                <option value="">Any</option>
                {SENTIMENTS.map((s) => (
                  <option key={s} value={s}>{SENTIMENT_LABEL[s]}</option>
                ))}
              </select>
            </label>
            {view.sourceOptions.length > 1 ? (
              <label className="flex flex-col gap-1 text-[11px] tracking-wide text-ink-500 uppercase">
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
            <label className="flex items-center gap-2 text-[13px] text-ink-700">
              <input type="checkbox" name="needs" value="reply" defaultChecked={view.filters.needs === 'reply'} className="h-4 w-4 rounded border-ink-300 accent-ink-900" />
              Only ones that need your answer
            </label>
            <button type="submit" className="h-8 rounded-md bg-ink-900 px-3.5 text-[13px] font-medium text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:outline-none">
              Show
            </button>
            {filtered ? (
              <Link href={base} className="text-[13px] text-ink-500 hover:text-ink-900">Clear</Link>
            ) : null}
          </div>
        </form>
      ) : null}

      {view.total === 0 ? (
        <Quiet>
          Once customers start scanning your QR code, each piece of feedback appears here exactly
          as they gave it — the rating, what they tapped, and their words — with what RepOS made
          of it alongside.
        </Quiet>
      ) : (
        <>
          <p className="text-[14px] font-medium text-ink-900">
            {view.shown} {view.shown === 1 ? 'comment' : 'comments'}
            {filtered ? <span className="font-normal text-ink-600"> {view.filterSummary}</span> : null}
          </p>
          {view.items.length > 0 ? (
            <ul className="mt-2 divide-y divide-ink-200 border-t border-ink-200">
              {view.items.map((item) => (
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
          {view.hasMore ? (
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
                className="mt-2 inline-block rounded-lg border border-ink-300 px-4 py-2 text-[13px] font-medium text-ink-900 hover:border-ink-900"
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
