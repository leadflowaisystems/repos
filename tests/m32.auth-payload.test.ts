import { readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/strings';
import { flattenFor } from '@/lib/i18n/t';

/**
 * THE SIGN-IN PAGE MUST BE SMALL (M32).
 *
 * `(auth)/layout.tsx` hands its client components their words, the same way the
 * workspace shell does. It was handing them ALL of them: 1663 phrases, ~130KB,
 * including every vertical's taxonomy and every sentence the server-side
 * builders write — none of which a browser can read.
 *
 * That landed on the one page that has to arrive before anybody can do
 * anything: the sign-in form, seen by a person who is not signed in, very often
 * on a phone, and often on a connection that is doing badly. Measured in
 * production, /login was 149KB.
 *
 * These tests keep it scoped. The failure they are really guarding against is
 * not size, though — it is the OTHER direction: somebody adds a t('home.…') to
 * a sign-in form, the key is not in the payload, and the form renders the raw
 * key at an owner. The list in the layout has to keep covering what the forms
 * actually ask for.
 */

const ROOT = resolvePath(__dirname, '..');

const LAYOUT = readFileSync(joinPath(ROOT, 'src', 'app', '(auth)', 'layout.tsx'), 'utf8');

/** The two translated client components `(auth)` can render. */
const AUTH_CLIENT_COMPONENTS = [
  joinPath(ROOT, 'src', 'components', 'forms', 'account-forms.tsx'),
  joinPath(ROOT, 'src', 'components', 'forms', 'team-forms.tsx'),
];

/** The prefixes the layout declares, read from the layout itself. */
function declaredPrefixes(): string[] {
  const m = /const AUTH_NAMESPACES = \[([^\]]*)\]/.exec(LAYOUT);
  expect(m, 'AUTH_NAMESPACES is no longer declared in the auth layout').toBeTruthy();
  return [...(m![1] as string).matchAll(/'([^']+)'/g)].map((x) => x[1] as string);
}

/** Every dictionary key a component asks its translator for. */
function keysUsedBy(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/\bt\(\s*'([a-z][\w.]*)'/g)].map((m) => m[1] as string);
}

describe('the sign-in page carries only the words it can use', () => {
  it('declares the namespaces it ships, and uses them', () => {
    const prefixes = declaredPrefixes();
    expect(prefixes.length).toBeGreaterThan(0);
    // The filter is actually applied — not declared and then ignored.
    expect(LAYOUT).toContain('flattenFor(MESSAGES, locale, AUTH_NAMESPACES)');
  });

  it('covers every key the auth forms actually ask for', () => {
    // THE REAL REGRESSION THIS FILE EXISTS FOR. If a form starts using a key
    // outside the shipped namespaces, `t()` falls through to returning the key
    // itself and an owner reads "common.form.signIn" on the sign-in button.
    const prefixes = declaredPrefixes();
    const uncovered: string[] = [];
    let checked = 0;
    for (const file of AUTH_CLIENT_COMPONENTS) {
      for (const key of keysUsedBy(file)) {
        checked += 1;
        if (!prefixes.some((p) => key.startsWith(p))) {
          uncovered.push(`${file.split(/[\\/]/).pop()}: ${key}`);
        }
      }
    }
    expect(checked, 'found no keys at all — the scan is broken').toBeGreaterThan(20);
    expect(uncovered).toEqual([]);
  });

  it('actually resolves every one of those keys to a real phrase', () => {
    const prefixes = declaredPrefixes();
    for (const locale of LOCALES) {
      const shipped = flattenFor(MESSAGES, locale, prefixes);
      for (const file of AUTH_CLIENT_COMPONENTS) {
        for (const key of keysUsedBy(file)) {
          expect(shipped[key], `${key} missing from the ${locale} auth payload`).toBeTruthy();
          expect(shipped[key], `${key} rendered as its own key`).not.toBe(key);
        }
      }
    }
  });

  it('leaves the server-only namespaces out of the browser', () => {
    // These are written by builder functions and read by nobody in a browser.
    // Together they were the bulk of the 130KB.
    const shipped = flattenFor(MESSAGES, 'en', declaredPrefixes());
    const leaked = Object.keys(shipped).filter((k) =>
      /^(pack|insight|intelligence|responsibility|evidence|focus|improve|period)\./.test(k),
    );
    expect(leaked).toEqual([]);
  });

  it('ships a small fraction of the dictionary', () => {
    const full = flattenFor(MESSAGES, 'en');
    const scoped = flattenFor(MESSAGES, 'en', declaredPrefixes());
    const fullBytes = JSON.stringify(full).length;
    const scopedBytes = JSON.stringify(scoped).length;
    expect(Object.keys(full).length).toBeGreaterThan(1000);
    // A guard with room to grow, not a golden number: the point is that the
    // sign-in page must never again carry the whole dictionary.
    expect(scopedBytes).toBeLessThan(fullBytes / 4);
    expect(scopedBytes).toBeLessThan(30_000);
  });

  it('and the workspace applies the same discipline to its own tree', () => {
    // The scoping started here and reached the workspace in the performance
    // pass: its client components read a handful of namespaces too, and the
    // whole dictionary was 137-250 KB on every first load and every language
    // switch. `tests/perf.workspace-payload.test.ts` keeps that list honest.
    const workspace = readFileSync(
      joinPath(ROOT, 'src', 'app', '(workspace)', 'layout.tsx'),
      'utf8',
    );
    expect(workspace).toContain('flattenFor(MESSAGES, locale, WORKSPACE_NAMESPACES)');
    expect(workspace).not.toMatch(/flattenFor\(MESSAGES, locale\)/);
  });

  it('keeps the sign-in page reachable without a session', () => {
    // Nothing here may turn into an auth change. The layout reads a cookie for
    // the language and does no session work at all.
    expect(LAYOUT).not.toContain('currentActor');
    expect(LAYOUT).not.toContain('redirect(');
    expect(LAYOUT).not.toContain('supabase');
  });
});
