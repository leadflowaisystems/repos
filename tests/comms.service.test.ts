import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { draftClientReplies, triageClientFeedback } from '@/lib/feedback/replies';
import { createMinute } from '@/lib/minutes/service';
import { getOwnerComms, getOwnerMessage } from '@/lib/comms/service';
import { insightNumbers } from '@/lib/comms/insight';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('comms-service');
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

async function makeClient(businessName = 'Sunrise Clinic', vertical = 'clinic') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

/** Import, read and sort — the state M8 builds on. */
async function prepare(clientId: string, raw: string) {
  const imported = await importFeedbackBatch(db, clientId, {
    raw,
    source: 'PUBLIC_REVIEW',
    referenceDate: REF,
  });
  if (!imported.ok) throw new Error(`import failed: ${imported.message}`);

  const analysis = await analyseClientFeedback(db, clientId, OFFLINE);
  if (!analysis.ok) throw new Error('analysis failed');

  const triage = await triageClientFeedback(db, clientId, { now: NOW });
  if (!triage.ok) throw new Error('triage failed');
}

/** Enough feedback to clear the naming floor, with a clear repeated issue. */
function clinicBatch(): string {
  const blocks: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    blocks.push('5 stars', `Doctor explained everything clearly and the clinic was very clean (${i}).`, '');
  }
  for (let i = 0; i < 6; i += 1) {
    blocks.push('1 star', `Waited over an hour past my appointment time again (${i}).`, '');
  }
  blocks.push('2 stars', 'Reception was rude when I asked how long the wait would be.', '');
  blocks.push('4 stars', 'The doctor was good but the wait was far too long.');
  return blocks.join('\n');
}

// ---------------------------------------------------------------------------

describe('the owner update is built from real stored data', () => {
  it('names real themes with real counts', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const result = await getOwnerComms(db, clientId, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { insight, messages } = result.data;
    const update = messages.find((m) => m.type === 'OWNER_UPDATE');
    expect(update).toBeDefined();
    if (!update) return;

    expect(insight.evidence.analysed).toBeGreaterThan(0);
    expect(insight.topIssue?.key).toBe('wait_time');
    expect(update.body).toContain('Sunrise Clinic');
    expect(update.body).toContain('Long waiting time');
    expect(update.body).toContain(
      `mentioned ${insight.topIssue?.count} times across all the feedback`,
    );
    expect(update.blocked).toBe(false);
  });

  it('states no figure the stored data does not support', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const result = await getOwnerComms(db, clientId, { now: NOW });
    if (!result.ok) return;

    const allowed = insightNumbers(result.data.insight);
    for (const message of result.data.messages) {
      for (const match of message.body.matchAll(/\d+(?:\.\d+)?/g)) {
        expect(
          allowed.has(match[0]),
          `${message.type} states unsupported figure ${match[0]}`,
        ).toBe(true);
      }
    }
  });

  it('carries the evidence trail the future portal will need', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const result = await getOwnerComms(db, clientId, { now: NOW });
    if (!result.ok) return;

    const issue = result.data.insight.topIssue;
    expect(issue).not.toBeNull();
    expect(issue?.itemIds.length).toBe(issue?.count);

    // Every id points at a real stored review for this client.
    const rows = await db.reviewItem.findMany({
      where: { id: { in: issue?.itemIds ?? [] } },
      select: { clientId: true },
    });
    expect(rows.length).toBe(issue?.count);
    expect(rows.every((row) => row.clientId === clientId)).toBe(true);
  });

  it('never leaks a customer identifier from the stored feedback', async () => {
    const clientId = await makeClient();
    await prepare(
      clientId,
      [
        clinicBatch(),
        '',
        '1 star',
        'Call me on 9876543210 or write to raj@example.com about booking REF-99812.',
      ].join('\n'),
    );

    const result = await getOwnerComms(db, clientId, { now: NOW });
    if (!result.ok) return;

    for (const message of result.data.messages) {
      expect(message.body).not.toMatch(/9876543210|example\.com|REF-99812/);
      expect(message.problems.filter((p) => p.blocking)).toEqual([]);
    }
  });

  it('says plainly that there is nothing to report yet', async () => {
    const clientId = await makeClient();

    const result = await getOwnerComms(db, clientId, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const update = result.data.messages.find((m) => m.type === 'OWNER_UPDATE');
    expect(update?.body).toMatch(/not read enough/i);
    expect(update?.body).not.toMatch(/\bmentioned\b/i);
    expect(result.data.insight.evidence.analysed).toBe(0);
  });

  it('does not claim a comparison when only one period exists', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const result = await getOwnerComms(db, clientId, { now: NOW });
    if (!result.ok) return;

    expect(result.data.insight.changes).toEqual([]);
    const update = result.data.messages.find((m) => m.type === 'OWNER_UPDATE');
    expect(update?.body).not.toContain('What changed between');
  });

  it('mentions a recorded decision without saying whether it worked', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const minute = await createMinute(db, clientId, {
      occurredAt: new Date('2026-03-10T09:00:00.000Z'),
      title: 'Agreed to add a second receptionist at peak hours',
      body: 'Owner will trial it for a month.',
      category: 'DECISION',
    });
    expect(minute.ok).toBe(true);

    const result = await getOwnerComms(db, clientId, { now: NOW });
    if (!result.ok) return;

    expect(result.data.insight.recentlyDone.length).toBe(1);
    const followUp = result.data.messages.find((m) => m.type === 'FOLLOW_UP');
    expect(followUp?.body).toContain('second receptionist');
    expect(followUp?.body).not.toMatch(/worked|helped|improved because/i);
  });
});

// ---------------------------------------------------------------------------

describe('the same call works for every vertical', () => {
  const CASES = [
    { vertical: 'clinic', name: 'Sunrise Dental', issueKey: 'wait_time' },
    { vertical: 'salon', name: 'Glow Salon', issueKey: 'wait_time' },
    { vertical: 'restaurant', name: 'Corner Cafe', issueKey: 'service_speed' },
  ];

  for (const testCase of CASES) {
    it(`prepares a ${testCase.vertical} update in that trade's own words`, async () => {
      const clientId = await makeClient(testCase.name, testCase.vertical);
      const blocks: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        blocks.push('1 star', `Waited far too long, over an hour again (${i}).`, '');
      }
      for (let i = 0; i < 6; i += 1) {
        blocks.push('5 stars', `Everything was clean and the staff were lovely (${i}).`, '');
      }
      await prepare(clientId, blocks.join('\n'));

      const result = await getOwnerComms(db, clientId, { now: NOW });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const update = result.data.messages.find((m) => m.type === 'OWNER_UPDATE');
      expect(update?.body).toContain(testCase.name);
      expect(update?.blocked).toBe(false);

      // The recommendation is the pack's own advice for whatever came up most.
      const recommendation = result.data.insight.recommendation;
      if (recommendation) {
        expect(update?.body).toContain(recommendation.action);
      }
    });
  }

  it('writes to the owner in the language their profile says', async () => {
    const clientId = await makeClient('Glow Salon', 'salon');
    await db.voiceProfile.upsert({
      where: { clientId },
      update: { languageMix: 'MARATHI' },
      create: { clientId, languageMix: 'MARATHI' },
    });

    const blocks: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      blocks.push('1 star', `Charged me more than the price quoted at the start (${i}).`, '');
    }
    await prepare(clientId, blocks.join('\n'));

    const result = await getOwnerComms(db, clientId, { now: NOW });
    if (!result.ok) return;

    expect(result.data.language).toBe('MARATHI');
    const update = result.data.messages.find((m) => m.type === 'OWNER_UPDATE');
    expect(update?.body).toMatch(/[ऀ-ॿ]/);
  });

  it('lets the operator switch language for one message without changing settings', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const english = await getOwnerComms(db, clientId, { now: NOW });
    const hindi = await getOwnerComms(db, clientId, { now: NOW, language: 'HINDI' });
    expect(english.ok && hindi.ok).toBe(true);
    if (!english.ok || !hindi.ok) return;

    expect(english.data.language).toBe('ENGLISH');
    expect(hindi.data.language).toBe('HINDI');

    // The stored preference is untouched — this is a view, not a setting.
    const stored = await db.voiceProfile.findUnique({ where: { clientId } });
    expect(stored?.languageMix).toBe('');
  });

  it('falls back to the client preference when asked for nonsense', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const result = await getOwnerComms(db, clientId, { now: NOW, language: 'KLINGON' });
    if (!result.ok) return;
    expect(result.data.language).toBe('ENGLISH');
  });
});

// ---------------------------------------------------------------------------

describe('owner communication sits alongside review replies, not on top of them', () => {
  it('leaves the per-review drafts exactly as they were', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());
    await draftClientReplies(db, clientId, OFFLINE);

    const before = await db.reviewItem.findMany({
      where: { clientId },
      select: { id: true, draftText: true, draftStatus: true },
      orderBy: { id: 'asc' },
    });

    await getOwnerComms(db, clientId, { now: NOW });

    const after = await db.reviewItem.findMany({
      where: { clientId },
      select: { id: true, draftText: true, draftStatus: true },
      orderBy: { id: 'asc' },
    });
    expect(after).toEqual(before);
  });

  it('points a review reply back at the feedback page rather than inventing one', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const result = await getOwnerMessage(db, clientId, 'REVIEW_REPLY', { now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/feedback page/i);
  });

  it('regenerates one message on its own', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const first = await getOwnerMessage(db, clientId, 'OWNER_UPDATE', { now: NOW });
    const again = await getOwnerMessage(db, clientId, 'OWNER_UPDATE', { now: NOW });
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;

    // Deterministic: the same stored rows produce the same message.
    expect(again.data.body).toBe(first.data.body);
  });

  it('stores nothing — a prepared message lives on the screen only', async () => {
    const clientId = await makeClient();
    await prepare(clientId, clinicBatch());

    const counts = async () => ({
      minutes: await db.minute.count(),
      items: await db.reviewItem.count(),
      snapshots: await db.snapshot.count(),
    });

    const before = await counts();
    await getOwnerComms(db, clientId, { now: NOW });
    await getOwnerMessage(db, clientId, 'ACTION_MESSAGE', { now: NOW });
    expect(await counts()).toEqual(before);
  });
});

// ---------------------------------------------------------------------------

describe('no provider, no problem', () => {
  it('prepares everything with no API key configured', async () => {
    const previous = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const clientId = await makeClient();
      await prepare(clientId, clinicBatch());

      const result = await getOwnerComms(db, clientId, { now: NOW });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.messages.length).toBe(3);
      for (const message of result.data.messages) {
        expect(message.body.length).toBeGreaterThan(40);
        expect(message.blocked).toBe(false);
      }
    } finally {
      if (previous === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previous;
    }
  });

  it('refuses a client that no longer exists', async () => {
    const result = await getOwnerComms(db, 'does-not-exist', { now: NOW });
    expect(result.ok).toBe(false);
  });

  it('keeps one client out of another client update', async () => {
    const a = await makeClient('Clinic A', 'clinic');
    const b = await makeClient('Clinic B', 'clinic');
    await prepare(a, clinicBatch());
    await prepare(b, '5 stars\nCompletely different praise about the parking being easy');

    const result = await getOwnerComms(db, a, { now: NOW });
    if (!result.ok) return;

    for (const message of result.data.messages) {
      expect(message.body).toContain('Clinic A');
      expect(message.body).not.toContain('Clinic B');
      expect(message.body).not.toMatch(/parking/i);
    }
  });
});
