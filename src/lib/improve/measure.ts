import type { Pack } from '@/lib/packs';
import { summariseThemeRows } from '@/lib/feedback/analysis';
import {
  MIN_FEEDBACK_FOR_SHARE_CLAIMS,
  TREND_SHARE_DELTA,
} from '@/lib/health/rules';
import {
  evidenceLine,
  measurementWindowStart,
  formatShare,
  resultLabel,
  shareOf,
  type ActionBaseline,
  type ActionResult,
  type Measurement,
  type MeasurementSide,
} from './model';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * DID CUSTOMER FEEDBACK CHANGE AFTER THE CHANGE? (M11)
 *
 * The most dangerous code in RepOS, because it is the part a business owner
 * will believe. Three rules hold it honest:
 *
 *  1. NO CAUSAL CLAIM, EVER. RepOS can say complaints fell after a change. It
 *     cannot say the change caused them to fall, because with one business, no
 *     control group and self-selected feedback, nobody could. Every sentence
 *     this module writes is "after", never "because".
 *
 *  2. SHARES, NOT RAW COUNTS. "9 mentions then, 2 now" means nothing if the
 *     first window held fifty pieces of feedback and the second held twelve.
 *     Both sides are shares of their own pile, and the counts are always
 *     printed with their denominator.
 *
 *  3. INSUFFICIENT DATA IS THE DEFAULT. A verdict requires enough feedback on
 *     BOTH sides, using the same floor the health engine already applies to
 *     share claims. A theme that vanished from four new pieces of feedback has
 *     not improved; it has not been measured.
 *
 * No model is involved in any of it.
 *
 * TWO HALVES, ON PURPOSE. `measureAction` DECIDES — it counts the two windows
 * and reaches a verdict, once, and that verdict is frozen. `measurementWords`
 * DESCRIBES — it turns those frozen facts into sentences in one language, and
 * can be called again, years later, by a reader in a different language. The
 * split exists because a measurement is stored as JSON with its sentences
 * inside it: without it, a reading taken in March would speak March's English
 * forever, and no amount of translating this file would reach it.
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
  /**
   * The owner's language, passed in by whoever asked for the measurement.
   *
   * Absent from the operator console, which is deliberately not localized, so
   * the default is English. Never a locale and never looked up: this module
   * must not know which language it is writing in, or the next language would
   * mean editing the verdict rules again.
   */
  t?: PortalTranslator;
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
 *
 * Not translated, and not routed through the dictionary: a date is a date in
 * every language Headway speaks, and a month name that changed with the reader
 * would make the same measurement look like two.
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
  const t = input.t ?? EN;

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

  const beforeCounts: MeasurementCounts = {
    count: baseline.count,
    total: baseline.total,
    share: shareOf(baseline.count, baseline.total),
  };

  const afterCounts: MeasurementCounts = {
    count: afterCount,
    total: afterTotal,
    share: shareOf(afterCount, afterTotal),
  };

  const shareDelta =
    beforeCounts.share !== null && afterCounts.share !== null
      ? Number((afterCounts.share - beforeCounts.share).toFixed(4))
      : null;

  // ---- The verdict -------------------------------------------------------
  //
  // Everything this function decides, it decides here and once. The thresholds
  // live in this half; the sentences live in the other, so re-reading a stored
  // measurement can restate the verdict but never reach a different one.
  const thinBefore = beforeCounts.total < MIN_FEEDBACK_TO_MEASURE;
  const thinAfter = afterCounts.total < MIN_FEEDBACK_TO_MEASURE;
  const moved = shareDelta !== null && Math.abs(shareDelta) >= MIN_SHARE_MOVE;
  const rose = (shareDelta ?? 0) > 0;
  const good = sentiment === 'ISSUE' ? !rose : rose;

  const result: ActionResult =
    thinBefore || thinAfter
      ? 'INSUFFICIENT_DATA'
      : !moved
        ? 'NO_CLEAR_CHANGE'
        : good
          ? 'IMPROVED'
          : 'WORSENED';

  const words = measurementWords(
    {
      result,
      themeLabel,
      sentiment,
      before: beforeCounts,
      after: afterCounts,
      shareDelta,
      betweenCount,
      capturedAt: baseline.capturedAt,
      doneAt,
    },
    t,
  );

  const before: MeasurementSide = {
    ...beforeCounts,
    label: words.beforeLabel,
    line: words.beforeLine,
    snapshotLabel: baseline.snapshotLabel,
  };

  const after: MeasurementSide = {
    ...afterCounts,
    label: words.afterLabel,
    line: words.afterLine,
    snapshotLabel: null,
  };

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

  return {
    ...base,
    result,
    resultLabel: words.resultLabel,
    headline: words.headline,
    why: words.why,
    limits: words.limits,
  };
}

// ---------------------------------------------------------------------------
// The words, written from the frozen facts
// ---------------------------------------------------------------------------

/** One side of the comparison, as figures only. Not a sentence in sight. */
export type MeasurementCounts = {
  count: number;
  total: number;
  share: number | null;
};

/**
 * Everything a measurement's sentences are written from.
 *
 * All of it is frozen at measure time and stored: the verdict, both sides'
 * figures, the share move, the feedback that fell between the decision and the
 * change, and the two dates. None of it is ever recomputed from live data —
 * that is the whole point of a measurement. The evidence belongs to a moment,
 * and the moment does not come back.
 */
export type MeasurementFacts = {
  result: ActionResult;
  themeLabel: string;
  sentiment: 'PRAISE' | 'ISSUE';
  before: MeasurementCounts;
  after: MeasurementCounts;
  shareDelta: number | null;
  betweenCount: number;
  /** When the baseline was frozen — the day the change was agreed. */
  capturedAt: Date;
  /** When the business says the change was made. */
  doneAt: Date;
};

/** The sentences, in one language. Every figure in them came from the facts. */
export type MeasurementWords = {
  resultLabel: string;
  headline: string;
  why: string[];
  limits: string[];
  beforeLabel: string;
  afterLabel: string;
  beforeLine: string;
  afterLine: string;
};

/**
 * THE SENTENCES, RENDERED FROM THE FROZEN FACTS.
 *
 * Split out of `measureAction` because a measurement is stored as JSON with
 * its sentences inside it. A reading taken in March holds March's English, and
 * translating this file cannot reach back into the database to change it. So
 * the portal calls this again at READ time, handing it the stored numbers and
 * the owner's translator, and gets the same reading in the owner's language.
 * The figures are the evidence and are never touched; only the words around
 * them are new.
 *
 * Nothing here decides anything. `facts.result` is the verdict, already made
 * and already stored; every branch below only asks which sentence describes
 * the verdict it was handed. Re-rendering must not be able to reach a
 * different conclusion from the one an owner was shown the first time.
 */
export function measurementWords(
  facts: MeasurementFacts,
  t: PortalTranslator = EN,
): MeasurementWords {
  const { before, after, result, sentiment, themeLabel } = facts;
  const theme = themeLabel.toLowerCase();

  const beforeLine = evidenceLine(before.count, before.total, t);
  const afterLine = evidenceLine(after.count, after.total, t);
  const sides = {
    beforeLabel: t('improve.side.before', { date: dateLabel(facts.capturedAt) }),
    afterLabel: t('improve.side.after', { date: dateLabel(facts.doneAt) }),
    beforeLine,
    afterLine,
  };

  const limits: string[] = [t('improve.limit.noCause')];
  if (facts.betweenCount > 0) {
    limits.push(t.plural('improve.limit.between', facts.betweenCount));
  }

  // ---- Not enough on one side or the other -------------------------------
  if (result === 'INSUFFICIENT_DATA') {
    const thinBefore = before.total < MIN_FEEDBACK_TO_MEASURE;
    const thinAfter = after.total < MIN_FEEDBACK_TO_MEASURE;
    const why: string[] = [];
    if (thinBefore) {
      why.push(
        t.plural('improve.why.thinBefore', before.total, {
          min: MIN_FEEDBACK_TO_MEASURE,
        }),
      );
    }
    if (thinAfter) {
      why.push(
        after.total === 0
          ? t('improve.why.noneAfter')
          : t.plural('improve.why.thinAfter', after.total, {
              min: MIN_FEEDBACK_TO_MEASURE,
            }),
      );
    }

    // The case that would flatter a business most, and is the least justified:
    // the theme is absent from a handful of new pieces of feedback. Absence in
    // a small sample is not improvement — it is silence.
    if (thinAfter && after.count === 0 && after.total > 0) {
      why.push(
        t('improve.why.absentInSmallSample', {
          theme: themeLabel,
          total: after.total,
        }),
      );
    }

    return {
      ...sides,
      resultLabel: resultLabel('INSUFFICIENT_DATA', t),
      headline: t('improve.headline.insufficient', { theme }),
      why,
      limits: [...limits, t('improve.limit.addMore')],
    };
  }

  // ---- Both sides are quotable -------------------------------------------
  const shareDelta = facts.shareDelta;
  const moved = result !== 'NO_CLEAR_CHANGE';
  const rose = (shareDelta ?? 0) > 0;

  // The before half must keep `before.line` intact as a substring: the operator
  // panel hides any reason line that repeats it, because the Before card above
  // already shows that figure.
  const comparison = t('improve.why.comparison', {
    theme,
    beforeLine,
    date: dateLabel(facts.capturedAt),
    doneDate: dateLabel(facts.doneAt),
    afterLine,
  });

  const why = [
    comparison,
    moved
      ? t('improve.why.moved', {
          delta: formatShare(Math.abs(shareDelta as number)),
          min: formatShare(MIN_SHARE_MOVE),
        })
      : t('improve.why.notMoved', {
          delta: formatShare(Math.abs(shareDelta ?? 0)),
          min: formatShare(MIN_SHARE_MOVE),
        }),
  ];

  if (!moved) {
    return {
      ...sides,
      resultLabel: resultLabel('NO_CLEAR_CHANGE', t),
      headline: t('improve.headline.noClearChange', { theme }),
      why,
      limits,
    };
  }

  // The headline states what happened; the verdict states whether that is good
  // news. Keeping them apart is what stops "improved" from creeping into the
  // description of the evidence itself.
  // One key per case rather than a "more"/"less" word dropped into a frame: in
  // Hindi and Marathi the direction word does not sit where English puts it,
  // and a phrase assembled from fragments is a phrase no translator can fix.
  const headline =
    sentiment === 'ISSUE'
      ? rose
        ? t('improve.headline.issue.more', { theme })
        : t('improve.headline.issue.less', { theme })
      : rose
        ? t('improve.headline.praise.more', { theme })
        : t('improve.headline.praise.less', { theme });

  return {
    ...sides,
    resultLabel: resultLabel(result, t),
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
