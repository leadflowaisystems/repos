import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_THEME_COLOR, INSTALLABLE_METADATA } from '@/lib/pwa';

/**
 * HEADWAY, INSTALLED (mobile polish pass).
 *
 * The owner's side opens from the home screen like an app; the customer's
 * feedback page and the public site stay ordinary web pages. These pin both
 * halves, and the static files the phone fetches before anyone signs in.
 */

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const b = readFileSync(join(root, 'public', file));
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const manifest = JSON.parse(read('public', 'app.webmanifest')) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
};

describe('the manifest', () => {
  it('names the app and opens it standalone', () => {
    expect(manifest.name).toBe('Headway');
    expect(manifest.short_name).toBe('Headway');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color.toLowerCase()).toBe(APP_THEME_COLOR);
  });

  it('opens on sign-in, which sends a signed-in owner straight to Home', () => {
    // /login redirects an actor to their landing path; see (auth)/login/page.tsx.
    expect(manifest.start_url).toBe('/login');
    expect(read('src', 'app', '(auth)', 'login', 'page.tsx')).toContain('if (actor) redirect(landingPathFor(actor));');
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
  });

  it('has 192 and 512 icons, plain and maskable, that exist at the size they claim', () => {
    for (const purpose of ['any', 'maskable']) {
      const sizes = manifest.icons.filter((i) => i.purpose === purpose).map((i) => i.sizes);
      expect(sizes, purpose).toEqual(expect.arrayContaining(['192x192', '512x512']));
    }
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(icon.src.replace(/^\//, ''))).toEqual({ width: w, height: h });
    }
    expect(pngSize('icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });
});

describe('who is offered the app', () => {
  it('links the manifest from the owner’s trees: sign-in and the workspace', () => {
    expect(INSTALLABLE_METADATA.manifest).toBe('/app.webmanifest');
    expect(INSTALLABLE_METADATA.appleWebApp.capable).toBe(true);
    for (const tree of ['(workspace)', '(auth)']) {
      const layout = read('src', 'app', tree, 'layout.tsx');
      expect(layout, tree).toContain('...INSTALLABLE_METADATA');
      expect(layout, tree).toContain('themeColor: APP_THEME_COLOR');
    }
  });

  it('leaves the customer feedback page and the public site as ordinary pages', () => {
    for (const tree of ['(feedback)', '(marketing)', '(print)']) {
      const file = join(root, 'src', 'app', tree, 'layout.tsx');
      if (!existsSync(file)) continue;
      const layout = read('src', 'app', tree, 'layout.tsx');
      expect(layout, tree).not.toContain('INSTALLABLE_METADATA');
      expect(layout, tree).not.toContain('manifest');
    }
    // A manifest file at the app root would be linked from every page.
    for (const name of ['manifest.ts', 'manifest.json', 'manifest.webmanifest']) {
      expect(existsSync(join(root, 'src', 'app', name)), name).toBe(false);
    }
  });

  it('keeps no service worker, so no signed-in page is ever served from a cache', () => {
    expect(existsSync(join(root, 'public', 'sw.js'))).toBe(false);
    expect(read('src', 'components', 'workspace', 'install-hint.tsx')).not.toContain('serviceWorker');
  });
});

describe('the files the phone fetches before anyone signs in', () => {
  it('are let past the sign-in middleware, like the favicon', () => {
    const middleware = read('src', 'middleware.ts');
    const matcher = middleware.slice(middleware.indexOf('matcher:'));
    expect(matcher).toContain('app.webmanifest');
    expect(matcher).toContain('icons/');
  });
});

describe('the install offer', () => {
  it('is a quiet row on More, never on Home and never a popup', () => {
    expect(read('src', 'components', 'workspace', 'more.tsx')).toContain('<InstallHint />');
    expect(read('src', 'components', 'workspace', 'brief.tsx')).not.toContain('InstallHint');
    expect(read('src', 'components', 'workspace', 'home.tsx')).not.toContain('InstallHint');
    const hint = read('src', 'components', 'workspace', 'install-hint.tsx');
    // It shows only after the browser offers, and hides once installed.
    expect(hint).toContain("'beforeinstallprompt'");
    expect(hint).toContain('(display-mode: standalone)');
  });
});
