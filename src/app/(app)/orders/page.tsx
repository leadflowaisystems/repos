import Link from 'next/link';
import { Badge, Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { formatDate, formatNumber, formatRupees } from '@/lib/format';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { listAllKitOrders, orderedQuantity, ORDER_STATUS_RECEIVED } from '@/lib/kit/orders';

export const dynamic = 'force-dynamic';

/**
 * EVERY PRINTED KIT SOMEBODY HAS ASKED FOR (M35).
 *
 * The operator side of the Kit ordering the businesses do for themselves. One
 * table, newest first, so the answer to "what do I have to print this week" is
 * the top of a page rather than a query somebody has to remember to run.
 *
 * WHOSE ORDERS THESE ARE IS NOT DECIDED HERE. `listAllKitOrders` asks for all
 * of them and the `tenant_isolation` policy on `KitOrder` decides which rows
 * come back — every business for platform staff, and only their own for anyone
 * else. This page adds no filter of its own, because a filter here would be one
 * that could be forgotten; and it needs no guard of its own either, because the
 * `(app)` layout has already run `requireOperator()`.
 *
 * EVERY FIGURE IS THE ONE THAT WAS STORED. The quantities, the prices and the
 * total were computed on the server when the order was placed and are read back
 * off the row. Nothing here recalculates anything from today's price list, so an
 * order placed at ₹100 still totals what it totalled.
 */
export default async function OperatorOrdersPage() {
  const orders = await listAllKitOrders(prisma);

  const received = orders.filter((order) => order.status === ORDER_STATUS_RECEIVED).length;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Printed kits businesses have asked for, newest first. Every figure is the one recorded when the order was placed."
      />

      <Card>
        {orders.length === 0 ? (
          <EmptyState
            title="No kit orders yet"
            description="When a business orders cards from its Kit page, the order appears here with what it asked for and what it came to."
            action={<LinkButton href="/clients">Back to clients</LinkButton>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="border-b border-ink-200 text-[12px] text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Business</th>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  {/* One column per product, named the operator's way. Adding a
                      third product to the catalogue adds a third column. */}
                  {KIT_PRODUCTS.map((product) => (
                    <th key={product.key} className="px-5 py-3 text-right font-medium">
                      {product.shortName}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-ink-100 last:border-0 hover:bg-ink-50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        prefetch={false}
                        className="font-medium text-ink-900 underline-offset-2 hover:underline"
                      >
                        {order.businessName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink-600">
                      #{String(order.number).padStart(3, '0')}
                    </td>
                    <td className="px-5 py-3 text-ink-600">{formatDate(order.placedAt)}</td>
                    {KIT_PRODUCTS.map((product) => {
                      const quantity = orderedQuantity(order, product.key);
                      return (
                        <td
                          key={product.key}
                          className="px-5 py-3 text-right tabular-nums text-ink-600"
                        >
                          {/* A dash, not a nought: this product was not on the
                              order at all, which is a different thing from
                              somebody having asked for none of it. */}
                          {quantity > 0 ? formatNumber(quantity) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-ink-900">
                      {formatRupees(order.totalInr)}
                    </td>
                    <td className="px-5 py-3">
                      {/* Received is the only status the system can claim. A row
                          carrying anything else prints as itself rather than as
                          a blank. */}
                      <Badge tone={order.status === ORDER_STATUS_RECEIVED ? 'brand' : 'neutral'}>
                        {order.status === ORDER_STATUS_RECEIVED ? 'Received' : order.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {orders.length > 0 ? (
        <p className="mt-3 text-[12px] text-ink-500">
          {formatNumber(orders.length)} {orders.length === 1 ? 'order' : 'orders'}
          {received === orders.length ? ', all received' : `, ${formatNumber(received)} received`}.
        </p>
      ) : null}
    </>
  );
}
