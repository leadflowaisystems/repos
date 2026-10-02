import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb, validClientInput } from './helpers/test-db';

/**
 * EVERY ACCOUNT PATH, IN THE ORDER IT HAPPENS (M43, two logins since M52).
 *
 * Each step already has its own tests. This file proves they work TOGETHER —
 * against a real Postgres with the shipped `rls.sql` (so `app.user_id_for_auth`,
 * `app.provision_user` and `app.rebind_temp_access` run for real), through
 * the real `src/lib/db.ts`, connected as `repos_app`, the role production runs
 * as. Only the Supabase network edge is stubbed: who the session says is
 * signed in, and the Auth admin API.
 *
 *   1. the admin adds a client; 2. generates a temporary EMAIL + PASSWORD
 *   3. the temporary login lands on Account, in that business only
 *   4. setup records the owner's OWN login on the same User
 *   5. the own login (once confirmed) and the temporary login both open it
 *   6. disabling temporary access never touches the owner's own login
 *   7. enabling it again: same email, new password, own login untouched
 *   8. before setup: disable really shuts the business, enable reopens it
 *   9. a business with its own owner: a temporary login into that account
 *  10. a row with no temporary login left is given a fresh one (platform only)
 *  11. two admins generating at once leave one login and no orphans
 *  12. a self-serve owner signs up, onboards, and lands in their own business
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
        session ? { data: { user: { id: session.id } }, error: null } : { data: { user: null }, error: null },
    },
  }),
}));

/** The Auth admin API, as a ledger. None of these calls sends an email. */
const idp = vi.hoisted(() => ({
  minted: [] as Array<{ email: string; password: string; authUserId: string }>,
  passwords: [] as Array<{ authUserId: string; password: string }>,
  scrambled: [] as string[],
  deleted: [] as string[],
  own: new Map<string, { email: string; confirmed: boolean }>(),
  n: 0,
  /** When set, createTempIdentity waits until this many calls are in flight. */
  rendezvous: null as null | { waiting: number; of: number; release: () => void; ready: Promise<void> },
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  SUPABASE_SERVICE_ROLE_KEY_VAR: 'SUPABASE_SERVICE_ROLE_KEY',
  isAccountAccessConfigured: () => true,
  createTempIdentity: async (email: string, password: string) => {
    const meet = idp.rendezvous;
    if (meet) {
      meet.waiting += 1;
      if (meet.waiting >= meet.of) meet.release();
      await meet.ready;
    }
    idp.n += 1;
    const authUserId = `aaaaaaaa-0000-4000-8000-${String(idp.n).padStart(12, '0')}`;
    idp.minted.push({ email, password, authUserId });
    return { authUserId };
  },
  setIdentityPassword: async (authUserId: string, password: string) => {
    idp.passwords.push({ authUserId, password });
    return { ok: true };
  },
  randomizeIdentityPassword: async (authUserId: string) => {
    idp.scrambled.push(authUserId);
  },
  deleteIdentity: async (authUserId: string) => {
    idp.deleted.push(authUserId);
  },
  getIdentitySnapshot: async (authUserId: string) => {
    const own = idp.own.get(authUserId);
    return own ? { ...own, lastSignInAt: null } : null;
  },
}));

const ADMIN_AUTH = '11111111-1111-4111-8111-111111111111';
const OTHER_AUTH = '44444444-4444-4444-8444-444444444444';
const SELF_AUTH = '55555555-5555-4555-8555-555555555555';
const OWN_AUTH = '66666666-6666-4666-8666-666666666666';

const TEMP_EMAIL = /^[a-z0-9]{8}@access\.headway\.local$/;
const TEMP_PASSWORD = /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;
let svc: {
  createClient: typeof import('@/lib/clients/service').createClient;
  generateTempAccess: typeof import('@/lib/account-access/service').generateTempAccess;
  validateAccountSetup: typeof import('@/lib/account-access/service').validateAccountSetup;
  finalizeAccountSetup: typeof import('@/lib/account-access/service').finalizeAccountSetup;
  disableTempAccess: typeof import('@/lib/account-access/service').disableTempAccess;
  getAdminAccessView: typeof import('@/lib/account-access/service').getAdminAccessView;
  loadActor: typeof import('@/lib/tenancy/service').loadActor;
  provisionUser: typeof import('@/lib/tenancy/service').provisionUser;
  landingPathFor: typeof import('@/lib/onboarding/service').landingPathFor;
  completeOnboarding: typeof import('@/lib/onboarding/service').completeOnboarding;
};

const state = {
  adminId: '',
  otherClientId: '',
  otherUserId: '',
  clientId: '',
  ownerUserId: '',
  tempAuth: '',
  email: '',
};

async function newClient(name: string) {
  session = { id: ADMIN_AUTH };
  const created = await svc.createClient(app, validClientInput({ businessName: name, vertical: 'clinic', status: 'ACTIVE' }));
  expect(created.ok, created.ok ? '' : created.message).toBe(true);
  if (!created.ok) throw new Error(created.message);
  return created.data.id;
}

/** What a request signed in as `authId` can see of the businesses. */
async function visibleClients(authId: string) {
  session = { id: authId };
  return (await app.client.findMany({ select: { id: true } })).map((c) => c.id).sort();
}

beforeAll(async () => {
  expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
  harness = await createRlsTestDb('m43-account-lifecycle');
  owner = harness.owner;
  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;
  ({ prisma: app } = await import('@/lib/db'));
  const clients = await import('@/lib/clients/service');
  const access = await import('@/lib/account-access/service');
  const tenancy = await import('@/lib/tenancy/service');
  const onboarding = await import('@/lib/onboarding/service');
  svc = {
    createClient: clients.createClient,
    generateTempAccess: access.generateTempAccess,
    validateAccountSetup: access.validateAccountSetup,
    finalizeAccountSetup: access.finalizeAccountSetup,
    disableTempAccess: access.disableTempAccess,
    getAdminAccessView: access.getAdminAccessView,
    loadActor: tenancy.loadActor,
    provisionUser: tenancy.provisionUser,
    landingPathFor: onboarding.landingPathFor,
    completeOnboarding: onboarding.completeOnboarding,
  };
  await resetDb(owner);
  const admin = await owner.user.create({
    data: { email: 'admin@headway.test', authProviderId: ADMIN_AUTH, isPlatformAdmin: true },
    select: { id: true },
  });
  const other = await owner.user.create({ data: { email: 'owner@other.test', authProviderId: OTHER_AUTH }, select: { id: true } });
  const otherClient = await owner.client.create({
    data: {
      businessName: 'Other Business',
      vertical: 'gym',
      status: 'ACTIVE',
      memberships: { create: { userId: other.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' } },
    },
    select: { id: true },
  });
  state.adminId = admin.id;
  state.otherUserId = other.id;
  state.otherClientId = otherClient.id;
}, 240_000);

afterAll(async () => {
  await harness?.dispose();
});

describe('one business, from the admin adding it to the owner signing in as themselves', () => {
  it('1. the platform admin adds a client: a trial, a feedback page, and no owner yet', async () => {
    state.clientId = await newClient('Lifecycle Salon');
    const row = await owner.client.findUniqueOrThrow({
      where: { id: state.clientId },
      include: { gateway: true, memberships: true },
    });
    expect(row.subscriptionStatus).toBe('TRIAL');
    expect(row.gateway?.publicToken).toMatch(/^[a-z0-9]{22}$/);
    expect(row.memberships).toHaveLength(0);
    expect(await svc.getAdminAccessView(app, state.clientId)).toEqual({ ownLogin: null, temporary: 'NONE', temporaryEmail: null });
  });

  it('2. generating gives a real temporary EMAIL and PASSWORD — exactly the pair Supabase was given', async () => {
    session = { id: ADMIN_AUTH };
    const generated = await svc.generateTempAccess(app, state.clientId, state.adminId);
    expect(generated.ok, generated.ok ? '' : generated.message).toBe(true);
    if (!generated.ok) return;
    state.email = generated.data.email;

    expect(generated.data.email).toMatch(TEMP_EMAIL);
    expect(generated.data.password).toMatch(TEMP_PASSWORD);
    expect(idp.minted).toHaveLength(1);
    expect(idp.minted[0]).toMatchObject({ email: generated.data.email, password: generated.data.password });
    state.tempAuth = idp.minted[0]!.authUserId;

    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId }, include: { user: true } });
    expect(access).toMatchObject({ status: 'TEMPORARY_ACTIVE', loginId: generated.data.email, tempAuthId: state.tempAuth });
    // The owner User exists, with NO login of its own yet.
    expect(access.user.authProviderId).toBeNull();
    expect(access.user.isPlatformAdmin).toBe(false);
    state.ownerUserId = access.userId;
    expect(await owner.membership.findMany({ where: { clientId: state.clientId } })).toEqual([
      expect.objectContaining({ userId: state.ownerUserId, role: 'BUSINESS_OWNER', status: 'ACTIVE' }),
    ]);

    // The password is in no column anywhere.
    expect(JSON.stringify(await owner.accountAccess.findMany())).not.toContain(generated.data.password);
    expect(JSON.stringify(await owner.user.findMany())).not.toContain(generated.data.password);

    expect(await svc.getAdminAccessView(app, state.clientId)).toEqual({
      ownLogin: null,
      temporary: 'ACTIVE',
      temporaryEmail: generated.data.email,
    });

    // Never a second one while this one is on.
    expect((await svc.generateTempAccess(app, state.clientId, state.adminId)).ok).toBe(false);
    expect(idp.minted).toHaveLength(1);
  });

  it('3. the temporary login opens that business only, landing on Account to set up', async () => {
    session = { id: state.tempAuth };
    // What sign-in does with the identity Supabase verified: no new User, and
    // the synthetic address never lands on the owner's record.
    const signedIn = await svc.provisionUser(app, { providerId: state.tempAuth, email: state.email });
    expect(signedIn).toEqual({ userId: state.ownerUserId, created: false });

    const actor = await svc.loadActor(app, state.tempAuth);
    expect(actor?.userId).toBe(state.ownerUserId);
    expect(actor?.temporaryAccessClientId).toBe(state.clientId);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.clientId}/account`);

    expect(await visibleClients(state.tempAuth)).toEqual([state.clientId]);
    session = { id: state.tempAuth };
    expect(await app.client.findUnique({ where: { id: state.otherClientId } })).toBeNull();
  });

  it('4. setup records the owner’s OWN login on the same User — refused when anything is wrong', async () => {
    session = { id: state.tempAuth };
    const base = { name: 'Asha', phone: '', email: 'owner@lifecycle.test', password: 'a-strong-password', confirmPassword: 'a-strong-password' };
    const validate = (input: Partial<typeof base>, clientId = state.clientId, sessionAuth = state.tempAuth) =>
      svc.validateAccountSetup(app, state.ownerUserId, clientId, sessionAuth, { ...base, ...input });

    expect((await validate({ confirmPassword: 'different' })).ok).toBe(false);
    expect((await validate({ password: 'short', confirmPassword: 'short' })).ok).toBe(false);
    expect((await validate({ email: '' })).ok).toBe(false);
    expect((await validate({ email: state.email })).ok).toBe(false);
    expect((await validate({ password: 'Kq7m-x3pa-9fne-t2wd', confirmPassword: 'Kq7m-x3pa-9fne-t2wd' })).ok).toBe(false);
    expect((await validate({}, state.otherClientId)).ok).toBe(false);
    expect((await validate({}, state.clientId, OTHER_AUTH)).ok).toBe(false);

    // KNOWN LIMIT, pinned: under the runtime role an owner cannot see another
    // tenant's User row, so this pre-check misses the clash; Supabase refuses
    // the address itself when the action creates the login (EMAIL_TAKEN, see
    // tests/m39.account-setup-action.test.ts).
    expect((await validate({ email: 'owner@other.test' })).ok).toBe(true);

    const counts = async () => ({
      users: await owner.user.count(),
      memberships: await owner.membership.count(),
      clients: await owner.client.count(),
    });
    const before = await counts();

    const valid = await validate({});
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    // The action creates the own login in Supabase (unconfirmed), then commits.
    idp.own.set(OWN_AUTH, { email: 'owner@lifecycle.test', confirmed: false });
    expect(await svc.finalizeAccountSetup(app, state.ownerUserId, state.tempAuth, valid.data, OWN_AUTH)).toBe(true);

    const user = await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } });
    expect(user.authProviderId).toBe(OWN_AUTH);
    expect(user.email).toBe('owner@lifecycle.test');
    const client = await owner.client.findUniqueOrThrow({ where: { id: state.clientId } });
    expect(client).toMatchObject({ ownerName: 'Asha', ownerEmail: 'owner@lifecycle.test' });
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } });
    expect(access).toMatchObject({ status: 'TEMPORARY_ACTIVE', tempAuthId: state.tempAuth });
    expect(access.setupCompletedAt).not.toBeNull();
    expect(await counts()).toEqual(before);

    session = { id: ADMIN_AUTH };
    expect(await svc.getAdminAccessView(app, state.clientId)).toEqual({
      ownLogin: { email: 'owner@lifecycle.test', confirmed: false },
      temporary: 'ACTIVE',
      temporaryEmail: state.email,
    });
  });

  it('5. once confirmed, the owner’s own login opens the same business — and the temporary one still does too', async () => {
    idp.own.set(OWN_AUTH, { email: 'owner@lifecycle.test', confirmed: true });

    session = { id: OWN_AUTH };
    const signedIn = await svc.provisionUser(app, { providerId: OWN_AUTH, email: 'owner@lifecycle.test' });
    expect(signedIn).toEqual({ userId: state.ownerUserId, created: false });
    const own = await svc.loadActor(app, OWN_AUTH);
    expect(own?.userId).toBe(state.ownerUserId);
    expect(own?.temporaryAccessClientId).toBeNull();
    expect(svc.landingPathFor(own!)).toBe(`/workspace/${state.clientId}`);
    expect(await visibleClients(OWN_AUTH)).toEqual([state.clientId]);

    // The temporary login is still on (an admin decides when it goes), and no
    // longer sends anyone to setup.
    session = { id: state.tempAuth };
    await svc.provisionUser(app, { providerId: state.tempAuth, email: state.email });
    expect((await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).email).toBe('owner@lifecycle.test');
    const temp = await svc.loadActor(app, state.tempAuth);
    expect(temp?.userId).toBe(state.ownerUserId);
    expect(svc.landingPathFor(temp!)).toBe(`/workspace/${state.clientId}`);

    expect(await owner.user.count({ where: { id: state.ownerUserId } })).toBe(1);
    expect(await owner.membership.count({ where: { clientId: state.clientId } })).toBe(1);
  });

  it('6. disabling temporary access shuts the temporary login and never the owner’s own', async () => {
    session = { id: ADMIN_AUTH };
    expect((await svc.disableTempAccess(app, state.clientId, state.adminId)).ok).toBe(true);
    expect(idp.scrambled).toEqual([state.tempAuth]);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } })).status).toBe('DISABLED');

    // The temporary login: nobody, in the app and in the database itself.
    session = { id: state.tempAuth };
    expect(await svc.loadActor(app, state.tempAuth)).toBeNull();
    expect(await visibleClients(state.tempAuth)).toEqual([]);

    // The owner's own login: exactly as before.
    session = { id: OWN_AUTH };
    expect((await svc.loadActor(app, OWN_AUTH))?.userId).toBe(state.ownerUserId);
    expect(await visibleClients(OWN_AUTH)).toEqual([state.clientId]);

    session = { id: ADMIN_AUTH };
    expect((await svc.getAdminAccessView(app, state.clientId)).temporary).toBe('DISABLED');
    expect((await svc.disableTempAccess(app, state.clientId, state.adminId)).ok).toBe(false);
  });

  it('7. enabling it again: the same temporary email, a new password — the owner’s own login untouched', async () => {
    session = { id: ADMIN_AUTH };
    const mintedBefore = idp.minted.length;
    const again = await svc.generateTempAccess(app, state.clientId, state.adminId);
    expect(again.ok, again.ok ? '' : again.message).toBe(true);
    if (!again.ok) return;
    expect(again.data.email).toBe(state.email);
    expect(again.data.password).toMatch(TEMP_PASSWORD);
    expect(idp.minted).toHaveLength(mintedBefore);
    expect(idp.passwords.at(-1)).toEqual({ authUserId: state.tempAuth, password: again.data.password });

    expect((await svc.getAdminAccessView(app, state.clientId)).temporary).toBe('ACTIVE');
    session = { id: state.tempAuth };
    expect((await svc.loadActor(app, state.tempAuth))?.userId).toBe(state.ownerUserId);
    session = { id: OWN_AUTH };
    expect((await svc.loadActor(app, OWN_AUTH))?.userId).toBe(state.ownerUserId);
    expect(idp.passwords.some((p) => p.authUserId === OWN_AUTH)).toBe(false);
    expect(await owner.membership.count({ where: { clientId: state.clientId } })).toBe(1);
  });

  it('8. before setup: disabling really shuts the business, and enabling reopens it — nothing deleted', async () => {
    const clientId = await newClient('Never Set Up');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    const tempAuth = idp.minted.at(-1)!.authUserId;
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });

    expect(await visibleClients(tempAuth)).toEqual([clientId]);

    session = { id: ADMIN_AUTH };
    expect((await svc.disableTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    session = { id: tempAuth };
    expect(await svc.loadActor(app, tempAuth)).toBeNull();
    expect(await visibleClients(tempAuth)).toEqual([]);
    session = { id: tempAuth };
    expect(
      (await svc.validateAccountSetup(app, access.userId, clientId, tempAuth, {
        name: '', phone: '', email: 'late@owner.test', password: 'a-strong-password', confirmPassword: 'a-strong-password',
      })).ok,
    ).toBe(false);
    expect(await owner.user.count({ where: { id: access.userId } })).toBe(1);
    expect(await owner.membership.count({ where: { clientId, status: 'ACTIVE' } })).toBe(1);

    session = { id: ADMIN_AUTH };
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    expect(await visibleClients(tempAuth)).toEqual([clientId]);
  });

  it('9. a business that already has its own owner: a temporary login into that same account', async () => {
    session = { id: ADMIN_AUTH };
    expect((await svc.getAdminAccessView(app, state.otherClientId)).temporary).toBe('NONE');
    const users = await owner.user.count();
    const generated = await svc.generateTempAccess(app, state.otherClientId, state.adminId);
    expect(generated.ok, generated.ok ? '' : generated.message).toBe(true);
    const tempAuth = idp.minted.at(-1)!.authUserId;
    expect(await owner.user.count()).toBe(users);
    expect(await owner.membership.count({ where: { clientId: state.otherClientId } })).toBe(1);

    session = { id: tempAuth };
    const actor = await svc.loadActor(app, tempAuth);
    expect(actor?.userId).toBe(state.otherUserId);
    // Nothing to set up: the owner already signs in with their own email.
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.otherClientId}`);

    session = { id: ADMIN_AUTH };
    expect((await svc.disableTempAccess(app, state.otherClientId, state.adminId)).ok).toBe(true);
    expect(await visibleClients(tempAuth)).toEqual([]);
    expect(await visibleClients(OTHER_AUTH)).toEqual([state.otherClientId]);
  });

  it('10. a row with no temporary login left is given a fresh one — and only platform staff can point it', async () => {
    const clientId = await newClient('From Before M52');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    // The shape the M52 migration leaves when an old temporary login had
    // become the owner's own: no temporary identity, switched off.
    await owner.user.update({ where: { id: access.userId }, data: { authProviderId: '77777777-7777-4777-8777-777777777777' } });
    await owner.accountAccess.update({ where: { clientId }, data: { tempAuthId: null, status: 'DISABLED' } });

    // Not a business owner's to do, even for their own row.
    session = { id: '77777777-7777-4777-8777-777777777777' };
    await expect(
      app.$executeRaw`SELECT app.rebind_temp_access(${clientId}, ${'88888888-8888-4888-8888-888888888888'}, ${'x@access.headway.local'})`,
    ).rejects.toThrow(/not authorised/);

    session = { id: ADMIN_AUTH };
    const enabled = await svc.generateTempAccess(app, clientId, state.adminId);
    expect(enabled.ok, enabled.ok ? '' : enabled.message).toBe(true);
    if (!enabled.ok) return;
    expect(enabled.data.email).not.toBe(access.loginId);
    const fresh = idp.minted.at(-1)!;
    expect(fresh.email).toBe(enabled.data.email);
    const row = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    expect(row).toMatchObject({ tempAuthId: fresh.authUserId, loginId: enabled.data.email, status: 'TEMPORARY_ACTIVE' });
    session = { id: fresh.authUserId };
    expect((await svc.loadActor(app, fresh.authUserId))?.userId).toBe(access.userId);
  });

  it('11. two admins generating at once leave exactly one login, and no orphaned user or identity', async () => {
    const clientId = await newClient('Double Click');
    const mintedBefore = idp.minted.length;
    const deletedBefore = idp.deleted.length;
    const usersBefore = await owner.user.count();
    session = { id: ADMIN_AUTH };
    // Both requests must pass the "nothing exists yet" check before either
    // writes — a real double click, not two clicks in a row.
    let release = () => {};
    const ready = new Promise<void>((resolve) => (release = resolve));
    idp.rendezvous = { waiting: 0, of: 2, release, ready };

    const results = await Promise.all([
      svc.generateTempAccess(app, clientId, state.adminId),
      svc.generateTempAccess(app, clientId, state.adminId),
    ]);
    idp.rendezvous = null;

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const minted = idp.minted.slice(mintedBefore);
    expect(minted).toHaveLength(2);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    const loser = minted.find((m) => m.authUserId !== access.tempAuthId)!;
    expect(idp.deleted.slice(deletedBefore)).toEqual([loser.authUserId]);
    expect(await owner.user.count()).toBe(usersBefore + 1);
    expect(await owner.membership.count({ where: { clientId } })).toBe(1);
  });

  it('12. a self-serve owner signs up, onboards, and lands in their own business only', async () => {
    session = { id: SELF_AUTH };
    const signedUp = await svc.provisionUser(app, { providerId: SELF_AUTH, email: 'self@serve.test' });
    expect(signedUp.created).toBe(true);
    expect(svc.landingPathFor((await svc.loadActor(app, SELF_AUTH))!)).toBe('/onboarding');

    const onboarded = await svc.completeOnboarding(app, signedUp.userId, {
      businessName: 'Self Serve Studio',
      vertical: 'coaching',
      areaLabel: 'Pune',
      ownerName: 'Ravi',
      ownerPhone: '',
      context: '',
    });
    expect(onboarded.ok, onboarded.ok ? '' : onboarded.message).toBe(true);
    if (!onboarded.ok) return;
    expect(svc.landingPathFor((await svc.loadActor(app, SELF_AUTH))!)).toBe(`/workspace/${onboarded.data.clientId}`);
    expect(await visibleClients(SELF_AUTH)).toEqual([onboarded.data.clientId]);
    // And the first business's owner still sees only their own.
    expect(await visibleClients(OWN_AUTH)).toEqual([state.clientId]);
  });
});
