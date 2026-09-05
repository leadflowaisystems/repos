import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * NO SCREEN MAY PREFETCH A PER-CLIENT ROUTE ONCE PER CLIENT (M20).
 *
 * Next.js starts rendering a `<Link>` target as soon as the link is on screen.
 * That is a good default for a cheap page and a bad one for `/clients/[id]`,
 * which is among the most expensive routes RepOS has. On a list it multiplies:
 * the client list fired five full client-detail renders for five businesses
 * before the operator clicked anything, and a real click then queued behind
 * them until the browser ran out of connections to the origin.
 *
 * That was fixed on `/clients`, and then reintroduced wholesale on the command
 * centre, where the card carries NINE such links and renders once per client.
 * Ten clients was ninety speculative renders on the first screen after sign-in.
 *
 * So the rule is asserted here rather than remembered. These tests read the
 * source, because that is where the property lives — there is no build artifact
 * or runtime signal that says "this link is speculative", and a browser test
 * could not tell a prefetch that was cheap from one that was not. Reading the
 * file is exact, fast, and fails the moment someone adds a tenth link.
 */

const SRC = resolve(__dirname, '..', 'src');

function read(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), 'utf8');
}

/**
 * The file with its comments removed.
 *
 * Necessary, not tidiness: these files explain themselves, and the explanations
 * mention `<Link>` and `prefetch` in prose. Scanning the raw text would count a
 * sentence as a link and a rationale as a fix.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

/**
 * Every JSX element opening in `source`, as a single string each.
 *
 * Deliberately not a regex over the whole file: attributes span lines, and a
 * naive pattern would pair a `<Link` with a `prefetch` belonging to the next
 * one. This walks from each `<Link` to the `>` that closes that same tag.
 */
function linkTags(source: string): string[] {
  const tags: string[] = [];
  const opener = /<Link(\s|>)/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const start = match.index;
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) {
        tags.push(source.slice(start, i + 1));
        break;
      }
    }
  }
  return tags;
}

/**
 * A route whose render costs at least one database round trip for one client.
 *
 * In this card every href is built from `base`, which the component defines as
 * `/clients/${card.clientId}` — either used whole (`href={base}`) or as the
 * prefix of a sub-route (`` href={`${base}/minutes`} ``). `nextAction.href` is
 * always a `/clients/[id]` route too.
 */
function isPerClientRoute(tag: string): boolean {
  return /href=\{base\}|\$\{base\}|\/clients\/\$\{|nextAction\.href/.test(tag);
}

describe('the command centre card', () => {
  const source = read('components', 'command-card.tsx');
  const tags = linkTags(code(source));

  it('still has the nine links this test was written for', () => {
    // If this number changes, the change is deliberate — and whoever made it
    // has to decide about prefetch for the new link rather than inherit the
    // default silently.
    expect(tags).toHaveLength(9);
  });

  it('points every one of them at a per-client route', () => {
    for (const tag of tags) {
      expect(isPerClientRoute(tag), tag.replace(/\s+/g, ' ')).toBe(true);
    }
  });

  it('marks every one of them prefetch={false}', () => {
    for (const tag of tags) {
      expect(tag.replace(/\s+/g, ' '), tag.replace(/\s+/g, ' ')).toContain('prefetch={false}');
    }
  });

  it('says why, so the next person does not undo it', () => {
    expect(source).toContain('prefetch={false}');
    expect(source.toLowerCase()).toContain('once per client');
  });
});

describe('the command centre page itself', () => {
  const source = read('app', '(app)', 'page.tsx');

  it('does not prefetch the calm band, which is also one link per client', () => {
    const perClient = linkTags(code(source)).filter((tag) => /\/clients\/\$\{/.test(tag));

    // Without this the loop below passes by having nothing to iterate — which is
    // exactly what a refactor that renames the link would produce, and exactly
    // the change this test exists to catch.
    expect(perClient.length).toBeGreaterThan(0);

    for (const tag of perClient) {
      expect(tag.replace(/\s+/g, ' '), tag.replace(/\s+/g, ' ')).toContain('prefetch={false}');
    }
  });
});

describe('the client tab bar', () => {
  const source = read('components', 'client-tabs.tsx');
  const tags = linkTags(code(source));

  // Rendered by the client layout, so it is on screen for the whole time an
  // operator is inside a business — and every destination is a per-client
  // dynamic route. Left on default prefetch it asks the server to render every
  // OTHER tab as soon as one is opened, which is why switching tabs measured
  // slower in production than opening the client in the first place.
  it('still has the eight tabs this test was written for', () => {
    expect(tags).toHaveLength(1);
    expect(source).toContain("label: 'Overview'");
    expect(source).toContain("label: 'Profile'");
    expect((source.match(/label: '/g) ?? []).length).toBe(8);
  });

  it('does not prefetch them', () => {
    for (const tag of tags) {
      expect(tag.replace(/\s+/g, ' '), tag.replace(/\s+/g, ' ')).toContain('prefetch={false}');
    }
  });

  it('says why, so the next person does not undo it', () => {
    expect(source.toLowerCase()).toContain('prefetch');
    expect(source).toMatch(/per-client dynamic route/i);
  });
});

describe('the client list, where this was first measured', () => {
  const source = read('app', '(app)', 'clients', 'page.tsx');

  it('has not lost its own fix', () => {
    const perClient = linkTags(code(source)).filter((tag) => /\/clients\/\$\{client\.id\}/.test(tag));
    expect(perClient.length).toBeGreaterThan(0);
    for (const tag of perClient) {
      expect(tag.replace(/\s+/g, ' '), tag.replace(/\s+/g, ' ')).toContain('prefetch={false}');
    }
  });
});
