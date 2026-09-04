'use client';

import { useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import {
  ActionForm,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/form-shell';
import {
  answerQuestionAction,
  createContextAction,
  deleteContextAction,
  restoreContextAction,
  retireContextAction,
  updateContextAction,
} from '@/lib/actions/context';
import { formatDate } from '@/lib/format';

/**
 * Business context forms (M13).
 *
 * Four optional prompts an operator can fill in under two minutes while
 * talking to the owner, and a list of what has been recorded — each line
 * editable, retirable ("no longer true") and removable. Nothing is mandatory;
 * a business with one line of context is fine.
 */

export type ThemeOption = { value: string; label: string };
export type ActionOption = { value: string; label: string };

export type ContextRowView = {
  id: string;
  kind: string;
  kindLabel: string;
  text: string;
  themeKey: string | null;
  themeLabel: string | null;
  constraintKey: string | null;
  constraintLabel: string | null;
  actionId: string | null;
  recordedAt: Date;
  retiredAt: Date | null;
  retiredNote: string;
};

const NO_THEME: ThemeOption = { value: '', label: 'No particular theme' };

const PII_NOTE = 'Business context only — never a customer\'s name or contact details.';

// ---------------------------------------------------------------------------
// The open question
// ---------------------------------------------------------------------------

export function OwnerQuestionCard({
  clientId,
  question,
}: {
  clientId: string;
  question: { themeKey: string; themeLabel: string; question: string; options: string[] } | null;
}) {
  if (!question) return null;
  return (
    <Card>
      <CardHeader
        title="RepOS is asking the owner"
        description={`Shown on their Home page under ${question.themeLabel}. Record the answer here and it stops asking.`}
      />
      <CardBody>
        <p className="text-[15px] font-medium text-ink-900">{question.question}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {question.options.map((option) => (
            <form key={option} action={answerQuestionAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="themeKey" value={question.themeKey} />
              <input type="hidden" name="answer" value={option} />
              <Button type="submit" variant="secondary">
                {option}
              </Button>
            </form>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-ink-500">
          Saved as &ldquo;You told us&rdquo; against {question.themeLabel.toLowerCase()}. Answering
          again replaces the earlier answer.
        </p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// The four prompts
// ---------------------------------------------------------------------------

export function ContextPrompts({
  clientId,
  themes,
  constraints,
}: {
  clientId: string;
  themes: ThemeOption[];
  constraints: ReadonlyArray<{ value: string; label: string }>;
}) {
  const themeOptions = [NO_THEME, ...themes];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="What matters most right now?" description="One thing. It sits beside the evidence for that theme." />
        <CardBody>
          <ActionForm action={createContextAction} submitLabel="Save" footerNote={PII_NOTE}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="kind" value="PRIORITY" />
            <TextField
              name="text"
              label="In the owner's words"
              required
              placeholder="Reduce waiting time — nobody should wait more than 15 minutes"
              autoComplete="off"
            />
            <SelectField name="themeKey" label="About" options={themeOptions} defaultValue="" />
          </ActionForm>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="How does the business operate?" description="Busy periods, who does what, anything RepOS could otherwise get wrong." />
        <CardBody>
          <ActionForm action={createContextAction} submitLabel="Save" footerNote={PII_NOTE}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="kind" value="OPERATING" />
            <TextAreaField
              name="text"
              label="In the owner's words"
              required
              rows={2}
              placeholder="Friday and Saturday evenings are much busier than other days"
            />
            <SelectField name="themeKey" label="About" options={themeOptions} defaultValue="" />
          </ActionForm>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Anything RepOS should not recommend?" description="RepOS keeps the complaint visible; it only changes which suggestion is practical." />
        <CardBody>
          <ActionForm action={createContextAction} submitLabel="Save" footerNote={PII_NOTE}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="kind" value="CONSTRAINT" />
            <SelectField name="constraintKey" label="Rule out" options={constraints} defaultValue="STAFF" />
            <TextField
              name="text"
              label="In the owner's words"
              required
              placeholder="We cannot add another employee right now"
              autoComplete="off"
            />
          </ActionForm>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Anything else RepOS should remember?" description="Something already tried, or a definition RepOS should keep in mind." />
        <CardBody>
          <ActionForm action={createContextAction} submitLabel="Save" footerNote={PII_NOTE}>
            <input type="hidden" name="clientId" value={clientId} />
            <SelectField
              name="kind"
              label="This is"
              defaultValue="DEFINITION"
              options={[
                { value: 'DEFINITION', label: 'Worth knowing' },
                { value: 'TRIED', label: 'Something already tried' },
                { value: 'FOCUS', label: 'Current focus' },
              ]}
            />
            <TextAreaField
              name="text"
              label="In the owner's words"
              required
              rows={2}
              placeholder="An appointment running ten minutes late is normal here"
            />
            <SelectField name="themeKey" label="About" options={themeOptions} defaultValue="" />
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// What has been recorded
// ---------------------------------------------------------------------------

function EditForm({
  clientId,
  row,
  themes,
  constraints,
  actions,
  onDone,
}: {
  clientId: string;
  row: ContextRowView;
  themes: ThemeOption[];
  constraints: ReadonlyArray<{ value: string; label: string }>;
  actions: ActionOption[];
  onDone: () => void;
}) {
  return (
    <ActionForm
      action={updateContextAction}
      submitLabel="Save changes"
      secondaryAction={
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      }
      footerNote={PII_NOTE}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="contextId" value={row.id} />
      <input type="hidden" name="kind" value={row.kind} />
      {row.kind === 'ANSWER' ? <input type="hidden" name="questionKey" value={row.themeKey ?? ''} /> : null}
      <TextAreaField name="text" label="In the owner's words" required rows={2} defaultValue={row.text} />
      {row.kind === 'CONSTRAINT' ? (
        <SelectField
          name="constraintKey"
          label="Rule out"
          options={constraints}
          defaultValue={row.constraintKey ?? 'OTHER'}
        />
      ) : null}
      {row.kind !== 'ANSWER' && row.kind !== 'CONSTRAINT' ? (
        <SelectField
          name="themeKey"
          label="About"
          options={[NO_THEME, ...themes]}
          defaultValue={row.themeKey ?? ''}
        />
      ) : null}
      {row.kind === 'TRIED' && actions.length > 0 ? (
        <SelectField
          name="actionId"
          label="Same as an improvement already on record?"
          options={[{ value: '', label: 'No — this was outside RepOS' }, ...actions]}
          defaultValue={row.actionId ?? ''}
          hint="If it is, link it rather than describing it twice."
        />
      ) : null}
      <TextField name="recordedAt" label="When the owner said this" type="date" defaultValue={toInputDate(row.recordedAt)} />
    </ActionForm>
  );
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ContextRowItem({
  clientId,
  row,
  themes,
  constraints,
  actions,
}: {
  clientId: string;
  row: ContextRowView;
  themes: ThemeOption[];
  constraints: ReadonlyArray<{ value: string; label: string }>;
  actions: ActionOption[];
}) {
  const [editing, setEditing] = useState(false);
  const retired = row.retiredAt !== null;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={retired ? 'neutral' : 'brand'}>{row.kindLabel}</Badge>
            {row.themeLabel ? <span className="text-[12px] text-ink-500">{row.themeLabel}</span> : null}
            {row.constraintLabel ? <span className="text-[12px] text-ink-500">{row.constraintLabel}</span> : null}
          </div>
          <p className={retired ? 'mt-1.5 text-[14px] text-ink-500 line-through' : 'mt-1.5 text-[14px] text-ink-900'}>
            {row.text}
          </p>
          <p className="mt-1 text-[12px] text-ink-500">
            Owner told us on {formatDate(row.recordedAt)}
            {retired && row.retiredAt ? ` · no longer true since ${formatDate(row.retiredAt)}` : ''}
            {retired && row.retiredNote ? ` — ${row.retiredNote}` : ''}
          </p>
        </div>

        {!editing ? (
          <div className="flex flex-wrap items-center gap-2">
            {!retired ? (
              <>
                <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                  Update
                </Button>
                <form action={retireContextAction}>
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="contextId" value={row.id} />
                  <Button type="submit" variant="secondary">
                    No longer true
                  </Button>
                </form>
              </>
            ) : (
              <form action={restoreContextAction}>
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="contextId" value={row.id} />
                <Button type="submit" variant="secondary">
                  True again
                </Button>
              </form>
            )}
            <form
              action={deleteContextAction}
              onSubmit={(e) => {
                if (!window.confirm('Remove this line for good?')) e.preventDefault();
              }}
            >
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="contextId" value={row.id} />
              <Button type="submit" variant="danger">
                Remove
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-4">
          <EditForm
            clientId={clientId}
            row={row}
            themes={themes}
            constraints={constraints}
            actions={actions}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : null}
    </li>
  );
}

export function ContextList({
  clientId,
  rows,
  themes,
  constraints,
  actions,
}: {
  clientId: string;
  rows: ContextRowView[];
  themes: ThemeOption[];
  constraints: ReadonlyArray<{ value: string; label: string }>;
  actions: ActionOption[];
}) {
  const active = rows.filter((r) => r.retiredAt === null);
  const retired = rows.filter((r) => r.retiredAt !== null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="What the owner has told RepOS"
          description={
            active.length === 0
              ? 'Nothing yet. Anything recorded above appears on the owner\'s pages as "You told us".'
              : `${active.length} ${active.length === 1 ? 'line' : 'lines'} the owner sees as "You told us".`
          }
        />
        {active.length > 0 ? (
          <CardBody>
            <ul className="divide-y divide-ink-100">
              {active.map((row) => (
                <ContextRowItem
                  key={row.id}
                  clientId={clientId}
                  row={row}
                  themes={themes}
                  constraints={constraints}
                  actions={actions}
                />
              ))}
            </ul>
          </CardBody>
        ) : null}
      </Card>

      {retired.length > 0 ? (
        <Card>
          <CardHeader title="No longer true" description="Kept for the record. Not shown to the owner as current." />
          <CardBody>
            <ul className="divide-y divide-ink-100">
              {retired.map((row) => (
                <ContextRowItem
                  key={row.id}
                  clientId={clientId}
                  row={row}
                  themes={themes}
                  constraints={constraints}
                  actions={actions}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
