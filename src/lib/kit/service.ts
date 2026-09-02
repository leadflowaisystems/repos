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

  // If the operator already recorded a review link on the client record, use it
  // as the kit destination rather than asking for the same URL twice.
  const qrTargetUrl =
    (stored?.qrTargetUrl ?? '').trim() || (client.reviewLinkUrl ?? '').trim();

  const config: KitConfigInput = {
    qrTargetUrl,
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
    reviewUrl: config.qrTargetUrl,
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
      reviewUrl: config.qrTargetUrl,
    }),
    qr: await generateQrSvg(config.qrTargetUrl),
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

  return ok({
    clientId,
    ready: computeReadiness({
      businessName: client.businessName,
      reviewUrl: data.qrTargetUrl,
    }).ready,
  });
}

/**
 * Fast path used by the "add your link" state: saves only the destination and
 * leaves every other setting on its vertical default. This is what keeps a new
 * client one field away from a printable kit.
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

  const check = checkReviewUrl(rawUrl);
  if (!check.ok) {
    return err('That link cannot be used.', { qrTargetUrl: check.reason });
  }

  await db.kitConfig.upsert({
    where: { clientId },
    create: { clientId, qrTargetUrl: check.url },
    update: { qrTargetUrl: check.url },
  });

  // Keep the client record in step so the operator never types this twice.
  await db.client.update({
    where: { id: clientId },
    data: { reviewLinkUrl: check.url },
  });

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
