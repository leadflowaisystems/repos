import type { MessageKey } from '@/lib/i18n/strings';

/**
 * WHAT A BUSINESS CAN ORDER, AND WHAT IT COSTS.
 *
 * The only place a price exists. Nothing on this list is ever read from a form,
 * a query string or a request body: the browser sends a product key and a
 * quantity, and the server looks the price up here. A page that posted its own
 * total would be posting a number it made up.
 *
 * TWO PRODUCTS, AND ONLY TWO. Both are the same approved Headway card — the
 * artwork nobody redraws — in the two forms a counter actually takes: dropped
 * into a clear stand, or folded so it stands by itself. Adding a third means
 * adding it here, with a photograph of the real thing.
 *
 * PRICES ARE WHOLE RUPEES. Every amount in this product is a whole rupee
 * (`avgCustomerValueInr` on a Client is the same), there is no tax line and no
 * discount, so an integer is the honest type. No floating point touches money.
 *
 * CHANGING A PRICE HERE CHANGES WHAT THE NEXT ORDER COSTS, AND NOTHING ELSE.
 * An order that has already been placed carries its own prices: `placeKitOrder`
 * copies the figures below onto the row at the moment of ordering, and every
 * read path takes them back off that row rather than looking them up again. So
 * an order placed at ₹100 still reads ₹100 on the Orders page after this list
 * says ₹99, which is the only honest thing for a record of what somebody
 * agreed to pay. There is no back-fill, and there must never be one.
 */

export type KitProductKey = 'card-qr-stand' | 'folded-tent';

export type KitProduct = {
  key: KitProductKey;
  /** Rupees, per piece. The server's number, never the browser's. */
  priceInr: number;
  /** The real product, photographed. Not a render of the PDF. */
  photo: string;
  /**
   * The photograph's own proportions, which `next/image` uses to hold the space
   * before the file arrives. The card crops to 4:3 on the page either way, so
   * these decide layout stability rather than what is shown.
   */
  photoWidth: number;
  photoHeight: number;
  nameKey: MessageKey;
  descriptionKey: MessageKey;
  /** Alt text, for somebody who cannot see the photograph. */
  altKey: MessageKey;
  /**
   * The operator's shorthand for this product (M35).
   *
   * The operator console is not translated and its orders table needs a column
   * heading, so the size prefix a business reads on the Kit page is dropped
   * here. Same product, working shorthand — never shown to a business, which is
   * why it is a plain string and not a dictionary key.
   */
  shortName: string;
};

export const KIT_PRODUCTS: readonly KitProduct[] = [
  {
    key: 'card-qr-stand',
    priceInr: 99,
    photo: '/kit/card-qr-stand.webp',
    photoWidth: 1312,
    photoHeight: 1199,
    nameKey: 'kit.product.stand.name',
    descriptionKey: 'kit.product.stand.description',
    altKey: 'kit.product.stand.alt',
    shortName: 'Card + QR Stand',
  },
  {
    key: 'folded-tent',
    priceInr: 49,
    photo: '/kit/folded-tent-card.webp',
    photoWidth: 1312,
    photoHeight: 1199,
    nameKey: 'kit.product.tent.name',
    descriptionKey: 'kit.product.tent.description',
    altKey: 'kit.product.tent.alt',
    shortName: 'Folded Tent Card',
  },
] as const;

/** The most of one thing a business can order at once. */
export const MAX_QUANTITY_PER_PRODUCT = 500;

export function kitProduct(key: string): KitProduct | null {
  return KIT_PRODUCTS.find((p) => p.key === key) ?? null;
}

/** One line of an order, priced by the server. */
export type KitOrderLine = {
  productKey: KitProductKey;
  quantity: number;
  /** Copied from the catalogue at the time of ordering, so an order can be
   *  re-read years later without the price having drifted under it. */
  unitPriceInr: number;
  lineTotalInr: number;
};

export type QuantityProblem =
  | 'NOT_A_NUMBER'
  | 'NOT_WHOLE'
  | 'NEGATIVE'
  | 'TOO_MANY'
  | 'UNKNOWN_PRODUCT';

export type PricedOrder =
  | { ok: true; lines: KitOrderLine[]; totalInr: number }
  | { ok: false; problem: QuantityProblem | 'EMPTY'; productKey?: string };

/**
 * Turns "what the browser asked for" into "what this actually costs".
 *
 * Quantities arrive from a form and are therefore assumed hostile: a string, a
 * fraction, a negative, a product that does not exist. Each of those is a
 * refusal rather than a clamp — silently rounding somebody's order to something
 * they did not ask for is worse than telling them.
 *
 * ONE IS THE SMALLEST QUANTITY OF ANY PRODUCT. Zero is not a quantity at all;
 * it means "not this one", which is how a business orders tents and no stands.
 * An order where EVERY line is zero is empty, and that is an error.
 */
export function priceOrder(requested: Record<string, unknown>): PricedOrder {
  const lines: KitOrderLine[] = [];

  for (const [key, raw] of Object.entries(requested)) {
    const product = kitProduct(key);
    if (!product) return { ok: false, problem: 'UNKNOWN_PRODUCT', productKey: key };

    // A form sends text, so text is read as text. `Number()` alone would be
    // too generous here: it reads '0x10' as 16 and '1e2' as 100, which means a
    // browser could order a number the owner never saw on the screen. Plain
    // digits, then, and an absent field means "not this one" rather than an
    // error — a card can be left out of an order.
    let quantity: number;
    if (typeof raw === 'number') {
      quantity = raw;
    } else {
      const text = String(raw ?? '').trim();
      if (text === '') quantity = 0;
      else if (!/^-?\d+$/.test(text)) {
        return { ok: false, problem: 'NOT_A_NUMBER', productKey: key };
      } else quantity = Number(text);
    }
    if (!Number.isFinite(quantity)) {
      return { ok: false, problem: 'NOT_A_NUMBER', productKey: key };
    }
    if (!Number.isInteger(quantity)) {
      return { ok: false, problem: 'NOT_WHOLE', productKey: key };
    }
    if (quantity < 0) return { ok: false, problem: 'NEGATIVE', productKey: key };
    if (quantity > MAX_QUANTITY_PER_PRODUCT) {
      return { ok: false, problem: 'TOO_MANY', productKey: key };
    }
    if (quantity === 0) continue;

    lines.push({
      productKey: product.key,
      quantity,
      unitPriceInr: product.priceInr,
      lineTotalInr: product.priceInr * quantity,
    });
  }

  if (lines.length === 0) return { ok: false, problem: 'EMPTY' };

  return {
    ok: true,
    lines,
    totalInr: lines.reduce((sum, line) => sum + line.lineTotalInr, 0),
  };
}
