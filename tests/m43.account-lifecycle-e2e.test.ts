import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb, validClientInput } from './helpers/test-db';

/**
 * EVERY ACCOUNT PATH, IN THE ORDER IT HAPPENS (M43; two logins since M52; the
 * owner's address recorded by Headway since M53).
 *
 * Each step already has its own tests. This file proves they work TOGETHER —
 * against a real Postgres with the shipped `rls.sql` (so `app.user_id_for_auth`,
 * `app.provision_user`, `app.rebind_temp_access` and the M53 login guard run
 * for real), through the real `src/lib/db.ts`, connected as `repos_app`, the
 * role production runs as. Only the Supabase network edge is stubbed: who the
 * session says is signed in, and the Auth admin API.
 *
 * WHAT M53 CHANGED. Up to M52 whoever signed in with the temporary login typed
 * an email AND a password on Account and that became the owner's permanent
 * login — so whoever held the handover sheet first could keep the business.
 * Now the ADMIN types the owner's email when generating temporary access, and
 * the owner's own login is made right then: on that address, unconfirmed, with
 * no password anybody knows. It starts working only once somebody opens the
 * link Supabase emails to that inbox. The temporary session can ask for that
 * link to be sent, and nothing more — and the database itself refuses to let
 * it re-point the owner's login or rewrite the owner's address.
 *
 *   1. the admin adds a client; the panel asks for the owner's email
 *   2. typed in, generating makes the owner's own login (pending) and a
 *      temporary EMAIL + PASSWORD; without it, nothing is made
 *   3. the temporary login lands on Account, in that business only
 *   4. the temporary session cannot re-point or re-address the owner's login,
 *      even straight at the database; it can only learn where the link goes
 *   5. once the address is proved, the own login and the temporary one both open it
 *   6. disabling temporary access never touches the owner's own login
 *   7. enabling it again: same email, new password, own login untouched
 *   8. before the address is proved: disable really shuts the business, enable reopens it
 *   9. a business with its own owner: a temporary login into that account, no email asked
 *  10. a row with no temporary login left is given a fresh one (platform only)
 *  11. two admins generating at once leave one temporary login, one own login, no orphans
 *  12. a self-serve owner signs up, onboards, and lands in their own business
 *  13. a temporary login opens ONE business, never with staff authority
 *  14–15. a row left on with no temporary login behind it is not stuck, even raced
 *  16. only platform staff switch temporary access, even straight at the database
 *  17. an address-only sign-in never claims a handed-over owner
 *  18. the admin is told only what Supabase actually says about the own login
 *  19. a temporary login whose address was moved away opens nothing
 *  20. the old "is this address taken?" function is gone from the database
 *  21. the admin corrects an address nobody has proved — and cannot once it is
 *  22. nobody's own session can do that swap itself: the database refuses it
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
  /** Owners' own logins Headway made (M53): unconfirmed, no password, nothing sent. */
  pending: [] as Array<{ email: string; authUserId: string }>,
  passwords: [] as Array<{ authUserId: string; password: string; email?: string }>,
  scrambled: [] as string[],
  scrambledTo: [] as Array<string | undefined>,
  deleted: [] as string[],
  /** Every non-temporary identity Supabase holds, as `getIdentitySnapshot` reports it. */
  own: new Map<string, { email: string; confirmed: boolean; confirmationSent: boolean; recoverySent: boolean }>(),
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
  createPendingOwnerIdentity: async (email: string, id?: string) => {
    // Supabase refuses an address any identity already holds, confirmed or not.
    for (const held of idp.own.values()) {
      if (held.email === email) {
        return { ok: false, reason: 'EMAIL_TAKEN', message: 'A user with this email address has already been registered' };
      }
    }
    idp.n += 1;
    const authUserId = id ?? `bbbbbbbb-0000-4000-8000-${String(idp.n).padStart(12, '0')}`;
    idp.own.set(authUserId, { email, confirmed: false, confirmationSent: false, recoverySent: false });
    idp.pending.push({ email, authUserId });
    return { ok: true, authUserId };
  },
  setIdentityPassword: async (authUserId: string, password: string, options: { email?: string } = {}) => {
    idp.passwords.push({ authUserId, password, ...(options.email ? { email: options.email } : {}) });
    return { ok: true };
  },
  randomizeIdentityPassword: async (authUserId: string, email?: string) => {
    idp.scrambled.push(authUserId);
    idp.scrambledTo.push(email);
    // A new password voids every link already sent: Supabase clears both stamps.
    const held = idp.own.get(authUserId);
    if (held) idp.own.set(authUserId, { ...held, confirmationSent: false, recoverySent: false });
  },
  deleteIdentity: async (authUserId: string) => {
    idp.deleted.push(authUserId);
    idp.own.delete(authUserId);
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
/** An identity a temporary-login holder would like the owner's account to open for. */
const SOMEONE_AUTH = '12121212-1212-4121-8121-121212121212';

const TEMP_EMAIL = /^[a-z0-9]{8}@access\.headway\.local$/;
const TEMP_PASSWORD = /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** What the M53 trigger `user_handover_login_guard` raises. */
const LOGIN_GUARD = /only platform staff can change a handed-over owner/;
const ADDRESS_TAKEN = /already has a Headway sign-in/;
const NOT_TEMPORARY = { ok: false, reason: 'NOT_TEMPORARY' } as const;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;
let svc: {
  createClient: typeof import('@/lib/clients/service').createClient;
  generateTempAccess: typeof import('@/lib/account-access/service').generateTempAccess;
  disableTempAccess: typeof import('@/lib/account-access/service').disableTempAccess;
  setOwnerEmail: typeof import('@/lib/account-access/service').setOwnerEmail;
  passwordLinkTarget: typeof import('@/lib/account-access/service').passwordLinkTarget;
  getAdminAccessView: typeof import('@/lib/account-access/service').getAdminAccessView;
  loadActor: typeof import('@/lib/tenancy/service').loadActor;
  provisionUser: typeof import('@/lib/tenancy/service').provisionUser;
  landingPathFor: typeof import('@/lib/onboarding/service').landingPathFor;
  completeOnboarding: typeof import('@/lib/onboarding/service').completeOnboarding;
  withRlsContext: typeof import('@/lib/db').withRlsContext;
};

const state = {
  adminId: '',
  otherClientId: '',
  otherUserId: '',
  clientId: '',
  ownerUserId: '',
  tempAuth: '',
  /** The owner's own login, made pending by generateTempAccess (step 2). */
  ownAuth: '',
  email: '',
  otherTempAuth: '',
  /** A business with an owner email on file and no temporary access (step 1). */
  suggestedClientId: '',
  /** A business whose owner never proves their address (step 8). */
  lateClientId: '',
};

async function newClient(name: string, overrides: Record<string, unknown> = {}) {
  session = { id: ADMIN_AUTH };
  const created = await svc.createClient(
    app,
    validClientInput({ businessName: name, vertical: 'clinic', status: 'ACTIVE', ...overrides }),
  );
  expect(created.ok, created.ok ? '' : created.message).toBe(true);
  if (!created.ok) throw new Error(created.message);
  return created.data.id;
}

/** What a request signed in as `authId` can see of the businesses. */
async function visibleClients(authId: string) {
  session = { id: authId };
  return (await app.client.findMany({ select: { id: true } })).map((c) => c.id).sort();
}

async function counts() {
  return {
    users: await owner.user.count(),
    memberships: await owner.membership.count(),
    clients: await owner.client.count(),
  };
}

/** Where the Supabase ledger stands, so a step can ask what IT did. */
type Mark = { minted: number; pending: number; scrambled: number; deleted: number; passwords: number };

function mark(): Mark {
  return {
    minted: idp.minted.length,
    pending: idp.pending.length,
    scrambled: idp.scrambled.length,
    deleted: idp.deleted.length,
    passwords: idp.passwords.length,
  };
}

function since(from: Mark) {
  return {
    minted: idp.minted.slice(from.minted),
    pending: idp.pending.slice(from.pending),
    scrambled: idp.scrambled.slice(from.scrambled),
    deleted: idp.deleted.slice(from.deleted),
    passwords: idp.passwords.slice(from.passwords),
  };
}

const NOTHING = { minted: [], pending: [], scrambled: [], deleted: [], passwords: [] };

beforeAll(async () => {
  expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
  harness = await createRlsTestDb('m43-account-lifecycle');
  owner = harness.owner;
  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;
  const db = await import('@/lib/db');
  app = db.prisma;
  const clients = await import('@/lib/clients/service');
  const access = await import('@/lib/account-access/service');
  const tenancy = await import('@/lib/tenancy/service');
  const onboarding = await import('@/lib/onboarding/service');
  svc = {
    createClient: clients.createClient,
    generateTempAccess: access.generateTempAccess,
    disableTempAccess: access.disableTempAccess,
    setOwnerEmail: access.setOwnerEmail,
    passwordLinkTarget: access.passwordLinkTarget,
    getAdminAccessView: access.getAdminAccessView,
    loadActor: tenancy.loadActor,
    provisionUser: tenancy.provisionUser,
    landingPathFor: onboarding.landingPathFor,
    completeOnboarding: onboarding.completeOnboarding,
    withRlsContext: db.withRlsContext,
  };
  await resetDb(owner);
  const admin = await owner.user.create({
    data: { email: 'admin@headway.test', authProviderId: ADMIN_AUTH, isPlatformAdmin: true },
    select: { id: true },
  });
  const other = await owner.user.create({ data: { email: 'owner@other.test', authProviderId: OTHER_AUTH }, select: { id: true } });
  // An owner who signed up themselves: Supabase has their confirmed login.
  idp.own.set(OTHER_AUTH, { email: 'owner@other.test', confirmed: true, confirmationSent: false, recoverySent: false });
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
  it('1. the platform admin adds a client: a trial, a feedback page, no owner yet — and the panel asks for the owner’s email', async () => {
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
      needsOwnerEmail: true,
      // validClientInput records no owner email, so there is nothing to offer.
      ownerEmailSuggestion: null,
      canSetOwnerEmail: false,
    });

    // An address typed on the client form is offered back, tidied — only a
    // suggestion: the admin still reads it and presses the button.
    state.suggestedClientId = await newClient('Suggested Owner', { ownerEmail: 'Suggested@Owner.Test' });
    expect(await svc.getAdminAccessView(app, state.suggestedClientId)).toMatchObject({
      needsOwnerEmail: true,
      ownerEmailSuggestion: 'suggested@owner.test',
      canSetOwnerEmail: false,
    });
    // A Headway-made address is never offered as the owner's own.
    await owner.client.update({ where: { id: state.suggestedClientId }, data: { ownerEmail: 'abcd2345@access.headway.local' } });
    expect((await svc.getAdminAccessView(app, state.suggestedClientId)).ownerEmailSuggestion).toBeNull();
  });

  it('2. generating needs the owner’s email: it makes their own login, pending, and a temporary EMAIL and PASSWORD', async () => {
    session = { id: ADMIN_AUTH };
    const usersBefore = await owner.user.count();

    // No address, a blank one, a malformed one, a Headway-made one, or one
    // another RepOS account already has: refused on the field, and nothing at
    // all is made — no login in Supabase, no User, no Membership, no row.
    const refusals: Array<[string | undefined, RegExp]> = [
      [undefined, /Enter the owner.s email/],
      ['   ', /Enter the owner.s email/],
      ['not-an-email', /valid email/],
      ['abcd2345@access.headway.local', /not a temporary one/],
      ['OWNER@other.test', ADDRESS_TAKEN],
    ];
    for (const [ownerEmail, why] of refusals) {
      const refused = await svc.generateTempAccess(
        app,
        state.clientId,
        state.adminId,
        ownerEmail === undefined ? {} : { ownerEmail },
      );
      expect(refused.ok, String(ownerEmail)).toBe(false);
      if (!refused.ok) expect(refused.errors.ownerEmail).toMatch(why);
    }
    expect(idp.minted).toHaveLength(0);
    expect(idp.pending).toHaveLength(0);
    expect(await owner.accountAccess.count({ where: { clientId: state.clientId } })).toBe(0);
    expect(await owner.membership.count({ where: { clientId: state.clientId } })).toBe(0);
    expect(await owner.user.count()).toBe(usersBefore);

    const generated = await svc.generateTempAccess(app, state.clientId, state.adminId, {
      ownerEmail: '  Owner@Lifecycle.Test ',
    });
    expect(generated.ok, generated.ok ? '' : generated.message).toBe(true);
    if (!generated.ok) return;
    state.email = generated.data.email;

    // The owner's own login: on the typed address (tidied), under an id RepOS
    // chose, unconfirmed — and nothing was sent anywhere.
    expect(idp.pending).toHaveLength(1);
    expect(idp.pending[0]!.email).toBe('owner@lifecycle.test');
    expect(idp.pending[0]!.authUserId).toMatch(UUID);
    state.ownAuth = idp.pending[0]!.authUserId;
    expect(idp.own.get(state.ownAuth)).toEqual({
      email: 'owner@lifecycle.test',
      confirmed: false,
      confirmationSent: false,
      recoverySent: false,
    });

    // The temporary login: exactly the pair Supabase was given.
    expect(generated.data.email).toMatch(TEMP_EMAIL);
    expect(generated.data.password).toMatch(TEMP_PASSWORD);
    expect(idp.minted).toHaveLength(1);
    expect(idp.minted[0]).toMatchObject({ email: generated.data.email, password: generated.data.password });
    state.tempAuth = idp.minted[0]!.authUserId;
    expect(state.tempAuth).not.toBe(state.ownAuth);

    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId }, include: { user: true } });
    expect(access).toMatchObject({ status: 'TEMPORARY_ACTIVE', loginId: generated.data.email, tempAuthId: state.tempAuth });
    expect(access.setupCompletedAt).toBeNull();
    // ONE owner User, bound to the owner's OWN login. Its email is still the
    // Headway-made address: the real one is written once it is proved.
    expect(access.user.authProviderId).toBe(state.ownAuth);
    expect(access.user.email).toBe(generated.data.email);
    expect(access.user.isPlatformAdmin).toBe(false);
    state.ownerUserId = access.userId;
    expect(await owner.user.count()).toBe(usersBefore + 1);
    expect(await owner.membership.findMany({ where: { clientId: state.clientId } })).toEqual([
      expect.objectContaining({ userId: state.ownerUserId, role: 'BUSINESS_OWNER', status: 'ACTIVE' }),
    ]);

    // The password is in no column anywhere.
    expect(JSON.stringify(await owner.accountAccess.findMany())).not.toContain(generated.data.password);
    expect(JSON.stringify(await owner.user.findMany())).not.toContain(generated.data.password);

    expect(await svc.getAdminAccessView(app, state.clientId)).toEqual({
      ownLogin: { email: 'owner@lifecycle.test', confirmed: false, linkSent: false },
      temporary: 'ACTIVE',
      temporaryEmail: generated.data.email,
      temporaryBlocked: null,
      needsOwnerEmail: false,
      ownerEmailSuggestion: null,
      // Nobody has proved it yet: the admin may still correct it.
      canSetOwnerEmail: true,
    });
    // Supabase cannot be asked: unknown, never "not confirmed" — and the
    // Headway-made address is never shown as the owner's.
    idp.unreachable = true;
    try {
      expect(await svc.getAdminAccessView(app, state.clientId)).toMatchObject({
        ownLogin: { email: null, confirmed: null, linkSent: false },
        canSetOwnerEmail: false,
      });
    } finally {
      idp.unreachable = false;
    }

    // Never a second one while this one is on.
    expect((await svc.generateTempAccess(app, state.clientId, state.adminId, { ownerEmail: 'owner@lifecycle.test' })).ok).toBe(false);
    expect(idp.minted).toHaveLength(1);
    expect(idp.pending).toHaveLength(1);

    // The same address for a different business: no RepOS User shows it yet,
    // but the pending login holds it, so Supabase refuses — and nothing of
    // that second business's handover is left behind.
    const sameAddress = await newClient('Same Address');
    const clash = await svc.generateTempAccess(app, sameAddress, state.adminId, { ownerEmail: 'owner@lifecycle.test' });
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.errors.ownerEmail).toMatch(ADDRESS_TAKEN);
    expect(idp.minted).toHaveLength(1);
    expect(idp.pending).toHaveLength(1);
    expect(await owner.accountAccess.count({ where: { clientId: sameAddress } })).toBe(0);
    expect(await owner.membership.count({ where: { clientId: sameAddress } })).toBe(0);
  });

  it('3. the temporary login opens that business only, landing on Account', async () => {
    session = { id: state.tempAuth };
    // What sign-in does with the identity Supabase verified: no new User, and
    // the owner's record keeps its own login and its address.
    const signedIn = await svc.provisionUser(app, { providerId: state.tempAuth, email: state.email });
    expect(signedIn).toEqual({ userId: state.ownerUserId, created: false });
    expect(await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).toMatchObject({
      authProviderId: state.ownAuth,
      email: state.email,
    });

    const actor = await svc.loadActor(app, state.tempAuth, state.email);
    expect(actor?.userId).toBe(state.ownerUserId);
    expect(actor?.temporaryAccessClientId).toBe(state.clientId);
    expect(actor?.setupPendingClientId).toBe(state.clientId);
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.clientId}/account`);

    expect(await visibleClients(state.tempAuth)).toEqual([state.clientId]);
    session = { id: state.tempAuth };
    expect(await app.client.findUnique({ where: { id: state.otherClientId } })).toBeNull();
  });

  it('4. the temporary session cannot re-point or re-address the owner’s login — it can only learn where the link goes', async () => {
    const before = await counts();
    const from = mark();

    // Signed in with the temporary login, straight at the database. The column
    // grant and `user_self_or_admin` would both allow these; the M53 guard
    // does not: whoever holds the sheet cannot aim the account at a login of
    // their own, nor move the address invitations are matched on.
    session = { id: state.tempAuth };
    await expect(
      app.user.updateMany({ where: { id: state.ownerUserId }, data: { authProviderId: SOMEONE_AUTH } }),
    ).rejects.toThrow(LOGIN_GUARD);
    await expect(
      app.user.updateMany({ where: { id: state.ownerUserId }, data: { email: 'holder@evil.test' } }),
    ).rejects.toThrow(LOGIN_GUARD);
    // Inside one transaction, the way the services write, too.
    await expect(
      svc.withRlsContext(app, (tx) =>
        tx.user.updateMany({
          where: { id: state.ownerUserId, authProviderId: state.ownAuth },
          data: { authProviderId: SOMEONE_AUTH, email: 'holder@evil.test' },
        }),
      ),
    ).rejects.toThrow(LOGIN_GUARD);
    // An ordinary write about themselves is not what the guard is for.
    expect((await app.user.updateMany({ where: { id: state.ownerUserId }, data: { name: 'Asha' } })).count).toBe(1);
    expect(await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).toMatchObject({
      authProviderId: state.ownAuth,
      email: state.email,
      name: 'Asha',
    });

    // Where the set-your-password link goes: the address Headway recorded —
    // and only for this business's temporary login, switched on.
    expect(await svc.passwordLinkTarget(app, state.clientId, state.ownerUserId, state.tempAuth)).toEqual({
      ok: true,
      email: 'owner@lifecycle.test',
    });
    expect(await svc.passwordLinkTarget(app, state.otherClientId, state.ownerUserId, state.tempAuth)).toEqual(NOT_TEMPORARY);
    idp.unreachable = true;
    try {
      expect(await svc.passwordLinkTarget(app, state.clientId, state.ownerUserId, state.tempAuth)).toEqual({
        ok: false,
        reason: 'UNKNOWN',
      });
    } finally {
      idp.unreachable = false;
    }
    // The owner's own login is not the temporary one.
    session = { id: state.ownAuth };
    expect(await svc.passwordLinkTarget(app, state.clientId, state.ownerUserId, state.ownAuth)).toEqual(NOT_TEMPORARY);
    // Nor is another business's owner — even one naming this temporary login.
    session = { id: OTHER_AUTH };
    expect(await svc.passwordLinkTarget(app, state.clientId, state.otherUserId, OTHER_AUTH)).toEqual(NOT_TEMPORARY);
    expect(await svc.passwordLinkTarget(app, state.clientId, state.ownerUserId, state.tempAuth)).toEqual(NOT_TEMPORARY);

    // Asking wrote nothing, anywhere.
    expect(since(from)).toEqual(NOTHING);
    expect(await counts()).toEqual(before);

    // Platform staff can (Headway owns the handover), and put it back.
    session = { id: ADMIN_AUTH };
    expect(
      (await app.user.updateMany({
        where: { id: state.ownerUserId },
        data: { authProviderId: SOMEONE_AUTH, email: 'holder@evil.test' },
      })).count,
    ).toBe(1);
    expect(
      (await app.user.updateMany({
        where: { id: state.ownerUserId },
        data: { authProviderId: state.ownAuth, email: state.email },
      })).count,
    ).toBe(1);
    expect(await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).toMatchObject({
      authProviderId: state.ownAuth,
      email: state.email,
    });

    // The holder presses the button; Supabase records that the link went.
    idp.own.set(state.ownAuth, { email: 'owner@lifecycle.test', confirmed: false, confirmationSent: false, recoverySent: true });
    expect((await svc.getAdminAccessView(app, state.clientId)).ownLogin).toEqual({
      email: 'owner@lifecycle.test',
      confirmed: false,
      linkSent: true,
    });
  });

  it('5. once the owner proves the address, their own login opens the same business — and the temporary one still does too', async () => {
    // They opened the emailed link and chose a password: Supabase says confirmed.
    idp.own.set(state.ownAuth, { email: 'owner@lifecycle.test', confirmed: true, confirmationSent: false, recoverySent: true });

    session = { id: state.ownAuth };
    const signedIn = await svc.provisionUser(app, { providerId: state.ownAuth, email: 'owner@lifecycle.test' });
    expect(signedIn).toEqual({ userId: state.ownerUserId, created: false });
    // The proved address is now the User's — written by the definer function,
    // which the M53 guard does not stand in the way of.
    expect((await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).email).toBe('owner@lifecycle.test');
    const own = await svc.loadActor(app, state.ownAuth, 'owner@lifecycle.test');
    expect(own?.userId).toBe(state.ownerUserId);
    expect(own?.temporaryAccessClientId).toBeNull();
    expect(own?.setupPendingClientId).toBeNull();
    expect(svc.landingPathFor(own!)).toBe(`/workspace/${state.clientId}`);
    expect(await visibleClients(state.ownAuth)).toEqual([state.clientId]);

    // The temporary login is still on (an admin decides when it goes), and
    // still lands on Account; it never moves the proved address back.
    session = { id: state.tempAuth };
    await svc.provisionUser(app, { providerId: state.tempAuth, email: state.email });
    expect((await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).email).toBe('owner@lifecycle.test');
    const temp = await svc.loadActor(app, state.tempAuth, state.email);
    expect(temp?.userId).toBe(state.ownerUserId);
    expect(svc.landingPathFor(temp!)).toBe(`/workspace/${state.clientId}/account`);

    expect(await owner.user.count({ where: { id: state.ownerUserId } })).toBe(1);
    expect(await owner.membership.count({ where: { clientId: state.clientId } })).toBe(1);

    session = { id: ADMIN_AUTH };
    expect(await svc.getAdminAccessView(app, state.clientId)).toEqual({
      ownLogin: { email: 'owner@lifecycle.test', confirmed: true, linkSent: true },
      temporary: 'ACTIVE',
      temporaryEmail: state.email,
      temporaryBlocked: null,
      needsOwnerEmail: false,
      ownerEmailSuggestion: null,
      // Proved: the owner's own now, never the admin's to replace.
      canSetOwnerEmail: false,
    });
  });

  it('6. disabling temporary access shuts the temporary login and never the owner’s own', async () => {
    session = { id: ADMIN_AUTH };
    const from = mark();
    expect((await svc.disableTempAccess(app, state.clientId, state.adminId)).ok).toBe(true);
    expect(since(from).scrambled).toEqual([state.tempAuth]);
    // ...and the Headway-made address back with it, wherever a holder moved it.
    expect(idp.scrambledTo.slice(from.scrambled)).toEqual([state.email]);
    expect(since(from).deleted).toEqual([]);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.clientId } })).status).toBe('DISABLED');

    // The temporary login: nobody, in the app and in the database itself — and
    // it can no longer even ask for the owner's link.
    session = { id: state.tempAuth };
    expect(await svc.loadActor(app, state.tempAuth)).toBeNull();
    expect(await visibleClients(state.tempAuth)).toEqual([]);
    session = { id: state.tempAuth };
    expect(await svc.passwordLinkTarget(app, state.clientId, state.ownerUserId, state.tempAuth)).toEqual(NOT_TEMPORARY);

    // The owner's own login: exactly as before, in Supabase too.
    session = { id: state.ownAuth };
    expect((await svc.loadActor(app, state.ownAuth))?.userId).toBe(state.ownerUserId);
    expect(await visibleClients(state.ownAuth)).toEqual([state.clientId]);
    expect(idp.own.get(state.ownAuth)).toMatchObject({ email: 'owner@lifecycle.test', confirmed: true });

    session = { id: ADMIN_AUTH };
    expect((await svc.getAdminAccessView(app, state.clientId)).temporary).toBe('DISABLED');
    expect((await svc.disableTempAccess(app, state.clientId, state.adminId)).ok).toBe(false);
  });

  it('7. enabling it again: the same temporary email, a new password — the owner’s own login untouched', async () => {
    session = { id: ADMIN_AUTH };
    const from = mark();
    // Enabling never asks for the owner's email.
    const again = await svc.generateTempAccess(app, state.clientId, state.adminId);
    expect(again.ok, again.ok ? '' : again.message).toBe(true);
    if (!again.ok) return;
    expect(again.data.email).toBe(state.email);
    expect(again.data.password).toMatch(TEMP_PASSWORD);
    expect(since(from)).toEqual({
      ...NOTHING,
      passwords: [{ authUserId: state.tempAuth, password: again.data.password, email: state.email }],
    });

    expect((await svc.getAdminAccessView(app, state.clientId)).temporary).toBe('ACTIVE');
    session = { id: state.tempAuth };
    expect((await svc.loadActor(app, state.tempAuth))?.userId).toBe(state.ownerUserId);
    session = { id: state.ownAuth };
    expect((await svc.loadActor(app, state.ownAuth))?.userId).toBe(state.ownerUserId);
    expect((await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).authProviderId).toBe(state.ownAuth);
    expect(await owner.membership.count({ where: { clientId: state.clientId } })).toBe(1);
  });

  it('8. before the owner proves the address: disabling really shuts the business, and enabling reopens it — nothing deleted', async () => {
    const clientId = await newClient('Never Set Up');
    state.lateClientId = clientId;
    expect((await svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'late@owner.test' })).ok).toBe(true);
    const tempAuth = idp.minted.at(-1)!.authUserId;
    const ownAuth = idp.pending.at(-1)!.authUserId;
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });

    expect(await visibleClients(tempAuth)).toEqual([clientId]);

    session = { id: ADMIN_AUTH };
    const from = mark();
    expect((await svc.disableTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    session = { id: tempAuth };
    expect(await svc.loadActor(app, tempAuth)).toBeNull();
    expect(await visibleClients(tempAuth)).toEqual([]);
    session = { id: tempAuth };
    expect(await svc.passwordLinkTarget(app, clientId, access.userId, tempAuth)).toEqual(NOT_TEMPORARY);
    expect(await owner.user.count({ where: { id: access.userId } })).toBe(1);
    expect(await owner.membership.count({ where: { clientId, status: 'ACTIVE' } })).toBe(1);
    // The owner's pending login is left exactly as it was: only the temporary
    // one was scrambled, nothing was deleted.
    expect(since(from).scrambled).toEqual([tempAuth]);
    expect(since(from).deleted).toEqual([]);
    expect(idp.own.get(ownAuth)).toMatchObject({ email: 'late@owner.test', confirmed: false });

    session = { id: ADMIN_AUTH };
    const reopen = mark();
    expect((await svc.generateTempAccess(app, clientId, state.adminId)).ok).toBe(true);
    expect(since(reopen).pending).toEqual([]);
    expect(await visibleClients(tempAuth)).toEqual([clientId]);
    session = { id: tempAuth };
    expect(await svc.passwordLinkTarget(app, clientId, access.userId, tempAuth)).toEqual({ ok: true, email: 'late@owner.test' });
  });

  it('9. a business that already has its own owner: a temporary login into that same account, no email asked', async () => {
    session = { id: ADMIN_AUTH };
    expect(await svc.getAdminAccessView(app, state.otherClientId)).toEqual({
      ownLogin: { email: 'owner@other.test', confirmed: true, linkSent: false },
      temporary: 'NONE',
      temporaryEmail: null,
      temporaryBlocked: null,
      // They already sign in as themselves: there is no email to ask for.
      needsOwnerEmail: false,
      ownerEmailSuggestion: null,
      canSetOwnerEmail: false,
    });
    const users = await owner.user.count();
    const from = mark();
    // Even an address typed anyway is ignored: their own login stays theirs.
    const generated = await svc.generateTempAccess(app, state.otherClientId, state.adminId, { ownerEmail: 'typed@anyway.test' });
    expect(generated.ok, generated.ok ? '' : generated.message).toBe(true);
    expect(since(from).pending).toEqual([]);
    expect(since(from).minted).toHaveLength(1);
    const tempAuth = idp.minted.at(-1)!.authUserId;
    state.otherTempAuth = tempAuth;
    expect(await owner.user.count()).toBe(users);
    expect(await owner.membership.count({ where: { clientId: state.otherClientId } })).toBe(1);
    expect((await owner.user.findUniqueOrThrow({ where: { id: state.otherUserId } })).authProviderId).toBe(OTHER_AUTH);
    expect((await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.otherClientId } })).setupCompletedAt).not.toBeNull();

    session = { id: tempAuth };
    const actor = await svc.loadActor(app, tempAuth);
    expect(actor?.userId).toBe(state.otherUserId);
    // Every temporary sign-in lands on Account (M53).
    expect(svc.landingPathFor(actor!)).toBe(`/workspace/${state.otherClientId}/account`);
    // Its link could only ever go to the owner's own, existing address.
    expect(await svc.passwordLinkTarget(app, state.otherClientId, state.otherUserId, tempAuth)).toEqual({
      ok: true,
      email: 'owner@other.test',
    });

    session = { id: ADMIN_AUTH };
    expect((await svc.disableTempAccess(app, state.otherClientId, state.adminId)).ok).toBe(true);
    expect(await visibleClients(tempAuth)).toEqual([]);
    expect(await visibleClients(OTHER_AUTH)).toEqual([state.otherClientId]);
  });

  it('10. a row with no temporary login left is given a fresh one — and only platform staff can point it', async () => {
    const clientId = await newClient('From Before M52');
    expect((await svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'before@m52.test' })).ok).toBe(true);
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
    const from = mark();
    const enabled = await svc.generateTempAccess(app, clientId, state.adminId);
    expect(enabled.ok, enabled.ok ? '' : enabled.message).toBe(true);
    if (!enabled.ok) return;
    expect(enabled.data.email).not.toBe(access.loginId);
    expect(since(from).pending).toEqual([]);
    const fresh = idp.minted.at(-1)!;
    expect(fresh.email).toBe(enabled.data.email);
    const row = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    expect(row).toMatchObject({ tempAuthId: fresh.authUserId, loginId: enabled.data.email, status: 'TEMPORARY_ACTIVE' });
    session = { id: fresh.authUserId };
    expect((await svc.loadActor(app, fresh.authUserId))?.userId).toBe(access.userId);
  });

  it('11. two admins generating at once leave one temporary login and one own login — the loser’s two are deleted', async () => {
    const clientId = await newClient('Double Click');
    const from = mark();
    const usersBefore = await owner.user.count();
    session = { id: ADMIN_AUTH };
    // Both requests must pass the "nothing exists yet" check before either
    // writes — a real double click, not two clicks in a row. Each typed its
    // own address, so Supabase lets both pending logins be made.
    let release = () => {};
    const ready = new Promise<void>((resolve) => (release = resolve));
    idp.rendezvous = { waiting: 0, of: 2, release, ready };

    const results = await Promise.all([
      svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'first@double.test' }),
      svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'second@double.test' }),
    ]);
    idp.rendezvous = null;

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const made = since(from);
    expect(made.minted).toHaveLength(2);
    expect(made.pending).toHaveLength(2);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
    const winnerOwn = access.user.authProviderId!;
    expect(made.pending.map((p) => p.authUserId)).toContain(winnerOwn);
    const loserTemp = made.minted.find((m) => m.authUserId !== access.tempAuthId)!.authUserId;
    const loserOwn = made.pending.find((p) => p.authUserId !== winnerOwn)!.authUserId;
    // The losing request removes both logins it made — its temporary one and
    // the owner login it made — and nothing of the winner's.
    expect(made.deleted).toEqual([loserTemp, loserOwn]);
    expect(idp.own.has(loserOwn)).toBe(false);
    expect(idp.own.has(winnerOwn)).toBe(true);
    const won = results.find((r) => r.ok);
    expect(won?.ok && won.data.email).toBe(access.loginId);
    // One User (the loser's half-made one is gone), one Membership.
    expect(await owner.user.count()).toBe(usersBefore + 1);
    expect(await owner.user.count({ where: { authProviderId: loserOwn } })).toBe(0);
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
    expect(await visibleClients(state.ownAuth)).toEqual([state.clientId]);
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
    const from = mark();
    const refused = await svc.generateTempAccess(app, staffBusiness.data.clientId, state.adminId, {
      ownerEmail: 'staff@owned.test',
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/Headway staff/);
    expect(since(from)).toEqual(NOTHING);
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
    expect((await svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'wedged@row.test' })).ok).toBe(true);
    await owner.accountAccess.update({ where: { clientId }, data: { tempAuthId: null, status: 'TEMPORARY_ACTIVE' } });

    session = { id: ADMIN_AUTH };
    expect((await svc.getAdminAccessView(app, clientId)).temporary).toBe('DISABLED');
    const from = mark();
    const enabled = await svc.generateTempAccess(app, clientId, state.adminId);
    expect(enabled.ok, enabled.ok ? '' : enabled.message).toBe(true);
    expect(since(from).pending).toEqual([]);
    const fresh = idp.minted.at(-1)!;
    expect(await owner.accountAccess.findUniqueOrThrow({ where: { clientId } })).toMatchObject({
      tempAuthId: fresh.authUserId,
      status: 'TEMPORARY_ACTIVE',
    });
    expect((await svc.getAdminAccessView(app, clientId)).temporary).toBe('ACTIVE');
  });

  it('15. two admins enabling such a row at once leave exactly one temporary login, and no orphan', async () => {
    const clientId = await newClient('Double Enable');
    expect((await svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'double@enable.test' })).ok).toBe(true);
    await owner.accountAccess.update({ where: { clientId }, data: { tempAuthId: null, status: 'DISABLED' } });
    const ownBefore = (await owner.user.findFirstOrThrow({ where: { accountAccessOwned: { clientId } } })).authProviderId;
    const from = mark();

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
    const made = since(from);
    expect(made.minted).toHaveLength(2);
    // Enabling never makes, or deletes, an owner login.
    expect(made.pending).toEqual([]);
    const row = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    const winner = made.minted.find((m) => m.authUserId === row.tempAuthId);
    expect(winner).toBeDefined();
    const loser = made.minted.find((m) => m.authUserId !== row.tempAuthId)!;
    expect(made.deleted).toEqual([loser.authUserId]);
    expect(row.status).toBe('TEMPORARY_ACTIVE');
    const won = results.find((r) => r.ok);
    expect(won?.ok && won.data.email).toBe(winner!.email);
    expect((await owner.user.findFirstOrThrow({ where: { accountAccessOwned: { clientId } } })).authProviderId).toBe(ownBefore);
  });

  it('16. only platform staff can switch temporary access on or off — even straight at the database', async () => {
    // The owner, signed in with their own login, on their own row.
    session = { id: state.ownAuth };
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
    expect((await svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'claim@guard.test' })).ok).toBe(true);
    const ownAuth = idp.pending.at(-1)!.authUserId;
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
    // Bound to the pending own login; the User's email is the Headway-made one.
    expect(access.user.authProviderId).toBe(ownAuth);
    expect(access.user.email).toBe(access.loginId);

    // Some other identity that happens to carry the same address.
    const stranger = '99999999-9999-4999-8999-999999999999';
    session = { id: stranger };
    // Refused outright: the address is the handed-over owner's, and that
    // User is never claimed by whichever identity carries it.
    await expect(svc.provisionUser(app, { providerId: stranger, email: access.loginId })).rejects.toThrow(
      /different account/,
    );
    expect((await owner.user.findUniqueOrThrow({ where: { id: access.userId } })).authProviderId).toBe(ownAuth);
    expect(await owner.user.count({ where: { authProviderId: stranger } })).toBe(0);
    expect(await visibleClients(stranger)).toEqual([]);
  });

  it('18. the admin is told only what Supabase actually says about the owner’s own login', async () => {
    session = { id: ADMIN_AUTH };
    // Supabase cannot be asked: unknown — not "confirmed", and not the
    // admin's to replace on a guess.
    idp.unreachable = true;
    try {
      expect(await svc.getAdminAccessView(app, state.clientId)).toMatchObject({
        ownLogin: { email: 'owner@lifecycle.test', confirmed: null, linkSent: false },
        canSetOwnerEmail: false,
      });
    } finally {
      idp.unreachable = false;
    }
    // An own login still on a Headway-made address is no own login at all —
    // the admin enters the owner's email instead.
    idp.own.set(state.ownAuth, { email: 'abcd2345@access.headway.local', confirmed: true, confirmationSent: false, recoverySent: false });
    expect(await svc.getAdminAccessView(app, state.clientId)).toMatchObject({ ownLogin: null, canSetOwnerEmail: true });
    // Nor is one Supabase no longer has.
    idp.own.delete(state.ownAuth);
    expect(await svc.getAdminAccessView(app, state.clientId)).toMatchObject({ ownLogin: null, canSetOwnerEmail: true });
    // A link sent is either kind: a confirmation, or a set-your-password link.
    idp.own.set(state.ownAuth, { email: 'owner@lifecycle.test', confirmed: false, confirmationSent: true, recoverySent: false });
    expect(await svc.getAdminAccessView(app, state.clientId)).toMatchObject({
      ownLogin: { email: 'owner@lifecycle.test', confirmed: false, linkSent: true },
      canSetOwnerEmail: true,
    });
    idp.own.set(state.ownAuth, { email: 'owner@lifecycle.test', confirmed: true, confirmationSent: false, recoverySent: true });
    expect(await svc.getAdminAccessView(app, state.clientId)).toMatchObject({
      ownLogin: { email: 'owner@lifecycle.test', confirmed: true, linkSent: true },
      canSetOwnerEmail: false,
    });
  });

  it('19. a temporary login whose address was moved away from the Headway-made one opens nothing', async () => {
    session = { id: ADMIN_AUTH };
    const clientId = await newClient('Moved Address');
    expect((await svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'moved@address.test' })).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId } });
    const tempAuth = access.tempAuthId!;
    session = { id: tempAuth };
    expect((await svc.loadActor(app, tempAuth, access.loginId))?.userId).toBe(access.userId);
    expect((await svc.loadActor(app, tempAuth, access.loginId.toUpperCase()))?.userId).toBe(access.userId);
    expect(await svc.loadActor(app, tempAuth, 'holder@elsewhere.test')).toBeNull();
    // The owner's own login is never judged by that rule.
    session = { id: state.ownAuth };
    expect((await svc.loadActor(app, state.ownAuth, 'owner@lifecycle.test'))?.userId).toBe(state.ownerUserId);
  });

  it('20. the old "is this address taken?" function is gone, and the login guard stands in the database instead', async () => {
    const [gone] = await owner.$queryRaw<{ fn: string | null }[]>`
      SELECT to_regprocedure('app.owner_email_taken(text)')::text AS fn`;
    expect(gone?.fn).toBeNull();
    // Asked for anyway from a temporary session, it is simply not there.
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.lateClientId } });
    session = { id: access.tempAuthId! };
    await expect(
      svc.withRlsContext(app, (tx) => tx.$queryRaw`SELECT app.owner_email_taken(${'owner@other.test'}) AS t`),
    ).rejects.toThrow(/42883|does not exist/);

    const triggers = await owner.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE tgrelid = 'public."User"'::regclass AND NOT tgisinternal`;
    expect(triggers.map((t) => t.tgname)).toContain('user_handover_login_guard');
  });

  it('21. the admin corrects an address nobody has proved — the old login is voided and replaced — and cannot once it is proved', async () => {
    session = { id: ADMIN_AUTH };
    // No temporary access yet: nothing to correct; generating is where it is typed.
    const early = await svc.setOwnerEmail(app, state.suggestedClientId, 'early@owner.test');
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.message).toMatch(/Generate temporary access first/);

    const clientId = await newClient('Corrected Email');
    expect((await svc.generateTempAccess(app, clientId, state.adminId, { ownerEmail: 'asha@typo.test' })).ok).toBe(true);
    const access = await owner.accountAccess.findUniqueOrThrow({ where: { clientId }, include: { user: true } });
    const tempAuth = access.tempAuthId!;
    const first = access.user.authProviderId!;
    expect(idp.own.get(first)?.email).toBe('asha@typo.test');
    // The holder already asked for the link: it went to the typo.
    idp.own.get(first)!.recoverySent = true;
    session = { id: ADMIN_AUTH };
    expect(await svc.getAdminAccessView(app, clientId)).toMatchObject({
      ownLogin: { email: 'asha@typo.test', confirmed: false, linkSent: true },
      canSetOwnerEmail: true,
    });
    const before = await counts();

    // The same address, however typed: nothing to do.
    const from = mark();
    expect(await svc.setOwnerEmail(app, clientId, ' ASHA@typo.test ')).toEqual({
      ok: true,
      data: { email: 'asha@typo.test', changed: false },
    });
    // Refused on the field: another account's address (the first business's
    // owner proved theirs in step 5), a Headway-made one, a malformed one.
    const refusals: Array<[string, RegExp]> = [
      ['owner@other.test', ADDRESS_TAKEN],
      ['owner@lifecycle.test', ADDRESS_TAKEN],
      ['abcd2345@access.headway.local', /not a temporary one/],
      ['not-an-email', /valid email/],
    ];
    for (const [raw, why] of refusals) {
      const refused = await svc.setOwnerEmail(app, clientId, raw);
      expect(refused.ok, raw).toBe(false);
      if (!refused.ok) expect(refused.errors.ownerEmail).toMatch(why);
    }
    expect(since(from)).toEqual(NOTHING);
    expect((await owner.user.findUniqueOrThrow({ where: { id: access.userId } })).authProviderId).toBe(first);

    // The correction. The old login is never edited (a link already in the
    // typo's inbox would then confirm the new address): it is scrambled, so
    // that link is dead, replaced by a new pending login, and deleted.
    const fixed = await svc.setOwnerEmail(app, clientId, 'asha@right.test');
    expect(fixed).toEqual({ ok: true, data: { email: 'asha@right.test', changed: true } });
    const made = since(from);
    expect(made.scrambled).toEqual([first]);
    expect(made.pending).toHaveLength(1);
    const right = made.pending[0]!;
    expect(right.email).toBe('asha@right.test');
    expect(right.authUserId).not.toBe(first);
    expect(made.deleted).toEqual([first]);
    expect(made.minted).toEqual([]);
    expect(idp.own.has(first)).toBe(false);
    expect(await owner.user.findUniqueOrThrow({ where: { id: access.userId } })).toMatchObject({
      authProviderId: right.authUserId,
      // Still the Headway-made address: the real one is written once proved.
      email: access.loginId,
    });
    expect(await counts()).toEqual(before);
    expect(await svc.getAdminAccessView(app, clientId)).toMatchObject({
      ownLogin: { email: 'asha@right.test', confirmed: false, linkSent: false },
      temporary: 'ACTIVE',
      canSetOwnerEmail: true,
    });
    // The old login opens nothing; the temporary one still opens the business,
    // and its link now goes to the corrected address.
    expect(await visibleClients(first)).toEqual([]);
    session = { id: first };
    expect(await svc.loadActor(app, first)).toBeNull();
    session = { id: tempAuth };
    expect(await svc.passwordLinkTarget(app, clientId, access.userId, tempAuth)).toEqual({ ok: true, email: 'asha@right.test' });

    // Two admins correcting it at once: one swap lands, the other is told,
    // and every login made on the way that nothing points at is deleted.
    session = { id: ADMIN_AUTH };
    const race = mark();
    const results = await Promise.all([
      svc.setOwnerEmail(app, clientId, 'asha@one.test'),
      svc.setOwnerEmail(app, clientId, 'asha@two.test'),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const lost = results.find((r) => !r.ok);
    if (lost && !lost.ok) expect(lost.message).toMatch(/changed while you were looking/);
    const raced = since(race);
    expect(raced.pending).toHaveLength(2);
    const bound = (await owner.user.findUniqueOrThrow({ where: { id: access.userId } })).authProviderId!;
    const winner = raced.pending.find((p) => p.authUserId === bound)!;
    expect(winner).toBeDefined();
    const loser = raced.pending.find((p) => p.authUserId !== bound)!;
    expect([...raced.deleted].sort()).toEqual([right.authUserId, loser.authUserId].sort());
    expect(idp.own.has(right.authUserId)).toBe(false);
    expect(idp.own.has(loser.authUserId)).toBe(false);
    expect(idp.own.get(bound)?.email).toBe(winner.email);
    expect(await counts()).toEqual(before);

    // Once the owner proves it, it is theirs: never replaced from here.
    idp.own.set(bound, { email: winner.email, confirmed: true, confirmationSent: false, recoverySent: true });
    session = { id: bound };
    expect(await svc.provisionUser(app, { providerId: bound, email: winner.email })).toEqual({
      userId: access.userId,
      created: false,
    });
    session = { id: ADMIN_AUTH };
    const settled = mark();
    const refused = await svc.setOwnerEmail(app, clientId, 'asha@later.test');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/already confirmed/);
    expect(since(settled)).toEqual(NOTHING);
    expect(await owner.user.findUniqueOrThrow({ where: { id: access.userId } })).toMatchObject({
      authProviderId: bound,
      email: winner.email,
    });
    expect((await svc.getAdminAccessView(app, clientId)).canSetOwnerEmail).toBe(false);
  });

  it('22. nobody’s own session can do that swap itself — the database refuses it, whichever login asks', async () => {
    const before = await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } });

    // The owner, signed in with their own (proved) login, running exactly the
    // statement setOwnerEmail's swap runs — and its plainer forms.
    session = { id: state.ownAuth };
    await expect(
      svc.withRlsContext(app, (tx) =>
        tx.user.updateMany({
          where: { id: state.ownerUserId, authProviderId: state.ownAuth },
          data: { authProviderId: SOMEONE_AUTH },
        }),
      ),
    ).rejects.toThrow(LOGIN_GUARD);
    await expect(
      app.user.updateMany({ where: { id: state.ownerUserId }, data: { email: 'someone@else.test' } }),
    ).rejects.toThrow(LOGIN_GUARD);
    // Not even to nothing, which would leave a login for an admin to "add".
    await expect(
      app.user.updateMany({ where: { id: state.ownerUserId }, data: { authProviderId: null } }),
    ).rejects.toThrow(LOGIN_GUARD);
    expect(await owner.user.findUniqueOrThrow({ where: { id: state.ownerUserId } })).toMatchObject({
      authProviderId: before.authProviderId,
      email: before.email,
    });

    // The whole service, run from a temporary session on a business whose
    // owner has not proved their address (it is the admin's alone, by its
    // action's gate): the database refuses the swap, RepOS ends exactly as it
    // was, and the login it made on the way is deleted again.
    const late = await owner.accountAccess.findUniqueOrThrow({ where: { clientId: state.lateClientId }, include: { user: true } });
    const lateOwn = late.user.authProviderId!;
    session = { id: late.tempAuthId! };
    const from = mark();
    const attempt = await svc.setOwnerEmail(app, state.lateClientId, 'holder@evil.test');
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.message).toMatch(/Nothing was changed/);
    const made = since(from);
    expect(made.pending.map((p) => p.email)).toEqual(['holder@evil.test']);
    expect(made.deleted).toEqual([made.pending[0]!.authUserId]);
    expect(idp.own.has(made.pending[0]!.authUserId)).toBe(false);
    expect(await owner.user.findUniqueOrThrow({ where: { id: late.userId } })).toMatchObject({
      authProviderId: lateOwn,
      email: late.loginId,
    });
    expect(idp.own.get(lateOwn)?.email).toBe('late@owner.test');
  });
});
