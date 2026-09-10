import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, type MessageKey } from '@/lib/i18n/strings';
import {
  KIT_PRODUCTS,
  MAX_QUANTITY_PER_PRODUCT,
  kitProduct,
  priceOrder,
} from '@/lib/kit/catalogue';
import { PRINT_SHEETS } from '@/lib/kit/sheets';

/**
 * ORDERING THE PRINTED KIT (M33).
 *
 * The Kit page stopped being a shelf of PDFs and became the place a business
 * asks Headway for the printed thing. What is worth protecting is not a
 * layout — it is that the two products are the two real ones, that the prices
 * live on the server, that a quantity is a whole number of at least one, that
 * the confirmation promises only what Headway can do, and that none of the
 * machinery this page sits on top of moved.
 *
 * Tests 10–16 — the ones about whose order this is — are in
 * `m33.kit-orders-rls.test.ts`, against a real database under the real
 * policies. A claim about isolation is worth nothing if the only thing
 * enforcing it is a component that declines to render.
 */

const ROOT = resolve(__dirname, '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const says = (key: MessageKey) => MESSAGES[key].en;

/** The file with its comments removed, so prose cannot satisfy a rule. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const KIT_PAGE = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx'));
const ORDERS_PAGE = code(
  read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'orders', 'page.tsx'),
);
const FORM = code(read('src', 'components', 'forms', 'kit-order-form.tsx'));
const NAV = code(read('src', 'components', 'portal', 'workspace.tsx'));
const ACTION = code(read('src', 'lib', 'actions', 'kit.ts'));
const ORDERS_SERVICE = code(read('src', 'lib', 'kit', 'orders.ts'));
const CATALOGUE = code(read('src', 'lib', 'kit', 'catalogue.ts'));

// ---------------------------------------------------------------------------
// KIT — 1 to 9
// ---------------------------------------------------------------------------

describe('1. the navigation says Kit', () => {
  it('renames the door and leaves the address alone', () => {
    expect(says('nav.section.kit')).toBe('Kit');
    // The slug is an address people have been sent. It does not move because
    // the label did.
    expect(NAV).toContain("{ slug: 'kit', label: 'nav.section.kit', extra: true }");
    expect(says('nav.section.orders')).toBe('Orders');
    expect(NAV).toContain("{ slug: 'orders', label: 'nav.section.orders', extra: true }");
  });

  it('names the door in all three languages, never in English twice', () => {
    for (const key of ['nav.section.kit', 'nav.section.orders'] as const) {
      const phrase = MESSAGES[key];
      expect(phrase.hi, `${key} has no Hindi`).toBeTruthy();
      expect(phrase.mr, `${key} has no Marathi`).toBeTruthy();
      expect(phrase.hi).not.toBe(phrase.en);
      expect(phrase.mr).not.toBe(phrase.en);
    }
  });

  it('keeps Orders inside the workspace, where there is a session to own it', () => {
    // The shared link has no session. An order belongs to a business, not to
    // whoever holds the link, so this door is `extra` like Team and Account.
    const block = NAV.slice(NAV.indexOf('const SECTIONS'), NAV.indexOf('] as const satisfies'));
    const orders = block.split('\n').find((line) => line.includes("slug: 'orders'")) ?? '';
    expect(orders).toContain('extra: true');
  });
});

describe('2. the page shows exactly two products', () => {
  it('lists two, with two keys and two photographs', () => {
    expect(KIT_PRODUCTS).toHaveLength(2);
    expect(new Set(KIT_PRODUCTS.map((p) => p.key)).size).toBe(2);
    expect(new Set(KIT_PRODUCTS.map((p) => p.photo)).size).toBe(2);
  });

  it('renders the catalogue rather than a list written into the page', () => {
    expect(KIT_PAGE).toContain('KIT_PRODUCTS.map');
    expect(FORM).toContain('products.map');
    // A third product would have to be added to the catalogue, with a
    // photograph of the real thing — not typed into a component.
    expect(FORM).not.toMatch(/priceInr:\s*\d+/);
  });

  it('offers nothing else to buy', () => {
    for (const invented of ['sticker', 'poster', 'banner', 'mug', 'badge', 'flyer']) {
      expect(KIT_PAGE.toLowerCase(), `the page offers a ${invented}`).not.toContain(invented);
    }
  });
});

describe('3. the product names are the ones agreed', () => {
  it('says the two names exactly', () => {
    expect(says('kit.product.stand.name')).toBe('4 × 6 in Card + QR Stand');
    expect(says('kit.product.tent.name')).toBe('4 × 6 in Folded Tent Card');
  });

  it('describes each in the words agreed, and invents no other specification', () => {
    expect(says('kit.product.stand.description')).toBe(
      'A personalized 4 × 6 in feedback card with a clear QR stand holder. Ready to place where customers can see it.',
    );
    expect(says('kit.product.tent.description')).toBe(
      'A personalized 4 × 6 in feedback card folded into a standing tent for tables and counters.',
    );
    for (const key of ['kit.product.stand.description', 'kit.product.tent.description'] as const) {
      for (const invented of ['gsm', 'lamination', 'matte', 'gloss', 'paper weight']) {
        expect(says(key).toLowerCase()).not.toContain(invented);
      }
    }
  });

  it('says the heading and the supporting line agreed for the page', () => {
    expect(says('kit.order.eyebrow')).toBe('Kit');
    expect(says('kit.order.heading')).toBe('Your Feedback Kit');
    expect(says('kit.order.intro')).toBe('Choose the format that works best for your business.');
    expect(KIT_PAGE).toContain("eyebrow={t('kit.order.eyebrow')}");
    expect(KIT_PAGE).toContain("title={t('kit.order.heading')}");
    expect(KIT_PAGE).toContain("description={t('kit.order.intro')}");
  });
});

describe('4. the prices are the ones agreed', () => {
  it('charges ₹99 for the stand and ₹49 for the tent', () => {
    // M34 moved these from ₹100 and ₹50. Orders already placed keep the price
    // they were placed at — see "a price change does not reach back" below.
    expect(kitProduct('card-qr-stand')?.priceInr).toBe(99);
    expect(kitProduct('folded-tent')?.priceInr).toBe(49);
  });

  it('keeps money in whole rupees, so no float ever touches it', () => {
    for (const product of KIT_PRODUCTS) {
      expect(Number.isInteger(product.priceInr)).toBe(true);
      expect(product.priceInr).toBeGreaterThan(0);
    }
  });

  it('says the price per piece, with the figure filled in by the server', () => {
    expect(says('kit.price.perPiece')).toBe('₹{price} per piece');
    expect(says('kit.line.quantityPrice')).toBe('{quantity} × ₹{price}');
  });
});

describe('5. the uploaded product photographs are the ones used', () => {
  it('points each product at its own photograph', () => {
    expect(kitProduct('card-qr-stand')?.photo).toBe('/kit/card-qr-stand.webp');
    expect(kitProduct('folded-tent')?.photo).toBe('/kit/folded-tent-card.webp');
  });

  it('has both files on disk, as real images of a real card', () => {
    for (const product of KIT_PRODUCTS) {
      const path = join(ROOT, 'public', product.photo.slice(1));
      const bytes = readFileSync(path);
      // RIFF....WEBP — the file the owner supplied, not a placeholder.
      expect(bytes.subarray(0, 4).toString('latin1'), product.photo).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('latin1'), product.photo).toBe('WEBP');
      expect(statSync(path).size).toBeGreaterThan(50_000);
    }
  });

  it('shows the photograph, not a render of the PDF master', () => {
    expect(FORM).toContain('src={product.photo}');
    // The PDF previews still exist, and still belong to the reprint section.
    for (const sheet of PRINT_SHEETS) {
      expect(FORM).not.toContain(sheet.preview);
    }
  });

  it('describes each photograph for somebody who cannot see it', () => {
    expect(FORM).toContain('alt={product.alt}');
    for (const product of KIT_PRODUCTS) {
      expect(says(product.altKey).length).toBeGreaterThan(20);
    }
  });
});

describe('6. one is the smallest quantity of anything', () => {
  it('refuses a line of zero: zero is not an order, it is a not-ordering', () => {
    const none = priceOrder({ 'card-qr-stand': 0, 'folded-tent': 0 });
    expect(none.ok).toBe(false);
    expect(none.ok === false && none.problem).toBe('EMPTY');
  });

  it('never records a line with a quantity below one', () => {
    const priced = priceOrder({ 'card-qr-stand': 0, 'folded-tent': 2 });
    expect(priced.ok).toBe(true);
    if (priced.ok) {
      expect(priced.lines).toHaveLength(1);
      expect(priced.lines[0]?.productKey).toBe('folded-tent');
      for (const line of priced.lines) expect(line.quantity).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows a stepper that cannot display zero, and an Add button instead', () => {
    // Below one there is no smaller order — there is only not ordering it.
    expect(FORM).toContain('if (quantity < 1)');
    expect(FORM).toContain("t('kit.quantity.add')");
    expect(says('kit.quantity.add')).toBe('Add to order');
    expect(FORM).toContain('.filter((line) => line.quantity >= 1)');
  });

  it('starts both products at one', () => {
    expect(FORM).toContain('Object.fromEntries(products.map((product) => [product.key, 1]))');
  });
});

describe('7. changing a quantity changes the amount', () => {
  it('multiplies by the server price, per line and in total', () => {
    const priced = priceOrder({ 'card-qr-stand': 2, 'folded-tent': 3 });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.lines).toEqual([
      { productKey: 'card-qr-stand', quantity: 2, unitPriceInr: 99, lineTotalInr: 198 },
      { productKey: 'folded-tent', quantity: 3, unitPriceInr: 49, lineTotalInr: 147 },
    ]);
    expect(priced.totalInr).toBe(345);
  });

  it('adds the lines up rather than trusting any single figure', () => {
    const priced = priceOrder({ 'card-qr-stand': 7, 'folded-tent': 11 });
    expect(priced.ok && priced.totalInr).toBe(7 * 99 + 11 * 49);
  });

  it('recomputes the reading on screen from the same two numbers', () => {
    expect(FORM).toContain('sum + line.quantity * line.product.priceInr');
    expect(FORM).toContain('money(quantity * product.priceInr)');
  });
});

describe('8. an impossible quantity is refused, not rounded', () => {
  const cases: Array<[string, unknown, string]> = [
    ['a negative', -1, 'NEGATIVE'],
    ['a fraction', 1.5, 'NOT_WHOLE'],
    ['a word', 'lots', 'NOT_A_NUMBER'],
    ['a fraction written as text', '1.5', 'NOT_A_NUMBER'],
    ['hexadecimal, which Number() would have read as 16', '0x10', 'NOT_A_NUMBER'],
    ['an exponent, which Number() would have read as 100', '1e2', 'NOT_A_NUMBER'],
    ['a negative written as text', '-1', 'NEGATIVE'],
    ['more than anyone orders', MAX_QUANTITY_PER_PRODUCT + 1, 'TOO_MANY'],
  ];

  for (const [what, value, problem] of cases) {
    it(`refuses ${what}`, () => {
      const priced = priceOrder({ 'card-qr-stand': value });
      expect(priced.ok).toBe(false);
      expect(priced.ok === false && priced.problem).toBe(problem);
    });
  }

  it('reads an absent field as "not this one", not as an error', () => {
    // A card left out of the order is a normal thing to do; an order with
    // every card left out is the error, and it is caught as an empty order.
    const priced = priceOrder({ 'card-qr-stand': '', 'folded-tent': '2' });
    expect(priced.ok).toBe(true);
    expect(priced.ok && priced.lines).toHaveLength(1);
    const nothing = priceOrder({ 'card-qr-stand': '', 'folded-tent': '' });
    expect(nothing.ok).toBe(false);
    expect(nothing.ok === false && nothing.problem).toBe('EMPTY');
  });

  it('refuses a product that does not exist', () => {
    const priced = priceOrder({ 'free-billboard': 1 });
    expect(priced.ok).toBe(false);
    expect(priced.ok === false && priced.problem).toBe('UNKNOWN_PRODUCT');
  });

  it('refuses rather than clamps — silently changing an order is worse', () => {
    expect(CATALOGUE).not.toContain('Math.max');
    expect(CATALOGUE).not.toContain('Math.round');
    expect(CATALOGUE).not.toContain('Math.abs');
  });

  it('tells the owner in their own language when it refuses', () => {
    expect(ORDERS_SERVICE).toContain("t('kit.order.error.empty')");
    expect(ORDERS_SERVICE).toContain("t('kit.order.error.quantity')");
    for (const key of ['kit.order.error.empty', 'kit.order.error.quantity'] as const) {
      expect(MESSAGES[key].hi).toBeTruthy();
      expect(MESSAGES[key].mr).toBeTruthy();
    }
  });
});

describe('9. the order summary says what was chosen', () => {
  it('is called "Your order" and totals with one word', () => {
    expect(says('kit.summary.title')).toBe('Your order');
    expect(says('kit.summary.total')).toBe('Total');
    expect(FORM).toContain("t('kit.summary.title')");
    expect(FORM).toContain("t('kit.summary.total')");
  });

  it('lists only what is actually in the order', () => {
    expect(FORM).toContain('chosen.map');
    expect(FORM).toContain('.filter((line) => line.quantity >= 1)');
  });

  it('cannot be ordered when it is empty', () => {
    expect(FORM).toContain('disabled={pending || chosen.length === 0}');
  });

  it('calls the button Order now, and never calls it a download', () => {
    expect(says('kit.order.cta')).toBe('Order now');
    expect(FORM).toContain("t('kit.order.cta')");
    const cta = says('kit.order.cta').toLowerCase();
    for (const wrong of ['download', 'print', 'pdf', 'generate']) {
      expect(cta).not.toContain(wrong);
    }
  });

  it('confirms in the words agreed, and promises nothing it cannot do', () => {
    expect(says('kit.order.placed.title')).toBe('Order placed');
    expect(says('kit.order.placed.body')).toBe(
      "Your order has been received. We'll contact you about the next step.",
    );
    const confirmation = `${says('kit.order.placed.title')} ${says('kit.order.placed.body')}`.toLowerCase();
    for (const promise of ['deliver', 'ship', 'dispatch', 'in stock', 'arrive', 'courier']) {
      expect(confirmation, `the confirmation promises "${promise}"`).not.toContain(promise);
    }
  });

  it('posts quantities and nothing else — no price rides along', () => {
    expect(FORM).toContain('name={`qty:${product.key}`}');
    expect(FORM).not.toMatch(/name="(price|unitPrice|total|totalInr|amount)"/);
    expect(FORM).not.toMatch(/name=\{`?(price|total)/);
  });
});

// ---------------------------------------------------------------------------
// ORDERS — the page. 10 to 16 are in m33.kit-orders-rls.test.ts.
// ---------------------------------------------------------------------------

describe('the Orders page shows date, items, quantities, total and status', () => {
  it('shows all five, from the stored row', () => {
    expect(ORDERS_PAGE).toContain('formatDate(order.placedAt)');
    expect(ORDERS_PAGE).toContain('order.lines.map');
    expect(ORDERS_PAGE).toContain("t.plural('kit.orders.pieces', line.quantity)");
    expect(ORDERS_PAGE).toContain('money(order.totalInr)');
    expect(ORDERS_PAGE).toContain("t('kit.orders.status.received')");
    expect(says('kit.orders.status.received')).toBe('Received');
  });

  it('reads the total back rather than recomputing it from today’s prices', () => {
    // An order from March still reads as what it cost in March.
    expect(ORDERS_PAGE).not.toContain('priceOrder');
    expect(ORDERS_PAGE).toContain('order.totalInr');
  });

  it('claims only the statuses the system can actually observe', () => {
    // Two since M36: Headway has the request, and an operator says they sent
    // it. Both are things a person actually asserts. There is still no
    // Shipped, no Preparing and no Out for delivery, because there is no
    // courier to ask.
    const statuses = Object.keys(MESSAGES).filter((k) => k.startsWith('kit.orders.status.'));
    expect(statuses.sort()).toEqual([
      'kit.orders.status.delivered',
      'kit.orders.status.received',
    ]);
    for (const invented of ['Shipped', 'Preparing', 'Out for delivery', 'Dispatched']) {
      expect(ORDERS_PAGE).not.toContain(invented);
    }
  });

  it('is hopeful when there is nothing to show, never "No data"', () => {
    expect(says('kit.orders.empty')).toBe('You have not ordered a kit yet.');
    expect(says('kit.orders.empty').toLowerCase()).not.toContain('no data');
    expect(ORDERS_PAGE).toContain("t('kit.orders.emptyCta')");
  });

  it('is behind the same lock as every other workspace page', () => {
    expect(ORDERS_PAGE).toContain('await requireOpenWorkspace(clientId)');
  });
});

// ---------------------------------------------------------------------------
// REGRESSION — 17 to 20
// ---------------------------------------------------------------------------

describe('17. the feedback gateway is untouched', () => {
  it('has no order code anywhere near it', () => {
    const gateway = read('src', 'lib', 'gateway', 'service.ts');
    expect(gateway).not.toContain('kitOrder');
    expect(gateway).not.toContain('KIT_PRODUCTS');
    expect(gateway).not.toContain('priceOrder');
  });

  it('leaves the public boundary exactly as it was', () => {
    const publicGateway = read('prisma', 'm20', 'public-gateway.sql');
    expect(publicGateway).not.toContain('KitOrder');
    // And the new table is explicitly kept away from the anonymous role.
    expect(read('prisma', 'm33', 'migration.sql')).toContain(
      'REVOKE ALL ON public."KitOrder" FROM repos_public',
    );
  });
});

describe('18. the QR is the same QR', () => {
  it('creates no second QR system', () => {
    // 'qr' is in a product key — the stand holds the card the QR is printed
    // on. What none of this may do is DRAW one.
    for (const source of [CATALOGUE, ORDERS_SERVICE, FORM, ORDERS_PAGE]) {
      for (const drawing of ['qrcode', 'toDataURL', 'gatewayToken', '@/lib/gateway/token']) {
        expect(source.toLowerCase()).not.toContain(drawing.toLowerCase());
      }
    }
  });

  it('leaves the token and the address the card opens alone', () => {
    const origin = code(read('src', 'lib', 'gateway', 'origin.ts'));
    expect(origin).not.toContain('kit/orders');
    // The Kit page still shows the one canonical address, unchanged.
    expect(KIT_PAGE).toContain('view.content.feedbackUrl');
  });
});

describe('19. the personalised print routes are the operator’s alone (M37)', () => {
  it('keeps both approved masters and the route that serves them', () => {
    // The masters and the route are untouched. What changed is who may reach
    // them: printing is Headway's job, and this page is a business's.
    expect(PRINT_SHEETS).toHaveLength(2);
    const route = read(
      'src', 'app', '(print)', 'print', 'sheet', '[clientId]', '[sheet]', 'route.ts',
    );
    expect(route).toContain('PRINT_SHEETS.find((s) => s.key === key)');
    expect(route).toContain('personaliseSheet');
  });

  it('offers a business no way to print, download or open its own card', () => {
    expect(KIT_PAGE).not.toContain('PRINT_SHEETS');
    expect(KIT_PAGE).not.toContain('/print/');
    expect(KIT_PAGE).not.toContain("t('kit.sheets.download')");
    expect(KIT_PAGE).not.toContain("t('kit.sheets.open')");
    expect(KIT_PAGE).not.toContain('sheet.preview');
  });

  it('leads with the order, which is the whole of the page now', () => {
    const order = KIT_PAGE.indexOf('<KitOrderForm');
    expect(order).toBeGreaterThan(0);
    // The strip of figures still sits under it, where it was.
    expect(KIT_PAGE.indexOf('<StatusStrip')).toBeGreaterThan(order);
  });
});

describe('20. the rest of the portal is where it was', () => {
  it('adds one door and one route, and renames one label', () => {
    const block = NAV.slice(NAV.indexOf('const SECTIONS'), NAV.indexOf('] as const satisfies'));
    const slugs = [...block.matchAll(/slug: '([^']*)'/g)].map((m) => m[1]);
    expect(slugs).toEqual([
      '',
      'analysis',
      'reviews',
      'improvements',
      'checkin',
      'team',
      'kit',
      'orders',
      'account',
    ]);
  });

  it('leaves the counted figures on the Kit page alone', () => {
    expect(KIT_PAGE).toContain("source: 'REP_OS_QR'");
    expect(KIT_PAGE).toContain("t.plural('kit.status.through', through)");
  });

  it('keeps the placement guidance an owner reads first', () => {
    expect(says('kit.placement.seen')).toContain('Put the card where customers can see it.');
    expect(KIT_PAGE).toContain("t('kit.placement.seen')");
    expect(KIT_PAGE).toContain('view.content.placement');
  });

  it('touches no AI, no lifecycle and no intelligence', () => {
    for (const source of [CATALOGUE, ORDERS_SERVICE, FORM, ORDERS_PAGE]) {
      expect(source).not.toContain('@/lib/ai');
      expect(source).not.toContain('@/lib/portal/engine');
      expect(source).not.toContain('groq');
    }
  });
});

// ---------------------------------------------------------------------------
// MOBILE — 21 to 24
// ---------------------------------------------------------------------------

describe('21. nothing scrolls sideways at 375px', () => {
  it('never puts the page in a horizontal scroller', () => {
    for (const source of [FORM, ORDERS_PAGE, KIT_PAGE]) {
      expect(source).not.toContain('overflow-x-auto');
      expect(source).not.toContain('whitespace-nowrap');
      for (const [, prefix, width] of source.matchAll(/(\w+:)?(?:min-)?w-\[(\d+)px\]/g)) {
        // A fixed width only strands a phone if it applies to one: anything
        // behind a breakpoint starts at 640px or above.
        if (prefix) continue;
        expect(Number(width), `${width}px is wider than a phone`).toBeLessThan(375);
      }
    }
  });

  it('stacks the two products on a phone and pairs them from tablet up', () => {
    expect(FORM).toContain('grid-cols-1 gap-5 sm:grid-cols-2');
  });

  it('lets a long line wrap instead of pushing the row wider', () => {
    expect(FORM).toContain('flex flex-wrap items-baseline justify-between');
    expect(ORDERS_PAGE).toContain('flex flex-wrap items-baseline justify-between');
  });
});

describe('22. nothing is clipped', () => {
  it('scales the photograph to the card rather than cropping it out of view', () => {
    expect(FORM).toContain('aspect-[4/3] w-full bg-ink-50 object-cover');
    expect(FORM).toContain('sizes="(min-width: 640px) 50vw, 100vw"');
  });

  it('lets the card grow with its text', () => {
    expect(FORM).toContain('flex flex-1 flex-col p-5');
    expect(FORM).toContain('mt-auto pt-5');
    // No fixed heights anywhere: a longer name in Hindi still fits.
    expect(FORM).not.toMatch(/\bh-\[\d+px\]/);
    expect(ORDERS_PAGE).not.toMatch(/\bh-\[\d+px\]/);
  });
});

describe('23. the quantity controls work with a thumb', () => {
  it('gives every stepper button a 48px target', () => {
    expect(FORM).toContain('h-12 w-12');
    expect(FORM).toContain('min-h-12');
  });

  it('says what each button does, for a screen reader', () => {
    expect(FORM).toContain("t('kit.quantity.less'");
    expect(FORM).toContain("t('kit.quantity.more'");
    expect(FORM).toContain("t('kit.quantity.remove'");
    expect(FORM).toContain("aria-label={`${t('kit.quantity.label')}: ${quantity}`}");
    expect(says('kit.quantity.less')).toContain('{product}');
    expect(says('kit.quantity.more')).toContain('{product}');
  });

  it('reads the changing number out rather than leaving it silent', () => {
    expect(FORM).toContain('role="status"');
  });

  it('shows focus, so a keyboard can find the buttons', () => {
    expect(FORM).toContain('focus-visible:ring-2');
  });
});

describe('24. the button that places the order works with a thumb', () => {
  it('is full width on a phone and 48px tall everywhere', () => {
    expect(FORM).toContain('min-h-12 w-full items-center justify-center');
    expect(FORM).toContain('sm:w-auto');
  });

  it('says it is working, so nobody taps twice', () => {
    expect(FORM).toContain("{pending ? t('kit.order.placing') : t('kit.order.cta')}");
    expect(says('kit.order.placing')).toBe('Placing your order…');
  });

  it('shows a refusal where the reader is looking, and announces it', () => {
    expect(FORM).toContain('role="alert"');
    expect(FORM).toContain('{state.message}');
  });

  it('offers the way on once the order is in', () => {
    expect(FORM).toContain('href={ordersHref}');
    expect(says('kit.order.seeOrders')).toBe('See your orders');
  });
});

// ---------------------------------------------------------------------------
// The rule underneath all of it
// ---------------------------------------------------------------------------

describe('no price, no total and no client id is ever read from the browser', () => {
  it('reads only quantities off the form', () => {
    expect(ACTION).toContain('quantities[product.key] = str(form, `qty:${product.key}`)');
    const body = ACTION.slice(ACTION.indexOf('export async function placeKitOrderAction'));
    for (const field of ['price', 'unitPrice', 'total', 'totalInr', 'amount']) {
      expect(body, `the action reads ${field} from the form`).not.toContain(`str(form, '${field}'`);
    }
  });

  it('takes the client from the gate, never from the posted id', () => {
    const body = ACTION.slice(ACTION.indexOf('export async function placeKitOrderAction'));
    expect(body).toContain("const gate = await tenantGate(form, 'OWNER')");
    expect(body).toContain('const { clientId } = gate;');
    expect(body).not.toContain("str(form, 'clientId')");
  });

  it('is an OWNER action, because it commits the business to a cost', () => {
    expect(read('tests', 'compliance.test.ts')).toContain("placeKitOrderAction: 'OWNER'");
  });

  it('prices the order from the catalogue, inside the service', () => {
    expect(ORDERS_SERVICE).toContain('const priced = priceOrder(input.quantities)');
    expect(ORDERS_SERVICE).toContain('totalInr: priced.totalInr');
    expect(ORDERS_SERVICE).toContain('itemsJson: JSON.stringify(priced.lines)');
  });

  it('builds nothing this product does not have behind it', () => {
    for (const source of [CATALOGUE, ORDERS_SERVICE, FORM, ORDERS_PAGE, ACTION]) {
      for (const overbuild of ['razorpay', 'stripe', 'coupon', 'invoice', 'refund', 'gst', 'courier']) {
        expect(source.toLowerCase(), `${overbuild} has no business here`).not.toContain(overbuild);
      }
    }
  });
});
