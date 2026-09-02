'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';

/**
 * Copy with inline confirmation.
 *
 * The operator is usually mid-conversation with a client when they use this, so
 * the confirmation happens in place rather than as a toast they have to notice.
 */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'secondary',
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API needs a secure context. Over plain http on the LAN it can
      // be unavailable, so fall back to the old selection trick.
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(area);
      }
    }

    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={copy}
      className={className}
      aria-live="polite"
    >
      {copied ? `✓ ${copiedLabel}` : label}
    </Button>
  );
}

/** Opens the printable sheet in a new tab, which then triggers the print dialog. */
export function PrintKitButton({ href }: { href: string }) {
  return (
    <Button
      type="button"
      variant="primary"
      onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
    >
      Print kit
    </Button>
  );
}

/** Used on the print sheet itself. */
export function PrintNowButton() {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
