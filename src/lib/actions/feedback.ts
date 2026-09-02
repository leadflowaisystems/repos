'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import {
  createFeedbackItem,
  deleteFeedbackItem,
  importFeedbackBatch,
} from '@/lib/feedback/service';
import {
  failure,
  optDate,
  optInt,
  str,
  text,
  type ActionState,
} from './shared';

/**
 * Feedback intake actions.
 *
 * Manual only. Nothing here fetches, imports from a platform, or posts
 * anywhere — every item arrives because the operator pasted or typed it.
 */

function revalidateFeedback(clientId: string) {
  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/feedback`);
}

/** Paste a batch. Redirects back with the result so there is no extra screen. */
export async function importFeedbackAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

  const result = await importFeedbackBatch(prisma, clientId, {
    raw: text(form, 'raw'),
    source: str(form, 'source') || 'PUBLIC_REVIEW',
    // Anchors relative dates like "2 weeks ago" so parsing is reproducible.
    referenceDate: optDate(form, 'referenceDate') ?? new Date(),
  });
  if (!result.ok) return failure(result.message, result.errors);

  const { imported, skippedDuplicates, redacted } = result.data;
  revalidateFeedback(clientId);
  redirect(
    `/clients/${clientId}/feedback?imported=${imported}&skipped=${skippedDuplicates}&redacted=${redacted}`,
  );
}

/** Add one item by hand. */
export async function addFeedbackItemAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

  const result = await createFeedbackItem(prisma, clientId, {
    text: text(form, 'text'),
    stars: optInt(form, 'stars'),
    reviewDate: optDate(form, 'reviewDate'),
    source: str(form, 'source') || 'MANUAL_ENTRY',
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateFeedback(clientId);
  redirect(`/clients/${clientId}/feedback?imported=1&skipped=0&redacted=${result.data.redacted ? 1 : 0}`);
}

export async function deleteFeedbackItemAction(form: FormData): Promise<void> {
  const clientId = str(form, 'clientId');
  const itemId = str(form, 'itemId');
  if (!clientId || !itemId) return;

  await deleteFeedbackItem(prisma, clientId, itemId);
  revalidateFeedback(clientId);
  redirect(`/clients/${clientId}/feedback?deleted=1`);
}
