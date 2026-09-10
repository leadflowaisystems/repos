'use client';

import { useActionState, useState } from 'react';
import { Input } from '@/components/ui';
import { SubmitButton } from '@/components/forms/submit-button';
import { setClientTrialAction } from '@/lib/actions/commercial';
import { IDLE } from '@/lib/actions/shared';

/**
 * THIS ONE BUSINESS'S TRIAL (M37).
 *
 * Two ways to say the same thing, and the operator picks one: the day it ends,
 * or how many days it runs. Only one is submitted — the radio decides which
 * field the server reads — so there is never a pair of values that could
 * disagree about when the trial is over.
 *
 * It does not touch the global default, which decides how long a NEW trial
 * runs. It does not touch the subscription status, the lock, the pause or the
 * exemption either: an operator setting a date should not quietly drag a
 * paying business back into a trial.
 */
export function TrialSettingsForm({
  clientId,
  trialEndsAt,
  trialDays,
  inTrial,
}: {
  clientId: string;
  /** The current end as `YYYY-MM-DD`, for the date field's starting value. */
  trialEndsAt: string;
  /** The current length in days, for the days field's starting value. */
  trialDays: number | null;
  /** False when the business is not on a trial, which the note explains. */
  inTrial: boolean;
}) {
  const [state, action, pending] = useActionState(setClientTrialAction, IDLE);
  const [mode, setMode] = useState<'date' | 'days'>('date');

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />

      <fieldset className="space-y-3">
        <legend className="text-[13px] font-medium text-ink-700">Trial</legend>

        <label className="flex items-start gap-2.5">
          <input
            type="radio"
            name="mode"
            value="date"
            checked={mode === 'date'}
            onChange={() => setMode('date')}
            className="mt-2 h-4 w-4 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="text-[13px] text-ink-800">End date</span>
            <Input
              type="date"
              name="trialEndDate"
              defaultValue={trialEndsAt}
              disabled={mode !== 'date'}
              className="mt-1"
            />
            {state.errors.trialEndDate ? (
              <span role="alert" className="mt-1.5 block text-[12px] font-medium text-bad-700">
                {state.errors.trialEndDate}
              </span>
            ) : null}
          </span>
        </label>

        <label className="flex items-start gap-2.5">
          <input
            type="radio"
            name="mode"
            value="days"
            checked={mode === 'days'}
            onChange={() => setMode('days')}
            className="mt-2 h-4 w-4 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="text-[13px] text-ink-800">Trial days</span>
            <Input
              type="number"
              name="trialDays"
              min={1}
              max={365}
              defaultValue={trialDays ?? ''}
              disabled={mode !== 'days'}
              placeholder="21"
              className="mt-1"
            />
            {state.errors.trialDays ? (
              <span role="alert" className="mt-1.5 block text-[12px] font-medium text-bad-700">
                {state.errors.trialDays}
              </span>
            ) : null}
          </span>
        </label>
      </fieldset>

      <p className="text-[12px] leading-relaxed text-ink-500">
        {mode === 'days'
          ? 'Counted from the day this trial started, so the end moves rather than the beginning.'
          : 'The trial runs to the end of that day.'}{' '}
        This changes this business only — the default length for new trials is in
        Settings.
      </p>

      {!inTrial ? (
        <p className="text-[12px] leading-relaxed text-warn-700">
          This business is not on a trial right now, so the date is stored but
          nothing reads it until one starts. Nothing else about their account
          changes.
        </p>
      ) : null}

      <SubmitButton variant="primary">
        {pending ? 'Saving…' : 'Save trial'}
      </SubmitButton>

      {state.message ? (
        <p
          role="status"
          className={state.ok ? 'text-[13px] text-good-700' : 'text-[13px] text-bad-700'}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
