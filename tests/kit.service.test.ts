import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import {
  getKitView,
  saveKitConfig,
  saveReviewLink,
  setKitInstalled,
} from '@/lib/kit/service';
import { getGatewayView, savePublicBaseUrl, savePublicReviewUrl } from '@/lib/gateway/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * THE PRINTED KIT (M3, rebuilt around the feedback gateway in M17).
 *
 * Until M17 the kit's QR encoded whatever public review link the operator had
 * pasted in, while the words printed above it said "tell us honestly — good or
 * bad". A customer read a promise of a private channel and was handed a public
 * one, and a business with no public listing could not print a card at all.
 *
 * These tests hold the corrected rule: there is ONE address on every printed
 * piece RepOS produces, it is the client's own feedback page, and a public
 * review link is optional and never the QR.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('kit-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  await savePublicBaseUrl(db, BASE);
});

afterAll(async () => {
  await db.$disconnect();
});

const BASE = 'https://repos.example.com';
const URL_OK = 'https://example.com/review/sunrise';

async function makeClient(vertical: string, businessName: string) {
  const result = await createClient(db, validClientInput({ vertical, businessName }));
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

describe('the card carries the feedback page, and only that', () => {
  it('is ready to print the moment the client exists', async () => {
    // No public review link, no listing, no account anywhere.
    const id = await makeClient('restaurant', 'Corner Cafe');
    const view = await getKitView(db, id);

    expect(view?.readiness.ready).toBe(true);
    expect(view?.readiness.label).toBe('READY');
    expect(view?.qr.ok).toBe(true);
  });

  it('encodes this client’s own feedback address', async () => {
    const id = await makeClient('restaurant', 'Corner Cafe');
    const view = await getKitView(db, id);
    const gateway = await getGatewayView(db, id, { requestOrigin: null });

    expect(view?.content.feedbackUrl).toBe(gateway?.feedbackUrl);
    expect(view?.content.feedbackUrl?.startsWith(`${BASE}/feedback/`)).toBe(true);
    if (view?.qr.ok) expect(view.qr.url).toBe(gateway?.feedbackUrl);
  });

  it('encodes the same address as the feedback card and the on-screen QR', async () => {
    // Four surfaces, one URL: the operator's QR tab, the printed feedback card,
    // the printed kit, and the downloadable image all come from these two.
    const id = await makeClient('salon', 'Glow Salon');
    const kit = await getKitView(db, id);
    const gateway = await getGatewayView(db, id, { requestOrigin: null });

    expect(kit?.qr.ok && gateway?.qr).toBeTruthy();
    if (kit?.qr.ok) expect(kit.qr.url).toBe(gateway?.qr?.url);
  });

  it('never encodes the public review link, even when one is saved', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    await savePublicReviewUrl(db, id, URL_OK);
    const view = await getKitView(db, id);

    expect(view?.content.publicReviewUrl).toBe(URL_OK);
    if (view?.qr.ok) {
      expect(view.qr.url).not.toBe(URL_OK);
      expect(view.qr.url).toContain('/feedback/');
    }
  });

  it('points every copyable message at the feedback page', async () => {
    const id = await makeClient('restaurant', 'Corner Cafe');
    await savePublicReviewUrl(db, id, URL_OK);
    const view = await getKitView(db, id);

    expect(view?.content.messages.length).toBeGreaterThan(0);
    for (const message of view!.content.messages) {
      expect(message.body).toContain('/feedback/');
      expect(message.body).not.toContain(URL_OK);
      expect(message.body).not.toContain('{{');
    }
  });

  it('produces no QR at all when the installation has no address', async () => {
    // A printed card cannot be recalled, so RepOS would rather print nothing.
    const id = await makeClient('gym', 'FitZone Gym');
    await savePublicBaseUrl(db, '');
    const view = await getKitView(db, id);

    expect(view?.readiness.ready).toBe(false);
    expect(view?.readiness.blockers[0]?.key).toBe('feedbackUrl');
    expect(view?.qr.ok).toBe(false);
    expect(view?.addressError).not.toBeNull();
  });

  it('still produces full vertical copy so the operator can preview it', async () => {
    const id = await makeClient('restaurant', 'Corner Cafe');
    const view = await getKitView(db, id);

    expect(view?.content.headline).toBe('How was the food today?');
    expect(view?.content.assetLabel).toBe('table card');
    expect(view?.content.messages.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown client instead of throwing', async () => {
    expect(await getKitView(db, 'does-not-exist')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('the optional public review link is one value everywhere', () => {
  it('shows on the kit when it was saved on the Feedback QR page', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    await savePublicReviewUrl(db, id, URL_OK);

    expect((await getKitView(db, id))?.content.publicReviewUrl).toBe(URL_OK);
  });

  it('reaches the customer’s thank-you page when it was saved on the kit', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const saved = await saveReviewLink(db, id, URL_OK);
    expect(saved.ok).toBe(true);

    const gateway = await getGatewayView(db, id, { requestOrigin: null });
    expect(gateway?.publicReviewUrl).toBe(URL_OK);
  });

  it('disappears from both screens when it is cleared from either', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    await saveReviewLink(db, id, URL_OK);
    await savePublicReviewUrl(db, id, '');

    expect((await getKitView(db, id))?.content.publicReviewUrl).toBeNull();
    expect((await getGatewayView(db, id, { requestOrigin: null }))?.publicReviewUrl).toBe('');
  });

  it('refuses a Headway address, so the two paths cannot be crossed', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });

    const result = await saveReviewLink(db, id, gateway!.feedbackUrl);
    expect(result.ok).toBe(false);
  });

  it('says nothing about a public option when there is no link', async () => {
    const id = await makeClient('gym', 'FitZone Gym');
    const view = await getKitView(db, id);

    expect(view?.content.publicReviewUrl).toBeNull();
    expect(view?.content.publicReviewNote).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('kit settings', () => {
  it('saves the operator’s wording and keeps the card printable', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const saved = await saveKitConfig(
      db,
      id,
      config({ displayName: 'Sunrise', headline: 'How did we do?' }),
    );
    expect(saved.ok).toBe(true);

    const view = await getKitView(db, id);
    expect(view?.content.displayName).toBe('Sunrise');
    expect(view?.content.headline).toBe('How did we do?');
    expect(view?.readiness.ready).toBe(true);
  });

  it('rejects a colour that is not a colour', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    const saved = await saveKitConfig(db, id, config({ brandPrimary: 'not-a-colour' }));
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.errors.brandPrimary).toBeTruthy();
  });

  it('records and clears the on-site date', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    await setKitInstalled(db, id, true);
    expect((await getKitView(db, id))?.kitInstalledDate).not.toBeNull();

    await setKitInstalled(db, id, false);
    expect((await getKitView(db, id))?.kitInstalledDate).toBeNull();
  });

  it('tells the operator when the feedback page is paused', async () => {
    const id = await makeClient('clinic', 'Sunrise Clinic');
    await db.feedbackGateway.update({ where: { clientId: id }, data: { enabled: false } });

    const view = await getKitView(db, id);
    expect(view?.gatewayPaused).toBe(true);
    // The cards still print — the operator is told, not blocked.
    expect(view?.readiness.ready).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('one client can never reach another client’s card', () => {
  it('gives every client its own feedback address', async () => {
    const cafe = await makeClient('restaurant', 'Corner Cafe');
    const salon = await makeClient('salon', 'Glow Salon');

    const cafeView = await getKitView(db, cafe);
    const salonView = await getKitView(db, salon);

    expect(cafeView?.content.feedbackUrl).not.toBe(salonView?.content.feedbackUrl);
    if (cafeView?.qr.ok && salonView?.qr.ok) {
      expect(cafeView.qr.url).not.toBe(salonView.qr.url);
    }
  });

  it('keeps one client’s public review link off another client’s card', async () => {
    const cafe = await makeClient('restaurant', 'Corner Cafe');
    const salon = await makeClient('salon', 'Glow Salon');
    await savePublicReviewUrl(db, cafe, URL_OK);

    expect((await getKitView(db, salon))?.content.publicReviewUrl).toBeNull();
  });

  it('gives every client its own vertical wording', async () => {
    const cafe = await makeClient('restaurant', 'Corner Cafe');
    const clinic = await makeClient('clinic', 'Sunrise Clinic');

    const cafeView = await getKitView(db, cafe);
    const clinicView = await getKitView(db, clinic);

    expect(cafeView?.content.headline).not.toBe(clinicView?.content.headline);
    expect(cafeView?.content.assetLabel).toBe('table card');
  });
});
