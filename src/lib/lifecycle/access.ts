import { notFound, redirect } from 'next/navigation';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor, type TenantLevel } from '@/lib/auth/guard';
import type { Actor, Role } from '@/lib/tenancy/service';
import { describeLifecycle, type Lifecycle } from './service';

/**
 * THE DOOR (M28).
 *
 * `describeLifecycle` decides what a business is entitled to; this reads the
 * row and enforces it. Everything server-side, and deliberately in one place:
 * a rule written out at seven call sites is a rule six of them will eventually
 * disagree with.
 *
 * WHY THE CHECK IS NOT IN THE LAYOUT. `src/app/(workspace)/workspace/[clientId]/layout.tsx`
 * says it itself, and it is right: a layout is not a security boundary in the
 * App Router, because a page can be requested in ways that do not re-run every
 * ancestor. So the lock lives where the membership check already lives — in a
 * function each page calls for itself — and `tests/m28.lifecycle-rls.test.ts`
 * asserts mechanically that every protected page calls it, the same way
 * `tests/compliance.test.ts` asserts every action opens with a gate.
 *
 * WHY IT IS NOT IN MIDDLEWARE EITHER. Middleware runs at the edge with no
 * database, and answers only "is there a session at all". It could not read a
 * trial date if it wanted to, and Server Actions are POSTs addressed by an
 * internal action id rather than by path, so a path rule would miss them
 * entirely.
 */

export type WorkspaceAccess =
  | { ok: false }
  | { ok: true; actor: Actor; role: Role | null; lifecycle: Lifecycle; locked: boolean };

/** The columns the lifecycle needs, and nothing else. */
const LIFECYCLE_SELECT = {
  subscriptionStatus: true,
  trialStartsAt: true,
  trialEndsAt: true,
  serviceLockedAt: true,
  accessOverrideAt: true,
  serviceExemption: true,
} as const;

/**
 * One business's lifecycle, read from its own row.
 *
 * `viewerIsPlatformAdmin` is passed in from a resolved server-side actor and
 * never from anything a browser sent. That is the whole of the founder
 * exemption: it is the same `isPlatformAdmin` column the operator console
 * already trusts, which `repos_app` holds no UPDATE privilege on, so it cannot
 * be forged from a form, a cookie or a header.
 */
export async function getLifecycle(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date; viewerIsPlatformAdmin?: boolean } = {},
): Promise<Lifecycle | null> {
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: LIFECYCLE_SELECT,
  });
  if (!client) return null;
  return describeLifecycle({
    ...client,
    viewerIsPlatformAdmin: options.viewerIsPlatformAdmin ?? false,
    now: options.now ?? new Date(),
  });
}

/**
 * Membership first, then entitlement. Both server-side, in that order.
 *
 * Order matters: someone who is not a member gets the same refusal whether the
 * business is locked or not, so a stranger cannot learn from the difference
 * which businesses have lapsed.
 */
export async function workspaceAccess(
  clientId: string,
  level: TenantLevel = 'MEMBER',
): Promise<WorkspaceAccess> {
  const gate = await tenantGateFor(clientId, level);
  if (!gate.ok) return { ok: false };

  const lifecycle = await getLifecycle(prisma, clientId, {
    viewerIsPlatformAdmin: gate.actor.isPlatformAdmin,
  });
  if (!lifecycle) return { ok: false };

  return { ok: true, actor: gate.actor, role: gate.role, lifecycle, locked: lifecycle.workspaceLocked };
}

/**
 * What every protected page calls instead of `tenantGateFor`.
 *
 * Fail-closed by construction: when the workspace is shut this REDIRECTS rather
 * than returning a flag a page could forget to read. `redirect()` throws, so
 * there is no path through this function that returns while locked, and no way
 * for a page to render its content anyway by ignoring the result.
 *
 * It sends them to Account, which stays open on purpose — that is where the
 * trial is explained and where continuing is asked for. A business that has
 * lapsed is not an intruder and is not shown a 404; it is shown the one page
 * that can do something about it.
 */
export async function requireOpenWorkspace(
  clientId: string,
  level: TenantLevel = 'MEMBER',
): Promise<{ actor: Actor; role: Role | null; lifecycle: Lifecycle }> {
  const access = await workspaceAccess(clientId, level);
  if (!access.ok) {
    // Signed out is a different answer from "not yours", and the login page can
    // bring them back to where they were.
    if (!(await currentActor(prisma))) redirect('/login');
    // Not a member, or no such business. The same 404 for both, exactly as
    // every workspace page already answers, so this cannot be used to ask
    // which businesses exist.
    notFound();
  }
  if (access.locked) redirect(`/workspace/${clientId}/account`);
  return { actor: access.actor, role: access.role, lifecycle: access.lifecycle };
}
