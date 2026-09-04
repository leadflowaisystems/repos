import { getPackOrFallback, _resetPackCache } from '@/lib/packs';
import { buildIntelligence, type IntelligenceInput } from '@/lib/intelligence/engine';
import {
  computeHealthCard,
  type Pulse,
  type PulsePeriod,
  type StoredSnapshot,
  type ThemeCount,
} from '@/lib/health/health';
import type {
  DimensionSummaryRow,
  ThemeSummary,
  ThemeSummaryRow,
} from '@/lib/feedback/analysis';
import type { ActionProgress } from '@/lib/improve/service';
import { ACTION_VERSION, type ActionResult, type ActionStatus } from '@/lib/improve/model';
import { EMPTY_CONTEXT, type ContextItem } from '@/lib/context/apply';
import type { PortalInput } from './view';

/**
 * Shared fixtures for the portal tests. A clinic with one clear strength,
 * one clear complaint, and the knobs the tests turn: a second check-in, an
 * action at any stage, a measured result of any kind.
 */

_resetPackCache();
export const clinic = getPackOrFallback('clinic');
export const NOW = new Date(2026, 5, 1);

export function theme(
  key: string,
  label: string,
  kind: 'PRAISE' | 'ISSUE',
  count: number,
  severity: 'low' | 'medium' | 'high' = 'high',
): ThemeSummaryRow {
  return {
    key,
    label,
    kind,
    severity,
    count,
    itemIds: Array.from({ length: count }, (_, i) => `${key}-${i}`),
  };
}

export function themes(
  praises: ThemeSummaryRow[],
  issues: ThemeSummaryRow[],
  analysedCount: number,
  dimensions: DimensionSummaryRow[] = [],
): ThemeSummary {
  return { praises, issues, analysedCount, dimensions };
}

/** The default pile: care praised by 12, waiting raised by 9, out of 50. */
export const DEFAULT_THEMES = themes(
  [
    theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 12),
    theme('staff_friendly', 'Friendly, helpful staff', 'PRAISE', 3),
  ],
  [
    theme('wait_time', 'Long waiting time', 'ISSUE', 9),
    theme('billing_clarity', 'Unclear or unexpected billing', 'ISSUE', 4),
    theme('parking_access', 'Parking / access difficulty', 'ISSUE', 2, 'low'),
  ],
  50,
);

export const NO_PULSE: Pulse = {
  available: false,
  reason: 'Two snapshots are needed before periods can be compared.',
  direction: 'NONE',
  directionLabel: 'Not enough data',
  current: null,
  previous: null,
  periodDays: null,
  metrics: [],
  notableChanges: [],
  sampleWarning: null,
};

function count(key: string, label: string, n: number, severity: 'low' | 'medium' | 'high' = 'high'): ThemeCount {
  return { key, label, count: n, severity, qualifies: n >= 3 };
}

function period(
  id: string,
  label: string,
  capturedAt: Date,
  issues: ThemeCount[],
  praises: ThemeCount[],
): PulsePeriod {
  return {
    snapshotId: id,
    label,
    capturedAt,
    feedbackCount: 20,
    distribution: {
      total: 20,
      counts: { POSITIVE: 12, NEGATIVE: 6, MIXED: 2, NEUTRAL: 0, UNKNOWN: 0 },
      shares: null,
      reliable: true,
      note: '',
    },
    rating: 4.4,
    reviewCount: 180,
    unansweredCount: 10,
    topIssues: issues,
    topPraises: praises,
  };
}

/** Two comparable check-ins, with the waiting and care counts on each side. */
export function pulseWith(args: {
  waitThen: number;
  waitNow: number;
  careThen?: number;
  careNow?: number;
  direction?: Pulse['direction'];
  /** Check-in dates; default March and May, both before the fixture change. */
  previousAt?: Date;
  currentAt?: Date;
}): Pulse {
  const careThen = args.careThen ?? 4;
  const careNow = args.careNow ?? 4;
  return {
    ...NO_PULSE,
    available: true,
    reason: '',
    direction: args.direction ?? 'IMPROVING',
    directionLabel: 'Improving',
    previous: period(
      's1',
      'March',
      args.previousAt ?? new Date(2026, 2, 1),
      [count('wait_time', 'Long waiting time', args.waitThen)],
      [count('doctor_care', "Doctor's care and explanation", careThen)],
    ),
    current: period(
      's2',
      'May',
      args.currentAt ?? new Date(2026, 4, 1),
      [count('wait_time', 'Long waiting time', args.waitNow)],
      [count('doctor_care', "Doctor's care and explanation", careNow)],
    ),
    periodDays: 61,
  };
}

/** Two check-ins recorded AFTER the fixture change of 1 Apr 2026. */
export function pulseAfterChange(args: { waitThen: number; waitNow: number }): Pulse {
  return pulseWith({ ...args, previousAt: new Date(2026, 4, 1), currentAt: new Date(2026, 5, 1) });
}

export function stored(id: string, capturedAt: Date): StoredSnapshot {
  return {
    id,
    label: 'A check-in',
    capturedAt,
    rating: 4.4,
    reviewCount: 180,
    unansweredCount: 12,
    reviewsPerWeek: 1.5,
    daysSinceLastPost: 10,
    photoRecencyDays: 20,
    generatedAt: null,
    feedback: [],
  };
}

export function intel(overrides: Partial<IntelligenceInput> = {}) {
  return buildIntelligence({
    client: { id: 'c1', businessName: 'Sunrise Dental Clinic', vertical: 'clinic' },
    pack: clinic,
    themes: DEFAULT_THEMES,
    totalFeedback: 50,
    pulse: NO_PULSE,
    notes: [],
    ...overrides,
  });
}

export function action(status: ActionStatus, result: ActionResult = 'IMPROVED'): ActionProgress {
  const measured = status === 'MEASURED';
  const declined = status === 'DECLINED';
  const made = status === 'DONE' || measured;
  const afterCount = result === 'IMPROVED' ? 2 : result === 'WORSENED' ? 12 : result === 'NO_CLEAR_CHANGE' ? 6 : 1;
  const afterTotal = result === 'INSUFFICIENT_DATA' ? 4 : 30;
  return {
    action: {
      id: 'a1',
      clientId: 'c1',
      status,
      statusNote: declined ? 'Hiring a second receptionist first.' : '',
      title: 'Reduce complaints about long waiting time',
      description: 'Cut evening bookings to five an hour',
      provenance: {
        insightId: 'c1:ATTENTION:wait_time',
        themeKey: 'wait_time',
        themeLabel: 'Long waiting time',
        themeSentiment: 'ISSUE',
        themeSeverity: 'high',
        insightHeadline: 'Long waiting time needs attention.',
        insightDetail: '9 mentions across the 50 reviews read so far.',
        signals: [{ key: 'severity_high', weight: 30, reason: 'Serious for a clinic.' }],
        intelligenceVersion: 1,
        recommendationText: 'Publish a realistic slot length.',
      },
      baseline: {
        count: 9,
        total: 50,
        itemIds: ['wait_time-0'],
        confidence: 'STRONG',
        capturedAt: new Date(2026, 2, 1),
        snapshotId: 's1',
        snapshotLabel: 'March',
      },
      decidedAt: status === 'RECOMMENDED' ? null : new Date(2026, 2, 1),
      doneAt: made ? new Date(2026, 3, 1) : null,
      measuredAt: measured ? NOW : null,
      measurement: measured
        ? {
            result,
            resultLabel: '',
            themeKey: 'wait_time',
            themeLabel: 'Long waiting time',
            sentiment: 'ISSUE',
            before: {
              count: 9,
              total: 50,
              share: 0.18,
              label: 'everything read up to 1 Mar 2026, when the action was agreed',
              line: '9 of 50 reviews (18%)',
              snapshotLabel: 'March',
            },
            after: {
              count: afterCount,
              total: afterTotal,
              share: afterCount / afterTotal,
              label: 'feedback that has come in since the change on 1 Apr 2026',
              line: `${afterCount} of ${afterTotal} reviews (${Math.round((afterCount / afterTotal) * 100)}%)`,
              snapshotLabel: null,
            },
            shareDelta: afterCount / afterTotal - 0.18,
            headline:
              result === 'IMPROVED'
                ? 'Customers are mentioning long waiting time less often since the change.'
                : result === 'WORSENED'
                  ? 'Customers are mentioning long waiting time more often since the change.'
                  : result === 'NO_CLEAR_CHANGE'
                    ? 'Long waiting time is coming up about as often as before the change.'
                    : 'Not enough feedback yet to say whether long waiting time changed.',
            why: ['The share moved.'],
            limits: [
              'This compares feedback before and after the change. It cannot show that the change caused the difference — nothing RepOS can see would prove that.',
            ],
            betweenCount: 0,
            measuredAt: NOW,
            version: 1,
          }
        : null,
      learningNote: measured ? 'Evenings feel calmer.' : '',
      learningAt: measured ? NOW : null,
      minuteId: 'm1',
      createdAt: new Date(2026, 2, 1),
      updatedAt: NOW,
      version: ACTION_VERSION,
    },
    newFeedbackSinceDone: made ? (status === 'DONE' ? 4 : 30) : 0,
    newFeedbackSinceMeasured: 0,
    canMeasure: false,
  };
}

export function input(overrides: Partial<PortalInput> = {}): PortalInput {
  const intelligence = overrides.intelligence ?? intel();
  return {
    intelligence,
    card: computeHealthCard({
      pack: clinic,
      snapshots: [stored('s1', new Date(2026, 4, 1))],
      now: NOW,
    }),
    actions: [],
    snapshots: [],
    pack: clinic,
    themes: DEFAULT_THEMES,
    context: EMPTY_CONTEXT,
    ...overrides,
  };
}

/** One thing the owner told RepOS, for the tests that turn context on. */
export function told(
  kind: ContextItem['kind'],
  text: string,
  extra: Partial<Pick<ContextItem, 'themeKey' | 'constraintKey' | 'questionKey' | 'actionId'>> = {},
): ContextItem {
  return {
    id: `ctx-${kind.toLowerCase()}-${text.length}`,
    kind,
    provenance: 'OWNER_TOLD_US',
    text,
    themeKey: extra.themeKey ?? null,
    constraintKey: extra.constraintKey ?? null,
    questionKey: extra.questionKey ?? null,
    actionId: extra.actionId ?? null,
    recordedAt: new Date(2026, 4, 10),
  };
}

/** Anything that would tell the owner they are looking at a tool, not their business. */
export const INTERNALS =
  /\bM\d{1,2}\b|milestone|taxonomy|analysisVersion|intelligenceVersion|provenance|baseline|insightId|snapshotId|minuteId|triage|groq|provider|"weight"|priorityRank|severity_high|command centre|reply queue|operator/i;

/**
 * Wording that would turn a before/after into a cause. The measurement
 * engine's own disclaimer ("cannot show that the change caused…") is the one
 * permitted use of the word.
 */
export const CAUSAL =
  /because of (the|your) change|(?<!not show (?:that )?the change )caused|due to (the|your) change|resulted in|led to|thanks to (the|your) change|\b(improved|got worse|worse) after (the|your) change|made (it|things) (worse|better)|the change (fixed|helped|worked)/i;
