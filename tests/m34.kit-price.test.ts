import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIT_PRODUCTS, kitProduct, priceOrder } from '@/lib/kit/catalogue';

/**
 * A NEW PRICE, AND THE ORDERS THAT WERE ALREADY PLACED (M34).
 *
 * The catalogue moved from ₹100/₹50 to ₹99/₹49. Two things have to be true
 * afterwards, and they pull in opposite directions:
 *
 *   1. The next order costs ₹99 and ₹49.
 *   2. Every order already placed still says what it said. A record of what
 *      somebody agreed to pay is not something a later price list may edit.
 *
 * The second is the one worth guarding, because it holds only as long as every
 * read path takes its figures off the stored row. The moment one of them looks
 * the price up again, history quietly rewrites itself and nothing fails.
 *
 * The operator's KIT ORDERED badge is here too — the source half of it. What it
 * is derived FROM is a database question, so it is answered in
 * `m34.operator-badge-rls.test.ts` against real rows under the real policies.
 */

const ROOT = resolve(__dirname, '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

/** The file with its comments removed, so prose cannot satisfy a rule. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CATALOGUE = code(read('src', 'lib', 'kit', 'catalogue.ts'));
const ORDERS_SERVICE = code(read('src', 'lib', 'kit', 'orders.ts'));
const ORDERS_PAGE = code(
  read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'orders', 'page.tsx'),
);
const CLIENTS_LIST = code(read('src', 'app', '(app)', 'clients', 'page.tsx'));
const CLIENT_LAYOUT = code(read('src', 'app', '(app)', 'clients', '[id]', 'layout.tsx'));
const CLIENTS_SERVICE = code(read('src', 'lib', 'clients', 'service.ts'));

// ---------------------------------------------------------------------------
// 1 and 2. The new prices
// ---------------------------------------------------------------------------

describe('1 & 2. the catalogue charges ₹99 and ₹49', () => {
  it('prices the stand at ₹99', () => {
    expect(kitProduct('card-qr-stand')?.priceInr).toBe(99);
  });

  it('prices the tent at ₹49', () => {
    expect(kitProduct('folded-tent')?.priceInr).toBe(49);
  });

  it('still keeps money in whole rupees', () => {
    for (const product of KIT_PRODUCTS) {
      expect(Number.isInteger(product.priceInr)).toBe(true);
    }
  });

  it('says the old prices nowhere in the source', () => {
    // Not `priceInr: 100` and not `priceInr: 50`, anywhere.
    expect(CATALOGUE).not.toMatch(/priceInr:\s*(100|50)\b/);
  });
});

// ---------------------------------------------------------------------------
// 3. The price is the server's
// ---------------------------------------------------------------------------

describe('3. the server ignores anything the browser says about money', () => {
  it('prices from the catalogue alone, whatever else was sent', () => {
    // priceOrder takes quantities. There is no parameter it could take a price
    // through, and the extra keys below are not products, so they are refused
    // rather than priced.
    const priced = priceOrder({ 'card-qr-stand': 1 });
    expect(priced.ok && priced.lines[0]?.unitPriceInr).toBe(99);

    const forged = priceOrder({ 'card-qr-stand': 1, price: 1 });
    expect(forged.ok).toBe(false);
    expect(forged.ok === false && forged.problem).toBe('UNKNOWN_PRODUCT');
  });

  it('keeps the only price list in one file, reached by key', () => {
    expect(ORDERS_SERVICE).toContain('const priced = priceOrder(input.quantities)');
    expect(ORDERS_SERVICE).toContain('totalInr: priced.totalInr');
  });
});

// ---------------------------------------------------------------------------
// 4. What a new order costs
// ---------------------------------------------------------------------------

describe('4. a new order is priced at ₹99 and ₹49', () => {
  it('multiplies and sums at the new prices', () => {
    const priced = priceOrder({ 'card-qr-stand': 2, 'folded-tent': 3 });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 99, lineTotalInr: 198 },
      { productKey: 'folded-tent', quantity: 3, unitPriceInr: 49, lineTotalInr: 147 },
    ]);
    expect(priced.totalInr).toBe(345);
  });

  it('prices a single-product order at the new price too', () => {
    expect(priceOrder({ 'folded-tent': 10 }).ok && priceOrder({ 'folded-tent': 10 })).toMatchObject(
      { totalInr: 490 },
    );
  });
});

// ---------------------------------------------------------------------------
// 5. A price change does not reach back
// ---------------------------------------------------------------------------

describe('5. a price change does not reach back', () => {
  it('never recomputes a stored line from the catalogue', () => {
    // linesFrom consults the catalogue to check the product KEY is real and to
    // narrow the type. It must never read `product.priceInr` — that one line
    // would rewrite every order in the database every time a price moved.
    const linesFrom = ORDERS_SERVICE.slice(
      ORDERS_SERVICE.indexOf('function linesFrom'),
      ORDERS_SERVICE.indexOf('type Row = {'),
    );
    expect(linesFrom.length).toBeGreaterThan(100);
    expect(linesFrom).toContain('const unitPriceInr = Number(line.unitPriceInr)');
    expect(linesFrom).toContain('const lineTotalInr = Number(line.lineTotalInr)');
    expect(linesFrom).not.toContain('priceInr: product.priceInr');
    expect(linesFrom).not.toContain('product.priceInr');
  });

  it('reads a stored order back off the row, not off the price list', () => {
    const from = ORDERS_SERVICE.indexOf('function toOrder');
    const toOrder = ORDERS_SERVICE.slice(
      from,
      ORDERS_SERVICE.indexOf('export async function', from),
    );
    expect(from).toBeGreaterThan(0);
    expect(toOrder).toContain('lines: linesFrom(row.itemsJson)');
    expect(toOrder).toContain('totalInr: row.totalInr');
    expect(toOrder).not.toContain('priceOrder');
  });

  it('prices an order once, on the way in, and nowhere else', () => {
    // One call site in the whole of src/, and it is the write path.
    const uses = [
      code(read('src', 'lib', 'kit', 'orders.ts')),
      code(read('src', 'lib', 'actions', 'kit.ts')),
      ORDERS_PAGE,
      code(read('src', 'components', 'forms', 'kit-order-form.tsx')),
      code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx')),
    ]
      .join('\n')
      .split('priceOrder(').length - 1;
    // The import in orders.ts is `priceOrder,` without a bracket, so this
    // counts calls: exactly one, inside placeKitOrder.
    expect(uses).toBe(1);
  });

  it('shows history from the stored figures, never from today’s catalogue', () => {
    expect(ORDERS_PAGE).toContain('money(line.lineTotalInr)');
    expect(ORDERS_PAGE).toContain('money(order.totalInr)');
    expect(ORDERS_PAGE).not.toContain('priceInr');
    expect(ORDERS_PAGE).not.toContain('priceOrder');
  });

  it('never writes money onto an order that already exists', () => {
    // M36 gave an order two more things that can change after it is placed —
    // that it was sent, and that it arrived. So the rule is no longer "never
    // update an order"; it is that no update may touch what it COST. Every
    // `data:` block on an existing order is checked for the money fields.
    const sources = [ORDERS_SERVICE, code(read('src', 'lib', 'actions', 'kit.ts'))];
    const offenders: string[] = [];
    for (const source of sources) {
      for (const match of source.matchAll(
        /kitOrder\.(update|updateMany|upsert)\(\{([\s\S]*?)\n\s*\}\)/g,
      )) {
        const body = match[2] ?? '';
        for (const money of ['itemsJson', 'totalInr', 'unitPriceInr', 'lineTotalInr', 'number:']) {
          if (body.includes(money)) offenders.push(`${match[1]} writes ${money}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // And the updates that DO exist write only the four M36 columns.
    const written = [...ORDERS_SERVICE.matchAll(/data: \{([^}]*)\}/g)]
      .flatMap((m) => [...(m[1] ?? '').matchAll(/(\w+):/g)].map((f) => f[1]))
      .filter((f) => f !== 'set');
    for (const field of written) {
      expect(
        [
          'clientId', 'number', 'status', 'itemsJson', 'totalInr', 'createdAt', 'updatedAt',
          'deliveredAt', 'deliveredByUserId', 'receivedAt', 'receivedByUserId',
        ],
        `unexpected written field ${field}`,
      ).toContain(field);
    }
  });
});

// ---------------------------------------------------------------------------
// 6, 7 and 8. The operator's badge — the source half
// ---------------------------------------------------------------------------

describe('6 & 7. the clients list badges a business that has ordered', () => {
  it('shows the badge only when the count is above zero', () => {
    expect(CLIENTS_LIST).toContain('{client.kitOrderCount > 0 ? (');
    expect(CLIENTS_LIST).toContain('<Badge tone="brand">Kit ordered</Badge>');
    // `: null` — nothing at all for a business that has not ordered.
    const badge = CLIENTS_LIST.slice(CLIENTS_LIST.indexOf('client.kitOrderCount > 0'));
    expect(badge.slice(0, 220)).toContain(': null');
  });

  it('reads the count from the business’s own rows, not from a stored flag', () => {
    expect(CLIENTS_SERVICE).toContain('_count: { select: { snapshots: true, kitOrders: true } }');
    expect(CLIENTS_SERVICE).toContain('kitOrderCount: row._count.kitOrders');
    expect(CLIENTS_SERVICE).toContain('kitOrderCount: number;');
    // No column on Client, no cache, no second source of truth.
    expect(read('prisma', 'schema.prisma')).not.toContain('hasOrderedKit');
    expect(read('prisma', 'schema.prisma')).not.toMatch(/kitOrderCount\s+Int/);
  });

  it('is gold: worth noticing, and not one of the two alarms', () => {
    const ui = read('src', 'components', 'ui.tsx');
    expect(ui).toContain("brand: 'bg-brand-50 text-brand-700 border-brand-200'");
    // Not the red that means something is wrong, not the green that claims
    // something is going well.
    expect(CLIENTS_LIST).not.toContain('<Badge tone="bad">Kit ordered</Badge>');
    expect(CLIENTS_LIST).not.toContain('<Badge tone="good">Kit ordered</Badge>');
  });
});

describe('8. the client-detail header carries the same badge', () => {
  it('shows it from the same kind of count', () => {
    expect(CLIENT_LAYOUT).toContain('_count: { select: { kitOrders: true } }');
    expect(CLIENT_LAYOUT).toContain('{client._count.kitOrders > 0 ? (');
    expect(CLIENT_LAYOUT).toContain('<Badge tone="brand">Kit ordered</Badge>');
  });

  it('says it the same way in both places, so it is one thing not two', () => {
    const badge = '<Badge tone="brand">Kit ordered</Badge>';
    expect(CLIENTS_LIST).toContain(badge);
    expect(CLIENT_LAYOUT).toContain(badge);
  });

  it('sits beside the badges that were already there', () => {
    // Same actions row as Archived / status / plan — not a new panel, not a
    // new column, not a redesign.
    const actions = CLIENT_LAYOUT.slice(
      CLIENT_LAYOUT.indexOf('actions={'),
      CLIENT_LAYOUT.indexOf('Edit details'),
    );
    expect(actions).toContain('Kit ordered');
    expect(actions).toContain('titleCase(client.status)');
  });
});

// ---------------------------------------------------------------------------
// The table still fits
// ---------------------------------------------------------------------------

describe('the badge does not break the clients table', () => {
  it('wraps inside the cell it is in rather than widening the row', () => {
    expect(CLIENTS_LIST).toContain('<div className="flex flex-wrap items-center gap-1.5">');
  });

  it('leaves the table’s own width and scroller exactly as they were', () => {
    // The operator table has always been a wide table in a horizontal
    // scroller. M34 must not have changed either number.
    expect(CLIENTS_LIST).toContain('<div className="overflow-x-auto">');
    expect(CLIENTS_LIST).toContain('table className="w-full min-w-[980px] text-left text-[13px]"');
  });

  it('adds no column to the table', () => {
    const head = CLIENTS_LIST.slice(CLIENTS_LIST.indexOf('<thead'), CLIENTS_LIST.indexOf('</thead>'));
    const headings = [...head.matchAll(/<th[^>]*>\s*([^<]*)/g)].map((m) => m[1]?.trim() ?? '');
    expect(headings.filter(Boolean)).toEqual([
      'Business',
      'Vertical',
      'Status',
      'Service',
      'Baseline',
      'Snapshots',
      'Last snapshot',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 10 and 11. Nothing else moved
// ---------------------------------------------------------------------------

describe('10 & 11. ordering and the history still work as they did', () => {
  it('still refuses zero, a negative, a fraction and an unknown product', () => {
    expect(priceOrder({ 'card-qr-stand': 0, 'folded-tent': 0 }).ok).toBe(false);
    expect(priceOrder({ 'card-qr-stand': -1 }).ok).toBe(false);
    expect(priceOrder({ 'card-qr-stand': 1.5 }).ok).toBe(false);
    expect(priceOrder({ nope: 1 }).ok).toBe(false);
  });

  it('still lets a business order one product and not the other', () => {
    const priced = priceOrder({ 'card-qr-stand': 0, 'folded-tent': 2 });
    expect(priced.ok).toBe(true);
    expect(priced.ok && priced.lines).toEqual([
      { productKey: 'folded-tent', quantity: 2, unitPriceInr: 49, lineTotalInr: 98 },
    ]);
  });

  it('still offers exactly two products, with the same photographs', () => {
    expect(KIT_PRODUCTS).toHaveLength(2);
    expect(KIT_PRODUCTS.map((p) => p.photo)).toEqual([
      '/kit/card-qr-stand.webp',
      '/kit/folded-tent-card.webp',
    ]);
  });

  it('still shows the history with its date, items, quantities, total and status', () => {
    expect(ORDERS_PAGE).toContain('formatDate(order.placedAt)');
    expect(ORDERS_PAGE).toContain("t.plural('kit.orders.pieces', line.quantity)");
    expect(ORDERS_PAGE).toContain("t('kit.orders.status.received')");
  });
});
