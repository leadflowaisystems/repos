'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import {
  ActionForm,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/form-shell';
import {
  createMinuteAction,
  deleteMinuteAction,
  updateMinuteAction,
} from '@/lib/actions/minutes';

/**
 * Fast entry.
 *
 * Everything is pre-filled: today's date, a sensible category, the client
 * already selected. In practice the operator types one line and hits save, so
 * the note field is the only thing that ever needs thought.
 */
export function QuickMinuteForm({
  clientId,
  defaultDate,
  categories,
  clientPicker,
}: {
  clientId: string;
  defaultDate: string;
  categories: ReadonlyArray<{ value: string; label: string }>;
  /** Rendered instead of the hidden clientId on the cross-client page. */
  clientPicker?: React.ReactNode;
}) {
  return (
    <ActionForm
      action={createMinuteAction}
      submitLabel="Save minute"
      submittingLabel="Saving…"
      footerNote="Business context only — never a customer's name or contact details."
    >
      {clientPicker ?? <input type="hidden" name="clientId" value={clientId} />}

      <TextField
        name="title"
        label="What happened?"
        required
        placeholder="Called the owner about waiting times"
        autoComplete="off"
        hint="One line. The detail goes in the note below."
      />

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <SelectField
          name="category"
          label="Type"
          defaultValue="OWNER_CONVERSATION"
          options={categories}
        />
        <TextField
          name="occurredAt"
          label="When"
          type="date"
          defaultValue={defaultDate}
        />
      </div>

      <TextAreaField
        name="body"
        label="Note"
        rows={3}
        placeholder="Optional. What was said, what was agreed, anything worth remembering next month."
      />
    </ActionForm>
  );
}

/** Collapsed by default on the client page so the memory itself leads. */
export function AddMinutePanel({
  clientId,
  defaultDate,
  categories,
  startOpen = false,
}: {
  clientId: string;
  defaultDate: string;
  categories: ReadonlyArray<{ value: string; label: string }>;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);

  if (!open) {
    return (
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        Add minute
      </Button>
    );
  }

  return (
    // text-left resets alignment: this panel also renders inside the centred
    // empty state, where centred form labels would look broken.
    <Card className="text-left">
      <CardHeader
        title="Add a minute"
        description="Takes a few seconds. Everything except the title is optional."
        action={
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      />
      <CardBody>
        <QuickMinuteForm
          clientId={clientId}
          defaultDate={defaultDate}
          categories={categories}
        />
      </CardBody>
    </Card>
  );
}

export function EditMinuteForm({
  clientId,
  minuteId,
  values,
  categories,
  cancelHref,
}: {
  clientId: string;
  minuteId: string;
  values: { title: string; body: string; category: string; occurredAt: string };
  categories: ReadonlyArray<{ value: string; label: string }>;
  cancelHref: string;
}) {
  return (
    <ActionForm action={updateMinuteAction} submitLabel="Save changes">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="minuteId" value={minuteId} />

      <TextField
        name="title"
        label="What happened?"
        required
        defaultValue={values.title}
        autoComplete="off"
      />

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <SelectField
          name="category"
          label="Type"
          defaultValue={values.category}
          options={categories}
        />
        <TextField
          name="occurredAt"
          label="When"
          type="date"
          defaultValue={values.occurredAt}
        />
      </div>

      <TextAreaField name="body" label="Note" rows={5} defaultValue={values.body} />

      <a
        href={cancelHref}
        className="text-[13px] text-ink-500 underline underline-offset-2"
      >
        Cancel and go back
      </a>
    </ActionForm>
  );
}

/** Deliberate two-step delete, matching the rest of the app. */
export function DeleteMinuteButton({
  clientId,
  minuteId,
  title,
}: {
  clientId: string;
  minuteId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="px-2 py-1 text-[12px]"
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <form action={deleteMinuteAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="minuteId" value={minuteId} />
      <span className="text-[12px] text-ink-600">Delete &ldquo;{title}&rdquo;?</span>
      <Button type="submit" variant="danger" className="px-2 py-1 text-[12px]">
        Yes, delete
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="px-2 py-1 text-[12px]"
        onClick={() => setConfirming(false)}
      >
        Keep
      </Button>
    </form>
  );
}
