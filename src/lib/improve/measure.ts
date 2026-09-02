import type { Pack } from '@/lib/packs';
import { summariseThemeRows } from '@/lib/feedback/analysis';
import {
  MIN_FEEDBACK_FOR_SHARE_CLAIMS,
  TREND_SHARE_DELTA,
} from '@/lib/health/rules';
import {
  RESULT_LABELS,
  evidenceLine,
  measurementWindowStart,
  formatShare,
  shareOf,
  type ActionBaseline,
  type Measurement,
  type MeasurementSide,
} from './model';

/**
 * DID CUSTOMER FEEDBACK CHANGE AFTER THE CHANGE? (M11)
 *
 * The most dangerous code in RepOS, because it is the part a business owner
 * will believe. Three rules hold it honest:
 *
 *  1. NO CAUSAL CLAIM, EVER. RepOS can say complaints fell after a change. It
 *     cannot say the change caused them to fall, because with one business, no
 *     control group and self-selected reviews, nobody could. Every sentence
 *     this module writes is "after", never "because".
 *
 *  2. SHARES, NOT RAW COUNTS. "9 mentions then, 2 now" means nothing if the
 *     first period held fifty reviews and the second held twelve. Both sides
 *     are shares of their own pile, and the counts are always printed with
 *     their denominator.
 *
 *  3. INSUFFICIENT DATA IS THE DEFAULT. A verdict requires enough feedback on
 *     BOTH sides, using the same floor the health engine already applies to
 *     share claims. A theme that vanished from four new reviews has not
 *     improved; it has not been measured.
 *
 * No model is involved in any of it.
 */

/** Bump when the verdict rules change. Stored with each frozen result. */
export const MEASUREMENT_VERSION = 1;

export {
  RESULT_LABELS,
  RESULT_TONES,
  type ActionResult,
  type Measurement,
  type MeasurementSide,
} from './model';

/**
 * How much feedback each side needs before a share is quotable.
 *
 * The same floor the health engine uses, deliberately: an owner must not be
 * told one story by the Health card and another by an action result.
 */
export const MIN_FEEDBACK_TO_MEASURE = MIN_FEEDBACK_FOR_SHARE_CLAIMS; // 10

/**
 * How far the share has to move before it is called a direction.
 *
 * Again the health engine's own threshold. Below it, the honest answer is that
 * nothing clearly changed — not a tiny improvement.
 */
export const MIN_SHARE_MOVE = TREND_SHARE_DELTA; // 0.05

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** One stored feedback row, with the date the evidence belongs to. */
export type MeasurableRow = {
  id: string;
  themesJson: string;
  analysisStatus: string;
  /** The customer's own date where it was parsed, otherwise when it arrived. */
  evidenceAt: Date;
};

export type MeasurementInput = {
  pack: Pack;
  themeKey: string;
  themeLabel: string;
  sentiment: 'PRAISE' | 'ISSUE';
  baseline: ActionBaseline;
  /** When the business says the change was made. The dividing line. */
  doneAt: Date;
  rows: MeasurableRow[];
  now: Date;
};

// ---------------------------------------------------------------------------

function countTheme(rows: MeasurableRow[], pack: Pack, themeKey: string): number {
  const summary = summariseThemeRows(
    rows
      .filter((row) => row.analysisStatus === 'ANALYSED')
      .map((row) => ({ id: row.id, themesJson: row.themesJson })),
    pack,
  );
  const found =
    summary.issues.find((t) => t.key === themeKey) ??
    summary.praises.find((t) => t.key === themeKey);
  return found?.count ?? 0;
}

function analysedCount(rows: MeasurableRow[]): number {
  return rows.filter((row) => row.analysisStatus === 'ANALYSED').length;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * "15 Jun 2026".
 *
 * Local parts, because the operator typed a local date into a date field and
 * every other screen shows it back to them that way. A frozen string that says
 * a different day from the one on the card beside it is worse than a string
 * that is only stable within one installation.
 */
function dateLabel(value: Date): string {
  return `${value.getDate()} ${MONTHS[value.getMonth()]} ${value.getFullYear()}`;
}

/**
 * The before and after of one improvement attempt.
 *
 * The BEFORE side is the frozen baseline — what RepOS saw when the business
 * decided to act. It is never recomputed, so the comparison always starts from
 * the number the decision was actually made on.
 *
 * The AFTER side is every piece of feedback that has arrived since the change
 * was made, counted the same way over its own denominator.
 */
export function measureAction(input: MeasurementInput): Measurement {
  const { baseline, doneAt, pack, themeKey, themeLabel, sentiment } = input;

  // The after window starts at the change, but never earlier than the moment
  // the baseline was frozen. Without that floor, feedback already counted in
  // the baseline could be counted again on the other side of the comparison —
  // which happens whenever a change is recorded on the day it was agreed.
  const windowStart = measurementWindowStart(doneAt, baseline.capturedAt);

  const afterRows = input.rows.filter((row) => row.evidenceAt.getTime() >= windowStart);
  const afterTotal = analysedCount(afterRows);
  const afterCount = countTheme(afterRows, pack, themeKey);

  // Feedback that arrived between the decision and the change being made sits
  // in neither figure. Small and usually zero, but stated rather than hidden.
  const betweenCount = input.rows.filter(
    (row) =>
      row.analysisStatus === 'ANALYSED' &&
      row.evidenceAt.getTime() >= baseline.capturedAt.getTime() &&
      row.evidenceAt.getTime() < windowStart,
  ).length;

  const before: MeasurementSide = {
    count: baseline.count,
    total: baseline.total,
    share: shareOf(baseline.count, baseline.total),
    label: `everything read up to ${dateLabel(baseline.capturedAt)}, when the action was agreed`,
    line: evidenceLine(baseline.count, baseline.total),
    snapshotLabel: baseline.snapshotLabel,
  };

  const after: MeasurementSide = {
    count: afterCount,
    total: afterTotal,
    share: shareOf(afterCount, afterTotal),
    label: `feedback that has come in since the change on ${dateLabel(doneAt)}`,
    line: evidenceLine(afterCount, afterTotal),
    snapshotLabel: null,
  };

  const shareDelta =
    before.share !== null && after.share !== null
      ? Number((after.share - before.share).toFixed(4))
      : null;

  const limits: string[] = [
    'This compares feedback before and after the change. It cannot show that the change caused the difference — nothing RepOS can see would prove that.',
  ];
  if (betweenCount > 0) {
    limits.push(
      `${betweenCount} piece${betweenCount === 1 ? '' : 's'} of feedback arrived between the decision and the change being made, so ${betweenCount === 1 ? 'it is' : 'they are'} in neither figure.`,
    );
  }

  const base = {
    themeKey,
    themeLabel,
    sentiment,
    before,
    after,
    shareDelta,
    betweenCount,
    measuredAt: input.now,
    version: MEASUREMENT_VERSION,
  };

  // ---- Not enough on one side or the other -------------------------------
  const thinBefore = before.total < MIN_FEEDBACK_TO_MEASURE;
  const thinAfter = after.total < MIN_FEEDBACK_TO_MEASURE;

  if (thinBefore || thinAfter) {
    const why: string[] = [];
    if (thinBefore) {
      why.push(
        `The baseline rests on ${before.total} read ${before.total === 1 ? 'review' : 'reviews'}, under the ${MIN_FEEDBACK_TO_MEASURE} RepOS needs before quoting a share.`,
      );
    }
    if (thinAfter) {
      why.push(
        after.total === 0
          ? 'No new feedback has been read since the change was made.'
          : `Only ${after.total} ${after.total === 1 ? 'review has' : 'reviews have'} come in since the change, under the ${MIN_FEEDBACK_TO_MEASURE} needed to compare.`,
      );
    }

    // The case that would flatter a business most, and is the least justified:
    // the theme is absent from a handful of new reviews. Absence in a small
    // sample is not improvement — it is silence.
    if (thinAfter && after.count === 0 && after.total > 0) {
      why.push(
        `${themeLabel} has not come up in those ${after.total}, but that is too little feedback to read as an improvement — it could equally be that nobody has mentioned it yet.`,
      );
    }

    return {
      ...base,
      result: 'INSUFFICIENT_DATA',
      resultLabel: RESULT_LABELS.INSUFFICIENT_DATA,
      headline: `Not enough feedback yet to say whether ${themeLabel.toLowerCase()} changed.`,
      why,
      limits: [
        ...limits,
        'Add the feedback you have collected since the change and measure again.',
      ],
    };
  }

  // ---- Both sides are quotable -------------------------------------------
  const moved = shareDelta !== null && Math.abs(shareDelta) >= MIN_SHARE_MOVE;
  const rose = (shareDelta ?? 0) > 0;
  const good = sentiment === 'ISSUE' ? !rose : rose;

  const comparison =
    `${themeLabel} was ${before.line} ${before.label}. ` +
    `It is ${after.line} in the ${after.label}.`;

  const why = [
    comparison,
    moved
      ? `The share moved by ${formatShare(Math.abs(shareDelta as number))}, past the ${formatShare(MIN_SHARE_MOVE)} RepOS needs before calling a direction.`
      : `The share moved by ${formatShare(Math.abs(shareDelta ?? 0))}, under the ${formatShare(MIN_SHARE_MOVE)} RepOS needs before calling a direction.`,
  ];

  if (!moved) {
    return {
      ...base,
      result: 'NO_CLEAR_CHANGE',
      resultLabel: RESULT_LABELS.NO_CLEAR_CHANGE,
      headline: `${themeLabel} is coming up about as often as before the change.`,
      why,
      limits,
    };
  }

  // The headline states what happened; the verdict states whether that is good
  // news. Keeping them apart is what stops "improved" from creeping into the
  // description of the evidence itself.
  const direction = rose ? 'more' : 'less';
  const headline =
    sentiment === 'ISSUE'
      ? `Customers are mentioning ${themeLabel.toLowerCase()} ${direction} often since the change.`
      : `Customers are praising ${themeLabel.toLowerCase()} ${direction} often since the change.`;

  return {
    ...base,
    result: good ? 'IMPROVED' : 'WORSENED',
    resultLabel: good ? RESULT_LABELS.IMPROVED : RESULT_LABELS.WORSENED,
    headline,
    why,
    limits,
  };
}

/**
 * Every number a measurement states, as strings.
 *
 * The same numeric guard M8 and M10 use: prose about a result may only contain
 * figures that appear here.
 */
export function measurementNumbers(measurement: Measurement): Set<string> {
  const out = new Set<string>();
  const add = (n: number | null) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return;
    out.add(String(n));
    out.add(String(Math.abs(n)));
    out.add(String(Math.round(n)));
  };

  add(measurement.before.count);
  add(measurement.before.total);
  add(measurement.after.count);
  add(measurement.after.total);
  add(measurement.betweenCount);
  add(MIN_FEEDBACK_TO_MEASURE);
  for (const side of [measurement.before.share, measurement.after.share]) {
    if (side !== null) out.add(String(Math.round(side * 100)));
  }
  if (measurement.shareDelta !== null) {
    out.add(String(Math.round(Math.abs(measurement.shareDelta) * 100)));
  }
  out.add(String(Math.round(MIN_SHARE_MOVE * 100)));

  return out;
}
