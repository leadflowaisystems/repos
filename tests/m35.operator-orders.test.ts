import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE OPERATOR'S ORDERS PAGE (M35).
 *
 * A cross-client list and a detail page, neither of which filters by client.
 * That is deliberate and it is the thing most worth testing: the scope comes
 * from the `tenant_isolation` policy on `KitOrder`, so the SAME function must
 * answer differently depending on who is asking. Tested against the real
 * schema, the real `prisma/m20/rls.sql`, and the same non-superuser role
 * production connects as.
 *
 *   1. The operator — a member of nothing — sees every business's orders.
 *   2. A business owner asking the same question sees only their own, and
 *      cannot open somebody else's order by id.
 *   3. The quantities are the ones ordered.
 *   4. The unit prices are the ones stored.
 *   5. The totals are the server's, and add up.
 *   6. An order placed at the old price still reads at the old price.
 *   7. The KIT ORDERED badge still works.
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

let orders: typeof import('@/lib/kit/orders');
let clients: typeof import('@/lib/clients/service');
let actions: typeof import('@/lib/actions/kit');
let shared: typeof import('@/lib/actions/shared');

let seeded: { alphaClient: string; betaClient: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m35-operator-orders');
  owner = harness.owner;

  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

  orders = await import('@/lib/kit/orders');
  clients = await import('@/lib/clients/service');
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

/** Alpha orders 3 stands and 5 tents; Beta orders 2 tents. */
async function seedOrders() {
  session = { id: AUTH.alpha };
  await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '3', 'folded-tent': '5' }));
  session = { id: AUTH.beta };
  await place(orderForm(seeded.betaClient, { 'folded-tent': '2' }));
  session = null;
}

const asOperator = async () => {
  session = { id: AUTH.operator };
  return orders.listAllKitOrders(app);
};

// ---------------------------------------------------------------------------
// 1. The operator sees the orders they are allowed to see
// ---------------------------------------------------------------------------

describe('1. the operator sees every business’s orders', () => {
  it('lists orders from more than one business, with the business name on each', async () => {
    await seedOrders();

    const all = await asOperator();
    expect(all).toHaveLength(2);
    expect(all.map((o) => o.businessName).sort()).toEqual(['Alpha Cafe', 'Beta Salon']);
  });

  it('is a member of nothing, and still sees them', async () => {
    await seedOrders();
    const memberships = await owner.membership.count({
      where: { user: { authProviderId: AUTH.operator } },
    });
    expect(memberships).toBe(0);
    expect(await asOperator()).toHaveLength(2);
  });

  it('lists newest first', async () => {
    await seedOrders();
    const all = await asOperator();
    expect(all[0]?.businessName).toBe('Beta Salon');
    expect(all[0]!.placedAt.getTime()).toBeGreaterThanOrEqual(all[1]!.placedAt.getTime());
  });

  it('can open any of them by id', async () => {
    await seedOrders();
    const all = await asOperator();
    for (const listed of all) {
      session = { id: AUTH.operator };
      const one = await orders.getKitOrder(app, listed.id);
      expect(one?.id).toBe(listed.id);
      expect(one?.businessName).toBe(listed.businessName);
      expect(one?.totalInr).toBe(listed.totalInr);
    }
  });

  it('still shows an order after its business has been archived', async () => {
    // An order is work somebody owes. Archiving the business does not undo it.
    await seedOrders();
    await owner.client.update({
      where: { id: seeded.alphaClient },
      data: { archivedAt: NOW },
    });
    const all = await asOperator();
    expect(all.map((o) => o.businessName).sort()).toEqual(['Alpha Cafe', 'Beta Salon']);
  });
});

// ---------------------------------------------------------------------------
// 2. Orders the caller is not allowed to see are not exposed
// ---------------------------------------------------------------------------

describe('2. a business never sees another business’s orders through these functions', () => {
  it('answers the SAME unfiltered question with only their own rows', async () => {
    await seedOrders();

    session = { id: AUTH.alpha };
    const alphaSees = await orders.listAllKitOrders(app);
    expect(alphaSees.map((o) => o.businessName)).toEqual(['Alpha Cafe']);

    session = { id: AUTH.beta };
    const betaSees = await orders.listAllKitOrders(app);
    expect(betaSees.map((o) => o.businessName)).toEqual(['Beta Salon']);
  });

  it('cannot open another business’s order by id — it is simply not found', async () => {
    await seedOrders();
    const all = await asOperator();
    const alphaOrder = all.find((o) => o.businessName === 'Alpha Cafe');
    expect(alphaOrder).toBeTruthy();

    session = { id: AUTH.beta };
    expect(await orders.getKitOrder(app, alphaOrder!.id)).toBeNull();
  });

  it('tells a stranger nothing at all', async () => {
    await seedOrders();
    const all = await asOperator();

    session = null;
    expect(await orders.listAllKitOrders(app)).toEqual([]);
    expect(await orders.getKitOrder(app, all[0]!.id)).toBeNull();
  });

  it('does it with a policy, not with a where clause the page could forget', async () => {
    const service = readFileSync(
      join(resolve(__dirname, '..'), 'src', 'lib', 'kit', 'orders.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const listAll = service.slice(
      service.indexOf('export async function listAllKitOrders'),
      service.indexOf('export async function getKitOrder'),
    );
    expect(listAll.length).toBeGreaterThan(50);
    expect(listAll).not.toContain('clientId:');
    expect(listAll).toContain('db.kitOrder.findMany');
  });
});

// ---------------------------------------------------------------------------
// 3, 4 and 5. Quantities, stored prices, totals
// ---------------------------------------------------------------------------

describe('3, 4 & 5. the quantities, prices and totals are the stored ones', () => {
  it('reports the quantities that were ordered, per product', async () => {
    await seedOrders();
    const all = await asOperator();
    const alpha = all.find((o) => o.businessName === 'Alpha Cafe')!;
    const beta = all.find((o) => o.businessName === 'Beta Salon')!;

    expect(orders.orderedQuantity(alpha, 'card-qr-stand')).toBe(3);
    expect(orders.orderedQuantity(alpha, 'folded-tent')).toBe(5);

    expect(orders.orderedQuantity(beta, 'card-qr-stand')).toBe(0);
    expect(orders.orderedQuantity(beta, 'folded-tent')).toBe(2);
  });

  it('carries the unit price each line was actually priced at', async () => {
    await seedOrders();
    const alpha = (await asOperator()).find((o) => o.businessName === 'Alpha Cafe')!;
    expect(alpha.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 3, unitPriceInr: 99, lineTotalInr: 297 },
      { productKey: 'folded-tent', quantity: 5, unitPriceInr: 49, lineTotalInr: 245 },
    ]);
  });

  it('totals to the sum of the lines, and to the server’s figure', async () => {
    await seedOrders();
    const all = await asOperator();
    for (const order of all) {
      const summed = order.lines.reduce((n, line) => n + line.lineTotalInr, 0);
      expect(order.totalInr).toBe(summed);
    }
    const alpha = all.find((o) => o.businessName === 'Alpha Cafe')!;
    expect(alpha.totalInr).toBe(3 * 99 + 5 * 49);
    expect(alpha.totalInr).toBe(542);
  });

  it('matches the row in the database, byte for byte', async () => {
    await seedOrders();
    const alpha = (await asOperator()).find((o) => o.businessName === 'Alpha Cafe')!;
    const row = await owner.kitOrder.findUniqueOrThrow({
      where: { id: alpha.id },
      select: { itemsJson: true, totalInr: true, number: true, status: true },
    });
    expect(row.totalInr).toBe(alpha.totalInr);
    expect(row.number).toBe(alpha.number);
    expect(row.status).toBe(alpha.status);
    expect(JSON.parse(row.itemsJson)).toEqual(alpha.lines);
  });

  it('gives the detail page the same figures as the list', async () => {
    await seedOrders();
    const listed = (await asOperator()).find((o) => o.businessName === 'Alpha Cafe')!;
    session = { id: AUTH.operator };
    const detail = await orders.getKitOrder(app, listed.id);
    expect(detail).toEqual(listed);
  });
});

// ---------------------------------------------------------------------------
// 6. Historical prices
// ---------------------------------------------------------------------------

describe('6. an order placed at the old price still reads at the old price', () => {
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

  it('shows ₹100 and ₹50 on the operator list, with the catalogue at ₹99 and ₹49', async () => {
    expect(KIT_PRODUCTS.map((p) => p.priceInr)).toEqual([99, 49]);
    await storeHistoricalOrder(seeded.alphaClient);

    const [historical] = await asOperator();
    expect(historical?.totalInr).toBe(350);
    expect(historical?.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 100, lineTotalInr: 200 },
      { productKey: 'folded-tent', quantity: 3, unitPriceInr: 50, lineTotalInr: 150 },
    ]);
  });

  it('shows the same on the detail page', async () => {
    await storeHistoricalOrder(seeded.alphaClient);
    const [listed] = await asOperator();
    session = { id: AUTH.operator };
    const detail = await orders.getKitOrder(app, listed!.id);
    expect(detail?.lines[0]?.unitPriceInr).toBe(100);
    expect(detail?.lines[1]?.unitPriceInr).toBe(50);
    expect(detail?.totalInr).toBe(350);
  });

  it('sits beside a new order without either changing the other', async () => {
    await storeHistoricalOrder(seeded.alphaClient);
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '2', 'folded-tent': '3' }));

    const all = await asOperator();
    expect(all).toHaveLength(2);
    // Newest first: the new one at today's prices, the old one at its own.
    expect(all[0]?.totalInr).toBe(345);
    expect(all[1]?.totalInr).toBe(350);
  });

  it('is not rewritten by being read', async () => {
    await storeHistoricalOrder(seeded.alphaClient);
    const before = await owner.kitOrder.findFirstOrThrow({
      select: { itemsJson: true, totalInr: true, updatedAt: true },
    });
    await asOperator();
    await asOperator();
    const [listed] = await asOperator();
    session = { id: AUTH.operator };
    await orders.getKitOrder(app, listed!.id);

    const after = await owner.kitOrder.findFirstOrThrow({
      select: { itemsJson: true, totalInr: true, updatedAt: true },
    });
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// 7. The badge still works
// ---------------------------------------------------------------------------

describe('7. the KIT ORDERED badge is untouched', () => {
  it('still counts each business’s own orders', async () => {
    await seedOrders();
    session = { id: AUTH.operator };
    const list = new Map((await clients.listClients(app)).map((row) => [row.id, row]));
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(1);
    expect(list.get(seeded.betaClient)?.openKitOrderCount).toBe(1);
  });

  it('is still zero for a business that has not ordered', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    session = { id: AUTH.operator };
    const list = new Map((await clients.listClients(app)).map((row) => [row.id, row]));
    expect(list.get(seeded.alphaClient)?.openKitOrderCount).toBe(1);
    expect(list.get(seeded.betaClient)?.openKitOrderCount).toBe(0);
  });

  it('still renders from the same condition, in both operator places', () => {
    const root = resolve(__dirname, '..');
    const list = readFileSync(join(root, 'src', 'app', '(app)', 'clients', 'page.tsx'), 'utf8');
    const layout = readFileSync(
      join(root, 'src', 'app', '(app)', 'clients', '[id]', 'layout.tsx'),
      'utf8',
    );
    expect(list).toContain('{client.openKitOrderCount > 0 ? (');
    expect(list).toContain('<Badge tone="brand">Kit ordered</Badge>');
    expect(layout).toContain('{client._count.kitOrders > 0 ? (');
    expect(layout).toContain('<Badge tone="brand">Kit ordered</Badge>');
  });
});

// ---------------------------------------------------------------------------
// The pages themselves
// ---------------------------------------------------------------------------

describe('the operator orders pages', () => {
  const root = resolve(__dirname, '..');
  const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const LIST = code(read('src', 'app', '(app)', 'orders', 'page.tsx'));
  const DETAIL = code(read('src', 'app', '(app)', 'orders', '[orderId]', 'page.tsx'));
  const NAV = code(read('src', 'components', 'nav.tsx'));

  it('adds Orders to the operator nav, without moving the others', () => {
    const block = NAV.slice(NAV.indexOf('const ITEMS'), NAV.indexOf('] as const'));
    const labels = [...block.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    expect(labels).toEqual(['Dashboard', 'Clients', 'Orders', 'Minutes', 'Settings']);
    expect(NAV).toContain("{ href: '/orders', label: 'Orders' }");
  });

  it('shows every field the operator needs to scan', () => {
    expect(LIST).toContain('order.businessName');
    expect(LIST).toContain('String(order.number).padStart(3, ');
    expect(LIST).toContain('formatDate(order.placedAt)');
    expect(LIST).toContain('orderedQuantity(order, product.key)');
    expect(LIST).toContain('formatRupees(order.totalInr)');
    expect(LIST).toContain('KIT_PRODUCTS.map');
  });

  it('shows every field the operator needs to pack an order', () => {
    for (const field of [
      'order.businessName',
      'formatNumber(line.quantity)',
      'formatRupees(line.unitPriceInr)',
      'formatRupees(line.lineTotalInr)',
      'formatRupees(order.totalInr)',
    ]) {
      expect(DETAIL, field).toContain(field);
    }
    expect(DETAIL).toContain('order.lines.map');
  });

  it('never recomputes money from the catalogue', () => {
    for (const page of [LIST, DETAIL]) {
      expect(page).not.toContain('priceOrder');
      expect(page).not.toContain('priceInr}');
      expect(page).not.toMatch(/product\.priceInr/);
    }
  });

  it('leans on the layout guard rather than inventing its own', () => {
    // Every page under (app) is behind requireOperator() in the group layout,
    // and not one of them checks for itself. These two are the same.
    for (const page of [LIST, DETAIL]) {
      expect(page).not.toContain('requireOperator');
      expect(page).not.toContain('currentActor');
      expect(page).not.toContain('isPlatformAdmin');
    }
    expect(code(read('src', 'app', '(app)', 'layout.tsx'))).toContain('await requireOperator()');
  });

  it('treats a missing order and somebody else’s order the same way', () => {
    expect(DETAIL).toContain('if (!order) notFound()');
  });

  it('is rendered fresh, like every other operator page', () => {
    for (const page of [LIST, DETAIL]) {
      expect(page).toContain("export const dynamic = 'force-dynamic'");
    }
  });

  it('names each product once, from the catalogue', () => {
    expect(KIT_PRODUCTS.map((p) => p.shortName)).toEqual([
      'Card + QR Stand',
      'Folded Tent Card',
    ]);
    expect(LIST).toContain('product.shortName');
    expect(DETAIL).toContain('product.shortName');
  });
});
