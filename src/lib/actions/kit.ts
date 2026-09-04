'use server';

import { notFound } from 'next/navigation';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { saveKitConfig, saveReviewLink, setKitInstalled } from '@/lib/kit/service';
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
