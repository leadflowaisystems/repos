'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button, Notice } from '@/components/ui';
import {
  ActionForm,
  FormGrid,
  TextField,
} from '@/components/forms/form-shell';
import {
  saveKitConfigAction,
  saveReviewLinkAction,
  setKitInstalledAction,
} from '@/lib/actions/kit';

/**
 * The one-field fast path.
 *
 * A new client should go create → paste link → printable kit. That is the whole
 * setup, so this is the whole form.
 */
export function ReviewLinkForm({
  clientId,
  defaultValue,
  hint,
}: {
  clientId: string;
  defaultValue: string;
  hint: string;
}) {
  return (
    <ActionForm
      action={saveReviewLinkAction}
      submitLabel="Save link"
      submittingLabel="Saving…"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <TextField
        name="qrTargetUrl"
        label="Public review link"
        type="url"
        defaultValue={defaultValue}
        placeholder="https://…"
        hint={hint}
        autoComplete="off"
      />
    </ActionForm>
  );
}

/**
 * Everything else, behind progressive disclosure. An operator never has to open
 * this: every field falls back to the client's vertical wording when left blank.
 */
export function KitSettingsForm({
  clientId,
  values,
  verticalLabel,
}: {
  clientId: string;
  values: {
    qrTargetUrl: string;
    displayName: string;
    headline: string;
    subhead: string;
    footerNote: string;
    brandPrimary: string;
    brandSecondary: string;
  };
  verticalLabel: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Customise wording and colours
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Notice tone="neutral">
        Leave anything blank to use the {verticalLabel} wording. RepOS only
        overrides a line when you actually type one.
      </Notice>

      <ActionForm
        action={saveKitConfigAction}
        submitLabel="Save changes"
        secondaryAction={
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <input type="hidden" name="clientId" value={clientId} />

        <TextField
          name="qrTargetUrl"
          label="Public review link"
          type="url"
          defaultValue={values.qrTargetUrl}
          placeholder="https://…"
          hint="Pasted in by you. RepOS never looks this up."
        />

        <FormGrid>
          <TextField
            name="displayName"
            label="Name on the card"
            defaultValue={values.displayName}
            placeholder="Leave blank to use the business name"
          />
          <TextField
            name="footerNote"
            label="Footer line"
            defaultValue={values.footerNote}
            placeholder="Leave blank for the default"
          />
          <TextField
            name="headline"
            label="Headline"
            defaultValue={values.headline}
            placeholder="Leave blank for the default"
          />
          <TextField
            name="subhead"
            label="Sub-line"
            defaultValue={values.subhead}
            placeholder="Leave blank for the default"
          />
          <TextField
            name="brandPrimary"
            label="Brand colour"
            type="color"
            defaultValue={values.brandPrimary}
            className="h-10 p-1"
          />
          <TextField
            name="brandSecondary"
            label="Accent colour"
            type="color"
            defaultValue={values.brandSecondary}
            className="h-10 p-1"
          />
        </FormGrid>
      </ActionForm>
    </div>
  );
}

/** One-click "the stand is physically on the counter now". */
export function KitInstalledToggle({
  clientId,
  installed,
}: {
  clientId: string;
  installed: boolean;
}) {
  return (
    <form action={setKitInstalledAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="installed" value={installed ? '' : 'on'} />
      <SubmitButton variant={installed ? 'ghost' : 'secondary'}>
        {installed ? 'Mark as not installed' : 'Mark as installed on site'}
      </SubmitButton>
    </form>
  );
}
