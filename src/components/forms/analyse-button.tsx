'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui';
import { analyseFeedbackAction } from '@/lib/actions/analysis';

/**
 * "Analyse feedback".
 *
 * Runs in the request, so the button reports that it is working rather than
 * pretending a background job exists.
 */
function SubmitButton({
  label,
  busyLabel,
  variant = 'primary',
}: {
  label: string;
  busyLabel: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? busyLabel : label}
    </Button>
  );
}

export function AnalyseFeedbackButton({
  clientId,
  needsAnalysis,
}: {
  clientId: string;
  needsAnalysis: number;
}) {
  return (
    <form action={analyseFeedbackAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <SubmitButton
        label={
          needsAnalysis > 0 ? `Read ${needsAnalysis} new` : 'Analyse feedback'
        }
        busyLabel="Reading…"
      />
    </form>
  );
}

/** Re-reads everything, for when the operator wants a fresh pass. */
export function ReanalyseButton({ clientId }: { clientId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        Read again
      </Button>
    );
  }

  return (
    <form action={analyseFeedbackAction} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="force" value="on" />
      <span className="text-[12px] text-ink-600">Read everything again?</span>
      <SubmitButton label="Yes, read again" busyLabel="Reading…" variant="secondary" />
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
