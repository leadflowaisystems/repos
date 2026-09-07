import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PeriodReportView } from '@/components/workspace/period-report';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { getWeeklyPulse } from '@/lib/reporting/service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Weekly Pulse' };

/**
 * Weekly Pulse.
 *
 * A period-scoped read of the same intelligence the rest of the workspace
 * uses. It stores nothing and computes nothing new — it counts the feedback
 * that arrived inside a window and hands it to the M10 summariser.
 */
export default async function WEEKPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId);

  const report = await getWeeklyPulse(prisma, clientId);
  if (!report) notFound();

  return <PeriodReportView report={report} basePath={`/workspace/${clientId}`} />;
}
