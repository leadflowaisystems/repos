import { notFound } from 'next/navigation';
import { Card, CardHeader, EmptyState, Notice } from '@/components/ui';
import { AddMinutePanel } from '@/components/forms/minute-forms';
import { MinuteList } from '@/components/minute-list';
import { prisma } from '@/lib/db';
import { categoryOptions, listClientMinutes } from '@/lib/minutes/service';
import { toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * One client's memory.
 *
 * Universal: identical for a clinic, a salon and a restaurant. Nothing here
 * touches the vertical pack.
 */
export default async function ClientMinutesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const { id } = await params;
  const { saved, deleted } = await searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!client) notFound();

  const minutes = await listClientMinutes(prisma, id);
  const today = toDateInputValue(new Date());

  return (
    <div className="space-y-5">
      {saved ? <Notice tone="good">Minute updated.</Notice> : null}
      {deleted ? <Notice tone="good">Minute deleted.</Notice> : null}

      {minutes.length === 0 ? (
        <Card>
          <EmptyState
            title="No minutes yet"
            description="Record important conversations, decisions and context here. Headway will use this memory later — so next month you can see not just what changed, but what you did about it."
            action={
              <AddMinutePanel
                clientId={id}
                defaultDate={today}
                categories={categoryOptions()}
              />
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Memory"
              description={`${minutes.length} recorded ${minutes.length === 1 ? 'entry' : 'entries'}. Newest first. Decisions and follow-ups are highlighted.`}
              action={
                <AddMinutePanel
                  clientId={id}
                  defaultDate={today}
                  categories={categoryOptions()}
                />
              }
            />
          </Card>

          <MinuteList minutes={minutes} clientId={id} />
        </>
      )}
    </div>
  );
}
