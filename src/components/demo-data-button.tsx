'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui';
import { seedDemoDataAction } from '@/lib/actions/clients';

/**
 * Creates one clearly-labelled demo client so the app can be explored without
 * inventing data by hand. Everything it creates is prefixed "Demo —" and can be
 * deleted like any other client.
 */
export function DemoDataButton() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" onClick={() => setConfirming(true)}>
        Add demo client
      </Button>
    );
  }

  return (
    <form action={seedDemoDataAction} className="flex items-center gap-2">
      <input type="hidden" name="confirm" value="1" />
      <span className="text-[12px] text-ink-600">Create a demo client?</span>
      <SubmitButton variant="primary">
        Yes, create
      </SubmitButton>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
