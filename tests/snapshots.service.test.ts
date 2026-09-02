import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import {
  createSnapshot,
  deleteSnapshot,
  getClientHealth,
  getSnapshotDetail,
  listSnapshots,
  loadHealthSnapshots,
} from '@/lib/snapshots/service';
import { MIN_FEEDBACK_FOR_TREND_CLAIMS } from '@/lib/health/rules';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('snapshots-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const MARCH = new Date('2026-03-10T00:00:00.000Z');
const FEBRUARY = new Date('2026-02-10T00:00:00.000Z');
const NOW = new Date('2026-03-12T00:00:00.000Z');

async function makeClient(overrides: Record<string, unknown> = {}) {
  const result = await createClient(db, validClientInput(overrides));
  if (!result.ok) throw new Error(`client setup failed: ${result.message}`);
  return result.data.id;
}

function snapshotInput(overrides: Record<string, unknown> = {}) {
  return {
    label: 'March',
    capturedAt: MARCH,
    rating: 4.3,
    reviewCount: 180,
    unansweredCount: 12,
    daysSinceLastPost: 15,
    photoRecencyDays: 40,
    reviewsPerWeek: 1.5,
    profileGaps: ['hours_missing'],
    observationNotes: 'Checked the listing at 10am.',
    reviewsRaw: '',
    ...overrides,
  };
}

/** Builds a paste of n identical complaint lines plus m praise lines. */
function paste(complaints: number, praise: number): string {
  const lines: string[] = [];
  for (let i = 0; i < complaints; i += 1) {
    lines.push(`1 star The waiting time here was far too long today (${i})`);
  }
  for (let i = 0; i < praise; i += 1) {
    lines.push(`5 stars The doctor explained everything and the clinic was clean (${i})`);
  }
  return lines.join('\n');
}

const OFFLINE = { useAi: false as const, now: NOW };

// ---------------------------------------------------------------------------

describe('createSnapshot', () => {
  it('stores the observation and its feedback together', async () => {
    const clientId = await makeClient();
    const result = await createSnapshot(
      db,
      clientId,
      snapshotInput({ reviewsRaw: paste(4, 12) }),
      OFFLINE,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.parse.reviews).toHaveLength(16);
    expect(result.data.classifiedBy).toBe('KEYWORD');

    const row = await db.snapshot.findUniqueOrThrow({
      where: { id: result.data.id },
      include: { reviews: true },
    });
    expect(row.rating).toBe(4.3);
    expect(row.reviewCount).toBe(180);
    expect(row.unansweredCount).toBe(12);
    expect(row.reviews).toHaveLength(16);
    expect(row.isBaseline).toBe(true);
    expect(JSON.parse(row.profileGaps)).toEqual(['hours_missing']);
  });

  it('freezes the competitor values as they were at capture time', async () => {
    const clientId = await makeClient();
    await db.competitor.create({
      data: { clientId, name: 'Rival Clinic', rating: 4.6, reviewCount: 300, sortIndex: 0 },
    });

    const created = await createSnapshot(db, clientId, snapshotInput(), OFFLINE);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Later edits to the competitor must not rewrite history.
    await db.competitor.updateMany({ where: { clientId }, data: { rating: 3.0 } });

    const row = await db.snapshot.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(JSON.parse(row.competitorsJson)).toEqual([
      { name: 'Rival Clinic', rating: 4.6, reviewCount: 300 },
    ]);
  });

  it('stores a deterministic analysis alongside the snapshot', async () => {
    const clientId = await makeClient();
    const created = await createSnapshot(
      db,
      clientId,
      snapshotInput({ reviewsRaw: paste(5, 20) }),
      OFFLINE,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const detail = await getSnapshotDetail(db, clientId, created.data.id);
    expect(detail?.analysis?.totals.reviewsAnalysed).toBe(25);
    expect(detail?.analysis?.evidence.tier).toBe('STANDARD');
    expect(detail?.analysis?.issues.find((i) => i.key === 'wait_time')?.count).toBe(5);
    expect(detail?.narrativeSource).toBe('TEMPLATE');
    expect(detail?.narrative?.complaintSummary).toBeTruthy();
  });

  it('redacts PII before anything is written to the database', async () => {
    const clientId = await makeClient();
    const created = await createSnapshot(
      db,
      clientId,
      snapshotInput({
        reviewsRaw:
          'Rahul Sharma\n1 star Call me on 9876543210 or rahul@example.com, the wait was far too long',
      }),
      OFFLINE,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const reviews = await db.reviewItem.findMany();
    expect(reviews).toHaveLength(1);
    const stored = reviews[0]?.text ?? '';
    expect(stored).not.toContain('9876543210');
    expect(stored).not.toContain('rahul@example.com');
    expect(stored).not.toContain('Rahul');
    expect(reviews[0]?.redacted).toBe(true);
  });

  it('accepts an observation with no pasted feedback at all', async () => {
    const clientId = await makeClient();
    const created = await createSnapshot(db, clientId, snapshotInput(), OFFLINE);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await db.reviewItem.count()).toBe(0);
    const detail = await getSnapshotDetail(db, clientId, created.data.id);
    expect(detail?.analysis?.evidence.tier).toBe('INSUFFICIENT');
    expect(detail?.analysis?.dataGaps).toContain(
      'No reviews were pasted, so there is no Customer Pulse.',
    );
  });

  it('rejects an invalid observation date without writing anything', async () => {
    const clientId = await makeClient();
    const result = await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: new Date(Number.NaN) }),
      OFFLINE,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.capturedAt).toContain('valid');
    expect(await db.snapshot.count()).toBe(0);
  });

  it('rejects an out-of-range rating', async () => {
    const clientId = await makeClient();
    const result = await createSnapshot(db, clientId, snapshotInput({ rating: 9 }), OFFLINE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.rating).toContain('above 5');
    expect(await db.snapshot.count()).toBe(0);
  });

  it('reports an unknown client instead of throwing', async () => {
    const result = await createSnapshot(db, 'nope', snapshotInput(), OFFLINE);
    expect(result.ok).toBe(false);
  });

  it('marks only the first snapshot as the baseline', async () => {
    const clientId = await makeClient();
    await createSnapshot(db, clientId, snapshotInput({ capturedAt: FEBRUARY, label: 'Feb' }), OFFLINE);
    await createSnapshot(db, clientId, snapshotInput({ capturedAt: MARCH, label: 'March' }), OFFLINE);

    const rows = await db.snapshot.findMany({ orderBy: { capturedAt: 'asc' } });
    expect(rows.map((r) => r.isBaseline)).toEqual([true, false]);
  });

  it('compares against the previous snapshot when one exists', async () => {
    const clientId = await makeClient();
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: FEBRUARY, label: 'Feb', rating: 4.0, reviewsRaw: paste(8, 20) }),
      OFFLINE,
    );
    const march = await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: MARCH, label: 'March', rating: 4.3, reviewsRaw: paste(3, 25) }),
      OFFLINE,
    );
    expect(march.ok).toBe(true);
    if (!march.ok) return;

    const detail = await getSnapshotDetail(db, clientId, march.data.id);
    expect(detail?.analysis?.comparison?.previousLabel).toBe('Feb');
    expect(
      detail?.analysis?.comparison?.metrics.find((m) => m.key === 'rating')?.delta,
    ).toBeCloseTo(0.3, 2);
  });
});

describe('snapshot retrieval', () => {
  it('lists snapshots newest first with their feedback counts', async () => {
    const clientId = await makeClient();
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: FEBRUARY, label: 'Feb', reviewsRaw: paste(1, 2) }),
      OFFLINE,
    );
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: MARCH, label: 'March', reviewsRaw: paste(2, 3) }),
      OFFLINE,
    );

    const rows = await listSnapshots(db, clientId);
    expect(rows.map((r) => r.label)).toEqual(['March', 'Feb']);
    expect(rows.map((r) => r.feedbackCount)).toEqual([5, 3]);
  });

  it('returns null for a snapshot belonging to another client', async () => {
    const a = await makeClient();
    const b = await makeClient({ businessName: 'Other Clinic' });
    const created = await createSnapshot(db, a, snapshotInput(), OFFLINE);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await getSnapshotDetail(db, b, created.data.id)).toBeNull();
  });

  it('deletes a snapshot and its stored feedback', async () => {
    const clientId = await makeClient();
    const created = await createSnapshot(
      db,
      clientId,
      snapshotInput({ reviewsRaw: paste(2, 2) }),
      OFFLINE,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(await db.reviewItem.count()).toBe(4);

    const removed = await deleteSnapshot(db, clientId, created.data.id);
    expect(removed.ok).toBe(true);
    expect(await db.snapshot.count()).toBe(0);
    expect(await db.reviewItem.count()).toBe(0);
  });

  it('refuses to delete a snapshot belonging to another client', async () => {
    const a = await makeClient();
    const b = await makeClient({ businessName: 'Other Clinic' });
    const created = await createSnapshot(db, a, snapshotInput(), OFFLINE);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect((await deleteSnapshot(db, b, created.data.id)).ok).toBe(false);
    expect(await db.snapshot.count()).toBe(1);
  });
});

describe('health computed from stored rows', () => {
  it('reports insufficient data for a client with no snapshots', async () => {
    const clientId = await makeClient();
    const health = await getClientHealth(db, clientId, 'clinic', NOW);
    expect(health.card.status).toBe('INSUFFICIENT_DATA');
    expect(health.pulse.available).toBe(false);
    expect(health.card.coverage.snapshotCount).toBe(0);
  });

  it('round-trips stored feedback into the health engine', async () => {
    const clientId = await makeClient();
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ reviewsRaw: paste(4, 8) }),
      OFFLINE,
    );

    const snapshots = await loadHealthSnapshots(db, clientId);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.feedback).toHaveLength(12);
    expect(
      snapshots[0]?.feedback.filter((f) => f.issueTags.includes('wait_time')),
    ).toHaveLength(4);

    const health = await getClientHealth(db, clientId, 'clinic', NOW);
    expect(health.card.distribution.total).toBe(12);
    expect(health.card.distribution.counts.NEGATIVE).toBe(4);
    expect(health.card.topIssues[0]?.key).toBe('wait_time');
    expect(health.card.status).toBe('ATTENTION');
  });

  it('produces a pulse once two snapshots exist', async () => {
    const clientId = await makeClient();
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: FEBRUARY, label: 'Feb', rating: 4.0, reviewsRaw: paste(8, 14) }),
      OFFLINE,
    );
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: MARCH, label: 'March', rating: 4.4, reviewsRaw: paste(2, 20) }),
      OFFLINE,
    );

    const health = await getClientHealth(db, clientId, 'clinic', NOW);
    expect(health.pulse.available).toBe(true);
    expect(health.pulse.current?.label).toBe('March');
    expect(health.pulse.previous?.label).toBe('Feb');
    expect(health.pulse.periodDays).toBe(28);
    expect(health.pulse.direction).toBe('IMPROVING');
    expect(health.pulse.sampleWarning).toBeNull();

    const waitChange = health.pulse.notableChanges.find((c) => c.key === 'wait_time');
    expect(waitChange).toMatchObject({ previous: 8, current: 2, delta: -6 });
  });

  it('warns rather than claiming a trend when a period is tiny', async () => {
    const clientId = await makeClient();
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: FEBRUARY, label: 'Feb', reviewsRaw: paste(1, 1) }),
      OFFLINE,
    );
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: MARCH, label: 'March', reviewsRaw: paste(2, 1) }),
      OFFLINE,
    );

    const health = await getClientHealth(db, clientId, 'clinic', NOW);
    expect(health.pulse.sampleWarning).toContain(String(MIN_FEEDBACK_FOR_TREND_CLAIMS));
    expect(
      health.pulse.metrics.find((m) => m.key === 'negativeShare')?.contributes,
    ).toBe(false);
  });

  it('is stable across repeated reads of the same stored data', async () => {
    const clientId = await makeClient();
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: FEBRUARY, label: 'Feb', reviewsRaw: paste(6, 15) }),
      OFFLINE,
    );
    await createSnapshot(
      db,
      clientId,
      snapshotInput({ capturedAt: MARCH, label: 'March', reviewsRaw: paste(3, 18) }),
      OFFLINE,
    );

    const first = await getClientHealth(db, clientId, 'clinic', NOW);
    const second = await getClientHealth(db, clientId, 'clinic', NOW);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('keeps each client health independent', async () => {
    const a = await makeClient({ businessName: 'Clinic A' });
    const b = await makeClient({ businessName: 'Clinic B' });
    await createSnapshot(db, a, snapshotInput({ reviewsRaw: paste(6, 6) }), OFFLINE);

    expect((await getClientHealth(db, a, 'clinic', NOW)).card.distribution.total).toBe(12);
    expect((await getClientHealth(db, b, 'clinic', NOW)).card.status).toBe(
      'INSUFFICIENT_DATA',
    );
  });
});
