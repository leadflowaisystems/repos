'use client';

import { useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { CopyButton } from '@/components/copy-button';
import { regeneratePortalTokenAction, setPortalLinkSentAction } from '@/lib/actions/portal';

/**
 * The owner's private workspace link, and the one control that revokes it.
 *
 * Regeneration is behind a confirmation because it silently breaks whatever
 * the owner has bookmarked — which is exactly what it is for, but not
 * something to do with a stray click.
 */
export function PortalLinkPanel({
  clientId,
  url,
  href,
  addressWarning,
  justRegenerated,
  sent,
}: {
  clientId: string;
  /** The whole address, for sending to the owner. */
  url: string;
  /** The same page on this computer, for opening it here. */
  href: string;
  /** Set when RepOS cannot build a whole address yet. */
  addressWarning: string | null;
  justRegenerated: boolean;
  /** Whether the operator has recorded actually handing this over. */
  sent: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      {addressWarning ? (
        <Notice tone="warn" title="This link is not ready to send yet">
          {addressWarning} Until then it only opens on this computer.
        </Notice>
      ) : null}
      {justRegenerated ? (
        <Notice tone="good">
          A new link has been issued. The previous one no longer opens anything — send the owner
          the new address below.
        </Notice>
      ) : null}

      <p className="text-[13px] break-all text-ink-800">{url}</p>

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={url} label="Copy owner link" />
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
        >
          Open client view
        </Button>

        <form action={setPortalLinkSentAction}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="sent" value={sent ? '' : 'on'} />
          <Button type="submit" variant={sent ? 'ghost' : 'secondary'}>
            {sent ? 'Not sent after all' : 'I have sent this to the owner'}
          </Button>
        </form>

        {confirming ? (
          <form action={regeneratePortalTokenAction} className="flex items-center gap-2">
            <input type="hidden" name="clientId" value={clientId} />
            <span className="text-[12px] text-ink-600">
              This stops the owner&rsquo;s current link working. Continue?
            </span>
            <Button type="submit" variant="danger">
              Yes, issue a new link
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
            Issue a new link
          </Button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-500">
        Anyone with this address can read this business&rsquo;s workspace, so treat it like a
        password: send it to the owner directly, and issue a new one if it goes anywhere else.
      </p>
    </div>
  );
}
