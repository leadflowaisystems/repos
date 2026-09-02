import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { createMinute } from '@/lib/minutes/service';
import { createSnapshot } from '@/lib/snapshots/service';
import { getClientIntelligence } from '@/lib/intelligence/service';
import { INTELLIGENCE_VERSION } from '@/lib/intelligence/engine';
import { getOwnerComms } from '@/lib/comms/service';
import { getBoard } from '@/lib/command/board';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('intelligence-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');
const FEBRUARY = new Date('2026-02-10T00:00:00.000Z');
const MARCH = new Date('2026-03-12T00:00:00.000Z');
const NOW = new Date('2026-03-16T00:00:00.000Z');
const OFFLINE = { useAi: false as const, now: NOW };

async function makeClient(businessName: string, vertical = 'clinic') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

/** Import a paste and read it, which is what the operator actually does. */
async function addAndRead(clientId: string, raw: string) {
  const imported = await importFeedbackBatch(db, clientId, {
    raw,
    source: 'PUBLIC_REVIEW',
    referenceDate: REF,
  });
  if (!imported.ok) throw new Error(`import failed: ${imported.message}`);
  const analysed = await analyseClientFeedback(db, clientId, OFFLINE);
  if (!analysed.ok) throw new Error('analysis failed');
}

function waitingBatch(complaints: number, praise: number, tag = ''): string {
  const lines: string[] = [];
  for (let i = 0; i < complaints; i += 1) {
    lines.push(`1 star Waited over an hour past my appointment time (${tag}${i})`);
  }
  for (let i = 0; i < praise; i += 1) {
    lines.push(`5 stars The doctor explained everything clearly (${tag}${i})`);
  }
  return lines.join('\n');
}

function salonBatch(): string {
  const lines: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    lines.push(`1 star The haircut was not what I asked for at all (${i})`);
  }
  for (let i = 0; i < 6; i += 1) {
    lines.push(`5 stars The stylist was friendly and the salon was spotless (${i})`);
  }
  return lines.join('\n');
}

async function intelligenceFor(clientId: string) {
  const intel = await getClientIntelligence(db, clientId, { now: NOW });
  if (!intel) throw new Error('no intelligence for that client');
  return intel;
}

// ---------------------------------------------------------------------------

describe('intelligence built from the operator\'s own stored feedback', () => {
  it('names what customers keep saying, with the reviews behind it', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await addAndRead(id, waitingBatch(7, 6));

    const intel = await intelligenceFor(id);

    expect(intel.attention).not.toBeNull();
    expect(intel.attention?.evidence.count).toBeGreaterThanOrEqual(3);
    expect(intel.loved.length).toBeGreaterThan(0);
    expect(intel.version).toBe(INTELLIGENCE_VERSION);

    // Every id on an insight is a real feedback row belonging to this client.
    const ids = intel.attention?.evidence.itemIds ?? [];
    expect(ids.length).toBe(intel.attention?.evidence.count);
    const rows = await db.reviewItem.findMany({
      where: { id: { in: ids } },
      select: { clientId: true },
    });
    expect(rows.length).toBe(ids.length);
    expect(rows.every((row) => row.clientId === id)).toBe(true);
  });

  it('says nothing at all for a client with no feedback', async () => {
    const id = await makeClient('FitZone Gym', 'gym');
    const intel = await intelligenceFor(id);

    expect(intel.headline).toEqual([]);
    expect(intel.attention).toBeNull();
    expect(intel.loved).toEqual([]);
    expect(intel.unhappy).toEqual([]);
    expect(intel.changing).toEqual([]);
    expect(intel.overallTrend).toBe('INSUFFICIENT_DATA');
    expect(intel.limits.join(' ')).toMatch(/no feedback has been read yet/i);
  });

  it('refuses to name a pattern from two or three pieces of feedback', async () => {
    const id = await makeClient('Corner Cafe', 'restaurant');
    await addAndRead(id, '1 star The food was cold when it arrived (1)');

    const intel = await intelligenceFor(id);
    expect(intel.headline).toEqual([]);
    expect(intel.evidence.enough).toBe(false);
    expect(intel.limits.length).toBeGreaterThan(0);
  });

  it('returns nothing for a client that does not exist', async () => {
    expect(await getClientIntelligence(db, 'nope', { now: NOW })).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('one client can never see another client\'s customers', () => {
  it('keeps themes, counts and evidence entirely separate', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    const salon = await makeClient('Glow Salon & Spa', 'salon');

    await addAndRead(clinic, waitingBatch(7, 6, 'c'));
    await addAndRead(salon, salonBatch());

    const clinicIntel = await intelligenceFor(clinic);
    const salonIntel = await intelligenceFor(salon);

    expect(clinicIntel.clientId).toBe(clinic);
    expect(salonIntel.clientId).toBe(salon);

    const clinicIds = new Set(
      [...clinicIntel.loved, ...clinicIntel.unhappy].flatMap((i) => i.evidence.itemIds),
    );
    const salonIds = new Set(
      [...salonIntel.loved, ...salonIntel.unhappy].flatMap((i) => i.evidence.itemIds),
    );
    expect(clinicIds.size).toBeGreaterThan(0);
    expect(salonIds.size).toBeGreaterThan(0);
    for (const id of salonIds) expect(clinicIds.has(id)).toBe(false);

    // The counts are each client's own, not the pile.
    expect(clinicIntel.evidence.analysed).toBe(13);
    expect(salonIntel.evidence.analysed).toBe(12);

    // And nothing carries the other client's id.
    for (const insight of [...salonIntel.loved, ...salonIntel.unhappy]) {
      expect(insight.clientId).toBe(salon);
      expect(insight.id.startsWith(`${salon}:`)).toBe(true);
    }
  });

  it('does not let a second client change the first one\'s verdict', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    await addAndRead(clinic, waitingBatch(7, 6, 'c'));
    const before = await intelligenceFor(clinic);

    const other = await makeClient('Glow Salon & Spa', 'salon');
    await addAndRead(other, salonBatch());
    const after = await intelligenceFor(clinic);

    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------

describe('trends only appear once there are two check-ins', () => {
  async function snapshot(clientId: string, label: string, capturedAt: Date, raw: string) {
    const result = await createSnapshot(
      db,
      clientId,
      {
        label,
        capturedAt,
        rating: 4.2,
        reviewCount: 120,
        unansweredCount: 10,
        daysSinceLastPost: 12,
        photoRecencyDays: 30,
        reviewsPerWeek: 1.5,
        profileGaps: [],
        observationNotes: '',
        reviewsRaw: raw,
      },
      OFFLINE,
    );
    if (!result.ok) throw new Error(`snapshot failed: ${result.message}`);
  }

  it('says so honestly when there is only one snapshot', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await addAndRead(id, waitingBatch(7, 6));
    await snapshot(id, 'March', MARCH, waitingBatch(5, 5));

    const intel = await intelligenceFor(id);
    expect(intel.window.available).toBe(false);
    expect(intel.overallTrend).toBe('INSUFFICIENT_DATA');
    expect(intel.changing).toEqual([]);
    expect(intel.window.reason.length).toBeGreaterThan(0);
  });

  it('compares the two check-ins by name once both exist', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await addAndRead(id, waitingBatch(7, 6));
    await snapshot(id, 'February', FEBRUARY, waitingBatch(8, 4, 'f'));
    await snapshot(id, 'March', MARCH, waitingBatch(1, 10, 'm'));

    const intel = await intelligenceFor(id);

    expect(intel.window.available).toBe(true);
    expect(intel.window.previousLabel).toBe('February');
    expect(intel.window.currentLabel).toBe('March');
    expect(intel.window.previousSnapshotId).not.toBe(intel.window.currentSnapshotId);
    expect(intel.window.note).toContain('February');
    expect(intel.window.note).toContain('March');

    // The complaint fell away between the two, and it is reported as such.
    const change = intel.changing.find((i) => i.sentiment === 'ISSUE');
    expect(change?.movement.state).toBe('IMPROVING');
    expect(change?.movement.note).toContain('February');
    expect(change?.movement.note).toContain('March');
  });
});

// ---------------------------------------------------------------------------

describe('operator minutes are context, never customer evidence', () => {
  it('shows them apart from anything a customer said', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await addAndRead(id, waitingBatch(7, 6));
    const minute = await createMinute(db, id, {
      title: 'Owner agreed to add a second chair on Saturdays',
      body: 'Discussed the waiting time complaints with the owner.',
      category: 'DECISION',
      occurredAt: new Date('2026-03-01T00:00:00.000Z'),
      minutesSpent: 20,
    });
    if (!minute.ok) throw new Error(`minute failed: ${minute.message}`);

    const intel = await intelligenceFor(id);

    expect(intel.contextNotes.length).toBe(1);
    expect(intel.contextNotes[0]?.source).toBe('OPERATOR_NOTE');

    const evidenceIds = new Set(
      [...intel.loved, ...intel.unhappy].flatMap((i) => i.evidence.itemIds),
    );
    expect(evidenceIds.has(minute.data.id)).toBe(false);
    expect(JSON.stringify(intel.headline)).not.toContain('second chair');
  });
});

// ---------------------------------------------------------------------------

describe('every screen tells the same story', () => {
  it('gives the owner update and the panel the same top issue', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await addAndRead(id, waitingBatch(7, 6));

    const intel = await intelligenceFor(id);
    const comms = await getOwnerComms(db, id, { now: NOW });
    if (!comms.ok) throw new Error('comms failed');

    expect(comms.data.intelligence.attention?.themeKey).toBe(intel.attention?.themeKey);
    expect(comms.data.insight.topIssue?.key).toBe(intel.attention?.themeKey);
    expect(comms.data.insight.topIssue?.count).toBe(intel.attention?.evidence.count);
    expect(comms.data.insight.recommendation?.action).toBe(intel.attention?.recommendation);
  });

  it('gives the command centre the same top issue as the client page', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await addAndRead(id, waitingBatch(7, 6));

    const intel = await intelligenceFor(id);
    const board = await getBoard(db, NOW);
    const card = board.cards.find((c) => c.clientId === id);

    expect(card?.topIssue?.key).toBe(intel.attention?.themeKey);
    expect(card?.topIssue?.count).toBe(intel.attention?.evidence.count);
    expect(card?.recommendation).toBe(intel.attention?.recommendation);
  });

  it('only offers an owner update when there is something to say in it', async () => {
    const rich = await makeClient('Sunrise Dental Clinic');
    await addAndRead(rich, waitingBatch(7, 6, 'r'));

    // Four pieces of feedback: real, but nothing repeated three times.
    const thin = await makeClient('Corner Cafe', 'restaurant');
    await addAndRead(
      thin,
      [
        '5 stars The coffee was excellent today',
        '4 stars Nice place to sit and work',
        '2 stars The music was far too loud',
        '5 stars Staff remembered my order',
      ].join('\n'),
    );

    const board = await getBoard(db, NOW);
    const richCard = board.cards.find((c) => c.clientId === rich);
    const thinCard = board.cards.find((c) => c.clientId === thin);

    expect((await intelligenceFor(thin)).headline).toEqual([]);
    expect(richCard?.ownerUpdateReady).toBe(true);
    // Sending the operator to copy "nothing is coming up often enough yet"
    // would be a dead end, so the board does not offer it.
    expect(thinCard?.ownerUpdateReady).toBe(false);
    expect(thinCard?.nextAction.key).not.toBe('PREPARE_OWNER_UPDATE');
  });

  it('never writes anything: intelligence is derived, not stored', async () => {
    const id = await makeClient('Sunrise Dental Clinic');
    await addAndRead(id, waitingBatch(7, 6));

    const before = await db.reviewItem.findMany({ orderBy: { id: 'asc' } });
    await intelligenceFor(id);
    await intelligenceFor(id);
    const after = await db.reviewItem.findMany({ orderBy: { id: 'asc' } });

    expect(after).toEqual(before);
    expect(await db.minute.count()).toBe(0);
  });
});
