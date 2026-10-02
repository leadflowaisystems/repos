'use client';

import { useActionState } from 'react';
import { disableTempAccessAction, generateTempAccessAction } from '@/lib/actions/account-access';
import { IDLE, type ActionState } from '@/lib/actions/shared';
import type { AdminAccessView } from '@/lib/account-access/service';
import { isTemporaryEmail } from '@/lib/account-access/state';
import { CopyButton } from '@/components/copy-button';
import { SubmitButton } from '@/components/forms/submit-button';

/**
 * TEMPORARY ACCESS — the admin's side of the handover (M39, M52).
 *
 * The admin generates a temporary EMAIL and PASSWORD, copies both, and hands
 * them to the owner, who signs in with them on the normal login page. No
 * email is sent. The password is visible exactly once, straight after it is
 * generated: RepOS stores no plaintext password anywhere, so there is nothing
 * to redisplay after a reload. The temporary email stays visible — it is not
 * a secret, and it is what the owner signs in with until setup.
 *
 * The status line always says what is true in the database and in Supabase:
 *
 *   No temporary access     nothing generated (or the business already has
 *                           its own owner account, which is said instead)
 *   Temporary access active the temporary email and password sign in
 *   Setup complete          the owner chose their own password; shows the
 *                           email they sign in with, and one waiting for
 *                           confirmation
 *   Disabled                the temporary email and password no longer work
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[10rem_1fr]">
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 font-medium break-words text-ink-900">{children}</dd>
    </div>
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

function GenerateForm({
  clientId,
  state,
  action,
  label,
}: {
  clientId: string;
  state: ActionState;
  action: (formData: FormData) => void;
  label: string;
}) {
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="clientId" value={clientId} />
      <SubmitButton variant="primary" pendingLabel="Generating…">
        {label}
      </SubmitButton>
      <Notice state={state} />
    </form>
  );
}

/**
 * The one-time result, shown in place of everything else in this panel.
 *
 * Keyed on the action's own returned data, not on the server-refreshed
 * `view`: the page re-renders right after the action resolves, and by then
 * the view already says "active" — if this were gated on the view, that
 * refresh could replace the password before it ever painted. Only a real
 * reload (which resets `useActionState`) makes it disappear.
 */
function GeneratedCredentials({ data, state }: { data: Record<string, string>; state: ActionState }) {
  const email = data.email ?? '';
  const password = data.password ?? '';
  return (
    <div>
      <Notice state={state} />
      <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50 p-3">
        <p className="text-[12px] font-medium tracking-wide text-ink-500 uppercase">Temporary access</p>
        <dl className="mt-2 space-y-2 text-[14px]">
          <div>
            <dt className="text-ink-500">Email</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-mono break-all text-ink-900 select-all">{email}</span>
              <CopyButton value={email} label="Copy email" copiedLabel="Email copied" />
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Password</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-mono break-all text-ink-900 select-all">{password}</span>
              <CopyButton value={password} label="Copy password" copiedLabel="Password copied" />
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Status</dt>
            <dd className="mt-0.5 font-medium text-ink-900">Temporary access active</dd>
          </div>
          {data.signInUrl ? (
            <div>
              <dt className="text-ink-500">Sign in at</dt>
              <dd className="mt-0.5 font-mono break-all text-ink-900">{data.signInUrl}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
          The password is shown only once. Give the owner both lines exactly as they are. No email
          has been sent.
        </p>
      </div>
    </div>
  );
}

export function AccountAccessPanel({ clientId, view }: { clientId: string; view: AdminAccessView }) {
  const [generateState, generateAction] = useActionState(generateTempAccessAction, IDLE);

  // Checked before `view`, and matched against `clientId`: this component
  // does not remount on an in-app move from one client's page to another's,
  // so a still-mounted result must never show on the wrong client.
  const generated = generateState.data;
  if (generated?.clientId === clientId && generated.email && generated.password) {
    return <GeneratedCredentials data={generated} state={generateState} />;
  }

  if (view.status === 'NONE') {
    if (view.ownerAccount) {
      return (
        <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
          <Row label="Status">No temporary access</Row>
          <Row label="Owner account">{view.ownerAccount.email}</Row>
          <p className="py-2.5 text-[13px] leading-relaxed text-ink-600">
            This business already has its own owner account, so it does not need temporary access.
          </p>
        </dl>
      );
    }
    return (
      <div>
        <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
          <Row label="Status">No temporary access</Row>
        </dl>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-700">
          Generate a temporary email and password for the owner. They sign in with them on the normal
          sign-in page and then set up their own email and password. No email is sent.
        </p>
        <GenerateForm
          clientId={clientId}
          state={generateState}
          action={generateAction}
          label="Generate temporary access"
        />
      </div>
    );
  }

  if (view.status === 'TEMPORARY_ACTIVE') {
    return (
      <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
        <Row label="Status">Temporary access active</Row>
        <Row label="Email">
          <span className="font-mono">{view.temporaryEmail}</span>
        </Row>
        <div className="py-2.5">
          <p className="text-[13px] leading-relaxed text-ink-600">
            The password was shown once, when it was generated. If it is lost, disable temporary
            access and generate it again.
          </p>
          <DisableForm clientId={clientId} />
        </div>
      </dl>
    );
  }

  if (view.status === 'SETUP_COMPLETE') {
    return (
      <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
        <Row label="Status">Setup complete</Row>
        <Row label="Email">{view.signInEmail}</Row>
        {view.pendingEmail ? (
          <Row label="Waiting to confirm">
            {view.pendingEmail}
            <span className="mt-0.5 block text-[13px] font-normal text-ink-600">
              The owner has been emailed a link. Until they open it, they sign in with the email
              above and their own password.
            </span>
          </Row>
        ) : null}
        <p className="py-2.5 text-[13px] leading-relaxed text-ink-600">
          {isTemporaryEmail(view.signInEmail)
            ? view.pendingEmail
              ? 'The owner chose their own password. The temporary password no longer works.'
              : 'The owner chose their own password, so the temporary password no longer works. No email is confirmed yet: they can send a confirmation link from Account.'
            : 'The owner signs in with their own email and password. The temporary password no longer works.'}
        </p>
      </dl>
    );
  }

  // DISABLED — before setup. Never after: there is nothing temporary to turn
  // off once the owner has their own password.
  return (
    <div>
      <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
        <Row label="Status">Disabled</Row>
        <Row label="Email">
          <span className="font-mono">{view.temporaryEmail}</span>
        </Row>
        {view.ownerAccount ? <Row label="Owner account">{view.ownerAccount.email}</Row> : null}
      </dl>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-700">
        The temporary email and password no longer work.
        {view.ownerAccount
          ? ' This business has its own owner account, who signs in as usual.'
          : ' Generating again gives the same email a new password.'}
      </p>
      {view.ownerAccount ? null : (
        <GenerateForm
          clientId={clientId}
          state={generateState}
          action={generateAction}
          label="Generate new temporary access"
        />
      )}
    </div>
  );
}
