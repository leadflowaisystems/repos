import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetDb } from './helpers/test-db';
import {
  disableTempAccess,
  generateTempAccess,
  getAdminAccessView,
  passwordLinkTarget,
  setOwnerEmail,
} from '@/lib/account-access/service';

/**
 * THE OWNER'S OWN LOGIN IS HEADWAY'S TO MAKE, ON THE ADDRESS THE ADMIN TYPED
 * (M39, two logins since M52, rewritten for M53).
 *
 * Up to M52 the owner's own login was made FROM the temporary login: the
 * "Set up your account" form asked whoever was signed in with the handover
 * sheet for an email AND a password. Whoever held the sheet first could make
 * the business theirs. That form, and the service it called, are gone.
 *
 * Now the ADMIN types the owner's email when generating temporary access.
 * Headway makes the owner's own Supabase login right then, on that address:
 * NOT confirmed, and with no password anybody knows, so nothing can sign in
 * with it. It starts working only when someone opens the link Supabase emails
 * to that inbox and chooses a password there. The temporary session can ask
 * for that link to be sent (`passwordLinkTarget` says where it goes), and
 * that is all it can do.
 *
 * Until the owner has proved the address, the admin can correct it
 * (`setOwnerEmail`): the login on the old address is never edited — a link
 * already sitting in that inbox would then confirm the corrected one — it is
 * scrambled, replaced by a new pending login on the new address, swapped in
 * with a compare-and-set, and deleted. A login somebody has confirmed is the
 * owner's own and is never touched.
 *
 * Service layer only: a real database (schema owner, no RLS — so
 * `provisionUser` takes its direct path), and the Supabase Auth admin API
 * replaced by an in-memory ledger of identities. The ledger behaves like the
 * real one where it matters: it refuses an address any identity already
 * holds, a deleted identity is "missing", and tests can make it slow to
 * answer, unreachable, or wrong.
 */

type Identity = { email: string; confirmed: boolean; confirmationSent: boolean; recoverySent: boolean };

/** The Auth admin API, as a ledger. None of these calls sends an email. */
const idp = vi.hoisted(() => ({
  identities: new Map<string, Identity>(),
  /** Everything Supabase was asked to change, in order. */
  log: [] as string[],
  /** Each createPendingOwnerIdentity call, exactly as made. */
  ownCalls: [] as unknown[][],
  tempCalls: [] as Array<{ email: string; password: string }>,
  passwordsSet: [] as Array<{ authUserId: string; password: string; email?: string }>,
  deleted: [] as string[],
  scrambled: [] as string[],
  tempN: 0,
  /** Supabase cannot be asked at all (a network error, a 5xx). */
  unreachable: false,
  /**
   * How createPendingOwnerIdentity answers. UNKNOWN_LANDED: the login was made
   * but the reply was lost. UNKNOWN_LOST: the request never arrived.
   */
  ownReply: 'OK' as 'OK' | 'NOT_CONFIGURED' | 'UNKNOWN_LANDED' | 'UNKNOWN_LOST' | 'REFUSED',
  tempFails: false,
  scrambleFails: false,
  /** Runs while Supabase is making the owner's login — somebody else acting meanwhile. */
  duringOwnCreate: null as null | (() => Promise<void>),
  /** Runs while Supabase is making the temporary login. */
  duringTempCreate: null as null | (() => Promise<void>),
  /** Runs as a scramble request reaches Supabase, before it lands — somebody acting just ahead of it. */
  duringScramble: null as null | ((authUserId: string) => void),
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  IDENTITY_MISSING: 'missing',
  createPendingOwnerIdentity: async (...args: unknown[]) => {
    const email = args[0] as string;
    const id = args[1] as string | undefined;
    idp.ownCalls.push(args);
    idp.log.push(`create-own:${id}`);
    if (idp.duringOwnCreate) await idp.duringOwnCreate();
    if (idp.ownReply === 'NOT_CONFIGURED') {
      return {
        ok: false,
        reason: 'NOT_CONFIGURED',
        message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to generate temporary credentials.',
      };
    }
    // Supabase refuses an address ANY identity holds, confirmed or not.
    if ([...idp.identities.values()].some((existing) => existing.email === email)) {
      return { ok: false, reason: 'EMAIL_TAKEN', message: 'A user with this email address has already been registered' };
    }
    if (idp.ownReply === 'UNKNOWN_LOST') return { ok: false, reason: 'UNKNOWN', message: 'fetch failed' };
    if (idp.ownReply === 'REFUSED') return { ok: false, reason: 'EMAIL_REFUSED', message: 'Unable to validate email address: invalid format' };
    const authUserId = id ?? `ffffffff-0000-4000-8000-${String(idp.ownCalls.length).padStart(12, '0')}`;
    idp.identities.set(authUserId, { email, confirmed: false, confirmationSent: false, recoverySent: false });
    if (idp.ownReply === 'UNKNOWN_LANDED') return { ok: false, reason: 'UNKNOWN', message: 'fetch failed' };
    return { ok: true, authUserId };
  },
  createTempIdentity: async (email: string, password: string) => {
    idp.tempCalls.push({ email, password });
    if (idp.duringTempCreate) await idp.duringTempCreate();
    if (idp.tempFails) throw new Error('Database error creating new user');
    idp.tempN += 1;
    const authUserId = `bbbbbbbb-0000-4000-8000-${String(idp.tempN).padStart(12, '0')}`;
    idp.identities.set(authUserId, { email, confirmed: true, confirmationSent: false, recoverySent: false });
    idp.log.push(`create-temp:${authUserId}`);
    return { authUserId };
  },
  setIdentityPassword: async (authUserId: string, password: string, options: { email?: string } = {}) => {
    idp.passwordsSet.push({ authUserId, password, ...(options.email ? { email: options.email } : {}) });
    idp.log.push(`set-password:${authUserId}`);
    const identity = idp.identities.get(authUserId);
    if (!identity) return { ok: false, reason: 'NOT_FOUND', message: 'User not found' };
    if (options.email) Object.assign(identity, { email: options.email, confirmed: true });
    return { ok: true };
  },
  randomizeIdentityPassword: async (authUserId: string, email?: string) => {
    idp.log.push(`scramble:${authUserId}`);
    idp.duringScramble?.(authUserId);
    if (idp.scrambleFails) throw new Error('Supabase is down');
    idp.scrambled.push(authUserId);
    const identity = idp.identities.get(authUserId);
    // A new password voids every link already sent.
    if (identity) Object.assign(identity, { confirmationSent: false, recoverySent: false }, email ? { email } : {});
  },
  deleteIdentity: async (authUserId: string) => {
    idp.log.push(`delete:${authUserId}`);
    idp.deleted.push(authUserId);
    idp.identities.delete(authUserId);
  },
  getIdentitySnapshot: async (authUserId: string) => {
    if (idp.unreachable) return null;
    const identity = idp.identities.get(authUserId);
    return identity ? { ...identity, lastSignInAt: null } : 'missing';
  },
}));

const ADMIN = 'admin1';
const OWNER = 'owner1';
const OTHER = 'other1';

// Fake Supabase ids, UUID-shaped like the real ones.
const ADMIN_AUTH = '11111111-1111-4111-8111-111111111111';
const OTHER_AUTH = '22222222-2222-4222-8222-222222222222';
const OWN_AUTH = '33333333-3333-4333-8333-333333333333';
const TEMP_AUTH = '44444444-4444-4444-8444-444444444444';
const SIGNED_UP_AUTH = '55555555-5555-4555-8555-555555555555';
const OLD_TEMP_OWN_AUTH = '66666666-6666-4666-8666-666666666666';

const TEMP = 'xyz23456@access.headway.local';
const TEMP_EMAIL = /^[a-z0-9]{8}@access\.headway\.local$/;
const TEMP_PASSWORD = /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function identity(email: string, over: Partial<Identity> = {}): Identity {
  return { email, confirmed: false, confirmationSent: false, recoverySent: false, ...over };
}

function resetLedger() {
  idp.identities.clear();
  idp.log.length = 0;
  idp.ownCalls.length = 0;
  idp.tempCalls.length = 0;
  idp.passwordsSet.length = 0;
  idp.deleted.length = 0;
  idp.scrambled.length = 0;
  idp.tempN = 0;
  idp.unreachable = false;
  idp.ownReply = 'OK';
  idp.tempFails = false;
  idp.scrambleFails = false;
  idp.duringOwnCreate = null;
  idp.duringTempCreate = null;
  idp.duringScramble = null;
}

/** The id generateTempAccess / setOwnerEmail chose for the owner's login, call by call. */
function ownIdOfCall(n: number): string {
  return idp.ownCalls[n]![1] as string;
}

describe('the owner’s own login, made by Headway (M53)', () => {
  let db: PrismaClient;
  let clientId: string;
  // How many transactions `failingNextTransaction` has actually failed.
  let failedTransactions = 0;

  beforeAll(() => {
    db = createTestDb('m39-account-setup-credentials');
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);
    resetLedger();
    failedTransactions = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await db.user.createMany({
      data: [
        { id: ADMIN, email: 'admin@headway.test', authProviderId: ADMIN_AUTH, isPlatformAdmin: true },
        { id: OTHER, email: 'already-taken@example.com', authProviderId: OTHER_AUTH },
      ],
    });
    const client = await db.client.create({
      data: { businessName: 'Alpha Salon', vertical: 'salon', status: 'ACTIVE', ownerName: 'From the admin' },
      select: { id: true },
    });
    clientId = client.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function counts() {
    return {
      users: await db.user.count(),
      memberships: await db.membership.count(),
      access: await db.accountAccess.count(),
    };
  }

  const NOTHING_MADE = { users: 2, memberships: 0, access: 0 };

  /** Every row anything here could write, for "wrote nothing" and "stored nowhere". */
  async function everyRow(): Promise<string> {
    return JSON.stringify(
      await Promise.all([
        db.user.findMany({ orderBy: { id: 'asc' } }),
        db.membership.findMany({ orderBy: { id: 'asc' } }),
        db.accountAccess.findMany({ orderBy: { id: 'asc' } }),
        db.client.findMany({ orderBy: { id: 'asc' } }),
        db.invitation.findMany({ orderBy: { id: 'asc' } }),
      ]),
    );
  }

  /** An owner (on this business) who exists before any temporary access. */
  async function existingOwner(fields: { email: string; authProviderId: string | null; isPlatformAdmin?: boolean }) {
    await db.user.create({ data: { id: OWNER, ...fields } });
    await db.membership.create({ data: { userId: OWNER, clientId, role: 'BUSINESS_OWNER', status: 'ACTIVE' } });
  }

  /**
   * A business already handed over: the owner User (under the temporary
   * address), its Membership, and the temporary login switched on.
   */
  async function handedOver(opts: { own?: string | null; status?: string } = {}) {
    const own = opts.own === undefined ? OWN_AUTH : opts.own;
    await db.user.create({ data: { id: OWNER, email: TEMP, authProviderId: own } });
    await db.membership.create({ data: { userId: OWNER, clientId, role: 'BUSINESS_OWNER', status: 'ACTIVE' } });
    await db.accountAccess.create({
      data: {
        clientId,
        userId: OWNER,
        loginId: TEMP,
        tempAuthId: TEMP_AUTH,
        status: opts.status ?? 'TEMPORARY_ACTIVE',
        createdByUserId: ADMIN,
      },
    });
    idp.identities.set(TEMP_AUTH, identity(TEMP, { confirmed: true }));
  }

  /**
   * The same database, except that its next transaction answers with an
   * error: either the commit happened and only the acknowledgement was lost,
   * or it never committed at all. A wrapper rather than a spy on the client
   * itself, which would leave the shared client broken for later tests.
   */
  function failingNextTransaction(opts: { committed: boolean }): PrismaClient {
    let armed = true;
    return new Proxy(db, {
      get(target, prop) {
        const value: unknown = Reflect.get(target, prop);
        if (prop === '$transaction' && armed) {
          armed = false;
          const real = (value as (fn: unknown) => Promise<unknown>).bind(target);
          return async (fn: unknown) => {
            if (opts.committed) await real(fn);
            failedTransactions += 1;
            throw new Error('Connection terminated unexpectedly');
          };
        }
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
  }

  // -------------------------------------------------------------------------
  // Generating: a business with no owner yet
  // -------------------------------------------------------------------------

  describe('generateTempAccess, for a business with no owner yet', () => {
    it('asks the admin for the owner’s email first, and makes nothing at all without it', async () => {
      for (const input of [undefined, {}, { ownerEmail: '' }, { ownerEmail: '   ' }]) {
        const result = await generateTempAccess(db, clientId, ADMIN, input);
        expect(result.ok, JSON.stringify(input)).toBe(false);
        if (!result.ok) expect(result.errors.ownerEmail).toMatch(/Enter the owner.s email address/);
      }
      expect(idp.log).toEqual([]);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('refuses a badly formed address, a too-long one, and a temporary one, before Supabase is asked', async () => {
      const cases: Array<[string, RegExp]> = [
        ['not-an-email', /valid email/],
        ['a@b', /valid email/],
        ['two words@example.com', /valid email/],
        [`${'x'.repeat(250)}@example.com`, /too long/],
        ['abc23456@access.headway.local', /not a temporary one/],
        ['  X@ACCESS.HEADWAY.LOCAL ', /not a temporary one/],
      ];
      for (const [ownerEmail, message] of cases) {
        const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail });
        expect(result.ok, ownerEmail).toBe(false);
        if (!result.ok) expect(result.errors.ownerEmail, ownerEmail).toMatch(message);
      }
      expect(idp.log).toEqual([]);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('makes the owner’s login on the typed address, normalised, under an id Headway chose — and with no password', async () => {
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: '  Owner@Example.COM ' });
      expect(result.ok).toBe(true);

      expect(idp.ownCalls).toHaveLength(1);
      const [email, id, ...rest] = idp.ownCalls[0]!;
      expect(email).toBe('owner@example.com');
      expect(id).toMatch(UUID);
      // Nothing else goes to Supabase: no password, so nobody knows one.
      expect(rest).toEqual([]);

      // The owner's own login first, then the temporary one.
      expect(idp.log).toEqual([`create-own:${id}`, 'create-temp:bbbbbbbb-0000-4000-8000-000000000001']);
    });

    it('records ONE owner User bound to that own login, under the temporary address — the real one is written only once proved', async () => {
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.email).toMatch(TEMP_EMAIL);
      expect(result.data.password).toMatch(TEMP_PASSWORD);
      expect(idp.tempCalls).toEqual([{ email: result.data.email, password: result.data.password }]);

      const ownId = ownIdOfCall(0);
      const tempId = 'bbbbbbbb-0000-4000-8000-000000000001';
      expect(ownId).not.toBe(tempId);

      const owners = await db.user.findMany({ where: { id: { notIn: [ADMIN, OTHER] } } });
      expect(owners).toHaveLength(1);
      const owner = owners[0]!;
      expect(owner.authProviderId).toBe(ownId);
      expect(owner.email).toBe(result.data.email);
      expect(owner.isPlatformAdmin).toBe(false);
      // An address nobody has proved is not what RepOS matches people by (a
      // team invitation is accepted on it).
      expect(await db.user.count({ where: { email: { equals: 'owner@example.com', mode: 'insensitive' } } })).toBe(0);

      const memberships = await db.membership.findMany({ where: { clientId } });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ userId: owner.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' });

      const access = await db.accountAccess.findUniqueOrThrow({ where: { clientId } });
      expect(access).toMatchObject({
        userId: owner.id,
        loginId: result.data.email,
        tempAuthId: tempId,
        status: 'TEMPORARY_ACTIVE',
        createdByUserId: ADMIN,
        setupCompletedAt: null,
        disabledAt: null,
      });
    });

    it('shows the temporary password once and stores it nowhere', async () => {
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(await everyRow()).not.toContain(result.data.password);
    });
  });

  // -------------------------------------------------------------------------
  // Generating: when the address, or Supabase, says no
  // -------------------------------------------------------------------------

  describe('generateTempAccess, when the address is somebody’s already or Supabase misbehaves', () => {
    it('refuses an address another RepOS user already has, whatever its case, before Supabase is asked', async () => {
      await db.user.create({ data: { id: 'upper1', email: 'Mixed.Case@Example.com', authProviderId: null } });
      for (const ownerEmail of ['Already-Taken@Example.com', 'mixed.case@example.com', 'admin@headway.test']) {
        const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail });
        expect(result.ok, ownerEmail).toBe(false);
        if (!result.ok) expect(result.errors.ownerEmail, ownerEmail).toMatch(/already has a Headway sign-in/);
      }
      expect(idp.log).toEqual([]);
      expect(await counts()).toEqual({ ...NOTHING_MADE, users: 3 });
    });

    it('refuses an address Supabase already holds, and never makes the temporary login', async () => {
      // A login on that address that RepOS has no User for (a signup nobody finished).
      idp.identities.set(SIGNED_UP_AUTH, identity('held@example.com'));

      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'Held@Example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.ownerEmail).toMatch(/already has a Headway sign-in/);
      expect(idp.tempCalls).toEqual([]);
      expect(idp.deleted).toEqual([]);
      expect([...idp.identities.keys()]).toEqual([SIGNED_UP_AUTH]);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('points the admin at the email field when Supabase refuses the address itself, and makes nothing', async () => {
      idp.ownReply = 'REFUSED';
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.ownerEmail).toMatch(/Supabase does not accept this address/);
      expect(idp.tempCalls).toEqual([]);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('refuses, before Supabase is asked, the shapes Supabase would refuse', async () => {
      for (const bad of ['owner@gmail.com.', 'owner@gmail..com', 'o,w@x.com', '<o@x.com>', 'a..b@x.com', '.a@x.com']) {
        const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: bad });
        expect(result.ok, bad).toBe(false);
        if (!result.ok) expect(result.errors.ownerEmail, bad).toBe('Enter a valid email address.');
      }
      expect(idp.ownCalls).toEqual([]);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('says so plainly when Supabase is not configured, and makes nothing', async () => {
      idp.ownReply = 'NOT_CONFIGURED';
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
        expect(result.errors).toEqual({});
      }
      expect(idp.tempCalls).toEqual([]);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('uses the login after all when the reply was lost but Supabase made it under the id Headway chose', async () => {
      idp.ownReply = 'UNKNOWN_LANDED';
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(true);

      const ownId = ownIdOfCall(0);
      expect(idp.identities.get(ownId)?.email).toBe('owner@example.com');
      expect(idp.deleted).toEqual([]);
      const access = await db.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
      expect(access.user.authProviderId).toBe(ownId);
    });

    it('refuses, leaving nothing behind, when the reply was lost and no login was made', async () => {
      idp.ownReply = 'UNKNOWN_LOST';
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Could not create the owner.s sign-in/);
      expect(idp.tempCalls).toEqual([]);
      expect(idp.identities.size).toBe(0);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('refuses, and deletes nothing on a guess, when Supabase cannot even say whether it made the login', async () => {
      idp.ownReply = 'UNKNOWN_LANDED';
      idp.unreachable = true;
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(false);
      expect(idp.tempCalls).toEqual([]);
      expect(idp.deleted).toEqual([]);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('deletes the owner’s new login again when the temporary login cannot be made', async () => {
      idp.tempFails = true;
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Could not create the temporary login/);
      expect(idp.deleted).toEqual([ownIdOfCall(0)]);
      expect(idp.identities.size).toBe(0);
      expect(await counts()).toEqual(NOTHING_MADE);
    });

    it('leaves nothing half-made when recording fails after both logins exist: both identities and the new User go', async () => {
      // Another admin, in another tab, finished generating for this business
      // (on another address) while this one was waiting on Supabase. Its row
      // is there first, so this transaction's write is refused.
      const WINNER_LOGIN = 'wnnr2345@access.headway.local';
      const WINNER_OWN = '77777777-7777-4777-8777-777777777777';
      const WINNER_TEMP = '88888888-8888-4888-8888-888888888888';
      idp.duringTempCreate = async () => {
        idp.duringTempCreate = null;
        idp.identities.set(WINNER_OWN, identity('first-tab@example.com'));
        idp.identities.set(WINNER_TEMP, identity(WINNER_LOGIN, { confirmed: true }));
        await db.user.create({ data: { id: 'winner1', email: WINNER_LOGIN, authProviderId: WINNER_OWN } });
        await db.membership.create({ data: { userId: 'winner1', clientId, role: 'BUSINESS_OWNER', status: 'ACTIVE' } });
        await db.accountAccess.create({
          data: { clientId, userId: 'winner1', loginId: WINNER_LOGIN, tempAuthId: WINNER_TEMP, createdByUserId: ADMIN },
        });
      };

      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Could not finish setting up temporary access/);

      const ownId = ownIdOfCall(0);
      const tempId = 'bbbbbbbb-0000-4000-8000-000000000001';
      expect(idp.deleted.sort()).toEqual([ownId, tempId].sort());
      // No half-made owner: the User this call provisioned is gone, and its
      // Membership rolled back with the row.
      expect(await db.user.count({ where: { authProviderId: ownId } })).toBe(0);
      expect(await db.user.count({ where: { id: { notIn: [ADMIN, OTHER, 'winner1'] } } })).toBe(0);
      expect(await db.membership.findMany({ where: { clientId }, select: { userId: true } })).toEqual([
        { userId: 'winner1' },
      ]);
      // The other admin's work is untouched.
      expect((await db.accountAccess.findUniqueOrThrow({ where: { clientId } })).tempAuthId).toBe(WINNER_TEMP);
      expect(idp.identities.has(WINNER_OWN)).toBe(true);
      expect(idp.identities.has(WINNER_TEMP)).toBe(true);
    });

    it('keeps everything when the commit landed but its acknowledgement was lost', async () => {
      const flaky = failingNextTransaction({ committed: true });
      const result = await generateTempAccess(flaky, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(failedTransactions).toBe(1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(idp.deleted).toEqual([]);
      const access = await db.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
      expect(access.loginId).toBe(result.data.email);
      expect(access.user.authProviderId).toBe(ownIdOfCall(0));
    });
  });

  // -------------------------------------------------------------------------
  // Generating: a business that already has an owner
  // -------------------------------------------------------------------------

  describe('generateTempAccess, for a business that already has an owner', () => {
    it('an owner who already signs in as themselves needs no email and gets no new login; nothing is left to set up', async () => {
      await existingOwner({ email: 'priya@example.com', authProviderId: OWN_AUTH });
      idp.identities.set(OWN_AUTH, identity('priya@example.com', { confirmed: true }));

      const result = await generateTempAccess(db, clientId, ADMIN);
      expect(result.ok).toBe(true);
      expect(idp.ownCalls).toEqual([]);
      expect(idp.log).toEqual(['create-temp:bbbbbbbb-0000-4000-8000-000000000001']);

      const access = await db.accountAccess.findUniqueOrThrow({ where: { clientId } });
      expect(access.userId).toBe(OWNER);
      expect(access.tempAuthId).toBe('bbbbbbbb-0000-4000-8000-000000000001');
      expect(access.setupCompletedAt).not.toBeNull();
      const owner = await db.user.findUniqueOrThrow({ where: { id: OWNER } });
      expect(owner.authProviderId).toBe(OWN_AUTH);
      expect(owner.email).toBe('priya@example.com');
      expect(await db.user.count()).toBe(3);
    });

    it('an address typed for an owner who already has a login is ignored, not made', async () => {
      await existingOwner({ email: 'priya@example.com', authProviderId: OWN_AUTH });
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'someone-else@example.com' });
      expect(result.ok).toBe(true);
      expect(idp.ownCalls).toEqual([]);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(OWN_AUTH);
    });

    it('an owner with no login of their own (an invitation never accepted) needs the email, and is bound to the new login by compare-and-set', async () => {
      await existingOwner({ email: 'invited@example.com', authProviderId: null });

      const missing = await generateTempAccess(db, clientId, ADMIN);
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.errors.ownerEmail).toMatch(/Enter the owner.s email address/);
      expect(idp.log).toEqual([]);
      expect(await db.accountAccess.count()).toBe(0);

      // Their own address is not "somebody else's".
      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'Invited@Example.com' });
      expect(result.ok).toBe(true);
      expect(idp.ownCalls[0]![0]).toBe('invited@example.com');

      const owner = await db.user.findUniqueOrThrow({ where: { id: OWNER } });
      expect(owner.authProviderId).toBe(ownIdOfCall(0));
      expect(owner.email).toBe('invited@example.com');
      expect(await db.user.count()).toBe(3);
      expect(await db.membership.count({ where: { clientId } })).toBe(1);
      const access = await db.accountAccess.findUniqueOrThrow({ where: { clientId } });
      expect(access.userId).toBe(OWNER);
      expect(access.setupCompletedAt).toBeNull();
    });

    it('loses the compare-and-set to an owner who got a login of their own meanwhile: both new logins go, theirs stays', async () => {
      await existingOwner({ email: 'invited@example.com', authProviderId: null });
      // The owner accepts their invitation while Supabase is making the temporary login.
      idp.duringTempCreate = async () => {
        await db.user.update({ where: { id: OWNER }, data: { authProviderId: SIGNED_UP_AUTH } });
      };

      const result = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'invited@example.com' });
      expect(result.ok).toBe(false);
      expect(idp.deleted.sort()).toEqual([ownIdOfCall(0), 'bbbbbbbb-0000-4000-8000-000000000001'].sort());
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(SIGNED_UP_AUTH);
      expect(await db.accountAccess.count()).toBe(0);
      expect(await db.user.count()).toBe(3);
    });

    it('refuses an owner who is Headway staff, or in another business, before any login is made', async () => {
      await existingOwner({ email: 'staff@headway.test', authProviderId: null, isPlatformAdmin: true });
      const staff = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'staff-owner@example.com' });
      expect(staff.ok).toBe(false);
      if (!staff.ok) expect(staff.message).toMatch(/Headway staff/);

      await db.user.update({ where: { id: OWNER }, data: { isPlatformAdmin: false } });
      const elsewhere = await db.client.create({
        data: { businessName: 'Somebody Else', vertical: 'salon', status: 'ACTIVE' },
        select: { id: true },
      });
      await db.membership.create({ data: { userId: OWNER, clientId: elsewhere.id, role: 'BUSINESS_STAFF' } });
      const other = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'staff-owner@example.com' });
      expect(other.ok).toBe(false);
      if (!other.ok) expect(other.message).toMatch(/another business/);

      expect(idp.log).toEqual([]);
      expect(await db.accountAccess.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Switching it on again
  // -------------------------------------------------------------------------

  describe('generateTempAccess, switching temporary access on again', () => {
    async function generatedThenDisabled() {
      const first = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      if (!first.ok) throw new Error(first.message);
      const disabled = await disableTempAccess(db, clientId, ADMIN);
      if (!disabled.ok) throw new Error(disabled.message);
      const ownId = ownIdOfCall(0);
      const tempId = (await db.accountAccess.findUniqueOrThrow({ where: { clientId } })).tempAuthId!;
      // Disabling scrambled the temporary login, never the owner's own.
      expect(idp.scrambled).toEqual([tempId]);
      idp.log.length = 0;
      return { first: first.data, ownId, tempId };
    }

    it('gives the same temporary email a new password, never asks for an email, and never touches the owner’s login', async () => {
      const { first, ownId, tempId } = await generatedThenDisabled();

      const again = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'somebody-else@example.com' });
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.data.email).toBe(first.email);
      expect(again.data.password).not.toBe(first.password);

      expect(idp.log).toEqual([`set-password:${tempId}`]);
      expect(idp.passwordsSet).toEqual([{ authUserId: tempId, password: again.data.password, email: first.email }]);
      expect(idp.ownCalls).toHaveLength(1);
      expect(idp.identities.get(ownId)).toEqual(identity('owner@example.com'));

      const access = await db.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
      expect(access.status).toBe('TEMPORARY_ACTIVE');
      expect(access.user.authProviderId).toBe(ownId);
      expect(await db.user.count()).toBe(3);
    });

    it('mints a fresh temporary login when the old one is gone from Supabase — still without touching the owner’s', async () => {
      const { first, ownId, tempId } = await generatedThenDisabled();
      idp.identities.delete(tempId);

      const again = await generateTempAccess(db, clientId, ADMIN);
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.data.email).not.toBe(first.email);
      expect(idp.log).toEqual([`set-password:${tempId}`, 'create-temp:bbbbbbbb-0000-4000-8000-000000000002']);
      expect(idp.ownCalls).toHaveLength(1);

      const access = await db.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
      expect(access.tempAuthId).toBe('bbbbbbbb-0000-4000-8000-000000000002');
      expect(access.loginId).toBe(again.data.email);
      expect(access.user.authProviderId).toBe(ownId);
    });
  });

  // -------------------------------------------------------------------------
  // Correcting the owner's email
  // -------------------------------------------------------------------------

  describe('setOwnerEmail', () => {
    it('refuses a business with no temporary access yet: the email goes in when generating', async () => {
      await existingOwner({ email: 'invited@example.com', authProviderId: null });
      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Generate temporary access first/);
      expect(idp.log).toEqual([]);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBeNull();
    });

    it('refuses a bad address, or one somebody else has, before Supabase is asked', async () => {
      await handedOver({ own: null });
      for (const [raw, message] of [
        ['', /Enter the owner.s email address/],
        ['nope', /valid email/],
        ['abc23456@access.headway.local', /not a temporary one/],
        ['ALREADY-TAKEN@example.com', /already has a Headway sign-in/],
      ] as Array<[string, RegExp]>) {
        const result = await setOwnerEmail(db, clientId, raw);
        expect(result.ok, raw).toBe(false);
        if (!result.ok) expect(result.errors.ownerEmail, raw).toMatch(message);
      }
      expect(idp.log).toEqual([]);
    });

    it('a business handed over before M53 (no own login at all): makes one and binds it', async () => {
      await handedOver({ own: null });
      const before = (await db.user.findUniqueOrThrow({ where: { id: OWNER } })).email;

      const result = await setOwnerEmail(db, clientId, ' Owner@Example.com ');
      expect(result).toEqual({ ok: true, data: { email: 'owner@example.com', changed: true } });

      const ownId = ownIdOfCall(0);
      expect(ownId).toMatch(UUID);
      expect(idp.ownCalls[0]).toEqual(['owner@example.com', ownId]);
      expect(idp.log).toEqual([`create-own:${ownId}`]);
      const owner = await db.user.findUniqueOrThrow({ where: { id: OWNER } });
      expect(owner.authProviderId).toBe(ownId);
      expect(owner.email).toBe(before);
    });

    it('replaces an unconfirmed login on another address: old scrambled FIRST, new made, swapped, old deleted', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com', { recoverySent: true }));

      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result).toEqual({ ok: true, data: { email: 'owner@example.com', changed: true } });

      const ownId = ownIdOfCall(0);
      // Scrambled before anything else: a link already in the old inbox stops
      // working before the new login exists.
      expect(idp.log).toEqual([`scramble:${OWN_AUTH}`, `create-own:${ownId}`, `delete:${OWN_AUTH}`]);
      expect(idp.identities.has(OWN_AUTH)).toBe(false);
      expect(idp.identities.get(ownId)).toEqual(identity('owner@example.com'));

      const owner = await db.user.findUniqueOrThrow({ where: { id: OWNER } });
      expect(owner.authProviderId).toBe(ownId);
      expect(owner.email).toBe(TEMP);
      // The temporary login is a different identity and is left alone.
      expect(idp.identities.has(TEMP_AUTH)).toBe(true);
      expect((await db.accountAccess.findUniqueOrThrow({ where: { clientId } })).tempAuthId).toBe(TEMP_AUTH);
    });

    it('the same address again (any case) changes nothing and makes nothing', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('owner@example.com', { recoverySent: true }));
      const rows = await everyRow();

      const result = await setOwnerEmail(db, clientId, 'OWNER@example.com');
      expect(result).toEqual({ ok: true, data: { email: 'owner@example.com', changed: false } });
      expect(idp.log).toEqual([]);
      // A link already sent there still works.
      expect(idp.identities.get(OWN_AUTH)?.recoverySent).toBe(true);
      expect(await everyRow()).toBe(rows);
    });

    it('never replaces a login the owner has confirmed: it is theirs', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('owner@example.com', { confirmed: true }));
      const rows = await everyRow();

      const result = await setOwnerEmail(db, clientId, 'new@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/already confirmed their own email/);
      expect(idp.log).toEqual([]);
      expect(await everyRow()).toBe(rows);
    });

    it('changes nothing when Supabase cannot be asked whether the owner confirmed', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com'));
      idp.unreachable = true;
      const rows = await everyRow();

      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Could not check the owner.s sign-in just now. Nothing was changed/);
      expect(idp.log).toEqual([]);
      expect(await everyRow()).toBe(rows);
    });

    it('changes nothing when the old login cannot be scrambled', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com'));
      idp.scrambleFails = true;
      const rows = await everyRow();

      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Nothing was changed/);
      expect(idp.ownCalls).toEqual([]);
      expect(await everyRow()).toBe(rows);
    });

    it('stops, making nothing, when the owner confirmed the old address between the first look and the scramble', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com'));
      idp.duringScramble = (authUserId) => {
        if (authUserId === OWN_AUTH) idp.identities.get(OWN_AUTH)!.confirmed = true;
      };

      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/changed while this was saving/);
      expect(idp.ownCalls).toEqual([]);
      expect(idp.deleted).toEqual([]);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(OWN_AUTH);
    });

    it('replaces a Headway-made (temporary-address) login an owner was left with before M52', async () => {
      await handedOver({ own: OLD_TEMP_OWN_AUTH });
      idp.identities.set(OLD_TEMP_OWN_AUTH, identity('oldtemp2@access.headway.local', { confirmed: true }));

      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result).toEqual({ ok: true, data: { email: 'owner@example.com', changed: true } });
      const ownId = ownIdOfCall(0);
      expect(idp.log).toEqual([`scramble:${OLD_TEMP_OWN_AUTH}`, `create-own:${ownId}`, `delete:${OLD_TEMP_OWN_AUTH}`]);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(ownId);
    });

    it('replaces a login that is gone from Supabase, with nothing to scramble', async () => {
      await handedOver();

      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result).toEqual({ ok: true, data: { email: 'owner@example.com', changed: true } });
      expect(idp.scrambled).toEqual([]);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(ownIdOfCall(0));
    });

    it('refuses a temporary login that is somehow also the owner’s own: that is for support', async () => {
      await handedOver({ own: TEMP_AUTH });
      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/support/);
      expect(idp.log).toEqual([]);
    });

    it('refuses an address Supabase already holds, and keeps the old login bound', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com'));
      idp.identities.set(SIGNED_UP_AUTH, identity('held@example.com'));

      const result = await setOwnerEmail(db, clientId, 'held@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.ownerEmail).toMatch(/already has a Headway sign-in/);
      expect(idp.deleted).toEqual([]);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(OWN_AUTH);
    });

    it('loses the compare-and-set to a change made meanwhile: the new login goes, the one bound now stays', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com'));
      // Another admin's correction lands while Supabase is making this one.
      idp.duringOwnCreate = async () => {
        idp.duringOwnCreate = null;
        await db.user.update({ where: { id: OWNER }, data: { authProviderId: SIGNED_UP_AUTH } });
      };

      const result = await setOwnerEmail(db, clientId, 'owner@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/changed while you were looking at it/);

      const newId = ownIdOfCall(0);
      expect(idp.deleted).toEqual([newId]);
      expect(idp.identities.has(newId)).toBe(false);
      // The previous login is not deleted on a lost race: it may be what the row still names.
      expect(idp.identities.has(OWN_AUTH)).toBe(true);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(SIGNED_UP_AUTH);
    });

    it('keeps the swap when the commit landed but its acknowledgement was lost', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com'));
      const flaky = failingNextTransaction({ committed: true });

      const result = await setOwnerEmail(flaky, clientId, 'owner@example.com');
      expect(failedTransactions).toBe(1);
      expect(result).toEqual({ ok: true, data: { email: 'owner@example.com', changed: true } });
      const newId = ownIdOfCall(0);
      expect(idp.deleted).toEqual([OWN_AUTH]);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(newId);
    });

    it('deletes the new login, and keeps the old one bound, when the swap never committed', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('typo@exmaple.com'));
      const flaky = failingNextTransaction({ committed: false });

      const result = await setOwnerEmail(flaky, clientId, 'owner@example.com');
      expect(failedTransactions).toBe(1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Nothing was changed/);
      expect(idp.deleted).toEqual([ownIdOfCall(0)]);
      expect(idp.identities.has(OWN_AUTH)).toBe(true);
      expect((await db.user.findUniqueOrThrow({ where: { id: OWNER } })).authProviderId).toBe(OWN_AUTH);
    });
  });

  // -------------------------------------------------------------------------
  // Where the set-your-password link goes
  // -------------------------------------------------------------------------

  describe('passwordLinkTarget', () => {
    it('for this business’s temporary login, switched on: the own login’s address as Supabase has it now', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('live@example.com'));
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: true, email: 'live@example.com' });
    });

    it('NOT_TEMPORARY for any other session, any other person, another business, or access switched off', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('owner@example.com'));
      const other = await db.client.create({
        data: { businessName: 'Somebody Else', vertical: 'salon', status: 'ACTIVE' },
        select: { id: true },
      });

      for (const [label, args] of [
        ['the owner’s own login', [clientId, OWNER, OWN_AUTH]],
        ['some other session', [clientId, OWNER, OTHER_AUTH]],
        ['an empty session', [clientId, OWNER, '']],
        ['another person', [clientId, OTHER, TEMP_AUTH]],
        ['another business', [other.id, OWNER, TEMP_AUTH]],
      ] as Array<[string, [string, string, string]]>) {
        expect(await passwordLinkTarget(db, ...args), label).toEqual({ ok: false, reason: 'NOT_TEMPORARY' });
      }

      await db.accountAccess.update({ where: { clientId }, data: { status: 'DISABLED', disabledAt: new Date() } });
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: false, reason: 'NOT_TEMPORARY' });
    });

    it('NO_OWN_LOGIN when there is none, it is gone from Supabase, it is the temporary login, or it is on a Headway-made address', async () => {
      await handedOver({ own: null });
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: false, reason: 'NO_OWN_LOGIN' });

      await db.user.update({ where: { id: OWNER }, data: { authProviderId: OWN_AUTH } });
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: false, reason: 'NO_OWN_LOGIN' });

      idp.identities.set(OWN_AUTH, identity('oldtemp2@access.headway.local', { confirmed: true }));
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: false, reason: 'NO_OWN_LOGIN' });

      idp.identities.set(OWN_AUTH, identity(''));
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: false, reason: 'NO_OWN_LOGIN' });

      await db.user.update({ where: { id: OWNER }, data: { authProviderId: TEMP_AUTH } });
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: false, reason: 'NO_OWN_LOGIN' });
    });

    it('UNKNOWN when Supabase cannot be asked', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('owner@example.com'));
      idp.unreachable = true;
      expect(await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH)).toEqual({ ok: false, reason: 'UNKNOWN' });
    });

    it('writes nothing, whatever it answers', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('owner@example.com'));
      const rows = await everyRow();

      await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH);
      await passwordLinkTarget(db, clientId, OTHER, TEMP_AUTH);
      idp.unreachable = true;
      await passwordLinkTarget(db, clientId, OWNER, TEMP_AUTH);

      expect(await everyRow()).toBe(rows);
      expect(idp.log).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // What the admin panel is told
  // -------------------------------------------------------------------------

  describe('getAdminAccessView', () => {
    it('a business with no owner: the email is needed, suggested from Client.ownerEmail when that is a real address', async () => {
      await db.client.update({ where: { id: clientId }, data: { ownerEmail: '  Owner@Example.COM ' } });
      expect(await getAdminAccessView(db, clientId)).toMatchObject({
        ownLogin: null,
        temporary: 'NONE',
        needsOwnerEmail: true,
        ownerEmailSuggestion: 'owner@example.com',
        canSetOwnerEmail: false,
      });

      for (const ownerEmail of [null, '', 'not-an-email', 'abc23456@access.headway.local']) {
        await db.client.update({ where: { id: clientId }, data: { ownerEmail } });
        const view = await getAdminAccessView(db, clientId);
        expect(view.needsOwnerEmail, String(ownerEmail)).toBe(true);
        expect(view.ownerEmailSuggestion, String(ownerEmail)).toBeNull();
      }
    });

    it('an owner already there: no suggestion; the email is needed only when they have no login of their own', async () => {
      await db.client.update({ where: { id: clientId }, data: { ownerEmail: 'owner@example.com' } });
      await existingOwner({ email: 'invited@example.com', authProviderId: null });
      expect(await getAdminAccessView(db, clientId)).toMatchObject({
        needsOwnerEmail: true,
        ownerEmailSuggestion: null,
        canSetOwnerEmail: false,
      });

      await db.user.update({ where: { id: OWNER }, data: { authProviderId: OWN_AUTH } });
      idp.identities.set(OWN_AUTH, identity('invited@example.com', { confirmed: true }));
      expect(await getAdminAccessView(db, clientId)).toMatchObject({
        ownLogin: { email: 'invited@example.com', confirmed: true, linkSent: false },
        needsOwnerEmail: false,
        ownerEmailSuggestion: null,
        canSetOwnerEmail: false,
      });
    });

    it('right after generating: the pending own login, correctable, never asked for again', async () => {
      await db.client.update({ where: { id: clientId }, data: { ownerEmail: 'owner@example.com' } });
      const generated = await generateTempAccess(db, clientId, ADMIN, { ownerEmail: 'owner@example.com' });
      expect(generated.ok).toBe(true);
      if (!generated.ok) return;

      expect(await getAdminAccessView(db, clientId)).toEqual({
        ownLogin: { email: 'owner@example.com', confirmed: false, linkSent: false },
        temporary: 'ACTIVE',
        temporaryEmail: generated.data.email,
        temporaryBlocked: null,
        needsOwnerEmail: false,
        ownerEmailSuggestion: null,
        canSetOwnerEmail: true,
      });
    });

    it('linkSent once either kind of link has gone out to the address', async () => {
      await handedOver();
      idp.identities.set(OWN_AUTH, identity('owner@example.com', { recoverySent: true }));
      expect((await getAdminAccessView(db, clientId)).ownLogin?.linkSent).toBe(true);
      idp.identities.set(OWN_AUTH, identity('owner@example.com', { confirmationSent: true }));
      expect((await getAdminAccessView(db, clientId)).ownLogin?.linkSent).toBe(true);
    });

    it('canSetOwnerEmail: yes with no own login or an unconfirmed one; no once confirmed, or when Supabase cannot say', async () => {
      await handedOver({ own: null });
      expect((await getAdminAccessView(db, clientId)).canSetOwnerEmail, 'none').toBe(true);

      await db.user.update({ where: { id: OWNER }, data: { authProviderId: OWN_AUTH } });
      expect((await getAdminAccessView(db, clientId)).canSetOwnerEmail, 'gone from Supabase').toBe(true);

      idp.identities.set(OWN_AUTH, identity('oldtemp2@access.headway.local', { confirmed: true }));
      expect((await getAdminAccessView(db, clientId)).canSetOwnerEmail, 'Headway-made address').toBe(true);

      idp.identities.set(OWN_AUTH, identity('owner@example.com'));
      expect((await getAdminAccessView(db, clientId)).canSetOwnerEmail, 'unconfirmed').toBe(true);

      idp.identities.set(OWN_AUTH, identity('owner@example.com', { confirmed: true }));
      expect((await getAdminAccessView(db, clientId)).canSetOwnerEmail, 'confirmed').toBe(false);

      idp.identities.set(OWN_AUTH, identity('owner@example.com'));
      idp.unreachable = true;
      const unknown = await getAdminAccessView(db, clientId);
      expect(unknown.ownLogin).toEqual({ email: null, confirmed: null, linkSent: false });
      expect(unknown.canSetOwnerEmail, 'unknown').toBe(false);
    });
  });
});
