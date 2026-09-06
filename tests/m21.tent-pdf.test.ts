import { readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TENT,
  composeTentSheet,
  qrMatrix,
  renderTentSheet,
  tentGeometry,
  type TentInput,
} from '@/lib/kit/tent';
import { PT_PER_MM, textWidthMm } from '@/lib/kit/pdf';

/**
 * THE PRINTED TENT, CHECKED AS AN OBJECT (launch pass).
 *
 * The kit is the only part of RepOS that leaves the screen, and a card is
 * permanent once it is printed. A hundred cards with a clipped line or a QR
 * that will not scan is not a bug report, it is a hundred pieces of paper.
 *
 * So the geometry is asserted rather than previewed: A4 to the millimetre, a
 * visible face of exactly six inches by two, both faces the same object, one
 * fold at the exact centre of each card, and nothing — no rule, no rectangle,
 * no line of type — outside the paper.
 */

const RESTAURANT: TentInput = {
  businessName: 'Corner Cafe',
  headline: 'How was the food today?',
  subhead: 'Scan and tell us honestly — good or bad.',
  qrCaption: 'Scan to tell us how it was',
  thankYou: 'Thank you — this goes straight to the kitchen team.',
  placement: 'On each table, and one at the billing counter.',
  feedbackUrl: 'https://repos.example.com/feedback/Ab3xY9zQmN2pLr7TvW1kJd',
  brandPrimary: '#1F3A5F',
  brandSecondary: '#C9A227',
};

const GYM: TentInput = {
  ...RESTAURANT,
  businessName: 'Gold Gym',
  headline: 'Is the gym working for you?',
  subhead: 'Scan and tell us honestly — it takes a minute.',
  thankYou: 'Thank you — the floor team will be glad to read this.',
  placement: 'At the front desk, beside the sign-in register.',
};

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

describe('the physical card', () => {
  const g = tentGeometry();

  it('is A4, exactly', () => {
    expect(g.pageWidthMm).toBe(210);
    expect(g.pageHeightMm).toBe(297);
  });

  it('shows a portrait face at 1 : 1.40', () => {
    // The ratio is the design. The size is what falls out of A4 once two tents
    // and a printable margin are subtracted, and it is checked below rather
    // than asserted as a number somebody chose.
    expect(g.faceHeightMm / g.faceWidthMm).toBeCloseTo(1.4, 6);
    expect(g.faceRatio).toBeCloseTo(1.4, 6);
    expect(g.faceHeightMm).toBeGreaterThan(g.faceWidthMm);
    expect(g.faceWidthMm).toBeCloseTo(88, 6);
    expect(g.faceHeightMm).toBeCloseTo(123.2, 6);
  });

  it('is the largest face that fits, not an arbitrary one', () => {
    // Width is the binding constraint: two faces and a gutter have to fit
    // across 210 mm, and the leftover is the trim. Prove there is no room for
    // a materially bigger card by showing the margins are already small.
    const across = g.faceWidthMm * g.cardsPerSheet + TENT.gapMm;
    expect(across).toBeLessThanOrEqual(g.pageWidthMm);
    expect(g.pageWidthMm - across).toBeLessThan(30); // under 15 mm of trim a side
    // And that it is genuinely bigger than the alternative arrangement: two
    // tents stacked would be FOUR faces deep, which caps the face far lower.
    const stackedMax = (g.pageHeightMm - 40) / 4 / 1.4;
    expect(g.faceWidthMm).toBeGreaterThan(stackedMax * 1.8);
  });

  it('folds exactly in the middle, so both faces are the same size', () => {
    expect(g.cardHeightMm).toBeCloseTo(g.faceHeightMm * 2, 6);
    const above = g.foldMm - g.cardTopMm;
    const below = g.cardTopMm + g.cardHeightMm - g.foldMm;
    // The two halves the fold makes are equal, which is what "both faces have
    // identical physical dimensions" means in millimetres.
    expect(above).toBeCloseTo(below, 6);
    expect(above).toBeCloseTo(g.faceHeightMm, 6);
  });

  it('fits two whole tents on one sheet, side by side, with paper between them', () => {
    expect(g.cardsPerSheet).toBe(2);
    expect(g.cardLeftsMm).toHaveLength(2);
    const firstRight = g.cardLeftsMm[0]! + g.cardWidthMm;
    expect(g.cardLeftsMm[1]! - firstRight).toBeCloseTo(TENT.gapMm, 6);
    expect(g.cardLeftsMm[1]! + g.cardWidthMm).toBeLessThanOrEqual(g.pageWidthMm);
    expect(g.cardTopMm + g.cardHeightMm).toBeLessThanOrEqual(g.pageHeightMm);
  });

  it('centres the pair, and leaves room to print above and below', () => {
    const across = g.cardWidthMm * g.cardsPerSheet + TENT.gapMm;
    expect(g.marginLeftMm).toBeCloseTo((g.pageWidthMm - across) / 2, 6);
    expect(g.marginTopMm).toBeGreaterThanOrEqual(10);
    expect(g.marginBottomMm).toBeGreaterThanOrEqual(10);
  });

  it('needs one fold per tent and no other construction', () => {
    // A second fold, a tab or a slot would each show up as another line to
    // follow. There is one, at the same height for both tents, and it is the
    // centre line of each.
    expect(typeof g.foldMm).toBe('number');
    expect(g.foldMm).toBeCloseTo(g.cardTopMm + g.cardHeightMm / 2, 6);
  });
});

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

describe('the PDF', () => {
  const bytes = renderTentSheet(RESTAURANT);
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

  it('points every byte offset in its cross-reference table at a real object', () => {
    // `startxref` contains the word too, so look for the table's own line.
    const table = body.slice(body.lastIndexOf(String.fromCharCode(10) + 'xref' + String.fromCharCode(10)));
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets.length).toBeGreaterThan(4);
    for (const offset of offsets) {
      expect(body.slice(offset)).toMatch(/^\d+ 0 obj/);
    }
    const start = Number(body.match(/startxref\n(\d+)/)![1]);
    expect(body.slice(start, start + 4)).toBe('xref');
  });

  it('is byte-for-byte reproducible, so the same card is the same file', () => {
    expect(text(renderTentSheet(RESTAURANT))).toBe(body);
  });
});

// ---------------------------------------------------------------------------
// What is drawn
// ---------------------------------------------------------------------------

/** The drawing operators, in order, as the page emitted them. */
function ops(input: TentInput): string[] {
  return composeTentSheet(input).content().split('\n');
}

describe('what is on the sheet', () => {
  const lines = ops(RESTAURANT);
  const g = tentGeometry();

  it('gives the card a curved base rather than a straight band', () => {
    // The shaped edge is the difference between a premium tabletop piece and a
    // folded rectangle, so it is a property, not a flourish: a filled curve per
    // face, and a gold curve stroked parallel above it.
    const curves = lines.filter((l) => l.endsWith(' c'));
    // Three per face across four faces: the filled base, the gold line stroked
    // parallel above it, and the rising path of the Headway mark on the base.
    expect(curves).toHaveLength(12);
    // The base and its gold line are the same shape at different heights, so
    // their control points differ only in y.
    const xs = (op: string) => op.split(' ').filter((_, i) => i % 2 === 0);
    expect(xs(curves[0]!)).toEqual(xs(curves[1]!));
    expect(curves[0]).not.toBe(curves[1]);
  });

  it('draws each tent once, cut border and fold line included', () => {
    // Six stroked rectangles: the cut border round each of the two tents, and
    // the gold frame round each of the four codes.
    expect(lines.filter((l) => l.endsWith(' re S'))).toHaveLength(2 + 4);
    // Per tent: one fold line and eight crop-mark strokes. Plus the three
    // segments of the single dashed line down the gutter, which is the cut
    // that separates the pair.
    const strokes = lines.filter((l) => l.includes(' m ') && l.endsWith(' l S'));
    expect(strokes).toHaveLength(2 * (1 + 8) + 3);
  });

  it('says where to cut and where to fold, in words', () => {
    // Once each, in the gutter. The gutter IS the cut that separates the two
    // tents and the fold is at the same height on both, so one of each says
    // everything — and set in the outer margins the words put ink 4.2 mm from
    // the edge of the paper, inside the unprintable border of most printers.
    const body = lines.join('\n');
    expect((body.match(/\(FOLD\) Tj/g) ?? []).length).toBe(1);
    expect((body.match(/\(CUT\) Tj/g) ?? []).length).toBe(1);
    expect(body).toContain('Cut out both cards along the dashed borders.');
    expect(body).toContain('Fold each along the dotted line, printed side out.');
  });

  it('tells the printer not to scale it, which is the one way to get the size wrong', () => {
    const body = lines.join('\n');
    expect(body).toContain('Print on A4 at 100% \\(Actual size\\). Do not use "Fit to page".');
  });

  it('warns that one half is printed upside down, so it is not mistaken for a fault', () => {
    expect(lines.join('\n')).toContain('prints upside down on purpose');
  });

  it('rotates exactly one half of each card, by exactly half a turn about its centre', () => {
    const rotations = lines.filter((l) => l.endsWith(' cm'));
    expect(rotations).toHaveLength(2);

    rotations.forEach((op, index) => {
      const [a, b, c, d, e, f] = op.replace(' cm', '').split(' ').map(Number);
      // A point reflection: p -> 2·centre - p. That is a 180-degree turn, and
      // nothing else, so the face lands back in its own box the other way up.
      expect([a, b, c, d]).toEqual([-1, 0, 0, -1]);

      const centreXmm = g.cardLeftsMm[index]! + g.cardWidthMm / 2;
      const centreYmm = g.cardTopMm + g.faceHeightMm / 2;
      expect(e!).toBeCloseTo(2 * centreXmm * PT_PER_MM, 2);
      expect(f!).toBeCloseTo(2 * (g.pageHeightMm - centreYmm) * PT_PER_MM, 2);
    });
  });

  it('draws the same face on both sides of the fold', () => {
    // The rotated half is emitted inside q…Q; the upright half follows it. Same
    // operators, same order, same horizontal positions — the only difference is
    // how far down the page it sits, and the rotation applied to one of them.
    const start = lines.indexOf('q');
    const end = lines.indexOf('Q');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const rotated = lines.slice(start + 1, end).filter((l) => !l.endsWith(' cm'));
    const upright = lines.slice(end + 1, end + 1 + rotated.length);

    expect(upright).toHaveLength(rotated.length);
    // Same kind of operator, in the same order.
    expect(upright.map(kind)).toEqual(rotated.map(kind));
    // Same words.
    expect(upright.filter((l) => l.endsWith(' Tj'))).toEqual(
      rotated.filter((l) => l.endsWith(' Tj')),
    );
    // Same horizontal geometry: x is untouched by the vertical offset.
    expect(upright.filter((l) => l.endsWith(' re f')).map(firstNumber)).toEqual(
      rotated.filter((l) => l.endsWith(' re f')).map(firstNumber),
    );
  });
});

describe('the tent is two identical faces joined at the fold', () => {
  const g = tentGeometry();

  it('prints four faces: two per tent, two tents', () => {
    const lines = ops(RESTAURANT);
    // The cream ground of a face, at the face's exact size.
    const cream = lines
      .map((line, i) => ({ line, prev: lines[i - 1] }))
      .filter((x) => x.line.endsWith(' re f') && x.prev === '0.98 0.969 0.937 rg')
      .map((x) => x.line.split(' ').slice(0, 4).map(Number));
    expect(cream).toHaveLength(4);
    for (const [, , w, h] of cream) {
      expect(w! / PT_PER_MM).toBeCloseTo(g.faceWidthMm, 3);
      expect(h! / PT_PER_MM).toBeCloseTo(g.faceHeightMm, 3);
    }
    // Two distinct x positions and two distinct y positions: a 2 x 2 grid of
    // faces, which is two tents side by side.
    expect(new Set(cream.map((r) => Math.round(r[0]!))).size).toBe(2);
    expect(new Set(cream.map((r) => Math.round(r[1]!))).size).toBe(2);
  });

  it('puts a code on both faces of both tents', () => {
    const lines = ops(RESTAURANT);
    const black = lines
      .map((line, i) => ({ line, prev: lines[i - 1] }))
      .filter((x) => x.line.endsWith(' re f') && x.prev === '0 0 0 rg')
      .map((x) => x.line.split(' ').slice(0, 4).map(Number));
    // Cluster by position: four codes, one per face.
    const clusters: Array<{ x: number; y: number }> = [];
    for (const [x, y] of black) {
      const near = clusters.find(
        (c) => Math.abs(c.x - x!) < 45 * PT_PER_MM && Math.abs(c.y - y!) < 45 * PT_PER_MM,
      );
      if (!near) clusters.push({ x: x!, y: y! });
    }
    expect(clusters).toHaveLength(4);
  });

  it('never lets a long business name print past the edge of the card', () => {
    // It did. "The Very Long Restaurant And Banqueting Company" is set in
    // tracked capitals, `fit` measured it without the tracking, and 116 mm of
    // type went onto an 88 mm card and 2.2 mm off the sheet. Ink outside the
    // page is the one fault a rendered preview cannot show you.
    const page = composeTentSheet({
      ...RESTAURANT,
      businessName: 'The Very Long Restaurant And Banqueting Company Limited',
    });
    const ink = page.bounds()!;
    expect(ink.leftMm).toBeGreaterThanOrEqual(0);
    expect(ink.rightMm).toBeLessThanOrEqual(page.widthMm);
    // And it stays inside the card, not merely inside the page.
    expect(ink.leftMm).toBeGreaterThanOrEqual(g.cardLeftsMm[0]! - 6);
  });

  it('keeps every drop of ink clear of the printer’s own border', () => {
    for (const input of [RESTAURANT, GYM]) {
      const page = composeTentSheet(input);
      const ink = page.bounds()!;
      const smallest = Math.min(
        ink.leftMm,
        ink.topMm,
        page.widthMm - ink.rightMm,
        page.heightMm - ink.bottomMm,
      );
      expect(smallest).toBeGreaterThanOrEqual(5);
    }
  });
});

function kind(op: string): string {
  return op.split(' ').slice(-1)[0] ?? '';
}
function firstNumber(op: string): number {
  return Number(op.split(' ')[0]);
}

// ---------------------------------------------------------------------------
// Nothing runs off the paper
// ---------------------------------------------------------------------------

describe('nothing is clipped', () => {
  const cases: Array<[string, TentInput]> = [
    ['a restaurant', RESTAURANT],
    ['a gym', GYM],
    [
      'a business with a long name and a long question',
      {
        ...RESTAURANT,
        businessName: 'The Very Long Restaurant And Banqueting Company',
        headline: 'How did the whole experience go for you today?',
        subhead: 'Scan and tell us honestly — good or bad. It takes under a minute.',
        thankYou: 'Thank you — this goes straight to the kitchen and the floor team.',
      },
    ],
  ];

  for (const [label, input] of cases) {
    it(`keeps every mark on the page for ${label}`, () => {
      const page = composeTentSheet(input);
      const ink = page.bounds();
      expect(ink).not.toBeNull();
      expect(ink!.leftMm).toBeGreaterThanOrEqual(0);
      expect(ink!.topMm).toBeGreaterThanOrEqual(0);
      expect(ink!.rightMm).toBeLessThanOrEqual(page.widthMm);
      expect(ink!.bottomMm).toBeLessThanOrEqual(page.heightMm);
    });

    it(`keeps the instructions clear of the printer's own margin for ${label}`, () => {
      // Consumer printers cannot print the outermost few millimetres. The cards
      // are nowhere near the edge; this checks the trim-margin text is not.
      const ink = composeTentSheet(input).bounds()!;
      expect(ink.topMm).toBeGreaterThanOrEqual(5);
      expect(ink.bottomMm).toBeLessThanOrEqual(297 - 5);
    });
  }

  it('shrinks a question that will not fit rather than letting it run over', () => {
    const short = composeTentSheet(RESTAURANT).content();
    const long = composeTentSheet({
      ...RESTAURANT,
      headline: 'How did absolutely everything go for you here today, honestly?',
    }).content();
    const sizeOf = (body: string) =>
      Number(body.match(/\/F2 ([\d.]+) Tf\n0 Tc\n[\d.]+ [\d.]+ Td\n\(How/)?.[1] ?? 0);
    expect(sizeOf(short)).toBeGreaterThan(0);
    expect(sizeOf(long)).toBeLessThan(sizeOf(short));
  });
});

// ---------------------------------------------------------------------------
// The QR
// ---------------------------------------------------------------------------

describe('the QR', () => {
  it('is drawn as the exact module grid for this client’s own feedback page', () => {
    const matrix = qrMatrix(RESTAURANT.feedbackUrl);
    const lines = ops(RESTAURANT);

    // Every black rectangle inside a card is a run of QR modules. Rebuild the
    // grid from what was drawn and compare it with what the encoder produced:
    // this is the difference between "a QR-shaped picture" and "this URL".
    const all = lines
      .map((line, i) => ({ line, prev: lines[i - 1] }))
      .filter((x) => x.line.endsWith(' re f') && x.prev === '0 0 0 rg')
      .map((x) => x.line.split(' ').slice(0, 4).map(Number) as [number, number, number, number]);

    // One face's worth. The four faces draw the identical grid and sit at least
    // 50mm apart, so everything within one QR's reach of the first module
    // belongs to the first QR.
    const reach = 40 * PT_PER_MM;
    const first = all[0]!;
    const black = all.filter(
      (r) => Math.abs(r[0] - first[0]) < reach && Math.abs(r[1] - first[1]) < reach,
    );
    expect(black.length).toBeGreaterThan(20);

    const unit = black[0]![3];
    const originX = Math.min(...black.map((r) => r[0]));
    const originY = Math.max(...black.map((r) => r[1] + r[3]));

    const drawn = new Set<string>();
    for (const [x, y, w, h] of black) {
      if (Math.abs(h - unit) > 0.01) continue;
      const row = Math.round((originY - (y + h)) / unit);
      const from = Math.round((x - originX) / unit);
      const count = Math.round(w / unit);
      for (let i = 0; i < count; i += 1) drawn.add(`${from + i},${row}`);
    }

    // One QR per face, four faces — every face draws the identical grid, so
    // the reconstructed set is that one grid.
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

  it('is big enough to scan off a table, with room around it', () => {
    const lines = ops(RESTAURANT);
    const all = lines
      .map((line, i) => ({ line, prev: lines[i - 1] }))
      .filter((x) => x.line.endsWith(' re f') && x.prev === '0 0 0 rg')
      .map((x) => x.line.split(' ').slice(0, 4).map(Number));
    const reach = 40 * PT_PER_MM;
    const first = all[0]!;
    const black = all.filter(
      (r) => Math.abs(r[0]! - first[0]!) < reach && Math.abs(r[1]! - first[1]!) < reach,
    );

    const unit = black[0]![3]! / PT_PER_MM;
    const left = Math.min(...black.map((r) => r[0]!)) / PT_PER_MM;
    const right = Math.max(...black.map((r) => r[0]! + r[2]!)) / PT_PER_MM;
    // A module a phone camera can resolve on paper, and a code big enough to
    // read from across a table rather than from arm's length.
    expect(unit).toBeGreaterThan(0.45);
    expect(right - left).toBeGreaterThan(24);
    // The quiet zone is the white panel around it: four modules of clear paper
    // on the side nearest the edge of the card it sits on.
    const g = tentGeometry();
    const nearestCardLeft = g.cardLeftsMm.reduce((best, x) =>
      Math.abs(left - x) < Math.abs(left - best) ? x : best,
    );
    expect(left - nearestCardLeft).toBeGreaterThan(4 * unit);
  });
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

describe('the wording stays the vertical’s own', () => {
  it('prints the restaurant question, not a generic one', () => {
    const body = composeTentSheet(RESTAURANT).content();
    expect(body).toContain('(How was the food today?) Tj');
    expect(body).toContain('good or bad');
    expect(body).toContain('kitchen team');
    expect(body).toContain('On each table, and one at the billing counter.');
    expect(body).not.toContain('How was your experience?');
  });

  it('prints the gym question and the gym’s own placement', () => {
    const body = composeTentSheet(GYM).content();
    expect(body).toContain('(Is the gym working for you?) Tj');
    expect(body).toContain('it takes a minute');
    expect(body).toContain('At the front desk, beside the sign-in register.');
    expect(body).not.toContain('food');
  });

  it('sets an em dash as an em dash, not as a question mark', () => {
    // WinAnsi 0x97. The approved scan line contains one, and a card that read
    // "honestly ? good or bad" would be a visible defect on every table.
    expect(composeTentSheet(RESTAURANT).content()).toContain('honestly \\227 good or bad');
  });

  it('measures type with the real font metrics, so centred lines are centred', () => {
    // A sanity check on the width table itself: Helvetica's "Hello" is a known
    // width in ems, and everything centred on the sheet depends on it.
    const em = 722 + 556 + 222 + 222 + 556; // H e l l o, from Adobe's AFM
    expect(textWidthMm('Hello', 'regular', 10)).toBeCloseTo((em / 1000) * 10 / PT_PER_MM, 6);
  });

  it('carries Headway quietly, and the business loudly', () => {
    const body = composeTentSheet(RESTAURANT).content();
    expect((body.match(/\(Headway\) Tj/g) ?? []).length).toBe(4); // once per face
    expect((body.match(/\(CORNER CAFE\) Tj/g) ?? []).length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// THE OWNER'S DOOR ONTO IT (M21)
// ---------------------------------------------------------------------------

describe('the print kit is a section of the owner’s workspace, not an operator URL', () => {
  const ROOT = resolvePath(__dirname, '..');
  const read = (...parts: string[]) => readFileSync(joinPath(ROOT, ...parts), 'utf8');
  const page = read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx');
  const nav = read('src', 'components', 'portal', 'workspace.tsx');
  const route = read('src', 'app', '(print)', 'print', 'tent', '[clientId]', 'route.ts');

  it('has a door of its own in the workspace navigation', () => {
    expect(nav).toContain("{ slug: 'kit', label: 'Print kit', extra: true }");
  });

  it('offers both a preview and a download, of the same bytes', () => {
    expect(page).toContain('src={href}');
    expect(page).toContain('href={`${href}?download=1`}');
    expect(page).toContain('Download the PDF');
    expect(route).toContain("searchParams.get('download') === '1'");
    expect(route).toContain("`${download ? 'attachment' : 'inline'}; filename=");
  });

  it('shows the four steps, in order, in the owner’s own words', () => {
    const words = [...page.matchAll(/word: '([^']+)'/g)].map((m) => m[1]);
    expect(words).toEqual(['Print', 'Cut', 'Fold', 'Place']);
    expect(page).toMatch(/turn off Fit to Page/i);
    expect(page).toMatch(/no glue, no tape, no holder/i);
  });

  it('refuses to offer a card when there is no address for the QR to open', () => {
    expect(page).toContain('const ready = Boolean(view.content.feedbackUrl)');
    expect(page).toContain('view.addressError');
  });

  it('repeats the one rule about who is offered the card', () => {
    // The QR is never a reward for a good visit. It is offered to everyone the
    // same way, which is the only thing that makes the answers worth reading.
    expect(page).toMatch(/Offer it to everyone, the same way/);
  });

  it('is gated like every other per-client surface', () => {
    expect(page).toContain("await tenantGateFor(clientId, 'MEMBER')");
    expect(route).toContain("await tenantGateFor(clientId, 'MEMBER')");
  });
});
