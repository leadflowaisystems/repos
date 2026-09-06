import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { talliesFor } from '@/lib/portal/tallies';
import type { PortalSignal, PortalView } from '@/lib/portal/view';

/**
 * HEADWAY — the identity, as rules rather than as intentions.
 *
 * Three things are asserted here, and each of them is a claim somebody could
 * otherwise undo without noticing.
 *
 * THE NAME. Customers and business owners see Headway. The repository, the
 * database roles, the environment variables, the deployment and the prose in
 * the comments still say RepOS, because that is the internal name and renaming
 * it would be a migration rather than a rebrand. The line between the two is
 * exactly "is this a string a person reads", so that is what the check tests.
 *
 * THE COLOURS MEAN SOMETHING. Green is a strength or an improvement. Red is a
 * problem or something getting worse. Gold is Headway itself. Navy is the
 * interface. The palette is applied by redefining token NAMES, which makes a
 * brand change reviewable — and makes it possible for a token to quietly change
 * meaning under four hundred class strings nobody re-reads. That happened once
 * already in this pass: `warn` was amber and became gold, and two places that
 * used it to mean "this got worse" went on rendering, in the wrong colour.
 *
 * THE CONTRAST IS COMPUTED, NOT ASSUMED. Every foreground/background pairing the
 * product actually uses is checked against WCAG here rather than eyeballed.
 * Three of them failed when the palette moved, including the primary call to
 * action, and none of them looked wrong.
 */

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

// ---------------------------------------------------------------------------
// Contrast, computed from the tokens themselves
// ---------------------------------------------------------------------------

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const parts = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = parts.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const CSS = read('src', 'app', 'globals.css');

function token(name: string): string {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
  if (!m) throw new Error(`token --color-${name} is not defined`);
  return m[1]!.toLowerCase();
}

// ---------------------------------------------------------------------------
// The source, with comments removed
// ---------------------------------------------------------------------------

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

/**
 * Strips comments without mistaking the // of a scheme for one.
 *
 * A naive regex calls `https://` a comment and stops reading half a file, which
 * would make every check below silently weaker rather than fail.
 */
function stripComments(code: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < code.length; i += 1) {
    const c = code[i]!;
    if (quote) {
      if (c === '\\') {
        out += code.slice(i, i + 2);
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      continue;
    }
    if (c === '/' && code[i + 1] === '/' && code[i - 1] !== ':') {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end - 1;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 1;
      continue;
    }
    out += c;
  }
  return out;
}

const FILES = walk(SRC).map((file) => ({
  file: file.slice(ROOT.length + 1).replace(/\\/g, '/'),
  code: stripComments(readFileSync(file, 'utf8')),
}));

/** Everything a customer or a business owner can reach. */
const CLIENT_FACING = FILES.filter(
  ({ file }) =>
    file.startsWith('src/app/(workspace)/') ||
    file.startsWith('src/app/(portal)/') ||
    file.startsWith('src/app/(feedback)/') ||
    file.startsWith('src/app/(auth)/') ||
    file.startsWith('src/components/portal/') ||
    file.startsWith('src/components/workspace/') ||
    file.startsWith('src/components/feedback-gateway/'),
);

// ---------------------------------------------------------------------------

describe('the name a customer reads is Headway', () => {
  it('has client-facing files to check', () => {
    expect(CLIENT_FACING.length).toBeGreaterThan(20);
  });

  it('says RepOS nowhere a person can read it', () => {
    // Case-sensitive, and only where nothing alphanumeric touches it: REPOS_,
    // repos_, REP_OS and repos- are identifiers, and this is the brand.
    const BRAND = /(?<![A-Za-z0-9_$])RepOS(?![A-Za-z0-9_$])/;
    const offenders = FILES.filter(({ code }) => BRAND.test(code)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('keeps the internal identifiers alone, so this was a rebrand and not a migration', () => {
    const all = FILES.map((f) => f.code).join('\n');
    expect(all).toContain('REPOS_PUBLIC_BASE_URL');
    expect(all).toContain('REP_OS_QR');
    expect(read('prisma', 'm20', 'rls.sql')).toContain('repos_app');
  });

  it('says Headway in the invitation email and the printed card', () => {
    expect(read('prisma', 'm20', 'invitation-email.html')).toContain('Headway');
    expect(read('src', 'lib', 'kit', 'tent.ts')).toContain("'Headway'");
    expect(read('src', 'lib', 'kit', 'tent.ts')).toContain('Prepared by Headway');
  });

  it('draws the mark from one component, never by hand', () => {
    // Six pages used to draw their own square with a letter in it. Six copies
    // of a mark is six chances for them to drift, and none of them was the mark.
    const tiles = CLIENT_FACING.filter(({ code }) =>
      /place-items-center rounded-\w+ bg-ink-900[^"]*">\s*[A-Z]\s*</.test(code),
    ).map(({ file }) => file);
    expect(tiles).toEqual([]);
    expect(read('src', 'components', 'brand.tsx')).toContain('export function HeadwayMark');
    expect(read('src', 'components', 'brand.tsx')).toContain('export function HeadwayWordmark');
  });

  it('ships a favicon and an app icon that are the mark', () => {
    for (const icon of ['icon.svg', 'apple-icon.svg']) {
      const svg = read('src', 'app', icon);
      expect(svg, icon).toContain('#102A43');
      expect(svg, icon).toContain('#B78A3B');
    }
  });

  it('lets a signed-out visitor actually load those icons', () => {
    // They shipped behind the auth redirect and 307'd to the sign-in page, so
    // the tab was blank for every customer with a QR code and every invitee —
    // exactly the people the mark exists for.
    const matcher = read('src', 'middleware.ts');
    expect(matcher).toContain('icon.svg');
    expect(matcher).toContain('apple-icon.svg');
    expect(matcher).toContain('favicon.ico');
  });
});

describe('the palette is the one the brand specifies', () => {
  it('names the exact Headway values', () => {
    expect(token('ink-900')).toBe('#102a43'); // Primary Navy
    expect(token('ink-950')).toBe('#0b1f33'); // Deep Navy
    expect(token('ink-50')).toBe('#f7f8fa'); // Background
    expect(token('ink-200')).toBe('#d9e0e8'); // Border
    expect(token('ink-800')).toBe('#1f2937'); // Text Primary
    expect(token('ink-500')).toBe('#607089'); // Text Secondary
    expect(token('brand-500')).toBe('#b78a3b'); // Headway Gold
    expect(token('brand-50')).toBe('#faf7ef'); // Warm Cream
    expect(token('good-600')).toBe('#16a34a');
    expect(token('bad-600')).toBe('#dc2626');
  });

  it('makes warn Headway gold, which is what it now means', () => {
    // Deliberate: warn is no longer a third alarm colour competing with red.
    // Anything that used it to mean "something is wrong" had to move to bad,
    // and this is the assertion that keeps the two apart.
    expect(token('warn-600')).toBe(token('brand-500'));
    expect(token('warn-50')).toBe(token('brand-50'));
  });
});

describe('every pairing the product uses is legible', () => {
  const GROUNDS: Array<[string, string]> = [
    ['page', token('ink-50')],
    ['surface', '#ffffff'],
    ['cream', token('brand-50')],
  ];

  it('sets body and label text at 4.5:1 or better on every ground', () => {
    const failures: string[] = [];
    for (const name of ['ink-500', 'ink-600', 'ink-700', 'ink-800', 'ink-900']) {
      for (const [ground, bg] of GROUNDS) {
        const ratio = contrast(token(name), bg);
        if (ratio < 4.5) failures.push(`${name} on ${ground} = ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps the lightest text grey legible, rather than merely light', () => {
    // ink-400 was #8a99ac and carried the eyebrows, the dates and the counts at
    // 2.7:1. The Headway palette names exactly two text greys, so there is no
    // legible step below Text Secondary; anything paler is a border.
    for (const [ground, bg] of GROUNDS) {
      expect(contrast(token('ink-400'), bg), ground).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('puts white only on grounds that can carry it', () => {
    // The gold call to action failed at 3.13:1 for as long as it took to
    // compute it. brand-700 is the shade that passes, and it is still gold.
    expect(contrast('#ffffff', token('brand-700'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', token('ink-900'))).toBeGreaterThanOrEqual(4.5);
    // And the ones that do NOT pass, so nothing drifts back onto them.
    expect(contrast('#ffffff', token('brand-500'))).toBeLessThan(4.5);
    expect(contrast('#ffffff', token('good-600'))).toBeLessThan(4.5);
  });

  it('reads on the deep navy footer', () => {
    expect(contrast(token('ink-300'), token('ink-950'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the pale chips readable', () => {
    expect(contrast(token('warn-700'), token('warn-50'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('good-700'), token('good-50'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('bad-700'), token('bad-50'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('colour carries meaning, and only its own meaning', () => {
  it('never puts white text on a fill that cannot hold it', () => {
    // bg-good-600 and bg-warn-600 are 3.3:1 and 3.1:1 under white. A chip that
    // needs a fill uses a pale ground and dark type instead.
    const offenders: string[] = [];
    for (const { file, code } of CLIENT_FACING) {
      for (const m of code.matchAll(/'([^']*bg-(?:good|warn|brand)-(?:500|600)[^']*)'/g)) {
        if (/text-white/.test(m[1]!)) offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('fills nothing large with saturated red or green', () => {
    // Red and green are indicators: dots, arrows, chips, a left rule. A section
    // or a card filled with either turns a briefing into an alarm.
    const offenders: string[] = [];
    for (const { file, code } of CLIENT_FACING) {
      for (const m of code.matchAll(/className="([^"]*bg-(?:good|bad)-600[^"]*)"/g)) {
        const cls = m[1]!;
        const small = /\bh-\d|\bw-\d|rounded-full|px-\d|\bh-full\b/.test(cls);
        if (!small) offenders.push(`${file}: ${cls}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('spends the gold fill once, on the one action', () => {
    // Gold stops being premium the moment there are two of it on a screen.
    const home = [
      read('src', 'components', 'workspace', 'home.tsx'),
      read('src', 'components', 'portal', 'responsibility.tsx'),
    ].join('\n');
    const fills = [...stripComments(home).matchAll(/bg-brand-(?:500|600|700|900)\b/g)];
    // One resting fill and its hover, on the decision card's button.
    expect(fills.length).toBeLessThanOrEqual(2);
    expect(stripComments(home)).toContain('bg-brand-700');
  });

  it('reads a measured worsening as red, wherever it is drawn', () => {
    // The one regression the palette remap actually caused: WORSENED was
    // rendered with warn, which used to be amber and is now Headway gold.
    const ui = stripComments(read('src', 'components', 'portal', 'portal-ui.tsx'));
    const worsened = ui.slice(ui.indexOf("case 'WORSENED'"), ui.indexOf("case 'NO_CLEAR_CHANGE'"));
    expect(worsened).toContain('text-bad-700');
    expect(worsened).not.toContain('warn');
    expect(ui).not.toMatch(/WORSENED'\s*\n?\s*\?\s*'bg-warn-600'/);
  });

  it('never leaves colour as the only carrier of meaning', () => {
    // Every arrow and dot in the tallies is aria-hidden and sits beside a word;
    // the direction is also announced for a reader who cannot see the glyph.
    const ui = read('src', 'components', 'portal', 'portal-ui.tsx');
    expect(ui).toContain('<span className="sr-only">');
    expect(ui).toMatch(/sr-only">\{tally\.movement === 'up' \? 'up,' : 'down,'\}/);
  });
});

describe('nothing on the page claims more than the engine knows', () => {
  // Behavioural, not a grep. Every rule below was broken at some point in this
  // pass, and each break was invisible in the rendered page: a fading strength
  // drew a rising arrow, and a first week named a leading theme the rest of the
  // page refused to name.
  const signal = (over: Partial<PortalSignal>): PortalSignal =>
    ({
      themeKey: 'slow_service',
      themeLabel: 'Slow service',
      kind: 'ISSUE',
      fact: '',
      evidenceCount: 34,
      evidenceTotal: 87,
      share: '39%',
      movementDirection: null,
      movementCounts: null,
      movementLine: null,
      recurrence: null,
      isRecurring: false,
      isNew: false,
      counterpart: null,
      brief: '',
      movementBrief: '',
      meaning: '',
      why: [],
      bucket: 'FIRST',
      bucketLabel: '',
      advice: 'ACT',
      adviceLabel: '',
      featuredBecause: null,
      returning: false,
      ...over,
    }) as unknown as PortalSignal;

  const view = (over: Partial<PortalView>): PortalView =>
    ({
      basedOn: 87,
      soFar: { waiting: 0 },
      facts: [],
      first: null,
      keep: null,
      unhappy: [],
      loved: [],
      ...over,
    }) as unknown as PortalView;

  const at = (tallies: ReturnType<typeof talliesFor>, key: string) =>
    tallies.find((t) => t.key === key);

  it('draws no arrow where two check-ins were never compared', () => {
    const t = talliesFor(view({ first: signal({}) }), '/w');
    expect(at(t, 'issue')?.movement).toBeNull();
  });

  it('points a rising complaint up, and a falling one down', () => {
    const rising = talliesFor(
      view({ first: signal({ kind: 'ISSUE', movementDirection: 'WORSENING' }) }),
      '/w',
    );
    expect(at(rising, 'issue')?.movement).toBe('up');
    expect(at(rising, 'issue')?.tone).toBe('bad');

    const falling = talliesFor(
      view({ first: signal({ kind: 'ISSUE', movementDirection: 'IMPROVING' }) }),
      '/w',
    );
    expect(at(falling, 'issue')?.movement).toBe('down');
  });

  it('points a fading strength DOWN, which it did not for one afternoon', () => {
    // For a praise theme, WORSENING means customers mentioned it LESS. Falling
    // through to the complaint-shaped helper made 'down' unreachable, so a
    // strength that was disappearing drew the same rising arrow as one that
    // was growing.
    const fading = talliesFor(
      view({ keep: signal({ kind: 'PRAISE', movementDirection: 'WORSENING' }) }),
      '/w',
    );
    expect(at(fading, 'praise')?.movement).toBe('down');
    expect(at(fading, 'praise')?.tone).toBe('good');

    const growing = talliesFor(
      view({ keep: signal({ kind: 'PRAISE', movementDirection: 'IMPROVING' }) }),
      '/w',
    );
    expect(at(growing, 'praise')?.movement).toBe('up');
  });

  it('treats a movement the engine called steady as no movement at all', () => {
    const steady = talliesFor(
      view({ first: signal({ movementDirection: 'STABLE', movementCounts: '3 → 2 mentions' }) }),
      '/w',
    );
    expect(at(steady, 'issue')?.movement).toBeNull();
    // The counts still show; only the direction is withheld.
    expect(at(steady, 'issue')?.note).toContain('3 → 2 mentions');
  });

  it('omits the tile rather than naming a leader the engine would not name', () => {
    // `first` and `keep` are empty exactly when the leading theme is still
    // EARLY — fewer than ten pieces read. There is no fallback to the top of
    // the raw list.
    const early = talliesFor(
      view({ first: null, keep: null, unhappy: [signal({})], loved: [signal({ kind: 'PRAISE' })] }),
      '/w',
    );
    expect(at(early, 'issue')).toBeUndefined();
    expect(at(early, 'praise')).toBeUndefined();
    expect(early.map((t) => t.key)).toEqual(['read']);
  });

  it('says which pile every count came from', () => {
    const compared = talliesFor(
      view({ first: signal({ movementCounts: '4 → 8 mentions' }) }),
      '/w',
    );
    expect(at(compared, 'issue')?.note).toBe('4 → 8 mentions at your last two check-ins');

    const uncompared = talliesFor(view({ first: signal({}) }), '/w');
    expect(at(uncompared, 'issue')?.note).toBe('34 of 87 mention it');
  });

  it('omits the public rating when the listing was never observed', () => {
    expect(at(talliesFor(view({}), '/w'), 'rating')).toBeUndefined();
    const observed = talliesFor(
      view({ facts: [{ label: 'Public rating', value: '3.6', scope: 'All 244 public reviews' }] }),
      '/w',
    );
    expect(at(observed, 'rating')?.value).toBe('3.6');
  });

  it('invents no percentage anywhere on the page', () => {
    const home = stripComments(read('src', 'components', 'workspace', 'home.tsx'));
    expect(home).not.toMatch(/\+\d+%/);
  });

  it('claims no freshness it is not measuring', () => {
    // "Last updated" was fed new Date() on a force-dynamic page, so it printed
    // the render clock to the minute and could never say anything else.
    const footer = stripComments(read('src', 'components', 'portal', 'workspace.tsx'));
    expect(footer).not.toContain('Last updated');
    const layout = stripComments(
      read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'layout.tsx'),
    );
    expect(layout).not.toContain('formatDateTime(new Date())');
  });

  it('counts correctly however many things are being watched', () => {
    const ui = stripComments(read('src', 'components', 'portal', 'responsibility.tsx'));
    expect(ui).not.toContain('Neither needs');
    expect(ui).toContain("rest === 1 ? 'It does not need' : 'None of them need'");
  });
});

describe('no dark patterns anywhere in the owner surfaces', () => {
  it('has no streak, badge, point, countdown or confetti', () => {
    // "the whole point of it" is English. A scoring system announces itself
    // with a number beside the word, or with the vocabulary around it.
    const BANNED =
      /\bstreaks?\b|\bbadges?\b|\bleaderboard|\btrophy|\bconfetti|\bgamif|\b\d+\s*points?\b|points (earned|balance|scored)|hurry|last chance|expires (in|soon)|running out|act now|only \d+ (hours?|days?) left/i;
    const offenders = CLIENT_FACING.filter(({ code }) => BANNED.test(code)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
