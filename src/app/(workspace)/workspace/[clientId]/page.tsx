import { notFound, redirect } from 'next/navigation';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { PortalHome } from '@/components/workspace/home';
import { sinceLastVisit } from '@/lib/retention/service';

export const dynamic = 'force-dynamic';

/**
 * The authenticated home page.
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
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) {
    // Nobody signed in at all goes to sign in; anyone else gets a 404.
    const { currentActor } = await import('@/lib/auth/authorize');
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  // Read BEFORE the visit is stamped, which the layout does after the response.
  // The other order would report an empty week to everybody, forever.
  const since = await sinceLastVisit(prisma, clientId, gate.actor.userId);

  return (
    <PortalHome
      clientId={clientId}
      basePath={`/workspace/${clientId}`}
      since={since}
    />
  );
}
