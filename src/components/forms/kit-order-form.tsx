'use client';

import { Link } from '@/components/portal/link';
import { useActionState, useState } from 'react';
import { placeKitOrderAction } from '@/lib/actions/kit';
import { IDLE } from '@/lib/actions/shared';
import { MAX_QUANTITY_PER_PRODUCT } from '@/lib/kit/catalogue';
import { useT } from '@/components/portal/locale-provider';

/**
 * ORDERING THE PRINTED KIT (M33).
 *
 * Two products, a number against each, and one button. There is no basket, no
 * checkout, no payment step and no delivery estimate, because none of those
 * exist behind it — the order is recorded and somebody gets in touch.
 *
 * THE ARITHMETIC HERE IS FOR READING, NOT FOR CHARGING. The total updates as
 * the owner taps so they can see what they are asking for, but the number that
 * matters is worked out again on the server from its own price list. This
 * component posts quantities and nothing else: no price, no line total, no
 * grand total. There is deliberately no hidden field carrying money.
 *
 * ONE IS THE SMALLEST NUMBER OF ANYTHING. A product that is in the order is in
 * it at least once: the stepper never shows 0, never shows a fraction and
 * never shows a negative. Below one there is no such thing as a smaller order —
 * there is only not ordering that product, which is a different state and looks
 * like one: the card offers "Add to order" again and the summary stops listing
 * it. So a business can order tents alone, and every line that does exist has a
 * real quantity on it.
 *
 * The server does not take any of this on trust. It re-reads the quantities,
 * refuses a fraction, a negative or an unknown product outright, and refuses an
 * order that turns out to contain nothing at all.
 */

export type KitProductView = {
  key: string;
  name: string;
  description: string;
  alt: string;
  photo: string;
  /** The photograph at several widths; see `KitProduct.photoSrcSet`. */
  photoSrcSet: string;
  photoWidth: number;
  photoHeight: number;
  priceInr: number;
};

const STEP =
  'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-ink-300 bg-white text-[20px] leading-none font-medium text-ink-800 hover:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none disabled:opacity-40 disabled:hover:border-ink-300';

/**
 * − 1 + for one product, or the button that puts it back in the order.
 *
 * `−` at one is not disabled: it takes the product out of the order, which is
 * the thing an owner actually wants when it is one they do not need. What it
 * never does is show them a quantity of zero and let them order it.
 */
function Quantity({
  product,
  quantity,
  onChange,
}: {
  product: KitProductView;
  quantity: number;
  onChange: (next: number) => void;
}) {
  const t = useT();

  if (quantity < 1) {
    return (
      <div>
        <p className="text-[13px] text-ink-500">{t('kit.quantity.removed')}</p>
        <button
          type="button"
          onClick={() => onChange(1)}
          className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-ink-300 bg-white px-5 text-[15px] font-medium text-ink-900 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none sm:w-auto"
        >
          {t('kit.quantity.add')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        aria-label={
          quantity === 1
            ? t('kit.quantity.remove', { product: product.name })
            : t('kit.quantity.less', { product: product.name })
        }
        className={STEP}
      >
        −
      </button>
      <span
        role="status"
        aria-label={`${t('kit.quantity.label')}: ${quantity}`}
        className="min-w-10 text-center text-[18px] font-semibold text-ink-900 tabular-nums"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX_QUANTITY_PER_PRODUCT, quantity + 1))}
        disabled={quantity >= MAX_QUANTITY_PER_PRODUCT}
        aria-label={t('kit.quantity.more', { product: product.name })}
        className={STEP}
      >
        +
      </button>
    </div>
  );
}

export function KitOrderForm({
  clientId,
  products,
  ordersHref,
}: {
  clientId: string;
  products: KitProductView[];
  ordersHref: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(placeKitOrderAction, IDLE);

  // Both start at one, which is what the page shows before anybody touches it
  // and the smallest order anybody would place.
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((product) => [product.key, 1])),
  );

  const chosen = products
    .map((product) => ({ product, quantity: quantities[product.key] ?? 0 }))
    .filter((line) => line.quantity >= 1);
  const total = chosen.reduce((sum, line) => sum + line.quantity * line.product.priceInr, 0);
  const money = (amount: number) => t('kit.amount', { amount });

  // Once the order is in, the numbers are no longer the point. The confirmation
  // is, and it says only what Headway can actually promise.
  if (state.ok) {
    return (
      <div className="rounded-2xl border border-good-200 bg-good-50 p-6" role="status">
        <h2 className="text-[20px] leading-tight font-semibold text-good-700">
          {t('kit.order.placed.title')}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-800">{t('kit.order.placed.body')}</p>
        <Link
          href={ordersHref}
          className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
        >
          {t('kit.order.seeOrders')}
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="clientId" value={clientId} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {products.map((product) => {
          const quantity = quantities[product.key] ?? 0;
          return (
            <article
              key={product.key}
              className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white"
            >
              {/* The real printed card on a real counter, photographed. Not a
                  render of the PDF — that is what the reprint section below
                  still shows, and the difference is the point. */}
              {/* A plain <img>, on purpose. `next/image` runs unoptimized in
                  this app (see next.config.ts) and so sends one 1312 px file
                  with no `srcset`; this lets the browser pick the 720 or 960
                  px copy for the width it is actually drawing. Lazy, because
                  the cards sit below the intro on a phone. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.photo}
                srcSet={product.photoSrcSet}
                sizes="(min-width: 640px) 50vw, 100vw"
                alt={product.alt}
                width={product.photoWidth}
                height={product.photoHeight}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full bg-ink-50 object-cover"
              />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-[17px] leading-tight font-semibold text-ink-900">
                  {product.name}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
                  {product.description}
                </p>
                <p className="mt-3 text-[15px] font-semibold text-ink-900 tabular-nums">
                  {t('kit.price.perPiece', { price: product.priceInr })}
                </p>

                <div className="mt-auto pt-5">
                  <Quantity
                    product={product}
                    quantity={quantity}
                    onChange={(next) =>
                      setQuantities((current) => ({ ...current, [product.key]: next }))
                    }
                  />
                </div>
              </div>

              {/* Quantities are the only thing posted. No price travels with
                  them: the server has its own list. */}
              <input type="hidden" name={`qty:${product.key}`} value={quantity} />
            </article>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
          {t('kit.summary.title')}
        </h2>

        {chosen.length === 0 ? (
          <p className="mt-3 text-[14px] leading-relaxed text-ink-500">{t('kit.summary.empty')}</p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-ink-200 border-y border-ink-200">
              {chosen.map(({ product, quantity }) => (
                <li
                  key={product.key}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3"
                >
                  <span className="text-[15px] font-medium text-ink-900">{product.name}</span>
                  <span className="text-[13px] text-ink-500 tabular-nums">
                    {t('kit.line.quantityPrice', { quantity, price: product.priceInr })}
                  </span>
                  <span className="w-full text-right text-[15px] font-semibold text-ink-900 tabular-nums sm:w-auto">
                    {money(quantity * product.priceInr)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between pt-3">
              <span className="text-[15px] font-semibold text-ink-900">
                {t('kit.summary.total')}
              </span>
              <span className="text-[20px] font-semibold text-ink-900 tabular-nums">
                {money(total)}
              </span>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={pending || chosen.length === 0}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-700 px-6 text-[16px] font-semibold text-white hover:bg-brand-900 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none disabled:bg-ink-300 sm:w-auto"
        >
          {pending ? t('kit.order.placing') : t('kit.order.cta')}
        </button>

        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">{t('kit.summary.serverNote')}</p>

        {state.message && !state.ok ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-bad-200 bg-bad-50 px-4 py-3 text-[15px] leading-relaxed text-bad-700"
          >
            {state.message}
          </p>
        ) : null}
      </section>
    </form>
  );
}
