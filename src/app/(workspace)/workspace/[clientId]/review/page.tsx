import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PeriodReportView } from '@/components/workspace/period-report';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { getMonthlyReview } from '@/lib/reporting/service';

export const dynamic = 'force-dynamic';

// The tab title says what the page says. Monthly Review is the code name, and
// it stays in code: in this product a review is a public listing review, never
// a Headway report on the private feedback.
export const metadata: Metadata = { title: 'This month' };

/**
 * Monthly Review — "This month" to the owner.
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
  await requireOpenWorkspace(clientId);

  const report = await getMonthlyReview(prisma, clientId);
  if (!report) notFound();

  return <PeriodReportView report={report} basePath={`/workspace/${clientId}`} />;
}
