import type { PrismaClient } from '@prisma/client';
import { summariseThemeRows, type ThemeSummaryRow } from '@/lib/feedback/analysis';
import {
  MIN_CHANGE_TO_REPORT,
  MIN_MENTIONS_TO_NAME,
  MIN_PERIOD_FEEDBACK_TO_COMPARE,
} from '@/lib/intelligence/engine';
import { getPackOrFallback } from '@/lib/packs';
import { RESULT_LABELS, type ActionResult } from '@/lib/improve/model';

/** A stored result string RepOS still recognises. */
function isActionResult(value: string | null): value is ActionResult {
  return value !== null && value in RESULT_LABELS;
}

/**
 * PERIOD REPORTS — the weekly Pulse and the monthly Review (M20 Stage 4).
 *
 * These are NOT a second intelligence engine, and they must never become one.
 * Everything here counts rows inside a window and hands them to
 * `summariseThemeRows`, which is the same function every other surface uses.
 * The judgement about what a theme means, and the floors that decide whether
 * RepOS will name it at all, stay where they were in M10.
 *
 * NOTHING IS STORED. There is no weekly_report table and no monthly snapshot,
 * because a period report is a pure function of feedback that is already in
 * the database and a date. Storing one would mean two versions of the truth
 * and a job to keep them in step, in exchange for nothing an owner can see.
 *
 * THE PERIOD BOUNDARY, once, so every caller means the same thing:
 *
 *   A week is the 7×24 hours ending at `now`. The one before it is the 7×24
 *   hours before that. A month is 30 days on the same rule.
 *
 * Rolling windows rather than calendar ones, deliberately: a calendar week
 * read on a Tuesday compares two days against seven and calls the difference
 * a trend. Equal-length windows are the only ones worth comparing, and an
 * owner opening this on any day gets the same answer for the same data.
 *
 * HONESTY RULES, enforced by tests:
 *   - Below the evidence floor RepOS says so and names no theme.
 *   - A movement smaller than the reporting floor is "no meaningful change".
 *   - Nothing here says a change CAUSED anything. Actions and outcomes are
 *     reported next to each other with the word "after", and the reader draws
 *     their own conclusion.
 */

export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodWindow = {
  from: Date;
  to: Date;
  days: number;
};

export type PeriodKind = 'WEEK' | 'MONTH';

export function periodWindows(
  kind: PeriodKind,
  now: Date,
): { current: PeriodWindow; previous: PeriodWindow } {
  const days = kind === 'WEEK' ? WEEK_DAYS : MONTH_DAYS;
  const span = days * DAY_MS;
  const to = now;
  const from = new Date(to.getTime() - span);
  return {
    current: { from, to, days },
    previous: { from: new Date(from.getTime() - span), to: from, days },
  };
}

export type PeriodTheme = {
  key: string;
  label: string;
  kind: 'PRAISE' | 'ISSUE';
  /** Mentions inside the current window. */
  count: number;
  /** Mentions inside the window before it. */
  before: number;
  delta: number;
  /** Null when neither window has enough feedback to compare. */
  movement: 'UP' | 'DOWN' | 'STEADY' | null;
};

export type PeriodAction = {
  id: string;
  title: string;
  themeLabel: string;
  status: string;
  /** Present once the operator measured it. Never phrased as a cause. */
  outcome: string | null;
  decidedAt: Date | null;
  measuredAt: Date | null;
};

export type PeriodReport = {
  kind: PeriodKind;
  window: PeriodWindow;
  previous: PeriodWindow;
  businessName: string;
  /** Feedback that arrived in each window. */
  volume: { current: number; previous: number };
  /** False when the current window is too thin to say anything at all. */
  enoughEvidence: boolean;
  /** True when both windows clear the floor, so a comparison is meaningful. */
  comparable: boolean;
  /** The one honest sentence at the top. */
  headline: string;
  praise: PeriodTheme[];
  issues: PeriodTheme[];
  improved: PeriodTheme[];
  worsened: PeriodTheme[];
  /** Monthly only: named in both windows and no better. */
  unresolved: PeriodTheme[];
  actions: PeriodAction[];
  /** One thing to look at next, or null when RepOS has nothing to offer. */
  focus: string | null;
  /** What this report cannot tell them. Always stated, never hidden. */
  limits: string[];
};

function themeRows(rows: ThemeSummaryRow[]): Map<string, ThemeSummaryRow> {
  return new Map(rows.map((r) => [r.key, r]));
}

function compare(
  current: ThemeSummaryRow[],
  previous: ThemeSummaryRow[],
  kind: 'PRAISE' | 'ISSUE',
  comparable: boolean,
): PeriodTheme[] {
  const before = themeRows(previous);
  return current.map((row) => {
    const was = before.get(row.key)?.count ?? 0;
    const delta = row.count - was;
    return {
      key: row.key,
      label: row.label,
      kind,
      count: row.count,
      before: was,
      delta,
      movement: !comparable
        ? null
        : Math.abs(delta) < MIN_CHANGE_TO_REPORT
          ? 'STEADY'
          : delta > 0
            ? 'UP'
            : 'DOWN',
    };
  });
}

/** Only themes RepOS is willing to name at all. */
function named(themes: PeriodTheme[]): PeriodTheme[] {
  return themes.filter((t) => t.count >= MIN_MENTIONS_TO_NAME);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * One report builder for both periods.
 *
 * Every query below is bounded by clientId and by the window, so a business
 * with four years of feedback loads the same amount as one with four weeks.
 */
export async function buildPeriodReport(
  db: PrismaClient,
  clientId: string,
  kind: PeriodKind,
  options: { now?: Date } = {},
): Promise<PeriodReport | null> {
  const now = options.now ?? new Date();
  const { current, previous } = periodWindows(kind, now);

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true, vertical: true },
  });
  if (!client) return null;
  const pack = getPackOrFallback(client.vertical);

  const select = { id: true, themesJson: true } as const;
  const [currentRows, previousRows, actions] = await Promise.all([
    db.reviewItem.findMany({
      where: {
        clientId,
        analysisStatus: 'ANALYSED',
        createdAt: { gte: current.from, lt: current.to },
      },
      select,
    }),
    db.reviewItem.findMany({
      where: {
        clientId,
        analysisStatus: 'ANALYSED',
        createdAt: { gte: previous.from, lt: previous.to },
      },
      select,
    }),
    db.improvementAction.findMany({
      where: {
        clientId,
        OR: [
          { status: { in: ['RECOMMENDED', 'ACCEPTED', 'IN_PROGRESS', 'DONE'] } },
          { measuredAt: { gte: current.from } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      // Bounded: an owner reads the live loop, not an archive.
      take: 10,
      select: {
        id: true,
        title: true,
        themeLabel: true,
        status: true,
        result: true,
        decidedAt: true,
        measuredAt: true,
      },
    }),
  ]);

  const nowSummary = summariseThemeRows(currentRows, pack);
  const beforeSummary = summariseThemeRows(previousRows, pack);

  const volume = { current: currentRows.length, previous: previousRows.length };
  const enoughEvidence = volume.current >= MIN_PERIOD_FEEDBACK_TO_COMPARE;
  const comparable =
    enoughEvidence && volume.previous >= MIN_PERIOD_FEEDBACK_TO_COMPARE;

  const praise = named(compare(nowSummary.praises, beforeSummary.praises, 'PRAISE', comparable));
  const issues = named(compare(nowSummary.issues, beforeSummary.issues, 'ISSUE', comparable));

  // "Improved" means a complaint is raised less often than before; "worsened"
  // means more often. Praise moving is reported under praise, not as a fix.
  const improved = comparable ? issues.filter((t) => t.movement === 'DOWN') : [];
  const worsened = comparable ? issues.filter((t) => t.movement === 'UP') : [];
  const unresolved =
    kind === 'MONTH' && comparable
      ? issues.filter((t) => t.movement !== 'DOWN' && t.before >= MIN_MENTIONS_TO_NAME)
      : [];

  const period = kind === 'WEEK' ? 'week' : 'month';
  const limits: string[] = [];
  let headline: string;

  if (volume.current === 0) {
    headline = `No new feedback this ${period}.`;
    limits.push('Nothing arrived in this period, so there is nothing to compare.');
  } else if (!enoughEvidence) {
    headline = `Not enough new feedback this ${period} to identify a reliable trend yet.`;
    limits.push(
      `${plural(volume.current, 'piece', 'pieces')} of feedback arrived. Headway names a theme once at least ${MIN_MENTIONS_TO_NAME} customers have raised it.`,
    );
  } else if (!comparable) {
    headline = `${plural(volume.current, 'piece', 'pieces')} of feedback this ${period}. Not enough in the ${period} before to compare against.`;
    limits.push(
      `The previous ${period} holds ${plural(volume.previous, 'piece', 'pieces')}, below the ${MIN_PERIOD_FEEDBACK_TO_COMPARE} needed for a fair comparison.`,
    );
  } else if (worsened.length === 0 && improved.length === 0) {
    headline = `No major change this ${period}.`;
  } else if (worsened.length > 0) {
    headline = `${worsened[0]!.label} came up more often this ${period}.`;
  } else {
    headline = `${improved[0]!.label} came up less often this ${period}.`;
  }

  if (comparable && Math.abs(volume.current - volume.previous) > volume.previous) {
    limits.push(
      'Feedback volume changed a lot between the two periods, so some of the movement is volume rather than sentiment.',
    );
  }

  // The one thing worth looking at next. Never invented: it is whichever
  // complaint is loudest, and null when there is not one worth naming.
  const focus =
    worsened[0]?.label ??
    (issues.length > 0 && enoughEvidence ? issues[0]!.label : null);

  return {
    kind,
    window: current,
    previous,
    businessName: client.businessName,
    volume,
    enoughEvidence,
    comparable,
    headline,
    praise,
    issues,
    improved,
    worsened,
    unresolved,
    actions: actions.map((a) => ({
      id: a.id,
      title: a.title,
      themeLabel: a.themeLabel,
      status: a.status,
      // The M11 wording, reused rather than reworded. It was written to be
      // observational — "mentioned less often after the change", never
      // "the change worked" — and duplicating the vocabulary here is exactly
      // how a causal claim would eventually creep in.
      outcome: isActionResult(a.result) ? RESULT_LABELS[a.result] : null,
      decidedAt: a.decidedAt,
      measuredAt: a.measuredAt,
    })),
    focus,
    limits,
  };
}

export function getWeeklyPulse(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<PeriodReport | null> {
  return buildPeriodReport(db, clientId, 'WEEK', options);
}

export function getMonthlyReview(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date } = {},
): Promise<PeriodReport | null> {
  return buildPeriodReport(db, clientId, 'MONTH', options);
}
