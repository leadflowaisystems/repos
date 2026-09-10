'use server';

import { notFound, redirect } from 'next/navigation';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { saveKitConfig, saveReviewLink, setKitInstalled } from '@/lib/kit/service';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import {
  acknowledgeKitOrderReceived,
  deleteKitOrder,
  markKitOrderDelivered,
  placeKitOrder,
} from '@/lib/kit/orders';
import { getTranslator } from '@/lib/i18n/request';
import { bool, failure, str, success, type ActionState } from './shared';
import { adminGate, tenantGate } from '@/lib/auth/guard';

/**
 * Feedback kit actions.
 *
 * All three are deliberately small. The whole point of M3 is that a new client
 * is one field away from a printable kit, so there is no setup wizard here.
 */

function revalidateKit(clientId: string) {
  revalidatePath('/');
  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/kit`);
  revalidatePath(`/print/kit/${clientId}`);
}

/** The one-field fast path shown when no destination has been set yet. */
export async function saveReviewLinkAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await saveReviewLink(prisma, clientId, str(form, 'qrTargetUrl'));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateKit(clientId);
  return success(
    str(form, 'qrTargetUrl')
      ? 'Saved. Customers are offered this after they send their feedback.'
      : 'Removed. Customers finish at the thank-you page.',
  );
}

/** Optional overrides, hidden behind progressive disclosure in the UI. */
export async function saveKitConfigAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await saveKitConfig(prisma, clientId, {
    qrTargetUrl: str(form, 'qrTargetUrl'),
    displayName: str(form, 'displayName'),
    headline: str(form, 'headline'),
    subhead: str(form, 'subhead'),
    footerNote: str(form, 'footerNote'),
    brandPrimary: str(form, 'brandPrimary'),
    brandSecondary: str(form, 'brandSecondary'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateKit(clientId);
  return success('Saved. The cards are ready to print.');
}

export async function setKitInstalledAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  if (!clientId) return;

  await setKitInstalled(prisma, clientId, bool(form, 'installed'));
  revalidateKit(clientId);
}

/**
 * Ordering the printed kit (M33).
 *
 * OWNER, like every other commercial action: this is the business agreeing to
 * pay for something, and staff do not commit a business to a cost.
 *
 * WHAT IS READ FROM THE FORM, AND WHAT IS NOT. Quantities are read — one per
 * product key, and every one of them treated as hostile. Prices are not. The
 * total is not. The client id is not: `tenantGate` established that before this
 * line, from the caller's own memberships, and the id the form happens to carry
 * is only ever the thing being CHECKED, never the thing being trusted.
 *
 * So a browser that posts a price, a total, a different product or somebody
 * else's id changes nothing about what is recorded.
 */
export async function placeKitOrderAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  // Only the keys the catalogue knows. Anything else the form invented is not
  // looked at, so it cannot become a line and it cannot become a price.
  const quantities: Record<string, unknown> = {};
  for (const product of KIT_PRODUCTS) {
    quantities[product.key] = str(form, `qty:${product.key}`);
  }

  const t = await getTranslator();
  const result = await placeKitOrder(prisma, clientId, { quantities }, { t });
  if (!result.ok) return failure(result.message, result.errors);

  revalidatePath(`/workspace/${clientId}/kit`);
  revalidatePath(`/workspace/${clientId}/orders`);

  return {
    ok: true,
    message: t('kit.order.placed.body'),
    errors: {},
    data: { orderNumber: String(result.data.number) },
  };
}

/**
 * An operator marks an order as sent (M36).
 *
 * ADMIN. Delivery is a claim only Headway can make about its own dispatch, so
 * it opens with `adminGate()` and nothing about a client is read before it.
 *
 * THE BROWSER SUPPLIES ONE THING: which order. Not the timestamp, not who did
 * it, not the status. The clock is the server's and the operator is the
 * session's, so a posted `deliveredAt`, `deliveredBy` or `status` is not read
 * and cannot be read — the service takes no such parameter.
 */
export async function markKitOrderDeliveredAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const orderId = str(form, 'orderId');
  if (!orderId) return failure('Missing order id.');

  const result = await markKitOrderDelivered(prisma, orderId, gate.actor.userId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateOrder(result.data.clientId, orderId);
  return success('Marked delivered.');
}

/**
 * A business confirms the kit arrived (M36).
 *
 * OWNER, and gated against the business's OWN id: `tenantGate` establishes
 * which client this caller may act for, and that id is passed into the service
 * as part of the WHERE — so acknowledging another business's order id updates
 * nothing.
 *
 * A business can say one thing here and one thing only: that it arrived. It
 * cannot set the date, cannot name the person, cannot touch the status, the
 * prices, the lines or the total, and cannot claim delivery on Headway's
 * behalf. None of those are parameters of anything this calls.
 */
export async function acknowledgeKitOrderReceivedAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const orderId = str(form, 'orderId');
  const t = await getTranslator();
  if (!orderId) return failure(t('kit.receipt.error'));

  const result = await acknowledgeKitOrderReceived(prisma, clientId, orderId, gate.actor.userId);
  if (!result.ok) return failure(t('kit.receipt.error'));

  revalidateOrder(clientId, orderId);
  return { ok: true, message: t('kit.receipt.done'), errors: {} };
}

/**
 * An operator deletes an order (M36).
 *
 * ADMIN, and only ADMIN. A business cannot delete its own order and cannot
 * delete anybody else's: this action refuses everyone who is not platform
 * staff before it reads a single field, and there is no client-facing route
 * that reaches it.
 *
 * The confirmation the operator clicks through is in the component. This is
 * the server half, and it re-establishes the permission rather than trusting
 * that the confirmation happened.
 */
export async function deleteKitOrderAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const orderId = str(form, 'orderId');
  if (!orderId) return failure('Missing order id.');

  const result = await deleteKitOrder(prisma, orderId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateOrder(result.data.clientId, orderId);
  redirect('/orders?deleted=1');
}

/** Every screen an order appears on, after it changes. */
function revalidateOrder(clientId: string, orderId: string) {
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/workspace/${clientId}/orders`);
  revalidatePath(`/workspace/${clientId}/kit`);
}
