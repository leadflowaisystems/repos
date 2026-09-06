import QRCode from 'qrcode';
import { buildPdf, PdfPage, textWidthMm, type PdfFont } from './pdf';

/**
 * THE TABLE TENT: one A4 sheet, two cards, one fold each.
 *
 * The physical experience this file exists to produce, in full:
 *
 *   print → cut out the two cards → fold each one down the middle → stand it up
 *
 * That is the entire construction. No tabs, no slots, no reverse folds, no
 * glue, no acrylic holder, no separate stand. A business that owns a printer
 * and a pair of scissors owns the whole kit, which is the point: the previous
 * print kit produced a flat A5 panel that had nothing to stand it up with, so
 * in practice it was propped against a napkin holder or it lay on the table
 * face down.
 *
 * WHY A SINGLE FOLD MAKES A STABLE OBJECT. Folded down the middle with the
 * printed side out, the crease becomes the ridge and the two halves lean apart
 * into a Λ. The base it stands on is as long as the card (152mm) and the thing
 * is only ~44mm tall, so it is far wider than it is high and does not topple.
 * Ordinary 80gsm paper is enough; anything heavier is sturdier still.
 *
 * WHY ONE HALF IS PRINTED UPSIDE DOWN. This is not a bug and it is the one
 * thing about the sheet that looks wrong before it is folded. The half above
 * the fold ends up hanging down the FAR side of the ridge, which inverts it.
 * Printing that half pre-rotated is what makes both faces read the right way
 * up on the finished tent — and it is why the sheet says so, in words, next to
 * the fold line.
 *
 * BOTH FACES ARE THE SAME OBJECT. Identical geometry and identical content, so
 * whichever way the tent is turned the customer sees the same card. The brief
 * allows complementary content; the same card is the better answer, because a
 * customer at a table does not know there is a second side and should not have
 * to.
 */

// ---------------------------------------------------------------------------
// Geometry — stated once, in millimetres, and asserted by the tests
// ---------------------------------------------------------------------------

const INCH = 25.4;

export const TENT = {
  /** True A4. Not "roughly A4": a print shop sets plates from this. */
  pageWidthMm: 210,
  pageHeightMm: 297,
  /** The visible face of the finished tent: 6in × 2in. */
  faceWidthMm: 6 * INCH, // 152.4
  faceHeightMm: 2 * INCH, // 50.8
  /** One card, flat, before folding: two faces stacked. */
  get cardWidthMm() {
    return this.faceWidthMm;
  },
  get cardHeightMm() {
    return this.faceHeightMm * 2;
  }, // 101.6
  /** Blank paper between the two cards, so one cut cannot clip the other. */
  gapMm: 6,
  cardsPerSheet: 2,
} as const;

export type TentGeometry = {
  pageWidthMm: number;
  pageHeightMm: number;
  faceWidthMm: number;
  faceHeightMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  cardsPerSheet: number;
  /** Left edge of both cards. */
  leftMm: number;
  /** Top edge of each card, top-down from the page edge. */
  cardTopsMm: number[];
  /** Where each card is folded — always its own vertical centre. */
  foldsMm: number[];
  marginTopMm: number;
  marginBottomMm: number;
};

/**
 * Where everything sits on the page.
 *
 * Computed rather than written down, so the numbers cannot drift from the
 * constants above, and returned so a test can check the arithmetic instead of
 * trusting a rendered picture.
 */
export function tentGeometry(): TentGeometry {
  const cardHeight = TENT.faceHeightMm * 2;
  const blockHeight = cardHeight * TENT.cardsPerSheet + TENT.gapMm * (TENT.cardsPerSheet - 1);
  const marginTop = (TENT.pageHeightMm - blockHeight) / 2;
  const left = (TENT.pageWidthMm - TENT.faceWidthMm) / 2;

  const cardTops: number[] = [];
  for (let i = 0; i < TENT.cardsPerSheet; i += 1) {
    cardTops.push(marginTop + i * (cardHeight + TENT.gapMm));
  }

  return {
    pageWidthMm: TENT.pageWidthMm,
    pageHeightMm: TENT.pageHeightMm,
    faceWidthMm: TENT.faceWidthMm,
    faceHeightMm: TENT.faceHeightMm,
    cardWidthMm: TENT.faceWidthMm,
    cardHeightMm: cardHeight,
    cardsPerSheet: TENT.cardsPerSheet,
    leftMm: left,
    cardTopsMm: cardTops,
    foldsMm: cardTops.map((top) => top + TENT.faceHeightMm),
    marginTopMm: marginTop,
    marginBottomMm: marginTop,
  };
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type TentInput = {
  businessName: string;
  /** The vertical's own question. From the pack, never invented here. */
  headline: string;
  /** The vertical's own scan line. */
  subhead: string;
  /** The vertical's own thank-you, printed on the base band. */
  thankYou: string;
  /** Where the vertical says the card should sit. Printed in the trim margin. */
  placement: string;
  /** The address the QR encodes: this client's own feedback page. */
  feedbackUrl: string;
  brandPrimary: string;
  brandSecondary: string;
};

const CREAM = '#FBF9F4';
const INK = '#1A1E29';
const MUTED = '#545B6C';
const FAINT = '#B6BDCB';

/** The face, laid out once and drawn twice — the second time upside down. */
function drawFace(page: PdfPage, x: number, y: number, input: TentInput, qr: QrMatrix) {
  const w = TENT.faceWidthMm;
  const h = TENT.faceHeightMm;
  const bandHeight = 9;
  const ruleHeight = 0.7;
  const bandTop = h - bandHeight;
  const contentHeight = bandTop - ruleHeight;

  page.rect(x, y, w, h, CREAM);

  // The base band. It sits on the table, which is why the thank-you goes here:
  // it is the last thing read and the first thing seen from across a room.
  page.rect(x, y + bandTop, w, bandHeight, input.brandPrimary);
  page.rect(x, y + bandTop - ruleHeight, w, ruleHeight, input.brandSecondary);

  // A white panel behind the QR. A QR needs a light quiet zone to scan, and
  // "light" should not be left to whatever the cream prints like on a given
  // printer.
  const panel = Math.min(35, contentHeight - 6);
  const panelX = x + 7;
  const panelY = y + (contentHeight - panel) / 2;
  page.rect(panelX, panelY, panel, panel, '#FFFFFF');
  drawQr(page, panelX, panelY, panel, qr);

  const textLeft = panelX + panel + 5;
  const textRight = x + w - 6.5;
  const textWidth = textRight - textLeft;

  page.text(input.businessName.toUpperCase(), textLeft, y + 12, {
    font: 'bold',
    size: 7,
    colour: input.brandPrimary,
    tracking: 0.9,
  });

  const headline = fit(input.headline, 'bold', [17, 15.5, 14, 12.5, 11], textWidth);
  if (headline.lines.length === 1) {
    page.text(headline.lines[0]!, textLeft, y + 24, {
      font: 'bold',
      size: headline.size,
      colour: INK,
    });
    page.text(input.subhead, textLeft, y + 33.5, { size: 8.5, colour: MUTED });
  } else {
    page.text(headline.lines[0]!, textLeft, y + 21, {
      font: 'bold',
      size: headline.size,
      colour: INK,
    });
    page.text(headline.lines[1]!, textLeft, y + 21 + headline.size * 0.42, {
      font: 'bold',
      size: headline.size,
      colour: INK,
    });
    page.text(input.subhead, textLeft, y + 37, { size: 8, colour: MUTED });
  }

  const baseline = y + bandTop + bandHeight / 2 + 1.1;
  page.text(input.thankYou, x + w / 2, baseline, {
    size: 7.5,
    colour: '#FFFFFF',
    align: 'centre',
  });
  page.text('RepOS', textRight, baseline, {
    size: 6.5,
    colour: input.brandSecondary,
    align: 'right',
  });
}

/**
 * The largest of the offered sizes that fits, wrapping to two lines only if
 * even the smallest will not fit on one.
 *
 * A question is the loudest thing on the card and should stay one line where
 * it can — "How was the food today?" reads as a question at a glance and as a
 * paragraph when it is broken in the wrong place.
 */
function fit(
  text: string,
  font: PdfFont,
  sizes: number[],
  maxWidthMm: number,
): { size: number; lines: string[] } {
  for (const size of sizes) {
    if (textWidthMm(text, font, size) <= maxWidthMm) return { size, lines: [text] };
  }
  const size = sizes[sizes.length - 1] ?? 11;
  const words = text.split(/\s+/).filter(Boolean);
  let first = '';
  for (const word of words) {
    const next = first ? `${first} ${word}` : word;
    if (textWidthMm(next, font, size) > maxWidthMm && first) break;
    first = next;
  }
  const rest = text.slice(first.length).trim();
  return { size, lines: rest ? [first, rest] : [first] };
}

// ---------------------------------------------------------------------------
// QR
// ---------------------------------------------------------------------------

export type QrMatrix = { size: number; dark: (x: number, y: number) => boolean };

/**
 * The QR as a grid of modules rather than an image.
 *
 * Drawn as vector rectangles it cannot be resampled, softened or dithered by a
 * printer driver, which is the failure that makes a printed QR scan on one
 * machine and not another. Error correction H so a card that gets splashed on
 * a table still resolves.
 */
export function qrMatrix(url: string): QrMatrix {
  const created = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const { size, data } = created.modules;
  return { size, dark: (x, y) => data[y * size + x] === 1 };
}

/** Modules as merged horizontal runs, so the content stream stays small. */
function drawQr(page: PdfPage, xMm: number, yMm: number, panelMm: number, qr: QrMatrix) {
  // Four modules of quiet zone on every side, as the spec requires.
  const quiet = 4;
  const unit = panelMm / (qr.size + quiet * 2);
  const originX = xMm + quiet * unit;
  const originY = yMm + quiet * unit;

  for (let row = 0; row < qr.size; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= qr.size; col += 1) {
      const dark = col < qr.size && qr.dark(col, row);
      if (dark && runStart === -1) runStart = col;
      if (!dark && runStart !== -1) {
        page.rect(
          originX + runStart * unit,
          originY + row * unit,
          (col - runStart) * unit,
          unit,
          '#000000',
        );
        runStart = -1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

/**
 * The whole deliverable: one A4 page a print shop can work from unaided.
 *
 * The trim margins carry the instructions. They are not decoration and they
 * are not left on the finished object — everything outside the dashed borders
 * is cut away, which is exactly why it is the right place to put "print at
 * 100%" and "this half is upside down on purpose".
 */
export function composeTentSheet(input: TentInput): PdfPage {
  const g = tentGeometry();
  const page = new PdfPage(g.pageWidthMm, g.pageHeightMm);
  const qr = qrMatrix(input.feedbackUrl);
  const centre = g.pageWidthMm / 2;

  // ---- The trim margin at the top: what this is, and how to print it -------
  page.text(`${input.businessName} — feedback tent`, centre, 13, {
    font: 'bold',
    size: 11,
    colour: INK,
    align: 'centre',
  });
  page.text('Print on A4 at 100% (Actual size). Do not use "Fit to page".', centre, 19.5, {
    size: 9,
    colour: MUTED,
    align: 'centre',
  });
  page.text(
    `${g.cardsPerSheet} tent cards per sheet · finished face ${round(g.faceWidthMm)} × ${round(g.faceHeightMm)} mm (6 × 2 in)`,
    centre,
    25,
    { size: 8, colour: FAINT, align: 'centre' },
  );
  page.text(`Where to put it: ${input.placement}`, centre, 31.5, {
    size: 7.5,
    colour: INK,
    align: 'centre',
  });
  // Said here, in the margin, because it is the one thing about the sheet that
  // looks like a mistake before it is folded.
  page.text(
    'The upper half of each card prints upside down on purpose — it reads the right way up once folded.',
    centre,
    37,
    { size: 7, colour: FAINT, align: 'centre' },
  );

  // ---- The two cards -------------------------------------------------------
  g.cardTopsMm.forEach((top, index) => {
    const fold = g.foldsMm[index]!;

    // The upper half hangs down the far side once folded, so it is printed
    // rotated. Laid out in ordinary coordinates and flipped in place.
    page.rotatedHalfTurn(g.leftMm, top, g.cardWidthMm, TENT.faceHeightMm, (p) => {
      drawFace(p, g.leftMm, top, input, qr);
    });
    drawFace(page, g.leftMm, fold, input, qr);

    // Cut border. Dashed, on the line itself — it is the edge of the finished
    // card, so it is trimmed away by the cut it describes.
    page.frame(g.leftMm, top, g.cardWidthMm, g.cardHeightMm, {
      colour: '#8B94A8',
      widthPt: 0.5,
      dash: [2, 1.6],
    });

    // Corner marks, in the white outside the card. The dashed border crosses
    // the navy base band twice, where a grey line is nearly invisible; these
    // are always on white, which is why print shops use them.
    for (const [cx, cy] of [
      [g.leftMm, top],
      [g.leftMm + g.cardWidthMm, top],
      [g.leftMm, top + g.cardHeightMm],
      [g.leftMm + g.cardWidthMm, top + g.cardHeightMm],
    ] as const) {
      const outX = cx === g.leftMm ? -1 : 1;
      const outY = cy === top ? -1 : 1;
      page.line(cx + outX * 1.5, cy, cx + outX * 5, cy, { colour: '#545B6C', widthPt: 0.5 });
      page.line(cx, cy + outY * 1.5, cx, cy + outY * 5, { colour: '#545B6C', widthPt: 0.5 });
    }

    // Fold line. It lands exactly on the crease, so it disappears when folded.
    page.line(g.leftMm, fold, g.leftMm + g.cardWidthMm, fold, {
      colour: '#8B94A8',
      widthPt: 0.4,
      dash: [0.8, 1.2],
    });

    page.text('FOLD', g.leftMm - 2.5, fold + 1, {
      size: 6,
      colour: FAINT,
      align: 'right',
      tracking: 0.5,
    });
    page.text('CUT', g.leftMm - 2.5, top + 3, {
      size: 6,
      colour: FAINT,
      align: 'right',
      tracking: 0.5,
    });
  });

  // ---- The trim margin at the bottom: the four steps -----------------------
  const bottom = g.cardTopsMm[g.cardTopsMm.length - 1]! + g.cardHeightMm;
  page.text('Print · Cut · Fold · Place', centre, bottom + 8, {
    font: 'bold',
    size: 9.5,
    colour: INK,
    align: 'centre',
  });
  const steps = [
    '1.  Print this page on A4 at 100%. Plain paper is fine; card stock is sturdier.',
    '2.  Cut out both cards along the dashed borders.',
    '3.  Fold each card along the dotted line, printed side out. The fold is the top ridge.',
    '4.  Stand it up. Both sides show the same card, the right way up.',
  ];
  steps.forEach((step, i) => {
    page.text(step, centre, bottom + 14.5 + i * 5, { size: 8, colour: MUTED, align: 'centre' });
  });
  page.text('Prepared by RepOS', centre, bottom + 36.5, {
    size: 6.5,
    colour: FAINT,
    align: 'centre',
    tracking: 0.6,
  });

  return page;
}

/** The same sheet, as the file an owner downloads. */
export function renderTentSheet(input: TentInput): Uint8Array<ArrayBuffer> {
  return buildPdf([composeTentSheet(input)], {
    title: `${input.businessName} — feedback tent`,
  });
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}
