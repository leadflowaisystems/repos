'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui';

/**
 * A submit button that admits it is working.
 *
 * Server actions on a remote database take long enough that a button which
 * neither moves nor greys out reads as a button that did nothing — which is
 * exactly how a successful portal rotation appeared to fail earlier in M20.
 *
 * `useFormStatus` reports the state of the form this button is inside, so the
 * component needs no props threaded through and cannot disagree with the form
 * it belongs to. Disabling while pending is not decoration either: it is what
 * stops a second submission from a second click.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...rest
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...rest}>
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
