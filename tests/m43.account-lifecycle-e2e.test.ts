import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb, validClientInput } from './helpers/test-db';

/**
 * EVERY ACCOUNT PATH, IN THE ORDER IT HAPPENS (M43, M52).
 *
 * Each step below already has its own tests. This file proves they work
 * TOGETHER, one after another — against a real Postgres with the shipped
 * `rls.sql`, through the real `src/lib/db.ts`, connected as `repos_app`, the
 * role production runs as. Only the Supabase network edge is stubbed: who the
 * session says is signed in, and the Auth admin API that mints, re-passwords,
 * scrambles and deletes identities.
 *
 *   1. the platform admin adds a client
 *   2. the admin generates a temporary EMAIL and PASSWORD — sends no email
 *   3. the temporary owner lands on Account, in that business, seeing no other
 *   4. setup: same User, Membership and Client; email waits for its link
 *   5. the confirmed email signs in as the same person; setup cannot rerun
 *   6. after setup there is no temporary access left to disable
 *   7. disabling BEFORE setup: the row, the password, and any live session
 *   8. new temporary access after a disable reuses the same identity
 *   9. a business with its own owner account is never given a second one
 *  10. two admins generating at once leave one login and no orphans
 *  11. a self-serve owner signs up, onboards, and lands in their own business
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
  getIdentitySnapshot: async () => ({ email: 'xxxxxxxx@access.headway.local', pendingEmail: 'owner@lifecycle.test', lastSignInAt: null }),
}));

const ADMIN_AUTH = '11111111-1111-4111-8111-111111111111';
const OTHER_AUTH = '44444444-4444-4444-8444-444444444444';
const SELF_AUTH = '55555555-5555-4555-8555-555555555555';

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
  tempUserId: '',
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
    expect(row.trialEndsAt).not.toBeNull();
    expect(row.gateway?.publicToken).toMatch(/^[a-z0-9]{22}$/);
    expect(row.memberships).toHaveLength(0);

    session = { id: ADMIN_AUTH };
    expect((await svc.getAdminAccessView(app, state.clientId)).status).toBe('NONE');
  });

  it('only a platform admin can add a client that way', async () => {
    session = { id: OTHER_AUTH };
    const refused = await svc.createClient(app, validClientInput({ businessName: 'Not Allowed', vertical: 'gym' }));
    expect(refused.ok).toBe(false);
    expect(await owner.client.count({ where: { businessName: 'Not Allowed' } })).toBe(0);
  });

  it('2. the admin generates a temporary EMAIL and PASSWORD — the exact pair Supabase was given', async () => {
    session = { id: ADMIN_AUTH };
    const generated = await svc.generateTempAccess(app, state.clientId, state.adminId);
    expect(generated.ok, generated.ok ? '' : generated.message).toBe(true);
    if (!generated.ok) return;
    state.email = generated.data.email;

    expect(generated.data.email).toMatch(TEMP_EMAIL);
    expect(generated.data.password).toMatch(TEMP_PASSWORD);
    expect(generated.data.password).toMatch(/[A-Z]/);
    expect(idp.minted).toHaveLength(1);
    expect(idp.minted[0]).toMatchObject({ email: generated.data.email, password: generated.data.password });
    state.tempAuth = idp.minted[0]!.authUserId;

    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId }, include: { user: true } });
    expect(access.status).toBe('TEMPORARY_ACTIVE');
    expect(access.loginId).toBe(generated.data.email);
    expect(access.createdByUserId).toBe(state.adminId);
    expect(access.user.email).toBe(generated.data.email);
    expect(access.user.authProviderId).toBe(state.tempAuth);
    expect(access.user.isPlatformAdmin).toBe(false);
    state.tempUserId = access.userId;

    // The password is in no column anywhere: only the email is stored.
    expect(JSON.stringify(access)).not.toContain(generated.data.password);
    expect(JSON.stringify(await owner.user.findMany())).not.toContain(generated.data.password);

    const memberships = await owner.membership.findMany({ where: { userId: state.tempUserId } });
    expect(memberships).toEqual([expect.objectContaining({ clientId: state.clientId, role: 'BUSINESS_OWNER', status: 'ACTIVE' })]);

    const view = await svc.getAdminAccessView(app, state.clientId);
    expect(view).toMatchObject({ status: 'TEMPORARY_ACTIVE', temporaryEmail: generated.data.email });

    // Never a second credential while this one is active.
    const again = await svc.generateTempAccess(app, state.clientId, state.adminId);
    expect(again.ok).toBe(false);
    expect(idp.minted).toHaveLength(1);
    expect(await owner.accountAccess.count({ where: { clientId: state.clientId } })).toBe(1);
  });

  it('3. the temporary owner lands on Account in their business, and can see no other', async () => {
    session = { id: state.tempAuth };
    const actor = await svc.loadActor(app, state.tempAuth);
    expect(actor?.userId).toBe(state.tempUserId);
    expect(actor?.isPlatformAdmin).toBe(false);
    expect(actor?.setupPendingClientId).toBe(state.clientId);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.clientId}/account`);

    expect((await app.client.findMany({ select: { id: true } })).map((c) => c.id)).toEqual([state.clientId]);
    expect(await app.client.findUnique({ where: { id: state.otherClientId } })).toBeNull();
    expect(await app.accountAccess.findMany({ select: { clientId: true } })).toEqual([{ clientId: state.clientId }]);
  });

  it('4. setup: refused when wrong; then committed on the same User, Membership and Client', async () => {
    session = { id: state.tempAuth };
    const base = { name: 'Asha', phone: '', email: 'owner@lifecycle.test', password: 'a-strong-password', confirmPassword: 'a-strong-password' };

    const mismatch = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, confirmPassword: 'different' });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.errors.confirmPassword).toBeDefined();
    const short = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, password: 'short', confirmPassword: 'short' });
    expect(short.ok).toBe(false);
    const blank = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, email: '' });
    expect(blank.ok).toBe(false);
    const temporary = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, email: state.email });
    expect(temporary.ok).toBe(false);

    // KNOWN LIMIT, pinned so it cannot change silently: under the runtime role
    // an owner cannot see another tenant's User row, so RepOS's own pre-check
    // for "that email belongs to someone else" does not see the clash. The
    // refusal comes from Supabase instead (email_exists, when the owner's own
    // session asks for the change — see tests/m39.account-setup-action.test.ts).
    // That is only sound while every User row has a Supabase identity.
    const taken = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, email: 'owner@other.test' });
    expect(taken.ok).toBe(true);
    expect(await owner.user.count({ where: { authProviderId: null } })).toBe(0);

    // Nor for a business this temporary access is not bound to.
    const wrongClient = await svc.validateAccountSetup(app, state.tempUserId, state.otherClientId, base);
    expect(wrongClient.ok).toBe(false);

    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } })).status).toBe('TEMPORARY_ACTIVE');

    const counts = async () => ({
      users: await owner.user.count(),
      memberships: await owner.membership.count(),
      clients: await owner.client.count(),
    });
    const before = await counts();

    const valid = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, base);
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    // The action sets the password on the owner's own session first, then commits.
    expect(await svc.finalizeAccountSetup(app, state.tempUserId, valid.data)).toBe(true);

    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } });
    expect(access.status).toBe('SETUP_COMPLETE');
    expect(access.setupCompletedAt).not.toBeNull();
    const user = await owner.user.findUniqueOrThrow({ where: { id: state.tempUserId } });
    // The sign-in email moves only when the owner opens the confirmation link.
    expect(user.email).toBe(state.email);
    expect(user.authProviderId).toBe(state.tempAuth);
    const client = await owner.client.findUniqueOrThrow({ where: { id: state.clientId } });
    expect(client.ownerName).toBe('Asha');
    // The contact email waits for Supabase to accept it (the action does that).
    expect(client.ownerEmail).toBeNull();
    expect(await counts()).toEqual(before);

    session = { id: ADMIN_AUTH };
    const view = await svc.getAdminAccessView(app, state.clientId);
    expect(view.status).toBe('SETUP_COMPLETE');
    expect(view.pendingEmail).toBe('owner@lifecycle.test');
  });

  it('5. once confirmed, the new email signs in as the same person, in the same business', async () => {
    session = { id: state.tempAuth };
    // What the callback and signInAction do with the verified identity after
    // the owner opens the link: Supabase now says the real address.
    const signedIn = await svc.provisionUser(app, { providerId: state.tempAuth, email: 'owner@lifecycle.test' });
    expect(signedIn.userId).toBe(state.tempUserId);
    expect(signedIn.created).toBe(false);
    expect((await owner.user.findUniqueOrThrow({ where: { id: state.tempUserId } })).email).toBe('owner@lifecycle.test');

    const actor = await svc.loadActor(app, state.tempAuth);
    expect(actor?.setupPendingClientId).toBeNull();
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.clientId}`);
    expect(await owner.user.count({ where: { authProviderId: state.tempAuth } })).toBe(1);
    expect(await owner.membership.count({ where: { userId: state.tempUserId } })).toBe(1);

    const twice = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, {
      name: '', phone: '', email: 'again@lifecycle.test', password: 'another-password', confirmPassword: 'another-password',
    });
    expect(twice.ok).toBe(false);
  });

  it('6. after setup there is no temporary access to disable — and nothing is scrambled', async () => {
    session = { id: ADMIN_AUTH };
    const refused = await svc.disableTempAccess(app, state.clientId, state.adminId);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/already set up/);
    expect(idp.scrambled).toEqual([]);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } })).status).toBe('SETUP_COMPLETE');

    session = { id: state.tempAuth };
    expect(await svc.loadActor(app, state.tempAuth)).not.toBeNull();

    // Nor can new temporary access be issued over a set-up account.
    session = { id: ADMIN_AUTH };
    expect((await svc.generateTempAccess(app, state.clientId, state.adminId)).ok).toBe(false);
    expect(idp.minted).toHaveLength(1);
  });

  it('7. disabling BEFORE setup: DISABLED first, then the password scrambled, and a live session is refused', async () => {
    const clientId = await newClient('Never Set Up');
    const generated = await svc.generateTempAccess(app, clientId, state.adminId);
    expect(generated.ok).toBe(true);
    const authUserId = idp.minted.at(-1)!.authUserId;
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });

    // The temporary owner is signed in somewhere.
    session = { id: authUserId };
    expect(await svc.loadActor(app, authUserId)).not.toBeNull();

    session = { id: ADMIN_AUTH };
    const disabled = await svc.disableTempAccess(app, clientId, state.adminId);
    expect(disabled.ok).toBe(true);
    expect(idp.scrambled).toEqual([authUserId]);
    const row = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    expect(row.status).toBe('DISABLED');
    expect(row.disabledByUserId).toBe(state.adminId);
    expect((await svc.getAdminAccessView(app, clientId)).status).toBe('DISABLED');

    // That same browser, still holding its session: nobody, everywhere.
    session = { id: authUserId };
    expect(await svc.loadActor(app, authUserId)).toBeNull();
    const setup = await svc.validateAccountSetup(app, access.userId, clientId, {
      name: '', phone: '', email: 'late@owner.test', password: 'a-strong-password', confirmPassword: 'a-strong-password',
    });
    expect(setup.ok).toBe(false);

    // Nothing was deleted to do it.
    expect(await owner.user.count({ where: { id: access.userId } })).toBe(1);
    expect(await owner.membership.count({ where: { userId: access.userId, clientId, status: 'ACTIVE' } })).toBe(1);
    expect(await owner.client.count({ where: { id: clientId } })).toBe(1);

    session = { id: ADMIN_AUTH };
    expect((await svc.disableTempAccess(app, clientId, state.adminId)).ok).toBe(false);
  });

  it('7b. never scrambles a login that already uses the owner’s own address (an older half-finished setup)', async () => {
    const clientId = await newClient('Half Set Up');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    await owner.user.update({ where: { id: access.userId }, data: { email: 'real-owner@halfsetup.test' } });
    const scrambledBefore = idp.scrambled.length;

    const refused = await svc.disableTempAccess(app, clientId, state.adminId);
    expect(refused.ok).toBe(false);
    expect(idp.scrambled).toHaveLength(scrambledBefore);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId } })).status).toBe('TEMPORARY_ACTIVE');
    // Shown as what it is: the owner's own login, not temporary access — and
    // the owner is not sent to a setup form that would no longer show.
    expect((await svc.getAdminAccessView(app, clientId)).status).toBe('SETUP_COMPLETE');
    session = { id: idp.minted.at(-1)!.authUserId };
    const actor = await svc.loadActor(app, idp.minted.at(-1)!.authUserId);
    expect(actor?.setupPendingClientId).toBeNull();
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${clientId}`);
  });

  it('7c. an older DISABLED flag never locks out an owner whose login is already their own', async () => {
    // The shape an earlier version could leave: setup moved the email in
    // Supabase, was never recorded, and an admin then "disabled" the row.
    const clientId = await newClient('Disabled Before The Fix');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    const authUserId = idp.minted.at(-1)!.authUserId;
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    await owner.user.update({ where: { id: access.userId }, data: { email: 'real-owner@olddisable.test' } });
    await owner.accountAccess.update({ where: { clientId }, data: { status: 'DISABLED', disabledAt: new Date() } });

    session = { id: authUserId };
    const actor = await svc.loadActor(app, authUserId);
    expect(actor?.userId).toBe(access.userId);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${clientId}`);

    session = { id: ADMIN_AUTH };
    expect((await svc.getAdminAccessView(app, clientId)).status).toBe('SETUP_COMPLETE');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(false);
  });

  it('8. new temporary access after a disable: the same email and identity, a brand-new password', async () => {
    const clientId = await newClient('Lost The Slip');
    const first = await svc.generateTempAccess(app, clientId, state.adminId);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const authUserId = idp.minted.at(-1)!.authUserId;
    const mintedBefore = idp.minted.length;
    expect((await svc.disableTempAccess(app, clientId, state.adminId)).ok).toBe(true);

    const second = await svc.generateTempAccess(app, clientId, state.adminId);
    expect(second.ok, second.ok ? '' : second.message).toBe(true);
    if (!second.ok) return;
    expect(second.data.email).toBe(first.data.email);
    expect(second.data.password).toMatch(TEMP_PASSWORD);
    expect(second.data.password).not.toBe(first.data.password);
    expect(idp.minted).toHaveLength(mintedBefore);
    expect(idp.passwords.at(-1)).toEqual({ authUserId, password: second.data.password });

    const row = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    expect(row.status).toBe('TEMPORARY_ACTIVE');
    expect(row.disabledAt).toBeNull();
    expect(row.disabledByUserId).toBeNull();
    expect(await owner.membership.count({ where: { clientId } })).toBe(1);
    expect(await owner.user.count({ where: { authProviderId: authUserId } })).toBe(1);

    session = { id: authUserId };
    expect(svc.landingPathFor((await svc.loadActor(app, authUserId))!)).toBe(`/workspace/${clientId}/account`);
  });

  it('9. a business with its own owner account is never given temporary access', async () => {
    session = { id: ADMIN_AUTH };
    const view = await svc.getAdminAccessView(app, state.otherClientId);
    expect(view.status).toBe('NONE');
    expect(view.ownerAccount?.email).toBe('owner@other.test');

    const mintedBefore = idp.minted.length;
    const refused = await svc.generateTempAccess(app, state.otherClientId, state.adminId);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/already has an owner account/);
    expect(idp.minted).toHaveLength(mintedBefore);
    expect(await owner.membership.count({ where: { clientId: state.otherClientId } })).toBe(1);
  });

  it('9b. ...including one whose old temporary access was disabled after an owner joined', async () => {
    const clientId = await newClient('Owner Joined Later');
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    expect((await svc.disableTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    await owner.membership.create({ data: { userId: state.otherUserId, clientId, role: 'BUSINESS_OWNER', status: 'ACTIVE' } });

    session = { id: ADMIN_AUTH };
    const view = await svc.getAdminAccessView(app, clientId);
    expect(view).toMatchObject({ status: 'DISABLED', ownerAccount: { email: 'owner@other.test' } });
    const passwordsBefore = idp.passwords.length;
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(false);
    expect(idp.passwords).toHaveLength(passwordsBefore);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId } })).status).toBe('DISABLED');
  });

  it('10. two admins generating at once leave exactly one login, and no orphaned user or identity', async () => {
    const clientId = await newClient('Double Click');
    const mintedBefore = idp.minted.length;
    const deletedBefore = idp.deleted.length;
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
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    const minted = idp.minted.slice(mintedBefore);
    expect(minted).toHaveLength(2);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
    const loser = minted.find((m) => m.authUserId !== access.user.authProviderId)!;
    // The losing identity is deleted in Supabase, and its User row is gone too.
    expect(idp.deleted.slice(deletedBefore)).toEqual([loser.authUserId]);
    expect(await owner.user.count({ where: { authProviderId: loser.authUserId } })).toBe(0);
    expect(await owner.membership.count({ where: { clientId } })).toBe(1);
    expect(await owner.user.count({ where: { email: { endsWith: '@access.headway.local' }, memberships: { none: {} } } })).toBe(0);
  });

  it('11. a self-serve owner signs up, onboards, and lands in their own business only', async () => {
    session = { id: SELF_AUTH };
    const signedUp = await svc.provisionUser(app, { providerId: SELF_AUTH, email: 'self@serve.test' });
    expect(signedUp.created).toBe(true);
    const fresh = await svc.loadActor(app, SELF_AUTH);
    expect(svc.landingPathFor(fresh!)).toBe('/onboarding');

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

    const actor = await svc.loadActor(app, SELF_AUTH);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${onboarded.data.clientId}`);
    expect((await app.client.findMany({ select: { id: true } })).map((c) => c.id)).toEqual([onboarded.data.clientId]);
    const client = await owner.client.findUniqueOrThrow({ where: { id: onboarded.data.clientId }, include: { gateway: true, memberships: true } });
    expect(client.setupCompletedAt).not.toBeNull();
    expect(client.gateway?.publicToken).toBe(onboarded.data.publicToken);
    expect(client.memberships).toEqual([expect.objectContaining({ userId: signedUp.userId, role: 'BUSINESS_OWNER', status: 'ACTIVE' })]);

    // And the admin-made business's owner still sees only their own.
    session = { id: state.tempAuth };
    expect((await app.client.findMany({ select: { id: true } })).map((c) => c.id)).toEqual([state.clientId]);
  });
});
