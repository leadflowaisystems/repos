import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { PortalMore } from '@/components/workspace/more';
import { SignOutButton } from '@/components/sign-out';
import { getTranslator } from '@/lib/i18n/request';
import { getPortalClient } from '@/lib/portal/service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * The authenticated "more" page.
 *
 * The client id in the URL is a REQUEST. Membership is the answer, and a
 * business belonging to somebody else is a 404 rather than a refusal — "not
 * yours" and "not real" must look identical to anyone trying ids.
 *
 * It guards itself like every other page here rather than trusting the layout,
 * because a layout is not a security boundary in the App Router. This page
 * only lists links, but the list itself says which parts of the product this
 * business has — so it is gated on the same terms as the pages it points at.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId);
  const [t, client] = await Promise.all([getTranslator(), getPortalClient(prisma, clientId)]);

  return (
    <PortalMore
      basePath={`/workspace/${clientId}`}
      business={client ? { name: client.businessName, verticalLabel: client.verticalLabel } : undefined}
      signOut={<SignOutButton variant="row" label={t('nav.signOut')} />}
    />
  );
}
