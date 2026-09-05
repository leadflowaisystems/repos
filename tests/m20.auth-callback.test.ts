import { describe, expect, it } from 'vitest';
import { safeNext } from '@/app/auth/callback/route';

/**
 * THE CALLBACK'S REDIRECT GUARD (M20 Stage 8A).
 *
 * `next` decides where somebody lands after an emailed auth link is
 * exchanged, which is the exact shape of an open redirect: a link that looks
 * like RepOS, carries a real Supabase code, and drops the person on a page
 * someone else controls.
 *
 * The route already refuses to redirect at all without a valid one-time code,
 * so this guard is the second line rather than the first. It is tested
 * directly because that first line makes it unreachable from the outside —
 * and an untested second line is not a second line.
 */
describe('the auth callback redirect guard', () => {
  it('accepts an ordinary same-site path', () => {
    expect(safeNext('/onboarding')).toBe('/onboarding');
    expect(safeNext('/workspace/abc123')).toBe('/workspace/abc123');
    expect(safeNext('/reset-password')).toBe('/reset-password');
  });

  it('refuses a protocol-relative URL, which resolves to another host', () => {
    // `new URL('//evil.com', origin)` is https://evil.com — the classic miss.
    expect(safeNext('//evil.example.com')).toBeNull();
    expect(safeNext('//evil.example.com/path')).toBeNull();
  });

  it('refuses an absolute URL on any scheme', () => {
    for (const raw of [
      'https://evil.example.com',
      'http://evil.example.com',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      expect(safeNext(raw), raw).toBeNull();
    }
  });

  it('refuses anything that is not a path at all', () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext('evil.example.com')).toBeNull();
    expect(safeNext('../../etc')).toBeNull();
  });
});

import { checkPublicBaseUrl, isLoopbackAddress, isProduction } from '@/lib/config/public-url';
import { AUTH_CALLBACK, callbackFor } from '@/lib/auth/redirect';

/**
 * WHICH ADDRESSES AN AUTH EMAIL MAY POINT AT.
 *
 * `authRedirectUrl` itself reads the database and the request, so its decision
 * is reproduced here from the same two predicates it uses. The case that
 * matters is the one that caught us out: in production mode a loopback http
 * address must still be accepted, or running locally silently discards the
 * redirect and the emailed link goes back to whatever the Supabase Site URL
 * happens to be.
 */
function allowed(candidate: string, nodeEnv: string): boolean {
  const env = { NODE_ENV: nodeEnv } as unknown as NodeJS.ProcessEnv;
  return checkPublicBaseUrl(candidate, {
    requireHttps: isProduction(env) && !isLoopbackAddress(candidate),
  }).ok;
}

describe('addresses an auth email may point at', () => {
  it('accepts loopback http even in production mode', () => {
    // The machine talking to itself never crosses a network.
    expect(allowed('http://localhost:3210', 'production')).toBe(true);
    expect(allowed('http://127.0.0.1:3210', 'production')).toBe(true);
  });

  it('still refuses plain http anywhere a network is involved', () => {
    expect(allowed('http://repos.example.com', 'production')).toBe(false);
    expect(allowed('http://192.168.1.20:3000', 'production')).toBe(false);
  });

  it('accepts https anywhere', () => {
    expect(allowed('https://repos.example.com', 'production')).toBe(true);
    expect(allowed('https://repos.example.com', 'development')).toBe(true);
  });

  it('refuses an address carrying a path, query, or credentials', () => {
    expect(allowed('https://repos.example.com/app', 'production')).toBe(false);
    expect(allowed('https://user:pw@repos.example.com', 'production')).toBe(false);
  });

  it('builds the callback link with an escaped, same-site next', () => {
    expect(AUTH_CALLBACK).toBe('/auth/callback');
    expect(callbackFor('/reset-password')).toBe('/auth/callback?next=%2Freset-password');
    expect(callbackFor('/onboarding')).toBe('/auth/callback?next=%2Fonboarding');
  });
});

import { landingPathFor } from '@/lib/onboarding/service';
import { ACTIVE } from '@/lib/tenancy/service';

/**
 * WHERE A SUCCESSFUL SIGN-IN SENDS PEOPLE (M20 Stage 8D).
 *
 * The sign-in action redirects to `next || landingPathFor(actor)`. The login
 * page used to default `next` to '/' when none was asked for, so the first
 * half of that expression was always truthy and the second was never consulted
 * — every business owner was sent to the operator console, which is exactly
 * the page they are not allowed to open.
 */
describe('where a successful sign-in lands', () => {
  const owner = {
    isPlatformAdmin: false,
    memberships: [{ clientId: 'client_gold_gym', status: ACTIVE }],
  };

  it('sends a business owner to their own workspace, never to the console', () => {
    const next = '';
    expect(next || landingPathFor(owner)).toBe('/workspace/client_gold_gym');
  });

  it('sends a platform admin to the operator console', () => {
    expect(landingPathFor({ isPlatformAdmin: true, memberships: [] })).toBe('/');
  });

  it('sends someone with no active membership to finish signing up', () => {
    expect(landingPathFor({ isPlatformAdmin: false, memberships: [] })).toBe('/onboarding');
    expect(
      landingPathFor({
        isPlatformAdmin: false,
        memberships: [{ clientId: 'c', status: 'SUSPENDED' }],
      }),
    ).toBe('/onboarding');
  });

  it('still honours an explicit same-site next', () => {
    const next = '/workspace/client_gold_gym/team';
    expect(next || landingPathFor(owner)).toBe('/workspace/client_gold_gym/team');
  });
});
