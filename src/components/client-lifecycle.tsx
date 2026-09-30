'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { SubmitButton } from '@/components/forms/submit-button';
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
 * Delete   — the delete-on-request action, for ARCHIVED clients only.
 *            Destroys the history. Requires the business name to be typed
 *            exactly in a confirmation dialog, re-checked on the server.
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
      <SubmitButton variant="primary" className="px-2.5 py-1 text-[12px]">
        Yes, archive
      </SubmitButton>
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
      <SubmitButton className="px-2.5 py-1 text-[12px]">
        Restore
      </SubmitButton>
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
          <SubmitButton variant="primary">
            Restore to active list
          </SubmitButton>
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

/**
 * DELETE PERMANENTLY — for an archived client, and only an archived one.
 *
 * Deliberately two steps away from anything: the business must already be in
 * the archive, the button opens a dialog rather than acting, and the dialog's
 * own button stays disabled until the business name is typed exactly. The
 * server re-checks all three (`purgeClient`); this is the part that stops the
 * slip, not the part that stops the attack.
 *
 * A native modal <dialog>: it traps focus, closes on Escape, and returns focus
 * to the button that opened it, without a dialog library. The typed name is
 * cleared every time it closes, so reopening never finds it pre-filled.
 */
export function DeleteArchivedClientButton({
  clientId,
  businessName,
  size = 'compact',
}: {
  clientId: string;
  businessName: string;
  size?: 'default' | 'compact';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === businessName;
  const titleId = `delete-client-${clientId}-title`;
  const descId = `delete-client-${clientId}-desc`;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => dialog.current?.showModal()}
        className={clsx(
          'text-bad-700 hover:bg-bad-50 hover:text-bad-700',
          size === 'compact' && 'px-2.5 py-1 text-[12px]',
        )}
      >
        Delete permanently
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={() => setTyped('')}
        className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-ink-200 bg-white p-0 text-left text-ink-900 shadow-xl backdrop:bg-ink-900/50"
      >
        <div className="p-5 sm:p-6">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-bad-700 uppercase">
            Permanent deletion
          </p>
          <h2 id={titleId} className="mt-1.5 text-[20px] leading-snug font-semibold text-balance text-ink-900">
            Delete {businessName} permanently?
          </h2>
          <p id={descId} className="mt-2 text-[14px] leading-relaxed text-ink-700">
            This will permanently remove this client&rsquo;s workspace and stored data. This
            cannot be undone.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-600">
            <li>
              Every feedback response, check-in, improvement, note, kit order and setting for
              this business.
            </li>
            <li>Its feedback QR code and link stop working, and so does the owner&rsquo;s workspace.</li>
            <li>
              Team members lose access to this business. Their own sign-in accounts, and any
              other business they use, are not touched.
            </li>
          </ul>

          <ActionForm
            action={purgeClientAction}
            submitLabel="Delete permanently"
            submittingLabel="Deleting…"
            submitVariant="danger"
            submitDisabled={!matches}
            className="mt-5"
            secondaryAction={
              <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
                Cancel
              </Button>
            }
          >
            <input type="hidden" name="id" value={clientId} />
            <Field
              label={
                <>
                  Type <span className="font-mono font-semibold">{businessName}</span> to confirm
                </>
              }
              hint="The delete button stays disabled until the name matches exactly."
            >
              <Input
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <FieldError name="confirm" />
            </Field>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}

/**
 * The edit page's delete card. Archived: the same dialog the archive list
 * uses. In service: no delete at all, only the way to it.
 */
export function PurgeClientPanel({
  clientId,
  businessName,
  archived,
}: {
  clientId: string;
  businessName: string;
  archived: boolean;
}) {
  if (!archived) {
    return (
      <Notice tone="neutral">
        Only an archived client can be deleted permanently. Archive this client first; it
        will then appear under Archived, where it can be restored or deleted.
      </Notice>
    );
  }
  return (
    <div className="space-y-4">
      <Notice tone="bad" title="This cannot be undone">
        Permanent deletion removes this business&rsquo;s workspace and every record it holds.
        Use it only for a genuine delete-on-request — otherwise leave it archived.
      </Notice>
      <DeleteArchivedClientButton clientId={clientId} businessName={businessName} size="default" />
    </div>
  );
}
