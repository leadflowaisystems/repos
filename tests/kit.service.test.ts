import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import {
  getKitView,
  saveKitConfig,
  saveReviewLink,
  setKitInstalled,
} from '@/lib/kit/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('kit-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const URL_OK = 'https://example.com/review/sunrise';

async function makeClient(vertical: string, businessName: string) {
  const result = await createClient(
    db,
    validClientInput({ vertical, businessName }),
  );
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

function config(overrides: Record<string, unknown> = {}) {
  return {
    qrTargetUrl: URL_OK,
    displayName: '',
    headline: '',
    subhead: '',
    footerNote: '',
    brandPrimary: '#1F3A5F',
    brandSecondary: '#C9A227',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('kit view — missing link state', () => {
  it('reports NEEDS ONE THING for a brand new client', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const view = await getKitView(db, id);

    expect(view).not.toBeNull();
    expect(view?.readiness.ready).toBe(false);
    expect(view?.readiness.label).toBe('NEEDS ONE THING');
    expect(view?.readiness.blockers[0]?.key).toBe('reviewUrl');
    expect(view?.qr.ok).toBe(false);
  });

  it('still produces full vertical copy so the operator can preview it', async () => {
    const id = await makeClient('restaurant', 'Corner Cafe');
    const view = await getKitView(db, id);

    expect(view?.content.headline).toBe('How was the food today?');
    expect(view?.content.assetLabel).toBe('table card');
    expect(view?.content.messages.length).toBeGreaterThan(0);
    expect(view?.content.reviewUrl).toBeNull();
  });

  it('returns null for an unknown client instead of throwing', async () => {
    expect(await getKitView(db, 'does-not-exist')).toBeNull();
  });
});

describe('kit view — supplied link state', () => {
  it('becomes READY and renders a QR once a link is saved', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const saved = await saveReviewLink(db, id, URL_OK);
    expect(saved.ok).toBe(true);

    const view = await getKitView(db, id);
    expect(view?.readiness.ready).toBe(true);
    expect(view?.readiness.label).toBe('READY');
    expect(view?.qr.ok).toBe(true);
    if (view?.qr.ok) {
      expect(view.qr.svg.startsWith('<svg')).toBe(true);
      expect(view.qr.url).toBe(URL_OK);
    }
  });

  it('reuses the review link already on the client record', async () => {
    const result = await createClient(
      db,
      validClientInput({ reviewLinkUrl: URL_OK }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // No kit-specific setup at all, yet the kit is ready: the operator is never
    // asked for the same URL twice.
    const view = await getKitView(db, result.data.id);
    expect(view?.readiness.ready).toBe(true);
    expect(view?.qr.ok).toBe(true);
  });

  it('keeps the client record in step when the link is set from the kit', async () => {
    const id = await makeClient('salon', 'Glow Salon');
    await saveReviewLink(db, id, URL_OK);

    const client = await db.client.findUniqueOrThrow({ where: { id } });
    expect(client.reviewLinkUrl).toBe(URL_OK);
  });

  it('rejects an unsafe link and stores nothing', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const result = await saveReviewLink(db, id, 'javascript:alert(1)');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.qrTargetUrl).toContain('https://');
    expect(await db.kitConfig.count({ where: { qrTargetUrl: { not: '' } } })).toBe(0);
  });

  it('rejects a link that is not a link at all', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    expect((await saveReviewLink(db, id, 'my review page')).ok).toBe(false);
  });

  it('reports an unknown client instead of throwing', async () => {
    expect((await saveReviewLink(db, 'nope', URL_OK)).ok).toBe(false);
  });
});

describe('kit configuration', () => {
  it('saves operator overrides and reflects them in the content', async () => {
    const id = await makeClient('clinic', 'Sunrise Dental Clinic');
    const result = await saveKitConfig(
      db,
      id,
      config({
        displayName: 'Sunrise Dental',
        headline: 'How was your visit today?',
        brandPrimary: '#123456',
      }),
    );
    expect(result.ok).toBe(true);

    const view = await getKitView(db, id);
    expect(view?.content.displayName).toBe('Sunrise Dental');
    expect(view?.content.headline).toBe('How was your visit today?');
    expect(view?.brandPrimary).toBe('#123456');
    expect(view?.content.messages[0]?.body).toContain('Sunrise Dental');
  });

  it('falls back to vertical defaults when overrides are blank', async () => {
    const id = await makeClient('salon', 'Glow Salon');
    await saveKitConfig(db, id, config());

    const view = await getKitView(db, id);
    expect(view?.content.headline).toBe('Happy with how it turned out?');
    expect(view?.content.displayName).toBe('Glow Salon');
  });

  it('rejects a malformed brand colour', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const result = await saveKitConfig(db, id, config({ brandPrimary: 'blue' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.brandPrimary).toContain('hex');
  });

  it('rejects a malformed destination but accepts a deliberately blank one', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    expect((await saveKitConfig(db, id, config({ qrTargetUrl: 'nope' }))).ok).toBe(false);
    expect((await saveKitConfig(db, id, config({ qrTargetUrl: '' }))).ok).toBe(true);
  });

  it('normalises the stored URL so QR and copy-link always agree', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    await saveKitConfig(db, id, config({ qrTargetUrl: '  https://example.com/r  ' }));

    const stored = await db.kitConfig.findUniqueOrThrow({ where: { clientId: id } });
    expect(stored.qrTargetUrl).toBe('https://example.com/r');

    const view = await getKitView(db, id);
    if (view?.qr.ok) expect(view.qr.url).toBe(stored.qrTargetUrl);
  });
});

describe('kit installed tracking', () => {
  it('records and clears the installed date', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const when = new Date('2026-03-01T00:00:00.000Z');

    await setKitInstalled(db, id, true, when);
    expect((await getKitView(db, id))?.kitInstalledDate?.toISOString()).toBe(
      when.toISOString(),
    );

    await setKitInstalled(db, id, false);
    expect((await getKitView(db, id))?.kitInstalledDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Universal architecture: three real verticals, one code path.
// ---------------------------------------------------------------------------

describe('same workflow across clinic, salon and restaurant', () => {
  const VERTICALS = [
    { vertical: 'clinic', name: 'Sunrise Clinic', expectHeadline: 'Was today’s visit helpful?', asset: 'counter card' },
    { vertical: 'salon', name: 'Glow Salon', expectHeadline: 'Happy with how it turned out?', asset: 'counter card' },
    { vertical: 'restaurant', name: 'Corner Cafe', expectHeadline: 'How was the food today?', asset: 'table card' },
  ];

  it('takes every vertical through create -> add link -> ready kit identically', async () => {
    for (const spec of VERTICALS) {
      await resetDb(db);

      // 1. Create the client — same service call for every vertical.
      const id = await makeClient(spec.vertical, spec.name);

      // 2. Brand new client: not ready, one thing missing.
      const before = await getKitView(db, id);
      expect(before?.readiness.label, spec.vertical).toBe('NEEDS ONE THING');

      // 3. Add the link — same service call for every vertical.
      expect((await saveReviewLink(db, id, URL_OK)).ok, spec.vertical).toBe(true);

      // 4. Ready, with a QR — same service call for every vertical.
      const after = await getKitView(db, id);
      expect(after?.readiness.ready, spec.vertical).toBe(true);
      expect(after?.qr.ok, spec.vertical).toBe(true);

      // 5. …but the content is the trade's own language.
      expect(after?.content.headline, spec.vertical).toBe(spec.expectHeadline);
      expect(after?.content.assetLabel, spec.vertical).toBe(spec.asset);
      expect(after?.verticalLabel, spec.vertical).toBeTruthy();
    }
  });

  it('produces different copy but an identical result shape', async () => {
    const views = [];
    for (const spec of VERTICALS) {
      await resetDb(db);
      const id = await makeClient(spec.vertical, spec.name);
      await saveReviewLink(db, id, URL_OK);
      views.push(await getKitView(db, id));
    }

    const shapes = views.map((v) => Object.keys(v ?? {}).sort().join(','));
    expect(new Set(shapes).size).toBe(1); // one shape

    const headlines = views.map((v) => v?.content.headline);
    expect(new Set(headlines).size).toBe(3); // three voices
  });

  it('stores no customer personal data for any vertical', async () => {
    for (const spec of VERTICALS) {
      await resetDb(db);
      const id = await makeClient(spec.vertical, spec.name);
      await saveReviewLink(db, id, URL_OK);

      const view = await getKitView(db, id);
      const blob = JSON.stringify(view).toLowerCase();
      expect(blob, spec.vertical).not.toMatch(/\b\d{10}\b/);
      expect(blob, spec.vertical).not.toContain('customername');
      expect(blob, spec.vertical).not.toContain('customerphone');
    }
  });

  it('is deterministic — reading the same stored kit twice matches exactly', async () => {
    const id = await makeClient('restaurant', 'Corner Cafe');
    await saveReviewLink(db, id, URL_OK);

    const first = await getKitView(db, id);
    const second = await getKitView(db, id);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
