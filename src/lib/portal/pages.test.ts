import { describe, expect, it } from 'vitest';
import type { AnalysisCoverage } from '@/lib/feedback/analysis';
import type { FeedbackRow, FeedbackStats } from '@/lib/feedback/service';
import type { SnapshotListRow } from '@/lib/snapshots/service';
import { formatDate } from '@/lib/format';
import {
  buildAnalysisView,
  buildCheckinView,
  buildImprovementsView,
  buildReviewsView,
  type ReviewFilters,
} from './pages';
import {
  CAUSAL,
  INTERNALS,
  NOW,
  action,
  clinic,
  input,
  intel,
  pulseAfterChange,
  pulseWith,
} from './test-fixtures';

const text = (v: unknown) => JSON.stringify(v);

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

describe('customers — why RepOS is saying this', () => {
  it('opens with the interpretation, not a list', () => {
    const v = buildAnalysisView(input());
    expect(v.telling).toEqual([
      "Customers praise your doctor's care and explanation most.",
      'Long waiting time is where the experience falls short most often — 9 of the 50 pieces of feedback we have read.',
      '1 other complaint is worth watching; RepOS is not asking you to act on it yet.',
    ]);
  });

  it('splits movement into better and worse, and names what held steady', () => {
    const v = buildAnalysisView(
      input({ intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 3, careThen: 4, careNow: 4 }) }) }),
    );
    expect(v.better.map((s) => s.themeKey)).toEqual(['wait_time']);
    expect(v.worse).toEqual([]);
    expect(v.steady.map((s) => s.themeKey)).toEqual(['doctor_care']);
    expect(v.steadyLine).toBeNull();
  });

  it('says what held steady when the two check-ins were compared and nothing moved', () => {
    const v = buildAnalysisView(input({ intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 9 }) }) }));
    expect(v.steadyLine).toBe(
      "Nothing moved by 2 or more mentions between these check-ins. Doctor's care and explanation (4 → 4 mentions) and long waiting time (9 → 9 mentions) held steady.",
    );
  });

  it('is honest about recurrence until two check-ins exist', () => {
    const v = buildAnalysisView(input());
    expect(v.recurring).toEqual([]);
    expect(v.fresh).toEqual([]);
    expect(v.recurrenceNote).toMatch(/No check-in has been recorded yet/);
  });

  it('puts early themes under not-yet-clear with the no-action sentence', () => {
    const v = buildAnalysisView(input());
    expect(v.early.map((s) => s.themeKey)).toEqual(['staff_friendly']);
    expect(v.noAction).toMatch(/not recommending action/);
  });

  it('never leaks internals or causes', () => {
    const t = text(buildAnalysisView(input({ actions: [action('MEASURED')] })));
    expect(t).not.toMatch(INTERNALS);
    expect(t).not.toMatch(CAUSAL);
  });
});

// ---------------------------------------------------------------------------
// Improvements
// ---------------------------------------------------------------------------

describe('improvements — what did we do, and did it help', () => {
  it('keeps the record and files a compared change under compared', () => {
    const v = buildImprovementsView(input({ actions: [action('MEASURED', 'IMPROVED')] }));
    expect(v.record).toBe('1 change compared · mentioned less often after 1');
    expect(v.checked).toHaveLength(1);
    expect(v.open).toEqual([]);
    expect(v.notPursued).toEqual([]);
    expect(v.suggested).toBeNull();
    expect(v.checked[0]?.nextStep).toMatch(/^Nothing in the feedback after the change says to undo it/);
  });

  it('counts a theme that came up more often honestly, without calling it a cause', () => {
    const v = buildImprovementsView(input({ actions: [action('MEASURED', 'WORSENED')] }));
    expect(v.record).toBe('1 change compared · more often after 1');
    expect(v.checked[0]?.memory?.result).toBe('More often');
    expect(v.checked[0]?.nextStep).toMatch(/^It came up more often in the feedback after the change\. That does not show the change caused it/);
  });

  it('keeps an agreed change open, and a declined one under not pursued with its reason', () => {
    expect(buildImprovementsView(input({ actions: [action('ACCEPTED')] })).open).toHaveLength(1);
    const declined = buildImprovementsView(input({ actions: [action('DECLINED')] }));
    expect(declined.notPursued[0]?.stage).toBe('NOT_DOING');
    expect(declined.notPursued[0]?.decisionNote).toBe('Hiring a second receptionist first.');
    expect(declined.record).toBe('No change has been compared against feedback yet.');
  });

  it('offers the leading complaint as the decision to start when nothing has been agreed', () => {
    const v = buildImprovementsView(input());
    expect(v.record).toBe('No change has been agreed yet.');
    expect(v.suggested?.themeKey).toBe('wait_time');
  });

  it('lists a change that helped and is now slipping, only on check-ins after the change', () => {
    const v = buildImprovementsView(
      input({
        intelligence: intel({ pulse: pulseAfterChange({ waitThen: 3, waitNow: 9 }) }),
        actions: [action('MEASURED', 'IMPROVED')],
      }),
    );
    expect(v.returning).toHaveLength(1);
    expect(v.returning[0]?.sinceThen).toMatch(/^At check-ins after the change: 3 mentions at your check-in on March, 9 at May/);
  });

  it('never leaks internals or causes', () => {
    for (const status of ['RECOMMENDED', 'ACCEPTED', 'DONE', 'MEASURED', 'DECLINED'] as const) {
      const t = text(buildImprovementsView(input({ actions: [action(status)] })));
      expect(t).not.toMatch(INTERNALS);
      expect(t).not.toMatch(CAUSAL);
    }
  });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const WAIT: FeedbackRow['themes'] = [
  { key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' },
];
const CARE: FeedbackRow['themes'] = [
  { key: 'doctor_care', label: "Doctor's care and explanation", kind: 'PRAISE', sentiment: 'POSITIVE', severity: 'low' },
];

function row(over: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: 'r1',
    clientId: 'c1',
    text: 'Waited over an hour past my appointment time',
    preview: 'Waited over an hour past my appointment time',
    stars: 1,
    reviewDate: new Date(2026, 4, 2),
    source: 'PUBLIC_REVIEW',
    sourceLabel: 'Public review',
    redacted: false,
    redactions: [],
    analysed: true,
    createdAt: NOW,
    sentiment: 'NEGATIVE',
    themes: WAIT,
    confidence: 'HIGH',
    reasons: ['matched a hint'],
    language: 'en',
    analysisError: null,
    responseClass: 'COMPLAINT',
    responseAction: 'REPLY_RECOMMENDED',
    priorityBand: 'HIGH',
    priorityRank: 1,
    priorityReasons: ['low rating'],
    draftText: 'We are sorry about the wait.',
    draftLanguage: 'en',
    draftSource: 'TEMPLATE',
    draftStatus: 'READY',
    draftCurrent: true,
    draftNotes: [],
    draftError: null,
    handledAt: null,
  answers: [],
    ...over,
  };
}

const ROWS: FeedbackRow[] = [
  row(),
  row({ id: 'r2', text: 'An hour late and nobody said sorry', handledAt: NOW, draftStatus: 'HANDLED' }),
  row({ id: 'r3', text: 'The wrong tooth was treated', responseAction: 'NEEDS_HUMAN', draftStatus: 'BLOCKED', draftText: null }),
  row({
    id: 'r4',
    text: 'The doctor explained everything clearly',
    stars: 5,
    sentiment: 'POSITIVE',
    themes: CARE,
    responseClass: 'PRAISE',
    responseAction: 'REPLY_OPTIONAL',
    priorityBand: 'LOW',
    draftText: 'Thank you, it is good to hear that.',
    source: 'WALK_IN',
    sourceLabel: 'In person',
  }),
  row({
    id: 'r5',
    text: 'Fine visit',
    stars: 4,
    sentiment: 'NEUTRAL',
    themes: [],
    responseClass: 'UNCLASSIFIED',
    responseAction: 'NONE',
    priorityBand: 'NONE',
    draftStatus: 'NONE',
    draftText: null,
    draftCurrent: false,
  }),
];

const STATS: FeedbackStats = {
  total: 5,
  analysed: 5,
  unanalysed: 0,
  withRating: 5,
  redacted: 0,
  averageRating: 2.4,
  newestAt: NOW,
  ratingCounts: { '1': 3, '4': 1, '5': 1 },
  sourceCounts: [
    { source: 'PUBLIC_REVIEW', label: 'Public review', count: 4 },
    { source: 'WALK_IN', label: 'In person', count: 1 },
  ],
};

const COVERAGE: AnalysisCoverage = {
  total: 5,
  analysed: 5,
  needsAnalysis: 0,
  failed: 0,
  outOfDate: 0,
  sentimentCounts: { POSITIVE: 1, NEGATIVE: 3, MIXED: 0, NEUTRAL: 1, UNKNOWN: 0 },
  upToDate: true,
};

function filters(over: Partial<ReviewFilters> = {}): ReviewFilters {
  return { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null, ...over };
}

function reviews(f: Partial<ReviewFilters> = {}, rows = ROWS) {
  return buildReviewsView({
    businessName: 'Sunrise Dental Clinic',
    pack: clinic,
    stats: STATS,
    coverage: COVERAGE,
    rows,
    matching: rows.length,
    hasMore: false,
    nextPage: 2,
    filters: filters(f),
    intelligence: intel(),
    replyWorth: 2,
  });
}

describe('reviews — the evidence', () => {
  it('says what RepOS found before showing a single review, with every count scoped', () => {
    const v = reviews();
    expect(v.found).toEqual([
      'Across all 5 pieces of feedback read: 1 positive, 0 mixed, 1 neutral, 3 negative.',
      "The two things praised most are doctor's care and explanation and friendly, helpful staff.",
      'The complaint that matters most is long waiting time. It appears in 9 of the 50 comments.',
      '2 of the 5 need an answer from you. A draft is attached where RepOS could write one safely; the rest need your own words.',
    ]);
    expect(v.quick).toEqual([
      { label: 'Long waiting time (9 comments)', query: 'theme=wait_time' },
      { label: 'All positive (1)', query: 'sentiment=POSITIVE' },
      { label: 'All negative (3)', query: 'sentiment=NEGATIVE' },
      { label: 'Need your answer (2 of 5)', query: 'needs=reply' },
    ]);
    expect(v.withRating).toBe(5);
  });

  it('shows each comment with the reading attached, and no sorting when there is none', () => {
    const by = Object.fromEntries(reviews().items.map((i) => [i.id, i]));
    expect(by.r1?.sentimentLabel).toBe('Negative');
    expect(by.r1?.classLabel).toBe('Complaint');
    expect(by.r1?.themes).toEqual(['Long waiting time']);
    expect(by.r5?.classLabel).toBeNull();
  });

  it('separates comments that need an answer from optional drafts', () => {
    const by = Object.fromEntries(reviews().items.map((i) => [i.id, i]));
    expect(by.r1?.replyState).toBe('SUGGESTED');
    expect(by.r1?.suggestedReply).toBe('We are sorry about the wait.');
    expect(by.r2?.replyState).toBe('ANSWERED');
    expect(by.r2?.suggestedReply).toBeNull();
    expect(by.r3?.replyState).toBe('YOURS');
    expect(by.r4?.replyState).toBe('DRAFT');
    expect(by.r4?.suggestedReply).toBe('Thank you, it is good to hear that.');
    expect(by.r5?.replyState).toBeNull();
  });

  it('renders exactly the rows it was given, in order', () => {
    // Filtering and paging moved into the query in M18, so the builder must
    // not quietly drop or reorder anything — what the query selected is what
    // the owner reads, and the count beside it comes from the same WHERE.
    const v = reviews({ needs: 'reply' }, [ROWS[0]!, ROWS[2]!]);
    expect(v.items.map((i) => i.id)).toEqual(['r1', 'r3']);
    expect(v.shown).toBe(2);
    expect(v.matching).toBe(2);
    expect(v.hasMore).toBe(false);
  });

  it('shows the owner-facing shape and nothing more', () => {
    const v = reviews();
    expect(Object.keys(v.items[0]!).sort()).toEqual([
      'at', 'classLabel', 'id', 'replyState', 'sentiment', 'sentimentLabel', 'sourceLabel', 'stars', 'suggestedReply', 'text', 'themes',
    ]);
    const t = text(v);
    expect(t).not.toMatch(/priorityRank|priorityReasons|draftNotes|draftSource|redactions|clientId|matched a hint|low rating/);
    expect(t).not.toMatch(INTERNALS);
  });

  it('describes the active filters as one sentence', () => {
    expect(
      reviews({ theme: 'wait_time', stars: 1, sentiment: 'NEGATIVE', needs: 'reply', q: 'hour' }).filterSummary,
    ).toBe('about long waiting time, rated 1 star, negative, that need your answer, mentioning "hour"');
    expect(reviews().filterSummary).toBeNull();
  });

  it('lays out ratings five to one and tones in a fixed order, from this vertical only', () => {
    const v = reviews();
    expect(v.ratings.map((r) => r.count)).toEqual([1, 1, 0, 0, 3]);
    expect(v.sentiments.map((s) => `${s.label}:${s.count}`)).toEqual(['Positive:1', 'Mixed:0', 'Neutral:1', 'Negative:3']);
    expect(v.themeOptions.some((t) => t.key === 'stylist_skill')).toBe(false);
    expect(v.themeOptions.map((t) => t.kind).lastIndexOf('ISSUE')).toBeLessThan(
      v.themeOptions.findIndex((t) => t.kind === 'PRAISE'),
    );
  });
});

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

function listed(id: string, label: string, capturedAt: Date): SnapshotListRow {
  return { id, label, capturedAt, rating: 4.4, reviewCount: 180, feedbackCount: 20, isBaseline: false, narrativeSource: null };
}

const TWO = [listed('s2', 'May', new Date(2026, 4, 1)), listed('s1', 'March', new Date(2026, 2, 1))];
const MAR = formatDate(new Date(2026, 2, 1));

describe('check-in — what changed', () => {
  it('is named after the latest check-in and says what it compares', () => {
    const v = buildCheckinView({ ...input(), checkins: TWO });
    expect(v.title).toBe('Your May check-in');
    expect(v.periodNote).toMatch(/^Compares your check-in on .* with the one on /);
    expect(v.periodNote).not.toContain('check-in of');
  });

  it('reports movement only, keeps later comparisons apart, and says what held steady', () => {
    const v = buildCheckinView({
      ...input({ intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 3 }) }), actions: [action('MEASURED')] }),
      checkins: TWO,
    });
    expect(v.movementLine).toBe(`Since your check-in on ${MAR}: 1 thing improved.`);
    expect(v.better.map((s) => s.themeKey)).toEqual(['wait_time']);
    expect(v.better[0]?.movementBrief).toBe('Customers raised it less at your latest check-in than at the one before.');
    // Measured on 1 Jun, after the May check-in: reported as "since this check-in", not inside it.
    expect(v.checked).toEqual([]);
    expect(v.sinceCheckin).toHaveLength(1);
    expect(v.unchangedNote).toMatch(/^Everything else RepOS could compare held steady, including doctor's care and explanation\./);
    expect(v.unchangedNote).toMatch(/2 themes had too few mentions at one of the two check-ins to compare\.$/);
    expect(v.next.map((w) => w.themeKey)).toEqual(['wait_time']);
  });

  it('says so simply when nothing moved', () => {
    const v = buildCheckinView({
      ...input({ intelligence: intel({ pulse: pulseWith({ waitThen: 9, waitNow: 9 }) }) }),
      checkins: TWO,
    });
    expect(v.movementLine).toBe(`Nothing moved enough to report since your check-in on ${MAR}.`);
    expect(v.unchangedNote).toMatch(/too few mentions/);
    expect(v.next).toEqual([]);
  });

  it('does not invent movement without two check-ins', () => {
    const v = buildCheckinView({ ...input(), checkins: TWO.slice(0, 1) });
    expect(v.movementLine).toMatch(/two check-ins/);
    expect(v.periodNote).toMatch(/A second check-in/);
    expect(v.unchangedNote).toBe('');
  });

  it('never leaks internals or causes', () => {
    const t = text(buildCheckinView({ ...input({ actions: [action('MEASURED')] }), checkins: TWO }));
    expect(t).not.toMatch(INTERNALS);
    expect(t).not.toMatch(CAUSAL);
  });
});
