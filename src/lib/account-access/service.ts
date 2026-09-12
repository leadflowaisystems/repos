import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { withRlsContext } from '@/lib/db';
import {
  ACTIVE,
  bumpSessionVersion,
  IdentityConflictError,
  provisionUser,
  ROLE_OWNER,
} from '@/lib/tenancy/service';
import { TOKEN_ALPHABET } from '@/lib/tokens';
import {
  createTempIdentity,
  deleteIdentity,
  randomizeIdentityPassword,
} from '@/lib/auth/supabase-admin';

/**
 * PILOT ONBOARDING: A TEMPORARY CREDENTIAL FOR ONE CLIENT (M39).
 *
 * The admin-created client flow leaves a business with no owner attached —
 * granting real access has always meant a separate, email-dependent invite
 * (see `@/lib/team/service.ts`). This is the pilot's replacement for that one
 * step: mint a real Supabase identity up front, with a generated login id
 * and password the admin hands over physically, and let the owner turn it
 * into their own account from the workspace they can already reach.
 *
 * ONE ROW PER CLIENT. Generating it also creates the one User and the one
 * Membership this credential will ever name — never a second identity, and
 * never repeated: `generateTempAccess` refuses outright if a row already
 * exists for this client.
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

// ---------------------------------------------------------------------------
// Generating a login id and a password nobody has to remember for long.
// ---------------------------------------------------------------------------

/** Never a real address — the synthetic domain makes that visible on sight. */
const LOGIN_ID_SUFFIX = '@access.headway.local';
const LOGIN_ID_BODY_LENGTH = 8;
const PASSWORD_LENGTH = 14;

/** Unbiased against the 32-letter alphabet, same technique as `newPublicToken`. */
function randomFromAlphabet(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const byte of bytes) out += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return out;
}

function generateLoginId(): string {
  return `${randomFromAlphabet(LOGIN_ID_BODY_LENGTH)}${LOGIN_ID_SUFFIX}`;
}

function generateTempPassword(): string {
  return randomFromAlphabet(PASSWORD_LENGTH);
}

// ---------------------------------------------------------------------------
// Generating temporary access
// ---------------------------------------------------------------------------

export type GeneratedAccess = { loginId: string; password: string };

/**
 * Mints a temporary credential for a client that does not already have one.
 *
 * Deliberately NOT part of client creation — see the account-access panel's
 * own comment for why keeping them separate matters. This can be called any
 * time after the client exists, including long after, whenever the kit is
 * actually ready to hand over.
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
    select: { id: true },
  });
  if (existing) return err('Temporary access already exists for this client.');

  // A collision is astronomically unlikely (32^8) but cheap to guard.
  let loginId = generateLoginId();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await db.accountAccess.findUnique({
      where: { loginId },
      select: { id: true },
    });
    if (!clash) break;
    loginId = generateLoginId();
  }
  const password = generateTempPassword();

  let authUserId: string;
  try {
    ({ authUserId } = await createTempIdentity(loginId, password));
  } catch {
    return err('Could not create the temporary login. Try again.');
  }

  try {
    // provisionUser is safe here despite trusting its inputs with no
    // identity check of its own: its three existing callers pass values
    // from a just-verified Supabase session, and this is a fourth, different
    // but equally valid trust argument — the values just came back from a
    // createTempIdentity() call this same function made. The email is
    // freshly minted and unique, so this always takes the "insert new User"
    // branch; IdentityConflictError is only possible if some other process
    // has already claimed this exact synthetic address, vanishingly
    // unlikely but handled below like any other failure.
    const { userId } = await provisionUser(db, { providerId: authUserId, email: loginId });

    await withRlsContext(db, async (tx) => {
      await tx.membership.create({
        data: { userId, clientId, role: ROLE_OWNER, status: ACTIVE },
      });
      await tx.accountAccess.create({
        data: {
          clientId,
          userId,
          loginId,
          status: 'TEMPORARY_ACTIVE',
          createdByUserId: adminUserId,
        },
      });
    });

    return ok({ loginId, password });
  } catch (error) {
    // Nothing reads an orphaned Supabase identity, but leaving one behind
    // silently is still worth cleaning up on a best-effort basis.
    await deleteIdentity(authUserId);
    if (error instanceof IdentityConflictError) {
      return err('That login id is already in use. Try again.');
    }
    return err('Could not finish setting up temporary access. Try again.');
  }
}

// ---------------------------------------------------------------------------
// Completing setup — the owner's own action
// ---------------------------------------------------------------------------

const MAX_NAME = 120;
const MAX_PHONE = 40;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Name/phone/email are optional, validated exactly as leniently as the
 * admin's own "Add client" form (`@/lib/clients/schema.ts`) — this is not
 * the place to force a field the rest of the product does not require.
 * Password is the one thing this form actually exists for.
 */
const setupSchema = z
  .object({
    name: z.string().trim().max(MAX_NAME, 'That name is too long.').optional(),
    phone: z.string().trim().max(MAX_PHONE, 'That phone number is too long.').optional(),
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || EMAIL_SHAPE.test(v), 'Enter a valid email address, or leave it blank.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
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

/**
 * Everything about completing setup EXCEPT the Supabase password change.
 *
 * The caller (the server action) makes the Supabase call itself, and does so
 * LAST, after this has already committed — the same ordering discipline
 * `updatePasswordAction` documents and follows: the reversible writes go
 * first, the one step that cannot join this transaction goes after
 * everything reversible has already succeeded.
 */
export async function completeAccountSetup(
  db: PrismaClient,
  actorUserId: string,
  clientId: string,
  input: AccountSetupInput,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
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
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
    }
    return err('Some fields need attention.', errors);
  }
  const data = parsed.data;
  const now = options.now ?? new Date();

  await withRlsContext(db, async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: {
        ownerName: data.name || null,
        ownerPhone: data.phone || null,
        ownerEmail: data.email || null,
      },
    });
    await tx.accountAccess.update({
      where: { userId: actorUserId },
      data: { status: 'SETUP_COMPLETE', setupCompletedAt: now },
    });
  });
  await bumpSessionVersion(db, actorUserId);

  return ok({ clientId });
}

// ---------------------------------------------------------------------------
// Disabling — the admin's own action
// ---------------------------------------------------------------------------

/**
 * Turns a temporary credential off. Never touches the User, Membership or
 * Client it belongs to — only this row, and (when needed) the Supabase
 * password behind it.
 *
 * The DB flip alone is not enough when the credential is still
 * TEMPORARY_ACTIVE: nothing in the ordinary sign-in path consults
 * AccountAccess, so the known temporary password would keep authenticating
 * through the normal login page even after an admin "disables" it here. So
 * in that case the Supabase-side password is also randomized to something
 * nobody is ever given, before the row is flipped. Once status is already
 * SETUP_COMPLETE the owner has already overwritten that password themselves
 * — there is nothing left on the Supabase side to revoke, so this is a
 * records-only change.
 *
 * `sessionVersion` is deliberately not relied on for this: it is written
 * elsewhere in this codebase but nothing currently reads or compares it, so
 * bumping it has no observable effect on a session already in a browser.
 */
export async function disableTempAccess(
  db: PrismaClient,
  clientId: string,
  adminUserId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string }>> {
  const access = await db.accountAccess.findUnique({
    where: { clientId },
    select: { userId: true, status: true },
  });
  if (!access) return err('There is no temporary access for this client.');
  if (access.status === 'DISABLED') return err('Temporary access is already disabled.');

  if (access.status === 'TEMPORARY_ACTIVE') {
    const user = await db.user.findUnique({
      where: { id: access.userId },
      select: { authProviderId: true },
    });
    if (user?.authProviderId) {
      try {
        await randomizeIdentityPassword(user.authProviderId);
      } catch {
        return err('Could not disable the temporary password. Try again.');
      }
    }
  }

  const now = options.now ?? new Date();
  await db.accountAccess.update({
    where: { clientId },
    data: { status: 'DISABLED', disabledAt: now, disabledByUserId: adminUserId },
  });

  return ok({ clientId });
}

// ---------------------------------------------------------------------------
// Reading — for the admin panel and the owner's own Account page
// ---------------------------------------------------------------------------

export type AccountAccessView = {
  loginId: string;
  status: string;
  createdAt: Date;
  setupCompletedAt: Date | null;
  disabledAt: Date | null;
};

function toView(row: {
  loginId: string;
  status: string;
  createdAt: Date;
  setupCompletedAt: Date | null;
  disabledAt: Date | null;
}): AccountAccessView {
  return {
    loginId: row.loginId,
    status: row.status,
    createdAt: row.createdAt,
    setupCompletedAt: row.setupCompletedAt,
    disabledAt: row.disabledAt,
  };
}

/** The admin's own view: does this client have temporary access, and what state is it in. */
export async function getAccountAccess(
  db: PrismaClient,
  clientId: string,
): Promise<AccountAccessView | null> {
  const row = await db.accountAccess.findUnique({
    where: { clientId },
    select: { loginId: true, status: true, createdAt: true, setupCompletedAt: true, disabledAt: true },
  });
  return row ? toView(row) : null;
}

/** The signed-in owner's own view, used to decide whether to show the setup section. */
export async function getAccountAccessForUser(
  db: PrismaClient,
  userId: string,
): Promise<AccountAccessView | null> {
  const row = await db.accountAccess.findUnique({
    where: { userId },
    select: { loginId: true, status: true, createdAt: true, setupCompletedAt: true, disabledAt: true },
  });
  return row ? toView(row) : null;
}
