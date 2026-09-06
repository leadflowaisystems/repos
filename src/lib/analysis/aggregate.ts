import type { Pack, TaxonomyEntry } from '@/lib/packs';
import { languageMixSummary, type LanguageCode } from './language';
import type { Sentiment } from './classify';

/**
 * THE DETERMINISTIC ENGINE.
 *
 * Every count, share, average, threshold, comparison and recommendation in a
 * RepOS report is computed here, in plain TypeScript, from data the operator
 * entered. No language model is involved at any point in this file.
 *
 * An AI provider may later be handed this object to write prose around it — but
 * it can only restate numbers that already exist here. See src/lib/ai/.
 *
 * EVIDENCE RULES (the honesty contract):
 *   < 10 reviews  -> INSUFFICIENT: no Pulse pattern may be claimed at all.
 *   10-24 reviews -> LIMITED:      themes need >= 3 mentions; NO trend claims.
 *   >= 25 reviews -> STANDARD:     themes need >= 3 mentions; trend claims are
 *                                  allowed only against comparable history.
 *   Percentages are only ever derived from real counts, and are always shown
 *   alongside the raw count. Missing data is reported as missing, never filled.
 */

export const ANALYSIS_VERSION = 1 as const;

export const MIN_MENTIONS_FOR_THEME = 3;
export const TIER_LIMITED_MIN = 10;
export const TIER_STANDARD_MIN = 25;

/** A post older than this is treated as a visible activity gap. */
export const STALE_POST_DAYS = 30;
/** Photos older than this are treated as a visible freshness gap. */
export const STALE_PHOTO_DAYS = 90;

export type EvidenceTier = 'INSUFFICIENT' | 'LIMITED' | 'STANDARD';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export type ClassifiedReview = {
  text: string;
  stars: number | null;
  reviewDate: Date | null;
  language: LanguageCode;
  sentiment: Sentiment;
  issueTags: string[];
  praiseTags: string[];
};

export type SnapshotObservation = {
  capturedAt: Date;
  rating: number | null;
  reviewCount: number | null;
  unansweredCount: number | null;
  daysSinceLastPost: number | null;
  photoRecencyDays: number | null;
  reviewsPerWeek: number | null;
  /** Gap keys the operator ticked, from the pack's profileGapChecks. */
  profileGaps: string[];
};

export type CompetitorObservation = {
  name: string;
  rating: number | null;
  reviewCount: number | null;
};

export type BaselineObservation = {
  rating: number | null;
  reviewCount: number | null;
  reviewsPerWeek: number | null;
  observedAt: Date | null;
};

export type PreviousSnapshotSummary = {
  id: string;
  label: string | null;
  capturedAt: Date;
  rating: number | null;
  reviewCount: number | null;
  reviewsPerWeek: number | null;
  unansweredCount: number | null;
  totalReviewsAnalysed: number;
  issueCounts: Record<string, number>;
  praiseCounts: Record<string, number>;
  recommendedIssueKey: string | null;
};

export type Theme = {
  key: string;
  label: string;
  count: number;
  /** count / totalReviews, 0-1. Null while evidence is INSUFFICIENT. */
  share: number | null;
  avgStars: number | null;
  starsSampleSize: number;
  severity: 'low' | 'medium' | 'high';
  qualifies: boolean;
};

export type MetricDelta = {
  key: string;
  label: string;
  now: number | null;
  then: number | null;
  delta: number | null;
  available: boolean;
};

export type ThemeDelta = {
  key: string;
  label: string;
  now: number;
  then: number;
  delta: number;
};

export type Opportunity = {
  key: string;
  label: string;
  detail: string;
  score: number;
};

export type Recommendation = {
  source: 'PULSE' | 'OPERATIONAL';
  issueKey: string | null;
  title: string;
  action: string;
  evidence: string[];
  confidence: Confidence;
  caveat: string | null;
};

export type Comparison = {
  previousSnapshotId: string;
  previousLabel: string;
  previousCapturedAt: string;
  daysBetween: number;
  metrics: MetricDelta[];
  themeTrendAllowed: boolean;
  themeTrendBlockedReason: string | null;
  issueDeltas: ThemeDelta[];
  praiseDeltas: ThemeDelta[];
  previousActionOutcome: {
    issueKey: string;
    label: string;
    then: number;
    now: number;
    delta: number;
    verdict: 'IMPROVED' | 'UNCHANGED' | 'WORSE' | 'NOT_COMPARABLE';
  } | null;
};

export type AnalysisResult = {
  version: typeof ANALYSIS_VERSION;
  computedAt: string;
  packId: string;
  totals: {
    reviewsAnalysed: number;
    withStars: number;
    withDates: number;
    redactedNote: string;
  };
  evidence: {
    tier: EvidenceTier;
    minMentions: number;
    canClaimThemes: boolean;
    canClaimTrend: boolean;
    statement: string;
  };
  starDistribution: Record<'1' | '2' | '3' | '4' | '5', number> | null;
  averageStarsInSample: number | null;
  sentiment: Record<Sentiment, number>;
  languageMix: Array<{ code: LanguageCode; label: string; count: number }>;
  issues: Theme[];
  praises: Theme[];
  responseGap: {
    observed: boolean;
    unanswered: number | null;
    totalReviews: number | null;
    share: number | null;
    statement: string;
  };
  activity: {
    daysSinceLastPost: number | null;
    photoRecencyDays: number | null;
    postStale: boolean;
    photosStale: boolean;
    statement: string;
  };
  profileGaps: Array<{ key: string; label: string; source: 'OBSERVED' | 'DERIVED' }>;
  competitors: Array<{
    name: string;
    rating: number | null;
    reviewCount: number | null;
    ratingDelta: number | null;
    reviewCountDelta: number | null;
  }>;
  competitorSummary: string;
  baselineComparison: MetricDelta[];
  comparison: Comparison | null;
  opportunities: Opportunity[];
  clearestOpportunity: Opportunity | null;
  emerging: {
    kind: 'EMERGING' | 'WATCH' | 'NONE';
    key: string | null;
    label: string | null;
    count: number;
    previousCount: number | null;
    statement: string;
  };
  recommendation: Recommendation;
  nextMonthChecks: string[];
  dataGaps: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function severityWeight(s: 'low' | 'medium' | 'high'): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function evidenceTier(reviewCount: number): EvidenceTier {
  if (reviewCount >= TIER_STANDARD_MIN) return 'STANDARD';
  if (reviewCount >= TIER_LIMITED_MIN) return 'LIMITED';
  return 'INSUFFICIENT';
}

function evidenceStatement(tier: EvidenceTier, n: number): string {
  if (tier === 'INSUFFICIENT') {
    return `Only ${n} review${n === 1 ? '' : 's'} analysed. That is below the ${TIER_LIMITED_MIN}-review floor Headway requires before calling anything a pattern, so no Customer Pulse theme is claimed this month.`;
  }
  if (tier === 'LIMITED') {
    return `${n} reviews analysed. Themes are reported only where at least ${MIN_MENTIONS_FOR_THEME} reviews mention them. Below ${TIER_STANDARD_MIN} reviews Headway does not make trend claims.`;
  }
  return `${n} reviews analysed. Themes are reported only where at least ${MIN_MENTIONS_FOR_THEME} reviews mention them. Trend claims are made only against comparable historical data.`;
}

function countTags(
  entries: TaxonomyEntry[],
  reviews: ClassifiedReview[],
  pick: (r: ClassifiedReview) => string[],
  tier: EvidenceTier,
  total: number,
): Theme[] {
  // Taxonomy order is the operator's own priority ordering, and is the final
  // tie-break everywhere. Alphabetical ordering would be arbitrary.
  const orderOf = new Map(entries.map((e, i) => [e.key, i]));
  const themes = entries.map<Theme>((entry) => {
    const matched = reviews.filter((r) => pick(r).includes(entry.key));
    const withStars = matched.filter(
      (r): r is ClassifiedReview & { stars: number } => r.stars !== null,
    );
    const avgStars =
      withStars.length > 0
        ? round(
            withStars.reduce((sum, r) => sum + r.stars, 0) / withStars.length,
            2,
          )
        : null;

    return {
      key: entry.key,
      label: entry.label,
      count: matched.length,
      share:
        tier === 'INSUFFICIENT' || total === 0
          ? null
          : round(matched.length / total, 4),
      avgStars,
      starsSampleSize: withStars.length,
      severity: entry.severity ?? 'medium',
      qualifies: tier !== 'INSUFFICIENT' && matched.length >= MIN_MENTIONS_FOR_THEME,
    };
  });

  return themes
    .filter((t) => t.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        severityWeight(b.severity) - severityWeight(a.severity) ||
        (a.avgStars ?? 6) - (b.avgStars ?? 6) ||
        (orderOf.get(a.key) ?? 0) - (orderOf.get(b.key) ?? 0),
    );
}

function toCountMap(themes: Theme[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of themes) out[t.key] = t.count;
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export type AggregateInput = {
  pack: Pack;
  snapshot: SnapshotObservation;
  reviews: ClassifiedReview[];
  competitors: CompetitorObservation[];
  baseline: BaselineObservation | null;
  previous: PreviousSnapshotSummary | null;
  /** Injected so output is reproducible in tests. */
  now?: Date;
};

export function aggregate(input: AggregateInput): AnalysisResult {
  const { pack, snapshot, reviews, competitors, baseline, previous } = input;
  const now = input.now ?? new Date();

  const total = reviews.length;
  const tier = evidenceTier(total);
  const withStars = reviews.filter((r) => r.stars !== null);
  const withDates = reviews.filter((r) => r.reviewDate !== null);

  // --- star distribution -----------------------------------------------------
  let starDistribution: AnalysisResult['starDistribution'] = null;
  let averageStarsInSample: number | null = null;
  if (withStars.length > 0) {
    const dist = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let sum = 0;
    for (const r of withStars) {
      const s = r.stars as number;
      if (s >= 1 && s <= 5) {
        dist[String(s) as keyof typeof dist] += 1;
        sum += s;
      }
    }
    starDistribution = dist;
    averageStarsInSample = round(sum / withStars.length, 2);
  }

  // --- sentiment -------------------------------------------------------------
  const sentiment: Record<Sentiment, number> = {
    POSITIVE: 0,
    NEGATIVE: 0,
    MIXED: 0,
    NEUTRAL: 0,
    UNKNOWN: 0,
  };
  for (const r of reviews) sentiment[r.sentiment] += 1;

  // --- themes ----------------------------------------------------------------
  const issues = countTags(
    pack.issueTaxonomy,
    reviews,
    (r) => r.issueTags,
    tier,
    total,
  );
  const praises = countTags(
    pack.praiseTaxonomy,
    reviews,
    (r) => r.praiseTags,
    tier,
    total,
  );

  // --- response gap ----------------------------------------------------------
  const unanswered = snapshot.unansweredCount;
  const reviewCount = snapshot.reviewCount;
  const responseShare =
    unanswered !== null && reviewCount !== null && reviewCount > 0
      ? round(unanswered / reviewCount, 4)
      : null;
  const responseGap: AnalysisResult['responseGap'] = {
    observed: unanswered !== null,
    unanswered,
    totalReviews: reviewCount,
    share: responseShare,
    statement:
      unanswered === null
        ? 'Unanswered reviews were not observed this month, so no response gap is reported.'
        : unanswered === 0
          ? 'Every observed review has a reply.'
          : responseShare !== null
            ? `${unanswered} of ${reviewCount} reviews (${pct(responseShare)}) have no reply.`
            : `${unanswered} reviews have no reply.`,
  };

  // --- activity --------------------------------------------------------------
  const postStale =
    snapshot.daysSinceLastPost !== null &&
    snapshot.daysSinceLastPost >= STALE_POST_DAYS;
  const photosStale =
    snapshot.photoRecencyDays !== null &&
    snapshot.photoRecencyDays >= STALE_PHOTO_DAYS;

  const activityParts: string[] = [];
  activityParts.push(
    snapshot.daysSinceLastPost === null
      ? 'Last post date not observed.'
      : `Last post was ${snapshot.daysSinceLastPost} day${snapshot.daysSinceLastPost === 1 ? '' : 's'} ago.`,
  );
  activityParts.push(
    snapshot.photoRecencyDays === null
      ? 'Photo recency not observed.'
      : `Newest photo is ${snapshot.photoRecencyDays} day${snapshot.photoRecencyDays === 1 ? '' : 's'} old.`,
  );

  const activity: AnalysisResult['activity'] = {
    daysSinceLastPost: snapshot.daysSinceLastPost,
    photoRecencyDays: snapshot.photoRecencyDays,
    postStale,
    photosStale,
    statement: activityParts.join(' '),
  };

  // --- profile gaps ----------------------------------------------------------
  const gapLabels = new Map(pack.profileGapChecks.map((g) => [g.key, g.label]));
  const profileGaps: AnalysisResult['profileGaps'] = snapshot.profileGaps
    .filter((k) => gapLabels.has(k))
    .map((k) => ({
      key: k,
      label: gapLabels.get(k) as string,
      source: 'OBSERVED' as const,
    }));

  if (postStale && !profileGaps.some((g) => g.key === 'derived_post_stale')) {
    profileGaps.push({
      key: 'derived_post_stale',
      label: `No post in ${snapshot.daysSinceLastPost} days`,
      source: 'DERIVED',
    });
  }
  if (photosStale && !profileGaps.some((g) => g.key === 'derived_photos_stale')) {
    profileGaps.push({
      key: 'derived_photos_stale',
      label: `Newest photo is ${snapshot.photoRecencyDays} days old`,
      source: 'DERIVED',
    });
  }

  // --- competitors -----------------------------------------------------------
  const competitorRows = competitors.map((c) => ({
    name: c.name,
    rating: c.rating,
    reviewCount: c.reviewCount,
    ratingDelta:
      c.rating !== null && snapshot.rating !== null
        ? round(snapshot.rating - c.rating, 2)
        : null,
    reviewCountDelta:
      c.reviewCount !== null && snapshot.reviewCount !== null
        ? snapshot.reviewCount - c.reviewCount
        : null,
  }));

  const ratedCompetitors = competitorRows.filter(
    (c): c is (typeof competitorRows)[number] & { rating: number } =>
      c.rating !== null,
  );
  const countedCompetitors = competitorRows.filter(
    (c): c is (typeof competitorRows)[number] & { reviewCount: number } =>
      c.reviewCount !== null,
  );

  let competitorSummary: string;
  if (competitorRows.length === 0) {
    competitorSummary = 'No competitor values were entered for this snapshot.';
  } else if (ratedCompetitors.length === 0 && countedCompetitors.length === 0) {
    competitorSummary =
      'Competitors are listed but no ratings were entered, so no comparison is made.';
  } else {
    const parts: string[] = [];
    if (snapshot.rating !== null && ratedCompetitors.length > 0) {
      const best = ratedCompetitors.reduce((a, b) => (b.rating > a.rating ? b : a));
      const diff = round(snapshot.rating - best.rating, 2);
      parts.push(
        diff >= 0
          ? `Rating is ${diff === 0 ? 'level with' : `${diff} ahead of`} the strongest competitor entered (${best.name}, ${best.rating}).`
          : `Rating is ${Math.abs(diff)} behind the strongest competitor entered (${best.name}, ${best.rating}).`,
      );
    }
    if (snapshot.reviewCount !== null && countedCompetitors.length > 0) {
      const most = countedCompetitors.reduce((a, b) =>
        b.reviewCount > a.reviewCount ? b : a,
      );
      const diff = snapshot.reviewCount - most.reviewCount;
      parts.push(
        diff >= 0
          ? `Review volume is ${diff === 0 ? 'level with' : `${diff} ahead of`} ${most.name} (${most.reviewCount}).`
          : `Review volume is ${Math.abs(diff)} behind ${most.name} (${most.reviewCount}).`,
      );
    }
    competitorSummary =
      parts.length > 0
        ? parts.join(' ')
        : 'Competitor values are incomplete, so no comparison is made.';
  }

  // --- baseline comparison ---------------------------------------------------
  const baselineComparison: MetricDelta[] = [];
  if (baseline) {
    const add = (
      key: string,
      label: string,
      nowValue: number | null,
      thenValue: number | null,
      dp: number,
    ) => {
      const available = nowValue !== null && thenValue !== null;
      baselineComparison.push({
        key,
        label,
        now: nowValue,
        then: thenValue,
        delta: available ? round(nowValue - thenValue, dp) : null,
        available,
      });
    };
    add('rating', 'Rating', snapshot.rating, baseline.rating, 2);
    add('reviewCount', 'Total reviews', snapshot.reviewCount, baseline.reviewCount, 0);
    add(
      'reviewsPerWeek',
      'Reviews per week',
      snapshot.reviewsPerWeek,
      baseline.reviewsPerWeek,
      2,
    );
  }

  // --- comparison against the previous snapshot ------------------------------
  let comparison: Comparison | null = null;
  if (previous) {
    const metrics: MetricDelta[] = [];
    const addMetric = (
      key: string,
      label: string,
      nowValue: number | null,
      thenValue: number | null,
      dp: number,
    ) => {
      const available = nowValue !== null && thenValue !== null;
      metrics.push({
        key,
        label,
        now: nowValue,
        then: thenValue,
        delta: available ? round(nowValue - thenValue, dp) : null,
        available,
      });
    };
    addMetric('rating', 'Rating', snapshot.rating, previous.rating, 2);
    addMetric('reviewCount', 'Total reviews', snapshot.reviewCount, previous.reviewCount, 0);
    addMetric(
      'reviewsPerWeek',
      'Reviews per week',
      snapshot.reviewsPerWeek,
      previous.reviewsPerWeek,
      2,
    );
    addMetric(
      'unanswered',
      'Unanswered reviews',
      snapshot.unansweredCount,
      previous.unansweredCount,
      0,
    );

    // Theme-level trend claims are sample-derived and need real evidence on
    // BOTH sides. Metric deltas above are directly observed and always allowed.
    const themeTrendAllowed =
      tier === 'STANDARD' && previous.totalReviewsAnalysed >= TIER_STANDARD_MIN;

    let themeTrendBlockedReason: string | null = null;
    if (!themeTrendAllowed) {
      themeTrendBlockedReason =
        tier !== 'STANDARD'
          ? `This month has ${total} reviews. Headway requires ${TIER_STANDARD_MIN}+ on both sides before comparing themes over time.`
          : `The previous snapshot analysed ${previous.totalReviewsAnalysed} reviews, below the ${TIER_STANDARD_MIN} needed to compare themes over time.`;
    }

    const buildDeltas = (
      current: Theme[],
      prior: Record<string, number>,
    ): ThemeDelta[] => {
      if (!themeTrendAllowed) return [];
      const keys = new Set<string>([...current.map((t) => t.key), ...Object.keys(prior)]);
      const labelFor = (k: string) =>
        current.find((t) => t.key === k)?.label ??
        pack.issueTaxonomy.find((t) => t.key === k)?.label ??
        pack.praiseTaxonomy.find((t) => t.key === k)?.label ??
        k;
      return [...keys]
        .map((k) => {
          const nowCount = current.find((t) => t.key === k)?.count ?? 0;
          const thenCount = prior[k] ?? 0;
          return {
            key: k,
            label: labelFor(k),
            now: nowCount,
            then: thenCount,
            delta: nowCount - thenCount,
          };
        })
        .filter((d) => d.now > 0 || d.then > 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.label.localeCompare(b.label));
    };

    let previousActionOutcome: Comparison['previousActionOutcome'] = null;
    if (previous.recommendedIssueKey) {
      const key = previous.recommendedIssueKey;
      const nowCount = issues.find((t) => t.key === key)?.count ?? 0;
      const thenCount = previous.issueCounts[key] ?? 0;
      const label =
        pack.issueTaxonomy.find((t) => t.key === key)?.label ?? key;
      const delta = nowCount - thenCount;
      previousActionOutcome = {
        issueKey: key,
        label,
        then: thenCount,
        now: nowCount,
        delta,
        verdict: !themeTrendAllowed
          ? 'NOT_COMPARABLE'
          : delta < 0
            ? 'IMPROVED'
            : delta > 0
              ? 'WORSE'
              : 'UNCHANGED',
      };
    }

    comparison = {
      previousSnapshotId: previous.id,
      previousLabel: previous.label ?? fmtDate(previous.capturedAt),
      previousCapturedAt: previous.capturedAt.toISOString(),
      daysBetween: daysBetween(snapshot.capturedAt, previous.capturedAt),
      metrics,
      themeTrendAllowed,
      themeTrendBlockedReason,
      issueDeltas: buildDeltas(issues, previous.issueCounts),
      praiseDeltas: buildDeltas(praises, previous.praiseCounts),
      previousActionOutcome,
    };
  }

  // --- opportunities (observed facts only) -----------------------------------
  const opportunities: Opportunity[] = [];

  if (unanswered !== null && unanswered > 0) {
    opportunities.push({
      key: 'response_gap',
      label: 'Close the reply gap',
      detail: responseGap.statement,
      score: 100 + unanswered,
    });
  }
  if (snapshot.reviewsPerWeek !== null && snapshot.reviewsPerWeek < 1) {
    opportunities.push({
      key: 'review_velocity',
      label: 'Restart steady review collection',
      detail: `Only ${snapshot.reviewsPerWeek} review${snapshot.reviewsPerWeek === 1 ? '' : 's'} per week are coming in. The counter kit and staff ask-script are the lever here.`,
      score: 90,
    });
  }
  if (postStale) {
    opportunities.push({
      key: 'post_stale',
      label: 'Profile looks dormant',
      detail: `No post in ${snapshot.daysSinceLastPost} days.`,
      score: 60 + Math.min(snapshot.daysSinceLastPost ?? 0, 60),
    });
  }
  if (photosStale) {
    opportunities.push({
      key: 'photos_stale',
      label: 'Photos are stale',
      detail: `Newest photo is ${snapshot.photoRecencyDays} days old.`,
      score: 50,
    });
  }
  const observedGaps = profileGaps.filter((g) => g.source === 'OBSERVED');
  if (observedGaps.length > 0) {
    opportunities.push({
      key: 'profile_gaps',
      label: 'Fix visible profile gaps',
      detail: `${observedGaps.length} gap${observedGaps.length === 1 ? '' : 's'} noted: ${observedGaps.map((g) => g.label).join('; ')}.`,
      score: 40 + observedGaps.length * 5,
    });
  }
  if (snapshot.rating !== null && ratedCompetitors.length > 0) {
    const best = ratedCompetitors.reduce((a, b) => (b.rating > a.rating ? b : a));
    if (best.rating > snapshot.rating) {
      opportunities.push({
        key: 'rating_behind',
        label: 'Rating behind the local benchmark',
        detail: `${best.name} sits at ${best.rating} against ${snapshot.rating}.`,
        score: 45 + Math.round((best.rating - snapshot.rating) * 20),
      });
    }
  }
  if (total < TIER_LIMITED_MIN) {
    opportunities.push({
      key: 'evidence_thin',
      label: 'Not enough feedback to read the room',
      detail: `Only ${total} review${total === 1 ? '' : 's'} were available to analyse this month. Getting that above ${TIER_LIMITED_MIN} is what makes the Pulse meaningful.`,
      score: 85,
    });
  }

  opportunities.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const clearestOpportunity = opportunities[0] ?? null;

  // --- emerging / watch item -------------------------------------------------
  let emerging: AnalysisResult['emerging'] = {
    kind: 'NONE',
    key: null,
    label: null,
    count: 0,
    previousCount: null,
    statement:
      'No emerging item is called this month — there is not enough evidence to separate a new problem from normal noise.',
  };

  if (comparison?.themeTrendAllowed && previous) {
    const candidates = issues
      .filter((t) => {
        const then = previous.issueCounts[t.key] ?? 0;
        return (
          t.count >= MIN_MENTIONS_FOR_THEME &&
          then < MIN_MENTIONS_FOR_THEME &&
          t.count - then >= 2
        );
      })
      .sort(
        (a, b) =>
          b.count -
            (previous.issueCounts[b.key] ?? 0) -
            (a.count - (previous.issueCounts[a.key] ?? 0)) ||
          b.count - a.count ||
          a.label.localeCompare(b.label),
      );

    const top = candidates[0];
    if (top) {
      const then = previous.issueCounts[top.key] ?? 0;
      emerging = {
        kind: 'EMERGING',
        key: top.key,
        label: top.label,
        count: top.count,
        previousCount: then,
        statement: `"${top.label}" went from ${then} mention${then === 1 ? '' : 's'} to ${top.count} between the two snapshots. That is a real change, not noise.`,
      };
    }
  }

  if (emerging.kind === 'NONE') {
    const watch = issues.find((t) => !t.qualifies && t.count > 0);
    if (watch) {
      emerging = {
        kind: 'WATCH',
        key: watch.key,
        label: watch.label,
        count: watch.count,
        previousCount: previous ? (previous.issueCounts[watch.key] ?? 0) : null,
        statement: `Watch item only: "${watch.label}" was mentioned ${watch.count} time${watch.count === 1 ? '' : 's'}. That is below the ${MIN_MENTIONS_FOR_THEME}-mention floor, so it is not being called a pattern — it is being watched next month.`,
      };
    } else if (!comparison) {
      emerging = {
        ...emerging,
        statement:
          'No emerging item can be called: this is the first snapshot, so there is no historical comparison to measure change against.',
      };
    } else if (comparison && !comparison.themeTrendAllowed) {
      emerging = {
        ...emerging,
        statement: `No emerging item can be called. ${comparison.themeTrendBlockedReason ?? ''}`.trim(),
      };
    }
  }

  // --- the ONE recommended action -------------------------------------------
  const qualifyingIssues = issues.filter((t) => t.qualifies);
  let recommendation: Recommendation;

  if (qualifyingIssues.length > 0) {
    const issueOrder = new Map(pack.issueTaxonomy.map((e, i) => [e.key, i]));
    const ranked = [...qualifyingIssues].sort(
      (a, b) =>
        severityWeight(b.severity) * b.count - severityWeight(a.severity) * a.count ||
        (a.avgStars ?? 6) - (b.avgStars ?? 6) ||
        b.count - a.count ||
        (issueOrder.get(a.key) ?? 0) - (issueOrder.get(b.key) ?? 0),
    );
    const top = ranked[0] as Theme;
    const packEntry = pack.issueTaxonomy.find((t) => t.key === top.key);

    const evidence: string[] = [
      `${top.count} of ${total} reviews analysed mention ${top.label.toLowerCase()}${top.share !== null ? ` (${pct(top.share)})` : ''}.`,
    ];
    if (top.avgStars !== null) {
      evidence.push(
        `Those reviews average ${top.avgStars} stars across the ${top.starsSampleSize} that carried a rating.`,
      );
    }
    if (comparison?.themeTrendAllowed) {
      const delta = comparison.issueDeltas.find((d) => d.key === top.key);
      if (delta) {
        evidence.push(
          `Previous snapshot had ${delta.then} mention${delta.then === 1 ? '' : 's'} of the same theme (change: ${delta.delta > 0 ? '+' : ''}${delta.delta}).`,
        );
      }
    }

    recommendation = {
      source: 'PULSE',
      issueKey: top.key,
      title: `Fix: ${top.label}`,
      action:
        packEntry?.action ??
        `Address ${top.label.toLowerCase()} — it is the most-mentioned issue in this month's feedback.`,
      evidence,
      confidence:
        tier === 'STANDARD' && top.count >= 5
          ? 'HIGH'
          : tier === 'STANDARD'
            ? 'MEDIUM'
            : 'MEDIUM',
      caveat:
        tier === 'LIMITED'
          ? `Based on ${total} reviews. Enough to act on, not enough to call a trend.`
          : null,
    };
  } else {
    const opp = clearestOpportunity;
    recommendation = {
      source: 'OPERATIONAL',
      issueKey: null,
      title: opp ? opp.label : 'Start collecting honest feedback consistently',
      action: opp
        ? opp.detail
        : 'Install the feedback kit at the counter and run the staff ask-script with every customer, so next month has enough evidence to read.',
      evidence:
        tier === 'INSUFFICIENT'
          ? [
              `Only ${total} review${total === 1 ? '' : 's'} were available to analyse — below the ${TIER_LIMITED_MIN}-review floor.`,
              'No Customer Pulse theme is claimed from this sample.',
            ]
          : [
              `${total} reviews analysed, but no single theme reached the ${MIN_MENTIONS_FOR_THEME}-mention floor.`,
              'The clearest action this month comes from the observed profile data, not the feedback sample.',
            ],
      confidence: tier === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'LOW',
      caveat:
        tier === 'INSUFFICIENT'
          ? `Headway will not invent a pattern from ${total} review${total === 1 ? '' : 's'}.`
          : 'No theme cleared the evidence floor, so this action comes from the Health Card side.',
    };
  }

  // --- what gets checked next month ------------------------------------------
  const nextMonthChecks: string[] = [];
  if (recommendation.issueKey) {
    const t = issues.find((i) => i.key === recommendation.issueKey);
    nextMonthChecks.push(
      `Mentions of "${t?.label ?? recommendation.issueKey}" — currently ${t?.count ?? 0} of ${total} reviews.`,
    );
  } else {
    nextMonthChecks.push(
      `Number of reviews available to analyse — currently ${total}. Target is ${TIER_LIMITED_MIN}+.`,
    );
  }
  nextMonthChecks.push(
    snapshot.rating === null
      ? 'Rating — not observed this month, so there is nothing to compare against yet.'
      : `Rating — currently ${snapshot.rating}.`,
  );
  nextMonthChecks.push(
    reviewCount === null
      ? 'Total reviews — not observed this month.'
      : `Total reviews — currently ${reviewCount}.`,
  );
  nextMonthChecks.push(
    unanswered === null
      ? 'Unanswered reviews — not observed this month.'
      : `Unanswered reviews — currently ${unanswered}.`,
  );
  nextMonthChecks.push(
    `Headline KPI (${pack.headlineKpi.label}) — ${
      snapshot.reviewsPerWeek === null
        ? 'not observed this month'
        : `currently ${snapshot.reviewsPerWeek} per week`
    }.`,
  );

  // --- explicit data gaps ----------------------------------------------------
  const dataGaps: string[] = [];
  if (snapshot.rating === null) dataGaps.push('Business rating was not entered.');
  if (snapshot.reviewCount === null) dataGaps.push('Total review count was not entered.');
  if (snapshot.unansweredCount === null)
    dataGaps.push('Unanswered review count was not observed.');
  if (snapshot.daysSinceLastPost === null)
    dataGaps.push('Days since last post was not observed.');
  if (snapshot.photoRecencyDays === null)
    dataGaps.push('Photo recency was not observed.');
  if (snapshot.reviewsPerWeek === null)
    dataGaps.push('Reviews per week was not observed.');
  if (competitors.length === 0) dataGaps.push('No competitor values were entered.');
  if (total === 0) dataGaps.push('No reviews were pasted, so there is no Customer Pulse.');
  if (withStars.length === 0 && total > 0)
    dataGaps.push('No star ratings were supplied with the pasted reviews.');
  if (withDates.length === 0 && total > 0)
    dataGaps.push('No dates were supplied with the pasted reviews.');
  if (!previous) dataGaps.push('No earlier snapshot exists, so no month-on-month comparison is possible.');

  return {
    version: ANALYSIS_VERSION,
    computedAt: now.toISOString(),
    packId: pack.id,
    totals: {
      reviewsAnalysed: total,
      withStars: withStars.length,
      withDates: withDates.length,
      redactedNote:
        'All pasted feedback is stored anonymously. Names, emails, phone numbers and handles are stripped at ingest.',
    },
    evidence: {
      tier,
      minMentions: MIN_MENTIONS_FOR_THEME,
      canClaimThemes: tier !== 'INSUFFICIENT',
      canClaimTrend: comparison?.themeTrendAllowed ?? false,
      statement: evidenceStatement(tier, total),
    },
    starDistribution,
    averageStarsInSample,
    sentiment,
    languageMix: languageMixSummary(reviews.map((r) => r.language)),
    issues,
    praises,
    responseGap,
    activity,
    profileGaps,
    competitors: competitorRows,
    competitorSummary,
    baselineComparison,
    comparison,
    opportunities,
    clearestOpportunity,
    emerging,
    recommendation,
    nextMonthChecks,
    dataGaps,
  };
}

/** Compact form persisted on a snapshot so a later snapshot can compare to it. */
export function toPreviousSummary(
  snapshotId: string,
  label: string | null,
  capturedAt: Date,
  observation: SnapshotObservation,
  analysis: AnalysisResult,
): PreviousSnapshotSummary {
  return {
    id: snapshotId,
    label,
    capturedAt,
    rating: observation.rating,
    reviewCount: observation.reviewCount,
    reviewsPerWeek: observation.reviewsPerWeek,
    unansweredCount: observation.unansweredCount,
    totalReviewsAnalysed: analysis.totals.reviewsAnalysed,
    issueCounts: toCountMap(analysis.issues),
    praiseCounts: toCountMap(analysis.praises),
    recommendedIssueKey: analysis.recommendation.issueKey,
  };
}
