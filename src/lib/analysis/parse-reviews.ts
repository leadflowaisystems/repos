import { cleanReviewText, looksLikePersonName } from '@/lib/redact';
import { detectLanguage, type LanguageCode } from './language';

/**
 * Turns a block of pasted public reviews into structured, PII-free items.
 *
 * Everything here is deterministic. The parser preserves a star rating and a
 * date only when they are actually present in the pasted text — it never
 * guesses one, because a fabricated rating would poison every downstream count.
 */

export type ParsedReview = {
  text: string;
  stars: number | null;
  reviewDate: Date | null;
  language: LanguageCode;
  redacted: boolean;
  redactedCategories: string[];
};

export type ParseSummary = {
  reviews: ParsedReview[];
  totalBlocks: number;
  withStars: number;
  withDates: number;
  redactedCount: number;
  skippedEmpty: number;
};

const SEPARATOR_RE = /^\s*(?:-{3,}|_{3,}|={3,}|\*{3,})\s*$/;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

/** "★★★★☆", "5 stars", "4/5", "Rating: 3", "3.0 star rating" */
function extractStars(block: string): { stars: number | null; cleaned: string } {
  let cleaned = block;
  let stars: number | null = null;

  const filled = (block.match(/★/g) ?? []).length;
  if (filled >= 1 && filled <= 5) {
    stars = filled;
    cleaned = cleaned.replace(/[★☆]/g, ' ');
  }

  if (stars === null) {
    const patterns: RegExp[] = [
      /\b([1-5])(?:\.0)?\s*(?:\/\s*5)\b/i,
      /\b([1-5])(?:\.0)?\s*stars?\b/i,
      /\bstars?\s*[:\-]?\s*([1-5])(?:\.0)?\b/i,
      /\brating\s*[:\-]?\s*([1-5])(?:\.0)?\b/i,
      /^\s*([1-5])(?:\.0)?\s*[-–—|:]\s+/,
    ];
    for (const re of patterns) {
      const m = cleaned.match(re);
      if (m && m[1] !== undefined) {
        stars = Number.parseInt(m[1], 10);
        cleaned = cleaned.replace(re, ' ');
        break;
      }
    }
  }

  return { stars, cleaned };
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const targetDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(targetDay, lastDay));
  return d;
}

/**
 * Dates are resolved against an explicit reference date (the snapshot capture
 * date), never against "now" — so re-parsing the same paste always produces the
 * same result.
 */
function extractDate(
  block: string,
  reference: Date,
): { date: Date | null; cleaned: string } {
  let cleaned = block;

  // Relative: "2 weeks ago", "a month ago", "3 years ago"
  const rel = cleaned.match(
    /\b(a|an|\d{1,3})\s+(day|week|month|year)s?\s+ago\b/i,
  );
  if (rel && rel[1] !== undefined && rel[2] !== undefined) {
    const rawN = rel[1].toLowerCase();
    const n = rawN === 'a' || rawN === 'an' ? 1 : Number.parseInt(rawN, 10);
    const unit = rel[2].toLowerCase();
    let date: Date;
    if (unit === 'day') {
      date = new Date(reference.getTime() - n * 86_400_000);
    } else if (unit === 'week') {
      date = new Date(reference.getTime() - n * 7 * 86_400_000);
    } else if (unit === 'month') {
      date = addMonths(reference, -n);
    } else {
      date = addMonths(reference, -n * 12);
    }
    cleaned = cleaned.replace(rel[0], ' ');
    return { date, cleaned };
  }

  // ISO: 2025-03-12
  const iso = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso && iso[1] && iso[2] && iso[3]) {
    const d = new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
    if (!Number.isNaN(d.getTime())) {
      cleaned = cleaned.replace(iso[0], ' ');
      return { date: d, cleaned };
    }
  }

  // Day-first: 12/03/2025 or 12-03-2025 (Indian convention)
  const dmy = cleaned.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(Number(dmy[3]), month - 1, day));
      if (!Number.isNaN(d.getTime())) {
        cleaned = cleaned.replace(dmy[0], ' ');
        return { date: d, cleaned };
      }
    }
  }

  // "12 March 2025" / "March 2025" / "Mar 12, 2025"
  const named = cleaned.match(
    /\b(?:(\d{1,2})\s+)?([A-Za-z]{3,9})\.?\s+(?:(\d{1,2}),?\s+)?(\d{4})\b/,
  );
  if (named && named[2] && named[4]) {
    const monthIdx = MONTHS[named[2].toLowerCase()];
    if (monthIdx !== undefined) {
      const day = named[1] ? Number(named[1]) : named[3] ? Number(named[3]) : 1;
      const d = new Date(Date.UTC(Number(named[4]), monthIdx, day));
      if (!Number.isNaN(d.getTime())) {
        cleaned = cleaned.replace(named[0], ' ');
        return { date: d, cleaned };
      }
    }
  }

  return { date: null, cleaned };
}

/**
 * True when a line carries only metadata (a rating, a date) and no review text.
 * Platform copy-paste puts these on their own lines above the review body.
 */
export function isMetadataOnlyLine(line: string): boolean {
  const stripped = line
    .replace(/[★☆]/g, '')
    .replace(/\b\d(?:\.\d)?\s*(?:\/\s*5)?\s*stars?\b/gi, '')
    .replace(/\bstars?\s*[:-]?\s*\d\b/gi, '')
    .replace(/\brating\s*[:-]?\s*\d(?:\.\d)?\b/gi, '')
    .replace(/\b(?:a|an|\d{1,3})\s+(?:day|week|month|year)s?\s+ago\b/gi, '')
    .replace(/\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/g, '')
    .replace(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\b/gi,
      '',
    )
    .replace(/\P{L}+/gu, '');
  return stripped.length === 0;
}


/**
 * Removes a leading bullet or list number. Like quotes, these are the
 * operator's formatting rather than something the customer wrote, and leaving
 * them in would put "- " at the front of the stored feedback.
 */
export function stripLeadingBullet(text: string): string {
  return text.replace(/^\s*(?:[-*•]\s+|\d{1,3}[.)]\s+)/, '').trim();
}

/**
 * Removes quotes wrapping a whole block. Operators commonly paste reviews as
 * quoted strings, one per line; the quotes are formatting, not content.
 * Straight, curly and low-9 quotation marks are all handled.
 */
export function stripWrappingQuotes(text: string): string {
  let out = text.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
    ['„', '“'],
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of pairs) {
      if (out.length >= 2 && out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(1, -1).trim();
        changed = true;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Segmentation: deciding where one review ends and the next begins
// ---------------------------------------------------------------------------
//
// This is the most consequential decision the parser makes. Every downstream
// count — sentiment shares, theme mentions, trends — is computed per review, so
// a wrong boundary distorts the statistics permanently.
//
// The rules are structural and applied in priority order. There is no
// length-based guessing anywhere.
//
//   1. Explicit separators (---, ___, ===, ***) are hard boundaries.
//   2. Blank lines are hard boundaries.
//   3. Inside a block, MARKER lines start a new review: a rating/date header on
//      its own line, a leading quotation mark, a leading inline rating, or a
//      bullet/number. A marker only starts a new review once the review being
//      built already has content, so "Name / 5 stars / 2 weeks ago / text"
//      stays one review.
//   4. A block with no markers at all is ambiguous. Which way we resolve it is
//      decided by how the operator structured the WHOLE paste:
//        - If the paste uses blank lines or separators anywhere, those are the
//          operator's chosen delimiter, so unmarked lines inside a block are a
//          wrapped review and are kept TOGETHER.
//        - If the paste has no delimiters at all, the line break IS the
//          delimiter, so each line is its own review — except lines that are
//          plainly sentence fragments (lowercase start, leading conjunction, or
//          a previous line ending mid-clause).
//
// Rule 4 implements the standing instruction: when the parser cannot tell, it
// keeps text together rather than inventing extra reviews.

/** `"…"`, `“…”`, `‘…’`, `„…“` — a quoted line is its own review. */
function startsWithQuote(line: string): boolean {
  return /^["“‘„']/.test(line.trim());
}

/** `★★★★★ Great`, `5 stars - great`, `4/5 quick`, `Rating: 3 average`, `5 | great`. */
function startsWithInlineRating(line: string): boolean {
  const trimmed = line.trim();
  if (/^[★☆]/.test(trimmed)) return true;
  if (/^[1-5](?:\.0)?\s*(?:\/\s*5)?\s*stars?\b/i.test(trimmed)) return true;
  if (/^rating\s*[:\-]\s*[1-5]/i.test(trimmed)) return true;
  if (/^[1-5](?:\.0)?\s*[-–—|:]\s+\S/.test(trimmed)) return true;
  return false;
}

/** `- text`, `* text`, `• text`, `1. text`, `2) text`. */
function startsWithBullet(line: string): boolean {
  return /^(?:[-*•]\s+|\d{1,3}[.)]\s+)/.test(line.trim());
}

/**
 * A line that structurally announces the start of a new review, by any of the
 * signals above or by being a bare rating/date header or a reviewer name.
 */
function isMarkerLine(line: string): boolean {
  return (
    isMetadataOnlyLine(line) ||
    looksLikePersonName(line) ||
    startsWithQuote(line) ||
    startsWithInlineRating(line) ||
    startsWithBullet(line)
  );
}

/** Header lines carry no review text of their own. */
function isHeaderOnly(line: string): boolean {
  return isMetadataOnlyLine(line) || looksLikePersonName(line);
}

/** Words that can only continue a sentence, never open a review. */
const CONTINUATION_WORDS =
  /^(?:and|but|or|so|because|although|though|however|also|plus|which|who|that|then|while|whereas|since|yet|still|even|as)\b/i;

/** A previous line left dangling mid-clause. */
const DANGLING_END = /(?:[,;:—–-]|\b(?:and|but|or|so|because|with|the|a|an|to|of|for|in|on|at)\s*)$/i;

/**
 * True when `line` is plainly a continuation of `previous` rather than a new
 * review. Only used in the no-delimiter case, and only on unambiguous signals.
 */
function isContinuationLine(line: string, previous: string): boolean {
  // Opening with a conjunction can only continue a sentence.
  if (CONTINUATION_WORDS.test(line.trim())) return true;
  // The previous line stopped mid-clause, so this one finishes it.
  if (DANGLING_END.test(previous.trim())) return true;
  // A bare lowercase opening is deliberately NOT enough on its own: informal
  // one-per-line pastes are frequently uncapitalised, and treating those as
  // continuations would merge genuinely separate reviews.
  return false;
}

type DelimiterMode = 'DELIMITED' | 'LINE_PER_REVIEW';

/**
 * Splits one block's lines into reviews.
 *
 * `mode` says how the operator structured the paste as a whole, which is what
 * resolves a block containing no markers.
 */
export function segmentLines(lines: string[], mode: DelimiterMode): string[] {
  const cleaned = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (cleaned.length === 0) return [];
  if (cleaned.length === 1) return cleaned;

  // --- Rule 3: marker-delimited -------------------------------------------
  if (cleaned.some(isMarkerLine)) {
    const reviews: string[] = [];
    let current: string[] = [];
    let currentHasContent = false;
    // True when this review began with a bare header line (a reviewer name, or
    // a rating/date on its own). A header opens a review that stays open until
    // the next marker, so its wrapped body is never split.
    let openedByHeader = false;

    const flush = () => {
      if (current.length > 0) reviews.push(current.join('\n'));
      current = [];
      currentHasContent = false;
      openedByHeader = false;
    };

    for (const line of cleaned) {
      const previous = current[current.length - 1];

      if (isMarkerLine(line)) {
        // A marker only closes the previous review once that review actually
        // has text, so stacked headers stay attached to the text below them.
        if (currentHasContent) flush();
      } else if (
        mode === 'LINE_PER_REVIEW' &&
        currentHasContent &&
        !openedByHeader &&
        previous !== undefined &&
        !isContinuationLine(line, previous)
      ) {
        // No delimiters were used anywhere, and this review was not opened by a
        // header, so an unmarked line is its own review rather than a wrapped
        // body — otherwise a marker-less review among marked ones is swallowed.
        flush();
      }

      if (current.length === 0 && isHeaderOnly(line)) openedByHeader = true;
      current.push(line);
      if (!isHeaderOnly(line)) currentHasContent = true;
    }
    flush();
    return reviews;
  }

  // --- Rule 4: no markers anywhere in this block ---------------------------
  if (mode === 'DELIMITED') {
    // The operator delimited reviews with blank lines or separators, so these
    // lines are one review wrapped across several. Keep them together.
    return [cleaned.join('\n')];
  }

  // No delimiters were used anywhere: the line break is the delimiter.
  const reviews: string[] = [];
  let current: string[] = [];
  for (const line of cleaned) {
    const previous = current[current.length - 1];
    if (previous !== undefined && isContinuationLine(line, previous)) {
      current.push(line);
      continue;
    }
    if (current.length > 0) reviews.push(current.join('\n'));
    current = [line];
  }
  if (current.length > 0) reviews.push(current.join('\n'));
  return reviews;
}

/** Splits a paste into candidate blocks: separators, blank lines, then lines. */
export function splitBlocks(raw: string): string[] {
  const normalised = raw.replace(/\r\n/g, '\n').trim();
  if (normalised.length === 0) return [];

  // Rule 1 — explicit separators.
  const parts = normalised
    .split('\n')
    .reduce<string[][]>(
      (acc, line) => {
        if (SEPARATOR_RE.test(line)) {
          acc.push([]);
        } else {
          const current = acc[acc.length - 1];
          if (current) current.push(line);
        }
        return acc;
      },
      [[]],
    )
    .map((lines) => lines.join('\n').trim())
    .filter((part) => part.length > 0);

  const usedSeparators = parts.length > 1;
  const usedBlankLines = parts.some((part) => /\n\s*\n/.test(part));

  // Whether the operator delimited reviews explicitly anywhere in this paste.
  const mode: DelimiterMode =
    usedSeparators || usedBlankLines ? 'DELIMITED' : 'LINE_PER_REVIEW';

  const blocks: string[] = [];
  for (const part of parts) {
    // Rule 2 — blank lines.
    const groups = /\n\s*\n/.test(part)
      ? part
          .split(/\n\s*\n+/)
          .map((g) => g.trim())
          .filter((g) => g.length > 0)
      : [part];

    for (const group of groups) {
      blocks.push(...segmentLines(group.split('\n'), mode));
    }
  }

  return blocks;
}

/**
 * Parses pasted reviews into structured items.
 *
 * @param raw           the pasted text
 * @param referenceDate anchor for relative dates ("2 weeks ago")
 */
export function parseReviews(raw: string, referenceDate: Date): ParseSummary {
  const blocks = splitBlocks(raw);
  const reviews: ParsedReview[] = [];
  let skippedEmpty = 0;

  for (const block of blocks) {
    const starResult = extractStars(block);
    const dateResult = extractDate(starResult.cleaned, referenceDate);
    const cleanedResult = cleanReviewText(dateResult.cleaned);

    const text = stripLeadingBullet(
      stripWrappingQuotes(
        stripLeadingBullet(cleanedResult.text.replace(/[ 	]{2,}/g, ' ').trim()),
      ),
    );

    // A block that was nothing but a phone number or an email is empty once
    // redacted — the placeholder must not be counted as a review.
    const meaningful = text
      .replace(/\[(?:email|number|handle) removed\]/g, '')
      .replace(/\P{L}+/gu, '');
    if (meaningful.length < 2) {
      skippedEmpty += 1;
      continue;
    }

    reviews.push({
      text,
      stars: starResult.stars,
      reviewDate: dateResult.date,
      language: detectLanguage(text),
      redacted: cleanedResult.redacted,
      redactedCategories: cleanedResult.removed,
    });
  }

  return {
    reviews,
    totalBlocks: blocks.length,
    withStars: reviews.filter((r) => r.stars !== null).length,
    withDates: reviews.filter((r) => r.reviewDate !== null).length,
    redactedCount: reviews.filter((r) => r.redacted).length,
    skippedEmpty,
  };
}
