'use client';

import { useState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { ActionForm, FieldError } from '@/components/forms/form-shell';
import {
  archiveClientAction,
  purgeClientAction,
  restoreClientAction,
} from '@/lib/actions/clients';

/**
 * Two very different operations, deliberately kept apart in the UI.
 *
 * Archive  — the everyday action. Hides the client from working views and
 *            keeps every snapshot, so past months stay comparable.
 * Delete   — the delete-on-request action. Destroys the history. Requires the
 *            business name to be typed exactly, re-checked on the server.
 */

export function ArchiveClientButton({
  clientId,
  businessName,
  size = 'default',
}: {
  clientId: string;
  businessName: string;
  size?: 'default' | 'compact';
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        onClick={() => setConfirming(true)}
        className={size === 'compact' ? 'px-2.5 py-1 text-[12px]' : undefined}
      >
        Archive
      </Button>
    );
  }

  return (
    <form action={archiveClientAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={clientId} />
      <span className="text-[12px] text-ink-600">
        Archive {businessName}? History is kept.
      </span>
      <Button type="submit" variant="primary" className="px-2.5 py-1 text-[12px]">
        Yes, archive
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="px-2.5 py-1 text-[12px]"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </form>
  );
}

export function RestoreClientButton({ clientId }: { clientId: string }) {
  return (
    <form action={restoreClientAction}>
      <input type="hidden" name="id" value={clientId} />
      <Button type="submit" className="px-2.5 py-1 text-[12px]">
        Restore
      </Button>
    </form>
  );
}

export function ArchiveClientPanel({
  clientId,
  businessName,
  archived,
  snapshotCount,
}: {
  clientId: string;
  businessName: string;
  archived: boolean;
  snapshotCount: number;
}) {
  if (archived) {
    return (
      <div className="space-y-4">
        <Notice tone="warn">
          This client is archived. It is hidden from the working client list.
          {snapshotCount === 0
            ? ' Nothing has been deleted.'
            : ` All ${snapshotCount} snapshot${snapshotCount === 1 ? '' : 's'} and every time entry are intact.`}
        </Notice>
        <form action={restoreClientAction}>
          <input type="hidden" name="id" value={clientId} />
          <Button type="submit" variant="primary">
            Restore to active list
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Notice tone="neutral">
        Archiving is the normal way to stop working with a client. The client
        disappears from your working list, and every snapshot, pasted feedback
        item and time entry is preserved so past months remain comparable.
      </Notice>
      <ArchiveClientButton clientId={clientId} businessName={businessName} />
    </div>
  );
}

export function PurgeClientPanel({
  clientId,
  businessName,
  snapshotCount,
}: {
  clientId: string;
  businessName: string;
  snapshotCount: number;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === businessName;

  return (
    <ActionForm
      action={purgeClientAction}
      submitLabel="Delete permanently"
      submittingLabel="Deleting…"
      submitVariant="danger"
      submitDisabled={!matches}
    >
      <input type="hidden" name="id" value={clientId} />
      <Notice tone="bad" title="This destroys history">
        Permanent deletion removes the knowledge profile, policies, competitors,{' '}
        {snapshotCount === 0
          ? 'any snapshots'
          : `all ${snapshotCount} snapshot${snapshotCount === 1 ? '' : 's'}`}
        , every pasted feedback item, the kit configuration and all time entries.
        Use this only for a genuine delete-on-request from the business owner —
        otherwise archive instead.
      </Notice>
      <Field
        label={
          <>
            Type <span className="font-mono font-semibold">{businessName}</span>{' '}
            to confirm
          </>
        }
        className="max-w-md"
      >
        <Input
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder={businessName}
        />
        <FieldError name="confirm" />
      </Field>
      {!matches ? (
        <p className="text-[12px] text-ink-500">
          The delete button stays disabled until the name matches exactly.
        </p>
      ) : null}
    </ActionForm>
  );
}
