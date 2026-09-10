import type { PrismaClient } from '@prisma/client';
import { isMissingDbFunction, withRlsContext } from '@/lib/db';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

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
 * The owner's half of the conversation is one button: continue with Headway,
 * confirming where to be reached. That writes their own contact details and a
 * timestamp, and nothing else. The operator sees the request, agrees a number,
 * and sends the payment details by hand.
 *
 * M23 added the two facts an owner's Account page rests on: every trial has an
 * end date from the moment it starts (`DEFAULT_TRIAL_DAYS`, operator-adjustable
 * without a schema change through one AppSetting row), and a pause and a
 * resume are stamped when they happen, so "paused since" and "resumed" are
 * records rather than guesses.
 *
 * M27 moved that default to thirty days and left every existing business alone,
 * which is a property of the design rather than a precaution taken afterwards.
 * The configured length is read at exactly one moment — when a trial starts —
 * and what is written is a date. Nothing downstream recomputes it: the Account
 * page, the days remaining and every operator screen read `trialEndsAt` off the
 * row. So the operator can change the number as often as they like and the only
 * businesses affected are the ones that do not exist yet.
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

// ---------------------------------------------------------------------------
// How long a new trial runs
// ---------------------------------------------------------------------------

/**
 * The product default, and the only place the number lives in TypeScript. The
 * database function `app.trial_default_days()` carries the same default for the
 * path that creates a business under the real policies. The two must agree, so
 * they change together — see `prisma/m27/migration.sql`.
 *
 * Thirty days since M27. It is a default for trials started from now on, and
 * nothing else: no business already on a trial moves, because a trial's end is
 * a stored date on that business and not a sum computed from this number.
 */
export const DEFAULT_TRIAL_DAYS = 30;
export const MAX_TRIAL_DAYS = 365;

/**
 * What the "Extend the trial" box offers, which is NOT the same number.
 *
 * The two buttons on a client page look alike and mean opposite things. "Start
 * a trial" begins a new one, so it should follow Settings. "Extend the trial"
 * adds to a business that already has stored dates, and Settings is explicitly
 * a default for new trials rather than a value applied to existing clients —
 * so wiring the same number into both would let a change on Settings reach a
 * business that is already running, through one default-accepting click.
 *
 * It happened: until M27 both boxes read `DEFAULT_TRIAL_DAYS`, so moving that
 * from 14 to 30 would silently have doubled what the extend button does, with
 * no mention of it anywhere and no clean way back — there is no "shorten the
 * trial", and restarting one rewrites `trialStartsAt`, the column this pass
 * exists to protect. Fourteen is what that button has always offered, and it
 * stays fourteen no matter what Settings says.
 */
export const EXTEND_TRIAL_DAYS = 14;
/** One AppSetting row. The operator changes it from Settings; nothing else reads it. */
export const TRIAL_DEFAULT_DAYS_SETTING = 'trial.default_days';

/** A whole number of days between 1 and 365, or null for anything else. */
export function normaliseTrialDays(raw: unknown): number | null {
  const text = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TRIAL_DAYS) return null;
  return n;
}

/**
 * The configured default, or the product default when none is set.
 *
 * AppSetting is admin-only under RLS, so a business owner's connection reads
 * nothing here and gets the product default — which is fine, because nothing
 * on the owner's side ever starts a trial. The operator's connection reads the
 * real value.
 *
 * Read only when a trial is being STARTED. Nothing that describes, warns about
 * or locks an existing account calls this: those read the client's own stored
 * `trialEndsAt`, which is why changing the number here cannot move anybody.
 */
export async function getTrialDefaultDays(db: PrismaClient): Promise<number> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: TRIAL_DEFAULT_DAYS_SETTING } });
    return normaliseTrialDays(row?.value) ?? DEFAULT_TRIAL_DAYS;
  } catch {
    return DEFAULT_TRIAL_DAYS;
  }
}

export async function saveTrialDefaultDays(
  db: PrismaClient,
  raw: string,
): Promise<ServiceResult<{ days: number }>> {
  const days = normaliseTrialDays(raw);
  if (days === null) {
    return err('Some fields need attention.', {
      trialDays: `Use a whole number of days between 1 and ${MAX_TRIAL_DAYS}.`,
    });
  }
  await db.appSetting.upsert({
    where: { key: TRIAL_DEFAULT_DAYS_SETTING },
    create: { key: TRIAL_DEFAULT_DAYS_SETTING, value: String(days) },
    update: { value: String(days) },
  });
  return ok({ days });
}

/** The window a brand-new business starts with. */
export function trialWindowFrom(now: Date, days: number): { trialStartsAt: Date; trialEndsAt: Date } {
  return { trialStartsAt: now, trialEndsAt: new Date(now.getTime() + days * DAY) };
}

// ---------------------------------------------------------------------------
// What the owner is told
// ---------------------------------------------------------------------------

/**
 * The five situations an owner can be in, each with its own headline. TRIAL
 * and TRIAL_ENDED are the same subscription state read against the clock.
 */
export type AccountPhase = 'TRIAL' | 'TRIAL_ENDED' | 'ACTIVE' | 'PAUSED' | 'CLOSED';

export type AccountState = {
  state: SubscriptionState;
  phase: AccountPhase;
  /** "Your Headway trial", "Your trial has ended", "Headway is active", "Headway is paused". */
  headline: string;
  /** One or two short sentences under it. Never a price, never a countdown to a sale. */
  line: string;
  /** A second fact when there is one: paused since, or resumed. */
  note: string | null;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  /** Whole days remaining, negative once it is past. Null with no end date. */
  trialDaysLeft: number | null;
  trialExpired: boolean;
  /** When the owner asked to continue with Headway. */
  continuationRequestedAt: Date | null;
  servicePausedAt: Date | null;
  serviceResumedAt: Date | null;
  owner: { name: string; email: string; phone: string };
};

/** "21 September 2026" — the long form an owner reads on their own page. */
const LONG_DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export function formatLongDate(value: Date): string {
  return LONG_DATE.format(value);
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY);
}

/** A resume is news for two weeks; after that the account is simply active. */
const RESUMED_IS_NEWS_FOR_DAYS = 14;

/**
 * What the owner is told about their own account.
 *
 * Deliberately calm. A trial says the date it runs to, because that is a fact
 * they need; it does not count down in hours, colour itself red, or suggest
 * that acting today is cheaper than acting on Friday. An ended trial says the
 * feedback and the history are safe, because they are. A pause says what is
 * still saved and what has stopped, and nothing else.
 */
export function describeAccount(input: {
  subscriptionStatus: string;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  paymentRequestedAt: Date | null;
  servicePausedAt?: Date | null;
  serviceResumedAt?: Date | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  now: Date;
  /** The owner's language. Omitted means English — see PortalTranslator. */
  t?: PortalTranslator;
}): AccountState {
  const t = input.t ?? EN;
  const state = subscriptionState(input.subscriptionStatus);
  const trialDaysLeft = input.trialEndsAt ? daysBetween(input.now, input.trialEndsAt) : null;
  const trialExpired = trialDaysLeft !== null && trialDaysLeft <= 0;
  const servicePausedAt = input.servicePausedAt ?? null;
  const serviceResumedAt = input.serviceResumedAt ?? null;
  const resumedRecently =
    serviceResumedAt !== null &&
    input.now.getTime() - serviceResumedAt.getTime() <= RESUMED_IS_NEWS_FOR_DAYS * DAY &&
    input.now.getTime() >= serviceResumedAt.getTime();

  let phase: AccountPhase;
  let headline: string;
  let line: string;
  let note: string | null = null;

  if (state === 'PAUSED') {
    phase = 'PAUSED';
    headline = t('lifecycle.account.paused.headline');
    line = t('lifecycle.account.paused.line');
    note = servicePausedAt
      ? t('lifecycle.account.paused.note', { date: formatLongDate(servicePausedAt) })
      : null;
  } else if (state === 'CANCELLED') {
    phase = 'CLOSED';
    headline = t('lifecycle.account.closed.headline');
    line = t('lifecycle.account.closed.line');
  } else if (state === 'ACTIVE') {
    phase = 'ACTIVE';
    headline = t('lifecycle.account.active.headline');
    line = t('lifecycle.account.active.line');
    note = resumedRecently ? t('lifecycle.account.resumed.note') : null;
  } else if (trialExpired) {
    phase = 'TRIAL_ENDED';
    headline = t('lifecycle.account.trialEnded.headline');
    line = t('lifecycle.account.trialEnded.line');
  } else {
    phase = 'TRIAL';
    headline = t('lifecycle.account.trial.headline');
    line = input.trialEndsAt
      ? t('lifecycle.account.trial.line', { date: formatLongDate(input.trialEndsAt) })
      : // Only for a business created before every trial carried a window, and
        // only until the M23 backfill runs. Never "no end date".
        t('lifecycle.account.trial.lineNoEndDate');
    note = resumedRecently ? t('lifecycle.account.resumed.note') : null;
  }

  return {
    state,
    phase,
    headline,
    line,
    note,
    trialStartsAt: input.trialStartsAt,
    trialEndsAt: input.trialEndsAt,
    trialDaysLeft,
    trialExpired,
    continuationRequestedAt: input.paymentRequestedAt,
    servicePausedAt,
    serviceResumedAt,
    owner: {
      name: (input.ownerName ?? '').trim(),
      email: (input.ownerEmail ?? '').trim(),
      phone: (input.ownerPhone ?? '').trim(),
    },
  };
}

/** The account state for one business. Null when the business is gone. */
export async function getAccountState(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date; t?: PortalTranslator } = {},
): Promise<AccountState | null> {
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: {
      subscriptionStatus: true,
      trialStartsAt: true,
      trialEndsAt: true,
      paymentRequestedAt: true,
      servicePausedAt: true,
      serviceResumedAt: true,
      ownerName: true,
      ownerEmail: true,
      ownerPhone: true,
    },
  });
  if (!client) return null;
  return describeAccount({ ...client, now: options.now ?? new Date(), t: options.t });
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
 * only way through. Both paths stamp the pause and the resume the same way.
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
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, subscriptionStatus: true },
  });
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
      // The database's own words go to the server log, never to the screen.
      console.error('app.set_subscription failed', error);
      return err('Could not change this account. Try again.');
    }
  }

  const was = isServicePaused(client.subscriptionStatus);
  const willBe = changes.status ? isServicePaused(changes.status) : was;
  await db.client.update({
    where: { id: clientId },
    data: {
      ...(changes.status ? { subscriptionStatus: changes.status } : {}),
      ...(changes.trialStartsAt !== undefined ? { trialStartsAt: changes.trialStartsAt } : {}),
      ...(changes.trialEndsAt !== undefined ? { trialEndsAt: changes.trialEndsAt } : {}),
      ...(changes.status && willBe && !was ? { servicePausedAt: now, serviceResumedAt: null } : {}),
      ...(changes.status && !willBe && was ? { serviceResumedAt: now, servicePausedAt: null } : {}),
      ...(changes.status && !willBe && !was ? { servicePausedAt: null } : {}),
    },
  });
  return ok({ clientId });
}

/**
 * Starts or restarts a trial from now. `days` defaults to the configured
 * default, which defaults to `DEFAULT_TRIAL_DAYS`.
 *
 * The configured length is read HERE, at the moment the trial starts, and the
 * resulting end date is stored on the client. That is the whole of how the
 * setting applies to new trials only: it is consulted once, and afterwards the
 * business carries its own dates.
 */
export async function startTrial(
  db: PrismaClient,
  clientId: string,
  days?: number | null,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; days: number }>> {
  const now = options.now ?? new Date();
  const length = days === undefined || days === null ? await getTrialDefaultDays(db) : days;
  if (!Number.isFinite(length) || length <= 0 || length > MAX_TRIAL_DAYS) {
    return err('Some fields need attention.', { days: `Pick between 1 and ${MAX_TRIAL_DAYS} days.` });
  }
  const window = trialWindowFrom(now, Math.round(length));
  const result = await setSubscription(db, clientId, { status: 'TRIAL', ...window }, { now });
  if (!result.ok) return result;
  return ok({ clientId, days: Math.round(length) });
}

/**
 * THIS ONE BUSINESS'S TRIAL, SET BY HAND (M37).
 *
 * Two ways to say the same thing, and the operator picks one:
 *
 *   'date' - the trial ends on this day.
 *   'days' - the trial runs this many days from where it started.
 *
 * BOTH WRITE ONE COLUMN. There is a single effective end, `trialEndsAt`, and
 * these are two ways of computing it - never two values that could disagree.
 *
 * IT CHANGES NOTHING ELSE. Not the subscription status, not the lock, not the
 * exemption, not the pause, not the continuation request. A business that is
 * paying or paused stays paying or paused; the dates simply are not what its
 * lifecycle reads. That is deliberate: an operator setting a date should not
 * silently drag a business back into a trial it had left.
 *
 * THE GLOBAL DEFAULT IS UNTOUCHED. `trial.default_days` decides how long a NEW
 * trial runs; this decides when THIS one ends, and neither reads the other.
 *
 * A DATE MEANS THE END OF THAT DAY WHERE THE BUSINESS IS. Headway prints its
 * dates in Asia/Kolkata, so "30 Sep" stored as midnight UTC would print as
 * 30 Sep and expire at half past five that morning. The end of 30 Sep in IST
 * is what an operator means, so that is what is stored.
 */
const IST_OFFSET_MINUTES = 330;

export type TrialSetting =
  | { mode: 'date'; endDate: string }
  | { mode: 'days'; days: string };

/** The last instant of `YYYY-MM-DD` in Asia/Kolkata, or null if unparseable. */
export function endOfDayIst(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // A day that rolls over never existed (31 February), and Date.UTC would
  // silently accept it.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  const startOfNextDayUtc = Date.UTC(year, month - 1, day + 1);
  return new Date(startOfNextDayUtc - IST_OFFSET_MINUTES * 60_000 - 1);
}

export async function setClientTrial(
  db: PrismaClient,
  clientId: string,
  setting: TrialSetting,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; trialEndsAt: Date }>> {
  const now = options.now ?? new Date();

  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, trialStartsAt: true },
  });
  if (!client) return err('That business no longer exists.');

  // The trial keeps the start it already had. Only a business that has never
  // had one starts today, because a length has to be measured from somewhere.
  const trialStartsAt = client.trialStartsAt ?? now;

  let trialEndsAt: Date;
  if (setting.mode === 'date') {
    const end = endOfDayIst(setting.endDate);
    if (!end) {
      return err('Some fields need attention.', { trialEndDate: 'Pick a date.' });
    }
    trialEndsAt = end;
  } else {
    const days = normaliseTrialDays(setting.days);
    if (days === null) {
      return err('Some fields need attention.', {
        trialDays: `Use a whole number of days between 1 and ${MAX_TRIAL_DAYS}.`,
      });
    }
    trialEndsAt = new Date(trialStartsAt.getTime() + days * DAY);
  }

  const result = await setSubscription(db, clientId, { trialStartsAt, trialEndsAt }, { now });
  if (!result.ok) return result;
  return ok({ clientId, trialEndsAt });
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
  if (!Number.isFinite(days) || days <= 0 || days > MAX_TRIAL_DAYS) {
    return err('Some fields need attention.', { days: `Pick between 1 and ${MAX_TRIAL_DAYS} days.` });
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
// The owner's one request, and their own details
// ---------------------------------------------------------------------------

export type OwnerContactInput = { name: string; email: string; phone: string };

function cleanContact(
  input: OwnerContactInput,
  t: PortalTranslator,
): ServiceResult<{ name: string; email: string; phone: string }> {
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim().toLowerCase();
  const phone = (input.phone ?? '').replace(/[^\d+ ]/g, '').trim();

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = t('lifecycle.form.nameNeeded');
  if (!email.includes('@') || email.length < 5) errors.email = t('lifecycle.form.emailNeeded');
  if (phone.replace(/\D/g, '').length < 8) {
    errors.phone = t('lifecycle.form.whatsappNeeded');
  }
  if (Object.keys(errors).length > 0) return err(t('lifecycle.form.fieldsNeedAttention'), errors);
  return ok({ name, email, phone });
}

/**
 * The owner asks to continue with Headway, and confirms where to be reached.
 *
 * Everything this writes is the owner's own contact detail plus a timestamp.
 * No amount is created here, no invoice, no payment intent and no card: RepOS
 * takes no payments. The operator sees the request, agrees a number by hand,
 * and sends the payment information and QR to the details confirmed here.
 */
export async function requestContinuation(
  db: PrismaClient,
  clientId: string,
  input: OwnerContactInput,
  options: { now?: Date; t?: PortalTranslator } = {},
): Promise<ServiceResult<{ clientId: string; requestedAt: Date }>> {
  const t = options.t ?? EN;
  const clean = cleanContact(input, t);
  if (!clean.ok) return clean;

  const now = options.now ?? new Date();
  const updated = await db.client.updateMany({
    where: { id: clientId },
    data: {
      ownerName: clean.data.name,
      ownerEmail: clean.data.email,
      ownerPhone: clean.data.phone,
      paymentRequestedAt: now,
    },
  });
  if (updated.count === 0) return err(t('lifecycle.form.businessGone'));
  return ok({ clientId, requestedAt: now });
}

/**
 * The same three details, kept up to date, without asking anything of anyone.
 *
 * `t` is trailing and optional because there is no options object here to carry
 * it. Omitted means English.
 */
export async function updateOwnerContact(
  db: PrismaClient,
  clientId: string,
  input: OwnerContactInput,
  t: PortalTranslator = EN,
): Promise<ServiceResult<{ clientId: string }>> {
  const clean = cleanContact(input, t);
  if (!clean.ok) return clean;

  const updated = await db.client.updateMany({
    where: { id: clientId },
    data: {
      ownerName: clean.data.name,
      ownerEmail: clean.data.email,
      ownerPhone: clean.data.phone,
    },
  });
  if (updated.count === 0) return err(t('lifecycle.form.businessGone'));
  return ok({ clientId });
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

// ---------------------------------------------------------------------------
// What the operator has to answer
// ---------------------------------------------------------------------------

/** Where a continuation request stands, from the operator's own records. */
export type ContinuationStatus = 'NEW' | 'DETAILS_SENT' | 'PAID';

export function continuationStatus(input: {
  requestedAt: Date | null;
  instructionsSentAt: Date | null;
  paidAt: Date | null;
}): ContinuationStatus | null {
  if (!input.requestedAt) return null;
  if (input.paidAt && input.paidAt.getTime() >= input.requestedAt.getTime()) return 'PAID';
  if (input.instructionsSentAt && input.instructionsSentAt.getTime() >= input.requestedAt.getTime()) {
    return 'DETAILS_SENT';
  }
  return 'NEW';
}

export type ContinuationRequest = {
  clientId: string;
  businessName: string;
  requestedAt: Date;
  status: ContinuationStatus;
  owner: { name: string; email: string; phone: string };
  /** The operator's own figures. Never leave the operator console. */
  amountInr: number | null;
  cadence: string;
  note: string;
  instructionsSentAt: Date | null;
  paidAt: Date | null;
};

/**
 * Every owner who has asked to continue, newest first. Operator only: the
 * Commercial join returns nothing for anyone else, and a request without its
 * record still lists — a request is not made less real by the operator not
 * having written the amount down yet.
 */
export async function listContinuationRequests(db: PrismaClient): Promise<ContinuationRequest[]> {
  const clients = await db.client.findMany({
    where: { paymentRequestedAt: { not: null }, archivedAt: null },
    select: {
      id: true,
      businessName: true,
      paymentRequestedAt: true,
      ownerName: true,
      ownerEmail: true,
      ownerPhone: true,
      commercial: {
        select: { amountInr: true, cadence: true, note: true, instructionsSentAt: true, paidAt: true },
      },
    },
    orderBy: { paymentRequestedAt: 'desc' },
  });
  return clients.flatMap((c) => {
    if (!c.paymentRequestedAt) return [];
    const status = continuationStatus({
      requestedAt: c.paymentRequestedAt,
      instructionsSentAt: c.commercial?.instructionsSentAt ?? null,
      paidAt: c.commercial?.paidAt ?? null,
    });
    if (!status) return [];
    return [
      {
        clientId: c.id,
        businessName: c.businessName,
        requestedAt: c.paymentRequestedAt,
        status,
        owner: {
          name: (c.ownerName ?? '').trim(),
          email: (c.ownerEmail ?? '').trim(),
          phone: (c.ownerPhone ?? '').trim(),
        },
        amountInr: c.commercial?.amountInr ?? null,
        cadence: c.commercial?.cadence ?? 'MONTHLY',
        note: c.commercial?.note ?? '',
        instructionsSentAt: c.commercial?.instructionsSentAt ?? null,
        paidAt: c.commercial?.paidAt ?? null,
      },
    ];
  });
}
