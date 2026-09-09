import type { PrismaClient } from '@prisma/client';

/**
 * ASKING TO CARRY ON (M28).
 *
 * The owner presses "Extend access", gives a number to be reached on, and a row
 * appears. That is the whole of it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO, because the button's name invites all four:
 * it does not extend the trial, does not move `trialEndsAt` or `trialStartsAt`,
 * does not unlock the workspace, and does not take a payment. There is no
 * Stripe, no invoice, no card field and no automatic message. Headway reads the
 * request, telephones the business, and arranges continuation by hand — the
 * same way every other commercial conversation in RepOS works, and the same
 * reason there is no price anywhere in the product.
 *
 * PHONE IS REQUIRED AND EMAIL IS NOT. A small business in India is reached on a
 * phone; an address the owner does not check is worse than no address, because
 * it looks like a way to reach them. The name is carried from the business
 * rather than typed, because the person is signed in and Headway already knows
 * who they are.
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

/** NEW → CONTACTED → RESOLVED. Only the operator moves it along. */
export const CONTINUATION_STATUSES = ['NEW', 'CONTACTED', 'RESOLVED'] as const;
export type ContinuationRequestStatus = (typeof CONTINUATION_STATUSES)[number];

/** A request nobody has dealt with yet. What "already asked" means. */
export const PENDING_STATUSES: readonly string[] = ['NEW', 'CONTACTED'];

// ---------------------------------------------------------------------------
// What counts as a number we could ring
// ---------------------------------------------------------------------------

/**
 * Deliberately permissive about shape and strict about substance.
 *
 * Indian mobiles are ten digits; the same owner may write +91, 0091, a leading
 * zero, spaces, brackets or dashes, and a business with an international
 * partner may give a longer number. So the punctuation is thrown away and what
 * is left is counted: between 8 and 15 digits, which is the E.164 range. A
 * stricter pattern would reject real numbers, and rejecting a real customer's
 * real number to satisfy a regex is a worse outcome than storing one that needs
 * a second look.
 *
 * What it does refuse is the thing a required field is actually for: nothing,
 * spaces, and a string with no digits in it.
 */
export function normalisePhone(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (text.length === 0) return null;
  const digits = text.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  // Kept as typed, minus anything that is not a digit, a plus or a space, so
  // the operator dials what the owner meant to give them.
  const cleaned = text.replace(/[^\d+ ]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Optional. Null when not given; refused only when given and obviously wrong. */
export function normaliseEmail(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  const text = String(raw ?? '').trim().toLowerCase();
  if (text.length === 0) return { ok: true, value: null };
  // One @, something either side, a dot in the domain, and no whitespace.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { ok: false };
  return { ok: true, value: text };
}

// ---------------------------------------------------------------------------
// The request itself
// ---------------------------------------------------------------------------

export type ContinuationRequest = {
  id: string;
  clientId: string;
  businessName: string;
  name: string;
  phone: string;
  email: string | null;
  status: ContinuationRequestStatus;
  createdAt: Date;
};

function statusOf(raw: string): ContinuationRequestStatus {
  return (CONTINUATION_STATUSES as readonly string[]).includes(raw)
    ? (raw as ContinuationRequestStatus)
    : 'NEW';
}

/** The open request for one business, if it has one. */
export async function pendingRequestFor(
  db: PrismaClient,
  clientId: string,
): Promise<ContinuationRequest | null> {
  const row = await db.serviceContinuationRequest.findFirst({
    where: { clientId, status: { in: [...PENDING_STATUSES] } },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { businessName: true } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.clientId,
    businessName: row.client.businessName,
    name: row.name,
    phone: row.phone,
    email: row.email,
    status: statusOf(row.status),
    createdAt: row.createdAt,
  };
}

/**
 * Records the request.
 *
 * `clientId` has already been checked by the gate above this — it is never read
 * from a form here — and the row it writes carries that id, so a request cannot
 * be aimed at a business the caller does not belong to. The database says the
 * same thing again underneath: `ServiceContinuationRequest` carries the same
 * `tenant_isolation` policy as every other per-business table, so an INSERT
 * naming somebody else's client is refused rather than merely discouraged.
 *
 * DUPLICATES ARE NOT AN ERROR. A second press is far more likely to be a slow
 * connection or an anxious owner than a mistake, so an existing open request is
 * returned as-is with `created: false`. Nothing is written, nothing is
 * duplicated, and the page says "we'll be in touch" either way — which is true.
 */
export async function requestContinuation(
  db: PrismaClient,
  clientId: string,
  input: { phone: string; email?: string | null },
  options: { now?: Date } = {},
): Promise<ServiceResult<{ request: ContinuationRequest; created: boolean }>> {
  const phone = normalisePhone(input.phone);
  const email = normaliseEmail(input.email);

  const errors: Record<string, string> = {};
  if (phone === null) {
    errors.phone = 'Add a phone number we can reach you on.';
  }
  if (!email.ok) {
    errors.email = 'That email address does not look right. You can leave it blank instead.';
  }
  if (Object.keys(errors).length > 0) return err('Some fields need attention.', errors);

  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, businessName: true },
  });
  if (!client) return err('That business no longer exists.');

  const existing = await pendingRequestFor(db, clientId);
  if (existing) return ok({ request: existing, created: false });

  const row = await db.serviceContinuationRequest.create({
    data: {
      clientId,
      // Carried from the business. The customer is signed in and Headway
      // already knows who they are, so the form does not ask again.
      name: client.businessName,
      phone: phone as string,
      email: email.ok ? email.value : null,
      status: 'NEW',
      ...(options.now ? { createdAt: options.now, updatedAt: options.now } : {}),
    },
    select: { id: true, clientId: true, name: true, phone: true, email: true, status: true, createdAt: true },
  });

  return ok({
    request: {
      id: row.id,
      clientId: row.clientId,
      businessName: client.businessName,
      name: row.name,
      phone: row.phone,
      email: row.email,
      status: statusOf(row.status),
      createdAt: row.createdAt,
    },
    created: true,
  });
}

/**
 * Every open request, newest first. The operator's list.
 *
 * Under the policies this returns nothing at all for a business owner's
 * connection except their own, and everything for a platform admin — the same
 * `app.accessible_client_ids()` every other per-business table uses. There is
 * no separate admin query and no separate admin table.
 */
export async function listContinuationRequests(
  db: PrismaClient,
  options: { includeResolved?: boolean } = {},
): Promise<ContinuationRequest[]> {
  const rows = await db.serviceContinuationRequest.findMany({
    where: options.includeResolved ? {} : { status: { in: [...PENDING_STATUSES] } },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { businessName: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    businessName: row.client.businessName,
    name: row.name,
    phone: row.phone,
    email: row.email,
    status: statusOf(row.status),
    createdAt: row.createdAt,
  }));
}

/** The operator moving one along. Never touches a trial date. */
export async function setContinuationStatus(
  db: PrismaClient,
  requestId: string,
  status: string,
): Promise<ServiceResult<{ id: string; status: ContinuationRequestStatus }>> {
  if (!(CONTINUATION_STATUSES as readonly string[]).includes(status)) {
    return err('Some fields need attention.', { status: 'Pick a status.' });
  }
  const updated = await db.serviceContinuationRequest.updateMany({
    where: { id: requestId },
    data: { status },
  });
  if (updated.count === 0) return err('That request no longer exists.');
  return ok({ id: requestId, status: status as ContinuationRequestStatus });
}
