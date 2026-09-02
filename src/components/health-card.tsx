import clsx from 'clsx';
import Link from 'next/link';
import { Badge, Card, CardBody, CardHeader, LinkButton, Notice } from '@/components/ui';
import type {
  Distribution,
  HealthCard as HealthCardData,
  Pulse,
  ThemeCount,
  Trend,
  TrendMetric,
} from '@/lib/health/health';
import type { HealthStatus, TrendDirection } from '@/lib/health/rules';
import { formatDate, formatDecimal, formatNumber } from '@/lib/format';

/**
 * Health Card + Pulse presentation.
 *
 * Purely presentational: every number and every sentence shown here was already
 * computed by src/lib/health/health.ts. No arithmetic happens in this file.
 */

const STATUS_TONE: Record<HealthStatus, 'good' | 'warn' | 'bad' | 'neutral'> = {
  HEALTHY: 'good',
  WATCH: 'warn',
  ATTENTION: 'bad',
  INSUFFICIENT_DATA: 'neutral',
};

const STATUS_BAR: Record<HealthStatus, string> = {
  HEALTHY: 'bg-good-600',
  WATCH: 'bg-warn-600',
  ATTENTION: 'bg-bad-600',
  INSUFFICIENT_DATA: 'bg-ink-300',
};

const TREND_TONE: Record<TrendDirection, 'good' | 'warn' | 'bad' | 'neutral'> = {
  IMPROVING: 'good',
  STABLE: 'neutral',
  DECLINING: 'bad',
  NONE: 'neutral',
};

const TREND_GLYPH: Record<TrendDirection, string> = {
  IMPROVING: '▲',
  STABLE: '▬',
  DECLINING: '▼',
  NONE: '–',
};

function pctText(share: number | null): string {
  if (share === null) return '—';
  return `${Math.round(share * 100)}%`;
}

// ---------------------------------------------------------------------------

export function HealthCardPanel({
  health,
  clientId,
}: {
  health: HealthCardData;
  clientId: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={clsx('h-1', STATUS_BAR[health.status])} />
      <CardHeader
        title="Health card"
        description={health.coverage.note}
        action={
          health.latestSnapshotId ? (
            <LinkButton href={`/clients/${clientId}/snapshots/${health.latestSnapshotId}`}>
              Open latest snapshot
            </LinkButton>
          ) : (
            <LinkButton href={`/clients/${clientId}/snapshots/new`} variant="primary">
              Take first snapshot
            </LinkButton>
          )
        }
      />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div>
            <p className="text-[12px] font-medium text-ink-500">Status</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge tone={STATUS_TONE[health.status]}>{health.statusLabel}</Badge>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink-500">Trend</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge tone={TREND_TONE[health.trend.direction]}>
                <span aria-hidden className="mr-1">
                  {TREND_GLYPH[health.trend.direction]}
                </span>
                {health.trend.label}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink-500">Last updated</p>
            <p className="mt-1.5 text-[14px] font-medium text-ink-900">
              {health.lastUpdatedAt ? formatDate(health.lastUpdatedAt) : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink-500">Feedback in RepOS</p>
            <p className="mt-1.5 text-[14px] font-medium tabular-nums text-ink-900">
              {formatNumber(health.coverage.totalFeedbackStored)}
            </p>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-ink-700">
          {health.statusSummary}
        </p>

        {health.status === 'INSUFFICIENT_DATA' ? (
          <Notice tone="neutral">
            RepOS will not give this client a status until there is something
            real to base one on. Take a snapshot: enter what you see on the
            public listing and paste any reviews you collected.
          </Notice>
        ) : null}

        {health.signals.length > 0 ? (
          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
              Why this status
            </p>
            <ul className="space-y-2">
              {health.signals.map((signal) => (
                <li
                  key={signal.key}
                  className={clsx(
                    'rounded-lg border px-3.5 py-2.5',
                    signal.level === 'ATTENTION'
                      ? 'border-bad-200 bg-bad-50'
                      : 'border-warn-200 bg-warn-50',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={signal.level === 'ATTENTION' ? 'bad' : 'warn'}>
                      {signal.level === 'ATTENTION' ? 'Attention' : 'Watch'}
                    </Badge>
                    <span className="text-[13px] font-medium text-ink-900">
                      {signal.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
                    {signal.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ObservedRow health={health} />
        <DistributionBar distribution={health.distribution} />

        <div className="grid gap-5 sm:grid-cols-2">
          <ThemeList
            title="Top complaint signals"
            themes={health.topIssues}
            emptyLabel="No complaint themes in the stored feedback."
          />
          <ThemeList
            title="Top praise signals"
            themes={health.topPraises}
            emptyLabel="No praise themes in the stored feedback."
          />
        </div>

        <TrendDetail trend={health.trend} />
      </CardBody>
    </Card>
  );
}

function ObservedRow({ health }: { health: HealthCardData }) {
  const items: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: 'Rating',
      value: formatDecimal(health.observed.rating, 1),
      hint: health.observed.rating === null ? 'Not observed' : undefined,
    },
    {
      label: 'Reviews on listing',
      value: formatNumber(health.observed.reviewCount),
      hint: health.observed.reviewCount === null ? 'Not observed' : undefined,
    },
    {
      label: 'Unanswered',
      value:
        health.observed.unansweredCount === null
          ? '—'
          : `${formatNumber(health.observed.unansweredCount)}${
              health.observed.unansweredShare !== null
                ? ` (${pctText(health.observed.unansweredShare)})`
                : ''
            }`,
      hint: health.observed.unansweredCount === null ? 'Not observed' : undefined,
    },
    {
      label: 'Reviews / week',
      value: formatDecimal(health.observed.reviewsPerWeek, 1),
      hint: health.observed.reviewsPerWeek === null ? 'Not observed' : undefined,
    },
  ];

  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        Observed at last snapshot
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-ink-200 px-3.5 py-2.5"
          >
            <p className="text-[12px] text-ink-500">{item.label}</p>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-ink-900">
              {item.value}
            </p>
            {item.hint ? (
              <p className="text-[11px] text-ink-400">{item.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const SENTIMENT_SEGMENTS = [
  { key: 'POSITIVE', label: 'Positive', bar: 'bg-good-600' },
  { key: 'MIXED', label: 'Mixed', bar: 'bg-warn-600' },
  { key: 'NEUTRAL', label: 'Neutral', bar: 'bg-ink-300' },
  { key: 'NEGATIVE', label: 'Negative', bar: 'bg-bad-600' },
  { key: 'UNKNOWN', label: 'Unclassified', bar: 'bg-ink-200' },
] as const;

export function DistributionBar({ distribution }: { distribution: Distribution }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        Feedback distribution
      </p>

      {distribution.total === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 px-3.5 py-3 text-[13px] text-ink-500">
          No feedback yet. Paste reviews into a snapshot to build this.
        </p>
      ) : (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
            {SENTIMENT_SEGMENTS.map((segment) => {
              const share = distribution.shares?.[segment.key] ?? 0;
              if (share <= 0) return null;
              return (
                <div
                  key={segment.key}
                  className={segment.bar}
                  style={{ width: `${share * 100}%` }}
                  title={`${segment.label}: ${distribution.counts[segment.key]}`}
                />
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
            {SENTIMENT_SEGMENTS.map((segment) => {
              const count = distribution.counts[segment.key];
              if (count === 0) return null;
              return (
                <span
                  key={segment.key}
                  className="flex items-center gap-1.5 text-[12px] text-ink-600"
                >
                  <span
                    aria-hidden
                    className={clsx('h-2 w-2 rounded-full', segment.bar)}
                  />
                  {segment.label}: <strong className="tabular-nums">{count}</strong>
                  {distribution.reliable && distribution.shares ? (
                    <span className="text-ink-400">
                      ({pctText(distribution.shares[segment.key])})
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
            {distribution.note}
          </p>
        </>
      )}
    </div>
  );
}

function ThemeList({
  title,
  themes,
  emptyLabel,
}: {
  title: string;
  themes: ThemeCount[];
  emptyLabel: string;
}) {
  const shown = themes.slice(0, 4);
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        {title}
      </p>
      {shown.length === 0 ? (
        <p className="text-[13px] text-ink-500">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((theme) => (
            <li
              key={theme.key}
              className="flex items-center justify-between gap-3 text-[13px]"
            >
              <span className="min-w-0 truncate text-ink-800">{theme.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-ink-900">{theme.count}</span>
                {theme.qualifies ? null : (
                  <span className="text-[11px] text-ink-400">below floor</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function metricValue(metric: TrendMetric, value: number | null): string {
  if (value === null) return '—';
  return metric.key === 'rating' ? value.toFixed(1) : pctText(value);
}

function TrendDetail({ trend }: { trend: Trend }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        Trend
      </p>
      <p className="text-[13px] leading-relaxed text-ink-700">{trend.reason}</p>
      {trend.metrics.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {trend.metrics.map((metric) => (
            <li key={metric.key} className="text-[12px] text-ink-600">
              <span className="font-medium text-ink-800">{metric.label}:</span>{' '}
              {metricValue(metric, metric.previous)} →{' '}
              {metricValue(metric, metric.current)}
              {metric.contributes ? null : (
                <span className="text-ink-400"> · not counted</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PulsePanel({
  pulse,
  clientId,
}: {
  pulse: Pulse;
  clientId: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Pulse"
        description="The most recent snapshot against the one before it."
        action={
          <LinkButton href={`/clients/${clientId}/snapshots/new`} variant="primary">
            New snapshot
          </LinkButton>
        }
      />
      <CardBody className="space-y-4">
        {!pulse.available ? (
          <>
            <Notice tone="neutral">{pulse.reason}</Notice>
            {pulse.current ? (
              <div className="rounded-lg border border-ink-200 px-4 py-3">
                <p className="text-[12px] text-ink-500">Current period</p>
                <p className="mt-0.5 text-[14px] font-medium text-ink-900">
                  {pulse.current.label} · {formatDate(pulse.current.capturedAt)}
                </p>
                <p className="mt-1 text-[13px] text-ink-600">
                  {pulse.current.feedbackCount} feedback item
                  {pulse.current.feedbackCount === 1 ? '' : 's'} stored.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={TREND_TONE[pulse.direction]}>
                <span aria-hidden className="mr-1">
                  {TREND_GLYPH[pulse.direction]}
                </span>
                {pulse.directionLabel}
              </Badge>
              <span className="text-[13px] text-ink-600">
                {pulse.reason}
                {pulse.periodDays !== null
                  ? ` ${pulse.periodDays} days apart.`
                  : ''}
              </span>
            </div>

            {pulse.sampleWarning ? (
              <Notice tone="warn" title="Too small to call a trend">
                {pulse.sampleWarning}
              </Notice>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead className="border-b border-ink-200 text-[12px] text-ink-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Measure</th>
                    <th className="py-2 pr-4 text-right font-medium">
                      {pulse.previous?.label ?? 'Previous'}
                    </th>
                    <th className="py-2 pr-4 text-right font-medium">
                      {pulse.current?.label ?? 'Current'}
                    </th>
                    <th className="py-2 font-medium">Read</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-ink-100">
                    <td className="py-2 pr-4 text-ink-800">Feedback stored</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-900">
                      {pulse.previous?.feedbackCount ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-900">
                      {pulse.current?.feedbackCount ?? '—'}
                    </td>
                    <td className="py-2 text-ink-500">Raw counts</td>
                  </tr>
                  {pulse.metrics.map((metric) => (
                    <tr key={metric.key} className="border-b border-ink-100 last:border-0">
                      <td className="py-2 pr-4 text-ink-800">{metric.label}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink-900">
                        {metricValue(metric, metric.previous)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink-900">
                        {metricValue(metric, metric.current)}
                      </td>
                      <td className="py-2 text-ink-500">{metric.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                Notable changes
              </p>
              {pulse.notableChanges.length === 0 ? (
                <p className="text-[13px] text-ink-500">
                  No complaint theme moved between the two periods.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {pulse.notableChanges.slice(0, 6).map((change) => (
                    <li
                      key={change.key}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <span className="min-w-0 truncate text-ink-800">
                        {change.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-600">
                        {change.note}
                        <span
                          className={clsx(
                            'ml-2 font-medium',
                            change.delta > 0 ? 'text-bad-700' : 'text-good-700',
                          )}
                        >
                          {change.delta > 0 ? `+${change.delta}` : change.delta}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[12px] text-ink-500">
              Every figure here comes from snapshots you entered by hand.{' '}
              <Link
                href={`/clients/${clientId}/snapshots`}
                className="underline underline-offset-2"
              >
                See all snapshots
              </Link>
              .
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
