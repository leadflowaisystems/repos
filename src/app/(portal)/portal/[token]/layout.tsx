import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolvePortalToken } from '@/lib/portal/access';
import { WorkspaceHeader } from '@/components/portal/workspace';

/** The browser tab is named after the business, then the section. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const client = await resolvePortalToken(prisma, token);
  if (!client) return { title: 'Not found' };
  return {
    title: { default: client.businessName, template: `%s · ${client.businessName}` },
    robots: { index: false, follow: false },
  };
}

/**
 * One business, five pages, one header.
 *
 * The secret in the URL is the authorization (M16). Resolving it here — not in
 * each page — means every page in the workspace is bounded by the same lookup,
 * and an unknown token, a wrong token and an archived business all 404 the
 * same way before any page code runs.
 */
export default async function PortalClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await resolvePortalToken(prisma, token);
  if (!client) notFound();

  return (
    <>
      <WorkspaceHeader
        basePath={`/portal/${token}`}
        businessName={client.businessName}
        verticalLabel={client.verticalLabel}
      />
      {children}
    </>
  );
}
