import Link from 'next/link';
import { notFound } from 'next/navigation';
import clsx from 'clsx';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Notice,
  Stat,
} from '@/components/ui';
import { AddFeedbackPanel } from '@/components/forms/feedback-forms';
import {
  AnalyseFeedbackButton,
  ReanalyseButton,
} from '@/components/forms/analyse-button';
import { DraftRepliesButton } from '@/components/forms/reply-panel';
import { prisma } from '@/lib/db';
import {
  getFeedbackStats,
  listClientFeedback,
  sourceOptions,
} from '@/lib/feedback/service';
import { getAnalysisCoverage, getThemeSummary } from '@/lib/feedback/analysis';
import { getReplyCoverage } from '@/lib/feedback/replies';
import { responseActionLabel } from '@/lib/reply/triage';
import { sentimentLabel } from '@/lib/analysis/normalize';
import { formatDate, formatDecimal, formatNumber, toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

const SENTIMENT_TONE: Record<string, 'good' | 'bad' | 'warn' | 'neutral'> = {
  POSITIVE: 'good',
  NEGATIVE: 'bad',
  MIXED: 'warn',
  NEUTRAL: 'neutral',
};

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, vertical: true },
  });
  if (!client) notFound();

  const starFilter = query.stars ? Number.parseInt(query.stars, 10) : null;
  const sourceFilter = query.source ?? null;
  const sentimentFilter = query.sentiment ?? null;
  const needsFilter = query.needs === '1';
  const themeFilter = query.theme ?? null;
  const actionFilter = query.action ?? null;
  const draftFilter = query.draft ?? null;

  const [stats, coverage, replies, themes, items] = await Promise.all([
    getFeedbackStats(prisma, id),
    getAnalysisCoverage(prisma, id),
    getReplyCoverage(prisma, id),
    getThemeSummary(prisma, id, client.vertical),
    listClientFeedback(prisma, id, {
      stars: Number.isFinite(starFilter) ? starFilter : null,
      source: sourceFilter,
      sentiment: sentimentFilter,
      themeKey: themeFilter,
      analysed: needsFilter ? false : null,
      responseAction: actionFilter,
      draftStatus: draftFilter,
      // Working a reply queue means the most demanding item should lead.
      byPriority: actionFilter !== null || draftFilter !== null,
      limit: 300,
    }),
  ]);

  const filtered = items;

  const imported = query.imported ? Number.parseInt(query.imported, 10) : null;
  const read = query.read ? Number.parseInt(query.read, 10) : null;
  const retry = query.retry ? Number.parseInt(query.retry, 10) : 0;
  const base = `/clients/${id}/feedback`;

  const href = (next: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null> = {
      stars: starFilter === null ? null : String(starFilter),
      source: sourceFilter,
      sentiment: sentimentFilter,
      theme: themeFilter,
      action: actionFilter,
      draft: draftFilter,
      needs: needsFilter ? '1' : null,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) p.set(key, value);
    }
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const filtering =
    starFilter !== null ||
    sourceFilter !== null ||
    sentimentFilter !== null ||
    themeFilter !== null ||
    actionFilter !== null ||
    draftFilter !== null ||
    needsFilter;

  const themeLabel = themeFilter
    ? ([...themes.praises, ...themes.issues].find((t) => t.key === themeFilter)?.label ??
      themeFilter)
    : null;

  return (
    <div className="space-y-5">
      {/* ---- Result banners ---- */}
      <div className="space-y-3">
        {imported !== null ? (
          <Notice tone={imported > 0 ? 'good' : 'warn'}>
            <span className="text-[14px] font-semibold">
              Imported: {formatNumber(imported)}
            </span>
            {query.skipped && Number(query.skipped) > 0
              ? ` · Skipped as duplicates: ${query.skipped}`
              : ''}
            {query.redacted && Number(query.redacted) > 0
              ? ` · Personal details removed from: ${query.redacted}`
              : ''}
          </Notice>
        ) : null}

        {read !== null ? (
          <Notice tone={retry > 0 ? 'warn' : 'good'}>
            <span className="text-[14px] font-semibold">
              Read {formatNumber(read)} {read === 1 ? 'review' : 'reviews'}
            </span>
            {retry > 0 ? ` · ${retry} need another try` : ''}
            {query.skipped && Number(query.skipped) > 0
              ? ` · ${query.skipped} already read`
              : ''}
            {query.assisted === '1' ? ' · with the writing assistant' : ''}
          </Notice>
        ) : null}

        {query.drafted !== undefined ? (
          <Notice tone={Number(query.draftFailed) > 0 ? 'warn' : 'good'}>
            <span className="text-[14px] font-semibold">
              Drafted: {formatNumber(Number(query.drafted) || 0)}
            </span>
            {Number(query.already) > 0 ? ` · Already drafted: ${query.already}` : ''}
            {Number(query.draftFailed) > 0 ? ` · Failed: ${query.draftFailed}` : ''}
            {Number(query.forYou) > 0 ? ` · Left for you: ${query.forYou}` : ''}
            {query.assisted === '1' ? ' · with the writing assistant' : ''}
          </Notice>
        ) : null}

        {query.readError ? <Notice tone="bad">{query.readError}</Notice> : null}
        {query.draftError ? <Notice tone="bad">{query.draftError}</Notice> : null}
        {query.deleted ? <Notice tone="good">Feedback item deleted.</Notice> : null}
      </div>

      {stats.total === 0 ? (
        <Card>
          <EmptyState
            title="No feedback yet"
            description="Paste your reviews here and RepOS will read them for you. Bring in as many as you like at once — from a public listing, a feedback form, or something a customer said in person."
            action={
              <AddFeedbackPanel
                clientId={id}
                sources={sourceOptions()}
                defaultDate={toDateInputValue(new Date())}
              />
            }
          />
        </Card>
      ) : (
        <>
          {/* ---- Has RepOS read this? ---- */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Feedback collected"
              value={formatNumber(stats.total)}
              hint={stats.newestAt ? `Latest ${formatDate(stats.newestAt)}` : undefined}
            />
            <Stat
              label="Read by RepOS"
              value={formatNumber(coverage.analysed)}
              hint={
                coverage.upToDate
                  ? 'All of it'
                  : `${coverage.needsAnalysis} still to read`
              }
              tone={coverage.upToDate ? 'good' : 'warn'}
            />
            <Stat
              label="Average rating"
              value={formatDecimal(stats.averageRating, 1)}
              hint={
                stats.withRating === 0
                  ? 'No ratings supplied'
                  : `From ${stats.withRating} with a rating`
              }
            />
            <Stat
              label="Needs a reply"
              value={
                replies.needsTriage > 0 ? '—' : formatNumber(replies.needsReply)
              }
              hint={
                replies.needsTriage > 0
                  ? `${replies.needsTriage} still to sort`
                  : replies.needsYou > 0
                    ? `${replies.needsYou} for you personally`
                    : replies.awaitingDraft > 0
                      ? `${replies.awaitingDraft} without a suggestion yet`
                      : replies.needsReply > 0
                        ? 'All have a suggestion'
                        : 'Nothing waiting'
              }
              tone={
                replies.needsTriage > 0 || replies.needsYou > 0
                  ? 'warn'
                  : replies.awaitingDraft > 0
                    ? 'warn'
                    : 'good'
              }
            />
          </div>

          {!coverage.upToDate ? (
            <Notice tone="warn" title={`${coverage.needsAnalysis} not read yet`}>
              RepOS has read {coverage.analysed} of {coverage.total}. Read the rest
              so what customers are saying stays up to date.
              {coverage.failed > 0
                ? ` ${coverage.failed} did not go through last time and will be tried again.`
                : ''}
            </Notice>
          ) : null}

          {/* ---- What customers are saying ---- */}
          {coverage.analysed > 0 ? (
            <Card>
              <CardHeader
                title="What customers are saying"
                description={`From the ${coverage.analysed} ${coverage.analysed === 1 ? 'review' : 'reviews'} RepOS has read. Counts only — every one links back to the reviews behind it.`}
              />
              <CardBody className="grid gap-6 sm:grid-cols-2">
                <ThemeColumn
                  title="Happy about"
                  tone="good"
                  rows={themes.praises}
                  href={(key) => href({ theme: key, sentiment: null, needs: null })}
                  activeKey={themeFilter}
                  emptyLabel="Nothing specific praised yet."
                />
                <ThemeColumn
                  title="Unhappy about"
                  tone="bad"
                  rows={themes.issues}
                  href={(key) => href({ theme: key, sentiment: null, needs: null })}
                  activeKey={themeFilter}
                  emptyLabel="No complaints found yet."
                />
              </CardBody>
            </Card>
          ) : null}

          {/* ---- The feedback itself ---- */}
          <Card>
            <CardHeader
              title="Feedback"
              description="Everything customers have told this business, as you brought it in."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {coverage.upToDate && coverage.total > 0 ? (
                    <ReanalyseButton clientId={id} />
                  ) : (
                    <AnalyseFeedbackButton
                      clientId={id}
                      needsAnalysis={coverage.needsAnalysis}
                    />
                  )}
                  {replies.awaitingDraft > 0 ? (
                    <DraftRepliesButton
                      clientId={id}
                      awaiting={replies.awaitingDraft}
                    />
                  ) : null}
                  <AddFeedbackPanel
                    clientId={id}
                    sources={sourceOptions()}
                    defaultDate={toDateInputValue(new Date())}
                  />
                </div>
              }
            />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <FilterGroup label="Customer sentiment">
                  <Chip href={href({ sentiment: null, needs: null })} active={!sentimentFilter && !needsFilter}>
                    All
                  </Chip>
                  {(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'] as const).map((key) => (
                    <Chip
                      key={key}
                      href={href({ sentiment: key, needs: null })}
                      active={sentimentFilter === key}
                    >
                      {sentimentLabel(key)} ({coverage.sentimentCounts[key] ?? 0})
                    </Chip>
                  ))}
                  {coverage.needsAnalysis > 0 ? (
                    <Chip
                      href={href({ needs: '1', sentiment: null })}
                      active={needsFilter}
                    >
                      Needs analysis ({coverage.needsAnalysis})
                    </Chip>
                  ) : null}
                </FilterGroup>

                <FilterGroup label="Needs a reply">
                  <Chip
                    href={href({ action: null, draft: null })}
                    active={!actionFilter && !draftFilter}
                  >
                    All
                  </Chip>
                  {replies.needsReply > 0 ? (
                    <Chip
                      href={href({ action: 'REPLY_RECOMMENDED', draft: null })}
                      active={actionFilter === 'REPLY_RECOMMENDED'}
                    >
                      Reply recommended ({replies.needsReply})
                    </Chip>
                  ) : null}
                  {replies.needsYou > 0 ? (
                    <Chip
                      href={href({ action: 'NEEDS_HUMAN', draft: null })}
                      active={actionFilter === 'NEEDS_HUMAN'}
                    >
                      For you personally ({replies.needsYou})
                    </Chip>
                  ) : null}
                  {replies.drafted > 0 ? (
                    <Chip
                      href={href({ draft: 'READY', action: null })}
                      active={draftFilter === 'READY'}
                    >
                      Draft ready ({replies.drafted})
                    </Chip>
                  ) : null}
                  {replies.handled > 0 ? (
                    <Chip
                      href={href({ draft: 'HANDLED', action: null })}
                      active={draftFilter === 'HANDLED'}
                    >
                      Handled ({replies.handled})
                    </Chip>
                  ) : null}
                </FilterGroup>

                <FilterGroup label="Rating">
                  <Chip href={href({ stars: null })} active={starFilter === null}>
                    All
                  </Chip>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <Chip
                      key={star}
                      href={href({ stars: String(star) })}
                      active={starFilter === star}
                    >
                      {star}★ ({stats.ratingCounts[String(star)] ?? 0})
                    </Chip>
                  ))}
                </FilterGroup>
              </div>

              {filtered.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ink-500">
                  Nothing matches that filter.{' '}
                  <Link href={base} className="underline underline-offset-2">
                    Show everything
                  </Link>
                  .
                </p>
              ) : (
                <>
                  {filtering ? (
                    <p className="text-[12px] text-ink-500">
                      {themeLabel ? `Reviews mentioning “${themeLabel}”. ` : ''}
                      Showing {filtered.length} of {stats.total}.{' '}
                      <Link href={base} className="underline underline-offset-2">
                        Clear filters
                      </Link>
                    </p>
                  ) : null}
                  <ul className="divide-y divide-ink-100">
                    {filtered.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`${base}/${item.id}`}
                          className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-ink-50"
                        >
                          <RatingPill stars={item.stars} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] leading-relaxed text-ink-800">
                              {item.preview}
                            </span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                              {item.analysed ? (
                                <Badge tone={SENTIMENT_TONE[item.sentiment] ?? 'neutral'}>
                                  {sentimentLabel(item.sentiment)}
                                </Badge>
                              ) : (
                                <Badge tone="brand">Needs analysis</Badge>
                              )}
                              {item.analysed && item.responseAction !== 'NONE' ? (
                                <Badge
                                  tone={
                                    item.responseAction === 'NEEDS_HUMAN'
                                      ? 'bad'
                                      : item.responseAction === 'REPLY_RECOMMENDED'
                                        ? 'brand'
                                        : 'neutral'
                                  }
                                >
                                  {(item.draftCurrent
                                    ? DRAFT_STATE_LABEL[item.draftStatus]
                                    : null) ??
                                    responseActionLabel(item.responseAction)}
                                </Badge>
                              ) : null}
                              {(item.analysed ? item.themes : []).slice(0, 3).map((theme) => (
                                <span
                                  key={theme.key}
                                  className={clsx(
                                    'rounded border px-1.5 py-0.5 text-[11px]',
                                    theme.sentiment === 'POSITIVE'
                                      ? 'border-good-200 text-good-700'
                                      : 'border-bad-200 text-bad-700',
                                  )}
                                >
                                  {theme.label}
                                </span>
                              ))}
                              <span>
                                {item.reviewDate
                                  ? formatDate(item.reviewDate)
                                  : 'No date given'}
                              </span>
                              <span>· {item.sourceLabel}</span>
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * What the row says about where this item has got to. The draft state wins
 * when there is one, because "Draft ready" is more use than repeating the
 * recommendation the operator has already acted on.
 */
const DRAFT_STATE_LABEL: Record<string, string> = {
  READY: 'Draft ready',
  EDITED: 'Your wording',
  HANDLED: 'Handled',
  FAILED: 'Draft failed',
};

function ThemeColumn({
  title,
  tone,
  rows,
  href,
  activeKey,
  emptyLabel,
}: {
  title: string;
  tone: 'good' | 'bad';
  rows: Array<{ key: string; label: string; count: number }>;
  href: (key: string) => string;
  activeKey: string | null;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-500">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((row) => (
            <li key={row.key}>
              <Link
                href={href(row.key)}
                className={clsx(
                  'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] hover:bg-ink-50',
                  activeKey === row.key && 'bg-ink-100',
                )}
              >
                <span className="min-w-0 truncate text-ink-800">{row.label}</span>
                <span
                  className={clsx(
                    'shrink-0 rounded-md border px-2 py-0.5 text-[12px] font-semibold tabular-nums',
                    tone === 'good'
                      ? 'border-good-200 bg-good-50 text-good-700'
                      : 'border-bad-200 bg-bad-50 text-bad-700',
                  )}
                >
                  {row.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RatingPill({ stars }: { stars: number | null }) {
  if (stars === null) {
    return (
      <span className="mt-0.5 grid h-7 w-9 shrink-0 place-items-center rounded-md border border-dashed border-ink-300 text-[11px] text-ink-400">
        —
      </span>
    );
  }
  return (
    <span
      className={clsx(
        'mt-0.5 grid h-7 w-9 shrink-0 place-items-center rounded-md border text-[12px] font-semibold tabular-nums',
        stars >= 4
          ? 'border-good-200 bg-good-50 text-good-700'
          : stars <= 2
            ? 'border-bad-200 bg-bad-50 text-bad-700'
            : 'border-warn-200 bg-warn-50 text-warn-700',
      )}
    >
      {stars}★
    </span>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] font-medium text-ink-500">{label}:</span>
      {children}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'rounded-md px-2 py-1 text-[12px] font-medium',
        active
          ? 'bg-ink-900 text-white'
          : 'border border-ink-200 text-ink-600 hover:bg-ink-100',
      )}
    >
      {children}
    </Link>
  );
}
