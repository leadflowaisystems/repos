'use server';

import { revalidatePath } from 'next/cache';

import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { tenantGate } from '@/lib/auth/guard';
import { setPortalLinkSent } from '@/lib/clients/service';
import { bool } from './shared';

/**
 * "I have sent the owner their link."
 *
 * A token existing is not a business being onboarded (M17). RepOS mints one
 * the first time the operator opens the client, so `portalTokenAt` records an
 * operator page view and nothing more. This records the handover itself, which
 * is the fact the setup checklist and the command centre need in order to
 * answer "which of my twenty clients have I actually onboarded?".
 */
export async function setPortalLinkSentAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'OWNER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  if (!clientId) return;

  await setPortalLinkSent(prisma, clientId, bool(form, 'sent'));

  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
