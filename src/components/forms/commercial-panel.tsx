'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import {
  convertToActiveAction,
  extendTrialAction,
  pauseServiceAction,
  resumeServiceAction,
  saveCommercialAction,
  startTrialAction,
} from '@/lib/actions/commercial';
import { IDLE, type ActionState } from '@/lib/actions/shared';

/**
 * THE COMMERCIAL CONSOLE — OPERATOR ONLY (M21).
 *
 * Everything on this panel is a platform decision, and none of it appears in
 * the owner's workspace. The negotiated amount is not merely hidden from them:
 * the table it lives in refuses their connection, so this panel is the only
 * place it exists on a screen.
 *
 * Every control here is also checked twice. `adminGate` refuses a non-admin at
 * the action, and the database refuses again underneath — `repos_app` holds no
 * UPDATE privilege on the subscription or trial columns and cannot select the
 * Commercial table at all. A hidden button is a design decision, not a boundary.
 */

export type CommercialPanelProps = {
  clientId: string;
  state: 'TRIAL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  /** Pre-formatted; this component does no date arithmetic. */
  trialStarted: string | null;
  trialEnds: string | null;
  trialDaysLeft: number | null;
  paymentRequested: string | null;
  owner: { name: string; email: string; phone: string };
  commercial: {
    amountInr: number | null;
    cadence: string;
    note: string;
    paymentInstructions: string;
    instructionsSent: string | null;
    paid: string | null;
  };
};

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={clsx(
        'mt-2 rounded-lg border px-3 py-2 text-[13px] break-words',
        state.ok
          ? 'border-good-200 bg-good-50 text-good-700'
          : 'border-bad-200 bg-bad-50 text-bad-700',
      )}
    >
      {state.message}
    </p>
  );
}

const STATE_TONE = {
  TRIAL: 'brand',
  ACTIVE: 'good',
  PAUSED: 'warn',
  CANCELLED: 'bad',
} as const;

const STATE_WORD = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  CANCELLED: 'Closed',
} as const;

/** One button, one action, its own result line. */
function ActionButton({
  action,
  clientId,
  label,
  pendingLabel,
  variant = 'secondary',
  days,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  clientId: string;
  label: string;
  pendingLabel: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Present on the two trial controls, absent on the rest. */
  days?: number;
}) {
  const [state, submit, pending] = useActionState(action, IDLE);
  return (
    <form action={submit} className="min-w-0">
      <input type="hidden" name="clientId" value={clientId} />
      {days === undefined ? null : (
        <label className="mb-1.5 flex items-center gap-2 text-[12px] text-ink-600">
          <span>Days</span>
          <Input
            name="days"
            type="number"
            min={1}
            max={365}
            defaultValue={days}
            className="w-20 py-1.5"
          />
        </label>
      )}
      <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
        {pending ? pendingLabel : label}
      </Button>
      <Notice state={state} />
    </form>
  );
}

export function CommercialPanel(props: CommercialPanelProps) {
  const { clientId, state } = props;
  const [saveState, save, saving] = useActionState(saveCommercialAction, IDLE);
  const paused = state === 'PAUSED' || state === 'CANCELLED';

  return (
    <div className="space-y-6">
      {/* --- where the account stands ------------------------------------ */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={STATE_TONE[state]}>{STATE_WORD[state]}</Badge>
          {props.trialEnds ? (
            <span className="text-[13px] text-ink-600">
              Trial {props.trialDaysLeft !== null && props.trialDaysLeft > 0 ? 'runs to' : 'ended'}{' '}
              {props.trialEnds}
              {props.trialDaysLeft !== null && props.trialDaysLeft > 0
                ? ` · ${props.trialDaysLeft} days left`
                : ''}
            </span>
          ) : (
            <span className="text-[13px] text-ink-500">No trial end date set</span>
          )}
          {props.trialStarted ? (
            <span className="text-[13px] text-ink-500">Started {props.trialStarted}</span>
          ) : null}
        </div>

        {paused ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
            Feedback is still being collected and kept. RepOS is not reading anything new for
            this business until it is resumed, and then it reads the backlog.
          </p>
        ) : null}
      </div>

      {/* --- moving it ---------------------------------------------------- */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 border-t border-ink-200 pt-4">
        <ActionButton
          action={startTrialAction}
          clientId={clientId}
          label="Start a trial"
          pendingLabel="Starting…"
          days={14}
        />
        <ActionButton
          action={extendTrialAction}
          clientId={clientId}
          label="Extend the trial"
          pendingLabel="Extending…"
          days={14}
        />
        <ActionButton
          action={convertToActiveAction}
          clientId={clientId}
          label="They are paying"
          pendingLabel="Saving…"
          variant="primary"
        />
        {paused ? (
          <ActionButton
            action={resumeServiceAction}
            clientId={clientId}
            label="Resume service"
            pendingLabel="Resuming…"
            variant="primary"
          />
        ) : (
          <ActionButton
            action={pauseServiceAction}
            clientId={clientId}
            label="Pause service"
            pendingLabel="Pausing…"
            variant="danger"
          />
        )}
      </div>

      {/* --- what the owner asked for -------------------------------------- */}
      <div className="border-t border-ink-200 pt-4">
        <p className="text-[13px] font-medium text-ink-700">The owner&rsquo;s request</p>
        {props.paymentRequested ? (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
            Asked for payment details on {props.paymentRequested}. Reply to{' '}
            {props.owner.name || 'the owner'}
            {props.owner.email ? ` · ${props.owner.email}` : ''}
            {props.owner.phone ? ` · ${props.owner.phone}` : ''}.
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-ink-500">
            They have not asked what this costs yet.
          </p>
        )}
      </div>

      {/* --- what was agreed ---------------------------------------------- */}
      <form action={save} className="border-t border-ink-200 pt-4">
        <input type="hidden" name="clientId" value={clientId} />
        <p className="text-[13px] font-medium text-ink-700">
          What was agreed
          <span className="ml-2 font-normal text-ink-500">
            Operator only. Never shown in the owner&rsquo;s workspace.
          </span>
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" hint="Whole rupees. Leave blank until something is agreed.">
            <Input
              name="amountInr"
              type="number"
              min={0}
              step={1}
              defaultValue={props.commercial.amountInr ?? ''}
              placeholder="—"
            />
          </Field>
          <Field label="How often">
            <Select name="cadence" defaultValue={props.commercial.cadence}>
              <option value="MONTHLY">Every month</option>
              <option value="QUARTERLY">Every quarter</option>
              <option value="YEARLY">Every year</option>
              <option value="ONE_OFF">One off</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 grid gap-4">
          <Field
            label="Payment instructions"
            hint="The UPI id or bank line you send by hand. RepOS takes no payments and stores no card."
          >
            <Textarea
              name="paymentInstructions"
              defaultValue={props.commercial.paymentInstructions}
              placeholder="UPI: business@bank · or account details"
            />
          </Field>
          <Field label="Note" hint="What was discussed, what was promised.">
            <Textarea name="note" defaultValue={props.commercial.note} />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="submit" name="mark" value="sent" disabled={saving}>
            Save and mark instructions sent
          </Button>
          <Button type="submit" name="mark" value="paid" disabled={saving}>
            Save and mark paid
          </Button>
        </div>

        <p className="mt-2 text-[12px] text-ink-500">
          {props.commercial.instructionsSent
            ? `Instructions sent ${props.commercial.instructionsSent}.`
            : 'Instructions not sent yet.'}{' '}
          {props.commercial.paid ? `Paid ${props.commercial.paid}.` : 'No payment recorded.'}
        </p>

        <Notice state={saveState} />
      </form>
    </div>
  );
}
