import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  Notice,
  Stat,
} from "@/components/ui";
import { HealthCardPanel, PulsePanel } from "@/components/health-card";
import { IntelligencePanel } from "@/components/intelligence-panel";
import { ResponsibilityPanel } from "@/components/responsibility-panel";
import { getResponsibility } from "@/lib/responsibility/service";
import { ImprovementActionsPanel } from "@/components/forms/improvement-actions";
import { listActionsWithProgress } from "@/lib/improve/service";
import { evidenceLine } from "@/lib/improve/model";
import { PortalLinkPanel } from "@/components/forms/portal-link";
import { portalPath } from "@/lib/portal/access";
import { ensurePortalToken, getClientSetup } from "@/lib/clients/service";
import { getPublicBaseUrl } from "@/lib/gateway/service";
import { requestOrigin } from "@/lib/gateway/origin";
import { resolvePublicBaseUrl } from "@/lib/config/public-url";
import { prisma } from "@/lib/db";
import { getClientHealth } from "@/lib/snapshots/service";
import { listClientMinutes } from "@/lib/minutes/service";
import { MinuteCard } from "@/components/minute-list";
import { OwnerCommsPanel } from "@/components/forms/owner-comms";
import { getOwnerComms } from "@/lib/comms/service";
import { COMMS_DESCRIPTIONS, type CommsType } from "@/lib/comms/compose";
import { LinkButton } from "@/components/ui";
import { getPackOrFallback } from "@/lib/packs";
import {
  formatDate,
  formatDecimal,
  formatMinutes,
  formatNumber,
  formatRupees,
} from "@/lib/format";
import { monthRange } from "@/lib/time";

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

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      voiceProfile: true,
      policy: true,
      kitConfig: true,
      competitors: { orderBy: { sortIndex: "asc" } },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 3,
        select: {
          id: true,
          label: true,
          capturedAt: true,
          rating: true,
          reviewCount: true,
          generatedAt: true,
          _count: { select: { reviews: true } },
        },
      },
    },
  });

  if (!client) notFound();

  const pack = getPackOrFallback(client.vertical);
  const { start, end } = monthRange(new Date());

  // The owner’s link is a secret, and it is issued the first time this page
  // is opened rather than at client creation — so an install that predates
  // M16 gets one without anybody having to run anything.
  const setup = await getClientSetup(prisma, client.id);
  const portalToken = await ensurePortalToken(prisma, client.id);
  // Only null when the client vanished between the read above and now.
  if (!portalToken) notFound();
  const portalPathname = portalPath(portalToken);
  // Sent to the owner, so it has to be a whole address, not a path. The same
  // one address the QR codes use — there is only ever one.
  const portalBase = resolvePublicBaseUrl({
    setting: await getPublicBaseUrl(prisma),
    requestOrigin: await requestOrigin(),
  });
  const portalUrl = portalBase.ok ? `${portalBase.url}${portalPathname}` : portalPathname;

  const [timeLogged, health, recentMinutes, minuteCount, comms, actions, responsibility] =
    await Promise.all([
      prisma.timeEntry.aggregate({
        where: { clientId: id, entryDate: { gte: start, lt: end } },
        _sum: { minutes: true },
        _count: true,
      }),
      getClientHealth(prisma, id, client.vertical),
      listClientMinutes(prisma, id, { limit: 3 }),
      prisma.minute.count({ where: { clientId: id } }),
      getOwnerComms(prisma, id, { language: query.commsLang ?? null }),
      listActionsWithProgress(prisma, id),
      getResponsibility(prisma, id),
    ]);

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
  const timeThisMonth = timeLogged._sum.minutes ?? 0;

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
        <ResponsibilityPanel
          r={responsibility.responsibility}
          clientId={client.id}
          portalToken={portalToken}
        />
      ) : null}

      <HealthCardPanel health={health.card} clientId={client.id} />
      <PulsePanel pulse={health.pulse} clientId={client.id} />

      {/* The listing's health, then what customers actually said about it.
          Everything below this is setup and admin. */}
      {comms.ok ? (
        <IntelligencePanel
          intel={comms.data.intelligence}
          actionedInsightIds={actionedInsightIds}
        />
      ) : null}

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
        <Stat
          label="Minutes recorded"
          value={formatNumber(minuteCount)}
          hint={
            timeThisMonth > 0
              ? `${formatMinutes(timeThisMonth)} logged this month`
              : "Conversations and decisions"
          }
        />
      </div>

      {remaining.length === 0 ? (
        <Notice tone="good">
          Setup is complete: the feedback page is live, the cards are on site and the owner has
          their link.
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title="The owner’s link"
          description="One private address that opens this business’s own view. It needs no password, so it should only ever go to the owner."
        />
        <CardBody>
          <PortalLinkPanel
            clientId={client.id}
            url={portalUrl}
            href={portalPathname}
            addressWarning={portalBase.ok ? null : portalBase.reason}
            justRegenerated={query.portalLink === "new"}
            sent={setup.ownerLinkSent}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6">
        {comms.ok ? (
          // Anchored so the command centre can send the operator straight here
          // rather than making them hunt down the page.
          <Card id="owner-update">
            <CardHeader
              title="Ready to send to the owner"
              description="Written from this client's own feedback. Copy it and send it however you normally do."
              action={
                <LinkButton href={portalPathname}>Open client view</LinkButton>
              }
            />
            <CardBody>
              <OwnerCommsPanel
                base={`/clients/${id}`}
                language={comms.data.language}
                replyHref={`/clients/${id}/feedback`}
                ownerContext={comms.data.ownerContext}
                messages={comms.data.messages.map((message) => ({
                  type: message.type,
                  title: message.title,
                  description: COMMS_DESCRIPTIONS[message.type as CommsType],
                  body: message.body,
                  emailSubject: message.channels.email.subject,
                  emailGreeting: message.channels.email.greeting,
                  emailSignOff: message.channels.email.signOff,
                  notes: message.notes,
                  problems: message.problems,
                  blocked: message.blocked,
                }))}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Recent memory"
            description="What happened with this client lately."
            action={
              <LinkButton href={`/clients/${id}/minutes`}>
                {minuteCount === 0 ? "Add a minute" : "All minutes"}
              </LinkButton>
            }
          />
          <CardBody>
            {recentMinutes.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-ink-500">
                No minutes yet. Record conversations, decisions and context here
                so next month you can see what you did, not just what changed.
              </p>
            ) : (
              <div className="space-y-2">
                {recentMinutes.map((minute) => (
                  <MinuteCard
                    key={minute.id}
                    minute={minute}
                    clientId={id}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

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
