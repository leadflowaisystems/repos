import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetDb } from './helpers/test-db';
import { finalizeAccountSetup, validateAccountSetup } from '@/lib/account-access/service';

/**
 * THE EMAIL TYPED DURING SETUP BECOMES THE PERMANENT LOGIN (M39 follow-up),
 * AND NOTHING COMMITS UNTIL SUPABASE HAS ALREADY ACCEPTED IT.
 *
 * `completeAccountSetup` used to do both the validation AND the database
 * commit in one call, before the caller ever touched Supabase — so a
 * Supabase-side rejection (an email already claimed, a password policy this
 * project enforces that RepOS's own zod schema does not know about) arrived
 * AFTER `AccountAccess` already said SETUP_COMPLETE. That is the exact state
 * that must never be reachable: a database that claims setup finished while
 * the temporary password is still the only one that works, and the person
 * locked out of retrying because `validateAccountSetup`/`finalizeAccountSetup`
 * (like the function they replaced) only ever act on a row that is still
 * TEMPORARY_ACTIVE.
 *
 * Split in two for exactly that reason: `validateAccountSetup` reads and
 * checks, and writes nothing at all; `finalizeAccountSetup` is the commit,
 * meant to be called only once the caller's own Supabase update has already
 * succeeded (`tests/m39.account-setup-action.test.ts` is the file that
 * proves the action actually orders it that way). This file is the service
 * layer only — real database, no Supabase at all, since neither function
 * here ever calls it.
 */

const ADMIN = 'admin1';
const OWNER = 'owner1';
const OTHER = 'other1';

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
        { id: OWNER, email: 'xyz12345@access.headway.local', authProviderId: 'auth-owner' },
        { id: OTHER, email: 'already-taken@example.com', authProviderId: 'auth-other' },
      ],
    });
    const client = await db.client.create({
      data: { businessName: 'Alpha Salon', vertical: 'salon', status: 'ACTIVE' },
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
        loginId: 'xyz12345@access.headway.local',
        status: 'TEMPORARY_ACTIVE',
        createdByUserId: ADMIN,
      },
    });
  });

  function validate(email: string) {
    return validateAccountSetup(db, OWNER, clientId, {
      name: '',
      phone: '',
      email,
      password: 'a-new-password',
      confirmPassword: 'a-new-password',
    });
  }

  describe('validateAccountSetup', () => {
    it('never writes anything, success or failure', async () => {
      await validate('fresh-owner@example.com');
      await validate('already-taken@example.com');

      const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
      expect(access?.status).toBe('TEMPORARY_ACTIVE');
      expect(access?.setupCompletedAt).toBeNull();
      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerEmail).toBeNull();
    });

    it('accepts a blank email and returns null', async () => {
      const result = await validate('');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.email).toBeNull();
    });

    it('accepts a fresh email, normalised to lower case', async () => {
      const result = await validate('New-Owner@Example.com');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.email).toBe('new-owner@example.com');
    });

    it('refuses an email already bound to a different account', async () => {
      const result = await validate('already-taken@example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.email).toBeTruthy();
    });

    it('does not reject the address the actor already owns (the exclusion is not dead code)', async () => {
      const result = await validate('xyz12345@access.headway.local');
      expect(result.ok).toBe(true);
    });

    it('refuses once AccountAccess has already moved past TEMPORARY_ACTIVE', async () => {
      await db.accountAccess.update({ where: { userId: OWNER }, data: { status: 'SETUP_COMPLETE' } });
      const result = await validate('someone@example.com');
      expect(result.ok).toBe(false);
    });
  });

  describe('finalizeAccountSetup', () => {
    it('commits the contact fields and flips AccountAccess to SETUP_COMPLETE', async () => {
      await finalizeAccountSetup(db, OWNER, {
        clientId,
        name: 'Priya',
        phone: '9876543210',
        email: 'new-owner@example.com',
      });

      const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
      expect(access?.status).toBe('SETUP_COMPLETE');
      expect(access?.setupCompletedAt).not.toBeNull();

      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerName).toBe('Priya');
      expect(client?.ownerEmail).toBe('new-owner@example.com');
    });

    it('leaves ownerEmail null when no email was given', async () => {
      await finalizeAccountSetup(db, OWNER, { clientId, name: '', phone: '', email: null });

      const client = await db.client.findUnique({ where: { id: clientId } });
      expect(client?.ownerEmail).toBeNull();
    });

    /**
     * THE LOGIN IDENTITY HAS TO MOVE ON RepOS'S SIDE TOO.
     *
     * Supabase gets the new address (setPermanentCredentials, with
     * email_confirm) and Client.ownerEmail got it here — but User.email used
     * to keep the synthetic `…@access.headway.local` login id forever. Sign-in
     * never noticed, because loadActor resolves by authProviderId, so the
     * drift was invisible while still breaking the collision guard below.
     */
    it('moves the login email onto the User row, not only onto the Client', async () => {
      await finalizeAccountSetup(db, OWNER, {
        clientId,
        name: '',
        phone: '',
        email: 'new-owner@example.com',
      });

      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.email).toBe('new-owner@example.com');
      expect(user?.emailVerifiedAt).not.toBeNull();
    });

    it('leaves the existing login identity untouched when no email was given', async () => {
      await finalizeAccountSetup(db, OWNER, { clientId, name: '', phone: '', email: null });

      const user = await db.user.findUnique({ where: { id: OWNER } });
      expect(user?.email).toBe('xyz12345@access.headway.local');
    });

    it('makes the address visible to the collision guard for the next owner', async () => {
      // The consequence of the stale row, stated as behaviour: without the
      // User.email write, the address this product just handed out is
      // invisible to validateAccountSetup, so the next owner passes RepOS's
      // own check and is refused by Supabase instead — as a failure the form
      // could not explain.
      await finalizeAccountSetup(db, OWNER, {
        clientId,
        name: '',
        phone: '',
        email: 'new-owner@example.com',
      });

      const second = await db.client.create({
        data: { businessName: 'Beta Spa', vertical: 'salon', status: 'ACTIVE' },
        select: { id: true },
      });
      await db.membership.create({
        data: { userId: OTHER, clientId: second.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
      });
      await db.accountAccess.create({
        data: {
          clientId: second.id,
          userId: OTHER,
          loginId: 'pqr67890@access.headway.local',
          status: 'TEMPORARY_ACTIVE',
          createdByUserId: ADMIN,
        },
      });

      const result = await validateAccountSetup(db, OTHER, second.id, {
        name: '',
        phone: '',
        email: 'new-owner@example.com',
        password: 'another-password',
        confirmPassword: 'another-password',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.email).toBeTruthy();
    });
  });
});
