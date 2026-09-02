import type { PrismaClient } from '@prisma/client';
import {
  clientInputSchema,
  normaliseBusinessName,
  type ClientInput,
} from './schema';

/**
 * Client management, independent of Next.js.
 *
 * Server actions in src/lib/actions/clients.ts are thin wrappers around this.
 * Keeping the logic here means duplicate protection, archiving and vertical
 * changes are all directly testable against a real SQLite database.
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

/**
 * Voice rows are created EMPTY, for the same reason kit rows are.
 *
 * A blank field means "use this vertical's voice" (see src/lib/reply/voice.ts).
 * Copying the pack's preset in here makes every client a permanent override, so
 * a later improvement to a pack never reaches anyone already onboarded. That is
 * exactly what happened to the kit before M3, and what made replies for a
 * Hinglish-speaking trade come out in English.
 */
function voiceDefaultsFor() {
  return {};
}

/**
 * Kit rows are created EMPTY on purpose.
 *
 * In the kit content engine, a blank field means "use this vertical's wording"
 * (see src/lib/kit/content.ts). Seeding these slots with a copy of the pack's
 * text would turn every client into a permanent override, so a later
 * improvement to a pack would never reach clients already onboarded. Blank
 * keeps the vertical pack the live source of truth.
 */
function kitDefaultsFor() {
  return {};
}

/**
 * Duplicate guard: two ACTIVE (non-archived) clients may not share a business
 * name once case and punctuation are normalised. Archived clients are ignored,
 * so a business can be re-onboarded after being archived.
 */
export async function findActiveNameCollision(
  db: PrismaClient,
  businessName: string,
  excludeId?: string,
): Promise<{ id: string; businessName: string } | null> {
  const target = normaliseBusinessName(businessName);
  if (target.length === 0) return null;

  const candidates = await db.client.findMany({
    where: { archivedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, businessName: true },
  });

  return (
    candidates.find((c) => normaliseBusinessName(c.businessName) === target) ?? null
  );
}

function zodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function createClient(
  db: PrismaClient,
  raw: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const parsed = clientInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }

  const input: ClientInput = parsed.data;

  const collision = await findActiveNameCollision(db, input.businessName);
  if (collision) {
    return err('That business is already on your active client list.', {
      businessName: `"${collision.businessName}" already exists. Archive it first, or use a name that distinguishes the two (for example by adding the area).`,
    });
  }

  try {
    const created = await db.client.create({
      data: {
        ...input,
        voiceProfile: { create: voiceDefaultsFor() },
        policy: { create: {} },
        kitConfig: {
          create: kitDefaultsFor(),
        },
      },
      select: { id: true },
    });
    return ok(created);
  } catch (error) {
    return err(
      error instanceof Error ? error.message : 'Could not save this client.',
    );
  }
}

export async function updateClient(
  db: PrismaClient,
  id: string,
  raw: unknown,
): Promise<ServiceResult<{ id: string; verticalChanged: boolean }>> {
  if (!id) return err('Missing client id.');

  const existing = await db.client.findUnique({
    where: { id },
    select: { id: true, vertical: true },
  });
  if (!existing) return err('That client no longer exists.');

  const parsed = clientInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }

  const input: ClientInput = parsed.data;

  const collision = await findActiveNameCollision(db, input.businessName, id);
  if (collision) {
    return err('Another active client already uses that name.', {
      businessName: `"${collision.businessName}" already exists on your active list.`,
    });
  }

  try {
    await db.client.update({ where: { id }, data: input });
  } catch (error) {
    return err(
      error instanceof Error ? error.message : 'Could not update this client.',
    );
  }

  return ok({ id, verticalChanged: existing.vertical !== input.vertical });
}

export type ClientListRow = {
  id: string;
  businessName: string;
  vertical: string;
  areaLabel: string | null;
  status: string;
  plan: string;
  baselineRating: number | null;
  kitInstalledDate: Date | null;
  archivedAt: Date | null;
  snapshotCount: number;
  lastSnapshotAt: Date | null;
};

/**
 * Working list. Archived clients are excluded unless explicitly requested, so
 * the default view is only what the operator is actually servicing.
 */
export async function listClients(
  db: PrismaClient,
  options: { includeArchived?: boolean; onlyArchived?: boolean } = {},
): Promise<ClientListRow[]> {
  const where = options.onlyArchived
    ? { archivedAt: { not: null } }
    : options.includeArchived
      ? {}
      : { archivedAt: null };

  const rows = await db.client.findMany({
    where,
    orderBy: [{ businessName: 'asc' }],
    select: {
      id: true,
      businessName: true,
      vertical: true,
      areaLabel: true,
      status: true,
      plan: true,
      baselineRating: true,
      kitInstalledDate: true,
      archivedAt: true,
      _count: { select: { snapshots: true } },
      snapshots: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
        select: { capturedAt: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    businessName: row.businessName,
    vertical: row.vertical,
    areaLabel: row.areaLabel,
    status: row.status,
    plan: row.plan,
    baselineRating: row.baselineRating,
    kitInstalledDate: row.kitInstalledDate,
    archivedAt: row.archivedAt,
    snapshotCount: row._count.snapshots,
    lastSnapshotAt: row.snapshots[0]?.capturedAt ?? null,
  }));
}

export async function countClients(
  db: PrismaClient,
): Promise<{ active: number; archived: number }> {
  const [active, archived] = await Promise.all([
    db.client.count({ where: { archivedAt: null } }),
    db.client.count({ where: { archivedAt: { not: null } } }),
  ]);
  return { active, archived };
}

/**
 * Archive, not delete.
 *
 * Snapshots, pasted feedback and time entries are the historical intelligence
 * this whole product is built on — archiving hides the client from working
 * views while keeping every past month intact and comparable.
 */
export async function archiveClient(
  db: PrismaClient,
  id: string,
  now: Date = new Date(),
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.client.findUnique({
    where: { id },
    select: { id: true, archivedAt: true },
  });
  if (!existing) return err('That client no longer exists.');
  if (existing.archivedAt) return ok({ id });

  await db.client.update({
    where: { id },
    data: { archivedAt: now, status: 'CHURNED' },
  });
  return ok({ id });
}

export async function restoreClient(
  db: PrismaClient,
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.client.findUnique({
    where: { id },
    select: { id: true, businessName: true, archivedAt: true },
  });
  if (!existing) return err('That client no longer exists.');
  if (!existing.archivedAt) return ok({ id });

  // Restoring must not create the duplicate the archive was hiding.
  const collision = await findActiveNameCollision(db, existing.businessName, id);
  if (collision) {
    return err(
      `"${collision.businessName}" is already active. Rename or archive that client before restoring this one.`,
    );
  }

  await db.client.update({
    where: { id },
    data: { archivedAt: null, status: 'PAUSED' },
  });
  return ok({ id });
}

/**
 * Permanent removal, for a delete-on-request from the business owner.
 *
 * Separate from archiving on purpose: this destroys the historical record.
 * The typed confirmation must match the business name exactly, and is checked
 * here on the server rather than only in the browser.
 */
export async function purgeClient(
  db: PrismaClient,
  id: string,
  confirmation: string,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.client.findUnique({
    where: { id },
    select: { id: true, businessName: true },
  });
  if (!existing) return err('That client no longer exists.');

  if (confirmation.trim() !== existing.businessName) {
    return err('The confirmation text did not match the business name.', {
      confirm: 'Type the business name exactly as it appears above.',
    });
  }

  await db.client.delete({ where: { id } });
  return ok({ id });
}
