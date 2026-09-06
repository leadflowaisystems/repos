import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { parseReviews } from '@/lib/analysis/parse-reviews';
import { cleanReviewText } from '@/lib/redact';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { analysisStateOf, type AnalysisState } from '@/lib/feedback/state';
import { readDimensions, readStructured } from '@/lib/feedback/structured';
import { parseJson } from '@/lib/format';
import { fingerprintFeedback } from './fingerprint';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { DRAFT_VERSION } from '@/lib/reply/draft';
import type { NormalizedTheme } from '@/lib/analysis/normalize';

/**
 * FEEDBACK INTAKE (M5).
 *
 * Gets customer feedback into RepOS safely. That is the whole job.
 *
 * This layer does NOT classify: no sentiment, no themes, no language. Items
 * land unanalysed and the analysis layer picks them up later. Keeping that
 * boundary clean is what lets intake stay fast and dumb.
 *
 * Universal: identical for every vertical. The client's pack influences later
 * analysis, never intake.
 *
 * Nothing here fetches anything. Every item arrives because the operator
 * pasted or typed it.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = {
  ok: false;
  message: string;
  errors: Record<string, string>;
};
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

/**
 * Where the operator got the feedback. Generic on purpose — no platform is
 * privileged, and RepOS integrates with none of them.
 */
export const FEEDBACK_SOURCES = [
  'PUBLIC_REVIEW',
  'PRIVATE_FEEDBACK',
  'MANUAL_ENTRY',
  'OTHER',
] as const;

export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

/**
 * Sources that arrive on their own rather than through the paste box (M14).
 *
 * REP_OS_QR is the customer feedback page. The same column carries every
 * source, so a future one is a new value here and nothing else — the row,
 * the analysis and the intelligence are shared. No platform is named.
 */
export const DIRECT_SOURCES = ['REP_OS_QR'] as const;

export type DirectSource = (typeof DIRECT_SOURCES)[number];

/** Every value the `source` column may hold. */
export const INGEST_SOURCES = [...FEEDBACK_SOURCES, ...DIRECT_SOURCES] as const;

export type IngestSource = (typeof INGEST_SOURCES)[number];

export const SOURCE_LABELS: Record<IngestSource, string> = {
  PUBLIC_REVIEW: 'Public review',
  PRIVATE_FEEDBACK: 'Private feedback',
  MANUAL_ENTRY: 'Manual entry',
  OTHER: 'Other',
  REP_OS_QR: 'Feedback QR',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as IngestSource] ?? source;
}

/**
 * Whether anyone can be replied to. A customer who scanned the QR gave no
 * name and no contact, and their words are private, so there is no review to
 * answer. The reply layer reads this rather than guessing from the source.
 */
export function hasReplyChannel(source: string): boolean {
  return source !== 'REP_OS_QR';
}

export function sourceOptions(): Array<{ value: string; label: string }> {
  return FEEDBACK_SOURCES.map((value) => ({ value, label: SOURCE_LABELS[value] }));
}

// ---------------------------------------------------------------------------
// Input contracts
// ---------------------------------------------------------------------------

export const batchInputSchema = z.object({
  raw: z
    .string()
    .min(2, 'Paste some feedback first.')
    .max(500_000, 'That is too much to paste at once — split it into batches.'),
  source: z.enum(FEEDBACK_SOURCES, { message: 'Choose where this came from.' }),
  /** Anchors relative dates like "2 weeks ago" so parsing is reproducible. */
  referenceDate: z.date({ message: 'Enter a valid date.' }),
});

export const singleInputSchema = z.object({
  text: z
    .string()
    .min(2, 'Write or paste the feedback text.')
    .max(20_000, 'That is too long for a single item.'),
  stars: z
    .number()
    .int('Rating must be a whole number of stars.')
    .min(1, 'Rating must be between 1 and 5.')
    .max(5, 'Rating must be between 1 and 5.')
    .nullable(),
  reviewDate: z.date({ message: 'Enter a valid date.' }).nullable(),
  source: z.enum(FEEDBACK_SOURCES, { message: 'Choose where this came from.' }),
});

function zodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportResult = {
  /** Blocks the parser found in the paste. */
  found: number;
  imported: number;
  skippedDuplicates: number;
  /** Items that had something stripped before storage. */
  redacted: number;
  /** Blocks that were empty once cleaned — usually a stray rating line. */
  skippedEmpty: number;
  withRating: number;
  withDate: number;
  /** Distinct categories of PII removed, for the operator's reassurance. */
  redactionCategories: string[];
};

const EMPTY_RESULT: ImportResult = {
  found: 0,
  imported: 0,
  skippedDuplicates: 0,
  redacted: 0,
  skippedEmpty: 0,
  withRating: 0,
  withDate: 0,
  redactionCategories: [],
};

/**
 * Imports a pasted batch.
 *
 * Duplicates are skipped both within the batch and against what the client
 * already has, and the count is reported rather than hidden.
 */
export async function importFeedbackBatch(
  db: PrismaClient,
  clientId: string,
  raw: unknown,
): Promise<ServiceResult<ImportResult>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) return err('That client no longer exists.');

  const parsed = batchInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Check the paste box.', zodErrors(parsed.error.issues));
  }

  const input = parsed.data;
  const parseSummary = parseReviews(input.raw, input.referenceDate);

  if (parseSummary.reviews.length === 0) {
    return err(
      'Nothing usable was found in that paste. Put one review per line, or separate them with a blank line.',
      { raw: 'No feedback could be read from that text.' },
    );
  }

  // Everything this client already holds, so re-pasting a batch is safe.
  const existing = await db.reviewItem.findMany({
    where: { clientId },
    select: { fingerprint: true },
  });
  const seen = new Set(existing.map((r) => r.fingerprint).filter((f) => f.length > 0));

  const highest = await db.reviewItem.aggregate({
    where: { clientId },
    _max: { sortIndex: true },
  });
  let sortIndex = (highest._max.sortIndex ?? -1) + 1;

  const toCreate: Array<{
    clientId: string;
    text: string;
    stars: number | null;
    reviewDate: Date | null;
    source: string;
    fingerprint: string;
    redacted: boolean;
    redactionsJson: string;
    sortIndex: number;
  }> = [];

  const result: ImportResult = {
    ...EMPTY_RESULT,
    found: parseSummary.totalBlocks,
    skippedEmpty: parseSummary.skippedEmpty,
  };
  const categories = new Set<string>();

  for (const review of parseSummary.reviews) {
    const fingerprint = fingerprintFeedback(review.text);
    if (fingerprint.length === 0) {
      result.skippedEmpty += 1;
      continue;
    }
    if (seen.has(fingerprint)) {
      result.skippedDuplicates += 1;
      continue;
    }
    seen.add(fingerprint);

    for (const category of review.redactedCategories) categories.add(category);
    if (review.redacted) result.redacted += 1;
    if (review.stars !== null) result.withRating += 1;
    if (review.reviewDate !== null) result.withDate += 1;

    toCreate.push({
      clientId,
      text: review.text,
      stars: review.stars,
      reviewDate: review.reviewDate,
      source: input.source,
      fingerprint,
      redacted: review.redacted,
      redactionsJson: JSON.stringify(review.redactedCategories),
      sortIndex: sortIndex++,
    });
  }

  if (toCreate.length > 0) {
    await db.reviewItem.createMany({ data: toCreate });
  }

  result.imported = toCreate.length;
  result.redactionCategories = [...categories].sort();
  return ok(result);
}

/** Adds one item typed or pasted by hand. */
export async function createFeedbackItem(
  db: PrismaClient,
  clientId: string,
  raw: unknown,
): Promise<ServiceResult<{ id: string; duplicate: boolean; redacted: boolean }>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) return err('That client no longer exists.');

  const parsed = singleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }

  const input = parsed.data;
  const cleaned = cleanReviewText(input.text);
  const text = cleaned.text.replace(/\s{2,}/g, ' ').trim();

  const fingerprint = fingerprintFeedback(text);
  if (fingerprint.length === 0) {
    return err('There was no usable text left after removing personal details.', {
      text: 'Add some feedback text.',
    });
  }

  const duplicate = await db.reviewItem.findFirst({
    where: { clientId, fingerprint },
    select: { id: true },
  });
  if (duplicate) {
    return err('This client already has that exact feedback.', {
      text: 'A feedback item with identical wording is already saved.',
    });
  }

  const highest = await db.reviewItem.aggregate({
    where: { clientId },
    _max: { sortIndex: true },
  });

  const created = await db.reviewItem.create({
    data: {
      clientId,
      text,
      stars: input.stars,
      reviewDate: input.reviewDate,
      source: input.source,
      fingerprint,
      redacted: cleaned.redacted,
      redactionsJson: JSON.stringify(cleaned.removed),
      sortIndex: (highest._max.sortIndex ?? -1) + 1,
    },
    select: { id: true },
  });

  return ok({ id: created.id, duplicate: false, redacted: cleaned.redacted });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type FeedbackRow = {
  id: string;
  clientId: string;
  text: string;
  preview: string;
  stars: number | null;
  reviewDate: Date | null;
  source: string;
  sourceLabel: string;
  redacted: boolean;
  redactions: string[];
  analysed: boolean;
  /** Where it stands with RepOS: COLLECTED · PROCESSING · ANALYSED · FAILED. */
  state: AnalysisState;
  createdAt: Date;
  // --- analysis layer ---
  sentiment: string;
  themes: NormalizedTheme[];
  confidence: string;
  reasons: string[];
  language: string | null;
  analysisError: string | null;
  // --- reply layer ---
  responseClass: string;
  responseAction: string;
  priorityBand: string;
  priorityRank: number;
  priorityReasons: string[];
  draftText: string | null;
  draftLanguage: string | null;
  draftSource: string;
  draftStatus: string;
  /** False once the writer has moved on: the stored draft is stale. */
  draftCurrent: boolean;
  draftNotes: string[];
  draftError: string | null;
  handledAt: Date | null;
  /**
   * What the customer tapped (M19), resolved against the client's pack so the
   * operator reads labels rather than keys. Empty for a pasted review and for
   * anything stored before M19.
   */
  answers: Array<{ key: string; label: string; rating: number; signals: string[] }>;
};

const PREVIEW_LENGTH = 150;

/**
 * A customer may leave a rating and no words (M14). The row's text is empty
 * and stays empty — nothing is invented in the customer's voice — and every
 * list shows this line in its place.
 */
export const RATING_ONLY_PREVIEW = 'Rating only — no written comment.';

/**
 * The same line for a customer who answered the vertical's questions (M19).
 *
 * "Rating only" undersells five deliberate answers, and an operator scanning
 * a list needs to know the difference between a row holding one tap and a row
 * holding six.
 */
export function ratingOnlyPreview(rated: number): string {
  return `Rated ${rated} question${rated === 1 ? '' : 's'} — no written comment.`;
}

/**
 * The tapped answers, worded as the pack words them today (M19).
 *
 * Labels are resolved at read time for the same reason theme labels are: the
 * key is what was stored and is authoritative, the wording is only how it is
 * shown, and improving a vertical's wording has to reach feedback that is
 * already in the database. A key the pack has since dropped is left out
 * rather than shown as a bare key the operator cannot read.
 */
function answersFor(
  row: { dimensionsJson?: string | null; signalsJson?: string | null },
  pack: Pack | undefined,
): FeedbackRow['answers'] {
  const dimensions = pack?.gateway?.dimensions ?? [];
  if (dimensions.length === 0) return [];

  const structured = readStructured(row);
  const tapped = new Set(structured.signals);
  const out: FeedbackRow['answers'] = [];
  for (const dimension of dimensions) {
    const rating = structured.dimensions[dimension.key];
    if (rating === undefined) continue;
    out.push({
      key: dimension.key,
      label: dimension.label,
      rating,
      signals: dimension.signals.filter((s) => tapped.has(s.key)).map((s) => s.label),
    });
  }
  return out;
}

function toRow(row: {
  id: string;
  clientId: string;
  text: string;
  stars: number | null;
  reviewDate: Date | null;
  source: string;
  redacted: boolean;
  redactionsJson: string;
  analysedAt: Date | null;
  updatedAt?: Date | null;
  createdAt: Date;
  sentiment: string;
  themesJson: string;
  confidence: string;
  analysisReasonsJson: string;
  analysisStatus: string;
  analysisVersion: number;
  language: string | null;
  analysisError: string | null;
  responseClass: string;
  responseAction: string;
  priorityBand: string;
  priorityRank: number;
  priorityReasonsJson: string;
  draftText: string | null;
  draftLanguage: string | null;
  draftSource: string;
  draftStatus: string;
  draftVersion: number;
  draftNotesJson: string;
  draftError: string | null;
  handledAt: Date | null;
  dimensionsJson?: string | null;
  signalsJson?: string | null;
}, pack?: Pack): FeedbackRow {
  const collapsed = row.text.replace(/\s+/g, ' ').trim();
  const rated = Object.keys(readDimensions(row.dimensionsJson)).length;
  return {
    id: row.id,
    clientId: row.clientId,
    text: row.text,
    preview:
      collapsed.length === 0
        ? rated > 0
          ? ratingOnlyPreview(rated)
          : RATING_ONLY_PREVIEW
        : collapsed.length > PREVIEW_LENGTH
          ? `${collapsed.slice(0, PREVIEW_LENGTH).trimEnd()}…`
          : collapsed,
    stars: row.stars,
    reviewDate: row.reviewDate,
    source: row.source,
    sourceLabel: sourceLabel(row.source),
    redacted: row.redacted,
    redactions: parseJson<string[]>(row.redactionsJson, []),
    answers: answersFor(row, pack),
    // Version-aware on purpose: after a bump the stored reading is stale, and
    // the row must say so rather than showing themes the header calls unread.
    analysed:
      row.analysisStatus === 'ANALYSED' && row.analysisVersion >= ANALYSIS_VERSION,
    state: analysisStateOf(row),
    createdAt: row.createdAt,
    sentiment: row.sentiment,
    themes: parseJson<NormalizedTheme[]>(row.themesJson, []),
    confidence: row.confidence,
    reasons: parseJson<string[]>(row.analysisReasonsJson, []),
    language: row.language,
    analysisError: row.analysisError,
    responseClass: row.responseClass,
    responseAction: row.responseAction,
    priorityBand: row.priorityBand,
    priorityRank: row.priorityRank,
    priorityReasons: parseJson<string[]>(row.priorityReasonsJson, []),
    draftText: row.draftText,
    draftLanguage: row.draftLanguage,
    draftSource: row.draftSource,
    draftStatus: row.draftStatus,
    // An edited or handled draft is the operator's own work and never goes
    // stale; only one RepOS wrote does.
    draftCurrent:
      row.draftStatus === 'EDITED' ||
      row.draftStatus === 'HANDLED' ||
      (row.draftStatus === 'READY' && row.draftVersion >= DRAFT_VERSION),
    draftNotes: parseJson<string[]>(row.draftNotesJson, []),
    draftError: row.draftError,
    handledAt: row.handledAt,
  };
}

export type FeedbackFilters = {
  stars?: number | null;
  source?: string | null;
  from?: Date | null;
  to?: Date | null;
  analysed?: boolean | null;
  sentiment?: string | null;
  /** REPLY_RECOMMENDED | REPLY_OPTIONAL | NEEDS_HUMAN | NO_RESPONSE_NEEDED. */
  responseAction?: string | null;
  /** NONE | READY | EDITED | HANDLED | FAILED. */
  draftStatus?: string | null;
  /** Order by how much attention the item needs rather than by date. */
  byPriority?: boolean;
  /** Only items whose analysis mentions this taxonomy theme. */
  themeKey?: string | null;
  /** Free text the comment must contain. */
  query?: string | null;
  /**
   * Only what RepOS thinks still deserves a person's answer (M18).
   *
   * The one definition, in the query rather than in a page — the owner's
   * Reviews page filtered in memory while the number beside the filter was
   * counted with a different set of conditions, so the two could disagree.
   */
  worthReply?: boolean;
  limit?: number;
  /** Rows to skip, for paging. */
  offset?: number;
};

/**
 * The WHERE every feedback read shares (M18).
 *
 * Extracted so the list and its total count are built from exactly the same
 * conditions. A page saying "9 comments" over a list of 6 is worse than no
 * number at all, and that is what two hand-written filters eventually produce.
 */
function feedbackWhere(
  clientId: string,
  filters: FeedbackFilters,
): Record<string, unknown> {
  const where: Record<string, unknown> = { clientId };

  if (typeof filters.stars === 'number') where.stars = filters.stars;
  if (filters.source) where.source = filters.source;
  if (filters.sentiment) where.sentiment = filters.sentiment;
  if (filters.responseAction) where.responseAction = filters.responseAction;
  if (filters.draftStatus) where.draftStatus = filters.draftStatus;
  if (filters.analysed === true) {
    where.analysisStatus = 'ANALYSED';
    where.analysisVersion = { gte: ANALYSIS_VERSION };
  }
  if (filters.analysed === false) {
    where.OR = [
      { analysisStatus: { not: 'ANALYSED' } },
      { analysisVersion: { lt: ANALYSIS_VERSION } },
    ];
  }

  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.gte = filters.from;
    if (filters.to) range.lte = filters.to;
    where.reviewDate = range;
  }

  // Themes live inside a JSON column, and until M18 this ran in memory AFTER
  // the row limit — so a theme chip reading "40" could open a list of twelve,
  // silently, on the one page whose whole job is proof. The stored shape is
  // [{"key":"wait_time",...}], so matching that exact fragment is equivalent
  // to parsing every row, and it lets the database do the paging.
  if (filters.themeKey) {
    where.themesJson = { contains: `"key":"${themeNeedle(filters.themeKey)}"` };
  }

  const q = (filters.query ?? '').trim();
  if (q) where.text = { contains: q };

  // The same three conditions `worthReply` applies in the portal: something
  // filed as needing no response is never worth a reply however it ranks,
  // anything already handled is done, and what is left has to be either high
  // priority or explicitly a person's job.
  if (filters.worthReply) {
    where.responseAction = { not: 'NO_RESPONSE_NEEDED' };
    where.handledAt = null;
    where.AND = [
      { OR: [{ priorityBand: 'HIGH' }, { responseAction: 'NEEDS_HUMAN' }] },
    ];
  }

  return where;
}

/** Theme keys come from the packs and are plain identifiers. Enforce that. */
function themeNeedle(key: string): string {
  return key.replace(/[^a-z0-9_]/gi, '');
}

function feedbackOrder(filters: FeedbackFilters) {
  // Newest feedback first; undated items fall back to arrival order. When
  // the operator is working a reply queue, the most demanding item leads.
  return filters.byPriority
    ? [{ priorityRank: 'desc' as const }, { reviewDate: 'desc' as const }, { sortIndex: 'desc' as const }]
    : [{ reviewDate: 'desc' as const }, { createdAt: 'desc' as const }, { sortIndex: 'desc' as const }];
}

/**
 * One client's feedback. Always scoped by clientId in the query itself, so
 * cross-client leakage is not possible through this path.
 */
export async function listClientFeedback(
  db: PrismaClient,
  clientId: string,
  filters: FeedbackFilters = {},
  /**
   * The client's pack, when the caller already holds it. With it, each row's
   * `answers` carries the tapped ratings and specifics as labels; without it
   * they read as empty — which is how the owner's Reviews page shipped with
   * every dimension a customer rated invisible. No extra query either way.
   */
  pack?: Pack,
): Promise<FeedbackRow[]> {
  const rows = await db.reviewItem.findMany({
    where: feedbackWhere(clientId, filters),
    orderBy: feedbackOrder(filters),
    ...(filters.limit ? { take: filters.limit } : {}),
    ...(filters.offset ? { skip: filters.offset } : {}),
  });

  return rows.map((row) => toRow(row, pack));
}

/**
 * How many rows those same filters match in total.
 *
 * Separate from the list so a page can show 25 comments and still say honestly
 * how many there are.
 */
export async function countClientFeedback(
  db: PrismaClient,
  clientId: string,
  filters: FeedbackFilters = {},
): Promise<number> {
  return db.reviewItem.count({ where: feedbackWhere(clientId, filters) });
}

export async function getFeedbackItem(
  db: PrismaClient,
  clientId: string,
  itemId: string,
): Promise<FeedbackRow | null> {
  const row = await db.reviewItem.findFirst({ where: { id: itemId, clientId } });
  if (!row) return null;
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { vertical: true },
  });
  return toRow(row, getPackOrFallback(client?.vertical));
}

export type FeedbackStats = {
  total: number;
  analysed: number;
  unanalysed: number;
  /** Collected and not yet in hand: the next run reads these. */
  waiting: number;
  /** Claimed by a run that is going now. */
  processing: number;
  /** The last attempt failed; the next run tries again. */
  failed: number;
  withRating: number;
  redacted: number;
  averageRating: number | null;
  newestAt: Date | null;
  /** Count per star value, 1-5. Only from items that carry a rating. */
  ratingCounts: Record<string, number>;
  sourceCounts: Array<{ source: string; label: string; count: number }>;
};

/** Headline numbers for the inbox. Deterministic counts, no estimation. */
export async function getFeedbackStats(
  db: PrismaClient,
  clientId: string,
): Promise<FeedbackStats> {
  const rows = await db.reviewItem.findMany({
    where: { clientId },
    select: {
      stars: true,
      source: true,
      redacted: true,
      analysedAt: true,
      analysisStatus: true,
      analysisVersion: true,
      updatedAt: true,
      reviewDate: true,
      createdAt: true,
    },
  });
  const now = new Date();

  const ratingCounts: Record<string, number> = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };
  const sourceMap = new Map<string, number>();
  let ratingSum = 0;
  let withRating = 0;
  let redacted = 0;
  let analysed = 0;
  let waiting = 0;
  let processing = 0;
  let failed = 0;
  let newestAt: Date | null = null;

  for (const row of rows) {
    if (row.stars !== null && row.stars >= 1 && row.stars <= 5) {
      ratingCounts[String(row.stars)] = (ratingCounts[String(row.stars)] ?? 0) + 1;
      ratingSum += row.stars;
      withRating += 1;
    }
    if (row.redacted) redacted += 1;
    switch (analysisStateOf(row, now)) {
      case 'ANALYSED':
        analysed += 1;
        break;
      case 'PROCESSING':
        processing += 1;
        break;
      case 'FAILED':
        failed += 1;
        break;
      default:
        waiting += 1;
    }
    sourceMap.set(row.source, (sourceMap.get(row.source) ?? 0) + 1);

    const stamp = row.reviewDate ?? row.createdAt;
    if (!newestAt || stamp > newestAt) newestAt = stamp;
  }

  return {
    total: rows.length,
    analysed,
    unanalysed: rows.length - analysed,
    waiting,
    processing,
    failed,
    withRating,
    redacted,
    averageRating:
      withRating > 0 ? Math.round((ratingSum / withRating) * 100) / 100 : null,
    newestAt,
    ratingCounts,
    sourceCounts: [...sourceMap.entries()]
      .map(([source, count]) => ({ source, label: sourceLabel(source), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

export async function deleteFeedbackItem(
  db: PrismaClient,
  clientId: string,
  itemId: string,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.reviewItem.findFirst({
    where: { id: itemId, clientId },
    select: { id: true },
  });
  if (!existing) return err('That feedback item no longer exists.');

  await db.reviewItem.delete({ where: { id: itemId } });
  return ok({ id: itemId });
}
