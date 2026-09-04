'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import {
  answerQuestion,
  createContext,
  deleteContext,
  restoreContext,
  retireContext,
  updateContext,
} from '@/lib/context/service';
import { failure, optDate, optStr, str, success, text, type ActionState } from './shared';
import { tenantGate } from '@/lib/auth/guard';

/**
 * Business context actions (M13).
 *
 * Every one of these is the operator writing down something the owner said.
 * Nothing is inferred, nothing is fetched, and nothing here touches feedback.
 */

function revalidateContext(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/context`);
  // The owner's own pages read this context. Since M16 they are addressed by a
  // secret token rather than the client id, and one revalidation of the portal
  // layout covers every page under it without the action having to look the
  // token up.
  revalidatePath('/portal/[token]', 'layout');
}

function readContextForm(form: FormData) {
  return {
    kind: str(form, 'kind'),
    text: text(form, 'text'),
    themeKey: optStr(form, 'themeKey'),
    constraintKey: optStr(form, 'constraintKey'),
    questionKey: optStr(form, 'questionKey'),
    actionId: optStr(form, 'actionId'),
    recordedAt: optDate(form, 'recordedAt'),
  };
}

export async function createContextAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  if (!clientId) return failure('Missing client.');
  const result = await createContext(prisma, clientId, readContextForm(form));
  if (!result.ok) return failure(result.message, result.errors);
  revalidateContext(clientId);
  return success('Saved. RepOS will show this back as "You told us".');
}

export async function updateContextAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const contextId = str(form, 'contextId');
  if (!clientId || !contextId) return failure('Missing line.');
  const result = await updateContext(prisma, clientId, contextId, readContextForm(form));
  if (!result.ok) return failure(result.message, result.errors);
  revalidateContext(clientId);
  redirect(`/clients/${clientId}/context?saved=1`);
}

export async function retireContextAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  const contextId = str(form, 'contextId');
  if (!clientId || !contextId) return;
  await retireContext(prisma, clientId, contextId, { note: text(form, 'note') });
  revalidateContext(clientId);
  redirect(`/clients/${clientId}/context?retired=1`);
}

export async function restoreContextAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  const contextId = str(form, 'contextId');
  if (!clientId || !contextId) return;
  await restoreContext(prisma, clientId, contextId);
  revalidateContext(clientId);
  redirect(`/clients/${clientId}/context?restored=1`);
}

export async function deleteContextAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'OWNER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  const contextId = str(form, 'contextId');
  if (!clientId || !contextId) return;
  await deleteContext(prisma, clientId, contextId);
  revalidateContext(clientId);
  redirect(`/clients/${clientId}/context?deleted=1`);
}

/** The owner answered the question RepOS is asking on their Home page. */
export async function answerQuestionAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  const themeKey = str(form, 'themeKey');
  const answer = str(form, 'answer');
  if (!clientId || !themeKey || !answer) return;
  await answerQuestion(prisma, clientId, { themeKey, answer });
  revalidateContext(clientId);
  redirect(`/clients/${clientId}/context?answered=1`);
}
