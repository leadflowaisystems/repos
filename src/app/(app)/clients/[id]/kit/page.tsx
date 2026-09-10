import { notFound } from 'next/navigation';
import clsx from 'clsx';
import { Badge, Card, CardBody, CardHeader, LinkButton, Notice } from '@/components/ui';
import Image from 'next/image';
import { CopyButton } from '@/components/copy-button';
import {
  KitInstalledToggle,
  KitSettingsForm,
  ReviewLinkForm,
} from '@/components/forms/kit-forms';
import { prisma } from '@/lib/db';
import { getKitView } from '@/lib/kit/service';
import { KIT_PRODUCTS } from '@/lib/kit/catalogue';
import { PRINT_SHEETS } from '@/lib/kit/sheets';
import { requestOrigin } from '@/lib/gateway/origin';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * The operator's words for the two formats.
 *
 * Plain strings, not dictionary keys: the operator console is not translated.
 * They are keyed by the catalogue's own product key, so the two lists cannot
 * drift apart without a type error.
 */
const PRODUCT_TITLE: Record<string, string> = {
  'card-qr-stand': '4 × 6 in Card + QR Stand',
  'folded-tent': '4 × 6 in Folded Tent Card',
};

const PRODUCT_BLURB: Record<string, string> = {
  'card-qr-stand': 'Personalized 4 × 6 in feedback card for a QR stand holder.',
  'folded-tent': 'Personalized 4 × 6 in feedback card that folds into a table tent.',
};

/**
 * ONE kit page for every vertical.
 *
 * There is no clinic page, no salon page and no restaurant page. This file
 * renders whatever the client's vertical pack says, which is what lets a new
 * business type be onboarded without touching React at all.
 */
export default async function KitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kit = await getKitView(prisma, id, { requestOrigin: await requestOrigin() });
  if (!kit) notFound();

  const { content, readiness, qr } = kit;

  /**
   * THE TWO APPROVED FORMATS, AND THE MASTER EACH ONE PRINTS FROM (M36).
   *
   * Both are the same signed-off Headway card. `insert-4x6` is the A4 sheet
   * whose own description says "for an acrylic stand"; `pair-legal` is the
   * Legal sheet that scores and folds into a standing tent. Nothing here draws
   * or re-renders anything — each link opens the existing personalised print
   * route, which fills this business's name and its own QR into the approved
   * PDF and leaves every other byte alone.
   *
   * A format with no sheet behind it is not rendered rather than rendered
   * broken, so this cannot invent a third option by accident.
   */
  const FORMAT_SHEET: Record<string, string> = {
    'card-qr-stand': 'insert-4x6',
    'folded-tent': 'pair-legal',
  };
  const formats = KIT_PRODUCTS.flatMap((product) => {
    const sheet = PRINT_SHEETS.find((s) => s.key === FORMAT_SHEET[product.key]);
    return sheet ? [{ product, sheet }] : [];
  });

  return (
    <div className="space-y-6">
      {/* ---- Ready state: the first thing the operator should see ---- */}
      <Card className="overflow-hidden">
        <div className={clsx('h-1', readiness.ready ? 'bg-good-600' : 'bg-warn-600')} />
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={readiness.ready ? 'good' : 'warn'}>{readiness.label}</Badge>
              <span className="text-[13px] text-ink-500">
                {kit.verticalLabel} kit · {content.assetLabel}
              </span>
            </div>
            <p className="mt-2 text-[15px] font-semibold text-ink-900">
              {readiness.headline}
            </p>
            {kit.kitInstalledDate ? (
              <p className="mt-1 text-[12px] text-ink-500">
                Marked installed on site {formatDate(kit.kitInstalledDate)}.
              </p>
            ) : null}
          </div>

          {readiness.ready ? (
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={content.feedbackUrl ?? ''} label="Copy feedback link" />
              <KitInstalledToggle
                clientId={id}
                installed={kit.kitInstalledDate !== null}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/*
        ---- The two formats: the primary presentation (M36) ----

        This used to be one button opening a generic browser-print page. The
        physical kit has exactly two approved formats, and the operator picks
        the one the shop asked for. Each card shows the real photographed
        product and prints from the approved master for that format.
      */}
      {readiness.ready ? (
        <Card>
          <CardHeader
            title="Print this client's kit"
            description="Two formats, both the approved card. Each print carries this client's name and their own QR."
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {formats.map(({ product, sheet }) => (
                <article
                  key={product.key}
                  className="flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white"
                >
                  <Image
                    src={product.photo}
                    alt={product.shortName}
                    width={product.photoWidth}
                    height={product.photoHeight}
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="aspect-[4/3] w-full bg-ink-50 object-cover"
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[15px] font-semibold tracking-tight text-ink-900">
                      {PRODUCT_TITLE[product.key]}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                      {PRODUCT_BLURB[product.key]}
                    </p>
                    <p className="mt-2 text-[12px] text-ink-500">{sheet.sheetNote}</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <LinkButton
                        href={`/print/sheet/${id}/${sheet.key}`}
                        variant="primary"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Print this format
                      </LinkButton>
                      <LinkButton href={`/print/sheet/${id}/${sheet.key}?download=1`}>
                        Download PDF
                      </LinkButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-500">
              Printing is not ordering. Nothing here records that this client
              asked for a kit — that is the Orders page.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* ---- What is actually in the way, if anything ---- */}
      {!readiness.ready ? (
        <Card>
          <CardHeader
            title={readiness.blockers[0]?.label ?? 'Finish the setup'}
            description="This is the only thing standing between this client and a printable kit."
          />
          <CardBody className="space-y-4">
            {readiness.blockers.map((blocker) => (
              <Notice key={blocker.key} tone="warn" title={blocker.label}>
                {blocker.hint}
              </Notice>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {kit.gatewayPaused ? (
        <Notice tone="warn" title="This client&rsquo;s feedback page is paused">
          The cards will print, but a customer who scans one today sees &ldquo;not active&rdquo;
          and nothing is stored. Turn it back on from the Feedback QR tab before handing these
          out.
        </Notice>
      ) : null}

      {/* ---- The optional public review link ---- */}
      <Card>
        <CardHeader
          title="A public review, optional"
          description="Nothing on the card depends on this. It only decides whether customers are offered a public review after they have already had their say."
        />
        <CardBody className="space-y-4">
          {content.publicReviewNote ? (
            <Notice tone="good">{content.publicReviewNote}</Notice>
          ) : (
            <Notice tone="neutral">
              No public review link. Customers finish at the thank-you page, and this business is
              fully served without one.
            </Notice>
          )}
          <ReviewLinkForm
            clientId={id}
            defaultValue={kit.config.qrTargetUrl}
            hint="Open the business's public listing yourself, copy its “write a review” link, and paste it here. Headway never fetches or looks up a listing. Leave it blank if the business has no public listing."
          />
        </CardBody>
      </Card>

      {/* ---- Preview ---- */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader title="Preview" description={`How the ${content.assetLabel} will print.`} />
          <CardBody>
            <div
              className="rounded-xl border px-5 py-6 text-center"
              style={{ borderColor: kit.brandPrimary }}
            >
              <p
                className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: kit.brandSecondary }}
              >
                {content.displayName}
              </p>
              <p
                className="mt-3 text-[19px] leading-snug font-semibold"
                style={{ color: kit.brandPrimary }}
              >
                {content.headline}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                {content.subhead}
              </p>

              <div className="mx-auto mt-4 w-[150px]">
                {qr.ok ? (
                  <div
                    className="[&>svg]:h-auto [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qr.svg }}
                  />
                ) : (
                  <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-ink-300 px-3 text-[11px] leading-relaxed text-ink-400">
                    QR appears here once the review link is added
                  </div>
                )}
              </div>

              <p className="mt-3 text-[12px] text-ink-600">{content.qrCaption}</p>
              <p className="mt-3 text-[11px] text-ink-400">{content.footerNote}</p>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          {/* ---- Copyable messages ---- */}
          <Card>
            <CardHeader
              title="Message to send"
              description="Written for this vertical. Send it yourself — Headway never sends anything."
            />
            <CardBody className="space-y-3">
              {content.messages.map((message) => (
                <div
                  key={message.key}
                  className="rounded-lg border border-ink-200 bg-ink-50/60 px-4 py-3"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge>{message.language}</Badge>
                    <CopyButton
                      value={message.body}
                      label="Copy message"
                      className="px-2.5 py-1 text-[12px]"
                    />
                  </div>
                  <p className="text-[13px] leading-relaxed break-words text-ink-800">
                    {message.body}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* ---- Where and when ---- */}
          <Card>
            <CardHeader
              title="How to use it"
              description={`Guidance for a ${kit.verticalLabel.toLowerCase()}.`}
            />
            <CardBody className="space-y-4">
              <Detail label="Where to put it">{content.placement}</Detail>
              <Detail label="When staff should mention it">
                {content.staffScript.when}
              </Detail>
              <Detail label="What staff should say">
                <span className="block">&ldquo;{content.staffScript.english}&rdquo;</span>
                {content.staffScript.hinglish ? (
                  <span className="mt-1.5 block text-ink-600">
                    &ldquo;{content.staffScript.hinglish}&rdquo;
                  </span>
                ) : null}
                {content.staffScript.marathi ? (
                  <span className="mt-1.5 block text-ink-600">
                    &ldquo;{content.staffScript.marathi}&rdquo;
                  </span>
                ) : null}
              </Detail>

              <div>
                <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                  Never do these
                </p>
                <ul className="space-y-1">
                  {content.rules.map((rule) => (
                    <li key={rule} className="text-[13px] text-bad-700">
                      · {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Customise"
              description="Optional. Every blank field uses the vertical wording."
            />
            <CardBody>
              <KitSettingsForm
                clientId={id}
                values={kit.config}
                verticalLabel={kit.verticalLabel}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        {label}
      </p>
      <p className="text-[13px] leading-relaxed text-ink-800">{children}</p>
    </div>
  );
}
