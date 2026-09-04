import type { PrismaClient } from '@prisma/client';
import { newPublicToken } from '@/lib/tokens';
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
        // The customer-facing feedback page exists from the moment the client
        // does (M17). It used to be created lazily, the first time somebody
        // opened one particular tab, so a client could be fully profiled and
        // marked active while having no front door at all — and nothing said so.
        //
        // A public review link given at creation is carried straight onto the
        // gateway, which is the row the customer's thank-you page reads.
        gateway: {
          create: {
            publicToken: newPublicToken(),
            publicReviewUrl: (input.reviewLinkUrl ?? '').trim(),
          },
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

// ---------------------------------------------------------------------------
// The owner’s private link (M16)
// ---------------------------------------------------------------------------
//
// Issuing and revoking live here rather than beside the portal, because both
// are things the OPERATOR does to a client row. The owner’s own path only
// reads — see `@/lib/portal/access`.
/**
 * The client's portal address, created on first use.
 *
 * Operator-side only. Like the feedback gateway, the row is filled in lazily
 * so every client that already existed gets one the first time it is needed,
 * with no migration step to forget.
 */
export async function ensurePortalToken(
  db: PrismaClient,
  clientId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, portalToken: true },
  });
  if (!client) return null;
  if (client.portalToken) return client.portalToken;

  // A collision on 110 random bits will not happen; the retry exists so the
  // guarantee rests on the unique constraint rather than on luck.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = newPublicToken();
    try {
      const updated = await db.client.update({
        where: { id: clientId },
        data: { portalToken: token, portalTokenAt: now },
        select: { portalToken: true },
      });
      return updated.portalToken;
    } catch (error) {
      const existing = await db.client.findUnique({
        where: { id: clientId },
        select: { portalToken: true },
      });
      if (existing?.portalToken) return existing.portalToken;
      if (attempt === 2) throw error;
    }
  }
  return null;
}

/** Issues a new address and retires the old one immediately. */
export async function regeneratePortalToken(
  db: PrismaClient,
  clientId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const updated = await db.client.update({
        where: { id: clientId },
        data: { portalToken: newPublicToken(), portalTokenAt: now },
        select: { portalToken: true },
      });
      return updated.portalToken;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Onboarding state (M17)
// ---------------------------------------------------------------------------

/**
 * What is still true, and still missing, for one business.
 *
 * ONE definition, read by the client page's checklist and by the command
 * centre, so the two can never tell the operator different things about the
 * same client. Nothing here needs a public listing, a Google account or a
 * customer's phone number.
 */
export type ClientSetup = {
  clientId: string;
  /** The feedback page exists and is switched on. */
  gatewayLive: boolean;
  /** It exists but the operator paused it, so a scanned card stores nothing. */
  gatewayPaused: boolean;
  /** The operator recorded that the printed cards are physically on site. */
  cardsOnSite: boolean;
  /** The operator recorded that the owner was actually sent their link. */
  ownerLinkSent: boolean;
  contextCount: number;
  feedbackCount: number;
  /** The steps still outstanding, in the order they should be done. */
  remaining: string[];
  complete: boolean;
};

type SetupRow = {
  id: string;
  kitInstalledDate: Date | null;
  portalLinkSentAt: Date | null;
  gateway: { enabled: boolean } | null;
  _count: { context: number; feedback: number };
};

function setupFrom(row: SetupRow): ClientSetup {
  const gatewayLive = row.gateway?.enabled === true;
  const gatewayPaused = row.gateway !== null && !row.gateway.enabled;
  const cardsOnSite = row.kitInstalledDate !== null;
  const ownerLinkSent = row.portalLinkSentAt !== null;

  const remaining: string[] = [];
  if (!gatewayLive) {
    remaining.push(
      gatewayPaused ? 'Switch the feedback page back on' : 'Switch the feedback page on',
    );
  }
  if (!cardsOnSite) remaining.push('Print the cards and get them on site');
  if (!ownerLinkSent) remaining.push('Send the owner their link');

  return {
    clientId: row.id,
    gatewayLive,
    gatewayPaused,
    cardsOnSite,
    ownerLinkSent,
    contextCount: row._count.context,
    feedbackCount: row._count.feedback,
    remaining,
    complete: remaining.length === 0,
  };
}

const SETUP_SELECT = {
  id: true,
  kitInstalledDate: true,
  portalLinkSentAt: true,
  gateway: { select: { enabled: true } },
  _count: { select: { context: true, feedback: true } },
} as const;

export async function getClientSetup(
  db: PrismaClient,
  clientId: string,
): Promise<ClientSetup> {
  const row = await db.client.findUnique({ where: { id: clientId }, select: SETUP_SELECT });
  if (!row) {
    return {
      clientId,
      gatewayLive: false,
      gatewayPaused: false,
      cardsOnSite: false,
      ownerLinkSent: false,
      contextCount: 0,
      feedbackCount: 0,
      remaining: [],
      complete: false,
    };
  }
  return setupFrom(row);
}

/**
 * The same answer for every client at once, in one query.
 *
 * The command centre is built on a fixed number of queries however many
 * clients there are; this keeps that true.
 */
export async function listClientSetup(
  db: PrismaClient,
  clientIds: string[],
): Promise<Map<string, ClientSetup>> {
  if (clientIds.length === 0) return new Map();
  const rows = await db.client.findMany({
    where: { id: { in: clientIds } },
    select: SETUP_SELECT,
  });
  return new Map(rows.map((row) => [row.id, setupFrom(row)]));
}

/**
 * Records that the owner was actually sent their link.
 *
 * A token existing is not a business being onboarded — RepOS mints one the
 * first time the operator opens the client. This is the operator saying "I
 * have handed it over", which is the fact the checklist and the board need.
 */
export async function setPortalLinkSent(
  db: PrismaClient,
  clientId: string,
  sent: boolean,
  now: Date = new Date(),
): Promise<ServiceResult<{ sent: boolean }>> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return err('That client no longer exists.');

  await db.client.update({
    where: { id: clientId },
    data: { portalLinkSentAt: sent ? now : null },
  });
  return ok({ sent });
}
