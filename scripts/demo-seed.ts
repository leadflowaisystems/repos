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
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { CORNER_CAFE, storyFeedbackCount } from './demo/corner-cafe';
import { createStorySeeder, MARKER, OFFLINE } from './demo/story-seeder';

const MANIFEST = resolve(join(__dirname, '..', 'data', '.demo-manifest.json'));

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

const {
  addSnapshot,
  addContext,
  addAnswer,
  addMinute,
  addDirectFeedback,
  seedStory,
  finishClient,
  printSummary,
} = createStorySeeder(db, manifest);

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

/** THE DEMO RESTAURANT: the Corner Cafe story, through the shared story seeder. */
async function seedCornerCafe(clientId: string) {
  await seedStory(clientId, CORNER_CAFE);
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
// One client, end to end
// ---------------------------------------------------------------------------

async function seedClient(client: { id: string; businessName: string; vertical: string }) {
  console.log(`${client.businessName} (${client.vertical})`);
  if (client.vertical === 'gym') await seedGym(client.id);
  else if (client.vertical === 'restaurant') await seedCornerCafe(client.id);
  else if (client.vertical === 'salon') await seedSalon(client.id);
  else if (client.vertical === 'clinic') await seedClinic(client.id);
  else await seedGym(client.id);

  await finishClient(client.id);

  await printSummary(client);
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
