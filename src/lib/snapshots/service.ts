import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  aggregate,
  type AnalysisResult,
  type ClassifiedReview,
  type PreviousSnapshotSummary,
  type SnapshotObservation,
} from '@/lib/analysis/aggregate';
import type { Sentiment } from '@/lib/analysis/classify';
import { parseReviews, type ParseSummary } from '@/lib/analysis/parse-reviews';
import type { LanguageCode } from '@/lib/analysis/language';
import { classifyReviews } from '@/lib/ai/classify-reviews';
import { buildNarrative, type Narrative } from '@/lib/ai/narrative';
import { aiStatus } from '@/lib/ai';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import {
  computeHealthCard,
  computePulse,
  type HealthCard,
  type Pulse,
  type StoredFeedback,
  type StoredSnapshot,
} from '@/lib/health/health';
import { parseJson } from '@/lib/format';
import { nullableInt, nullableNumber } from '@/lib/actions/shared';

/**
 * Snapshot lifecycle.
 *
 * A snapshot is the unit of measurement in RepOS: everything the operator
 * observed by hand on a given day, plus the feedback they pasted, plus the
 * deterministic analysis computed from both. Nothing is fetched — the operator
 * looks at the public listing themselves and types what they see.
 *
 * Storing the snapshot preserves the state used to compute the client's health
 * at that point in time, which is what makes later comparison possible.
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
// Input contract
// ---------------------------------------------------------------------------

export const snapshotInputSchema = z.object({
  label: z.string().max(80, 'Keep the label short.').nullable(),
  capturedAt: z.date({ message: 'Enter a valid observation date.' }),
  rating: nullableNumber('Rating', 0, 5),
  reviewCount: nullableInt('Review count', 0, 10_000_000),
  unansweredCount: nullableInt('Unanswered count', 0, 10_000_000),
  daysSinceLastPost: nullableInt('Days since last post', 0, 100_000),
  photoRecencyDays: nullableInt('Photo recency', 0, 100_000),
  reviewsPerWeek: nullableNumber('Reviews per week', 0, 10_000),
  profileGaps: z.array(z.string()),
  observationNotes: z.string().max(4000, 'Notes are too long.'),
  reviewsRaw: z.string().max(200_000, 'That is too much text to paste at once.'),
});

export type SnapshotInput = z.infer<typeof snapshotInputSchema>;

// ---------------------------------------------------------------------------
// Row -> health input mapping
// ---------------------------------------------------------------------------

type ReviewRow = {
  sentiment: string;
  issueTags: string;
  praiseTags: string;
  stars: number | null;
  reviewDate: Date | null;
};

/** Shared with the command centre, which loads the same rows in bulk. */
export function toStoredFeedback(row: ReviewRow): StoredFeedback {
  return {
    sentiment: row.sentiment as Sentiment,
    issueTags: parseJson<string[]>(row.issueTags, []),
    praiseTags: parseJson<string[]>(row.praiseTags, []),
    stars: row.stars,
    reviewDate: row.reviewDate,
  };
}

/**
 * Loads every stored check-in for a client in the shape the health engine
 * expects. Sentiment and tags come from the stored review rows, not from the
 * frozen report JSON, so health is always recomputed from source data.
 *
 * WHICH FEEDBACK BELONGS TO A CHECK-IN (M17).
 *
 * A check-in is a moment: "this is what the business looked like on this
 * date". Until M17 the only feedback it could see was whatever the operator
 * happened to paste into it, which made sense when reviews arrived in batches
 * copied off a public listing.
 *
 * Under the QR-first direction feedback arrives continuously and belongs to no
 * batch at all, so on a real database roughly two thirds of it — including
 * every single QR submission — was invisible to health, to the trend and to
 * every before-and-after comparison, while the intelligence engine read all of
 * it. Two parts of the product answering the same question from different
 * evidence.
 *
 * So a check-in now covers the feedback that ARRIVED in its window: after the
 * previous check-in, up to its own moment. Feedback pasted directly into a
 * check-in still belongs to it, exactly as before.
 *
 * Feedback that arrived AFTER the most recent check-in belongs to no check-in
 * at all. It is waiting for the next one. A check-in taken in March must not
 * quietly absorb what a customer said in September — that would let a stale
 * check-in keep re-reading itself as current.
 *
 * This changes which evidence a period contains, not what any of it means. No
 * count is reweighted, no sentiment is reinterpreted, and the health engine
 * itself is untouched.
 */
export async function loadHealthSnapshots(
  db: PrismaClient,
  clientId: string,
): Promise<StoredSnapshot[]> {
  const [rows, arrived] = await Promise.all([
    db.snapshot.findMany({
      where: { clientId },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        label: true,
        capturedAt: true,
        rating: true,
        reviewCount: true,
        unansweredCount: true,
        reviewsPerWeek: true,
        daysSinceLastPost: true,
        photoRecencyDays: true,
        generatedAt: true,
        reviews: {
          select: {
            sentiment: true,
            issueTags: true,
            praiseTags: true,
            stars: true,
            reviewDate: true,
          },
        },
      },
    }),
    db.reviewItem.findMany({
      where: { clientId, snapshotId: null },
      select: {
        sentiment: true,
        issueTags: true,
        praiseTags: true,
        stars: true,
        reviewDate: true,
        createdAt: true,
      },
    }),
  ]);

  // Oldest first, so each check-in's window starts where the last one ended.
  const oldestFirst = [...rows].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
  );

  const windowed = new Map<string, StoredFeedback[]>();
  for (const row of oldestFirst) windowed.set(row.id, []);

  for (const item of arrived) {
    // When it reached RepOS. For a QR submission that is when the customer
    // sent it; for a pasted batch it is when the operator brought it in.
    const at = item.createdAt.getTime();
    let target: string | null = null;
    for (const row of oldestFirst) {
      if (at <= row.capturedAt.getTime()) {
        target = row.id;
        break;
      }
    }
    // Arrived after the last check-in: it belongs to the next one, not this one.
    if (target === null) continue;
    windowed.get(target)?.push(toStoredFeedback(item));
  }

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    capturedAt: row.capturedAt,
    rating: row.rating,
    reviewCount: row.reviewCount,
    unansweredCount: row.unansweredCount,
    reviewsPerWeek: row.reviewsPerWeek,
    daysSinceLastPost: row.daysSinceLastPost,
    photoRecencyDays: row.photoRecencyDays,
    generatedAt: row.generatedAt,
    feedback: [...row.reviews.map(toStoredFeedback), ...(windowed.get(row.id) ?? [])],
  }));
}

export type ClientHealth = {
  card: HealthCard;
  pulse: Pulse;
};

/** The Health Card and Pulse for one client, computed from stored rows only. */
export async function getClientHealth(
  db: PrismaClient,
  clientId: string,
  vertical: string,
  now: Date = new Date(),
): Promise<ClientHealth> {
  const pack = getPackOrFallback(vertical);
  const snapshots = await loadHealthSnapshots(db, clientId);
  return {
    card: computeHealthCard({ pack, snapshots, now }),
    pulse: computePulse({ pack, snapshots, now }),
  };
}

export type PortfolioRow = {
  clientId: string;
  businessName: string;
  vertical: string;
  verticalLabel: string;
  status: HealthCard['status'];
  statusLabel: string;
  /** The single most important thing wrong, or null when nothing fired. */
  topSignal: string | null;
  daysSinceLastSnapshot: number | null;
  snapshotCount: number;
};

const STATUS_ORDER: Record<HealthCard['status'], number> = {
  ATTENTION: 0,
  WATCH: 1,
  INSUFFICIENT_DATA: 2,
  HEALTHY: 3,
};

/**
 * Health for every active client, most urgent first.
 *
 * Two queries total: clients, then all their snapshots with review tags. The
 * engine then runs per client in memory, so the dashboard answers "who needs me
 * today" rather than just listing recent activity.
 */
export async function getPortfolioHealth(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<PortfolioRow[]> {
  const clients = await db.client.findMany({
    where: { archivedAt: null },
    select: { id: true, businessName: true, vertical: true },
  });
  if (clients.length === 0) return [];

  const snapshots = await db.snapshot.findMany({
    where: { clientId: { in: clients.map((c) => c.id) } },
    orderBy: { capturedAt: 'desc' },
    select: {
      id: true,
      clientId: true,
      label: true,
      capturedAt: true,
      rating: true,
      reviewCount: true,
      unansweredCount: true,
      reviewsPerWeek: true,
      daysSinceLastPost: true,
      photoRecencyDays: true,
      generatedAt: true,
      reviews: {
        select: {
          sentiment: true,
          issueTags: true,
          praiseTags: true,
          stars: true,
          reviewDate: true,
        },
      },
    },
  });

  const byClient = new Map<string, StoredSnapshot[]>();
  for (const row of snapshots) {
    const list = byClient.get(row.clientId) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      capturedAt: row.capturedAt,
      rating: row.rating,
      reviewCount: row.reviewCount,
      unansweredCount: row.unansweredCount,
      reviewsPerWeek: row.reviewsPerWeek,
      daysSinceLastPost: row.daysSinceLastPost,
      photoRecencyDays: row.photoRecencyDays,
      generatedAt: row.generatedAt,
      feedback: row.reviews.map(toStoredFeedback),
    });
    byClient.set(row.clientId, list);
  }

  return clients
    .map((client) => {
      const pack = getPackOrFallback(client.vertical);
      const clientSnapshots = byClient.get(client.id) ?? [];
      const card = computeHealthCard({ pack, snapshots: clientSnapshots, now });

      return {
        clientId: client.id,
        businessName: client.businessName,
        vertical: client.vertical,
        verticalLabel: pack.label,
        status: card.status,
        statusLabel: card.statusLabel,
        topSignal: card.signals[0]?.label ?? null,
        daysSinceLastSnapshot: card.coverage.daysSinceLastSnapshot,
        snapshotCount: card.coverage.snapshotCount,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.businessName.localeCompare(b.businessName),
    );
}

// ---------------------------------------------------------------------------
// Previous-snapshot summary, rebuilt from stored rows
// ---------------------------------------------------------------------------

function countTagsFromRows(
  feedback: StoredFeedback[],
  which: 'issueTags' | 'praiseTags',
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of feedback) {
    for (const tag of item[which]) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return counts;
}

async function loadPreviousSummary(
  db: PrismaClient,
  clientId: string,
  before: Date,
): Promise<PreviousSnapshotSummary | null> {
  const previous = await db.snapshot.findFirst({
    where: { clientId, capturedAt: { lt: before } },
    orderBy: { capturedAt: 'desc' },
    select: {
      id: true,
      label: true,
      capturedAt: true,
      rating: true,
      reviewCount: true,
      reviewsPerWeek: true,
      unansweredCount: true,
      analysisJson: true,
      reviews: {
        select: {
          sentiment: true,
          issueTags: true,
          praiseTags: true,
          stars: true,
          reviewDate: true,
        },
      },
    },
  });

  if (!previous) return null;

  const feedback = previous.reviews.map(toStoredFeedback);
  const priorAnalysis = previous.analysisJson
    ? parseJson<Partial<AnalysisResult>>(previous.analysisJson, {})
    : {};

  return {
    id: previous.id,
    label: previous.label,
    capturedAt: previous.capturedAt,
    rating: previous.rating,
    reviewCount: previous.reviewCount,
    reviewsPerWeek: previous.reviewsPerWeek,
    unansweredCount: previous.unansweredCount,
    totalReviewsAnalysed: feedback.length,
    issueCounts: countTagsFromRows(feedback, 'issueTags'),
    praiseCounts: countTagsFromRows(feedback, 'praiseTags'),
    recommendedIssueKey: priorAnalysis.recommendation?.issueKey ?? null,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateSnapshotResult = {
  id: string;
  parse: ParseSummary;
  classifiedBy: string;
  narrativeSource: string;
  notes: string[];
};

export async function createSnapshot(
  db: PrismaClient,
  clientId: string,
  raw: unknown,
  options: { useAi?: boolean; now?: Date } = {},
): Promise<ServiceResult<CreateSnapshotResult>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessName: true,
      areaLabel: true,
      vertical: true,
      baselineRating: true,
      baselineReviewCount: true,
      baselineReviewsPerWeek: true,
      baselineObservedAt: true,
      voiceProfile: { select: { formality: true, languageMix: true } },
      competitors: {
        orderBy: { sortIndex: 'asc' },
        take: 3,
        select: { name: true, rating: true, reviewCount: true },
      },
    },
  });
  if (!client) return err('That client no longer exists.');

  const parsed = snapshotInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join('.') || '_form';
      if (!errors[key]) errors[key] = issue.message;
    }
    return err('Some fields need attention.', errors);
  }

  const input = parsed.data;
  const pack: Pack = getPackOrFallback(client.vertical);
  const useAi = options.useAi ?? aiStatus().enabled;
  const notes: string[] = [];

  // 1. Parse the pasted text. Dates resolve against the observation date, so
  //    re-parsing the same paste always yields the same result.
  const parseSummary = parseReviews(input.reviewsRaw, input.capturedAt);

  // 2. Classify. AI may assign tags; it never counts anything.
  const classification = await classifyReviews(
    parseSummary.reviews.map((r) => ({ text: r.text, stars: r.stars })),
    pack,
    { useAi },
  );
  notes.push(...classification.notes);

  const classified: ClassifiedReview[] = parseSummary.reviews.map((review, i) => {
    const result = classification.results[i];
    return {
      text: review.text,
      stars: review.stars,
      reviewDate: review.reviewDate,
      language: review.language as LanguageCode,
      sentiment: result?.sentiment ?? 'UNKNOWN',
      issueTags: result?.issueTags ?? [],
      praiseTags: result?.praiseTags ?? [],
    };
  });

  // 3. Deterministic aggregation against the previous snapshot.
  const observation: SnapshotObservation = {
    capturedAt: input.capturedAt,
    rating: input.rating,
    reviewCount: input.reviewCount,
    unansweredCount: input.unansweredCount,
    daysSinceLastPost: input.daysSinceLastPost,
    photoRecencyDays: input.photoRecencyDays,
    reviewsPerWeek: input.reviewsPerWeek,
    profileGaps: input.profileGaps,
  };

  const previous = await loadPreviousSummary(db, clientId, input.capturedAt);

  const competitors = client.competitors.map((c) => ({
    name: c.name,
    rating: c.rating,
    reviewCount: c.reviewCount,
  }));

  const analysis = aggregate({
    pack,
    snapshot: observation,
    reviews: classified,
    competitors,
    baseline: {
      rating: client.baselineRating,
      reviewCount: client.baselineReviewCount,
      reviewsPerWeek: client.baselineReviewsPerWeek,
      observedAt: client.baselineObservedAt,
    },
    previous,
    now: options.now ?? new Date(),
  });

  // 4. Prose. Falls back to deterministic templates whenever AI is unavailable
  //    or returns a figure the numeric guard cannot verify.
  let narrative: Narrative;
  let narrativeSource = 'TEMPLATE';
  let aiModel: string | null = null;
  if (useAi) {
    const built = await buildNarrative(analysis, {
      businessName: client.businessName,
      areaLabel: client.areaLabel,
      verticalLabel: pack.label,
      languageMix: client.voiceProfile?.languageMix ?? 'ENGLISH',
      formality: client.voiceProfile?.formality ?? 'NEUTRAL',
    });
    narrative = built.narrative;
    narrativeSource = built.source;
    aiModel = built.model;
    notes.push(...built.notes);
  } else {
    const { templateNarrative } = await import('@/lib/ai/narrative');
    narrative = templateNarrative(analysis, {
      businessName: client.businessName,
      areaLabel: client.areaLabel,
      verticalLabel: pack.label,
      languageMix: client.voiceProfile?.languageMix ?? 'ENGLISH',
      formality: client.voiceProfile?.formality ?? 'NEUTRAL',
    });
  }

  // 5. Persist. Snapshot and its feedback are written together so a snapshot
  //    can never exist with a partial set of reviews.
  const created = await db.snapshot.create({
    data: {
      clientId,
      label: input.label,
      capturedAt: input.capturedAt,
      rating: input.rating,
      reviewCount: input.reviewCount,
      unansweredCount: input.unansweredCount,
      daysSinceLastPost: input.daysSinceLastPost,
      photoRecencyDays: input.photoRecencyDays,
      reviewsPerWeek: input.reviewsPerWeek,
      profileGaps: JSON.stringify(input.profileGaps),
      observationNotes: input.observationNotes,
      competitorsJson: JSON.stringify(competitors),
      analysisJson: JSON.stringify(analysis),
      narrativeJson: JSON.stringify(narrative),
      narrativeSource,
      aiModel,
      generatedAt: options.now ?? new Date(),
      isBaseline: previous === null,
      reviews: {
        create: classified.map((review, index) => ({
          // clientId is required on every feedback item: an item always belongs
          // to exactly one client, whether or not it sits inside a snapshot.
          clientId,
          text: review.text,
          stars: review.stars,
          reviewDate: review.reviewDate,
          language: review.language,
          sentiment: review.sentiment,
          issueTags: JSON.stringify(review.issueTags),
          praiseTags: JSON.stringify(review.praiseTags),
          classifiedBy: classification.source,
          classifierModel: classification.model,
          redacted: parseSummary.reviews[index]?.redacted ?? false,
          sortIndex: index,
        })),
      },
    },
    select: { id: true },
  });

  return ok({
    id: created.id,
    parse: parseSummary,
    classifiedBy: classification.source,
    narrativeSource,
    notes,
  });
}

// ---------------------------------------------------------------------------
// Read / delete
// ---------------------------------------------------------------------------

export type SnapshotListRow = {
  id: string;
  label: string | null;
  capturedAt: Date;
  rating: number | null;
  reviewCount: number | null;
  feedbackCount: number;
  isBaseline: boolean;
  narrativeSource: string | null;
};

export async function listSnapshots(
  db: PrismaClient,
  clientId: string,
): Promise<SnapshotListRow[]> {
  const rows = await db.snapshot.findMany({
    where: { clientId },
    orderBy: { capturedAt: 'desc' },
    select: {
      id: true,
      label: true,
      capturedAt: true,
      rating: true,
      reviewCount: true,
      isBaseline: true,
      narrativeSource: true,
      _count: { select: { reviews: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    capturedAt: row.capturedAt,
    rating: row.rating,
    reviewCount: row.reviewCount,
    feedbackCount: row._count.reviews,
    isBaseline: row.isBaseline,
    narrativeSource: row.narrativeSource,
  }));
}

export type SnapshotDetail = {
  id: string;
  clientId: string;
  label: string | null;
  capturedAt: Date;
  /** Exactly what the operator observed. Not derivable from the analysis. */
  rating: number | null;
  reviewCount: number | null;
  unansweredCount: number | null;
  daysSinceLastPost: number | null;
  photoRecencyDays: number | null;
  reviewsPerWeek: number | null;
  observationNotes: string;
  profileGaps: string[];
  narrativeSource: string | null;
  aiModel: string | null;
  generatedAt: Date | null;
  analysis: AnalysisResult | null;
  narrative: Narrative | null;
  feedbackCount: number;
  redactedCount: number;
};

export async function getSnapshotDetail(
  db: PrismaClient,
  clientId: string,
  snapshotId: string,
): Promise<SnapshotDetail | null> {
  const row = await db.snapshot.findFirst({
    where: { id: snapshotId, clientId },
    include: { reviews: { select: { redacted: true } } },
  });
  if (!row) return null;

  return {
    id: row.id,
    clientId: row.clientId,
    label: row.label,
    capturedAt: row.capturedAt,
    rating: row.rating,
    reviewCount: row.reviewCount,
    unansweredCount: row.unansweredCount,
    daysSinceLastPost: row.daysSinceLastPost,
    photoRecencyDays: row.photoRecencyDays,
    reviewsPerWeek: row.reviewsPerWeek,
    observationNotes: row.observationNotes,
    profileGaps: parseJson<string[]>(row.profileGaps, []),
    narrativeSource: row.narrativeSource,
    aiModel: row.aiModel,
    generatedAt: row.generatedAt,
    analysis: row.analysisJson
      ? parseJson<AnalysisResult | null>(row.analysisJson, null)
      : null,
    narrative: row.narrativeJson
      ? parseJson<Narrative | null>(row.narrativeJson, null)
      : null,
    feedbackCount: row.reviews.length,
    redactedCount: row.reviews.filter((r) => r.redacted).length,
  };
}

export async function deleteSnapshot(
  db: PrismaClient,
  clientId: string,
  snapshotId: string,
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.snapshot.findFirst({
    where: { id: snapshotId, clientId },
    select: { id: true },
  });
  if (!existing) return err('That snapshot no longer exists.');

  await db.snapshot.delete({ where: { id: snapshotId } });
  return ok({ id: snapshotId });
}
