'use client';

import { useActionState, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/forms/submit-button';
import {
  deleteKitOrderAction,
  markKitOrderCompletedAction,
} from '@/lib/actions/kit';
import { IDLE } from '@/lib/actions/shared';

/**
 * THE OPERATOR'S TWO CONTROLS ON ONE ORDER (M36, reworded M37).
 *
 * Marking it finished, and removing it. Both post nothing but the order's id:
 * the timestamp is the server's clock, the person is the session, and the
 * permission is re-established server-side by an admin gate. A browser that
 * posted a date, a name or a status would be posting fields nothing reads.
 */

/**
 * "Order completed" — a one-way tick.
 *
 * Once an order is finished it stays finished, so this becomes a statement
 * rather than a control. There is no untick: un-finishing is not a thing that
 * happens, and offering it would invite somebody to erase a fact by accident.
 */
export function OrderCompletedControl({
  orderId,
  completedOn,
  completedByName,
}: {
  orderId: string;
  /** Already-formatted date, or null if it is not finished yet. */
  completedOn: string | null;
  completedByName: string | null;
}) {
  const [state, action, pending] = useActionState(markKitOrderCompletedAction, IDLE);

  if (completedOn) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
        <span className="font-medium text-ink-900">
          <span aria-hidden>☑</span> Order completed
        </span>
        <span className="text-ink-500">
          Completed {completedOn}
          {completedByName ? ` by ${completedByName}` : ''}
        </span>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="primary">
          {pending ? 'Saving…' : 'Mark order completed'}
        </SubmitButton>
        <span className="text-[12px] text-ink-500">
          Records the date and your name. It does not mark the order received —
          only the client can say that.
        </span>
      </div>
      {state.message && !state.ok ? (
        <p role="alert" className="mt-3 text-[13px] text-bad-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * "Delete order" — secondary, and two taps away from happening.
 *
 * The confirmation is the house pattern (see ArchiveClientButton): the button
 * swaps itself for a question with Cancel first. Nothing is destroyed by a
 * single click, and the server checks the permission again regardless of what
 * the browser claims happened here.
 */
export function DeleteOrderControl({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteKitOrderAction, IDLE);

  if (!confirming) {
    return (
      <div>
        <Button
          type="button"
          variant="danger"
          className="px-2.5 py-1 text-[12px]"
          onClick={() => setConfirming(true)}
        >
          Delete order
        </Button>
        {state.message && !state.ok ? (
          <p role="alert" className="mt-3 text-[13px] text-bad-700">
            {state.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Notice tone="bad" title={`Delete order ${orderNumber}?`}>
        This cannot be undone. The order disappears from this list, from the
        client&rsquo;s own Orders page and from their client record. Nothing
        else about the client is touched.
      </Notice>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        <Button
          type="button"
          variant="secondary"
          className="px-2.5 py-1 text-[12px]"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <SubmitButton variant="danger" className="px-2.5 py-1 text-[12px]">
          {pending ? 'Deleting…' : 'Delete order'}
        </SubmitButton>
      </form>
    </div>
  );
}
