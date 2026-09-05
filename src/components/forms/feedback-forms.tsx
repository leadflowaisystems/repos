'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button, Card, CardBody, CardHeader, Notice } from '@/components/ui';
import {
  ActionForm,
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/form-shell';
import {
  addFeedbackItemAction,
  deleteFeedbackItemAction,
  importFeedbackAction,
} from '@/lib/actions/feedback';

/**
 * Paste → Import → Done.
 *
 * One box, one dropdown, one button. No wizard, no column mapping, no preview
 * step — the operator does this repeatedly across many clients and every extra
 * click costs them.
 */
export function PasteFeedbackForm({
  clientId,
  sources,
  defaultDate,
}: {
  clientId: string;
  sources: ReadonlyArray<{ value: string; label: string }>;
  defaultDate: string;
}) {
  return (
    <ActionForm
      action={importFeedbackAction}
      submitLabel="Import feedback"
      submittingLabel="Importing…"
      footerNote="Personal details are stripped before anything is saved."
    >
      <input type="hidden" name="clientId" value={clientId} />

      <TextAreaField
        name="raw"
        label="Paste your reviews here"
        rows={12}
        required
        className="font-mono text-[13px]"
        hint="One review per line — or if a review runs over several lines, put a blank line between reviews. Ratings (5 stars, ★★★★★, 4/5) and dates (2 weeks ago, 12/03/2026) are picked up when they are there, and never invented when they are not."
        placeholder={
          '5 stars\n"Very good service. Staff were polite and the clinic was clean."\n\n4 stars\n"Good experience but had to wait past my appointment time."\n\n"★★☆☆☆ Reception was rude when I asked about the delay."\n\nडॉक्टर छान आहेत पण खूप उशीर झाला'
        }
      />

      <FormGrid>
        <SelectField
          name="source"
          label="Where did this come from?"
          defaultValue="PUBLIC_REVIEW"
          options={sources}
        />
        <TextField
          name="referenceDate"
          label="Collected on"
          type="date"
          defaultValue={defaultDate}
          hint='Anchors relative dates like "2 weeks ago".'
        />
      </FormGrid>
    </ActionForm>
  );
}

/** One item at a time, for feedback given verbally or by message. */
export function SingleFeedbackForm({
  clientId,
  sources,
}: {
  clientId: string;
  sources: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={addFeedbackItemAction} submitLabel="Add feedback">
      <input type="hidden" name="clientId" value={clientId} />

      <TextAreaField
        name="text"
        label="What did they say?"
        rows={5}
        required
        placeholder="Told us at the counter that the wait was too long, but the treatment itself was good."
      />

      <FormGrid cols={3}>
        <SelectField
          name="stars"
          label="Rating"
          defaultValue=""
          options={[
            { value: '', label: 'Not known' },
            { value: '5', label: '5 — very happy' },
            { value: '4', label: '4 — happy' },
            { value: '3', label: '3 — mixed' },
            { value: '2', label: '2 — unhappy' },
            { value: '1', label: '1 — very unhappy' },
          ]}
        />
        <TextField name="reviewDate" label="When" type="date" defaultValue="" />
        <SelectField
          name="source"
          label="Source"
          defaultValue="MANUAL_ENTRY"
          options={sources}
        />
      </FormGrid>
    </ActionForm>
  );
}

/**
 * The add panel. Paste is the default because it is the common case; the
 * single-item form is one click away rather than a separate page.
 */
export function AddFeedbackPanel({
  clientId,
  sources,
  defaultDate,
  startOpen = false,
}: {
  clientId: string;
  sources: ReadonlyArray<{ value: string; label: string }>;
  defaultDate: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [mode, setMode] = useState<'paste' | 'single'>('paste');

  if (!open) {
    return (
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        Add feedback
      </Button>
    );
  }

  return (
    <Card className="text-left">
      <CardHeader
        title={mode === 'paste' ? 'Paste your reviews' : 'Add one piece of feedback'}
        description={
          mode === 'paste'
            ? 'Paste as many as you like in one go. RepOS will read them and analyse them for you.'
            : 'For something a customer said in person or by message.'
        }
        action={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={mode === 'paste' ? 'secondary' : 'ghost'}
              className="px-2.5 py-1 text-[12px]"
              onClick={() => setMode('paste')}
            >
              Paste batch
            </Button>
            <Button
              type="button"
              variant={mode === 'single' ? 'secondary' : 'ghost'}
              className="px-2.5 py-1 text-[12px]"
              onClick={() => setMode('single')}
            >
              Add one
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-2.5 py-1 text-[12px]"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        <Notice tone="warn">
          Paste the feedback text only. If a name, phone number, email or address
          slips in, RepOS strips it before saving — but the rule is that customer
          feedback is anonymous.
        </Notice>

        {mode === 'paste' ? (
          <PasteFeedbackForm
            clientId={clientId}
            sources={sources}
            defaultDate={defaultDate}
          />
        ) : (
          <SingleFeedbackForm clientId={clientId} sources={sources} />
        )}
      </CardBody>
    </Card>
  );
}

export function DeleteFeedbackButton({
  clientId,
  itemId,
}: {
  clientId: string;
  itemId: string;
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
    <form action={deleteFeedbackItemAction} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="itemId" value={itemId} />
      <span className="text-[12px] text-ink-600">Delete this feedback?</span>
      <SubmitButton variant="danger" className="px-2 py-1 text-[12px]">
        Yes
      </SubmitButton>
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
