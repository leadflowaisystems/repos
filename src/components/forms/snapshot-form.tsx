'use client';

import { Card, CardBody, CardHeader, Field, Notice } from '@/components/ui';
import {
  ActionForm,
  FormGrid,
  TextAreaField,
  TextField,
} from '@/components/forms/form-shell';
import { createSnapshotAction } from '@/lib/actions/snapshots';

/**
 * Manual snapshot entry.
 *
 * Everything on this form is something the operator looked at themselves.
 * RepOS does not fetch a listing, does not read a review platform and does not
 * hold any platform credential — see COMPLIANCE.md.
 */

export function SnapshotForm({
  clientId,
  defaultDate,
  competitorSummary,
  profileGapChecks,
  aiNote,
}: {
  clientId: string;
  defaultDate: string;
  competitorSummary: string;
  profileGapChecks: Array<{ key: string; label: string }>;
  aiNote: string;
}) {
  return (
    <ActionForm
      action={createSnapshotAction}
      submitLabel="Save snapshot"
      submittingLabel="Analysing and saving…"
      footerNote="Counts, thresholds and comparisons are computed in application code, not by AI."
    >
      <input type="hidden" name="clientId" value={clientId} />

      <Card>
        <CardHeader
          title="What you observed"
          description="Open the client's public listing yourself and type in what you can see. Leave anything you did not check blank — Headway reports it as not observed rather than guessing."
        />
        <CardBody className="space-y-4">
          <FormGrid>
            <TextField
              name="label"
              label="Label"
              defaultValue=""
              placeholder="March 2026"
              hint="Optional. Makes comparisons easier to read."
            />
            <TextField
              name="capturedAt"
              label="Observation date"
              type="date"
              required
              defaultValue={defaultDate}
              hint="Relative dates in pasted reviews resolve against this date."
            />
          </FormGrid>

          <FormGrid cols={3}>
            <TextField
              name="rating"
              label="Rating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              inputMode="decimal"
              placeholder="4.3"
            />
            <TextField
              name="reviewCount"
              label="Total reviews"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="180"
            />
            <TextField
              name="unansweredCount"
              label="Unanswered reviews"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="12"
              hint="Only if you actually counted them."
            />
            <TextField
              name="reviewsPerWeek"
              label="New reviews per week"
              type="number"
              min={0}
              step={0.1}
              inputMode="decimal"
              placeholder="1.5"
            />
            <TextField
              name="daysSinceLastPost"
              label="Days since last post"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="15"
            />
            <TextField
              name="photoRecencyDays"
              label="Newest photo age (days)"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="40"
            />
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Visible profile gaps"
          description="Tick anything visibly missing or out of date on the listing."
        />
        <CardBody>
          {profileGapChecks.length === 0 ? (
            <p className="text-[13px] text-ink-500">
              This vertical pack defines no profile checks.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {profileGapChecks.map((gap) => (
                <label
                  key={gap.key}
                  className="flex items-start gap-2.5 rounded-lg border border-ink-200 px-3.5 py-2.5 text-[13px] text-ink-800 hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    name="profileGaps"
                    value={gap.key}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-brand-600)]"
                  />
                  <span>{gap.label}</span>
                </label>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Competitors"
          description="Frozen into this snapshot from the client's knowledge profile."
        />
        <CardBody>
          <Notice tone="neutral">{competitorSummary}</Notice>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Paste reviews"
          description="Optional, but this is what produces the Customer Pulse."
        />
        <CardBody className="space-y-4">
          <Notice tone="warn" title="Paste review text only">
            Do not paste reviewer names, phone numbers or email addresses. Headway
            strips them automatically before anything is written to disk, but the
            rule is: feedback is anonymous by default.
          </Notice>

          <Field
            label="Formatting"
            hint="One review per line, or separate them with a blank line or ---. Star ratings (5 stars, ★★★★★, 4/5) and dates (2 weeks ago, 12/03/2026) are picked up when present, and never invented when absent."
          >
            <span className="sr-only">Formatting help</span>
          </Field>

          <TextAreaField
            name="reviewsRaw"
            label="Pasted reviews"
            rows={14}
            className="font-mono text-[13px]"
            placeholder={
              '5 stars 2 weeks ago Doctor explained everything clearly, very happy\n\n1 star a month ago Waited over an hour past my appointment time\n\nडॉक्टर छान आहेत पण खूप उशीर झाला'
            }
          />

          <Notice tone="neutral">{aiNote}</Notice>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notes" description="Anything else you noticed while looking." />
        <CardBody>
          <TextAreaField
            name="observationNotes"
            label="Observation notes"
            rows={3}
            placeholder="Listing photos all look like stock images. Hours say open but shop was shut."
          />
        </CardBody>
      </Card>
    </ActionForm>
  );
}
