'use client';

import { ActionForm, TextField } from '@/components/forms/form-shell';
import { saveTrialDefaultDaysAction } from '@/lib/actions/commercial';

/**
 * How long a new trial runs (M23).
 *
 * One number, installation-wide. It is read by the database function that
 * creates a business, so a trial started by signup and a trial started from the
 * client page agree without either knowing about the other. Changing it here
 * changes nothing for a trial already running.
 */
export function TrialSettingsForm({ days }: { days: number }) {
  return (
    <ActionForm
      action={saveTrialDefaultDaysAction}
      submitLabel="Save"
      submittingLabel="Saving…"
      footerNote="Applies to trials started from now on. Existing trials keep their dates."
    >
      <TextField
        name="trialDays"
        label="Trial length, in days"
        type="number"
        min={1}
        max={365}
        step={1}
        defaultValue={days}
        className="max-w-xs"
        hint="Whole days, between 1 and 365. New businesses start on a trial of this length."
      />
    </ActionForm>
  );
}
