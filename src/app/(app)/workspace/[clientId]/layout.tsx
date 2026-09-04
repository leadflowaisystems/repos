import { notFound, redirect } from 'next/navigation';
import { WorkspaceHeader } from '@/components/portal/workspace';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { verticalLabel } from '@/lib/packs';

export const dynamic = 'force-dynamic';

/**
 * The authenticated workspace shell.
 *
 * The gate runs here as well as on every page beneath it, not instead of them.
 * A layout is not a security boundary in the App Router — a page can be
 * requested in ways that do not re-run every ancestor — so each page still
 * checks for itself and this only decides what chrome to draw.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { businessName: true, vertical: true },
  });
  if (!client) notFound();

  return (
    <>
      <WorkspaceHeader
        basePath={`/workspace/${clientId}`}
        businessName={client.businessName}
        verticalLabel={verticalLabel(client.vertical)}
        showExtras
      />
      {children}
    </>
  );
}
