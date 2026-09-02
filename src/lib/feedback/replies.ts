import type { PrismaClient } from '@prisma/client';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { parseJson } from '@/lib/format';
import { aiStatus } from '@/lib/ai';
import { draftReplyWithAi } from '@/lib/ai/draft-reply';
import type { NormalizedTheme } from '@/lib/analysis/normalize';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import {
  DRAFT_VERSION,
  draftReply,
  templateDraft,
  type DraftContext,
} from '@/lib/reply/draft';
import { checkDraft } from '@/lib/reply/safety';
import { resolveVoice, type EffectiveVoice } from '@/lib/reply/voice';
import {
  TRIAGE_VERSION,
  triageFeedback,
  wantsDraft,
  type ResponseClass,
} from '@/lib/reply/triage';

/**
 * REPLY WORKFLOW (M7).
 *
 * Analysed feedback -> triage -> suggested reply -> the operator's eyes -> copy.
 *
 * Three guarantees, the same three the analysis layer keeps:
 *
 *  1. The customer's stored text is never modified. This layer only writes to
 *     the reply columns.
 *  2. One item failing never affects another and never rolls back work already
 *     done. A failure is recorded on the item and stays retryable.
 *  3. Nothing leaves this machine and nothing is posted anywhere. A draft is
 *     text on a screen with a Copy button next to it.
 *
 * There is no background worker. The operator presses a button and waits.
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

type ClientBundle = {
  clientId: string;
  pack: Pack;
  voice: EffectiveVoice;
};

async function loadClient(
  db: PrismaClient,
  clientId: string,
): Promise<ClientBundle | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessName: true,
      vertical: true,
      voiceProfile: true,
      policy: true,
    },
  });
  if (!client) return null;

  const pack = getPackOrFallback(client.vertical);
  return {
    clientId: client.id,
    pack,
    voice: resolveVoice(
      pack,
      { businessName: client.businessName, vertical: client.vertical },
      client.voiceProfile,
      client.policy,
    ),
  };
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

export type TriageRunResult = {
  considered: number;
  triaged: number;
  skippedUpToDate: number;
  /** Not analysed yet, so there is nothing to triage from. */
  skippedUnanalysed: number;
  needsReply: number;
  needsYou: number;
};

export type TriageOptions = { force?: boolean; now?: Date };

/**
 * Sorts a client's analysed feedback into what needs a reply and how urgently.
 *
 * Deterministic and cheap: it reads the analysis columns M6 already wrote and
 * never re-reads the text for sentiment. Safe to run after every analysis pass.
 */
export async function triageClientFeedback(
  db: PrismaClient,
  clientId: string,
  options: TriageOptions = {},
): Promise<ServiceResult<TriageRunResult>> {
  const bundle = await loadClient(db, clientId);
  if (!bundle) return err('That client no longer exists.');

  const now = options.now ?? new Date();

  const rows = await db.reviewItem.findMany({
    where: { clientId },
    select: {
      id: true,
      text: true,
      stars: true,
      reviewDate: true,
      sentiment: true,
      confidence: true,
      themesJson: true,
      analysisStatus: true,
      analysisVersion: true,
      triageVersion: true,
      responseAction: true,
    },
  });

  const analysed = rows.filter(
    (row) => row.analysisStatus === 'ANALYSED' && row.analysisVersion >= ANALYSIS_VERSION,
  );
  const skippedUnanalysed = rows.length - analysed.length;

  const pending = options.force
    ? analysed
    : analysed.filter((row) => row.triageVersion < TRIAGE_VERSION);

  let triaged = 0;
  for (const row of pending) {
    const result = triageFeedback({
      text: row.text,
      stars: row.stars,
      reviewDate: row.reviewDate,
      sentiment: row.sentiment,
      confidence: row.confidence,
      themes: parseJson<NormalizedTheme[]>(row.themesJson, []),
      pack: bundle.pack,
      now,
    });

    await db.reviewItem.update({
      where: { id: row.id },
      data: {
        responseClass: result.responseClass,
        responseAction: result.responseAction,
        priorityBand: result.priorityBand,
        priorityRank: result.priorityRank,
        priorityReasonsJson: JSON.stringify(result.reasons),
        triageVersion: result.version,
      },
    });
    triaged += 1;
  }

  const after = await db.reviewItem.findMany({
    where: { clientId },
    select: { responseAction: true },
  });

  return ok({
    considered: rows.length,
    triaged,
    skippedUpToDate: analysed.length - pending.length,
    skippedUnanalysed,
    needsReply: after.filter((r) => r.responseAction === 'REPLY_RECOMMENDED').length,
    needsYou: after.filter((r) => r.responseAction === 'NEEDS_HUMAN').length,
  });
}

// ---------------------------------------------------------------------------
// Drafting
// ---------------------------------------------------------------------------

export type DraftRunResult = {
  considered: number;
  drafted: number;
  alreadyDrafted: number;
  failed: number;
  /** Items that need the operator personally, so no draft was written. */
  leftForYou: number;
  usedAi: boolean;
  notes: string[];
};

export type DraftOptions = {
  /** Redo drafts that already exist. Never touches an edited or handled one. */
  force?: boolean;
  useAi?: boolean;
  now?: Date;
  limit?: number;
  /** Also draft for "reply if you have a minute" items. */
  includeOptional?: boolean;
};

/** Statuses that represent the operator's own work. Never overwritten. */
const OPERATOR_OWNED = new Set(['EDITED', 'HANDLED']);

function buildContext(
  bundle: ClientBundle,
  row: {
    text: string;
    stars: number | null;
    sentiment: string;
    themesJson: string;
    responseClass: string;
    language: string | null;
  },
): DraftContext {
  return {
    pack: bundle.pack,
    voice: bundle.voice,
    text: row.text,
    stars: row.stars,
    sentiment: row.sentiment,
    themes: parseJson<NormalizedTheme[]>(row.themesJson, []),
    responseClass: (row.responseClass || 'NEUTRAL') as ResponseClass,
    detectedLanguage: row.language,
  };
}

/**
 * Writes a suggested reply for every item that wants one.
 *
 * Runs triage first so the recommendations are current, then drafts. Items
 * flagged for the operator personally are counted and deliberately skipped:
 * handing someone a ready-made reply to a threat of legal action would be the
 * wrong thing to do.
 */
export async function draftClientReplies(
  db: PrismaClient,
  clientId: string,
  options: DraftOptions = {},
): Promise<ServiceResult<DraftRunResult>> {
  const bundle = await loadClient(db, clientId);
  if (!bundle) return err('That client no longer exists.');

  const triage = await triageClientFeedback(db, clientId, { now: options.now });
  if (!triage.ok) return triage;

  const now = options.now ?? new Date();
  const useAi = options.useAi ?? aiStatus().enabled;
  const notes: string[] = [];

  const rows = await db.reviewItem.findMany({
    where: { clientId },
    orderBy: [{ priorityRank: 'desc' }, { sortIndex: 'asc' }],
    select: {
      id: true,
      text: true,
      stars: true,
      sentiment: true,
      themesJson: true,
      language: true,
      responseClass: true,
      responseAction: true,
      draftStatus: true,
      draftVersion: true,
    },
  });

  const leftForYou = rows.filter((r) => r.responseAction === 'NEEDS_HUMAN').length;

  const eligible = rows.filter((row) => {
    if (row.responseAction === 'NEEDS_HUMAN') return false;
    if (!wantsDraft(row.responseAction)) return false;
    if (row.responseAction === 'REPLY_OPTIONAL' && !options.includeOptional) return false;
    return true;
  });

  const pending = eligible.filter((row) => {
    if (OPERATOR_OWNED.has(row.draftStatus)) return false;
    if (options.force) return true;
    if (row.draftStatus === 'READY') return row.draftVersion < DRAFT_VERSION;
    return true; // NONE or FAILED
  });

  const alreadyDrafted = eligible.length - pending.length;
  const queue = options.limit ? pending.slice(0, options.limit) : pending;

  if (queue.length === 0) {
    return ok({
      considered: eligible.length,
      drafted: 0,
      alreadyDrafted,
      failed: 0,
      leftForYou,
      usedAi: false,
      notes:
        eligible.length === 0
          ? ['Nothing here needs a reply right now.']
          : ['Every review that needs a reply already has a suggestion.'],
    });
  }

  let drafted = 0;
  let failed = 0;
  let usedAi = false;

  for (const row of queue) {
    try {
      const context = buildContext(bundle, row);
      const outcome = await draftReply(context, {
        useAi,
        drafter: useAi ? draftReplyWithAi : undefined,
      });

      if (outcome.source === 'AI') usedAi = true;

      if (outcome.blocked) {
        // Even RepOS's own wording breaks a rule this business set — usually a
        // word they banned that the reply genuinely needs. Publishing it would
        // ignore their instruction, so the item is handed back with the reason.
        failed += 1;
        await db.reviewItem.update({
          where: { id: row.id },
          data: {
            draftStatus: 'FAILED',
            draftError: outcome.problems
              .filter((p) => p.blocking)
              .map((p) => p.message)
              .join(' ')
              .slice(0, 500),
          },
        });
        continue;
      }

      await db.reviewItem.update({
        where: { id: row.id },
        data: {
          draftText: outcome.text,
          draftLanguage: outcome.language,
          draftSource: outcome.source,
          draftStatus: 'READY',
          draftNotesJson: JSON.stringify(outcome.notes),
          draftError: null,
          draftVersion: outcome.version,
          draftedAt: now,
        },
      });
      drafted += 1;
    } catch (error) {
      failed += 1;
      const reason =
        error instanceof Error ? error.message : 'Something went wrong writing this one.';
      // The feedback and its analysis are untouched. Only the draft columns
      // record the failure, so the operator can retry just these.
      try {
        await db.reviewItem.update({
          where: { id: row.id },
          data: { draftStatus: 'FAILED', draftError: reason.slice(0, 500) },
        });
      } catch {
        // Losing the marker is better than aborting the whole run.
      }
    }
  }

  if (!useAi) {
    notes.push('Written by RepOS itself — the writing assistant is not switched on.');
  } else if (!usedAi) {
    notes.push('The writing assistant was unavailable, so RepOS wrote these itself.');
  }
  if (leftForYou > 0) {
    notes.push(
      `${leftForYou} left for you to handle personally — RepOS does not write those.`,
    );
  }

  return ok({
    considered: eligible.length,
    drafted,
    alreadyDrafted,
    failed,
    leftForYou,
    usedAi,
    notes: [...new Set(notes)],
  });
}

// ---------------------------------------------------------------------------
// Single-item operations
// ---------------------------------------------------------------------------

/** Rewrites one item's draft, discarding whatever was there. */
export async function regenerateDraft(
  db: PrismaClient,
  clientId: string,
  itemId: string,
  options: { useAi?: boolean; now?: Date } = {},
): Promise<ServiceResult<{ text: string; source: string; notes: string[] }>> {
  const bundle = await loadClient(db, clientId);
  if (!bundle) return err('That client no longer exists.');

  const row = await db.reviewItem.findFirst({
    where: { id: itemId, clientId },
    select: {
      id: true,
      text: true,
      stars: true,
      sentiment: true,
      themesJson: true,
      language: true,
      responseClass: true,
      analysisStatus: true,
    },
  });
  if (!row) return err('That feedback item no longer exists.');
  if (row.analysisStatus !== 'ANALYSED') {
    return err('RepOS has not read this one yet, so it cannot suggest a reply.');
  }

  const now = options.now ?? new Date();
  const useAi = options.useAi ?? aiStatus().enabled;

  try {
    const outcome = await draftReply(buildContext(bundle, row), {
      useAi,
      drafter: useAi ? draftReplyWithAi : undefined,
    });

    if (outcome.blocked) {
      const reason = outcome.problems
        .filter((p) => p.blocking)
        .map((p) => p.message)
        .join(' ');
      await db.reviewItem.update({
        where: { id: row.id },
        data: { draftStatus: 'FAILED', draftError: reason.slice(0, 500) },
      });
      return err(
        `RepOS cannot write this one without breaking your own wording rules. ${reason}`,
      );
    }

    await db.reviewItem.update({
      where: { id: row.id },
      data: {
        draftText: outcome.text,
        draftLanguage: outcome.language,
        draftSource: outcome.source,
        draftStatus: 'READY',
        draftNotesJson: JSON.stringify(outcome.notes),
        draftError: null,
        draftVersion: outcome.version,
        draftedAt: now,
      },
    });

    return ok({ text: outcome.text, source: outcome.source, notes: outcome.notes });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Something went wrong writing this one.';
    await db.reviewItem
      .update({
        where: { id: row.id },
        data: { draftStatus: 'FAILED', draftError: reason.slice(0, 500) },
      })
      .catch(() => undefined);
    return err('RepOS could not write a suggestion for this one. Try again.');
  }
}

/**
 * Stores the operator's own wording.
 *
 * Their text still passes the safety gate: a person is allowed to commit their
 * own business to a time frame, but nobody is allowed to publish a review
 * incentive or a customer's phone number from inside RepOS.
 */
export async function saveDraftEdit(
  db: PrismaClient,
  clientId: string,
  itemId: string,
  text: string,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ warnings: string[] }>> {
  const bundle = await loadClient(db, clientId);
  if (!bundle) return err('That client no longer exists.');

  const row = await db.reviewItem.findFirst({
    where: { id: itemId, clientId },
    select: { id: true, text: true, draftLanguage: true },
  });
  if (!row) return err('That feedback item no longer exists.');

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return err('Write something first.', { draftText: 'The reply cannot be empty.' });
  }

  const check = checkDraft(trimmed, {
    voice: bundle.voice,
    sourceText: row.text,
    allowedContext: bundle.voice.policyNotes,
  });

  if (!check.storable) {
    const blocking = check.problems.filter((p) => p.blocking);
    return err(blocking[0]?.message ?? 'That reply cannot be saved.', {
      draftText: blocking.map((p) => p.message).join(' '),
    });
  }

  await db.reviewItem.update({
    where: { id: row.id },
    data: {
      draftText: trimmed,
      draftStatus: 'EDITED',
      draftSource: 'TEMPLATE',
      draftError: null,
      draftVersion: DRAFT_VERSION,
      draftNotesJson: JSON.stringify(['Your own wording.']),
      draftedAt: options.now ?? new Date(),
    },
  });

  return ok({ warnings: check.problems.map((p) => p.message) });
}

/** Marks an item dealt with, or puts it back. Nothing is sent either way. */
export async function setHandled(
  db: PrismaClient,
  clientId: string,
  itemId: string,
  handled: boolean,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ handled: boolean }>> {
  const row = await db.reviewItem.findFirst({
    where: { id: itemId, clientId },
    select: { id: true, draftText: true },
  });
  if (!row) return err('That feedback item no longer exists.');

  await db.reviewItem.update({
    where: { id: row.id },
    data: {
      draftStatus: handled ? 'HANDLED' : row.draftText ? 'EDITED' : 'NONE',
      handledAt: handled ? (options.now ?? new Date()) : null,
    },
  });

  return ok({ handled });
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export type ReplyCoverage = {
  analysed: number;
  /** Analysed but not yet sorted into what needs a reply. */
  needsTriage: number;
  needsReply: number;
  optional: number;
  needsYou: number;
  noReplyNeeded: number;
  drafted: number;
  edited: number;
  handled: number;
  failed: number;
  /** Wants a reply, has no usable draft yet. */
  awaitingDraft: number;
  upToDate: boolean;
};

export async function getReplyCoverage(
  db: PrismaClient,
  clientId: string,
): Promise<ReplyCoverage> {
  const rows = await db.reviewItem.findMany({
    where: { clientId },
    select: {
      analysisStatus: true,
      analysisVersion: true,
      triageVersion: true,
      responseAction: true,
      draftStatus: true,
      draftVersion: true,
    },
  });
  return replyCoverageOf(rows);
}

/** Fields the coverage counter needs, so callers can select exactly these. */
export type ReplyCoverageRow = {
  analysisStatus: string;
  analysisVersion: number;
  triageVersion: number;
  responseAction: string;
  draftStatus: string;
  draftVersion: number;
};

/**
 * The same coverage from rows already in memory.
 *
 * Exported so the command centre can load every client's feedback once and
 * group it, rather than issuing a query per client. Counting lives here only,
 * so the client page and the command centre can never disagree.
 */
export function replyCoverageOf(rows: ReplyCoverageRow[]): ReplyCoverage {
  const analysedRows = rows.filter(
    (r) => r.analysisStatus === 'ANALYSED' && r.analysisVersion >= ANALYSIS_VERSION,
  );

  const count = (predicate: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(predicate).length;

  const awaitingDraft = rows.filter(
    (r) =>
      r.responseAction === 'REPLY_RECOMMENDED' &&
      !OPERATOR_OWNED.has(r.draftStatus) &&
      (r.draftStatus !== 'READY' || r.draftVersion < DRAFT_VERSION),
  ).length;

  return {
    analysed: analysedRows.length,
    needsTriage: analysedRows.filter((r) => r.triageVersion < TRIAGE_VERSION).length,
    needsReply: count((r) => r.responseAction === 'REPLY_RECOMMENDED'),
    optional: count((r) => r.responseAction === 'REPLY_OPTIONAL'),
    needsYou: count((r) => r.responseAction === 'NEEDS_HUMAN'),
    noReplyNeeded: count((r) => r.responseAction === 'NO_RESPONSE_NEEDED'),
    // Version-aware: a draft written under older rules is not a draft the
    // operator can rely on, and the headline must not claim otherwise.
    drafted: count(
      (r) => r.draftStatus === 'READY' && r.draftVersion >= DRAFT_VERSION,
    ),
    edited: count((r) => r.draftStatus === 'EDITED'),
    handled: count((r) => r.draftStatus === 'HANDLED'),
    failed: count((r) => r.draftStatus === 'FAILED'),
    awaitingDraft,
    upToDate: awaitingDraft === 0,
  };
}

/**
 * A preview of what the deterministic writer would say, without storing it.
 * Used by tests and by anything that wants to show a reply without committing.
 */
export async function previewTemplateReply(
  db: PrismaClient,
  clientId: string,
  itemId: string,
): Promise<ServiceResult<{ text: string }>> {
  const bundle = await loadClient(db, clientId);
  if (!bundle) return err('That client no longer exists.');

  const row = await db.reviewItem.findFirst({
    where: { id: itemId, clientId },
    select: {
      text: true,
      stars: true,
      sentiment: true,
      themesJson: true,
      language: true,
      responseClass: true,
    },
  });
  if (!row) return err('That feedback item no longer exists.');

  return ok({ text: templateDraft(buildContext(bundle, row)).text });
}
