import type { ImprovementAction, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { createMinute } from '@/lib/minutes/service';
import { loadIntelligence } from '@/lib/intelligence/service';
import type { ClientIntelligence, Insight, IntelligenceSignal } from '@/lib/intelligence/engine';
import {
  ACTION_VERSION,
  actionFromInsight,
  canTransition,
  decisionMinute,
  isActionStatus,
  measurementWindowStart,
  transitionError,
  type ActionBaseline,
  type ActionProvenance,
  type ActionStatus,
} from './model';
import {
  MIN_FEEDBACK_TO_MEASURE,
  measureAction,
  type Measurement,
  type MeasurableRow,
} from './measure';

/**
 * THE ACTION LOOP SERVICE (M11).
 *
 * Persists improvement attempts and measures them against stored feedback.
 *
 * What it never does: fetch anything, send anything, schedule anything, or ask
 * a model whether a change worked. New feedback reaches RepOS only because the
 * operator pasted it in, exactly as in M5.
 *
 * Every query is scoped by clientId, and every write re-checks that the action
 * belongs to the client it is being changed through.
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

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const value = JSON.parse(raw) as T;
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// The decoded action
// ---------------------------------------------------------------------------

export type ActionRecord = {
  id: string;
  clientId: string;
  status: ActionStatus;
  statusNote: string;
  title: string;
  /** What the business actually decided to do. Not the recommendation. */
  description: string;

  provenance: ActionProvenance;
  baseline: ActionBaseline;

  decidedAt: Date | null;
  doneAt: Date | null;
  measuredAt: Date | null;

  /** The frozen verdict, or null until measured. */
  measurement: Measurement | null;

  learningNote: string;
  learningAt: Date | null;
  minuteId: string | null;

  createdAt: Date;
  updatedAt: Date;
  version: number;
};

/** Turns a stored row back into the domain object. Never recomputes anything. */
export function toActionRecord(row: ImprovementAction): ActionRecord {
  const measurement = row.resultJson
    ? (parseJson<Measurement | null>(row.resultJson, null) ?? null)
    : null;

  return {
    id: row.id,
    clientId: row.clientId,
    status: isActionStatus(row.status) ? row.status : 'RECOMMENDED',
    statusNote: row.statusNote,
    title: row.title,
    description: row.description,

    provenance: {
      insightId: row.insightId,
      themeKey: row.themeKey,
      themeLabel: row.themeLabel,
      themeSentiment: row.themeSentiment === 'PRAISE' ? 'PRAISE' : 'ISSUE',
      themeSeverity:
        row.themeSeverity === 'high' || row.themeSeverity === 'low'
          ? row.themeSeverity
          : 'medium',
      insightHeadline: row.insightHeadline,
      insightDetail: row.insightDetail,
      signals: parseJson<IntelligenceSignal[]>(row.insightSignalsJson, []),
      intelligenceVersion: row.intelligenceVersion,
      recommendationText: row.recommendationText,
    },

    baseline: {
      count: row.baselineCount,
      total: row.baselineTotal,
      itemIds: parseJson<string[]>(row.baselineItemIdsJson, []),
      confidence:
        row.baselineConfidence === 'STRONG' || row.baselineConfidence === 'MODERATE'
          ? row.baselineConfidence
          : 'EARLY',
      capturedAt: row.baselineCapturedAt,
      snapshotId: row.baselineSnapshotId,
      snapshotLabel: row.baselineSnapshotLabel,
    },

    decidedAt: row.decidedAt,
    doneAt: row.doneAt,
    measuredAt: row.measuredAt,
    measurement: measurement && typeof measurement === 'object' ? measurement : null,

    learningNote: row.learningNote,
    learningAt: row.learningAt,
    minuteId: row.minuteId,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: ACTION_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Newest first: the action history for one client. */
export async function listClientActions(
  db: PrismaClient,
  clientId: string,
): Promise<ActionRecord[]> {
  const rows = await db.improvementAction.findMany({
    where: { clientId },
    orderBy: [{ createdAt: 'desc' }],
  });
  return rows.map(toActionRecord);
}

export async function getAction(
  db: PrismaClient,
  clientId: string,
  actionId: string,
): Promise<ActionRecord | null> {
  const row = await db.improvementAction.findFirst({
    where: { id: actionId, clientId },
  });
  return row ? toActionRecord(row) : null;
}

/** Insight ids a client already has an action for, so the UI does not offer it twice. */
export async function actionedInsightIds(
  db: PrismaClient,
  clientId: string,
): Promise<Set<string>> {
  const rows = await db.improvementAction.findMany({
    where: { clientId },
    select: { insightId: true },
  });
  return new Set(rows.map((row) => row.insightId));
}

/**
 * The one improvement worth telling the owner about.
 *
 * Ranked by how far along it is, because a measured result says more than an
 * agreement. RECOMMENDED is skipped on purpose: the business has not decided
 * anything yet, so there is nothing to report to them about it. PAUSED and
 * DECLINED are skipped for the same reason.
 */
export async function latestReportableAction(
  db: PrismaClient,
  clientId: string,
): Promise<ActionRecord | null> {
  const rows = await db.improvementAction.findMany({
    where: { clientId, status: { in: ['ACCEPTED', 'DONE', 'MEASURED'] } },
    orderBy: [{ updatedAt: 'desc' }],
  });
  if (rows.length === 0) return null;

  const rank: Record<string, number> = { MEASURED: 3, DONE: 2, ACCEPTED: 1 };
  const best = rows.reduce((a, b) =>
    (rank[b.status] ?? 0) > (rank[a.status] ?? 0) ? b : a,
  );
  return toActionRecord(best);
}

// ---------------------------------------------------------------------------
// Creating from an insight
// ---------------------------------------------------------------------------

/** Finds one insight in the current intelligence by its stable id. */
export function findInsight(
  intelligence: ClientIntelligence,
  insightId: string,
): Insight | null {
  const all = [
    ...(intelligence.attention ? [intelligence.attention] : []),
    ...intelligence.unhappy,
    ...intelligence.loved,
    ...intelligence.changing,
  ];
  return all.find((insight) => insight.id === insightId) ?? null;
}

/**
 * Turns an insight into a recommended action.
 *
 * Everything the operator was looking at when they clicked — the headline, the
 * counts, the evidence ids, the ranking reasons and the pack's advice — is
 * copied onto the row here and never touched again. That copy is the whole
 * point: intelligence is recomputed constantly, and an action has to survive
 * being disagreed with by a later version of it.
 */
export async function createActionFromInsight(
  db: PrismaClient,
  clientId: string,
  insightId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string }>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true, vertical: true },
  });
  if (!client) return err('That client no longer exists.');

  const now = options.now ?? new Date();
  const { intelligence } = await loadIntelligence(db, client, now);

  const insight = findInsight(intelligence, insightId);
  if (!insight) {
    return err(
      'That insight is no longer in the current intelligence, so there is nothing to base an action on.',
    );
  }

  const existing = await db.improvementAction.findFirst({
    where: { clientId, insightId, status: { notIn: ['DECLINED'] } },
    select: { id: true },
  });
  if (existing) {
    return err('There is already an open action for this. Open it instead of starting again.');
  }

  const draft = actionFromInsight(insight, {
    capturedAt: now,
    snapshotId: intelligence.window.currentSnapshotId,
    snapshotLabel: intelligence.window.currentLabel,
  });

  const created = await db.improvementAction.create({
    data: {
      clientId,
      insightId: draft.provenance.insightId,
      themeKey: draft.provenance.themeKey,
      themeLabel: draft.provenance.themeLabel,
      themeSentiment: draft.provenance.themeSentiment,
      themeSeverity: draft.provenance.themeSeverity,
      insightHeadline: draft.provenance.insightHeadline,
      insightDetail: draft.provenance.insightDetail,
      insightSignalsJson: JSON.stringify(draft.provenance.signals),
      intelligenceVersion: draft.provenance.intelligenceVersion,
      recommendationText: draft.provenance.recommendationText,

      baselineCount: draft.baseline.count,
      baselineTotal: draft.baseline.total,
      baselineItemIdsJson: JSON.stringify(draft.baseline.itemIds),
      baselineConfidence: draft.baseline.confidence,
      baselineCapturedAt: draft.baseline.capturedAt,
      baselineSnapshotId: draft.baseline.snapshotId,
      baselineSnapshotLabel: draft.baseline.snapshotLabel,

      title: draft.title,
      status: 'RECOMMENDED',
    },
    select: { id: true },
  });

  return ok(created);
}

// ---------------------------------------------------------------------------
// The human decision
// ---------------------------------------------------------------------------

const decisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'DECLINE'], { message: 'Choose accept or decline.' }),
  description: z.string().max(2000, 'That is too long for one decision.'),
  statusNote: z.string().max(2000, 'That note is too long.'),
  recordMinute: z.boolean(),
});

export type DecisionInput = z.infer<typeof decisionSchema>;

function zodErrors(issues: z.ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Records what a human decided.
 *
 * The recommendation and the decision are different fields on purpose. RepOS
 * may have said "review booking capacity"; the owner may have decided "cut
 * 6-8pm to five an hour". The second one is what actually happened and what
 * has to be remembered, so accepting without describing it is refused.
 */
export async function decideAction(
  db: PrismaClient,
  clientId: string,
  actionId: string,
  raw: unknown,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string; status: ActionStatus }>> {
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }
  const input = parsed.data;

  const current = await getAction(db, clientId, actionId);
  if (!current) return err('That action no longer exists.');

  const next: ActionStatus = input.decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
  if (!canTransition(current.status, next)) {
    return err(transitionError(current.status, next));
  }

  if (next === 'ACCEPTED' && input.description.trim().length < 3) {
    return err('Some fields need attention.', {
      description: 'Write what the business actually decided to do.',
    });
  }

  const now = options.now ?? new Date();

  // Operational memory stays in Minutes. The action points at the minute; it
  // does not keep a second copy of the client's history.
  let minuteId = current.minuteId;
  if (next === 'ACCEPTED' && input.recordMinute && !minuteId) {
    const minute = await createMinute(
      db,
      clientId,
      decisionMinute(
        {
          themeLabel: current.provenance.themeLabel,
          description: input.description,
          recommendationText: current.provenance.recommendationText,
        },
        now,
      ),
    );
    if (minute.ok) minuteId = minute.data.id;
  }

  await db.improvementAction.update({
    where: { id: actionId },
    data: {
      status: next,
      description: next === 'ACCEPTED' ? input.description.trim() : current.description,
      statusNote: input.statusNote.trim(),
      decidedAt: now,
      minuteId,
    },
  });

  return ok({ id: actionId, status: next });
}

// ---------------------------------------------------------------------------
// Status moves
// ---------------------------------------------------------------------------

const moveSchema = z.object({
  to: z.enum(['ACCEPTED', 'DONE', 'PAUSED', 'DECLINED'], {
    message: 'That is not a state an action can be moved to.',
  }),
  note: z.string().max(2000, 'That note is too long.'),
  /** Only meaningful for DONE: when the business says the change was made. */
  occurredAt: z.date().nullable(),
});

/**
 * Moves an action along.
 *
 * DONE deserves its own note: it records that the business SAYS the change was
 * made. Nothing about this write is evidence that customers noticed, and the
 * measurement is a separate, later, evidence-based step.
 */
export async function moveAction(
  db: PrismaClient,
  clientId: string,
  actionId: string,
  raw: unknown,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string; status: ActionStatus }>> {
  const parsed = moveSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }
  const input = parsed.data;

  const current = await getAction(db, clientId, actionId);
  if (!current) return err('That action no longer exists.');

  if (!canTransition(current.status, input.to)) {
    return err(transitionError(current.status, input.to));
  }

  const now = options.now ?? new Date();
  const doneAt = input.occurredAt ?? now;

  if (input.to === 'DONE') {
    if (doneAt.getTime() > now.getTime()) {
      return err('Some fields need attention.', {
        occurredAt: 'A change cannot have been made in the future.',
      });
    }
    // The date splits feedback into before and after, so a change dated before
    // the action was agreed would make the comparison meaningless. Compared by
    // calendar day, because the form supplies a date and the baseline carries
    // a time — a change agreed and made the same morning is perfectly normal.
    const day = (value: Date) =>
      new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

    if (day(doneAt) < day(current.baseline.capturedAt)) {
      const agreed = current.baseline.capturedAt.toISOString().slice(0, 10);
      return err('Some fields need attention.', {
        occurredAt: `This action was agreed on ${agreed}, so the change cannot have been made before then.`,
      });
    }
  }

  await db.improvementAction.update({
    where: { id: actionId },
    data: {
      status: input.to,
      statusNote: input.note.trim(),
      // Moving back out of DONE clears the date and any measurement built on
      // it, because both were about a change that turns out not to have been
      // made. Leaving a stale result behind would be worse than losing it.
      doneAt: input.to === 'DONE' ? doneAt : input.to === 'ACCEPTED' ? null : current.doneAt,
      ...(input.to === 'ACCEPTED' && current.status === 'DONE'
        ? { result: null, resultJson: null, measuredAt: null }
        : {}),
    },
  });

  return ok({ id: actionId, status: input.to });
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/** The evidence date: the customer's own where known, otherwise arrival. */
export function evidenceDateOf(row: {
  reviewDate: Date | null;
  createdAt: Date;
}): Date {
  return row.reviewDate ?? row.createdAt;
}

/**
 * Compares the feedback that has arrived since the change with the baseline.
 *
 * Reads only what the operator has already put into RepOS. Nothing is fetched,
 * and the verdict is application code applying the health engine's own share
 * floors — no model is asked whether the change worked.
 *
 * The result is frozen onto the row. A later re-analysis of the feedback must
 * not silently rewrite a verdict the operator has already told the owner.
 */
export async function measureClientAction(
  db: PrismaClient,
  clientId: string,
  actionId: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string; measurement: Measurement }>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, vertical: true },
  });
  if (!client) return err('That client no longer exists.');

  const current = await getAction(db, clientId, actionId);
  if (!current) return err('That action no longer exists.');

  if (!canTransition(current.status, 'MEASURED')) {
    return err(transitionError(current.status, 'MEASURED'));
  }
  if (!current.doneAt) {
    return err('Mark the change as made before measuring it.');
  }

  const now = options.now ?? new Date();
  const pack: Pack = getPackOrFallback(client.vertical);

  const rows = await db.reviewItem.findMany({
    where: { clientId },
    select: {
      id: true,
      themesJson: true,
      analysisStatus: true,
      reviewDate: true,
      createdAt: true,
    },
  });

  const measurable: MeasurableRow[] = rows.map((row) => ({
    id: row.id,
    themesJson: row.themesJson,
    analysisStatus: row.analysisStatus,
    evidenceAt: evidenceDateOf(row),
  }));

  const measurement = measureAction({
    pack,
    themeKey: current.provenance.themeKey,
    themeLabel: current.provenance.themeLabel,
    sentiment: current.provenance.themeSentiment,
    baseline: current.baseline,
    doneAt: current.doneAt,
    rows: measurable,
    now,
  });

  await db.improvementAction.update({
    where: { id: actionId },
    data: {
      status: 'MEASURED',
      result: measurement.result,
      resultJson: JSON.stringify(measurement),
      measuredAt: now,
    },
  });

  return ok({ id: actionId, measurement });
}

export type ActionProgress = {
  action: ActionRecord;
  /** Read feedback whose evidence date falls inside the measurement window. */
  newFeedbackSinceDone: number;
  /** Of those, how many were read since the last measurement. */
  newFeedbackSinceMeasured: number;
  canMeasure: boolean;
};

/**
 * Every action for a client, with how much new evidence each one has.
 *
 * Two queries regardless of how many actions there are: the actions, and the
 * client's feedback dates. The per-action counting happens in memory, so a
 * client with a long improvement history does not cost a query per row.
 */
export async function listActionsWithProgress(
  db: PrismaClient,
  clientId: string,
): Promise<ActionProgress[]> {
  const [actions, rows] = await Promise.all([
    listClientActions(db, clientId),
    db.reviewItem.findMany({
      where: { clientId, analysisStatus: 'ANALYSED' },
      select: { reviewDate: true, createdAt: true, analysedAt: true },
    }),
  ]);

  return actions.map((action) => {
    const start = action.doneAt
      ? measurementWindowStart(action.doneAt, action.baseline.capturedAt)
      : null;

    const inWindow =
      start === null
        ? []
        : rows.filter((row) => evidenceDateOf(row).getTime() >= start);

    // An action already measured is only worth measuring again once something
    // has actually been read since. Offering a button that would return the
    // same answer is a dead end dressed up as an action.
    const measuredAt = action.measuredAt?.getTime() ?? null;
    const unread =
      measuredAt === null
        ? inWindow.length
        : inWindow.filter((row) => (row.analysedAt?.getTime() ?? 0) > measuredAt).length;

    return {
      action,
      newFeedbackSinceDone: inWindow.length,
      newFeedbackSinceMeasured: unread,
      canMeasure: hasEnoughToMeasure(action, inWindow.length) && unread > 0,
    };
  });
}

/**
 * Whether measuring would tell the operator anything yet.
 *
 * Used by the command centre so it only ever offers "measure this" when there
 * is enough new feedback for the answer to be more than "not enough yet".
 */
export function hasEnoughToMeasure(
  action: ActionRecord,
  newFeedbackSinceDone: number,
): boolean {
  // MEASURED counts too: the normal life of an action is to be measured once,
  // then measured again a month later on more feedback. Locking it after the
  // first verdict would freeze the loop at its least informative point.
  if (action.status !== 'DONE' && action.status !== 'MEASURED') return false;
  if (!action.doneAt) return false;
  return newFeedbackSinceDone >= MIN_FEEDBACK_TO_MEASURE;
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

const learningSchema = z.object({
  note: z
    .string()
    .max(2000, 'Keep the note short — it is a reminder, not a report.'),
});

/**
 * The operator's own note about what they think happened.
 *
 * Stored apart from the measurement and labelled as a business observation
 * wherever it appears. It is what a person believes; the measurement is what
 * the feedback shows. Merging the two would let an opinion inherit the
 * credibility of evidence.
 */
export async function recordLearning(
  db: PrismaClient,
  clientId: string,
  actionId: string,
  raw: unknown,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ id: string }>> {
  const parsed = learningSchema.safeParse(raw);
  if (!parsed.success) {
    return err('Some fields need attention.', zodErrors(parsed.error.issues));
  }

  const current = await getAction(db, clientId, actionId);
  if (!current) return err('That action no longer exists.');

  const note = parsed.data.note.trim();
  await db.improvementAction.update({
    where: { id: actionId },
    data: { learningNote: note, learningAt: note.length > 0 ? options.now ?? new Date() : null },
  });

  return ok({ id: actionId });
}
