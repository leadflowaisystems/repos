'use client';

import { Card, CardBody, CardHeader, Notice } from '@/components/ui';
import {
  ActionForm,
  FormGrid,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/form-shell';
import {
  saveCompetitorsAction,
  savePolicyAction,
  saveVoiceProfileAction,
} from '@/lib/actions/clients';
import {
  EMOJI_POLICY_OPTIONS,
  FORMALITY_OPTIONS,
  LANGUAGE_MIX_OPTIONS,
  titleCase,
} from '@/lib/format';

const asOptions = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: titleCase(v) }));

export type VoiceValues = {
  formality: string;
  languageMix: string;
  greeting: string;
  signOff: string;
  preferredWords: string;
  bannedWords: string;
  emojiPolicy: string;
  exampleReplies: string;
};

export function VoiceForm({
  clientId,
  values,
  presetHint,
}: {
  clientId: string;
  values: VoiceValues;
  presetHint: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Voice profile"
        description="How replies and content should sound for this business."
      />
      <CardBody>
        <ActionForm action={saveVoiceProfileAction} submitLabel="Save voice profile">
          <input type="hidden" name="clientId" value={clientId} />
          <Notice tone="neutral">{presetHint}</Notice>

          <FormGrid cols={3}>
            <SelectField
              name="formality"
              label="Formality"
              defaultValue={values.formality}
              options={asOptions(FORMALITY_OPTIONS)}
            />
            <SelectField
              name="languageMix"
              label="Language mix"
              defaultValue={values.languageMix}
              options={asOptions(LANGUAGE_MIX_OPTIONS)}
              hint="English, Hindi, Hinglish, Marathi, or match whatever the customer wrote in."
            />
            <SelectField
              name="emojiPolicy"
              label="Emoji policy"
              defaultValue={values.emojiPolicy}
              options={asOptions(EMOJI_POLICY_OPTIONS)}
            />
          </FormGrid>

          <FormGrid>
            <TextField
              name="greeting"
              label="Greeting"
              defaultValue={values.greeting}
              placeholder="Thank you for taking the time to share this."
            />
            <TextField
              name="signOff"
              label="Sign-off"
              defaultValue={values.signOff}
              placeholder="— Team {{businessName}}"
            />
          </FormGrid>

          <FormGrid>
            <TextAreaField
              name="preferredWords"
              label="Preferred words"
              defaultValue={values.preferredWords}
              rows={5}
              hint="One per line."
            />
            <TextAreaField
              name="bannedWords"
              label="Banned words"
              defaultValue={values.bannedWords}
              rows={5}
              hint="One per line. These must never appear in anything you send out."
            />
          </FormGrid>

          <TextAreaField
            name="exampleReplies"
            label="Example replies"
            defaultValue={values.exampleReplies}
            rows={5}
            hint="One per line. Real replies you were happy with."
          />
        </ActionForm>
      </CardBody>
    </Card>
  );
}

export type PolicyValues = {
  refundPolicy: string;
  appointmentPolicy: string;
  cancellationPolicy: string;
  neverPromise: string;
  sensitiveTopics: string;
};

export function PolicyForm({
  clientId,
  values,
}: {
  clientId: string;
  values: PolicyValues;
}) {
  return (
    <Card>
      <CardHeader
        title="Business policies"
        description="The rules you must not contradict when replying on this client's behalf."
      />
      <CardBody>
        <ActionForm action={savePolicyAction} submitLabel="Save policies">
          <input type="hidden" name="clientId" value={clientId} />
          <FormGrid>
            <TextAreaField
              name="refundPolicy"
              label="Refund policy"
              defaultValue={values.refundPolicy}
              rows={3}
            />
            <TextAreaField
              name="appointmentPolicy"
              label="Appointment policy"
              defaultValue={values.appointmentPolicy}
              rows={3}
            />
            <TextAreaField
              name="cancellationPolicy"
              label="Cancellation policy"
              defaultValue={values.cancellationPolicy}
              rows={3}
            />
            <TextAreaField
              name="sensitiveTopics"
              label="Sensitive topics"
              defaultValue={values.sensitiveTopics}
              rows={3}
              hint="One per line. Anything that must be taken offline instead of answered publicly."
            />
          </FormGrid>
          <TextAreaField
            name="neverPromise"
            label="Never promise"
            defaultValue={values.neverPromise}
            rows={4}
            hint="One per line. Hard limits — claims that must never be made, in any channel."
          />
        </ActionForm>
      </CardBody>
    </Card>
  );
}

export type CompetitorValues = {
  name: string;
  mapsUrl: string;
  rating: string;
  reviewCount: string;
  observedAt: string;
};

export function CompetitorsForm({
  clientId,
  rows,
}: {
  clientId: string;
  rows: CompetitorValues[];
}) {
  const padded: CompetitorValues[] = [0, 1, 2].map(
    (i) =>
      rows[i] ?? {
        name: '',
        mapsUrl: '',
        rating: '',
        reviewCount: '',
        observedAt: '',
      },
  );

  return (
    <Card>
      <CardHeader
        title="Competitors"
        description="Up to three. Every value here is typed in by you from what you saw."
      />
      <CardBody>
        <ActionForm action={saveCompetitorsAction} submitLabel="Save competitors">
          <input type="hidden" name="clientId" value={clientId} />
          <Notice tone="neutral">
            Headway never fetches competitor data. Leave a row completely blank to
            remove it.
          </Notice>

          <div className="space-y-6">
            {padded.map((row, i) => (
              <div
                key={i}
                className="rounded-lg border border-ink-200 bg-ink-50/60 p-4"
              >
                <p className="mb-3 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                  Competitor {i + 1}
                </p>
                <FormGrid>
                  <TextField
                    name={`competitors.${i}.name`}
                    label="Name"
                    defaultValue={row.name}
                    autoComplete="off"
                  />
                  <TextField
                    name={`competitors.${i}.mapsUrl`}
                    label="Public Maps URL"
                    type="url"
                    defaultValue={row.mapsUrl}
                    placeholder="https://…"
                  />
                  <TextField
                    name={`competitors.${i}.rating`}
                    label="Rating (as observed)"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    inputMode="decimal"
                    defaultValue={row.rating}
                  />
                  <TextField
                    name={`competitors.${i}.reviewCount`}
                    label="Review count (as observed)"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    defaultValue={row.reviewCount}
                  />
                  <TextField
                    name={`competitors.${i}.observedAt`}
                    label="Observed on"
                    type="date"
                    defaultValue={row.observedAt}
                  />
                </FormGrid>
              </div>
            ))}
          </div>
        </ActionForm>
      </CardBody>
    </Card>
  );
}
