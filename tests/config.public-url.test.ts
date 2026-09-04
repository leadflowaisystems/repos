import { describe, expect, it } from 'vitest';
import {
  PUBLIC_BASE_URL_VAR,
  checkPublicBaseUrl,
  isLoopbackAddress,
  resolvePublicBaseUrl,
} from '@/lib/config/public-url';

/**
 * THE ADDRESS PRINTED INTO A QR CODE (M16).
 *
 * A card on a shop counter cannot be recalled. Every rule here exists so that
 * the address baked into one is deliberate, stable across restarts, and never
 * taken from something a stranger can set.
 */

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return overrides as NodeJS.ProcessEnv;
}

const PROD = { NODE_ENV: 'production' } as const;

describe('checking an address before it is used', () => {
  it('accepts a plain origin', () => {
    expect(checkPublicBaseUrl('https://repos.example.com')).toEqual({
      ok: true,
      url: 'https://repos.example.com',
    });
    expect(checkPublicBaseUrl('http://192.168.1.7:3000')).toEqual({
      ok: true,
      url: 'http://192.168.1.7:3000',
    });
  });

  it('trims a trailing slash rather than doubling it later', () => {
    const checked = checkPublicBaseUrl('https://repos.example.com/');
    expect(checked.ok && checked.url).toBe('https://repos.example.com');
  });

  it('refuses anything that is not just an origin', () => {
    for (const bad of [
      'https://repos.example.com/somewhere',
      'https://repos.example.com/?a=1',
      'https://repos.example.com/#top',
    ]) {
      expect(checkPublicBaseUrl(bad).ok).toBe(false);
    }
  });

  it('refuses an address with a username or password in it', () => {
    expect(checkPublicBaseUrl('https://user:pass@repos.example.com').ok).toBe(false);
  });

  it('refuses a scheme a phone cannot open', () => {
    for (const bad of ['ftp://repos.example.com', 'javascript:alert(1)', 'file:///c:/', '']) {
      expect(checkPublicBaseUrl(bad).ok).toBe(false);
    }
  });

  it('refuses plain http when https is required', () => {
    const checked = checkPublicBaseUrl('http://repos.example.com', { requireHttps: true });
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.reason).toContain('https://');
  });

  it('knows an address that only works on this computer', () => {
    expect(isLoopbackAddress('http://localhost:3000')).toBe(true);
    expect(isLoopbackAddress('http://127.0.0.1:3000')).toBe(true);
    expect(isLoopbackAddress('http://192.168.1.7:3000')).toBe(false);
    expect(isLoopbackAddress('https://repos.example.com')).toBe(false);
  });
});

describe('working out the one address to use', () => {
  it('prefers the installation setting over everything else', () => {
    const resolved = resolvePublicBaseUrl({
      setting: 'https://saved.example.com',
      requestOrigin: 'http://192.168.1.7:3000',
      env: env({ [PUBLIC_BASE_URL_VAR]: 'https://repos.example.com' }),
    });
    expect(resolved).toMatchObject({ ok: true, url: 'https://repos.example.com', source: 'ENV' });
  });

  it('falls back to the saved setting in development', () => {
    const resolved = resolvePublicBaseUrl({
      setting: 'https://saved.example.com',
      requestOrigin: 'http://192.168.1.7:3000',
      env: env(),
    });
    expect(resolved).toMatchObject({ ok: true, url: 'https://saved.example.com', source: 'SETTING' });
  });

  it('falls back to the address RepOS was opened on, in development only', () => {
    const resolved = resolvePublicBaseUrl({
      setting: null,
      requestOrigin: 'http://192.168.1.7:3000',
      env: env(),
    });
    expect(resolved).toMatchObject({ ok: true, url: 'http://192.168.1.7:3000', source: 'REQUEST' });
  });

  it('refuses to guess in production', () => {
    // This is the whole point: a forged Host header must never reach a QR.
    const resolved = resolvePublicBaseUrl({
      setting: 'https://saved.example.com',
      requestOrigin: 'https://evil.example',
      env: env(PROD),
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toContain(PUBLIC_BASE_URL_VAR);
  });

  it('refuses a plain-http address in production', () => {
    const resolved = resolvePublicBaseUrl({
      setting: null,
      requestOrigin: null,
      env: env({ ...PROD, [PUBLIC_BASE_URL_VAR]: 'http://repos.example.com' }),
    });
    expect(resolved.ok).toBe(false);
  });

  it('accepts an https address in production', () => {
    const resolved = resolvePublicBaseUrl({
      setting: null,
      requestOrigin: null,
      env: env({ ...PROD, [PUBLIC_BASE_URL_VAR]: 'https://repos.example.com' }),
    });
    expect(resolved).toMatchObject({ ok: true, url: 'https://repos.example.com', source: 'ENV' });
  });

  it('reports a broken setting instead of quietly using something else', () => {
    const resolved = resolvePublicBaseUrl({
      setting: 'https://saved.example.com',
      requestOrigin: 'http://192.168.1.7:3000',
      env: env({ [PUBLIC_BASE_URL_VAR]: 'not-an-address' }),
    });
    expect(resolved.ok).toBe(false);
  });

  it('says so when there is nothing to go on at all', () => {
    const resolved = resolvePublicBaseUrl({ setting: null, requestOrigin: null, env: env() });
    expect(resolved.ok).toBe(false);
  });

  it('flags an address that only works on this computer', () => {
    const resolved = resolvePublicBaseUrl({
      setting: null,
      requestOrigin: 'http://localhost:3000',
      env: env(),
    });
    expect(resolved).toMatchObject({ ok: true, loopback: true });
  });

  it('gives the same answer twice, so a restart cannot change a printed card', () => {
    const input = {
      setting: null,
      requestOrigin: null,
      env: env({ ...PROD, [PUBLIC_BASE_URL_VAR]: 'https://repos.example.com' }),
    };
    expect(resolvePublicBaseUrl(input)).toEqual(resolvePublicBaseUrl(input));
  });
});
