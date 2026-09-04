import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import { buildGatewayCopy, publicReviewLabel } from './copy';
import { OnceSet, RateLimiter, hashKey, newFormNonce } from './throttle';
import {
  TOKEN_ALPHABET,
  TOKEN_LENGTH,
  checkBaseUrl,
  feedbackPath,
  feedbackUrl,
  isLoopbackAddress,
  isPublicToken,
  newPublicToken,
} from './token';

/**
 * The pure parts of the feedback gateway (M14): tokens, addresses, ceilings
 * and wording. No database, no network, no clock they were not handed.
 */

_resetPackCache();

describe('public tokens', () => {
  it('are the right length, from the printable alphabet, and never repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      const token = newPublicToken();
      expect(token).toHaveLength(TOKEN_LENGTH);
      for (const char of token) expect(TOKEN_ALPHABET).toContain(char);
      expect(isPublicToken(token)).toBe(true);
      seen.add(token);
    }
    expect(seen.size).toBe(2000);
  });

  it('leave out the characters that print ambiguously', () => {
    for (const char of ['i', 'l', 'o', '1', 'I', 'L', 'O']) {
      expect(TOKEN_ALPHABET).not.toContain(char);
    }
  });

  it('refuse anything that is not exactly a token, before any lookup', () => {
    expect(isPublicToken('')).toBe(false);
    expect(isPublicToken(null)).toBe(false);
    expect(isPublicToken(undefined)).toBe(false);
    expect(isPublicToken(42)).toBe(false);
    expect(isPublicToken('a'.repeat(TOKEN_LENGTH - 1))).toBe(false);
    expect(isPublicToken('a'.repeat(TOKEN_LENGTH + 1))).toBe(false);
    expect(isPublicToken('A'.repeat(TOKEN_LENGTH))).toBe(false);
    expect(isPublicToken('l'.repeat(TOKEN_LENGTH))).toBe(false);
    expect(isPublicToken('../../etc/passwd/../..')).toBe(false);
    // A cuid — a database id — is never a public token.
    expect(isPublicToken('cmtjsf9440004p2aocvao3zbk')).toBe(false);
  });

  it('build the customer address from the base and the token, nothing else', () => {
    const token = 'abcdefghjkmnpqrstuvwxy';
    expect(feedbackPath(token)).toBe('/feedback/abcdefghjkmnpqrstuvwxy');
    expect(feedbackUrl('http://192.168.1.7:3000', token)).toBe(
      'http://192.168.1.7:3000/feedback/abcdefghjkmnpqrstuvwxy',
    );
    expect(feedbackUrl('https://repos.example/', token)).toBe(
      'https://repos.example/feedback/abcdefghjkmnpqrstuvwxy',
    );
  });
});

describe('the public address', () => {
  it('accepts an origin, with plain http for the shop Wi-Fi', () => {
    expect(checkBaseUrl('http://192.168.1.7:3000')).toEqual({ ok: true, url: 'http://192.168.1.7:3000' });
    expect(checkBaseUrl('https://repos.example/')).toEqual({ ok: true, url: 'https://repos.example' });
    expect(checkBaseUrl('  http://localhost:3000  ')).toEqual({ ok: true, url: 'http://localhost:3000' });
  });

  it('refuses anything that is not just an address', () => {
    for (const bad of ['', 'repos.example', 'ftp://x', 'javascript:alert(1)', 'http://x/feedback', 'http://x/?a=1', 'http://x/#f']) {
      expect(checkBaseUrl(bad).ok, bad).toBe(false);
    }
  });

  it('knows when an address only works on this computer', () => {
    expect(isLoopbackAddress('http://localhost:3000')).toBe(true);
    expect(isLoopbackAddress('http://127.0.0.1:3000')).toBe(true);
    expect(isLoopbackAddress('http://[::1]:3000')).toBe(true);
    expect(isLoopbackAddress('http://192.168.1.7:3000')).toBe(false);
    expect(isLoopbackAddress('https://repos.example')).toBe(false);
  });
});

describe('ceilings', () => {
  const at = (s: number) => new Date(2026, 5, 1, 12, 0, s);

  it('allow up to the limit inside the window and refuse the next', () => {
    const limiter = new RateLimiter(3, 60_000);
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.check('k', at(i)).allowed).toBe(true);
      limiter.record('k', at(i));
    }
    const refused = limiter.check('k', at(3));
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) expect(refused.retryAfterMs).toBeGreaterThan(0);
  });

  it('slide: an old hit falls out of the window', () => {
    const limiter = new RateLimiter(2, 10_000);
    limiter.record('k', at(0));
    limiter.record('k', at(1));
    expect(limiter.check('k', at(5)).allowed).toBe(false);
    expect(limiter.check('k', at(11)).allowed).toBe(true);
  });

  it('keep every key apart', () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.record('a', at(0));
    expect(limiter.check('a', at(1)).allowed).toBe(false);
    expect(limiter.check('b', at(1)).allowed).toBe(true);
  });

  it('cap how many keys are remembered', () => {
    const limiter = new RateLimiter(1, 60_000, 3);
    for (const key of ['a', 'b', 'c', 'd']) limiter.record(key, at(0));
    // The oldest key was dropped, so it is allowed again.
    expect(limiter.check('a', at(1)).allowed).toBe(true);
    expect(limiter.check('d', at(1)).allowed).toBe(false);
  });

  it('a nonce is accepted once and refused after, until it expires', () => {
    const once = new OnceSet(1_000);
    expect(once.useOnce('n1', at(0))).toBe(true);
    expect(once.useOnce('n1', at(0))).toBe(false);
    expect(once.useOnce('n2', at(0))).toBe(true);
    expect(once.useOnce('n1', at(2))).toBe(true);
  });

  it('hash keys with a salt, so the same address is a different key under a different salt', () => {
    expect(hashKey('10.0.0.1', 's1')).toBe(hashKey('10.0.0.1', 's1'));
    expect(hashKey('10.0.0.1', 's1')).not.toBe(hashKey('10.0.0.1', 's2'));
    expect(hashKey('10.0.0.1')).not.toContain('10.0.0.1');
    expect(hashKey('10.0.0.1')).toHaveLength(20);
  });

  it('form nonces are random and short-lived by construction', () => {
    expect(newFormNonce()).not.toBe(newFormNonce());
    expect(newFormNonce()).toMatch(/^[0-9a-f]{24}$/);
  });
});

describe('customer wording', () => {
  const BANNED_ON_THE_PAGE = /5 star|five star|google|positive review|happy customers|rate us|leave a review/i;

  it('is complete for every vertical, from its pack', () => {
    for (const pack of listPacks()) {
      const copy = buildGatewayCopy(pack, 'Test Business');
      for (const [key, value] of Object.entries(copy)) {
        expect(typeof value === 'string' && value.trim().length > 0, `${pack.id}.${key}`).toBe(true);
      }
      expect(copy.headline.endsWith('?'), `${pack.id} headline`).toBe(true);
    }
  });

  it('never steers, gates or names a platform before the customer has written anything', () => {
    for (const pack of listPacks()) {
      const copy = buildGatewayCopy(pack, 'Test Business');
      const shown = [
        copy.headline,
        copy.prompt,
        copy.ratingLabel,
        copy.textLabel,
        copy.placeholder,
        copy.languageHint,
        copy.submitLabel,
        copy.privacyLine,
        copy.printHeadline,
        copy.printLine,
        copy.thanksHeadline,
        copy.thanksLine,
      ].join(' ');
      expect(shown, pack.id).not.toMatch(BANNED_ON_THE_PAGE);
    }
  });

  it('falls back to universal wording when a pack has no gateway block', () => {
    const bare = { ...getPackOrFallback('clinic'), gateway: undefined };
    const copy = buildGatewayCopy(bare, 'Bare Clinic');
    expect(copy.headline).toBe('How was your experience?');
    expect(copy.privacyLine).toContain('Bare Clinic');
    expect(copy.thanksLine.length).toBeGreaterThan(0);
  });

  it('differs between verticals only where the pack says so', () => {
    const cafe = buildGatewayCopy(getPackOrFallback('restaurant'), 'Corner Cafe');
    const clinic = buildGatewayCopy(getPackOrFallback('clinic'), 'Sunrise Clinic');
    expect(cafe.placeholder).not.toBe(clinic.placeholder);
    expect(cafe.thanksLine).not.toBe(clinic.thanksLine);
    expect(cafe.ratingLabel).toBe(clinic.ratingLabel);
    expect(cafe.submitLabel).toBe(clinic.submitLabel);
  });

  it('labels the public review button from the stored link alone', () => {
    expect(publicReviewLabel('https://g.page/r/abc/review')).toBe('Leave a Google review');
    expect(publicReviewLabel('https://www.google.com/maps/place/x')).toBe('Leave a Google review');
    expect(publicReviewLabel('https://maps.app.goo.gl/abc')).toBe('Leave a Google review');
    expect(publicReviewLabel('https://www.justdial.com/x')).toBe('Leave a public review');
    expect(publicReviewLabel('not a url')).toBe('Leave a public review');
    expect(publicReviewLabel(null)).toBe('Leave a public review');
  });
});
