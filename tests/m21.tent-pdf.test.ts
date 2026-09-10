import { readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TENT,
  TENT_COPY,
  composeTentSheet,
  qrMatrix,
  renderTentSheet,
  tentGeometry,
  type TentInput,
} from '@/lib/kit/tent';
import { PT_PER_MM, textWidthMm } from '@/lib/kit/pdf';

/**
 * THE HEADWAY TABLE TENT, CHECKED AS AN OBJECT.
 *
 * The kit is the only part of Headway that leaves the screen, and a card is
 * permanent once it is printed. A hundred cards with a clipped line or a QR
 * that will not scan is not a bug report, it is a hundred pieces of paper.
 *
 * So the geometry is asserted rather than previewed, and so is the thing that
 * matters most about this design: it is ONE template. Two clients produce the
 * same sheet with two things swapped — the name and the code — and these tests
 * prove that by rendering two of them and comparing every word.
 */

const CAFE: TentInput = {
  businessName: 'Corner Cafe',
  feedbackUrl: 'https://headway.example.com/feedback/Ab3xY9zQmN2pLr7TvW1kJd',
};

const CLINIC: TentInput = {
  businessName: "Dr. Mehta's Family Clinic & Diagnostics",
  feedbackUrl: 'https://headway.example.com/feedback/Mn4bVcXzLkJhGfDsAqWeRt',
};

const LONG: TentInput = {
  businessName: 'The Very Long Restaurant And Banqueting Company Limited',
  feedbackUrl: 'https://headway.example.com/feedback/Zz9QwErTyUiOpAsDfGhJkL',
};

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

/** The drawing operators, in order, as the page emitted them. */
function ops(input: TentInput): string[] {
  return composeTentSheet(input).content().split('\n');
}

/** Every string the sheet actually sets, in order. */
function words(input: TentInput): string[] {
  return ops(input)
    .filter((l) => l.endsWith(' Tj'))
    .map((l) => l.slice(1, l.lastIndexOf(') Tj')));
}

/** Every filled rectangle drawn immediately after this colour. */
function rects(lines: string[], colour: string): number[][] {
  return lines
    .map((line, i) => ({ line, prev: lines[i - 1] }))
    .filter((x) => x.line.endsWith(' re f') && x.prev === colour)
    .map((x) => x.line.split(' ').slice(0, 4).map(Number));
}

const NAVY = '0.063 0.165 0.263 rg';
const GOLD = '0.718 0.541 0.231 rg';
const PANEL = '0.925 0.902 0.847 rg';
const BLACK = '0 0 0 rg';

// ---------------------------------------------------------------------------
// The physical object
// ---------------------------------------------------------------------------

describe('the physical card', () => {
  const g = tentGeometry();

  it('is A4, exactly', () => {
    expect(g.pageWidthMm).toBe(210);
    expect(g.pageHeightMm).toBe(297);
  });

  it('shows the approved face: 84 × 123 mm, portrait', () => {
    expect(g.faceWidthMm).toBe(84);
    expect(g.faceHeightMm).toBe(123);
    expect(g.faceHeightMm).toBeGreaterThan(g.faceWidthMm);
  });

  it('is four panels: two faces, a base and a tab', () => {
    // The A-frame the approved artwork builds. Two faces lean apart from the
    // ridge, the base folds under and lies on the table, and the tab closes
    // the triangle inside the far face.
    expect(g.cardHeightMm).toBeCloseTo(
      g.faceHeightMm * 2 + TENT.baseMm + TENT.tabMm,
      6,
    );
    expect(g.fold1Mm - g.cardTopMm).toBeCloseTo(g.faceHeightMm, 6);
    expect(g.fold2Mm - g.fold1Mm).toBeCloseTo(g.faceHeightMm, 6);
    expect(g.fold3Mm - g.fold2Mm).toBeCloseTo(TENT.baseMm, 6);
    expect(g.cardBottomMm - g.fold3Mm).toBeCloseTo(TENT.tabMm, 6);
  });

  it('makes the two faces identical in size, so the tent reads the same from either side', () => {
    expect(g.fold2Mm - g.fold1Mm).toBeCloseTo(g.fold1Mm - g.cardTopMm, 6);
  });

  it('fits two whole cards on one sheet, side by side, with paper between them', () => {
    expect(g.cardsPerSheet).toBe(2);
    expect(g.cardLeftsMm).toHaveLength(2);
    const firstRightBleed = g.cardLeftsMm[0]! + g.cardWidthMm + g.bleedMm;
    expect(g.cardLeftsMm[1]! - g.bleedMm - firstRightBleed).toBeCloseTo(TENT.gapMm, 6);
    expect(g.cardLeftsMm[1]! + g.cardWidthMm).toBeLessThanOrEqual(g.pageWidthMm);
    expect(g.cardBottomMm).toBeLessThanOrEqual(g.pageHeightMm);
  });

  it('centres the pair', () => {
    const leftGap = g.cardLeftsMm[0]! - g.bleedMm;
    const rightGap = g.pageWidthMm - (g.cardLeftsMm[1]! + g.cardWidthMm + g.bleedMm);
    expect(leftGap).toBeCloseTo(rightGap, 6);
  });

  it('carries a bleed, so a cut that wanders leaves no white edge', () => {
    const lines = ops(CAFE);
    const navy = rects(lines, NAVY);
    // One navy ground per card, and it is the card PLUS a bleed on every side.
    expect(navy).toHaveLength(2);
    for (const [x, , w, h] of navy) {
      expect(w! / PT_PER_MM).toBeCloseTo(g.cardWidthMm + g.bleedMm * 2, 3);
      expect(h! / PT_PER_MM).toBeCloseTo(g.cardHeightMm + g.bleedMm * 2, 3);
      const trimLeft = g.cardLeftsMm.find((l) => Math.abs(l - g.bleedMm - x! / PT_PER_MM) < 0.01);
      expect(trimLeft, 'the navy sits exactly one bleed outside a trim edge').toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Nothing that matters is clipped
// ---------------------------------------------------------------------------

describe('what survives the cut', () => {
  const g = tentGeometry();

  it('keeps the whole finished card clear of the printer’s own border', () => {
    // This is the invariant that matters. Consumer printers cannot reach the
    // outermost few millimetres of the paper; everything INSIDE the trim is
    // what the owner ends up holding, so it is the trim, not the ink, that has
    // to be safely inboard. It is 6.5 mm from the top and the sides, and more
    // than that from the foot.
    const inset = Math.min(
      g.cardLeftsMm[0]!,
      g.cardTopMm,
      g.pageWidthMm - (g.cardLeftsMm[1]! + g.cardWidthMm),
      g.pageHeightMm - g.cardBottomMm,
    );
    expect(inset).toBeGreaterThanOrEqual(6.5);
  });

  it('keeps even the bleed and the build instructions on the paper, with room to spare', () => {
    // Outside the trim there are only two things, and both are thrown away by
    // the cut: the bleed, and the two lines at the foot that say how to build
    // the tent. They still have to PRINT, or the person assembling it never
    // reads them — 3 mm is inside the margin of every current A4 printer.
    for (const input of [CAFE, CLINIC, LONG]) {
      const page = composeTentSheet(input);
      const ink = page.bounds()!;
      const smallest = Math.min(
        ink.leftMm,
        ink.topMm,
        page.widthMm - ink.rightMm,
        page.heightMm - ink.bottomMm,
      );
      expect(smallest, input.businessName).toBeGreaterThanOrEqual(3);
    }
  });

  it('never lets a long business name print past the edge of the card', () => {
    // It did once. A 54-character name set in tracked capitals was measured
    // WITHOUT the tracking, and 146 mm of type went onto an 84 mm card and off
    // the sheet. Ink outside the page is the one fault a rendered preview
    // cannot show you.
    const page = composeTentSheet(LONG);
    const ink = page.bounds()!;
    expect(ink.leftMm).toBeGreaterThanOrEqual(0);
    expect(ink.rightMm).toBeLessThanOrEqual(page.widthMm);
    // And it stays inside its own card, not merely inside the page.
    const name = words(LONG)[0]!;
    expect(name).toBe(LONG.businessName.toUpperCase());
    expect(name).not.toContain('…');
  });

  it('sets the name smaller rather than wrapping it or letting it run over', () => {
    const sizeOfName = (input: TentInput) =>
      Number(/\/F1 ([\d.]+) Tf\n[\d.]+ Tc\n[\d.]+ [\d.]+ Td\n\([A-Z]/.exec(
        composeTentSheet(input).content(),
      )?.[1] ?? 0);
    expect(sizeOfName(CAFE)).toBeGreaterThan(sizeOfName(LONG));
    expect(sizeOfName(LONG)).toBeGreaterThan(0);
    // One line, whatever the name: four faces, four settings of it.
    expect(words(LONG).filter((w) => w === LONG.businessName.toUpperCase())).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// ONE TEMPLATE
// ---------------------------------------------------------------------------

describe('one canonical template, personalised with two things', () => {
  it('says the same words to every business', () => {
    const cafe = words(CAFE);
    const clinic = words(CLINIC);
    expect(cafe).toHaveLength(clinic.length);

    const cafeName = CAFE.businessName.toUpperCase();
    const clinicName = CLINIC.businessName.toUpperCase();
    cafe.forEach((word, i) => {
      const other = clinic[i]!;
      if (word === cafeName) {
        expect(other, 'the only line that differs is the business name').toBe(clinicName);
        return;
      }
      expect(other).toBe(word);
    });
  });

  it('gives every business a different code', () => {
    const grid = (input: TentInput) =>
      rects(ops(input), BLACK)
        .map((r) => r.join(','))
        .join('|');
    expect(grid(CAFE)).not.toBe(grid(CLINIC));
  });

  it('prints the approved wording, exactly', () => {
    const said = words(CAFE);
    for (const line of [
      ...TENT_COPY.headline,
      TENT_COPY.subhead,
      TENT_COPY.scanLine,
      TENT_COPY.privacyLine,
      TENT_COPY.thankYou,
      TENT_COPY.wordmark,
      ...TENT_COPY.base,
      TENT_COPY.tab,
      ...TENT_COPY.sheet,
      TENT_COPY.cut,
      ...TENT_COPY.folds,
    ]) {
      // The PDF escapes its own delimiters and writes WinAnsi bytes in octal,
      // so compare on the decoded side.
      const encoded = line
        .replace(/[\\()]/g, (c) => `\\${c}`)
        .replace(/—/g, '\\227')
        .replace(/·/g, '\\267');
      expect(said, line).toContain(encoded);
    }
  });

  it('takes no wording from the vertical packs', () => {
    // Before this design the card asked a different question per vertical.
    // One approved template means one question, and a clinic's card must not
    // be able to say "meal" because a restaurant's does.
    const body = composeTentSheet(CLINIC).content();
    for (const stray of [
      'How was your meal',
      'How was your visit',
      'How is the gym working',
      'somewhere between',
      'kitchen team',
      'about a minute',
      'billing counter',
    ]) {
      expect(body, stray).not.toContain(stray);
    }
  });

  it('never mentions a public review site, a rating or a star', () => {
    // The card asks for honest feedback and promises it is private. A line
    // about Google, or a row of stars, would sort customers by mood before
    // they answered, and everything Headway reads afterwards would be worth
    // less for it.
    const body = composeTentSheet(CAFE).content().toLowerCase();
    for (const stray of ['google', 'star', 'rate us', 'review us', '5-star', 'if you enjoyed']) {
      expect(body, stray).not.toContain(stray);
    }
    expect(TENT_COPY.privacyLine).toContain('never posted publicly');
  });

  it('takes only a name and an address, so nothing else can vary', () => {
    const ROOT = resolvePath(__dirname, '..');
    const route = readFileSync(
      joinPath(ROOT, 'src', 'app', '(print)', 'print', 'tent', '[clientId]', 'route.ts'),
      'utf8',
    );
    const call = /renderTentSheet\(\{([\s\S]*?)\}\);/.exec(route)?.[1] ?? '';
    const fields = [...call.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    expect(fields.sort()).toEqual(['businessName', 'feedbackUrl']);
  });
});

// ---------------------------------------------------------------------------
// The look
// ---------------------------------------------------------------------------

describe('the approved look', () => {
  const lines = ops(CAFE);

  it('is navy, gold and cream — Headway’s colours, not the client’s', () => {
    // The card is one approved object every client puts on a table. A business
    // can set its own colours in Headway and they are used where they belong;
    // this is not one of those places, and there is no input that could make
    // it one.
    const used = new Set(lines.filter((l) => l.endsWith(' rg') || l.endsWith(' RG')));
    expect(used).toContain(NAVY);
    expect(used).toContain(GOLD);
    expect(used).toContain(PANEL);
    expect(used).toContain('0.953 0.929 0.878 rg'); // the cream headline
    expect(used).toContain('0.718 0.757 0.804 rg'); // the two supporting lines
    // Nine, and no tenth: whatever the client, the palette is closed.
    expect(used.size).toBe(9);
    expect(new Set(ops(LONG).filter((l) => l.endsWith(' rg') || l.endsWith(' RG')))).toEqual(used);
  });

  it('rides a gold band on every fold', () => {
    const gold = rects(lines, GOLD);
    // Two per face, four faces: the shared bands at the ridge are drawn by
    // both of the faces that meet there.
    expect(gold).toHaveLength(8);
    const heights = new Set(gold.map((r) => Math.round((r[3]! / PT_PER_MM) * 10) / 10));
    expect(heights).toEqual(new Set([TENT.bandInsideMm + TENT.bandOutsideMm]));
  });

  it('sets the question in an italic serif, and only the question and the thanks', () => {
    const serif = lines.filter((l) => l.startsWith('/F3 '));
    // Two lines of headline plus the thank-you, on four faces.
    expect(serif).toHaveLength(12);
    expect(new Set(serif)).toEqual(new Set(['/F3 24 Tf', '/F3 9.5 Tf']));
    const file = text(renderTentSheet(CAFE));
    expect(file).toContain('/BaseFont /Times-Italic');
    expect(file).toContain('/F3 ');
  });

  it('puts the code on a rounded cream panel, at a fixed height', () => {
    // Fixed, not stacked under the text: no line of type can ever push the
    // code down the card, because no line of type is measured against it.
    const panels = lines.filter((l, i) => l === 'f' && lines.slice(0, i).lastIndexOf(PANEL) > -1);
    expect(panels.length).toBeGreaterThanOrEqual(4);
    const curves = lines.filter((l) => l.endsWith(' c'));
    // Four rounded corners on four panels, plus the rising path of the mark on
    // each of the four faces.
    expect(curves).toHaveLength(4 * 4 + 4);
  });
});

// ---------------------------------------------------------------------------
// Both faces are the same object
// ---------------------------------------------------------------------------

describe('the tent is two identical faces joined at the ridge', () => {
  it('rotates exactly one face per card, by exactly half a turn about its centre', () => {
    const g = tentGeometry();
    const lines = ops(CAFE);
    const rotations = lines.filter((l) => l.endsWith(' cm'));
    expect(rotations).toHaveLength(2);

    rotations.forEach((op, index) => {
      const [a, b, c, d, e, f] = op.replace(' cm', '').split(' ').map(Number);
      // A point reflection: p -> 2·centre - p. That is a 180-degree turn and
      // nothing else, so the face lands back in its own box the other way up.
      expect([a, b, c, d]).toEqual([-1, 0, 0, -1]);
      const centreXmm = g.cardLeftsMm[index]! + g.cardWidthMm / 2;
      const centreYmm = g.cardTopMm + g.faceHeightMm / 2;
      expect(e!).toBeCloseTo(2 * centreXmm * PT_PER_MM, 2);
      expect(f!).toBeCloseTo(2 * (g.pageHeightMm - centreYmm) * PT_PER_MM, 2);
    });
  });

  it('draws the same face on both sides of the ridge', () => {
    const lines = ops(CAFE);
    const start = lines.indexOf('q');
    const end = lines.indexOf('Q');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const rotated = lines.slice(start + 1, end).filter((l) => !l.endsWith(' cm'));
    const upright = lines.slice(end + 1, end + 1 + rotated.length);

    expect(upright).toHaveLength(rotated.length);
    expect(upright.map(kind)).toEqual(rotated.map(kind));
    // Same words, in the same order.
    expect(upright.filter((l) => l.endsWith(' Tj'))).toEqual(
      rotated.filter((l) => l.endsWith(' Tj')),
    );
    // Same horizontal geometry: x is untouched by the vertical offset.
    expect(upright.filter((l) => l.endsWith(' re f')).map(firstNumber)).toEqual(
      rotated.filter((l) => l.endsWith(' re f')).map(firstNumber),
    );
  });

  it('carries Headway quietly, and the business loudly', () => {
    const said = words(CAFE);
    expect(said.filter((w) => w === 'Headway')).toHaveLength(4); // once per face
    expect(said.filter((w) => w === 'CORNER CAFE')).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// The QR
// ---------------------------------------------------------------------------

describe('the QR', () => {
  /** One face's worth of modules. The four faces sit far enough apart to split. */
  function oneFace(input: TentInput): number[][] {
    const all = rects(ops(input), BLACK);
    const reach = 45 * PT_PER_MM;
    const first = all[0]!;
    return all.filter(
      (r) => Math.abs(r[0]! - first[0]!) < reach && Math.abs(r[1]! - first[1]!) < reach,
    );
  }

  it('is drawn as the exact module grid for this client’s own feedback page', () => {
    const matrix = qrMatrix(CAFE.feedbackUrl);
    const black = oneFace(CAFE);
    expect(black.length).toBeGreaterThan(20);

    const drawn = moduleGrid(black);

    let dark = 0;
    for (let y = 0; y < matrix.size; y += 1) {
      for (let x = 0; x < matrix.size; x += 1) {
        if (!matrix.dark(x, y)) continue;
        dark += 1;
        expect(drawn.has(`${x},${y}`), `module ${x},${y} is missing from the drawn QR`).toBe(true);
      }
    }
    expect(drawn.size).toBe(dark);
  });

  it('is the same code on all four faces of the sheet', () => {
    // One business, one gateway, one code. Two tents printed together are two
    // copies of one address, not two addresses that happen to agree.
    const all = rects(ops(CAFE), BLACK);
    const reach = 45 * PT_PER_MM;
    const faces: number[][][] = [];
    for (const r of all) {
      const near = faces.find(
        (f) => Math.abs(f[0]![0]! - r[0]!) < reach && Math.abs(f[0]![1]! - r[1]!) < reach,
      );
      if (near) near.push(r);
      else faces.push([r]);
    }
    expect(faces).toHaveLength(4);

    // Every face resolves to the identical module grid. Compared as modules
    // rather than as coordinates, because the four faces sit at four different
    // offsets and the content stream rounds to a thousandth of a point.
    const shape = (rs: number[][]) => [...moduleGrid(rs)].sort().join('|');
    expect(new Set(faces.map(shape)).size).toBe(1);
  });

  it('is big enough to scan off a table, with a real quiet zone around it', () => {
    for (const input of [CAFE, CLINIC, LONG]) {
      const black = oneFace(input);
      const unit = black[0]![3]! / PT_PER_MM;
      const left = Math.min(...black.map((r) => r[0]!)) / PT_PER_MM;
      const right = Math.max(...black.map((r) => r[0]! + r[2]!)) / PT_PER_MM;
      // A module a phone camera can resolve on paper, and a code readable from
      // across a table rather than from arm's length.
      expect(unit, input.businessName).toBeGreaterThan(0.45);
      expect(right - left, input.businessName).toBeGreaterThan(30);
      expect(right - left, input.businessName).toBeLessThanOrEqual(TENT.qrModulesMm + 0.01);

      // The quiet zone is the cream panel around it, and the specification
      // asks for four modules of it on every side.
      const panelEdge = (TENT.qrPanelMm - (right - left)) / 2;
      expect(panelEdge, input.businessName).toBeGreaterThanOrEqual(4 * unit - 0.001);
    }
  });
});

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

describe('the PDF', () => {
  const bytes = renderTentSheet(CAFE);
  const body = text(bytes);

  it('is a PDF that a reader will open', () => {
    expect(body.startsWith('%PDF-1.4')).toBe(true);
    expect(body.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(body).toContain('xref');
    expect(body).toContain('trailer');
  });

  it('is one page, at A4 in points', () => {
    expect(body).toContain('/Count 1');
    expect((body.match(/\/Type \/Page[^s]/g) ?? []).length).toBe(1);
    const media = body.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
    expect(media).not.toBeNull();
    expect(Number(media![1])).toBeCloseTo(210 * PT_PER_MM, 2); // 595.276
    expect(Number(media![2])).toBeCloseTo(297 * PT_PER_MM, 2); // 841.89
  });

  it('embeds no fonts and needs none, so it opens the same everywhere', () => {
    for (const face of ['/Helvetica', '/Helvetica-Bold', '/Times-Italic']) {
      expect(body).toContain(`/BaseFont ${face}`);
    }
    expect(body).not.toContain('/FontFile');
  });

  it('points every byte offset in its cross-reference table at a real object', () => {
    const table = body.slice(
      body.lastIndexOf(String.fromCharCode(10) + 'xref' + String.fromCharCode(10)),
    );
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets.length).toBeGreaterThan(4);
    for (const offset of offsets) {
      expect(body.slice(offset)).toMatch(/^\d+ 0 obj/);
    }
    const start = Number(body.match(/startxref\n(\d+)/)![1]);
    expect(body.slice(start, start + 4)).toBe('xref');
  });

  it('is byte-for-byte reproducible, so the same card is the same file', () => {
    expect(text(renderTentSheet(CAFE))).toBe(body);
  });

  it('measures type with the real font metrics, so centred lines are centred', () => {
    // A sanity check on the width tables themselves: everything centred on the
    // sheet depends on them, and there is no embedded font to fall back on.
    const helvetica = 722 + 556 + 222 + 222 + 556; // H e l l o, from Adobe's AFM
    expect(textWidthMm('Hello', 'regular', 10)).toBeCloseTo(
      ((helvetica / 1000) * 10) / PT_PER_MM,
      6,
    );
    const times = 722 + 444 + 278 + 278 + 500; // the same word, Times-Italic
    expect(textWidthMm('Hello', 'serifItalic', 10)).toBeCloseTo(
      ((times / 1000) * 10) / PT_PER_MM,
      6,
    );
  });
});

function kind(op: string): string {
  return op.split(' ').slice(-1)[0] ?? '';
}
function firstNumber(op: string): number {
  return Number(op.split(' ')[0]);
}
/**
 * The drawn rectangles of one QR, back as the set of dark modules.
 *
 * The sheet draws each row as merged horizontal runs, so this reverses that:
 * one module is the height of any run, and every run contributes its own width
 * in modules. Comparing grids rather than coordinates is what lets four faces
 * at four different offsets be checked against each other, and against what
 * the encoder produced.
 */
function moduleGrid(black: number[][]): Set<string> {
  const unit = black[0]![3]!;
  const originX = Math.min(...black.map((r) => r[0]!));
  const originY = Math.max(...black.map((r) => r[1]! + r[3]!));
  const grid = new Set<string>();
  for (const [x, y, w, h] of black) {
    if (Math.abs(h! - unit) > 0.01) continue;
    const row = Math.round((originY - (y! + h!)) / unit);
    const from = Math.round((x! - originX) / unit);
    for (let i = 0; i < Math.round(w! / unit); i += 1) grid.add(`${from + i},${row}`);
  }
  return grid;
}

// ---------------------------------------------------------------------------
// THE OWNER'S DOOR ONTO IT
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WHERE THIS SHEET IS OFFERED
// ---------------------------------------------------------------------------

describe('the generated tent is an operator print surface', () => {
  const ROOT = resolvePath(__dirname, '..');
  const read = (...parts: string[]) => readFileSync(joinPath(ROOT, ...parts), 'utf8');
  const route = read('src', 'app', '(print)', 'print', 'tent', '[clientId]', 'route.ts');
  const operator = read('src', 'app', '(app)', 'clients', '[id]', 'qr', 'page.tsx');
  const ownerKit = read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx');

  it('is reachable from the operator console', () => {
    expect(operator).toContain('const tentHref = `/print/tent/${id}`');
  });

  it('serves the same bytes inline or as a download', () => {
    expect(route).toContain("searchParams.get('download') === '1'");
    expect(route).toContain("`${download ? 'attachment' : 'inline'}; filename=");
  });

  it('is operator-only, not merely tenant-scoped (M37)', () => {
    // It used to be `tenantGateFor(clientId, 'MEMBER')`, which a business owner
    // passes — so an owner with the URL could pull their own sheet. A layout
    // does not wrap a route handler, so the requireOperator() in the group
    // layout never ran here. `printGate` is that check, in the handler.
    expect(route).toContain('await printGate(clientId)');
    expect(route).not.toContain("tenantGateFor(clientId, 'MEMBER')");
    expect(route).toMatch(/if \(!gate\.ok\) return new NextResponse\('Not found', \{ status: 404 \}\)/);
  });

  it('is NOT what the owner’s print kit offers', () => {
    // The owner's Print kit serves the two approved PDF masters, byte for byte.
    // A generated third design on the same page would be a format nobody
    // signed off — see tests/m29.print-kit-masters.test.ts.
    expect(ownerKit).not.toContain('/print/tent/');
    expect(ownerKit).not.toContain('renderTentSheet');
  });
});
