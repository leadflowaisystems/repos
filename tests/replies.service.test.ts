import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch, listClientFeedback } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import {
  draftClientReplies,
  getReplyCoverage,
  previewTemplateReply,
  regenerateDraft,
  saveDraftEdit,
  setHandled,
  triageClientFeedback,
} from '@/lib/feedback/replies';
import { TRIAGE_VERSION } from '@/lib/reply/triage';
import { DRAFT_VERSION } from '@/lib/reply/draft';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('replies-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');
const NOW = new Date('2026-03-16T00:00:00.000Z');

/** Every run here stays offline, so results are fully deterministic. */
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

/**
 * A client whose draft write fails for exactly one item.
 *
 * Wrapping rather than patching: a Prisma delegate method cannot be restored
 * once replaced, so a spy would break every test that runs after it.
 */
function withFailingDraftWrite(real: PrismaClient, failId: string): PrismaClient {
  const reviewItem = new Proxy(real.reviewItem, {
    get(target, prop, receiver) {
      if (prop !== 'update') return Reflect.get(target, prop, receiver);
      return async (args: { where?: { id?: string }; data?: Record<string, unknown> }) => {
        if (args.where?.id === failId && args.data && 'draftText' in args.data) {
          throw new Error('disk full');
        }
        return (target.update as (a: unknown) => Promise<unknown>)(args);
      };
    },
  });

  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'reviewItem') return reviewItem;
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** Import, read and sort — the state M7 starts from. */
async function prepare(clientId: string, raw: string) {
  await seed(clientId, raw);
  const analysis = await analyseClientFeedback(db, clientId, OFFLINE);
  if (!analysis.ok) throw new Error('analysis failed');
  const triage = await triageClientFeedback(db, clientId, { now: NOW });
  if (!triage.ok) throw new Error('triage failed');
  return triage.data;
}

const CLINIC_BATCH = [
  '5 stars',
  'Doctor explained everything clearly and the clinic was very clean.',
  '',
  '1 star',
  'Waited over an hour and reception was rude when I asked.',
  '',
  '3 stars',
  'The doctor was good but the wait was far too long.',
  '',
  '4 stars',
  'Do you open on Sundays?',
  '',
  '1 star',
  'I got an infection after the procedure and want my money back.',
].join('\n');

// ---------------------------------------------------------------------------

describe('triage runs off the stored analysis', () => {
  it('sorts every analysed item without re-reading the text', async () => {
    const clientId = await makeClient();
    const result = await prepare(clientId, CLINIC_BATCH);

    expect(result.triaged).toBe(5);
    expect(result.skippedUnanalysed).toBe(0);

    const rows = await listClientFeedback(db, clientId, {});
    for (const row of rows) {
      expect(row.responseClass).not.toBe('UNCLASSIFIED');
      expect(row.responseAction).not.toBe('NONE');
      expect(row.priorityReasons.length).toBeGreaterThan(0);
    }
  });

  it('leaves unanalysed feedback alone', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);

    const result = await triageClientFeedback(db, clientId, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.triaged).toBe(0);
    expect(result.data.skippedUnanalysed).toBe(5);
  });

  it('is idempotent at the current version', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);

    const second = await triageClientFeedback(db, clientId, { now: NOW });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.triaged).toBe(0);
    expect(second.data.skippedUpToDate).toBe(5);
  });

  it('re-sorts everything when asked', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);

    const forced = await triageClientFeedback(db, clientId, { force: true, now: NOW });
    expect(forced.ok).toBe(true);
    if (!forced.ok) return;
    expect(forced.data.triaged).toBe(5);
  });

  it('stamps the engine version so a rule change can be reprocessed', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);

    const rows = await db.reviewItem.findMany({ where: { clientId } });
    expect(rows.every((r) => r.triageVersion === TRIAGE_VERSION)).toBe(true);

    await db.reviewItem.updateMany({
      where: { clientId },
      data: { triageVersion: TRIAGE_VERSION - 1 },
    });
    const again = await triageClientFeedback(db, clientId, { now: NOW });
    expect(again.ok && again.data.triaged).toBe(5);
  });

  it('separates what needs a reply from what needs the operator', async () => {
    const clientId = await makeClient();
    const result = await prepare(clientId, CLINIC_BATCH);

    // The infection / money-back review is the operator's, not RepOS's.
    expect(result.needsYou).toBe(1);
    expect(result.needsReply).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------

describe('drafting stores a usable reply', () => {
  it('writes a suggestion for everything that needs one', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);

    const run = await draftClientReplies(db, clientId, OFFLINE);
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    expect(run.data.drafted).toBeGreaterThan(0);
    expect(run.data.failed).toBe(0);
    expect(run.data.leftForYou).toBe(1);

    const rows = await listClientFeedback(db, clientId, {
      responseAction: 'REPLY_RECOMMENDED',
    });
    for (const row of rows) {
      expect(row.draftStatus).toBe('READY');
      expect(row.draftText?.length ?? 0).toBeGreaterThan(20);
      expect(row.draftSource).toBe('TEMPLATE');
      expect(row.draftLanguage).toBe('ENGLISH');
    }
  });

  it('never writes anything for an item flagged for the operator', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);

    const rows = await listClientFeedback(db, clientId, { responseAction: 'NEEDS_HUMAN' });
    expect(rows.length).toBe(1);
    expect(rows[0]?.draftText).toBeNull();
    expect(rows[0]?.draftStatus).toBe('NONE');
  });

  it('is idempotent — a second run drafts nothing new', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);

    const first = await draftClientReplies(db, clientId, OFFLINE);
    const second = await draftClientReplies(db, clientId, OFFLINE);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.data.drafted).toBe(0);
    expect(second.data.alreadyDrafted).toBe(first.data.drafted);
  });

  it('rewrites everything when forced', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    const first = await draftClientReplies(db, clientId, OFFLINE);

    const forced = await draftClientReplies(db, clientId, { ...OFFLINE, force: true });
    expect(forced.ok && first.ok).toBe(true);
    if (!forced.ok || !first.ok) return;
    expect(forced.data.drafted).toBe(first.data.drafted);
  });

  it('reports honest counts', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    const run = await draftClientReplies(db, clientId, OFFLINE);
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    const { drafted, alreadyDrafted, failed, considered } = run.data;
    expect(drafted + alreadyDrafted + failed).toBe(considered);
  });

  it('stamps the writer version', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);

    const rows = await db.reviewItem.findMany({
      where: { clientId, draftStatus: 'READY' },
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.draftVersion === DRAFT_VERSION)).toBe(true);
  });

  it('says nothing needs a reply when nothing does', async () => {
    const clientId = await makeClient();
    await prepare(clientId, 'ok');

    const run = await draftClientReplies(db, clientId, OFFLINE);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.data.drafted).toBe(0);
    expect(run.data.notes.join(' ')).toMatch(/nothing/i);
  });

  it('leaves optional replies out unless asked for', async () => {
    const clientId = await makeClient();
    await prepare(clientId, 'Good');

    const withoutOptional = await draftClientReplies(db, clientId, OFFLINE);
    expect(withoutOptional.ok && withoutOptional.data.drafted).toBe(0);

    const withOptional = await draftClientReplies(db, clientId, {
      ...OFFLINE,
      includeOptional: true,
    });
    expect(withOptional.ok && withOptional.data.drafted).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('one failure never takes the batch with it', () => {
  it('keeps the successes and marks only the failed item', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);

    const target = await db.reviewItem.findFirst({
      where: { clientId, responseAction: 'REPLY_RECOMMENDED' },
      orderBy: { priorityRank: 'desc' },
      select: { id: true },
    });
    expect(target).not.toBeNull();

    // One row refuses to be written; every other row must still be drafted.
    // The failure is injected through a wrapper around the client rather than
    // by patching the Prisma delegate, which cannot be restored afterwards.
    const run = await draftClientReplies(
      withFailingDraftWrite(db, target!.id),
      clientId,
      OFFLINE,
    );
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    expect(run.data.failed).toBe(1);
    expect(run.data.drafted).toBeGreaterThan(0);

    const failed = await db.reviewItem.findUnique({ where: { id: target!.id } });
    expect(failed?.draftStatus).toBe('FAILED');
    expect(failed?.draftError).toContain('disk full');

    // The customer's own text and its analysis are untouched by the failure.
    expect(failed?.text.length).toBeGreaterThan(0);
    expect(failed?.analysisStatus).toBe('ANALYSED');
  });

  it('retries a failed item on the next run', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);

    const row = await db.reviewItem.findFirst({
      where: { clientId, draftStatus: 'READY' },
      select: { id: true },
    });
    await db.reviewItem.update({
      where: { id: row!.id },
      data: { draftStatus: 'FAILED', draftError: 'earlier failure', draftText: null },
    });

    const rerun = await draftClientReplies(db, clientId, OFFLINE);
    expect(rerun.ok && rerun.data.drafted).toBe(1);

    const fixed = await db.reviewItem.findUnique({ where: { id: row!.id } });
    expect(fixed?.draftStatus).toBe('READY');
    expect(fixed?.draftError).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('the operator stays in control', () => {
  async function firstDrafted(clientId: string) {
    const row = await db.reviewItem.findFirst({
      where: { clientId, draftStatus: 'READY' },
      orderBy: { priorityRank: 'desc' },
      select: { id: true },
    });
    if (!row) throw new Error('no draft to work with');
    return row.id;
  }

  it('saves their own wording', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    const result = await saveDraftEdit(
      db,
      clientId,
      itemId,
      'Sorry about the wait that day. Please come and ask for the manager next time.',
    );
    expect(result.ok).toBe(true);

    const row = await db.reviewItem.findUnique({ where: { id: itemId } });
    expect(row?.draftStatus).toBe('EDITED');
    expect(row?.draftText).toContain('ask for the manager');
  });

  it('refuses to save a review incentive, whoever typed it', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);
    const before = await db.reviewItem.findUnique({ where: { id: itemId } });

    const result = await saveDraftEdit(
      db,
      clientId,
      itemId,
      'Sorry about that! Come back and we will give you a free cleaning if you update your review.',
    );
    expect(result.ok).toBe(false);

    const after = await db.reviewItem.findUnique({ where: { id: itemId } });
    expect(after?.draftText).toBe(before?.draftText);
  });

  it('refuses to save a customer phone number', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    const result = await saveDraftEdit(
      db,
      clientId,
      itemId,
      'Sorry about the wait. We tried calling you on 9876543210 yesterday about this.',
    );
    expect(result.ok).toBe(false);
  });

  it('lets a person commit their own business to a time frame, with a warning', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    const result = await saveDraftEdit(
      db,
      clientId,
      itemId,
      'Sorry about the wait. Someone from the clinic will call you within two days.',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings.join(' ')).toMatch(/time frame/i);
  });

  it('refuses an empty reply', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    const result = await saveDraftEdit(db, clientId, itemId, '   ');
    expect(result.ok).toBe(false);
  });

  it('never overwrites their edit with a batch run', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    const mine = 'Thank you for telling us. We are sorry, and we are on it.';
    await saveDraftEdit(db, clientId, itemId, mine);

    await draftClientReplies(db, clientId, { ...OFFLINE, force: true });

    const row = await db.reviewItem.findUnique({ where: { id: itemId } });
    expect(row?.draftText).toBe(mine);
    expect(row?.draftStatus).toBe('EDITED');
  });

  it('regenerates one item on request', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    await db.reviewItem.update({
      where: { id: itemId },
      data: { draftText: 'something stale' },
    });

    const result = await regenerateDraft(db, clientId, itemId, { useAi: false, now: NOW });
    expect(result.ok).toBe(true);

    const row = await db.reviewItem.findUnique({ where: { id: itemId } });
    expect(row?.draftText).not.toBe('something stale');
    expect(row?.draftStatus).toBe('READY');
  });

  it('refuses to draft for something it has not read', async () => {
    const clientId = await makeClient();
    await seed(clientId, CLINIC_BATCH);
    const row = await db.reviewItem.findFirst({ where: { clientId } });

    const result = await regenerateDraft(db, clientId, row!.id, { useAi: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/has not read/i);
  });

  it('marks an item handled and puts it back', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    await setHandled(db, clientId, itemId, true, { now: NOW });
    let row = await db.reviewItem.findUnique({ where: { id: itemId } });
    expect(row?.handledAt).not.toBeNull();

    await setHandled(db, clientId, itemId, false);
    row = await db.reviewItem.findUnique({ where: { id: itemId } });
    expect(row?.handledAt).toBeNull();
  });

  it('does not relabel RepOS’s own wording as the operator’s on reopen', async () => {
    // Reopening used to set draftStatus to EDITED whenever draft text existed,
    // so one mis-click permanently claimed RepOS's words as the operator's and
    // exempted them from ever being rewritten.
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    const before = await db.reviewItem.findUnique({ where: { id: itemId } });
    await setHandled(db, clientId, itemId, true, { now: NOW });
    await setHandled(db, clientId, itemId, false);
    const after = await db.reviewItem.findUnique({ where: { id: itemId } });

    expect(after?.draftStatus).toBe(before?.draftStatus);
    expect(after?.draftText).toBe(before?.draftText);
  });

  it('leaves a handled item alone on the next batch run', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);
    const original = (await db.reviewItem.findUnique({ where: { id: itemId } }))?.draftText;
    await setHandled(db, clientId, itemId, true, { now: NOW });

    await draftClientReplies(db, clientId, { ...OFFLINE, force: true });
    const row = await db.reviewItem.findUnique({ where: { id: itemId } });
    expect(row?.handledAt).not.toBeNull();
    expect(row?.draftText).toBe(original);
  });

  it('stops counting an item once the operator has finished with it', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    await draftClientReplies(db, clientId, OFFLINE);
    const itemId = await firstDrafted(clientId);

    const before = await getReplyCoverage(db, clientId);
    await setHandled(db, clientId, itemId, true, { now: NOW });
    const after = await getReplyCoverage(db, clientId);

    // Triage's own answer does not move; the outstanding work does.
    expect(after.needsReply).toBe(before.needsReply);
    expect(after.replyOutstanding).toBe(before.replyOutstanding - 1);
    expect(after.handled).toBe(before.handled + 1);
  });
});

// ---------------------------------------------------------------------------

describe('AI is optional at the service layer too', () => {
  it('drafts everything with no API key configured', async () => {
    const previous = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const clientId = await makeClient();
      await prepare(clientId, CLINIC_BATCH);

      // No useAi override: the service decides from provider availability.
      const run = await draftClientReplies(db, clientId, { now: NOW });
      expect(run.ok).toBe(true);
      if (!run.ok) return;

      expect(run.data.drafted).toBeGreaterThan(0);
      expect(run.data.usedAi).toBe(false);

      const rows = await db.reviewItem.findMany({
        where: { clientId, draftStatus: 'READY' },
      });
      expect(rows.every((r) => r.draftSource === 'TEMPLATE')).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previous;
    }
  });

  it('says plainly that RepOS wrote them itself', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);
    const run = await draftClientReplies(db, clientId, OFFLINE);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.data.notes.join(' ')).toMatch(/RepOS/);
  });
});

// ---------------------------------------------------------------------------

describe('replies adapt to the vertical through the same code path', () => {
  const CASES = [
    {
      vertical: 'salon',
      name: 'Glow Salon',
      raw: '1 star\nThe stylist rushed and the haircut was bad.',
      expect: /baalon ke result/i,
    },
    {
      vertical: 'restaurant',
      name: 'Corner Cafe',
      raw: '1 star\nThe food was cold and the waiter was rude.',
      expect: /khane ki quality|staff ke vyavhaar/i,
    },
    {
      vertical: 'clinic',
      name: 'Sunrise Dental',
      raw: '1 star\nWaited over an hour past my appointment.',
      expect: /the wait past your appointment time/i,
    },
  ];

  for (const testCase of CASES) {
    it(`writes a ${testCase.vertical} reply that names the ${testCase.vertical} problem`, async () => {
      const clientId = await makeClient(testCase.name, testCase.vertical);
      await prepare(clientId, testCase.raw);
      const run = await draftClientReplies(db, clientId, OFFLINE);
      expect(run.ok && run.data.drafted).toBe(1);

      const row = await db.reviewItem.findFirst({ where: { clientId } });
      expect(row?.draftText).toMatch(testCase.expect);
      expect(row?.draftText).toContain(testCase.name);
    });
  }

  it('writes a Marathi reply when the business speaks Marathi', async () => {
    const clientId = await makeClient('Glow Salon', 'salon');
    await db.voiceProfile.upsert({
      where: { clientId },
      update: { languageMix: 'MARATHI' },
      create: { clientId, languageMix: 'MARATHI' },
    });
    await prepare(clientId, '2 stars\nकेस कापणे नीट झाले नाही आणि खूप वेळ लागला');

    const run = await draftClientReplies(db, clientId, OFFLINE);
    expect(run.ok && run.data.drafted).toBe(1);

    const row = await db.reviewItem.findFirst({ where: { clientId } });
    expect(row?.draftLanguage).toBe('MARATHI');
    expect(row?.draftText).toMatch(/[ऀ-ॿ]/);
  });

  it('follows the customer when the business says "match them"', async () => {
    const clientId = await makeClient('Corner Cafe', 'restaurant');
    await db.voiceProfile.upsert({
      where: { clientId },
      update: { languageMix: 'MIXED' },
      create: { clientId, languageMix: 'MIXED' },
    });
    await prepare(clientId, '2 stars\nKhana thanda tha aur service bahut slow thi');

    await draftClientReplies(db, clientId, OFFLINE);
    const row = await db.reviewItem.findFirst({ where: { clientId } });
    expect(row?.draftLanguage).toBe('HINGLISH');
    expect(row?.draftText).not.toMatch(/[ऀ-ॿ]/);
  });

  it('refuses to publish a word the client banned, and says why', async () => {
    const clientId = await makeClient();
    await db.voiceProfile.upsert({
      where: { clientId },
      update: { bannedWords: 'sorry' },
      create: { clientId, bannedWords: 'sorry' },
    });
    await prepare(clientId, '1 star\nWaited over an hour past my appointment.');

    const run = await draftClientReplies(db, clientId, OFFLINE);
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    // RepOS's own apology uses a word this business banned. Rather than ignore
    // their instruction, the item comes back with the reason on it.
    expect(run.data.drafted).toBe(0);
    expect(run.data.failed).toBe(1);

    const row = await db.reviewItem.findFirst({ where: { clientId } });
    expect(row?.draftText).toBeNull();
    expect(row?.draftStatus).toBe('FAILED');
    expect(row?.draftError).toContain('sorry');

    // The wording it would have used is still inspectable.
    const preview = await previewTemplateReply(db, clientId, row!.id);
    expect(preview.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('coverage and isolation', () => {
  it('reports where the reply work has got to', async () => {
    const clientId = await makeClient();
    await prepare(clientId, CLINIC_BATCH);

    let coverage = await getReplyCoverage(db, clientId);
    expect(coverage.analysed).toBe(5);
    expect(coverage.needsYou).toBe(1);
    expect(coverage.awaitingDraft).toBeGreaterThan(0);
    expect(coverage.upToDate).toBe(false);

    await draftClientReplies(db, clientId, OFFLINE);
    coverage = await getReplyCoverage(db, clientId);
    expect(coverage.awaitingDraft).toBe(0);
    expect(coverage.upToDate).toBe(true);
    expect(coverage.drafted).toBeGreaterThan(0);
  });

  it('keeps one client out of another client drafts', async () => {
    const a = await makeClient('Clinic A', 'clinic');
    const b = await makeClient('Clinic B', 'clinic');
    await prepare(a, CLINIC_BATCH);
    await prepare(b, '1 star\nCompletely different complaint about parking being hard');

    await draftClientReplies(db, a, OFFLINE);

    const bRows = await db.reviewItem.findMany({ where: { clientId: b } });
    expect(bRows.every((r) => r.draftText === null)).toBe(true);

    const aRows = await db.reviewItem.findMany({
      where: { clientId: a, draftStatus: 'READY' },
    });
    expect(aRows.length).toBeGreaterThan(0);
    expect(aRows.every((r) => r.draftText?.includes('Clinic A'))).toBe(true);
  });

  it('refuses to work on a client that no longer exists', async () => {
    const result = await draftClientReplies(db, 'does-not-exist', OFFLINE);
    expect(result.ok).toBe(false);
  });
});
