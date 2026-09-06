'use client';

import { Card, CardBody, CardHeader, Notice } from '@/components/ui';
import {
  ActionForm,
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/form-shell';
import type { ActionState } from '@/lib/actions/shared';
import { PLAN_OPTIONS, STATUS_OPTIONS, titleCase, toDateInputValue } from '@/lib/format';

export type ClientFormValues = {
  id?: string;
  businessName: string;
  vertical: string;
  areaLabel: string;
  mapsUrl: string;
  reviewLinkUrl: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  avgCustomerValueInr: string;
  plan: string;
  status: string;
  onboardingDate: string;
  baselineRating: string;
  baselineReviewCount: string;
  baselineReviewsPerWeek: string;
  baselineObservedAt: string;
  kitInstalledDate: string;
  notes: string;
};

export const EMPTY_CLIENT: ClientFormValues = {
  businessName: '',
  vertical: '',
  areaLabel: '',
  mapsUrl: '',
  reviewLinkUrl: '',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  avgCustomerValueInr: '',
  plan: 'STARTER',
  status: 'PROSPECT',
  onboardingDate: toDateInputValue(new Date()),
  baselineRating: '',
  baselineReviewCount: '',
  baselineReviewsPerWeek: '',
  baselineObservedAt: '',
  kitInstalledDate: '',
  notes: '',
};

const enumOptions = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: titleCase(v) }));

export function ClientForm({
  action,
  values,
  verticals,
  submitLabel,
  secondaryAction,
  snapshotCount = 0,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  values: ClientFormValues;
  verticals: Array<{ value: string; label: string }>;
  submitLabel: string;
  secondaryAction?: React.ReactNode;
  /** Drives the warning shown when changing an already-analysed client's vertical. */
  snapshotCount?: number;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel={submitLabel}
      secondaryAction={secondaryAction}
    >
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Card>
        <CardHeader
          title="Business"
          description="Who this client is and where they operate."
        />
        <CardBody className="space-y-4">
          {snapshotCount > 0 ? (
            <Notice tone="warn">
              This client already has {snapshotCount} saved snapshot
              {snapshotCount === 1 ? '' : 's'}. Changing the vertical switches the
              playbook used for <em>future</em> snapshots. Snapshots already
              generated keep the taxonomy they were built with, so past reports
              stay exactly as you sent them.
            </Notice>
          ) : null}
          <FormGrid>
            <TextField
              name="businessName"
              label="Business name"
              required
              defaultValue={values.businessName}
              placeholder="Sunrise Dental Clinic"
              autoComplete="off"
            />
            <SelectField
              name="vertical"
              label="Vertical"
              required
              // No silent default (M17). This used to fall back to the first
              // option, so an operator who tabbed past the field onboarded a
              // restaurant with clinic wording, clinic taxonomy and clinic
              // banned words — and `required` never fired, because something
              // was already selected.
              defaultValue={values.vertical}
              options={[{ value: '', label: 'Choose the business type…' }, ...verticals]}
              hint="Chooses the playbook: taxonomy, voice preset, customer question and staff script. It is worth getting right."
            />
            <TextField
              name="areaLabel"
              label="Area"
              defaultValue={values.areaLabel}
              placeholder="Kothrud, Pune"
              hint="Neighbourhood or city. Not a customer address."
            />
            <TextField
              name="avgCustomerValueInr"
              label="Average customer value (₹)"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={values.avgCustomerValueInr}
              placeholder="900"
            />
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Public links"
          description="Stored as plain references so you can open them yourself."
        />
        <CardBody className="space-y-4">
          <Notice tone="neutral">
            Headway never opens or fetches these links, and never connects to any
            platform account. They are here so you can click through manually
            when you go and look.
          </Notice>
          <FormGrid>
            <TextField
              name="mapsUrl"
              label="Public Maps listing URL"
              type="url"
              defaultValue={values.mapsUrl}
              placeholder="https://…"
            />
            <TextField
              name="reviewLinkUrl"
              label="Direct review link"
              type="url"
              defaultValue={values.reviewLinkUrl}
              placeholder="https://…"
              hint="Paste the link the owner already has. Headway does not generate one."
            />
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Owner contact"
          description="The business owner or operator only."
        />
        <CardBody className="space-y-4">
          <Notice tone="warn">
            Owner details only. Never store an end customer&rsquo;s name, phone
            number or email anywhere in Headway.
          </Notice>
          <FormGrid cols={3}>
            <TextField
              name="ownerName"
              label="Owner name"
              defaultValue={values.ownerName}
              autoComplete="off"
            />
            <TextField
              name="ownerPhone"
              label="Owner phone"
              defaultValue={values.ownerPhone}
              autoComplete="off"
            />
            <TextField
              name="ownerEmail"
              label="Owner email"
              type="email"
              defaultValue={values.ownerEmail}
              autoComplete="off"
            />
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Engagement"
          description="Plan, status and the dates that drive your operating rhythm."
        />
        <CardBody>
          <FormGrid cols={3}>
            <SelectField
              name="plan"
              label="Plan"
              defaultValue={values.plan}
              options={enumOptions(PLAN_OPTIONS)}
            />
            <SelectField
              name="status"
              label="Status"
              defaultValue={values.status}
              options={enumOptions(STATUS_OPTIONS)}
            />
            <TextField
              name="onboardingDate"
              label="Onboarding date"
              type="date"
              defaultValue={values.onboardingDate}
            />
            <TextField
              name="kitInstalledDate"
              label="Kit installed date"
              type="date"
              defaultValue={values.kitInstalledDate}
              hint="Leave blank until the counter stand is physically on site."
            />
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Baseline"
          description="What you observed on day one. Every later snapshot is measured against this."
        />
        <CardBody className="space-y-4">
          <Notice tone="neutral">
            Enter only what you actually saw. Blank means not observed — Headway
            will say so in the report rather than guess.
          </Notice>
          <FormGrid cols={3}>
              <TextField
                name="baselineRating"
                label="Baseline rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                inputMode="decimal"
                defaultValue={values.baselineRating}
                placeholder="4.1"
              />
              <TextField
                name="baselineReviewCount"
                label="Baseline review count"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={values.baselineReviewCount}
                placeholder="148"
              />
              <TextField
                name="baselineReviewsPerWeek"
                label="Baseline reviews / week"
                type="number"
                min={0}
                step={0.1}
                inputMode="decimal"
                defaultValue={values.baselineReviewsPerWeek}
                placeholder="0.8"
              />
              <TextField
                name="baselineObservedAt"
                label="Baseline observed on"
                type="date"
                defaultValue={values.baselineObservedAt}
              />
          </FormGrid>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notes" description="Anything you want to remember about this client." />
        <CardBody>
          <TextAreaField
            name="notes"
            label="Internal notes"
            defaultValue={values.notes}
            rows={4}
            placeholder="Owner prefers WhatsApp voice notes. Reception changes staff often."
          />
        </CardBody>
      </Card>
    </ActionForm>
  );
}
