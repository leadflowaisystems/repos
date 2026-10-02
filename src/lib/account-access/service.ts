import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { isMissingDbFunction, withRlsContext } from '@/lib/db';
import { ACTIVE, provisionUser, ROLE_OWNER } from '@/lib/tenancy/service';
import { TOKEN_ALPHABET } from '@/lib/tokens';
import {
  isTemporaryEmail,
  TEMP_EMAIL_DOMAIN,
  TEMP_PASSWORD_SHAPE,
  temporaryStatusOf,
  type TemporaryStatus,
} from '@/lib/account-access/state';
import {
  createTempIdentity,
  deleteIdentity,
  getIdentitySnapshot,
  IDENTITY_MISSING,
  randomizeIdentityPassword,
  setIdentityPassword,
} from '@/lib/auth/supabase-admin';

/**
 * TEMPORARY ACCESS FOR ONE CLIENT (M39; two logins since M52).
 *
 * The admin creates a business and generates a temporary EMAIL and PASSWORD
 * for it. No email is sent: the temporary login is minted pre-confirmed
 * through the Supabase admin API under a synthetic address
 * (`…@access.headway.local`), so it signs in on the ordinary login page
 * straight away. The owner then sets up their OWN login from Account: their
 * real email (Supabase makes them confirm it) and their own password.
 *
 * TWO LOGINS, ONE ACCOUNT. The temporary login (`AccountAccess.tempAuthId`)
 * and the owner's own login (`User.authProviderId`) are separate Supabase
 * identities that both open the SAME owner User — one User, one Membership,
 * one Client. That is what lets an admin switch temporary access off, and on
 * again later, at any time, without ever touching the owner's own password.
 *
 *   No temporary access     -> Generate      (mints the temporary login)
 *   Temporary access active -> Disable       (scrambles it; owner unaffected)
 *   Temporary access off    -> Enable        (new password, same email)
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

export { isTemporaryEmail, type TemporaryStatus };

// ---------------------------------------------------------------------------
// The temporary email and password
// ---------------------------------------------------------------------------

const TEMP_EMAIL_BODY_LENGTH = 8;

/** Unbiased against the 32-letter alphabet, same technique as `newPublicToken`. */
function randomFromAlphabet(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const byte of bytes) out += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return out;
}

function generateTempEmail(): string {
  return `${randomFromAlphabet(TEMP_EMAIL_BODY_LENGTH)}@${TEMP_EMAIL_DOMAIN}`;
}

/**
 * Four groups of four, like `Kq7m-x3pa-9fne-t2wd`: easy to read out and type,
 * from the alphabet that has no i, l, o or 1 to misread, about 80 bits of
 * randomness. The first letter is upper case and the groups are joined by
 * hyphens so the password satisfies every character rule Supabase can be
 * configured with (lower, upper, digit, symbol) — Supabase refuses to create
 * an identity whose password misses one.
 */
export function generateTemporaryPassword(): string {
  for (;;) {
    const raw = randomFromAlphabet(16);
    if (!/[a-z]/.test(raw) || !/[0-9]/.test(raw)) continue;
    const firstLetter = raw.search(/[a-z]/);
    const cased = raw.slice(0, firstLetter) + raw[firstLetter]!.toUpperCase() + raw.slice(firstLetter + 1);
    return cased.match(/.{4}/g)!.join('-');
  }
}

/** A fresh synthetic address no other temporary login is using. */
async function unusedTempEmail(db: PrismaClient): Promise<string> {
  let email = generateTempEmail();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await db.accountAccess.findUnique({ where: { loginId: email }, select: { id: true } });
    if (!clash) break;
    email = generateTempEmail();
  }
  return email;
}

// ---------------------------------------------------------------------------
// Generating and enabling — the admin's action
// ---------------------------------------------------------------------------

export type GeneratedAccess = { email: string; password: string };

/**
 * A temporary login opens ONE business as its owner, and nothing more:
 * whoever holds the handover sheet must not inherit staff authority or a
 * second business. So an owner User who is platform staff, or who belongs to
 * any other business, is never given one. (`loadActor` and
 * `app.user_id_for_auth` hold the same line at sign-in, in case either changes
 * after the login was issued.)
 */
function temporaryAccessRefusal(user: { isPlatformAdmin: boolean; memberships: unknown[] }): string | null {
  const blocked = temporaryAccessBlock(user);
  if (blocked === 'STAFF') return 'This owner is Headway staff, so their account cannot be given temporary access.';
  if (blocked === 'OTHER_BUSINESS') {
    return 'This owner also belongs to another business, so their account cannot be given temporary access.';
  }
  return null;
}

/** Why a temporary login can never sign in as this owner, if it cannot. */
export type TemporaryBlock = 'STAFF' | 'OTHER_BUSINESS';

function temporaryAccessBlock(user: { isPlatformAdmin: boolean; memberships: unknown[] }): TemporaryBlock | null {
  if (user.isPlatformAdmin) return 'STAFF';
  if (user.memberships.length > 0) return 'OTHER_BUSINESS';
  return null;
}

/**
 * Turns temporary access ON for a business and returns the email and the
 * password to hand over — the only time the password is ever visible.
 *
 *   - no row yet, no owner:  mints the temporary login and the business's
 *                            owner User and Membership (the owner has no login
 *                            of their own until setup);
 *   - no row yet, an owner:  mints a temporary login into that owner's account;
 *   - row switched off:      gives the same temporary email a new password.
 *
 * Sends no email.
 */
export async function generateTempAccess(
  db: PrismaClient,
  clientId: string,
  adminUserId: string,
): Promise<ServiceResult<GeneratedAccess>> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return err('That business no longer exists.');

  const existing = await db.accountAccess.findUnique({
    where: { clientId },
    select: { userId: true, loginId: true, status: true, tempAuthId: true },
  });
  if (existing) {
    if (temporaryStatusOf(existing) === 'ACTIVE') {
      return err('Temporary access is already active. Disable it first if you need a new password.');
    }
    return enableTempAccess(db, clientId, existing);
  }

  const owner = await db.membership.findFirst({
    where: { clientId, role: ROLE_OWNER, status: ACTIVE },
    orderBy: { createdAt: 'asc' },
    select: {
      user: {
        select: {
          id: true,
          authProviderId: true,
          isPlatformAdmin: true,
          accountAccessOwned: { select: { id: true } },
          memberships: { where: { clientId: { not: clientId } }, select: { id: true }, take: 1 },
        },
      },
    },
  });
  if (owner?.user.accountAccessOwned) {
    return err('This owner already has temporary access for another business.');
  }
  const refusal = owner ? temporaryAccessRefusal(owner.user) : null;
  if (refusal) return err(refusal);

  const email = await unusedTempEmail(db);
  const password = generateTemporaryPassword();
  let tempAuthId: string;
  try {
    ({ authUserId: tempAuthId } = await createTempIdentity(email, password));
  } catch {
    return err('Could not create the temporary login. Try again.');
  }

  let provisioned: { userId: string; created: boolean } | null = null;
  try {
    if (!owner) {
      // The business's owner, with no login of their own yet. Created through
      // the same definer function signup uses (the runtime role may not write a
      // User row directly — it could otherwise write `isPlatformAdmin`), bound
      // for a moment to the temporary identity, which the transaction below
      // then moves to `tempAuthId`. The synthetic address stands in as the
      // email until setup gives the owner their own.
      provisioned = await provisionUser(db, { providerId: tempAuthId, email });
    }
    await withRlsContext(db, async (tx) => {
      let userId = owner?.user.id ?? null;
      if (!userId) {
        userId = provisioned!.userId;
        await tx.user.update({ where: { id: userId }, data: { authProviderId: null } });
        await tx.membership.create({ data: { userId, clientId, role: ROLE_OWNER, status: ACTIVE } });
      }
      await tx.accountAccess.create({
        data: {
          clientId,
          userId,
          loginId: email,
          tempAuthId,
          status: 'TEMPORARY_ACTIVE',
          createdByUserId: adminUserId,
          // An owner who already signs in with their own login has nothing to set up.
          setupCompletedAt: owner?.user.authProviderId ? new Date() : null,
        },
      });
    });
    return ok({ email, password });
  } catch (error) {
    // A commit whose acknowledgement was lost would otherwise have its live
    // login deleted out from under it below. If the row is there, it worked;
    // if the database cannot even say, nothing is cleaned up on a guess.
    let landed: { loginId: string } | null;
    try {
      landed = await db.accountAccess.findUnique({ where: { clientId }, select: { loginId: true } });
    } catch {
      console.error('generateTempAccess: could not tell whether temporary access was recorded', { clientId });
      return err('Could not confirm whether temporary access was created. Reload the page before trying again.');
    }
    if (landed?.loginId === email) return ok({ email, password });

    // NOTHING HALF-MADE IS LEFT BEHIND. The Membership and row rolled back
    // together; the User this call created committed on its own (the definer
    // function has to), so it goes too — only while it still belongs to
    // nothing — and then the Supabase identity.
    if (provisioned?.created) {
      await db.user
        .deleteMany({ where: { id: provisioned.userId, isPlatformAdmin: false, memberships: { none: {} } } })
        .catch((cleanup: unknown) => {
          console.error('generateTempAccess: could not remove the half-made user', {
            clientId,
            message: cleanup instanceof Error ? cleanup.message : String(cleanup),
          });
        });
    }
    await deleteIdentity(tempAuthId);
    console.error('generateTempAccess: could not record temporary access', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
    return err('Could not finish setting up temporary access. Try again.');
  }
}

/**
 * Temporary access back ON: a new password for the same temporary login, so
 * the business keeps its one owner User and Membership. A row with no
 * temporary login left (from before M52, or one removed from Supabase) gets a
 * fresh one, under a fresh synthetic address.
 */
async function enableTempAccess(
  db: PrismaClient,
  clientId: string,
  existing: { userId: string; loginId: string; tempAuthId: string | null },
): Promise<ServiceResult<GeneratedAccess>> {
  // Whoever the owner has become since (staff, or a member of another
  // business) decides again, before anything is switched on.
  const owner = await db.user.findUnique({
    where: { id: existing.userId },
    select: {
      isPlatformAdmin: true,
      memberships: { where: { clientId: { not: clientId } }, select: { id: true }, take: 1 },
    },
  });
  if (!owner) return err('That business no longer has an owner account. Reload the page and try again.');
  const refusal = temporaryAccessRefusal(owner);
  if (refusal) return err(refusal);

  // The row first, as a compare-and-set: only one admin can win it, and until
  // a password is set nobody can sign in — the identity still holds the
  // random password it was given when it was switched off. "Off" is exactly
  // what `temporaryStatusOf` calls off — including a row left switched on
  // with no temporary login behind it, which is otherwise stuck for good.
  const flipped = await db.accountAccess.updateMany({
    where: { clientId, OR: [{ status: { not: 'TEMPORARY_ACTIVE' } }, { tempAuthId: null }] },
    data: { status: 'TEMPORARY_ACTIVE', disabledAt: null, disabledByUserId: null },
  });
  if (flipped.count === 0) {
    return err('This changed while you were looking at it. Reload the page and try again.');
  }

  const switchBackOff = async () => {
    await db.accountAccess
      .updateMany({
        where: { clientId, status: 'TEMPORARY_ACTIVE' },
        data: { status: 'DISABLED', disabledAt: new Date() },
      })
      .catch((error: unknown) => {
        console.error('enableTempAccess: could not switch the row back off', {
          clientId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
  };

  const password = generateTemporaryPassword();
  if (existing.tempAuthId) {
    // The Headway-made address goes back on with the new password: whoever
    // held the login before could have moved it to an inbox of their own.
    const set = await setIdentityPassword(existing.tempAuthId, password, { email: existing.loginId });
    if (set.ok) return ok({ email: existing.loginId, password });
    if (set.reason !== 'NOT_FOUND') {
      await switchBackOff();
      return err('Could not set a new temporary password. Try again.');
    }
  }

  // No temporary login to re-use: mint one and point the row at it.
  const email = await unusedTempEmail(db);
  let tempAuthId: string;
  try {
    ({ authUserId: tempAuthId } = await createTempIdentity(email, password));
  } catch {
    await switchBackOff();
    return err('Could not create the temporary login. Try again.');
  }
  let rebound: boolean;
  try {
    rebound = await rebindTempAccess(db, clientId, existing.tempAuthId, tempAuthId, email);
  } catch (error) {
    await deleteIdentity(tempAuthId);
    await switchBackOff();
    console.error('enableTempAccess: could not record the new temporary login', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
    return err('Could not re-enable temporary access. Try again.');
  }
  if (!rebound) {
    // Another admin pointed the row at a login of their own first. Theirs
    // stands; the one made here never existed for anybody.
    await deleteIdentity(tempAuthId);
    return err('This changed while you were looking at it. Reload the page and try again.');
  }
  return ok({ email, password });
}

/**
 * Points a row at a new temporary identity, only if it still names
 * `expected` (the login the caller saw, or none). Platform staff only, through
 * the definer function (`app.rebind_temp_access`) — there is deliberately no
 * column grant for these two columns. The direct write is only for test
 * databases built without `rls.sql`. True when this call rebound the row.
 */
async function rebindTempAccess(
  db: PrismaClient,
  clientId: string,
  expected: string | null,
  tempAuthId: string,
  loginId: string,
): Promise<boolean> {
  try {
    const rows = await withRlsContext(
      db,
      (tx) =>
        tx.$queryRaw<{ n: number }[]>`SELECT app.rebind_temp_access(${clientId}, ${expected}, ${tempAuthId}, ${loginId}) AS n`,
    );
    return Number(rows[0]?.n ?? 0) === 1;
  } catch (error) {
    if (!isMissingDbFunction(error)) throw error;
    const moved = await db.accountAccess.updateMany({
      where: { clientId, tempAuthId: expected },
      data: { tempAuthId, loginId },
    });
    return moved.count === 1;
  }
}

// ---------------------------------------------------------------------------
// Disabling — the admin's action
// ---------------------------------------------------------------------------

/**
 * Switches the TEMPORARY login off — at any time, before or after setup. Never
 * deletes the Client, User, Membership or any data, and never touches the
 * owner's own login: that is a different Supabase identity.
 *
 * Two independent locks, so neither system has to be trusted alone:
 *
 *   1. The row moves to DISABLED first. `loadActor` and the database's own
 *      `app.user_id_for_auth` then treat the temporary identity as nobody —
 *      even a browser already signed in with it, and even if step 2 fails.
 *   2. Its Supabase password is overwritten with a random value nobody is
 *      given, which also ends every Supabase session it holds.
 */
export async function disableTempAccess(
  db: PrismaClient,
  clientId: string,
  adminUserId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  const access = await db.accountAccess.findUnique({
    where: { clientId },
    select: { status: true, tempAuthId: true, loginId: true, user: { select: { authProviderId: true } } },
  });
  if (!access || temporaryStatusOf(access) !== 'ACTIVE') {
    return err('Temporary access is not active for this business.');
  }
  // Never possible from this code, and checked anyway: whatever is scrambled
  // below must not be the owner's own login.
  if (access.tempAuthId === access.user.authProviderId) {
    return err('This temporary login is also the owner’s own. Contact support.');
  }

  const now = options.now ?? new Date();
  const flipped = await db.accountAccess.updateMany({
    where: { clientId, status: 'TEMPORARY_ACTIVE' },
    data: { status: 'DISABLED', disabledAt: now, disabledByUserId: adminUserId },
  });
  if (flipped.count === 0) {
    return err('This changed while you were looking at it. Reload the page and try again.');
  }

  try {
    await randomizeIdentityPassword(access.tempAuthId!, access.loginId);
  } catch (error) {
    // Sign-in is already refused by step 1; this is the second lock.
    console.error('disableTempAccess: could not scramble the temporary password', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return ok({ clientId });
}

// ---------------------------------------------------------------------------
// Setting up the owner's own login — the owner, signed in with temporary access
// ---------------------------------------------------------------------------

const MAX_NAME = 120;
const MAX_PHONE = 40;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Supabase refuses anything longer. */
const MAX_PASSWORD = 72;

/** The owner's real address: required, well-formed, and not a temporary one. */
export const ownerEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .refine((v) => EMAIL_SHAPE.test(v), 'Enter a valid email address.')
  .refine((v) => !isTemporaryEmail(v), 'Enter your own email address.');

export const newPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(MAX_PASSWORD, `Use ${MAX_PASSWORD} characters or fewer.`);

/**
 * Name and phone are optional, validated as leniently as the admin's own "Add
 * client" form. The email is required: it is what the owner signs in with and
 * where a forgotten password is recovered, and Supabase makes them confirm it
 * before it can sign in. The temporary password is refused as the owner's own:
 * the admin has seen it.
 */
const setupSchema = z
  .object({
    name: z.string().trim().max(MAX_NAME, 'That name is too long.').optional(),
    phone: z.string().trim().max(MAX_PHONE, 'That phone number is too long.').optional(),
    email: ownerEmailSchema,
    password: newPasswordSchema.refine(
      (v) => !TEMP_PASSWORD_SHAPE.test(v),
      'Choose your own password, not the temporary one.',
    ),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'These two passwords do not match.',
    path: ['confirmPassword'],
  });

export type AccountSetupInput = {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type AccountSetupValidated = {
  clientId: string;
  name: string;
  phone: string;
  email: string;
  /**
   * The own login the owner User names right now, if any — one this setup
   * replaces (the action allows that only while nobody has confirmed it, or
   * while it is still a Headway-made address).
   */
  previousOwnAuthId: string | null;
};

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Whether another RepOS account already has this address. Through the definer
 * function `app.owner_email_taken`, because under RLS a temporary login sees
 * only its own business's people; the function answers only for a temporary
 * login that is switched on, so it tells nobody else anything. The direct read
 * is only for test databases built without `rls.sql`.
 */
async function emailTakenByAnother(db: PrismaClient, actorUserId: string, email: string): Promise<boolean> {
  try {
    const rows = await withRlsContext(db, (tx) =>
      tx.$queryRaw<{ taken: boolean }[]>`SELECT app.owner_email_taken(${email}) AS taken`,
    );
    return rows[0]?.taken === true;
  } catch (error) {
    if (!isMissingDbFunction(error)) throw error;
    const collision = await db.user.findUnique({ where: { email }, select: { id: true } });
    return Boolean(collision && collision.id !== actorUserId);
  }
}

/**
 * Everything about setup EXCEPT the Supabase calls; writes nothing. Setup is
 * the temporary login's to do: the request must come from this business's
 * temporary identity, switched on.
 */
export async function validateAccountSetup(
  db: PrismaClient,
  actorUserId: string,
  clientId: string,
  sessionAuthId: string,
  input: AccountSetupInput,
): Promise<ServiceResult<AccountSetupValidated>> {
  const access = await db.accountAccess.findUnique({
    where: { clientId },
    select: { userId: true, status: true, tempAuthId: true, user: { select: { authProviderId: true } } },
  });
  if (
    !access ||
    access.userId !== actorUserId ||
    temporaryStatusOf(access) !== 'ACTIVE' ||
    access.tempAuthId !== sessionAuthId
  ) {
    return err('Sign in with the temporary email and password Headway gave you to set up your account.');
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return err('Some fields need attention.', fieldErrors(parsed.error));
  const data = parsed.data;

  // RepOS's own record of who has which address. Supabase refuses an address
  // another identity holds; this catches the one Supabase cannot see — a
  // RepOS account on that address whose Supabase login is gone. Left to
  // confirmation, that would only fail once the owner had opened the link,
  // leaving a confirmed login RepOS refuses at every sign-in.
  if (await emailTakenByAnother(db, actorUserId, data.email)) {
    return err('Some fields need attention.', {
      email: 'That email is already in use by another account.',
    });
  }

  return ok({
    clientId,
    name: data.name ?? '',
    phone: data.phone ?? '',
    email: data.email,
    previousOwnAuthId: access.user.authProviderId,
  });
}

/** How recording setup went. */
export type SetupRecord =
  /** Written. */
  | 'recorded'
  /** An admin switched the temporary login off first; nothing was written. */
  | 'access-off'
  /** Another setup changed the owner's own login first; nothing was written. */
  | 'raced';

class SetupNotRecorded extends Error {
  constructor(readonly outcome: Exclude<SetupRecord, 'recorded'>) {
    super(outcome);
  }
}

/**
 * The commit, called once Supabase has created (or re-armed) the owner's own
 * login (`ownAuthId`, not yet confirmed). One transaction, all or nothing:
 *
 *   - the row records that setup happened — compare-and-set on the temporary
 *     login still being on, so an admin's disable that landed first wins;
 *   - the owner User names that login — compare-and-set on the login it named
 *     when setup was validated, so of two setups at once (two tabs) exactly
 *     one lands, and the other removes the login it made;
 *   - the business's contact details are the owner's.
 *
 * NOT the User's email. That stays what it was until the owner proves the new
 * address by opening its confirmation link (`app.provision_user` writes it
 * then, from the identity Supabase has confirmed). An address nobody has
 * proved must never become what RepOS matches people by — accepting a team
 * invitation, for one, is matched on it.
 */
export async function finalizeAccountSetup(
  db: PrismaClient,
  actorUserId: string,
  sessionAuthId: string,
  fields: AccountSetupValidated,
  ownAuthId: string,
  options: { now?: Date } = {},
): Promise<SetupRecord> {
  const now = options.now ?? new Date();
  try {
    await withRlsContext(db, async (tx) => {
      const flipped = await tx.accountAccess.updateMany({
        where: {
          clientId: fields.clientId,
          userId: actorUserId,
          tempAuthId: sessionAuthId,
          status: 'TEMPORARY_ACTIVE',
        },
        data: { setupCompletedAt: now },
      });
      if (flipped.count === 0) throw new SetupNotRecorded('access-off');
      const moved = await tx.user.updateMany({
        where: { id: actorUserId, authProviderId: fields.previousOwnAuthId },
        data: { authProviderId: ownAuthId, ...(fields.name ? { name: fields.name } : {}) },
      });
      if (moved.count === 0) throw new SetupNotRecorded('raced');
      await tx.client.update({
        where: { id: fields.clientId },
        data: { ownerName: fields.name || null, ownerPhone: fields.phone || null, ownerEmail: fields.email },
      });
    });
    return 'recorded';
  } catch (error) {
    if (error instanceof SetupNotRecorded) return error.outcome;
    throw error;
  }
}

/**
 * Puts the owner's previous own login back, only if setup's swap is still what
 * RepOS has on record (compare-and-set). Used when that previous login turns
 * out to have been confirmed while setup was running: it is the owner's, and
 * the login setup just made goes instead. True when it was put back.
 */
export async function restoreOwnLogin(
  db: PrismaClient,
  actorUserId: string,
  swappedTo: string,
  previous: string,
): Promise<boolean> {
  return withRlsContext(db, async (tx) => {
    const moved = await tx.user.updateMany({
      where: { id: actorUserId, authProviderId: swappedTo },
      data: { authProviderId: previous },
    });
    return moved.count === 1;
  });
}

/**
 * The owner login RepOS has on record for this User right now, read back after
 * a failed commit to tell "it never landed" from "it landed and only the
 * acknowledgement was lost". Throws when the database cannot say.
 */
export async function recordedOwnLogin(db: PrismaClient, actorUserId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: actorUserId }, select: { authProviderId: true } });
  return user?.authProviderId ?? null;
}

// ---------------------------------------------------------------------------
// Reading — for the admin panel and the owner's own Account page
// ---------------------------------------------------------------------------

/**
 * The owner's own login, as Supabase sees it.
 *
 * `confirmed` is null when Supabase could not be asked just now: that says
 * nothing either way, so nothing may read it as "ready" (an admin told the
 * owner has their own sign-in might switch off the only one that works). The
 * email is then RepOS's own record, or null where that is still the
 * temporary address (the real one is recorded only once it is confirmed).
 * `confirmationSent` is whether a confirmation link is actually out there.
 */
export type OwnLogin = { email: string | null; confirmed: boolean | null; confirmationSent: boolean };

/**
 * Null — no own login — also when the identity RepOS names no longer exists
 * in Supabase, and when it is still a Headway-made address (an owner who "set
 * up" before M52 but whose real email never arrived): neither is anything the
 * owner can sign in with as themselves, and both are replaced by setup.
 */
async function ownLoginOf(user: { authProviderId: string | null; email: string }): Promise<OwnLogin | null> {
  if (!user.authProviderId) return null;
  const live = await getIdentitySnapshot(user.authProviderId);
  if (live === IDENTITY_MISSING) return null;
  if (!live) {
    return { email: isTemporaryEmail(user.email) ? null : user.email, confirmed: null, confirmationSent: false };
  }
  if (isTemporaryEmail(live.email)) return null;
  return { email: live.email, confirmed: live.confirmed, confirmationSent: live.confirmationSent };
}

/** Everything the admin panel shows, already decided. */
export type AdminAccessView = {
  /** The owner's own login (made at setup, or an owner who signed up). */
  ownLogin: OwnLogin | null;
  temporary: TemporaryStatus;
  /** The temporary email, when there is a temporary login. */
  temporaryEmail: string | null;
  /**
   * Set when no temporary login can sign in as this owner at all — they are
   * Headway staff, or belong to another business (see
   * `temporaryAccessRefusal`). The panel says so rather than offering, or
   * calling "active", a login that sign-in will refuse.
   */
  temporaryBlocked: TemporaryBlock | null;
};

const OWNER_VIEW_SELECT = (clientId: string) =>
  ({
    authProviderId: true,
    email: true,
    isPlatformAdmin: true,
    memberships: { where: { clientId: { not: clientId } }, select: { id: true }, take: 1 },
  }) as const;

export async function getAdminAccessView(db: PrismaClient, clientId: string): Promise<AdminAccessView> {
  const row = await db.accountAccess.findUnique({
    where: { clientId },
    select: { loginId: true, status: true, tempAuthId: true, user: { select: OWNER_VIEW_SELECT(clientId) } },
  });
  if (row) {
    return {
      ownLogin: await ownLoginOf(row.user),
      temporary: temporaryStatusOf(row),
      temporaryEmail: row.tempAuthId ? row.loginId : null,
      temporaryBlocked: temporaryAccessBlock(row.user),
    };
  }
  const owner = await db.membership.findFirst({
    where: { clientId, role: ROLE_OWNER, status: ACTIVE },
    orderBy: { createdAt: 'asc' },
    select: { user: { select: OWNER_VIEW_SELECT(clientId) } },
  });
  return {
    ownLogin: owner ? await ownLoginOf(owner.user) : null,
    temporary: 'NONE',
    temporaryEmail: null,
    temporaryBlocked: owner ? temporaryAccessBlock(owner.user) : null,
  };
}

/** What Account needs to know about the signed-in person and this business. */
export type OwnerAccessView = {
  /** Signed in with this business's temporary login, rather than their own. */
  viaTemporary: boolean;
  ownLogin: OwnLogin | null;
};

export async function getOwnerAccessView(
  db: PrismaClient,
  clientId: string,
  actorUserId: string,
  sessionAuthId: string,
): Promise<OwnerAccessView | null> {
  const row = await db.accountAccess.findUnique({
    where: { clientId },
    select: { userId: true, tempAuthId: true, status: true, user: { select: { authProviderId: true, email: true } } },
  });
  if (!row || row.userId !== actorUserId) return null;
  return {
    viaTemporary: temporaryStatusOf(row) === 'ACTIVE' && row.tempAuthId === sessionAuthId,
    ownLogin: await ownLoginOf(row.user),
  };
}
