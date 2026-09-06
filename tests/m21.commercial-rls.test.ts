import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE COMMERCIAL SIDE, UNDER THE POLICIES THAT ACTUALLY SHIP (M21).
 *
 * Everything asserted here is a claim about the DATABASE, so it is tested
 * against the database — the real schema, `prisma/m20/rls.sql` applied
 * verbatim, and the same non-superuser role production connects as. A claim
 * that "the owner cannot see the price" is worth nothing if the only thing
 * stopping them is a component that declines to render it.
 *
 * Four claims:
 *
 *   1. A business owner's connection returns NO ROWS from Commercial. Not a
 *      redacted row, not a null amount — nothing. And it cannot write one.
 *   2. Nobody can move their own subscription or their own trial dates. The
 *      columns are not in the grant, so the UPDATE is refused by privilege
 *      rather than by policy, and `app.set_subscription` refuses anyone who is
 *      not platform staff.
 *   3. `app.touch_membership` writes one column on the caller's own row. Not
 *      somebody else's row, not their role, not another business.
 *   4. `app.invitation_preview` answers for the invited address and for nobody
 *      else, and accepting lands the person in the invited workspace only.
 */

let session: { id: string } | null = null;

vi.mock('@/lib/auth/supabase', () => ({
  SUPABASE_URL_VAR: 'SUPABASE_URL',
  SUPABASE_ANON_KEY_VAR: 'SUPABASE_ANON_KEY',
  supabaseConfig: () => ({ ok: true, config: { url: 'http://localhost', anonKey: 'test' } }),
  isSupabaseConfigured: () => true,
  supabaseServerClient: async () => ({
    auth: {
      getUser: async () =>
        session
          ? { data: { user: { id: session.id } }, error: null }
          : { data: { user: null }, error: null },
    },
  }),
}));

const AUTH = {
  admin: '11111111-1111-4111-8111-111111111111',
  alpha: '22222222-2222-4222-8222-222222222222',
  beta: '44444444-4444-4444-8444-444444444444',
  staff: '55555555-5555-4555-8555-555555555555',
  invited: '88888888-8888-4888-8888-888888888888',
} as const;

const NOW = new Date('2026-06-01T10:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let commercial: typeof import('@/lib/commercial/service');
let team: typeof import('@/lib/team/service');
let retention: typeof import('@/lib/retention/service');

let seeded: {
  adminId: string;
  alphaOwnerId: string;
  alphaStaffId: string;
  betaOwnerId: string;
  invitedId: string;
  alphaClientId: string;
  betaClientId: string;
};

beforeAll(async () => {
  harness = await createRlsTestDb('m21-commercial');
  owner = harness.owner;

  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

  commercial = await import('@/lib/commercial/service');
  team = await import('@/lib/team/service');
  retention = await import('@/lib/retention/service');
  ({ prisma: app } = await import('@/lib/db'));
}, 180_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  session = null;
  await resetDb(owner);

  const admin = await owner.user.create({
    data: { email: 'admin@repos.test', authProviderId: AUTH.admin, isPlatformAdmin: true },
    select: { id: true },
  });
  const alphaOwner = await owner.user.create({
    data: { email: 'owner@alpha.test', authProviderId: AUTH.alpha },
    select: { id: true },
  });
  const alphaStaff = await owner.user.create({
    data: { email: 'staff@alpha.test', authProviderId: AUTH.staff },
    select: { id: true },
  });
  const betaOwner = await owner.user.create({
    data: { email: 'owner@beta.test', authProviderId: AUTH.beta },
    select: { id: true },
  });
  const invited = await owner.user.create({
    data: { email: 'invited@alpha.test', authProviderId: AUTH.invited },
    select: { id: true },
  });

  const alpha = await owner.client.create({
    data: { businessName: 'Alpha Cafe', vertical: 'cafe', status: 'ACTIVE' },
    select: { id: true },
  });
  const beta = await owner.client.create({
    data: { businessName: 'Beta Gym', vertical: 'gym', status: 'ACTIVE' },
    select: { id: true },
  });
  await owner.membership.createMany({
    data: [
      { userId: alphaOwner.id, clientId: alpha.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
      { userId: alphaStaff.id, clientId: alpha.id, role: 'BUSINESS_STAFF', status: 'ACTIVE' },
      { userId: betaOwner.id, clientId: beta.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
    ],
  });
  await owner.commercial.create({
    data: {
      clientId: alpha.id,
      amountInr: 4500,
      cadence: 'MONTHLY',
      note: 'Agreed on the call.',
      paymentInstructions: 'UPI: alpha@bank',
    },
  });

  seeded = {
    adminId: admin.id,
    alphaOwnerId: alphaOwner.id,
    alphaStaffId: alphaStaff.id,
    betaOwnerId: betaOwner.id,
    invitedId: invited.id,
    alphaClientId: alpha.id,
    betaClientId: beta.id,
  };
});

// ---------------------------------------------------------------------------

describe('what the business pays is not the business’s to read', () => {
  it('is there, as far as the owner of the tables is concerned', async () => {
    expect(await owner.commercial.count()).toBe(1);
  });

  it('returns no rows to the owner of the business it describes', async () => {
    session = { id: AUTH.alpha };
    expect(await app.commercial.count({ where: { clientId: seeded.alphaClientId } })).toBe(0);
    const record = await commercial.getCommercial(app, seeded.alphaClientId);
    expect(record.amountInr).toBeNull();
    expect(record.paymentInstructions).toBe('');
  });

  it('returns no rows to a staff member either, or to anybody at all', async () => {
    for (const who of [AUTH.staff, AUTH.beta, null]) {
      session = who ? { id: who } : null;
      expect(await app.commercial.count()).toBe(0);
    }
  });

  it('lets an owner write no row of their own', async () => {
    session = { id: AUTH.alpha };
    const result = await commercial.saveCommercial(app, seeded.betaClientId, {
      amountInr: 1,
      cadence: 'MONTHLY',
      note: 'not mine to set',
      paymentInstructions: '',
    });
    // Either the business is invisible to them or the write is refused. Both
    // are correct; what must never happen is a row appearing.
    expect(result.ok).toBe(false);
    expect(await owner.commercial.count({ where: { clientId: seeded.betaClientId } })).toBe(0);
  });

  it('hands the whole record to platform staff', async () => {
    session = { id: AUTH.admin };
    const record = await commercial.getCommercial(app, seeded.alphaClientId);
    expect(record.amountInr).toBe(4500);
    expect(record.paymentInstructions).toBe('UPI: alpha@bank');
  });

  it('lets platform staff record what was agreed', async () => {
    session = { id: AUTH.admin };
    const result = await commercial.saveCommercial(
      app,
      seeded.betaClientId,
      { amountInr: 2500, cadence: 'QUARTERLY', note: 'n', paymentInstructions: 'UPI: beta@bank' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    const row = await owner.commercial.findUniqueOrThrow({
      where: { clientId: seeded.betaClientId },
    });
    expect(row.amountInr).toBe(2500);
    expect(row.cadence).toBe('QUARTERLY');
  });
});

describe('a business cannot move its own subscription or its own trial', () => {
  it('holds no privilege on the columns at all', async () => {
    const granted = await owner.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee = 'repos_app' AND table_name = 'Client' AND privilege_type = 'UPDATE'`,
    );
    const columns = granted.map((g) => g.column_name);
    for (const column of ['subscriptionStatus', 'trialStartsAt', 'trialEndsAt', 'plan', 'status']) {
      expect(columns, column).not.toContain(column);
    }
    // And the one the owner IS allowed to set, so this is not vacuous.
    expect(columns).toContain('paymentRequestedAt');
  });

  it('refuses the function to a business owner', async () => {
    session = { id: AUTH.alpha };
    const result = await commercial.pauseService(app, seeded.alphaClientId, { now: NOW });
    expect(result.ok).toBe(false);

    const client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.subscriptionStatus).toBe('TRIAL');
  });

  it('refuses it to a staff member and to a signed-out caller', async () => {
    for (const who of [AUTH.staff, null]) {
      session = who ? { id: who } : null;
      const result = await commercial.extendTrial(app, seeded.alphaClientId, 30, { now: NOW });
      expect(result.ok).toBe(false);
    }
    const client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.trialEndsAt).toBeNull();
  });

  it('lets platform staff start, extend, pause and resume', async () => {
    session = { id: AUTH.admin };

    expect((await commercial.startTrial(app, seeded.alphaClientId, 14, { now: NOW })).ok).toBe(true);
    let client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.subscriptionStatus).toBe('TRIAL');
    expect(client.trialEndsAt?.getTime()).toBe(NOW.getTime() + 14 * DAY);

    expect((await commercial.extendTrial(app, seeded.alphaClientId, 7, { now: NOW })).ok).toBe(true);
    client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.trialEndsAt?.getTime()).toBe(NOW.getTime() + 21 * DAY);

    expect((await commercial.pauseService(app, seeded.alphaClientId, { now: NOW })).ok).toBe(true);
    client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.subscriptionStatus).toBe('PAUSED');
    // Pausing changed the state and nothing else: the trial window is intact.
    expect(client.trialEndsAt?.getTime()).toBe(NOW.getTime() + 21 * DAY);

    expect((await commercial.resumeService(app, seeded.alphaClientId, { now: NOW })).ok).toBe(true);
    client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.subscriptionStatus).toBe('TRIAL');
  });

  it('touches only the business named, never a neighbour', async () => {
    session = { id: AUTH.admin };
    await commercial.pauseService(app, seeded.alphaClientId, { now: NOW });
    const beta = await owner.client.findUniqueOrThrow({ where: { id: seeded.betaClientId } });
    expect(beta.subscriptionStatus).toBe('TRIAL');
  });
});

describe('the owner asking what it costs is the owner’s to do', () => {
  it('writes their own contact details and the timestamp, under the policies', async () => {
    session = { id: AUTH.alpha };
    const result = await commercial.requestPaymentDetails(
      app,
      seeded.alphaClientId,
      { name: 'Priya Shah', email: 'priya@alpha.test', phone: '9876543210' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);

    const client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.ownerEmail).toBe('priya@alpha.test');
    expect(client.paymentRequestedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it('cannot be done for somebody else’s business', async () => {
    session = { id: AUTH.beta };
    const result = await commercial.requestPaymentDetails(
      app,
      seeded.alphaClientId,
      { name: 'Not Mine', email: 'x@beta.test', phone: '9876543210' },
      { now: NOW },
    );
    expect(result.ok).toBe(false);
    const client = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClientId } });
    expect(client.paymentRequestedAt).toBeNull();
    expect(client.ownerName).toBeNull();
  });
});

describe('remembering a visit, without widening what a member may write', () => {
  it('stamps the caller’s own row, including a staff member’s', async () => {
    session = { id: AUTH.staff };
    await retention.touchLastSeen(app, seeded.alphaClientId, { now: NOW });

    const rows = await owner.membership.findMany({
      where: { clientId: seeded.alphaClientId },
      select: { userId: true, lastSeenAt: true, role: true },
    });
    const staff = rows.find((r) => r.userId === seeded.alphaStaffId);
    const ownerRow = rows.find((r) => r.userId === seeded.alphaOwnerId);
    expect(staff?.lastSeenAt?.toISOString()).toBe(NOW.toISOString());
    // Not everyone on the team, and not their role either.
    expect(ownerRow?.lastSeenAt).toBeNull();
    expect(staff?.role).toBe('BUSINESS_STAFF');
  });

  it('stamps nothing for a business the caller does not belong to', async () => {
    session = { id: AUTH.alpha };
    await retention.touchLastSeen(app, seeded.betaClientId, { now: NOW });
    const beta = await owner.membership.findFirstOrThrow({
      where: { clientId: seeded.betaClientId },
    });
    expect(beta.lastSeenAt).toBeNull();
  });

  it('stamps nothing for a caller with no session at all', async () => {
    session = null;
    await retention.touchLastSeen(app, seeded.alphaClientId, { now: NOW });
    const touched = await owner.membership.count({ where: { lastSeenAt: { not: null } } });
    expect(touched).toBe(0);
  });
});

describe('an invitation says what it is for, to the person it names', () => {
  async function invite(role = 'BUSINESS_STAFF') {
    session = { id: AUTH.alpha };
    const result = await team.inviteMember(app, seeded.alphaClientId, {
      email: 'invited@alpha.test',
      role,
      invitedById: seeded.alphaOwnerId,
    });
    if (!result.ok) throw new Error(result.message);
    return result.data.token;
  }

  it('names the business, the role and the expiry for the invited account', async () => {
    const token = await invite('BUSINESS_OWNER');
    session = { id: AUTH.invited };
    const preview = await team.invitationPreview(app, token, seeded.invitedId);
    expect(preview?.businessName).toBe('Alpha Cafe');
    expect(preview?.role).toBe('BUSINESS_OWNER');
    expect(preview?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('says nothing to anybody else holding the same link', async () => {
    const token = await invite();
    for (const who of [seeded.betaOwnerId, seeded.alphaStaffId, seeded.adminId]) {
      expect(await team.invitationPreview(app, token, who)).toBeNull();
    }
  });

  it('says nothing for a token that is wrong, spent, revoked or out of time', async () => {
    expect(await team.invitationPreview(app, 'not-a-real-token', seeded.invitedId)).toBeNull();

    const spent = await invite();
    session = { id: AUTH.invited };
    await team.acceptInviteViaResolver(app, spent, seeded.invitedId);
    expect(await team.invitationPreview(app, spent, seeded.invitedId)).toBeNull();

    const revoked = await invite();
    await owner.invitation.updateMany({
      where: { acceptedAt: null },
      data: { revokedAt: new Date() },
    });
    expect(await team.invitationPreview(app, revoked, seeded.invitedId)).toBeNull();

    const expired = await invite();
    await owner.invitation.updateMany({
      where: { acceptedAt: null, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - DAY) },
    });
    expect(await team.invitationPreview(app, expired, seeded.invitedId)).toBeNull();
  });

  it('provisions the invited workspace and only the invited workspace', async () => {
    const token = await invite();
    session = { id: AUTH.invited };
    const accepted = await team.acceptInviteViaResolver(app, token, seeded.invitedId);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.data.clientId).toBe(seeded.alphaClientId);

    const memberships = await owner.membership.findMany({
      where: { userId: seeded.invitedId },
      select: { clientId: true, role: true, status: true },
    });
    expect(memberships).toEqual([
      { clientId: seeded.alphaClientId, role: 'BUSINESS_STAFF', status: 'ACTIVE' },
    ]);
  });

  it('cannot be accepted by a different account, however the link was obtained', async () => {
    const token = await invite();
    session = { id: AUTH.beta };
    const result = await team.acceptInviteViaResolver(app, token, seeded.betaOwnerId);
    expect(result.ok).toBe(false);
    expect(await owner.membership.count({ where: { userId: seeded.betaOwnerId } })).toBe(1);
  });
});
