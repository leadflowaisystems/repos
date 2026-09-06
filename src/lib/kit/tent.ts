import QRCode from 'qrcode';
import {
  buildPdf,
  curveTo,
  lineTo,
  moveTo,
  PdfPage,
  textWidthMm,
  type PathSegment,
  type PdfFont,
} from './pdf';

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

export const TENT = {
  /** True A4. Not "roughly A4": a print shop sets plates from this. */
  pageWidthMm: 210,
  pageHeightMm: 297,

  /**
   * The visible face of the finished tent: portrait, 1 : 1.40.
   *
   * The ratio is the design; the size is arithmetic. Working from A4 inwards:
   * two tents must fit, each tent is TWO faces tall because it folds in half,
   * and the sheet needs a printable margin plus a line of instructions. That
   * leaves two arrangements, and they are not close.
   *
   *   TWO TENTS STACKED, one above the other, is four faces deep. Four faces
   *   plus margins on 297 mm caps the face at 43 × 60 mm — a place card.
   *
   *   TWO TENTS SIDE BY SIDE is two faces deep and two faces wide. 297 mm of
   *   height is generous for two faces; 210 mm of width is the binding
   *   constraint, and it allows 88 mm.
   *
   * Side by side wins by a factor of four in area, so that is the arrangement.
   * The reference sheet settles it too: it asks for a folded card of about
   * 70 × 98 mm, and two of those stacked need 392 mm of a 297 mm page. Stacked
   * is not a smaller version of this design, it is a different one.
   */
  faceWidthMm: 88,
  faceRatio: 1.4,
  get faceHeightMm() {
    return this.faceWidthMm * this.faceRatio; // 123.2
  },

  /** One tent, flat, before folding: the same face twice, joined at the fold. */
  get cardWidthMm() {
    return this.faceWidthMm;
  },
  get cardHeightMm() {
    return this.faceHeightMm * 2; // 246.4
  },

  /** Blank paper between the two tents, so one cut cannot clip the other. */
  gapMm: 10,
  cardsPerSheet: 2,

  /** The instruction strip above the tents, and the four steps below them. */
  headerMm: 32.5,
} as const;

export type TentGeometry = {
  pageWidthMm: number;
  pageHeightMm: number;
  faceWidthMm: number;
  faceHeightMm: number;
  /** height ÷ width of one visible face. */
  faceRatio: number;
  cardWidthMm: number;
  cardHeightMm: number;
  cardsPerSheet: number;
  /** Left edge of each tent, left to right across the sheet. */
  cardLeftsMm: number[];
  /** Top edge of both tents. They sit on one line. */
  cardTopMm: number;
  /** Where each tent is folded — always its own horizontal centre. */
  foldMm: number;
  marginLeftMm: number;
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
  const faceWidth = TENT.faceWidthMm;
  const faceHeight = TENT.faceHeightMm;
  const cardHeight = faceHeight * 2;

  const blockWidth = faceWidth * TENT.cardsPerSheet + TENT.gapMm * (TENT.cardsPerSheet - 1);
  const marginLeft = (TENT.pageWidthMm - blockWidth) / 2;
  const top = TENT.headerMm;

  const lefts: number[] = [];
  for (let i = 0; i < TENT.cardsPerSheet; i += 1) {
    lefts.push(marginLeft + i * (faceWidth + TENT.gapMm));
  }

  return {
    pageWidthMm: TENT.pageWidthMm,
    pageHeightMm: TENT.pageHeightMm,
    faceWidthMm: faceWidth,
    faceHeightMm: faceHeight,
    faceRatio: TENT.faceRatio,
    cardWidthMm: faceWidth,
    cardHeightMm: cardHeight,
    cardsPerSheet: TENT.cardsPerSheet,
    cardLeftsMm: lefts,
    cardTopMm: top,
    foldMm: top + faceHeight,
    marginLeftMm: marginLeft,
    marginTopMm: top,
    marginBottomMm: TENT.pageHeightMm - (top + cardHeight),
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
  /** The short label under the QR, in the vertical's words. */
  qrCaption: string;
  /** The vertical's own thank-you, printed on the base band. */
  thankYou: string;
  /** Where the vertical says the card should sit. Printed in the trim margin. */
  placement: string;
  /** The address the QR encodes: this client's own feedback page. */
  feedbackUrl: string;
  brandPrimary: string;
  brandSecondary: string;
};

const CREAM = '#FAF7EF';
const INK = '#1A1E29';
const MUTED = '#545B6C';
const FAINT = '#B6BDCB';

/**
 * THE HEADWAY MARK, AS VECTOR.
 *
 * The same two uprights and rising gold path the product draws on screen, in
 * PDF operators rather than SVG. It is on the card because a customer who scans
 * a Headway tent should land on a Headway page: the two are one object, and a
 * mark on only one of them makes them look like unrelated things.
 *
 * Sized by height and drawn from the same 40-unit box as the component, so the
 * proportions cannot drift between the screen and the print.
 */
function drawMark(page: PdfPage, xMm: number, yMm: number, heightMm: number, gold: string) {
  const u = heightMm / 28; // the letter occupies y 6..34 of the 40-unit box
  const upright = (offset: number) =>
    page.rect(xMm + offset * u, yMm, 5.2 * u, 28 * u, '#FFFFFF');
  upright(0);
  upright(25.8);
  page.path(
    [
      moveTo(xMm + 0 * u, yMm + 17 * u),
      curveTo(
        xMm + 10.5 * u,
        yMm + 17 * u,
        xMm + 20.5 * u,
        yMm + 15.5 * u,
        xMm + 31 * u,
        yMm + 11 * u,
      ),
    ],
    { stroke: gold, widthPt: (5 * u * 72) / 25.4 },
  );
}

/** How wide drawMark comes out, so a caller can centre the lockup. */
function markWidth(heightMm: number): number {
  return (heightMm / 28) * 31;
}

/**
 * The face, laid out once and drawn twice — the second time upside down.
 *
 * PORTRAIT, and that is the whole change. The old face was a 6 × 2 inch
 * landscape strip, which put the question beside the QR and read as a shelf
 * talker. Turned upright at 1 : 1.40 the composition becomes a column — name,
 * question, invitation, code, thanks — and each element gets the full width of
 * the card instead of half of it. It is the difference between a label and a
 * card somebody leaves on the table.
 *
 * The base is a curve rather than a band. A folded rectangle with a straight
 * coloured strip along the bottom looks like a printout; the same card with a
 * curved base and a gold line riding above it reads as a made thing, and costs
 * exactly the same to print because it is vector, not an image.
 *
 * Everything is centred, because a centred column is what reads as considered
 * from across a table, and because the eye should land on the question rather
 * than track a ragged left edge.
 */
function drawFace(page: PdfPage, x: number, y: number, input: TentInput, qr: QrMatrix) {
  const w = TENT.faceWidthMm; // 88
  const h = TENT.faceHeightMm; // 123.2
  const cx = x + w / 2;
  const column = w - 14; // the measure everything sets to

  page.rect(x, y, w, h, CREAM);

  // ---- The base: a curve, not a band --------------------------------------
  // One cubic sweep from the left edge to the right, rising as it goes. `lift`
  // draws the same curve higher up, which is how the gold line stays exactly
  // parallel to the navy edge instead of being a second guess at it. The
  // control points matter: keeping the first close to the start in y and
  // throwing the second high makes the line leave the left edge almost flat and
  // swing up through the middle. Spread them evenly and it draws a straight
  // diagonal, which reads as a printing mistake rather than a designed edge.
  const BASE_LEFT = 22; // mm of navy at the left edge
  const BASE_RIGHT = 27; // and at the right, so the edge rises
  const wave = (lift: number): PathSegment[] => [
    moveTo(x, y + h - BASE_LEFT - lift),
    curveTo(
      x + w * 0.34,
      y + h - BASE_LEFT - 0.6 - lift,
      x + w * 0.5,
      y + h - BASE_RIGHT + 0.4 - lift,
      x + w,
      y + h - BASE_RIGHT - lift,
    ),
  ];
  page.path([...wave(0), lineTo(x + w, y + h), lineTo(x, y + h)], {
    fill: input.brandPrimary,
  });
  page.path(wave(1.7), { stroke: input.brandSecondary, widthPt: 2.4 });

  // ---- The column ---------------------------------------------------------
  // Tracked capitals, measured WITH the tracking. Measured without it, "The
  // Very Long Restaurant And Banqueting Company" came out 116 mm wide on an
  // 88 mm card and ran off the sheet — the one failure a rendered picture will
  // not show you, because the ink is outside the page.
  const name = fitTracked(input.businessName.toUpperCase(), 'bold', [8.5, 7.5, 6.5, 5.8], column, 1.6);
  page.text(name.text, cx, y + 11.5, {
    font: 'bold',
    size: name.size,
    colour: input.brandSecondary,
    align: 'centre',
    tracking: name.tracking,
  });

  const headline = fit(input.headline, 'bold', [19, 17.5, 16, 14.5, 13], column);
  const headlineTop = headline.lines.length === 1 ? 24.5 : 22;
  headline.lines.forEach((line, i) => {
    page.text(line, cx, y + headlineTop + i * (headline.size * 0.46), {
      font: 'bold',
      size: headline.size,
      colour: INK,
      align: 'centre',
    });
  });

  const subhead = fit(input.subhead, 'regular', [10, 9.5, 9], column);
  const subheadTop = headline.lines.length === 1 ? 35 : 39.5;
  subhead.lines.forEach((line, i) => {
    page.text(line, cx, y + subheadTop + i * 4.8, {
      size: subhead.size,
      colour: MUTED,
      align: 'centre',
    });
  });

  // ---- The code, framed the way the reference frames it -------------------
  // A white panel inside a gold rule. The panel is not decoration: a QR printed
  // straight onto cream loses contrast on a cheap printer, and the quiet zone
  // has to be paper-white for a phone to find the code at all.
  const panel = 40;
  const panelX = cx - panel / 2;
  // Fixed, not stacked under the text: a question that wraps to two lines would
  // otherwise push the code down onto the curve, which is where it went the
  // first time this was rendered.
  const panelY = y + 47;
  page.rect(panelX, panelY, panel, panel, '#FFFFFF');
  page.frame(panelX, panelY, panel, panel, {
    colour: input.brandSecondary,
    widthPt: 1.4,
  });
  drawQr(page, panelX, panelY, panel, qr);

  // Labelled, the way the reference labels it. A bare QR on a table is a thing
  // people photograph without knowing why; a line under it is the difference.
  const caption = fitTracked(input.qrCaption, 'regular', [8, 7.5, 7, 6.5], column, 0);
  page.text(caption.text, cx, panelY + panel + 5.5, {
    size: caption.size,
    colour: MUTED,
    align: 'centre',
  });

  // ---- On the base ---------------------------------------------------------
  gratitude(page, input.thankYou, cx, y + h);

  // The lockup: mark and name together, centred, small. Gold on navy at this
  // size is a signature rather than a logo placement.
  const markH = 4.6;
  const nameW = textWidthMm('Headway', 'bold', 8, 0.3);
  const lockup = markWidth(markH) + 2.2 + nameW;
  const lockupX = cx - lockup / 2;
  drawMark(page, lockupX, y + h - 8.4, markH, input.brandSecondary);
  page.text('Headway', lockupX + markWidth(markH) + 2.2, y + h - 4.6, {
    font: 'bold',
    size: 8,
    colour: '#FFFFFF',
    tracking: 0.3,
  });
}

/**
 * The thanks, on the curve, in two lines.
 *
 * "Thank you — this goes straight to the kitchen team." is one sentence doing
 * two jobs: the thanks, and the promise about where the words go. Stacking them
 * gives the first the weight it deserves and turns the second into the
 * reassurance it actually is — and it is the promise, not the thanks, that
 * persuades somebody to type honestly.
 */
function gratitude(page: PdfPage, text: string, cx: number, faceBottom: number) {
  const trimmed = text.trim();
  const match = /^(thank you|thanks)\s*[—–-]?\s*/i.exec(trimmed);
  if (!match) {
    page.text(trimmed, cx, faceBottom - 12.5, { size: 9, colour: '#FFFFFF', align: 'centre' });
    return;
  }
  const head = trimmed.slice(0, match[1]!.length);
  const rest = trimmed.slice(match[0].length);
  const tail = rest.charAt(0).toUpperCase() + rest.slice(1);
  page.text(head, cx, faceBottom - 16.5, {
    font: 'bold',
    size: 11,
    colour: '#FFFFFF',
    align: 'centre',
  });
  if (tail) {
    const lines = fit(tail, 'regular', [8, 7.5, 7], TENT.faceWidthMm - 16);
    lines.lines.forEach((line, i) => {
      page.text(line, cx, faceBottom - 12 + i * 4, {
        size: lines.size,
        colour: '#DDE4EE',
        align: 'centre',
      });
    });
  }
}

/**
 * The largest of the offered sizes that fits ON ONE LINE, tracking included.
 *
 * For the short tracked runs — the business name, the caption under the code —
 * where wrapping would look like a mistake and the honest answer is to set it
 * smaller. When even the smallest offered size will not fit, the tracking goes
 * first, because letter-spacing is the part of the treatment nobody misses.
 * Only if that still overflows is the text cut, with an ellipsis, so a card can
 * never print past the edge of the paper.
 */
function fitTracked(
  text: string,
  font: PdfFont,
  sizes: number[],
  maxWidthMm: number,
  tracking: number,
): { text: string; size: number; tracking: number } {
  for (const size of sizes) {
    if (textWidthMm(text, font, size, tracking) <= maxWidthMm) return { text, size, tracking };
  }
  const size = sizes[sizes.length - 1] ?? 6;
  if (textWidthMm(text, font, size, 0) <= maxWidthMm) return { text, size, tracking: 0 };
  let cut = text;
  while (cut.length > 1 && textWidthMm(`${cut}…`, font, size, 0) > maxWidthMm) {
    cut = cut.slice(0, -1).trimEnd();
  }
  return { text: `${cut}…`, size, tracking: 0 };
}

/**
 * The largest of the offered sizes that fits, wrapping to two lines only if
 * even the smallest will not fit on one.
 *
 * A question is the loudest thing on the card and should stay one line where it
 * can — "How was the food today?" reads as a question at a glance and as a
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
 * TWO TENTS, SIDE BY SIDE. Each one is two identical faces joined at a
 * horizontal fold, the upper printed upside down so that folding brings it the
 * right way up on the far side. One vertical cut down the middle of the sheet
 * separates the pair; the dashed rectangle round each is the trim.
 *
 * The margins carry the instructions and are cut away, which is exactly why
 * they are the right place for "print at 100%" and "this half is upside down on
 * purpose". They are kept to a strip: the cards are the product, and a sheet
 * that spends half its area explaining itself has the proportions of a leaflet.
 */
export function composeTentSheet(input: TentInput): PdfPage {
  const g = tentGeometry();
  const page = new PdfPage(g.pageWidthMm, g.pageHeightMm);
  const qr = qrMatrix(input.feedbackUrl);
  const centre = g.pageWidthMm / 2;

  // ---- The strip above: what this is, and how to print it -----------------
  page.text(`${input.businessName} — table tent`, centre, 13.5, {
    font: 'bold',
    size: 11,
    colour: INK,
    align: 'centre',
  });
  page.text('Print on A4 at 100% (Actual size). Do not use "Fit to page".', centre, 19.5, {
    size: 8.5,
    colour: MUTED,
    align: 'centre',
  });
  page.text(
    `${g.cardsPerSheet} tents per sheet · finished card ${round(g.faceWidthMm)} × ${round(g.faceHeightMm)} mm ` +
      `(1 : ${g.faceRatio.toFixed(2)}) · the upper half of each prints upside down on purpose`,
    centre,
    24.3,
    { size: 6.8, colour: FAINT, align: 'centre' },
  );
  page.text(`Where to put it: ${input.placement}`, centre, 29.2, {
    size: 7,
    colour: INK,
    align: 'centre',
  });

  // ---- The two tents -------------------------------------------------------
  const top = g.cardTopMm;
  const fold = g.foldMm;
  const bottom = top + g.cardHeightMm;

  g.cardLeftsMm.forEach((left) => {
    // The upper half hangs down the far side once folded, so it is printed
    // rotated. Laid out in ordinary coordinates and flipped in place.
    page.rotatedHalfTurn(left, top, g.cardWidthMm, g.faceHeightMm, (p) => {
      drawFace(p, left, top, input, qr);
    });
    drawFace(page, left, fold, input, qr);

    // Cut border. Dashed, on the line itself — it is the edge of the finished
    // card, so it is trimmed away by the cut it describes.
    page.frame(left, top, g.cardWidthMm, g.cardHeightMm, {
      colour: '#8B94A8',
      widthPt: 0.5,
      dash: [2, 1.6],
    });

    // Corner marks, in the white outside the card. The dashed border crosses
    // the navy base twice, where a grey line is nearly invisible; these are
    // always on white, which is why print shops use them.
    for (const [mx, my] of [
      [left, top],
      [left + g.cardWidthMm, top],
      [left, bottom],
      [left + g.cardWidthMm, bottom],
    ] as const) {
      const outX = mx === left ? -1 : 1;
      const outY = my === top ? -1 : 1;
      page.line(mx + outX * 1.5, my, mx + outX * 4, my, { colour: '#545B6C', widthPt: 0.5 });
      page.line(mx, my + outY * 1.5, mx, my + outY * 4, { colour: '#545B6C', widthPt: 0.5 });
    }

    // Fold line. It lands exactly on the crease, so it disappears when folded.
    page.line(left, fold, left + g.cardWidthMm, fold, {
      colour: '#8B94A8',
      widthPt: 0.4,
      dash: [0.8, 1.2],
    });
  });

  // ---- The two labels, in the gutter ---------------------------------------
  //
  // Not in the outer margins, where they were. "FOLD" set beside the left-hand
  // card put ink 4.2 mm from the edge of the paper, which is inside the
  // unprintable border of most consumer printers — so on a real machine the
  // word would have been clipped or would have pushed the whole sheet to
  // scale. The gutter is 10 mm of white in the middle of the page and has no
  // such problem.
  //
  // It is also the more truthful place for them. The vertical line down the
  // gutter IS the cut that separates the two tents, and the fold is at the same
  // height on both cards, so one label each says everything.
  const gutterX = (g.cardLeftsMm[0]! + g.cardWidthMm + g.cardLeftsMm[1]!) / 2;

  // Three segments, so the dashes never run through a word. The first break
  // is well down the page: level with the header the gutter is still under the
  // instruction lines, and "CUT" printed there landed on top of "Where to put
  // it".
  const cutLabelY = top + 30;
  for (const [from, to] of [
    [top - 4, cutLabelY - 4.5],
    [cutLabelY + 2.2, fold - 4.5],
    [fold + 2.2, bottom + 4],
  ] as const) {
    page.line(gutterX, from, gutterX, to, {
      colour: '#B6BDCB',
      widthPt: 0.4,
      dash: [1.4, 1.4],
    });
  }

  page.text('CUT', gutterX, cutLabelY + 1, {
    size: 5.5,
    colour: FAINT,
    align: 'centre',
    tracking: 0.5,
  });
  page.text('FOLD', gutterX, fold + 1, {
    size: 5.5,
    colour: FAINT,
    align: 'centre',
    tracking: 0.5,
  });

  // ---- The strip below: the four steps -------------------------------------
  page.text('Print · Cut · Fold · Place', centre, bottom + 5.2, {
    font: 'bold',
    size: 8.5,
    colour: INK,
    align: 'centre',
  });
  // Four steps in two lines. Spread over four they ran off the bottom of the
  // page, and the card already carries the mark twice, so the sheet does not
  // need a third signature down here.
  page.text(
    '1.  Print on A4 at 100%.    2.  Cut out both cards along the dashed borders.    ' +
      '3.  Fold each along the dotted line, printed side out.    4.  Stand it up.',
    centre,
    bottom + 10,
    { size: 6.5, colour: MUTED, align: 'centre' },
  );

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
