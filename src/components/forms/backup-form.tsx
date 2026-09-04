'use client';

import { ActionForm } from '@/components/forms/form-shell';
import { takeBackupAction } from '@/lib/actions/backup';

/**
 * One button. Pressing it writes a checked copy of the database and says what
 * happened — the whole feature, deliberately.
 */
export function TakeBackupForm() {
  return (
    <ActionForm
      action={takeBackupAction}
      submitLabel="Take a backup now"
      submittingLabel="Copying…"
      footerNote="Nothing is uploaded. The copy is written to this computer only."
    >
      {null}
    </ActionForm>
  );
}
