import Image from 'next/image';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { requestOrigin } from '@/lib/gateway/origin';
import { getKitView } from '@/lib/kit/service';
import { CopyButton } from '@/components/copy-button';
import { PageIntro, Quiet, Section, StatusStrip } from '@/components/portal/portal-ui';
import { PRINT_SHEETS } from '@/lib/kit/sheets';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { KitOrderForm, type KitProductView } from '@/components/forms/kit-order-form';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('kit.meta.title') };
}

/**
 * THE PRINT KIT, IN THE OWNER'S OWN WORKSPACE (M21, trimmed in M23, put onto
 * the approved print masters in M29, translated in M31).
 *
 * TWO SHEETS, AND ONLY TWO. Both are the signed-off Headway artwork:
 *
 *   1. 4 × 6 in insert card — A4, two cards, for an acrylic stand
 *   2. Legal joined pair    — Legal, two pairs, folds to a tent or cuts to two
 *
 * Nothing on this page draws or re-renders them. The download route opens the
 * approved PDF, swaps in this business's name and its own QR, and leaves every
 * other byte of the file alone — so what a print shop receives is the artwork
 * somebody said yes to, with the right business on it.
 *
 * WHY THE PREVIEW IS AN IMAGE. It used to be an iframe pointing at the PDF
 * route, and that never rendered: `next.config.ts` sets
 * `Content-Security-Policy: frame-ancestors 'none'` on every response, which
 * blocks framing even from the same origin, so the owner saw an empty box. The
 * previews here are stills of the two masters, so they show the layout rather
 * than this business's own card — which is what the note under the list says.
 */

/**
 * The words for each sheet, one set of phrases per sheet in the list.
 *
 * `PRINT_SHEETS` describes the two masters — which file, which preview, what
 * size — and that description is the same in every language. What an owner
 * READS about each sheet is not, so the sentences live in the dictionary and
 * the list is joined to them here by the sheet's own key. Nothing about the
 * files, the paths or the order moves.
 *
 * A sheet with no entry falls back to the English already carried on the list,
 * so adding a third master can never render an empty card.
 */
type SheetPhrases = {
  label: MessageKey;
  note: MessageKey;
  what: MessageKey;
  finish: MessageKey;
  spec: MessageKey;
};

const SHEET_PHRASES: Record<string, SheetPhrases> = {
  'insert-4x6': {
    label: 'kit.sheets.insert.label',
    note: 'kit.sheets.insert.note',
    what: 'kit.sheets.insert.what',
    finish: 'kit.sheets.insert.finish',
    spec: 'kit.sheets.insert.spec',
  },
  'pair-legal': {
    label: 'kit.sheets.pair.label',
    note: 'kit.sheets.pair.note',
    what: 'kit.sheets.pair.what',
    finish: 'kit.sheets.pair.finish',
    spec: 'kit.sheets.pair.spec',
  },
};

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
    // whether the system is working, and the reason to print another.
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
    photoWidth: product.photoWidth,
    photoHeight: product.photoHeight,
    priceInr: product.priceInr,
  }));

  // The same two masters, with the five sentences an owner reads about each of
  // them in the owner's language. The list, the files, the previews, the sizes
  // and the order are `PRINT_SHEETS` untouched; a sheet with no phrases keeps
  // the English already on the list.
  const sheets = PRINT_SHEETS.map((sheet) => {
    const phrases = SHEET_PHRASES[sheet.key];
    if (!phrases) return sheet;
    return {
      ...sheet,
      label: t(phrases.label),
      sheetNote: t(phrases.note),
      what: t(phrases.what),
      finish: t(phrases.finish),
      spec: t(phrases.spec),
    };
  });

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
            The photographs are of the real printed cards on a real counter —
            not renders of the PDF, which is what the reprint section further
            down still shows.
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
            THE REPRINT ROUTE, KEPT AND DEMOTED (M33). Ordering the printed kit
            is what this page is for now, but a business that already has the
            card and wants one more copy must still be able to get one, and the
            personalised PDF route is the only thing that produces it. So it
            stays, below the order, worded as what it is. Nothing about the
            route, the masters or the personalisation changed.
          */}
          <Section eyebrow={t('kit.reprint.title')} note={t('kit.reprint.body')}>
            <p className="mb-5 text-[14px] leading-relaxed text-ink-600">
              {t('kit.sheets.intro')}
            </p>

            <ul className="space-y-5">
              {sheets.map((sheet) => (
                <li
                  key={sheet.key}
                  className="overflow-hidden rounded-xl border border-ink-200 bg-white"
                >
                  <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
                    <a
                      href={`/print/sheet/${clientId}/${sheet.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block shrink-0 self-start overflow-hidden rounded-lg border border-ink-200 bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none sm:w-[176px]"
                    >
                      <Image
                        src={sheet.preview}
                        alt={t('kit.sheets.previewAlt', { sheet: sheet.label })}
                        width={sheet.previewWidth}
                        height={sheet.previewHeight}
                        className="block h-auto w-full"
                      />
                    </a>

                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] leading-snug font-semibold tracking-tight text-ink-900">
                        {sheet.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-500">{sheet.sheetNote}</p>
                      <p className="mt-2 text-[14px] leading-relaxed text-ink-800">{sheet.what}</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{sheet.finish}</p>
                      <p className="mt-2 text-[12px] leading-relaxed text-ink-500">{sheet.spec}</p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={`/print/sheet/${clientId}/${sheet.key}?download=1`}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
                        >
                          {t('kit.sheets.download')}
                        </a>
                        <a
                          href={`/print/sheet/${clientId}/${sheet.key}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ink-300 bg-white px-5 text-[15px] font-medium text-ink-900 hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
                        >
                          {t('kit.sheets.open')}
                        </a>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/*
            THE PREVIEWS ARE STILLS OF THE MASTERS, so the picture on this page
            still shows the placeholder name and code. The file does not. Said
            once, under the list — an owner who scans the picture instead of the
            print and lands somewhere odd should not have to work out why.
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
