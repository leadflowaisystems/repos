'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { adminGate, tenantGate } from '@/lib/auth/guard';
import {
  requestContinuation,
  setContinuationStatus,
} from '@/lib/continuation/service';
import { setServiceAccess, type ServiceAccessAction } from '@/lib/lifecycle/admin';
import { failure, str, success, type ActionState } from './shared';

/**
 * ASKING TO CARRY ON, AND THE PLATFORM'S ANSWER (M28).
 *
 * Split the same way every other pair in RepOS is: the first is the business's
 * own, the rest are the platform's.
 *
 * The owner's one is a MESSAGE. It records a phone number and a request to be
 * contacted; it does not extend the trial, move a date, unlock a workspace or
 * take a payment, and there is nothing in this file that could. The platform's
 * ones move access, and every one of them leaves `trialStartsAt` and
 * `trialEndsAt` exactly as they were.
 */

function revalidateFor(clientId: string) {
  revalidatePath(`/workspace/${clientId}/account`);
  revalidatePath(`/workspace/${clientId}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/clients');
  revalidatePath('/');
}

// --- the owner's side ---------------------------------------------------------

/**
 * "Extend access" — which means ASK, and says so on the button that follows.
 *
 * Phone required, email optional, and no name field: the person is signed in,
 * so Headway already knows which business is asking and carries the name from
 * the row rather than making them type what is on the screen.
 *
 * A second press while a request is still open returns the same confirmation
 * without writing anything, so an anxious owner on a slow connection cannot
 * create a queue of identical requests for the operator to wade through.
 */
export async function requestContinuationAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // allowLocked: this is the one thing a business whose trial has ended must
  // still be able to do. Refusing it would lock them out of asking to come back.
  const gate = await tenantGate(form, 'OWNER', 'clientId', { allowLocked: true });
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await requestContinuation(prisma, clientId, {
    phone: str(form, 'phone'),
    email: str(form, 'email'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  // The operator's existing surfaces — the board, the client page, the
  // continuation list — have keyed on `paymentRequestedAt` since M21, and the
  // owner's own contact details are what Headway rings. Both are columns the
  // owner is allowed to write, and neither is a trial date.
  if (result.data.created) {
    await prisma.client.updateMany({
      where: { id: clientId },
      data: {
        ownerPhone: result.data.request.phone,
        ...(result.data.request.email ? { ownerEmail: result.data.request.email } : {}),
        paymentRequestedAt: result.data.request.createdAt,
      },
    });
  }

  revalidateFor(clientId);
  return success("Request received. Thank you. We'll contact you to arrange continued access.");
}

// --- the platform's decisions -------------------------------------------------

/**
 * Lock, unlock, override, or mark the demonstration business.
 *
 * `adminGate` first, and the database asks again underneath: `repos_app` holds
 * no UPDATE privilege on any of the three columns, so a bug here cannot become
 * a business unlocking itself.
 */
export async function setServiceAccessAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const clientId = str(form, 'clientId');
  const action = str(form, 'action') as ServiceAccessAction;

  const result = await setServiceAccess(prisma, clientId, action);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateFor(clientId);
  const said: Record<ServiceAccessAction, string> = {
    LOCK: 'Workspace locked. The trial dates are unchanged.',
    UNLOCK: 'Workspace unlocked.',
    OVERRIDE: 'Access override applied. The trial dates are unchanged.',
    CLEAR_OVERRIDE: 'Access override removed.',
    EXEMPT_DEMO: 'Marked as the demonstration business.',
    CLEAR_EXEMPTION: 'Exemption removed.',
  };
  return success(said[action] ?? 'Saved.');
}

/** Moving one request along the operator's own three states. */
export async function setContinuationStatusAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const result = await setContinuationStatus(prisma, str(form, 'requestId'), str(form, 'status'));
  if (!result.ok) return failure(result.message, result.errors);

  revalidatePath('/clients');
  revalidatePath('/');
  return success('Saved.');
}
