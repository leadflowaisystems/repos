import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { PortalAnalysis } from '@/components/workspace/analysis';

export const dynamic = 'force-dynamic';

/**
 * The authenticated analysis page.
 *
 * The client id in the URL is a REQUEST. Membership is the answer, and a
 * business belonging to somebody else is a 404 rather than a refusal — "not
 * yours" and "not real" must look identical to anyone trying ids.
 */
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId);

  return (
    <PortalAnalysis
      clientId={clientId}
      basePath={`/workspace/${clientId}`}
      searchParams={searchParams}
    />
  );
}
