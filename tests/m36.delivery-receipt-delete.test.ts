import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { PRINT_SHEETS } from '@/lib/kit/sheets';
import { createRlsTestDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * SENT, ARRIVED, AND GONE (M36).
 *
 * Three new facts about an order, each belonging to a different person:
 *
 *   DELIVERED — Headway's claim about its own dispatch. Operator only.
 *   RECEIVED  — the business's claim about its own counter. Theirs only.
 *   DELETED   — destroying the record. Operator only.
 *
 * The rule that matters most is that neither of the first two may be inferred
 * from the other, and that the browser supplies none of the three timestamps,
 * none of the names and none of the statuses. Tested against a real database
 * under the shipped policies, because every one of those is a claim about what
 * the server does with what a browser sends it.
 *
 * The operator's two print formats are here too — those are a claim about a
 * page, so they are read from the source.
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
// `deleteKitOrderAction` ends in a redirect, which throws outside a request.
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const AUTH = {
  operator: '11111111-1111-4111-8111-111111111111',
  alpha: '22222222-2222-4222-8222-222222222222',
  beta: '33333333-3333-4333-8333-333333333333',
} as const;

const NOW = new Date('2026-09-12T06:00:00.000Z');
const DAY = 86_400_000;

let harness: RlsTestDb;
let owner: PrismaClient;
let app: PrismaClient;

let orders: typeof import('@/lib/kit/orders');
let clients: typeof import('@/lib/clients/service');
let actions: typeof import('@/lib/actions/kit');
let shared: typeof import('@/lib/actions/shared');

let seeded: { alphaClient: string; betaClient: string; operatorId: string; alphaUserId: string };

beforeAll(async () => {
  harness = await createRlsTestDb('m36-delivery');
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
    data: { email: 'owner@alpha.test', name: 'Alpha Owner', authProviderId: AUTH.alpha },
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

  seeded = {
    alphaClient: alphaClient.id,
    betaClient: betaClient.id,
    operatorId: operator.id,
    alphaUserId: alpha.id,
  };
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
  return actions.placeKitOrderAction(shared.IDLE, f);
};

const deliver = (fields: Record<string, string>) =>
  actions.markKitOrderDeliveredAction(shared.IDLE, form(fields));
const acknowledge = (fields: Record<string, string>) =>
  actions.acknowledgeKitOrderReceivedAction(shared.IDLE, form(fields));
const remove = (fields: Record<string, string>) =>
  actions.deleteKitOrderAction(shared.IDLE, form(fields));

/** Alpha places one order and it comes back with its id. */
async function anOrder(clientId = seeded.alphaClient, who: string = AUTH.alpha) {
  session = { id: who };
  await place(clientId, { 'card-qr-stand': '1', 'folded-tent': '1' });
  const row = await owner.kitOrder.findFirstOrThrow({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true },
  });
  session = null;
  return row;
}

const raw = (id: string) =>
  owner.kitOrder.findUnique({
    where: { id },
    select: {
      status: true,
      deliveredAt: true,
      deliveredByUserId: true,
      receivedAt: true,
      receivedByUserId: true,
      totalInr: true,
      itemsJson: true,
    },
  });

// ---------------------------------------------------------------------------
// PRINT — 1 to 5
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const OPERATOR_KIT = code(read('src', 'app', '(app)', 'clients', '[id]', 'kit', 'page.tsx'));

describe('1. the operator kit page offers exactly two formats', () => {
  it('builds them from the catalogue, which has exactly two products', () => {
    expect(KIT_PRODUCTS).toHaveLength(2);
    expect(OPERATOR_KIT).toContain('KIT_PRODUCTS.flatMap');
    expect(OPERATOR_KIT).toContain('formats.map');
  });

  it('names them the way the operator asked', () => {
    expect(OPERATOR_KIT).toContain("'card-qr-stand': '4 × 6 in Card + QR Stand'");
    expect(OPERATOR_KIT).toContain("'folded-tent': '4 × 6 in Folded Tent Card'");
    expect(OPERATOR_KIT).toContain(
      "'card-qr-stand': 'Personalized 4 × 6 in feedback card for a QR stand holder.'",
    );
    expect(OPERATOR_KIT).toContain(
      "'folded-tent': 'Personalized 4 × 6 in feedback card that folds into a table tent.'",
    );
  });

  it('shows the approved photograph of each, not a render of the PDF', () => {
    expect(OPERATOR_KIT).toContain('src={product.photo}');
    expect(KIT_PRODUCTS.map((p) => p.photo)).toEqual([
      '/kit/card-qr-stand.webp',
      '/kit/folded-tent-card.webp',
    ]);
  });

  it('cannot grow a third format by accident', () => {
    // A product with no sheet behind it is dropped rather than rendered
    // half-built, and the map has exactly two keys.
    expect(OPERATOR_KIT).toContain('return sheet ? [{ product, sheet }] : []');
    const map = OPERATOR_KIT.slice(
      OPERATOR_KIT.indexOf('const FORMAT_SHEET'),
      OPERATOR_KIT.indexOf('const formats'),
    );
    expect([...map.matchAll(/'[^']+':\s*'[^']+'/g)]).toHaveLength(2);
  });
});

describe('2 & 3. each format prints from the right approved master', () => {
  it('sends Card + QR Stand to the A4 insert sheet, which is the one for a stand', () => {
    expect(OPERATOR_KIT).toContain("'card-qr-stand': 'insert-4x6'");
    const sheet = PRINT_SHEETS.find((s) => s.key === 'insert-4x6');
    expect(sheet?.what).toContain('acrylic stand');
    expect(sheet?.file).toBe('/print-kit/headway-4x6-insert-PRINT-MASTER.pdf');
  });

  it('sends Folded Tent Card to the Legal pair, which is the one that folds', () => {
    expect(OPERATOR_KIT).toContain("'folded-tent': 'pair-legal'");
    const sheet = PRINT_SHEETS.find((s) => s.key === 'pair-legal');
    expect(sheet?.finish).toContain('fold');
    expect(sheet?.file).toBe('/print-kit/headway-pair-LEGAL-PRINT-MASTER.pdf');
  });

  it('reaches them through the existing personalised route', () => {
    expect(OPERATOR_KIT).toContain('href={`/print/sheet/${id}/${sheet.key}`}');
    expect(OPERATOR_KIT).toContain('href={`/print/sheet/${id}/${sheet.key}?download=1`}');
  });
});

describe('4. the old single generic print page is no longer the primary experience', () => {
  it('no longer offers the generic browser-print page at all', () => {
    expect(OPERATOR_KIT).not.toContain('PrintKitButton');
    expect(OPERATOR_KIT).not.toContain('/print/kit/');
  });

  it('leads with the two formats, above everything else on the page', () => {
    const formats = OPERATOR_KIT.indexOf('formats.map');
    for (const later of ['A public review, optional', 'Message to send', 'Customise']) {
      expect(OPERATOR_KIT.indexOf(later), later).toBeGreaterThan(formats);
    }
  });

  it('keeps printing and ordering apart', () => {
    // Nothing on the print page places an order, and nothing about ordering
    // marks anything printed.
    expect(OPERATOR_KIT).not.toContain('placeKitOrder');
    expect(OPERATOR_KIT).not.toContain('kitOrder');
    const kitActions = code(read('src', 'lib', 'actions', 'kit.ts'));
    const orderAction = kitActions.slice(kitActions.indexOf('placeKitOrderAction'));
    expect(orderAction).not.toContain('setKitInstalled');
  });
});

describe('5. the approved artwork is untouched', () => {
  it('still ships exactly the two master PDFs, unchanged', () => {
    expect(PRINT_SHEETS).toHaveLength(2);
    for (const sheet of PRINT_SHEETS) {
      const bytes = readFileSync(join(ROOT, 'public', sheet.file.slice(1)));
      expect(bytes.subarray(0, 5).toString('latin1'), sheet.file).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(50_000);
    }
  });

  it('changes nothing about how a master is personalised', () => {
    const personalise = read('src', 'lib', 'kit', 'personalise.ts');
    expect(personalise).not.toContain('deliveredAt');
    expect(personalise).not.toContain('KitOrder');
  });
});

// ---------------------------------------------------------------------------
// ORDER DISPLAY — 6 to 12
// ---------------------------------------------------------------------------

describe('6 & 7. the client detail shows what was ordered, or nothing at all', () => {
  it('has no latest order for a business that has not ordered', async () => {
    session = { id: AUTH.operator };
    expect(await orders.latestKitOrder(app, seeded.alphaClient)).toBeNull();
    const list = new Map((await clients.listClients(app)).map((r) => [r.id, r]));
    expect(list.get(seeded.alphaClient)?.kitOrderCount).toBe(0);
  });

  it('shows the one order a business has placed', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    const latest = await orders.latestKitOrder(app, seeded.alphaClient);
    expect(latest?.id).toBe(placed.id);
    expect(latest?.number).toBe(1);
  });

  it('renders the summary from the stored order, never from a literal', () => {
    const page = code(read('src', 'app', '(app)', 'clients', '[id]', 'page.tsx'));
    expect(page).toContain('latestKitOrder(prisma, id)');
    expect(page).toContain('latestOrder.lines.map');
    expect(page).toContain('formatRupees(line.unitPriceInr)');
    expect(page).toContain('formatRupees(latestOrder.totalInr)');
    expect(page).toContain('href="/orders"');
    // No prices typed into the page.
    expect(page).not.toMatch(/₹\s*\d/);
  });
});

describe('8. the names, quantities, unit prices and total are right', () => {
  it('reads them all off the stored order', async () => {
    session = { id: AUTH.alpha };
    await place(seeded.alphaClient, { 'card-qr-stand': '3', 'folded-tent': '5' });

    session = { id: AUTH.operator };
    const latest = await orders.latestKitOrder(app, seeded.alphaClient);
    expect(latest?.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 3, unitPriceInr: 99, lineTotalInr: 297 },
      { productKey: 'folded-tent', quantity: 5, unitPriceInr: 49, lineTotalInr: 245 },
    ]);
    expect(latest?.totalInr).toBe(542);
    expect(KIT_PRODUCTS.map((p) => p.shortName)).toEqual([
      'Card + QR Stand',
      'Folded Tent Card',
    ]);
  });
});

describe('9. several orders show the latest one', () => {
  it('picks the newest, not the first', async () => {
    session = { id: AUTH.alpha };
    await place(seeded.alphaClient, { 'card-qr-stand': '1' });
    await place(seeded.alphaClient, { 'folded-tent': '2' });
    await place(seeded.alphaClient, { 'card-qr-stand': '4' });

    session = { id: AUTH.operator };
    const latest = await orders.latestKitOrder(app, seeded.alphaClient);
    expect(latest?.number).toBe(3);
    expect(latest?.totalInr).toBe(4 * 99);
    // And the full history is still on the Orders page.
    expect(await orders.listAllKitOrders(app)).toHaveLength(3);
  });
});

describe('10 & 11. one business never sees another’s order', () => {
  it('returns nothing for somebody else’s client id', async () => {
    await anOrder(seeded.alphaClient, AUTH.alpha);

    session = { id: AUTH.beta };
    expect(await orders.latestKitOrder(app, seeded.alphaClient)).toBeNull();
    expect(await orders.listKitOrders(app, seeded.alphaClient)).toEqual([]);
    expect(await orders.listAllKitOrders(app)).toEqual([]);
  });

  it('shows the operator every order they are allowed to see', async () => {
    await anOrder(seeded.alphaClient, AUTH.alpha);
    await anOrder(seeded.betaClient, AUTH.beta);

    session = { id: AUTH.operator };
    const all = await orders.listAllKitOrders(app);
    expect(all.map((o) => o.businessName).sort()).toEqual(['Alpha Cafe', 'Beta Salon']);
  });
});

describe('12. KIT ORDERED stays derived from the rows', () => {
  it('follows the count up and back down again', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    const before = new Map((await clients.listClients(app)).map((r) => [r.id, r]));
    expect(before.get(seeded.alphaClient)?.kitOrderCount).toBe(1);

    await owner.kitOrder.delete({ where: { id: placed.id } });

    session = { id: AUTH.operator };
    const after = new Map((await clients.listClients(app)).map((r) => [r.id, r]));
    expect(after.get(seeded.alphaClient)?.kitOrderCount).toBe(0);
  });

  it('has no stored boolean anywhere to drift from the rows', () => {
    const schema = read('prisma', 'schema.prisma');
    expect(schema).not.toContain('hasOrderedKit');
    expect(schema).not.toMatch(/kitOrderCount\s+Int/);
    expect(code(read('src', 'lib', 'clients', 'service.ts'))).toContain(
      'kitOrderCount: row._count.kitOrders',
    );
  });
});

// ---------------------------------------------------------------------------
// DELIVERY — 13 to 17
// ---------------------------------------------------------------------------

describe('13, 14 & 15. an operator marks an order delivered', () => {
  it('sets the status, the time and the person', async () => {
    const placed = await anOrder();
    const before = new Date();

    session = { id: AUTH.operator };
    expect((await deliver({ orderId: placed.id })).ok).toBe(true);

    const row = await raw(placed.id);
    expect(row?.status).toBe('DELIVERED');
    expect(row?.deliveredByUserId).toBe(seeded.operatorId);
    expect(row?.deliveredAt).toBeInstanceOf(Date);
    expect(row!.deliveredAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(row!.deliveredAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('ignores a date and a person posted by the browser', async () => {
    const placed = await anOrder();
    const forged = new Date('2001-01-01T00:00:00.000Z');

    session = { id: AUTH.operator };
    expect(
      (
        await deliver({
          orderId: placed.id,
          deliveredAt: forged.toISOString(),
          deliveredBy: seeded.alphaUserId,
          deliveredByUserId: seeded.alphaUserId,
          status: 'Shipped',
        })
      ).ok,
    ).toBe(true);

    const row = await raw(placed.id);
    expect(row?.deliveredAt?.getTime()).not.toBe(forged.getTime());
    expect(row!.deliveredAt!.getFullYear()).toBeGreaterThan(2020);
    expect(row?.deliveredByUserId).toBe(seeded.operatorId);
    expect(row?.status).toBe('DELIVERED');
  });

  it('does not mark it received — that is the client’s to say', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    await deliver({ orderId: placed.id });

    const row = await raw(placed.id);
    expect(row?.receivedAt).toBeNull();
    expect(row?.receivedByUserId).toBeNull();
  });

  it('names the operator when the order is read back', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    await deliver({ orderId: placed.id });
    const order = await orders.getKitOrder(app, placed.id);
    expect(order?.deliveredByName).toBe('Ops Person');
  });
});

describe('16 & 17. a business cannot mark its own order delivered', () => {
  it('refuses the business owner, and writes nothing', async () => {
    const placed = await anOrder();

    session = { id: AUTH.alpha };
    expect((await deliver({ orderId: placed.id })).ok).toBe(false);

    const row = await raw(placed.id);
    expect(row?.status).toBe('RECEIVED');
    expect(row?.deliveredAt).toBeNull();
  });

  it('refuses a stranger too', async () => {
    const placed = await anOrder();
    session = null;
    expect((await deliver({ orderId: placed.id })).ok).toBe(false);
    expect((await raw(placed.id))?.deliveredAt).toBeNull();
  });

  it('hides the receipt control until the order has been delivered', () => {
    const page = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'orders', 'page.tsx'));
    expect(page).toContain('{order.deliveredAt ? (');
    const guarded = page.slice(page.indexOf('{order.deliveredAt ? ('));
    expect(guarded).toContain('<KitOrderReceiptForm');
    // The only place the form appears is inside that guard.
    expect(page.split('<KitOrderReceiptForm')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// RECEIPT — 18 to 22
// ---------------------------------------------------------------------------

describe('18, 19 & 20. a business confirms its own delivered order', () => {
  it('records the time and the person, server-side', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    await deliver({ orderId: placed.id });

    const before = new Date();
    session = { id: AUTH.alpha };
    expect((await acknowledge({ clientId: seeded.alphaClient, orderId: placed.id })).ok).toBe(true);

    const row = await raw(placed.id);
    expect(row?.receivedByUserId).toBe(seeded.alphaUserId);
    expect(row!.receivedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(row!.receivedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('ignores a posted date and a posted person', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    await deliver({ orderId: placed.id });

    session = { id: AUTH.alpha };
    await acknowledge({
      clientId: seeded.alphaClient,
      orderId: placed.id,
      receivedAt: '2001-01-01T00:00:00.000Z',
      receivedBy: seeded.operatorId,
      receivedByUserId: seeded.operatorId,
    });

    const row = await raw(placed.id);
    expect(row!.receivedAt!.getFullYear()).toBeGreaterThan(2020);
    expect(row?.receivedByUserId).toBe(seeded.alphaUserId);
  });

  it('cannot confirm an order nobody has said they sent', async () => {
    const placed = await anOrder();
    session = { id: AUTH.alpha };
    expect((await acknowledge({ clientId: seeded.alphaClient, orderId: placed.id })).ok).toBe(false);
    expect((await raw(placed.id))?.receivedAt).toBeNull();
  });

  it('does not mark it delivered — that is Headway’s to say', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    await deliver({ orderId: placed.id });
    const deliveredAt = (await raw(placed.id))!.deliveredAt;

    session = { id: AUTH.alpha };
    await acknowledge({ clientId: seeded.alphaClient, orderId: placed.id });

    const row = await raw(placed.id);
    expect(row?.status).toBe('DELIVERED');
    expect(row?.deliveredAt?.getTime()).toBe(deliveredAt?.getTime());
    expect(row?.deliveredByUserId).toBe(seeded.operatorId);
  });
});

describe('21 & 22. a business cannot reach another’s order, or change its own', () => {
  it('cannot acknowledge somebody else’s order', async () => {
    const placed = await anOrder(seeded.alphaClient, AUTH.alpha);
    session = { id: AUTH.operator };
    await deliver({ orderId: placed.id });

    // Beta, posting their own (approved) client id with Alpha's order id.
    session = { id: AUTH.beta };
    expect((await acknowledge({ clientId: seeded.betaClient, orderId: placed.id })).ok).toBe(false);
    // And posting Alpha's client id, which their gate refuses outright.
    expect((await acknowledge({ clientId: seeded.alphaClient, orderId: placed.id })).ok).toBe(false);

    expect((await raw(placed.id))?.receivedAt).toBeNull();
  });

  it('changes no price, no item, no quantity and no total by acknowledging', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    await deliver({ orderId: placed.id });
    const before = await raw(placed.id);

    session = { id: AUTH.alpha };
    await acknowledge({
      clientId: seeded.alphaClient,
      orderId: placed.id,
      totalInr: '1',
      total: '1',
      status: 'RECEIVED',
      'qty:card-qr-stand': '99',
      itemsJson: '[]',
    });

    const after = await raw(placed.id);
    expect(after?.totalInr).toBe(before?.totalInr);
    expect(after?.itemsJson).toBe(before?.itemsJson);
    expect(after?.status).toBe(before?.status);
  });

  it('takes none of those as parameters in the first place', () => {
    const service = code(read('src', 'lib', 'kit', 'orders.ts'));
    const fn = service.slice(
      service.indexOf('export async function acknowledgeKitOrderReceived'),
      service.indexOf('async function needOrder'),
    );
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).toContain('data: { receivedAt:');
    expect(fn).not.toContain('totalInr');
    expect(fn).not.toContain('itemsJson');
    expect(fn).not.toContain('status:');
  });
});

// ---------------------------------------------------------------------------
// DELETE — 23 to 28
// ---------------------------------------------------------------------------

describe('23. a business cannot delete an order', () => {
  it('refuses the owner of the order’s own business', async () => {
    const placed = await anOrder();
    session = { id: AUTH.alpha };
    const result = await remove({ orderId: placed.id, clientId: seeded.alphaClient });
    expect(result.ok).toBe(false);
    expect(await raw(placed.id)).not.toBeNull();
  });

  it('refuses another business, and a stranger', async () => {
    const placed = await anOrder();
    session = { id: AUTH.beta };
    expect((await remove({ orderId: placed.id })).ok).toBe(false);
    session = null;
    expect((await remove({ orderId: placed.id })).ok).toBe(false);
    expect(await raw(placed.id)).not.toBeNull();
  });

  it('is not reachable from any client-facing page', () => {
    const workspace = join(ROOT, 'src', 'app', '(workspace)');
    const stack = [workspace];
    const offenders: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (/\.tsx?$/.test(entry) && readFileSync(full, 'utf8').includes('deleteKitOrder')) {
          offenders.push(full);
        }
      }
    }
    expect(offenders).toEqual([]);
    expect(code(read('src', 'components', 'forms', 'kit-receipt-form.tsx'))).not.toContain(
      'deleteKitOrder',
    );
  });
});

describe('24, 26 & 27. an operator deletes an order', () => {
  it('removes it, and it disappears from both views', async () => {
    const placed = await anOrder();
    session = { id: AUTH.operator };
    await expect(remove({ orderId: placed.id })).rejects.toThrow(/NEXT_REDIRECT/);

    expect(await raw(placed.id)).toBeNull();

    session = { id: AUTH.operator };
    expect(await orders.listAllKitOrders(app)).toEqual([]);
    expect(await orders.getKitOrder(app, placed.id)).toBeNull();

    session = { id: AUTH.alpha };
    expect(await orders.listKitOrders(app, seeded.alphaClient)).toEqual([]);
    expect(await orders.latestKitOrder(app, seeded.alphaClient)).toBeNull();
  });

  it('drops the badge when it was the final order, and keeps it when it was not', async () => {
    session = { id: AUTH.alpha };
    await place(seeded.alphaClient, { 'card-qr-stand': '1' });
    await place(seeded.alphaClient, { 'folded-tent': '1' });
    const both = await owner.kitOrder.findMany({
      where: { clientId: seeded.alphaClient },
      select: { id: true },
    });

    session = { id: AUTH.operator };
    await expect(remove({ orderId: both[0]!.id })).rejects.toThrow(/NEXT_REDIRECT/);
    session = { id: AUTH.operator };
    let list = new Map((await clients.listClients(app)).map((r) => [r.id, r]));
    expect(list.get(seeded.alphaClient)?.kitOrderCount).toBe(1);

    session = { id: AUTH.operator };
    await expect(remove({ orderId: both[1]!.id })).rejects.toThrow(/NEXT_REDIRECT/);
    session = { id: AUTH.operator };
    list = new Map((await clients.listClients(app)).map((r) => [r.id, r]));
    expect(list.get(seeded.alphaClient)?.kitOrderCount).toBe(0);
  });
});

describe('25. deleting takes an explicit confirmation', () => {
  it('puts Cancel first, behind a second click', () => {
    const control = code(read('src', 'components', 'forms', 'kit-order-controls.tsx'));
    expect(control).toContain('const [confirming, setConfirming] = useState(false);');
    expect(control).toContain('onClick={() => setConfirming(true)}');
    expect(control).toContain('onClick={() => setConfirming(false)}');
    expect(control).toContain('This cannot be undone');
    // The form that actually deletes only exists in the confirming branch.
    const confirmBranch = control.slice(control.indexOf('if (!confirming)'));
    expect(confirmBranch).toContain('<form action={action}');
    expect(control).toContain('variant="danger"');
  });

  it('re-checks the permission on the server whatever the browser did', () => {
    const kitActions = code(read('src', 'lib', 'actions', 'kit.ts'));
    const fn = kitActions.slice(kitActions.indexOf('export async function deleteKitOrderAction'));
    expect(fn).toContain('const gate = await adminGate();');
    expect(fn.indexOf('adminGate')).toBeLessThan(fn.indexOf("str(form, 'orderId')"));
    expect(fn).not.toContain("str(form, 'clientId')");
  });
});

describe('28. deleting an order touches nothing else', () => {
  it('leaves the client, its feedback, its gateway and the other business alone', async () => {
    const placed = await anOrder(seeded.alphaClient, AUTH.alpha);
    const other = await anOrder(seeded.betaClient, AUTH.beta);

    await owner.reviewItem.create({
      data: {
        clientId: seeded.alphaClient,
        source: 'REP_OS_QR',
        text: 'The card was easy to scan',
        stars: 5,
      },
    });
    await owner.feedbackGateway.create({
      data: { clientId: seeded.alphaClient, publicToken: 'tok-alpha-m36', enabled: true },
    });

    const clientBefore = await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClient } });

    session = { id: AUTH.operator };
    await expect(remove({ orderId: placed.id })).rejects.toThrow(/NEXT_REDIRECT/);

    expect(await owner.reviewItem.count({ where: { clientId: seeded.alphaClient } })).toBe(1);
    expect(await owner.feedbackGateway.count({ where: { clientId: seeded.alphaClient } })).toBe(1);
    expect(await owner.client.findUniqueOrThrow({ where: { id: seeded.alphaClient } })).toEqual(
      clientBefore,
    );
    // The other business's order is untouched.
    expect(await raw(other.id)).not.toBeNull();
  });

  it('has nothing pointing at an order for a delete to cascade into', () => {
    const schema = read('prisma', 'schema.prisma');
    // A foreign key is a relation field with `fields:` on it. No model
    // anywhere declares one whose TYPE is KitOrder, so nothing hangs off an
    // order and there is no cascade to reason about. The only KitOrder
    // relations are the list-valued back-references, which carry no key.
    const owning = [...schema.matchAll(/^\s*\w+\s+KitOrder\??\s+@relation\([^)]*fields:/gm)];
    expect(owning).toEqual([]);
    const backRefs = [...schema.matchAll(/^\s*(\w+)\s+KitOrder\[\]/gm)].map((m) => m[1]);
    expect(backRefs.sort()).toEqual(['kitOrders', 'kitOrdersDelivered', 'kitOrdersReceived']);
  });
});

// ---------------------------------------------------------------------------
// PRICING — 29 to 31
// ---------------------------------------------------------------------------

describe('29, 30 & 31. the money is the server’s, and history keeps its own', () => {
  it('prices a new order at ₹99 and ₹49', async () => {
    session = { id: AUTH.alpha };
    await place(seeded.alphaClient, { 'card-qr-stand': '2', 'folded-tent': '3' });
    session = { id: AUTH.operator };
    const latest = await orders.latestKitOrder(app, seeded.alphaClient);
    expect(latest?.lines.map((l) => l.unitPriceInr)).toEqual([99, 49]);
    expect(latest?.totalInr).toBe(345);
  });

  it('ignores a price the browser sends alongside the quantities', async () => {
    session = { id: AUTH.alpha };
    const f = new FormData();
    f.set('clientId', seeded.alphaClient);
    f.set('qty:card-qr-stand', '2');
    f.set('unitPriceInr', '1');
    f.set('totalInr', '1');
    f.set('price', '1');
    expect((await actions.placeKitOrderAction(shared.IDLE, f)).ok).toBe(true);

    session = { id: AUTH.operator };
    const latest = await orders.latestKitOrder(app, seeded.alphaClient);
    expect(latest?.totalInr).toBe(198);
    expect(latest?.lines[0]?.unitPriceInr).toBe(99);
  });

  it('leaves an order stored at ₹100 and ₹50 exactly as it was', async () => {
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

    session = { id: AUTH.operator };
    const historical = await orders.latestKitOrder(app, seeded.alphaClient);
    expect(historical?.totalInr).toBe(350);
    expect(historical?.lines.map((l) => l.unitPriceInr)).toEqual([100, 50]);

    // And delivering it does not touch the money either.
    const row = await owner.kitOrder.findFirstOrThrow({ select: { id: true } });
    session = { id: AUTH.operator };
    await deliver({ orderId: row.id });
    const after = await raw(row.id);
    expect(after?.totalInr).toBe(350);
    expect(JSON.parse(after!.itemsJson)[0].unitPriceInr).toBe(100);
  });
});
