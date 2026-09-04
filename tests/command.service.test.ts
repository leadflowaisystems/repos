import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient, archiveClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { draftClientReplies, triageClientFeedback } from '@/lib/feedback/replies';
import { createMinute } from '@/lib/minutes/service';
import { getBoard } from '@/lib/command/board';
import { getOwnerComms } from '@/lib/comms/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('command-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');
const NOW = new Date('2026-03-16T00:00:00.000Z');
const OFFLINE = { useAi: false as const, now: NOW };

async function makeClient(businessName: string, vertical = 'clinic') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

async function importOnly(clientId: string, raw: string) {
  const result = await importFeedbackBatch(db, clientId, {
    raw,
    source: 'PUBLIC_REVIEW',
    referenceDate: REF,
  });
  if (!result.ok) throw new Error(`import failed: ${result.message}`);
}

async function readAndSort(clientId: string) {
  const analysis = await analyseClientFeedback(db, clientId, OFFLINE);
  if (!analysis.ok) throw new Error('analysis failed');
  const triage = await triageClientFeedback(db, clientId, { now: NOW });
  if (!triage.ok) throw new Error('triage failed');
}

/** A clinic with a clear, repeated waiting-time complaint. */
function troubledBatch(): string {
  const blocks: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    blocks.push('1 star', `Waited over an hour past my appointment time (${i}).`, '');
  }
  for (let i = 0; i < 5; i += 1) {
    blocks.push('5 stars', `Doctor explained everything clearly (${i}).`, '');
  }
  blocks.push('1 star', 'I got an infection after the procedure and want my money back.');
  return blocks.join('\n');
}

function calmBatch(): string {
  const blocks: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    blocks.push('5 stars', `Doctor explained everything clearly and it was clean (${i}).`, '');
  }
  return blocks.join('\n');
}

function cardFor(board: Awaited<ReturnType<typeof getBoard>>, name: string) {
  const card = board.cards.find((c) => c.businessName === name);
  if (!card) throw new Error(`no card for ${name}`);
  return card;
}

// ---------------------------------------------------------------------------

describe('the board answers who needs the operator', () => {
  it('puts the client with real problems above the calm one', async () => {
    const troubled = await makeClient('Trouble Clinic');
    const calm = await makeClient('Calm Clinic');
    await importOnly(troubled, troubledBatch());
    await importOnly(calm, calmBatch());
    await readAndSort(troubled);
    await readAndSort(calm);

    const board = await getBoard(db, NOW);
    expect(board.cards[0]?.businessName).toBe('Trouble Clinic');
    expect(cardFor(board, 'Trouble Clinic').rank).toBeGreaterThan(
      cardFor(board, 'Calm Clinic').rank,
    );
  });

  it('says why, in words the operator can read', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);

    const card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');
    expect(card.reasons.length).toBeGreaterThan(0);
    expect(card.reasons.join(' ')).toMatch(/waiting time|your own words|reply/i);
    // Every reason maps to a signal, and the rank is their sum.
    expect(card.reasons.length).toBe(card.signals.length);
    expect(card.rank).toBe(card.signals.reduce((sum, s) => sum + s.weight, 0));
  });

  it('names the biggest complaint with its count and the pack advice', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);

    const card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');
    expect(card.topIssue?.key).toBe('wait_time');
    expect(card.topIssue?.count).toBeGreaterThanOrEqual(3);
    expect(card.recommendation).toBeTruthy();
  });

  it('offers a next action that exists', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());

    // Nothing read yet, so reading must come first.
    let card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');
    expect(card.nextAction.key).toBe('READ_FEEDBACK');
    expect(card.nextAction.href).toBe(`/clients/${clientId}/feedback`);

    await readAndSort(clientId);
    card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');
    expect(card.nextAction.key).toBe('HANDLE_YOURSELF');
    expect(card.nextAction.href).toContain('action=NEEDS_HUMAN');
  });

  it('deep-links to the owner update the communication layer already prepares', async () => {
    const clientId = await makeClient('Calm Clinic');
    await importOnly(clientId, calmBatch());
    await readAndSort(clientId);
    await draftClientReplies(db, clientId, OFFLINE);

    const card = cardFor(await getBoard(db, NOW), 'Calm Clinic');
    expect(card.ownerUpdateReady).toBe(true);

    // And that panel really does have something to show.
    const comms = await getOwnerComms(db, clientId, { now: NOW });
    expect(comms.ok).toBe(true);
    if (!comms.ok) return;
    expect(comms.data.messages.length).toBe(3);
  });

  it('surfaces recorded memory without inventing a task list', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);
    await createMinute(db, clientId, {
      occurredAt: new Date('2026-02-01T09:00:00.000Z'),
      title: 'Owner to review peak-hour staffing',
      body: 'Agreed on the call.',
      category: 'FOLLOW_UP',
    });

    const card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');
    expect(card.memory.lastFollowUpTitle).toBe('Owner to review peak-hour staffing');
    expect(card.memory.lastNoteCategory).toBe('Follow-up');
    expect(card.reasons.join(' ')).toMatch(/noted/i);
    expect(card.reasons.join(' ')).not.toMatch(/overdue|outstanding|unresolved/i);
  });

  it('reports the change the pulse engine reported, not its own arithmetic', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);

    const card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');
    // One period only, so there is nothing to compare and nothing is claimed.
    expect(card.change).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('low-data clients are handled honestly', () => {
  it('does not look broken for a brand new client', async () => {
    const clientId = await makeClient('Brand New Clinic');

    const card = cardFor(await getBoard(db, NOW), 'Brand New Clinic');
    expect(card.lowData?.missing).toBe('No feedback yet');
    expect(card.lowData?.why).toMatch(/nothing to read/i);
    // Get the QR onto the counter, not "paste the reviews you have collected"
    // — a business with no public listing has none to paste (M17).
    expect(card.nextAction.key).toBe('PRINT_CARDS');
    expect(card.nextAction.href).toBe(`/clients/${clientId}/kit`);
    expect(card.topIssue).toBeNull();
    expect(card.change).toBeNull();
    expect(card.recommendation).toBeNull();
  });

  it('stops asking for the cards once they are on site', async () => {
    const clientId = await makeClient('Carded Clinic');
    await db.client.update({
      where: { id: clientId },
      data: { kitInstalledDate: new Date('2026-03-01T00:00:00.000Z') },
    });

    const card = cardFor(await getBoard(db, NOW), 'Carded Clinic');
    expect(card.nextAction.key).toBe('ADD_FEEDBACK');
  });

  it('says so when a client’s feedback page is switched off', async () => {
    const clientId = await makeClient('Paused Clinic');
    await db.feedbackGateway.update({
      where: { clientId },
      data: { enabled: false },
    });

    const card = cardFor(await getBoard(db, NOW), 'Paused Clinic');
    expect(card.nextAction.key).toBe('RESUME_FEEDBACK');
    expect(card.reasons.join(' ')).toMatch(/paused/i);
  });

  it('says what is missing when nothing has been read', async () => {
    const clientId = await makeClient('Unread Clinic');
    await importOnly(clientId, calmBatch());

    const card = cardFor(await getBoard(db, NOW), 'Unread Clinic');
    expect(card.lowData?.missing).toBe('Nothing read yet');
    expect(card.nextAction.key).toBe('READ_FEEDBACK');
  });

  it('refuses to name a theme below the floor', async () => {
    const clientId = await makeClient('Thin Clinic');
    await importOnly(clientId, '1 star\nWaited a long time past my appointment.');
    await readAndSort(clientId);

    const card = cardFor(await getBoard(db, NOW), 'Thin Clinic');
    expect(card.topIssue).toBeNull();
    expect(card.lowData?.missing).toBe('Too little to judge');
    expect(card.lowData?.why).toMatch(/3 times/);
  });

  it('says a snapshot is missing without calling the client low-data', async () => {
    const clientId = await makeClient('No Snapshot Clinic');
    await importOnly(clientId, calmBatch());
    await readAndSort(clientId);

    const card = cardFor(await getBoard(db, NOW), 'No Snapshot Clinic');
    // Plenty of feedback, just nothing to compare against. A warning box here
    // would contradict the named praise and counts on the same card.
    expect(card.lowData).toBeNull();
    expect(card.change).toBeNull();
    expect(card.reasons.join(' ')).toMatch(/no snapshot taken yet/i);
  });

  it('never fabricates an insight for a client with nothing', async () => {
    await makeClient('Empty Clinic');
    const card = cardFor(await getBoard(db, NOW), 'Empty Clinic');

    const serialised = JSON.stringify(card);
    expect(card.topIssue).toBeNull();
    expect(card.recommendation).toBeNull();
    expect(card.change).toBeNull();
    expect(card.memory.lastNoteAt).toBeNull();
    expect(card.lastActivityAt).toBeNull();
    // No count anywhere claims data that does not exist.
    expect(serialised).not.toMatch(/"count":[1-9]/);
  });
});

// ---------------------------------------------------------------------------

describe('the board covers every vertical and keeps clients apart', () => {
  it('works across clinic, salon and restaurant in one call', async () => {
    const clinic = await makeClient('Sunrise Dental', 'clinic');
    const salon = await makeClient('Glow Salon', 'salon');
    const restaurant = await makeClient('Corner Cafe', 'restaurant');

    for (const id of [clinic, salon, restaurant]) {
      const blocks: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        blocks.push('1 star', `Waited far too long, over an hour again (${i}).`, '');
      }
      await importOnly(id, blocks.join('\n'));
      await readAndSort(id);
    }

    const board = await getBoard(db, NOW);
    expect(board.cards.length).toBe(3);

    for (const name of ['Sunrise Dental', 'Glow Salon', 'Corner Cafe']) {
      const card = cardFor(board, name);
      expect(card.verticalLabel.length).toBeGreaterThan(0);
      expect(card.topIssue).not.toBeNull();
      // Advice comes from that trade's own pack.
      expect(card.recommendation).toBeTruthy();
    }

    // Each trade gets its own wording, not a shared generic line.
    const advice = new Set(
      ['Sunrise Dental', 'Glow Salon', 'Corner Cafe'].map(
        (name) => cardFor(board, name).recommendation,
      ),
    );
    expect(advice.size).toBe(3);
  });

  it('never mixes one client feedback into another card', async () => {
    const a = await makeClient('Clinic A');
    const b = await makeClient('Clinic B');
    await importOnly(a, troubledBatch());
    await importOnly(b, '5 stars\nParking was easy and everything was fine.');
    await readAndSort(a);
    await readAndSort(b);

    const board = await getBoard(db, NOW);
    const cardA = cardFor(board, 'Clinic A');
    const cardB = cardFor(board, 'Clinic B');

    expect(cardA.feedback.total).toBe(13);
    expect(cardB.feedback.total).toBe(1);
    expect(cardA.topIssue?.key).toBe('wait_time');
    expect(cardB.topIssue).toBeNull();
  });

  it('leaves archived clients off the board', async () => {
    const active = await makeClient('Active Clinic');
    const gone = await makeClient('Archived Clinic');
    await importOnly(active, calmBatch());
    await archiveClient(db, gone);

    const board = await getBoard(db, NOW);
    expect(board.cards.map((c) => c.businessName)).toEqual(['Active Clinic']);
    expect(board.totals.clients).toBe(1);
  });

  it('adds up the queues across every client', async () => {
    const a = await makeClient('Clinic A');
    const b = await makeClient('Clinic B');
    await importOnly(a, troubledBatch());
    await importOnly(b, calmBatch());

    let board = await getBoard(db, NOW);
    expect(board.totals.unreadFeedback).toBe(25);

    await readAndSort(a);
    await readAndSort(b);
    board = await getBoard(db, NOW);
    expect(board.totals.unreadFeedback).toBe(0);
    expect(board.totals.awaitingDraft).toBeGreaterThan(0);
    expect(board.totals.needsYou).toBe(1);
  });

  it('returns an empty board rather than failing when there are no clients', async () => {
    const board = await getBoard(db, NOW);
    expect(board.cards).toEqual([]);
    expect(board.totals.clients).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('the board composes the existing engines rather than replacing them', () => {
  it('changes nothing it reads', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);
    await draftClientReplies(db, clientId, OFFLINE);

    const before = await db.reviewItem.findMany({
      where: { clientId },
      orderBy: { id: 'asc' },
    });
    const minutesBefore = await db.minute.count();

    await getBoard(db, NOW);

    const after = await db.reviewItem.findMany({
      where: { clientId },
      orderBy: { id: 'asc' },
    });
    expect(after).toEqual(before);
    expect(await db.minute.count()).toBe(minutesBefore);
  });

  it('agrees with the reply layer about what is waiting', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);

    const { getReplyCoverage } = await import('@/lib/feedback/replies');
    const coverage = await getReplyCoverage(db, clientId);
    const card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');

    expect(card.feedback.awaitingDraft).toBe(coverage.awaitingDraft);
    expect(card.feedback.needsYou).toBe(coverage.needsYou);
    expect(card.feedback.draftsReady).toBe(coverage.drafted);
  });

  it('agrees with the health engine about status', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);

    const { getClientHealth } = await import('@/lib/snapshots/service');
    const health = await getClientHealth(db, clientId, 'clinic', NOW);
    const card = cardFor(await getBoard(db, NOW), 'Trouble Clinic');

    expect(card.status).toBe(health.card.status);
    expect(card.statusLabel).toBe(health.card.statusLabel);
    expect(card.topSignal).toBe(health.card.signals[0]?.detail ?? null);
  });

  it('is deterministic for the same stored rows', async () => {
    const clientId = await makeClient('Trouble Clinic');
    await importOnly(clientId, troubledBatch());
    await readAndSort(clientId);

    const first = await getBoard(db, NOW);
    const second = await getBoard(db, NOW);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
