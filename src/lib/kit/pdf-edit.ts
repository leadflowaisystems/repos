import { deflateSync, inflateSync } from 'node:zlib';

/**
 * A MINIMAL PDF REWRITER, FOR FILLING IN AN APPROVED MASTER.
 *
 * `pdf.ts` writes a PDF from nothing. This does the opposite job: it opens a
 * finished, signed-off PDF, swaps a named object or two, and writes it back
 * out. Everything it does not touch comes through byte for byte — the same
 * fonts, the same colours, the same coordinates, the same graphics — which is
 * the whole reason it exists. The approved print masters are artwork, not
 * templates, and the only honest way to put a business's own name and code on
 * one is to change those two things and leave the other hundred alone.
 *
 * WHAT IT UNDERSTANDS, AND NOTHING MORE. A PDF with a classic cross-reference
 * table, direct `/Length` values, and no object streams — which is what the
 * masters are. Anything else throws rather than guesses, because a rewriter
 * that silently mangles a print file is worse than one that refuses.
 */

/** One top-level object, kept as the exact bytes it came in as. */
export type PdfObject = {
  number: number;
  /** Everything between `N 0 obj` and `endobj`, verbatim. */
  body: Uint8Array;
};

export type PdfFile = {
  /** `%PDF-1.4` and the binary comment line, kept as-is. */
  header: Uint8Array;
  /** In the order they appeared, which is the order they are written back. */
  objects: PdfObject[];
  /** `/Root`, `/Info` and `/ID` as they appeared. `/Size` is recomputed. */
  trailer: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder('latin1');

/** latin1 in and out, so a byte is a byte and nothing is re-encoded. */
export function bytesToLatin1(bytes: Uint8Array): string {
  return dec.decode(bytes);
}

export function latin1ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Splits a PDF into its top-level objects.
 *
 * Stream payloads are skipped by their declared `/Length` rather than by
 * looking for `endstream`, because compressed image data contains every byte
 * sequence eventually — including the word `endobj`. That is the bug this
 * function is written to avoid.
 */
export function parsePdf(bytes: Uint8Array): PdfFile {
  const s = bytesToLatin1(bytes);
  if (!s.startsWith('%PDF-')) throw new Error('Not a PDF: no %PDF- header.');
  if (/\/Type\s*\/ObjStm/.test(s) || /\/Type\s*\/XRef/.test(s)) {
    throw new Error('This PDF uses object or cross-reference streams, which this rewriter does not read.');
  }

  const firstObj = s.search(/(^|[\r\n])\d+ 0 obj/);
  if (firstObj < 0) throw new Error('This PDF has no objects.');
  const headerEnd = s[firstObj] === '\r' || s[firstObj] === '\n' ? firstObj + 1 : firstObj;
  const header = bytes.subarray(0, headerEnd);

  const objects: PdfObject[] = [];
  const start = /(?:^|[\r\n])(\d+) 0 obj/g;
  start.lastIndex = headerEnd - 1 < 0 ? 0 : headerEnd - 1;

  let match: RegExpExecArray | null;
  while ((match = start.exec(s))) {
    const number = Number(match[1]);
    const bodyFrom = match.index + match[0].length;
    // A stream's payload is opaque, so step over it by its declared length.
    const streamAt = s.indexOf('stream', bodyFrom);
    const dictEnd = s.indexOf('>>', bodyFrom);
    let searchFrom = bodyFrom;
    if (streamAt > -1 && dictEnd > -1 && streamAt < dictEnd + 4) {
      const dict = s.slice(bodyFrom, streamAt);
      const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      if (!length) {
        throw new Error(`Object ${number} has a stream whose /Length is not a plain number.`);
      }
      let payload = streamAt + 'stream'.length;
      if (s[payload] === '\r') payload += 1;
      if (s[payload] === '\n') payload += 1;
      searchFrom = payload + Number(length[1]);
    }
    const end = s.indexOf('endobj', searchFrom);
    if (end < 0) throw new Error(`Object ${number} is never closed.`);
    objects.push({ number, body: bytes.subarray(bodyFrom, end) });
    start.lastIndex = end;
  }

  const trailerAt = s.lastIndexOf('trailer');
  if (trailerAt < 0) throw new Error('This PDF has no trailer.');
  const trailer = s.slice(trailerAt + 'trailer'.length, s.indexOf('startxref', trailerAt));

  return { header, objects, trailer };
}

/** The object a `/Name`d resource, or a `/Type`, belongs to. */
export function findObject(
  file: PdfFile,
  test: (body: string, object: PdfObject) => boolean,
): PdfObject | null {
  for (const object of file.objects) {
    if (test(bytesToLatin1(object.body), object)) return object;
  }
  return null;
}

export function objectByNumber(file: PdfFile, number: number): PdfObject | null {
  return file.objects.find((o) => o.number === number) ?? null;
}

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

function decodeAscii85(text: string): Uint8Array {
  let body = text.replace(/\s+/g, '');
  const end = body.indexOf('~>');
  if (end >= 0) body = body.slice(0, end);
  const out: number[] = [];
  let tuple: number[] = [];
  for (const char of body) {
    if (char === 'z' && tuple.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    tuple.push(char.charCodeAt(0) - 33);
    if (tuple.length === 5) {
      let value = 0;
      for (const t of tuple) value = value * 85 + t;
      out.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
      tuple = [];
    }
  }
  if (tuple.length > 0) {
    const held = tuple.length;
    while (tuple.length < 5) tuple.push(84);
    let value = 0;
    for (const t of tuple) value = value * 85 + t;
    const four = [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
    for (let i = 0; i < held - 1; i += 1) out.push(four[i] as number);
  }
  return new Uint8Array(out);
}

/** An object's stream payload, with its filters undone. */
export function readStream(object: PdfObject): { dict: string; data: Uint8Array } {
  const s = bytesToLatin1(object.body);
  const streamAt = s.indexOf('stream');
  if (streamAt < 0) throw new Error(`Object ${object.number} has no stream.`);
  const dict = s.slice(0, streamAt);
  let from = streamAt + 'stream'.length;
  if (s[from] === '\r') from += 1;
  if (s[from] === '\n') from += 1;
  const length = /\/Length\s+(\d+)/.exec(dict);
  if (!length) throw new Error(`Object ${object.number} has no plain /Length.`);
  let data: Uint8Array = object.body.subarray(from, from + Number(length[1]));
  if (/ASCII85Decode/.test(dict)) data = decodeAscii85(bytesToLatin1(data));
  if (/FlateDecode/.test(dict)) data = new Uint8Array(inflateSync(data));
  return { dict, data };
}

/**
 * Replaces an object with a stream, keeping every key of its dictionary except
 * the ones the new payload changes.
 *
 * `/Filter` becomes a single `/FlateDecode`, or is dropped entirely when the
 * payload is small enough to leave readable — an uncompressed content stream
 * can be diffed by a person, which is worth a few kilobytes on a file this
 * size.
 */
export function replaceStream(
  object: PdfObject,
  data: Uint8Array,
  options: { compress: boolean; dictOverrides?: Record<string, string> } = { compress: true },
): void {
  const { dict } = readStream(object);
  let inner = dict.slice(dict.indexOf('<<') + 2, dict.lastIndexOf('>>'));

  // Drop the keys this rewrite owns, then put back the ones it decides.
  inner = inner
    .replace(/\/Length\s+\d+/g, '')
    .replace(/\/Filter\s*\[[^\]]*\]/g, '')
    .replace(/\/Filter\s*\/\w+/g, '');
  for (const key of Object.keys(options.dictOverrides ?? {})) {
    inner = inner.replace(new RegExp(`/${key}\\s+[^/>\\s]+`, 'g'), '');
  }

  const payload = options.compress ? new Uint8Array(deflateSync(data, { level: 9 })) : data;
  const overrides = Object.entries(options.dictOverrides ?? {})
    .map(([key, value]) => `/${key} ${value}`)
    .join(' ');

  const head =
    `<< ${inner.trim().replace(/\s+/g, ' ')} ${overrides} ` +
    `${options.compress ? '/Filter /FlateDecode ' : ''}/Length ${payload.length} >>\nstream\n`;
  const tail = '\nendstream\n';

  const bytes = new Uint8Array(enc.encode(head).length + payload.length + tail.length);
  const headBytes = enc.encode(head);
  bytes.set(headBytes, 0);
  bytes.set(payload, headBytes.length);
  bytes.set(latin1ToBytes(tail), headBytes.length + payload.length);
  object.body = bytes;
}

/** Replaces an object that has no stream — an Info dictionary, say. */
export function replaceBody(object: PdfObject, body: string): void {
  object.body = latin1ToBytes(`\n${body}\n`);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Writes the file back out with a fresh cross-reference table.
 *
 * Byte offsets have to be exact and every object's length has changed, so the
 * body is assembled as a list of chunks and measured as it goes rather than
 * built and searched afterwards. Object numbers are preserved, because every
 * `N 0 R` reference inside the untouched objects still points at them.
 */
export function serialisePdf(file: PdfFile): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const pushText = (text: string) => push(latin1ToBytes(text));

  push(file.header);

  const highest = Math.max(...file.objects.map((o) => o.number));
  const offsets = new Array<number>(highest + 1).fill(0);

  for (const object of file.objects) {
    offsets[object.number] = length;
    pushText(`${object.number} 0 obj`);
    push(object.body);
    pushText('endobj\n');
  }

  const xref = length;
  let table = `xref\n0 ${highest + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= highest; i += 1) {
    table += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pushText(table);

  // The original trailer, minus its own /Size, which no longer holds.
  const kept = file.trailer
    .replace(/\/Size\s+\d+/g, '')
    .replace(/%[^\r\n]*/g, '')
    .trim();
  const inner = kept.startsWith('<<') ? kept.slice(2, kept.lastIndexOf('>>')) : kept;
  pushText(
    `trailer\n<< ${inner.trim().replace(/\s+/g, ' ')} /Size ${highest + 1} >>\n` +
      `startxref\n${xref}\n%%EOF\n`,
  );

  const out = new Uint8Array(new ArrayBuffer(length));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out as Uint8Array<ArrayBuffer>;
}
