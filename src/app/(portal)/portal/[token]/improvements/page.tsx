import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolvePortalToken } from '@/lib/portal/access';
import { PortalImprovements } from '@/components/workspace/improvements';

export const dynamic = 'force-dynamic';

/**
 * The owner's secret-link portal (M12-M19), kept as a compatibility surface.
 *
 * The authenticated workspace at /workspace/[clientId] is the canonical home
 * for this content. This route renders the same component for a client
 * resolved from the link token instead of from a membership, so the two can
 * never drift apart, and it grants exactly what it always did: read access to
 * one business's own portal, no more.
 */
export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await resolvePortalToken(prisma, token);
  if (!client) notFound();

  return (
    <PortalImprovements
      clientId={client.id}
      basePath={`/portal/${token}`}
    />
  );
}
