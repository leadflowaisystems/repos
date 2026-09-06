import { notFound } from 'next/navigation';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  Notice,
  PageHeader,
  Stat,
} from '@/components/ui';
import { DeleteSnapshotButton } from '@/components/delete-snapshot-button';
import { prisma } from '@/lib/db';
import { getSnapshotDetail } from '@/lib/snapshots/service';
import { getPackOrFallback } from '@/lib/packs';
import { formatDate, formatDateTime, formatDecimal, formatNumber } from '@/lib/format';
import type { Theme } from '@/lib/analysis/aggregate';

export const dynamic = 'force-dynamic';

const TIER_TONE = {
  INSUFFICIENT: 'bad',
  LIMITED: 'warn',
  STANDARD: 'good',
} as const;

/**
 * "Evidence tier: LIMITED" means nothing to a business owner. These are the
 * same three states in language they can act on.
 */
const TIER_PLAIN: Record<keyof typeof TIER_TONE, { value: string; hint: string }> = {
  INSUFFICIENT: {
    value: 'Not enough yet',
    hint: 'Too little feedback to call any pattern',
  },
  LIMITED: {
    value: 'Enough to act on',
    hint: 'Enough to act on, not enough to call a trend',
  },
  STANDARD: {
    value: 'Strong',
    hint: 'Enough to compare month on month',
  },
};

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string; snapshotId: string }>;
}) {
  const { id, snapshotId } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, businessName: true, areaLabel: true, vertical: true },
  });
  if (!client) notFound();

  const snapshot = await getSnapshotDetail(prisma, id, snapshotId);
  if (!snapshot) notFound();

  const pack = getPackOrFallback(client.vertical);
  const analysis = snapshot.analysis;
  const narrative = snapshot.narrative;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Snapshot"
        title={snapshot.label || formatDate(snapshot.capturedAt)}
        description={`${client.businessName}${client.areaLabel ? ` · ${client.areaLabel}` : ''} · observed ${formatDateTime(snapshot.capturedAt)}`}
        actions={
          <>
            <LinkButton href={`/clients/${id}/snapshots`}>All snapshots</LinkButton>
            <DeleteSnapshotButton
              clientId={id}
              snapshotId={snapshotId}
              feedbackCount={snapshot.feedbackCount}
            />
          </>
        }
      />

      {!analysis ? (
        <Notice tone="warn">
          This snapshot has no stored analysis. The observed values are still
          available above.
        </Notice>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Feedback analysed"
              value={formatNumber(analysis.totals.reviewsAnalysed)}
              hint={`${analysis.totals.withStars} with a star rating`}
            />
            <Stat
              label="Rating observed"
              value={formatDecimal(snapshot.rating, 1)}
              hint={analysis.responseGap.statement}
            />
            <Stat
              label="How solid is this"
              value={TIER_PLAIN[analysis.evidence.tier].value}
              hint={TIER_PLAIN[analysis.evidence.tier].hint}
            />
            <Stat
              label="Wording written by"
              value={snapshot.narrativeSource === 'TEMPLATE' ? 'Headway' : 'AI draft'}
              hint={
                snapshot.narrativeSource === 'TEMPLATE'
                  ? 'Every figure computed in code'
                  : `${snapshot.aiModel ?? 'AI'} · figures still computed in code`
              }
            />
          </div>

          <Notice tone={TIER_TONE[analysis.evidence.tier]}>
            {analysis.evidence.statement}
          </Notice>

          {/* --- Page 1: Health Card ------------------------------------ */}
          <Card>
            <CardHeader
              title="Page 1 — Health Card"
              description="What the listing looked like when you checked it."
            />
            <CardBody className="space-y-5">
              <p className="text-[13px] leading-relaxed text-ink-700">
                {narrative?.healthHeadline}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Section title="Recent activity">
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    {analysis.activity.statement}
                  </p>
                </Section>
                <Section title="Response gap">
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    {analysis.responseGap.statement}
                  </p>
                </Section>
              </div>

              <Section title="Visible profile gaps">
                {analysis.profileGaps.length === 0 ? (
                  <p className="text-[13px] text-ink-500">
                    No profile gaps were recorded for this snapshot.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {analysis.profileGaps.map((gap) => (
                      <li key={gap.key} className="flex items-center gap-2 text-[13px] text-ink-700">
                        <span>· {gap.label}</span>
                        {gap.source === 'DERIVED' ? (
                          <span className="text-[11px] text-ink-400">derived</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Competitor comparison">
                <p className="text-[13px] leading-relaxed text-ink-700">
                  {analysis.competitorSummary}
                </p>
                {analysis.competitors.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {analysis.competitors.map((c) => (
                      <li key={c.name} className="text-[13px] text-ink-600">
                        {c.name}: {formatDecimal(c.rating, 1)}
                        {c.reviewCount !== null ? ` · ${formatNumber(c.reviewCount)} reviews` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Section>

              <Section title="Clearest opportunity">
                <p className="text-[13px] leading-relaxed text-ink-700">
                  {narrative?.opportunityNote}
                </p>
              </Section>
            </CardBody>
          </Card>

          {/* --- Page 2: Customer Pulse --------------------------------- */}
          <Card>
            <CardHeader
              title="Page 2 — Customer Pulse"
              description="What customers actually said, counted in application code."
            />
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Section title="What customers praise">
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    {narrative?.praiseSummary}
                  </p>
                  <ThemeRows themes={analysis.praises} total={analysis.totals.reviewsAnalysed} />
                </Section>
                <Section title="Recurring complaints">
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    {narrative?.complaintSummary}
                  </p>
                  <ThemeRows themes={analysis.issues} total={analysis.totals.reviewsAnalysed} />
                </Section>
              </div>

              <Section title="Emerging / watch item">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      analysis.emerging.kind === 'EMERGING'
                        ? 'bad'
                        : analysis.emerging.kind === 'WATCH'
                          ? 'warn'
                          : 'neutral'
                    }
                  >
                    {analysis.emerging.kind === 'NONE' ? 'None called' : analysis.emerging.kind}
                  </Badge>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
                  {narrative?.emergingSummary}
                </p>
              </Section>

              <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-4">
                <p className="text-[12px] font-semibold tracking-wide text-brand-700 uppercase">
                  The one recommended action
                </p>
                <p className="mt-1.5 text-[15px] font-semibold text-ink-900">
                  {analysis.recommendation.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-800">
                  {narrative?.actionRationale}
                </p>
                <p className="mt-2 text-[12px] text-ink-600">
                  Confidence: {analysis.recommendation.confidence.toLowerCase()} ·
                  source: {analysis.recommendation.source === 'PULSE' ? 'customer feedback' : 'observed listing data'}
                </p>
                {analysis.recommendation.evidence.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {analysis.recommendation.evidence.map((line) => (
                      <li key={line} className="text-[12px] text-ink-600">
                        · {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <Section title="What gets checked next month">
                <ul className="space-y-1">
                  {analysis.nextMonthChecks.map((check) => (
                    <li key={check} className="text-[13px] text-ink-700">
                      · {check}
                    </li>
                  ))}
                </ul>
              </Section>

              {analysis.dataGaps.length > 0 ? (
                <Section title="What was not observed">
                  <ul className="space-y-1">
                    {analysis.dataGaps.map((gap) => (
                      <li key={gap} className="text-[12px] text-ink-500">
                        · {gap}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Snapshot record" description={`Vertical playbook: ${pack.label}`} />
            <CardBody className="space-y-2 text-[13px] text-ink-600">
              <p>
                {snapshot.feedbackCount} feedback item
                {snapshot.feedbackCount === 1 ? '' : 's'} stored anonymously.
                {snapshot.redactedCount > 0
                  ? ` ${snapshot.redactedCount} had identifying details stripped at ingest.`
                  : ''}
              </p>
              {snapshot.observationNotes ? (
                <p className="whitespace-pre-wrap">
                  <span className="font-medium text-ink-800">Notes:</span>{' '}
                  {snapshot.observationNotes}
                </p>
              ) : null}
              <p className="text-[12px] text-ink-500">
                Generated {snapshot.generatedAt ? formatDateTime(snapshot.generatedAt) : '—'}.
                All counts, thresholds and comparisons were computed by application code.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function ThemeRows({ themes, total }: { themes: Theme[]; total: number }) {
  const shown = themes.slice(0, 5);
  if (shown.length === 0) {
    return <p className="mt-2 text-[13px] text-ink-500">Nothing tagged.</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {shown.map((theme) => (
        <li key={theme.key} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="min-w-0 truncate text-ink-800">{theme.label}</span>
          <span className="shrink-0 tabular-nums text-ink-600">
            {theme.count} of {total}
            {theme.qualifies ? null : (
              <span className="ml-2 text-[11px] text-ink-400">below floor</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
