'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import {
  convertToActive,
  extendTrial,
  pauseService,
  requestContinuation,
  resumeService,
  saveCommercial,
  saveTrialDefaultDays,
  startTrial,
  updateOwnerContact,
} from '@/lib/commercial/service';
import { failure, optInt, str, success, text, type ActionState } from './shared';

/**
 * THE COMMERCIAL ACTIONS.
 *
 * Split down the middle, and the split is the point.
 *
 * TWO of these are the owner's: continuing with Headway, and keeping their own
 * contact details right. Each writes their own name, email and number; the
 * first also writes a timestamp. Nothing else.
 *
 * EVERY OTHER ONE is platform staff's, because they decide the state of an
 * account and what was agreed for it. `adminGate` is the outer check; the
 * database asks again underneath, since `repos_app` holds no UPDATE privilege
 * on the subscription or trial columns and cannot read the Commercial table at
 * all. A bug in this file cannot become a business changing its own billing.
 *
 * No amount appears in any owner-facing path here. There is no price list in
 * RepOS: what a business pays is negotiated, recorded by the operator, and
 * collected by hand.
 */

function revalidateCommercial(clientId: string) {
  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/workspace/${clientId}/account`);
  revalidatePath(`/workspace/${clientId}`);
}

// --- the owner's side ---------------------------------------------------------

export async function continueWithHeadwayAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await requestContinuation(prisma, clientId, {
    name: str(form, 'ownerName'),
    email: str(form, 'ownerEmail'),
    phone: str(form, 'ownerPhone'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success(
    "Thanks. We've got your details. We'll send the payment information and QR directly to you.",
  );
}

export async function updateOwnerContactAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await updateOwnerContact(prisma, clientId, {
    name: str(form, 'ownerName'),
    email: str(form, 'ownerEmail'),
    phone: str(form, 'ownerPhone'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success('Saved. These are the details Headway will use to reach you.');
}

// --- the platform's decisions -------------------------------------------------

export async function startTrialAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  const days = optInt(form, 'days');
  if (days !== null && Number.isNaN(days)) {
    return failure('Some fields need attention.', { days: 'Enter a whole number of days.' });
  }
  // Blank means the configured default, which is what the button offers.
  const result = await startTrial(prisma, clientId, days);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success(`Trial started, ${result.data.days} days.`);
}

export async function extendTrialAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  const days = optInt(form, 'days');
  if (days === null || Number.isNaN(days)) {
    return failure('Some fields need attention.', { days: 'Enter a whole number of days.' });
  }
  const result = await extendTrial(prisma, clientId, days);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success(`Trial extended by ${days} days.`);
}

export async function convertToActiveAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  const result = await convertToActive(prisma, clientId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success('Account is active.');
}

export async function pauseServiceAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  const result = await pauseService(prisma, clientId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success(
    'Service paused. Feedback still arrives and is kept; Headway stops reading it until this is resumed.',
  );
}

export async function resumeServiceAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  const result = await resumeService(prisma, clientId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success(
    result.data.state === 'TRIAL'
      ? 'Service resumed, back on trial. Anything that arrived while paused will be read.'
      : 'Service resumed. Anything that arrived while paused will be read.',
  );
}

export async function saveCommercialAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  const amountInr = optInt(form, 'amountInr');
  if (Number.isNaN(amountInr)) {
    return failure('Some fields need attention.', {
      amountInr: 'Use whole rupees, or leave it blank.',
    });
  }
  const result = await saveCommercial(prisma, clientId, {
    amountInr,
    cadence: str(form, 'cadence'),
    note: text(form, 'note'),
    paymentInstructions: text(form, 'paymentInstructions'),
    markSent: str(form, 'mark') === 'sent',
    markPaid: str(form, 'mark') === 'paid',
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateCommercial(clientId);
  return success('Saved. This stays on the operator side.');
}

/** How long every new trial runs. One installation-wide setting, operator only. */
export async function saveTrialDefaultDaysAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const result = await saveTrialDefaultDays(prisma, str(form, 'trialDays'));
  if (!result.ok) return failure(result.message, result.errors);

  revalidatePath('/settings');
  return success(`New trials run for ${result.data.days} days.`);
}
