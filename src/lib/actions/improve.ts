'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import {
  createActionFromInsight,
  decideAction,
  measureClientAction,
  moveAction,
  recordLearning,
} from '@/lib/improve/service';
import { bool, failure, optDate, str, success, text, type ActionState } from './shared';

/**
 * Improvement action loop (M11).
 *
 * Every one of these is a human pressing a button about a business change.
 * Nothing here sends, posts or schedules anything, and nothing measures itself:
 * the operator asks for a measurement, and it reads only feedback they have
 * already pasted in.
 */

function revalidateActions(clientId: string) {
  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
}

export async function createActionFromInsightAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  const insightId = str(form, 'insightId');
  if (!clientId || !insightId) return failure('Missing the insight to act on.');

  const result = await createActionFromInsight(prisma, clientId, insightId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success('Added. Record what the business decides.');
}

export async function decideActionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) return failure('Missing action.');

  const result = await decideAction(prisma, clientId, actionId, {
    decision: str(form, 'decision'),
    description: text(form, 'description'),
    statusNote: text(form, 'statusNote'),
    recordMinute: bool(form, 'recordMinute'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  revalidatePath(`/clients/${clientId}/minutes`);
  return success(
    result.data.status === 'ACCEPTED' ? 'Saved. Mark it done once the change is made.' : 'Saved.',
  );
}

export async function moveActionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) return failure('Missing action.');

  const result = await moveAction(prisma, clientId, actionId, {
    to: str(form, 'to'),
    note: text(form, 'note'),
    occurredAt: optDate(form, 'occurredAt'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success(
    result.data.status === 'DONE'
      ? 'Recorded. Bring in new feedback, then measure it.'
      : 'Saved.',
  );
}

export async function measureActionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) return failure('Missing action.');

  const result = await measureClientAction(prisma, clientId, actionId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success(result.data.measurement.resultLabel);
}

export async function recordLearningAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) return failure('Missing action.');

  const result = await recordLearning(prisma, clientId, actionId, {
    note: text(form, 'note'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success('Saved.');
}
