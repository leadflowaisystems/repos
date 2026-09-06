import type { PrismaClient } from '@prisma/client';
import { isMissingDbFunction, withRlsContext } from '@/lib/db';

/**
 * THE COMMERCIAL SIDE: what state an account is in, and what it costs.
 *
 * Two things live here and they are deliberately not the same thing.
 *
 * WHAT STATE THE ACCOUNT IS IN — trial, active, paused — is the platform's
 * decision and moves through `app.set_subscription`, which asks the database
 * whether the caller is platform staff. A business owner cannot take their own
 * account off pause or push their own trial end date out, and that is enforced
 * a layer below the server action rather than by it.
 *
 * WHAT IT COSTS is not in this model at all from the owner's side. There is no
 * price list in RepOS, no published tier, and no number on any owner-facing
 * screen: what a business pays is negotiated, recorded by the operator, and
 * collected by hand. It lives in `Commercial`, whose RLS policy asks for
 * platform admin rather than for membership — so an owner's connection returns
 * no rows, not a blank amount.
 *
 * The owner's half of the conversation is one button: ask what this costs, and
 * confirm where to be reached. That writes their own contact details and a
 * timestamp, and nothing else.
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

/** The states an account can be in. Anything else is treated as TRIAL. */
export const SUBSCRIPTION_STATES = ['TRIAL', 'ACTIVE', 'PAUSED', 'CANCELLED'] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

export function subscriptionState(raw: string | null | undefined): SubscriptionState {
  return (SUBSCRIPTION_STATES as readonly string[]).includes(raw ?? '')
    ? (raw as SubscriptionState)
    : 'TRIAL';
}

/** True when RepOS should stop doing work for this business. */
export function isServicePaused(raw: string | null | undefined): boolean {
  const state = subscriptionState(raw);
  return state === 'PAUSED' || state === 'CANCELLED';
}

const DAY = 86_400_000;

export type AccountState = {
  state: SubscriptionState;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  /** Whole days remaining, negative once it is past. Null with no end date. */
  trialDaysLeft: number | null;
  trialExpired: boolean;
  paymentRequestedAt: Date | null;
  owner: { name: string; email: string; phone: string };
  /** One sentence for the owner. Never a price, never a countdown to a sale. */
  line: string;
};

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY);
}

/**
 * What the owner is told about their own account.
 *
 * Deliberately calm. A trial that is running says how long is left because that
 * is a fact they need; it does not count down in hours, colour itself red, or
 * suggest that acting today is cheaper than acting on Friday.
 */
export function describeAccount(input: {
  subscriptionStatus: string;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  paymentRequestedAt: Date | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  now: Date;
}): AccountState {
  const state = subscriptionState(input.subscriptionStatus);
  const trialDaysLeft = input.trialEndsAt ? daysBetween(input.now, input.trialEndsAt) : null;
  const trialExpired = trialDaysLeft !== null && trialDaysLeft <= 0;

  let line: string;
  if (state === 'PAUSED') {
    line =
      'Your account is paused. Feedback is still being collected and kept — Headway will read it when the account is resumed.';
  } else if (state === 'CANCELLED') {
    line =
      'This account is closed. Everything already collected is kept and nothing new is being read.';
  } else if (state === 'ACTIVE') {
    line = 'Your account is active.';
  } else if (trialDaysLeft === null) {
    line = 'You are on a trial. There is no end date set — talk to us whenever you are ready.';
  } else if (trialExpired) {
    line =
      'Your trial has ended. Everything you have collected is still here, and the team will be in touch about carrying on.';
  } else {
    line = `You are on a trial with ${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} to go.`;
  }

  return {
    state,
    trialStartsAt: input.trialStartsAt,
    trialEndsAt: input.trialEndsAt,
    trialDaysLeft,
    trialExpired,
    paymentRequestedAt: input.paymentRequestedAt,
    owner: {
      name: (input.ownerName ?? '').trim(),
      email: (input.ownerEmail ?? '').trim(),
      phone: (input.ownerPhone ?? '').trim(),
    },
    line,
  };
}

/** The account state for one business. Null when the business is gone. */
export async function getAccountState(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<AccountState | null> {
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: {
      subscriptionStatus: true,
      trialStartsAt: true,
      trialEndsAt: true,
      paymentRequestedAt: true,
      ownerName: true,
      ownerEmail: true,
      ownerPhone: true,
    },
  });
  if (!client) return null;
  return describeAccount({ ...client, now: options.now ?? new Date() });
}

// ---------------------------------------------------------------------------
// The platform's decisions
// ---------------------------------------------------------------------------

/**
 * Moves the subscription and the trial window together.
 *
 * `undefined` leaves a date alone; `null` clears it. That is the difference
 * between "extend the trial" and "they are paying now, the trial dates no
 * longer mean anything", and it is why this is one call rather than three.
 *
 * The direct write underneath is the same rules in TypeScript, and only ever
 * runs where the DDL is not applied — the test suite, and an install that has
 * not run `rls.sql`. Under the real policies `repos_app` holds no UPDATE
 * privilege on these columns, so it returns nothing and the function is the
 * only way through.
 */
export async function setSubscription(
  db: PrismaClient,
  clientId: string,
  changes: {
    status?: SubscriptionState;
    trialStartsAt?: Date | null;
    trialEndsAt?: Date | null;
  },
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  const now = options.now ?? new Date();
  const client = await db.client.findFirst({ where: { id: clientId }, select: { id: true } });
  if (!client) return err('That business no longer exists.');

  const asArgument = (value: Date | null | undefined): string | null =>
    value === undefined ? null : value === null ? '' : value.toISOString();

  // Inside withRlsContext, not on a bare handle: the function asks
  // app.is_platform_admin(), which reads the transaction-local identity, and a
  // raw query does not pass through the extension that sets it. Called without
  // it, the operator's own call would be refused as nobody's.
  //
  // $executeRaw rather than $queryRaw: the function returns void, and Prisma
  // cannot deserialise a void column into a row.
  try {
    await withRlsContext(db, async (tx) => {
      await tx.$executeRaw`
        SELECT app.set_subscription(
          ${clientId}::text,
          ${changes.status ?? ''}::text,
          ${asArgument(changes.trialStartsAt)}::text,
          ${asArgument(changes.trialEndsAt)}::text,
          ${now.toISOString()}::text)`;
    });
    return ok({ clientId });
  } catch (error) {
    if (!isMissingDbFunction(error)) {
      return err(error instanceof Error ? error.message : 'Could not change this account.');
    }
  }

  await db.client.update({
    where: { id: clientId },
    data: {
      ...(changes.status ? { subscriptionStatus: changes.status } : {}),
      ...(changes.trialStartsAt !== undefined ? { trialStartsAt: changes.trialStartsAt } : {}),
      ...(changes.trialEndsAt !== undefined ? { trialEndsAt: changes.trialEndsAt } : {}),
    },
  });
  return ok({ clientId });
}

/** Starts or restarts a trial of `days`, from now. */
export async function startTrial(
  db: PrismaClient,
  clientId: string,
  days: number,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  const now = options.now ?? new Date();
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return err('Some fields need attention.', { days: 'Pick between 1 and 365 days.' });
  }
  return setSubscription(
    db,
    clientId,
    {
      status: 'TRIAL',
      trialStartsAt: now,
      trialEndsAt: new Date(now.getTime() + Math.round(days) * DAY),
    },
    { now },
  );
}

/**
 * Pushes the trial end out, from wherever it stands.
 *
 * From the existing end date when there is one, so extending twice adds twice —
 * and from today when the trial has already lapsed, because an extension that
 * lands in the past is not an extension.
 */
export async function extendTrial(
  db: PrismaClient,
  clientId: string,
  days: number,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; trialEndsAt: Date }>> {
  const now = options.now ?? new Date();
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return err('Some fields need attention.', { days: 'Pick between 1 and 365 days.' });
  }
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { trialEndsAt: true, trialStartsAt: true },
  });
  if (!client) return err('That business no longer exists.');

  const from =
    client.trialEndsAt && client.trialEndsAt.getTime() > now.getTime() ? client.trialEndsAt : now;
  const trialEndsAt = new Date(from.getTime() + Math.round(days) * DAY);

  const result = await setSubscription(
    db,
    clientId,
    {
      status: 'TRIAL',
      trialStartsAt: client.trialStartsAt ?? now,
      trialEndsAt,
    },
    { now },
  );
  if (!result.ok) return result;
  return ok({ clientId, trialEndsAt });
}

/** They are paying. The trial window stops meaning anything, so it is cleared. */
export async function convertToActive(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  return setSubscription(db, clientId, { status: 'ACTIVE', trialEndsAt: null }, options);
}

/**
 * Pauses the service. Nothing is deleted and nothing stops arriving.
 *
 * The QR keeps working and feedback keeps landing, because a customer standing
 * at a table is not party to a billing conversation and should never meet a
 * dead page because of one. What stops is RepOS's own work: the pipeline leaves
 * new feedback unread until the account is resumed, and then reads the backlog.
 */
export async function pauseService(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  return setSubscription(db, clientId, { status: 'PAUSED' }, options);
}

/**
 * Resumes. Whether that is a trial or a paid account depends on whether the
 * trial window is still open, so resuming never silently converts anybody.
 */
export async function resumeService(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; state: SubscriptionState }>> {
  const now = options.now ?? new Date();
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { trialEndsAt: true },
  });
  if (!client) return err('That business no longer exists.');

  const state: SubscriptionState =
    client.trialEndsAt && client.trialEndsAt.getTime() > now.getTime() ? 'TRIAL' : 'ACTIVE';
  const result = await setSubscription(db, clientId, { status: state }, { now });
  if (!result.ok) return result;
  return ok({ clientId, state });
}

// ---------------------------------------------------------------------------
// The owner's one request
// ---------------------------------------------------------------------------

export type PaymentRequestInput = { name: string; email: string; phone: string };

/**
 * The owner asks what this costs, and confirms where to be reached.
 *
 * Everything this writes is the owner's own contact detail plus a timestamp.
 * No amount is created here, no invoice, no payment intent and no card: RepOS
 * takes no payments. The operator sees the request, agrees a number by hand,
 * and sends the UPI or bank details to the address confirmed here.
 */
export async function requestPaymentDetails(
  db: PrismaClient,
  clientId: string,
  input: PaymentRequestInput,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; requestedAt: Date }>> {
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim().toLowerCase();
  const phone = (input.phone ?? '').replace(/[^\d+ ]/g, '').trim();

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Add the name we should ask for.';
  if (!email.includes('@') || email.length < 5) errors.email = 'Add a valid email address.';
  if (phone.replace(/\D/g, '').length < 8) {
    errors.phone = 'Add a mobile or WhatsApp number we can reach you on.';
  }
  if (Object.keys(errors).length > 0) return err('Some fields need attention.', errors);

  const now = options.now ?? new Date();
  const updated = await db.client.updateMany({
    where: { id: clientId },
    data: { ownerName: name, ownerEmail: email, ownerPhone: phone, paymentRequestedAt: now },
  });
  if (updated.count === 0) return err('That business no longer exists.');
  return ok({ clientId, requestedAt: now });
}

// ---------------------------------------------------------------------------
// The operator's private record
// ---------------------------------------------------------------------------

export type CommercialRecord = {
  amountInr: number | null;
  cadence: string;
  note: string;
  paymentInstructions: string;
  instructionsSentAt: Date | null;
  paidAt: Date | null;
};

export const CADENCES = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_OFF'] as const;

const EMPTY: CommercialRecord = {
  amountInr: null,
  cadence: 'MONTHLY',
  note: '',
  paymentInstructions: '',
  instructionsSentAt: null,
  paidAt: null,
};

/**
 * The negotiated terms. Operator only, and not by convention: a business
 * owner's connection cannot select this table at all, so this returns the
 * empty record for them rather than a redacted one.
 */
export async function getCommercial(
  db: PrismaClient,
  clientId: string,
): Promise<CommercialRecord> {
  const row = await db.commercial.findFirst({ where: { clientId } });
  if (!row) return { ...EMPTY };
  return {
    amountInr: row.amountInr,
    cadence: row.cadence,
    note: row.note ?? '',
    paymentInstructions: row.paymentInstructions ?? '',
    instructionsSentAt: row.instructionsSentAt,
    paidAt: row.paidAt,
  };
}

export async function saveCommercial(
  db: PrismaClient,
  clientId: string,
  input: {
    amountInr: number | null;
    cadence: string;
    note: string;
    paymentInstructions: string;
    markSent?: boolean;
    markPaid?: boolean;
  },
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  if (input.amountInr !== null && (!Number.isInteger(input.amountInr) || input.amountInr < 0)) {
    return err('Some fields need attention.', { amountInr: 'Use whole rupees, or leave it blank.' });
  }
  const client = await db.client.findFirst({ where: { id: clientId }, select: { id: true } });
  if (!client) return err('That business no longer exists.');

  const now = options.now ?? new Date();
  const cadence = (CADENCES as readonly string[]).includes(input.cadence)
    ? input.cadence
    : 'MONTHLY';
  const data = {
    amountInr: input.amountInr,
    cadence,
    note: input.note.trim(),
    paymentInstructions: input.paymentInstructions.trim(),
    ...(input.markSent ? { instructionsSentAt: now } : {}),
    ...(input.markPaid ? { paidAt: now } : {}),
  };

  await db.commercial.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  });
  return ok({ clientId });
}
