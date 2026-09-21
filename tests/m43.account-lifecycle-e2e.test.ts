import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb, validClientInput } from './helpers/test-db';

/**
 * EVERY ACCOUNT PATH, IN THE ORDER IT HAPPENS (M43).
 *
 * Each step below already has its own tests. This file proves they work
 * TOGETHER, one after another, on one business — against a real Postgres with
 * the shipped `rls.sql`, through the real `src/lib/db.ts`, connected as
 * `repos_app`, the role production runs as. Only the Supabase network edge is
 * stubbed: who the session says is signed in, and the Auth admin API that
 * mints, re-passwords and scrambles identities.
 *
 *   1. the platform admin adds a client
 *   2. the admin generates temporary credentials for it — once only
 *   3. the temporary owner lands in that business and sees nothing else
 *   4. the owner finishes setup: their own password and login email
 *   5. setup cannot be run twice; signing in again is the same person
 *   6. disabling after setup is records-only; the owner keeps access
 *   7. disabling BEFORE setup scrambles the temporary password and closes setup
 *   7b. ...but never the owner's own password, if setup reached Supabase only
 *   8. a self-serve owner signs up, onboards, and lands in their own business
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

/** The Auth admin API, as a ledger: what was minted, re-passworded, scrambled. */
const idp = vi.hoisted(() => ({
  minted: [] as Array<{ email: string; password: string; authUserId: string }>,
  permanent: [] as Array<{ authUserId: string; email?: string }>,
  scrambled: [] as string[],
  n: 0,
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  SUPABASE_SERVICE_ROLE_KEY_VAR: 'SUPABASE_SERVICE_ROLE_KEY',
  isAccountAccessConfigured: () => true,
  createTempIdentity: async (email: string, password: string) => {
    idp.n += 1;
    const authUserId = `aaaaaaaa-0000-4000-8000-${String(idp.n).padStart(12, '0')}`;
    idp.minted.push({ email, password, authUserId });
    return { authUserId };
  },
  setPermanentCredentials: async (authUserId: string, _password: string, email?: string) => {
    idp.permanent.push({ authUserId, email });
    return { ok: true };
  },
  randomizeIdentityPassword: async (authUserId: string) => {
    idp.scrambled.push(authUserId);
  },
  deleteIdentity: async () => {},
}));

const ADMIN_AUTH = '11111111-1111-4111-8111-111111111111';
const OTHER_AUTH = '44444444-4444-4444-8444-444444444444';
const SELF_AUTH = '55555555-5555-4555-8555-555555555555';

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;
let svc: {
  createClient: typeof import('@/lib/clients/service').createClient;
  generateTempAccess: typeof import('@/lib/account-access/service').generateTempAccess;
  validateAccountSetup: typeof import('@/lib/account-access/service').validateAccountSetup;
  finalizeAccountSetup: typeof import('@/lib/account-access/service').finalizeAccountSetup;
  disableTempAccess: typeof import('@/lib/account-access/service').disableTempAccess;
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
  loginId: '',
};

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
    session = { id: ADMIN_AUTH };
    const created = await svc.createClient(app, validClientInput({ businessName: 'Lifecycle Salon', vertical: 'salon', status: 'ACTIVE' }));
    expect(created.ok, created.ok ? '' : created.message).toBe(true);
    if (!created.ok) return;
    state.clientId = created.data.id;

    const row = await owner.client.findUniqueOrThrow({
      where: { id: state.clientId },
      include: { gateway: true, memberships: true },
    });
    expect(row.subscriptionStatus).toBe('TRIAL');
    expect(row.trialEndsAt).not.toBeNull();
    expect(row.gateway?.publicToken).toMatch(/^[a-z0-9]{22}$/);
    expect(row.memberships).toHaveLength(0);
  });

  it('only a platform admin can add a client that way', async () => {
    session = { id: OTHER_AUTH };
    const refused = await svc.createClient(app, validClientInput({ businessName: 'Not Allowed', vertical: 'gym' }));
    expect(refused.ok).toBe(false);
    expect(await owner.client.count({ where: { businessName: 'Not Allowed' } })).toBe(0);
  });

  it('2. the admin generates temporary credentials — a synthetic login, an owner membership, once only', async () => {
    session = { id: ADMIN_AUTH };
    const generated = await svc.generateTempAccess(app, state.clientId, state.adminId);
    expect(generated.ok, generated.ok ? '' : generated.message).toBe(true);
    if (!generated.ok) return;
    state.loginId = generated.data.loginId;

    expect(generated.data.loginId).toMatch(/^[a-z0-9]{8}@access\.headway\.local$/);
    expect(generated.data.password).toMatch(/^[a-z0-9]{14}$/);
    // The identity minted is exactly the one handed over.
    expect(idp.minted).toHaveLength(1);
    expect(idp.minted[0]).toMatchObject({ email: generated.data.loginId, password: generated.data.password });
    state.tempAuth = idp.minted[0]!.authUserId;

    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId }, include: { user: true } });
    expect(access.status).toBe('TEMPORARY_ACTIVE');
    expect(access.createdByUserId).toBe(state.adminId);
    expect(access.user.email).toBe(generated.data.loginId);
    expect(access.user.authProviderId).toBe(state.tempAuth);
    expect(access.user.isPlatformAdmin).toBe(false);
    state.tempUserId = access.userId;

    const memberships = await owner.membership.findMany({ where: { userId: state.tempUserId } });
    expect(memberships).toEqual([expect.objectContaining({ clientId: state.clientId, role: 'BUSINESS_OWNER', status: 'ACTIVE' })]);

    // Never a second credential for the same business.
    const again = await svc.generateTempAccess(app, state.clientId, state.adminId);
    expect(again.ok).toBe(false);
    expect(idp.minted).toHaveLength(1);
    expect(await owner.accountAccess.count({ where: { clientId: state.clientId } })).toBe(1);
  });

  it('3. the temporary owner lands in their business and can see no other', async () => {
    session = { id: state.tempAuth };
    const actor = await svc.loadActor(app, state.tempAuth);
    expect(actor?.userId).toBe(state.tempUserId);
    expect(actor?.isPlatformAdmin).toBe(false);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.clientId}`);

    expect((await app.client.findMany({ select: { id: true } })).map((c) => c.id)).toEqual([state.clientId]);
    expect(await app.client.findUnique({ where: { id: state.otherClientId } })).toBeNull();
  });

  it('4. the owner finishes setup: refused when wrong, then their own password and login email', async () => {
    session = { id: state.tempAuth };
    const base = { name: 'Asha', phone: '', email: 'owner@lifecycle.test', password: 'a-strong-password', confirmPassword: 'a-strong-password' };

    const mismatch = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, confirmPassword: 'different' });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.errors.confirmPassword).toBeDefined();

    const short = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, password: 'short', confirmPassword: 'short' });
    expect(short.ok).toBe(false);

    // KNOWN LIMIT, pinned so it cannot change silently: under the runtime role
    // an owner cannot see another tenant's User row, so RepOS's own pre-check
    // for "that email belongs to someone else" does not see the clash. The
    // refusal comes from Supabase instead (EMAIL_TAKEN, before anything is
    // written — see tests/m39.account-setup-action.test.ts). That is only
    // sound while every User row has a Supabase identity, which is asserted.
    const taken = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, { ...base, email: 'owner@other.test' });
    expect(taken.ok).toBe(true);
    expect(await owner.user.count({ where: { authProviderId: null } })).toBe(0);

    // Nor for a business this credential is not bound to.
    const wrongClient = await svc.validateAccountSetup(app, state.tempUserId, state.otherClientId, base);
    expect(wrongClient.ok).toBe(false);

    // Nothing moved while being refused.
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } })).status).toBe('TEMPORARY_ACTIVE');

    const valid = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, base);
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    const before = await owner.user.findUniqueOrThrow({ where: { id: state.tempUserId } });
    // The action hands the password and email to Supabase first, then commits.
    await svc.finalizeAccountSetup(app, state.tempUserId, valid.data);

    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } });
    expect(access.status).toBe('SETUP_COMPLETE');
    expect(access.setupCompletedAt).not.toBeNull();
    const user = await owner.user.findUniqueOrThrow({ where: { id: state.tempUserId } });
    expect(user.email).toBe('owner@lifecycle.test');
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.authProviderId).toBe(state.tempAuth); // same identity, never a second one
    expect(user.sessionVersion).toBe(before.sessionVersion + 1);
    const client = await owner.client.findUniqueOrThrow({ where: { id: state.clientId } });
    expect(client.ownerName).toBe('Asha');
    expect(client.ownerEmail).toBe('owner@lifecycle.test');
  });

  it('5. setup cannot be run twice, and signing in again is the same person in the same business', async () => {
    session = { id: state.tempAuth };
    const twice = await svc.validateAccountSetup(app, state.tempUserId, state.clientId, {
      name: '', phone: '', email: '', password: 'another-password', confirmPassword: 'another-password',
    });
    expect(twice.ok).toBe(false);

    // What signInAction does with the verified identity: no new user, same membership.
    const signedIn = await svc.provisionUser(app, { providerId: state.tempAuth, email: 'owner@lifecycle.test' });
    expect(signedIn.userId).toBe(state.tempUserId);
    expect(signedIn.created).toBe(false);
    const actor = await svc.loadActor(app, state.tempAuth);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.clientId}`);
    expect(await owner.user.count({ where: { authProviderId: state.tempAuth } })).toBe(1);
  });

  it('6. disabling after setup is records-only: nothing scrambled, the owner keeps their access', async () => {
    session = { id: ADMIN_AUTH };
    const disabled = await svc.disableTempAccess(app, state.clientId, state.adminId);
    expect(disabled.ok).toBe(true);
    expect(idp.scrambled).toEqual([]);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } });
    expect(access.status).toBe('DISABLED');
    expect(access.disabledByUserId).toBe(state.adminId);

    session = { id: state.tempAuth };
    const actor = await svc.loadActor(app, state.tempAuth);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.clientId}`);

    session = { id: ADMIN_AUTH };
    expect((await svc.disableTempAccess(app, state.clientId, state.adminId)).ok).toBe(false);
  });

  it('7. disabling BEFORE setup scrambles the temporary password and closes setup for good', async () => {
    session = { id: ADMIN_AUTH };
    const created = await svc.createClient(app, validClientInput({ businessName: 'Never Set Up', vertical: 'clinic', status: 'ACTIVE' }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const generated = await svc.generateTempAccess(app, created.data.id, state.adminId);
    expect(generated.ok).toBe(true);
    const authUserId = idp.minted.at(-1)!.authUserId;
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: created.data.id } });

    const disabled = await svc.disableTempAccess(app, created.data.id, state.adminId);
    expect(disabled.ok).toBe(true);
    expect(idp.scrambled).toEqual([authUserId]);

    session = { id: authUserId };
    const setup = await svc.validateAccountSetup(app, access.userId, created.data.id, {
      name: '', phone: '', email: '', password: 'a-strong-password', confirmPassword: 'a-strong-password',
    });
    expect(setup.ok).toBe(false);
  });

  it('7b. disabling never scrambles the owner’s OWN password when setup reached Supabase but not Headway', async () => {
    session = { id: ADMIN_AUTH };
    const created = await svc.createClient(app, validClientInput({ businessName: 'Half Set Up', vertical: 'gym', status: 'ACTIVE' }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await svc.generateTempAccess(app, created.data.id, state.adminId)).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: created.data.id } });
    // Supabase took the owner's own email and password; the database commit
    // never happened, and their next sign-in brought the new address across.
    await owner.user.update({ where: { id: access.userId }, data: { email: 'real-owner@halfsetup.test' } });
    const scrambledBefore = idp.scrambled.length;

    const disabled = await svc.disableTempAccess(app, created.data.id, state.adminId);
    expect(disabled.ok).toBe(true);
    expect(idp.scrambled).toHaveLength(scrambledBefore);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: created.data.id } })).status).toBe('DISABLED');
  });

  it('8. a self-serve owner signs up, onboards, and lands in their own business only', async () => {
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
