import { Card, CardBody, CardHeader, LinkButton, Stat } from '@/components/ui';
import { IntelligencePanel } from '@/components/intelligence-panel';
import { OwnerCommsPanel } from '@/components/forms/owner-comms';
import { MinuteCard } from '@/components/minute-list';
import { COMMS_DESCRIPTIONS, type CommsType } from '@/lib/comms/compose';
import { getClientDetailSecondary } from '@/lib/clients/detail';
import { prisma } from '@/lib/db';
import { formatMinutes, formatNumber } from '@/lib/format';

/**
 * THE PARTS OF THE CLIENT PAGE WORTH SHOWING SECOND (M20).
 *
 * Each of these is a server component that fetches for itself and is rendered
 * inside a Suspense boundary, so the page can draw the business, its health and
 * the work in flight without waiting for a drafted owner update to be composed.
 *
 * They share one read: `getClientDetailSecondary` is memoised per request, so
 * four boundaries asking for the same bundle produce a single set of queries,
 * resolved once and handed to whichever of them finishes rendering first.
 *
 * They are ordinary authenticated reads through the same RLS-bound client as
 * everything else. Streaming changes when the operator sees a panel, never
 * which panels they are allowed to see.
 */

/** A placeholder with the shape of the thing it stands in for. */
export function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-ink-100 p-5" aria-busy="true">
      <div className="h-4 w-44 animate-pulse rounded bg-ink-100" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-3 w-full animate-pulse rounded bg-ink-100" />
        ))}
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-xl border border-ink-100 p-4" aria-busy="true">
      <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
      <div className="mt-3 h-6 w-16 animate-pulse rounded bg-ink-100" />
    </div>
  );
}

export async function IntelligenceSection({
  clientId,
  commsLanguage,
  actionedInsightIds,
}: {
  clientId: string;
  commsLanguage: string | null;
  actionedInsightIds: Set<string>;
}) {
  const { comms } = await getClientDetailSecondary(prisma, clientId, commsLanguage);
  if (!comms.ok) return null;
  return (
    <IntelligencePanel intel={comms.data.intelligence} actionedInsightIds={actionedInsightIds} />
  );
}

export async function MinutesRecordedStat({
  clientId,
  commsLanguage,
}: {
  clientId: string;
  commsLanguage: string | null;
}) {
  const { minuteCount, timeLogged } = await getClientDetailSecondary(
    prisma,
    clientId,
    commsLanguage,
  );
  const timeThisMonth = timeLogged._sum.minutes ?? 0;
  return (
    <Stat
      label="Minutes recorded"
      value={formatNumber(minuteCount)}
      hint={
        timeThisMonth > 0
          ? `${formatMinutes(timeThisMonth)} logged this month`
          : 'Conversations and decisions'
      }
    />
  );
}

export async function OwnerUpdateSection({
  clientId,
  commsLanguage,
}: {
  clientId: string;
  commsLanguage: string | null;
}) {
  const { comms } = await getClientDetailSecondary(prisma, clientId, commsLanguage);
  if (!comms.ok) return null;
  return (
    // Anchored so the command centre can send the operator straight here
    // rather than making them hunt down the page.
    <Card id="owner-update">
      <CardHeader
        title="Ready to send to the owner"
        description="Written from this client's own feedback. Copy it and send it however you normally do."
        action={<LinkButton href={`/workspace/${clientId}`}>Open client view</LinkButton>}
      />
      <CardBody>
        <OwnerCommsPanel
          base={`/clients/${clientId}`}
          language={comms.data.language}
          replyHref={`/clients/${clientId}/feedback`}
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
  );
}

export async function RecentMemorySection({
  clientId,
  commsLanguage,
}: {
  clientId: string;
  commsLanguage: string | null;
}) {
  const { recentMinutes, minuteCount } = await getClientDetailSecondary(
    prisma,
    clientId,
    commsLanguage,
  );
  return (
    <Card>
      <CardHeader
        title="Recent memory"
        description="What happened with this client lately."
        action={
          <LinkButton href={`/clients/${clientId}/minutes`}>
            {minuteCount === 0 ? 'Add a minute' : 'All minutes'}
          </LinkButton>
        }
      />
      <CardBody>
        {recentMinutes.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-500">
            No minutes yet. Record conversations, decisions and context here so next month you can
            see what you did, not just what changed.
          </p>
        ) : (
          <div className="space-y-2">
            {recentMinutes.map((minute) => (
              <MinuteCard key={minute.id} minute={minute} clientId={clientId} showActions={false} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
