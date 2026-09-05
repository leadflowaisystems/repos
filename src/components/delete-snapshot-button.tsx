'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui';
import { deleteSnapshotAction } from '@/lib/actions/snapshots';

/**
 * Deleting a snapshot removes a month of history, so it asks first and says
 * exactly what goes with it.
 */
export function DeleteSnapshotButton({
  clientId,
  snapshotId,
  feedbackCount,
}: {
  clientId: string;
  snapshotId: string;
  feedbackCount: number;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
        Delete snapshot
      </Button>
    );
  }

  return (
    <form action={deleteSnapshotAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="snapshotId" value={snapshotId} />
      <span className="text-[12px] text-ink-600">
        Delete this snapshot and its {feedbackCount} stored feedback item
        {feedbackCount === 1 ? '' : 's'}?
      </span>
      <SubmitButton variant="danger">
        Yes, delete
      </SubmitButton>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
