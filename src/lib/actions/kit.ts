'use server';

import { notFound } from 'next/navigation';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { saveKitConfig, saveReviewLink, setKitInstalled } from '@/lib/kit/service';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { placeKitOrder } from '@/lib/kit/orders';
import { getTranslator } from '@/lib/i18n/request';
import { bool, failure, str, success, type ActionState } from './shared';
import { tenantGate } from '@/lib/auth/guard';

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
