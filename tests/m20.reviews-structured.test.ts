import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { _resetGatewayThrottles, ensureGateway, submitCustomerFeedback } from '@/lib/gateway/service';
import { getReviewsView } from '@/lib/portal/service';
import type { ReviewFilters } from '@/lib/portal/pages';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * WHAT THE CUSTOMER GAVE REACHES THE OWNER'S SCREEN (launch pass).
 *
 * The gateway has stored a rating per part of the visit and the specifics a
 * customer tapped since M19, and `getFeedbackItem` resolved them to labels —
 * but the Reviews page is built from `listClientFeedback`, which was never
 * handed the pack, so every row on the page carried `answers: []` and an
 * owner saw "A rating only" under a customer who had rated five things.
 *
 * These tests go through the same view the page renders from, so the property
 * holds where the owner looks rather than one call below it.
 */

function filters(overrides: Partial<ReviewFilters> = {}): ReviewFilters {
  return { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null, ...overrides };
}

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m20-reviews-structured');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');

async function restaurant() {
  const created = await createClient(
    db,
    validClientInput({ businessName: 'Anand Tiffin', vertical: 'restaurant' }),
  );
  if (!created.ok) throw new Error('fixture client failed');
  const gateway = await ensureGateway(db, created.data.id);
  if (!gateway) throw new Error('fixture gateway failed');
  return { clientId: created.data.id, token: gateway.publicToken };
}

describe('the reviews page', () => {
  it('shows exactly what the customer tapped, in the words of the pack', async () => {
    const { clientId, token } = await restaurant();
    const submitted = await submitCustomerFeedback(db, token, {
      stars: 2,
      text: '',
      dimensions: { waiting: 1, food: 4 },
      signals: ['for_food'],
    });
    expect(submitted.ok).toBe(true);

    const view = await getReviewsView(db, clientId, filters(), { page: 1 });
    expect(view).not.toBeNull();
    const item = view!.items.find((i) => i.stars === 2);
    expect(item).toBeDefined();

    // The customer's own input, untouched: nothing written, two parts rated.
    expect(item!.text).toBe('');
    expect(item!.read).toBe(false);
    expect(item!.gave.dimensions).toEqual(
      expect.arrayContaining([
        { label: 'Food and drink', rating: 4 },
        { label: 'Waiting', rating: 1 },
      ]),
    );
    expect(item!.gave.dimensions).toHaveLength(2);
    expect(item!.gave.selected).toEqual(['For the food']);
  });

  it('shows nothing tapped for a pasted review, rather than inventing it', async () => {
    const { clientId } = await restaurant();
    const imported = await importFeedbackBatch(db, clientId, {
      raw: '5 stars Lovely dosa and the staff were quick',
      source: 'PUBLIC_REVIEW',
      referenceDate: REF,
    });
    expect(imported.ok).toBe(true);

    const view = await getReviewsView(db, clientId, filters(), { page: 1 });
    expect(view!.items).toHaveLength(1);
    expect(view!.items[0]!.gave).toEqual({ dimensions: [], selected: [] });
    expect(view!.items[0]!.text).toContain('Lovely dosa');
  });

  it('filters by a single star rating and counts every rating for the strip', async () => {
    const { clientId, token } = await restaurant();
    const low = await submitCustomerFeedback(db, token, {
      stars: 2,
      text: '',
      dimensions: { waiting: 1 },
      signals: [],
    });
    expect(low.ok).toBe(true);
    const imported = await importFeedbackBatch(db, clientId, {
      raw: '5 stars Lovely dosa and the staff were quick',
      source: 'PUBLIC_REVIEW',
      referenceDate: REF,
    });
    expect(imported.ok).toBe(true);

    const all = await getReviewsView(db, clientId, filters(), { page: 1 });
    expect(all!.total).toBe(2);
    expect(all!.ratings.map((r) => r.stars).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(all!.ratings.find((r) => r.stars === 2)?.count).toBe(1);
    expect(all!.ratings.find((r) => r.stars === 5)?.count).toBe(1);
    expect(all!.ratings.find((r) => r.stars === 3)?.count).toBe(0);

    const twos = await getReviewsView(db, clientId, filters({ stars: 2 }), { page: 1 });
    expect(twos!.items).toHaveLength(1);
    expect(twos!.items[0]!.stars).toBe(2);
    expect(twos!.items[0]!.gave.dimensions).toEqual([{ label: 'Waiting', rating: 1 }]);

    const fives = await getReviewsView(db, clientId, filters({ stars: 5 }), { page: 1 });
    expect(fives!.items).toHaveLength(1);
    expect(fives!.items[0]!.stars).toBe(5);
  });
});
