import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SETTING UP THE OWNER'S OWN LOGIN, AFTER M53: THE TEMPORARY SESSION ONLY ASKS.
 *
 * Before M53 the owner's "Set up your account" form, used while signed in
 * with the TEMPORARY login (`…@access.headway.local` + a generated password),
 * took an email AND a password and made the owner's permanent login from
 * them. Whoever held the handover sheet could therefore type an address of
 * their own and keep the business. That form and its action are gone.
 *
 * Now the split is:
 *
 *   ADMIN (Headway staff, adminGate)
 *     generateTempAccessAction  types the owner's email; the service makes the
 *                               owner's own login, pending (unconfirmed, no
 *                               password anybody knows, no email sent), plus
 *                               the temporary login.
 *     setOwnerEmailAction       adds or corrects that address while the owner
 *                               has not proved it.
 *
 *   TEMPORARY SESSION (OWNER gate, this business's temporary login switched on)
 *     requestOwnerPasswordLinkAction
 *                               presses one button. Supabase emails the
 *                               ordinary set-your-password link to the
 *                               address HEADWAY recorded — read from the own
 *                               login's live Supabase record by
 *                               `passwordLinkTarget`, never from the form.
 *                               Nothing is created, changed or deleted: no
 *                               login, no password, no RepOS row.
 *
 *   TEAM ACTIONS               refuse a temporary session outright: inviting
 *                               your own address as an owner would be the
 *                               same hole by another door.
 *
 * So nothing a temporary session types ever becomes anyone's login or
 * password. Every collaborator is mocked; this file is about wiring — which
 * values reach which collaborator, which never do, and what comes back.
 */

const TEMP_AUTH = '0d7c9a52-5b1e-4c7a-9f0e-1a2b3c4d5e01';
const OWN_AUTH = '0d7c9a52-5b1e-4c7a-9f0e-1a2b3c4d5e02';
const TEMP_EMAIL = 'k7m2q9xd@access.headway.local';
const OWNER_EMAIL = 'owner@example.com';
const HOSTILE = 'attacker@evil.example';

const h = vi.hoisted(() => {
  const db: string[] = [];
  const dbReplies: Record<string, unknown> = {};
  /**
   * A database that records every call made on it (`model.method`) and
   * answers from `dbReplies` (null when nothing is set). Lets a test say
   * "nothing was written" — or "nothing was touched at all" — without
   * listing every Prisma method by hand.
   */
  const prisma = new Proxy(
    {},
    {
      get(_target, model) {
        if (typeof model !== 'string') return undefined;
        return new Proxy(
          {},
          {
            get(_m, method) {
              if (typeof method !== 'string') return undefined;
              return async () => {
                db.push(`${model}.${method}`);
                return dbReplies[`${model}.${method}`] ?? null;
              };
            },
          },
        );
      },
    },
  );
  return {
    calls: [] as string[],
    db,
    dbReplies,
    prisma,
    withRlsContext: vi.fn(),
    currentAuthIdentity: vi.fn(),
    adminGate: vi.fn(),
    tenantGate: vi.fn(),
    currentActor: vi.fn(),
    supabaseConfig: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    authRedirectUrl: vi.fn(),
    // Supabase admin: every one of these makes, changes or removes a login.
    createPendingOwnerIdentity: vi.fn(),
    createTempIdentity: vi.fn(),
    setIdentityPassword: vi.fn(),
    randomizeIdentityPassword: vi.fn(),
    deleteIdentity: vi.fn(),
    removeGeneratedIdentity: vi.fn(),
    getIdentitySnapshot: vi.fn(),
    // The account-access service.
    generateTempAccess: vi.fn(),
    setOwnerEmail: vi.fn(),
    disableTempAccess: vi.fn(),
    passwordLinkTarget: vi.fn(),
    // The team service and the invitation email.
    inviteMember: vi.fn(),
    revokeInvite: vi.fn(),
    setMembership: vi.fn(),
    acceptInviteViaResolver: vi.fn(),
    deliverInvitation: vi.fn(),
    invitationLink: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    h.calls.push(`redirect:${to}`);
    // The real one throws to unwind the action; code under test must not be
    // written in a way that swallows it.
    throw new Error('NEXT_REDIRECT');
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    h.calls.push(`revalidate:${path}`);
  },
  revalidateTag: () => {},
}));

vi.mock('@/lib/db', () => ({
  prisma: h.prisma,
  currentAuthIdentity: h.currentAuthIdentity,
  withRlsContext: h.withRlsContext,
  isMissingDbFunction: () => false,
}));

vi.mock('@/lib/auth/guard', () => ({ adminGate: h.adminGate, tenantGate: h.tenantGate }));

vi.mock('@/lib/auth/authorize', () => ({ currentActor: h.currentActor }));

vi.mock('@/lib/auth/supabase', () => ({
  supabaseConfig: h.supabaseConfig,
  supabaseServerClient: async () => ({ auth: { resetPasswordForEmail: h.resetPasswordForEmail } }),
  detachedAuthClient: () => ({ auth: {} }),
  SUPABASE_URL_VAR: 'SUPABASE_URL',
}));

vi.mock('@/lib/auth/redirect', () => ({
  authRedirectUrl: h.authRedirectUrl,
  // As the real one: the one route that turns an emailed code into a session.
  callbackFor: (next: string) => `/auth/callback?next=${encodeURIComponent(next)}`,
  emailConfirmCallback: (next: string) => `/auth/callback?next=${encodeURIComponent(next)}&kind=email`,
}));

vi.mock('@/lib/auth/supabase-admin', () => ({
  createPendingOwnerIdentity: h.createPendingOwnerIdentity,
  createTempIdentity: h.createTempIdentity,
  setIdentityPassword: h.setIdentityPassword,
  randomizeIdentityPassword: h.randomizeIdentityPassword,
  deleteIdentity: h.deleteIdentity,
  removeGeneratedIdentity: h.removeGeneratedIdentity,
  getIdentitySnapshot: h.getIdentitySnapshot,
  IDENTITY_MISSING: 'missing',
}));

vi.mock('@/lib/account-access/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/account-access/service')>()),
  generateTempAccess: h.generateTempAccess,
  setOwnerEmail: h.setOwnerEmail,
  disableTempAccess: h.disableTempAccess,
  passwordLinkTarget: h.passwordLinkTarget,
}));

vi.mock('@/lib/team/service', () => ({
  inviteMember: h.inviteMember,
  revokeInvite: h.revokeInvite,
  setMembership: h.setMembership,
  acceptInviteViaResolver: h.acceptInviteViaResolver,
}));

vi.mock('@/lib/invite/email', () => ({
  deliverInvitation: h.deliverInvitation,
  invitationLink: h.invitationLink,
  roleLabel: (role: string) => (role === 'BUSINESS_OWNER' ? 'an owner' : 'a team member'),
}));

type State = { ok: boolean; message: string; errors: Record<string, string>; data?: Record<string, string> };

const IDLE: State = { ok: false, message: '', errors: {} };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs an action, turning the redirect throw into an observable outcome. */
async function outcome(action: Promise<State>): Promise<State | 'redirected'> {
  try {
    return await action;
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') return 'redirected';
    throw error;
  }
}

const ADMIN = { userId: 'admin1', email: 'staff@headway.example', isPlatformAdmin: true, status: 'ACTIVE', memberships: [] };

/** Signed in with this business's TEMPORARY login. */
const TEMPORARY_OWNER = {
  userId: 'owner1',
  email: TEMP_EMAIL,
  isPlatformAdmin: false,
  status: 'ACTIVE',
  memberships: [],
  temporaryAccessClientId: 'client1',
  setupPendingClientId: 'client1',
};

/** The same owner, signed in with their own login. */
const OWN_LOGIN_OWNER = { ...TEMPORARY_OWNER, email: OWNER_EMAIL, temporaryAccessClientId: null, setupPendingClientId: null };

const REFUSED: State = { ok: false, message: 'You do not have access to that.', errors: {} };

/** Every Supabase admin call that makes, changes or removes a login. */
const IDENTITY_WRITERS = [
  'createPendingOwnerIdentity',
  'createTempIdentity',
  'setIdentityPassword',
  'randomizeIdentityPassword',
  'deleteIdentity',
  'removeGeneratedIdentity',
] as const;

function expectNoIdentityChanged() {
  for (const name of IDENTITY_WRITERS) expect(h[name], name).not.toHaveBeenCalled();
}

const DB_WRITE = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|\$executeRaw|\$executeRawUnsafe|\$transaction)$/;

function expectNoDbWrite() {
  expect(h.db.filter((call) => DB_WRITE.test(call))).toEqual([]);
  expect(h.withRlsContext).not.toHaveBeenCalled();
}

beforeEach(() => {
  h.calls.length = 0;
  h.db.length = 0;
  for (const key of Object.keys(h.dbReplies)) delete h.dbReplies[key];
  for (const mock of Object.values(h)) {
    if (typeof mock === 'function' && 'mockReset' in mock) (mock as ReturnType<typeof vi.fn>).mockReset();
  }

  h.adminGate.mockResolvedValue({ ok: true, actor: ADMIN });
  h.tenantGate.mockResolvedValue({ ok: true, actor: TEMPORARY_OWNER, clientId: 'client1', role: 'BUSINESS_OWNER' });
  h.supabaseConfig.mockReturnValue({ ok: true, config: { url: 'https://x.supabase.co', anonKey: 'anon' } });
  h.currentAuthIdentity.mockResolvedValue({ id: TEMP_AUTH, email: TEMP_EMAIL });
  h.authRedirectUrl.mockImplementation(async (path: string) => `https://headway.test${path}`);
  h.passwordLinkTarget.mockResolvedValue({ ok: true, email: OWNER_EMAIL });
  h.resetPasswordForEmail.mockImplementation(async () => {
    h.calls.push('link');
    return { data: {}, error: null };
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// The temporary session: one button, one link, to Headway's address
// ---------------------------------------------------------------------------

async function requestLink(fields: Record<string, string> = {}) {
  const { requestOwnerPasswordLinkAction } = await import('@/lib/actions/account-access');
  return outcome(requestOwnerPasswordLinkAction(IDLE, form({ clientId: 'client1', ...fields })));
}

describe('requestOwnerPasswordLinkAction — the happy path', () => {
  it('asks Supabase for the set-your-password link to the recorded address, then lands on Account with link=sent', async () => {
    expect(await requestLink()).toBe('redirected');

    // OWNER gate, and it must still work for a business whose trial has ended.
    expect(h.tenantGate).toHaveBeenCalledWith(expect.any(FormData), 'OWNER', 'clientId', { allowLocked: true });
    expect(h.passwordLinkTarget).toHaveBeenCalledWith(h.prisma, 'client1', 'owner1', TEMP_AUTH);
    expect(h.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(h.resetPasswordForEmail).toHaveBeenCalledWith(OWNER_EMAIL, {
      redirectTo: 'https://headway.test/auth/callback?next=%2Freset-password',
    });
    expect(h.calls).toEqual([
      'link',
      'revalidate:/workspace/client1/account',
      'redirect:/workspace/client1/account?link=sent',
    ]);
  });

  it('ignores every address the form carries: the link goes only where passwordLinkTarget says', async () => {
    expect(
      await requestLink({
        email: HOSTILE,
        ownerEmail: HOSTILE,
        password: 'chosen-by-whoever-holds-the-sheet',
        redirectTo: 'https://evil.example/steal',
      }),
    ).toBe('redirected');

    expect(h.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, options] = h.resetPasswordForEmail.mock.calls[0]!;
    expect(email).toBe(OWNER_EMAIL);
    expect(options.redirectTo).toMatch(/\/auth\/callback\?next=%2Freset-password$/);
    expect(options.redirectTo.startsWith('https://headway.test/')).toBe(true);
    // Nothing from the form reached any collaborator.
    const everything = JSON.stringify([
      h.resetPasswordForEmail.mock.calls,
      h.passwordLinkTarget.mock.calls.map((call) => call.slice(1)),
      h.authRedirectUrl.mock.calls,
    ]);
    expect(everything).not.toContain('evil.example');
    expect(everything).not.toContain('chosen-by-whoever');
  });

  it('makes, changes and deletes no login, and writes nothing to the database', async () => {
    expect(await requestLink({ email: HOSTILE, password: 'new-password-123' })).toBe('redirected');

    expectNoIdentityChanged();
    expectNoDbWrite();
    // passwordLinkTarget (mocked here) is the only reader; the action itself
    // never touches the database.
    expect(h.db).toEqual([]);
  });
});

describe('requestOwnerPasswordLinkAction — what Supabase answers', () => {
  it.each([
    ['a 429', { code: undefined, status: 429, message: 'Too Many Requests' }],
    ['over_email_send_rate_limit', { code: 'over_email_send_rate_limit', status: 400, message: 'email rate limit exceeded' }],
  ])('treats %s as "wait a little" (link=wait)', async (_label, error) => {
    h.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error });

    expect(await requestLink()).toBe('redirected');
    expect(h.calls.at(-1)).toBe('redirect:/workspace/client1/account?link=wait');
    expectNoIdentityChanged();
    expectNoDbWrite();
  });

  it('reports any other refusal as link=failed, and logs it without the address', async () => {
    h.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { code: 'unexpected_failure', status: 500, message: 'Error sending recovery email' },
    });

    expect(await requestLink()).toBe('redirected');
    expect(h.calls.at(-1)).toBe('redirect:/workspace/client1/account?link=failed');

    expect(console.error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain('unexpected_failure');
    expect(logged).toContain('client1');
    expect(logged).not.toContain(OWNER_EMAIL);
    expect(logged).not.toContain(TEMP_EMAIL);
    expectNoIdentityChanged();
    expectNoDbWrite();
  });

  it('logs nothing when the link went out', async () => {
    await requestLink();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('requestOwnerPasswordLinkAction — refusals send nothing', () => {
  it("passes the gate's refusal straight through", async () => {
    h.tenantGate.mockResolvedValueOnce({ ok: false, state: REFUSED });

    expect(await requestLink()).toBe(REFUSED);
    expect(h.currentAuthIdentity).not.toHaveBeenCalled();
    expect(h.passwordLinkTarget).not.toHaveBeenCalled();
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
  });

  it('says it is unavailable when Supabase is not configured', async () => {
    h.supabaseConfig.mockReturnValueOnce({ ok: false, reason: 'Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.' });

    const state = (await requestLink()) as State;
    expect(state.ok).toBe(false);
    expect(state.message).toBe('This is unavailable right now. Please contact Headway.');
    // The configuration detail is for the operator, not the owner.
    expect(state.message).not.toContain('SUPABASE');
    expect(h.passwordLinkTarget).not.toHaveBeenCalled();
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('asks to sign in again when there is no session behind the request', async () => {
    h.currentAuthIdentity.mockResolvedValueOnce(null);

    const state = (await requestLink()) as State;
    expect(state.ok).toBe(false);
    expect(state.message).toBe('Please sign in again, then try once more.');
    expect(h.passwordLinkTarget).not.toHaveBeenCalled();
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['NOT_TEMPORARY', 'Sign in with the temporary email and password Headway gave you to do this.'],
    ['NO_OWN_LOGIN', 'Headway has not added your email address yet. Please contact Headway.'],
    ['UNKNOWN', 'We could not check your sign-in just now. Try again in a minute.'],
  ])('%s gets its own message and never calls Supabase', async (reason, message) => {
    h.passwordLinkTarget.mockResolvedValueOnce({ ok: false, reason });

    const state = (await requestLink({ email: HOSTILE })) as State;
    expect(state).toEqual({ ok: false, message, errors: {} });
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
    expectNoIdentityChanged();
    expectNoDbWrite();
  });

  it('the three refusals say three different things', async () => {
    const messages = new Set<string>();
    for (const reason of ['NOT_TEMPORARY', 'NO_OWN_LOGIN', 'UNKNOWN']) {
      h.passwordLinkTarget.mockResolvedValueOnce({ ok: false, reason });
      messages.add(((await requestLink()) as State).message);
    }
    expect(messages.size).toBe(3);
  });
});

describe('requestOwnerPasswordLinkAction — with the real passwordLinkTarget', () => {
  const LIVE = { email: OWNER_EMAIL, confirmed: false, confirmationSent: false, recoverySent: false, lastSignInAt: null };
  const ROW = {
    userId: 'owner1',
    status: 'TEMPORARY_ACTIVE',
    tempAuthId: TEMP_AUTH,
    user: { authProviderId: OWN_AUTH },
  };

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('@/lib/account-access/service')>('@/lib/account-access/service');
    h.passwordLinkTarget.mockImplementation(actual.passwordLinkTarget);
    h.getIdentitySnapshot.mockResolvedValue(LIVE);
  });

  it("sends to the own login's live address, reading one row and writing none", async () => {
    h.dbReplies['accountAccess.findUnique'] = ROW;

    expect(await requestLink({ email: HOSTILE })).toBe('redirected');
    expect(h.getIdentitySnapshot).toHaveBeenCalledWith(OWN_AUTH);
    expect(h.resetPasswordForEmail).toHaveBeenCalledWith(OWNER_EMAIL, expect.anything());
    expect(h.db).toEqual(['accountAccess.findUnique']);
    expectNoIdentityChanged();
    expectNoDbWrite();
  });

  it('refuses the owner signed in with their own login (they use "Forgot password?")', async () => {
    h.dbReplies['accountAccess.findUnique'] = ROW;
    h.tenantGate.mockResolvedValueOnce({ ok: true, actor: OWN_LOGIN_OWNER, clientId: 'client1', role: 'BUSINESS_OWNER' });
    h.currentAuthIdentity.mockResolvedValueOnce({ id: OWN_AUTH, email: OWNER_EMAIL });

    const state = (await requestLink()) as State;
    expect(state.message).toMatch(/temporary email and password/);
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('refuses once Headway has switched the temporary login off', async () => {
    h.dbReplies['accountAccess.findUnique'] = { ...ROW, status: 'DISABLED' };

    const state = (await requestLink()) as State;
    expect(state.message).toMatch(/temporary email and password/);
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('never sends to a Headway-made address on the own login', async () => {
    h.dbReplies['accountAccess.findUnique'] = ROW;
    h.getIdentitySnapshot.mockResolvedValue({ ...LIVE, email: 'z02brkuq@access.headway.local' });

    const state = (await requestLink()) as State;
    expect(state.message).toMatch(/has not added your email address/);
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The admin's side: the owner's email is typed by Headway
// ---------------------------------------------------------------------------

async function setEmail(fields: Record<string, string>) {
  const { setOwnerEmailAction } = await import('@/lib/actions/account-access');
  return (await outcome(setOwnerEmailAction(IDLE, form(fields)))) as State;
}

describe('setOwnerEmailAction', () => {
  it("passes the admin gate's refusal straight through, and changes nothing", async () => {
    h.adminGate.mockResolvedValueOnce({ ok: false, state: REFUSED });

    expect(await setEmail({ clientId: 'client1', ownerEmail: OWNER_EMAIL })).toBe(REFUSED);
    expect(h.setOwnerEmail).not.toHaveBeenCalled();
    expect(h.tenantGate).not.toHaveBeenCalled();
  });

  it('refuses without a client id', async () => {
    const state = await setEmail({ ownerEmail: OWNER_EMAIL });
    expect(state).toEqual({ ok: false, message: 'Missing client id.', errors: {} });
    expect(h.setOwnerEmail).not.toHaveBeenCalled();
  });

  it("passes the form's ownerEmail (trimmed) to setOwnerEmail", async () => {
    h.setOwnerEmail.mockResolvedValueOnce({ ok: true, data: { email: OWNER_EMAIL, changed: true } });

    await setEmail({ clientId: 'client1', ownerEmail: '  Owner@Example.com ' });
    expect(h.setOwnerEmail).toHaveBeenCalledWith(h.prisma, 'client1', 'Owner@Example.com');
  });

  it('a refusal returns its message and field errors, and keeps the typed address in the field', async () => {
    h.setOwnerEmail.mockResolvedValueOnce({
      ok: false,
      message: 'Some fields need attention.',
      errors: { ownerEmail: 'This email already has a Headway sign-in.' },
    });

    const state = await setEmail({ clientId: 'client1', ownerEmail: 'taken@example.com' });
    expect(state).toEqual({
      ok: false,
      message: 'Some fields need attention.',
      errors: { ownerEmail: 'This email already has a Headway sign-in.' },
      data: { ownerEmail: 'taken@example.com' },
    });
    expect(h.calls).toEqual([]);
  });

  it('a change says where the sign-in now is, and that earlier links stopped working', async () => {
    h.setOwnerEmail.mockResolvedValueOnce({ ok: true, data: { email: 'fixed@example.com', changed: true } });

    const state = await setEmail({ clientId: 'client1', ownerEmail: 'fixed@example.com' });
    expect(state.ok).toBe(true);
    expect(state.message).toBe(
      "Saved. The owner's own sign-in is now fixed@example.com. Links sent to any earlier address no longer work.",
    );
    expect(h.calls).toContain('revalidate:/clients/client1');
  });

  it('the same address again says it already is the owner’s email', async () => {
    h.setOwnerEmail.mockResolvedValueOnce({ ok: true, data: { email: OWNER_EMAIL, changed: false } });

    const state = await setEmail({ clientId: 'client1', ownerEmail: OWNER_EMAIL });
    expect(state.ok).toBe(true);
    expect(state.message).toBe(`${OWNER_EMAIL} is already the owner's email.`);
  });

  it('sends no email of any kind', async () => {
    h.setOwnerEmail.mockResolvedValueOnce({ ok: true, data: { email: OWNER_EMAIL, changed: true } });
    await setEmail({ clientId: 'client1', ownerEmail: OWNER_EMAIL });
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

async function generate(fields: Record<string, string>) {
  const { generateTempAccessAction } = await import('@/lib/actions/account-access');
  return (await outcome(generateTempAccessAction(IDLE, form(fields)))) as State;
}

describe('generateTempAccessAction', () => {
  it("passes the admin gate's refusal straight through", async () => {
    h.adminGate.mockResolvedValueOnce({ ok: false, state: REFUSED });

    expect(await generate({ clientId: 'client1', ownerEmail: OWNER_EMAIL })).toBe(REFUSED);
    expect(h.generateTempAccess).not.toHaveBeenCalled();
  });

  it('refuses without a client id', async () => {
    const state = await generate({ ownerEmail: OWNER_EMAIL });
    expect(state.message).toBe('Missing client id.');
    expect(h.generateTempAccess).not.toHaveBeenCalled();
  });

  it("passes the owner's email through to generateTempAccess, with the admin as the actor", async () => {
    h.generateTempAccess.mockResolvedValueOnce({ ok: true, data: { email: TEMP_EMAIL, password: 'Kq7m-x3pa-9fne-t2wd' } });

    await generate({ clientId: 'client1', ownerEmail: ' owner@example.com ' });
    expect(h.generateTempAccess).toHaveBeenCalledWith(h.prisma, 'client1', 'admin1', { ownerEmail: OWNER_EMAIL });
  });

  it('switching access back on (no email field) passes an empty address and lets the service decide', async () => {
    h.generateTempAccess.mockResolvedValueOnce({ ok: true, data: { email: TEMP_EMAIL, password: 'Kq7m-x3pa-9fne-t2wd' } });

    await generate({ clientId: 'client1' });
    expect(h.generateTempAccess).toHaveBeenCalledWith(h.prisma, 'client1', 'admin1', { ownerEmail: '' });
  });

  it('a refusal keeps the typed address in the field, and hands back no credentials', async () => {
    h.generateTempAccess.mockResolvedValueOnce({
      ok: false,
      message: 'Some fields need attention.',
      errors: { ownerEmail: 'Enter the owner’s own email address, not a temporary one.' },
    });

    const state = await generate({ clientId: 'client1', ownerEmail: 'x@access.headway.local' });
    expect(state).toEqual({
      ok: false,
      message: 'Some fields need attention.',
      errors: { ownerEmail: 'Enter the owner’s own email address, not a temporary one.' },
      data: { ownerEmail: 'x@access.headway.local' },
    });
    expect(h.calls).toEqual([]);
  });

  it('success returns the client id, the temporary email, the password (once) and the sign-in URL', async () => {
    h.generateTempAccess.mockResolvedValueOnce({ ok: true, data: { email: TEMP_EMAIL, password: 'Kq7m-x3pa-9fne-t2wd' } });

    const state = await generate({ clientId: 'client1', ownerEmail: OWNER_EMAIL });
    expect(state.ok).toBe(true);
    expect(state.message).toMatch(/Copy the password now/);
    expect(state.data).toEqual({
      clientId: 'client1',
      email: TEMP_EMAIL,
      password: 'Kq7m-x3pa-9fne-t2wd',
      signInUrl: 'https://headway.test/login',
    });
    expect(h.calls).toContain('revalidate:/clients/client1');
    // Headway records the address; nobody is emailed by generating access.
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('disableTempAccessAction', () => {
  it("passes the admin gate's refusal straight through", async () => {
    h.adminGate.mockResolvedValueOnce({ ok: false, state: REFUSED });
    const { disableTempAccessAction } = await import('@/lib/actions/account-access');

    expect(await disableTempAccessAction(IDLE, form({ clientId: 'client1' }))).toBe(REFUSED);
    expect(h.disableTempAccess).not.toHaveBeenCalled();
  });

  it('switches the temporary login off for this client, as the admin', async () => {
    h.disableTempAccess.mockResolvedValueOnce({ ok: true, data: {} });
    const { disableTempAccessAction } = await import('@/lib/actions/account-access');

    const state = await disableTempAccessAction(IDLE, form({ clientId: 'client1' }));
    expect(state.ok).toBe(true);
    expect(h.disableTempAccess).toHaveBeenCalledWith(h.prisma, 'client1', 'admin1');
  });
});

// ---------------------------------------------------------------------------
// The team: not from a temporary login
// ---------------------------------------------------------------------------

describe('team actions — a temporary session decides nothing about who gets in', () => {
  const asTemporary = () =>
    h.tenantGate.mockResolvedValue({ ok: true, actor: TEMPORARY_OWNER, clientId: 'client1', role: 'BUSINESS_OWNER' });
  const asOwnLogin = () =>
    h.tenantGate.mockResolvedValue({ ok: true, actor: OWN_LOGIN_OWNER, clientId: 'client1', role: 'BUSINESS_OWNER' });

  function expectTeamUntouched() {
    expect(h.inviteMember).not.toHaveBeenCalled();
    expect(h.revokeInvite).not.toHaveBeenCalled();
    expect(h.setMembership).not.toHaveBeenCalled();
    expect(h.acceptInviteViaResolver).not.toHaveBeenCalled();
    expect(h.deliverInvitation).not.toHaveBeenCalled();
    expect(h.db).toEqual([]);
  }

  it('inviteMemberAction refuses a temporary session — even inviting its own address as an owner', async () => {
    asTemporary();
    const { inviteMemberAction } = await import('@/lib/actions/team');

    const state = await inviteMemberAction(
      IDLE,
      form({ clientId: 'client1', email: HOSTILE, role: 'BUSINESS_OWNER' }),
    );
    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/temporary access/);
    expect(state.message).toMatch(/your own email/);
    expect(state.data).toBeUndefined();
    expectTeamUntouched();
  });

  it('revokeInviteAction refuses a temporary session', async () => {
    asTemporary();
    const { revokeInviteAction } = await import('@/lib/actions/team');

    const state = await revokeInviteAction(IDLE, form({ clientId: 'client1', inviteId: 'invite1' }));
    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/temporary access/);
    expectTeamUntouched();
  });

  it('setMembershipAction refuses a temporary session', async () => {
    asTemporary();
    const { setMembershipAction } = await import('@/lib/actions/team');

    const state = await setMembershipAction(
      IDLE,
      form({ clientId: 'client1', membershipId: 'membership1', role: 'BUSINESS_OWNER', status: 'ACTIVE' }),
    );
    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/temporary access/);
    expectTeamUntouched();
  });

  it('acceptInviteAction refuses a temporary session too', async () => {
    h.currentActor.mockResolvedValueOnce(TEMPORARY_OWNER);
    const { acceptInviteAction } = await import('@/lib/actions/team');

    const state = await acceptInviteAction(IDLE, form({ token: 'some-token' }));
    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/temporary access/);
    expectTeamUntouched();
  });

  it("passes the gate's refusal straight through", async () => {
    h.tenantGate.mockResolvedValue({ ok: false, state: REFUSED });
    const { inviteMemberAction } = await import('@/lib/actions/team');

    expect(await inviteMemberAction(IDLE, form({ clientId: 'client1', email: HOSTILE, role: 'BUSINESS_OWNER' }))).toBe(
      REFUSED,
    );
    expectTeamUntouched();
  });

  it('the owner on their own login CAN invite someone as an owner', async () => {
    asOwnLogin();
    h.inviteMember.mockResolvedValueOnce({
      ok: true,
      data: {
        inviteId: 'invite1',
        token: 'tok_fake_0001',
        email: 'partner@example.com',
        role: 'BUSINESS_OWNER',
        expiresAt: new Date('2026-10-09T00:00:00Z'),
      },
    });
    h.dbReplies['client.findUnique'] = { businessName: 'Headway QA Café (test)' };
    h.deliverInvitation.mockResolvedValueOnce({ sent: true, email: 'partner@example.com' });
    h.invitationLink.mockResolvedValueOnce('https://headway.test/invite/tok_fake_0001');
    const { inviteMemberAction } = await import('@/lib/actions/team');

    const state = await inviteMemberAction(
      IDLE,
      form({ clientId: 'client1', email: 'partner@example.com', role: 'BUSINESS_OWNER' }),
    );
    expect(h.tenantGate).toHaveBeenCalledWith(expect.any(FormData), 'OWNER');
    expect(h.inviteMember).toHaveBeenCalledWith(h.prisma, 'client1', {
      email: 'partner@example.com',
      role: 'BUSINESS_OWNER',
      invitedById: 'owner1',
    });
    expect(state.ok).toBe(true);
    expect(state.data).toEqual({
      link: 'https://headway.test/invite/tok_fake_0001',
      email: 'partner@example.com',
      sent: 'yes',
    });
  });

  it('the owner on their own login CAN revoke an invitation', async () => {
    asOwnLogin();
    h.revokeInvite.mockResolvedValueOnce({ ok: true, data: { inviteId: 'invite1' } });
    const { revokeInviteAction } = await import('@/lib/actions/team');

    const state = await revokeInviteAction(IDLE, form({ clientId: 'client1', inviteId: 'invite1' }));
    expect(h.revokeInvite).toHaveBeenCalledWith(h.prisma, 'client1', 'invite1');
    expect(state).toEqual({ ok: true, message: 'That invitation no longer works.', errors: {} });
  });

  it('the owner on their own login CAN change a member', async () => {
    asOwnLogin();
    h.setMembership.mockResolvedValueOnce({ ok: true, data: { membershipId: 'membership1' } });
    const { setMembershipAction } = await import('@/lib/actions/team');

    const state = await setMembershipAction(
      IDLE,
      form({ clientId: 'client1', membershipId: 'membership1', role: 'BUSINESS_OWNER' }),
    );
    expect(h.setMembership).toHaveBeenCalledWith(h.prisma, 'client1', 'membership1', {
      role: 'BUSINESS_OWNER',
      status: undefined,
    });
    expect(state).toEqual({ ok: true, message: 'Saved.', errors: {} });
  });
});
