import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { EditMinuteForm } from '@/components/forms/minute-forms';
import { prisma } from '@/lib/db';
import { categoryOptions, getMinute } from '@/lib/minutes/service';
import { toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function EditMinutePage({
  params,
}: {
  params: Promise<{ id: string; minuteId: string }>;
}) {
  const { id, minuteId } = await params;

  // Scoped by client, so a minute belonging to another client 404s.
  const minute = await getMinute(prisma, id, minuteId);
  if (!minute) notFound();

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Minutes" title="Edit minute" />
      <Card>
        <CardHeader title={minute.title} description={minute.categoryLabel} />
        <CardBody>
          <EditMinuteForm
            clientId={id}
            minuteId={minute.id}
            categories={categoryOptions()}
            cancelHref={`/clients/${id}/minutes`}
            values={{
              title: minute.title,
              body: minute.body,
              category: minute.category,
              occurredAt: toDateInputValue(minute.occurredAt),
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
