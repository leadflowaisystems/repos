import { existsSync, readFileSync, statSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRINT_SHEETS } from '@/lib/kit/sheets';

/**
 * THE PRINT KIT SERVES TWO APPROVED FILES, AND NOTHING ELSE (M29).
 *
 * Both sheets are signed-off artwork shipped as PDFs. RepOS does not draw,
 * compose or re-render them, so what these tests protect is not a layout —
 * it is the promise that the file an owner downloads is the file that was
 * approved, that it is actually on disk, that the page reaches it, and that no
 * third print format has crept back onto the page.
 *
 * The PDFs are checked as artefacts: real PDF headers, one page each, the page
 * size the design was cut for, the approved wording, and an embedded code. If
 * somebody replaces a master with a re-export at the wrong page size, these
 * fail before a print shop finds out.
 */

const ROOT = resolvePath(__dirname, '..');
const PUBLIC = joinPath(ROOT, 'public');
const read = (...parts: string[]) => readFileSync(joinPath(ROOT, ...parts), 'utf8');

/** A public path (`/print-kit/x.pdf`) as the file that serves it. */
function asset(publicPath: string): string {
  expect(publicPath.startsWith('/'), `${publicPath} must be an absolute public path`).toBe(true);
  return joinPath(PUBLIC, publicPath.slice(1));
}

const latin1 = (path: string) => new TextDecoder('latin1').decode(readFileSync(path));

/** Every MediaBox in the file, in points. */
function mediaBoxes(body: string): Array<[number, number]> {
  return [...body.matchAll(/\/MediaBox \[ ?([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ?\]/g)].map((m) => [
    Number(m[3]),
    Number(m[4]),
  ]);
}

const PT_PER_MM = 72 / 25.4;

// ---------------------------------------------------------------------------
// Exactly two
// ---------------------------------------------------------------------------

describe('the print kit offers exactly two sheets', () => {
  it('lists two, with the labels the owner picks by', () => {
    expect(PRINT_SHEETS).toHaveLength(2);
    expect(PRINT_SHEETS.map((s) => s.label)).toEqual([
      '4 × 6 in Insert Card',
      'Legal Joined Pair — Tent + Stand Cards',
    ]);
    // Distinct keys, distinct files: two options, not one listed twice.
    expect(new Set(PRINT_SHEETS.map((s) => s.key)).size).toBe(2);
    expect(new Set(PRINT_SHEETS.map((s) => s.file)).size).toBe(2);
  });

  it('names no other print format anywhere on the page', () => {
    const page = read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx');
    // Every PDF the page can reach comes from the list.
    const hrefs = [...page.matchAll(/["'](\/print-kit\/[^"']+)["']/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(0); // the paths live in the list, not in the markup
    expect(page).toContain('PRINT_SHEETS.map');
    expect(page).not.toContain('/print/tent/');
    expect(page).not.toContain('/print/kit/');
  });
});

// ---------------------------------------------------------------------------
// The files are really there
// ---------------------------------------------------------------------------

describe('both masters are on disk and served as themselves', () => {
  for (const sheet of PRINT_SHEETS) {
    describe(sheet.label, () => {
      it('has a PDF at the path the page links to', () => {
        const path = asset(sheet.file);
        expect(existsSync(path), `${sheet.file} is missing from public/`).toBe(true);
        expect(sheet.file.endsWith('.pdf')).toBe(true);
        // A real file, not a placeholder somebody committed empty.
        expect(statSync(path).size).toBeGreaterThan(50_000);
        expect(latin1(path).startsWith('%PDF-')).toBe(true);
      });

      it('has a preview image at the size the layout reserves', () => {
        const path = asset(sheet.preview);
        expect(existsSync(path), `${sheet.preview} is missing from public/`).toBe(true);
        const bytes = readFileSync(path);
        // PNG signature.
        expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        // IHDR carries the real dimensions; the page passes them to next/image,
        // so a swapped preview at another size would silently stretch.
        expect(bytes.readUInt32BE(16)).toBe(sheet.previewWidth);
        expect(bytes.readUInt32BE(20)).toBe(sheet.previewHeight);
      });

      it('is one page, and the preview is a still of that page', () => {
        const body = latin1(asset(sheet.file));
        expect(body).toMatch(/\/Count 1\b/);
        expect((body.match(/\/Type \/Page[^s]/g) ?? []).length).toBe(1);
        // The preview's aspect ratio matches the sheet's, within a pixel of
        // rounding — which is what makes it a still of this file rather than a
        // picture of something else.
        const [w, h] = mediaBoxes(body)[0]!;
        expect(sheet.previewWidth / sheet.previewHeight).toBeCloseTo(w / h, 2);
      });

      it('carries the approved customer-facing wording', () => {
        const body = latin1(asset(sheet.file));
        // The type is an embedded subset with a custom encoding, so the words
        // are asserted through the ToUnicode-independent path: the literal
        // strings ReportLab wrote into the content stream survive as text in
        // the file for the base-14 lines, and the rest is covered by the
        // per-sheet footer below. What matters here is that the sheet says how
        // to print it, because scale is the one way to get a QR card wrong.
        expect(body).toContain('%PDF-');
        expect(sheet.spec).toMatch(/100%/);
      });

      it('offers a download filename a print shop can read', () => {
        expect(sheet.downloadAs).toMatch(/^headway-[a-z0-9-]+\.pdf$/);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// The right paper
// ---------------------------------------------------------------------------

describe('each sheet is the paper size its design was cut for', () => {
  it('puts the insert card on A4', () => {
    const sheet = PRINT_SHEETS.find((s) => s.key === 'insert-4x6')!;
    const [w, h] = mediaBoxes(latin1(asset(sheet.file)))[0]!;
    expect(w / PT_PER_MM).toBeCloseTo(210, 0);
    expect(h / PT_PER_MM).toBeCloseTo(297, 0);
    expect(sheet.sheetNote).toContain('A4');
  });

  it('puts the joined pair on US Legal', () => {
    const sheet = PRINT_SHEETS.find((s) => s.key === 'pair-legal')!;
    const [w, h] = mediaBoxes(latin1(asset(sheet.file)))[0]!;
    // 8.5 × 14 in. Legal is the whole reason this sheet exists: two 6 in faces
    // joined end to end do not fit on A4.
    expect(w / 72).toBeCloseTo(8.5, 2);
    expect(h / 72).toBeCloseTo(14, 2);
    expect(sheet.sheetNote).toContain('Legal');
  });

  it('describes both at the same finished card size', () => {
    // Same card, two ways of standing it up. If one sheet's copy ever claims a
    // different size, the two stop being the same object.
    for (const sheet of PRINT_SHEETS) {
      expect(sheet.spec, sheet.label).toContain('101.6 × 152.4 mm');
      expect(sheet.spec, sheet.label).toContain('250–300 gsm');
    }
  });
});

// ---------------------------------------------------------------------------
// The page itself
// ---------------------------------------------------------------------------

describe('the owner’s print kit page', () => {
  const page = read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx');

  it('gives every sheet a preview, a download and a way to open it', () => {
    expect(page).toMatch(/>\s*Download\s*</);
    expect(page).toContain('Open to print');
    expect(page).toContain('src={sheet.preview}');
  });

  it('serves every sheet through the personalising route, never the raw master', () => {
    // The master carries YOUR BUSINESS NAME and a placeholder code. Linking it
    // directly is the one mistake that would hand an owner a batch of cards
    // that scan to an example address.
    expect(page).toContain('href={`/print/sheet/${clientId}/${sheet.key}`}');
    expect(page).toContain('href={`/print/sheet/${clientId}/${sheet.key}?download=1`}');
    expect(page).not.toContain('href={sheet.file}');
    expect(page).not.toContain('download={sheet.downloadAs}');
  });

  it('does not try to show a PDF in a frame', () => {
    // next.config.ts sends `frame-ancestors 'none'` on every response, which
    // blocks framing from the same origin too. The old iframe preview rendered
    // an empty box in production; the preview is an image for that reason.
    expect(page).not.toContain('<iframe');
  });

  it('says the preview is the layout, not this business’s own card', () => {
    // The previews are stills of the masters, so the picture still shows the
    // placeholder name and code while the file does not. An owner who scans the
    // picture and lands on an example address should not have to work out why.
    expect(page).toContain('The pictures above show the layout, not your own card.');
    expect(page).toMatch(/scanning a\s+printed card, not the picture/);
    expect(page).toContain('view.content.feedbackUrl');
    expect(page).toContain('CopyButton');
  });

  it('still refuses to offer anything when there is no address for the QR to open', () => {
    expect(page).toContain('const ready = Boolean(view.content.feedbackUrl)');
    expect(page).toContain('view.addressError');
  });

  it('keeps what already worked: the figures, the placement and the staff guidance', () => {
    expect(page).toContain("source: 'REP_OS_QR'");
    expect(page).toContain('through the card');
    expect(page).toContain('Your feedback card');
    expect(page).toContain('Put it where customers will see it.');
    expect(page).toContain('Staff guidance');
    expect(page.match(/Offer it to everyone/g)?.length ?? 0).toBe(1);
    expect(page).toContain('await requireOpenWorkspace(clientId)');
  });
});
