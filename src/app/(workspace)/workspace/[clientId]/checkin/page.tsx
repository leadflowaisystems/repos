import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { PortalCheckin } from '@/components/workspace/checkin';

export const dynamic = 'force-dynamic';

/**
 * The authenticated checkin page.
 *
 * The client id in the URL is a REQUEST. Membership is the answer, and a
 * business belonging to somebody else is a 404 rather than a refusal — "not
 * yours" and "not real" must look identical to anyone trying ids.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId);

  return (
    <PortalCheckin
      clientId={clientId}
      basePath={`/workspace/${clientId}`}
    />
  );
}
