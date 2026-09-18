import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, type MessageKey } from '@/lib/i18n/strings';
import { READING_LOOKS_MS, RESTORE_STALE_MS, RETURN_STALE_MS } from '@/components/workspace/live-refresh';

/**
 * FRESH FEEDBACK ON HOME, AND BACK THAT STAYS INSIDE HEADWAY.
 *
 * Source-level, like the rest of the workspace rules: these are server
 * components and a client router with no renderer in this suite. The
 * behaviour itself is proven elsewhere — the history rules against a model of
 * the browser in `src/lib/portal/nav-intent.test.ts`, the feed against real
 * rows in `src/lib/portal/fresh.test.ts`, and the whole path from a customer's
 * submission to Home in `tests/m41.fresh-feedback-e2e.test.ts`. What is pinned
 * here is what those cannot see: that the pages are wired to them, and that
 * nothing was added that would make the browser's own Back stop working.
 */

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const says = (key: MessageKey) => MESSAGES[key].en;

describe('Back is the browser\'s, and nothing takes it away', () => {
  const app = walk(SRC).map((file) => ({ file: file.slice(ROOT.length).replace(/\\/g, '/'), source: code(readFileSync(file, 'utf8')) }));

  it('never pushes an entry of its own, and never listens to Back to overrule it', () => {
    // A fake history (pushState to "catch" Back, a popstate handler that
    // navigates somewhere else, a beforeunload prompt) is exactly the trap
    // the owner asked for none of. Next's router makes every entry.
    for (const { file, source } of app) {
      expect(source, file).not.toMatch(/history\.pushState|history\.replaceState|['"]popstate['"]|['"]beforeunload['"]|onbeforeunload/);
    }
  });

  it('moves through real history in exactly one place, and only backwards to an entry that exists', () => {
    const going = app.filter(({ source }) => /history\.go\(|history\.back\(/.test(source)).map(({ file }) => file);
    expect(going).toEqual(['/src/components/portal/history.tsx']);
    const history = code(read('src', 'components', 'portal', 'history.tsx'));
    expect(history).toContain('window.history.go(intent.delta)');
    // The delta only ever comes from `stepsBackTo` or `upIntent`, which find an
    // entry that is already there — never a guess.
    const intent = code(read('src', 'lib', 'portal', 'nav-intent.ts'));
    expect(intent).toContain("return { kind: 'TRAVERSE', delta: back }");
    expect(intent).toContain("return { kind: 'TRAVERSE', delta: -1 }");
  });

  it('lets a new tab, a new window or a download open the way the browser opens it', () => {
    const history = code(read('src', 'components', 'portal', 'history.tsx'));
    expect(history).toMatch(/event\.metaKey[\s\S]*event\.ctrlKey[\s\S]*event\.shiftKey[\s\S]*event\.altKey/);
    const bar = code(read('src', 'components', 'portal', 'mobile-nav.tsx'));
    expect(bar).toContain('if (isModifiedClick(event)) return;');
  });

  it('reads history through the Navigation API, and falls back to ordinary links without it', () => {
    const history = code(read('src', 'components', 'portal', 'history.tsx'));
    expect(history).toContain('.navigation');
    expect(history).toContain('if (!nav || typeof nav.entries !== \'function\' || !nav.currentEntry) return null;');
  });
});

describe('the bottom bar puts the right entries in history', () => {
  const bar = code(read('src', 'components', 'portal', 'mobile-nav.tsx'));

  it('decides every tap with the shared rules', () => {
    expect(bar).toContain('doorIntent({');
    expect(bar).toContain('history: readHistory()');
    expect(bar).toContain('followIntent(intent, href, router, replaces)');
  });

  it('replaces the entry when moving sideways between doors', () => {
    expect(bar).toContain("const replaces = door.slug !== '' && current !== '';");
    expect(bar).toContain('replace={replaces}');
  });
});

describe('going deeper adds an entry; going up or growing a list does not', () => {
  const reviews = code(read('src', 'components', 'workspace', 'reviews.tsx'));
  const entry = code(read('src', 'components', 'workspace', 'feedback-entry.tsx'));
  const improvements = code(read('src', 'components', 'workspace', 'improvements.tsx'));

  it('opens a topic, an entry and a change as ordinary links', () => {
    expect(reviews).toContain('<Link href={`${base}?theme=${encodeURIComponent(s.key)}`} className={className}>');
    expect(reviews).toContain('hrefFor={(id) => `${base}/${id}?topic=${encodeURIComponent(signal.themeKey)}`}');
    expect(improvements).toContain('href={`${basePath}/improvements/${row.actionId}`}');
  });

  it('goes back up with the history-aware link, wherever a page names its parent', () => {
    expect(reviews).toMatch(/<UpLink\s+href=\{base\}\s+basePath=\{basePath\}/);
    expect(entry).toMatch(/<UpLink\s+href=\{back\.href\}/);
    expect(entry).toMatch(/<UpLink\s+href=\{`\$\{reviews\}\?theme=/);
    expect(improvements).toMatch(/<UpLink\s+href=\{`\$\{basePath\}\/improvements`\}/);
  });

  it('grows a list in place: "show more" and "show all" replace, and keep the scroll', () => {
    // Up to the class list: the "show more" address is built with an arrow
    // function, so the tag's own `>` is not the first one in it.
    const growing = [...reviews.matchAll(/<Link\s+href=\{(showAllHref|`\$\{base\}\?\$\{new URLSearchParams)[\s\S]*?className=/g)].map((m) => m[0]);
    expect(growing.length).toBe(2);
    for (const link of growing) {
      expect(link).toContain('replace');
      expect(link).toContain('scroll={false}');
    }
  });

  it('marks the door you are in while you are deep inside it', () => {
    // An entry lives under Feedback's slug, a change under Improvements', and
    // every page behind More lights More.
    expect(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'reviews', '[entryId]', 'page.tsx')).toBeTruthy();
    expect(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'improvements', '[actionId]', 'page.tsx')).toBeTruthy();
  });
});

describe('the sign-in page is a doorway, not a place to come back to', () => {
  it('replaces itself with the workspace, so Back from Home leaves the way the owner came', () => {
    const account = code(read('src', 'lib', 'actions', 'account.ts'));
    expect(account).toContain('redirect(next || landingPathFor(actor), RedirectType.replace);');
  });
});

describe('Home stays fresh without pretending to be live', () => {
  const brief = code(read('src', 'components', 'workspace', 'brief.tsx'));
  const home = code(read('src', 'components', 'workspace', 'home.tsx'));
  const live = code(read('src', 'components', 'workspace', 'live-refresh.tsx'));
  const fresh = code(read('src', 'lib', 'portal', 'fresh.ts'));

  it('builds the feed from the ledger the page already read, with no query of its own', () => {
    expect(home).toContain('getFreshFeed(prisma, client.id, {');
    expect(fresh).not.toMatch(/@\/lib\/db|prisma|\$queryRaw|findMany|findFirst/);
    const service = code(read('src', 'lib', 'portal', 'service.ts'));
    const loader = service.slice(service.indexOf('export async function getFreshFeed('), service.indexOf('const ENTRY_ID'));
    expect(loader).toContain('loadFeedbackLedger(db, client.id)');
    expect(loader).not.toMatch(/db\.reviewItem/);
  });

  it('refreshes only on a restore, a return or while reading — a handful of times, then stops', () => {
    expect(RESTORE_STALE_MS).toBe(10_000);
    expect(RETURN_STALE_MS).toBe(60_000);
    expect(READING_LOOKS_MS.length).toBeLessThanOrEqual(5);
    expect(READING_LOOKS_MS.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(120_000);
    // A timer per look, never an interval; no look in a hidden tab; one
    // refresh per render, so a failed refresh cannot loop.
    expect(live).not.toContain('setInterval(');
    expect(live).toContain("if (document.visibilityState !== 'visible') return;");
    expect(live).toContain('if (refreshedFor.current === forStamp) return;');
    expect(live).not.toMatch(/\bfetch\(|WebSocket|EventSource/);
  });

  it('watches the three pages whose reading can go stale, and only them', () => {
    expect(brief).toContain('<LiveRefresh stamp={stamp} reading={fresh?.live?.kind === \'READING\'} />');
    expect(code(read('src', 'components', 'workspace', 'reviews.tsx'))).toContain('<LiveRefresh stamp={stamp} reading={inHand > 0} />');
    expect(code(read('src', 'components', 'workspace', 'improvements.tsx'))).toContain('<LiveRefresh stamp={stamp} />');
  });

  it('says what is true, in the owner\'s language, and never calls it real time', () => {
    const keys = [
      'brief.live.reading.one',
      'brief.live.reading.other',
      'brief.live.held.one',
      'brief.live.held.other',
      'brief.live.justRead.one',
      'brief.live.justRead.other',
      'brief.latest.title',
      'brief.latest.new',
      'brief.latest.held',
      'brief.latest.failed',
      'brief.latest.noWords',
      'common.ago.now',
      'common.ago.minutes.other',
      'common.ago.hours.other',
    ] as const satisfies readonly MessageKey[];
    for (const key of keys) {
      const phrase = MESSAGES[key];
      expect(phrase.en, key).not.toMatch(/real[- ]?time|\blive\b|instant|right now/i);
      expect(phrase.hi, key).toMatch(/[ऀ-ॿ]/);
      expect(phrase.mr, key).toMatch(/[ऀ-ॿ]/);
    }
    expect(says('brief.live.reading.other')).toBe('{count} new feedback entries · Headway is reading them');
    expect(says('brief.live.justRead.other')).toBe('Headway just read {count} new feedback entries');
    expect(says('brief.latest.title')).toBe('Latest from customers');
  });

  it('announces the change politely, and only moves for people who have not asked it to be still', () => {
    expect(brief).toContain('<p aria-live="polite"');
    const pulses = [...brief.matchAll(/animate-pulse/g)].length;
    const safe = [...brief.matchAll(/motion-safe:animate-pulse/g)].length;
    expect(pulses).toBe(safe);
    expect(code(read('src', 'components', 'portal', 'history.tsx'))).toContain("'(prefers-reduced-motion: reduce)'");
  });

  it('keeps every customer reachable: three on Home, then every entry on its own page', () => {
    expect(brief).toContain('href={`${basePath}/reviews/${entry.id}?from=home`}');
    expect(brief).toContain('href={`${basePath}/reviews#entries`}');
    expect(code(read('src', 'components', 'workspace', 'reviews.tsx'))).toContain('<div id="entries" className="scroll-mt-24">');
  });
});

describe('the new pages keep the workspace\'s guarantees', () => {
  const entryPage = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'reviews', '[entryId]', 'page.tsx'));
  const changePage = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'improvements', '[actionId]', 'page.tsx'));

  it('asks membership first, before anything is looked up', () => {
    for (const page of [entryPage, changePage]) {
      const gate = page.indexOf('await requireOpenWorkspace(clientId)');
      expect(gate).toBeGreaterThan(-1);
      expect(gate).toBeLessThan(page.search(/getFeedbackEntry\(|getImprovementsView\(/));
    }
  });

  it('finds one entry by its id AND its business, so another business\'s id is simply not found', () => {
    const service = code(read('src', 'lib', 'portal', 'service.ts'));
    expect(service).toContain('if (!ENTRY_ID.test(entryId)) return null;');
    const feedback = code(read('src', 'lib', 'feedback', 'service.ts'));
    expect(feedback).toContain('db.reviewItem.findFirst({ where: { id: itemId, clientId } })');
    expect(entryPage).toContain('if (!item) notFound();');
  });

  it('finds a change only inside that business\'s own action centre', () => {
    expect(changePage).toContain('if (!ACTION_ID.test(actionId)) notFound();');
    expect(changePage).toContain('[...view.open, ...view.checked, ...view.notPursued].find((a) => a.id === actionId)');
  });

  it('never echoes the way-back hints into anything but a closed shape', () => {
    expect(entryPage).toContain('const TOPIC = /^[a-z0-9_]{1,64}$/;');
    expect(entryPage).toContain("from === 'home'");
  });

  it('writes nothing', () => {
    for (const page of [entryPage, changePage]) {
      expect(page).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(|\$executeRaw/);
    }
  });
});
