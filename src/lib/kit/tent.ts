import QRCode from 'qrcode';
import { buildPdf, PdfPage, textWidthMm, type PdfFont } from './pdf';

/**
 * THE HEADWAY TABLE TENT — the one approved physical display, for every client.
 *
 * There is a single canonical design. Every business gets the same card with
 * two things filled in:
 *
 *   1. its own business name
 *   2. its own Headway QR
 *
 * Nothing else varies. Not the wording, not the colours, not the sizes, not
 * the construction. A restaurant, a clinic and a gym all put out the same
 * object, which is the point: the card is Headway's, the name on it is theirs.
 *
 * ONE BUSINESS, ONE CODE. The QR is this client's existing feedback gateway —
 * the same address the workspace shows, the same token, the same page. Both
 * faces of a tent carry it, and every tent a business prints carries it. There
 * is no per-table code, no per-sheet code and no second QR system; extra cards
 * are extra copies of one address.
 *
 * THE CONSTRUCTION, in the order the sheet says it:
 *
 *   print → cut on the dashed line → score the three fold lines → fold printed
 *   side out → tape two coins inside the base → fold the base in → double-sided
 *   tape on the tab, stick it inside the opposite face
 *
 * Flat, each card is four panels down the page:
 *
 *   FACE (upside down) | FOLD 1 | FACE | FOLD 2 | BASE | FOLD 3 | TAB
 *
 * Folded, the two faces lean apart into an A, the base folds under and sits on
 * the table, and the tab closes the triangle inside the far face. The upper
 * face is printed upside down because once folded it hangs down the far side
 * of the ridge — that is the one thing about the flat sheet that looks like a
 * mistake and is not, which is why the sheet says so in words.
 *
 * WHY THE CARD RUNS ALMOST THE FULL SHEET. It is 84 × 279 mm before folding
 * and there is one per column, with 6.5 mm of paper above the trim and 3 mm of
 * bleed outside it. That is a print-shop master — 300 gsm, cut on the line —
 * and it is also safe on a home printer, because everything that survives the
 * cut is at least 6.5 mm inside the paper. Only the bleed and the two lines of
 * build instructions at the foot of the sheet sit closer than that, and both
 * are thrown away by the cut.
 */

// ---------------------------------------------------------------------------
// Geometry — the approved artwork, in millimetres, asserted by the tests
// ---------------------------------------------------------------------------

export const TENT = {
  /** True A4. Not "roughly A4": a print shop sets plates from this. */
  pageWidthMm: 210,
  pageHeightMm: 297,

  /** The visible face of the finished tent. */
  faceWidthMm: 84,
  faceHeightMm: 123,

  /**
   * The panel that lies on the table, weighted with two coins, and the flap
   * that tapes inside the opposite face to close the triangle.
   *
   * THE ONE PLACE THIS SHEET DEPARTS FROM THE ARTWORK, and it is 3 mm of base
   * and 2 mm of tab. The approved master runs the card to 284 mm, which leaves
   * its two lines of build instructions 2 mm from the foot of the paper —
   * correct for a press, which trims them off, and clipped by every home
   * printer, which cannot reach the last few millimetres. The faces are the
   * part anybody ever looks at and they are untouched at 84 × 123 mm; the base
   * and the tab are structure, hidden inside the finished tent, and losing
   * 5 mm of them buys the instructions a margin they survive.
   */
  baseMm: 25,
  tabMm: 8,

  /** Ink carried past the trim, so a cut that wanders leaves no white edge. */
  bleedMm: 3,
  /**
   * White paper between the two cards' bleed boxes.
   *
   * Wide enough to name the three creases in. The artwork puts each card's
   * labels in the margin to its right, which on the right-hand card lands them
   * 3 mm from the edge of the paper; both cards fold at the same heights, so
   * one set of labels down the middle says everything and says it where it
   * will actually print.
   */
  gapMm: 14,
  cardsPerSheet: 2,

  /** Paper above the trim line. The same below, by symmetry. */
  marginTopMm: 6.5,

  /** The gold band that rides every fold: this far inside the panel… */
  bandInsideMm: 3.5,
  /** …and this far past its edge, which is exactly the bleed. */
  bandOutsideMm: 3,

  /** The cream panel the code sits on, and its corner radius. */
  qrPanelMm: 43,
  qrPanelRadiusMm: 3,
  /** How much of that panel the code itself fills; the rest is quiet zone. */
  qrModulesMm: 35,
} as const;

export type TentGeometry = {
  pageWidthMm: number;
  pageHeightMm: number;
  faceWidthMm: number;
  faceHeightMm: number;
  /** height ÷ width of one visible face. */
  faceRatio: number;
  /** The whole card, flat: two faces, the base and the tab. */
  cardWidthMm: number;
  cardHeightMm: number;
  cardsPerSheet: number;
  /** Left edge of each card's TRIM, left to right across the sheet. */
  cardLeftsMm: number[];
  /** Top edge of the trim. Both cards sit on one line. */
  cardTopMm: number;
  /** Bottom edge of the trim. */
  cardBottomMm: number;
  /** The three folds, top to bottom: the ridge, the base, the tab. */
  fold1Mm: number;
  fold2Mm: number;
  fold3Mm: number;
  bleedMm: number;
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
  const cardHeight = faceHeight * 2 + TENT.baseMm + TENT.tabMm;

  // The cards are placed by their BLEED boxes, because that is the ink; the
  // trim then sits one bleed inside each.
  const bleedWidth = faceWidth + TENT.bleedMm * 2;
  const across = bleedWidth * TENT.cardsPerSheet + TENT.gapMm * (TENT.cardsPerSheet - 1);
  const marginLeft = (TENT.pageWidthMm - across) / 2 + TENT.bleedMm;

  const lefts: number[] = [];
  for (let i = 0; i < TENT.cardsPerSheet; i += 1) {
    lefts.push(marginLeft + i * (bleedWidth + TENT.gapMm));
  }

  const top = TENT.marginTopMm;

  return {
    pageWidthMm: TENT.pageWidthMm,
    pageHeightMm: TENT.pageHeightMm,
    faceWidthMm: faceWidth,
    faceHeightMm: faceHeight,
    faceRatio: faceHeight / faceWidth,
    cardWidthMm: faceWidth,
    cardHeightMm: cardHeight,
    cardsPerSheet: TENT.cardsPerSheet,
    cardLeftsMm: lefts,
    cardTopMm: top,
    cardBottomMm: top + cardHeight,
    fold1Mm: top + faceHeight,
    fold2Mm: top + faceHeight * 2,
    fold3Mm: top + faceHeight * 2 + TENT.baseMm,
    bleedMm: TENT.bleedMm,
    marginLeftMm: marginLeft,
    marginTopMm: top,
    marginBottomMm: TENT.pageHeightMm - (top + cardHeight),
  };
}

// ---------------------------------------------------------------------------
// The words — fixed, because the template is fixed
// ---------------------------------------------------------------------------

/**
 * THE APPROVED WORDING. Not per vertical, not per client, not editable.
 *
 * Every line on this card was signed off as customer-facing copy and each one
 * is doing a job:
 *
 *   the question    — open, answerable by anyone, in no way a rating
 *   the invitation  — says a bad answer is wanted, which is the whole product
 *   the scan line   — removes the three reasons people do not scan
 *   the promise     — who reads it, and that it is not published anywhere
 *   the thanks      — the reason to bother
 *
 * There is no mention of Google, no stars, no "if you enjoyed your visit", and
 * nothing that sorts customers by how happy they are before asking them. A
 * card that gated feedback would make everything Headway reads afterwards
 * worthless.
 */
export const TENT_COPY = {
  /** Broken where the artwork breaks it, not wherever the measure runs out. */
  headline: ['How did we', 'do today?'] as const,
  subhead: 'Good, bad or in between — tell us honestly.',
  scanLine: 'SCAN  ·  1 MINUTE  ·  NO APP NEEDED',
  privacyLine: 'Read by the owner. Private — never posted publicly.',
  thankYou: 'Thank you for helping us do better.',
  wordmark: 'Headway',
  base: [
    'BASE — this side faces the table.',
    'Tape two coins on the other side, then fold in.',
  ] as const,
  tab: 'DOUBLE-SIDED TAPE HERE  ·  sticks inside the opposite face',
  sheet: [
    "Headway table tent  ·  Print A4 at 100% (never 'fit to page')  ·  300 gsm matte-laminated card  ·  " +
      'Cut on the dashed line  ·  Score all three fold lines with a ruler and a blunt edge',
    'Fold printed side out  ·  Tape two coins inside the base  ·  Fold the base in  ·  ' +
      'Double-sided tape on the tab, stick it inside the opposite face',
  ] as const,
  cut: 'CUT',
  folds: ['FOLD 1', 'FOLD 2', 'FOLD 3'] as const,
} as const;

// ---------------------------------------------------------------------------
// The palette — Headway's, and only Headway's
// ---------------------------------------------------------------------------

/**
 * The card does not take the client's brand colours, and that is deliberate.
 *
 * A business can set its own colours in Headway and they are used where they
 * belong. This card is not one of those places: it is one approved object that
 * every client puts on a table, and a hundred recoloured variants of it would
 * be a hundred designs nobody approved. The business's name is what makes the
 * card theirs.
 */
const NAVY = '#102A43';
const GOLD = '#B78A3B';
/** The headline and the thanks: warm, not white. */
const CREAM = '#F3EDE0';
/** The panel the code sits on — a shade deeper, so the code reads as inset. */
const PANEL = '#ECE6D8';
/** The two supporting lines. Quieter than the headline, still legible on navy. */
const MUTED = '#B7C1CD';
/** Cut marks, fold marks and the instructions that get trimmed away. */
const MARKS = '#9AA6B4';

// ---------------------------------------------------------------------------
// Type — sized to SET THE SAME WIDTH as the approved artwork
// ---------------------------------------------------------------------------

/**
 * The artwork was drawn in Jost, Cormorant Garamond Light Italic and Lato
 * Bold. None of those is a base-14 face, and embedding three TrueType subsets
 * to print one card would add font files, a subsetter and a licence question
 * to a module whose whole point is that it has no dependencies.
 *
 * So each line is set in the nearest base-14 face at whatever size reproduces
 * the MEASURED WIDTH of that line in the approved artwork. Matching the width
 * rather than the nominal point size is what keeps the composition — the
 * relative weight of the question against the invitation, the invitation
 * against the promise — looking like the thing that was signed off, instead of
 * looking like the same layout in a different font.
 */
const TYPE = {
  /** Tracked capitals. Shrinks for a long name; see fitTracked. */
  nameSizes: [10.3, 9.2, 8.2, 7.2, 6.4, 5.6],
  nameTracking: 1.7,
  headline: 24,
  /** Baseline to baseline, in millimetres. */
  headlineLeadingMm: 9.6,
  subhead: 7.5,
  scan: 6.3,
  scanTracking: 0.9,
  privacy: 7,
  thankYou: 9.5,
  wordmark: 9.2,
  base: 5,
  tab: 4.8,
  sheet: 5.4,
  label: 5.4,
  labelTracking: 0.4,
} as const;

/**
 * Baselines and edges within one face, measured down from the top of the face.
 *
 * Taken from the approved artwork, not invented: the QR panel is at a fixed
 * height rather than stacked under the text, so no line of type can ever push
 * the code down the card.
 */
const FACE = {
  nameBaselineMm: 14.6,
  headlineBaselineMm: 28.2,
  subheadBaselineMm: 44.2,
  panelTopMm: 48.6,
  scanBaselineMm: 98.4,
  privacyBaselineMm: 103.8,
  thankYouBaselineMm: 109.4,
  wordmarkBaselineMm: 116.15,
  /** Widest a line of type may set. The name is the only line that can grow. */
  measureMm: 74,
} as const;

// ---------------------------------------------------------------------------
// The Headway mark
// ---------------------------------------------------------------------------

/**
 * THE HEADWAY MARK, AS VECTOR.
 *
 * The same two uprights and rising gold path the product draws on screen, in
 * PDF operators rather than SVG. It is on the card because a customer who
 * scans a Headway tent should land on a Headway page: the two are one object,
 * and a mark on only one of them makes them look like unrelated things.
 *
 * Sized to the cap height of the word beside it, and drawn from the same
 * 40-unit box as the component, so the proportions cannot drift between the
 * screen and the print.
 */
function drawMark(page: PdfPage, xMm: number, baselineMm: number, heightMm: number) {
  const u = heightMm / 28; // the letter occupies y 6..34 of the 40-unit box
  const top = baselineMm - heightMm;
  page.rect(xMm, top, 5.2 * u, 28 * u, CREAM);
  page.rect(xMm + 25.8 * u, top, 5.2 * u, 28 * u, CREAM);
  page.path(
    [
      { kind: 'move', x: xMm, y: top + 17 * u },
      {
        kind: 'curve',
        c1x: xMm + 10.5 * u,
        c1y: top + 17 * u,
        c2x: xMm + 20.5 * u,
        c2y: top + 15.5 * u,
        x: xMm + 31 * u,
        y: top + 11 * u,
      },
    ],
    { stroke: GOLD, widthPt: (5 * u * 72) / 25.4 },
  );
}

/** How wide drawMark comes out, so a caller can centre the lockup. */
function markWidth(heightMm: number): number {
  return (heightMm / 28) * 31;
}

// ---------------------------------------------------------------------------
// One face
// ---------------------------------------------------------------------------

/**
 * The face, laid out once and drawn four times — twice per tent, and once of
 * each pair upside down.
 *
 * It is a single centred column, top to bottom: whose business this is, the
 * question, the invitation, the code, what happens to the answer, thanks, and
 * the mark. Nothing sits beside anything else, because a card read from across
 * a table is read in one pass down the middle.
 *
 * The navy ground is NOT drawn here. It is one rectangle per card, covering the
 * bleed, so that the two faces emit identical operators and the sheet can be
 * checked for "both sides are the same object" by comparing them.
 */
function drawFace(page: PdfPage, x: number, y: number, businessName: string, qr: QrMatrix) {
  const w = TENT.faceWidthMm;
  const h = TENT.faceHeightMm;
  const cx = x + w / 2;

  // The gold band rides each fold: this face's own share at the top and at the
  // bottom. Where two panels meet, their two shares make the one band the
  // artwork shows; at the cut line the outer share falls in the bleed.
  band(page, x, y);
  band(page, x, y + h);

  // Whose card this is. Tracked capitals, measured WITH the tracking — measured
  // without it, "The Very Long Restaurant And Banqueting Company" set 146 mm
  // wide on an 84 mm card and ran off the sheet, which is the one failure a
  // rendered preview cannot show you, because the ink is outside the page.
  const name = fitTracked(
    businessName.toUpperCase(),
    'regular',
    TYPE.nameSizes,
    FACE.measureMm,
    TYPE.nameTracking,
  );
  page.text(name.text, cx, y + FACE.nameBaselineMm, {
    size: name.size,
    colour: GOLD,
    align: 'centre',
    tracking: name.tracking,
  });

  // The question, in the italic serif, broken where the artwork breaks it.
  TENT_COPY.headline.forEach((line, i) => {
    page.text(line, cx, y + FACE.headlineBaselineMm + i * TYPE.headlineLeadingMm, {
      font: 'serifItalic',
      size: TYPE.headline,
      colour: CREAM,
      align: 'centre',
    });
  });

  page.text(TENT_COPY.subhead, cx, y + FACE.subheadBaselineMm, {
    size: TYPE.subhead,
    colour: MUTED,
    align: 'centre',
  });

  // The code, on its own cream panel. The panel is not decoration: a QR printed
  // straight onto navy has no contrast at all, and the quiet zone around it has
  // to be light paper for a phone to find the code.
  const panel = TENT.qrPanelMm;
  const panelX = cx - panel / 2;
  const panelY = y + FACE.panelTopMm;
  page.roundedRect(panelX, panelY, panel, panel, TENT.qrPanelRadiusMm, PANEL);
  drawQr(page, panelX, panelY, panel, qr);

  page.text(TENT_COPY.scanLine, cx, y + FACE.scanBaselineMm, {
    size: TYPE.scan,
    colour: GOLD,
    align: 'centre',
    tracking: TYPE.scanTracking,
  });
  page.text(TENT_COPY.privacyLine, cx, y + FACE.privacyBaselineMm, {
    size: TYPE.privacy,
    colour: MUTED,
    align: 'centre',
  });
  page.text(TENT_COPY.thankYou, cx, y + FACE.thankYouBaselineMm, {
    font: 'serifItalic',
    size: TYPE.thankYou,
    colour: CREAM,
    align: 'centre',
  });

  // The lockup: mark and word together, centred, small. Gold and cream on navy
  // at this size is a signature rather than a logo placement.
  const markH = TYPE.wordmark * 0.718 * (25.4 / 72); // the cap height beside it
  const nameW = textWidthMm(TENT_COPY.wordmark, 'bold', TYPE.wordmark);
  const gap = 1.4;
  const lockup = markWidth(markH) + gap + nameW;
  const lockupX = cx - lockup / 2;
  const baseline = y + FACE.wordmarkBaselineMm;
  drawMark(page, lockupX, baseline, markH);
  page.text(TENT_COPY.wordmark, lockupX + markWidth(markH) + gap, baseline, {
    font: 'bold',
    size: TYPE.wordmark,
    colour: CREAM,
  });
}

/** The gold band that rides one edge of a panel. */
function band(page: PdfPage, x: number, edgeY: number) {
  page.rect(
    x,
    edgeY - TENT.bandOutsideMm,
    TENT.faceWidthMm,
    TENT.bandOutsideMm + TENT.bandInsideMm,
    GOLD,
  );
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
 * machine and not another. Error correction H, so a card that gets splashed on
 * a table still resolves.
 */
export function qrMatrix(url: string): QrMatrix {
  const created = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const { size, data } = created.modules;
  return { size, dark: (x, y) => data[y * size + x] === 1 };
}

/**
 * Modules as merged horizontal runs, so the content stream stays small.
 *
 * The code fills 35 mm of the 43 mm panel, which leaves 4 mm of cream on every
 * side. The QR specification asks for four modules of quiet zone; for any
 * address Headway generates that is comfortably met, but a short URL encodes
 * to a smaller grid with bigger modules, so the drawn size is reduced rather
 * than the quiet zone — the rule is enforced here, not assumed.
 */
function drawQr(page: PdfPage, panelXMm: number, panelYMm: number, panelMm: number, qr: QrMatrix) {
  const quietModules = 4;
  const widest = (panelMm * qr.size) / (qr.size + quietModules * 2);
  const grid = Math.min(TENT.qrModulesMm, widest);
  const unit = grid / qr.size;
  const originX = panelXMm + (panelMm - grid) / 2;
  const originY = panelYMm + (panelMm - grid) / 2;

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
// Fitting
// ---------------------------------------------------------------------------

/**
 * The largest of the offered sizes that fits ON ONE LINE, tracking included.
 *
 * The business name is the only line on the card whose length Headway does not
 * control, and it has to stay one line: a name wrapped across two lines under
 * a fixed layout reads as a mistake. So it is set smaller instead. When even
 * the smallest offered size will not fit, the tracking goes first, because
 * letter-spacing is the part of the treatment nobody misses. Only if that
 * still overflows is the name cut, with an ellipsis, so a card can never print
 * past the edge of the paper.
 */
function fitTracked(
  text: string,
  font: PdfFont,
  sizes: readonly number[],
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

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export type TentInput = {
  /** The name printed at the top of both faces. */
  businessName: string;
  /** The address the QR encodes: this client's own Headway feedback page. */
  feedbackUrl: string;
};

/**
 * The whole deliverable: one A4 page a print shop can work from unaided.
 *
 * Two cards side by side, each with its own trim rectangle, its own three fold
 * lines and its own labels in the margin beside it. The two lines at the foot
 * of the sheet are the build instructions; they sit outside every trim and are
 * thrown away with the offcuts.
 */
export function composeTentSheet(input: TentInput): PdfPage {
  const g = tentGeometry();
  const page = new PdfPage(g.pageWidthMm, g.pageHeightMm);

  // ONE matrix, built once, drawn on all four faces. Not four encodings that
  // happen to agree: one address, one code, and the tests can prove it by
  // comparing the drawn grids.
  const qr = qrMatrix(input.feedbackUrl);
  const bleed = g.bleedMm;

  g.cardLeftsMm.forEach((left) => {
    // The navy, including the bleed, in one rectangle. Everything else is
    // drawn on top of it.
    page.rect(
      left - bleed,
      g.cardTopMm - bleed,
      g.cardWidthMm + bleed * 2,
      g.cardHeightMm + bleed * 2,
      NAVY,
    );

    // The upper face hangs down the far side once folded, so it is printed
    // rotated. Laid out in ordinary coordinates and flipped in place.
    page.rotatedHalfTurn(left, g.cardTopMm, g.cardWidthMm, g.faceHeightMm, (p) => {
      drawFace(p, left, g.cardTopMm, input.businessName, qr);
    });
    drawFace(page, left, g.fold1Mm, input.businessName, qr);

    // The base. Its gold edge is the lower share of the FOLD 2 band, already
    // drawn by the face above it.
    const baseCentre = left + g.cardWidthMm / 2;
    TENT_COPY.base.forEach((line, i) => {
      page.text(line, baseCentre, g.fold2Mm + 12.8 + i * 3.4, {
        size: TYPE.base,
        colour: MUTED,
        align: 'centre',
      });
    });

    // The tab, which nobody ever sees once the card is built.
    page.text(TENT_COPY.tab, baseCentre, g.fold3Mm + 5.5, {
      size: TYPE.tab,
      colour: GOLD,
      align: 'centre',
    });

    // The trim. Dashed, on the line itself — it is the edge of the finished
    // card, so it is cut away by the cut it describes.
    page.frame(left, g.cardTopMm, g.cardWidthMm, g.cardHeightMm, {
      colour: MARKS,
      widthPt: 0.4,
      dash: [(2.4 * 25.4) / 72, (2 * 25.4) / 72],
    });

    // The three creases, drawn a little past the ink at both ends so the score
    // line is findable against the navy.
    for (const fold of [g.fold1Mm, g.fold2Mm, g.fold3Mm]) {
      page.line(left - bleed - 2, fold, left + g.cardWidthMm + bleed + 2, fold, {
        colour: MARKS,
        widthPt: 0.5,
        dash: [(0.7 * 25.4) / 72, (1.9 * 25.4) / 72],
      });
    }
  });

  // The three creases and the cut, named once, down the middle of the sheet.
  // Both cards fold at the same heights, so one label each is the whole story —
  // and the gutter is the only strip of white on the page wide enough to set
  // them in without pushing type into the printer's own border.
  const gutter = g.pageWidthMm / 2;
  const labels: Array<[string, number]> = [
    [TENT_COPY.cut, g.cardTopMm + 1.8],
    [TENT_COPY.folds[0], g.fold1Mm + 0.7],
    [TENT_COPY.folds[1], g.fold2Mm + 0.7],
    [TENT_COPY.folds[2], g.fold3Mm + 0.7],
  ];
  for (const [label, y] of labels) {
    page.text(label, gutter, y, {
      size: TYPE.label,
      colour: MARKS,
      align: 'centre',
      tracking: TYPE.labelTracking,
    });
  }

  // How to build it, at the foot of the sheet, below every trim and below the
  // bleed — read while the sheet is flat, then cut off.
  TENT_COPY.sheet.forEach((line, i) => {
    page.text(line, gutter, g.pageHeightMm - 6.7 + i * 2.6, {
      size: TYPE.sheet,
      colour: MARKS,
      align: 'centre',
    });
  });

  return page;
}

/** The same sheet, as the file an owner downloads. */
export function renderTentSheet(input: TentInput): Uint8Array<ArrayBuffer> {
  return buildPdf([composeTentSheet(input)], {
    title: `${input.businessName} — Headway table tent`,
  });
}
