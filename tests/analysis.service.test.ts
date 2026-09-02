import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch, listClientFeedback } from '@/lib/feedback/service';
import {
  analyseClientFeedback,
  getAnalysisCoverage,
  getThemeEvidence,
  getThemeSummary,
} from '@/lib/feedback/analysis';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('analysis-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');
const NOW = new Date('2026-03-16T00:00:00.000Z');

/** Every run in this file stays offline, so results are fully deterministic. */
const OFFLINE = { useAi: false as const, now: NOW };

async function makeClient(businessName = 'Sunrise Clinic', vertical = 'clinic') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

async function seed(clientId: string, raw: string) {
  const result = await importFeedbackBatch(db, clientId, {
    raw,
    source: 'PUBLIC_REVIEW',
    referenceDate: REF,
  });
  if (!result.ok) throw new Error(`import failed: ${result.message}`);
  return result.data;
}

const CLINIC_BATCH = [
  '5 stars',
  'Doctor explained everything clearly and the clinic was very clean.',
  '',
  '1 star',
  'Waited over an hour and reception was rude when I asked.',
  '',
  '4 stars',
  'Doctor was very kind but I waited 45 minutes past my appointment.',
  '',
  'डॉक्टर छान आहेत पण खूप उशीर झाला',
  '',
  'Went there on Tuesday',
].join('\n');

// ---------------------------------------------------------------------------

describe('analysing a client feedback set', () => {
  it('reads every stored item and marks them analysed', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);

    const result = await analyseClientFeedback(db, clientId, OFFLINE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.considered).toBe(5);
    expect(result.data.analysed).toBe(5);
    expect(result.data.needsRetry).toBe(0);
    expect(result.data.usedAi).toBe(false);

    const rows = await db.reviewItem.findMany({ where: { clientId } });
    expect(rows.every((r) => r.analysisStatus === 'ANALYSED')).toBe(true);
    expect(rows.every((r) => r.analysedAt !== null)).toBe(true);
    expect(rows.every((r) => r.analysisVersion === ANALYSIS_VERSION)).toBe(true);
    expect(rows.every((r) => r.sentiment !== 'UNCLASSIFIED')).toBe(true);
  });

  it('never modifies the original feedback text', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);

    const before = (await listClientFeedback(db, clientId)).map((r) => r.text).sort();
    await analyseClientFeedback(db, clientId, OFFLINE);
    const after = (await listClientFeedback(db, clientId)).map((r) => r.text).sort();

    expect(after).toEqual(before);
  });

  it('assigns a sentiment that is not simply the star rating', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const rows = await listClientFeedback(db, clientId);
    const mixed = rows.find((r) => r.text.includes('kind but I waited'));
    const item = await db.reviewItem.findUniqueOrThrow({ where: { id: mixed?.id } });
    // 4 stars, but it contains a complaint — so it is Mixed, not Positive.
    expect(item.stars).toBe(4);
    expect(item.sentiment).toBe('MIXED');
  });

  it('records language, themes, confidence and reasons', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const marathi = await db.reviewItem.findFirstOrThrow({
      where: { clientId, text: { contains: 'डॉक्टर' } },
    });
    expect(marathi.language).toBe('mr');
    expect(JSON.parse(marathi.themesJson).length).toBeGreaterThan(0);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(marathi.confidence);
    expect(JSON.parse(marathi.analysisReasonsJson).length).toBeGreaterThan(0);
  });

  it('gives each theme its own sentiment on the stored row', async () => {
    const clientId = await makeClient();
    await seed(
      clientId,
      'Doctor explained everything clearly but I waited 45 minutes at reception',
    );
    await analyseClientFeedback(db, clientId, OFFLINE);

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    const themes = JSON.parse(row.themesJson) as Array<{
      key: string;
      kind: string;
      sentiment: string;
    }>;

    expect(themes.find((t) => t.key === 'doctor_care')).toMatchObject({
      kind: 'PRAISE',
      sentiment: 'POSITIVE',
    });
    expect(themes.find((t) => t.key === 'wait_time')).toMatchObject({
      kind: 'ISSUE',
      sentiment: 'NEGATIVE',
    });
  });

  it('reports an unknown client instead of throwing', async () => {
    expect((await analyseClientFeedback(db, 'nope', OFFLINE)).ok).toBe(false);
  });

  it('handles a client with no feedback at all', async () => {
    const clientId = await makeClient();
    const result = await analyseClientFeedback(db, clientId, OFFLINE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.analysed).toBe(0);
    expect(result.data.notes.join(' ')).toContain('no feedback');
  });
});

// ---------------------------------------------------------------------------

describe('idempotency and versioning', () => {
  it('does not re-analyse items already on the current version', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);

    const first = await analyseClientFeedback(db, clientId, OFFLINE);
    expect(first.ok && first.data.analysed).toBe(5);

    const second = await analyseClientFeedback(db, clientId, OFFLINE);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.analysed).toBe(0);
    expect(second.data.skippedUpToDate).toBe(5);
  });

  it('re-analyses everything when the operator forces it', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const forced = await analyseClientFeedback(db, clientId, { ...OFFLINE, force: true });
    expect(forced.ok && forced.data.analysed).toBe(5);
  });

  it('picks up items left on an older engine version', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    // Simulate a taxonomy or prompt improvement shipping.
    await db.reviewItem.updateMany({
      where: { clientId },
      data: { analysisVersion: ANALYSIS_VERSION - 1 },
    });

    const rerun = await analyseClientFeedback(db, clientId, OFFLINE);
    expect(rerun.ok && rerun.data.analysed).toBe(5);
    expect(rerun.ok && rerun.data.skippedUpToDate).toBe(0);
  });

  it('produces identical results on a forced re-run', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const snapshot = async () =>
      (
        await db.reviewItem.findMany({
          where: { clientId },
          orderBy: { sortIndex: 'asc' },
          select: { sentiment: true, themesJson: true, confidence: true, language: true },
        })
      ).map((r) => JSON.stringify(r));

    const before = await snapshot();
    await analyseClientFeedback(db, clientId, { ...OFFLINE, force: true });
    expect(await snapshot()).toEqual(before);
  });

  it('honours a batch limit so one run stays bounded', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);

    const result = await analyseClientFeedback(db, clientId, { ...OFFLINE, limit: 2 });
    expect(result.ok && result.data.analysed).toBe(2);

    const coverage = await getAnalysisCoverage(db, clientId);
    expect(coverage.analysed).toBe(2);
    expect(coverage.needsAnalysis).toBe(3);
  });
});

// ---------------------------------------------------------------------------

describe('failure handling', () => {
  it('keeps successful work when an individual item fails', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);

    const rows = await db.reviewItem.findMany({
      where: { clientId },
      orderBy: { sortIndex: 'asc' },
      select: { id: true },
    });
    const doomedId = rows[2]?.id as string;

    // Make exactly one update fail, leaving the others untouched.
    const realUpdate = db.reviewItem.update.bind(db.reviewItem);
    let failedOnce = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.reviewItem as any).update = async (args: any) => {
      if (args?.where?.id === doomedId && args?.data?.analysisStatus === 'ANALYSED') {
        failedOnce = true;
        throw new Error('simulated write failure');
      }
      return realUpdate(args);
    };

    let result;
    try {
      result = await analyseClientFeedback(db, clientId, OFFLINE);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db.reviewItem as any).update = realUpdate;
    }

    expect(failedOnce).toBe(true);
    expect(result?.ok).toBe(true);
    if (!result?.ok) return;

    // The other four are analysed and are NOT rolled back.
    expect(result.data.analysed).toBe(4);
    expect(result.data.needsRetry).toBe(1);

    const coverage = await getAnalysisCoverage(db, clientId);
    expect(coverage.analysed).toBe(4);
    expect(coverage.failed).toBe(1);

    // The failed item keeps its original text, ready to retry.
    const failed = await db.reviewItem.findUniqueOrThrow({ where: { id: doomedId } });
    expect(failed.analysisStatus).toBe('FAILED');
    expect(failed.analysisError).toContain('simulated write failure');
    expect(failed.text.length).toBeGreaterThan(0);
  });

  it('retries only the failed item on the next run', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const target = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    await db.reviewItem.update({
      where: { id: target.id },
      data: { analysisStatus: 'FAILED', analysisError: 'earlier failure' },
    });

    const retry = await analyseClientFeedback(db, clientId, OFFLINE);
    expect(retry.ok && retry.data.analysed).toBe(1);
    expect(retry.ok && retry.data.skippedUpToDate).toBe(4);

    const healed = await db.reviewItem.findUniqueOrThrow({ where: { id: target.id } });
    expect(healed.analysisStatus).toBe('ANALYSED');
    expect(healed.analysisError).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('AI is optional and never destructive', () => {
  it('analyses everything with no API key configured', async () => {
    const previous = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const clientId = await makeClient();
      await seed(clientId, CLINIC_BATCH);

      // useAi left unset, so it falls through to the real provider check.
      const result = await analyseClientFeedback(db, clientId, { now: NOW });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.analysed).toBe(5);
      expect(result.data.usedAi).toBe(false);
      expect(result.data.needsRetry).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previous;
    }
  });

  it('never records a provider name when no provider was used', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const rows = await db.reviewItem.findMany({ where: { clientId } });
    expect(rows.every((r) => r.classifiedBy === 'KEYWORD')).toBe(true);
    expect(rows.every((r) => r.classifierModel === null)).toBe(true);
  });

  it('leaks no secret into anything the operator can see', async () => {
    const previous = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'super-secret-test-key';
    try {
      const clientId = await makeClient();
      await seed(clientId, CLINIC_BATCH);
      const result = await analyseClientFeedback(db, clientId, OFFLINE);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(JSON.stringify(result.data)).not.toContain('super-secret-test-key');

      const rows = await db.reviewItem.findMany({ where: { clientId } });
      expect(JSON.stringify(rows)).not.toContain('super-secret-test-key');
    } finally {
      if (previous === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previous;
    }
  });
});

// ---------------------------------------------------------------------------

describe('coverage', () => {
  it('reports nothing read yet before analysis', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);

    const coverage = await getAnalysisCoverage(db, clientId);
    expect(coverage.total).toBe(5);
    expect(coverage.analysed).toBe(0);
    expect(coverage.needsAnalysis).toBe(5);
    expect(coverage.upToDate).toBe(false);
  });

  it('reports full coverage and a sentiment breakdown after analysis', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const coverage = await getAnalysisCoverage(db, clientId);
    expect(coverage.analysed).toBe(5);
    expect(coverage.needsAnalysis).toBe(0);
    expect(coverage.upToDate).toBe(true);

    const total = Object.values(coverage.sentimentCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
    expect(coverage.sentimentCounts.POSITIVE).toBeGreaterThan(0);
    expect(coverage.sentimentCounts.MIXED).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe('themes and evidence', () => {
  it('counts what customers are happy and unhappy about, separately', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const summary = await getThemeSummary(db, clientId, 'clinic');
    expect(summary.praises.length).toBeGreaterThan(0);
    expect(summary.issues.length).toBeGreaterThan(0);

    const wait = summary.issues.find((t) => t.key === 'wait_time');
    expect(wait?.count).toBeGreaterThanOrEqual(2);
    expect(wait?.kind).toBe('ISSUE');
    expect(wait?.severity).toBe('high');
  });

  it('carries the evidence trail on every count', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const summary = await getThemeSummary(db, clientId, 'clinic');
    for (const row of [...summary.praises, ...summary.issues]) {
      expect(row.itemIds.length, row.key).toBe(row.count);
      expect(new Set(row.itemIds).size, row.key).toBe(row.count);
    }
  });

  it('answers "show me the reviews behind this"', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    const evidence = await getThemeEvidence(db, clientId, 'wait_time');
    expect(evidence.length).toBeGreaterThanOrEqual(2);
    for (const item of evidence) {
      expect(item.text.length).toBeGreaterThan(0);
      expect(item.id).toBeTruthy();
    }

    const summary = await getThemeSummary(db, clientId, 'clinic');
    const wait = summary.issues.find((t) => t.key === 'wait_time');
    expect(evidence.map((e) => e.id).sort()).toEqual([...(wait?.itemIds ?? [])].sort());
  });

  it('returns nothing for a theme nobody mentioned', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    await analyseClientFeedback(db, clientId, OFFLINE);

    expect(await getThemeEvidence(db, clientId, 'parking_access')).toEqual([]);
  });

  it('keeps themes and evidence scoped to one client', async () => {
    const a = await makeClient('Clinic A', 'clinic');
    const b = await makeClient('Clinic B', 'clinic');
    await seed(a, CLINIC_BATCH);
    await seed(b, '5 stars\nCompletely different feedback about parking being hard');

    await analyseClientFeedback(db, a, OFFLINE);
    await analyseClientFeedback(db, b, OFFLINE);

    const forA = await getThemeSummary(db, a, 'clinic');
    const forB = await getThemeSummary(db, b, 'clinic');
    const idsA = new Set(forA.issues.flatMap((t) => t.itemIds));
    const idsB = new Set(forB.issues.flatMap((t) => t.itemIds));

    for (const id of idsA) expect(idsB.has(id)).toBe(false);
    expect((await getThemeEvidence(db, b, 'wait_time')).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('the same engine works across verticals', () => {
  const CASES = [
    {
      vertical: 'salon',
      name: 'Glow Salon',
      raw: [
        '5 stars',
        'Lovely haircut and the stylist listened to what I wanted.',
        '',
        '2 stars',
        'They charged me more than the price quoted at the start.',
      ].join('\n'),
      expectIssue: 'pricing_transparency',
    },
    {
      vertical: 'restaurant',
      name: 'Corner Cafe',
      raw: [
        '5 stars',
        'The food was excellent but the service was very slow.',
        '',
        '1 star',
        'Table was dirty and the waiter was rude.',
      ].join('\n'),
      expectIssue: 'service_speed',
    },
    {
      vertical: 'clinic',
      name: 'Sunrise Clinic',
      raw: CLINIC_BATCH,
      expectIssue: 'wait_time',
    },
  ];

  it('analyses every vertical through the same service call', async () => {
    for (const spec of CASES) {
      await resetDb(db);
      const clientId = await makeClient(spec.name, spec.vertical);
      await seed(clientId, spec.raw);

      const result = await analyseClientFeedback(db, clientId, OFFLINE);
      expect(result.ok, spec.vertical).toBe(true);
      if (!result.ok) return;
      expect(result.data.needsRetry, spec.vertical).toBe(0);

      const coverage = await getAnalysisCoverage(db, clientId);
      expect(coverage.upToDate, spec.vertical).toBe(true);

      const summary = await getThemeSummary(db, clientId, spec.vertical);
      const keys = summary.issues.map((t) => t.key);
      expect(keys, spec.vertical).toContain(spec.expectIssue);
    }
  });

  it('gives each vertical its own themes, not a shared generic set', async () => {
    const found: Record<string, string[]> = {};
    for (const spec of CASES) {
      await resetDb(db);
      const clientId = await makeClient(spec.name, spec.vertical);
      await seed(clientId, spec.raw);
      await analyseClientFeedback(db, clientId, OFFLINE);
      const summary = await getThemeSummary(db, clientId, spec.vertical);
      found[spec.vertical] = summary.issues.map((t) => t.key);
    }

    expect(found.restaurant).toContain('service_speed');
    expect(found.restaurant).not.toContain('wait_time');
    expect(found.clinic).toContain('wait_time');
    expect(found.salon).toContain('pricing_transparency');
  });
});
