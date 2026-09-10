import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE OPERATOR'S "KIT ORDERED" BADGE, AND THE ORDERS IT IS DERIVED FROM (M34).
 *
 * The badge is a claim about the database — this business has ordered a
 * printed kit — so it is tested against one: the real schema, the real
 * `prisma/m20/rls.sql`, and the same non-superuser role production connects
 * as. A badge that lit up from a stored flag, a cached number or anything a
 * browser could reach would be a different feature with the same picture.
 *
 * What is proved here:
 *
 *   * A business that has ordered comes back with a count above zero, and one
 *     that has not comes back with zero. That is the whole badge.
 *   * One business's order never raises another's count — checked with the
 *     rows actually in the database, not with a filter in a component.
 *   * The operator, who is a member of nothing, still sees every count, which
 *     is what makes the list useful at all.
 *   * AND THE PRICE CHANGE DOES NOT REACH BACK: an order stored at ₹100/₹50
 *     still reads ₹100/₹50 through the live code, with the catalogue now
 *     saying ₹99/₹49.
 */

let session: { id: string } | null = null;

vi.mock('@/lib/auth/supabase', () => ({
  SUPABASE_URL_VAR: 'SUPABASE_URL',
  SUPABASE_ANON_KEY_VAR: 'SUPABASE_ANON_KEY',
  supabaseConfig: () => ({ ok: true, config: { url: 'http://localhost', anonKey: 'test' } }),
  isSupabaseConfigured: () => true,
  supabaseServerClient: async () => ({
    auth: {
      getUser: async () =>
        session
          ? { data: { user: { id: session.id } }, error: null }
          : { data: { user: null }, error: null },
    },
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const AUTH = {
  operator: '11111111-1111-4111-8111-111111111111',
  alpha: '22222222-2222-4222-8222-222222222222',
  beta: '33333333-3333-4333-8333-333333333333',
} as const;

const NOW = new Date('2026-09-10T06:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let clients: typeof import('@/lib/clients/service');
let orders: typeof import('@/lib/kit/orders');
let actions: typeof import('@/lib/actions/kit');
let shared: typeof import('@/lib/actions/shared');

let seeded: { alphaClient: string; betaClient: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m34-operator-badge');
  owner = harness.owner;

  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

  clients = await import('@/lib/clients/service');
  orders = await import('@/lib/kit/orders');
  actions = await import('@/lib/actions/kit');
  shared = await import('@/lib/actions/shared');
  ({ prisma: app } = await import('@/lib/db'));
}, 180_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  session = null;
  await resetDb(owner);

  // The operator is a member of nothing. Every client they can see, they see
  // because they are platform staff.
  await owner.user.create({
    data: { email: 'operator@headway.test', authProviderId: AUTH.operator, isPlatformAdmin: true },
  });
  const alpha = await owner.user.create({
    data: { email: 'owner@alpha.test', authProviderId: AUTH.alpha },
    select: { id: true },
  });
  const beta = await owner.user.create({
    data: { email: 'owner@beta.test', authProviderId: AUTH.beta },
    select: { id: true },
  });

  const trial = {
    status: 'ACTIVE' as const,
    subscriptionStatus: 'TRIAL' as const,
    trialStartsAt: new Date(NOW.getTime() - 5 * DAY),
    trialEndsAt: new Date(NOW.getTime() + 25 * DAY),
  };

  const alphaClient = await owner.client.create({
    data: { businessName: 'Alpha Cafe', vertical: 'restaurant', ...trial },
    select: { id: true },
  });
  const betaClient = await owner.client.create({
    data: { businessName: 'Beta Salon', vertical: 'salon', ...trial },
    select: { id: true },
  });

  await owner.membership.create({
    data: { userId: alpha.id, clientId: alphaClient.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });
  await owner.membership.create({
    data: { userId: beta.id, clientId: betaClient.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });

  seeded = { alphaClient: alphaClient.id, betaClient: betaClient.id };
});

function orderForm(clientId: string, quantities: Record<string, string>) {
  const form = new FormData();
  form.set('clientId', clientId);
  for (const [key, value] of Object.entries(quantities)) form.set(`qty:${key}`, value);
  return form;
}

const place = (form: FormData) => actions.placeKitOrderAction(shared.IDLE, form);

/** The list exactly as /clients builds it, read as the operator. */
async function operatorList() {
  session = { id: AUTH.operator };
  const rows = await clients.listClients(app);
  return new Map(rows.map((row) => [row.id, row]));
}

/** The count the client-detail layout reads, through the same query it uses. */
async function detailCount(clientId: string) {
  session = { id: AUTH.operator };
  const row = await app.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true, _count: { select: { kitOrders: true } } },
  });
  return row?._count.kitOrders ?? null;
}

// ---------------------------------------------------------------------------
// 6 and 7. Badged, and not badged
// ---------------------------------------------------------------------------

describe('6. a business that has ordered comes back with a count', () => {
  it('counts one order as one', async () => {
    session = { id: AUTH.alpha };
    expect((await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '2' }))).ok).toBe(true);

    const list = await operatorList();
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(1);
  });

  it('counts three orders as three, so the badge cannot depend on there being one', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    await place(orderForm(seeded.alphaClient, { 'folded-tent': '2' }));
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '5', 'folded-tent': '5' }));

    const list = await operatorList();
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(3);
  });
});

describe('7. a business that has not ordered comes back with zero', () => {
  it('is zero before anything is ordered', async () => {
    const list = await operatorList();
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(0);
    expect(list.get(seeded.betaClient)?.openKitOrderCount).toBe(0);
  });

  it('is still zero for the business that did not order', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));

    const list = await operatorList();
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(1);
    expect(list.get(seeded.betaClient)?.openKitOrderCount).toBe(0);
  });

  it('goes back to zero if the order is removed, because it is a count and not a flag', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    expect((await operatorList()).get(seeded.alphaClient)?.openKitOrderCount).toBe(1);

    await owner.kitOrder.deleteMany({ where: { clientId: seeded.alphaClient } });
    expect((await operatorList()).get(seeded.alphaClient)?.openKitOrderCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. The detail page
// ---------------------------------------------------------------------------

describe('8. the client-detail header gets the same answer', () => {
  it('counts the business’s own orders and nobody else’s', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    await place(orderForm(seeded.alphaClient, { 'folded-tent': '1' }));

    expect(await detailCount(seeded.alphaClient)).toBe(2);
    expect(await detailCount(seeded.betaClient)).toBe(0);
  });

  it('agrees with the list, so the two screens cannot disagree', async () => {
    session = { id: AUTH.beta };
    await place(orderForm(seeded.betaClient, { 'folded-tent': '3' }));

    const list = await operatorList();
    expect(await detailCount(seeded.betaClient)).toBe(list.get(seeded.betaClient)?.openKitOrderCount);
    expect(await detailCount(seeded.alphaClient)).toBe(list.get(seeded.alphaClient)?.openKitOrderCount);
  });
});

// ---------------------------------------------------------------------------
// 9. One business's order is one business's order
// ---------------------------------------------------------------------------

describe('9. an order cannot raise another business’s badge', () => {
  it('keeps the counts apart when both have ordered different amounts', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    session = { id: AUTH.beta };
    await place(orderForm(seeded.betaClient, { 'folded-tent': '1' }));
    await place(orderForm(seeded.betaClient, { 'folded-tent': '1' }));

    const list = await operatorList();
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(1);
    expect(list.get(seeded.betaClient)?.openKitOrderCount).toBe(2);
  });

  it('cannot be raised by ordering against somebody else’s id', async () => {
    // Beta's owner posting Alpha's id. The gate refuses, so no row is written
    // and neither badge moves.
    session = { id: AUTH.beta };
    expect((await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '9' }))).ok).toBe(false);

    const list = await operatorList();
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(0);
    expect(list.get(seeded.betaClient)?.openKitOrderCount).toBe(0);
  });

  it('shows a business its own count and not the other’s, even signed in as them', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));

    // Alpha's owner is a member of Alpha alone, so the same query returns one
    // row: the policy decides this, not the component.
    session = { id: AUTH.alpha };
    const asAlpha = await clients.listClients(app);
    expect(asAlpha.map((row) => row.id)).toEqual([seeded.alphaClient]);
    expect(asAlpha[0]?.openKitOrderCount).toBe(1);
  });
});

describe('the operator sees every business’s count without being a member of any', () => {
  it('lists both businesses and both counts', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));

    session = { id: AUTH.operator };
    const memberships = await owner.membership.count({
      where: { user: { authProviderId: AUTH.operator } },
    });
    expect(memberships).toBe(0);

    const list = await operatorList();
    expect([...list.keys()].sort()).toEqual([seeded.alphaClient, seeded.betaClient].sort());
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(1);
    expect(list.get(seeded.betaClient)?.openKitOrderCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. The price change does not reach back — against real stored rows
// ---------------------------------------------------------------------------

describe('5. an order placed at the old price still says the old price', () => {
  /** An order as it was written before M34, stored exactly as M33 stored one. */
  async function storeHistoricalOrder(clientId: string) {
    await owner.kitOrder.create({
      data: {
        clientId,
        number: 1,
        status: 'RECEIVED',
        itemsJson: JSON.stringify([
          { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 100, lineTotalInr: 200 },
          { productKey: 'folded-tent', quantity: 3, unitPriceInr: 50, lineTotalInr: 150 },
        ]),
        totalInr: 350,
        createdAt: new Date(NOW.getTime() - 30 * DAY),
        updatedAt: new Date(NOW.getTime() - 30 * DAY),
      },
    });
  }

  it('reads back at ₹100 and ₹50 through the live code', async () => {
    await storeHistoricalOrder(seeded.alphaClient);

    session = { id: AUTH.alpha };
    const [historical] = await orders.listKitOrders(app, seeded.alphaClient);

    expect(historical?.totalInr).toBe(350);
    expect(historical?.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 100, lineTotalInr: 200 },
      { productKey: 'folded-tent', quantity: 3, unitPriceInr: 50, lineTotalInr: 150 },
    ]);
  });

  it('leaves the stored row itself untouched by any read', async () => {
    await storeHistoricalOrder(seeded.alphaClient);
    const before = await owner.kitOrder.findFirstOrThrow({
      where: { clientId: seeded.alphaClient },
      select: { itemsJson: true, totalInr: true, updatedAt: true },
    });

    session = { id: AUTH.alpha };
    await orders.listKitOrders(app, seeded.alphaClient);
    await orders.listKitOrders(app, seeded.alphaClient);
    await operatorList();

    const after = await owner.kitOrder.findFirstOrThrow({
      where: { clientId: seeded.alphaClient },
      select: { itemsJson: true, totalInr: true, updatedAt: true },
    });
    expect(after).toEqual(before);
  });

  it('prices the NEXT order at ₹99 and ₹49 while the old one keeps its own', async () => {
    await storeHistoricalOrder(seeded.alphaClient);

    session = { id: AUTH.alpha };
    expect(
      (await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '2', 'folded-tent': '3' }))).ok,
    ).toBe(true);

    const both = await orders.listKitOrders(app, seeded.alphaClient);
    expect(both).toHaveLength(2);

    const [newest, oldest] = both;
    // Same two products, same two quantities, thirty days apart.
    expect(newest?.totalInr).toBe(345);
    expect(newest?.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 99, lineTotalInr: 198 },
      { productKey: 'folded-tent', quantity: 3, unitPriceInr: 49, lineTotalInr: 147 },
    ]);
    expect(oldest?.totalInr).toBe(350);
    expect(oldest?.lines[0]?.unitPriceInr).toBe(100);
    expect(oldest?.lines[1]?.unitPriceInr).toBe(50);
  });

  it('counts the old order towards the operator’s badge like any other', async () => {
    await storeHistoricalOrder(seeded.alphaClient);
    expect((await operatorList()).get(seeded.alphaClient)?.openKitOrderCount).toBe(1);
  });
});
