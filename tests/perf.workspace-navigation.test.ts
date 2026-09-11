import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * MOVING BETWEEN WORKSPACE PAGES COSTS ONE REQUEST, AND ANSWERS AT ONCE (perf pass).
 *
 * Three things were measured on a production build of the workspace and are
 * pinned here as source properties, because none of them has a runtime signal
 * a unit test could read:
 *
 *   1. PREFETCH. Every link in the workspace points at a per-business dynamic
 *      route. With Next's default, opening one page fired eight prefetch
 *      requests — one per tab — each through the middleware's session check,
 *      for ~230 bytes of nothing; with a loading boundary in the tree it would
 *      have been every per-business link on the page. So the tree imports one
 *      `Link` (`components/portal/link.tsx`) that never prefetches, and
 *      nothing in it may reach for `next/link` directly. Twenty-four rapid
 *      taps measured as exactly twenty-four requests afterwards.
 *
 *   2. THE LOADING BOUNDARY. Navigating between Home and Feedback re-renders
 *      only the page under the header, and the only loading state was one
 *      level up, wrapping the header itself — so it never showed on a tab
 *      change, and a tap on a slow connection changed nothing on screen until
 *      the server had finished. `workspace/[clientId]/loading.tsx` is the
 *      boundary for that slot.
 *
 *   3. THE PRESSED TAB. `useLinkStatus` marks the tab whose page is in flight
 *      the moment it is pressed, before any request has answered.
 *
 * And one thing that makes rapid navigation safe by construction: no client
 * component in the workspace fetches data for itself. Every byte arrives
 * through the router, which discards a response its navigation has already
 * been superseded by — so there is no state a late answer could overwrite.
 */

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const WORKSPACE_TREE = [
  join(SRC, 'app', '(workspace)'),
  join(SRC, 'components', 'portal'),
  join(SRC, 'components', 'workspace'),
];

/** The forms the workspace pages render, which also carry links. */
const WORKSPACE_FORMS = [
  join(SRC, 'components', 'forms', 'kit-order-form.tsx'),
  join(SRC, 'components', 'forms', 'kit-receipt-form.tsx'),
  join(SRC, 'components', 'forms', 'language-form.tsx'),
  join(SRC, 'components', 'forms', 'extend-access-form.tsx'),
  join(SRC, 'components', 'forms', 'continue-form.tsx'),
  join(SRC, 'components', 'forms', 'team-forms.tsx'),
];

const LINK_WRAPPER = join(SRC, 'components', 'portal', 'link.tsx');

function rel(file: string): string {
  return file.replace(ROOT, '').replace(/\\/g, '/');
}

describe('links in the workspace do not prefetch', () => {
  it('has one wrapper, and it sets prefetch={false} before anything else', () => {
    const source = readFileSync(LINK_WRAPPER, 'utf8');
    expect(source).toContain("import NextLink from 'next/link'");
    expect(source).toMatch(/<NextLink prefetch=\{false\} \{\.\.\.props\} \/>/);
  });

  it('is what every file in the workspace tree imports', () => {
    const files = [...WORKSPACE_TREE.flatMap((d) => walk(d)), ...WORKSPACE_FORMS];
    const direct = files
      .filter((f) => f !== LINK_WRAPPER)
      .filter((f) => /from 'next\/link'/.test(readFileSync(f, 'utf8')))
      // The header reads `useLinkStatus` from next/link; it must not read `Link`.
      .filter((f) => /import\s+(Link|NextLink|\w+)\s+from 'next\/link'/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(direct).toEqual([]);

    const wrapped = files.filter((f) => /@\/components\/portal\/link'/.test(readFileSync(f, 'utf8')));
    // Without this the assertion above passes by having nothing to check.
    expect(wrapped.length).toBeGreaterThan(10);
  });

  it('never opts a link back in', () => {
    const files = [...WORKSPACE_TREE.flatMap((d) => walk(d)), ...WORKSPACE_FORMS];
    const optedIn = files
      .filter((f) => /prefetch=\{true\}|prefetch\s*$|prefetch=\{null\}/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(optedIn).toEqual([]);
  });
});

describe('a tab answers at once', () => {
  const loading = join(SRC, 'app', '(workspace)', 'workspace', '[clientId]', 'loading.tsx');

  it('has a loading boundary for the page slot under the header', () => {
    expect(existsSync(loading)).toBe(true);
    const source = readFileSync(loading, 'utf8');
    expect(source).toContain('aria-busy="true"');
    // Read aloud, in the owner's language, like the outer one.
    expect(source).toContain("t('errors.loading.label')");
  });

  it('marks the pressed tab while its page is in flight', () => {
    const header = readFileSync(join(SRC, 'components', 'portal', 'workspace.tsx'), 'utf8');
    expect(header).toContain("import { useLinkStatus } from 'next/link'");
    expect(header).toMatch(/const \{ pending \} = useLinkStatus\(\)/);
    expect(header).toContain('data-pending');
  });
});

describe('nothing in the workspace fetches for itself', () => {
  it('has no client-side data fetching, so a late answer has nothing to overwrite', () => {
    const files = [...WORKSPACE_TREE.flatMap((d) => walk(d)), ...WORKSPACE_FORMS];
    const clientFiles = files.filter((f) => /^\s*'use client';/m.test(readFileSync(f, 'utf8')));
    expect(clientFiles.length).toBeGreaterThan(5);
    const fetching = clientFiles
      .filter((f) => {
        const source = readFileSync(f, 'utf8');
        return /\bfetch\(|useSWR|useQuery|router\.refresh\(|setInterval\(|new EventSource|WebSocket\(/.test(source);
      })
      .map(rel);
    expect(fetching).toEqual([]);
  });
});
