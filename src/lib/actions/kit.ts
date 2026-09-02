'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { saveKitConfig, saveReviewLink, setKitInstalled } from '@/lib/kit/service';
import { bool, failure, str, success, type ActionState } from './shared';

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
  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

  const result = await saveReviewLink(prisma, clientId, str(form, 'qrTargetUrl'));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateKit(clientId);
  return success('Link saved. The kit is ready to print.');
}

/** Optional overrides, hidden behind progressive disclosure in the UI. */
export async function saveKitConfigAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

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
  return success(
    result.data.ready
      ? 'Saved. The kit is ready to print.'
      : 'Saved. Add the public review link to finish the kit.',
  );
}

export async function setKitInstalledAction(form: FormData): Promise<void> {
  const clientId = str(form, 'clientId');
  if (!clientId) return;

  await setKitInstalled(prisma, clientId, bool(form, 'installed'));
  revalidateKit(clientId);
}
