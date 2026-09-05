import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  IntelligenceSection,
  MinutesRecordedStat,
  OwnerUpdateSection,
  RecentMemorySection,
  SectionSkeleton,
  StatSkeleton,
} from "@/components/client-detail-secondary";
import { getClientDetailPrimary } from "@/lib/clients/detail";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  Notice,
  Stat,
} from "@/components/ui";
import { HealthCardPanel, PulsePanel } from "@/components/health-card";
import { ResponsibilityPanel } from "@/components/responsibility-panel";
import { ImprovementActionsPanel } from "@/components/forms/improvement-actions";
import { evidenceLine } from "@/lib/improve/model";
import { OwnerHandoverPanel } from "@/components/forms/owner-handover";
import { prisma } from "@/lib/db";
import { getPackOrFallback } from "@/lib/packs";
import {
  formatDate,
  formatDecimal,
  formatNumber,
  formatRupees,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  // One read for the first screen. Everything the operator looks at on arrival
  // - who this is, whether anything needs doing, health, work in flight -
  // resolved together instead of in three sequential stages. The rest of the
  // page fetches itself behind Suspense further down.
  const primary = await getClientDetailPrimary(prisma, id);
  if (!primary) notFound();
  const { client, setup, health, responsibility, actions } = primary;

  const pack = getPackOrFallback(client.vertical);
  const commsLanguage = query.commsLang ?? null;

  // The action panel renders strings, not Dates: every figure and date is
  // formatted once here so the client component adds no arithmetic of its own.
  const actionViews = actions.map(
    ({
      action,
      newFeedbackSinceDone,
      newFeedbackSinceMeasured,
      canMeasure,
    }) => ({
      id: action.id,
      status: action.status,
      statusNote: action.statusNote,
      title: action.title,
      description: action.description,
      themeKey: action.provenance.themeKey,
      themeLabel: action.provenance.themeLabel,
      sentiment: action.provenance.themeSentiment,
      insightHeadline: action.provenance.insightHeadline,
      insightDetail: action.provenance.insightDetail,
      recommendationText: action.provenance.recommendationText,
      reasons: action.provenance.signals.map((signal) => signal.reason),
      baselineLine: evidenceLine(action.baseline.count, action.baseline.total),
      baselineCapturedAt: formatDate(action.baseline.capturedAt),
      baselineSnapshotLabel: action.baseline.snapshotLabel,
      baselineEvidenceCount: action.baseline.itemIds.length,
      decidedAt: action.decidedAt ? formatDate(action.decidedAt) : null,
      doneAt: action.doneAt ? formatDate(action.doneAt) : null,
      measuredAt: action.measuredAt ? formatDate(action.measuredAt) : null,
      measurement: action.measurement,
      result: action.measurement?.result ?? null,
      learningNote: action.learningNote,
      minuteId: action.minuteId,
      newFeedbackSinceDone,
      newFeedbackSinceMeasured,
      canMeasure,
    }),
  );

  const actionedInsightIds = new Set(
    actions
      .filter(({ action }) => action.status !== "DECLINED")
      .map(({ action }) => action.provenance.insightId),
  );

  const latest = client.snapshots[0];

  // What actually has to be true before this business is being served (M17).
  //
  // The old list scored a client against a public listing — a baseline rating,
  // a competitor, a printable review kit — so a business with no Google
  // presence showed a permanent "setup still to do" box naming things it would
  // never do. These six are the things the product's own direction says matter,
  // and every one of them is reachable without an account anywhere.
  const checklist = [
    {
      label: "Feedback page switched on",
      done: setup.gatewayLive,
      href: `/clients/${id}/qr`,
    },
    {
      label: "Feedback cards printed and on site",
      done: client.kitInstalledDate !== null,
      href: `/clients/${id}/kit`,
    },
    {
      label: "Owner has been sent their link",
      done: client.portalLinkSentAt !== null,
      href: `/clients/${id}`,
    },
    {
      label: "What the owner told us is recorded",
      done: setup.contextCount > 0,
      href: `/clients/${id}/context`,
    },
    {
      label: "Voice profile filled in",
      done: Boolean(
        client.voiceProfile?.greeting || client.voiceProfile?.signOff,
      ),
      href: `/clients/${id}/profile`,
    },
    {
      label: "Business policies recorded",
      done: Boolean(
        client.policy?.refundPolicy ||
        client.policy?.appointmentPolicy ||
        client.policy?.neverPromise,
      ),
      href: `/clients/${id}/profile`,
    },
  ];

  const remaining = checklist.filter((c) => !c.done);

  return (
    <div className="space-y-6">
      {remaining.length > 0 ? (
        <Notice tone="warn" title="Setup still to do">
          <ul className="mt-1 space-y-1">
            {remaining.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="underline underline-offset-2">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {/* What RepOS is responsible for right now, before any measurement:
          the same object the owner's Home is built from. */}
      {responsibility ? (
        <ResponsibilityPanel r={responsibility.responsibility} clientId={client.id} />
      ) : null}

      <HealthCardPanel health={health.card} clientId={client.id} />
      <PulsePanel pulse={health.pulse} clientId={client.id} />

      {/* The listing's health, then what customers actually said about it.
          Everything below this is setup and admin. */}
      <Suspense fallback={<SectionSkeleton lines={4} />}>
        <IntelligenceSection
          clientId={id}
          commsLanguage={commsLanguage}
          actionedInsightIds={actionedInsightIds}
        />
      </Suspense>

      {/* The loop closes here: what we decided to change, and what the
          feedback did afterwards. */}
      <ImprovementActionsPanel clientId={id} actions={actionViews} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Baseline rating"
          value={formatDecimal(client.baselineRating, 1)}
          hint={
            client.baselineObservedAt
              ? `Observed ${formatDate(client.baselineObservedAt)}`
              : "Not observed"
          }
        />
        <Stat
          label="Baseline reviews"
          value={formatNumber(client.baselineReviewCount)}
          hint={`${formatDecimal(client.baselineReviewsPerWeek, 1)} / week`}
        />
        <Stat
          label="Snapshots saved"
          value={formatNumber(client.snapshots.length)}
          hint={latest ? `Latest ${formatDate(latest.capturedAt)}` : "None yet"}
        />
        <Suspense fallback={<StatSkeleton />}>
          <MinutesRecordedStat clientId={id} commsLanguage={commsLanguage} />
        </Suspense>
      </div>

      {remaining.length === 0 ? (
        <Notice tone="good">
          Setup is complete: the feedback page is live, the cards are on site and the owner has
          their link.
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title="The owner’s access"
          description="The owner signs in and opens their own workspace. Invite them from the Team page; this only records that you have done it."
        />
        <CardBody>
          <OwnerHandoverPanel clientId={client.id} sent={setup.ownerLinkSent} />
        </CardBody>
      </Card>

      <div className="grid gap-6">
        <Suspense fallback={<SectionSkeleton lines={5} />}>
          <OwnerUpdateSection clientId={id} commsLanguage={commsLanguage} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton lines={3} />}>
          <RecentMemorySection clientId={id} commsLanguage={commsLanguage} />
        </Suspense>

        <Card>
          <CardHeader title="Client details" />
          <CardBody>
            <dl>
              <DataRow label="Vertical playbook">{pack.label}</DataRow>
              <DataRow label="Headline KPI">{pack.headlineKpi.label}</DataRow>
              <DataRow label="Average customer value">
                {formatRupees(client.avgCustomerValueInr)}
              </DataRow>
              <DataRow label="Onboarded">
                {formatDate(client.onboardingDate)}
              </DataRow>
              <DataRow label="Kit installed">
                {formatDate(client.kitInstalledDate)}
              </DataRow>
              <DataRow label="Owner">
                {client.ownerName || "—"}
                {client.ownerPhone ? ` · ${client.ownerPhone}` : ""}
                {client.ownerEmail ? ` · ${client.ownerEmail}` : ""}
              </DataRow>
              <DataRow label="Maps listing">
                {client.mapsUrl ? (
                  <a
                    href={client.mapsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand-700 underline underline-offset-2"
                  >
                    Open manually
                  </a>
                ) : (
                  "—"
                )}
              </DataRow>
              <DataRow label="Review link">
                {client.reviewLinkUrl ? (
                  <a
                    href={client.reviewLinkUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand-700 underline underline-offset-2"
                  >
                    Open manually
                  </a>
                ) : (
                  "—"
                )}
              </DataRow>
              {client.notes ? (
                <DataRow label="Notes">
                  <span className="whitespace-pre-wrap">{client.notes}</span>
                </DataRow>
              ) : null}
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
