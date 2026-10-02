import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetDb } from './helpers/test-db';
import { finalizeAccountSetup, validateAccountSetup } from '@/lib/account-access/service';

/**
 * COMPLETING SETUP: VALIDATE, THEN (ONLY AFTER SUPABASE ACCEPTS THE PASSWORD)
 * COMMIT (M39, M52).
 *
 * `validateAccountSetup` reads and checks and writes nothing at all;
 * `finalizeAccountSetup` is the commit, called only once the owner's own
 * Supabase session has accepted their new password
 * (`tests/m39.account-setup-action.test.ts` proves the action orders it that
 * way). Service layer only — a real database, no Supabase.
 *
 * Since M52 the email is REQUIRED, and it is NOT written to the login
 * identity here: the sign-in email moves in Supabase only when the owner
 * opens the confirmation link, and RepOS's User row follows on their next
 * sign-in. Writing it now would trust an address nobody has proved they can
 * read — a typo would become the address a password is reset through.
 */

const ADMIN = 'admin1';
const OWNER = 'owner1';
const OTHER = 'other1';
const TEMP = 'xyz12345@access.headway.local';

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
        { id: OWNER, email: TEMP, authProviderId: 'auth-owner' },
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
      data: { clientId, userId: OWNER, loginId: TEMP, status: 'TEMPORARY_ACTIVE', createdByUserId: ADMIN },
    });
  });

  function validate(fields: Partial<{ email: string; password: string; confirmPassword: string; name: string; phone: string }> = {}) {
    return validateAccountSetup(db, OWNER, clientId, {
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
      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerEmail).toBeNull();
      expect(client?.ownerName).toBe('From the admin');
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

    it('accepts a fresh email, normalised to lower case', async () => {
      const result = await validate({ email: '  New-Owner@Example.com ' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.email).toBe('new-owner@example.com');
    });

    it('refuses an email already bound to a different account', async () => {
      const result = await validate({ email: 'already-taken@example.com' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.email).toMatch(/already in use/);
    });

    it('refuses a short password, a long one, and two that do not match', async () => {
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
    });

    it('refuses the temporary password itself as the owner’s new password', async () => {
      // Supabase would answer "same password" and change nothing, leaving the
      // password the admin handed over live behind a row saying setup is done.
      for (const password of ['Kq7m-x3pa-9fne-t2wd', '6750-Ae2p-f42v-wk0e']) {
        const result = await validate({ password, confirmPassword: password });
        expect(result.ok, password).toBe(false);
        if (!result.ok) expect(result.errors.password).toMatch(/not the temporary one/);
      }
    });

    it('leaves name and phone optional', async () => {
      const result = await validate({ name: '', phone: '' });
      expect(result.ok).toBe(true);
    });

    it('refuses once AccountAccess has moved past TEMPORARY_ACTIVE', async () => {
      for (const status of ['SETUP_COMPLETE', 'DISABLED']) {
        await db.accountAccess.update({ where: { userId: OWNER }, data: { status } });
        const result = await validate();
        expect(result.ok, status).toBe(false);
      }
    });

    it('refuses a client id that is not the one this temporary access belongs to', async () => {
      const other = await db.client.create({
        data: { businessName: 'Somebody Else', vertical: 'salon', status: 'ACTIVE' },
        select: { id: true },
      });
      const result = await validateAccountSetup(db, OWNER, other.id, {
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
    it('commits the contact fields and flips AccountAccess to SETUP_COMPLETE', async () => {
      const committed = await finalizeAccountSetup(db, OWNER, {
        clientId,
        name: 'Priya',
        phone: '9876543210',
        email: 'new-owner@example.com',
      });
      expect(committed).toBe(true);

      const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
      expect(access?.status).toBe('SETUP_COMPLETE');
      expect(access?.setupCompletedAt).not.toBeNull();

      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerName).toBe('Priya');
      expect(client?.ownerPhone).toBe('9876543210');
      // Recorded only once Supabase accepts the address for a link (the action).
      expect(client?.ownerEmail).toBeNull();
    });

    it('does NOT move the login email: that waits for the confirmation link', async () => {
      await finalizeAccountSetup(db, OWNER, { clientId, name: '', phone: '', email: 'new-owner@example.com' });

      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.email).toBe(TEMP);
    });

    it('keeps the same User, Membership and Client — nothing new is created', async () => {
      const before = { users: await db.user.count(), memberships: await db.membership.count(), clients: await db.client.count() };
      await finalizeAccountSetup(db, OWNER, { clientId, name: '', phone: '', email: 'new-owner@example.com' });
      expect({ users: await db.user.count(), memberships: await db.membership.count(), clients: await db.client.count() }).toEqual(before);
      const membership = await db.membership.findFirst({ where: { userId: OWNER, clientId } });
      expect(membership?.status).toBe('ACTIVE');
    });

    it('loses to a disable that landed first, and writes nothing', async () => {
      await db.accountAccess.update({ where: { userId: OWNER }, data: { status: 'DISABLED', disabledAt: new Date() } });

      const committed = await finalizeAccountSetup(db, OWNER, {
        clientId,
        name: 'Priya',
        phone: '',
        email: 'new-owner@example.com',
      });

      expect(committed).toBe(false);
      const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
      expect(access?.status).toBe('DISABLED');
      expect(access?.setupCompletedAt).toBeNull();
      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerName).toBe('From the admin');
    });

    it('commits once: a second call finds nothing left to finish', async () => {
      const fields = { clientId, name: '', phone: '', email: 'new-owner@example.com' };
      expect(await finalizeAccountSetup(db, OWNER, fields)).toBe(true);
      const first = (await db.accountAccess.findUnique({ where: { userId: OWNER } }))?.setupCompletedAt;
      expect(await finalizeAccountSetup(db, OWNER, fields)).toBe(false);
      expect((await db.accountAccess.findUnique({ where: { userId: OWNER } }))?.setupCompletedAt).toEqual(first);
    });
  });
});
