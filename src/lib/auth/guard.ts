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
import { describeLifecycle } from '@/lib/lifecycle/service';

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

/**
 * A print route handler's own gate (M37).
 *
 * A LAYOUT DOES NOT WRAP A ROUTE HANDLER. `src/app/(print)/layout.tsx` calls
 * `requireOperator()` and its comment claims that makes the whole group
 * operator-only — which is true of the two print PAGES beside it and false of
 * the two `route.ts` handlers, because Next.js runs layouts for pages only. So
 * the handlers carry their own gate, and this is it.
 *
 * OPERATOR ONLY, deliberately. A personalised sheet carries the business's own
 * feedback token inside a QR, and handing that file over is Headway's to do,
 * not the business's to help itself to. Until M37 these two handlers gated on
 * `tenantGateFor(clientId, 'MEMBER')`, which a business owner passes — so any
 * owner who kept the URL could pull their own PDF straight from it.
 *
 * Answers a bare `false`, so the caller can return the same 404 a business
 * that does not exist gets. "Not yours" and "not real" must look identical.
 */
export async function printGate(
  clientId: string,
): Promise<{ ok: true; actor: Actor } | { ok: false }> {
  const id = typeof clientId === 'string' ? clientId.trim() : '';
  if (id.length === 0) return { ok: false };
  const actor = await currentActor(prisma);
  if (!actor || !actor.isPlatformAdmin) return { ok: false };
  return { ok: true, actor };
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
 * M28 - what a business whose trial has ended is refused.
 *
 * Server Actions are POSTs addressed by an internal action id, not by page
 * path, so locking the PAGES would leave every action reachable by anyone who
 * kept a tab open or replayed a request. The lock therefore lives here, in the
 * same function that already decides whether the client id is theirs, and it is
 * ON BY DEFAULT: an action that says nothing gets the lock, and only the two
 * that must keep working while shut opt out by name.
 *
 * The message is the owner's, not an error: they have not done anything wrong.
 * It does not name the trial, because the same lock covers a trial that has run
 * out AND a workspace Headway staff closed by hand — and the second of those
 * has trial dates that are still perfectly good. Account is the one page that
 * knows which it is, so the message sends them there rather than guessing.
 */
const LOCKED_MESSAGE =
  'Your Headway workspace is closed for now. Your feedback and your history are safe. Go to Account and ask to continue.';

async function isLockedOut(clientId: string, actor: Actor): Promise<boolean> {
  // Platform staff are never locked out of anything they can already reach.
  if (actor.isPlatformAdmin) return false;
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: {
      subscriptionStatus: true,
      trialStartsAt: true,
      trialEndsAt: true,
      serviceLockedAt: true,
      accessOverrideAt: true,
      serviceExemption: true,
    },
  });
  if (!client) return false;
  return describeLifecycle({ ...client, now: new Date() }).workspaceLocked;
}

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
  /**
   * `allowLocked` is for the handful of actions a business must still be able
   * to use once its workspace is shut — asking to carry on, and keeping the
   * number Headway will ring it on correct. Everything else is refused.
   */
  options: { allowLocked?: boolean } = {},
): Promise<TenantGate> {
  const raw = form.get(field);
  const clientId = typeof raw === 'string' ? raw.trim() : '';

  const actor = await currentActor(prisma);
  if (!actor) return { ok: false, state: failure(DENIED_MESSAGE) };
  if (clientId.length === 0) return { ok: false, state: failure(DENIED_MESSAGE) };

  const allowed = level === 'OWNER' ? canManage(actor, clientId) : canRead(actor, clientId);
  if (!allowed) return { ok: false, state: failure(DENIED_MESSAGE) };

  // Membership first, entitlement second. A stranger is refused identically
  // whether the business has lapsed or not, so the difference between the two
  // refusals cannot be used to ask which businesses are still paying.
  if (!options.allowLocked && (await isLockedOut(clientId, actor))) {
    return { ok: false, state: failure(LOCKED_MESSAGE) };
  }

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
