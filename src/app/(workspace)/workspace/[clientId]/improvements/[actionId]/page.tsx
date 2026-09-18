import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { getEvidenceIndex, getImprovementsView } from '@/lib/portal/service';
import { getTranslator } from '@/lib/i18n/request';
import { ImprovementDetail } from '@/components/workspace/improvements';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Improvements' };

/** Ids are cuids. Anything else is not a change and is never looked up. */
const ACTION_ID = /^[a-z0-9]{10,64}$/i;

/**
 * One change, on its own page (mobile back-navigation pass).
 *
 * The client id is a request, answered by membership; the change is then
 * found in THAT business's own improvement view, so an id belonging to
 * another business is not found — the same 404 as one that never existed.
 * The view is the one the action centre builds, so this page and the list
 * cannot describe the same change two ways.
 */
export default async function ImprovementDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; actionId: string }>;
}) {
  const { clientId, actionId } = await params;
  await requireOpenWorkspace(clientId);
  if (!ACTION_ID.test(actionId)) notFound();
  const t = await getTranslator();

  const [view, evidence] = await Promise.all([
    getImprovementsView(prisma, clientId, { t }),
    getEvidenceIndex(prisma, clientId),
  ]);
  if (!view) notFound();
  const action = [...view.open, ...view.checked, ...view.notPursued].find((a) => a.id === actionId);
  if (!action) notFound();

  return (
    <ImprovementDetail
      action={action}
      evidence={evidence}
      clientId={clientId}
      basePath={`/workspace/${clientId}`}
    />
  );
}
