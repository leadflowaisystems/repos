/**
 * A MINIMAL PDF WRITER, WITH NO DEPENDENCY AND NO SERVICE.
 *
 * The print kit used to be an HTML page the operator printed from a browser.
 * That is fine for one person with one printer and useless for the thing an
 * owner actually needs: a file they can send to a print shop. A print shop
 * needs a PDF at a known page size with the cut and fold marks already on it —
 * "open this in Chrome and press Ctrl+P, and make sure Fit to Page is off" is
 * not something to put in an email.
 *
 * So RepOS writes the PDF itself. Not through a library: the whole job is one
 * page, two typefaces that every reader already has, some filled rectangles
 * and some lines. That is a few hundred lines of the PDF format, and it is
 * worth writing rather than taking a dependency for, because it makes the
 * output exact and reproducible — the same client produces the same bytes,
 * which is what lets a test assert the geometry instead of eyeballing it.
 *
 * WHAT IS DELIBERATELY NOT HERE. No embedded fonts (the base-14 Helvetica is
 * present in every reader and needs no licence), no images (the QR is drawn as
 * vector rectangles, so it stays sharp at any size and cannot be resampled by
 * a printer driver), no compression (a one-page card is a few kilobytes either
 * way, and an uncompressed content stream can be read by a human debugging a
 * misplaced millimetre), and no creation date (so the bytes are deterministic).
 *
 * COORDINATES. PDF puts the origin at the BOTTOM-left and measures in points.
 * Everything a person says about a printed page — "18mm from the top" — is
 * top-down and in millimetres. This module takes the human units and does the
 * conversion once, in `y()`, so no caller has to think in flipped points.
 */

export const PT_PER_MM = 72 / 25.4;

export function mmToPt(value: number): number {
  return value * PT_PER_MM;
}

/** Trims a number to something a PDF reader parses without scientific notation. */
function n(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export type PdfFont = 'regular' | 'bold';

/**
 * Adobe's own Helvetica widths, in 1/1000 em, for ASCII 32-126.
 *
 * Needed because centring text requires knowing how wide it is, and the base-14
 * fonts are not embedded — so there is no font file to measure. These are the
 * canonical AFM values; a reader lays the text out with exactly these.
 */
const ASCII_WIDTHS: Record<PdfFont, number[]> = {
  regular: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ],
  bold: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ],
};

/**
 * The handful of typographic characters RepOS copy actually uses, mapped to
 * their WinAnsi byte and width.
 *
 * The em dash matters most: "Scan and tell us honestly — good or bad." is the
 * approved wording for a restaurant, and rendering it as a question mark on a
 * card a customer reads would be a visible defect.
 */
const WIN_ANSI: Record<string, { byte: number; regular: number; bold: number }> = {
  '—': { byte: 0x97, regular: 1000, bold: 1000 }, // em dash
  '–': { byte: 0x96, regular: 556, bold: 556 }, // en dash
  '’': { byte: 0x92, regular: 222, bold: 278 }, // right single quote
  '‘': { byte: 0x91, regular: 222, bold: 278 },
  '“': { byte: 0x93, regular: 333, bold: 500 },
  '”': { byte: 0x94, regular: 333, bold: 500 },
  '…': { byte: 0x85, regular: 1000, bold: 1000 }, // ellipsis
  '•': { byte: 0x95, regular: 350, bold: 350 }, // bullet
  '·': { byte: 0xb7, regular: 278, bold: 278 }, // middle dot, the separator RepOS uses
  '×': { byte: 0xd7, regular: 584, bold: 584 }, // multiplication sign, for dimensions
};

/** Anything with no WinAnsi byte becomes something a reader can still set. */
const TRANSLITERATE: Record<string, string> = {
  '₹': 'Rs', // rupee
  '→': '->',
  '★': '*',
  '☆': '*',
  ' ': ' ',
};

function charWidth(char: string, font: PdfFont): number {
  const code = char.charCodeAt(0);
  if (code >= 32 && code <= 126) return ASCII_WIDTHS[font][code - 32] ?? 556;
  const extra = WIN_ANSI[char];
  if (extra) return extra[font];
  // Latin-1 accented letters pass through as themselves; 556 is the width of
  // most of them in both faces and the error is under a millimetre.
  if (code >= 0xa1 && code <= 0xff) return font === 'bold' ? 611 : 556;
  return 0;
}

/** How wide this string sets, in millimetres, at this size. */
export function textWidthMm(
  text: string,
  font: PdfFont,
  sizePt: number,
  letterSpacingPt = 0,
): number {
  let em = 0;
  let count = 0;
  for (const char of normalise(text)) {
    const w = charWidth(char, font);
    if (w === 0) continue;
    em += w;
    count += 1;
  }
  const pt = (em / 1000) * sizePt + Math.max(0, count - 1) * letterSpacingPt;
  return pt / PT_PER_MM;
}

function normalise(text: string): string {
  let out = '';
  for (const char of text) {
    const replacement = TRANSLITERATE[char];
    out += replacement === undefined ? char : replacement;
  }
  return out;
}

/**
 * A PDF string literal: WinAnsi bytes, with the three characters that would
 * end the literal early escaped, and anything above ASCII written in octal so
 * the content stream stays plain ASCII and stays diffable.
 */
function pdfString(text: string): string {
  let out = '';
  for (const char of normalise(text)) {
    const code = char.charCodeAt(0);
    let byte: number | null = null;
    if (code >= 32 && code <= 126) byte = code;
    else if (WIN_ANSI[char]) byte = WIN_ANSI[char].byte;
    else if (code >= 0xa1 && code <= 0xff) byte = code;
    if (byte === null) continue;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte > 126) out += `\\${byte.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(byte);
  }
  return `(${out})`;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** #rrggbb, or the colour itself if it is already one of ours. */
export function rgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value) || full.length !== 6) return [0, 0, 0];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export type TextOptions = {
  font?: PdfFont;
  size?: number;
  colour?: string;
  align?: 'left' | 'centre' | 'right';
  /** Extra space between characters, in points. For small uppercase labels. */
  tracking?: number;
};

/**
 * One page, drawn in millimetres from the top-left.
 *
 * Every method appends to a content stream. Nothing is measured or laid out
 * for the caller: this is a drawing surface, and the tent layout that uses it
 * does its own arithmetic, where that arithmetic can be read and tested.
 */
export type InkBounds = { leftMm: number; topMm: number; rightMm: number; bottomMm: number };

export class PdfPage {
  readonly widthMm: number;
  readonly heightMm: number;
  private readonly ops: string[] = [];
  private ink: InkBounds | null = null;

  constructor(widthMm: number, heightMm: number) {
    this.widthMm = widthMm;
    this.heightMm = heightMm;
  }

  /**
   * The box every drawn thing fits inside, in the same top-down millimetres
   * the caller draws in — or null if nothing has been drawn.
   *
   * Kept because "nothing is clipped" is a property worth asserting rather
   * than eyeballing in a preview, and because the trim margins on the tent
   * sheet are exactly where a line of instructions quietly grows past the
   * paper.
   */
  bounds(): InkBounds | null {
    return this.ink ? { ...this.ink } : null;
  }

  private mark(leftMm: number, topMm: number, rightMm: number, bottomMm: number) {
    if (!this.ink) {
      this.ink = { leftMm, topMm, rightMm, bottomMm };
      return;
    }
    this.ink.leftMm = Math.min(this.ink.leftMm, leftMm);
    this.ink.topMm = Math.min(this.ink.topMm, topMm);
    this.ink.rightMm = Math.max(this.ink.rightMm, rightMm);
    this.ink.bottomMm = Math.max(this.ink.bottomMm, bottomMm);
  }

  /** Millimetres from the top, as points from the bottom. */
  private y(mm: number): number {
    return mmToPt(this.heightMm - mm);
  }

  rect(xMm: number, yMm: number, wMm: number, hMm: number, colour: string): this {
    const [r, g, b] = rgb(colour);
    this.ops.push(
      `${n(r)} ${n(g)} ${n(b)} rg`,
      `${n(mmToPt(xMm))} ${n(this.y(yMm + hMm))} ${n(mmToPt(wMm))} ${n(mmToPt(hMm))} re f`,
    );
    this.mark(xMm, yMm, xMm + wMm, yMm + hMm);
    return this;
  }

  line(
    x1Mm: number,
    y1Mm: number,
    x2Mm: number,
    y2Mm: number,
    options: { colour?: string; widthPt?: number; dash?: number[] } = {},
  ): this {
    const [r, g, b] = rgb(options.colour ?? '#000000');
    const dash = options.dash?.length ? `[${options.dash.map((d) => n(mmToPt(d))).join(' ')}] 0 d` : '[] 0 d';
    this.ops.push(
      `${n(r)} ${n(g)} ${n(b)} RG`,
      `${n(options.widthPt ?? 0.5)} w`,
      dash,
      `${n(mmToPt(x1Mm))} ${n(this.y(y1Mm))} m ${n(mmToPt(x2Mm))} ${n(this.y(y2Mm))} l S`,
      '[] 0 d',
    );
    this.mark(Math.min(x1Mm, x2Mm), Math.min(y1Mm, y2Mm), Math.max(x1Mm, x2Mm), Math.max(y1Mm, y2Mm));
    return this;
  }

  /** An unfilled rectangle, for a cut border. */
  frame(
    xMm: number,
    yMm: number,
    wMm: number,
    hMm: number,
    options: { colour?: string; widthPt?: number; dash?: number[] } = {},
  ): this {
    const [r, g, b] = rgb(options.colour ?? '#000000');
    const dash = options.dash?.length ? `[${options.dash.map((d) => n(mmToPt(d))).join(' ')}] 0 d` : '[] 0 d';
    this.ops.push(
      `${n(r)} ${n(g)} ${n(b)} RG`,
      `${n(options.widthPt ?? 0.5)} w`,
      dash,
      `${n(mmToPt(xMm))} ${n(this.y(yMm + hMm))} ${n(mmToPt(wMm))} ${n(mmToPt(hMm))} re S`,
      '[] 0 d',
    );
    this.mark(xMm, yMm, xMm + wMm, yMm + hMm);
    return this;
  }

  /** `yMm` is the BASELINE, which is how type is actually positioned. */
  text(value: string, xMm: number, yMm: number, options: TextOptions = {}): this {
    const font = options.font ?? 'regular';
    const size = options.size ?? 10;
    const tracking = options.tracking ?? 0;
    const [r, g, b] = rgb(options.colour ?? '#000000');
    const width = textWidthMm(value, font, size, tracking);
    const x =
      options.align === 'centre' ? xMm - width / 2 : options.align === 'right' ? xMm - width : xMm;
    this.ops.push(
      'BT',
      `${n(r)} ${n(g)} ${n(b)} rg`,
      `/${font === 'bold' ? 'F2' : 'F1'} ${n(size)} Tf`,
      `${n(tracking)} Tc`,
      `${n(mmToPt(x))} ${n(this.y(yMm))} Td`,
      `${pdfString(value)} Tj`,
      '0 Tc',
      'ET',
    );
    // Helvetica's ascender and descender, as a share of the em. Enough to know
    // whether a line of type has run off the paper.
    const ascent = (size * 0.718) / PT_PER_MM;
    const descent = (size * 0.207) / PT_PER_MM;
    this.mark(x, yMm - ascent, x + width, yMm + descent);
    return this;
  }

  /**
   * Draws `body` rotated 180 degrees about the centre of the given box.
   *
   * This is the whole trick of a folded tent. The half of the card above the
   * fold ends up hanging down the far side, so it is upside down relative to
   * the sheet it was printed on. Printing it pre-rotated is what makes both
   * faces read the right way up once the card is folded — and the caller can
   * lay that face out in ordinary top-down coordinates and forget about it.
   *
   * The matrix is a point reflection through the box centre: a 180-degree
   * rotation is exactly that, and expressing it as one `cm` avoids composing
   * three transforms and getting the order wrong.
   */
  rotatedHalfTurn(
    xMm: number,
    yMm: number,
    wMm: number,
    hMm: number,
    body: (page: PdfPage) => void,
  ): this {
    const cx = mmToPt(xMm + wMm / 2);
    const cy = this.y(yMm + hMm / 2);
    this.ops.push('q', `-1 0 0 -1 ${n(2 * cx)} ${n(2 * cy)} cm`);
    body(this);
    this.ops.push('Q');
    return this;
  }

  content(): string {
    return this.ops.join('\n');
  }
}

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

/**
 * Assembles pages into a PDF 1.4 file.
 *
 * Byte offsets in the cross-reference table have to be exact, so the body is
 * built as a list of chunks and measured as it goes rather than assembled and
 * searched afterwards.
 */
export function buildPdf(
  pages: PdfPage[],
  options: { title?: string } = {},
): Uint8Array<ArrayBuffer> {
  if (pages.length === 0) throw new Error('A PDF needs at least one page.');

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (index: number, body: string) => {
    offsets[index] = length;
    push(`${index} 0 obj\n${body}\nendobj\n`);
  };

  // 1 catalog · 2 pages · 3 info · then a page and a content stream each · then
  // the two fonts last, so their numbers are known before the pages reference
  // them.
  const first = 4;
  const fontRegular = first + pages.length * 2;
  const fontBold = fontRegular + 1;
  const total = fontBold + 1;

  push('%PDF-1.4\n');
  // A binary comment marks the file as binary for tools that sniff it.
  push('%âãÏÓ\n');

  object(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  object(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${first + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  object(
    3,
    `<< /Producer (RepOS) /Creator (RepOS)${options.title ? ` /Title ${pdfString(options.title)}` : ''} >>`,
  );

  pages.forEach((page, i) => {
    const pageIndex = first + i * 2;
    const streamIndex = pageIndex + 1;
    object(
      pageIndex,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(mmToPt(page.widthMm))} ${n(mmToPt(page.heightMm))}] ` +
        `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${streamIndex} 0 R >>`,
    );
    const stream = page.content();
    object(
      streamIndex,
      `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`,
    );
  });

  object(
    fontRegular,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  );
  object(
    fontBold,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  );

  const xref = length;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i += 1) {
    table += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  push(table);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(new ArrayBuffer(length));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
