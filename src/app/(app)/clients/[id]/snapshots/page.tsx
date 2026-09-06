import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Notice,
} from '@/components/ui';
import { prisma } from '@/lib/db';
import { listSnapshots } from '@/lib/snapshots/service';
import { formatDate, formatDecimal, formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SnapshotsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { id } = await params;
  const { deleted } = await searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!client) notFound();

  const snapshots = await listSnapshots(prisma, id);

  return (
    <div className="space-y-5">
      {deleted ? (
        <Notice tone="good">
          Snapshot deleted, along with the feedback stored inside it.
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title="Snapshots"
          description="Each snapshot is one point-in-time measurement: what you observed on the listing plus the feedback you pasted."
          action={
            <LinkButton href={`/clients/${id}/snapshots/new`} variant="primary">
              New snapshot
            </LinkButton>
          }
        />

        {snapshots.length === 0 ? (
          <EmptyState
            title="No snapshots yet"
            description="A check-in is a moment: it captures the feedback that has come in since the last one, so Headway has something to compare against later. Public listing figures are optional — leave them blank if the business has none. Headway never fetches anything."
            action={
              <LinkButton href={`/clients/${id}/snapshots/new`} variant="primary">
                Take the first snapshot
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="border-b border-ink-200 text-[12px] text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Snapshot</th>
                  <th className="px-5 py-3 text-right font-medium">Rating</th>
                  <th className="px-5 py-3 text-right font-medium">Reviews</th>
                  <th className="px-5 py-3 text-right font-medium">Feedback stored</th>
                  <th className="px-5 py-3 font-medium">Wording</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr
                    key={snapshot.id}
                    className="border-b border-ink-100 last:border-0 hover:bg-ink-50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/clients/${id}/snapshots/${snapshot.id}`}
                        className="font-medium text-ink-900 underline-offset-2 hover:underline"
                      >
                        {snapshot.label || formatDate(snapshot.capturedAt)}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                        {formatDate(snapshot.capturedAt)}
                        {snapshot.isBaseline ? <Badge>Baseline</Badge> : null}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {formatDecimal(snapshot.rating, 1)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {formatNumber(snapshot.reviewCount)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {formatNumber(snapshot.feedbackCount)}
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {snapshot.narrativeSource === 'TEMPLATE'
                        ? 'Headway wording'
                        : (snapshot.narrativeSource ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
