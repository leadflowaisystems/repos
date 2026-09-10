'use client';

import { useActionState } from 'react';
import { acknowledgeKitOrderReceivedAction } from '@/lib/actions/kit';
import { IDLE } from '@/lib/actions/shared';
import { useT } from '@/components/portal/locale-provider';

/**
 * THE BUSINESS SAYS THE KIT ARRIVED (M36).
 *
 * One tick, on their own order, and only after Headway has said it sent the
 * thing — a shop cannot confirm the arrival of something nobody claims to have
 * posted, so the page does not render this until then.
 *
 * IT SAYS ONE FACT AND CARRIES NOTHING ELSE. The form posts the order's id and
 * the client id the gate will check; the date is the server's clock and the
 * person is the session. Price, total, items, quantities, status, and who
 * delivered it are not fields here and are not parameters of anything this
 * reaches — a business could not change them by posting them.
 */
export function KitOrderReceiptForm({
  clientId,
  orderId,
  receivedOn,
}: {
  clientId: string;
  orderId: string;
  /** Already-formatted date, or null if they have not confirmed yet. */
  receivedOn: string | null;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(acknowledgeKitOrderReceivedAction, IDLE);

  // Once it is confirmed it stays confirmed. There is no un-receiving a thing
  // that arrived, and a control offering it would only invite a mistake.
  if (receivedOn || state.ok) {
    return (
      <p className="mt-3 text-[14px] font-medium text-good-700">
        <span aria-hidden>☑</span> {t('kit.receipt.done')}
        <span className="ml-2 font-normal text-ink-500">
          {receivedOn ? t('kit.receipt.doneOn', { date: receivedOn }) : ''}
        </span>
      </p>
    );
  }

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center gap-2.5 rounded-xl border border-ink-300 bg-white px-4 text-[15px] font-medium text-ink-900 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none disabled:opacity-60"
      >
        {/* A drawn box rather than a real checkbox: this submits, and a
            checkbox that submits on tick is a control that lies about being
            reversible. */}
        <span
          aria-hidden
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-ink-400"
        />
        {pending ? t('kit.receipt.saving') : t('kit.receipt.cta')}
      </button>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{t('kit.receipt.hint')}</p>
      {state.message && !state.ok ? (
        <p role="alert" className="mt-2 text-[13px] leading-relaxed text-bad-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
