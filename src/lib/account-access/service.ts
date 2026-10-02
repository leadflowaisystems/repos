import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { withRlsContext } from '@/lib/db';
import { ACTIVE, IdentityConflictError, provisionUser, ROLE_OWNER } from '@/lib/tenancy/service';
import { TOKEN_ALPHABET } from '@/lib/tokens';
import {
  accessStatusOf,
  isTemporaryEmail,
  TEMP_EMAIL_DOMAIN,
  TEMP_PASSWORD_SHAPE,
  type AccessStatus,
} from '@/lib/account-access/state';
import {
  createTempIdentity,
  deleteIdentity,
  getIdentitySnapshot,
  randomizeIdentityPassword,
  setIdentityPassword,
} from '@/lib/auth/supabase-admin';

/**
 * TEMPORARY ACCESS FOR ONE CLIENT (M39, made a real handover in M52).
 *
 * The admin creates a business, then generates a temporary EMAIL and
 * PASSWORD for it and hands both to the owner. No email is sent: the identity
 * is minted pre-confirmed through the Supabase admin API under a synthetic
 * address (`…@access.headway.local`), so it signs in on the ordinary login
 * page straight away. The owner then sets up their own account from Account:
 * their real email (which Supabase makes them confirm) and their own password.
 *
 * ONE IDENTITY PER CLIENT, FOR GOOD. Generating creates the one Supabase
 * identity, the one User and the one BUSINESS_OWNER Membership this access
 * will ever name. Setup keeps all three — the same Supabase user simply gets
 * a new password and, once confirmed, a new email. Disabling keeps all three
 * too, and issuing new temporary access after a disable reuses them.
 *
 * The status moves:
 *
 *   TEMPORARY_ACTIVE  the temporary email and password sign in
 *   SETUP_COMPLETE    the owner chose their own password (temporary one gone)
 *   DISABLED          an admin turned the temporary login off before setup
 *
 *   TEMPORARY_ACTIVE -> SETUP_COMPLETE   the owner, from Account
 *   TEMPORARY_ACTIVE -> DISABLED         an admin
 *   DISABLED -> TEMPORARY_ACTIVE         an admin, with a brand-new password
 *
 * Nothing moves a SETUP_COMPLETE row: after setup there is no temporary
 * access left, and the owner's own login is not this panel's to turn off.
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

export { isTemporaryEmail, type AccessStatus };

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
 * from the alphabet that has no 0/o or 1/l to confuse, about 80 bits of
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

// ---------------------------------------------------------------------------
// Generating (and re-issuing) temporary access — the admin's action
// ---------------------------------------------------------------------------

export type GeneratedAccess = { email: string; password: string };

/**
 * An ACTIVE owner of this business who is somebody other than its temporary
 * login — an owner who signed up themselves, or was invited. A business that
 * already has one does not need temporary access, and minting it anyway would
 * put a second owner identity on a real customer's business.
 */
async function otherOwnerOf(
  db: PrismaClient,
  clientId: string,
  temporaryUserId: string | null,
): Promise<{ email: string } | null> {
  const owner = await db.membership.findFirst({
    where: {
      clientId,
      role: ROLE_OWNER,
      status: ACTIVE,
      ...(temporaryUserId ? { userId: { not: temporaryUserId } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { user: { select: { email: true } } },
  });
  return owner ? { email: owner.user.email } : null;
}

/**
 * Mints temporary access for a client, or issues a brand-new password for one
 * whose temporary access was disabled before anyone set it up.
 *
 * Deliberately NOT part of client creation: an admin generates it when the
 * kit is actually ready to hand over. Sends no email.
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
    select: { userId: true, loginId: true, status: true, setupCompletedAt: true },
  });

  const owner = await otherOwnerOf(db, clientId, existing?.userId ?? null);
  if (owner) {
    return err(
      `This business already has an owner account (${owner.email}). They sign in with their own email and password, so it does not need temporary access.`,
    );
  }

  if (existing) {
    if (existing.setupCompletedAt !== null || existing.status === 'SETUP_COMPLETE') {
      return err('The owner has already set up their account, so there is no temporary access to issue.');
    }
    if (existing.status === 'TEMPORARY_ACTIVE') {
      return err('Temporary access is already active. Disable it first if you need a new password.');
    }
    return reissueTempAccess(db, clientId, existing);
  }

  // A collision is astronomically unlikely (32^8) but cheap to guard.
  let email = generateTempEmail();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await db.accountAccess.findUnique({ where: { loginId: email }, select: { id: true } });
    if (!clash) break;
    email = generateTempEmail();
  }
  const password = generateTemporaryPassword();

  let authUserId: string;
  try {
    ({ authUserId } = await createTempIdentity(email, password));
  } catch {
    return err('Could not create the temporary login. Try again.');
  }

  let provisioned: { userId: string; created: boolean } | null = null;
  try {
    // The values just came back from the createTempIdentity call above, which
    // is the same trust argument provisionUser's other callers make about a
    // just-verified Supabase session. The address is freshly minted, so this
    // always inserts a new User.
    provisioned = await provisionUser(db, { providerId: authUserId, email });
    const { userId } = provisioned;

    await withRlsContext(db, async (tx) => {
      await tx.membership.create({
        data: { userId, clientId, role: ROLE_OWNER, status: ACTIVE },
      });
      await tx.accountAccess.create({
        data: { clientId, userId, loginId: email, status: 'TEMPORARY_ACTIVE', createdByUserId: adminUserId },
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

    // NOTHING HALF-MADE IS LEFT BEHIND. provisionUser commits on its own (it
    // has to: it is the definer function signup uses), so a failure after it
    // would otherwise leave an ACTIVE User with no membership pointing at an
    // identity deleted a line later. Only a row this call created, and only
    // while it still belongs to nothing.
    if (provisioned?.created) {
      await db.user
        .deleteMany({
          where: { id: provisioned.userId, isPlatformAdmin: false, memberships: { none: {} } },
        })
        .catch((cleanup: unknown) => {
        console.error('generateTempAccess: could not remove the half-made user', {
          clientId,
          message: cleanup instanceof Error ? cleanup.message : String(cleanup),
        });
      });
    }
    await deleteIdentity(authUserId);
    console.error('generateTempAccess: could not record temporary access', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof IdentityConflictError) return err('That temporary email is already in use. Try again.');
    return err('Could not finish setting up temporary access. Try again.');
  }
}

/**
 * New temporary access after a disable: a new password on the SAME identity,
 * so the business keeps its one owner login — no second User, Membership or
 * Supabase identity. The temporary email stays the same.
 */
async function reissueTempAccess(
  db: PrismaClient,
  clientId: string,
  existing: { userId: string; loginId: string },
): Promise<ServiceResult<GeneratedAccess>> {
  const user = await db.user.findUnique({
    where: { id: existing.userId },
    select: { authProviderId: true, email: true },
  });
  if (!user?.authProviderId || user.email.toLowerCase() !== existing.loginId.toLowerCase()) {
    return err('This temporary login cannot be re-issued. Contact support.');
  }

  // The row first, as a compare-and-set: only one admin can win it, and until
  // the new password is set the identity still holds the random one it was
  // given when it was disabled, so nobody can sign in in between.
  const flipped = await db.accountAccess.updateMany({
    where: { clientId, status: 'DISABLED', setupCompletedAt: null },
    data: { status: 'TEMPORARY_ACTIVE', disabledAt: null, disabledByUserId: null },
  });
  if (flipped.count === 0) {
    return err('This changed while you were looking at it. Reload the page and try again.');
  }

  const password = generateTemporaryPassword();
  const set = await setIdentityPassword(user.authProviderId, password);
  if (!set.ok) {
    // Back to DISABLED, so the panel never says "active" over a password that
    // was never set.
    await db.accountAccess
      .updateMany({
        where: { clientId, status: 'TEMPORARY_ACTIVE', setupCompletedAt: null },
        data: { status: 'DISABLED', disabledAt: new Date() },
      })
      .catch((error: unknown) => {
        console.error('reissueTempAccess: could not put the row back to DISABLED', {
          clientId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return err(
      set.reason === 'NOT_FOUND'
        ? 'The temporary login for this business no longer exists. Contact support.'
        : 'Could not set a new temporary password. Try again.',
    );
  }
  return ok({ email: existing.loginId, password });
}

// ---------------------------------------------------------------------------
// Disabling — the admin's action
// ---------------------------------------------------------------------------

/**
 * Turns temporary access off BEFORE setup. Never deletes the Client, User,
 * Membership or any data.
 *
 * Two independent locks, so neither system has to be trusted alone:
 *
 *   1. The row moves to DISABLED first. `loadActor` treats a DISABLED,
 *      never-set-up temporary login as nobody, so every page and action
 *      refuses it immediately — even a browser that is already signed in,
 *      and even if step 2 fails.
 *   2. The Supabase password is overwritten with a random value nobody is
 *      given, which also ends every Supabase session the identity holds. The
 *      temporary password stops working on the normal login page.
 *
 * After setup there is nothing temporary left to disable: the owner signs in
 * with their own email and password, and this refuses rather than pretending.
 */
export async function disableTempAccess(
  db: PrismaClient,
  clientId: string,
  adminUserId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  const access = await db.accountAccess.findUnique({
    where: { clientId },
    select: { userId: true, status: true, loginId: true, setupCompletedAt: true },
  });
  if (!access) return err('There is no temporary access for this client.');
  if (access.status === 'DISABLED') return err('Temporary access is already disabled.');
  if (access.status === 'SETUP_COMPLETE' || access.setupCompletedAt !== null) {
    return err(
      'The owner has already set up their account. They sign in with their own email and password, so there is no temporary access to disable.',
    );
  }

  const user = await db.user.findUnique({
    where: { id: access.userId },
    select: { authProviderId: true, email: true },
  });
  // A login that already signs in with an address the owner typed is theirs,
  // not temporary: an earlier version of setup could move the email over and
  // then fail to record it. Scrambling that would lock a real owner out.
  if (user && user.email.toLowerCase() !== access.loginId.toLowerCase()) {
    return err(
      'This login already uses the owner’s own email address, so it is not temporary access any more.',
    );
  }

  const now = options.now ?? new Date();
  const flipped = await db.accountAccess.updateMany({
    where: { clientId, status: 'TEMPORARY_ACTIVE', setupCompletedAt: null },
    data: { status: 'DISABLED', disabledAt: now, disabledByUserId: adminUserId },
  });
  if (flipped.count === 0) {
    return err('This changed while you were looking at it. Reload the page and try again.');
  }

  if (user?.authProviderId) {
    try {
      await randomizeIdentityPassword(user.authProviderId);
    } catch (error) {
      // Sign-in is already refused by step 1; this is the second lock.
      console.error('disableTempAccess: could not scramble the temporary password', {
        clientId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return ok({ clientId });
}

// ---------------------------------------------------------------------------
// Completing setup — the owner's own action
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
 * client" form. The email is required: it is what the owner signs in with
 * afterwards and where a forgotten password is recovered, and Supabase makes
 * them confirm it before it counts.
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
 * Everything about completing setup EXCEPT the Supabase calls — and nothing
 * here writes anything, so the caller can change the password in Supabase
 * between this and the commit, and commit only once Supabase has accepted it.
 */
export async function validateAccountSetup(
  db: PrismaClient,
  actorUserId: string,
  clientId: string,
  input: AccountSetupInput,
): Promise<ServiceResult<AccountSetupValidated>> {
  const access = await db.accountAccess.findUnique({
    where: { userId: actorUserId },
    select: { clientId: true, status: true },
  });
  // One refusal whether there is no temporary access at all, it belongs to a
  // different client than the one this request names, or it has already
  // moved past TEMPORARY_ACTIVE — none of that is this form's to explain.
  if (!access || access.clientId !== clientId || access.status !== 'TEMPORARY_ACTIVE') {
    return err('This account has already been set up.');
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return err('Some fields need attention.', fieldErrors(parsed.error));
  const data = parsed.data;

  // RepOS's own record of who has which address. Supabase is the real guard
  // (it refuses an address another identity holds); this only catches the
  // case early, as a plain field error.
  const collision = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (collision && collision.id !== actorUserId) {
    return err('Some fields need attention.', {
      email: 'That email is already in use by another account.',
    });
  }

  return ok({ clientId, name: data.name ?? '', phone: data.phone ?? '', email: data.email });
}

/**
 * The commit — called ONLY after Supabase has accepted the owner's new
 * password on the same identity. Compare-and-set on TEMPORARY_ACTIVE, so an
 * admin's disable that landed first wins and is never silently overwritten.
 *
 * The LOGIN email is deliberately not written: it changes in Supabase only
 * when the owner opens the confirmation link, and the next sign-in brings
 * RepOS's record into line (`provisionUser`).
 */
export async function finalizeAccountSetup(
  db: PrismaClient,
  actorUserId: string,
  fields: AccountSetupValidated,
  options: { now?: Date } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  return withRlsContext(db, async (tx) => {
    const flipped = await tx.accountAccess.updateMany({
      where: { userId: actorUserId, clientId: fields.clientId, status: 'TEMPORARY_ACTIVE' },
      data: { status: 'SETUP_COMPLETE', setupCompletedAt: now },
    });
    if (flipped.count === 0) return false;
    // Name and phone are the owner's own from here on. The email is not
    // written here: it is recorded once Supabase has accepted it for a
    // confirmation link — a taken address belongs to somebody else.
    await tx.client.update({
      where: { id: fields.clientId },
      data: { ownerName: fields.name || null, ownerPhone: fields.phone || null },
    });
    return true;
  });
}

// ---------------------------------------------------------------------------
// Reading — for the admin panel and the owner's own Account page
// ---------------------------------------------------------------------------

export type AccountAccessView = {
  clientId: string;
  loginId: string;
  status: AccessStatus;
  createdAt: Date;
  setupCompletedAt: Date | null;
  disabledAt: Date | null;
};

const ROW_SELECT = {
  clientId: true,
  userId: true,
  loginId: true,
  status: true,
  createdAt: true,
  setupCompletedAt: true,
  disabledAt: true,
  user: { select: { email: true, authProviderId: true } },
} as const;

/** Everything the admin panel shows, already decided. */
export type AdminAccessView = {
  status: 'NONE' | AccessStatus;
  /** The temporary email, when there is one. */
  temporaryEmail: string | null;
  /** After setup: the email the owner signs in with now. */
  signInEmail: string | null;
  /** After setup: a new address the owner has not confirmed yet. */
  pendingEmail: string | null;
  /** Another owner account this business already has, if any. */
  ownerAccount: { email: string } | null;
};

export async function getAdminAccessView(db: PrismaClient, clientId: string): Promise<AdminAccessView> {
  const row = await db.accountAccess.findUnique({ where: { clientId }, select: ROW_SELECT });
  const ownerAccount = await otherOwnerOf(db, clientId, row?.userId ?? null);
  if (!row) {
    return { status: 'NONE', temporaryEmail: null, signInEmail: null, pendingEmail: null, ownerAccount };
  }

  const status = accessStatusOf(row, row.user.email);
  if (status !== 'SETUP_COMPLETE') {
    return { status, temporaryEmail: row.loginId, signInEmail: null, pendingEmail: null, ownerAccount };
  }

  // After setup the truth about the login lives in Supabase: the address can
  // change there (a confirmed link) before RepOS next hears about it.
  const live = row.user.authProviderId ? await getIdentitySnapshot(row.user.authProviderId) : null;
  return {
    status,
    temporaryEmail: row.loginId,
    signInEmail: live?.email ?? row.user.email,
    pendingEmail: live?.pendingEmail ?? null,
    ownerAccount,
  };
}

/** The signed-in owner's own view, used to decide whether to show setup. */
export async function getAccountAccessForUser(
  db: PrismaClient,
  userId: string,
): Promise<AccountAccessView | null> {
  const row = await db.accountAccess.findUnique({ where: { userId }, select: ROW_SELECT });
  if (!row) return null;
  return {
    clientId: row.clientId,
    loginId: row.loginId,
    status: accessStatusOf(row, row.user.email),
    createdAt: row.createdAt,
    setupCompletedAt: row.setupCompletedAt,
    disabledAt: row.disabledAt,
  };
}
