'use client';

import { useActionState } from 'react';
import { disableTempAccessAction, generateTempAccessAction } from '@/lib/actions/account-access';
import { IDLE, type ActionState } from '@/lib/actions/shared';
import type { AdminAccessView } from '@/lib/account-access/service';
import { CopyButton } from '@/components/copy-button';
import { SubmitButton } from '@/components/forms/submit-button';

/**
 * ACCESS — the admin's side of the handover (M39; two logins since M52).
 *
 * Two separate things, never shown as one:
 *
 *   Permanent account  the owner's OWN login — their real email and their own
 *                      password, made at setup. This panel never changes it.
 *   Temporary access   a Headway-made email and password the admin hands
 *                      over. Generate / Disable / Enable at any time; the
 *                      permanent account is unaffected either way.
 *
 * The temporary password is visible exactly once, straight after it is
 * generated or re-enabled: RepOS stores no plaintext password anywhere. No
 * email is sent.
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
      <SubmitButton variant="primary" pendingLabel="Working…">
        {label}
      </SubmitButton>
      {/* Failures only: a success is shown with the password, above. Kept
          after a Disable, it would say "on" under "disabled". */}
      <Notice state={state.ok ? IDLE : state} />
    </form>
  );
}

/**
 * The note under the permanent account, true for the temporary access it sits
 * beside: an owner whose own login is not confirmed can only get a new link
 * through "Set up your account", which only the temporary login reaches.
 */
function permanentNote(view: AdminAccessView): string | null {
  const own = view.ownLogin;
  if (own === null || own.confirmed === true) return null;
  const temporaryOn = view.temporary === 'ACTIVE' && view.temporaryBlocked === null;
  if (own.confirmed === null) {
    return temporaryOn
      ? 'Could not check this sign-in with Supabase just now. Reload the page before switching temporary access off.'
      : 'Could not check this sign-in with Supabase just now. Reload the page.';
  }
  if (temporaryOn) {
    return own.confirmationSent
      ? 'Waiting for the owner to open the confirmation email. Until then they cannot sign in with it.'
      : 'No confirmation email has gone out yet. Signed in with the temporary access, the owner can fill in "Set up your account" again to send one. Until then they cannot sign in with it.';
  }
  // With temporary access off, "Forgot password?" is the owner's way in: a
  // reset link to that address confirms it too.
  return own.confirmationSent
    ? 'Not confirmed yet, and the temporary access is off. The owner can open the confirmation email, or use "Forgot password?" on the sign-in page with this address — that confirms it too.'
    : 'Not confirmed, and no confirmation email has gone out. With the temporary access off, the owner can use "Forgot password?" on the sign-in page with this address — that confirms it too.';
}

function PermanentAccount({ view }: { view: AdminAccessView }) {
  const own = view.ownLogin;
  const note = permanentNote(view);
  return (
    <Row label="Permanent account">
      {own ? (
        <>
          {own.email ?? <span className="font-normal text-ink-600">Set up, address not known yet</span>}
          {note ? <span className="mt-0.5 block text-[13px] font-normal text-ink-600">{note}</span> : null}
        </>
      ) : (
        <span className="font-normal text-ink-600">Not set up yet</span>
      )}
    </Row>
  );
}

/**
 * The one-time result, shown in place of the temporary-access part of the
 * panel. Keyed on the action's own returned data, not on the server-refreshed
 * `view`: the page re-renders right after the action resolves, and only a real
 * reload (which resets `useActionState`) makes the password disappear.
 */
function GeneratedCredentials({
  clientId,
  data,
  state,
}: {
  clientId: string;
  data: Record<string, string>;
  state: ActionState;
}) {
  const email = data.email ?? '';
  const password = data.password ?? '';
  return (
    <div>
      <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50 p-3">
        <p className="text-[12px] font-medium tracking-wide text-ink-500 uppercase">Temporary access</p>
        <dl className="mt-2 space-y-2 text-[14px]">
          <div>
            <dt className="text-ink-500">Status</dt>
            <dd className="mt-0.5 font-medium text-ink-900">Temporary access active</dd>
          </div>
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
      <Notice state={state} />
      <DisableForm clientId={clientId} />
    </div>
  );
}

export function AccountAccessPanel({ clientId, view }: { clientId: string; view: AdminAccessView }) {
  const [generateState, generateAction] = useActionState(generateTempAccessAction, IDLE);

  // Checked before `view`, and matched against `clientId`: this component
  // does not remount on an in-app move from one client's page to another's,
  // so a still-mounted result must never show on the wrong client.
  // Once the server says the access was switched off again (Disable pressed
  // in the box below), the old password stops being shown.
  const generated = generateState.data;
  const justGenerated =
    generated?.clientId === clientId &&
    Boolean(generated.email) &&
    Boolean(generated.password) &&
    view.temporary !== 'DISABLED';

  return (
    <div>
      <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
        <PermanentAccount view={view} />
        {justGenerated ? null : (
          <>
            <Row label="Temporary access">
              {view.temporary === 'ACTIVE'
                ? view.temporaryBlocked
                  ? 'On, but it cannot sign in'
                  : 'Temporary access active'
                : view.temporary === 'DISABLED'
                  ? 'Temporary access disabled'
                  : 'No temporary access'}
            </Row>
            {view.temporary === 'ACTIVE' && view.temporaryEmail ? (
              <Row label="Temporary email">
                <span className="font-mono">{view.temporaryEmail}</span>
              </Row>
            ) : null}
          </>
        )}
      </dl>

      {justGenerated ? (
        <GeneratedCredentials clientId={clientId} data={generated!} state={generateState} />
      ) : view.temporaryBlocked ? (
        <div className="mt-3">
          <p className="text-[13px] leading-relaxed text-ink-600">
            {view.temporaryBlocked === 'STAFF'
              ? 'This owner is Headway staff, so a temporary login cannot sign in as them.'
              : 'This owner also belongs to another business, so a temporary login cannot sign in as them.'}
            {view.temporary === 'ACTIVE' ? ' Switch it off to tidy up.' : ''}
          </p>
          {view.temporary === 'ACTIVE' ? <DisableForm clientId={clientId} /> : null}
        </div>
      ) : view.temporary === 'ACTIVE' ? (
        <div className="mt-3">
          <p className="text-[13px] leading-relaxed text-ink-600">
            {view.ownLogin?.confirmed === true
              ? 'The owner has their own sign-in now. Disable temporary access when they no longer need it; their own email and password keep working.'
              : 'The password was shown once, when it was generated. If it is lost, disable temporary access and enable it again for a new one.'}
          </p>
          <DisableForm clientId={clientId} />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[13px] leading-relaxed text-ink-600">
            {view.temporary === 'DISABLED'
              ? 'The temporary email and password do not work.'
              : 'Generate a temporary email and password to hand to the owner. No email is sent.'}
            {view.ownLogin ? ' The permanent account is not affected.' : ''}
          </p>
          <GenerateForm
            clientId={clientId}
            state={generateState}
            action={generateAction}
            label={view.temporary === 'DISABLED' ? 'Enable temporary access' : 'Generate temporary access'}
          />
        </div>
      )}
    </div>
  );
}
