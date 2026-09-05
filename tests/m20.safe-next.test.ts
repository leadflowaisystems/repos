import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/auth/redirect';
import { safeNext } from '@/app/auth/callback/route';

/**
 * THE SAME-SITE CHECK, ATTACKED (M20).
 *
 * The previous implementation asked "does it start with `/` and not `//`?".
 * That is a reasonable-looking question and it is the wrong one, because the
 * thing that eventually resolves the value is a URL parser, not a string
 * comparison, and the parser reads several inputs as leaving the site that a
 * prefix test reads as staying.
 *
 * Two of them shipped:
 *
 *   `/\evil.com`      — after the leading slash the parser is in relative-slash
 *                       state, where a backslash means what a second slash
 *                       means. Resolves to https://evil.com/.
 *   `/<tab>/evil.com` — tab, LF and CR are removed from the input BEFORE
 *                       parsing, so this is `//evil.com`.
 *
 * Both arrive decoded, because `searchParams.get()` and Next's `searchParams`
 * prop percent-decode: `?next=/%5Cevil.com` and `?next=/%09/evil.com` are how
 * they would actually be delivered.
 *
 * So these tests do not check the implementation's rules. They check the
 * OUTCOME, against the same parser a browser uses: for every hostile input,
 * resolving the result against our own origin must still land on our own
 * origin. A future rewrite that satisfies this cannot be wrong in the way the
 * last two were.
 */

const ORIGIN = 'https://repos.example.com';

/** Where a browser would actually go, given what the guard returned. */
function resolves(next: string | null): string {
  return new URL(next ?? '/', ORIGIN).origin;
}

const HOSTILE = [
  // The blocker, and its neighbours.
  ['backslash after the slash', '/\\evil.example.com'],
  ['double backslash', '/\\\\evil.example.com'],
  ['backslash then slash', '/\\/evil.example.com'],
  ['leading backslash', '\\/evil.example.com'],
  ['bare double backslash', '\\\\evil.example.com'],
  ['single leading backslash', '\\evil.example.com'],
  ['literal percent-5C left encoded', '/%5Cevil.example.com'],
  ['lowercase percent-5c', '/%5cevil.example.com'],

  // The second bypass: characters the parser deletes.
  ['tab', '/\t/evil.example.com'],
  ['newline', '/\n/evil.example.com'],
  ['carriage return', '/\r/evil.example.com'],
  ['tab before the backslash', '/\t\\evil.example.com'],
  ['null byte', '/\u0000/evil.example.com'],
  ['delete character', '/\u007f/evil.example.com'],

  // The third bypass, and the subtlest: the parser NORMALISES dot segments, so
  // a path that is not protocol-relative on the way in can be on the way out.
  // `..` empties the path and the following empty segment is appended, giving
  // `//evil.example.com`. The guard has to test what it RETURNS, not only what
  // it was given.
  ['dot-segment that normalises to protocol-relative', '/..//evil.example.com'],
  ['single dot segment', '/.//evil.example.com'],
  ['percent-encoded dot segments', '/%2e%2e//evil.example.com'],
  ['percent-encoded single dot, upper case', '/%2E//evil.example.com'],
  ['dot segments buried in a real path', '/clients/../..//evil.example.com'],

  // The classics.
  ['protocol-relative', '//evil.example.com'],
  ['protocol-relative with a path', '//evil.example.com/path'],
  ['https', 'https://evil.example.com'],
  ['http', 'http://evil.example.com'],
  ['uppercase scheme', 'HTTPS://evil.example.com'],
  ['javascript', 'javascript:alert(1)'],
  ['mixed-case javascript', 'JaVaScRiPt:alert(1)'],
  ['javascript with a newline in the scheme', 'java\nscript:alert(1)'],
  ['data', 'data:text/html,<script>alert(1)</script>'],
  ['file', 'file:///etc/passwd'],
  ['scheme-relative with tab inside', 'ht\ttps://evil.example.com'],

  // Not a path at all.
  ['bare host', 'evil.example.com'],
  ['relative traversal', '../../etc'],
  ['relative path', 'workspace/abc'],
  ['empty', ''],
  ['whitespace only', '   '],
] as const;

describe('safeNextPath refuses everything that leaves the origin', () => {
  it.each(HOSTILE)('rejects %s', (_name, raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it('never returns a value that resolves off-origin', () => {
    // The property that actually matters, asserted with a real URL parser
    // rather than by reading the implementation.
    for (const [name, raw] of HOSTILE) {
      const result = safeNextPath(raw);
      expect(resolves(result), `${name}: ${JSON.stringify(raw)}`).toBe(ORIGIN);
    }
  });

  it('rejects a non-string, however it arrives', () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(123 as unknown as string)).toBeNull();
    expect(safeNextPath({} as unknown as string)).toBeNull();
  });

  it('rejects a backslash however deep in the path it is buried', () => {
    expect(safeNextPath('/clients/abc\\..\\..\\evil.example.com')).toBeNull();
    expect(safeNextPath('/clients/abc/\\/evil.example.com')).toBeNull();
  });

  it('trims a trailing control character rather than refusing outright', () => {
    // Deliberate, and safe: `trim()` runs first, so a tab at either END is
    // simply gone and what is left is checked in full. Only an interior one can
    // change how the parser reads the value, and that is the case above. The
    // returned string is what matters, and it has no tab in it.
    expect(safeNextPath('/clients/abc\t')).toBe('/clients/abc');
    expect(safeNextPath('\t//evil.example.com')).toBeNull();
    expect(safeNextPath('\n/onboarding')).toBe('/onboarding');
  });
});

describe('safeNextPath is idempotent, because the chain depends on it', () => {
  // The sign-in page validates `?next=` and renders it into a hidden field; the
  // sign-in action then validates it again. If one pass could turn a safe value
  // into an unsafe one, the second pass would be load-bearing in one direction
  // and useless in the other. It must be neither.
  const EVERYTHING = [...HOSTILE.map(([, raw]) => raw), '/', '/onboarding', '/a/../b', '/x?y#z'];

  it('returns the same answer however many times it is applied', () => {
    for (const raw of EVERYTHING) {
      const once = safeNextPath(raw);
      const twice = once === null ? null : safeNextPath(once);
      expect(twice, `${JSON.stringify(raw)} -> ${JSON.stringify(once)}`).toBe(once);
    }
  });

  it('normalises dot segments that are harmless, and refuses ones that are not', () => {
    expect(safeNextPath('/clients/../onboarding')).toBe('/onboarding');
    expect(safeNextPath('/./onboarding')).toBe('/onboarding');
    expect(safeNextPath('/../onboarding')).toBe('/onboarding');
    expect(safeNextPath('/..//evil.example.com')).toBeNull();
  });
});

describe('safeNextPath keeps every path RepOS actually produces', () => {
  const LEGITIMATE = [
    '/',
    '/onboarding',
    '/reset-password',
    '/clients',
    '/clients/cmto8ncb90000p2occ3j9t8lb',
    '/clients/cmto8ncb90000p2occ3j9t8lb/feedback',
    '/workspace/cmto8ncb90000p2occ3j9t8lb',
    '/workspace/cmto8ncb90000p2occ3j9t8lb/team',
    '/invite/aBcD_-1234567890',
    '/clients?view=archived',
  ];

  it.each(LEGITIMATE)('accepts %s unchanged', (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it('preserves a query string and a fragment', () => {
    expect(safeNextPath('/clients/abc?tab=1#owner-update')).toBe('/clients/abc?tab=1#owner-update');
  });

  it('keeps legitimate percent-encoding in a segment', () => {
    expect(safeNextPath('/clients/a%20b')).toBe('/clients/a%20b');
  });

  it('trims surrounding whitespace rather than refusing', () => {
    expect(safeNextPath('  /onboarding  ')).toBe('/onboarding');
  });
});

describe('the auth callback still exposes the same guard', () => {
  // The route re-exports it; this is what the existing callback test imports,
  // and what the route feeds to `new URL(next, origin)`.
  it('delegates to the shared rule', () => {
    expect(safeNext('/onboarding')).toBe('/onboarding');
    expect(safeNext('/\\evil.example.com')).toBeNull();
    expect(safeNext('//evil.example.com')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });

  it('cannot be talked off-origin by anything in the hostile set', () => {
    for (const [name, raw] of HOSTILE) {
      const next = safeNext(raw);
      // Exactly what route.ts does with the result.
      expect(new URL(next ?? '/login', ORIGIN).origin, `${name}: ${JSON.stringify(raw)}`).toBe(
        ORIGIN,
      );
    }
  });
});
