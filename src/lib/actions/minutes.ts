'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { createMinute, deleteMinute, updateMinute } from '@/lib/minutes/service';
import {
  failure,
  optDate,
  str,
  success,
  text,
  type ActionState,
} from './shared';
import { tenantGate } from '@/lib/auth/guard';

/**
 * Minutes actions.
 *
 * Small on purpose: the whole point is that recording something takes seconds.
 */

function readMinuteForm(form: FormData) {
  return {
    occurredAt: optDate(form, 'occurredAt') ?? new Date(Number.NaN),
    category: str(form, 'category') || 'GENERAL',
    title: str(form, 'title'),
    body: text(form, 'body'),
  };
}

function revalidateMinutes(clientId: string) {
  revalidatePath('/');
  revalidatePath('/minutes');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/minutes`);
}

export async function createMinuteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  if (!clientId) return failure('Choose a client first.');

  const result = await createMinute(prisma, clientId, readMinuteForm(form));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateMinutes(clientId);
  return success('Saved.');
}

export async function updateMinuteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const minuteId = str(form, 'minuteId');
  if (!clientId || !minuteId) return failure('Missing minute.');

  const result = await updateMinute(
    prisma,
    clientId,
    minuteId,
    readMinuteForm(form),
  );
  if (!result.ok) return failure(result.message, result.errors);

  revalidateMinutes(clientId);
  redirect(`/clients/${clientId}/minutes?saved=1`);
}

export async function deleteMinuteAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'OWNER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  const minuteId = str(form, 'minuteId');
  if (!clientId || !minuteId) return;

  await deleteMinute(prisma, clientId, minuteId);
  revalidateMinutes(clientId);
  redirect(`/clients/${clientId}/minutes?deleted=1`);
}
