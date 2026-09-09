'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import {
  acceptInviteAction,
  inviteMemberAction,
  revokeInviteAction,
  setMembershipAction,
} from '@/lib/actions/team';
import { IDLE, type ActionState } from '@/lib/actions/shared';
import { CopyButton } from '@/components/copy-button';
import { useT } from '@/components/portal/locale-provider';

/**
 * TEAM FORMS (M20 Stage 4, put into three languages in M31).
 *
 * Owner-only controls. Staff never see this page, but the forms do not rely on
 * that: every action re-checks the role on the server, because a hidden button
 * is a design decision and not a security boundary.
 *
 * These run in the browser, so they cannot read the language cookie for
 * themselves — `useT` reads the finished strings the workspace shell handed
 * down. Outside that shell (the invitation page has its own root) it answers in
 * English, which is right: that page has not asked anybody for a language yet.
 *
 * The messages that come back from a server action are NOT translated here.
 * They are written by `@/lib/actions/team` and belong to it; putting a second
 * copy of them in this file is how the two would drift apart.
 */

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-ink-900 px-4 text-[15px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400';
const QUIET =
  'inline-flex min-h-11 items-center rounded-lg border border-ink-300 bg-white px-3 text-[13px] font-medium text-ink-700 hover:border-ink-400 disabled:text-ink-400';

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={clsx(
        'mt-3 rounded-xl border px-4 py-3 text-[14px] break-words',
        state.ok
          ? 'border-good-200 bg-good-50 text-good-700'
          : 'border-bad-200 bg-bad-50 text-bad-700',
      )}
    >
      {state.message}
    </p>
  );
}

export function InviteForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(inviteMemberAction, IDLE);
  const t = useT();
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="invite-email" className="block text-[14px] font-medium text-ink-800">
            {t('team.form.emailLabel')}
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="them@example.com"
            aria-invalid={state.errors.email ? true : undefined}
            className={clsx(
              'mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-[16px] text-ink-900 placeholder:text-ink-400',
              state.errors.email ? 'border-bad-600' : 'border-ink-300',
            )}
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="block text-[14px] font-medium text-ink-800">
            {t('team.form.roleLabel')}
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="BUSINESS_STAFF"
            className="mt-1.5 rounded-xl border border-ink-300 bg-white px-4 py-2.5 text-[16px] text-ink-900"
          >
            <option value="BUSINESS_STAFF">{t('team.role.staff')}</option>
            <option value="BUSINESS_OWNER">{t('team.role.owner')}</option>
          </select>
        </div>
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? t('team.form.creating') : t('team.form.create')}
        </button>
      </div>
      {state.errors.email ? (
        <p className="mt-1 text-[13px] text-bad-700">{state.errors.email}</p>
      ) : null}
      <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{t('team.form.help')}</p>
      <Notice state={state} />
      {state.data?.link ? (
        <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50 p-3">
          <p className="text-[12px] font-medium tracking-wide text-ink-500 uppercase">
            {state.data.sent === 'yes'
              ? t('team.form.linkBackup')
              : t('team.form.linkSend')}
          </p>
          <p className="mt-1.5 font-mono text-[12px] break-all text-ink-700">{state.data.link}</p>
          <div className="mt-2.5">
            <CopyButton
              value={state.data.link}
              label={t('team.form.copyLink')}
              copiedLabel={t('team.form.copied')}
            />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
            {t('team.form.linkNote', { email: state.data.email ?? '' })}
          </p>
        </div>
      ) : null}
    </form>
  );
}

/**
 * Calls off an invitation nobody has accepted yet. The button says "Cancel",
 * because revoke is the action's name and not a word an owner uses; the row's
 * own email says what is being cancelled, which is why the label stays one
 * word and does not push the row onto a second line on a phone.
 */
export function RevokeInviteButton({
  clientId,
  inviteId,
}: {
  clientId: string;
  inviteId: string;
}) {
  const [state, action, pending] = useActionState(revokeInviteAction, IDLE);
  const t = useT();
  return (
    <form action={action}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      <button type="submit" disabled={pending} className={QUIET}>
        {pending ? t('team.invite.cancelling') : t('team.invite.cancel')}
      </button>
      {state.message && !state.ok ? (
        <p className="mt-1 text-[13px] text-bad-700">{state.message}</p>
      ) : null}
    </form>
  );
}

/** Suspend, restore, or change what someone may do. */
export function MembershipControls({
  clientId,
  membershipId,
  role,
  status,
  isLastOwner,
}: {
  clientId: string;
  membershipId: string;
  role: string;
  status: string;
  isLastOwner: boolean;
}) {
  const [state, action, pending] = useActionState(setMembershipAction, IDLE);
  const t = useT();
  const suspended = status !== 'ACTIVE';

  if (isLastOwner) {
    return <p className="text-[13px] text-ink-500">{t('team.member.lastOwner')}</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="membershipId" value={membershipId} />
      <button
        type="submit"
        name="role"
        value={role === 'BUSINESS_OWNER' ? 'BUSINESS_STAFF' : 'BUSINESS_OWNER'}
        disabled={pending}
        className={QUIET}
      >
        {/* One whole label per direction. "Make " + a word was English word
            order shipped as if it were universal. */}
        {role === 'BUSINESS_OWNER'
          ? t('team.member.makeStaff')
          : t('team.member.makeOwner')}
      </button>
      <button
        type="submit"
        name="status"
        value={suspended ? 'ACTIVE' : 'SUSPENDED'}
        disabled={pending}
        className={QUIET}
      >
        {suspended ? t('team.member.giveAccessBack') : t('team.member.stopAccess')}
      </button>
      {state.message && !state.ok ? (
        <p className="w-full text-[13px] text-bad-700">{state.message}</p>
      ) : null}
    </form>
  );
}

/** The one control on the invitation page. */
export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, IDLE);
  const t = useT();
  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className={clsx(BUTTON, 'w-full')}>
        {pending ? t('team.accept.joining') : t('team.accept.button')}
      </button>
      <Notice state={state} />
    </form>
  );
}
