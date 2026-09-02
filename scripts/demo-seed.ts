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

const MANIFEST = resolve(join(__dirname, '..', 'data', '.demo-manifest.json'));

const MARKER = 'Synthetic demo data for local product evaluation.';

type Manifest = {
  createdAt: string;
  note: string;
  feedbackIds: string[];
  snapshotIds: string[];
  minuteIds: string[];
  actionIds: string[];
};

const db = new PrismaClient();

const manifest: Manifest = {
  createdAt: new Date().toISOString(),
  note: MARKER,
  feedbackIds: [],
  snapshotIds: [],
  minuteIds: [],
  actionIds: [],
};

const OFFLINE = { useAi: false as const };

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

/** Every review line is unique per client, so the duplicate guard never trips. */
function lines(templates: string[], count: number, tag: string): string[] {
  return Array.from(
    { length: count },
    (_, i) => `${templates[i % templates.length]} (${tag}${i + 1})`,
  );
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
  const t = TEXT.gym;
  // A healthy client: strong praise, one modest issue that is easing.
  await addFeedback(
    clientId,
    [
      ...lines([...t.praise], 12, 'g-old-p'),
      ...lines([...t.issueHeavy], 6, 'g-old-i'),
    ],
    daysAgo(70),
    daysAgo(70),
  );
  await addFeedback(
    clientId,
    [...lines([...t.praise], 10, 'g-new-p'), ...lines([...t.issueLight], 2, 'g-new-i')],
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
      ...lines([...t.praise], 9, 'g-s1-p'),
      ...lines([...t.issueHeavy], 6, 'g-s1-i'),
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
      ...lines([...t.praise], 13, 'g-s2-p'),
      ...lines([...t.issueLight], 2, 'g-s2-i'),
    ],
  });

  await addMinute(
    clientId,
    'OWNER_CONVERSATION',
    'Owner happy with evening footfall',
    'Owner reports memberships up since the new timetable. Wants to keep the current trainer roster.',
    daysAgo(20),
  );
}

async function seedRestaurant(clientId: string) {
  const t = TEXT.restaurant;
  // The problem client: a dominant, worsening service-speed issue.
  await addFeedback(
    clientId,
    [
      ...lines([...t.praise], 8, 'r-old-p'),
      ...lines([...t.issueHeavy], 5, 'r-old-i'),
    ],
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
    reviewsRaw: [
      ...lines([...t.praise], 9, 'r-s1-p'),
      ...lines([...t.issueHeavy], 5, 'r-s1-i'),
    ],
  });
  await addSnapshot(clientId, {
    label: 'Check-in — this month',
    capturedAt: daysAgo(6),
    rating: 3.6,
    reviewCount: 244,
    unansweredCount: 88,
    reviewsPerWeek: 3.1,
    daysSinceLastPost: 30,
    photoRecencyDays: 60,
    reviewsRaw: [
      ...lines([...t.praise], 5, 'r-s2-p'),
      ...lines([...t.issueHeavy], 11, 'r-s2-i'),
    ],
  });

  await addMinute(
    clientId,
    'OWNER_CONVERSATION',
    'Owner raised weekend kitchen delays',
    'Owner says the kitchen is short-staffed on Friday and Saturday evenings and is considering a second line cook.',
    daysAgo(30),
  );
  await addMinute(
    clientId,
    'FOLLOW_UP',
    'Check whether the second server was hired',
    'Agreed to revisit staffing at the next monthly call.',
    daysAgo(12),
  );
}

async function seedSalon(clientId: string) {
  const t = TEXT.salon;
  // A middling client: real praise, a booking problem that is holding steady.
  await addFeedback(
    clientId,
    [
      ...lines([...t.praise], 8, 's-old-p'),
      ...lines([...t.issueHeavy], 6, 's-old-i'),
    ],
    daysAgo(72),
    daysAgo(72),
  );
  await addFeedback(
    clientId,
    [...lines([...t.praise], 5, 's-new-p'), ...lines([...t.issueHeavy], 3, 's-new-i')],
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
      ...lines([...t.praise], 10, 's-s1-p'),
      ...lines([...t.issueHeavy], 5, 's-s1-i'),
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
      ...lines([...t.praise], 10, 's-s2-p'),
      ...lines([...t.issueHeavy], 5, 's-s2-i'),
    ],
  });

  await addMinute(
    clientId,
    'DECISION',
    'Owner agreed to send booking confirmations',
    'Reception will send a same-day confirmation message for every booking taken by phone.',
    daysAgo(25),
  );
}

async function seedClinic(clientId: string) {
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
}

// ---------------------------------------------------------------------------
// M11: a completed improvement loop, driven through the real state machine
// ---------------------------------------------------------------------------

async function seedWorseningAction(clientId: string) {
  const intel = await getClientIntelligence(db, clientId);
  const insightId = intel?.attention?.id;
  if (!insightId) {
    console.log('  · no attention insight yet, skipping the action loop');
    return;
  }

  const created = await createActionFromInsight(db, clientId, insightId);
  if (!created.ok) {
    console.log(`  · action not created: ${created.message}`);
    return;
  }
  manifest.actionIds.push(created.data.id);

  const decided = await decideAction(db, clientId, created.data.id, {
    decision: 'ACCEPT',
    description: 'Added a second server on Friday and Saturday evenings',
    statusNote: '',
    recordMinute: true,
  });
  if (!decided.ok) throw new Error(`decide failed: ${decided.message}`);

  // Accepting an action writes a DECISION minute through the M4 service, so
  // its id has to be picked up from the row — otherwise --clear would leave
  // that one minute behind.
  const withMinute = await db.improvementAction.findUnique({
    where: { id: created.data.id },
    select: { minuteId: true },
  });
  if (withMinute?.minuteId) manifest.minuteIds.push(withMinute.minuteId);

  const done = await moveAction(db, clientId, created.data.id, {
    to: 'DONE',
    note: '',
    occurredAt: new Date(),
  });
  if (!done.ok) throw new Error(`done failed: ${done.message}`);

  // Feedback collected since the change. Left undated so it carries today's
  // arrival time, which is what puts it after the change in the comparison.
  const t = TEXT.restaurant;
  await addFeedback(
    clientId,
    [
      ...lines([...t.issueHeavy], 14, 'r-after-i'),
      ...lines([...t.praise], 8, 'r-after-p'),
    ],
    new Date(),
    null,
  );

  const measured = await measureClientAction(db, clientId, created.data.id);
  if (!measured.ok) throw new Error(`measure failed: ${measured.message}`);
  console.log(`  · action measured: ${measured.data.measurement.result}`);

  await recordLearning(db, clientId, created.data.id, {
    note: 'The extra server helped at the door but the delay is in the kitchen, not the floor. Needs a different fix.',
  });
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

  // One worsening improvement loop, on the restaurant.
  const restaurant = clients.find((c) => c.vertical === 'restaurant');
  if (restaurant) {
    console.log(`\nImprovement loop for ${restaurant.businessName}`);
    await seedWorseningAction(restaurant.id);
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(
    `\nDone. ${manifest.feedbackIds.length} feedback, ${manifest.snapshotIds.length} snapshots, ` +
      `${manifest.minuteIds.length} minutes, ${manifest.actionIds.length} actions.`,
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
      `${minutes.count} minutes, ${actions.count} actions.`,
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
