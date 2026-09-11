import { Link } from '@/components/portal/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { formatDate } from '@/lib/format';
import { kitProduct } from '@/lib/kit/catalogue';
import {
  listKitOrders,
  ORDER_STATUS_COMPLETED,
  ORDER_STATUS_RECEIVED,
} from '@/lib/kit/orders';
import { KitOrderReceiptForm } from '@/components/forms/kit-receipt-form';
import { PageIntro, Quiet, Section } from '@/components/portal/portal-ui';
import { getTranslator } from '@/lib/i18n/request';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('kit.orders.meta.title') };
}

/**
 * WHAT THIS BUSINESS HAS ASKED FOR (M33).
 *
 * A list, newest first: when, what, how many, what it came to, and where it has
 * got to. Nothing here is editable — an order is a record of a request, and a
 * page that let an owner change one after the fact would be describing a system
 * that does not exist.
 *
 * ONE STATUS. "Received" is the only thing Headway can honestly say today:
 * there is no printer queue to read, no courier to ask and no delivery date to
 * promise. A tracking bar with four empty steps would be a story.
 *
 * EVERY FIGURE ON THIS PAGE WAS COMPUTED ON THE SERVER when the order was
 * placed, and is read back from the row. Nothing is recalculated from a price
 * list that may since have moved, so an order from March still reads as what it
 * actually cost in March.
 *
 * THE ORDERS ARE THIS BUSINESS'S OWN. `listKitOrders` scopes by client id, and
 * underneath it the runtime connects as `repos_app`, which cannot bypass
 * row-level security: the `tenant_isolation` policy on `KitOrder` restricts
 * every row to the businesses this session actually belongs to. Asking for
 * another business's id returns nothing rather than their orders.
 */
export default async function WorkspaceOrdersPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId);

  const t = await getTranslator();
  const orders = await listKitOrders(prisma, clientId);

  const money = (amount: number) => t('kit.amount', { amount });

  return (
    <div className="max-w-3xl">
      <PageIntro
        eyebrow={t('kit.orders.eyebrow')}
        title={t('kit.orders.heading')}
        description={t('kit.orders.intro')}
      />

      {orders.length === 0 ? (
        <Section eyebrow={t('kit.orders.eyebrow')}>
          <Quiet>{t('kit.orders.empty')}</Quiet>
          <Link
            href={`/workspace/${clientId}/kit`}
            className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-ink-300 bg-white px-5 text-[15px] font-medium text-ink-900 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
          >
            {t('kit.orders.emptyCta')}
          </Link>
        </Section>
      ) : (
        <ul className="space-y-5">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-ink-200 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[16px] leading-snug font-semibold tracking-tight text-ink-900">
                  {/* "Order #003", not "Order #3" and never a cuid. The padding
                      is presentation; the stored number is the integer. */}
                  {t('kit.orders.number', { number: String(order.number).padStart(3, '0') })}
                </p>
                {/* The stored status, read as a word. Anything other than the
                    one status this system writes prints as itself rather than
                    as a blank — a row nobody expected is still a row. */}
                <span className="rounded-full bg-good-50 px-3 py-1 text-[12px] font-semibold text-good-700">
                  {order.status === ORDER_STATUS_COMPLETED
                    ? t('kit.orders.status.delivered')
                    : order.status === ORDER_STATUS_RECEIVED
                      ? t('kit.orders.status.received')
                      : order.status}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-ink-500">{formatDate(order.placedAt)}</p>

              <ul className="mt-4 divide-y divide-ink-200 border-y border-ink-200">
                {order.lines.map((line) => {
                  const product = kitProduct(line.productKey);
                  return (
                    <li
                      key={line.productKey}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3"
                    >
                      <span className="text-[15px] font-medium text-ink-900">
                        {product ? t(product.nameKey) : line.productKey}
                      </span>
                      <span className="text-[13px] text-ink-500 tabular-nums">
                        {t.plural('kit.orders.pieces', line.quantity)}
                      </span>
                      <span className="w-full text-right text-[15px] font-semibold text-ink-900 tabular-nums sm:w-auto">
                        {money(line.lineTotalInr)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-baseline justify-between pt-3">
                <span className="text-[15px] font-semibold text-ink-900">
                  {t('kit.summary.total')}
                </span>
                <span className="text-[17px] font-semibold text-ink-900 tabular-nums">
                  {money(order.totalInr)}
                </span>
              </div>

              {/*
                SAYING IT ARRIVED (M36).

                Only once Headway has said it sent the thing — a shop cannot
                confirm the arrival of something nobody claims to have posted,
                so before that there is nothing here to tick. The control says
                one fact and carries no price, no total and no status.
              */}
              {order.completedAt ? (
                <div className="mt-4 border-t border-ink-200 pt-4">
                  <p className="text-[13px] leading-relaxed text-ink-500">
                    {t('kit.orders.sentOn', { date: formatDate(order.completedAt) })}
                  </p>
                  <KitOrderReceiptForm
                    clientId={clientId}
                    orderId={order.id}
                    receivedOn={order.receivedAt ? formatDate(order.receivedAt) : null}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
