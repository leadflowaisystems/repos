import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMAIL_NOTICE_PARAM,
  emailNotice,
  RESET_LINK_PARAM,
  RESET_NOTICE_PARAM,
  resetLinkNotice,
  resetNotice,
} from '@/lib/auth/setup-notice';

// Vitest compiles .tsx with the classic JSX transform, which calls a free
// `React.createElement`; Next's own build does not need this. Kept local to
// this file rather than changing the shared test config.
(globalThis as { React?: typeof React }).React = React;

/**
 * THE FIXED SENTENCES ON THE SIGN-IN PAGE (M39, M52).
 *
 * Two redirects end on /login with something to say: a finished password
 * reset (the session is ended on purpose, so the next step is signing in with
 * the new password), and a "confirm your new email" link opened in a browser
 * that was not signed in. Both are fixed flags mapped to fixed sentences, so
 * this runs the real page against mocked collaborators and checks what it
 * returns: the notice is shown and the auto-redirect is skipped only for the
 * exact flags, and for anything else the page behaves exactly as it always
 * did — including never echoing a value someone put in the query string.
 */

const { redirectCalls, currentActorMock } = vi.hoisted(() => ({
  redirectCalls: [] as string[],
  currentActorMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirectCalls.push(to);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('@/components/forms/account-forms', () => ({ SignInForm: () => null }));
vi.mock('@/components/brand', () => ({ HeadwayWordmark: () => null }));
vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/auth/authorize', () => ({ currentActor: currentActorMock }));
vi.mock('@/lib/onboarding/service', () => ({ landingPathFor: () => '/workspace/client1' }));
vi.mock('@/lib/auth/redirect', () => ({
  safeNextPath: (value: unknown) =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null,
}));

const SIGNED_IN = { userId: 'owner1', email: 'new-owner@example.com', isPlatformAdmin: false, status: 'ACTIVE', memberships: [] };

/** Every string the returned tree would put on screen. Nothing is rendered. */
function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: unknown } }).props.children);
  }
  return '';
}

async function open(query: Record<string, string | string[]>) {
  const { default: LoginPage } = await import('@/app/(auth)/login/page');
  try {
    return { text: textOf(await LoginPage({ searchParams: Promise.resolve(query) })), redirected: false };
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') return { text: '', redirected: true };
    throw error;
  }
}

beforeEach(() => {
  redirectCalls.length = 0;
  currentActorMock.mockReset();
  currentActorMock.mockResolvedValue(null);
});

describe('the login page after a password reset', () => {
  it('says the password changed and asks for the new one', async () => {
    const page = await open({ reset: 'done' });

    expect(page.redirected).toBe(false);
    expect(page.text).toContain('Your password has been changed. Sign in with your new password.');
    expect(page.text).toContain('Sign in');
  });

  it('shows the sentence even to someone still signed in, without consulting the session', async () => {
    currentActorMock.mockResolvedValue(SIGNED_IN);
    const page = await open({ reset: 'done' });
    expect(page.redirected).toBe(false);
    expect(currentActorMock).not.toHaveBeenCalled();
  });
});

describe('the login page after a confirmed new email', () => {
  it('says the new address is confirmed and to sign in with it', async () => {
    const page = await open({ email: 'confirmed' });

    expect(page.redirected).toBe(false);
    expect(page.text).toContain('Your new email address is confirmed. Sign in with it and your password.');
  });
});

describe('any other value', () => {
  it('still sends a signed-in person onward when there is no flag at all', async () => {
    currentActorMock.mockResolvedValue(SIGNED_IN);
    const page = await open({});

    expect(page.redirected).toBe(true);
    expect(redirectCalls).toEqual(['/workspace/client1']);
  });

  it('treats any other value as no flag, and never puts it on the page', async () => {
    currentActorMock.mockResolvedValue(SIGNED_IN);
    const injected = 'Your account was suspended. Call +1-555-0100 now';
    for (const [key, value] of [
      ['reset', injected],
      ['reset', 'DONE'],
      ['reset', ''],
      ['email', '__proto__'],
      ['email', 'toString'],
      ['email', injected],
      ['setup', 'complete'],
    ] as const) {
      redirectCalls.length = 0;
      const page = await open({ [key]: value });
      expect(page.redirected, `${key}=${value}`).toBe(true);
      expect(page.text).not.toContain(injected);
    }
  });

  it('ignores a repeated parameter rather than picking one of its values', async () => {
    currentActorMock.mockResolvedValue(SIGNED_IN);
    const page = await open({ reset: ['done', 'done'] });
    expect(page.redirected).toBe(true);
  });

  it('shows no notice on an ordinary visit by someone signed out', async () => {
    const page = await open({});
    expect(page.redirected).toBe(false);
    expect(page.text).not.toContain('Your password has been changed');
    expect(page.text).not.toContain('is confirmed');
  });
});

describe('resetNotice / emailNotice / resetLinkNotice', () => {
  it('map exactly their own flags, and nothing else, to a sentence', () => {
    expect(resetNotice('done')).toMatch(/password has been changed/);
    expect(emailNotice('confirmed')).toMatch(/new email address is confirmed/);
    expect(emailNotice('incomplete')).toMatch(/could not finish confirming/);
    // M53: a dead confirmation link is replaced by "Forgot password?", which
    // needs no temporary login and confirms the address too.
    expect(emailNotice('expired')).toMatch(/Forgot password\?/);
    expect(emailNotice('expired')).not.toMatch(/send a new one from Account/);
    expect(resetLinkNotice('expired')).toMatch(/expired or was already used/);
    expect(resetLinkNotice('other-browser')).toMatch(/same browser/);
    for (const value of ['', 'Done', 'constructor', '__proto__', null, undefined, 1, ['done'], {}]) {
      expect(resetNotice(value), String(value)).toBeNull();
      expect(emailNotice(value), String(value)).toBeNull();
      expect(resetLinkNotice(value), String(value)).toBeNull();
    }
  });

  it('name the parameters the callback and the reset action actually send', () => {
    expect(RESET_NOTICE_PARAM).toBe('reset');
    expect(EMAIL_NOTICE_PARAM).toBe('email');
    expect(RESET_LINK_PARAM).toBe('link');
  });

  it('carry nothing sensitive in the sentence', () => {
    for (const sentence of [
      resetNotice('done'),
      emailNotice('confirmed'),
      emailNotice('incomplete'),
      emailNotice('expired'),
      resetLinkNotice('expired'),
      resetLinkNotice('other-browser'),
    ]) {
      expect(sentence).not.toMatch(/@|\{|\}/);
    }
  });
});

describe('the login page after a link the callback could not use', () => {
  it('tells a signed-out person their link expired or was used, and where to get a new one', async () => {
    const page = await open({ expired: '1' });
    expect(page.redirected).toBe(false);
    expect(page.text).toContain('That link has expired or was already used.');
    expect(page.text).toContain('Forgot password?');
  });

  it('shows nothing for any other value, and never puts it on the page', async () => {
    const injected = 'Your account was suspended. Call +1-555-0100 now';
    for (const value of [injected, '0', 'true', '']) {
      const page = await open({ expired: value });
      expect(page.text, value).not.toContain('That link has expired');
      expect(page.text).not.toContain(injected);
    }
  });

  it('still sends someone already signed in straight to their workspace', async () => {
    currentActorMock.mockResolvedValue(SIGNED_IN);
    const page = await open({ expired: '1' });
    expect(page.redirected).toBe(true);
    expect(redirectCalls).toEqual(['/workspace/client1']);
  });
});
