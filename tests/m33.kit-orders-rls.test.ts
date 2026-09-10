import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * WHOSE ORDER IS THIS? (M33, tests 10–16.)
 *
 * Every claim here is a claim about the DATABASE, so it is tested against one:
 * the real schema, `prisma/m20/rls.sql` applied verbatim, and the same
 * non-superuser role production connects as. "A business only sees its own
 * orders" is worth nothing if the only thing enforcing it is a page that
 * declines to render somebody else's.
 *
 * The claims:
 *
 *   10. An order is stored against the business that placed it.
 *   11. That business reads it back.
 *   12. Another business does not — not through the service, not through a
 *       bare query, and it cannot write one into somebody else's name either.
 *   13. The unit price comes from the catalogue. A posted price is ignored.
 *   14. The total is the server's arithmetic. A posted total is ignored.
 *   15. A successful order answers with the confirmation.
 *   16. And appears in that business's history, numbered from one.
 *
 * Plus the two an owner could try by hand: a quantity of zero, and a negative.
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

// The action revalidates two paths. There is no request to revalidate here.
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const AUTH = {
  alpha: '22222222-2222-4222-8222-222222222222',
  beta: '33333333-3333-4333-8333-333333333333',
} as const;

const NOW = new Date('2026-09-10T06:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let orders: typeof import('@/lib/kit/orders');
let actions: typeof import('@/lib/actions/kit');
let shared: typeof import('@/lib/actions/shared');

let seeded: { alphaClient: string; betaClient: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m33-kit-orders');
  owner = harness.owner;

  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

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

/** What the browser actually posts: an id and two quantities, plus any
 *  extra field somebody might try to slip in alongside them. */
function orderForm(clientId: string, quantities: Record<string, string>, forged: Record<string, string> = {}) {
  const form = new FormData();
  form.set('clientId', clientId);
  for (const [key, value] of Object.entries(quantities)) form.set(`qty:${key}`, value);
  for (const [key, value] of Object.entries(forged)) form.set(key, value);
  return form;
}

const place = (form: FormData) => actions.placeKitOrderAction(shared.IDLE, form);

/** Every order in the database, read as the owner: the ground truth. */
async function allRows() {
  return owner.kitOrder.findMany({
    orderBy: { createdAt: 'asc' },
    select: { clientId: true, number: true, status: true, itemsJson: true, totalInr: true },
  });
}

// ---------------------------------------------------------------------------
// 10. The order is stored for the right business
// ---------------------------------------------------------------------------

describe('10. an order is stored against the business that placed it', () => {
  it('writes one row, for that business, with the server’s numbers', async () => {
    session = { id: AUTH.alpha };
    const result = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '2', 'folded-tent': '3' }));
    expect(result.ok).toBe(true);

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clientId).toBe(seeded.alphaClient);
    expect(rows[0]?.number).toBe(1);
    expect(rows[0]?.status).toBe('RECEIVED');
    expect(rows[0]?.totalInr).toBe(350);
  });

  it('ignores a client id the browser chose for itself', async () => {
    // Beta's owner, posting Alpha's id. The gate answers from Beta's own
    // memberships, so this is refused before anything is written.
    session = { id: AUTH.beta };
    const result = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    expect(result.ok).toBe(false);
    expect(await allRows()).toHaveLength(0);
  });

  it('refuses a stranger with no session at all', async () => {
    session = null;
    const result = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    expect(result.ok).toBe(false);
    expect(await allRows()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 11 and 12. Own orders, and only own orders
// ---------------------------------------------------------------------------

describe('11. a business reads its own orders back', () => {
  it('returns what it ordered, with the lines it ordered', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '2', 'folded-tent': '3' }));

    const mine = await orders.listKitOrders(app, seeded.alphaClient);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.clientId).toBe(seeded.alphaClient);
    expect(mine[0]?.totalInr).toBe(350);
    expect(mine[0]?.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 100, lineTotalInr: 200 },
      { productKey: 'folded-tent', quantity: 3, unitPriceInr: 50, lineTotalInr: 150 },
    ]);
  });
});

describe('12. a business cannot see another business’s orders', () => {
  beforeEach(async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '2' }));
    session = { id: AUTH.beta };
    await place(orderForm(seeded.betaClient, { 'folded-tent': '4' }));
  });

  it('returns nothing rather than their orders, even when asked by id', async () => {
    session = { id: AUTH.alpha };
    expect(await orders.listKitOrders(app, seeded.betaClient)).toEqual([]);

    session = { id: AUTH.beta };
    expect(await orders.listKitOrders(app, seeded.alphaClient)).toEqual([]);
  });

  it('hides them from an unscoped query too, not just a scoped one', async () => {
    // Not "the service filters"; the policy does. A query with no where clause
    // still comes back with one business's rows.
    session = { id: AUTH.alpha };
    const seen = await app.kitOrder.findMany({ select: { clientId: true, totalInr: true } });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.clientId).toBe(seeded.alphaClient);
    expect(seen[0]?.totalInr).toBe(200);

    // Both rows do exist. Alpha simply cannot reach the other one.
    expect(await allRows()).toHaveLength(2);
  });

  it('cannot write an order into another business’s name', async () => {
    session = { id: AUTH.alpha };
    await expect(
      app.kitOrder.create({
        data: {
          clientId: seeded.betaClient,
          number: 99,
          status: 'RECEIVED',
          itemsJson: '[]',
          totalInr: 1,
          updatedAt: NOW,
        },
      }),
    ).rejects.toThrow();
    expect(await allRows()).toHaveLength(2);
  });

  it('cannot reach into another business’s order to change or delete it', async () => {
    session = { id: AUTH.alpha };
    const betaRow = (await allRows()).find((row) => row.clientId === seeded.betaClient);
    expect(betaRow).toBeTruthy();

    // Neither of these finds a row to act on, so neither changes anything.
    expect(
      await app.kitOrder.updateMany({
        where: { clientId: seeded.betaClient },
        data: { totalInr: 0 },
      }),
    ).toEqual({ count: 0 });
    expect(await app.kitOrder.deleteMany({ where: { clientId: seeded.betaClient } })).toEqual({
      count: 0,
    });

    const after = (await allRows()).find((row) => row.clientId === seeded.betaClient);
    expect(after?.totalInr).toBe(betaRow?.totalInr);
  });
});

// ---------------------------------------------------------------------------
// 13 and 14. The money is the server's
// ---------------------------------------------------------------------------

describe('13. the server controls the price', () => {
  it('ignores a unit price posted alongside the quantity', async () => {
    session = { id: AUTH.alpha };
    const result = await place(
      orderForm(
        seeded.alphaClient,
        { 'card-qr-stand': '2' },
        { price: '1', unitPrice: '1', unitPriceInr: '1', 'price:card-qr-stand': '1' },
      ),
    );
    expect(result.ok).toBe(true);

    const rows = await allRows();
    const lines = JSON.parse(rows[0]?.itemsJson ?? '[]');
    expect(lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 100, lineTotalInr: 200 },
    ]);
    expect(rows[0]?.totalInr).toBe(200);
  });

  it('ignores a product the browser invented, and records nothing at all', async () => {
    session = { id: AUTH.alpha };
    const form = orderForm(seeded.alphaClient, { 'card-qr-stand': '1' });
    form.set('qty:free-billboard', '500');
    const result = await place(form);
    expect(result.ok).toBe(true);

    const lines = JSON.parse((await allRows())[0]?.itemsJson ?? '[]');
    expect(lines.map((l: { productKey: string }) => l.productKey)).toEqual(['card-qr-stand']);
  });
});

describe('14. the browser cannot alter the total', () => {
  it('adds the lines up itself, whatever total was posted', async () => {
    session = { id: AUTH.alpha };
    const result = await place(
      orderForm(
        seeded.alphaClient,
        { 'card-qr-stand': '2', 'folded-tent': '3' },
        { total: '1', totalInr: '1', amount: '1', grandTotal: '0' },
      ),
    );
    expect(result.ok).toBe(true);
    expect((await allRows())[0]?.totalInr).toBe(350);
  });

  it('refuses a quantity of zero on every line rather than storing an empty order', async () => {
    session = { id: AUTH.alpha };
    const result = await place(
      orderForm(seeded.alphaClient, { 'card-qr-stand': '0', 'folded-tent': '0' }),
    );
    expect(result.ok).toBe(false);
    expect(await allRows()).toHaveLength(0);
  });

  it('refuses a negative quantity outright', async () => {
    session = { id: AUTH.alpha };
    const result = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '-5' }));
    expect(result.ok).toBe(false);
    expect(await allRows()).toHaveLength(0);
  });

  it('refuses a fraction, and refuses a number dressed up as something else', async () => {
    session = { id: AUTH.alpha };
    for (const bad of ['1.5', '0x10', '1e2', 'lots']) {
      expect((await place(orderForm(seeded.alphaClient, { 'card-qr-stand': bad }))).ok).toBe(false);
    }
    expect(await allRows()).toHaveLength(0);
  });

  it('lets a business order one product and not the other', async () => {
    session = { id: AUTH.alpha };
    const result = await place(
      orderForm(seeded.alphaClient, { 'card-qr-stand': '0', 'folded-tent': '4' }),
    );
    expect(result.ok).toBe(true);

    const lines = JSON.parse((await allRows())[0]?.itemsJson ?? '[]');
    expect(lines).toEqual([
      { productKey: 'folded-tent', quantity: 4, unitPriceInr: 50, lineTotalInr: 200 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 15 and 16. What the owner is told, and what they see afterwards
// ---------------------------------------------------------------------------

describe('15. a successful order is confirmed', () => {
  it('answers with the confirmation and the order’s own number', async () => {
    session = { id: AUTH.alpha };
    const result = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    expect(result.ok).toBe(true);
    expect(result.message).toBe(
      "Your order has been received. We'll contact you about the next step.",
    );
    expect(result.data).toEqual({ orderNumber: '1' });
  });

  it('promises nothing about delivery, dispatch or stock', async () => {
    session = { id: AUTH.alpha };
    const result = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    const said = (result.message ?? '').toLowerCase();
    for (const promise of ['deliver', 'ship', 'dispatch', 'stock', 'arrive', 'courier']) {
      expect(said, `the confirmation promises "${promise}"`).not.toContain(promise);
    }
  });

  it('says why when it refuses, rather than failing silently', async () => {
    session = { id: AUTH.alpha };
    const empty = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '0' }));
    expect(empty.ok).toBe(false);
    expect(empty.message).toBe('Choose at least one card before ordering.');

    const bad = await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '-1' }));
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('cannot be ordered');
  });
});

describe('16. a new order appears in the history', () => {
  it('numbers them from one, per business, newest first', async () => {
    session = { id: AUTH.alpha };
    expect(await orders.listKitOrders(app, seeded.alphaClient)).toEqual([]);

    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    await place(orderForm(seeded.alphaClient, { 'folded-tent': '2' }));

    const mine = await orders.listKitOrders(app, seeded.alphaClient);
    expect(mine.map((order) => order.number)).toEqual([2, 1]);
    expect(mine.map((order) => order.totalInr)).toEqual([100, 100]);
    expect(mine.every((order) => order.status === 'RECEIVED')).toBe(true);
  });

  it('gives each business its own Order #1', async () => {
    session = { id: AUTH.alpha };
    await place(orderForm(seeded.alphaClient, { 'card-qr-stand': '1' }));
    session = { id: AUTH.beta };
    await place(orderForm(seeded.betaClient, { 'folded-tent': '1' }));

    const rows = await allRows();
    expect(rows.map((row) => row.number)).toEqual([1, 1]);
    expect(new Set(rows.map((row) => row.clientId)).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// The table itself
// ---------------------------------------------------------------------------

describe('the orders table answers to the same policies as every other', () => {
  it('has row-level security enabled AND forced', async () => {
    const [row] = await owner.$queryRawUnsafe<{ enabled: boolean; forced: boolean }[]>(
      `SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
         FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = 'KitOrder'`,
    );
    expect(row?.enabled).toBe(true);
    expect(row?.forced).toBe(true);
  });

  it('is guarded by tenant_isolation and nothing more permissive', async () => {
    const policies = await owner.$queryRawUnsafe<{ policyname: string; qual: string }[]>(
      `SELECT policyname, qual FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'KitOrder'`,
    );
    expect(policies.map((p) => p.policyname)).toEqual(['tenant_isolation']);
    expect(policies[0]?.qual).toContain('accessible_client_ids');
  });

  it('is not reachable by the anonymous customer-facing role', async () => {
    const granted = await owner.$queryRawUnsafe<{ privilege_type: string }[]>(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'KitOrder' AND grantee = 'repos_public'`,
    );
    expect(granted).toEqual([]);
  });

  it('holds no customer data: a business, a count and a cost', async () => {
    const columns = await owner.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'KitOrder' ORDER BY 1`,
    );
    expect(columns.map((c) => c.column_name)).toEqual([
      'clientId',
      'createdAt',
      'id',
      'itemsJson',
      'number',
      'status',
      'totalInr',
      'updatedAt',
    ]);
  });

  it('ships the same table to production as the tests run against', async () => {
    // The RLS harness applies prisma/m20/rls.sql; production will never replay
    // it and gets prisma/m33/migration.sql instead. Both must say the same
    // thing about this table, or the tests are guarding a database nobody has.
    const { readFileSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');
    const root = resolve(__dirname, '..');
    const migration = readFileSync(join(root, 'prisma', 'm33', 'migration.sql'), 'utf8');
    const rls = readFileSync(join(root, 'prisma', 'm20', 'rls.sql'), 'utf8');

    expect(rls).toContain("'KitOrder'");
    expect(migration).toContain('ALTER TABLE public."KitOrder" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public."KitOrder" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('CREATE POLICY tenant_isolation ON public."KitOrder"');
    expect(migration).toContain('app.accessible_client_ids()');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public."KitOrder" TO repos_app');
    expect(migration).toContain('REVOKE ALL ON public."KitOrder" FROM repos_public');
    // Additive only: nothing in this file drops or alters anything else.
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|ALTER COLUMN|TRUNCATE/);
  });
});
