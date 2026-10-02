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
  passwords: [] as Array<{ authUserId: string; password: string; email?: string }>,
  scrambled: [] as string[],
  scrambledTo: [] as Array<string | undefined>,
  deleted: [] as string[],
  own: new Map<string, { email: string; confirmed: boolean; confirmationSent: boolean }>(),
  n: 0,
  /** When true, Supabase cannot be asked (a network error, a 5xx). */
  unreachable: false,
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
  setIdentityPassword: async (authUserId: string, password: string, options: { email?: string } = {}) => {
    idp.passwords.push({ authUserId, password, ...(options.email ? { email: options.email } : {}) });
    return { ok: true };
  },
  randomizeIdentityPassword: async (authUserId: string, email?: string) => {
    idp.scrambled.push(authUserId);
    idp.scrambledTo.push(email);
  },
  deleteIdentity: async (authUserId: string) => {
    idp.deleted.push(authUserId);
  },
  IDENTITY_MISSING: 'missing',
  getIdentitySnapshot: async (authUserId: string) => {
    if (idp.unreachable) return null;
    const own = idp.own.get(authUserId);
    return own ? { ...own, lastSignInAt: null } : 'missing';
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
  otherTempAuth: '',
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
    expect(await svc.getAdminAccessView(app, state.clientId)).toEqual({
      ownLogin: null,
      temporary: 'NONE',
      temporaryEmail: null,
      temporaryBlocked: null,
    });
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
      temporaryBlocked: null,
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

    // Another tenant's account holds this address. Under RLS the temporary
    // login cannot see that User, so app.owner_email_taken answers instead —
    // before any login is made, not only once the owner has confirmed.
    const clash = await validate({ email: 'owner@other.test' });
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.errors.email).toMatch(/already in use/);

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
    idp.own.set(OWN_AUTH, { email: 'owner@lifecycle.test', confirmed: false, confirmationSent: true });
    expect(await svc.finalizeAccountSetup(app, state.ownerUserId, state.tempAuth, valid.data, OWN_AUTH)).toBe('recorded');

    const user = await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } });
    expect(user.authProviderId).toBe(OWN_AUTH);
    // The User's email moves only once the address is confirmed (step 5).
    expect(user.email).toBe(state.email);
    const client = await owner.client.findUniqueOrThrow({ where: { id: state.clientId } });
    expect(client).toMatchObject({ ownerName: 'Asha', ownerEmail: 'owner@lifecycle.test' });
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } });
    expect(access).toMatchObject({ status: 'TEMPORARY_ACTIVE', tempAuthId: state.tempAuth });
    expect(access.setupCompletedAt).not.toBeNull();
    expect(await counts()).toEqual(before);

    session = { id: ADMIN_AUTH };
    expect(await svc.getAdminAccessView(app, state.clientId)).toEqual({
      ownLogin: { email: 'owner@lifecycle.test', confirmed: false, confirmationSent: true },
      temporary: 'ACTIVE',
      temporaryEmail: state.email,
      temporaryBlocked: null,
    });
  });

  it('5. once confirmed, the owner’s own login opens the same business — and the temporary one still does too', async () => {
    idp.own.set(OWN_AUTH, { email: 'owner@lifecycle.test', confirmed: true, confirmationSent: true });

    session = { id: OWN_AUTH };
    const signedIn = await svc.provisionUser(app, { providerId: OWN_AUTH, email: 'owner@lifecycle.test' });
    expect(signedIn).toEqual({ userId: state.ownerUserId, created: false });
    // The confirmed address is now the User's.
    expect((await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).email).toBe('owner@lifecycle.test');
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
    // ...and the Headway-made address back with it, wherever a holder moved it.
    expect(idp.scrambledTo).toEqual([state.email]);
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
    expect(idp.passwords.at(-1)).toEqual({ authUserId: state.tempAuth, password: again.data.password, email: state.email });

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
    state.otherTempAuth = tempAuth;
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
      app.$executeRaw`SELECT app.rebind_temp_access(${clientId}, ${null}, ${'88888888-8888-4888-8888-888888888888'}, ${'x@access.headway.local'})`,
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
  it('13. a temporary login opens ONE business, and never with staff authority', async () => {
    // Headway staff who own a business themselves are never given one.
    session = { id: ADMIN_AUTH };
    const staffBusiness = await svc.completeOnboarding(app, state.adminId, {
      businessName: 'Staff Owned',
      vertical: 'salon',
      areaLabel: '',
      ownerName: '',
      ownerPhone: '',
      context: '',
    });
    expect(staffBusiness.ok, staffBusiness.ok ? '' : staffBusiness.message).toBe(true);
    if (!staffBusiness.ok) return;
    const minted = idp.minted.length;
    const refused = await svc.generateTempAccess(app, staffBusiness.data.clientId, state.adminId);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/Headway staff/);
    expect(idp.minted).toHaveLength(minted);
    expect(await owner.accountAccess.count({ where: { clientId: staffBusiness.data.clientId } })).toBe(0);
    // ...and the panel says why, instead of offering a button that will refuse.
    expect((await svc.getAdminAccessView(app, staffBusiness.data.clientId)).temporaryBlocked).toBe('STAFF');

    // An owner who has since joined a second business: Enable refuses...
    const second = await owner.client.create({
      data: {
        businessName: 'Second Shop',
        vertical: 'gym',
        status: 'ACTIVE',
        memberships: { create: { userId: state.otherUserId, role: 'BUSINESS_STAFF', status: 'ACTIVE' } },
      },
      select: { id: true },
    });
    session = { id: ADMIN_AUTH };
    const enable = await svc.generateTempAccess(app, state.otherClientId, state.adminId);
    expect(enable.ok).toBe(false);
    if (!enable.ok) expect(enable.message).toMatch(/another business/);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.otherClientId } })).status).toBe('DISABLED');

    // ...and even a row left switched on opens nothing — in the app and in the
    // database — while the owner's own login opens both businesses as before.
    await owner.accountAccess.update({ where: { clientId: state.otherClientId }, data: { status: 'TEMPORARY_ACTIVE' } });
    session = { id: ADMIN_AUTH };
    // The panel never calls that login simply "active".
    expect(await svc.getAdminAccessView(app, state.otherClientId)).toMatchObject({
      temporary: 'ACTIVE',
      temporaryBlocked: 'OTHER_BUSINESS',
    });
    session = { id: state.otherTempAuth };
    expect(await svc.loadActor(app, state.otherTempAuth)).toBeNull();
    expect(await visibleClients(state.otherTempAuth)).toEqual([]);
    expect(await visibleClients(OTHER_AUTH)).toEqual([state.otherClientId, second.id].sort());
    await owner.accountAccess.update({ where: { clientId: state.otherClientId }, data: { status: 'DISABLED' } });
  });

  it('14. a row left switched on with no temporary login behind it is not stuck', async () => {
    const clientId = await newClient('Wedged Row');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    await owner.accountAccess.update({ where: { clientId }, data: { tempAuthId: null, status: 'TEMPORARY_ACTIVE' } });

    session = { id: ADMIN_AUTH };
    expect((await svc.getAdminAccessView(app, clientId)).temporary).toBe('DISABLED');
    const enabled = await svc.generateTempAccess(app, clientId, state.adminId);
    expect(enabled.ok, enabled.ok ? '' : enabled.message).toBe(true);
    const fresh = idp.minted.at(-1)!;
    expect(await owner.accountAccess.findUniqueOrThrow({ where: { clientId } })).toMatchObject({
      tempAuthId: fresh.authUserId,
      status: 'TEMPORARY_ACTIVE',
    });
    expect((await svc.getAdminAccessView(app, clientId)).temporary).toBe('ACTIVE');
  });

  it('15. two admins enabling such a row at once leave exactly one temporary login, and no orphan', async () => {
    const clientId = await newClient('Double Enable');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    await owner.accountAccess.update({ where: { clientId }, data: { tempAuthId: null, status: 'DISABLED' } });
    const mintedBefore = idp.minted.length;
    const deletedBefore = idp.deleted.length;

    session = { id: ADMIN_AUTH };
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
    const row = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    const winner = minted.find((m) => m.authUserId === row.tempAuthId);
    expect(winner).toBeDefined();
    const loser = minted.find((m) => m.authUserId !== row.tempAuthId)!;
    expect(idp.deleted.slice(deletedBefore)).toEqual([loser.authUserId]);
    expect(row.status).toBe('TEMPORARY_ACTIVE');
    const won = results.find((r) => r.ok);
    expect(won?.ok && won.data.email).toBe(winner!.email);
  });

  it('16. only platform staff can switch temporary access on or off — even straight at the database', async () => {
    // The owner, signed in with their own login, on their own row.
    session = { id: OWN_AUTH };
    await expect(
      app.accountAccess.updateMany({ where: { clientId: state.clientId }, data: { status: 'DISABLED' } }),
    ).rejects.toThrow(/only platform staff/);
    await expect(
      app.accountAccess.updateMany({ where: { clientId: state.clientId }, data: { disabledByUserId: state.ownerUserId } }),
    ).rejects.toThrow(/only platform staff/);
    // Their one legitimate write still goes through.
    expect(
      (await app.accountAccess.updateMany({ where: { clientId: state.clientId }, data: { setupCompletedAt: new Date() } }))
        .count,
    ).toBe(1);
  });

  it('17. an address-only sign-in never claims a User that has temporary access', async () => {
    const clientId = await newClient('Claim Guard');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
    expect(access.user.authProviderId).toBeNull();

    // Some other identity that happens to carry the same address.
    const stranger = '99999999-9999-4999-8999-999999999999';
    session = { id: stranger };
    // Refused outright: the address is the temporary-only User's, and that
    // User is never claimed by whichever identity carries it.
    await expect(svc.provisionUser(app, { providerId: stranger, email: access.loginId })).rejects.toThrow(
      /different account/,
    );
    expect((await owner.user.findUniqueOrThrow({ where: { id: access.userId } })).authProviderId).toBeNull();
    expect(await owner.user.count({ where: { authProviderId: stranger } })).toBe(0);
    expect(await visibleClients(stranger)).toEqual([]);
  });

  it('18. the admin is never told the owner has a sign-in that nobody could check, or that Headway made', async () => {
    session = { id: ADMIN_AUTH };
    // Supabase cannot be asked: unknown — not "confirmed".
    idp.unreachable = true;
    try {
      expect((await svc.getAdminAccessView(app, state.clientId)).ownLogin).toEqual({
        email: 'owner@lifecycle.test',
        confirmed: null,
        confirmationSent: false,
      });
    } finally {
      idp.unreachable = false;
    }
    // An own login still on a Headway-made address is no own login at all.
    idp.own.set(OWN_AUTH, { email: 'abcd2345@access.headway.local', confirmed: true, confirmationSent: false });
    expect((await svc.getAdminAccessView(app, state.clientId)).ownLogin).toBeNull();
    // Nor is one Supabase no longer has.
    idp.own.delete(OWN_AUTH);
    expect((await svc.getAdminAccessView(app, state.clientId)).ownLogin).toBeNull();
    idp.own.set(OWN_AUTH, { email: 'owner@lifecycle.test', confirmed: true, confirmationSent: true });
    expect((await svc.getAdminAccessView(app, state.clientId)).ownLogin).toEqual({
      email: 'owner@lifecycle.test',
      confirmed: true,
      confirmationSent: true,
    });
  });

  it('19. a temporary login whose address was moved away from the Headway-made one opens nothing', async () => {
    session = { id: ADMIN_AUTH };
    const clientId = await newClient('Moved Address');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    const tempAuth = access.tempAuthId!;
    session = { id: tempAuth };
    expect((await svc.loadActor(app, tempAuth, access.loginId))?.userId).toBe(access.userId);
    expect((await svc.loadActor(app, tempAuth, access.loginId.toUpperCase()))?.userId).toBe(access.userId);
    expect(await svc.loadActor(app, tempAuth, 'holder@elsewhere.test')).toBeNull();
    // The owner's own login is never judged by that rule.
    session = { id: OWN_AUTH };
    expect((await svc.loadActor(app, OWN_AUTH, 'owner@lifecycle.test'))?.userId).toBe(state.ownerUserId);
  });

  it('20. the address check for setup answers only for an owner whose temporary access is on', async () => {
    const { withRlsContext } = await import('@/lib/db');
    // As the app asks it: inside the request's own RLS context.
    const taken = async (authId: string, email: string) => {
      session = { id: authId };
      const rows = await withRlsContext(app, (tx) =>
        tx.$queryRaw<{ t: boolean }[]>`SELECT app.owner_email_taken(${email}) AS t`,
      );
      return rows[0]?.t;
    };
    // A business owner with no temporary access learns nothing, even about a
    // real address.
    expect(await taken(SELF_AUTH, 'owner@other.test')).toBe(false);
    // Through temporary access that is on: yes for another account's address,
    // no for a free one, no for one's own.
    const clientId = await newClient('Email Check');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    expect(await taken(access.tempAuthId!, 'owner@other.test')).toBe(true);
    expect(await taken(access.tempAuthId!, 'nobody@free.test')).toBe(false);
    expect(await taken(access.tempAuthId!, access.loginId)).toBe(false);
  });
});
