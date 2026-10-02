import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetDb } from './helpers/test-db';
import { finalizeAccountSetup, validateAccountSetup } from '@/lib/account-access/service';

/**
 * SETTING UP THE OWNER'S OWN LOGIN: VALIDATE, THEN COMMIT (M39, M52).
 *
 * Since M52 the temporary login and the owner's own login are two Supabase
 * identities for ONE owner User. Setup is done FROM the temporary login: it
 * creates the owner's own login (real email + own password, unconfirmed until
 * they open the emailed link) and records it on that same User. The temporary
 * login keeps working until an admin switches it off.
 *
 * `validateAccountSetup` reads and checks and writes nothing; it insists the
 * request comes from this business's temporary login, switched on.
 * `finalizeAccountSetup` is the commit, called once Supabase has created the
 * owner's own login (`tests/m39.account-setup-action.test.ts` proves the
 * action's order). Service layer only — a real database, no Supabase.
 */

const ADMIN = 'admin1';
const OWNER = 'owner1';
const OTHER = 'other1';
const TEMP = 'xyz12345@access.headway.local';
const TEMP_AUTH = 'auth-temp';

describe('validateAccountSetup / finalizeAccountSetup', () => {
  let db: PrismaClient;
  let clientId: string;

  beforeAll(() => {
    db = createTestDb('m39-account-setup-credentials');
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);

    await db.user.createMany({
      data: [
        { id: ADMIN, email: 'admin@headway.test', authProviderId: 'auth-admin', isPlatformAdmin: true },
        // The owner, before setup: no login of their own; the temporary
        // address stands in as the email.
        { id: OWNER, email: TEMP, authProviderId: null },
        { id: OTHER, email: 'already-taken@example.com', authProviderId: 'auth-other' },
      ],
    });
    const client = await db.client.create({
      data: {
        businessName: 'Alpha Salon',
        vertical: 'salon',
        status: 'ACTIVE',
        ownerName: 'From the admin',
        ownerPhone: '1111111111',
      },
      select: { id: true },
    });
    clientId = client.id;
    await db.membership.create({
      data: { userId: OWNER, clientId, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
    });
    await db.accountAccess.create({
      data: {
        clientId,
        userId: OWNER,
        loginId: TEMP,
        tempAuthId: TEMP_AUTH,
        status: 'TEMPORARY_ACTIVE',
        createdByUserId: ADMIN,
      },
    });
  });

  function validate(
    fields: Partial<{ email: string; password: string; confirmPassword: string; name: string; phone: string }> = {},
    session = TEMP_AUTH,
  ) {
    return validateAccountSetup(db, OWNER, clientId, session, {
      name: '',
      phone: '',
      email: 'fresh-owner@example.com',
      password: 'a-new-password',
      confirmPassword: 'a-new-password',
      ...fields,
    });
  }

  describe('validateAccountSetup', () => {
    it('never writes anything, success or failure', async () => {
      await validate();
      await validate({ email: 'already-taken@example.com' });

      const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
      expect(access?.status).toBe('TEMPORARY_ACTIVE');
      expect(access?.setupCompletedAt).toBeNull();
      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.authProviderId).toBeNull();
      expect(user?.email).toBe(TEMP);
      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerEmail).toBeNull();
      expect(client?.ownerName).toBe('From the admin');
    });

    it('accepts a fresh email, normalised to lower case, with no earlier own login', async () => {
      const result = await validate({ email: '  New-Owner@Example.com ' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.email).toBe('new-owner@example.com');
        expect(result.data.previousOwnAuthId).toBeNull();
      }
    });

    it('names an earlier own login, so the action can replace it only while unconfirmed', async () => {
      await db.user.update({ where: { id: OWNER }, data: { authProviderId: 'auth-own-first' } });
      const result = await validate();
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.previousOwnAuthId).toBe('auth-own-first');
    });

    it('requires an email: it is what the owner signs in and recovers with', async () => {
      const result = await validate({ email: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.email).toMatch(/Enter your email address/);
    });

    it('refuses a badly formed email', async () => {
      for (const email of ['not-an-email', 'a@b', 'two words@example.com']) {
        const result = await validate({ email });
        expect(result.ok, email).toBe(false);
        if (!result.ok) expect(result.errors.email).toBeTruthy();
      }
    });

    it('refuses a temporary address as the owner’s own email', async () => {
      for (const email of [TEMP, 'other999@access.headway.local', 'X@ACCESS.HEADWAY.LOCAL']) {
        const result = await validate({ email });
        expect(result.ok, email).toBe(false);
        if (!result.ok) expect(result.errors.email).toMatch(/your own email/);
      }
    });

    it('refuses an email already bound to a different account', async () => {
      const result = await validate({ email: 'already-taken@example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.email).toMatch(/already in use/);
    });

    it('refuses a short password, a long one, two that do not match, and the temporary one', async () => {
      const short = await validate({ password: 'short', confirmPassword: 'short' });
      expect(short.ok).toBe(false);
      if (!short.ok) expect(short.errors.password).toMatch(/at least 8/);

      const long = 'x'.repeat(73);
      const tooLong = await validate({ password: long, confirmPassword: long });
      expect(tooLong.ok).toBe(false);
      if (!tooLong.ok) expect(tooLong.errors.password).toMatch(/72 characters/);

      const mismatch = await validate({ password: 'a-new-password', confirmPassword: 'a-new-passw0rd' });
      expect(mismatch.ok).toBe(false);
      if (!mismatch.ok) expect(mismatch.errors.confirmPassword).toMatch(/do not match/);

      for (const password of ['Kq7m-x3pa-9fne-t2wd', '6750-Ae2p-f42v-wk0e']) {
        const temporary = await validate({ password, confirmPassword: password });
        expect(temporary.ok, password).toBe(false);
        if (!temporary.ok) expect(temporary.errors.password).toMatch(/not the temporary one/);
      }
    });

    it('leaves name and phone optional', async () => {
      expect((await validate({ name: '', phone: '' })).ok).toBe(true);
    });

    it('is the temporary login’s to do: any other session is refused', async () => {
      for (const session of ['auth-other', 'auth-own-anything', '']) {
        expect((await validate({}, session)).ok, session).toBe(false);
      }
    });

    it('refuses once temporary access is switched off', async () => {
      await db.accountAccess.update({ where: { userId: OWNER }, data: { status: 'DISABLED' } });
      expect((await validate()).ok).toBe(false);
    });

    it('refuses a client id that is not the one this temporary access belongs to', async () => {
      const other = await db.client.create({
        data: { businessName: 'Somebody Else', vertical: 'salon', status: 'ACTIVE' },
        select: { id: true },
      });
      const result = await validateAccountSetup(db, OWNER, other.id, TEMP_AUTH, {
        name: '',
        phone: '',
        email: 'fresh-owner@example.com',
        password: 'a-new-password',
        confirmPassword: 'a-new-password',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('finalizeAccountSetup', () => {
    const FIELDS = (id: string) => ({
      clientId: id,
      name: 'Priya',
      phone: '9876543210',
      email: 'new-owner@example.com',
      previousOwnAuthId: null,
    });

    it('records the owner’s own login on the SAME User, and the business’s contact details', async () => {
      const emailBefore = (await db.user.findUnique({ where: { id: OWNER } }))?.email;
      const committed = await finalizeAccountSetup(db, OWNER, TEMP_AUTH, FIELDS(clientId), 'auth-own');
      expect(committed).toBe('recorded');

      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.authProviderId).toBe('auth-own');
      // NOT the email: an address nobody has proved yet is not what RepOS
      // matches people by (a team invitation is accepted on it). It changes
      // when the confirmation link is opened — app.provision_user writes it
      // from the identity Supabase confirmed.
      expect(user?.email).toBe(emailBefore);
      expect(user?.email).not.toBe('new-owner@example.com');
      expect(user?.name).toBe('Priya');

      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerName).toBe('Priya');
      expect(client?.ownerPhone).toBe('9876543210');
      expect(client?.ownerEmail).toBe('new-owner@example.com');

      // The temporary login is untouched: it keeps working until an admin
      // switches it off.
      const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
      expect(access?.status).toBe('TEMPORARY_ACTIVE');
      expect(access?.tempAuthId).toBe(TEMP_AUTH);
      expect(access?.setupCompletedAt).not.toBeNull();
    });

    it('creates no User, Membership or Client', async () => {
      const counts = async () => ({
        users: await db.user.count(),
        memberships: await db.membership.count(),
        clients: await db.client.count(),
      });
      const before = await counts();
      await finalizeAccountSetup(db, OWNER, TEMP_AUTH, FIELDS(clientId), 'auth-own');
      expect(await counts()).toEqual(before);
    });

    it('loses to a disable that landed first, and writes nothing', async () => {
      await db.accountAccess.update({ where: { userId: OWNER }, data: { status: 'DISABLED', disabledAt: new Date() } });

      expect(await finalizeAccountSetup(db, OWNER, TEMP_AUTH, FIELDS(clientId), 'auth-own')).toBe('access-off');
      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.authProviderId).toBeNull();
      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerName).toBe('From the admin');
    });

    it('only from the temporary login itself', async () => {
      expect(await finalizeAccountSetup(db, OWNER, 'auth-someone-else', FIELDS(clientId), 'auth-own')).toBe('access-off');
      expect((await db.user.findUnique({ where: { id: OWNER } }))?.authProviderId).toBeNull();
    });

    it('a redo (a typo, a lost email) replaces the unconfirmed own login on the same User', async () => {
      await finalizeAccountSetup(db, OWNER, TEMP_AUTH, FIELDS(clientId), 'auth-own-1');
      expect(
        await finalizeAccountSetup(
          db,
          OWNER,
          TEMP_AUTH,
          { ...FIELDS(clientId), email: 'fixed@example.com', previousOwnAuthId: 'auth-own-1' },
          'auth-own-2',
        ),
      ).toBe('recorded');
      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.authProviderId).toBe('auth-own-2');
      expect((await db.client.findUnique({ where: { id: clientId } }))?.ownerEmail).toBe('fixed@example.com');
      expect(await db.user.count({ where: { authProviderId: 'auth-own-1' } })).toBe(0);
    });

    it('of two setups validated at once (two tabs), exactly one lands; the other writes nothing', async () => {
      // Both were validated while the User named no own login.
      expect(await finalizeAccountSetup(db, OWNER, TEMP_AUTH, FIELDS(clientId), 'auth-tab-1')).toBe('recorded');
      expect(
        await finalizeAccountSetup(db, OWNER, TEMP_AUTH, { ...FIELDS(clientId), name: 'Tab two', phone: '111' }, 'auth-tab-2'),
      ).toBe('raced');

      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.authProviderId).toBe('auth-tab-1');
      expect(user?.name).toBe('Priya');
      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerName).toBe('Priya');
      expect(client?.ownerPhone).toBe('9876543210');
    });
  });
});
