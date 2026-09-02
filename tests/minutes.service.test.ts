import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import {
  MINUTE_CATEGORIES,
  categoryLabel,
  categoryOptions,
  countClientMinutes,
  createMinute,
  deleteMinute,
  getMinute,
  isForwardLooking,
  listClientMinutes,
  listRecentMinutes,
  updateMinute,
} from '@/lib/minutes/service';
import { archiveClient } from '@/lib/clients/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('minutes-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const JAN = new Date('2026-01-10T09:00:00.000Z');
const FEB = new Date('2026-02-10T09:00:00.000Z');
const MAR = new Date('2026-03-10T09:00:00.000Z');

async function makeClient(
  businessName = 'Sunrise Clinic',
  vertical = 'clinic',
) {
  const result = await createClient(
    db,
    validClientInput({ businessName, vertical }),
  );
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    occurredAt: MAR,
    category: 'OWNER_CONVERSATION',
    title: 'Called the owner about waiting times',
    body: 'He agreed to tell reception to quote an expected wait on arrival.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('categories', () => {
  it('keeps the set small and operational', () => {
    expect(MINUTE_CATEGORIES).toHaveLength(6);
    expect(categoryOptions().map((o) => o.value)).toEqual([...MINUTE_CATEGORIES]);
  });

  it('labels every category in plain language', () => {
    for (const category of MINUTE_CATEGORIES) {
      expect(categoryLabel(category), category).not.toBe(category);
      expect(categoryLabel(category).length, category).toBeGreaterThan(2);
    }
  });

  it('separates what happened from what was decided or still needs doing', () => {
    expect(isForwardLooking('DECISION')).toBe(true);
    expect(isForwardLooking('ACTION')).toBe(true);
    expect(isForwardLooking('FOLLOW_UP')).toBe(true);
    expect(isForwardLooking('OWNER_CONVERSATION')).toBe(false);
    expect(isForwardLooking('ISSUE')).toBe(false);
    expect(isForwardLooking('GENERAL')).toBe(false);
  });

  it('falls back to the raw value for an unknown category', () => {
    expect(categoryLabel('NONSENSE')).toBe('NONSENSE');
    expect(isForwardLooking('NONSENSE')).toBe(false);
  });
});

describe('createMinute', () => {
  it('stores a minute against the client', async () => {
    const clientId = await makeClient();
    const result = await createMinute(db, clientId, input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await db.minute.findUniqueOrThrow({ where: { id: result.data.id } });
    expect(row.clientId).toBe(clientId);
    expect(row.title).toBe('Called the owner about waiting times');
    expect(row.category).toBe('OWNER_CONVERSATION');
    expect(row.occurredAt.toISOString()).toBe(MAR.toISOString());
    expect(row.body).toContain('expected wait');
  });

  it('accepts every valid category', async () => {
    const clientId = await makeClient();
    for (const category of MINUTE_CATEGORIES) {
      const result = await createMinute(db, clientId, input({ category }));
      expect(result.ok, category).toBe(true);
    }
    expect(await countClientMinutes(db, clientId)).toBe(MINUTE_CATEGORIES.length);
  });

  it('accepts an empty note — a title alone is a valid memory', async () => {
    const clientId = await makeClient();
    const result = await createMinute(db, clientId, input({ body: '' }));
    expect(result.ok).toBe(true);
  });

  it('rejects a missing title', async () => {
    const clientId = await makeClient();
    const result = await createMinute(db, clientId, input({ title: '' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.title).toContain('short title');
    expect(await countClientMinutes(db, clientId)).toBe(0);
  });

  it('rejects a one-character title', async () => {
    const clientId = await makeClient();
    expect((await createMinute(db, clientId, input({ title: 'x' }))).ok).toBe(false);
  });

  it('rejects an over-long title rather than silently truncating', async () => {
    const clientId = await makeClient();
    const result = await createMinute(db, clientId, input({ title: 'x'.repeat(200) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.title).toContain('one line');
  });

  it('rejects an invalid date', async () => {
    const clientId = await makeClient();
    const result = await createMinute(
      db,
      clientId,
      input({ occurredAt: new Date(Number.NaN) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.occurredAt).toContain('valid date');
  });

  it('rejects a category outside the allowed set', async () => {
    const clientId = await makeClient();
    const result = await createMinute(db, clientId, input({ category: 'BILLING' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.category).toContain('category');
    expect(await countClientMinutes(db, clientId)).toBe(0);
  });

  it('reports an unknown client instead of throwing', async () => {
    expect((await createMinute(db, 'nope', input())).ok).toBe(false);
  });

  it('rejects junk input without throwing', async () => {
    const clientId = await makeClient();
    for (const raw of [null, undefined, 'text', 42, [], {}]) {
      expect((await createMinute(db, clientId, raw)).ok, String(raw)).toBe(false);
    }
    expect(await countClientMinutes(db, clientId)).toBe(0);
  });
});

describe('retrieval and ordering', () => {
  it('returns an empty list for a client with no minutes', async () => {
    const clientId = await makeClient();
    expect(await listClientMinutes(db, clientId)).toEqual([]);
    expect(await countClientMinutes(db, clientId)).toBe(0);
  });

  it('returns minutes newest first by when they happened', async () => {
    const clientId = await makeClient();
    await createMinute(db, clientId, input({ occurredAt: JAN, title: 'January thing' }));
    await createMinute(db, clientId, input({ occurredAt: MAR, title: 'March thing' }));
    await createMinute(db, clientId, input({ occurredAt: FEB, title: 'February thing' }));

    expect((await listClientMinutes(db, clientId)).map((m) => m.title)).toEqual([
      'March thing',
      'February thing',
      'January thing',
    ]);
  });

  it('orders by when it happened, not when it was typed', async () => {
    const clientId = await makeClient();
    // Typed second but happened first.
    await createMinute(db, clientId, input({ occurredAt: MAR, title: 'Recent' }));
    await createMinute(db, clientId, input({ occurredAt: JAN, title: 'Backfilled' }));

    expect((await listClientMinutes(db, clientId))[0]?.title).toBe('Recent');
  });

  it('honours a limit', async () => {
    const clientId = await makeClient();
    for (let i = 0; i < 5; i += 1) {
      await createMinute(db, clientId, input({ title: `Entry ${i}` }));
    }
    expect(await listClientMinutes(db, clientId, { limit: 2 })).toHaveLength(2);
  });

  it('decorates each row with its label and forward-looking flag', async () => {
    const clientId = await makeClient();
    await createMinute(db, clientId, input({ category: 'FOLLOW_UP' }));

    const row = (await listClientMinutes(db, clientId))[0];
    expect(row?.categoryLabel).toBe('Follow-up');
    expect(row?.forwardLooking).toBe(true);
  });

  it('is deterministic across repeated reads', async () => {
    const clientId = await makeClient();
    await createMinute(db, clientId, input({ occurredAt: JAN }));
    await createMinute(db, clientId, input({ occurredAt: MAR }));

    const first = await listClientMinutes(db, clientId);
    const second = await listClientMinutes(db, clientId);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe('client isolation', () => {
  it('never shows one client minutes under another', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');

    await createMinute(db, a, input({ title: 'Clinic conversation' }));
    await createMinute(db, b, input({ title: 'Salon conversation' }));

    const forA = await listClientMinutes(db, a);
    const forB = await listClientMinutes(db, b);

    expect(forA.map((m) => m.title)).toEqual(['Clinic conversation']);
    expect(forB.map((m) => m.title)).toEqual(['Salon conversation']);
    expect(forA.every((m) => m.clientId === a)).toBe(true);
    expect(forB.every((m) => m.clientId === b)).toBe(true);
  });

  it('cannot fetch another client minute by id', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');
    const created = await createMinute(db, a, input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await getMinute(db, a, created.data.id)).not.toBeNull();
    expect(await getMinute(db, b, created.data.id)).toBeNull();
  });

  it('cannot edit another client minute', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');
    const created = await createMinute(db, a, input({ title: 'Original' }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const attempt = await updateMinute(
      db,
      b,
      created.data.id,
      input({ title: 'Hijacked' }),
    );
    expect(attempt.ok).toBe(false);

    const row = await db.minute.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(row.title).toBe('Original');
  });

  it('cannot delete another client minute', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');
    const created = await createMinute(db, a, input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect((await deleteMinute(db, b, created.data.id)).ok).toBe(false);
    expect(await db.minute.count()).toBe(1);
  });

  it('counts only the given client', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');
    await createMinute(db, a, input());
    await createMinute(db, a, input());
    await createMinute(db, b, input());

    expect(await countClientMinutes(db, a)).toBe(2);
    expect(await countClientMinutes(db, b)).toBe(1);
  });
});

describe('edit', () => {
  it('updates every editable field', async () => {
    const clientId = await makeClient();
    const created = await createMinute(db, clientId, input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateMinute(
      db,
      clientId,
      created.data.id,
      input({
        occurredAt: FEB,
        category: 'DECISION',
        title: 'Owner agreed to publish slot lengths',
        body: 'Starting next month.',
      }),
    );
    expect(result.ok).toBe(true);

    const row = await db.minute.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(row.category).toBe('DECISION');
    expect(row.title).toBe('Owner agreed to publish slot lengths');
    expect(row.body).toBe('Starting next month.');
    expect(row.occurredAt.toISOString()).toBe(FEB.toISOString());
  });

  it('rejects invalid edits and leaves the stored row untouched', async () => {
    const clientId = await makeClient();
    const created = await createMinute(db, clientId, input({ title: 'Original' }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      (await updateMinute(db, clientId, created.data.id, input({ title: '' }))).ok,
    ).toBe(false);

    const row = await db.minute.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(row.title).toBe('Original');
  });

  it('reports an unknown minute instead of throwing', async () => {
    const clientId = await makeClient();
    expect((await updateMinute(db, clientId, 'nope', input())).ok).toBe(false);
  });
});

describe('delete', () => {
  it('removes only the given minute', async () => {
    const clientId = await makeClient();
    const keep = await createMinute(db, clientId, input({ title: 'Keep' }));
    const drop = await createMinute(db, clientId, input({ title: 'Drop' }));
    expect(keep.ok && drop.ok).toBe(true);
    if (!drop.ok) return;

    expect((await deleteMinute(db, clientId, drop.data.id)).ok).toBe(true);

    const remaining = await listClientMinutes(db, clientId);
    expect(remaining.map((m) => m.title)).toEqual(['Keep']);
  });

  it('reports an unknown minute instead of throwing', async () => {
    const clientId = await makeClient();
    expect((await deleteMinute(db, clientId, 'nope')).ok).toBe(false);
  });

  it('is removed with the client under the existing lifecycle rules', async () => {
    const clientId = await makeClient();
    await createMinute(db, clientId, input());
    expect(await db.minute.count()).toBe(1);

    await db.client.delete({ where: { id: clientId } });
    expect(await db.minute.count()).toBe(0);
  });

  it('survives archiving, because archiving preserves history', async () => {
    const clientId = await makeClient();
    await createMinute(db, clientId, input());

    await archiveClient(db, clientId);
    expect(await countClientMinutes(db, clientId)).toBe(1);
  });
});

describe('cross-client feed', () => {
  it('is empty when nothing has been recorded', async () => {
    expect(await listRecentMinutes(db)).toEqual([]);
  });

  it('shows minutes from every active client, newest first', async () => {
    const clinic = await makeClient('Sunrise Clinic', 'clinic');
    const salon = await makeClient('Glow Salon', 'salon');
    const restaurant = await makeClient('Corner Cafe', 'restaurant');

    await createMinute(db, clinic, input({ occurredAt: JAN, title: 'Clinic call' }));
    await createMinute(db, salon, input({ occurredAt: MAR, title: 'Salon call' }));
    await createMinute(db, restaurant, input({ occurredAt: FEB, title: 'Cafe call' }));

    const feed = await listRecentMinutes(db);
    expect(feed.map((m) => m.title)).toEqual(['Salon call', 'Cafe call', 'Clinic call']);
    expect(feed.map((m) => m.businessName)).toEqual([
      'Glow Salon',
      'Corner Cafe',
      'Sunrise Clinic',
    ]);
  });

  it('hides minutes belonging to archived clients', async () => {
    const active = await makeClient('Sunrise Clinic', 'clinic');
    const archived = await makeClient('Glow Salon', 'salon');
    await createMinute(db, active, input({ title: 'Visible' }));
    await createMinute(db, archived, input({ title: 'Hidden' }));

    await archiveClient(db, archived);

    const feed = await listRecentMinutes(db);
    expect(feed.map((m) => m.title)).toEqual(['Visible']);
    // …but the data itself is preserved, not deleted.
    expect(await countClientMinutes(db, archived)).toBe(1);
  });

  it('honours a limit', async () => {
    const clientId = await makeClient();
    for (let i = 0; i < 6; i += 1) {
      await createMinute(db, clientId, input({ title: `Entry ${i}` }));
    }
    expect(await listRecentMinutes(db, { limit: 3 })).toHaveLength(3);
  });
});

describe('data boundaries', () => {
  it('has no schema field for customer identity', async () => {
    const clientId = await makeClient();
    const created = await createMinute(db, clientId, input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const row = await db.minute.findUniqueOrThrow({ where: { id: created.data.id } });
    const fields = Object.keys(row).map((k) => k.toLowerCase());

    expect(fields.sort()).toEqual([
      'body',
      'category',
      'clientid',
      'createdat',
      'id',
      'occurredat',
      'title',
      'updatedat',
    ]);
    for (const banned of ['customername', 'customerphone', 'customeremail', 'phone', 'email', 'address']) {
      expect(fields, banned).not.toContain(banned);
    }
  });
});
