import type { PrismaClient } from '@prisma/client';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { sanitiseSentiment, sanitiseTags, type Sentiment } from '@/lib/analysis/classify';
import {
  ANALYSIS_VERSION,
  normalizeFeedback,
  type AiSuggestion,
  type NormalizedTheme,
} from '@/lib/analysis/normalize';
import { classifyReviews } from '@/lib/ai/classify-reviews';
import { aiStatus } from '@/lib/ai';
import { parseJson } from '@/lib/format';

/**
 * BATCH FEEDBACK ANALYSIS.
 *
 * Reads every stored feedback item for a client and works out what the customer
 * was actually saying: language, themes with their own sentiment, an overall
 * sentiment, and why.
 *
 * Three guarantees this layer must never break:
 *
 *  1. The original sanitised text is never modified. Analysis only ever writes
 *     to the analysis columns.
 *  2. A failure on one item never affects another, and never rolls back work
 *     already done. Failed items are marked retryable, not discarded.
 *  3. AI is optional. With no key, a failed call or malformed output, the
 *     deterministic engine still produces a full result and the item is still
 *     marked analysed — it simply says so was done without AI.
 *
 * There is no background worker: this is a local-first application and the
 * operator triggers analysis explicitly.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

/** How many items go to the provider in one request. */
const AI_BATCH_SIZE = 20;

export type AnalysisRunResult = {
  /** Items considered for this run. */
  considered: number;
  analysed: number;
  /** Left untouched because they were already current. */
  skippedUpToDate: number;
  needsRetry: number;
  /** True when a provider was actually used for at least one item. */
  usedAi: boolean;
  /** Plain-language notes, safe to show the operator. Never contains a key. */
  notes: string[];
};

type ItemRow = {
  id: string;
  text: string;
  stars: number | null;
  analysisStatus: string;
  analysisVersion: number;
};

export type AnalyseOptions = {
  /** Re-analyse everything, including items already on the current version. */
  force?: boolean;
  /** Overrides provider availability; tests use false to stay offline. */
  useAi?: boolean;
  now?: Date;
  /** Safety cap so one click cannot start an unbounded run. */
  limit?: number;
};

/**
 * Analyses a client's feedback.
 *
 * Idempotent by default: an item already analysed at the current engine version
 * is skipped. Bumping ANALYSIS_VERSION, or passing `force`, makes it eligible
 * again.
 */
export async function analyseClientFeedback(
  db: PrismaClient,
  clientId: string,
  options: AnalyseOptions = {},
): Promise<ServiceResult<AnalysisRunResult>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, vertical: true },
  });
  if (!client) return err('That client no longer exists.');

  const pack: Pack = getPackOrFallback(client.vertical);
  const now = options.now ?? new Date();
  const useAi = options.useAi ?? aiStatus().enabled;
  const notes: string[] = [];

  const all = await db.reviewItem.findMany({
    where: { clientId },
    orderBy: { sortIndex: 'asc' },
    select: {
      id: true,
      text: true,
      stars: true,
      analysisStatus: true,
      analysisVersion: true,
    },
  });

  // Idempotency: only items that have never been analysed, previously failed,
  // or were analysed by an older engine version.
  const pending: ItemRow[] = options.force
    ? all
    : all.filter(
        (row) =>
          row.analysisStatus !== 'ANALYSED' || row.analysisVersion < ANALYSIS_VERSION,
      );

  const skippedUpToDate = all.length - pending.length;
  const queue = options.limit ? pending.slice(0, options.limit) : pending;

  if (queue.length === 0) {
    return ok({
      considered: all.length,
      analysed: 0,
      skippedUpToDate,
      needsRetry: 0,
      usedAi: false,
      notes:
        all.length === 0
          ? ['There is no feedback to read yet.']
          : ['Everything here has already been read.'],
    });
  }

  // --- Optional AI pass ------------------------------------------------------
  // Suggestions are collected per item and may be absent for any of them. The
  // deterministic engine runs regardless, so a gap is never a failure.
  const suggestions = new Map<string, AiSuggestion>();
  let usedAi = false;
  let aiModel: string | null = null;

  if (useAi) {
    for (let start = 0; start < queue.length; start += AI_BATCH_SIZE) {
      const slice = queue.slice(start, start + AI_BATCH_SIZE);
      try {
        const outcome = await classifyReviews(
          slice.map((row) => ({ text: row.text, stars: row.stars })),
          pack,
          { useAi: true },
        );

        if (outcome.source.startsWith('AI:')) {
          usedAi = true;
          aiModel = outcome.model;
          slice.forEach((row, index) => {
            const result = outcome.results[index];
            if (!result) return;
            // Belt and braces: re-filter against the taxonomy here too, so a
            // malformed or hallucinated tag can never reach the database.
            suggestions.set(row.id, {
              issueTags: sanitiseTags(result.issueTags, pack.issueTaxonomy),
              praiseTags: sanitiseTags(result.praiseTags, pack.praiseTaxonomy),
              sentiment: sanitiseSentiment(result.sentiment),
            });
          });
        } else if (outcome.notes.length > 0) {
          notes.push(...outcome.notes);
        }
      } catch (error) {
        // A provider blowing up must not stop the run: the remaining items are
        // still analysed deterministically below.
        notes.push(
          error instanceof Error
            ? `Could not reach the writing assistant: ${error.message}`
            : 'Could not reach the writing assistant.',
        );
      }
    }
  }

  // --- Deterministic pass, one item at a time --------------------------------
  let analysed = 0;
  let needsRetry = 0;

  for (const row of queue) {
    try {
      const normalized = normalizeFeedback({
        text: row.text,
        stars: row.stars,
        pack,
        ai: suggestions.get(row.id) ?? null,
      });

      await db.reviewItem.update({
        where: { id: row.id },
        data: {
          language: normalized.language,
          sentiment: normalized.sentiment,
          issueTags: JSON.stringify(normalized.issueTags),
          praiseTags: JSON.stringify(normalized.praiseTags),
          themesJson: JSON.stringify(normalized.themes),
          confidence: normalized.confidence,
          analysisReasonsJson: JSON.stringify(normalized.reasons),
          classifiedBy: normalized.method,
          classifierModel: normalized.method === 'AI' ? aiModel : null,
          analysisStatus: 'ANALYSED',
          analysisVersion: normalized.version,
          analysisError: null,
          analysedAt: now,
        },
      });
      analysed += 1;
    } catch (error) {
      needsRetry += 1;
      const reason =
        error instanceof Error ? error.message : 'Something went wrong reading this one.';
      // The feedback itself is untouched; only the analysis columns record the
      // failure so the operator can retry just these.
      try {
        await db.reviewItem.update({
          where: { id: row.id },
          data: { analysisStatus: 'FAILED', analysisError: reason.slice(0, 500) },
        });
      } catch {
        // If even the failure marker cannot be written, keep going: losing the
        // marker is far better than aborting the whole run.
      }
    }
  }

  if (!usedAi && useAi) {
    notes.push('Read using the built-in reader — the writing assistant was unavailable.');
  }
  if (!useAi) {
    notes.push('Read using the built-in reader.');
  }

  return ok({
    considered: all.length,
    analysed,
    skippedUpToDate,
    needsRetry,
    usedAi,
    notes: [...new Set(notes)],
  });
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export type AnalysisCoverage = {
  total: number;
  analysed: number;
  needsAnalysis: number;
  failed: number;
  outOfDate: number;
  sentimentCounts: Record<Sentiment, number>;
  /** True when nothing at all is waiting. */
  upToDate: boolean;
};

const EMPTY_SENTIMENT: Record<Sentiment, number> = {
  POSITIVE: 0,
  NEGATIVE: 0,
  MIXED: 0,
  NEUTRAL: 0,
  UNKNOWN: 0,
};

/** How much of a client's feedback RepOS has actually read. */
export async function getAnalysisCoverage(
  db: PrismaClient,
  clientId: string,
): Promise<AnalysisCoverage> {
  const rows = await db.reviewItem.findMany({
    where: { clientId },
    select: { analysisStatus: true, analysisVersion: true, sentiment: true },
  });

  const sentimentCounts: Record<Sentiment, number> = { ...EMPTY_SENTIMENT };
  let analysed = 0;
  let failed = 0;
  let outOfDate = 0;

  for (const row of rows) {
    const isCurrent =
      row.analysisStatus === 'ANALYSED' && row.analysisVersion >= ANALYSIS_VERSION;
    if (isCurrent) {
      analysed += 1;
      const key = (row.sentiment as Sentiment) in sentimentCounts
        ? (row.sentiment as Sentiment)
        : 'UNKNOWN';
      sentimentCounts[key] += 1;
    } else {
      if (row.analysisStatus === 'FAILED') failed += 1;
      if (row.analysisStatus === 'ANALYSED') outOfDate += 1;
    }
  }

  const needsAnalysis = rows.length - analysed;
  return {
    total: rows.length,
    analysed,
    needsAnalysis,
    failed,
    outOfDate,
    sentimentCounts,
    upToDate: needsAnalysis === 0,
  };
}

export type ThemeSummaryRow = {
  key: string;
  label: string;
  kind: 'PRAISE' | 'ISSUE';
  severity: 'low' | 'medium' | 'high';
  count: number;
  /** Ids of the feedback items behind this count — the evidence trail. */
  itemIds: string[];
};

export type ThemeSummary = {
  praises: ThemeSummaryRow[];
  issues: ThemeSummaryRow[];
  analysedCount: number;
};

/**
 * What customers are happy and unhappy about, with the evidence.
 *
 * Every count carries the ids of the feedback items behind it, so the question
 * "show me the reviews behind this" always has an answer. Counts only — no
 * priority, no severity ranking beyond what the pack already declares.
 */
export async function getThemeSummary(
  db: PrismaClient,
  clientId: string,
  vertical: string,
): Promise<ThemeSummary> {
  const rows = await db.reviewItem.findMany({
    where: { clientId, analysisStatus: 'ANALYSED' },
    select: { id: true, themesJson: true },
  });
  return summariseThemeRows(rows, getPackOrFallback(vertical));
}

/**
 * The same summary from rows already in memory.
 *
 * Exported so a caller holding every client's feedback from one query — the
 * command centre does — can group per client without issuing a query each. The
 * bucketing lives here once so the two paths can never drift apart.
 */
export function summariseThemeRows(
  rows: Array<{ id: string; themesJson: string }>,
  pack: Pack,
): ThemeSummary {
  const buckets = new Map<string, { theme: NormalizedTheme; itemIds: string[] }>();
  for (const row of rows) {
    const themes = parseJson<NormalizedTheme[]>(row.themesJson, []);
    for (const theme of themes) {
      if (!theme?.key) continue;
      const existing = buckets.get(theme.key);
      if (existing) {
        existing.itemIds.push(row.id);
      } else {
        buckets.set(theme.key, { theme, itemIds: [row.id] });
      }
    }
  }

  const order = new Map<string, number>();
  pack.praiseTaxonomy.forEach((e, i) => order.set(`PRAISE:${e.key}`, i));
  pack.issueTaxonomy.forEach((e, i) => order.set(`ISSUE:${e.key}`, i));

  const toRows = (kind: 'PRAISE' | 'ISSUE'): ThemeSummaryRow[] =>
    [...buckets.values()]
      .filter((b) => b.theme.kind === kind)
      .map((b) => ({
        key: b.theme.key,
        label: b.theme.label,
        kind,
        severity: b.theme.severity,
        count: b.itemIds.length,
        itemIds: b.itemIds,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          (order.get(`${kind}:${a.key}`) ?? 0) - (order.get(`${kind}:${b.key}`) ?? 0),
      );

  return {
    praises: toRows('PRAISE'),
    issues: toRows('ISSUE'),
    analysedCount: rows.length,
  };
}

/** The feedback items behind one theme — the "show me the reviews" answer. */
export async function getThemeEvidence(
  db: PrismaClient,
  clientId: string,
  themeKey: string,
): Promise<Array<{ id: string; text: string; stars: number | null; sentiment: string }>> {
  const rows = await db.reviewItem.findMany({
    where: { clientId, analysisStatus: 'ANALYSED' },
    orderBy: { sortIndex: 'asc' },
    select: { id: true, text: true, stars: true, sentiment: true, themesJson: true },
  });

  return rows
    .filter((row) =>
      parseJson<NormalizedTheme[]>(row.themesJson, []).some((t) => t?.key === themeKey),
    )
    .map(({ id, text, stars, sentiment }) => ({ id, text, stars, sentiment }));
}
