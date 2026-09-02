import { notFound } from 'next/navigation';
import { LinkButton, PageHeader } from '@/components/ui';
import { SnapshotForm } from '@/components/forms/snapshot-form';
import { prisma } from '@/lib/db';
import { aiStatus } from '@/lib/ai';
import { getPackOrFallback } from '@/lib/packs';
import { toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NewSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      vertical: true,
      competitors: {
        orderBy: { sortIndex: 'asc' },
        take: 3,
        select: { name: true, rating: true, reviewCount: true },
      },
    },
  });
  if (!client) notFound();

  const pack = getPackOrFallback(client.vertical);

  const competitorSummary =
    client.competitors.length === 0
      ? 'No competitors are set up for this client, so the snapshot will record none. Add them on the Knowledge profile tab if you want a comparison.'
      : `${client.competitors
          .map(
            (c) =>
              `${c.name} (${c.rating === null ? 'no rating' : c.rating}${
                c.reviewCount === null ? '' : `, ${c.reviewCount} reviews`
              })`,
          )
          .join('; ')}. These values are copied into the snapshot as they stand right now.`;

  const ai = aiStatus();

  return (
    <>
      <PageHeader
        eyebrow="New snapshot"
        title={`Snapshot for ${client.businessName}`}
        description="One snapshot is one measurement. It preserves exactly what you observed and what customers said, so later months have something honest to compare against."
        actions={
          <LinkButton href={`/clients/${id}/snapshots`}>Cancel</LinkButton>
        }
      />
      <SnapshotForm
        clientId={client.id}
        defaultDate={toDateInputValue(new Date())}
        competitorSummary={competitorSummary}
        profileGapChecks={pack.profileGapChecks}
        aiNote={ai.note}
      />
    </>
  );
}
