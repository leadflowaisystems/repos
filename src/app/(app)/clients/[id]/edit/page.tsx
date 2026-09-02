import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { ClientForm } from '@/components/forms/client-form';
import {
  ArchiveClientPanel,
  PurgeClientPanel,
} from '@/components/client-lifecycle';
import { updateClientAction } from '@/lib/actions/clients';
import { prisma } from '@/lib/db';
import { packOptions } from '@/lib/packs';
import { toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

const s = (value: string | null | undefined) => value ?? '';
const n = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { snapshots: true, timeEntries: true } } },
  });
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <ClientForm
        action={updateClientAction}
        verticals={packOptions()}
        submitLabel="Save changes"
        snapshotCount={client._count.snapshots}
        values={{
          id: client.id,
          businessName: client.businessName,
          vertical: client.vertical,
          areaLabel: s(client.areaLabel),
          mapsUrl: s(client.mapsUrl),
          reviewLinkUrl: s(client.reviewLinkUrl),
          ownerName: s(client.ownerName),
          ownerPhone: s(client.ownerPhone),
          ownerEmail: s(client.ownerEmail),
          avgCustomerValueInr: n(client.avgCustomerValueInr),
          plan: client.plan,
          status: client.status,
          onboardingDate: toDateInputValue(client.onboardingDate),
          baselineRating: n(client.baselineRating),
          baselineReviewCount: n(client.baselineReviewCount),
          baselineReviewsPerWeek: n(client.baselineReviewsPerWeek),
          baselineObservedAt: toDateInputValue(client.baselineObservedAt),
          kitInstalledDate: toDateInputValue(client.kitInstalledDate),
          notes: s(client.notes),
        }}
      />

      <Card>
        <CardHeader
          title={client.archivedAt ? 'Restore this client' : 'Archive this client'}
          description="Archiving is reversible and keeps every snapshot, so month-on-month comparisons still work if you pick the work back up."
        />
        <CardBody>
          <ArchiveClientPanel
            clientId={client.id}
            businessName={client.businessName}
            archived={client.archivedAt !== null}
            snapshotCount={client._count.snapshots}
          />
        </CardBody>
      </Card>

      <Card className="border-bad-200">
        <CardHeader
          title="Delete permanently"
          description="Only for a delete-on-request from the business owner. This cannot be undone."
        />
        <CardBody>
          <PurgeClientPanel
            clientId={client.id}
            businessName={client.businessName}
            snapshotCount={client._count.snapshots}
          />
        </CardBody>
      </Card>
    </div>
  );
}
