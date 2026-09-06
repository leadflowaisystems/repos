import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE INVITATION ACTUALLY GOES SOMEWHERE (launch pass).
 *
 * RepOS could create an invitation and never deliver it. The reason was
 * written down in `@/lib/team/service`: delivery was the operator's job "until
 * the Supabase project exists". It exists, and a client-facing SaaS whose Team
 * page says "RepOS does not send email" is not finished.
 *
 * What is asserted here is the part that can be got wrong quietly:
 *
 *   the link in the email is absolute, and it is this invitation's;
 *   "sent" is claimed only when the provider accepted the message;
 *   a refusal is reported in words an owner can act on, with the link intact;
 *   the token appears in the link and nowhere else — not in a log line, not in
 *   an error, not in the metadata attached to the account.
 */

const TOKEN = 'Zx9-token-that-must-not-leak_ABCDEFGHIJKLMNOP';

const sent = vi.hoisted(() => ({
  calls: [] as Array<{ email: string; options?: Record<string, unknown> }>,
  error: null as { message: string } | null,
  configured: true,
  baseUrl: 'https://repos.example.com' as string | null,
}));

vi.mock('@/lib/auth/supabase', () => ({
  SUPABASE_URL_VAR: 'SUPABASE_URL',
  SUPABASE_ANON_KEY_VAR: 'SUPABASE_ANON_KEY',
  supabaseConfig: () =>
    sent.configured
      ? { ok: true, config: { url: 'https://x.supabase.co', anonKey: 'anon' } }
      : { ok: false, reason: 'not configured' },
  isSupabaseConfigured: () => sent.configured,
  supabaseServerClient: async () => ({
    auth: {
      signInWithOtp: async (args: { email: string; options?: Record<string, unknown> }) => {
        sent.calls.push(args);
        return { data: {}, error: sent.error };
      },
    },
  }),
}));

vi.mock('@/lib/auth/redirect', () => ({
  AUTH_CALLBACK: '/auth/callback',
  callbackFor: (next: string) => `/auth/callback?next=${encodeURIComponent(next)}`,
  authRedirectUrl: async (path: string) => (sent.baseUrl ? `${sent.baseUrl}${path}` : undefined),
}));

const { deliverInvitation, invitationLink, roleLabel } = await import('@/lib/invite/email');

const INVITE = {
  email: 'them@example.com',
  token: TOKEN,
  businessName: 'Corner Cafe',
  roleLabel: 'a team member',
  expiresAt: new Date('2026-09-13T00:00:00.000Z'),
};

beforeEach(() => {
  sent.calls = [];
  sent.error = null;
  sent.configured = true;
  sent.baseUrl = 'https://repos.example.com';
});

describe('delivering an invitation', () => {
  it('emails the address the owner typed, and says it went', async () => {
    const result = await deliverInvitation(INVITE);
    expect(result).toEqual({ sent: true, email: 'them@example.com' });
    expect(sent.calls).toHaveLength(1);
    expect(sent.calls[0]!.email).toBe('them@example.com');
  });

  it('sends them to this invitation, through the callback that signs them in', async () => {
    await deliverInvitation(INVITE);
    const redirect = String(sent.calls[0]!.options?.emailRedirectTo);
    // Absolute, or it is not a link in an email.
    expect(redirect.startsWith('https://repos.example.com/')).toBe(true);
    // Through the callback, which exchanges the link for a session and
    // provisions the account — an invitee has no account yet, and a link that
    // only showed them the page would strand them at "please sign in".
    expect(redirect).toContain('/auth/callback?next=');
    expect(decodeURIComponent(redirect)).toContain(`/invite/${TOKEN}`);
  });

  it('creates the account it is inviting, because the invitee has none yet', async () => {
    await deliverInvitation(INVITE);
    expect(sent.calls[0]!.options?.shouldCreateUser).toBe(true);
  });

  it('carries the business and the role for the email template, and never the token', async () => {
    await deliverInvitation(INVITE);
    const data = sent.calls[0]!.options?.data as Record<string, string>;
    expect(data.repos_business).toBe('Corner Cafe');
    expect(data.repos_role).toBe('a team member');
    expect(JSON.stringify(data)).not.toContain(TOKEN);
  });

  it('refuses to claim delivery when the provider refused', async () => {
    sent.error = { message: 'boom' };
    const result = await deliverInvitation(INVITE);
    expect(result.sent).toBe(false);
  });

  it('explains a rate limit as something the owner can work around', async () => {
    sent.error = { message: 'Email rate limit exceeded' };
    const result = await deliverInvitation(INVITE);
    expect(result.sent).toBe(false);
    if (result.sent) return;
    expect(result.reason).toMatch(/rate-limited/i);
    expect(result.reason).toMatch(/still valid|send the link yourself/i);
  });

  it('explains sign-ups being closed, which is the other thing that actually happens', async () => {
    sent.error = { message: 'Signups not allowed for otp' };
    const result = await deliverInvitation(INVITE);
    expect(result.sent).toBe(false);
    if (result.sent) return;
    expect(result.reason).toMatch(/not accepting new sign-ups/i);
  });

  it('never puts the token in a reason an owner or a log might see', async () => {
    for (const message of ['boom', 'Email rate limit exceeded', 'Signups not allowed']) {
      sent.error = { message };
      const result = await deliverInvitation(INVITE);
      expect(JSON.stringify(result)).not.toContain(TOKEN);
    }
  });

  it('sends nothing, and says why, when RepOS has no public address', async () => {
    sent.baseUrl = null;
    const result = await deliverInvitation(INVITE);
    expect(result.sent).toBe(false);
    expect(sent.calls).toHaveLength(0);
    if (result.sent) return;
    expect(result.reason).toMatch(/public address/i);
  });

  it('sends nothing when there is no email provider configured at all', async () => {
    sent.configured = false;
    const result = await deliverInvitation(INVITE);
    expect(result.sent).toBe(false);
    expect(sent.calls).toHaveLength(0);
  });

  it('hands back an absolute invitation link for the owner to pass on', async () => {
    expect(await invitationLink(TOKEN)).toBe(`https://repos.example.com/invite/${TOKEN}`);
    sent.baseUrl = null;
    expect(await invitationLink(TOKEN)).toBeNull();
  });

  it('describes a role the way a person would say it', () => {
    expect(roleLabel('BUSINESS_OWNER')).toBe('an owner');
    expect(roleLabel('BUSINESS_STAFF')).toBe('a team member');
    expect(roleLabel('anything else')).toBe('a team member');
  });
});

// ---------------------------------------------------------------------------
// How it is wired, read from the source
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');

describe('the team page tells the truth about email', () => {
  const action = code(read('src', 'lib', 'actions', 'team.ts'));
  const form = code(read('src', 'components', 'forms', 'team-forms.tsx'));

  it('claims "sent" only on the delivery result, never on the invitation existing', () => {
    expect(action).toContain('delivery.sent');
    expect(action).toMatch(/delivery\.sent\s*\n?\s*\?\s*`Invitation email sent to/);
    expect(action).toMatch(/but no email was sent\. \$\{delivery\.reason\}/);
  });

  it('no longer says RepOS does not send email', () => {
    expect(form).not.toMatch(/RepOS does not send email/i);
    expect(action).not.toMatch(/RepOS sends nothing/i);
    expect(code(read('src', 'lib', 'team', 'service.ts'))).not.toMatch(
      /DELIVERY IS NOT IMPLEMENTED/,
    );
  });

  it('keeps the copyable link as the fallback, and says it is one', () => {
    expect(form).toContain('CopyButton');
    expect(form).toContain('Copy invitation link');
    expect(form).toContain('state.data.link');
    expect(form).toMatch(/in case it does not arrive|send it yourself/i);
  });

  it('does not log the token anywhere', () => {
    for (const file of [
      ['src', 'lib', 'invite', 'email.ts'],
      ['src', 'lib', 'actions', 'team.ts'],
      ['src', 'lib', 'team', 'service.ts'],
    ]) {
      const source = code(read(...file));
      const logs = [...source.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1] ?? '');
      for (const argument of logs) {
        expect(argument).not.toMatch(/token/i);
      }
    }
  });

  it('sends through Supabase Auth, which is the one transport this repo allows', () => {
    const email = code(read('src', 'lib', 'invite', 'email.ts'));
    expect(email).toContain('signInWithOtp');
    // The compliance suite bans a second outbound caller in src/, and bans the
    // words `nodemailer` and `smtp.` outright. This is the sanctioned path.
    expect(email).not.toMatch(/fetch\(|nodemailer|smtp\.|mailto:/);
  });

  it('gates inviting to an owner, unchanged', () => {
    expect(action).toMatch(/export async function inviteMemberAction[\s\S]*?await tenantGate\(form, 'OWNER'\)/);
  });
});

describe('the invitation page says what is being joined', () => {
  const page = code(read('src', 'app', '(auth)', 'invite', '[token]', 'page.tsx'));

  it('resolves nothing at all for a signed-out visitor', () => {
    // The token stays an opaque string until somebody is signed in, so trying
    // tokens tells a stranger neither whether one is real nor whose it is.
    expect(page).toContain('const invite = actor ? await invitationPreview(prisma, token, actor.userId) : null;');
  });

  it('names the business, the role, the address and the expiry above the button', () => {
    expect(page).toContain('invite.businessName');
    expect(page).toContain("invite.role === 'BUSINESS_OWNER' ? 'Owner' : 'Team member'");
    expect(page).toContain('DATE.format(invite.expiresAt)');
    expect(page).toContain('<AcceptInviteForm token={token} />');
  });

  it('still offers a signed-out visitor a way in and no information', () => {
    expect(page).toContain('You have been invited to a RepOS workspace');
    expect(page).toMatch(/Sign in/);
    expect(page).toMatch(/Create an account/);
  });

  it('says "Accept invitation" on the button itself', () => {
    expect(code(read('src', 'components', 'forms', 'team-forms.tsx'))).toContain(
      'Accept invitation',
    );
  });
});

describe('the RepOS wording for the message body ships with the repository', () => {
  const template = read('prisma', 'm20', 'invitation-email.html');

  it('is a RepOS invitation, not a provider notice', () => {
    expect(template).toContain('RepOS');
    expect(template).toContain('Accept invitation');
    expect(template).toContain('{{ .ConfirmationURL }}');
    expect(template).toContain('{{ .Data.repos_business }}');
    expect(template).toContain('{{ .Data.repos_role }}');
  });

  it('carries the fields the sender actually sets, and never the token', () => {
    const email = code(read('src', 'lib', 'invite', 'email.ts'));
    for (const field of ['repos_business', 'repos_role']) {
      expect(email, field).toContain(field);
      expect(template, field).toContain(field);
    }
    expect(template).not.toMatch(/\{\{\s*\.Data\.repos_token/);
  });

  it('is documented as going into both templates, because a new invitee gets the other one', () => {
    // Measured, not assumed: an address with no Supabase account receives the
    // Confirm signup template, and an existing account receives Magic Link.
    const readme = read('prisma', 'm20', 'README.md');
    expect(readme).toContain('invitation-email.html');
    expect(readme).toContain('Confirm signup');
    expect(readme).toContain('Magic Link');
  });
});
