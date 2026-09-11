import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/strings';
import { flattenFor } from '@/lib/i18n/t';

/**
 * THE WORKSPACE CARRIES ONLY THE WORDS A BROWSER CAN READ (perf pass).
 *
 * `(workspace)/layout.tsx` hands its client components their words through
 * `LocaleProvider`. Until this pass it handed them ALL of them: 1,736 phrases,
 * 137 KB of English or 250 KB of Hindi or Marathi, in every first load and —
 * because choosing a language revalidates the root layout — in every language
 * switch. Measured on a production build: switching to Hindi moved 259 KB to
 * the browser; the same switch now moves 26 KB.
 *
 * Almost none of it could be read where it landed. The generated sentences,
 * every vertical's taxonomy and the page headings are written on the server;
 * the client components reach a handful of namespaces. So the layout now
 * declares them, the way the sign-in page has since M32.
 *
 * The regression this guards is not size. It is the other direction: a client
 * component starts using a key outside the list, `t()` falls through to the
 * key itself, and an owner reads "kit.order.cta" on a button. The list in the
 * layout has to keep covering what the client components actually ask for,
 * and this file reads both to say whether it does.
 */

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');

const LAYOUT = readFileSync(join(SRC, 'app', '(workspace)', 'layout.tsx'), 'utf8');

/** The prefixes the layout declares, read from the layout itself. */
function declaredPrefixes(): string[] {
  const m = /const WORKSPACE_NAMESPACES = \[([^\]]*)\]/.exec(LAYOUT);
  expect(m, 'WORKSPACE_NAMESPACES is no longer declared in the workspace layout').toBeTruthy();
  return [...(m![1] as string).matchAll(/'([^']+)'/g)].map((x) => x[1] as string);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * A module's imports of project files, resolved to paths on disk.
 *
 * `@/x` and relative specifiers only; packages are not followed. A specifier
 * is tried as `.tsx`, `.ts`, and as a directory index, which is every shape
 * this repository uses.
 */
function localImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of source.matchAll(/from\s+'(@\/[^']+|\.{1,2}\/[^']+)'/g)) {
    const spec = m[1] as string;
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : resolve(file, '..', spec);
    for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        out.push(candidate);
        break;
      }
    }
  }
  return out;
}

/**
 * Every client component that reads the provider AND can be rendered under
 * the workspace layout.
 *
 * Found by following imports from `src/app/(workspace)`, not by listing: a
 * new form the workspace renders is covered the day it is written, and a form
 * only the operator console renders — which has no provider and reads English
 * by design — is not asked for in the workspace's payload.
 */
function translatedClientComponents(): string[] {
  const seen = new Set<string>();
  const queue = walk(join(SRC, 'app', '(workspace)'));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const dep of localImports(file)) if (!seen.has(dep)) queue.push(dep);
  }
  return [...seen].filter((file) => {
    const source = readFileSync(file, 'utf8');
    return /^\s*'use client';/m.test(source) && /\buseT\(\)/.test(source);
  });
}

/**
 * Every dictionary key a component asks its translator for.
 *
 * Static keys are read straight off `t('…')`. `t.plural('base', n)` reads
 * `base.one` and `base.other`. The one dynamic site — the header's doors,
 * whose labels sit in a table as `label: 'nav.section.…'` — is covered by
 * also collecting every quoted `nav.` key in the file, which is what that
 * table contains.
 */
function keysUsedBy(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const keys = new Set<string>();
  for (const m of source.matchAll(/\bt\(\s*'([a-z][\w.]*)'/g)) keys.add(m[1] as string);
  for (const m of source.matchAll(/\bt\.plural\(\s*'([a-z][\w.]*)'/g)) {
    keys.add(`${m[1]}.one`);
    keys.add(`${m[1]}.other`);
  }
  for (const m of source.matchAll(/'(nav\.[\w.]+)'/g)) keys.add(m[1] as string);
  return [...keys];
}

describe('the workspace ships only the namespaces its client components read', () => {
  it('declares the namespaces, and applies them', () => {
    const prefixes = declaredPrefixes();
    expect(prefixes.length).toBeGreaterThan(3);
    expect(LAYOUT).toContain('flattenFor(MESSAGES, locale, WORKSPACE_NAMESPACES)');
  });

  it('finds the client components this file is about', () => {
    const files = translatedClientComponents().map((f) => f.replace(ROOT, '').replace(/\\/g, '/'));
    // The header, the language form and the kit order form at the very least.
    expect(files).toEqual(expect.arrayContaining([
      '/src/components/portal/workspace.tsx',
      '/src/components/forms/language-form.tsx',
      '/src/components/forms/kit-order-form.tsx',
      '/src/app/(workspace)/workspace/[clientId]/loading.tsx',
      '/src/app/(workspace)/workspace/[clientId]/error.tsx',
    ]));
  });

  it('covers every key a client component actually asks for', () => {
    // THE REGRESSION THIS FILE EXISTS FOR. A key outside the shipped
    // namespaces renders as itself on an owner's screen.
    const prefixes = declaredPrefixes();
    const uncovered: string[] = [];
    let checked = 0;
    for (const file of translatedClientComponents()) {
      for (const key of keysUsedBy(file)) {
        checked += 1;
        if (!prefixes.some((p) => key.startsWith(p))) {
          uncovered.push(`${file.split(/[\\/]/).pop()}: ${key}`);
        }
      }
    }
    expect(checked, 'found no keys at all — the scan is broken').toBeGreaterThan(60);
    expect(uncovered).toEqual([]);
  });

  it('resolves every one of those keys to a real phrase, in every language', () => {
    const prefixes = declaredPrefixes();
    for (const locale of LOCALES) {
      const shipped = flattenFor(MESSAGES, locale, prefixes);
      for (const file of translatedClientComponents()) {
        for (const key of keysUsedBy(file)) {
          expect(shipped[key], `${key} missing from the ${locale} workspace payload`).toBeTruthy();
          expect(shipped[key], `${key} rendered as its own key`).not.toBe(key);
        }
      }
    }
  });

  it('leaves the server-written namespaces out of the browser', () => {
    // The generated sentences and the packs: written by builders, read by
    // nobody in a browser. Together they were the bulk of the 137 KB.
    const shipped = flattenFor(MESSAGES, 'en', declaredPrefixes());
    const leaked = Object.keys(shipped).filter((k) =>
      /^(pack|insight|intelligence|responsibility|evidence|focus|improve|period|home|customers|feedback|improvements|checkin|pulse|review|lifecycle)\./.test(k),
    );
    expect(leaked).toEqual([]);
  });

  it('ships a small fraction of the dictionary, in every language', () => {
    for (const locale of LOCALES) {
      const full = JSON.stringify(flattenFor(MESSAGES, locale)).length;
      const scoped = JSON.stringify(flattenFor(MESSAGES, locale, declaredPrefixes())).length;
      // A guard with room to grow, not a golden number: the workspace must
      // never again carry the whole dictionary to the browser.
      expect(scoped, locale).toBeLessThan(full / 6);
    }
  });

  it('still switches language by revalidating the root layout, where the words are decided', () => {
    // The payload shrank; the mechanism did not. The language is read once in
    // the root layout, so the switch has to reach it or the shell would keep
    // the old words around a page in the new ones.
    const action = readFileSync(join(SRC, 'lib', 'actions', 'locale.ts'), 'utf8');
    expect(action).toContain("revalidatePath('/', 'layout')");
    expect(action).not.toContain('groq');
    expect(action).not.toContain('/ai/');
  });
});
