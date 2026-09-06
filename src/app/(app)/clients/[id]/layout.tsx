import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, LinkButton, Notice, PageHeader } from '@/components/ui';
import { ClientTabs } from '@/components/client-tabs';
import { prisma } from '@/lib/db';
import { verticalLabel } from '@/lib/packs';
import { titleCase } from '@/lib/format';
import { triggerFeedbackProcessing } from '@/lib/pipeline/trigger';

export const dynamic = 'force-dynamic';
// Long enough for the post-response reading of a batch and one provider round trip.
export const maxDuration = 60;

const STATUS_TONE: Record<string, 'good' | 'brand' | 'warn' | 'neutral' | 'bad'> = {
  ACTIVE: 'good',
  ONBOARDING: 'brand',
  PROSPECT: 'neutral',
  PAUSED: 'warn',
  CHURNED: 'bad',
};

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      vertical: true,
      areaLabel: true,
      status: true,
      plan: true,
      archivedAt: true,
    },
  });

  if (!client) notFound();

  // The console catches up too: a row that could only be read from a button
  // was the reason two real reviews sat unread. Runs after the response.
  triggerFeedbackProcessing(client.id, 'VISIT');

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <span>{verticalLabel(client.vertical)}</span>
            {client.areaLabel ? <span>· {client.areaLabel}</span> : null}
          </span>
        }
        title={client.businessName}
        actions={
          <>
            {client.archivedAt ? <Badge tone="warn">Archived</Badge> : null}
            <Badge tone={STATUS_TONE[client.status] ?? 'neutral'}>
              {titleCase(client.status)}
            </Badge>
            <Badge>{titleCase(client.plan)}</Badge>
            <LinkButton href={`/clients/${client.id}/edit`}>Edit details</LinkButton>
          </>
        }
      />
      {client.archivedAt ? (
        <div className="mb-5">
          <Notice tone="warn">
            This client is archived and hidden from the working list. Its history
            is intact — restore it from{' '}
            <Link
              href={`/clients/${client.id}/edit`}
              className="underline underline-offset-2"
            >
              Edit details
            </Link>
            .
          </Notice>
        </div>
      ) : null}
      <ClientTabs clientId={client.id} />
      {children}
    </>
  );
}
