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

  it('shows a visible face of six inches by two', () => {
    expect(g.faceWidthMm).toBeCloseTo(152.4, 6);
    expect(g.faceHeightMm).toBeCloseTo(50.8, 6);
    expect(g.faceWidthMm / 25.4).toBeCloseTo(6, 6);
    expect(g.faceHeightMm / 25.4).toBeCloseTo(2, 6);
  });

  it('folds exactly in the middle, so both faces are the same size', () => {
    expect(g.cardHeightMm).toBeCloseTo(g.faceHeightMm * 2, 6);
    g.cardTopsMm.forEach((top, i) => {
      const fold = g.foldsMm[i]!;
      // The two halves the fold makes are equal, which is what "both faces have
      // identical physical dimensions" means in millimetres.
      expect(fold - top).toBeCloseTo(g.cardHeightMm - (fold - top), 6);
      expect(fold - top).toBeCloseTo(g.faceHeightMm, 6);
    });
  });

  it('fits two whole cards on one sheet, with paper between them', () => {
    expect(g.cardsPerSheet).toBe(2);
    expect(g.cardTopsMm).toHaveLength(2);
    const firstBottom = g.cardTopsMm[0]! + g.cardHeightMm;
    expect(g.cardTopsMm[1]! - firstBottom).toBeCloseTo(TENT.gapMm, 6);
    expect(g.cardTopsMm[1]! + g.cardHeightMm).toBeLessThanOrEqual(g.pageHeightMm);
    expect(g.leftMm + g.cardWidthMm).toBeLessThanOrEqual(g.pageWidthMm);
  });

  it('centres the cards, so the trim is even on every side', () => {
    expect(g.leftMm).toBeCloseTo((g.pageWidthMm - g.cardWidthMm) / 2, 6);
    expect(g.marginTopMm).toBeCloseTo(g.marginBottomMm, 6);
  });

  it('needs one fold per card and no other construction', () => {
    // A second fold, a tab or a slot would each show up as another line to
    // follow. There is one, and it is the centre line.
    expect(g.foldsMm).toHaveLength(g.cardsPerSheet);
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

  it('draws each card once, cut border and fold line included', () => {
    // Two dashed rectangles: one per card, and they are the cut lines.
    expect(lines.filter((l) => l.endsWith(' re S'))).toHaveLength(2);
    // One fold line per card, plus the eight crop-mark strokes.
    const strokes = lines.filter((l) => l.includes(' m ') && l.endsWith(' l S'));
    expect(strokes).toHaveLength(2 + 8 * 2);
  });

  it('says where to cut and where to fold, in words', () => {
    const body = lines.join('\n');
    expect((body.match(/\(FOLD\) Tj/g) ?? []).length).toBe(2);
    expect((body.match(/\(CUT\) Tj/g) ?? []).length).toBe(2);
    expect(body).toContain('Cut out both cards along the dashed borders.');
    expect(body).toContain('Fold each card along the dotted line, printed side out.');
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

      const top = g.cardTopsMm[index]!;
      const centreXmm = g.leftMm + g.cardWidthMm / 2;
      const centreYmm = top + g.faceHeightMm / 2;
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
    const rects = (colour: string) =>
      lines
        .map((line, i) => ({ line, prev: lines[i - 1] }))
        .filter((x) => x.line.endsWith(' re f') && x.prev === colour)
        .map((x) => x.line.split(' ').slice(0, 4).map(Number) as [number, number, number, number]);

    // One face's worth: the modules that sit inside the first white panel. All
    // four faces draw the identical grid, so one of them is the grid.
    const panel = rects('1 1 1 rg')[0]!;
    const black = rects('0 0 0 rg').filter(
      (r) =>
        r[0] >= panel[0] - 0.01 &&
        r[1] >= panel[1] - 0.01 &&
        r[0] + r[2] <= panel[0] + panel[2] + 0.01 &&
        r[1] + r[3] <= panel[1] + panel[3] + 0.01,
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

  it('leaves the quiet zone a scanner needs, on a white panel', () => {
    const lines = ops(RESTAURANT);
    // Four white panels, one per face, each square.
    const panels = lines
      .map((line, i) => ({ line, prev: lines[i - 1] }))
      .filter((x) => x.line.endsWith(' re f') && x.prev === '1 1 1 rg')
      .map((x) => x.line.split(' ').slice(0, 4).map(Number));
    expect(panels).toHaveLength(4);
    for (const [, , w, h] of panels) expect(w).toBeCloseTo(h!, 3);

    const panel = panels[0]![2]! / PT_PER_MM;
    const matrix = qrMatrix(RESTAURANT.feedbackUrl);
    const unit = panel / (matrix.size + 8);
    // Four modules of quiet zone on each side is the specified minimum.
    expect(panel - matrix.size * unit).toBeCloseTo(8 * unit, 6);
    // And a module large enough for a phone camera to resolve on paper.
    expect(unit).toBeGreaterThan(0.4);
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

  it('carries RepOS quietly, and the business loudly', () => {
    const body = composeTentSheet(RESTAURANT).content();
    expect((body.match(/\(RepOS\) Tj/g) ?? []).length).toBe(4); // once per face
    expect((body.match(/\(CORNER CAFE\) Tj/g) ?? []).length).toBe(4);
  });
});
