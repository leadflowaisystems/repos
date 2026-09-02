'use client';

import { useActionState, useState } from 'react';
import clsx from 'clsx';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { ActionForm, TextAreaField, TextField } from '@/components/forms/form-shell';
import {
  createActionFromInsightAction,
  decideActionAction,
  measureActionAction,
  moveActionAction,
  recordLearningAction,
} from '@/lib/actions/improve';
import {
  RESULT_LABELS,
  RESULT_TONES,
  STATUS_LABELS,
  STATUS_MEANINGS,
  STATUS_TONES,
  type ActionResult,
  type ActionStatus,
  type Measurement,
} from '@/lib/improve/model';
import { formatDate } from '@/lib/format';
import { IDLE as IDLE_STATE } from '@/lib/actions/shared';

/**
 * IMPROVEMENT ACTIONS (M11).
 *
 * The loop, as a workflow rather than a form: what we are trying to improve,
 * what the business decided to do, whether it was done, and what customers
 * said afterwards.
 *
 * Two lines this UI is not allowed to cross:
 *
 *  - "Done" is presented as something the business says, never as evidence.
 *  - A measured result is described as what happened after the change, never
 *    as what the change caused. The wording comes from the measurement engine;
 *    this component adds no claims of its own.
 */

export type ActionView = {
  id: string;
  status: ActionStatus;
  statusNote: string;
  title: string;
  description: string;
  themeKey: string;
  themeLabel: string;
  sentiment: 'PRAISE' | 'ISSUE';
  insightHeadline: string;
  insightDetail: string;
  recommendationText: string;
  reasons: string[];

  baselineLine: string;
  baselineCapturedAt: string;
  baselineSnapshotLabel: string | null;
  baselineEvidenceCount: number;

  decidedAt: string | null;
  doneAt: string | null;
  measuredAt: string | null;

  measurement: Measurement | null;
  result: ActionResult | null;
  learningNote: string;
  minuteId: string | null;

  /** Read feedback that has arrived since the change was made. */
  newFeedbackSinceDone: number;
  /** Of those, how many are new since the last measurement. */
  newFeedbackSinceMeasured: number;
  canMeasure: boolean;
};

/**
 * Turn one insight into an improvement attempt.
 *
 * Sits on the insight itself so the evidence the operator just read is the
 * evidence the action is created from — there is no separate screen where the
 * connection could be lost.
 */
export function CreateActionButton({
  clientId,
  insightId,
  existing,
}: {
  clientId: string;
  insightId: string;
  /** Already has an action: link to it rather than offering a duplicate. */
  existing: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createActionFromInsightAction,
    IDLE_STATE,
  );

  if (existing) {
    return (
      <a
        href="#actions"
        className="text-[12px] font-medium text-ink-600 underline underline-offset-2"
      >
        Already an improvement action
      </a>
    );
  }

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="insightId" value={insightId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-800 transition-colors hover:bg-ink-50 disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Turn this into an action'}
      </button>
      {state.message ? (
        <p
          className={
            state.ok
              ? 'text-[12px] text-good-700'
              : 'text-[12px] font-medium text-bad-700'
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <p className="w-44 shrink-0 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
        {label}
      </p>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-800">
        {children}
      </div>
    </div>
  );
}

function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] text-ink-600 underline underline-offset-2 hover:text-ink-900"
      >
        {open ? 'Hide' : label}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The measured before/after
// ---------------------------------------------------------------------------

function MeasurementBlock({
  measurement,
  clientId,
  themeKey,
}: {
  measurement: Measurement;
  clientId: string;
  themeKey: string;
}) {
  const tone = RESULT_TONES[measurement.result];
  return (
    <div
      className={clsx(
        'rounded-lg border px-4 py-3.5',
        tone === 'good'
          ? 'border-good-200 bg-good-50'
          : tone === 'bad'
            ? 'border-bad-200 bg-bad-50'
            : 'border-ink-200 bg-ink-50',
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{RESULT_LABELS[measurement.result]}</Badge>
        <span className="text-[11px] text-ink-500">
          Measured {formatDate(measurement.measuredAt)}
        </span>
      </div>

      <p className="text-[14px] leading-snug font-semibold text-ink-900">
        {measurement.headline}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-white/70 px-3 py-2">
          <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
            Before
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-ink-900">
            {measurement.before.line}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600">
            {measurement.before.label}
            {measurement.before.snapshotLabel
              ? ` · check-in: ${measurement.before.snapshotLabel}`
              : ''}
          </p>
        </div>
        <div className="rounded-md bg-white/70 px-3 py-2">
          <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
            After
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-ink-900">
            {measurement.after.line}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600">
            {measurement.after.label}
          </p>
        </div>
      </div>

      {/* The before and after cards above already say the comparison; the
          reasons list adds only what they do not show. */}
      <ul className="mt-3 space-y-1">
        {measurement.why
          .filter((line) => !line.includes(measurement.before.line))
          .map((line) => (
            <li key={line} className="text-[12px] leading-relaxed text-ink-700">
              {line}
            </li>
          ))}
      </ul>

      <ul className="mt-2 space-y-1 border-t border-ink-200/60 pt-2">
        {measurement.limits.map((line) => (
          <li key={line} className="text-[12px] leading-relaxed text-ink-500">
            {line}
          </li>
        ))}
      </ul>

      <a
        href={`/clients/${clientId}/feedback?theme=${encodeURIComponent(themeKey)}`}
        className="mt-2 inline-block text-[12px] font-medium text-brand-700 underline underline-offset-2"
      >
        Read the feedback behind this
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One action
// ---------------------------------------------------------------------------

function ActionCard({ clientId, action }: { clientId: string; action: ActionView }) {
  const isOpen = action.status !== 'DECLINED' && action.status !== 'MEASURED';

  return (
    <article className="rounded-xl border border-ink-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[14px] leading-snug font-semibold text-ink-900">
            {action.title}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Started {action.baselineCapturedAt}
            {action.decidedAt ? ` · decided ${action.decidedAt}` : ''}
            {action.doneAt ? ` · done ${action.doneAt}` : ''}
          </p>
        </div>
        <Badge tone={STATUS_TONES[action.status]}>{STATUS_LABELS[action.status]}</Badge>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* ---- 1. What we are trying to improve --------------------------- */}
        <Row label="Trying to improve">
          <p>{action.insightHeadline}</p>
          <p className="mt-0.5 text-[12px] text-ink-600">
            Baseline: {action.baselineLine} {action.baselineCapturedAt}
            {action.baselineSnapshotLabel
              ? ` · check-in: ${action.baselineSnapshotLabel}`
              : ''}
          </p>
          <a
            href={`/clients/${clientId}/feedback?theme=${encodeURIComponent(action.themeKey)}`}
            className="text-[12px] font-medium text-brand-700 underline underline-offset-2"
          >
            Read the {action.baselineEvidenceCount} reviews this was based on
          </a>
        </Row>

        {/* ---- 2. What RepOS suggested, frozen ---------------------------- */}
        {action.recommendationText ? (
          <Row label="RepOS suggested">
            <p className="text-ink-700">{action.recommendationText}</p>
          </Row>
        ) : null}

        {/* ---- 3. What the business decided ------------------------------- */}
        {action.description ? (
          <Row label="Business decided">
            <p className="font-medium">{action.description}</p>
            {action.minuteId ? (
              <a
                href={`/clients/${clientId}/minutes`}
                className="text-[12px] text-ink-600 underline underline-offset-2"
              >
                Also recorded in Minutes
              </a>
            ) : null}
          </Row>
        ) : null}

        {action.statusNote ? (
          <Row label="Note">
            <p className="text-ink-700">{action.statusNote}</p>
          </Row>
        ) : null}

        {/* ---- 4. What happened after ------------------------------------- */}
        {action.measurement ? (
          <MeasurementBlock
            measurement={action.measurement}
            clientId={clientId}
            themeKey={action.themeKey}
          />
        ) : null}

        {/* ---- 5. What the operator thinks -------------------------------- */}
        {action.learningNote ? (
          <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              What you concluded · your note, not customer evidence
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-800">
              {action.learningNote}
            </p>
          </div>
        ) : null}

        {/* ---- What this state does and does not mean --------------------- */}
        {isOpen ? (
          <p className="text-[12px] leading-relaxed text-ink-500">
            {STATUS_MEANINGS[action.status]}
          </p>
        ) : null}

        {/* ---- The next step in the loop ---------------------------------- */}
        <div className="border-t border-ink-100 pt-4">
          <ActionControls clientId={clientId} action={action} />
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// What can be done next, and only what can be done next
// ---------------------------------------------------------------------------

function ActionControls({ clientId, action }: { clientId: string; action: ActionView }) {
  const hidden = (
    <>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="actionId" value={action.id} />
    </>
  );

  if (action.status === 'RECOMMENDED') {
    return (
      <div className="space-y-4">
        <ActionForm action={decideActionAction} submitLabel="Accept and record the decision">
          {hidden}
          <input type="hidden" name="decision" value="ACCEPT" />
          <TextAreaField
            name="description"
            label="What did the business actually decide to do?"
            rows={2}
            required
            placeholder="Cut 6–8pm bookings to five an hour and add 15 minutes between slots"
            hint="Often not the same as the suggestion above. This is the version that gets remembered."
          />
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="recordMinute"
              defaultChecked
              className="h-4 w-4 rounded border-ink-300"
            />
            Also record this as a minute
          </label>
        </ActionForm>

        <Disclosure label="The business said no">
          <ActionForm
            action={decideActionAction}
            submitLabel="Record as declined"
            submitVariant="danger"
          >
            {hidden}
            <input type="hidden" name="decision" value="DECLINE" />
            <TextAreaField
              name="statusNote"
              label="Why not?"
              rows={2}
              placeholder="Owner says evenings are their busiest hours and they will not cut slots."
            />
          </ActionForm>
        </Disclosure>
      </div>
    );
  }

  if (action.status === 'ACCEPTED' || action.status === 'PAUSED') {
    return (
      <div className="space-y-4">
        <ActionForm action={moveActionAction} submitLabel="The business says this is done">
          {hidden}
          <input type="hidden" name="to" value="DONE" />
          <TextField
            name="occurredAt"
            type="date"
            label="When was the change made?"
            required
            hint="This date splits the feedback into before and after."
          />
          <p className="text-[12px] leading-relaxed text-ink-500">
            This records that the business made the change. It is not evidence
            that customers noticed — that comes later, from feedback.
          </p>
        </ActionForm>

        <Disclosure label="Put on hold or drop it">
          <div className="space-y-3">
            <ActionForm action={moveActionAction} submitLabel="Put on hold">
              {hidden}
              <input type="hidden" name="to" value="PAUSED" />
              <TextAreaField name="note" label="Why is it on hold?" rows={2} />
            </ActionForm>
            <ActionForm
              action={moveActionAction}
              submitLabel="Drop it"
              submitVariant="danger"
            >
              {hidden}
              <input type="hidden" name="to" value="DECLINED" />
              <TextAreaField name="note" label="Why?" rows={2} />
            </ActionForm>
          </div>
        </Disclosure>
      </div>
    );
  }

  if (action.status === 'DONE' || action.status === 'MEASURED') {
    return (
      <div className="space-y-4">
        {action.canMeasure ? (
          <ActionForm
            action={measureActionAction}
            submitLabel={
              action.status === 'MEASURED'
                ? 'Measure again with the newer feedback'
                : 'Check what customers said afterwards'
            }
            submittingLabel="Reading the feedback…"
          >
            {hidden}
            <p className="text-[13px] leading-relaxed text-ink-700">
              {action.status === 'MEASURED'
                ? `${action.newFeedbackSinceMeasured} more ${action.newFeedbackSinceMeasured === 1 ? 'piece' : 'pieces'} of feedback have been read since this was last measured.`
                : `${action.newFeedbackSinceDone} pieces of feedback have been read since the change. RepOS will compare them with the baseline.`}
            </p>
          </ActionForm>
        ) : (
          <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
            <p className="text-[13px] font-medium text-ink-800">
              {action.status === 'MEASURED'
                ? 'Nothing new has been read since this was measured.'
                : action.newFeedbackSinceDone === 0
                  ? 'No new feedback since the change.'
                  : `Only ${action.newFeedbackSinceDone} new pieces of feedback since the change.`}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600">
              {action.status === 'MEASURED'
                ? 'Bring in the reviews collected since, and RepOS will check the result again.'
                : 'Paste in the reviews you have collected since then, read them, and RepOS can compare before and after.'}
            </p>
            <a
              href={`/clients/${clientId}/feedback`}
              className="mt-1.5 inline-block text-[12px] font-medium text-brand-700 underline underline-offset-2"
            >
              Add feedback
            </a>
          </div>
        )}

        <Disclosure
          label={action.learningNote ? 'Edit what you concluded' : 'Record what you concluded'}
        >
          <ActionForm action={recordLearningAction} submitLabel="Save note">
            {hidden}
            <TextAreaField
              name="note"
              label="What do you think happened?"
              rows={3}
              defaultValue={action.learningNote}
              placeholder="Waiting complaints have dropped, but the owner says evenings are still tight."
              hint="Your own read on it. Stored as your observation, never shown as something a customer said."
            />
          </ActionForm>
        </Disclosure>

        {action.status === 'DONE' ? (
          <Disclosure label="It was not actually done">
            <ActionForm action={moveActionAction} submitLabel="Move back to agreed">
              {hidden}
              <input type="hidden" name="to" value="ACCEPTED" />
              <TextAreaField name="note" label="What happened?" rows={2} />
            </ActionForm>
          </Disclosure>
        ) : null}
      </div>
    );
  }

  return (
    <p className="text-[12px] leading-relaxed text-ink-500">
      {STATUS_MEANINGS[action.status]}
    </p>
  );
}

// ---------------------------------------------------------------------------

export function ImprovementActionsPanel({
  clientId,
  actions,
}: {
  clientId: string;
  actions: ActionView[];
}) {
  const open = actions.filter((a) => a.status !== 'MEASURED' && a.status !== 'DECLINED');
  const closed = actions.filter((a) => a.status === 'MEASURED' || a.status === 'DECLINED');

  return (
    <Card id="actions">
      <CardHeader
        title="Improvement actions"
        description="What we decided to change because of the feedback, and what customers said afterwards."
      />
      <CardBody className="space-y-5">
        {actions.length === 0 ? (
          <div className="rounded-xl border border-ink-200 bg-ink-50 px-5 py-4">
            <p className="text-[14px] font-semibold text-ink-800">
              No improvement actions yet.
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
              When RepOS names something customers keep raising, turn it into an
              action from the panel above. Then record what the business decided,
              mark it done, and RepOS will show you what the feedback did next.
            </p>
          </div>
        ) : null}

        {open.length > 0 ? (
          <div className="space-y-3">
            {open.map((action) => (
              <ActionCard key={action.id} clientId={clientId} action={action} />
            ))}
          </div>
        ) : null}

        {closed.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              History
            </p>
            <div className="space-y-3">
              {closed.map((action) => (
                <ActionCard key={action.id} clientId={clientId} action={action} />
              ))}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
