'use client';

import { useActionState } from 'react';
import { disableTempAccessAction, generateTempAccessAction } from '@/lib/actions/account-access';
import { IDLE, type ActionState } from '@/lib/actions/shared';
import { CopyButton } from '@/components/copy-button';
import { SubmitButton } from '@/components/forms/submit-button';

/**
 * ACCOUNT ACCESS (M39) — the admin's side of the pilot handover.
 *
 * Before setup, this is the only place the temporary password is ever
 * visible, and only once: RepOS stores no plaintext password anywhere, so
 * there is nothing to redisplay after this first render. The Login ID stays
 * visible indefinitely afterwards — it is not a secret, it is closer to a
 * username, and keeping it on screen is what lets an admin hand it over
 * again if the printed copy is lost.
 *
 * Generating and disabling are two separate, independent forms rather than
 * one that changes its own behaviour, so a failed disable can never be
 * confused with a failed generate.
 */

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={`mt-3 rounded-lg border px-3 py-2 text-[13px] break-words ${
        state.ok ? 'border-good-200 bg-good-50 text-good-700' : 'border-bad-200 bg-bad-50 text-bad-700'
      }`}
    >
      {state.message}
    </p>
  );
}

function DisableForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(disableTempAccessAction, IDLE);
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="clientId" value={clientId} />
      <SubmitButton variant="danger" pendingLabel="Disabling…">
        Disable temporary access
      </SubmitButton>
      <Notice state={state} />
    </form>
  );
}

function GenerateForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(generateTempAccessAction, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="clientId" value={clientId} />
      <SubmitButton variant="primary" pendingLabel="Generating…">
        Generate temporary access
      </SubmitButton>
      <Notice state={state} />
      {state.data?.loginId && state.data?.password ? (
        <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50 p-3">
          <p className="text-[12px] font-medium tracking-wide text-ink-500 uppercase">
            Shown once — copy these now
          </p>
          <dl className="mt-2 space-y-1.5 text-[13px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-500">Login ID</dt>
              <dd className="font-mono text-ink-900">{state.data.loginId}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-500">Temporary password</dt>
              <dd className="font-mono text-ink-900">{state.data.password}</dd>
            </div>
          </dl>
          <div className="mt-2.5">
            <CopyButton
              value={`Login ID: ${state.data.loginId}\nTemporary password: ${state.data.password}`}
              label="Copy credentials"
              copiedLabel="Copied"
            />
          </div>
        </div>
      ) : null}
    </form>
  );
}

const STATUS_LABEL: Record<string, string> = {
  TEMPORARY_ACTIVE: 'Temporary access active',
  SETUP_COMPLETE: 'Setup complete',
  DISABLED: 'Disabled',
};

export function AccountAccessPanel({
  clientId,
  access,
}: {
  clientId: string;
  access: { loginId: string; status: string } | null;
}) {
  if (!access) {
    return (
      <div>
        <p className="text-[14px] leading-relaxed text-ink-700">
          Generate a temporary login and password for this client. Hand them over with the
          physical kit — the owner signs in with them on the normal login page and sets up their
          own account from there.
        </p>
        <div className="mt-3">
          <GenerateForm clientId={clientId} />
        </div>
      </div>
    );
  }

  return (
    <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
      <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[12rem_1fr]">
        <dt className="text-ink-500">Status</dt>
        <dd className="font-medium text-ink-900">
          {STATUS_LABEL[access.status] ?? access.status}
        </dd>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[12rem_1fr]">
        <dt className="text-ink-500">Login ID</dt>
        <dd className="font-mono text-ink-900">{access.loginId}</dd>
      </div>
      {access.status !== 'DISABLED' ? (
        <div className="py-2.5">
          <DisableForm clientId={clientId} />
        </div>
      ) : null}
    </dl>
  );
}
