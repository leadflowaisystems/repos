import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAfterSetup, SETUP_NOTICE_PARAM, setupNotice } from '@/lib/auth/setup-notice';

// Vitest compiles .tsx with the classic JSX transform, which calls a free
// `React.createElement`; Next's own build does not need this. Kept local to
// this file rather than changing the shared test config.
(globalThis as { React?: typeof React }).React = React;

/**
 * THE CONFIRMATION AFTER ACCOUNT SETUP ACTUALLY REACHES THE OWNER (M39).
 *
 * Setup used to end in a bare redirect to /login. Two things made that a dead
 * end rather than a confirmation: the page had nothing to say, and — the part
 * a unit test on the action alone would miss — the owner is STILL SIGNED IN
 * when they arrive (the credential change goes through the admin API, which
 * leaves the session valid), so /login sent them straight back to their
 * workspace before rendering anything.
 *
 * So this runs the real page against mocked collaborators and checks what it
 * returns for a signed-in owner: the notice is shown and the auto-redirect is
 * skipped only for the two fixed flags, and for anything else the page
 * behaves exactly as it always did — including never echoing a value someone
 * put in the query string.
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
  currentActorMock.mockResolvedValue(SIGNED_IN);
});

describe('the login page after account setup', () => {
  it('shows the confirmation to an owner who is still signed in, instead of bouncing them', async () => {
    const page = await open({ setup: 'complete' });

    expect(page.redirected).toBe(false);
    expect(redirectCalls).toEqual([]);
    expect(page.text).toContain('Your account is set up. Sign in with your new email and password.');
    // Still the ordinary sign-in page underneath.
    expect(page.text).toContain('Sign in');
  });

  it('tells a password-only owner to use their login ID, not a new email', async () => {
    const page = await open({ setup: 'password' });

    expect(page.redirected).toBe(false);
    expect(page.text).toContain('Sign in with your login ID and your new password.');
    expect(page.text).not.toContain('new email');
  });

  it('never consults the session when it is showing the confirmation', async () => {
    await open({ setup: 'complete' });
    expect(currentActorMock).not.toHaveBeenCalled();
  });

  it('still sends a signed-in person onward when there is no flag at all', async () => {
    const page = await open({});

    expect(page.redirected).toBe(true);
    expect(redirectCalls).toEqual(['/workspace/client1']);
  });

  it('treats any other value as no flag, and never puts it on the page', async () => {
    const injected = 'Your account was suspended. Call +1-555-0100 now';
    for (const value of [injected, 'COMPLETE', '', '__proto__', 'toString']) {
      redirectCalls.length = 0;
      const page = await open({ setup: value });
      expect(page.redirected, value).toBe(true);
      expect(page.text).not.toContain(injected);
    }
  });

  it('ignores a repeated parameter rather than picking one of its values', async () => {
    const page = await open({ setup: ['complete', 'password'] });
    expect(page.redirected).toBe(true);
  });

  it('shows no confirmation on an ordinary visit by someone signed out', async () => {
    currentActorMock.mockResolvedValue(null);
    const page = await open({});

    expect(page.redirected).toBe(false);
    expect(page.text).not.toContain('Your account is set up');
  });
});

describe('setupNotice / loginAfterSetup', () => {
  it('maps exactly two flags, and nothing else, to a sentence', () => {
    expect(setupNotice('complete')).toMatch(/new email and password/);
    expect(setupNotice('password')).toMatch(/login ID and your new password/);
    for (const value of ['', 'Complete', 'constructor', '__proto__', null, undefined, 1, ['complete'], {}]) {
      expect(setupNotice(value), String(value)).toBeNull();
    }
  });

  it('builds a redirect whose flag the login page will recognise', () => {
    for (const emailChanged of [true, false]) {
      const url = new URL(loginAfterSetup(emailChanged), 'https://repos.invalid');
      expect(url.pathname).toBe('/login');
      expect(setupNotice(url.searchParams.get(SETUP_NOTICE_PARAM))).not.toBeNull();
    }
  });

  it('carries nothing sensitive in either the redirect or the sentence', () => {
    for (const emailChanged of [true, false]) {
      const path = loginAfterSetup(emailChanged);
      // A fixed flag and nothing else: no address, no password, no id.
      expect(path).toMatch(/^\/login\?setup=(complete|password)$/);
      const sentence = setupNotice(new URL(path, 'https://repos.invalid').searchParams.get('setup'));
      expect(sentence).not.toMatch(/@|\{|\}/);
    }
  });
});
