import { readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { PRINT_SHEETS } from '@/lib/kit/sheets';
import {
  NAME_PLACEHOLDER,
  QR_DARK,
  QR_LIGHT,
  personaliseSheet,
  printableName,
  qrRaster,
} from '@/lib/kit/personalise';
import { bytesToLatin1, parsePdf, readStream } from '@/lib/kit/pdf-edit';

/**
 * FILLING IN AN APPROVED PRINT MASTER (M29).
 *
 * The masters are artwork somebody signed off. Two things get swapped into one
 * of them — the business name and that business's own QR — and the promise of
 * this module is that NOTHING ELSE MOVES. These tests are that promise, stated
 * as properties rather than eyeballed in a preview, because a card is permanent
 * once it is printed and a hundred wrong ones is not a bug report.
 *
 * The load-bearing assertion is the object-level diff: of the twenty objects in
 * a master, exactly three may differ — the code, the content stream and the
 * document title — and the seventeen others, every font and font file and the
 * page itself, must come through byte for byte.
 */

const ROOT = resolvePath(__dirname, '..');
const master = (publicPath: string) =>
  new Uint8Array(readFileSync(joinPath(ROOT, 'public', publicPath.replace(/^\//, ''))));

const CAFE = {
  businessName: 'Corner Cafe',
  feedbackUrl: 'https://app.headway.example.com/feedback/Ab3xY9zQmN2pLr7TvW1kJd',
};
const CLINIC = {
  businessName: "Dr. Mehta's Family Clinic & Diagnostics",
  feedbackUrl: 'https://app.headway.example.com/feedback/Mn4bVcXzLkJhGfDsAqWeRt',
};
const LONG = {
  businessName: 'The Very Long Restaurant And Banqueting Company Limited',
  feedbackUrl: 'https://app.headway.example.com/feedback/Zz9QwErTyUiOpAsDfGhJkL',
};

/** The page's content stream, decompressed, whatever filter it arrived under. */
function content(pdf: Uint8Array): string {
  const file = parsePdf(pdf);
  const page = file.objects.find((o) => /\/Type\s*\/Page[^s]/.test(bytesToLatin1(o.body)))!;
  const ref = /\/Contents\s+(\d+)\s+0\s+R/.exec(bytesToLatin1(page.body))!;
  const object = file.objects.find((o) => o.number === Number(ref[1]))!;
  return bytesToLatin1(readStream(object).data);
}

/**
 * Every string the sheet sets, in order, joined.
 *
 * The masters set some lines whole and the tracked capitals one glyph at a
 * time, so a per-glyph reader would silently drop the headline. Joining the
 * literals makes both shapes comparable: a name set as eleven blocks reads the
 * same as a name set as one.
 */
function contentText(pdf: Uint8Array): string {
  return content(pdf)
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const at = trimmed.lastIndexOf(') Tj');
      if (at < 0 || !trimmed.startsWith('BT')) return null;
      const from = trimmed.indexOf('(');
      return from < 0 || from > at ? null : trimmed.slice(from + 1, at);
    })
    .filter((s): s is string => s !== null)
    .join('');
}

/** The font resources the content stream actually selects. */
function fontsUsed(pdf: Uint8Array): Set<string> {
  return new Set([...content(pdf).matchAll(/\/(F\d(?:\+\d)?) [\d.]+ Tf/g)].map((m) => m[1] as string));
}

/** The single image, back as pixels. */
function image(pdf: Uint8Array): { width: number; height: number; rgb: Uint8Array } {
  const file = parsePdf(pdf);
  const img = file.objects.find((o) => /\/Subtype\s*\/Image/.test(bytesToLatin1(o.body)))!;
  const { dict, data } = readStream(img);
  return {
    width: Number(/\/Width\s+(\d+)/.exec(dict)![1]),
    height: Number(/\/Height\s+(\d+)/.exec(dict)![1]),
    rgb: data,
  };
}

// ---------------------------------------------------------------------------
// Nothing else moves
// ---------------------------------------------------------------------------

describe('exactly three objects may change', () => {
  for (const sheet of PRINT_SHEETS) {
    it(`leaves every font and the page untouched — ${sheet.label}`, () => {
      const before = parsePdf(master(sheet.file));
      const after = parsePdf(personaliseSheet(master(sheet.file), CAFE).pdf);

      expect(after.objects.map((o) => o.number)).toEqual(before.objects.map((o) => o.number));

      const changed: number[] = [];
      for (const object of before.objects) {
        const other = after.objects.find((o) => o.number === object.number)!;
        if (bytesToLatin1(object.body) !== bytesToLatin1(other.body)) changed.push(object.number);
      }
      // The code, the content stream, and the title. Three, and no fourth.
      expect(changed).toHaveLength(3);

      const kind = (file: typeof before, n: number) =>
        bytesToLatin1(file.objects.find((o) => o.number === n)!.body);
      const kinds = changed.map((n) => kind(before, n));
      expect(kinds.filter((b) => /\/Subtype\s*\/Image/.test(b))).toHaveLength(1);
      expect(kinds.filter((b) => /\/Title/.test(b))).toHaveLength(1);
      expect(kinds.filter((b) => /\/Length/.test(b) && !/\/Subtype/.test(b))).toHaveLength(1);

      // Said the other way round: no embedded font file was rewritten.
      for (const object of before.objects) {
        const body = bytesToLatin1(object.body);
        if (!/\/FontFile2|\/BaseFont|\/FontDescriptor|\/ToUnicode\s+\d/.test(body)) continue;
        const other = after.objects.find((o) => o.number === object.number)!;
        expect(bytesToLatin1(other.body), `object ${object.number} is a font and moved`).toBe(body);
      }
    });

    it(`keeps every other word on the card — ${sheet.label}`, () => {
      const before = contentText(master(sheet.file));
      const after = contentText(personaliseSheet(master(sheet.file), CAFE).pdf);
      // Take the placeholder out of one and the new name out of the other, and
      // what is left has to be identical: the approved wording, untouched.
      const strip = (text: string, name: string) => text.split(name).join('');
      expect(strip(after, 'CORNER CAFE')).toBe(strip(before, NAME_PLACEHOLDER));
      for (const line of [
        'How did we',
        'do today?',
        'SCAN',
        'NO APP NEEDED',
        'Read by the owner. Private',
        'never posted publicly.',
        'Thank you for helping us do better.',
        'Headway',
      ]) {
        expect(after, line).toContain(line);
      }
    });

    it(`still opens as a one-page PDF at the right paper size — ${sheet.label}`, () => {
      const out = personaliseSheet(master(sheet.file), CAFE).pdf;
      const body = bytesToLatin1(out);
      expect(body.startsWith('%PDF-')).toBe(true);
      expect(body.trimEnd().endsWith('%%EOF')).toBe(true);
      expect(body).toMatch(/\/Count 1\b/);
      // The MediaBox is on the page object, which is one of the untouched ones.
      const media = /\/MediaBox \[ ?([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ?\]/.exec(body)!;
      const original = /\/MediaBox \[ ?([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ?\]/.exec(
        bytesToLatin1(master(sheet.file)),
      )!;
      expect(media[3]).toBe(original[3]);
      expect(media[4]).toBe(original[4]);
    });

    it(`points every cross-reference offset at a real object — ${sheet.label}`, () => {
      // Every object's length changed, so the table is rebuilt from scratch.
      // A single wrong offset is a file that some readers open and others do not.
      const body = bytesToLatin1(personaliseSheet(master(sheet.file), CAFE).pdf);
      const table = body.slice(body.lastIndexOf('\nxref\n'));
      const offsets = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
      expect(offsets.length).toBeGreaterThan(15);
      for (const offset of offsets) expect(body.slice(offset)).toMatch(/^\d+ 0 obj/);
      const start = Number(/startxref\n(\d+)/.exec(body)![1]);
      expect(body.slice(start, start + 4)).toBe('xref');
    });

    it(`is byte-for-byte reproducible — ${sheet.label}`, () => {
      const a = personaliseSheet(master(sheet.file), CAFE).pdf;
      const b = personaliseSheet(master(sheet.file), CAFE).pdf;
      expect(bytesToLatin1(a)).toBe(bytesToLatin1(b));
    });
  }
});

// ---------------------------------------------------------------------------
// The name
// ---------------------------------------------------------------------------

describe('the business name', () => {
  it('replaces the placeholder on every face of the sheet', () => {
    const insert = personaliseSheet(master(PRINT_SHEETS[0]!.file), CAFE);
    const pair = personaliseSheet(master(PRINT_SHEETS[1]!.file), CAFE);
    // The A4 insert carries two cards; the Legal pair carries four faces.
    expect(insert.facesNamed).toBe(2);
    expect(pair.facesNamed).toBe(4);

    for (const out of [insert, pair]) {
      const text = contentText(out.pdf);
      expect(text).not.toContain(NAME_PLACEHOLDER);
      expect(text.split('CORNER CAFE').length - 1).toBe(out.facesNamed);
    }
  });

  it('is set in the master’s own font, at the master’s own size, when it fits', () => {
    const out = personaliseSheet(master(PRINT_SHEETS[0]!.file), CAFE);
    expect(out.sizePt).toBe(out.originalSizePt);
    // The resource the placeholder used is the resource the name uses. That is
    // the whole "no font change" claim, and it is checkable.
    expect(content(out.pdf)).toMatch(/\(C\) Tj/);
    expect(fontsUsed(out.pdf)).toEqual(fontsUsed(master(PRINT_SHEETS[0]!.file)));
    // And the name specifically: the placeholder's resource, not a base-14
    // stand-in that happens to be in the file already.
    const nameFont = /\(Y\) Tj/.test(content(master(PRINT_SHEETS[0]!.file)))
      ? /\/(F\d(?:\+\d)?) [\d.]+ Tf [\d.]+ TL \(Y\) Tj/.exec(content(master(PRINT_SHEETS[0]!.file)))![1]
      : null;
    expect(nameFont).toBeTruthy();
    expect(content(out.pdf)).toContain(`/${nameFont} ${out.sizePt} Tf`);
  });

  it('stays on the same baseline, centred where the placeholder was centred', () => {
    const file = master(PRINT_SHEETS[0]!.file);
    const lineOf = (pdf: Uint8Array, glyph: string) => {
      const parsed = parsePdf(pdf);
      const page = parsed.objects.find((o) => /\/Type\s*\/Page[^s]/.test(bytesToLatin1(o.body)))!;
      const ref = /\/Contents\s+(\d+)\s+0\s+R/.exec(bytesToLatin1(page.body))!;
      const content = parsed.objects.find((o) => o.number === Number(ref[1]))!;
      return bytesToLatin1(readStream(content).data)
        .split('\n')
        .map((l) => /^BT 1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm \/(\S+) ([\d.]+) Tf .* \((.)\) Tj/.exec(l.trim()))
        .find((m) => m && m[5] === glyph);
    };
    // The placeholder's first glyph and the new name's first glyph share a
    // baseline; the run is centred, so the x moves and the y does not.
    const placeholder = lineOf(file, 'Y')!;
    const named = lineOf(personaliseSheet(file, CAFE).pdf, 'C')!;
    expect(named[2]).toBe(placeholder[2]);
    expect(Number(named[4])).toBe(Number(placeholder[4]));
    // "CORNER CAFE" is shorter than "YOUR BUSINESS NAME", so it starts further
    // in — which is what centring on the same centre means.
    expect(Number(named[1])).toBeGreaterThan(Number(placeholder[1]));
  });

  it('shrinks a long name rather than running it off the card, and keeps it whole', () => {
    const out = personaliseSheet(master(PRINT_SHEETS[1]!.file), LONG);
    expect(out.sizePt).toBeLessThan(out.originalSizePt);
    // Whole: the letter-spacing gives way before the type does, so even a
    // 54-character name still fits without being cut.
    expect(out.printedName).toBe(LONG.businessName.toUpperCase());
    expect(out.printedName).not.toContain('...');
  });

  it('sets a name with an ampersand and an apostrophe, because the subset has them', () => {
    const out = personaliseSheet(master(PRINT_SHEETS[0]!.file), CLINIC);
    expect(out.printedName).toBe("DR. MEHTA'S FAMILY CLINIC & DIAGNOSTICS");
    expect(out.dropped).toEqual([]);
    expect(contentText(out.pdf)).toContain('&');
  });

  it('folds what the embedded font cannot set, and reports anything it drops', () => {
    // The subsets cover printable ASCII and nothing else, so an accent or a
    // rupee sign is folded to the nearest thing that prints rather than left to
    // render as a blank box on a hundred cards.
    expect(printableName('Café Rüchi — Bombay ₹').text).toBe('CAFE RUCHI - BOMBAY RS');
    expect(printableName('Café Rüchi').dropped).toEqual([]);
    const devanagari = printableName('कॉर्नर Cafe');
    expect(devanagari.text).toBe('CAFE');
    expect(devanagari.dropped.length).toBeGreaterThan(0);
  });

  it('refuses rather than printing a card with no name on it', () => {
    expect(() => personaliseSheet(master(PRINT_SHEETS[0]!.file), { ...CAFE, businessName: '   ' }))
      .toThrow(/no printable business name/i);
  });

  it('refuses a PDF that is not one of the Headway masters', () => {
    const notASheet = new Uint8Array(readFileSync(joinPath(ROOT, 'public', 'og.png')));
    expect(() => personaliseSheet(notASheet, CAFE)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// The code
// ---------------------------------------------------------------------------

describe('the QR', () => {
  it('encodes this client’s own feedback page, module for module', () => {
    // Not "a QR-shaped picture": the drawn raster is rebuilt into a module grid
    // and compared with what the encoder produced for this exact URL.
    const out = personaliseSheet(master(PRINT_SHEETS[0]!.file), CAFE);
    const { width, height, rgb } = image(out.pdf);
    expect(width).toBe(height);

    const expected = QRCode.create(CAFE.feedbackUrl, { errorCorrectionLevel: 'H' });
    const size = expected.modules.size;
    expect(out.qrModules).toBe(size);
    expect(width % size).toBe(0); // whole pixels per module

    const unit = width / size;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const x = Math.floor(col * unit + unit / 2);
        const y = Math.floor(row * unit + unit / 2);
        const i = (y * width + x) * 3;
        const dark = rgb[i] === QR_DARK[0] && rgb[i + 1] === QR_DARK[1] && rgb[i + 2] === QR_DARK[2];
        const want = expected.modules.data[row * size + col] === 1;
        expect(dark, `module ${col},${row}`).toBe(want);
      }
    }
  });

  it('gives every business a different code, and every face the same one', () => {
    // One business, one gateway, one code — and the masters place a single
    // image object on every face, so all of them move together by construction.
    const a = image(personaliseSheet(master(PRINT_SHEETS[1]!.file), CAFE).pdf);
    const b = image(personaliseSheet(master(PRINT_SHEETS[1]!.file), CLINIC).pdf);
    expect(bytesToLatin1(a.rgb)).not.toBe(bytesToLatin1(b.rgb));
    const pair = parsePdf(personaliseSheet(master(PRINT_SHEETS[1]!.file), CAFE).pdf);
    const images = pair.objects.filter((o) => /\/Subtype\s*\/Image/.test(bytesToLatin1(o.body)));
    expect(images).toHaveLength(1);
  });

  it('keeps the master’s own two colours, so the code stays part of the card', () => {
    // Navy on cream, read off the master. If these ever drift apart the code
    // starts looking like a sticker somebody put on the artwork.
    const original = image(master(PRINT_SHEETS[0]!.file));
    const corner = (img: { width: number; rgb: Uint8Array }) => {
      const i = 0;
      return [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
    };
    // The top-left module of any QR is the corner of a finder pattern: dark.
    expect(corner(original)).toEqual([...QR_DARK]);
    const out = image(personaliseSheet(master(PRINT_SHEETS[0]!.file), CAFE).pdf);
    expect(corner(out)).toEqual([...QR_DARK]);
    // And the light colour is the master's cream, not white.
    const light = new Set<string>();
    for (let i = 0; i < out.rgb.length; i += 3) {
      light.add(`${out.rgb[i]},${out.rgb[i + 1]},${out.rgb[i + 2]}`);
    }
    expect([...light].sort()).toEqual([QR_DARK.join(','), QR_LIGHT.join(',')].sort());
  });

  it('leaves room for a real quiet zone inside the artwork’s cream panel', () => {
    // The artwork gives the code a 43 mm square inside a 52 mm panel, so 4.5 mm
    // of cream on every side. The specification asks for four modules of it.
    // At the master's own 33 modules that is 3.45 — the personalised sheet must
    // not be worse, and in fact is better.
    const panelMm = 52;
    const codeMm = 43;
    const marginMm = (panelMm - codeMm) / 2;
    for (const business of [CAFE, CLINIC, LONG]) {
      const { qrModules } = personaliseSheet(master(PRINT_SHEETS[0]!.file), business);
      const moduleMm = codeMm / qrModules;
      expect(marginMm / moduleMm, `${business.businessName}: ${qrModules} modules`).toBeGreaterThanOrEqual(4);
      // And a module a phone can still resolve on paper.
      expect(moduleMm).toBeGreaterThan(0.45);
    }
  });

  it('fills the image edge to edge, as the master does', () => {
    // The quiet zone is the panel behind the code, not a margin inside the
    // image. An image with its own margin would shrink the code on the card.
    const raster = qrRaster(CAFE.feedbackUrl);
    expect(raster.width).toBe(raster.modules * Math.round(1600 / raster.modules));
    const corners = [0, raster.width - 1].flatMap((x) => [0, raster.width - 1].map((y) => ({ x, y })));
    const dark = corners.map(({ x, y }) => {
      const i = (y * raster.width + x) * 3;
      return raster.rgb[i] === QR_DARK[0];
    });
    // Three finder patterns, so three dark corners and one light.
    expect(dark.filter(Boolean)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------

describe('the download route', () => {
  const route = readFileSync(
    joinPath(ROOT, 'src', 'app', '(print)', 'print', 'sheet', '[clientId]', '[sheet]', 'route.ts'),
    'utf8',
  );

  it('is gated like every other per-client surface', () => {
    expect(route).toContain("await tenantGateFor(clientId, 'MEMBER')");
  });

  it('serves only the two known sheets', () => {
    expect(route).toContain('PRINT_SHEETS.find((s) => s.key === key)');
    expect(route).toMatch(/if \(!sheet\) return new NextResponse\('Not found', \{ status: 404 \}\)/);
  });

  it('refuses when there is no address for the QR to open', () => {
    // A printed card is permanent, so a sheet whose code opens nothing is worse
    // than no sheet at all.
    expect(route).toContain('const url = view.content.feedbackUrl');
    expect(route).toContain('status: 409');
  });

  it('never caches, because the name and the code follow the client record', () => {
    expect(route).toContain("'Cache-Control': 'no-store'");
  });

  it('offers the same bytes inline or as a download', () => {
    expect(route).toContain("searchParams.get('download') === '1'");
    expect(route).toContain("`${download ? 'attachment' : 'inline'}; filename=");
  });

  it('runs on Node, because it rewrites a PDF', () => {
    expect(route).toContain("export const runtime = 'nodejs'");
  });

  it('ships the masters with the function that reads them', () => {
    // public/ is deployed as static assets, which is not the same as being on
    // the filesystem a serverless function can read.
    const config = readFileSync(joinPath(ROOT, 'next.config.ts'), 'utf8');
    expect(config).toContain('outputFileTracingIncludes');
    expect(config).toContain('./public/print-kit/*.pdf');
    expect(config).toContain('/print/sheet/[clientId]/[sheet]');
  });
});
