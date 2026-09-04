import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { hexColour } from '@/lib/actions/shared';
import {
  buildKitContent,
  checkReviewUrl,
  computeReadiness,
  type KitContent,
  type KitReadiness,
} from './content';
import { generateQrSvg, type QrResult } from './qr';
import { ensureGateway, getPublicBaseUrl } from '@/lib/gateway/service';
import { feedbackUrl as buildFeedbackUrl } from '@/lib/gateway/token';
import { resolvePublicBaseUrl } from '@/lib/config/public-url';

/**
 * Feedback kit service.
 *
 * One code path for every vertical. The client's `vertical` selects a pack, the
 * pack supplies the wording, and the same page renders it. No vertical-specific
 * branches exist above this layer.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = {
  ok: false;
  message: string;
  errors: Record<string, string>;
};
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const kitConfigSchema = z.object({
  qrTargetUrl: z
    .string()
    .refine((v) => v.trim().length === 0 || checkReviewUrl(v).ok, {
      message:
        'Paste the full public review link, starting with https:// — RepOS never looks it up for you.',
    }),
  displayName: z.string().max(80, 'Keep the printed name short.'),
  headline: z.string().max(120, 'Keep the headline short enough to read at a glance.'),
  subhead: z.string().max(200, 'Keep the sub-line short.'),
  footerNote: z.string().max(200, 'Keep the footer short.'),
  brandPrimary: hexColour,
  brandSecondary: hexColour,
});

export type KitConfigInput = z.infer<typeof kitConfigSchema>;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type KitView = {
  clientId: string;
  businessName: string;
  vertical: string;
  verticalLabel: string;
  pack: Pack;
  content: KitContent;
  readiness: KitReadiness;
  qr: QrResult;
  /**
   * Set when RepOS cannot say what address a customer would open, so no card
   * can be printed yet. Plain language, for the operator.
   */
  addressError: string | null;
  /** True when this client's feedback page is switched off. */
  gatewayPaused: boolean;
  brandPrimary: string;
  brandSecondary: string;
  /** Raw stored values, for populating the settings form. */
  config: KitConfigInput;
  kitInstalledDate: Date | null;
};

const DEFAULT_PRIMARY = '#1F3A5F';
const DEFAULT_SECONDARY = '#C9A227';

/**
 * Everything the kit page needs, resolved through the vertical pack.
 * Returns null when the client does not exist.
 */
export async function getKitView(
  db: PrismaClient,
  clientId: string,
  options: { requestOrigin?: string | null } = {},
): Promise<KitView | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessName: true,
      vertical: true,
      reviewLinkUrl: true,
      kitInstalledDate: true,
      kitConfig: true,
    },
  });
  if (!client) return null;

  const pack = getPackOrFallback(client.vertical);
  const stored = client.kitConfig;

  // The one address every printed piece carries: this client's own feedback
  // page, built from the same gateway token and the same installation address
  // the QR tab and the feedback card use. There is no second URL to keep in
  // step, because there is no second URL.
  const gateway = await ensureGateway(db, clientId);
  const address = resolvePublicBaseUrl({
    setting: await getPublicBaseUrl(db),
    requestOrigin: options.requestOrigin ?? null,
  });
  const feedbackUrl =
    gateway && address.ok ? buildFeedbackUrl(address.url, gateway.publicToken) : '';

  // The optional public review link has one home: the gateway row, which is
  // what the customer's thank-you page actually reads. The two older columns
  // are read only as a fallback for clients set up before the gateway existed,
  // so the operator can never see two different answers on two screens.
  const publicReviewUrl =
    (gateway?.publicReviewUrl ?? '').trim() ||
    (stored?.qrTargetUrl ?? '').trim() ||
    (client.reviewLinkUrl ?? '').trim();

  const config: KitConfigInput = {
    qrTargetUrl: publicReviewUrl,
    displayName: stored?.displayName ?? '',
    headline: stored?.headline ?? '',
    subhead: stored?.subhead ?? '',
    footerNote: stored?.footerNote ?? '',
    brandPrimary: stored?.brandPrimary || DEFAULT_PRIMARY,
    brandSecondary: stored?.brandSecondary || DEFAULT_SECONDARY,
  };

  const content = buildKitContent({
    pack,
    businessName: client.businessName,
    displayName: config.displayName,
    feedbackUrl,
    publicReviewUrl,
    headline: config.headline,
    subhead: config.subhead,
    footerNote: config.footerNote,
  });

  return {
    clientId: client.id,
    businessName: client.businessName,
    vertical: client.vertical,
    verticalLabel: pack.label,
    pack,
    content,
    readiness: computeReadiness({
      businessName: client.businessName,
      feedbackUrl,
    }),
    qr: await generateQrSvg(feedbackUrl),
    addressError: address.ok ? null : address.reason,
    gatewayPaused: gateway ? !gateway.enabled : false,
    brandPrimary: config.brandPrimary,
    brandSecondary: config.brandSecondary,
    config,
    kitInstalledDate: client.kitInstalledDate,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function saveKitConfig(
  db: PrismaClient,
  clientId: string,
  raw: unknown,
): Promise<ServiceResult<{ clientId: string; ready: boolean }>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true },
  });
  if (!client) return err('That client no longer exists.');

  const parsed = kitConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join('.') || '_form';
      if (!errors[key]) errors[key] = issue.message;
    }
    return err('Some fields need attention.', errors);
  }

  const data = parsed.data;
  const normalisedUrl = checkReviewUrl(data.qrTargetUrl);

  await db.kitConfig.upsert({
    where: { clientId },
    create: {
      clientId,
      // Store the normalised form so the QR and the copy button always agree.
      qrTargetUrl: normalisedUrl.ok ? normalisedUrl.url : '',
      displayName: data.displayName,
      headline: data.headline,
      subhead: data.subhead,
      footerNote: data.footerNote,
      brandPrimary: data.brandPrimary,
      brandSecondary: data.brandSecondary,
    },
    update: {
      qrTargetUrl: normalisedUrl.ok ? normalisedUrl.url : '',
      displayName: data.displayName,
      headline: data.headline,
      subhead: data.subhead,
      footerNote: data.footerNote,
      brandPrimary: data.brandPrimary,
      brandSecondary: data.brandSecondary,
    },
  });

  // The public review link the operator just typed is the same one the
  // customer's thank-you page offers, so it is written to the gateway as well.
  // Two screens, one value.
  await syncPublicReviewUrl(db, clientId, normalisedUrl.ok ? normalisedUrl.url : '');

  return ok({ clientId, ready: true });
}

/**
 * Keeps the optional public review link identical wherever it is edited.
 *
 * The kit page and the Feedback QR page both offer this field. Before M17 they
 * wrote to different columns, so the card could point one way and the
 * thank-you page another. Now either screen writes both.
 */
async function syncPublicReviewUrl(
  db: PrismaClient,
  clientId: string,
  url: string,
): Promise<void> {
  await db.feedbackGateway.updateMany({
    where: { clientId },
    data: { publicReviewUrl: url },
  });
  await db.client.update({ where: { id: clientId }, data: { reviewLinkUrl: url || null } });
}

/**
 * Fast path for adding the OPTIONAL public review link.
 *
 * It is not what makes a kit printable — the card carries the RepOS feedback
 * page, which every client has from the moment they are created. This only
 * decides whether customers are offered a public review after they have
 * already had their say.
 */
export async function saveReviewLink(
  db: PrismaClient,
  clientId: string,
  rawUrl: string,
): Promise<ServiceResult<{ clientId: string }>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) return err('That client no longer exists.');

  // Blank clears it. The card does not depend on this link, so removing it has
  // to be as easy as adding it (M17).
  const value = rawUrl.trim();
  if (value.length === 0) {
    await db.kitConfig.upsert({
      where: { clientId },
      create: { clientId, qrTargetUrl: '' },
      update: { qrTargetUrl: '' },
    });
    await syncPublicReviewUrl(db, clientId, '');
    return ok({ clientId });
  }

  const check = checkReviewUrl(value);
  if (!check.ok) {
    return err('That link cannot be used.', { qrTargetUrl: check.reason });
  }

  await db.kitConfig.upsert({
    where: { clientId },
    create: { clientId, qrTargetUrl: check.url },
    update: { qrTargetUrl: check.url },
  });
  await syncPublicReviewUrl(db, clientId, check.url);

  return ok({ clientId });
}

/** Records that the printed kit is physically on site. */
export async function setKitInstalled(
  db: PrismaClient,
  clientId: string,
  installed: boolean,
  now: Date = new Date(),
): Promise<ServiceResult<{ clientId: string }>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  if (!client) return err('That client no longer exists.');

  await db.client.update({
    where: { id: clientId },
    data: { kitInstalledDate: installed ? now : null },
  });
  return ok({ clientId });
}
