import type { PrismaClient } from '@prisma/client';
import { getPackOrFallback } from '@/lib/packs';
import { isPublicToken } from '@/lib/tokens';

/**
 * WHO MAY OPEN A CLIENT'S WORKSPACE (M16).
 *
 * Until M16 the owner's portal was addressed by the raw database id. That id
 * is not a secret: it appears on every operator screen, it is a sortable
 * timestamp rather than random, and anyone holding one could read that
 * business's entire customer analysis.
 *
 * The address is now a 110-bit token — the same shape the customer feedback
 * page has always used. It is checked for shape before any query runs, it can
 * be regenerated to revoke a link that was shared too widely, and an unknown
 * token, a wrong token and an archived client are all the same neutral
 * nothing, so a caller learns only that the link does not work.
 *
 * This module only ever READS. Issuing and revoking a link are things the
 * operator does to a client row, so they live with the rest of the client
 * operations in `@/lib/clients/service` — nothing on the owner’s own path
 * is able to write.
 */

export type PortalClient = {
  id: string;
  businessName: string;
  vertical: string;
  verticalLabel: string;
  portalToken: string;
};

/**
 * The client this token belongs to, or null.
 *
 * Null for a malformed token, an unknown token and an archived client alike.
 * An archived business is one RepOS no longer serves, and its link going quiet
 * is the safe behaviour — the operator restores the client if access is needed
 * again.
 */
export async function resolvePortalToken(
  db: PrismaClient,
  token: unknown,
): Promise<PortalClient | null> {
  if (!isPublicToken(token)) return null;

  const client = await db.client.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      businessName: true,
      vertical: true,
      archivedAt: true,
      portalToken: true,
    },
  });
  if (!client || client.archivedAt !== null || !client.portalToken) return null;

  return {
    id: client.id,
    businessName: client.businessName,
    vertical: client.vertical,
    verticalLabel: getPackOrFallback(client.vertical).label,
    portalToken: client.portalToken,
  };
}

/** The owner-facing path for a token. */
export function portalPath(token: string): string {
  return `/portal/${token}`;
}
