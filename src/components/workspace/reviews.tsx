import { Link } from '@/components/portal/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getEvidenceIndex, getReviewsView } from '@/lib/portal/service';
import { quotesFor, type Quote } from '@/lib/portal/evidence';
import type { ReviewFilters, ReviewsView } from '@/lib/portal/pages';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';
import type { Translator } from '@/lib/i18n/t';
import {
  PageIntro,
  Quiet,
  RatingBars,
  RatingStrip,
  ReviewRow,
  SentimentBar,
  StatusStrip,
} from '@/components/portal/portal-ui';
import { Quotes, Reveal } from '@/components/portal/disclose';
import type { PortalSignal } from '@/lib/portal/view';
import { loopLine, trendOf } from '@/lib/portal/brief';
import { OwnerDecision } from '@/components/workspace/owner-decision';
import { LiveRefresh } from '@/components/workspace/live-refresh';
import { UpLink } from '@/components/portal/history';
import { movesFor } from '@/lib/improve/owner-moves';
import { getResponsibility } from '@/lib/responsibility/service';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feedback' };

/**
 * FEEDBACK — the evidence cabinet (M24, completed in the final experience pass).
 * The door is called Feedback; the route stays /reviews, because a URL is not
 * copy, and the few rows that come from a public listing keep their own
 * "Public review" label — that distinction is the point.
 *
 * The raw material, made to feel like what it is: the thing every conclusion
 * rests on. The page opens with the transformation Headway made of the pile —
 * everything read, the patterns, the topics raised only once or twice, the
 * one that needs attention — each step a count of the same rows and a tap to
 * the rows behind it. Then the patterns as one-tap filters, so an owner can
 * ask "what did Headway actually base this on?" and see only those comments:
 * three representative ones first, chosen the way every quote on the
 * workspace is chosen, and the whole list one tap further. The full inbox,
 * the ratings, the tones and the search are all still here, under the
 * intelligence rather than above it.
 *
 * EVERY WORD ON THIS PAGE COMES FROM THE DICTIONARY (M31), under `feedback.*`,
 * so the same screen reads in English, Hindi or Marathi. Two rules shaped how
 * the phrases were cut. First, one counted noun: these rows are "feedback
 * entries" everywhere, never comments on one line and something else on the
 * next. Second, whole sentences: "Showing {shown} of {total}…" is a single key
 * with two placeholders, because a sentence glued together from three fragments
 * can only ever come out in English word order.
 *
 * Names are NOT words. `sentiment` stays the query parameter it has always
 * been, `theme` and `stars` likewise, and the taxonomy labels arrive already
 * written from the pack — renaming any of those would break links an owner has
 * already bookmarked to buy nothing.
 */

type Search = Record<string, string | string[] | undefined>;

const SENTIMENTS = ['POSITIVE', 'MIXED', 'NEUTRAL', 'NEGATIVE'] as const;
const SENTIMENT_LABEL: Record<(typeof SENTIMENTS)[number], MessageKey> = {
  POSITIVE: 'feedback.tone.positive',
  MIXED: 'feedback.tone.mixed',
  NEUTRAL: 'feedback.tone.neutral',
  NEGATIVE: 'feedback.tone.negative',
};

/** How many comments stand for a topic before the owner asks for all of them. */
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
 * 87 feedback entries read → 7 patterns → 6 topics mentioned once or twice
 * → 1 needs attention.
 *
 * Four figures and three arrows, each a count of the same rows. The third
 * step buys its length: it is the counterweight that says Headway is NOT
 * treating those topics as patterns. The last step names the theme, because
 * "1" is not a finding and "slow service" is.
 *
 * The count is the figure, never part of the label, so the label is a phrase
 * the dictionary can carry whole in three languages.
 */
function Funnel({
  funnel,
  base,
  t,
}: {
  funnel: ReviewsView['funnel'];
  base: string;
  t: Translator<MessageKey>;
}) {
  const steps: Array<{ value: string; label: string; href: string | null; tone: string }> = [
    {
      value: String(funnel.read),
      label: t.plural('feedback.funnel.read', funnel.read),
      href: base,
      tone: 'text-ink-900',
    },
    {
      value: String(funnel.signals),
      label: t.plural('feedback.funnel.pattern', funnel.signals),
      href: `${base}#signals`,
      tone: 'text-ink-900',
    },
    {
      value: String(funnel.isolated),
      label: t.plural('feedback.funnel.isolated', funnel.isolated),
      href: null,
      tone: 'text-ink-500',
    },
    funnel.attention
      ? {
          value: '1',
          label: t('feedback.funnel.attention', { topic: funnel.attention.label.toLowerCase() }),
          href: `${base}?theme=${encodeURIComponent(funnel.attention.key)}`,
          tone: 'text-bad-700',
        }
      : { value: '0', label: t('feedback.funnel.attentionNone'), href: null, tone: 'text-good-700' },
  ];
  return (
    <ol className="mb-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-0" aria-label={t('feedback.funnel.aria')}>
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

/**
 * WHAT CUSTOMERS ARE SAYING — the answer, first (mobile pass).
 *
 * This page used to open with the funnel: four figures and three arrows
 * describing what Headway did to the pile. That is a diagram of the SOFTWARE'S
 * work, and it was the first thing on a screen whose whole job is to answer
 * "what are my customers saying?". The funnel is still here — it is a fair
 * account of the method — but it now sits with the method, under a tap.
 *
 * In its place: the themes themselves, complaints first, biggest first, each
 * one a row the width of the phone. The count is the largest thing in the row
 * because the count IS the finding, and tapping the row filters the page to
 * exactly the feedback entries it counts.
 *
 * COMPLAINTS BEFORE PRAISE, and not because bad news matters more. They are in
 * the order an owner acts on them: the complaints are the list they can do
 * something about this week, and burying them under praise would be the
 * product flattering the reader.
 *
 * ROWS, NOT CHIPS. These were pill-shaped chips in a wrapping row, which on a
 * phone produced five ragged lines of small text with the counts floating
 * between them. A row per theme reads top to bottom, gives every theme the
 * same width, and gives the count somewhere consistent to sit.
 */
export function SayingRows({
  signals,
  base,
  active,
  t,
  basePath,
}: {
  signals: ReviewsView['signals'];
  base: string;
  /** Whether one of these rows is currently the filter. */
  active: boolean;
  t: Translator<MessageKey>;
  /**
   * The workspace root, for the history rules. A row that is already open
   * goes back UP to the list rather than pushing the list on top of itself.
   */
  basePath?: string;
}) {
  const Up = ({
    href,
    className,
    children,
    current,
  }: {
    href: string;
    className: string;
    children: React.ReactNode;
    current?: boolean;
  }) =>
    basePath ? (
      <UpLink href={href} basePath={basePath} className={className} aria-current={current ? 'page' : undefined}>
        {children}
      </UpLink>
    ) : (
      <Link href={href} className={className} aria-current={current ? 'page' : undefined}>
        {children}
      </Link>
    );
  return (
    <ul id="signals" className="scroll-mt-24 divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white">
      {signals.map((s) => (
        <li key={s.key}>
          {/* Opening a topic is a step deeper, so it is an ordinary link and
              adds to history. The open row leads back up. */}
          {(() => {
            const className = clsx(
              'hw-focus-inset flex min-h-14 items-center gap-3 px-4 py-3 transition-colors',
              s.active ? 'bg-ink-900' : 'hover:bg-ink-50',
            );
            const inner = (
              <>
            {/* The kind, as a rule down the left rather than a coloured pill.
                One mark, at the same place in every row, readable at a glance
                and still there when the row is selected. */}
            <span
              aria-hidden
              className={clsx(
                'h-8 w-1 shrink-0 rounded-full',
                s.active ? 'bg-white' : s.kind === 'ISSUE' ? 'bg-bad-600' : 'bg-good-600',
              )}
            />
            <span
              className={clsx(
                'min-w-0 flex-1 text-[16px] leading-snug font-medium',
                s.active ? 'text-white' : 'text-ink-900',
              )}
            >
              {s.label}
            </span>
            {/* Which way it moved since the last check-in: the arrow is the
                count's own direction, the colour whether that is good news
                for this topic. Hidden from screen readers, which hear the
                word beside it instead. */}
            {s.trend ? (
              <span
                className={clsx(
                  'text-[15px] leading-none font-semibold',
                  s.active
                    ? 'text-white'
                    : s.trend.tone === 'good'
                      ? 'text-good-700'
                      : s.trend.tone === 'bad'
                        ? 'text-bad-700'
                        : 'text-ink-400',
                )}
              >
                <span aria-hidden>{s.trend.mark}</span>
                <span className="sr-only">
                  {s.trend.mark === '↑'
                    ? t('brief.trend.up')
                    : s.trend.mark === '↓'
                      ? t('brief.trend.down')
                      : t('brief.trend.steady')}
                </span>
              </span>
            ) : null}
            <span
              className={clsx(
                'font-mono text-[22px] leading-none font-semibold tabular-nums',
                s.active ? 'text-white' : s.kind === 'ISSUE' ? 'text-bad-700' : 'text-good-700',
              )}
            >
              {s.count}
            </span>
              </>
            );
            return s.active ? (
              <Up href={base} className={className} current>
                {inner}
              </Up>
            ) : (
              <Link href={`${base}?theme=${encodeURIComponent(s.key)}`} className={className}>
                {inner}
              </Link>
            );
          })()}
        </li>
      ))}
      {/* The way back out, in the list rather than floating above it: a
          selected row is the only state from which "show everything" means
          anything, so the control only exists then. */}
      {active ? (
        <li>
          <Up
            href={base}
            className="hw-focus-inset flex min-h-12 items-center px-4 py-2.5 text-[14px] font-medium text-ink-700 hover:bg-ink-50"
          >
            {/* Not "clear filters": an owner did not set a filter, they tapped
                a topic. This is the way back to everything. */}
            {t('feedback.saying.showAll')}
          </Up>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * ONE TOPIC, TOLD AS A STORY (final experience pass).
 *
 * Tapping a topic used to filter the inbox: the same page, fewer rows, and a
 * box saying what Headway made of them. The owner still had to read the rows
 * and assemble the meaning. Now a topic opens as the sequence a person would
 * tell it in:
 *
 *   WHAT CUSTOMERS SAID     three of them, in their own words — first
 *   WHAT CHANGED            the engine's own comparison of the last two check-ins
 *   WHAT HEADWAY THINKS     one sentence, marked as Headway's reading
 *   WHAT TO DO              the suggestion, and the decision, on this screen
 *   WHAT HAPPENS NEXT       what Headway will watch for
 *
 * Evidence before interpretation, interpretation before action — the order
 * that makes the conclusion believable. Every feedback entry about the topic
 * is still listed below the story.
 *
 * A strength has no decision to make, so its fourth step is "keep doing" and
 * carries no button. Praise is a thing to protect, not a change.
 *
 * The rail down the left is the one piece of structure: it says "these five
 * belong together, in this order" without five more boxes.
 */
export async function TopicStory({
  signal,
  quotes,
  clientId,
  base,
  basePath,
}: {
  signal: PortalSignal;
  quotes: Quote[];
  clientId: string;
  base: string;
  /** The workspace root, for the history rules and for each quote's own page. */
  basePath: string;
}) {
  const t = await getTranslator();
  const issue = signal.kind === 'ISSUE';
  const trend = trendOf(signal, t);
  const state = loopLine(signal.actionState, t);
  const choices = movesFor(signal.actionStatus);
  const changed = signal.movementLine ?? signal.recurrence;

  const Step = ({
    title,
    lead = false,
    children,
  }: {
    title: string;
    lead?: boolean;
    children: React.ReactNode;
  }) => (
    <li className="relative pb-6 pl-6 last:pb-0">
      <span
        aria-hidden
        className={clsx(
          'absolute top-1 -left-[7px] h-3 w-3 rounded-full border-2',
          lead ? 'border-brand-500 bg-brand-500' : 'border-brand-400 bg-canvas',
        )}
      />
      <h2 className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{title}</h2>
      <div className="mt-1.5">{children}</div>
    </li>
  );

  return (
    <article aria-labelledby="topic-title" className="mb-10">
      {/* Up to every topic. When the list is right behind this in history —
          the usual way here — this is the browser's own Back. */}
      <UpLink
        href={base}
        basePath={basePath}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-[14px] font-medium text-ink-700 hover:text-ink-900"
      >
        <span aria-hidden>←</span> {t('feedback.story.back')}
      </UpLink>

      <p
        className={clsx(
          'mt-2 text-[11px] font-semibold tracking-[0.14em] uppercase',
          issue ? 'text-bad-700' : 'text-good-700',
        )}
      >
        {issue ? t('feedback.story.issue') : t('feedback.story.praise')}
      </p>
      <h1
        id="topic-title"
        className="mt-1.5 font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.01em] text-balance text-ink-900 sm:text-[34px]"
      >
        {signal.themeLabel}
      </h1>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[34px] leading-none font-semibold text-ink-900 tabular-nums">
          {signal.evidenceCount}
        </span>
        <span className="text-[13px] text-ink-500">
          {t('brief.basis', { count: signal.evidenceCount, total: signal.evidenceTotal })}
        </span>
        {trend ? (
          <span
            className={clsx(
              'text-[13px] font-medium',
              trend.tone === 'good' ? 'text-good-700' : trend.tone === 'bad' ? 'text-bad-700' : 'text-ink-500',
            )}
          >
            <span aria-hidden>{trend.mark}</span> {trend.counts ?? trend.label}
          </span>
        ) : null}
      </p>

      <ol className="mt-7 ml-1.5 border-l border-ink-200">
        <Step title={t('feedback.story.said')}>
          {/* Each customer opens their whole entry: a step deeper. */}
          <Quotes
            quotes={quotes}
            hrefFor={(id) => `${base}/${id}?topic=${encodeURIComponent(signal.themeKey)}`}
          />
        </Step>

        {changed ? (
          <Step title={t('feedback.story.changed')}>
            <p className="max-w-2xl text-[15px] leading-snug text-ink-800">{changed}</p>
          </Step>
        ) : null}

        <Step title={t('feedback.story.thinks')}>
          <p className="max-w-2xl text-[16px] leading-snug text-ink-900">{signal.brief}</p>
        </Step>

        {issue ? (
          <Step title={t('feedback.story.todo')} lead>
            <p className="max-w-2xl text-[17px] leading-snug font-semibold text-ink-900">
              {signal.suggestion ?? signal.nextStep}
            </p>
            {state ? (
              <p className="mt-3 border-l-2 border-ink-300 pl-3 text-[13px] leading-snug text-ink-600">{state}</p>
            ) : null}
            {choices.length > 0 ? (
              <OwnerDecision
                clientId={clientId}
                themeKey={signal.themeKey}
                actionId={signal.actionId}
                choices={choices}
                lead
              />
            ) : null}
          </Step>
        ) : (
          <Step title={t('feedback.story.keep')} lead>
            <p className="max-w-2xl text-[17px] leading-snug font-semibold text-ink-900">{signal.nextStep}</p>
          </Step>
        )}

        <Step title={t('feedback.story.next')}>
          <p className="max-w-2xl text-[15px] leading-snug text-ink-700">{signal.watchLine}</p>
        </Step>
      </ol>
    </article>
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
  // The language has to be in hand BEFORE the view is built, because the view
  // is where the sentences are written. Resolving it alongside would have
  // raced the thing it is needed for.
  const t = await getTranslator();
  const [view, evidence] = await Promise.all([
    getReviewsView(prisma, client.id, filters, { page, t }),
    getEvidenceIndex(prisma, client.id),
  ]);
  if (!view) notFound();

  // The whole reading of the selected theme, loaded ONLY when one is selected.
  // It is what turns this page from evidence into a decision, and it costs a
  // core load — so the unfiltered inbox, which cannot use it, does not pay.
  const selected = filters.theme
    ? await (async () => {
        const bundle = await getResponsibility(prisma, client.id, { t });
        if (!bundle) return null;
        const v = bundle.view;
        return (
          [...v.unhappy, ...v.loved, ...v.early].find((s) => s.themeKey === filters.theme) ?? null
        );
      })()
    : null;

  const base = `${basePath}/reviews`;
  const filtered = view.filterSummary !== null;
  const issues = view.themeOptions.filter((t) => t.kind === 'ISSUE');
  const praise = view.themeOptions.filter((t) => t.kind === 'PRAISE');
  const inHand = view.waiting + view.processing;
  const activeSignal = view.signals.find((s) => s.active) ?? null;
  // The story is told only for a topic Headway reads as a pattern, which is
  // exactly when the full signal was found. A topic mentioned once or twice
  // gets the plain list, headed by what it is.
  const story = activeSignal && selected ? selected : null;
  const searching = filters.q.trim().length > 0 || filters.sentiment !== null || filters.source !== null || filters.needs !== null;

  // One topic, nothing else narrowed, first page: the representative comments
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

  // One server render, named, so a copy the browser restores on Back can be
  // told apart from a fresh one and refreshed. See `LiveRefresh`.
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <>
      <LiveRefresh stamp={stamp} reading={inHand > 0} />
      {/* The heading only, with no paragraph under it. The three sentences
          that used to sit here said what the page was for — which the heading
          already says — or gave instructions for reading the rows below, which
          is documentation for a screen that should not need any. The one case
          worth a sentence is the pile that has not been read yet, because the
          owner otherwise sees an empty page and concludes the product is
          broken. That sentence is kept and the other two are gone. */}
      {/* ONE TOPIC OPEN: its story leads, and the tools for the whole pile —
          the counts, the method, the summary — step aside. They are about
          everything, and the owner has just asked about one thing. */}
      {story ? (
        <TopicStory
          signal={story}
          quotes={quotesFor(evidence, story.themeKey, { limit: REPRESENTATIVE })}
          clientId={clientId}
          base={base}
          basePath={basePath}
        />
      ) : (
        <>
          <PageIntro
            eyebrow={t('feedback.intro.eyebrow')}
            title={t('feedback.saying.heading')}
            description={
              view.total === 0
                ? t('feedback.intro.empty')
                : view.analysed === 0 && inHand > 0
                  ? t('feedback.intro.reading')
                  : null
            }
          />

          {/* THE ANSWER, FIRST: the topics themselves, biggest first,
              complaints before praise, each with which way it moved. What used
              to lead here — the funnel of Headway's own work — is under "How
              Headway read these", with the rest of the method. */}
          {view.signals.length > 0 ? (
            <section className="mb-6" aria-label={t('feedback.saying.heading')}>
              <SayingRows
                signals={view.signals}
                base={base}
                active={activeSignal !== null}
                t={t}
                basePath={basePath}
              />
            </section>
          ) : null}
        </>
      )}

      {!story && view.total > 0 ? (
        <StatusStrip
          items={[
            { label: t('feedback.status.collected'), value: view.total },
            { label: t('feedback.status.read'), value: view.analysed },
            ...(inHand > 0
              ? [{ label: t('feedback.status.reading'), value: inHand, tone: 'warn' as const }]
              : []),
            ...(view.failed > 0
              ? [{ label: t('feedback.status.failed'), value: view.failed, tone: 'bad' as const }]
              : []),
            ...(view.averageRating !== null
              ? [
                  {
                    label: t.plural('feedback.status.average', view.withRating),
                    value: `${view.averageRating.toFixed(1)}★`,
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {/* How Headway got from the pile to those topics. Method, so it sits
          with the method: the funnel, the ratings, the tones and the rest of
          what the reading found, all behind one tap. An owner who wants to
          audit the reading gets everything they had before; an owner who
          wants to know what customers said is not made to walk through it
          first. */}
      {!story && view.analysed > 0 ? (
        <div className="mb-6">
          <Reveal summary={t('feedback.method.summary')}>
            <div className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
              <Funnel funnel={view.funnel} base={base} t={t} />
              <RatingStrip base={base} ratings={view.ratings} active={view.filters.stars} />
            </div>
          </Reveal>
        </div>
      ) : null}

      {!story && view.found.length > 0 ? (
        <div className="mb-6">
          <Reveal summary={t('feedback.found.summary')}>
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
                      {t('feedback.found.byRating', { count: view.withRating })}
                    </h3>
                    <RatingBars ratings={view.ratings} />
                  </div>
                  <div>
                    <h3 className="mb-3 text-[11px] font-medium tracking-widest text-ink-500 uppercase">
                      {t('feedback.found.byTone', { count: view.analysed })}
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
          <Reveal summary={t('feedback.filter.summary')} open={searching}>
            <form method="get" action={base} className="border-y border-ink-200 py-4">
              {/* One grid that reads the same on every width: search full width,
                  then the pickers two to a row on a phone and in one row from
                  tablet up. Nothing here scrolls sideways. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                <label className={`${label} col-span-2 sm:col-span-4 lg:col-span-1`}>
                  {t('feedback.filter.search')}
                  <input type="search" name="q" defaultValue={view.filters.q} placeholder={t('feedback.filter.searchPlaceholder')} className={control} />
                </label>
                <label className={label}>
                  {t('feedback.filter.about')}
                  <select name="theme" defaultValue={view.filters.theme ?? ''} className={control}>
                    <option value="">{t('feedback.filter.anything')}</option>
                    {issues.length > 0 ? (
                      <optgroup label={t('feedback.filter.complaints')}>
                        {issues.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </optgroup>
                    ) : null}
                    {praise.length > 0 ? (
                      <optgroup label={t('feedback.filter.praise')}>
                        {praise.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>
                <label className={label}>
                  {t('feedback.filter.rating')}
                  <select name="stars" defaultValue={view.filters.stars ? String(view.filters.stars) : ''} className={control}>
                    <option value="">{t('feedback.filter.any')}</option>
                    {[5, 4, 3, 2, 1].map((s) => (
                      <option key={s} value={s}>{t.plural('feedback.filter.stars', s)}</option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  {t('feedback.filter.tone')}
                  <select name="sentiment" defaultValue={view.filters.sentiment ?? ''} className={control}>
                    <option value="">{t('feedback.filter.any')}</option>
                    {SENTIMENTS.map((s) => (
                      <option key={s} value={s}>{t(SENTIMENT_LABEL[s])}</option>
                    ))}
                  </select>
                </label>
                {view.sourceOptions.length > 1 ? (
                  <label className={label}>
                    {t('feedback.filter.from')}
                    <select name="source" defaultValue={view.filters.source ?? ''} className={control}>
                      <option value="">{t('feedback.filter.anywhere')}</option>
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
                  {t('feedback.filter.needsReply')}
                </label>
                <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-ink-900 px-3.5 text-[13px] font-medium text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:outline-none">
                  {t('feedback.filter.show')}
                </button>
                {filtered ? (
                  <Link href={base} className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[13px] text-ink-500 hover:text-ink-900">{t('feedback.filter.clear')}</Link>
                ) : null}
              </div>
            </form>
          </Reveal>
        </div>
      ) : null}

      {view.total === 0 ? (
        <Quiet>{t('feedback.empty.body')}</Quiet>
      ) : (
        // #entries is where Home's link to every entry lands: the entries
        // themselves, below the topics.
        <div id="entries" className="scroll-mt-24">
          {activeSignal ? (
            <div className="mb-1 border-l-2 border-ink-900 pl-4">
              {/* Under the story, this is simply the rows it rests on. Where
                  no story could be told — a topic mentioned, but not yet a
                  pattern — it is the page's heading instead. */}
              <p className={EYEBROW}>{t('feedback.evidence.eyebrow')}</p>
              <p className="mt-1 text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                {t('feedback.evidence.title', { topic: activeSignal.label.toLowerCase() })}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-600">
                {t.plural('feedback.evidence.count', view.matching)}
                {representative && view.matching > items.length
                  ? ` ${t.plural('feedback.evidence.clearest', items.length)}`
                  : ''}{' '}
                <UpLink href={base} basePath={basePath} className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900">
                  {t('feedback.filter.clear')}
                </UpLink>
              </p>
            </div>
          ) : (
            <p className="text-[14px] font-medium text-ink-900">
              {t.plural('feedback.list.count', view.shown)}
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
                {t('feedback.list.noMatch')}{' '}
                <Link href={base} className="text-ink-900 underline underline-offset-2">
                  {t('feedback.list.clearAll')}
                </Link>
              </Quiet>
            </div>
          )}
          {representative && view.matching > items.length ? (
            <div className="mt-6 border-t border-ink-200 pt-5">
              <p className="text-[13px] text-ink-600">
                {t('feedback.list.showingAbout', { shown: items.length, total: view.matching })}
              </p>
              <Link
                href={showAllHref}
                // The same list, longer — not a new place. Replace, and stay put.
                replace
                scroll={false}
                className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg border border-ink-300 px-4 text-[13px] font-medium text-ink-900 hover:border-ink-900"
              >
                {t('feedback.list.showAll', { count: view.matching })} <span aria-hidden>→</span>
              </Link>
            </div>
          ) : view.hasMore ? (
            <div className="mt-6 border-t border-ink-200 pt-5">
              <p className="text-[13px] text-ink-600">
                {t('feedback.list.showing', { shown: view.shown, total: view.matching })}
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
                replace
                scroll={false}
                className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-ink-300 px-4 text-[13px] font-medium text-ink-900 hover:border-ink-900"
              >
                {t('feedback.list.showMore')}
              </Link>
            </div>
          ) : view.matching > 0 ? (
            <p className="mt-4 text-[12px] text-ink-500">
              {t.plural('feedback.list.end', view.matching)}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
