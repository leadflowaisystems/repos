import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { currentActor, DENIED_MESSAGE } from '@/lib/auth/authorize';
import {
  canManage,
  canRead,
  roleFor,
  type Actor,
  type Role,
} from '@/lib/tenancy/service';
import { failure, type ActionState } from '@/lib/actions/shared';

/**
 * THE GATES (M16's operator guard, rebuilt on Supabase Auth in M20).
 *
 * Every server action begins with exactly one of these. They exist so that no
 * action has to decide for itself what "allowed" means — forty-three
 * hand-written rules is forty-three chances to forget one, and the one you
 * forget is the one that matters.
 *
 * The rule they all enforce:
 *
 *   A clientId that arrived in a FormData is a REQUEST, not a PERMISSION.
 *
 * So `tenantGate` never trusts the id it reads. It reads it, then goes and
 * asks the authenticated person's memberships whether that id is theirs, and
 * refuses identically whether the business belongs to someone else or does not
 * exist at all.
 */

// --- Whole-installation actions --------------------------------------------

/**
 * The operator console: RepOS staff only.
 *
 * A business owner is redirected rather than shown a refusal — they have no
 * business in the agency's console, and being a customer is not a step towards
 * being staff.
 */
export async function requireOperator(): Promise<Actor> {
  const actor = await currentActor(prisma);
  if (!actor) redirect('/login');
  if (!actor.isPlatformAdmin) redirect('/login');
  return actor;
}

/** The same check without the redirect, for pages that render a signed-out state. */
export async function isOperator(): Promise<boolean> {
  const actor = await currentActor(prisma);
  return actor !== null && actor.isPlatformAdmin;
}

/**
 * Admin-only actions, as a result rather than a redirect.
 *
 * Actions return an ActionState, so a redirect out of one loses whatever the
 * person had typed. This hands back something the form can render.
 */
export async function adminGate(): Promise<
  { ok: true; actor: Actor } | { ok: false; state: ActionState }
> {
  const actor = await currentActor(prisma);
  if (!actor) return { ok: false, state: failure(DENIED_MESSAGE) };
  if (!actor.isPlatformAdmin) return { ok: false, state: failure(DENIED_MESSAGE) };
  return { ok: true, actor };
}

// --- Tenant actions ---------------------------------------------------------

/**
 * MEMBER — anyone with an active membership. Day-to-day work.
 * OWNER  — reshaping the business: its details, its team, its settings, and
 *          anything destructive enough that staff should not do it alone.
 */
export type TenantLevel = 'MEMBER' | 'OWNER';

export type TenantGate =
  | { ok: true; actor: Actor; clientId: string; role: Role | null }
  | { ok: false; state: ActionState };

/**
 * Reads the client id off the form and then refuses to believe it.
 *
 * One refusal for every failure — not signed in, not yours, not real, not your
 * role. Distinguishing them would turn any form in RepOS into a way of asking
 * which businesses exist and who owns them.
 */
export async function tenantGate(
  form: FormData,
  level: TenantLevel,
  /** The field carrying the id. One older form calls it `id`. */
  field = 'clientId',
): Promise<TenantGate> {
  const raw = form.get(field);
  const clientId = typeof raw === 'string' ? raw.trim() : '';

  const actor = await currentActor(prisma);
  if (!actor) return { ok: false, state: failure(DENIED_MESSAGE) };
  if (clientId.length === 0) return { ok: false, state: failure(DENIED_MESSAGE) };

  const allowed = level === 'OWNER' ? canManage(actor, clientId) : canRead(actor, clientId);
  if (!allowed) return { ok: false, state: failure(DENIED_MESSAGE) };

  return { ok: true, actor, clientId, role: roleFor(actor, clientId) };
}

/** The same decision for a page, where the id comes from the route. */
export async function tenantGateFor(
  clientId: string,
  level: TenantLevel,
): Promise<{ ok: true; actor: Actor; role: Role | null } | { ok: false }> {
  const actor = await currentActor(prisma);
  if (!actor) return { ok: false };
  const id = typeof clientId === 'string' ? clientId.trim() : '';
  if (id.length === 0) return { ok: false };
  const allowed = level === 'OWNER' ? canManage(actor, id) : canRead(actor, id);
  if (!allowed) return { ok: false };
  return { ok: true, actor, role: roleFor(actor, id) };
}
