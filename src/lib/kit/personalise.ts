import QRCode from 'qrcode';
import {
  bytesToLatin1,
  findObject,
  latin1ToBytes,
  objectByNumber,
  parsePdf,
  readStream,
  replaceBody,
  replaceStream,
  serialisePdf,
  type PdfFile,
  type PdfObject,
} from './pdf-edit';

/**
 * PUTTING A BUSINESS ON AN APPROVED PRINT MASTER.
 *
 * The two sheets under `public/print-kit` are signed-off artwork. This module
 * changes exactly two things in one of them and copies everything else through
 * untouched:
 *
 *   1. `YOUR BUSINESS NAME`  ->  this business's name
 *   2. the placeholder QR    ->  this business's own Headway feedback code
 *
 * Not the fonts — the name is re-set in the master's own embedded Jost subset,
 * which carries the whole printable ASCII range, so it is the same typeface at
 * the same size with the same letter-spacing on the same baseline. Not the
 * layout — the new name is centred on the centre the master itself centred the
 * placeholder on, recovered from the placeholder's own geometry. Not the
 * colours, not the graphics, not the wording, not the QR's position or size:
 * the code is one image object placed two or four times, so replacing that one
 * object updates every face at identical coordinates.
 *
 * WHY THE CODE IS RE-ENCODED RATHER THAN RE-DRAWN. The master's placeholder
 * encodes `https://example.com/replace-with-your-headway-feedback-link` at 33
 * modules and error correction L or M. A real feedback address is a similar
 * length, and Headway encodes at H everywhere else, so the replacement comes
 * out finer — 41 modules for a typical address. That is an improvement, not a
 * compromise: the artwork gives the code a 43 mm square inside a 52 mm cream
 * panel, so 4.5 mm of quiet zone. At the master's 33 modules that is 3.45
 * modules, under the four the QR specification asks for; at 41 it is 4.29. The
 * approved master is very slightly out of spec and the personalised sheet is
 * not, and H tolerates 30 % of the code being obscured rather than 15 %, which
 * on a card that lives on a restaurant table is the difference that matters.
 */

/** The literal string the masters carry where a name belongs. */
export const NAME_PLACEHOLDER = 'YOUR BUSINESS NAME';

/** And the one in the document title. */
const TITLE_PLACEHOLDER = 'Your Business Name';

/**
 * The two colours the master's QR is drawn in, read off the master itself.
 *
 * Navy on cream, not black on white — the code is part of the card, not a
 * sticker on it. Hard-coded so a request does not have to inflate 7.7 MB of
 * image to sample two pixels; asserted against the real file by the tests.
 */
export const QR_DARK: readonly [number, number, number] = [16, 42, 67];
export const QR_LIGHT: readonly [number, number, number] = [236, 230, 216];

/**
 * The widest the name may set, in points.
 *
 * Both masters put the card's face at 4 × 6 in, so 288 pt across. The approved
 * placeholder uses 180 pt of that; this allows a long name to grow to 248 pt,
 * which still leaves 20 pt of navy either side, and shrinks the type rather
 * than crossing that line. Nothing sits beside the name, so the measure can be
 * wider than the placeholder's without touching anything else on the card.
 */
const NAME_MEASURE_PT = 248;

/**
 * How a name that does not fit gives way: LETTER-SPACING FIRST, then the type.
 *
 * The treatment is wide tracked capitals, and at the approved size the spacing
 * is 3 pt against an average glyph of about 7 — nearly a third of the line's
 * width is air. So a long name buys its room by closing that air up before it
 * gives up any type size, which keeps it readable far longer than shrinking
 * both together would. Tightening tracking on a tracked line reads as a
 * different setting of the same idea; 6 pt capitals read as a mistake.
 *
 * Each pair is [size, tracking] as a share of the master's own values.
 */
const NAME_STEPS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 0.7],
  [1, 0.45],
  [0.9, 0.45],
  [0.82, 0.4],
  [0.74, 0.35],
  [0.66, 0.3],
  [0.58, 0.25],
  [0.5, 0.2],
];

export type Personalisation = {
  /** The name to print. Set in capitals, as the artwork sets it. */
  businessName: string;
  /** The address the QR must open: this client's own Headway feedback page. */
  feedbackUrl: string;
};

export type PersonaliseResult = {
  pdf: Uint8Array<ArrayBuffer>;
  /** What was actually printed, after fitting and transliteration. */
  printedName: string;
  /** How many faces on this sheet carried the name. */
  facesNamed: number;
  /** The size the name ended up at, in points, and the master's own size. */
  sizePt: number;
  originalSizePt: number;
  /** The code's module count, so a test can check the quiet zone. */
  qrModules: number;
  /** Anything dropped because the embedded font has no glyph for it. */
  dropped: string[];
};

// ---------------------------------------------------------------------------
// The name
// ---------------------------------------------------------------------------

/** Characters the embedded subsets cannot set, mapped to something they can. */
const TRANSLITERATE: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '—': '-',
  '–': '-',
  '·': '.',
  '…': '...',
  '₹': 'RS',
  'É': 'E',
  'È': 'E',
  'Ê': 'E',
  'Á': 'A',
  'À': 'A',
  'Â': 'A',
  'Ä': 'A',
  'Í': 'I',
  'Ó': 'O',
  'Ö': 'O',
  'Ú': 'U',
  'Ü': 'U',
  'Ñ': 'N',
  'Ç': 'C',
  ' ': ' ',
};

/**
 * The name as the master's font can actually set it.
 *
 * The embedded subsets cover printable ASCII and nothing else, so a name with
 * a curly apostrophe or an accent is folded to the nearest thing that will
 * print, and anything still outside the range is dropped and reported rather
 * than left to render as a blank box on a hundred printed cards.
 */
export function printableName(raw: string): { text: string; dropped: string[] } {
  const dropped: string[] = [];
  let out = '';
  for (const char of raw.trim().toUpperCase()) {
    const mapped = TRANSLITERATE[char] ?? char;
    for (const c of mapped) {
      const code = c.charCodeAt(0);
      if (code >= 32 && code <= 126) out += c;
      else if (!dropped.includes(char)) dropped.push(char);
    }
  }
  return { text: out.replace(/\s+/g, ' ').trim(), dropped };
}

/** `/Widths [...]` from the font object whose `/Name` is this resource. */
function glyphWidths(file: PdfFile, resource: string): number[] {
  const font = findObject(file, (body) => body.includes(`/Name /${resource}`));
  if (!font) throw new Error(`The master has no font resource called ${resource}.`);
  const body = bytesToLatin1(font.body);
  const first = /\/FirstChar\s+(\d+)/.exec(body);
  const widths = /\/Widths\s*\[([^\]]*)\]/.exec(body);
  if (!first || !widths) throw new Error(`Font ${resource} has no usable /Widths.`);
  if (Number(first[1]) !== 0) {
    throw new Error(`Font ${resource} does not start at code 0, which this rewriter assumes.`);
  }
  return (widths[1] as string).trim().split(/\s+/).map(Number);
}

function advance(widths: number[], char: string, sizePt: number): number {
  const code = char.charCodeAt(0);
  return ((widths[code] ?? 500) / 1000) * sizePt;
}

function runWidth(widths: number[], text: string, sizePt: number, trackingPt: number): number {
  let total = 0;
  for (const char of text) total += advance(widths, char, sizePt);
  return total + Math.max(0, text.length - 1) * trackingPt;
}

/** A PDF string literal, with the three characters that would end it escaped. */
function pdfLiteral(char: string): string {
  if (char === '(' || char === ')' || char === '\\') return `\\${char}`;
  return char;
}

/**
 * One glyph, one text block — exactly the shape the master already uses.
 *
 * ReportLab implemented the letter-spacing by placing every character at its
 * own computed x rather than by setting `Tc`, and the replacement keeps that,
 * so the diff against the master is one run of lines swapped for another run
 * of the same lines.
 */
function nameBlocks(
  text: string,
  widths: number[],
  options: { resource: string; sizePt: number; trackingPt: number; leading: string; startX: number; y: string },
): string[] {
  const lines: string[] = [];
  let x = options.startX;
  for (const char of text) {
    lines.push(
      `BT 1 0 0 1 ${trim(x)} ${options.y} Tm /${options.resource} ${trim(options.sizePt)} Tf ` +
        `${options.leading} TL (${pdfLiteral(char)}) Tj T* ET`,
    );
    x += advance(widths, char, options.sizePt) + options.trackingPt;
  }
  return lines;
}

function trim(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** One `BT … Tj T* ET` line, as the masters write them. */
const GLYPH_LINE =
  /^BT 1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm \/(\S+) ([\d.]+) Tf ([\d.]+) TL \((\\.|[^)])\) Tj T\* ET$/;

type Run = {
  from: number;
  to: number;
  text: string;
  x: number;
  y: string;
  resource: string;
  sizePt: number;
  leading: string;
};

/** Every consecutive same-line, same-font run of single-glyph blocks. */
function findRuns(lines: string[]): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  lines.forEach((line, index) => {
    const m = GLYPH_LINE.exec(line.trim());
    if (!m) {
      if (current) runs.push(current);
      current = null;
      return;
    }
    const [, x, y, resource, size, leading, raw] = m;
    const char = raw as string;
    const glyph = char.length === 2 ? (char[1] as string) : char;
    if (
      current &&
      current.to === index - 1 &&
      current.y === y &&
      current.resource === resource &&
      current.sizePt === Number(size)
    ) {
      current.to = index;
      current.text += glyph;
      return;
    }
    if (current) runs.push(current);
    current = {
      from: index,
      to: index,
      text: glyph as string,
      x: Number(x),
      y: y as string,
      resource: resource as string,
      sizePt: Number(size),
      leading: leading as string,
    };
  });
  if (current) runs.push(current);
  return runs;
}

/**
 * The letter-spacing the master used, recovered from the run itself.
 *
 * The first two glyphs are enough: the gap between their origins is the first
 * glyph's advance plus the tracking, and the advance is known from the font's
 * own width table. Reading it rather than assuming it is what lets this work
 * on both masters without either of them being described in code.
 */
function trackingOf(run: Run, widths: number[], lines: string[]): number {
  if (run.text.length < 2) return 0;
  const second = GLYPH_LINE.exec(lines[run.from + 1]!.trim());
  if (!second) return 0;
  const gap = Number(second[1]) - run.x;
  return gap - advance(widths, run.text[0] as string, run.sizePt);
}

// ---------------------------------------------------------------------------
// The code
// ---------------------------------------------------------------------------

type Raster = { width: number; height: number; rgb: Uint8Array; modules: number };

/**
 * The client's QR as a raster the same shape as the one it replaces.
 *
 * The master's image is a square of navy modules on cream with no margin of
 * its own — the quiet zone is the cream panel the artwork draws behind it — so
 * this is the same: edge to edge, same two colours, same colour space.
 *
 * The pixel size is chosen as the multiple of the module count nearest the
 * master's 1600, so every module lands on whole pixels. The master's own
 * 1600 ÷ 33 does not, which leaves its modules a pixel wider in places; at
 * 43 mm on paper neither matters, but there is no reason to copy the flaw.
 */
export function qrRaster(url: string): Raster {
  const created = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const { size, data } = created.modules;
  const scale = Math.max(1, Math.round(1600 / size));
  const side = size * scale;

  const rgb = new Uint8Array(side * side * 3);
  // Fill with the light colour, then paint the dark modules over it.
  for (let i = 0; i < side * side; i += 1) {
    rgb[i * 3] = QR_LIGHT[0];
    rgb[i * 3 + 1] = QR_LIGHT[1];
    rgb[i * 3 + 2] = QR_LIGHT[2];
  }
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (data[row * size + col] !== 1) continue;
      for (let y = row * scale; y < (row + 1) * scale; y += 1) {
        const rowStart = y * side;
        for (let x = col * scale; x < (col + 1) * scale; x += 1) {
          const i = (rowStart + x) * 3;
          rgb[i] = QR_DARK[0];
          rgb[i + 1] = QR_DARK[1];
          rgb[i + 2] = QR_DARK[2];
        }
      }
    }
  }
  return { width: side, height: side, rgb, modules: size };
}

// ---------------------------------------------------------------------------
// The whole job
// ---------------------------------------------------------------------------

/** The content stream the page points at. */
function contentObject(file: PdfFile): PdfObject {
  const page = findObject(file, (body) => /\/Type\s*\/Page[^s]/.test(body));
  if (!page) throw new Error('The master has no page object.');
  const ref = /\/Contents\s+(\d+)\s+0\s+R/.exec(bytesToLatin1(page.body));
  if (!ref) throw new Error('The master page has no /Contents reference.');
  const content = objectByNumber(file, Number(ref[1]));
  if (!content) throw new Error(`The master has no object ${ref[1]}.`);
  return content;
}

/** The single image XObject every face places. */
function imageObject(file: PdfFile): PdfObject {
  const images = file.objects.filter((o) => /\/Subtype\s*\/Image/.test(bytesToLatin1(o.body)));
  if (images.length !== 1) {
    throw new Error(`Expected exactly one image in the master, found ${images.length}.`);
  }
  return images[0] as PdfObject;
}

/**
 * Fills in one approved master for one business.
 *
 * Throws rather than returning something half-done: a print master that has
 * been partly personalised is the worst possible output, because it looks
 * finished.
 */
export function personaliseSheet(master: Uint8Array, input: Personalisation): PersonaliseResult {
  const file = parsePdf(master);

  // ---- The name ------------------------------------------------------------
  const content = contentObject(file);
  const { data } = readStream(content);
  const lines = bytesToLatin1(data).split('\n');

  const runs = findRuns(lines).filter((r) => r.text === NAME_PLACEHOLDER);
  if (runs.length === 0) {
    throw new Error(`This master does not carry "${NAME_PLACEHOLDER}", so it is not a Headway sheet.`);
  }

  const resource = runs[0]!.resource;
  const widths = glyphWidths(file, resource);
  const originalSize = runs[0]!.sizePt;
  const originalTracking = trackingOf(runs[0]!, widths, lines);

  const { text: name, dropped } = printableName(input.businessName);
  if (name.length === 0) throw new Error('There is no printable business name to put on the card.');

  // The first step that fits the measure. Rounded, so the emitted size is a
  // number a person reads in the content stream rather than 7.249999999999999,
  // and so the same client always produces the same bytes.
  let sizePt = originalSize;
  let trackingPt = originalTracking;
  for (const [size, tracking] of NAME_STEPS) {
    sizePt = round3(originalSize * size);
    trackingPt = round3(originalTracking * tracking);
    if (runWidth(widths, name, sizePt, trackingPt) <= NAME_MEASURE_PT) break;
  }
  // Still too wide at the smallest step: cut it rather than print off the card.
  let printedName = name;
  while (
    printedName.length > 1 &&
    runWidth(widths, `${printedName}...`, sizePt, trackingPt) > NAME_MEASURE_PT
  ) {
    printedName = printedName.slice(0, -1).trimEnd();
  }
  if (printedName !== name) printedName = `${printedName}...`;

  const width = runWidth(widths, printedName, sizePt, trackingPt);

  // Replace from the last run backwards, so earlier line indexes stay valid.
  for (const run of [...runs].sort((a, b) => b.from - a.from)) {
    // The centre the master itself used, recovered from the placeholder's own
    // geometry — so this works on any face of any sheet without either being
    // written down here.
    const centre = run.x + runWidth(widths, NAME_PLACEHOLDER, run.sizePt, originalTracking) / 2;
    const blocks = nameBlocks(printedName, widths, {
      resource: run.resource,
      sizePt,
      trackingPt,
      leading: run.leading,
      startX: centre - width / 2,
      y: run.y,
    });
    lines.splice(run.from, run.to - run.from + 1, ...blocks);
  }

  // Left uncompressed on purpose: it is a few kilobytes either way and a
  // person debugging a misplaced millimetre can read it.
  replaceStream(content, latin1ToBytes(lines.join('\n')), { compress: false });

  // ---- The code ------------------------------------------------------------
  const image = imageObject(file);
  const raster = qrRaster(input.feedbackUrl);
  replaceStream(image, raster.rgb, {
    compress: true,
    dictOverrides: { Width: String(raster.width), Height: String(raster.height) },
  });

  // ---- The title, so a downloaded file says whose it is --------------------
  const info = findObject(file, (body) => body.includes('/Producer') && body.includes('/Title'));
  if (info) {
    const body = bytesToLatin1(info.body);
    if (body.includes(TITLE_PLACEHOLDER)) {
      replaceBody(
        info,
        body.trim().replace(TITLE_PLACEHOLDER, printedName.replace(/[()\\]/g, (c) => `\\${c}`)),
      );
    }
  }

  return {
    pdf: serialisePdf(file),
    printedName,
    facesNamed: runs.length,
    sizePt,
    originalSizePt: originalSize,
    qrModules: raster.modules,
    dropped,
  };
}
