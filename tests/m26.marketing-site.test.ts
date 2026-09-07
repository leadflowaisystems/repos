import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { CORNER_CAFE, storyFeedbackCount } from '../scripts/demo/corner-cafe';
import { GET_STARTED, NAV_LINKS, SEE_HOW, SIGN_IN, TALK_TO_US } from '@/components/marketing/links';
import {
  DEMO_BUSINESS,
  FOOD_PRAISE_QUOTES,
  IMPROVEMENT,
  MEASUREMENT,
  PILE,
  SIGNALS,
  SLOW_SERVICE,
  SLOW_SERVICE_QUOTES,
  TAPPED,
} from '@/lib/marketing/demo';
import { CONTACT_EMAIL_VAR, CONTACT_PHONE_VAR, DEFAULT_CONTACT, siteContact, siteUrl } from '@/lib/marketing/site';
import { findPack } from '@/lib/packs';

/**
 * THE PUBLIC WEBSITE (M26).
 *
 * Three claims, each of which somebody could otherwise undo without noticing.
 *
 * THE FRONT DOOR IS ONE ADDRESS, AND THE PRODUCT BEHIND IT DID NOT MOVE. A
 * signed-out visitor who opens `/` gets the marketing page at `/`; the
 * marketing page's own path is never an address; every protected path still
 * bounces to sign-in; every public path still passes. Proven by running the
 * middleware, not by reading it.
 *
 * EVERY FIGURE ON THE PAGE IS THE DEMO'S. The site quotes Corner Cafe, and
 * Corner Cafe is a dataset in this repository. So every quotation must be a
 * verbatim record, every date one the dataset carries, and every sum that can
 * be recomputed from the raw records must recompute.
 *
 * THE PAGE OFFERS EXACTLY THE DESTINATIONS IT SAYS. One primary label, one
 * secondary, a way to sign in, four places on the page — and nothing
 * external, nothing that opens a messaging app, nothing that pretends to be
 * proof.
 */

const ROOT = resolve(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

const CODE_EXT = new Set(['.ts', '.tsx']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (CODE_EXT.has(extname(entry)) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const SITE_DIRS = [
  join(ROOT, 'src', 'components', 'marketing'),
  join(ROOT, 'src', 'lib', 'marketing'),
  join(ROOT, 'src', 'app', '(marketing)'),
];

const SITE_FILES = SITE_DIRS.flatMap(walk).map((file) => ({
  file: file.slice(ROOT.length + 1).replace(/\\/g, '/'),
  raw: readFileSync(file, 'utf8'),
  code: stripComments(readFileSync(file, 'utf8')),
}));

// ---------------------------------------------------------------------------
// The front door, by running the middleware
// ---------------------------------------------------------------------------

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

async function visit(path: string, env: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  const { middleware } = await import('@/middleware');
  return middleware(new NextRequest(`https://headway.test${path}`));
}

describe('the front door', () => {
  it('shows a signed-out visitor the public site at /, without changing the address', async () => {
    const res = await visit('/');
    expect(res.status).toBe(200);
    const rewrite = res.headers.get('x-middleware-rewrite') ?? '';
    expect(new URL(rewrite).pathname).toBe('/welcome');
    expect(res.headers.get('location')).toBeNull();
  });

  it('keeps the query a visitor arrived with', async () => {
    const res = await visit('/?ref=card');
    expect(new URL(res.headers.get('x-middleware-rewrite') ?? '').search).toBe('?ref=card');
  });

  it('does the same when sign-in is configured but no session cookie is presented', async () => {
    // No cookie means no network call: the auth client reports a missing
    // session locally. This is the path every first-time visitor takes.
    const res = await visit('/', {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key-for-the-test',
    });
    expect(res.status).toBe(200);
    expect(new URL(res.headers.get('x-middleware-rewrite') ?? '').pathname).toBe('/welcome');
  });

  it("never lets the page's own path be an address", async () => {
    for (const path of ['/welcome', '/welcome/', '/welcome/anything']) {
      const res = await visit(path);
      expect(res.status, path).toBe(308);
      expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/');
    }
  });

  it('still sends every protected path to sign-in, naming where they were going', async () => {
    for (const path of ['/clients', '/clients/abc', '/minutes', '/settings', '/workspace/abc', '/print/kit/abc']) {
      const res = await visit(path);
      expect(res.status, path).toBe(307);
      const location = new URL(res.headers.get('location') ?? '');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('next')).toBe(path);
    }
  });

  it('still lets every public path through untouched', async () => {
    for (const path of ['/login', '/signup', '/forgot-password', '/feedback/tok', '/auth/callback', '/invite/x', '/portal/x']) {
      const res = await visit(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('x-middleware-next'), path).toBe('1');
      expect(res.headers.get('x-middleware-rewrite'), path).toBeNull();
    }
  });

  it('exempts the files a crawler or a link preview fetches with no session', () => {
    const source = read('src', 'middleware.ts');
    for (const file of ['og.png', 'robots.txt', 'sitemap.xml', 'icon.svg', 'apple-icon.svg', 'favicon.ico']) {
      expect(source, file).toContain(file);
    }
  });
});

// ---------------------------------------------------------------------------
// The demo's figures are the demo's
// ---------------------------------------------------------------------------

/** Every record in the story with words, so a quotation can be matched exactly. */
function everyText(): Array<{ text: string; stars: number | null }> {
  const s = CORNER_CAFE;
  return [
    ...s.earlyReviews,
    ...s.firstCheckin.reviews,
    ...s.midReviews,
    ...s.lateReviews,
    ...s.secondCheckin.reviews,
    ...s.qr,
  ].map((r) => ({ text: r.text, stars: r.stars }));
}

describe('every figure on the page is the demo business', () => {
  const records = everyText();

  it('counts the dataset, not a rounder number', () => {
    expect(DEMO_BUSINESS.total).toBe(storyFeedbackCount(CORNER_CAFE));
    expect(DEMO_BUSINESS.total).toBe(87);
  });

  it('quotes customers verbatim, with the rating they actually gave', () => {
    const quoted = [
      ...SLOW_SERVICE_QUOTES,
      ...FOOD_PRAISE_QUOTES,
      ...PILE.flatMap((p) => (p.kind === 'words' ? [{ text: p.text, stars: p.stars }] : [])),
    ];
    expect(quoted.length).toBeGreaterThan(10);
    for (const q of quoted) {
      const record = records.find((r) => r.text === q.text);
      expect(record, q.text).toBeDefined();
      expect(record?.stars, q.text).toBe(q.stars);
    }
  });

  it('shows the taps-only piece exactly as the customer left it', () => {
    const taps = PILE.find((p) => p.kind === 'taps');
    expect(taps).toBeDefined();
    if (!taps || taps.kind !== 'taps') return;
    const pack = findPack('restaurant');
    expect(pack).toBeDefined();
    const dims = pack?.gateway?.dimensions ?? [];
    const labelToKey = new Map(dims.map((d) => [d.label, d.key]));
    const wanted: Record<string, number> = {};
    for (const part of taps.parts) wanted[labelToKey.get(part.label) ?? part.label] = part.value;
    const signalKeys = taps.specifics.map(
      (label) => dims.flatMap((d) => d.signals).find((s) => s.label === label)?.key ?? label,
    );
    const match = CORNER_CAFE.qr.find(
      (r) =>
        r.stars === taps.stars &&
        r.text === '' &&
        JSON.stringify(r.dimensions) === JSON.stringify(wanted) &&
        JSON.stringify(r.signals) === JSON.stringify(signalKeys),
    );
    expect(match).toBeDefined();
  });

  it('tells the improvement story in the dataset’s own words and dates', () => {
    expect(IMPROVEMENT.decision).toBe(CORNER_CAFE.action.description);
    expect(IMPROVEMENT.learning).toBe(CORNER_CAFE.action.learning);
    expect(IMPROVEMENT.suggestedAt.getTime()).toBe(new Date(CORNER_CAFE.action.suggestedAt).getTime());
    expect(IMPROVEMENT.decidedAt.getTime()).toBe(new Date(CORNER_CAFE.action.decidedAt).getTime());
    expect(IMPROVEMENT.doneAt.getTime()).toBe(new Date(CORNER_CAFE.action.doneAt).getTime());
    expect(IMPROVEMENT.measuredAt.getTime()).toBe(new Date(CORNER_CAFE.action.measuredAt).getTime());
    expect(MEASUREMENT.changeDate.getTime()).toBe(IMPROVEMENT.doneAt.getTime());
    expect(IMPROVEMENT.suggested).toBe(
      findPack('restaurant')?.issueTaxonomy.find((t) => t.key === 'service_speed')?.action,
    );
  });

  it('adds up what customers tapped from the raw submissions', () => {
    const rated = CORNER_CAFE.qr.filter((r) => typeof r.dimensions.waiting === 'number');
    const values = rated.map((r) => r.dimensions.waiting as number);
    expect(TAPPED.rated).toBe(rated.length);
    expect(TAPPED.average).toBe((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
    expect(TAPPED.low).toBe(values.filter((v) => v <= 3).length);

    const pack = findPack('restaurant');
    const waiting = pack?.gateway?.dimensions.find((d) => d.key === 'waiting');
    expect(waiting).toBeDefined();
    for (const specific of TAPPED.specifics) {
      const key = waiting?.signals.find((s) => s.label === specific.label)?.key;
      expect(key, specific.label).toBeDefined();
      const count = CORNER_CAFE.qr.filter((r) => r.signals.includes(key ?? '')).length;
      expect(count, specific.label).toBe(specific.count);
    }
  });

  it('states shares that recompute from their own counts', () => {
    const share = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;
    expect(MEASUREMENT.before.total + MEASUREMENT.after.total).toBe(DEMO_BUSINESS.total);
    expect(MEASUREMENT.before.share).toBe(share(MEASUREMENT.before.count, MEASUREMENT.before.total));
    expect(MEASUREMENT.after.share).toBe(share(MEASUREMENT.after.count, MEASUREMENT.after.total));
    expect(SLOW_SERVICE.share).toBe(share(SLOW_SERVICE.count, DEMO_BUSINESS.total));
    expect(SIGNALS.loved.share).toBe(share(SIGNALS.loved.count, DEMO_BUSINESS.total));
    expect(SIGNALS.changing.share).toBe(share(SIGNALS.changing.count, DEMO_BUSINESS.total));
    expect(SIGNALS.unhappy.count).toBe(SLOW_SERVICE.count);
  });

  it('dates every quotation inside the story', () => {
    const first = new Date(CORNER_CAFE.earlyReviews[0]!.at).getTime();
    const last = Math.max(...CORNER_CAFE.qr.map((r) => new Date(r.at).getTime()));
    for (const q of [...SLOW_SERVICE_QUOTES, ...FOOD_PRAISE_QUOTES]) {
      expect(q.at.getTime(), q.text).toBeGreaterThanOrEqual(first);
      expect(q.at.getTime(), q.text).toBeLessThanOrEqual(last);
    }
  });
});

// ---------------------------------------------------------------------------
// What the page offers
// ---------------------------------------------------------------------------

describe('the page offers exactly the destinations it says', () => {
  const ids = new Set<string>();
  const hrefs: Array<{ file: string; href: string }> = [];
  for (const { file, code } of SITE_FILES) {
    for (const m of code.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]!);
    for (const m of code.matchAll(/href="([^"]+)"/g)) hrefs.push({ file, href: m[1]! });
  }
  const constants = [GET_STARTED, SIGN_IN, TALK_TO_US, SEE_HOW, ...NAV_LINKS];

  it('has site files to check', () => {
    expect(SITE_FILES.length).toBeGreaterThan(15);
  });

  it('points every anchor at a place that exists on the page', () => {
    const anchors = [...constants.map((c) => c.href), ...hrefs.map((h) => h.href)].filter((h) => h.startsWith('#'));
    expect(anchors.length).toBeGreaterThan(4);
    for (const anchor of anchors) expect(ids.has(anchor.slice(1)), anchor).toBe(true);
  });

  it('links only into the product, never out of it', () => {
    const routes = [...constants.map((c) => c.href), ...hrefs.map((h) => h.href)].filter((h) => !h.startsWith('#'));
    for (const route of routes) expect(['/signup', '/login']).toContain(route);
    for (const { file, code } of SITE_FILES) {
      expect(code, file).not.toMatch(/href=\{?["'`]?(?:https?:|mailto:|tel:|whatsapp|sms:)/i);
    }
  });

  it('uses one label for the primary action and one for the secondary', () => {
    expect(GET_STARTED).toEqual({ label: 'Get started', href: '/signup' });
    expect(TALK_TO_US).toEqual({ label: 'Talk to us', href: '#contact' });
    const all = SITE_FILES.map((f) => f.code).join('\n');
    for (const rival of ['Get access', 'Request a demo', 'Book a demo', 'Start free trial', 'Sign up now', 'Try it free']) {
      expect(all, rival).not.toContain(rival);
    }
  });

  it('has exactly one h1', () => {
    const count = SITE_FILES.reduce((n, f) => n + (f.code.match(/<h1\b/g) ?? []).length, 0);
    expect(count).toBe(1);
  });

  it('says Headway, never the internal name, and invents no proof', () => {
    const BRAND = /(?<![A-Za-z0-9_$])RepOS(?![A-Za-z0-9_$])/;
    const PROOF =
      /trusted by|customers? (?:love|trust) us|\d[\d,]*\+ (?:businesses|customers|users)|testimonial|rated \d(?:\.\d)? stars|as seen (?:in|on)|case stud/i;
    const DARK =
      /\bstreaks?\b|\bbadges?\b|\bleaderboard|\btrophy|\bconfetti|\bgamif|hurry|last chance|expires (in|soon)|running out|act now|only \d+ (hours?|days?) left|limited (?:time|spots)/i;
    for (const { file, code } of SITE_FILES) {
      expect(code, file).not.toMatch(BRAND);
      expect(code, file).not.toMatch(PROOF);
      expect(code, file).not.toMatch(DARK);
      expect(code, file).not.toContain('NEXT_PUBLIC_');
    }
  });

  it('names the demo business as a demonstration wherever its figures lead', () => {
    const hero = read('src', 'components', 'marketing', 'right-now.tsx');
    expect(hero).toMatch(/demonstration business/);
  });

  it('never puts white text on a gold or green fill that cannot hold it', () => {
    for (const { file, code } of SITE_FILES) {
      for (const m of code.matchAll(/["'`]([^"'`]*bg-(?:good|warn|brand)-(?:500|600)[^"'`]*)["'`]/g)) {
        expect(m[1], file).not.toMatch(/text-white/);
      }
    }
  });

  it('reads the vertical packs rather than listing verticals by hand', () => {
    const businesses = read('src', 'components', 'marketing', 'businesses.tsx');
    expect(businesses).toContain('listPacks()');
    for (const hardcoded of ['Salon', 'Gym', 'Clinic', 'Restaurant']) {
      expect(stripComments(businesses), hardcoded).not.toMatch(new RegExp(`['"]${hardcoded}`));
    }
  });
});

// ---------------------------------------------------------------------------
// Metadata, crawlers, the preview image
// ---------------------------------------------------------------------------

describe('what search engines and link previews get', () => {
  it('asks to be indexed on the public root and nowhere else', () => {
    expect(read('src', 'app', '(marketing)', 'layout.tsx')).toContain('index: true');
    for (const group of ['(app)', '(auth)', '(workspace)', '(feedback)', '(print)']) {
      expect(read('src', 'app', group, 'layout.tsx'), group).toContain('index: false');
    }
  });

  it('carries a title, a description, a canonical and a social preview', () => {
    const layout = read('src', 'app', '(marketing)', 'layout.tsx');
    expect(layout).toContain("canonical: '/'");
    expect(layout).toContain('openGraph');
    expect(layout).toContain("card: 'summary_large_image'");
    expect(read('src', 'lib', 'marketing', 'site.ts')).toContain(
      'Headway — Turn customer feedback into better decisions',
    );
  });

  it('ships the preview image the metadata names', () => {
    const png = readFileSync(join(ROOT, 'public', 'og.png'));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    // Width and height live in the IHDR chunk, big-endian, right after the signature.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeGreaterThan(10_000);
    expect(png.length).toBeLessThan(600_000);
  });

  it('keeps every private surface out of robots.txt and lists only the front door', () => {
    const robots = read('src', 'app', 'robots.ts');
    for (const path of ['/workspace/', '/feedback/', '/clients', '/print/', '/welcome']) {
      expect(robots, path).toContain(`'${path}'`);
    }
    expect(robots).toContain("allow: '/'");
    expect(read('src', 'app', 'sitemap.ts')).not.toMatch(/workspace|feedback|clients/);
  });
});

// ---------------------------------------------------------------------------
// The deployment's own details
// ---------------------------------------------------------------------------

/** An environment for one call: only the variables named, nothing inherited. */
const env = (vars: Record<string, string>): NodeJS.ProcessEnv => ({ NODE_ENV: 'test', ...vars }) as unknown as NodeJS.ProcessEnv;

describe('what the deployment configures', () => {
  it('always has a way to be reached, and lets a deployment override it only with something usable', () => {
    expect(siteContact(env({}))).toEqual({
      email: DEFAULT_CONTACT.email,
      phone: DEFAULT_CONTACT.phone,
      whatsapp: '+917972755279',
    });
    expect(
      siteContact(env({ [CONTACT_EMAIL_VAR]: ' team@headway.example ', [CONTACT_PHONE_VAR]: '+91 98765 43210' })),
    ).toEqual({ email: 'team@headway.example', phone: '+91 98765 43210', whatsapp: '+919876543210' });
    for (const bad of ['not an address', 'a@b', 'two@addresses.example, more@addresses.example', '<x@y.zz>']) {
      expect(siteContact(env({ [CONTACT_EMAIL_VAR]: bad })).email, bad).toBe(DEFAULT_CONTACT.email);
    }
    for (const bad of ['call me', '12', 'https://example.test']) {
      expect(siteContact(env({ [CONTACT_PHONE_VAR]: bad })).phone, bad).toBe(DEFAULT_CONTACT.phone);
    }
  });

  it('shows the contact details on the page as text, never as a link', () => {
    const contact = stripComments(read('src', 'components', 'marketing', 'contact.tsx'));
    expect(contact).toContain('contact.email');
    expect(contact).toContain('contact.phone');
    expect(contact).toContain('contact.whatsapp');
    expect(contact).toMatch(/WhatsApp/);
    // The one link in the section is the sign-up button; nothing links to the details themselves.
    expect(contact.match(/href=/g) ?? []).toHaveLength(1);
    expect(contact).toContain('href={GET_STARTED.href}');
    expect(contact).not.toMatch(/wa.me|mailto:|tel:/i);
  });

  it('takes its own address from the setting the printed cards use', () => {
    expect(siteUrl(env({ REPOS_PUBLIC_BASE_URL: 'https://headway.example/' }))).toBe(
      'https://headway.example',
    );
    expect(siteUrl(env({ REPOS_PUBLIC_BASE_URL: 'headway.example' }))).toBeNull();
    expect(siteUrl(env({}))).toBeNull();
  });

  it('documents both contact variables in the environment template', () => {
    const example = read('.env.example');
    expect(example).toContain(CONTACT_EMAIL_VAR);
    expect(example).toContain(CONTACT_PHONE_VAR);
  });
});
