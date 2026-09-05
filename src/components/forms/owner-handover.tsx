'use client';

import { SubmitButton } from '@/components/forms/submit-button';
import { setPortalLinkSentAction } from '@/lib/actions/portal';

/**
 * Whether the owner has actually been given access to their own workspace.
 *
 * This used to hand out a secret link to an anonymous portal. That portal was
 * retired in M20: the owner's workspace is now behind Supabase Auth like
 * everything else, so access is granted by inviting them from the Team page
 * rather than by sending an address that authenticates whoever holds it.
 *
 * The record of the handover survives the portal, because the setup checklist
 * and the command centre both ask whether it has happened, and neither of them
 * cares how the owner got in.
 */
export function OwnerHandoverPanel({ clientId, sent }: { clientId: string; sent: boolean }) {
  return (
    <form action={setPortalLinkSentAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="sent" value={sent ? '' : 'on'} />
      <SubmitButton variant={sent ? 'ghost' : 'secondary'}>
        {sent ? 'Not handed over after all' : 'I have given the owner access'}
      </SubmitButton>
    </form>
  );
}
