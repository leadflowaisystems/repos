import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  archiveClient,
  countClients,
  createClient,
  findActiveNameCollision,
  listClients,
  purgeClient,
  restoreClient,
  updateClient,
} from '@/lib/clients/service';
import { normaliseBusinessName } from '@/lib/clients/schema';
import { listPacks } from '@/lib/packs';
import { buildKitContent } from '@/lib/kit/content';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('clients-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

async function create(overrides: Record<string, unknown> = {}) {
  return createClient(db, validClientInput(overrides));
}

// ---------------------------------------------------------------------------

describe('createClient', () => {
  it('creates a valid client and returns its id', async () => {
    const result = await create();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await db.client.findUnique({ where: { id: result.data.id } });
    expect(row?.businessName).toBe('Sunrise Clinic');
    expect(row?.vertical).toBe('clinic');
    expect(row?.archivedAt).toBeNull();
  });

  it('creates the voice profile, policy and kit config empty so the pack stays live', async () => {
    const result = await create({ vertical: 'restaurant' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await db.client.findUnique({
      where: { id: result.data.id },
      include: { voiceProfile: true, policy: true, kitConfig: true },
    });

    // The voice row exists but is EMPTY, for the same reason the kit row is: a
    // blank field means "use this vertical's voice" (src/lib/reply/voice.ts).
    // Copying the preset in here would freeze it onto every client, which is
    // what made a Hinglish-speaking trade reply in English.
    expect(row?.voiceProfile).not.toBeNull();
    expect(row?.voiceProfile?.formality).toBe('');
    expect(row?.voiceProfile?.languageMix).toBe('');
    expect(row?.voiceProfile?.bannedWords).toBe('');
    expect(row?.voiceProfile?.greeting).toBe('');
    expect(row?.policy).not.toBeNull();

    // The kit row exists but is deliberately EMPTY. In the kit content engine a
    // blank field means "use this vertical's wording", so seeding these slots
    // would freeze a copy of the pack onto every client and stop later pack
    // improvements from reaching clients already onboarded.
    expect(row?.kitConfig).not.toBeNull();
    expect(row?.kitConfig?.displayName).toBe('');
    expect(row?.kitConfig?.headline).toBe('');
    expect(row?.kitConfig?.subhead).toBe('');
    // The QR destination must start empty: it is supplied manually.
    expect(row?.kitConfig?.qrTargetUrl).toBe('');
  });

  it('leaves the kit driven by the vertical pack rather than a frozen copy', async () => {
    const result = await create({ vertical: 'restaurant', businessName: 'Corner Cafe' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pack = listPacks().find((p) => p.id === 'restaurant');
    const content = buildKitContent({
      pack: pack as NonNullable<typeof pack>,
      businessName: 'Corner Cafe',
      feedbackUrl: 'https://repos.example.com/feedback/gp7f8yv6f9zyauwhvxxysm',
    });

    // Blank overrides resolve to the vertical's own wording and the real name.
    expect(content.headline).toBe(pack?.kit?.headline);
    expect(content.displayName).toBe('Corner Cafe');
  });

  it('rejects a missing business name with a field-level message', async () => {
    const result = await create({ businessName: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.businessName).toContain('required');
    expect(await db.client.count()).toBe(0);
  });

  it('rejects a vertical that has no pack', async () => {
    const result = await create({ vertical: 'not_a_real_vertical' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.vertical).toMatch(/business type/i);
    expect(await db.client.count()).toBe(0);
  });

  it('rejects a malformed URL rather than storing it', async () => {
    const result = await create({ mapsUrl: 'notaurl' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.mapsUrl).toContain('https://');
  });

  it('rejects a malformed owner email but accepts a blank one', async () => {
    const bad = await create({ ownerEmail: 'owner@' });
    expect(bad.ok).toBe(false);

    const blank = await create({ ownerEmail: null });
    expect(blank.ok).toBe(true);
  });

  it('rejects an out-of-range baseline rating', async () => {
    const result = await create({ baselineRating: 9 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.baselineRating).toContain('above 5');
  });

  it('rejects entirely empty input without throwing', async () => {
    const result = await createClient(db, {});
    expect(result.ok).toBe(false);
    expect(await db.client.count()).toBe(0);
  });

  it('rejects non-object input without throwing', async () => {
    for (const input of [null, undefined, 'nonsense', 42, []]) {
      const result = await createClient(db, input);
      expect(result.ok, String(input)).toBe(false);
    }
    expect(await db.client.count()).toBe(0);
  });
});

describe('duplicate protection', () => {
  it('normalises case, punctuation and spacing but nothing more', () => {
    expect(normaliseBusinessName('Sunrise Clinic')).toBe('sunrise clinic');
    expect(normaliseBusinessName('  sunrise   CLINIC. ')).toBe('sunrise clinic');
    expect(normaliseBusinessName("Sunrise-Clinic")).toBe('sunrise clinic');
    // Genuinely different names must NOT collide.
    expect(normaliseBusinessName('Sunrise Dental')).not.toBe('sunrise clinic');
    expect(normaliseBusinessName('Sunrise Clinic Kothrud')).not.toBe(
      'sunrise clinic',
    );
  });

  it('blocks a second active client with a colliding name', async () => {
    await create();
    const duplicate = await create({ businessName: '  sunrise   clinic. ' });

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.errors.businessName).toContain('already exists');
    expect(await db.client.count()).toBe(1);
  });

  it('allows a similar-but-distinct name', async () => {
    await create();
    const other = await create({ businessName: 'Sunrise Clinic Kothrud' });
    expect(other.ok).toBe(true);
    expect(await db.client.count()).toBe(2);
  });

  it('ignores archived clients, so a business can be re-onboarded', async () => {
    const first = await create();
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    await archiveClient(db, first.data.id);

    const again = await create();
    expect(again.ok).toBe(true);
    expect(await db.client.count()).toBe(2);
  });

  it('does not flag a client against itself on update', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateClient(
      db,
      created.data.id,
      validClientInput({ areaLabel: 'Baner, Pune' }),
    );
    expect(updated.ok).toBe(true);
  });

  it('blocks renaming one client onto another active client', async () => {
    await create();
    const second = await create({ businessName: 'Moonlight Clinic' });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const clash = await updateClient(
      db,
      second.data.id,
      validClientInput({ businessName: 'Sunrise Clinic' }),
    );
    expect(clash.ok).toBe(false);
    if (clash.ok) return;
    expect(clash.errors.businessName).toContain('already exists');
  });

  it('findActiveNameCollision returns null when there is no collision', async () => {
    await create();
    expect(await findActiveNameCollision(db, 'Totally Different')).toBeNull();
  });
});

describe('listClients and countClients', () => {
  it('lists active clients alphabetically and excludes archived ones', async () => {
    const a = await create({ businessName: 'Zeta Clinic' });
    await create({ businessName: 'Alpha Clinic' });
    const c = await create({ businessName: 'Mid Clinic' });
    expect(a.ok && c.ok).toBe(true);
    if (!c.ok) return;

    await archiveClient(db, c.data.id);

    const active = await listClients(db);
    expect(active.map((r) => r.businessName)).toEqual([
      'Alpha Clinic',
      'Zeta Clinic',
    ]);

    const archived = await listClients(db, { onlyArchived: true });
    expect(archived.map((r) => r.businessName)).toEqual(['Mid Clinic']);

    const all = await listClients(db, { includeArchived: true });
    expect(all).toHaveLength(3);
  });

  it('reports snapshot counts and the latest snapshot date', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await db.snapshot.createMany({
      data: [
        { clientId: created.data.id, capturedAt: new Date('2026-01-10T00:00:00Z') },
        { clientId: created.data.id, capturedAt: new Date('2026-02-10T00:00:00Z') },
      ],
    });

    const rows = await listClients(db);
    expect(rows[0]?.snapshotCount).toBe(2);
    expect(rows[0]?.lastSnapshotAt?.toISOString()).toBe('2026-02-10T00:00:00.000Z');
  });

  it('counts active and archived separately', async () => {
    const a = await create({ businessName: 'One Clinic' });
    await create({ businessName: 'Two Clinic' });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    await archiveClient(db, a.data.id);

    expect(await countClients(db)).toEqual({ active: 1, archived: 1 });
  });

  it('returns an empty list rather than throwing when there are no clients', async () => {
    expect(await listClients(db)).toEqual([]);
    expect(await countClients(db)).toEqual({ active: 0, archived: 0 });
  });
});

describe('updateClient', () => {
  it('persists changed fields', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateClient(
      db,
      created.data.id,
      validClientInput({
        businessName: 'Sunrise Clinic',
        status: 'ACTIVE',
        plan: 'GROWTH',
        baselineRating: 4.2,
        baselineReviewCount: 148,
      }),
    );
    expect(result.ok).toBe(true);

    const row = await db.client.findUnique({ where: { id: created.data.id } });
    expect(row?.status).toBe('ACTIVE');
    expect(row?.plan).toBe('GROWTH');
    expect(row?.baselineRating).toBe(4.2);
    expect(row?.baselineReviewCount).toBe(148);
  });

  it('rejects invalid data and leaves the stored row untouched', async () => {
    const created = await create({ status: 'ACTIVE' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateClient(
      db,
      created.data.id,
      validClientInput({ businessName: 'x' }),
    );
    expect(result.ok).toBe(false);

    const row = await db.client.findUnique({ where: { id: created.data.id } });
    expect(row?.businessName).toBe('Sunrise Clinic');
    expect(row?.status).toBe('ACTIVE');
  });

  it('reports an unknown id instead of throwing', async () => {
    const result = await updateClient(db, 'does-not-exist', validClientInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('no longer exists');
  });

  it('reports a missing id instead of throwing', async () => {
    const result = await updateClient(db, '', validClientInput());
    expect(result.ok).toBe(false);
  });
});

describe('vertical selection', () => {
  it('accepts every shipped vertical pack', async () => {
    for (const pack of listPacks()) {
      const result = await create({
        businessName: `Client ${pack.id}`,
        vertical: pack.id,
      });
      expect(result.ok, pack.id).toBe(true);
    }
    expect(await db.client.count()).toBe(listPacks().length);
  });

  it('flags a vertical change so the UI can warn about existing snapshots', async () => {
    const created = await create({ vertical: 'clinic' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const same = await updateClient(
      db,
      created.data.id,
      validClientInput({ vertical: 'clinic' }),
    );
    expect(same.ok && same.data.verticalChanged).toBe(false);

    const changed = await updateClient(
      db,
      created.data.id,
      validClientInput({ vertical: 'salon' }),
    );
    expect(changed.ok && changed.data.verticalChanged).toBe(true);

    const row = await db.client.findUnique({ where: { id: created.data.id } });
    expect(row?.vertical).toBe('salon');
  });

  it('leaves existing snapshots intact when the vertical changes', async () => {
    const created = await create({ vertical: 'clinic' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await db.snapshot.create({
      data: {
        clientId: created.data.id,
        capturedAt: new Date('2026-01-10T00:00:00Z'),
        analysisJson: JSON.stringify({ packId: 'clinic' }),
      },
    });

    await updateClient(db, created.data.id, validClientInput({ vertical: 'gym' }));

    const snapshot = await db.snapshot.findFirst({
      where: { clientId: created.data.id },
    });
    expect(snapshot?.analysisJson).toContain('clinic');
  });
});

describe('archiving', () => {
  it('archives without deleting any history', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await db.snapshot.create({
      data: { clientId: created.data.id, capturedAt: new Date('2026-01-10T00:00:00Z') },
    });
    await db.timeEntry.create({
      data: {
        clientId: created.data.id,
        taskType: 'Onboarding',
        minutes: 30,
        entryDate: new Date('2026-01-10T00:00:00Z'),
      },
    });

    const result = await archiveClient(db, created.data.id, new Date('2026-03-01T00:00:00Z'));
    expect(result.ok).toBe(true);

    const row = await db.client.findUnique({ where: { id: created.data.id } });
    expect(row?.archivedAt?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(row?.status).toBe('CHURNED');

    expect(await db.snapshot.count()).toBe(1);
    expect(await db.timeEntry.count()).toBe(1);
  });

  it('is idempotent', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await archiveClient(db, created.data.id, new Date('2026-03-01T00:00:00Z'));
    const second = await archiveClient(db, created.data.id, new Date('2026-04-01T00:00:00Z'));
    expect(second.ok).toBe(true);

    const row = await db.client.findUnique({ where: { id: created.data.id } });
    expect(row?.archivedAt?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('keeps an archived client individually retrievable', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await archiveClient(db, created.data.id);
    const row = await db.client.findUnique({ where: { id: created.data.id } });
    expect(row).not.toBeNull();
    expect(row?.businessName).toBe('Sunrise Clinic');
  });

  it('restores an archived client as paused', async () => {
    const created = await create({ status: 'ACTIVE' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await archiveClient(db, created.data.id);
    const restored = await restoreClient(db, created.data.id);
    expect(restored.ok).toBe(true);

    const row = await db.client.findUnique({ where: { id: created.data.id } });
    expect(row?.archivedAt).toBeNull();
    expect(row?.status).toBe('PAUSED');
    expect(await listClients(db)).toHaveLength(1);
  });

  it('refuses to restore when it would create an active duplicate', async () => {
    const first = await create();
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    await archiveClient(db, first.data.id);
    await create(); // same name, now allowed because the original is archived

    const restored = await restoreClient(db, first.data.id);
    expect(restored.ok).toBe(false);
    if (restored.ok) return;
    expect(restored.message).toContain('already active');

    const row = await db.client.findUnique({ where: { id: first.data.id } });
    expect(row?.archivedAt).not.toBeNull();
  });

  it('reports an unknown id instead of throwing', async () => {
    expect((await archiveClient(db, 'nope')).ok).toBe(false);
    expect((await restoreClient(db, 'nope')).ok).toBe(false);
  });
});

describe('permanent delete (delete-on-request)', () => {
  it('requires the exact business name', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const wrong = await purgeClient(db, created.data.id, 'sunrise clinic');
    expect(wrong.ok).toBe(false);
    expect(await db.client.count()).toBe(1);

    const right = await purgeClient(db, created.data.id, 'Sunrise Clinic');
    expect(right.ok).toBe(true);
    expect(await db.client.count()).toBe(0);
  });

  it('cascades to every related row', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const snapshot = await db.snapshot.create({
      data: { clientId: created.data.id, capturedAt: new Date() },
    });
    await db.reviewItem.create({
      data: {
        clientId: created.data.id,
        snapshotId: snapshot.id,
        text: 'Anonymous feedback text',
      },
    });
    await db.competitor.create({
      data: { clientId: created.data.id, name: 'Rival Clinic' },
    });
    await db.timeEntry.create({
      data: {
        clientId: created.data.id,
        taskType: 'Admin',
        minutes: 10,
        entryDate: new Date(),
      },
    });

    const result = await purgeClient(db, created.data.id, 'Sunrise Clinic');
    expect(result.ok).toBe(true);

    expect(await db.client.count()).toBe(0);
    expect(await db.snapshot.count()).toBe(0);
    expect(await db.reviewItem.count()).toBe(0);
    expect(await db.competitor.count()).toBe(0);
    expect(await db.timeEntry.count()).toBe(0);
    expect(await db.voiceProfile.count()).toBe(0);
    expect(await db.businessPolicy.count()).toBe(0);
    expect(await db.kitConfig.count()).toBe(0);
  });

  it('reports an unknown id instead of throwing', async () => {
    const result = await purgeClient(db, 'nope', 'anything');
    expect(result.ok).toBe(false);
  });
});

describe('data boundaries', () => {
  it('has no schema field for end-customer identity', async () => {
    const created = await create();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const row = await db.client.findUniqueOrThrow({ where: { id: created.data.id } });
    const fields = Object.keys(row).map((k) => k.toLowerCase());

    // Contact fields must be owner-scoped only.
    for (const field of fields) {
      if (field.includes('phone') || field.includes('email') || field.includes('name')) {
        expect(
          field.startsWith('owner') || field === 'businessname' || field === 'arealabel',
          `unexpected identity-like field: ${field}`,
        ).toBe(true);
      }
    }
    expect(fields).toContain('ownerphone');
    expect(fields).not.toContain('customerphone');
    expect(fields).not.toContain('customername');
  });
});
