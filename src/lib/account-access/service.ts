import { randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { isMissingDbFunction, withRlsContext } from '@/lib/db';
import { ACTIVE, provisionUser, ROLE_OWNER } from '@/lib/tenancy/service';
import { TOKEN_ALPHABET } from '@/lib/tokens';
import {
  isTemporaryEmail,
  looksLikeTemporaryPassword,
  TEMP_EMAIL_DOMAIN,
  TEMPORARY_PASSWORD_REFUSED,
  temporaryStatusOf,
  type TemporaryStatus,
} from '@/lib/account-access/state';
import {
  createPendingOwnerIdentity,
  createTempIdentity,
  deleteIdentity,
  getIdentitySnapshot,
  IDENTITY_MISSING,
  randomizeIdentityPassword,
  setIdentityPassword,
} from '@/lib/auth/supabase-admin';

/**
 * TEMPORARY ACCESS FOR ONE CLIENT (M39; two logins since M52; owner's email
 * recorded by Headway since M53).
 *
 * The admin creates a business, types the owner's email, and generates a
 * temporary EMAIL and PASSWORD for it. No email is sent: the temporary login
 * is minted pre-confirmed through the Supabase admin API under a synthetic
 * address (`…@access.headway.local`), so it signs in on the ordinary login
 * page straight away. The owner's OWN login is made at the same moment, on
 * the address the admin typed, unconfirmed and with no password anybody
 * knows. From Account, the owner has a link sent to that address; opening it
 * proves the address and lets them choose their password.
 *
 * TWO LOGINS, ONE ACCOUNT. The temporary login (`AccountAccess.tempAuthId`)
 * and the owner's own login (`User.authProviderId`) are separate Supabase
 * identities that both open the SAME owner User — one User, one Membership,
 * one Client. That is what lets an admin switch temporary access off, and on
 * again later, at any time, without ever touching the owner's own password.
 *
 *   No temporary access     -> Generate      (mints the temporary login, and
 *                                             the owner's pending own login)
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
 *   - no row yet, no owner:  makes the owner's own login (pending, on the
 *                            address the admin typed), the temporary login,
 *                            and the business's owner User and Membership;
 *   - no row yet, an owner:  a temporary login into that owner's account —
 *                            plus their pending own login on the typed
 *                            address if they have no login of their own;
 *   - row switched off:      gives the same temporary email a new password.
 *                            The owner's own login is not touched.
 *
 * Sends no email.
 */
export async function generateTempAccess(
  db: PrismaClient,
  clientId: string,
  adminUserId: string,
  input: { ownerEmail?: string } = {},
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

  // The owner's own login: the one they already sign in with, or a pending
  // one made now on the address Headway recorded for them.
  let ownAuthId = owner?.user.authProviderId ?? null;
  const makeOwn = ownAuthId === null;
  if (makeOwn) {
    const checked = await checkedOwnerEmail(db, input.ownerEmail ?? '', owner?.user.id ?? null);
    if (!checked.ok) return checked;
    const made = await makePendingOwnerLogin(checked.data);
    if (!made.ok) return made;
    ownAuthId = made.data.authUserId;
  }
  const discardOwn = async () => {
    if (makeOwn) await deleteIdentity(ownAuthId!);
  };

  const email = await unusedTempEmail(db);
  const password = generateTemporaryPassword();
  let tempAuthId: string;
  try {
    ({ authUserId: tempAuthId } = await createTempIdentity(email, password));
  } catch {
    await discardOwn();
    return err('Could not create the temporary login. Try again.');
  }

  let provisioned: { userId: string; created: boolean } | null = null;
  try {
    if (!owner) {
      // The business's owner. Created through the same definer function
      // signup uses (the runtime role may not write a User row directly — it
      // could otherwise write `isPlatformAdmin`), bound to their pending own
      // login. The synthetic address stands in as the email: the real one is
      // written only once the owner proves it (`app.provision_user`, when the
      // emailed link is opened).
      provisioned = await provisionUser(db, { providerId: ownAuthId!, email });
    }
    await withRlsContext(db, async (tx) => {
      let userId = owner?.user.id ?? null;
      if (!userId) {
        userId = provisioned!.userId;
        await tx.membership.create({ data: { userId, clientId, role: ROLE_OWNER, status: ACTIVE } });
      } else if (makeOwn) {
        const bound = await tx.user.updateMany({
          where: { id: userId, authProviderId: null },
          data: { authProviderId: ownAuthId },
        });
        if (bound.count !== 1) throw new Error('the owner was given a login of their own meanwhile');
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
          setupCompletedAt: makeOwn ? null : new Date(),
        },
      });
    });
    return ok({ email, password });
  } catch (error) {
    // A commit whose acknowledgement was lost would otherwise have its live
    // logins deleted out from under it below. If the row is there, it worked;
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
    // nothing — and then both Supabase identities.
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
    await discardOwn();
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
// The owner's own login — made by Headway on the address Headway recorded
// ---------------------------------------------------------------------------

/**
 * WHY HEADWAY, NOT THE PERSON SIGNED IN WITH THE TEMPORARY LOGIN (M53).
 *
 * The temporary email and password are a bearer pass: whoever holds the
 * handover sheet is indistinguishable from the owner. Up to M52, setup asked
 * that session for an email AND a password and made the owner's permanent
 * login from them — so whoever got the sheet first could make it their own,
 * on their own address, or on the owner's address with a password they knew.
 *
 * Now the address is Headway's to record (the admin types it when generating
 * temporary access, and can correct it until the owner has proved it), and
 * the owner's own login is made right then, from the admin's action: on that
 * address, NOT confirmed, with no password anybody knows. Nothing can sign in
 * with it. It starts working only when somebody opens a link emailed to that
 * address and chooses a password — the ordinary reset link. The temporary
 * session can ask for that link to be sent, and that is all it can do: it
 * goes to the recorded inbox, so only the person who reads it can finish.
 */

const MAX_EMAIL = 254;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/**
 * Stricter, for the address Headway records for an owner: letters, digits
 * and the usual punctuation, with no empty dot-separated part, ending in a
 * letter — close to what Supabase itself accepts, so a pasted "name@mail.com."
 * is caught here rather than refused by Supabase with no field to point at.
 */
const OWNER_EMAIL_SHAPE =
  /^[a-z0-9!#$%&\x27*+\/=?^_\x60{|}~-]+(\.[a-z0-9!#$%&\x27*+\/=?^_\x60{|}~-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
/** Supabase refuses anything longer. */
const MAX_PASSWORD = 72;

/** The owner's real address: required, well-formed, and not a temporary one. Trimmed and lower-cased. */
export const ownerEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter the owner’s email address.')
  .max(MAX_EMAIL, 'That email address is too long.')
  .refine((v) => OWNER_EMAIL_SHAPE.test(v), 'Enter a valid email address.')
  .refine((v) => !isTemporaryEmail(v), 'Enter the owner’s own email address, not a temporary one.');

export const newPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(MAX_PASSWORD, `Use ${MAX_PASSWORD} characters or fewer.`)
  // The handover sheet's password has been seen by the admin and by whoever
  // carried the sheet: never anyone's own.
  .refine((v) => !looksLikeTemporaryPassword(v), TEMPORARY_PASSWORD_REFUSED);

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const ADDRESS_TAKEN =
  'This email already has a Headway sign-in, so a new one cannot be made on it. Check the address. If it is the owner’s own existing account, invite them as Owner from the Team page instead.';
const ADDRESS_REFUSED = 'Supabase does not accept this address. Check it for a stray dot, space or symbol.';

/** The owner's address, checked; a field error under `ownerEmail` otherwise. */
async function checkedOwnerEmail(
  db: PrismaClient,
  raw: string,
  ownerUserId: string | null,
): Promise<ServiceResult<string>> {
  const parsed = ownerEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', { ownerEmail: parsed.error.issues[0]!.message });
  }
  // RepOS's own record of who has which address. Supabase then refuses an
  // address any login holds, including one nobody has confirmed.
  const holder = await db.user.findFirst({
    where: {
      email: { equals: parsed.data, mode: 'insensitive' },
      ...(ownerUserId ? { id: { not: ownerUserId } } : {}),
    },
    select: { id: true },
  });
  if (holder) return err('Some fields need attention.', { ownerEmail: ADDRESS_TAKEN });
  return ok(parsed.data);
}

/**
 * Makes the owner's pending own login on `email`. Its id is chosen here and
 * handed to Supabase, so a reply lost on the way back cannot leave a login
 * nobody can find: it is looked up by that id instead.
 */
async function makePendingOwnerLogin(email: string): Promise<ServiceResult<{ authUserId: string }>> {
  const authUserId = randomUUID();
  const made = await createPendingOwnerIdentity(email, authUserId);
  if (made.ok) return ok({ authUserId: made.authUserId });
  if (made.reason === 'EMAIL_TAKEN') return err('Some fields need attention.', { ownerEmail: ADDRESS_TAKEN });
  if (made.reason === 'EMAIL_REFUSED') return err('Some fields need attention.', { ownerEmail: ADDRESS_REFUSED });
  if (made.reason === 'NOT_CONFIGURED') return err(made.message);
  const landed = await getIdentitySnapshot(authUserId);
  if (landed !== null && landed !== IDENTITY_MISSING && landed.email === email) return ok({ authUserId });
  if (landed === null) {
    console.error('makePendingOwnerLogin: could not tell whether the login was made', { authUserId });
  } else if (landed !== IDENTITY_MISSING) {
    await deleteIdentity(authUserId);
  }
  return err('Could not create the owner’s sign-in. Try again.');
}

/**
 * The admin's "Owner's email": adds it where there is none yet (a business
 * handed over before M53), or corrects it while the owner has not proved it.
 *
 * The login on the old address is never edited — a link already sitting in
 * that inbox would then confirm the corrected one. It is REPLACED: scrambled
 * first (so no link already sent still works), a new pending login made on
 * the new address and swapped in with a compare-and-set, and the old one
 * deleted. A login somebody has confirmed is the owner's own and is never
 * replaced here.
 */
export async function setOwnerEmail(
  db: PrismaClient,
  clientId: string,
  rawEmail: string,
): Promise<ServiceResult<{ email: string; changed: boolean }>> {
  const access = await db.accountAccess.findUnique({
    where: { clientId },
    select: { userId: true, tempAuthId: true, user: { select: { authProviderId: true } } },
  });
  if (!access) return err('Generate temporary access first.');

  const checked = await checkedOwnerEmail(db, rawEmail, access.userId);
  if (!checked.ok) return checked;
  const email = checked.data;

  const previous = access.user.authProviderId;
  if (previous && previous === access.tempAuthId) {
    return err('This owner’s sign-in needs attention from support.');
  }
  if (previous) {
    const now = await getIdentitySnapshot(previous);
    if (now === null) return err('Could not check the owner’s sign-in just now. Nothing was changed — try again.');
    if (now !== IDENTITY_MISSING) {
      if (now.confirmed && !isTemporaryEmail(now.email)) {
        return err('The owner has already confirmed their own email, so it cannot be changed here.');
      }
      if (now.email === email) return ok({ email, changed: false });
      // Every link already sent to the old address stops working now.
      try {
        await randomizeIdentityPassword(previous);
      } catch {
        return err('Could not change the owner’s email just now. Nothing was changed — try again.');
      }
      const after = await getIdentitySnapshot(previous);
      if (after === null || (after !== IDENTITY_MISSING && after.confirmed && !isTemporaryEmail(after.email))) {
        return err('The owner’s sign-in changed while this was saving. Reload the page and check it.');
      }
    }
  }

  const made = await makePendingOwnerLogin(email);
  if (!made.ok) return made;
  const ownAuthId = made.data.authUserId;

  let swapped: boolean;
  try {
    swapped = await withRlsContext(db, async (tx) => {
      const moved = await tx.user.updateMany({
        where: { id: access.userId, authProviderId: previous },
        data: { authProviderId: ownAuthId },
      });
      return moved.count === 1;
    });
  } catch (error) {
    console.error('setOwnerEmail: could not record the new sign-in', {
      clientId,
      message: error instanceof Error ? error.message : String(error),
    });
    // A commit whose acknowledgement was lost would otherwise have its live
    // login deleted out from under it. If the database cannot even say,
    // nothing is deleted on a guess.
    let landed: string | null;
    try {
      landed = (await db.user.findUnique({ where: { id: access.userId }, select: { authProviderId: true } }))
        ?.authProviderId ?? null;
    } catch {
      return err('Could not confirm whether the email was changed. Reload the page before trying again.');
    }
    if (landed !== ownAuthId) {
      await deleteIdentity(ownAuthId);
      return err('Could not change the owner’s email. Nothing was changed — try again.');
    }
    swapped = true;
  }
  if (!swapped) {
    await deleteIdentity(ownAuthId);
    return err('This changed while you were looking at it. Reload the page and try again.');
  }
  // Nothing points at the old login any more; deleted, it can never be confirmed.
  if (previous) await deleteIdentity(previous);
  return ok({ email, changed: true });
}

/**
 * Where the owner's set-your-password link goes, for a request from Account
 * signed in with THIS business's temporary login, switched on. Writes
 * nothing: the address is the owner's own login, as Headway made it.
 */
export type PasswordLinkTarget =
  | { ok: true; email: string }
  | { ok: false; reason: 'NOT_TEMPORARY' | 'NO_OWN_LOGIN' | 'UNKNOWN' };

export async function passwordLinkTarget(
  db: PrismaClient,
  clientId: string,
  actorUserId: string,
  sessionAuthId: string,
): Promise<PasswordLinkTarget> {
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
    return { ok: false, reason: 'NOT_TEMPORARY' };
  }
  const own = access.user.authProviderId;
  if (!own || own === access.tempAuthId) return { ok: false, reason: 'NO_OWN_LOGIN' };
  const live = await getIdentitySnapshot(own);
  if (live === null) return { ok: false, reason: 'UNKNOWN' };
  if (live === IDENTITY_MISSING || isTemporaryEmail(live.email) || !EMAIL_SHAPE.test(live.email)) {
    return { ok: false, reason: 'NO_OWN_LOGIN' };
  }
  return { ok: true, email: live.email };
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
 * `linkSent` is whether a link to prove the address (a set-your-password or
 * confirmation email) has gone out to it.
 */
export type OwnLogin = { email: string | null; confirmed: boolean | null; linkSent: boolean };

/**
 * Null — no own login — also when the identity RepOS names no longer exists
 * in Supabase, and when it is still a Headway-made address (an owner who "set
 * up" before M52 but whose real email never arrived): neither is anything the
 * owner can sign in with as themselves, and an admin replaces either by
 * entering the owner's email.
 */
async function ownLoginOf(user: { authProviderId: string | null; email: string }): Promise<OwnLogin | null> {
  if (!user.authProviderId) return null;
  const live = await getIdentitySnapshot(user.authProviderId);
  if (live === IDENTITY_MISSING) return null;
  if (!live) {
    return { email: isTemporaryEmail(user.email) ? null : user.email, confirmed: null, linkSent: false };
  }
  if (isTemporaryEmail(live.email)) return null;
  return { email: live.email, confirmed: live.confirmed, linkSent: live.confirmationSent || live.recoverySent };
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
  /**
   * Generating temporary access needs the owner's email from the admin: the
   * owner has no login of their own yet. (Enabling it again never asks.)
   */
  needsOwnerEmail: boolean;
  /** What the admin's "Owner's email" field starts with, on a first generate only. */
  ownerEmailSuggestion: string | null;
  /**
   * The admin may add or correct the owner's email: there is temporary access,
   * and the owner has not confirmed a login of their own (an unknown answer
   * from Supabase is not "not confirmed").
   */
  canSetOwnerEmail: boolean;
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
    const ownLogin = await ownLoginOf(row.user);
    return {
      ownLogin,
      temporary: temporaryStatusOf(row),
      temporaryEmail: row.tempAuthId ? row.loginId : null,
      temporaryBlocked: temporaryAccessBlock(row.user),
      needsOwnerEmail: false,
      ownerEmailSuggestion: null,
      // No own login (none, gone from Supabase, or a Headway-made address) or
      // one nobody has confirmed: either is the admin's to (re)place.
      canSetOwnerEmail: ownLogin === null || ownLogin.confirmed === false,
    };
  }
  const [owner, client] = await Promise.all([
    db.membership.findFirst({
      where: { clientId, role: ROLE_OWNER, status: ACTIVE },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: OWNER_VIEW_SELECT(clientId) } },
    }),
    db.client.findUnique({ where: { id: clientId }, select: { ownerEmail: true } }),
  ]);
  const needsOwnerEmail = !owner?.user.authProviderId;
  // Only a suggestion, on a business nobody has signed in to yet: before the
  // first temporary login, only Headway can have typed it. The admin still
  // reads it and presses the button.
  const suggestion = ownerEmailSchema.safeParse(client?.ownerEmail ?? '');
  return {
    ownLogin: owner ? await ownLoginOf(owner.user) : null,
    temporary: 'NONE',
    temporaryEmail: null,
    temporaryBlocked: owner ? temporaryAccessBlock(owner.user) : null,
    needsOwnerEmail,
    ownerEmailSuggestion: needsOwnerEmail && !owner && suggestion.success ? suggestion.data : null,
    canSetOwnerEmail: false,
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
