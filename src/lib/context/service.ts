import type { PrismaClient } from '@prisma/client';
import { oncePerRequest } from '@/lib/request-cache';
import { z } from 'zod';
import { getPackOrFallback } from '@/lib/packs';
import { redactPii } from '@/lib/redact';
import {
  CONSTRAINT_KEYS,
  CONSTRAINT_LABELS,
  CONTEXT_KINDS,
  CONTEXT_PROVENANCE,
  KIND_LABELS,
  type ConstraintKey,
  type ContextItem,
  type ContextKind,
  type ContextProvenance,
  type ContextSet,
} from './apply';

/**
 * BUSINESS CONTEXT (M13) — what the owner told RepOS about their business.
 *
 * The memory that lets RepOS understand THIS business rather than its
 * vertical: what matters most to the owner, how the place runs, what RepOS
 * should not suggest, what has already been tried, and the answers the owner
 * gave to RepOS's questions.
 *
 * Three rules, kept by construction:
 *
 *  1. OWNER WORDS STAY OWNER WORDS. Everything written here carries the
 *     provenance OWNER_TOLD_US and is shown back as "You told us …". Nothing
 *     in this table is ever counted as a customer saying it.
 *
 *  2. NOT A CONTACT LIST. A line that carries a phone number, an email or a
 *     handle is refused, not redacted: business context describes how the
 *     business works, never who its customers or staff are.
 *
 *  3. CONTEXT AGES. Every line has the date the owner told us and can be
 *     retired when it stops being true. Retired lines are kept for the record
 *     and never shown as current.
 *
 * M11 stays the formal record of improvement attempts. A TRIED line may point
 * at an action; it never duplicates one.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}
function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

export { CONSTRAINT_KEYS, CONSTRAINT_LABELS, CONTEXT_KINDS, KIND_LABELS };
export type { ConstraintKey, ContextItem, ContextKind, ContextProvenance, ContextSet };

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const MAX_CONTEXT_TEXT = 400;

export const contextInputSchema = z.object({
  kind: z.enum(CONTEXT_KINDS, { message: 'Choose what kind of thing this is.' }),
  text: z
    .string()
    .trim()
    .min(2, 'Write what the owner told you, in their words.')
    .max(MAX_CONTEXT_TEXT, `Keep it under ${MAX_CONTEXT_TEXT} characters — one thing per line.`),
  themeKey: z.string().trim().nullable().default(null),
  constraintKey: z.enum(CONSTRAINT_KEYS).nullable().default(null),
  questionKey: z.string().trim().nullable().default(null),
  actionId: z.string().trim().nullable().default(null),
  recordedAt: z.date().nullable().default(null),
});

export type ContextInput = z.input<typeof contextInputSchema>;

function zodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Business context must not become a contact list. Anything the redaction
 * layer would strip from a review is refused here outright.
 */
export function piiProblem(text: string): string | null {
  const result = redactPii(text);
  if (!result.redacted) return null;
  return 'Keep phone numbers, emails and personal details out — this is about how the business works, not who its customers are.';
}

type Validated = z.output<typeof contextInputSchema>;

async function validate(
  db: PrismaClient,
  clientId: string,
  raw: unknown,
): Promise<ServiceResult<Validated>> {
  const parsed = contextInputSchema.safeParse(raw);
  if (!parsed.success) return err('Some fields need attention.', zodErrors(parsed.error.issues));
  const input = parsed.data;

  const pii = piiProblem(input.text);
  if (pii) return err('Some fields need attention.', { text: pii });

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, vertical: true },
  });
  if (!client) return err('That client no longer exists.');

  const pack = getPackOrFallback(client.vertical);
  const themeKey = input.themeKey || null;
  if (
    themeKey &&
    !pack.issueTaxonomy.some((t) => t.key === themeKey) &&
    !pack.praiseTaxonomy.some((t) => t.key === themeKey)
  ) {
    return err('Some fields need attention.', { themeKey: 'That theme is not one this business uses.' });
  }

  if (input.kind === 'CONSTRAINT' && !input.constraintKey) {
    return err('Some fields need attention.', { constraintKey: 'Say what RepOS should not suggest.' });
  }
  if (input.kind === 'ANSWER' && !input.questionKey) {
    return err('Some fields need attention.', { questionKey: 'An answer needs the question it answers.' });
  }

  const actionId = input.actionId || null;
  if (actionId) {
    const action = await db.improvementAction.findFirst({
      where: { id: actionId, clientId },
      select: { id: true },
    });
    if (!action) return err('Some fields need attention.', { actionId: 'That improvement is not this business\'s.' });
  }

  return ok({
    ...input,
    themeKey,
    constraintKey: input.kind === 'CONSTRAINT' ? input.constraintKey : null,
    questionKey: input.kind === 'ANSWER' ? input.questionKey : null,
    actionId,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type ContextRow = ContextItem & {
  kindLabel: string;
  constraintLabel: string | null;
  updatedAt: Date;
  retiredAt: Date | null;
  retiredNote: string;
};

function toRow(row: {
  id: string;
  kind: string;
  provenance: string;
  text: string;
  themeKey: string | null;
  constraintKey: string | null;
  questionKey: string | null;
  actionId: string | null;
  recordedAt: Date;
  updatedAt: Date;
  retiredAt: Date | null;
  retiredNote: string;
}): ContextRow {
  const kind = (CONTEXT_KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as ContextKind)
    : 'DEFINITION';
  const provenance = (CONTEXT_PROVENANCE as readonly string[]).includes(row.provenance)
    ? (row.provenance as ContextProvenance)
    : 'OWNER_TOLD_US';
  const constraintKey =
    row.constraintKey && (CONSTRAINT_KEYS as readonly string[]).includes(row.constraintKey)
      ? (row.constraintKey as ConstraintKey)
      : null;
  return {
    id: row.id,
    kind,
    kindLabel: KIND_LABELS[kind],
    provenance,
    text: row.text,
    themeKey: row.themeKey,
    constraintKey,
    constraintLabel: constraintKey ? CONSTRAINT_LABELS[constraintKey] : null,
    questionKey: row.questionKey,
    actionId: row.actionId,
    recordedAt: row.recordedAt,
    updatedAt: row.updatedAt,
    retiredAt: row.retiredAt,
    retiredNote: row.retiredNote,
  };
}

/** Everything the owner has told RepOS, newest first. Scoped in the query. */
export async function listClientContext(
  db: PrismaClient,
  clientId: string,
  options: { includeRetired?: boolean } = {},
): Promise<ContextRow[]> {
  const rows = await db.businessContext.findMany({
    where: { clientId, ...(options.includeRetired ? {} : { retiredAt: null }) },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
  });
  return rows.map(toRow);
}

/** The active context the reasoning and presentation layers read. */
export async function getContextSet(db: PrismaClient, clientId: string): Promise<ContextSet> {
  return oncePerRequest(`context:${clientId}`, async () => {
  const rows = await listClientContext(db, clientId);
  return { items: rows.map((r) => ({ ...r })) };
  });
}

export async function getContext(
  db: PrismaClient,
  clientId: string,
  contextId: string,
): Promise<ContextRow | null> {
  const row = await db.businessContext.findFirst({ where: { id: contextId, clientId } });
  return row ? toRow(row) : null;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createContext(
  db: PrismaClient,
  clientId: string,
  raw: unknown,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string }>> {
  const valid = await validate(db, clientId, raw);
  if (!valid.ok) return valid;
  const input = valid.data;
  const created = await db.businessContext.create({
    data: {
      clientId,
      kind: input.kind,
      provenance: 'OWNER_TOLD_US',
      text: input.text,
      themeKey: input.themeKey,
      constraintKey: input.constraintKey,
      questionKey: input.questionKey,
      actionId: input.actionId,
      recordedAt: input.recordedAt ?? options.now ?? new Date(),
    },
    select: { id: true },
  });
  return ok({ id: created.id });
}

export async function updateContext(
  db: PrismaClient,
  clientId: string,
  contextId: string,
  raw: unknown,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.businessContext.findFirst({ where: { id: contextId, clientId } });
  if (!existing) return err('That line no longer exists.');
  const valid = await validate(db, clientId, raw);
  if (!valid.ok) return valid;
  const input = valid.data;
  await db.businessContext.update({
    where: { id: contextId },
    data: {
      kind: input.kind,
      text: input.text,
      themeKey: input.themeKey,
      constraintKey: input.constraintKey,
      questionKey: input.questionKey,
      actionId: input.actionId,
      recordedAt: input.recordedAt ?? existing.recordedAt,
      updatedAt: options.now ?? new Date(),
    },
  });
  return ok({ id: contextId });
}

/** "No longer true." Kept for the record, never shown as current again. */
export async function retireContext(
  db: PrismaClient,
  clientId: string,
  contextId: string,
  options: { now?: Date; note?: string } = {},
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.businessContext.findFirst({ where: { id: contextId, clientId } });
  if (!existing) return err('That line no longer exists.');
  await db.businessContext.update({
    where: { id: contextId },
    data: { retiredAt: options.now ?? new Date(), retiredNote: (options.note ?? '').trim().slice(0, 200) },
  });
  return ok({ id: contextId });
}

export async function restoreContext(
  db: PrismaClient,
  clientId: string,
  contextId: string,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.businessContext.findFirst({ where: { id: contextId, clientId } });
  if (!existing) return err('That line no longer exists.');
  await db.businessContext.update({
    where: { id: contextId },
    data: { retiredAt: null, retiredNote: '' },
  });
  return ok({ id: contextId });
}

export async function deleteContext(
  db: PrismaClient,
  clientId: string,
  contextId: string,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.businessContext.findFirst({ where: { id: contextId, clientId } });
  if (!existing) return err('That line no longer exists.');
  await db.businessContext.delete({ where: { id: contextId } });
  return ok({ id: contextId });
}

/**
 * The owner answered one of RepOS's questions.
 *
 * One answer per question: answering again replaces the earlier answer rather
 * than piling up, so the owner is never asked to repeat themselves and RepOS
 * never holds two answers to one question.
 */
export async function answerQuestion(
  db: PrismaClient,
  clientId: string,
  input: { themeKey: string; answer: string },
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.businessContext.findFirst({
    where: { clientId, kind: 'ANSWER', questionKey: input.themeKey },
    select: { id: true },
  });
  const raw = {
    kind: 'ANSWER',
    text: input.answer,
    themeKey: input.themeKey,
    questionKey: input.themeKey,
    recordedAt: options.now ?? null,
  };
  if (existing) {
    const updated = await updateContext(db, clientId, existing.id, raw, options);
    if (!updated.ok) return updated;
    await db.businessContext.update({
      where: { id: existing.id },
      data: { retiredAt: null, retiredNote: '' },
    });
    return ok({ id: existing.id });
  }
  return createContext(db, clientId, raw, options);
}
