'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button, Notice } from '@/components/ui';
import { ActionForm, TextField } from '@/components/forms/form-shell';
import {
  savePublicBaseUrlAction,
  savePublicReviewUrlAction,
  setGatewayEnabledAction,
} from '@/lib/actions/gateway';

/**
 * Operator-side pieces of the feedback QR page (M14).
 *
 * Deliberately few: a link to add, a switch, an address, and two download
 * buttons. Everything else on the page is already done for the operator.
 */

/** The optional public review link, offered to every customer after sending. */
export function PublicReviewUrlForm({
  clientId,
  defaultValue,
}: {
  clientId: string;
  defaultValue: string;
}) {
  return (
    <ActionForm
      action={savePublicReviewUrlAction}
      submitLabel="Save link"
      submittingLabel="Saving…"
      footerNote="Leave it blank to remove the link."
    >
      <input type="hidden" name="clientId" value={clientId} />
      <TextField
        name="publicReviewUrl"
        label="Public review link"
        type="url"
        defaultValue={defaultValue}
        placeholder="https://…"
        autoComplete="off"
        hint="Open the business's public listing yourself, copy its “write a review” link and paste it here. RepOS never looks it up, never opens it, and never posts to it."
      />
    </ActionForm>
  );
}

/** Pause or resume the page. Paused, a scanned QR shows "not active" and stores nothing. */
export function GatewayEnabledToggle({
  clientId,
  enabled,
}: {
  clientId: string;
  enabled: boolean;
}) {
  return (
    <form action={setGatewayEnabledAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="enabled" value={enabled ? '' : 'on'} />
      <SubmitButton variant={enabled ? 'ghost' : 'primary'}>
        {enabled ? 'Pause feedback' : 'Resume feedback'}
      </SubmitButton>
    </form>
  );
}

/**
 * The address customers open — one setting for the whole installation.
 *
 * Shown with this computer's own network addresses as one-tap choices, so
 * setting it up in a shop is "tap the one that starts with 192" rather than
 * an explanation of what an IP address is.
 */
export function PublicBaseUrlForm({
  clientId,
  current,
  fromSetting,
  suggestions,
}: {
  clientId: string;
  current: string;
  fromSetting: boolean;
  suggestions: string[];
}) {
  const [value, setValue] = useState(fromSetting ? current : '');

  return (
    <ActionForm
      action={savePublicBaseUrlAction}
      submitLabel="Save address"
      submittingLabel="Saving…"
      footerNote="Applies to every client's QR. Cards already printed keep the address they were printed with."
    >
      <input type="hidden" name="clientId" value={clientId} />
      <TextField
        name="publicBaseUrl"
        label="Address customers open"
        type="url"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={current}
        autoComplete="off"
        hint={
          fromSetting
            ? 'Saved by you. Leave it blank and save to go back to the address RepOS is opened on.'
            : 'Blank means the address RepOS is opened on right now. Save one so the QR stays the same whichever way you open RepOS.'
        }
      />
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-500">This computer on the local network:</span>
          {suggestions.map((s) => (
            <Button
              key={s}
              type="button"
              variant="secondary"
              className="px-2.5 py-1 text-[12px]"
              onClick={() => setValue(s)}
            >
              Use {s}
            </Button>
          ))}
        </div>
      ) : null}
    </ActionForm>
  );
}

/** Download the QR as an image, with no server round-trip. */
export function QrDownloadButtons({
  pngDataUrl,
  svg,
  fileBase,
}: {
  pngDataUrl: string;
  svg: string;
  fileBase: string;
}) {
  const svgHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const link =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-[13px] font-medium text-ink-800 hover:bg-ink-50';
  return (
    <>
      <a href={pngDataUrl} download={`${fileBase}-feedback-qr.png`} className={link}>
        Download PNG
      </a>
      <a href={svgHref} download={`${fileBase}-feedback-qr.svg`} className={link}>
        Download SVG
      </a>
    </>
  );
}

/** Opens a page in a new tab. Used for the customer preview and the print sheet. */
export function OpenInNewTabButton({
  href,
  label,
  variant = 'secondary',
}: {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
    >
      {label}
    </Button>
  );
}

/** A one-line, dismissible note for pages that want to explain themselves once. */
export function InlineHint({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" className="px-2 py-1 text-[12px]" onClick={() => setOpen(true)}>
        How is this different from the print kit?
      </Button>
    );
  }
  return (
    <Notice tone="neutral">
      {children}{' '}
      <button type="button" className="underline underline-offset-2" onClick={() => setOpen(false)}>
        Close
      </button>
    </Notice>
  );
}
