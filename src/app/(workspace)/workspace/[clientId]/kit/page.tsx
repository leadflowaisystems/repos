import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { requestOrigin } from '@/lib/gateway/origin';
import { getKitView } from '@/lib/kit/service';
import { CopyButton } from '@/components/copy-button';
import { PageIntro, Quiet, Section, StatusStrip } from '@/components/portal/portal-ui';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { KitOrderForm, type KitProductView } from '@/components/forms/kit-order-form';
import { getTranslator } from '@/lib/i18n/request';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('kit.meta.title') };
}

/**
 * THE KIT, IN THE OWNER'S OWN WORKSPACE (M21, trimmed in M23, put onto the
 * approved print masters in M29, translated in M31, made an ordering page in
 * M33, and closed to printing in M37).
 *
 * A BUSINESS ORDERS ITS KIT. IT DOES NOT PRINT IT.
 *
 * Until M37 this page also offered the personalised PDF — a preview, a
 * Download and an Open to print — so an owner could take the artwork and get
 * it printed themselves. That is not what this product sells. Headway prints
 * the cards and sends them; the owner chooses a format, a quantity and a
 * price, and that is the whole of their side.
 *
 * So the sheets, the previews and both links are gone from here, and the
 * routes behind them are operator-only (see `printGate` in
 * src/lib/auth/guard.ts). The masters, the personalisation and the operator's
 * own print page are untouched — this page simply no longer reaches them.
 */

export default async function WorkspaceKitPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireOpenWorkspace(clientId);

  const t = await getTranslator();

  const [view, through] = await Promise.all([
    getKitView(prisma, clientId, { requestOrigin: await requestOrigin() }),
    // How much has actually come through the card: the one figure that says
    // whether the system is working, and the reason to order more.
    prisma.reviewItem.count({ where: { clientId, source: 'REP_OS_QR' } }),
  ]);
  if (!view) notFound();

  const ready = Boolean(view.content.feedbackUrl);
  const script = view.content.staffScript;
  const basePath = `/workspace/${clientId}`;

  // The catalogue, named in the owner's language. The PRICE is here to be READ
  // and is never sent back: the server prices the order again from its own
  // list when it arrives, so nothing on this page can decide what anything
  // costs.
  const products: KitProductView[] = KIT_PRODUCTS.map((product) => ({
    key: product.key,
    name: t(product.nameKey),
    description: t(product.descriptionKey),
    alt: t(product.altKey),
    photo: product.photo,
    photoSrcSet: product.photoSrcSet,
    photoWidth: product.photoWidth,
    photoHeight: product.photoHeight,
    priceInr: product.priceInr,
  }));

  return (
    <div className="max-w-3xl">
      <PageIntro
        eyebrow={t('kit.order.eyebrow')}
        title={t('kit.order.heading')}
        description={t('kit.order.intro')}
      />

      {ready ? (
        <>
          {/*
            THE TWO THINGS A BUSINESS CAN ORDER, and the point of the page.
            The photographs are of the real printed cards on a real counter.
          */}
          <div className="mb-10">
            <KitOrderForm
              clientId={clientId}
              products={products}
              ordersHref={`${basePath}/orders`}
            />
          </div>

          {/*
            THE STRIP PRINTS THE VALUE FIRST AND THE LABEL AFTER IT, and no
            language can reorder those two. So each half stands on its own —
            "Live" beside "feedback page" — rather than the label finishing a
            phrase the value started. The old labels completed an English
            sentence ("Ready" + "to print"), which is a shape only English
            has: in Hindi and Marathi the same two halves land in the wrong
            order and stop being a sentence at all.
          */}
          <StatusStrip
            items={[
              {
                label: t('kit.status.page.label'),
                value: view.gatewayPaused
                  ? t('kit.status.page.paused')
                  : t('kit.status.page.live'),
                tone: view.gatewayPaused ? 'warn' : 'good',
              },
              { label: t('kit.status.print.label'), value: t('kit.status.print.value') },
              {
                label: t.plural('kit.status.through', through),
                value: through,
                tone: through > 0 ? 'good' : 'neutral',
              },
            ]}
          />

          {/*
            WHERE THE CARD'S QR POINTS (M37). The sentence above this used to
            explain the preview pictures and the file an owner downloaded.
            Neither exists on this page any more — printing is Headway's job,
            not the owner's — so what is left is the one thing they still need:
            the address their code opens, and a way to copy it.
          */}
          <Section eyebrow={t('kit.file.eyebrow')}>
            <p className="text-[15px] leading-relaxed text-ink-900">{t('kit.file.body')}</p>
            <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-4">
              <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">
                {t('kit.file.qrTarget')}
              </p>
              <p className="mt-1.5 font-mono text-[13px] break-all text-ink-900">
                {view.content.feedbackUrl}
              </p>
              <div className="mt-3">
                <CopyButton
                  value={view.content.feedbackUrl ?? ''}
                  label={t('kit.file.copyLink')}
                  copiedLabel={t('kit.file.copied')}
                />
              </div>
            </div>
          </Section>

          <Section eyebrow={t('kit.placement.eyebrow')}>
            {/* The sentence that used to open the page. The top of the page
                is the order now, but where to stand the card is still the
                first thing an owner wants told, and this is the section they
                look in for it. */}
            <p className="text-[15px] leading-relaxed text-ink-900">{t('kit.placement.seen')}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-900">{view.content.placement}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
              {t('kit.placement.everyone')}
            </p>

            <details className="group mt-5 rounded-xl border border-ink-200 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[14px] font-medium text-ink-900 hover:text-ink-700">
                {t('kit.staff.summary')}
                <span aria-hidden className="text-ink-400 transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="space-y-4 border-t border-ink-200 px-4 py-4 text-[14px] leading-relaxed text-ink-800">
                {view.content.moment ? (
                  <div>
                    <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">{t('kit.staff.when')}</p>
                    <p className="mt-1">{view.content.moment}</p>
                  </div>
                ) : null}
                {/*
                  THE SCRIPT IS NOT TRANSLATED HERE, and must not be. These
                  three lines are what a person says out loud at the counter,
                  written for them in the pack in English, Hinglish and
                  Marathi. Which line a waiter reads is decided by the waiter
                  and the customer in front of them — not by the language the
                  owner happens to read the portal in.
                */}
                <div>
                  <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">{t('kit.staff.say')}</p>
                  <p className="mt-1">&ldquo;{script.english}&rdquo;</p>
                  {script.hinglish ? <p className="mt-1 text-ink-700">&ldquo;{script.hinglish}&rdquo;</p> : null}
                  {script.marathi ? <p className="mt-1 text-ink-700">&ldquo;{script.marathi}&rdquo;</p> : null}
                </div>
                {view.content.rules.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold tracking-widest text-ink-500 uppercase">{t('kit.staff.never')}</p>
                    <ul className="mt-1 space-y-1">
                      {view.content.rules.map((rule) => (
                        <li key={rule} className="flex gap-2">
                          <span aria-hidden className="text-ink-400">
                            ·
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          </Section>
        </>
      ) : (
        <Section eyebrow={t('kit.sheets.eyebrow')}>
          <Quiet>{view.addressError ?? t('kit.empty.noAddress')}</Quiet>
        </Section>
      )}
    </div>
  );
}
