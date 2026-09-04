'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import {
  draftClientReplies,
  regenerateDraft,
  saveDraftEdit,
  setHandled,
} from '@/lib/feedback/replies';
import { bool, str, text } from './shared';
import type { ActionState } from './shared';
import { failure, success } from './shared';
import { tenantGate } from '@/lib/auth/guard';

/**
 * Reply actions.
 *
 * Every one of these ends at text on the operator's screen. RepOS has no
 * outbound path for a reply: nothing is posted, sent, queued or scheduled. The
 * operator copies what they approve and pastes it wherever they choose.
 */

/** Cap so one click stays bounded. The operator clicks again if more is waiting. */
const MAX_PER_RUN = 40;

function revalidateFor(clientId: string, itemId?: string) {
  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/feedback`);
  if (itemId) revalidatePath(`/clients/${clientId}/feedback/${itemId}`);
}

export async function draftRepliesAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  if (!clientId) return;

  const result = await draftClientReplies(prisma, clientId, {
    force: bool(form, 'force'),
    includeOptional: bool(form, 'includeOptional'),
    limit: MAX_PER_RUN,
  });

  revalidateFor(clientId);

  if (!result.ok) {
    redirect(
      `/clients/${clientId}/feedback?draftError=${encodeURIComponent(result.message)}`,
    );
  }

  const { drafted, alreadyDrafted, failed, leftForYou, usedAi } = result.data;
  redirect(
    `/clients/${clientId}/feedback?drafted=${drafted}&already=${alreadyDrafted}` +
      `&draftFailed=${failed}&forYou=${leftForYou}&assisted=${usedAi ? 1 : 0}`,
  );
}

export async function regenerateDraftAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  const itemId = str(form, 'itemId');
  if (!clientId || !itemId) return;

  const result = await regenerateDraft(prisma, clientId, itemId, {});
  revalidateFor(clientId, itemId);

  redirect(
    result.ok
      ? `/clients/${clientId}/feedback/${itemId}?redrafted=1`
      : `/clients/${clientId}/feedback/${itemId}?draftError=${encodeURIComponent(result.message)}`,
  );
}

/**
 * Saves the operator's own wording.
 *
 * Returns state rather than redirecting, so the editor can show what is wrong
 * without losing what they typed.
 */
export async function saveDraftAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const itemId = str(form, 'itemId');
  if (!clientId || !itemId) return failure('That feedback item could not be found.');

  const result = await saveDraftEdit(prisma, clientId, itemId, text(form, 'draftText'));

  if (!result.ok) return failure(result.message, result.errors);

  revalidateFor(clientId, itemId);
  return success(
    result.data.warnings.length > 0
      ? `Saved. Worth a second look: ${result.data.warnings.join(' ')}`
      : 'Saved.',
  );
}

export async function setHandledAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  const itemId = str(form, 'itemId');
  if (!clientId || !itemId) return;

  const handled = bool(form, 'handled');
  await setHandled(prisma, clientId, itemId, handled);
  revalidateFor(clientId, itemId);

  redirect(`/clients/${clientId}/feedback/${itemId}?handled=${handled ? 1 : 0}`);
}
