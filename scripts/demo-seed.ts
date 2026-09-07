/**
 * DEMO DATA SEEDER — SYNTHETIC DATA FOR PRODUCT EVALUATION.
 *
 *   These records are synthetic demo data for product evaluation.
 *
 * Populates clients that already exist in the database with enough synthetic
 * evidence to exercise the product end to end: feedback from both doors, two
 * check-ins, what the owner told Headway, an improvement that was suggested,
 * agreed, made and compared, and the operator's own record of it.
 *
 * THREE RULES THIS SCRIPT KEEPS:
 *
 *  1. It writes NOTHING directly that a service owns. Every row goes through
 *     the real intake, snapshot, analysis, triage, context and improvement
 *     services, so every validation, safety gate and state-machine rule
 *     applies exactly as it does for an operator or a customer. A record that
 *     the product would refuse cannot be introduced this way.
 *
 *  2. The demo restaurant — Corner Cafe — is a STORY, not a template. It lives
 *     in `scripts/demo/corner-cafe.ts` as data, shaped exactly the way the
 *     current feedback form and the operator's paste box store things:
 *     public reviews carry a rating, a date and words; table-card feedback
 *     carries the pack's own questions, the specifics a customer tapped, and
 *     — sometimes — nothing written at all. The other verticals keep a
 *     simpler, templated set for local evaluation only.
 *
 *  3. Two modes, and each one says what it touched.
 *
 *       npx tsx scripts/demo-seed.ts
 *         Seeds every client in the database and records everything it
 *         created in a manifest, so `--clear` removes precisely that and
 *         nothing else. Data that existed before is never touched.
 *
 *       npx tsx scripts/demo-seed.ts --client "Corner Cafe" --replace [--yes]
 *         Rebuilds ONE client's story from scratch: removes that client's
 *         feedback, check-ins, improvements, minutes and owner context, then
 *         seeds the story. For a wholly synthetic demo client only. Without
 *         --yes it prints what it would remove and stops. The client row, its
 *         feedback page and its printed QR token are never touched.
 *
 * Contains no real names, phone numbers, emails or addresses. Nothing is
 * fetched from anywhere.
 */

import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createFeedbackItem, importFeedbackBatch } from '@/lib/feedback/service';
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
import { CORNER_CAFE, storyFeedbackCount, type CornerCafeStory } from './demo/corner-cafe';

const MANIFEST = resolve(join(__dirname, '..', 'data', '.demo-manifest.json'));

const MARKER = 'Synthetic demo data for local product evaluation.';

type Manifest = {
  createdAt: string;
  note: string;
  feedbackIds: string[];
  snapshotIds: string[];
  minuteIds: string[];
  actionIds: string[];
  contextIds: string[];
};

const db = new PrismaClient();

const manifest: Manifest = {
  createdAt: new Date().toISOString(),
  note: MARKER,
  feedbackIds: [],
  snapshotIds: [],
  minuteIds: [],
  actionIds: [],
  contextIds: [],
};

/**
 * Offline on purpose. The demo has to read the same way every time it is
 * seeded, on every machine, so the deterministic reader does the reading and
 * no provider is contacted. Every number on every page then rests on rules
 * anybody can re-run.
 */
const OFFLINE = { useAi: false as const };

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function at(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`demo seed: bad date ${iso}`);
  return d;
}

/**
 * Natural endings that keep repeated templates unique without an identifier.
 * The duplicate guard fingerprints the whole text, so the same sentence can be
 * used many times per client as long as each use ends differently. Nothing
 * here may look like a code: an owner reads these words on the Reviews page.
 */
const CLOSERS = [
  '',
  ' this time',
  ' again',
  ' on our last visit',
  ' as usual',
  ' this month',
  ' last week',
  ' on Saturday',
  ' on a weekday evening',
  ' yesterday',
  ' on my second visit',
  ' at the weekend',
  ' during the evening rush',
  ' in the afternoon',
  ' on a busy day',
  ' the other day',
  ' once more',
  ' on Sunday',
];

/** How often each template has been used for the current client. */
let templateUse = new Map<string, number>();

function resetLines(): void {
  templateUse = new Map();
}

/** Every review line is unique per client, so the duplicate guard never trips. */
function lines(templates: string[], count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const template = templates[i % templates.length] as string;
    const used = templateUse.get(template) ?? 0;
    templateUse.set(template, used + 1);
    const closer = CLOSERS[used];
    if (closer === undefined) {
      throw new Error(`demo seed: template used more than ${CLOSERS.length} times: ${template}`);
    }
    return `${template}${closer}`;
  });
}

// ---------------------------------------------------------------------------
// Import + read feedback through the real services
// ---------------------------------------------------------------------------

async function addFeedback(
  clientId: string,
  raw: string[],
  referenceDate: Date,
  reviewDate: Date | null,
): Promise<number> {
  const before = new Set(
    (await db.reviewItem.findMany({ where: { clientId }, select: { id: true } })).map(
      (r) => r.id,
    ),
  );

  const imported = await importFeedbackBatch(db, clientId, {
    raw: raw.join('\n'),
    source: 'PUBLIC_REVIEW',
    referenceDate,
  });
  if (!imported.ok) throw new Error(`import failed: ${imported.message}`);

  const fresh = (
    await db.reviewItem.findMany({ where: { clientId }, select: { id: true } })
  )
    .map((r) => r.id)
    .filter((id) => !before.has(id));

  manifest.feedbackIds.push(...fresh);

  // The customer's own date, where the demo wants the evidence to sit in a
  // particular period. Left alone for "just arrived" batches.
  if (reviewDate && fresh.length > 0) {
    await db.reviewItem.updateMany({
      where: { id: { in: fresh } },
      data: { reviewDate },
    });
  }

  const analysed = await analyseClientFeedback(db, clientId, OFFLINE);
  if (!analysed.ok) throw new Error(`analysis failed: ${analysed.message}`);

  return fresh.length;
}

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

async function addSnapshot(
  clientId: string,
  input: {
    label: string;
    capturedAt: Date;
    rating: number;
    reviewCount: number;
    unansweredCount: number;
    reviewsPerWeek: number;
    daysSinceLastPost: number;
    photoRecencyDays: number;
    reviewsRaw: string[];
  },
): Promise<void> {
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

/** "★★★★ Loved it" — the form the operator pastes a listing's reviews in. */
function starLine(stars: number | null, text: string): string {
  return stars === null ? text : `${'★'.repeat(stars)} ${text}`;
}

/**
 * M13: one thing the owner told Headway, through the real context service, so
 * the same validation (no contact details, a theme this pack knows) applies.
 */
async function addContext(
  clientId: string,
  input: {
    kind: string;
    text: string;
    themeKey?: string;
    constraintKey?: string;
    recordedAt: Date;
  },
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
  items: Array<{
    text: string;
    stars: number | null;
    at: Date;
    dimensions?: Record<string, number>;
    signals?: string[];
  }>,
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

// ---------------------------------------------------------------------------
// Review text for the templated verticals, keyed to each pack's taxonomy hints
// ---------------------------------------------------------------------------

const TEXT = {
  gym: {
    praise: [
      '5 stars The trainer corrected my form and was really knowledgeable',
      '5 stars Equipment is well maintained and there is good variety',
      '5 stars Clean facility, the changing rooms are hygienic',
      '4 stars Motivating atmosphere, good energy in the evenings',
      '5 stars Membership is affordable and worth the money',
    ],
    issueHeavy: [
      '2 stars Far too crowded at peak hours, waiting for machine every time',
      '2 stars Crowded in the evening, too many people for the space',
      '3 stars The AC is not working properly, very stuffy upstairs',
    ],
    issueLight: [
      '3 stars Bit crowded around 7pm but manageable',
      '3 stars AC could be better in the free weights area',
    ],
  },
  salon: {
    praise: [
      '5 stars The stylist is skilled, great cut exactly as discussed',
      '5 stars Friendly and patient staff, never rushed',
      '5 stars Clean and hygienic, tools sanitised in front of me',
      '4 stars Relaxing and calm, nice place to unwind',
    ],
    issueHeavy: [
      '2 stars They cancelled my appointment with no confirmation call',
      '2 stars No confirmation and my appointment was cancelled last minute',
      '2 stars Charged more than the price quoted, hidden charge at the till',
    ],
    issueLight: [
      '3 stars Had to wait past my slot but the result was good',
      '3 stars Price was slightly more than quoted, minor',
    ],
  },
  clinic: {
    praise: [
      '5 stars The doctor explained everything clearly and listened',
      '5 stars Friendly and helpful reception staff',
      '5 stars Clean and neat clinic throughout',
    ],
    issueHeavy: [
      '2 stars Waited over an hour past my appointment time',
      '2 stars The consultation felt rushed and hurried',
    ],
    issueLight: ['3 stars Short wait, otherwise fine'],
  },
} as const;

// ---------------------------------------------------------------------------
// Per-client stories. Deliberately different, so the console has something to rank.
// ---------------------------------------------------------------------------

async function seedGym(clientId: string) {
  resetLines();
  const t = TEXT.gym;
  // A healthy client: strong praise, one modest issue that is easing.
  await addFeedback(
    clientId,
    [
      ...lines([...t.praise], 12),
      ...lines([...t.issueHeavy], 6),
    ],
    daysAgo(70),
    daysAgo(70),
  );
  await addFeedback(
    clientId,
    [...lines([...t.praise], 10), ...lines([...t.issueLight], 2)],
    daysAgo(10),
    daysAgo(10),
  );

  await addSnapshot(clientId, {
    label: 'Check-in — two months ago',
    capturedAt: daysAgo(65),
    rating: 4.1,
    reviewCount: 96,
    unansweredCount: 22,
    reviewsPerWeek: 1.4,
    daysSinceLastPost: 20,
    photoRecencyDays: 45,
    reviewsRaw: [
      ...lines([...t.praise], 9),
      ...lines([...t.issueHeavy], 6),
    ],
  });
  await addSnapshot(clientId, {
    label: 'Check-in — this month',
    capturedAt: daysAgo(8),
    rating: 4.4,
    reviewCount: 118,
    unansweredCount: 9,
    reviewsPerWeek: 1.9,
    daysSinceLastPost: 6,
    photoRecencyDays: 12,
    reviewsRaw: [
      ...lines([...t.praise], 13),
      ...lines([...t.issueLight], 2),
    ],
  });

  await addMinute(
    clientId,
    'OWNER_CONVERSATION',
    'Owner happy with evening footfall',
    'Owner reports memberships up since the new timetable. Wants to keep the current trainer roster.',
    daysAgo(20),
  );

  // What the owner told Headway about the gym. The crowding question stays
  // unanswered on purpose, so the demo shows Headway asking.
  await addContext(clientId, {
    kind: 'OPERATING',
    text: 'Weekday evenings after 6pm are our busiest time; mornings are quiet',
    recordedAt: daysAgo(20),
  });
  await addContext(clientId, {
    kind: 'PRIORITY',
    text: 'Keep the trainer team stable and visible on the floor',
    themeKey: 'trainer_quality',
    recordedAt: daysAgo(20),
  });
}

/**
 * THE DEMO RESTAURANT.
 *
 * Seeded in the order it happened, so every date on the Improvements page is
 * honest: reviews, a check-in, more reviews, the conversation, the
 * suggestion, the decision, the change, the feedback that came after it, the
 * second check-in, the comparison. The intelligence at each step is computed
 * from what had arrived by then, which is what freezes the right baseline.
 */
async function seedCornerCafe(clientId: string, story: CornerCafeStory = CORNER_CAFE) {
  const vertical = story.vertical;

  // May and June: the public listing, pasted in as the operator found it.
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

  // Late June to late July.
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
  await addAnswer(clientId, owner.answer.themeKey, owner.answer.answer, at(owner.answer.at));
  await addMinute(clientId, 'FOLLOW_UP', owner.followUp.title, owner.followUp.body, at(owner.followUp.at));

  // After the change: the table card goes out, and the listing keeps filling.
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

async function seedSalon(clientId: string) {
  resetLines();
  const t = TEXT.salon;
  // A middling client: real praise, a booking problem that is holding steady.
  await addFeedback(
    clientId,
    [
      ...lines([...t.praise], 8),
      ...lines([...t.issueHeavy], 6),
    ],
    daysAgo(72),
    daysAgo(72),
  );
  await addFeedback(
    clientId,
    [...lines([...t.praise], 5), ...lines([...t.issueHeavy], 3)],
    daysAgo(9),
    daysAgo(9),
  );

  await addSnapshot(clientId, {
    label: 'Check-in — two months ago',
    capturedAt: daysAgo(66),
    rating: 4.3,
    reviewCount: 132,
    unansweredCount: 30,
    reviewsPerWeek: 1.7,
    daysSinceLastPost: 18,
    photoRecencyDays: 30,
    reviewsRaw: [
      ...lines([...t.praise], 10),
      ...lines([...t.issueHeavy], 5),
    ],
  });
  await addSnapshot(clientId, {
    label: 'Check-in — this month',
    capturedAt: daysAgo(7),
    rating: 4.2,
    reviewCount: 151,
    unansweredCount: 26,
    reviewsPerWeek: 1.8,
    daysSinceLastPost: 14,
    photoRecencyDays: 25,
    reviewsRaw: [
      ...lines([...t.praise], 10),
      ...lines([...t.issueHeavy], 5),
    ],
  });

  await addMinute(
    clientId,
    'DECISION',
    'Owner agreed to send booking confirmations',
    'Reception will send a same-day confirmation message for every booking taken by phone.',
    daysAgo(25),
  );

  await addContext(clientId, {
    kind: 'OPERATING',
    text: 'Most bookings come in by phone, and most of those in the evening',
    themeKey: 'appointment_scheduling',
    recordedAt: daysAgo(25),
  });
  await addContext(clientId, {
    kind: 'CONSTRAINT',
    text: 'We cannot add another stylist right now',
    constraintKey: 'STAFF',
    recordedAt: daysAgo(25),
  });
  await addAnswer(clientId, 'appointment_scheduling', 'Appointment cancelled or not confirmed', daysAgo(7));

  await addDirectFeedback(clientId, 'salon', [
    { text: 'Loved the haircut. Booking by phone took three tries though.', stars: 4, at: daysAgo(4) },
    { text: '', stars: 5, at: daysAgo(2) },
  ]);
}

async function seedClinic(clientId: string) {
  resetLines();
  // Already the richest client from earlier work. Only operational memory is
  // added, so its existing evidence and measured action stay exactly as they
  // are.
  await addMinute(
    clientId,
    'ACTION',
    'Published realistic slot lengths at reception',
    'Printed the expected wait for each appointment type and put it at the front desk.',
    daysAgo(15),
  );

  await addContext(clientId, {
    kind: 'PRIORITY',
    text: 'Patient waiting time — nobody should wait more than 15 minutes past their slot',
    themeKey: 'wait_time',
    recordedAt: daysAgo(15),
  });
  await addContext(clientId, {
    kind: 'OPERATING',
    text: 'One doctor covers all the evening appointments; mornings have two',
    themeKey: 'wait_time',
    recordedAt: daysAgo(15),
  });
}

// ---------------------------------------------------------------------------
// M11: an improvement loop, driven through the real state machine
// ---------------------------------------------------------------------------

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
    console.log('  · no attention insight yet, skipping the action loop');
    return null;
  }

  const created = await createActionFromInsight(db, clientId, insightId, {
    now: dates.suggestedAt,
  });
  if (!created.ok) {
    console.log(`  · action not created: ${created.message}`);
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
  console.log(`  · action measured: ${measured.data.measurement.result}`);

  await recordLearning(db, clientId, actionId, { note: learning }, { now: measuredAt });
}

// ---------------------------------------------------------------------------
// One client, end to end
// ---------------------------------------------------------------------------

async function seedClient(client: { id: string; businessName: string; vertical: string }) {
  console.log(`${client.businessName} (${client.vertical})`);
  if (client.vertical === 'gym') await seedGym(client.id);
  else if (client.vertical === 'restaurant') await seedCornerCafe(client.id);
  else if (client.vertical === 'salon') await seedSalon(client.id);
  else if (client.vertical === 'clinic') await seedClinic(client.id);
  else await seedGym(client.id);

  // Every demo business has its feedback QR ready, even before anything
  // has come in through it.
  await ensureGateway(db, client.id);

  // Snapshots capture their own reviews as feedback items, so a final read
  // pass runs after them — otherwise the freshly captured ones would sit
  // unread and every client would show a "still to read" backlog.
  await readAll(client.id);

  // M7: sort and draft, exactly as the operator would from the Feedback page.
  await triageClientFeedback(db, client.id, {});
  await draftClientReplies(db, client.id, { ...OFFLINE, limit: 60 });

  await printSummary(client);
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
  console.log(
    `  · feedback ${bySource.map((s) => `${s.source} ${s._count._all}`).join(', ')}` +
      ` (${unread} unread), check-ins ${snapshots}, minutes ${minutes}, context ${contextRows}`,
  );
  console.log(
    `  · read ${themes.analysedCount}; issues ${themes.issues.map((t) => `${t.key} ${t.count}`).join(', ')}`,
  );
  console.log(`  · praise ${themes.praises.map((t) => `${t.key} ${t.count}`).join(', ')}`);
  for (const d of themes.dimensions) {
    if (d.rated > 0) console.log(`  · rated ${d.key}: ${d.rated} answers, avg ${d.average}, ${d.low} at 3 or below`);
  }
  for (const a of actions) {
    const m = a.resultJson ? (JSON.parse(a.resultJson) as { before?: { line?: string }; after?: { line?: string } }) : null;
    console.log(
      `  · action ${a.themeLabel}: ${a.status}${a.result ? ` → ${a.result}` : ''} (baseline ${a.baselineCount} of ${a.baselineTotal}${
        m?.before?.line && m?.after?.line ? `; ${m.before.line} → ${m.after.line}` : ''
      })`,
    );
  }
}

// ---------------------------------------------------------------------------

type Options = { client: string | null; replace: boolean; yes: boolean; clear: boolean };

function options(argv: string[]): Options {
  const out: Options = { client: null, replace: false, yes: false, clear: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--clear') out.clear = true;
    else if (arg === '--replace') out.replace = true;
    else if (arg === '--yes') out.yes = true;
    else if (arg === '--client') {
      out.client = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return out;
}

async function seed() {
  if (existsSync(MANIFEST)) {
    console.log('A demo manifest already exists. Run with --clear first.');
    return;
  }

  const clients = await db.client.findMany({
    where: { archivedAt: null },
    select: { id: true, businessName: true, vertical: true },
    orderBy: { businessName: 'asc' },
  });

  if (clients.length === 0) {
    console.log('No clients in the database. Nothing to populate.');
    return;
  }

  console.log(`Populating ${clients.length} existing clients with demo data.\n`);

  for (const client of clients) await seedClient(client);

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(
    `\nDone. ${manifest.feedbackIds.length} feedback, ${manifest.snapshotIds.length} snapshots, ` +
      `${manifest.minuteIds.length} minutes, ${manifest.actionIds.length} actions, ` +
      `${manifest.contextIds.length} context lines.`,
  );
  console.log(`Manifest: ${MANIFEST}`);
  console.log(MARKER);
}

/**
 * Rebuild one client's story from scratch.
 *
 * For a wholly synthetic demo client. Says what it would remove, and removes
 * nothing without --yes. The client row, its memberships, its feedback page
 * and its printed QR token are never touched: a card already on a table has
 * to keep working.
 */
async function replaceClient(name: string, yes: boolean) {
  const client = await db.client.findFirst({
    where: { businessName: { equals: name, mode: 'insensitive' }, archivedAt: null },
    select: { id: true, businessName: true, vertical: true },
  });
  if (!client) {
    console.log(`No client named "${name}".`);
    process.exitCode = 1;
    return;
  }
  if (client.vertical !== 'restaurant') {
    console.log(`"${client.businessName}" is a ${client.vertical}; only the restaurant story can be rebuilt this way.`);
    process.exitCode = 1;
    return;
  }

  const where = { clientId: client.id };
  const [feedback, snapshots, actions, minutes, context] = await Promise.all([
    db.reviewItem.count({ where }),
    db.snapshot.count({ where }),
    db.improvementAction.count({ where }),
    db.minute.count({ where }),
    db.businessContext.count({ where }),
  ]);
  console.log(
    `${client.businessName} (${client.id}) holds ${feedback} feedback, ${snapshots} check-ins, ` +
      `${actions} improvements, ${minutes} minutes and ${context} context lines.`,
  );
  console.log(
    `Rebuilding replaces all of that with the ${storyFeedbackCount()} pieces of the Corner Cafe story.`,
  );
  if (!yes) {
    console.log('Dry run. Add --yes to do it.');
    return;
  }

  // Order matters only for the reader: nothing here references anything else
  // except improvements → minutes, which is a soft link.
  const removed = {
    actions: (await db.improvementAction.deleteMany({ where })).count,
    minutes: (await db.minute.deleteMany({ where })).count,
    context: (await db.businessContext.deleteMany({ where })).count,
    snapshots: (await db.snapshot.deleteMany({ where })).count,
    feedback: (await db.reviewItem.deleteMany({ where })).count,
  };
  console.log(
    `Removed ${removed.feedback} feedback, ${removed.snapshots} check-ins, ${removed.actions} improvements, ` +
      `${removed.minutes} minutes, ${removed.context} context lines.\n`,
  );

  await seedClient(client);
  console.log(`\nDone. ${client.businessName} now carries the Corner Cafe story.`);
  console.log(MARKER);
}

async function clear() {
  if (!existsSync(MANIFEST)) {
    console.log('No demo manifest found. Nothing to remove.');
    return;
  }
  const saved = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;

  const context = await db.businessContext.deleteMany({
    where: { id: { in: saved.contextIds ?? [] } },
  });
  const actions = await db.improvementAction.deleteMany({
    where: { id: { in: saved.actionIds } },
  });
  const minutes = await db.minute.deleteMany({ where: { id: { in: saved.minuteIds } } });
  // Snapshot delete cascades to the reviews captured inside it.
  const snapshots = await db.snapshot.deleteMany({
    where: { id: { in: saved.snapshotIds } },
  });
  const feedback = await db.reviewItem.deleteMany({
    where: { id: { in: saved.feedbackIds } },
  });

  rmSync(MANIFEST, { force: true });
  console.log(
    `Removed ${feedback.count} feedback, ${snapshots.count} snapshots, ` +
      `${minutes.count} minutes, ${actions.count} actions, ${context.count} context lines.`,
  );
  console.log('Data that existed before seeding was not touched.');
}

async function main() {
  const opts = options(process.argv.slice(2));
  try {
    if (opts.clear) await clear();
    else if (opts.client && opts.replace) await replaceClient(opts.client, opts.yes);
    else if (opts.client) {
      console.log('--client needs --replace: seeding a single client only works as a rebuild.');
      process.exitCode = 1;
    } else await seed();
  } finally {
    await db.$disconnect();
  }
}

void main();
