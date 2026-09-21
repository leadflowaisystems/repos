/**
 * THE STORY SEEDER — one demo story, through the real services.
 *
 * Synthetic demo data for product evaluation. Extracted from
 * `scripts/demo-seed.ts` so the Corner Cafe rebuild and the six vertical
 * demos (`scripts/demo-verticals.ts`) run the SAME code: every row goes
 * through the real intake, snapshot, analysis, triage, context and
 * improvement services, so every validation, safety gate and state-machine
 * rule applies exactly as it does for an operator or a customer.
 *
 * Offline on purpose: the deterministic reader does the reading and no
 * provider is contacted, so a story reads the same way every time it is
 * seeded, on every machine.
 */

import type { PrismaClient } from '@prisma/client';
import { createFeedbackItem } from '@/lib/feedback/service';
import { ingestFeedback } from '@/lib/feedback/ingest';
import { parseStructured } from '@/lib/feedback/structured';
import { ensureGateway } from '@/lib/gateway/service';
import { analyseClientFeedback, getThemeSummary } from '@/lib/feedback/analysis';
import { draftClientReplies, triageClientFeedback } from '@/lib/feedback/replies';
import { createSnapshot } from '@/lib/snapshots/service';
import { createMinute } from '@/lib/minutes/service';
import { getClientIntelligence } from '@/lib/intelligence/service';
import { getPackOrFallback } from '@/lib/packs';
import {
  createActionFromInsight,
  decideAction,
  measureClientAction,
  moveAction,
  recordLearning,
} from '@/lib/improve/service';
import { answerQuestion, createContext } from '@/lib/context/service';
import type { DemoStory } from './story';

export const MARKER = 'Synthetic demo data for local product evaluation.';

export const OFFLINE = { useAi: false as const };

/** Every id a seeding created, so it can be accounted for afterwards. */
export type SeedManifest = {
  feedbackIds: string[];
  snapshotIds: string[];
  minuteIds: string[];
  actionIds: string[];
  contextIds: string[];
};

export function emptySeedManifest(): SeedManifest {
  return { feedbackIds: [], snapshotIds: [], minuteIds: [], actionIds: [], contextIds: [] };
}

export function at(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`demo seed: bad date ${iso}`);
  return d;
}

/** "★★★★ Loved it" — the form the operator pastes a listing's reviews in. */
export function starLine(stars: number | null, text: string): string {
  return stars === null ? text : `${'★'.repeat(stars)} ${text}`;
}

export type SnapshotInput = {
  label: string;
  capturedAt: Date;
  rating: number;
  reviewCount: number;
  unansweredCount: number;
  reviewsPerWeek: number;
  daysSinceLastPost: number;
  photoRecencyDays: number;
  reviewsRaw: string[];
};

export type DirectFeedbackInput = {
  text: string;
  stars: number | null;
  at: Date;
  dimensions?: Record<string, number>;
  signals?: string[];
};

export type StorySeeder = ReturnType<typeof createStorySeeder>;

export function createStorySeeder(
  db: PrismaClient,
  manifest: SeedManifest,
  log: (line: string) => void = (line) => console.log(line),
) {
  /**
   * One public review, as the operator adds one by hand: the words, the rating
   * the listing showed (or none), and the date the customer left it. The same
   * redaction, the same duplicate rule, the same row.
   */
  async function addPublicReview(
    clientId: string,
    review: { at: string; stars: number | null; text: string },
  ): Promise<void> {
    const result = await createFeedbackItem(db, clientId, {
      text: review.text,
      stars: review.stars,
      reviewDate: at(review.at),
      source: 'PUBLIC_REVIEW',
    });
    if (!result.ok) throw new Error(`public review failed: ${result.message} — ${review.text}`);
    manifest.feedbackIds.push(result.data.id);
    // Arrival is the customer's own date too, so the row never looks like it
    // arrived on the day the demo was seeded.
    await db.reviewItem.update({ where: { id: result.data.id }, data: { createdAt: at(review.at) } });
  }

  async function addSnapshot(clientId: string, input: SnapshotInput): Promise<void> {
    const result = await createSnapshot(
      db,
      clientId,
      {
        label: input.label,
        capturedAt: input.capturedAt,
        rating: input.rating,
        reviewCount: input.reviewCount,
        unansweredCount: input.unansweredCount,
        daysSinceLastPost: input.daysSinceLastPost,
        photoRecencyDays: input.photoRecencyDays,
        reviewsPerWeek: input.reviewsPerWeek,
        profileGaps: [],
        observationNotes: MARKER,
        reviewsRaw: input.reviewsRaw.join('\n'),
      },
      OFFLINE,
    );
    if (!result.ok) throw new Error(`snapshot failed: ${result.message}`);
    manifest.snapshotIds.push(result.data.id);

    // Reviews captured inside a check-in are evidence from that check-in's
    // time, not from the day the demo was seeded. Dating them keeps every
    // before/after comparison chronologically honest.
    await db.reviewItem.updateMany({
      where: { snapshotId: result.data.id, reviewDate: null },
      data: { reviewDate: input.capturedAt },
    });
    await db.reviewItem.updateMany({
      where: { snapshotId: result.data.id },
      data: { createdAt: input.capturedAt },
    });
    await db.snapshot.update({ where: { id: result.data.id }, data: { createdAt: input.capturedAt } });
  }

  /**
   * M13: one thing the owner told Headway, through the real context service, so
   * the same validation (no contact details, a theme this pack knows) applies.
   */
  async function addContext(
    clientId: string,
    input: { kind: string; text: string; themeKey?: string; constraintKey?: string; recordedAt: Date },
  ): Promise<void> {
    const result = await createContext(db, clientId, {
      kind: input.kind,
      text: input.text,
      themeKey: input.themeKey ?? null,
      constraintKey: input.constraintKey ?? null,
      recordedAt: input.recordedAt,
    });
    if (!result.ok) throw new Error(`context failed: ${result.message} ${JSON.stringify(result.errors)}`);
    manifest.contextIds.push(result.data.id);
  }

  /** M13: the owner answered the question Headway asks on their Home page. */
  async function addAnswer(clientId: string, themeKey: string, answer: string, when: Date): Promise<void> {
    const result = await answerQuestion(db, clientId, { themeKey, answer }, { now: when });
    if (!result.ok) throw new Error(`answer failed: ${result.message}`);
    manifest.contextIds.push(result.data.id);
  }

  async function addMinute(
    clientId: string,
    category: string,
    title: string,
    body: string,
    occurredAt: Date,
  ): Promise<void> {
    const result = await createMinute(db, clientId, {
      occurredAt,
      category,
      title,
      body: `${body}\n\n${MARKER}`,
    });
    if (!result.ok) throw new Error(`minute failed: ${result.message}`);
    manifest.minuteIds.push(result.data.id);
  }

  /** Read everything unread for a client, exactly as the pipeline would. */
  async function readAll(clientId: string): Promise<void> {
    const read = await analyseClientFeedback(db, clientId, OFFLINE);
    if (!read.ok) throw new Error(`analysis failed: ${read.message}`);
  }

  /**
   * Feedback that came in through the client's own QR page, as customers send
   * it: an overall rating, the pack's own questions, the specifics they tapped,
   * and words or none. It takes the same road the public page takes — the
   * shared intake, the pack's own key check, the page's own duplicate rule — so
   * the demo holds nothing the real thing could not.
   */
  async function addDirectFeedback(
    clientId: string,
    vertical: string,
    items: DirectFeedbackInput[],
  ): Promise<void> {
    await ensureGateway(db, clientId);
    const dimensions = getPackOrFallback(vertical).gateway?.dimensions ?? [];
    for (const item of items) {
      const structured = parseStructured(dimensions, {
        dimensions: item.dimensions ?? {},
        signals: item.signals ?? [],
      });
      const result = await ingestFeedback(
        db,
        clientId,
        { text: item.text, stars: item.stars, occurredAt: item.at, source: 'REP_OS_QR', structured },
        {
          now: item.at,
          allowEmptyText: true,
          dedupe: { mode: 'WINDOW', textWindowMs: 10 * 60_000, ratingOnlyWindowMs: 30_000 },
        },
      );
      if (!result.ok) throw new Error(`direct feedback failed: ${result.message}`);
      if (result.data.duplicate) throw new Error(`direct feedback read as a duplicate: ${item.text}`);
      manifest.feedbackIds.push(result.data.id);
    }
  }

  /**
   * Suggestion → decision → change, each on its own date, through the real
   * state machine. Returns the action id, or null when the feedback so far
   * gives Headway nothing to suggest.
   */
  async function startAction(
    clientId: string,
    dates: { suggestedAt: Date; decidedAt: Date; description: string; doneAt: Date },
  ): Promise<string | null> {
    const intel = await getClientIntelligence(db, clientId, { now: dates.suggestedAt });
    const insightId = intel?.attention?.id;
    if (!insightId) {
      log('  · no attention insight yet, skipping the action loop');
      return null;
    }

    const created = await createActionFromInsight(db, clientId, insightId, {
      now: dates.suggestedAt,
    });
    if (!created.ok) {
      log(`  · action not created: ${created.message}`);
      return null;
    }
    manifest.actionIds.push(created.data.id);
    // The service stamps the baseline with `now` but lets the row's createdAt
    // default to the wall clock; the demo wants the suggestion dated too.
    await db.improvementAction.update({
      where: { id: created.data.id },
      data: { createdAt: dates.suggestedAt },
    });

    const decided = await decideAction(
      db,
      clientId,
      created.data.id,
      {
        decision: 'ACCEPT',
        description: dates.description,
        statusNote: '',
        recordMinute: true,
      },
      { now: dates.decidedAt },
    );
    if (!decided.ok) throw new Error(`decide failed: ${decided.message}`);

    // Accepting an action writes a DECISION minute through the M4 service, so
    // its id has to be picked up from the row — otherwise --clear would leave
    // that one minute behind.
    const withMinute = await db.improvementAction.findUnique({
      where: { id: created.data.id },
      select: { minuteId: true },
    });
    if (withMinute?.minuteId) manifest.minuteIds.push(withMinute.minuteId);

    const done = await moveAction(
      db,
      clientId,
      created.data.id,
      { to: 'DONE', note: '', occurredAt: dates.doneAt },
      { now: dates.doneAt },
    );
    if (!done.ok) throw new Error(`done failed: ${done.message}`);
    return created.data.id;
  }

  /** The comparison, once enough feedback has arrived after the change. */
  async function finishAction(
    clientId: string,
    actionId: string,
    measuredAt: Date,
    learning: string,
  ): Promise<void> {
    const measured = await measureClientAction(db, clientId, actionId, { now: measuredAt });
    if (!measured.ok) throw new Error(`measure failed: ${measured.message}`);
    log(`  · action measured: ${measured.data.measurement.result}`);

    await recordLearning(db, clientId, actionId, { note: learning }, { now: measuredAt });
  }

  /**
   * One story, seeded in the order it happened, so every date on the
   * Improvements page is honest: reviews, a check-in, more reviews, the
   * conversation, the suggestion, the decision, the change, the feedback that
   * came after it, the second check-in, the comparison. The intelligence at
   * each step is computed from what had arrived by then, which is what freezes
   * the right baseline.
   */
  async function seedStory(clientId: string, story: DemoStory): Promise<void> {
    const vertical = story.vertical;

    // Before the first check-in: the public listing, pasted in as the operator found it.
    for (const review of story.earlyReviews) await addPublicReview(clientId, review);
    await readAll(clientId);

    // The first check-in, with the reviews observed that day.
    const first = story.firstCheckin;
    await addSnapshot(clientId, {
      label: first.label,
      capturedAt: at(first.capturedAt),
      rating: first.rating,
      reviewCount: first.reviewCount,
      unansweredCount: first.unansweredCount,
      reviewsPerWeek: first.reviewsPerWeek,
      daysSinceLastPost: first.daysSinceLastPost,
      photoRecencyDays: first.photoRecencyDays,
      reviewsRaw: first.reviews.map((x) => starLine(x.stars, x.text)),
    });
    await readAll(clientId);

    // Between the check-in and the decision.
    for (const review of story.midReviews) await addPublicReview(clientId, review);
    await readAll(clientId);

    // The conversation, and what the owner told Headway in it.
    const owner = story.owner;
    await addMinute(
      clientId,
      'OWNER_CONVERSATION',
      owner.conversation.title,
      owner.conversation.body,
      at(owner.conversation.at),
    );
    for (const line of owner.context) {
      await addContext(clientId, {
        kind: line.kind,
        text: line.text,
        themeKey: line.themeKey,
        constraintKey: line.constraintKey,
        recordedAt: at(line.at),
      });
    }

    // Suggestion → decision → change, through the real state machine, with the
    // baseline frozen on the feedback read by the day of the suggestion.
    const actionId = await startAction(clientId, {
      suggestedAt: at(story.action.suggestedAt),
      decidedAt: at(story.action.decidedAt),
      description: story.action.description,
      doneAt: at(story.action.doneAt),
    });
    if (owner.answer) {
      await addAnswer(clientId, owner.answer.themeKey, owner.answer.answer, at(owner.answer.at));
    }
    await addMinute(clientId, 'FOLLOW_UP', owner.followUp.title, owner.followUp.body, at(owner.followUp.at));

    // After the change: the QR card goes out, and the listing keeps filling.
    // Everything lands in the order it arrived.
    type Arrival =
      | { kind: 'public'; at: string; review: (typeof story.lateReviews)[number] }
      | { kind: 'qr'; at: string; item: (typeof story.qr)[number] }
      | { kind: 'checkin'; at: string };
    const arrivals: Arrival[] = [
      ...story.lateReviews.map((review) => ({ kind: 'public' as const, at: review.at, review })),
      ...story.qr.map((item) => ({ kind: 'qr' as const, at: item.at, item })),
      { kind: 'checkin' as const, at: story.secondCheckin.capturedAt },
    ].sort((a, b) => a.at.localeCompare(b.at));

    for (const arrival of arrivals) {
      if (arrival.kind === 'public') {
        await addPublicReview(clientId, arrival.review);
      } else if (arrival.kind === 'qr') {
        await addDirectFeedback(clientId, vertical, [
          {
            text: arrival.item.text,
            stars: arrival.item.stars,
            at: at(arrival.item.at),
            dimensions: arrival.item.dimensions,
            signals: arrival.item.signals,
          },
        ]);
      } else {
        await readAll(clientId);
        const second = story.secondCheckin;
        await addSnapshot(clientId, {
          label: second.label,
          capturedAt: at(second.capturedAt),
          rating: second.rating,
          reviewCount: second.reviewCount,
          unansweredCount: second.unansweredCount,
          reviewsPerWeek: second.reviewsPerWeek,
          daysSinceLastPost: second.daysSinceLastPost,
          photoRecencyDays: second.photoRecencyDays,
          reviewsRaw: second.reviews.map((x) => starLine(x.stars, x.text)),
        });
      }
    }
    await readAll(clientId);

    // The comparison, and what the owner made of it.
    if (actionId) {
      await finishAction(clientId, actionId, at(story.action.measuredAt), story.action.learning);
    }
    await addMinute(clientId, 'ACTION', owner.afterNote.title, owner.afterNote.body, at(owner.afterNote.at));
  }

  /**
   * What every seeded client gets at the end: its feedback QR ready, nothing
   * left unread, and the operator's sort-and-draft pass done — exactly as the
   * operator would from the Feedback page.
   */
  async function finishClient(clientId: string): Promise<void> {
    await ensureGateway(db, clientId);
    // Snapshots capture their own reviews as feedback items, so a final read
    // pass runs after them — otherwise the freshly captured ones would sit
    // unread and every client would show a "still to read" backlog.
    await readAll(clientId);
    await triageClientFeedback(db, clientId, {});
    await draftClientReplies(db, clientId, { ...OFFLINE, limit: 60 });
  }

  /**
   * What the pages will say, straight from the stored rows — printed so a
   * seeding can be checked against the story before anybody opens a browser.
   */
  async function printSummary(client: { id: string; businessName: string; vertical: string }) {
    const [bySource, snapshots, minutes, actions, contextRows, themes] = await Promise.all([
      db.reviewItem.groupBy({ by: ['source'], where: { clientId: client.id }, _count: { _all: true } }),
      db.snapshot.count({ where: { clientId: client.id } }),
      db.minute.count({ where: { clientId: client.id } }),
      db.improvementAction.findMany({
        where: { clientId: client.id },
        select: { themeLabel: true, status: true, result: true, baselineCount: true, baselineTotal: true, resultJson: true },
      }),
      db.businessContext.count({ where: { clientId: client.id } }),
      getThemeSummary(db, client.id, client.vertical),
    ]);
    const unread = await db.reviewItem.count({
      where: { clientId: client.id, NOT: { analysisStatus: 'ANALYSED' } },
    });
    log(
      `  · feedback ${bySource.map((s) => `${s.source} ${s._count._all}`).join(', ')}` +
        ` (${unread} unread), check-ins ${snapshots}, minutes ${minutes}, context ${contextRows}`,
    );
    log(`  · read ${themes.analysedCount}; issues ${themes.issues.map((t) => `${t.key} ${t.count}`).join(', ')}`);
    log(`  · praise ${themes.praises.map((t) => `${t.key} ${t.count}`).join(', ')}`);
    for (const d of themes.dimensions) {
      if (d.rated > 0) log(`  · rated ${d.key}: ${d.rated} answers, avg ${d.average}, ${d.low} at 3 or below`);
    }
    for (const a of actions) {
      const m = a.resultJson ? (JSON.parse(a.resultJson) as { before?: { line?: string }; after?: { line?: string } }) : null;
      log(
        `  · action ${a.themeLabel}: ${a.status}${a.result ? ` → ${a.result}` : ''} (baseline ${a.baselineCount} of ${a.baselineTotal}${
          m?.before?.line && m?.after?.line ? `; ${m.before.line} → ${m.after.line}` : ''
        })`,
      );
    }
  }

  return {
    addPublicReview,
    addSnapshot,
    addContext,
    addAnswer,
    addMinute,
    readAll,
    addDirectFeedback,
    startAction,
    finishAction,
    seedStory,
    finishClient,
    printSummary,
  };
}
