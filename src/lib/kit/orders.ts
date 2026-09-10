import type { PrismaClient } from '@prisma/client';
import { KIT_PRODUCTS, kitProduct, priceOrder, type KitOrderLine } from './catalogue';
import type { ServiceResult } from './service';
import { EN, type PortalTranslator } from '@/lib/i18n/translator';

/**
 * ORDERING THE PRINTED KIT (M33).
 *
 * A business asks for so many of each card; Headway records what that costs and
 * gets in touch. There is no payment here, no courier, no stock and no delivery
 * date — none of those exist, and a screen that implied they did would be
 * making a promise nobody can keep.
 *
 * THE BROWSER SENDS QUANTITIES. NOTHING ELSE.
 *
 * Not a price, not a line total, not a grand total, not a client id it chose
 * for itself. Those either come from `catalogue.ts` or from the gate that
 * already established who is asking. A form is a request, never a fact — the
 * same rule the tenant gates are built on.
 */

/** The only status the system can honestly claim about an order today. */
export const ORDER_STATUS_RECEIVED = 'RECEIVED';

export type KitOrder = {
  id: string;
  clientId: string;
  /** 1, 2, 3 … per business. What "Order #003" means. */
  number: number;
  status: string;
  lines: KitOrderLine[];
  totalInr: number;
  placedAt: Date;
};

/** Parses the stored lines back, defensively: a bad row is an empty order. */
function linesFrom(json: string): KitOrderLine[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const line = raw as Record<string, unknown>;
      const product = kitProduct(String(line.productKey ?? ''));
      const quantity = Number(line.quantity);
      const unitPriceInr = Number(line.unitPriceInr);
      const lineTotalInr = Number(line.lineTotalInr);
      if (!product || !Number.isInteger(quantity) || quantity <= 0) return [];
      if (!Number.isFinite(unitPriceInr) || !Number.isFinite(lineTotalInr)) return [];
      return [{ productKey: product.key, quantity, unitPriceInr, lineTotalInr }];
    });
  } catch {
    return [];
  }
}

type Row = {
  id: string;
  clientId: string;
  number: number;
  status: string;
  itemsJson: string;
  totalInr: number;
  createdAt: Date;
};

function toOrder(row: Row): KitOrder {
  return {
    id: row.id,
    clientId: row.clientId,
    number: row.number,
    status: row.status,
    lines: linesFrom(row.itemsJson),
    totalInr: row.totalInr,
    placedAt: row.createdAt,
  };
}

/**
 * One business's orders, newest first.
 *
 * Scoped by `clientId` in the query AND by row-level security underneath it:
 * the runtime connects as `repos_app`, which cannot bypass RLS, and the
 * `tenant_isolation` policy on this table restricts every row to
 * `app.accessible_client_ids()`. Asking for somebody else's id returns nothing
 * rather than their orders.
 */
export async function listKitOrders(db: PrismaClient, clientId: string): Promise<KitOrder[]> {
  const rows = await db.kitOrder.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      clientId: true,
      number: true,
      status: true,
      itemsJson: true,
      totalInr: true,
      createdAt: true,
    },
  });
  return rows.map(toOrder);
}

/**
 * An order as the OPERATOR reads it: with the business's name on it (M35).
 *
 * A business already knows whose order it is looking at. An operator is looking
 * at everybody's, so the name is the first thing they need.
 */
export type KitOrderForOperator = KitOrder & { businessName: string };

/** How many of one product an order was for. Zero if it was not on the order. */
export function orderedQuantity(order: KitOrder, productKey: string): number {
  return order.lines.find((line) => line.productKey === productKey)?.quantity ?? 0;
}

const WITH_BUSINESS = {
  id: true,
  clientId: true,
  number: true,
  status: true,
  itemsJson: true,
  totalInr: true,
  createdAt: true,
  client: { select: { businessName: true } },
} as const;

/**
 * Every order the caller is allowed to see, newest first (M35).
 *
 * THERE IS NO `clientId` FILTER HERE, AND THAT IS THE POINT. The scope is the
 * `tenant_isolation` policy on `KitOrder`, which restricts every row to
 * `app.accessible_client_ids()`. For platform staff that is every business, so
 * the operator's page lists everything; for anybody else it is their own
 * businesses and nothing more. The same query, asked by two people, answers
 * differently — which is the only way this can be right, because a filter in
 * TypeScript would be one somebody could later forget.
 *
 * Archived businesses are INCLUDED. An order is a thing somebody still has to
 * print and send; archiving the business afterwards does not undo it, and a
 * list that quietly dropped it would be hiding work rather than finishing it.
 */
export async function listAllKitOrders(
  db: PrismaClient,
  options: { limit?: number } = {},
): Promise<KitOrderForOperator[]> {
  const rows = await db.kitOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: options.limit ?? 200,
    select: WITH_BUSINESS,
  });
  return rows.map((row) => ({ ...toOrder(row), businessName: row.client.businessName }));
}

/**
 * One order, by its id, for the operator's detail page (M35).
 *
 * Again no `clientId` in the query: an order the caller may not see is not
 * found rather than forbidden, because the policy removes the row before this
 * code ever sees it. So an operator guessing at ids learns nothing, and neither
 * does anybody else.
 */
export async function getKitOrder(
  db: PrismaClient,
  id: string,
): Promise<KitOrderForOperator | null> {
  const row = await db.kitOrder.findUnique({ where: { id }, select: WITH_BUSINESS });
  if (!row) return null;
  return { ...toOrder(row), businessName: row.client.businessName };
}

export type PlaceOrderInput = {
  /** Product key -> quantity, exactly as the form sent it. Assumed hostile. */
  quantities: Record<string, unknown>;
};

/**
 * Records an order for one business.
 *
 * `clientId` is the one the caller's tenant gate already approved. It is never
 * read from the form: an action that trusted a posted id would be letting the
 * browser choose whose order this is.
 */
export async function placeKitOrder(
  db: PrismaClient,
  clientId: string,
  input: PlaceOrderInput,
  options: { now?: Date; t?: PortalTranslator } = {},
): Promise<ServiceResult<KitOrder>> {
  const t = options.t ?? EN;

  const priced = priceOrder(input.quantities);
  if (!priced.ok) {
    return {
      ok: false,
      message:
        priced.problem === 'EMPTY' ? t('kit.order.error.empty') : t('kit.order.error.quantity'),
      errors: {},
    };
  }

  // The next number for THIS business. Scoped like everything else, so two
  // businesses both have an Order #1 and neither can see the other's.
  const latest = await db.kitOrder.findFirst({
    where: { clientId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const number = (latest?.number ?? 0) + 1;

  const row = await db.kitOrder.create({
    data: {
      clientId,
      number,
      status: ORDER_STATUS_RECEIVED,
      itemsJson: JSON.stringify(priced.lines),
      // The server's arithmetic, over the server's prices.
      totalInr: priced.totalInr,
      ...(options.now ? { createdAt: options.now, updatedAt: options.now } : {}),
    },
    select: {
      id: true,
      clientId: true,
      number: true,
      status: true,
      itemsJson: true,
      totalInr: true,
      createdAt: true,
    },
  });

  return { ok: true, data: toOrder(row) };
}

/** The catalogue as the page needs it. Exported so one list feeds both. */
export function kitCatalogue() {
  return KIT_PRODUCTS;
}
