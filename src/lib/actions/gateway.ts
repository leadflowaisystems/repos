'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { publicDb } from '@/lib/db-public';
import { DIMENSION_FIELD_PREFIX, SIGNAL_FIELD } from '@/lib/gateway/fields';
import {
  savePublicBaseUrl,
  savePublicReviewUrl,
  setGatewayEnabled,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { requestAddress } from '@/lib/gateway/origin';
import { triggerFeedbackProcessing } from '@/lib/pipeline/trigger';
import { bool, failure, optInt, str, success, text, type ActionState } from './shared';
import { adminGate, tenantGate } from '@/lib/auth/guard';

/**
 * Customer feedback gateway actions (M14).
 *
 * Three are the operator's, one is the public. The public one stores words
 * and a rating against the client its token resolved to, and nothing about
 * the person. It reads no header into the database, sends nothing, and
 * redirects to a thank-you page that knows only the token.
 */

function revalidateGateway(clientId: string) {
  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/qr`);
  revalidatePath(`/clients/${clientId}/feedback`);
  revalidatePath(`/print/feedback/${clientId}`);
}

// --- Operator ----------------------------------------------------------------

export async function savePublicReviewUrlAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const result = await savePublicReviewUrl(prisma, clientId, str(form, 'publicReviewUrl'));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateGateway(clientId);
  return success(
    result.data.url
      ? 'Saved. Every customer is offered this link after they send feedback.'
      : 'Removed. Customers finish at the thank-you page.',
  );
}

export async function setGatewayEnabledAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'OWNER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  if (!clientId) return;

  await setGatewayEnabled(prisma, clientId, bool(form, 'enabled'));
  revalidateGateway(clientId);
  redirect(`/clients/${clientId}/qr`);
}

export async function savePublicBaseUrlAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;
  const clientId = str(form, 'clientId');
  const result = await savePublicBaseUrl(prisma, str(form, 'publicBaseUrl'));
  if (!result.ok) return failure(result.message, result.errors);

  // One setting for the whole installation: every client's QR follows it.
  revalidatePath('/', 'layout');
  if (clientId) revalidateGateway(clientId);
  return success(
    result.data.url
      ? `Saved. Every feedback QR now opens at ${result.data.url}.`
      : 'Cleared. QR codes use the address Headway is opened on.',
  );
}

// --- Public ------------------------------------------------------------------

/**
 * The vertical's own ratings, off the posted form.
 *
 * Reads whatever `dim:` fields arrived rather than a list of expected ones:
 * the service checks every key against the client's pack anyway, so there is
 * nothing to gain by knowing them twice, and a pack that gains a question
 * needs no change here.
 */
function dimensionRatings(form: FormData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [field, value] of form.entries()) {
    if (!field.startsWith(DIMENSION_FIELD_PREFIX) || typeof value !== 'string') continue;
    const key = field.slice(DIMENSION_FIELD_PREFIX.length);
    const rating = Number.parseInt(value, 10);
    if (key.length > 0 && Number.isInteger(rating)) out[key] = rating;
  }
  return out;
}

/**
 * The customer's own submission.
 *
 * On success it redirects to the thank-you page for the same token — a
 * destination that carries nothing about what was written or how it was
 * rated, so the thank-you page cannot treat anyone differently.
 */
export async function submitCustomerFeedbackAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const token = str(form, 'token');
  const stars = optInt(form, 'stars');

  // The one action in RepOS with no signed-in person behind it, and so the one
  // that uses the anonymous handle. Every operator action in this file keeps
  // the ordinary client and stays bound by Row Level Security.
  const result = await submitCustomerFeedback(
    publicDb(),
    token,
    {
      stars: stars === null || Number.isNaN(stars) ? null : stars,
      text: text(form, 'text'),
      dimensions: dimensionRatings(form),
      signals: form.getAll(SIGNAL_FIELD).filter((v): v is string => typeof v === 'string'),
      nonce: str(form, 'nonce') || null,
      website: str(form, 'website') || null,
    },
    { address: await requestAddress() },
  );
  if (!result.ok) return failure(result.message, result.errors);

  // The reading starts once the thank-you page is on its way — never on the
  // customer's request, and never as this anonymous handle: the run is scoped
  // to the client the token resolved to, inside the database, and reaches it
  // as the application role. Nothing stored (a duplicate, a bot) starts nothing.
  if (result.data.stored) triggerFeedbackProcessing(result.data.clientId, 'SUBMITTED');

  redirect(`/feedback/${result.data.token}/thanks`);
}
