import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetDb } from './helpers/test-db';
import { completeAccountSetup } from '@/lib/account-access/service';

/**
 * THE EMAIL TYPED DURING SETUP BECOMES THE PERMANENT LOGIN (M39 follow-up).
 *
 * `completeAccountSetup` used to write a submitted email only onto
 * `Client.ownerEmail` (contact info) and never touch the Supabase identity's
 * login email at all — the synthetic Login ID stayed the permanent
 * identifier forever, by original design. In production this meant an owner
 * who typed their own email and a new password during setup could not sign
 * back in with either afterwards: `auth.users.email` had never moved, so
 * Supabase matched neither.
 *
 * Changed: a non-blank email is now checked against RepOS's own `User` table
 * BEFORE anything commits (this file), and handed to
 * `setPermanentCredentials` — the one module allowed to touch
 * `SUPABASE_SERVICE_ROLE_KEY` — alongside the password
 * (`tests/m39.account-setup-action.test.ts`), so the identity Supabase
 * actually verifies against moves too.
 *
 * This file is the service layer only: real database, no Supabase at all —
 * `completeAccountSetup` itself never calls it. Connected as the schema
 * owner, like every other non-RLS-specific service test; the collision check
 * added here is a business rule, not a policy question.
 */

const ADMIN = 'admin1';
const OWNER = 'owner1';
const OTHER = 'other1';

describe('completeAccountSetup', () => {
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

  function setup(email: string) {
    return completeAccountSetup(db, OWNER, clientId, {
      name: '',
      phone: '',
      email,
      password: 'a-new-password',
      confirmPassword: 'a-new-password',
    });
  }

  it('leaves the login untouched when no email is given, and still completes setup', async () => {
    const result = await setup('');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBeNull();

    const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
    expect(access?.status).toBe('SETUP_COMPLETE');
  });

  it('accepts a fresh email, normalised to lower case, and completes setup', async () => {
    const result = await setup('New-Owner@Example.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBe('new-owner@example.com');

    const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
    expect(access?.status).toBe('SETUP_COMPLETE');
  });

  it("refuses an email already bound to a different account, and leaves TEMPORARY_ACTIVE untouched", async () => {
    const result = await setup('already-taken@example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toBeTruthy();

    // The point of the check: a rejected email must not have flipped the
    // row, or the owner is permanently locked out of retrying —
    // completeAccountSetup only ever accepts a row that is still
    // TEMPORARY_ACTIVE.
    const access = await db.accountAccess.findUnique({ where: { userId: OWNER } });
    expect(access?.status).toBe('TEMPORARY_ACTIVE');
  });

  it('does not reject the address the actor already owns (the exclusion is not dead code)', async () => {
    const result = await setup('xyz12345@access.headway.local');
    expect(result.ok).toBe(true);
  });
});
