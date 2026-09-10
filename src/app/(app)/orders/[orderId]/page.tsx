import { notFound } from 'next/navigation';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  DataRow,
  LinkButton,
  PageHeader,
} from '@/components/ui';
import {
  DeleteOrderControl,
  OrderCompletedControl,
} from '@/components/forms/kit-order-controls';
import { prisma } from '@/lib/db';
import { formatDate, formatDateTime, formatNumber, formatRupees } from '@/lib/format';
import { kitProduct } from '@/lib/kit/catalogue';
import { getKitOrder, ORDER_STATUS_COMPLETED, ORDER_STATUS_RECEIVED } from '@/lib/kit/orders';

/** The two statuses, as an operator reads them. Nothing between them exists. */
function statusLabel(status: string): string {
  if (status === ORDER_STATUS_COMPLETED) return 'Completed';
  if (status === ORDER_STATUS_RECEIVED) return 'Received';
  return status;
}

export const dynamic = 'force-dynamic';

/**
 * ONE ORDER, IN FULL (M35).
 *
 * What the business asked for, what each piece cost at the time, and what that
 * came to. This is the page somebody works from when they print and pack.
 *
 * A MISSING ORDER AND SOMEBODY ELSE'S ORDER LOOK IDENTICAL. `getKitOrder` asks
 * by id with no client filter, and the `tenant_isolation` policy removes rows
 * the caller may not see before this code runs — so both cases arrive here as
 * `null` and both become `notFound()`. Somebody trying ids learns nothing about
 * which of them exist.
 *
 * EVERY NUMBER IS READ, NOT RECOMPUTED. The unit prices and the line totals are
 * the ones stored on the order, not the ones in today's catalogue, so an order
 * placed at ₹100 a piece still says ₹100 a piece. The catalogue is consulted
 * only for the product's name.
 */
export default async function OperatorOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getKitOrder(prisma, orderId);
  if (!order) notFound();

  const number = `#${String(order.number).padStart(3, '0')}`;

  return (
    <>
      <PageHeader
        eyebrow="Kit order"
        title={`${order.businessName} — Order ${number}`}
        description={`Placed ${formatDate(order.placedAt)}.`}
        actions={
          <>
            <Badge tone={order.status === ORDER_STATUS_COMPLETED ? 'good' : 'brand'}>
              {statusLabel(order.status)}
            </Badge>
            <LinkButton href={`/clients/${order.clientId}`}>Open client</LinkButton>
            <LinkButton href="/orders">All orders</LinkButton>
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="What was ordered" description="Priced as it was on the day." />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="border-b border-ink-200 text-[12px] text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Product</th>
                    <th className="px-5 py-3 text-right font-medium">Quantity</th>
                    <th className="px-5 py-3 text-right font-medium">Unit price</th>
                    <th className="px-5 py-3 text-right font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const product = kitProduct(line.productKey);
                    return (
                      <tr key={line.productKey} className="border-b border-ink-100 last:border-0">
                        <td className="px-5 py-3 font-medium text-ink-900">
                          {/* The catalogue names the product. If a key ever
                              left the catalogue the key itself is printed,
                              rather than a blank row nobody can act on. */}
                          {product ? product.shortName : line.productKey}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                          {formatNumber(line.quantity)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                          {formatRupees(line.unitPriceInr)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-900">
                          {formatRupees(line.lineTotalInr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink-200">
                    <td className="px-5 py-3 font-semibold text-ink-900" colSpan={3}>
                      Total
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink-900">
                      {formatRupees(order.totalInr)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Order details" />
          <CardBody>
            <dl>
              <DataRow label="Business">{order.businessName}</DataRow>
              <DataRow label="Order number">{number}</DataRow>
              <DataRow label="Placed">{formatDateTime(order.placedAt)}</DataRow>
              <DataRow label="Total">{formatRupees(order.totalInr)}</DataRow>
              <DataRow label="Status">{statusLabel(order.status)}</DataRow>
              <DataRow label="Completed">
                {order.completedAt
                  ? `${formatDateTime(order.completedAt)}${order.completedByName ? ` by ${order.completedByName}` : ''}`
                  : 'Not yet'}
              </DataRow>
              {/* The client's own confirmation, which is a different fact from
                  delivery and is theirs to give. Shown here so an operator can
                  see whether it actually arrived, never set here. */}
              <DataRow label="Client confirmed receipt">
                {order.receivedAt
                  ? `${formatDateTime(order.receivedAt)}${order.receivedByName ? ` by ${order.receivedByName}` : ''}`
                  : 'Not yet'}
              </DataRow>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Completion"
            description="Mark this once you have finished this physical order and handed it over."
          />
          <CardBody>
            <OrderCompletedControl
              orderId={order.id}
              completedOn={order.completedAt ? formatDate(order.completedAt) : null}
              completedByName={order.completedByName}
            />
            <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
              {order.receivedAt
                ? `The client confirmed it arrived on ${formatDate(order.receivedAt)}.`
                : order.completedAt
                  ? 'The client has not confirmed it arrived yet. Only they can do that.'
                  : 'The client cannot confirm receipt until this is marked completed.'}
            </p>
          </CardBody>
        </Card>

        {/*
          Destructive, and deliberately last and quiet. Two taps, with Cancel
          first, and the permission re-checked on the server whatever the
          browser claims happened here.
        */}
        <Card>
          <CardHeader
            title="Delete order"
            description="Removes this order entirely. Nothing else about the client is touched."
          />
          <CardBody>
            <DeleteOrderControl orderId={order.id} orderNumber={number} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
