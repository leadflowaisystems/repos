import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PeriodReportView } from '@/components/workspace/period-report';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { getMonthlyReview } from '@/lib/reporting/service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Monthly Review' };

/**
 * Monthly Review.
 *
 * A period-scoped read of the same intelligence the rest of the workspace
 * uses. It stores nothing and computes nothing new — it counts the feedback
 * that arrived inside a window and hands it to the M10 summariser.
 */
export default async function MONTHPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  const report = await getMonthlyReview(prisma, clientId);
  if (!report) notFound();

  return <PeriodReportView report={report} basePath={`/workspace/${clientId}`} />;
}
