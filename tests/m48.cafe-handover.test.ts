import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { analyseClientFeedback, getThemeSummary } from '@/lib/feedback/analysis';
import { prepareIngest } from '@/lib/feedback/ingest';
import { analysedRows, loadFeedbackLedger } from '@/lib/feedback/ledger';
import { ANALYSIS_VERSION, normalizeFeedback } from '@/lib/analysis/normalize';
import { redactPii } from '@/lib/redact';
import {
  SAVE_FAILED_MESSAGE,
  _resetGatewayThrottles,
  ensureGateway,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { measureAction, type MeasurableRow } from '@/lib/improve/measure';
import { getPackOrFallback } from '@/lib/packs';
import { runInRequestScope } from '@/lib/request-cache';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * M48 — THE PRODUCTION DEFECTS THE CAFÉ HANDOVER AUDIT FOUND, PINNED FIXED.
 *
 *   1. One definition of "read": a row an older reader read is not read
 *      evidence until it is read again — on every surface.
 *   2. New feedback is read before the re-read backlog of an upgrade.
 *   3. A before/after comparison never reports a change in the reader as a
 *      change in the café ("served cold" was split out of "food & taste").
 *   4. A customer's first line ("Cappuccino") and clock times survive.
 *   5. A failed save can be sent again; a different response from the same
 *      page is not swallowed as a duplicate.
 */

const pack = getPackOrFallback('restaurant');
const NOW = new Date('2026-10-01T10:00:00.000Z');

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m48-cafe-handover');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
});

async function makeCafe(): Promise<string> {
  const result = await createClient(db, validClientInput({ businessName: 'QA Café', vertical: 'restaurant' }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

async function addRow(clientId: string, text: string, sortIndex: number, read: { version: number } | null) {
  const n = normalizeFeedback({ text, stars: null, pack, ai: null });
  return db.reviewItem.create({
    data: {
      clientId,
      text,
      source: 'REP_OS_QR',
      sortIndex,
      createdAt: new Date(NOW.getTime() - (100 - sortIndex) * 60_000),
      ...(read
        ? {
            analysisStatus: 'ANALYSED',
            analysisVersion: read.version,
            sentiment: n.sentiment,
            issueTags: JSON.stringify(n.issueTags),
            praiseTags: JSON.stringify(n.praiseTags),
            themesJson: JSON.stringify(n.themes),
            analysedAt: NOW,
          }
        : {}),
    },
  });
}

describe('one definition of read', () => {
  it('a row an older reader read is waiting, not read evidence', async () => {
    const clientId = await makeCafe();
    await addRow(clientId, 'The coffee was lukewarm.', 0, { version: ANALYSIS_VERSION - 1 });
    await addRow(clientId, 'The coffee was lukewarm.', 1, { version: ANALYSIS_VERSION });
    const ledger = await runInRequestScope(() => loadFeedbackLedger(db, clientId));
    expect(analysedRows(ledger)).toHaveLength(1);
    expect(analysedRows(ledger)[0]!.analysisVersion).toBe(ANALYSIS_VERSION);
    const summary = await runInRequestScope(() => getThemeSummary(db, clientId, 'restaurant'));
    expect(summary.analysedCount).toBe(1);
    expect(summary.issues.find((t) => t.key === 'served_cold')?.count).toBe(1);
  });
});

describe('new feedback is read before the re-read backlog', () => {
  it('a customer response from a minute ago is read in the first run after an upgrade, however long the backlog', async () => {
    const clientId = await makeCafe();
    for (let i = 0; i < 12; i += 1) await addRow(clientId, `Great coffee, visit ${i}.`, i, { version: ANALYSIS_VERSION - 1 });
    const fresh = await addRow(clientId, 'The sandwich was stale and the coffee was cold.', 12, null);

    const run = await analyseClientFeedback(db, clientId, { useAi: false, now: NOW, limit: 1 });
    expect(run.ok).toBe(true);
    const row = await db.reviewItem.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(row.analysisStatus).toBe('ANALYSED');
    expect(JSON.parse(row.issueTags)).toEqual(expect.arrayContaining(['food_quality', 'served_cold']));
  });

  it('the post-upgrade catch-up re-reads old rows only, and leaves never-read feedback to the pipeline', async () => {
    const clientId = await makeCafe();
    for (let i = 0; i < 5; i += 1) await addRow(clientId, `The coffee was cold, visit ${i}.`, i, { version: ANALYSIS_VERSION - 1 });
    const fresh = await addRow(clientId, 'Lovely filter coffee.', 5, null);
    const run = await analyseClientFeedback(db, clientId, { useAi: false, onlyReRead: true, now: NOW, limit: 200 });
    expect(run.ok && run.data.analysed).toBe(5);
    expect((await db.reviewItem.findUniqueOrThrow({ where: { id: fresh.id } })).analysisStatus).toBe('PENDING');
    const stale = await db.reviewItem.count({ where: { clientId, analysisVersion: { lt: ANALYSIS_VERSION } } });
    expect(stale).toBe(1); // the never-read row, still at version 0
  });

  it('re-reads clear the backlog in a few runs, deterministically', async () => {
    const clientId = await makeCafe();
    for (let i = 0; i < 12; i += 1) await addRow(clientId, `The coffee was cold, visit ${i}.`, i, { version: ANALYSIS_VERSION - 1 });
    await analyseClientFeedback(db, clientId, { useAi: false, now: NOW, limit: 3 });
    const left = await db.reviewItem.count({ where: { clientId, analysisVersion: { lt: ANALYSIS_VERSION } } });
    expect(left).toBe(0);
  });
});

describe('a before/after never reports a change in the reader as a change in the café', () => {
  const cold = (id: string, at: Date): MeasurableRow => ({
    id,
    themesJson: JSON.stringify(normalizeFeedback({ text: 'The food was cold when it arrived.', stars: 2, pack, ai: null }).themes),
    analysisStatus: 'ANALYSED',
    analysisVersion: ANALYSIS_VERSION,
    evidenceAt: at,
  });
  const praise = (id: string, at: Date): MeasurableRow => ({
    id,
    themesJson: JSON.stringify(normalizeFeedback({ text: 'Lovely staff and great coffee.', stars: 5, pack, ai: null }).themes),
    analysisStatus: 'ANALYSED',
    analysisVersion: ANALYSIS_VERSION,
    evidenceAt: at,
  });
  const capturedAt = new Date('2026-08-01T00:00:00.000Z');
  const doneAt = new Date('2026-08-05T00:00:00.000Z');
  const before = (i: number) => new Date(capturedAt.getTime() - (i + 1) * 3_600_000);
  const after = (i: number) => new Date(doneAt.getTime() + (i + 1) * 3_600_000);

  it('a baseline frozen as "food & taste" under the old reader, the same complaints now read as "served cold": not IMPROVED', () => {
    // Before: 8 of 20 said the food was cold; the old reader filed it as food_quality.
    const beforeRows = [...Array.from({ length: 8 }, (_, i) => cold(`b${i}`, before(i))), ...Array.from({ length: 12 }, (_, i) => praise(`bp${i}`, before(8 + i)))];
    const afterRows = [...Array.from({ length: 8 }, (_, i) => cold(`a${i}`, after(i))), ...Array.from({ length: 12 }, (_, i) => praise(`ap${i}`, after(8 + i)))];
    const m = measureAction({
      pack,
      themeKey: 'food_quality',
      themeLabel: 'Food & taste',
      sentiment: 'ISSUE',
      baseline: {
        count: 8,
        total: 20,
        itemIds: Array.from({ length: 8 }, (_, i) => `b${i}`),
        confidence: 'MODERATE',
        capturedAt,
        snapshotId: null,
        snapshotLabel: null,
      },
      doneAt,
      rows: [...beforeRows, ...afterRows],
      now: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(m.result).not.toBe('IMPROVED');
    expect(m.before.count).toBe(0);
  });

  it('a baseline the current reader agrees with is kept exactly as frozen', () => {
    const rows = [...Array.from({ length: 8 }, (_, i) => cold(`b${i}`, before(i))), ...Array.from({ length: 12 }, (_, i) => praise(`bp${i}`, before(8 + i))), ...Array.from({ length: 20 }, (_, i) => praise(`ap${i}`, after(i)))];
    const m = measureAction({
      pack,
      themeKey: 'served_cold',
      themeLabel: 'Served cold / not hot',
      sentiment: 'ISSUE',
      baseline: { count: 8, total: 20, itemIds: Array.from({ length: 8 }, (_, i) => `b${i}`), confidence: 'MODERATE', capturedAt, snapshotId: null, snapshotLabel: null },
      doneAt,
      rows,
      now: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(m.before.count).toBe(8);
    expect(m.before.total).toBe(20);
    expect(m.result).toBe('IMPROVED');
  });
});

describe("a customer's words survive the cleaning", () => {
  it('a first line that is just the dish is kept on a QR response', () => {
    const r = prepareIngest({ text: 'Cappuccino\nperfect as always', stars: 5, source: 'REP_OS_QR', occurredAt: NOW }, { now: NOW, allowEmptyText: true });
    expect(r.ok && r.data.text).toBe('Cappuccino\nperfect as always');
  });

  it('clock times are evidence, not identifiers; a phone number still goes', () => {
    expect(redactPii('Waited from 10.30 - 11.15 for a table').text).toBe('Waited from 10.30 - 11.15 for a table');
    expect(redactPii('Call me on 98765 43210').text).toContain('[number removed]');
  });
});

describe('a response is never silently dropped', () => {
  async function gatewayFor(clientId: string): Promise<string> {
    const g = await ensureGateway(db, clientId);
    if (!g) throw new Error('no gateway');
    return g.publicToken;
  }

  /** A handle whose next write fails once, as a pooler hiccup would. */
  function failingOnce(real: PrismaClient): PrismaClient {
    let failed = false;
    return new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === 'reviewItem') {
          const model = Reflect.get(target, prop, receiver) as PrismaClient['reviewItem'];
          return new Proxy(model, {
            get(m, p, r) {
              if (p === 'create' && !failed) {
                return async () => {
                  failed = true;
                  throw new Error('simulated pooler timeout');
                };
              }
              return Reflect.get(m, p, r);
            },
          });
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  it('a save that failed says so, and the same form sent again is stored', async () => {
    const clientId = await makeCafe();
    const token = await gatewayFor(clientId);
    const form = { stars: 2, text: 'Coffee was cold and the bill was wrong', nonce: 'n-once-1' };
    const first = await submitCustomerFeedback(failingOnce(db), token, form, { now: NOW });
    expect(first.ok).toBe(false);
    expect(!first.ok && first.message).toBe(SAVE_FAILED_MESSAGE);
    const second = await submitCustomerFeedback(db, token, form, { now: NOW });
    expect(second.ok && second.data.stored).toBe(true);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(1);
  });

  it('the same form posted twice lands once; a different response from the same page lands too', async () => {
    const clientId = await makeCafe();
    const token = await gatewayFor(clientId);
    const a = { stars: 5, text: 'Loved the filter coffee', nonce: 'page-render-1' };
    expect((await submitCustomerFeedback(db, token, a, { now: NOW })).ok).toBe(true);
    const again = await submitCustomerFeedback(db, token, a, { now: NOW });
    expect(again.ok && again.data.stored).toBe(false);
    const b = { stars: 2, text: 'Waited 30 minutes for a sandwich', nonce: 'page-render-1' };
    const other = await submitCustomerFeedback(db, token, b, { now: NOW });
    expect(other.ok && other.data.stored).toBe(true);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(2);
  });

  it('two customers writing the same two words two minutes apart are two responses', async () => {
    const clientId = await makeCafe();
    const token = await gatewayFor(clientId);
    await submitCustomerFeedback(db, token, { stars: 5, text: 'Good coffee', nonce: 'x1' }, { now: NOW });
    await submitCustomerFeedback(db, token, { stars: 2, text: 'Good coffee', nonce: 'x2' }, { now: new Date(NOW.getTime() + 2 * 60_000) });
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(2);
  });
});
