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
import { useT } from '@/components/portal/locale-provider';

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
  const t = useT();
  return (
    <ActionForm
      action={saveReviewLinkAction}
      submitLabel={t('kit.form.saveLink')}
      submittingLabel={t('kit.form.saving')}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <TextField
        name="qrTargetUrl"
        label={t('kit.form.reviewLink.label')}
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
 *
 * THE BLANK-FIELD SENTENCE IS ONE PHRASE, NOT THREE. It used to be built on
 * screen out of an English fragment, the vertical's name, and a second English
 * fragment, which is a shape that only ever reads correctly in English —
 * Hindi and Marathi put the name somewhere else in the sentence entirely. The
 * whole sentence is one dictionary entry with the name as `{type}`, so each
 * language decides for itself where the name goes.
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
  const t = useT();

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        {t('kit.form.customise')}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <Notice tone="neutral">{t('kit.form.defaults', { type: verticalLabel })}</Notice>

      <ActionForm
        action={saveKitConfigAction}
        submitLabel={t('kit.form.saveChanges')}
        secondaryAction={
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t('kit.form.close')}
          </Button>
        }
      >
        <input type="hidden" name="clientId" value={clientId} />

        <TextField
          name="qrTargetUrl"
          label={t('kit.form.reviewLink.label')}
          type="url"
          defaultValue={values.qrTargetUrl}
          placeholder="https://…"
          hint={t('kit.form.reviewLink.hint')}
        />

        <FormGrid>
          <TextField
            name="displayName"
            label={t('kit.form.displayName.label')}
            defaultValue={values.displayName}
            placeholder={t('kit.form.displayName.placeholder')}
          />
          <TextField
            name="footerNote"
            label={t('kit.form.footerNote.label')}
            defaultValue={values.footerNote}
            placeholder={t('kit.form.blankDefault')}
          />
          <TextField
            name="headline"
            label={t('kit.form.headline.label')}
            defaultValue={values.headline}
            placeholder={t('kit.form.blankDefault')}
          />
          <TextField
            name="subhead"
            label={t('kit.form.subhead.label')}
            defaultValue={values.subhead}
            placeholder={t('kit.form.blankDefault')}
          />
          <TextField
            name="brandPrimary"
            label={t('kit.form.brandPrimary.label')}
            type="color"
            defaultValue={values.brandPrimary}
            className="h-10 p-1"
          />
          <TextField
            name="brandSecondary"
            label={t('kit.form.brandSecondary.label')}
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
  const t = useT();
  return (
    <form action={setKitInstalledAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="installed" value={installed ? '' : 'on'} />
      <SubmitButton variant={installed ? 'ghost' : 'secondary'}>
        {installed ? t('kit.form.installed.unmark') : t('kit.form.installed.mark')}
      </SubmitButton>
    </form>
  );
}
