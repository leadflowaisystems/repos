'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Notice, Textarea } from '@/components/ui';
import { CopyButton } from '@/components/copy-button';
import {
  draftRepliesAction,
  regenerateDraftAction,
  saveDraftAction,
  setHandledAction,
} from '@/lib/actions/replies';
import { IDLE } from '@/lib/actions/shared';

/**
 * The suggested reply, and everything the operator can do with it.
 *
 * Deliberately four plain buttons: Edit, Regenerate, Copy, Mark handled. There
 * is no send, no publish and no schedule, because RepOS has no outbound path
 * for a reply — the operator copies the text and pastes it wherever they like.
 *
 * There is nothing to configure here either. Tone, language and wording all
 * come from the client profile and the vertical pack, so the normal path is
 * read it, copy it, done.
 */

function SubmitButton({
  label,
  busyLabel,
  variant = 'secondary',
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

export function ReplyPanel({
  clientId,
  itemId,
  draftText,
  handled,
}: {
  clientId: string;
  itemId: string;
  draftText: string;
  handled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(draftText);
  const [state, formAction] = useActionState(saveDraftAction, IDLE);

  // A regenerate replaces the text under the operator; keep the editor honest.
  useEffect(() => {
    setValue(draftText);
  }, [draftText]);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  if (editing) {
    return (
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="itemId" value={itemId} />
        <Textarea
          name="draftText"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={7}
          aria-label="Suggested reply"
        />
        {state.errors.draftText ? (
          <Notice tone="bad">{state.errors.draftText}</Notice>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton label="Save" busyLabel="Saving…" variant="primary" />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setValue(draftText);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap text-ink-900">
        {draftText}
      </p>

      {state.message ? (
        <Notice tone={state.ok ? 'good' : 'bad'}>{state.message}</Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={draftText} label="Copy" copiedLabel="Copied" variant="primary" />
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>

        <form action={regenerateDraftAction}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="itemId" value={itemId} />
          <SubmitButton label="Regenerate" busyLabel="Writing…" variant="ghost" />
        </form>

        <HandledButton clientId={clientId} itemId={itemId} handled={handled} />
      </div>

      <p className="text-[12px] text-ink-500">
        Nothing is posted from here. Copy the text and paste it wherever you reply.
      </p>
    </div>
  );
}

/** For an item that wants a reply but has none yet. */
export function GenerateReplyButton({
  clientId,
  itemId,
}: {
  clientId: string;
  itemId: string;
}) {
  return (
    <form action={regenerateDraftAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="itemId" value={itemId} />
      <SubmitButton label="Suggest a reply" busyLabel="Writing…" variant="primary" />
    </form>
  );
}

/** The batch button on the Feedback page. */
export function DraftRepliesButton({
  clientId,
  awaiting,
  includeOptional = false,
}: {
  clientId: string;
  awaiting: number;
  includeOptional?: boolean;
}) {
  return (
    <form action={draftRepliesAction}>
      <input type="hidden" name="clientId" value={clientId} />
      {includeOptional ? <input type="hidden" name="includeOptional" value="on" /> : null}
      <SubmitButton
        label={awaiting > 0 ? `Suggest ${awaiting} replies` : 'Suggest replies'}
        busyLabel="Writing…"
        variant="primary"
      />
    </form>
  );
}

/**
 * "I have dealt with this one."
 *
 * Its own component because it is not part of a draft (M17). The two response
 * categories that most need an operator to close them off — the ones RepOS
 * deliberately writes nothing for, and the ones that need no reply at all —
 * never have a draft, so for exactly those the button had nowhere to live and
 * the item was a dead end.
 */
export function HandledButton({
  clientId,
  itemId,
  handled,
  label,
}: {
  clientId: string;
  itemId: string;
  handled: boolean;
  label?: string;
}) {
  return (
    <form action={setHandledAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="handled" value={handled ? '' : 'on'} />
      <SubmitButton
        label={handled ? 'Reopen' : (label ?? 'Mark handled')}
        busyLabel="Saving…"
        variant="ghost"
      />
    </form>
  );
}
