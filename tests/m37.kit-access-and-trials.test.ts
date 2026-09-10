import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES, type MessageKey } from '@/lib/i18n/strings';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { PRINT_SHEETS } from '@/lib/kit/sheets';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * PRINTING IS HEADWAY'S, AND A TRIAL IS ONE BUSINESS'S (M37).
 *
 * Four things, and the first is the one that mattered most:
 *
 *   1. A BUSINESS CANNOT PRINT ITS OWN CARD. Not from the page, and — the real
 *      bug — not from the URL either. A Next.js layout does not wrap a route
 *      handler, so the `requireOperator()` in `(print)/layout.tsx` never ran
 *      for the two `route.ts` files beside it, and both gated on a MEMBER-level
 *      tenant check that a business owner passes.
 *   2. An order is finished by the operator and separately confirmed by the
 *      business, and the KIT ORDERED badge is outstanding work rather than
 *      history.
 *   3. A trial can be set for one business, by date or by days, without
 *      touching the global default or any other lifecycle state.
 *   4. The public site says which languages Headway speaks.
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
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const ROOT = resolve(__dirname, '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const says = (key: MessageKey) => MESSAGES[key].en;

const CLIENT_KIT = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx'));
const OPERATOR_KIT = code(read('src', 'app', '(app)', 'clients', '[id]', 'kit', 'page.tsx'));
const SHEET_ROUTE = code(
  read('src', 'app', '(print)', 'print', 'sheet', '[clientId]', '[sheet]', 'route.ts'),
);
const TENT_ROUTE = code(read('src', 'app', '(print)', 'print', 'tent', '[clientId]', 'route.ts'));
const GUARD = code(read('src', 'lib', 'auth', 'guard.ts'));
const CLIENT_ORDERS = code(
  read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'orders', 'page.tsx'),
);
const CLIENT_DETAIL = code(read('src', 'app', '(app)', 'clients', '[id]', 'page.tsx'));
const ACCOUNT = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'account', 'page.tsx'));

const AUTH = {
  operator: '11111111-1111-4111-8111-111111111111',
  alpha: '22222222-2222-4222-8222-222222222222',
  beta: '33333333-3333-4333-8333-333333333333',
} as const;

const NOW = new Date('2026-09-13T06:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let orders: typeof import('@/lib/kit/orders');
let clients: typeof import('@/lib/clients/service');
let commercial: typeof import('@/lib/commercial/service');
let kitActions: typeof import('@/lib/actions/kit');
let commercialActions: typeof import('@/lib/actions/commercial');
let shared: typeof import('@/lib/actions/shared');

let seeded: { alphaClient: string; betaClient: string; operatorId: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m37-kit-access');
  owner = harness.owner;
  process.env.DATABASE_URL = harness.appUrl;
  process.env.DIRECT_DATABASE_URL = harness.appUrl;

  orders = await import('@/lib/kit/orders');
  clients = await import('@/lib/clients/service');
  commercial = await import('@/lib/commercial/service');
  kitActions = await import('@/lib/actions/kit');
  commercialActions = await import('@/lib/actions/commercial');
  shared = await import('@/lib/actions/shared');
  ({ prisma: app } = await import('@/lib/db'));
}, 180_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  session = null;
  await resetDb(owner);

  const operator = await owner.user.create({
    data: {
      email: 'operator@headway.test',
      name: 'Ops Person',
      authProviderId: AUTH.operator,
      isPlatformAdmin: true,
    },
    select: { id: true },
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

  seeded = { alphaClient: alphaClient.id, betaClient: betaClient.id, operatorId: operator.id };
});

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const place = (clientId: string, quantities: Record<string, string>) => {
  const f = new FormData();
  f.set('clientId', clientId);
  for (const [k, v] of Object.entries(quantities)) f.set(`qty:${k}`, v);
  return kitActions.placeKitOrderAction(shared.IDLE, f);
};
const complete = (fields: Record<string, string>) =>
  kitActions.markKitOrderCompletedAction(shared.IDLE, form(fields));
const acknowledge = (fields: Record<string, string>) =>
  kitActions.acknowledgeKitOrderReceivedAction(shared.IDLE, form(fields));
const removeOrder = (fields: Record<string, string>) =>
  kitActions.deleteKitOrderAction(shared.IDLE, form(fields));
const setTrial = (fields: Record<string, string>) =>
  commercialActions.setClientTrialAction(shared.IDLE, form(fields));

async function anOrder(clientId = seeded.alphaClient, who: string = AUTH.alpha) {
  session = { id: who };
  await place(clientId, { 'card-qr-stand': '1', 'folded-tent': '1' });
  const row = await owner.kitOrder.findFirstOrThrow({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  session = null;
  return row;
}

const badge = async (clientId: string) => {
  session = { id: AUTH.operator };
  const rows = await clients.listClients(app);
  return rows.find((r) => r.id === clientId)?.openKitOrderCount ?? null;
};

// ---------------------------------------------------------------------------
// CLIENT PRINT SECURITY — 1 to 4
// ---------------------------------------------------------------------------

describe('1 & 2. a business cannot reach the print routes, by button or by URL', () => {
  it('offers no print, download or preview anywhere on its Kit page', () => {
    expect(CLIENT_KIT).not.toContain('/print/');
    expect(CLIENT_KIT).not.toContain('PRINT_SHEETS');
    expect(CLIENT_KIT).not.toContain('sheet.preview');
    expect(CLIENT_KIT).not.toContain("t('kit.sheets.download')");
    expect(CLIENT_KIT).not.toContain("t('kit.sheets.open')");
    expect(CLIENT_KIT).not.toContain("t('kit.reprint.title')");
  });

  it('links to no print route from anywhere in the client portal', () => {
    const workspace = join(ROOT, 'src', 'app', '(workspace)');
    const offenders: string[] = [];
    const stack = [workspace];
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (/\.tsx?$/.test(entry) && code(readFileSync(full, 'utf8')).includes('/print/')) {
          offenders.push(full);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('gates BOTH route handlers on being an operator, not on membership', () => {
    // The bug this closes: a layout does not wrap a route handler, so the
    // requireOperator() in (print)/layout.tsx never ran for these two.
    for (const route of [SHEET_ROUTE, TENT_ROUTE]) {
      expect(route).toContain('await printGate(clientId)');
      expect(route).not.toContain('tenantGateFor');
      expect(route).toMatch(/if \(!gate\.ok\) return new NextResponse\('Not found', \{ status: 404 \}\)/);
    }
  });

  it('makes printGate an admin check and nothing looser', () => {
    const fn = GUARD.slice(
      GUARD.indexOf('export async function printGate'),
      GUARD.indexOf('export async function isOperator'),
    );
    expect(fn.length).toBeGreaterThan(80);
    expect(fn).toContain('if (!actor || !actor.isPlatformAdmin) return { ok: false }');
    expect(fn).not.toContain('canRead');
    expect(fn).not.toContain('roleFor');
  });
});

describe('3 & 4. the operator still prints, from the approved masters', () => {
  it('offers both formats, each through the personalising route', () => {
    expect(OPERATOR_KIT).toContain('Print this format');
    expect(OPERATOR_KIT).toContain('href={`/print/sheet/${id}/${sheet.key}`}');
    expect(OPERATOR_KIT).toContain('href={`/print/sheet/${id}/${sheet.key}?download=1`}');
  });

  it('leaves the approved masters byte-intact', () => {
    expect(PRINT_SHEETS).toHaveLength(2);
    for (const sheet of PRINT_SHEETS) {
      const bytes = readFileSync(join(ROOT, 'public', sheet.file.slice(1)));
      expect(bytes.subarray(0, 5).toString('latin1'), sheet.file).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(50_000);
    }
    expect(code(read('src', 'lib', 'kit', 'personalise.ts'))).not.toContain('KitOrder');
  });
});

// ---------------------------------------------------------------------------
// OPERATOR KIT — 5 to 7
// ---------------------------------------------------------------------------

describe('5, 6 & 7. the operator page shows exactly two formats', () => {
  it('builds them from the catalogue, and maps each to one approved sheet', () => {
    expect(KIT_PRODUCTS).toHaveLength(2);
    expect(OPERATOR_KIT).toContain("'card-qr-stand': 'insert-4x6'");
    expect(OPERATOR_KIT).toContain("'folded-tent': 'pair-legal'");
    const map = OPERATOR_KIT.slice(
      OPERATOR_KIT.indexOf('const FORMAT_SHEET'),
      OPERATOR_KIT.indexOf('const formats'),
    );
    expect([...map.matchAll(/'[^']+':\s*'[^']+'/g)]).toHaveLength(2);
  });

  it('titles and describes them the way they were specified', () => {
    expect(OPERATOR_KIT).toContain("'card-qr-stand': '4 × 6 in Card + QR Stand'");
    expect(OPERATOR_KIT).toContain("'folded-tent': '4 × 6 in Folded Tent Card'");
    expect(OPERATOR_KIT).toContain(
      "'card-qr-stand': 'Personalized 4 × 6 in feedback card for a QR stand holder.'",
    );
    expect(OPERATOR_KIT).toContain(
      "'folded-tent': 'Personalized 4 × 6 in feedback card that folds into a table tent.'",
    );
  });

  it('uses the uploaded product photographs', () => {
    expect(OPERATOR_KIT).toContain('src={product.photo}');
    expect(KIT_PRODUCTS.map((p) => p.photo)).toEqual([
      '/kit/card-qr-stand.webp',
      '/kit/folded-tent-card.webp',
    ]);
    for (const product of KIT_PRODUCTS) {
      const bytes = readFileSync(join(ROOT, 'public', product.photo.slice(1)));
      expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
    }
  });

  it('no longer leads with the old generic print page', () => {
    expect(OPERATOR_KIT).not.toContain('PrintKitButton');
    expect(OPERATOR_KIT).not.toContain('/print/kit/');
  });
});

// ---------------------------------------------------------------------------
// ORDER DISPLAY — 8 to 11
// ---------------------------------------------------------------------------

describe('8, 9, 10 & 11. the client detail shows the latest order', () => {
  it('shows nothing when there is no order, and the order when there is', async () => {
    session = { id: AUTH.operator };
    expect(await orders.latestKitOrder(app, seeded.alphaClient)).toBeNull();

    await anOrder();
    session = { id: AUTH.operator };
    const latest = await orders.latestKitOrder(app, seeded.alphaClient);
    expect(latest?.number).toBe(1);
    expect(latest?.totalInr).toBe(99 + 49);
  });

  it('resolves several orders to the newest', async () => {
    session = { id: AUTH.alpha };
    await place(seeded.alphaClient, { 'card-qr-stand': '1' });
    await place(seeded.alphaClient, { 'folded-tent': '2' });
    await place(seeded.alphaClient, { 'card-qr-stand': '4' });

    session = { id: AUTH.operator };
    expect((await orders.latestKitOrder(app, seeded.alphaClient))?.number).toBe(3);
    expect(await orders.listAllKitOrders(app)).toHaveLength(3);
  });

  it('renders from the stored order, with a link to the whole list', () => {
    expect(CLIENT_DETAIL).toContain('latestKitOrder(prisma, id)');
    expect(CLIENT_DETAIL).toContain('latestOrder.lines.map');
    expect(CLIENT_DETAIL).toContain('formatRupees(line.unitPriceInr)');
    expect(CLIENT_DETAIL).toContain('href="/orders"');
    expect(CLIENT_DETAIL).not.toMatch(/₹\s*\d/);
  });

  it('keeps one business out of another’s orders', async () => {
    await anOrder(seeded.alphaClient, AUTH.alpha);
    session = { id: AUTH.beta };
    expect(await orders.latestKitOrder(app, seeded.alphaClient)).toBeNull();
    expect(await orders.listAllKitOrders(app)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// COMPLETION — 12 to 17
// ---------------------------------------------------------------------------

describe('12, 13, 14 & 15. the operator completes an order', () => {
  it('records the server’s clock and the signed-in operator', async () => {
    const order = await anOrder();
    const before = new Date();
    session = { id: AUTH.operator };
    expect((await complete({ orderId: order.id })).ok).toBe(true);

    const row = await owner.kitOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, completedAt: true, completedByUserId: true },
    });
    expect(row.status).toBe('DELIVERED');
    expect(row.completedByUserId).toBe(seeded.operatorId);
    expect(row.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(row.completedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('ignores a posted date, person and status', async () => {
    const order = await anOrder();
    session = { id: AUTH.operator };
    await complete({
      orderId: order.id,
      completedAt: '2001-01-01T00:00:00.000Z',
      completedByUserId: seeded.alphaClient,
      status: 'Shipped',
    });
    const row = await owner.kitOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, completedAt: true, completedByUserId: true },
    });
    expect(row.completedAt!.getFullYear()).toBeGreaterThan(2020);
    expect(row.completedByUserId).toBe(seeded.operatorId);
    expect(row.status).toBe('DELIVERED');
  });

  it('refuses a business and a stranger', async () => {
    const order = await anOrder();
    session = { id: AUTH.alpha };
    expect((await complete({ orderId: order.id })).ok).toBe(false);
    session = null;
    expect((await complete({ orderId: order.id })).ok).toBe(false);
    const row = await owner.kitOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { completedAt: true },
    });
    expect(row.completedAt).toBeNull();
  });
});

describe('16 & 17. KIT ORDERED is outstanding work, not history', () => {
  it('goes when the only order is completed, and the order stays', async () => {
    const order = await anOrder();
    expect(await badge(seeded.alphaClient)).toBe(1);

    session = { id: AUTH.operator };
    await complete({ orderId: order.id });

    expect(await badge(seeded.alphaClient)).toBe(0);
    // The order itself is untouched and still listed.
    session = { id: AUTH.operator };
    expect(await orders.listAllKitOrders(app)).toHaveLength(1);
    expect((await orders.latestKitOrder(app, seeded.alphaClient))?.id).toBe(order.id);
  });

  it('stays while any order is still unfinished', async () => {
    const first = await anOrder();
    await anOrder();
    expect(await badge(seeded.alphaClient)).toBe(2);

    session = { id: AUTH.operator };
    await complete({ orderId: first.id });
    expect(await badge(seeded.alphaClient)).toBe(1);
  });

  it('is a count of rows, never a stored flag', () => {
    const schema = read('prisma', 'schema.prisma');
    expect(schema).not.toContain('hasKitOrdered');
    expect(schema).not.toContain('hasOrderedKit');
    expect(code(read('src', 'lib', 'clients', 'service.ts'))).toContain(
      'kitOrders: { where: { completedAt: null } }',
    );
  });
});

// ---------------------------------------------------------------------------
// RECEIPT — 18 to 21
// ---------------------------------------------------------------------------

describe('18, 19, 20 & 21. the business confirms receipt of its own order', () => {
  it('is not offered until the order is completed', async () => {
    expect(CLIENT_ORDERS).toContain('{order.completedAt ? (');
    expect(CLIENT_ORDERS.split('<KitOrderReceiptForm')).toHaveLength(2);

    const order = await anOrder();
    session = { id: AUTH.alpha };
    expect((await acknowledge({ clientId: seeded.alphaClient, orderId: order.id })).ok).toBe(false);
  });

  it('records the server’s clock and the signed-in person', async () => {
    const order = await anOrder();
    session = { id: AUTH.operator };
    await complete({ orderId: order.id });

    const before = new Date();
    session = { id: AUTH.alpha };
    expect((await acknowledge({ clientId: seeded.alphaClient, orderId: order.id })).ok).toBe(true);

    const row = await owner.kitOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { receivedAt: true, receivedByUserId: true },
    });
    expect(row.receivedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(row.receivedByUserId).not.toBeNull();
    expect(row.receivedByUserId).not.toBe(seeded.operatorId);
  });

  it('cannot touch another business’s order', async () => {
    const order = await anOrder(seeded.alphaClient, AUTH.alpha);
    session = { id: AUTH.operator };
    await complete({ orderId: order.id });

    session = { id: AUTH.beta };
    expect((await acknowledge({ clientId: seeded.betaClient, orderId: order.id })).ok).toBe(false);
    expect((await acknowledge({ clientId: seeded.alphaClient, orderId: order.id })).ok).toBe(false);
    const row = await owner.kitOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { receivedAt: true },
    });
    expect(row.receivedAt).toBeNull();
  });

  it('changes no status, price, item or completion by acknowledging', async () => {
    const order = await anOrder();
    session = { id: AUTH.operator };
    await complete({ orderId: order.id });
    const before = await owner.kitOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, totalInr: true, itemsJson: true, completedAt: true, completedByUserId: true },
    });

    session = { id: AUTH.alpha };
    await acknowledge({
      clientId: seeded.alphaClient,
      orderId: order.id,
      status: 'RECEIVED',
      totalInr: '1',
      itemsJson: '[]',
      completedAt: '2001-01-01T00:00:00.000Z',
    });

    const after = await owner.kitOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true, totalInr: true, itemsJson: true, completedAt: true, completedByUserId: true },
    });
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// DELETE — 22 to 25
// ---------------------------------------------------------------------------

describe('22, 23, 24 & 25. deleting is the operator’s alone', () => {
  it('refuses a business and a stranger', async () => {
    const order = await anOrder();
    session = { id: AUTH.alpha };
    expect((await removeOrder({ orderId: order.id, clientId: seeded.alphaClient })).ok).toBe(false);
    session = null;
    expect((await removeOrder({ orderId: order.id })).ok).toBe(false);
    expect(await owner.kitOrder.findUnique({ where: { id: order.id } })).not.toBeNull();
  });

  it('takes two clicks, with Cancel first', () => {
    const control = code(read('src', 'components', 'forms', 'kit-order-controls.tsx'));
    expect(control).toContain('const [confirming, setConfirming] = useState(false);');
    expect(control).toContain('onClick={() => setConfirming(false)}');
    expect(control).toContain('This cannot be undone');
    expect(control).toContain('variant="danger"');
  });

  it('removes it from every view, and drops the badge with the last one', async () => {
    const order = await anOrder();
    expect(await badge(seeded.alphaClient)).toBe(1);

    session = { id: AUTH.operator };
    await expect(removeOrder({ orderId: order.id })).rejects.toThrow(/NEXT_REDIRECT/);

    expect(await owner.kitOrder.findUnique({ where: { id: order.id } })).toBeNull();
    expect(await badge(seeded.alphaClient)).toBe(0);
    session = { id: AUTH.alpha };
    expect(await orders.listKitOrders(app, seeded.alphaClient)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PRICING — 26 to 29
// ---------------------------------------------------------------------------

describe('26, 27, 28 & 29. the prices are the server’s, and history keeps its own', () => {
  it('charges ₹99 and ₹49', () => {
    expect(KIT_PRODUCTS.map((p) => p.priceInr)).toEqual([99, 49]);
  });

  it('ignores a price the browser sends', async () => {
    session = { id: AUTH.alpha };
    const f = new FormData();
    f.set('clientId', seeded.alphaClient);
    f.set('qty:card-qr-stand', '2');
    f.set('unitPriceInr', '1');
    f.set('totalInr', '1');
    expect((await kitActions.placeKitOrderAction(shared.IDLE, f)).ok).toBe(true);

    session = { id: AUTH.operator };
    expect((await orders.latestKitOrder(app, seeded.alphaClient))?.totalInr).toBe(198);
  });

  it('leaves an order stored at ₹100 and ₹50 exactly as it was, even when completed', async () => {
    await owner.kitOrder.create({
      data: {
        clientId: seeded.alphaClient,
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
    const row = await owner.kitOrder.findFirstOrThrow({ select: { id: true } });

    session = { id: AUTH.operator };
    await complete({ orderId: row.id });
    const after = await owner.kitOrder.findUniqueOrThrow({
      where: { id: row.id },
      select: { totalInr: true, itemsJson: true },
    });
    expect(after.totalInr).toBe(350);
    expect(JSON.parse(after.itemsJson)[0].unitPriceInr).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// TRIAL SETTINGS — 30 to 35
// ---------------------------------------------------------------------------

describe('30, 31 & 32. one business’s trial, by date or by days', () => {
  it('sets an end date directly, to the end of that day in IST', async () => {
    session = { id: AUTH.operator };
    const result = await setTrial({
      clientId: seeded.alphaClient,
      mode: 'date',
      trialEndDate: '2026-09-30',
    });
    expect(result.ok).toBe(true);

    const row = await owner.client.findUniqueOrThrow({
      where: { id: seeded.alphaClient },
      select: { trialEndsAt: true },
    });
    // 30 Sep 23:59:59.999 IST is 30 Sep 18:29:59.999 UTC.
    expect(row.trialEndsAt?.toISOString()).toBe('2026-09-30T18:29:59.999Z');
    expect(commercial.endOfDayIst('2026-09-30')?.toISOString()).toBe(
      '2026-09-30T18:29:59.999Z',
    );
  });

  it('sets a number of days, counted from the trial’s own start', async () => {
    const before = await owner.client.findUniqueOrThrow({
      where: { id: seeded.alphaClient },
      select: { trialStartsAt: true },
    });

    session = { id: AUTH.operator };
    expect((await setTrial({ clientId: seeded.alphaClient, mode: 'days', trialDays: '21' })).ok).toBe(true);

    const row = await owner.client.findUniqueOrThrow({
      where: { id: seeded.alphaClient },
      select: { trialStartsAt: true, trialEndsAt: true },
    });
    expect(row.trialStartsAt?.getTime()).toBe(before.trialStartsAt?.getTime());
    expect(row.trialEndsAt!.getTime() - row.trialStartsAt!.getTime()).toBe(21 * DAY);
  });

  it('leaves one effective end, whichever way it was set', async () => {
    session = { id: AUTH.operator };
    await setTrial({ clientId: seeded.alphaClient, mode: 'days', trialDays: '10' });
    const afterDays = await owner.client.findUniqueOrThrow({
      where: { id: seeded.alphaClient },
      select: { trialEndsAt: true },
    });
    await setTrial({ clientId: seeded.alphaClient, mode: 'date', trialEndDate: '2026-12-25' });
    const afterDate = await owner.client.findUniqueOrThrow({
      where: { id: seeded.alphaClient },
      select: { trialEndsAt: true },
    });
    expect(afterDate.trialEndsAt?.getTime()).not.toBe(afterDays.trialEndsAt?.getTime());
    expect(afterDate.trialEndsAt?.toISOString()).toBe('2026-12-25T18:29:59.999Z');
  });

  it('refuses nonsense rather than storing it', async () => {
    session = { id: AUTH.operator };
    for (const bad of ['2026-02-31', 'soon', '', '30-09-2026']) {
      expect((await setTrial({ clientId: seeded.alphaClient, mode: 'date', trialEndDate: bad })).ok).toBe(false);
    }
    for (const bad of ['0', '-5', '9999', 'ten']) {
      expect((await setTrial({ clientId: seeded.alphaClient, mode: 'days', trialDays: bad })).ok).toBe(false);
    }
  });

  it('changes no other lifecycle state', async () => {
    await owner.client.update({
      where: { id: seeded.alphaClient },
      data: { subscriptionStatus: 'ACTIVE' },
    });
    session = { id: AUTH.operator };
    await setTrial({ clientId: seeded.alphaClient, mode: 'days', trialDays: '15' });

    const row = await owner.client.findUniqueOrThrow({
      where: { id: seeded.alphaClient },
      select: { subscriptionStatus: true, serviceLockedAt: true, serviceExemption: true },
    });
    expect(row.subscriptionStatus).toBe('ACTIVE');
    expect(row.serviceLockedAt).toBeNull();
    expect(row.serviceExemption).toBeNull();
  });
});

describe('33, 34 & 35. the default is untouched and the business only reads', () => {
  it('leaves the global default trial length alone', async () => {
    session = { id: AUTH.operator };
    const before = await commercial.getTrialDefaultDays(app);
    await setTrial({ clientId: seeded.alphaClient, mode: 'days', trialDays: '7' });
    expect(await commercial.getTrialDefaultDays(app)).toBe(before);

    const service = code(read('src', 'lib', 'commercial', 'service.ts'));
    const fn = service.slice(
      service.indexOf('export async function setClientTrial'),
      service.indexOf('export async function extendTrial'),
    );
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).not.toContain('saveTrialDefaultDays');
    expect(fn).not.toContain('TRIAL_DEFAULT_DAYS_SETTING');
    expect(fn).not.toContain('status:');
  });

  it('shows the business its own effective end on Account, and no controls', () => {
    expect(ACCOUNT).toContain("t('account.service.trialEnds')");
    expect(ACCOUNT).toContain('lifecycle.trialEndsAt');
    expect(ACCOUNT).toContain("t.plural('account.service.daysLeft'");
    expect(says('account.service.trialEnds')).toBeTruthy();
    // Nothing operator-only leaks onto it.
    expect(ACCOUNT).not.toContain('TrialSettingsForm');
    expect(ACCOUNT).not.toContain('setClientTrial');
  });

  it('refuses a business that tries to set a trial', async () => {
    session = { id: AUTH.alpha };
    expect((await setTrial({ clientId: seeded.alphaClient, mode: 'days', trialDays: '365' })).ok).toBe(false);
    session = null;
    expect((await setTrial({ clientId: seeded.alphaClient, mode: 'days', trialDays: '365' })).ok).toBe(false);

    const row = await owner.client.findUniqueOrThrow({
      where: { id: seeded.alphaClient },
      select: { trialEndsAt: true },
    });
    expect(row.trialEndsAt?.getTime()).toBe(NOW.getTime() + 25 * DAY);
  });
});

// ---------------------------------------------------------------------------
// LOCALIZATION — 36 to 40
// ---------------------------------------------------------------------------

describe('36, 37, 38 & 39. every new client-facing string speaks three languages', () => {
  const NEW_KEYS: MessageKey[] = [
    'kit.orders.status.delivered',
    'kit.orders.sentOn',
    'kit.receipt.cta',
    'kit.receipt.hint',
    'kit.receipt.saving',
    'kit.receipt.done',
    'kit.receipt.doneOn',
    'kit.receipt.error',
    'kit.status.print.label',
    'kit.file.body',
  ];

  it('has English, Hindi and Marathi for each', () => {
    for (const key of NEW_KEYS) {
      const phrase = MESSAGES[key];
      expect(phrase.en, key).toBeTruthy();
      expect(phrase.hi, `${key} has no Hindi`).toBeTruthy();
      expect(phrase.mr, `${key} has no Marathi`).toBeTruthy();
    }
  });

  it('writes Hindi and Marathi in Devanagari, not English twice', () => {
    const devanagari = /[ऀ-ॿ]/;
    for (const key of NEW_KEYS) {
      const phrase = MESSAGES[key];
      const translatable = phrase.en.replace(/\{[^}]*\}/g, '').replace(/Headway/g, '').trim();
      if (!/[a-z]{4}/i.test(translatable)) continue;
      expect(devanagari.test(phrase.hi as string), `${key} Hindi`).toBe(true);
      expect(devanagari.test(phrase.mr as string), `${key} Marathi`).toBe(true);
    }
  });

  it('keeps English the default', async () => {
    const { DEFAULT_LOCALE } = await import('@/lib/i18n/locale');
    const { makeTranslator } = await import('@/lib/i18n/t');
    expect(DEFAULT_LOCALE).toBe('en');
    for (const key of NEW_KEYS) {
      expect(makeTranslator(MESSAGES, 'en')(key)).toBe(MESSAGES[key].en);
      expect(makeTranslator(MESSAGES, 'hi')(key)).toBe(MESSAGES[key].hi);
      expect(makeTranslator(MESSAGES, 'mr')(key)).toBe(MESSAGES[key].mr);
    }
  });
});

describe('40. the public site says which languages Headway speaks', () => {
  const FOOTER = read('src', 'components', 'marketing', 'site-footer.tsx');

  it('says it once, as a line rather than a section', () => {
    expect(FOOTER).toContain('Available in English, Hindi and Marathi.');
    expect(code(FOOTER).split('Available in English').length).toBe(2);
    // A paragraph, not a heading, and not a link to anywhere.
    const line = code(FOOTER).slice(code(FOOTER).indexOf('Available in English') - 200);
    expect(line.slice(0, 220)).not.toContain('<h1');
    expect(line.slice(0, 220)).not.toContain('<h2');
    expect(line.slice(0, 220)).not.toContain('href');
  });
});
