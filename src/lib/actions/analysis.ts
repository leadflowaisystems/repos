'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { triageClientFeedback } from '@/lib/feedback/replies';
import { bool } from './shared';
import { tenantGate } from '@/lib/auth/guard';

/**
 * Reading a client's feedback.
 *
 * Runs in the request, because RepOS is local-first and has no background
 * worker. A cap keeps one click bounded; the operator simply clicks again if
 * there is more waiting.
 */

const MAX_PER_RUN = 200;

export async function analyseFeedbackAction(form: FormData): Promise<void> {
  const gate = await tenantGate(form, 'MEMBER');
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const { clientId } = gate;
  if (!clientId) return;

  const result = await analyseClientFeedback(prisma, clientId, {
    force: bool(form, 'force'),
    limit: MAX_PER_RUN,
  });

  // Sorting what was just read into "needs a reply" is deterministic and
  // cheap, so the operator never sees a half-updated page. It reads the
  // analysis columns and never re-reads the text.
  if (result.ok) await triageClientFeedback(prisma, clientId, {});

  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/feedback`);

  if (!result.ok) {
    redirect(
      `/clients/${clientId}/feedback?readError=${encodeURIComponent(result.message)}`,
    );
  }

  const { analysed, needsRetry, skippedUpToDate, usedAi } = result.data;
  redirect(
    `/clients/${clientId}/feedback?read=${analysed}&retry=${needsRetry}&skipped=${skippedUpToDate}&assisted=${usedAi ? 1 : 0}`,
  );
}
