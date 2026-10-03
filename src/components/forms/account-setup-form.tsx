'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { useT } from '@/components/portal/locale-provider';
import { requestOwnerPasswordLinkAction } from '@/lib/actions/account-access';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * SET UP YOUR ACCOUNT (M39, M52, M53).
 *
 * Shown to an owner signed in with the temporary email and password Headway
 * handed over. One button: it emails a link to the address Headway recorded
 * for them (named on the page above it), and opening that link is where the
 * owner chooses their password. Nothing is typed here — whoever holds the
 * handover sheet cannot choose the owner's email or password from this page.
 */

const BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink-900 px-4 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400 sm:w-auto';

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={clsx(
        'mt-4 rounded-xl border px-4 py-3 text-[14px]',
        state.ok
          ? 'border-good-200 bg-good-50 text-good-700'
          : 'border-bad-200 bg-bad-50 text-bad-700',
      )}
    >
      {state.message}
    </p>
  );
}

export function AccountSetupForm({ clientId }: { clientId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(requestOwnerPasswordLinkAction, IDLE);

  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="clientId" value={clientId} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? t('account.setup.sending') : t('account.setup.send')}
      </button>
      <Notice state={state} />
    </form>
  );
}
