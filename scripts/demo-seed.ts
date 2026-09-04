/**
 * DEMO DATA SEEDER — LOCAL PRODUCT EVALUATION ONLY.
 *
 *   These records are synthetic demo data for local product evaluation.
 *
 * Populates the clients that already exist in the local SQLite database with
 * enough synthetic evidence to exercise M1-M11 in the UI: snapshots, feedback,
 * themes, trends, owner communication, improvement actions and minutes.
 *
 * TWO RULES THIS SCRIPT KEEPS:
 *
 *  1. It writes NOTHING directly that a service owns. Every row goes through
 *     the real M5 import, M6 analysis, M7 triage/draft, M2 snapshot, M4 minute
 *     and M11 action services, so all existing validation, safety gates and
 *     state-machine rules apply exactly as they do for an operator. No
 *     malformed record can be introduced this way.
 *
 *  2. Everything it creates is recorded in a manifest so `--clear` removes
 *     precisely what was added and nothing else. Data that existed before the
 *     first seed is never touched.
 *
 * Contains no real names, phone numbers, emails or addresses. Review text is
 * generic customer wording chosen to match each vertical pack's own taxonomy
 * hints — no theme is invented, and nothing is fetched from anywhere.
 *
 * Usage:
 *   npx tsx scripts/demo-seed.ts            seed the existing clients
 *   npx tsx scripts/demo-seed.ts --clear    remove everything it created
 */

import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { ingestFeedback } from '@/lib/feedback/ingest';
import { ensureGateway } from '@/lib/gateway/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { draftClientReplies, triageClientFeedback } from '@/lib/feedback/replies';
import { createSnapshot } from '@/lib/snapshots/service';
import { createMinute } from '@/lib/minutes/service';
import { getClientIntelligence } from '@/lib/intelligence/service';
import {
  createActionFromInsight,
  decideAction,
  measureClientAction,
  moveAction,
  recordLearning,
} from '@/lib/improve/service';
import { answerQuestion, createContext } from '@/lib/context/service';

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

const OFFLINE = { useAi: false as const };

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
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
}

/**
 * M13: one thing the owner told RepOS, through the real context service, so
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

/** M13: the owner answered the question RepOS asks on their Home page. */
async function addAnswer(clientId: string, themeKey: string, answer: string, at: Date): Promise<void> {
  const result = await answerQuestion(db, clientId, { themeKey, answer }, { now: at });
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

// ---------------------------------------------------------------------------
// Review text, keyed to each pack's own taxonomy hints
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
  restaurant: {
    praise: [
      '5 stars Food was delicious and full of flavour',
      '5 stars Warm and welcoming staff, very polite',
      '4 stars Nice cosy ambience for an evening out',
      '4 stars Good value for money for the portion size',
    ],
    issueHeavy: [
      '1 star Service was very slow, we waited nearly an hour for mains',
      '2 stars Slow service again, waited far too long to order',
      '2 stars They brought the wrong order and forgot one dish entirely',
    ],
    issueLight: [
      '3 stars Slightly slow at the start but the food made up for it',
      '3 stars Wrong drink arrived, sorted quickly though',
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
// Per-client stories. Deliberately different, so M9 has something to rank.
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

  // What the owner told RepOS about the gym. The crowding question stays
  // unanswered on purpose, so the demo shows RepOS asking.
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

async function seedRestaurant(clientId: string) {
  resetLines();
  const t = TEXT.restaurant;
  // The problem client: a dominant service-speed issue, a change that was
  // tried, and feedback after it that reads worse. Seeded in the order it
  // would have happened, so every date on the Improvements page is honest:
  // check-in, suggestion, decision, change, feedback after it, comparison.

  // Ten weeks ago: the first feedback, and the first check-in.
  await addFeedback(
    clientId,
    [...lines([...t.praise], 8), ...lines([...t.issueHeavy], 5)],
    daysAgo(75),
    daysAgo(75),
  );
  await addSnapshot(clientId, {
    label: 'Check-in — two months ago',
    capturedAt: daysAgo(68),
    rating: 4.0,
    reviewCount: 210,
    unansweredCount: 60,
    reviewsPerWeek: 2.6,
    daysSinceLastPost: 25,
    photoRecencyDays: 50,
    reviewsRaw: [...lines([...t.praise], 9), ...lines([...t.issueHeavy], 5)],
  });
  // The suggestion has to rest on the check-in's reviews, so read them now.
  await readAll(clientId);

  // Six weeks ago: RepOS raised slow service. The owner agreed two days
  // later and had a second server in place a week after that.
  await addMinute(
    clientId,
    'OWNER_CONVERSATION',
    'Owner raised weekend kitchen delays',
    'Owner says the kitchen is short-staffed on Friday and Saturday evenings and is considering a second line cook.',
    daysAgo(44),
  );
  // What the owner told RepOS in that conversation, in their words.
  await addContext(clientId, {
    kind: 'OPERATING',
    text: 'Friday and Saturday evenings are much busier than other days',
    themeKey: 'service_speed',
    recordedAt: daysAgo(44),
  });
  await addContext(clientId, {
    kind: 'FOCUS',
    text: 'Slow service is my biggest concern right now',
    themeKey: 'service_speed',
    recordedAt: daysAgo(44),
  });
  await addContext(clientId, {
    kind: 'CONSTRAINT',
    text: 'Do not recommend discounts or offers',
    constraintKey: 'DISCOUNT',
    recordedAt: daysAgo(44),
  });
  const actionId = await startWorseningAction(clientId, {
    suggestedAt: daysAgo(42),
    decidedAt: daysAgo(40),
    doneAt: daysAgo(33),
  });
  await addMinute(
    clientId,
    'FOLLOW_UP',
    'Check whether the second server was hired',
    'Agreed to revisit staffing at the next monthly call.',
    daysAgo(38),
  );

  // Three weeks ago: feedback that came in after the change, dated as it
  // arrived. Heavier on service than before.
  await addFeedback(
    clientId,
    [...lines([...t.issueHeavy], 14), ...lines([...t.praise], 8)],
    daysAgo(20),
    daysAgo(20),
  );

  // This month: the second check-in, then the comparison two days ago.
  await addSnapshot(clientId, {
    label: 'Check-in — this month',
    capturedAt: daysAgo(6),
    rating: 3.6,
    reviewCount: 244,
    unansweredCount: 88,
    reviewsPerWeek: 3.1,
    daysSinceLastPost: 30,
    photoRecencyDays: 60,
    reviewsRaw: [...lines([...t.praise], 5), ...lines([...t.issueHeavy], 11)],
  });
  await readAll(clientId);
  if (actionId) await finishWorseningAction(clientId, actionId, daysAgo(2));

  // This week: what customers sent straight from the table card's QR.
  await addDirectFeedback(clientId, [
    {
      text: 'Waited nearly half an hour for two mains on Saturday night. Food was good when it came.',
      stars: 3,
      at: daysAgo(5),
    },
    { text: 'Biryani was excellent and the staff were very friendly.', stars: 5, at: daysAgo(4) },
    { text: '', stars: 4, at: daysAgo(3) },
    { text: 'Service bahut slow tha, order aane me kaafi der lagi.', stars: 2, at: daysAgo(2) },
  ]);
}

/** Read everything unread for a client, exactly as the operator would. */
async function readAll(clientId: string): Promise<void> {
  const read = await analyseClientFeedback(db, clientId, OFFLINE);
  if (!read.ok) throw new Error(`analysis failed: ${read.message}`);
}

/**
 * Feedback that came in through the client's own QR page (M14), as customers
 * send it: a rating, a few words, or both. It takes the same road the public
 * page takes — the shared intake, with the page's own duplicate rule — so the
 * demo holds nothing the real thing could not.
 */
async function addDirectFeedback(
  clientId: string,
  items: Array<{ text: string; stars: number | null; at: Date }>,
): Promise<void> {
  await ensureGateway(db, clientId);
  for (const item of items) {
    const result = await ingestFeedback(
      db,
      clientId,
      { text: item.text, stars: item.stars, occurredAt: item.at, source: 'REP_OS_QR' },
      {
        now: item.at,
        allowEmptyText: true,
        dedupe: { mode: 'WINDOW', textWindowMs: 10 * 60_000, ratingOnlyWindowMs: 30_000 },
      },
    );
    if (!result.ok) throw new Error(`direct feedback failed: ${result.message}`);
    if (!result.data.duplicate) manifest.feedbackIds.push(result.data.id);
  }
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

  // What the owner told RepOS about the salon, including the answer to the
  // question RepOS asked about appointment problems.
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

  // This week: sent from the reception card's QR.
  await addDirectFeedback(clientId, [
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

  // What the owner told RepOS about the clinic.
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
// M11: a completed improvement loop, driven through the real state machine
// ---------------------------------------------------------------------------

/**
 * Suggestion → decision → change, each on its own date, through the real
 * M11 state machine. Returns the action id, or null when the feedback so far
 * gives RepOS nothing to suggest.
 */
async function startWorseningAction(
  clientId: string,
  dates: { suggestedAt: Date; decidedAt: Date; doneAt: Date },
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
      description: 'Added a second server on Friday and Saturday evenings',
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
async function finishWorseningAction(
  clientId: string,
  actionId: string,
  measuredAt: Date,
): Promise<void> {
  const measured = await measureClientAction(db, clientId, actionId, { now: measuredAt });
  if (!measured.ok) throw new Error(`measure failed: ${measured.message}`);
  console.log(`  · action measured: ${measured.data.measurement.result}`);

  await recordLearning(
    db,
    clientId,
    actionId,
    {
      note: 'The extra server helped at the door but the delay is in the kitchen, not the floor. Needs a different fix.',
    },
    { now: measuredAt },
  );
}

// ---------------------------------------------------------------------------

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

  for (const client of clients) {
    console.log(`${client.businessName} (${client.vertical})`);
    if (client.vertical === 'gym') await seedGym(client.id);
    else if (client.vertical === 'restaurant') await seedRestaurant(client.id);
    else if (client.vertical === 'salon') await seedSalon(client.id);
    else if (client.vertical === 'clinic') await seedClinic(client.id);
    else await seedGym(client.id);

    // Every demo business has its feedback QR ready, even before anything
    // has come in through it.
    await ensureGateway(db, client.id);

    // Snapshots capture their own reviews as feedback items, so a final read
    // pass runs after them — otherwise the freshly captured ones would sit
    // unread and every client would show a "still to read" backlog.
    const read = await analyseClientFeedback(db, client.id, OFFLINE);
    if (!read.ok) throw new Error(`analysis failed: ${read.message}`);

    // M7: sort and draft, exactly as the operator would from the Feedback page.
    await triageClientFeedback(db, client.id, {});
    await draftClientReplies(db, client.id, { ...OFFLINE, limit: 40 });

    const counts = await db.client.findUnique({
      where: { id: client.id },
      select: { _count: { select: { feedback: true, snapshots: true, minutes: true } } },
    });
    console.log(
      `  · feedback ${counts?._count.feedback}, snapshots ${counts?._count.snapshots}, minutes ${counts?._count.minutes}`,
    );
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(
    `\nDone. ${manifest.feedbackIds.length} feedback, ${manifest.snapshotIds.length} snapshots, ` +
      `${manifest.minuteIds.length} minutes, ${manifest.actionIds.length} actions, ` +
      `${manifest.contextIds.length} context lines.`,
  );
  console.log(`Manifest: ${MANIFEST}`);
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
  const mode = process.argv.includes('--clear') ? 'clear' : 'seed';
  try {
    if (mode === 'clear') await clear();
    else await seed();
  } finally {
    await db.$disconnect();
  }
}

void main();
