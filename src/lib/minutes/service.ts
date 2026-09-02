import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

/**
 * MINUTES — the operational memory layer.
 *
 * One minute is one thing that happened with a client: a conversation, a
 * decision, an issue raised, something to chase. It exists so RepOS can
 * remember context between monthly snapshots, and so a later milestone can join
 * feedback → insight → action → result.
 *
 * Deliberately small. This is not a CRM: there is no pipeline, no assignee, no
 * reminder engine and no customer record. Everything here is business context
 * the operator typed about the OWNER's business.
 *
 * Universal by design: identical for a clinic, a salon and a restaurant. The
 * vertical pack plays no part here, and no vertical-specific page exists.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = {
  ok: false;
  message: string;
  errors: Record<string, string>;
};
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Six categories, no more. Each one earns its place by changing how the
 * operator reads the entry later.
 */
export const MINUTE_CATEGORIES = [
  'OWNER_CONVERSATION',
  'ISSUE',
  'DECISION',
  'ACTION',
  'FOLLOW_UP',
  'GENERAL',
] as const;

export type MinuteCategory = (typeof MINUTE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<MinuteCategory, string> = {
  OWNER_CONVERSATION: 'Owner conversation',
  ISSUE: 'Issue',
  DECISION: 'Decision',
  ACTION: 'Action',
  FOLLOW_UP: 'Follow-up',
  GENERAL: 'General',
};

/**
 * Splits the categories into "what happened" and "what was decided or still
 * needs doing". This is the only nod to action tracking in M4 — it changes how
 * an entry is coloured and nothing else. The real action loop is M11.
 */
export const FORWARD_LOOKING: ReadonlySet<MinuteCategory> = new Set([
  'DECISION',
  'ACTION',
  'FOLLOW_UP',
]);

export function isForwardLooking(category: string): boolean {
  return FORWARD_LOOKING.has(category as MinuteCategory);
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as MinuteCategory] ?? category;
}

export function categoryOptions(): Array<{ value: string; label: string }> {
  return MINUTE_CATEGORIES.map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  }));
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const minuteInputSchema = z.object({
  occurredAt: z.date({ message: 'Enter a valid date.' }),
  category: z.enum(MINUTE_CATEGORIES, { message: 'Choose a category.' }),
  title: z
    .string()
    .min(2, 'Write a short title — one line describing what happened.')
    .max(140, 'Keep the title to one line; put the detail in the note.'),
  body: z.string().max(8000, 'That note is too long.'),
});

export type MinuteInput = z.infer<typeof minuteInputSchema>;

function zodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type MinuteRow = {
  id: string;
  clientId: string;
  occurredAt: Date;
  category: string;
  categoryLabel: string;
  forwardLooking: boolean;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

function toRow(row: {
  id: string;
  clientId: string;
  occurredAt: Date;
  category: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}): MinuteRow {
  return {
    ...row,
    categoryLabel: categoryLabel(row.category),
    forwardLooking: isForwardLooking(row.category),
  };
}

/**
 * One client's memory, newest first.
 *
 * Scoped by clientId in the query itself, so a minute can never surface under a
 * client it does not belong to.
 */
export async function listClientMinutes(
  db: PrismaClient,
  clientId: string,
  options: { limit?: number } = {},
): Promise<MinuteRow[]> {
  const rows = await db.minute.findMany({
    where: { clientId },
    // Ties broken by creation order so the list is stable across reads.
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    ...(options.limit ? { take: options.limit } : {}),
  });
  return rows.map(toRow);
}

export type RecentMinute = MinuteRow & {
  businessName: string;
  vertical: string;
};

/** Cross-client feed for the Minutes page. Archived clients are excluded. */
export async function listRecentMinutes(
  db: PrismaClient,
  options: { limit?: number } = {},
): Promise<RecentMinute[]> {
  const rows = await db.minute.findMany({
    where: { client: { archivedAt: null } },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: options.limit ?? 50,
    include: {
      client: { select: { businessName: true, vertical: true } },
    },
  });

  return rows.map((row) => ({
    ...toRow(row),
    businessName: row.client.businessName,
    vertical: row.client.vertical,
  }));
}

/** Single minute, scoped to its client so ids cannot be probed across clients. */
export async function getMinute(
  db: PrismaClient,
  clientId: string,
  minuteId: string,
): Promise<MinuteRow | null> {
  const row = await db.minute.findFirst({ where: { id: minuteId, clientId } });
  return row ? toRow(row) : null;
}

export async function countClientMinutes(
  db: PrismaClient,
  clientId: string,
): Promise<number> {
  return db.minute.count({ where: { clientId } });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createMinute(
  db: PrismaClient,
  clientId: string,
  raw: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) return err('That client no longer exists.');

  const parsed = minuteInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }

  const created = await db.minute.create({
    data: { clientId, ...parsed.data },
    select: { id: true },
  });
  return ok(created);
}

export async function updateMinute(
  db: PrismaClient,
  clientId: string,
  minuteId: string,
  raw: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.minute.findFirst({
    where: { id: minuteId, clientId },
    select: { id: true },
  });
  if (!existing) return err('That minute no longer exists.');

  const parsed = minuteInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }

  await db.minute.update({ where: { id: minuteId }, data: parsed.data });
  return ok({ id: minuteId });
}

/**
 * Deletes one minute. Scoped to the client, so a minute belonging to another
 * client cannot be removed through this path.
 */
export async function deleteMinute(
  db: PrismaClient,
  clientId: string,
  minuteId: string,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.minute.findFirst({
    where: { id: minuteId, clientId },
    select: { id: true },
  });
  if (!existing) return err('That minute no longer exists.');

  await db.minute.delete({ where: { id: minuteId } });
  return ok({ id: minuteId });
}
