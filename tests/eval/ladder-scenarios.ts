import { ANALYSIS_VERSION, normalizeFeedback, type NormalizedFeedback } from '@/lib/analysis/normalize';
import { summariseThemeRows, type AnalysisCoverage, type ThemeSummary } from '@/lib/feedback/analysis';
import type { FeedbackStats } from '@/lib/feedback/service';
import { computeHealthCard, computePulse, type StoredSnapshot } from '@/lib/health/health';
import { buildIntelligence, type ClientIntelligence } from '@/lib/intelligence/engine';
import { EMPTY_CONTEXT } from '@/lib/context/apply';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { EN, type PortalTranslator } from '@/lib/i18n/translator';
import { buildBrief, type Brief } from '@/lib/portal/brief';
import { buildEvidenceIndex } from '@/lib/portal/evidence';
import { buildEvidenceState, pileFrom, type EvidenceState } from '@/lib/portal/ladder';
import {
  buildAnalysisView,
  buildImprovementsView,
  buildReviewsView,
  type AnalysisView,
  type ImprovementsView,
  type ReviewsView,
} from '@/lib/portal/pages';
import { buildTrendReadiness } from '@/lib/portal/trends';
import { buildPortalView, type PortalInput, type PortalView } from '@/lib/portal/view';
import { buildResponsibility, type Responsibility } from '@/lib/responsibility/engine';
import { toStoredFeedback } from '@/lib/snapshots/service';
import { withAutomaticPeriods } from '@/lib/snapshots/periods';

/**
 * THE EVIDENCE LADDER, END TO END, IN MEMORY (Oct 2026).
 *
 * Real customer words go through the real deterministic reader
 * (`normalizeFeedback`), the real theme summary, the real automatic comparison
 * periods, the real intelligence engine, and from there to every surface the
 * owner reads: Home's brief and evidence state, Feedback, Customers, Trends,
 * and the responsibility layer. No database, no clock, no provider — so a
 * matrix of hundreds of businesses runs in a second, and every assertion is
 * about what the product would actually show for those words.
 */

export const NOW = new Date('2026-10-01T12:00:00.000Z');
const DAY = 86_400_000;

export type Response = {
  text: string;
  stars: number | null;
  /** When it reached Headway. Defaults to one per hour, ending at NOW. */
  at?: Date;
};

export type LadderRun = {
  pack: Pack;
  /** The ledger rows as the pipeline stores them: read rows first, then any unread. */
  rows: Array<Record<string, unknown> & { id: string; text: string; stars: number | null; createdAt: Date; analysisStatus: string }>;
  readings: NormalizedFeedback[];
  themes: ThemeSummary;
  periods: StoredSnapshot[];
  intelligence: ClientIntelligence;
  input: PortalInput;
  view: PortalView;
  state: EvidenceState;
  responsibility: Responsibility;
  brief: Brief;
  analysis: AnalysisView;
  improvements: ImprovementsView;
  reviews: ReviewsView;
};

export function runLadder(
  responses: Response[],
  options: { pack?: string; t?: PortalTranslator; unread?: Response[] } = {},
): LadderRun {
  const pack = getPackOrFallback(options.pack ?? 'restaurant');
  const t = options.t ?? EN;
  const n = responses.length;
  const dated = responses.map((r, i) => ({ ...r, at: r.at ?? new Date(NOW.getTime() - (n - i) * 3_600_000) }));
  const readings = dated.map((r) => normalizeFeedback({ text: r.text, stars: r.stars, pack, ai: null }));

  // The ledger rows the product reads, as the pipeline stores them.
  const rows = dated.map((r, i) => {
    const reading = readings[i]!;
    return {
      id: `r${String(i).padStart(4, '0')}`,
      text: r.text,
      stars: r.stars,
      reviewDate: null as Date | null,
      createdAt: r.at,
      source: 'REP_OS_QR',
      snapshotId: null as string | null,
      sentiment: reading.sentiment,
      issueTags: JSON.stringify(reading.issueTags),
      praiseTags: JSON.stringify(reading.praiseTags),
      themesJson: JSON.stringify(reading.themes),
      analysisStatus: 'ANALYSED',
      analysisVersion: ANALYSIS_VERSION,
    };
  });
  const unread = (options.unread ?? []).map((r, i) => ({
    id: `u${String(i).padStart(4, '0')}`,
    text: r.text,
    stars: r.stars,
    reviewDate: null as Date | null,
    createdAt: r.at ?? NOW,
    source: 'REP_OS_QR',
    snapshotId: null as string | null,
    sentiment: 'UNKNOWN',
    issueTags: '[]',
    praiseTags: '[]',
    themesJson: '[]',
    analysisStatus: 'PENDING',
    analysisVersion: 0,
  }));
  const ledger = [...rows, ...unread];

  const themes: ThemeSummary = { ...summariseThemeRows(rows, pack), dimensions: [] };
  const periods = withAutomaticPeriods(
    [],
    rows.map((row) => ({ id: row.id, createdAt: row.createdAt, snapshotId: row.snapshotId, feedback: toStoredFeedback(row) })),
  );
  const pulse = computePulse({ pack, snapshots: periods, now: NOW, t });
  const intelligence = buildIntelligence({
    client: { id: 'c1', businessName: 'Test Business', vertical: pack.id },
    pack,
    themes,
    totalFeedback: ledger.length,
    pulse,
    notes: [],
    t,
  });
  const input: PortalInput = {
    intelligence,
    card: computeHealthCard({ pack, snapshots: [], now: NOW, t }),
    actions: [],
    snapshots: periods,
    pack,
    themes,
    context: EMPTY_CONTEXT,
    t,
  };
  const view = buildPortalView(input);
  const trendReadiness = buildTrendReadiness(input);
  const state = buildEvidenceState({ view, themes, pile: pileFrom(ledger), trendReadiness, pack, t });

  const responsibility = buildResponsibility({
    view,
    intelligence,
    actions: [],
    checkins: [],
    feedbackSince: { total: ledger.length, read: rows.length, unread: unread.length, direct: rows.length },
    comparison: { periods: trendReadiness.checkins, latestAt: trendReadiness.latest?.at ?? null, readSince: trendReadiness.since },
    needsYourWords: 0,
    gateway: { enabled: true, received: ledger.length },
    archived: false,
    now: NOW,
    t,
  });

  const counts = { POSITIVE: 0, NEGATIVE: 0, MIXED: 0, NEUTRAL: 0, UNKNOWN: 0 };
  for (const row of rows) counts[row.sentiment as keyof typeof counts] += 1;
  const coverage: AnalysisCoverage = {
    total: ledger.length,
    analysed: rows.length,
    needsAnalysis: unread.length,
    failed: 0,
    processing: 0,
    outOfDate: 0,
    sentimentCounts: counts,
    upToDate: unread.length === 0,
  };
  const rated = rows.filter((r) => r.stars !== null);
  const stats: FeedbackStats = {
    total: ledger.length,
    analysed: rows.length,
    unanalysed: unread.length,
    waiting: unread.length,
    processing: 0,
    failed: 0,
    withRating: rated.length,
    redacted: 0,
    averageRating: rated.length > 0 ? rated.reduce((s, r) => s + (r.stars ?? 0), 0) / rated.length : null,
    newestAt: NOW,
    ratingCounts: {},
    sourceCounts: [],
  };

  const evidence = buildEvidenceIndex(rows);
  const brief = buildBrief({ view, responsibility, evidence, coverage, basePath: '/workspace/c1', now: NOW, t });
  const analysis = buildAnalysisView(input);
  const improvements = buildImprovementsView(input);
  const reviews = buildReviewsView({
    businessName: 'Test Business',
    pack,
    stats,
    coverage,
    rows: [],
    matching: 0,
    hasMore: false,
    nextPage: 2,
    filters: { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null },
    intelligence,
    themes,
    replyWorth: 0,
    t,
  });

  return { pack, rows: ledger, readings, themes, periods, intelligence, input, view, state, responsibility, brief, analysis, improvements, reviews };
}

/** `n` responses cycling through `bank`, each made unique so none is a duplicate. */
export function cycle(bank: Response[], n: number, tag = 'x'): Response[] {
  return Array.from({ length: n }, (_, i) => {
    const r = bank[i % bank.length]!;
    return { ...r, text: r.text ? `${r.text} (${tag}${i})` : r.text };
  });
}

/** Responses spread evenly over `days`, oldest first — for automatic periods. */
export function spread(responses: Response[], days: number, end: Date = NOW): Response[] {
  const step = responses.length > 1 ? (days * DAY) / (responses.length - 1) : 0;
  const start = end.getTime() - days * DAY;
  return responses.map((r, i) => ({ ...r, at: new Date(start + i * step) }));
}

// ---------------------------------------------------------------------------
// Sentence banks — every line checked against the real reader in
// tests/m50.evidence-ladder.test.ts, so a bank that stops meaning what it says
// fails loudly rather than quietly changing the matrix.
// ---------------------------------------------------------------------------

export const PRAISE_BANK: Response[] = [
  { text: 'Loved the coffee, really smooth', stars: 5 },
  { text: 'The food was delicious and fresh', stars: 5 },
  { text: 'Staff were warm and welcoming', stars: 5 },
  { text: 'Lovely ambience and beautiful decor', stars: 4 },
];

export const COMPLAINT_BANK: Response[] = [
  { text: 'Service was very slow, we waited 40 minutes', stars: 1 },
  { text: 'The food arrived cold', stars: 2 },
  { text: 'The washroom was dirty', stars: 1 },
];

export const MIXED_BANK: Response[] = [
  { text: 'Loved the coffee but the service was slow', stars: 4 },
  { text: 'Food was tasty but the bill was wrong', stars: 3 },
];

export const NEUTRAL_BANK: Response[] = [
  { text: 'It was okay', stars: 3 },
  { text: 'Average experience', stars: 3 },
];

export const RATING_ONLY_BANK: Response[] = [
  { text: '', stars: 5 },
  { text: '', stars: 4 },
  { text: '', stars: 1 },
];

export const MULTILINGUAL_BANK: Response[] = [
  { text: 'खाना बहुत स्वादिष्ट था', stars: 5 },
  { text: 'जेवण खूप छान होतं', stars: 5 },
  { text: 'Khana bahut accha tha but service bahut slow thi', stars: 3 },
  { text: 'सर्विस बहुत धीमी थी', stars: 2 },
  { text: 'सेवा खूप हळू होती', stars: 2 },
];

export const AMBIGUOUS_BANK: Response[] = [
  { text: 'Not bad.', stars: null },
  { text: 'Could be better.', stars: null },
  { text: 'Last time was much better.', stars: null },
];

export const THIRD_PARTY_BANK: Response[] = [
  { text: 'The rider was late', stars: 2 },
  { text: 'The delivery guy was rude', stars: 2 },
];

/** A five-star rating over a complaint: the rating never erases the words. */
export const CONTRADICTORY_BANK: Response[] = [{ text: 'Waited an hour for our food', stars: 5 }];

export const MIXES: Record<string, Response[]> = {
  'positive-only': PRAISE_BANK,
  'negative-only': COMPLAINT_BANK,
  mixed: [...PRAISE_BANK, ...MIXED_BANK, ...COMPLAINT_BANK],
  neutral: NEUTRAL_BANK,
  'no-text ratings': RATING_ONLY_BANK,
  'multi-topic': [{ text: 'The bill was wrong, they overcharged us', stars: 1 }, ...MIXED_BANK],
  multilingual: MULTILINGUAL_BANK,
  ambiguous: AMBIGUOUS_BANK,
  'third-party': THIRD_PARTY_BANK,
  contradictory: [...CONTRADICTORY_BANK, ...PRAISE_BANK],
};

/** The counts the evidence-ladder matrix runs at. */
export const LADDER_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 15, 20, 24, 25, 30, 50, 100];

/**
 * THE CRAZY CHEESY FIRST READ — the five responses behind the screenshots
 * that started the evidence-ladder pass: four rated (5, 5, 5, 4 — a 4.8
 * average), four happy, one mixed, none unhappy, nothing a pattern.
 */
export const CRAZY_CHEESY: Response[] = [
  { text: 'The food was delicious and fresh', stars: 5 },
  { text: 'Loved the coffee, really smooth', stars: 5 },
  { text: '', stars: 5 },
  { text: 'Staff were warm and welcoming', stars: 4 },
  { text: 'Loved the cappuccino, but the service was slow.', stars: null },
];
