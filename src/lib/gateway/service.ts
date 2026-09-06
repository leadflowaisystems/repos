import type { PrismaClient } from '@prisma/client';
import { getPackOrFallback, type PackDimension } from '@/lib/packs';
import { checkReviewUrl } from '@/lib/kit/content';
import { ingestFeedback, prepareIngest } from '@/lib/feedback/ingest';
import { isPublicClient } from '@/lib/db-public';
import { encodeDimensions, encodeSignals } from '@/lib/feedback/structured';
import { readGateway, writeSubmissionAsPublic } from './store';
import { parseStructured, ratedCount } from '@/lib/feedback/structured';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { buildGatewayCopy, publicReviewLabel, type GatewayCopy } from './copy';
import {
  checkBaseUrl,
  feedbackUrl,
  isPublicToken,
  newPublicToken,
} from './token';
import { resolvePublicBaseUrl, type BaseUrlSource } from '@/lib/config/public-url';
import { renderGatewayQr, type GatewayQr } from './qr';
import {
  ADDRESS_LIMIT,
  NONCE_TTL_MS,
  OnceSet,
  PAGE_LIMIT,
  RateLimiter,
  hashKey,
} from './throttle';

/**
 * CUSTOMER FEEDBACK GATEWAY (M14).
 *
 * The front door. A customer scans a QR, opens one page, says what they
 * think, and it lands in the same feedback pile the operator pastes into —
 * same row, same reading, same intelligence, same owner pages. There is no
 * second pipeline and no QR dashboard.
 *
 * Three rules this service keeps:
 *
 *  1. A public token resolves to one client, or to nothing. Every read and
 *     write is scoped by the client the token resolved to; the token never
 *     reaches a query about any other client.
 *  2. The customer is never identified. No name, no phone, no email, no
 *     network address is stored. Text is redacted before it is written, as
 *     every other source's text already is.
 *  3. The page treats everyone the same. It never reads what was written to
 *     decide what to show next, and the public review link — when the
 *     operator added one — is offered to every customer or to none.
 *
 * Nothing here fetches anything, contacts any provider, or posts anywhere.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// The gateway row — one per client, created the first time it is needed
// ---------------------------------------------------------------------------

export type GatewayRow = {
  id: string;
  clientId: string;
  publicToken: string;
  enabled: boolean;
  publicReviewUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Every client has a feedback page; this makes sure the row behind it exists.
 *
 * The public review link starts as whatever the operator already gave the
 * print kit or the client record, so it is never typed twice. Null when the
 * client does not exist.
 */
export async function ensureGateway(
  db: PrismaClient,
  clientId: string,
): Promise<GatewayRow | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      reviewLinkUrl: true,
      kitConfig: { select: { qrTargetUrl: true } },
      gateway: true,
    },
  });
  if (!client) return null;
  if (client.gateway) return client.gateway;

  const known = [client.kitConfig?.qrTargetUrl, client.reviewLinkUrl]
    .map((value) => checkReviewUrl(value))
    .find((check) => check.ok);
  const publicReviewUrl = known && known.ok ? known.url : '';

  // Two things can fail here, and both end in the same place: one row.
  //
  //   - clientId is unique, so two first loads of the page race and one
  //     loses. The loser reads the winner's row rather than erroring, which
  //     is why a client can never end up with two tokens.
  //   - publicToken is unique too. A collision on 110 random bits will not
  //     happen, but a fresh token on retry costs nothing and means the
  //     guarantee rests on the constraint rather than on luck.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.feedbackGateway.create({
        data: { clientId, publicToken: newPublicToken(), publicReviewUrl },
      });
    } catch (error) {
      const existing = await db.feedbackGateway.findUnique({ where: { clientId } });
      if (existing) return existing;
      if (attempt === 2) throw error;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The public address — one setting for the whole installation
// ---------------------------------------------------------------------------

export const BASE_URL_SETTING = 'gateway.publicBaseUrl';

/** The operator's configured address, or null to use the address RepOS was opened on. */
export async function getPublicBaseUrl(db: PrismaClient): Promise<string | null> {
  const row = await db.appSetting.findUnique({ where: { key: BASE_URL_SETTING } });
  const check = checkBaseUrl(row?.value);
  return check.ok ? check.url : null;
}

/** Blank clears the setting, so the address RepOS was opened on is used again. */
export async function savePublicBaseUrl(
  db: PrismaClient,
  raw: string,
): Promise<ServiceResult<{ url: string | null }>> {
  const value = raw.trim();
  if (value.length === 0) {
    await db.appSetting.deleteMany({ where: { key: BASE_URL_SETTING } });
    return ok({ url: null });
  }
  const check = checkBaseUrl(value);
  if (!check.ok) return err('That address cannot be used.', { publicBaseUrl: check.reason });

  await db.appSetting.upsert({
    where: { key: BASE_URL_SETTING },
    create: { key: BASE_URL_SETTING, value: check.url },
    update: { value: check.url },
  });
  return ok({ url: check.url });
}

// ---------------------------------------------------------------------------
// Operator view
// ---------------------------------------------------------------------------

export type GatewayView = {
  clientId: string;
  businessName: string;
  vertical: string;
  verticalLabel: string;
  archived: boolean;
  token: string;
  enabled: boolean;
  /** The customer-facing address. What the QR encodes. Blank when unconfigured. */
  feedbackUrl: string;
  baseUrl: string;
  /** Where the address came from: the environment, the saved setting, or this request. */
  baseUrlSource: BaseUrlSource | null;
  /** True when the address only works on this computer, so a card would be useless. */
  baseUrlLoopback: boolean;
  /**
   * Set when RepOS cannot say what address a customer would open — in plain
   * language, for the operator. No QR is produced while this is set, because a
   * printed card with the wrong address inside it cannot be recalled.
   */
  baseUrlError: string | null;
  publicReviewUrl: string;
  publicReviewLabel: string;
  copy: GatewayCopy;
  qr: GatewayQr | null;
  received: { total: number; unread: number; latestAt: Date | null };
};

/**
 * Everything the operator's page and the print sheet need.
 *
 * `requestOrigin` is the address RepOS was opened on, used until the operator
 * saves a public address. Null when the client does not exist.
 */
export async function getGatewayView(
  db: PrismaClient,
  clientId: string,
  options: { requestOrigin: string | null },
): Promise<GatewayView | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true, vertical: true, archivedAt: true },
  });
  if (!client) return null;

  const gateway = await ensureGateway(db, clientId);
  if (!gateway) return null;

  const setting = await getPublicBaseUrl(db);
  const address = resolvePublicBaseUrl({ setting, requestOrigin: options.requestOrigin });
  const baseUrl = address.ok ? address.url : '';
  const url = address.ok ? feedbackUrl(baseUrl, gateway.publicToken) : '';
  const pack = getPackOrFallback(client.vertical);

  const [qr, rows] = await Promise.all([
    address.ok ? renderGatewayQr(url) : Promise.resolve(null),
    db.reviewItem.findMany({
      where: { clientId, source: 'REP_OS_QR' },
      select: { analysisStatus: true, analysisVersion: true, createdAt: true },
    }),
  ]);

  let unread = 0;
  let latestAt: Date | null = null;
  for (const row of rows) {
    if (row.analysisStatus !== 'ANALYSED' || row.analysisVersion < ANALYSIS_VERSION) unread += 1;
    if (!latestAt || row.createdAt > latestAt) latestAt = row.createdAt;
  }

  return {
    clientId: client.id,
    businessName: client.businessName,
    vertical: client.vertical,
    verticalLabel: pack.label,
    archived: client.archivedAt !== null,
    token: gateway.publicToken,
    enabled: gateway.enabled,
    feedbackUrl: url,
    baseUrl,
    baseUrlSource: address.ok ? address.source : null,
    baseUrlLoopback: address.ok ? address.loopback : false,
    baseUrlError: address.ok ? null : address.reason,
    publicReviewUrl: gateway.publicReviewUrl,
    publicReviewLabel: publicReviewLabel(gateway.publicReviewUrl || null),
    copy: buildGatewayCopy(pack, client.businessName),
    qr,
    received: { total: rows.length, unread, latestAt },
  };
}

/** The operator's public review link for this client. Blank removes it. */
export async function savePublicReviewUrl(
  db: PrismaClient,
  clientId: string,
  raw: string,
): Promise<ServiceResult<{ url: string }>> {
  const gateway = await ensureGateway(db, clientId);
  if (!gateway) return err('That client no longer exists.');

  const value = raw.trim();
  if (value.length === 0) {
    await db.feedbackGateway.update({ where: { clientId }, data: { publicReviewUrl: '' } });
    await mirrorPublicReviewUrl(db, clientId, '');
    return ok({ url: '' });
  }

  const check = checkReviewUrl(value);
  if (!check.ok) return err('That link cannot be used.', { publicReviewUrl: check.reason });

  await db.feedbackGateway.update({
    where: { clientId },
    data: { publicReviewUrl: check.url },
  });
  await mirrorPublicReviewUrl(db, clientId, check.url);
  return ok({ url: check.url });
}

/**
 * The optional public review link is offered on two operator screens — here
 * and on the kit page — and it is one link (M17).
 *
 * Two columns predate this row and are still read as a fallback for clients
 * created before the gateway existed, so clearing the link has to clear them
 * too. Otherwise removing it here would leave the kit page still showing it.
 */
async function mirrorPublicReviewUrl(
  db: PrismaClient,
  clientId: string,
  url: string,
): Promise<void> {
  await db.kitConfig.updateMany({ where: { clientId }, data: { qrTargetUrl: url } });
  await db.client.update({ where: { id: clientId }, data: { reviewLinkUrl: url || null } });
}

export async function setGatewayEnabled(
  db: PrismaClient,
  clientId: string,
  enabled: boolean,
): Promise<ServiceResult<{ enabled: boolean }>> {
  const gateway = await ensureGateway(db, clientId);
  if (!gateway) return err('That client no longer exists.');
  await db.feedbackGateway.update({ where: { clientId }, data: { enabled } });
  return ok({ enabled });
}

// ---------------------------------------------------------------------------
// Public side
// ---------------------------------------------------------------------------

/** Exactly what the customer page may know. Nothing else leaves the service. */
export type PublicGateway = {
  clientId: string;
  token: string;
  businessName: string;
  copy: GatewayCopy;
  /** Null when the operator has not added one. Shown to everyone or no one. */
  publicReviewUrl: string | null;
  publicReviewLabel: string | null;
  /**
   * What this vertical asks about, in the order it asks (M19). Empty for a
   * pack with no set, and then the page asks the one overall question.
   */
  dimensions: PackDimension[];
};

/**
 * Resolves a token to one business, or to nothing.
 *
 * Nothing for a malformed token, an unknown token, a paused page or an
 * archived client — and the same nothing in every case, so a caller cannot
 * tell which it was.
 */
export async function resolvePublicGateway(
  db: PrismaClient,
  token: unknown,
): Promise<PublicGateway | null> {
  if (!isPublicToken(token)) return null;

  // One read, through whichever boundary this handle belongs to. An anonymous
  // request resolves its token inside the database and never holds a privilege
  // that could list a second gateway; an operator's request takes the ordinary
  // RLS-bound path. Both answer null for a paused gateway or an archived
  // business, so a customer cannot tell those apart from a wrong token.
  const gateway = await readGateway(db, token);
  if (!gateway) return null;

  const pack = getPackOrFallback(gateway.vertical);
  const url = gateway.publicReviewUrl.trim() || null;
  return {
    clientId: gateway.clientId,
    token,
    businessName: gateway.businessName,
    copy: buildGatewayCopy(pack, gateway.businessName),
    publicReviewUrl: url,
    publicReviewLabel: url ? publicReviewLabel(url) : null,
    dimensions: pack.gateway?.dimensions ?? [],
  };
}

// --- Submission --------------------------------------------------------------

export const MAX_CUSTOMER_TEXT = 1500;
/** Same wording again within this window is the same person tapping twice. */
export const TEXT_DUPLICATE_WINDOW_MS = 10 * 60_000;
/** Same rating, no words, within this window is the same tap twice. */
export const RATING_DUPLICATE_WINDOW_MS = 30_000;

export const NOT_ACTIVE_MESSAGE = 'This feedback link is not active right now.';
export const NOTHING_MESSAGE = 'Add a rating or a few words first.';
export const TOO_LONG_MESSAGE = `Please keep it under ${MAX_CUSTOMER_TEXT} characters.`;
export const TOO_MANY_MESSAGE =
  'A lot of messages have come from here just now. Please try again in a few minutes.';

export type CustomerSubmission = {
  stars: number | null;
  text: string;
  /** Stable dimension key to a 1-5 rating (M19). Unknown keys are dropped. */
  dimensions?: Record<string, unknown> | null;
  /** Stable signal keys the customer tapped (M19). Unknown keys are dropped. */
  signals?: string[] | null;
  /** Per-render form id; a repeat is a double tap. Optional. */
  nonce?: string | null;
  /** Honeypot. Humans never see the field; anything in it is a bot. */
  website?: string | null;
};

export type SubmitOutcome = {
  token: string;
  /**
   * The business the token resolved to — inside the database, never from a
   * URL — so the caller can start the reading for it. Server-side only: the
   * customer's redirect carries the token and nothing else.
   */
  clientId: string;
  /** False when the submission was accepted but deliberately not stored. */
  stored: boolean;
  itemId: string | null;
};

const pageLimiter = new RateLimiter(PAGE_LIMIT.limit, PAGE_LIMIT.windowMs);
const addressLimiter = new RateLimiter(ADDRESS_LIMIT.limit, ADDRESS_LIMIT.windowMs);
const nonces = new OnceSet(NONCE_TTL_MS);

/** Test seam: forget every counter. */
export function _resetGatewayThrottles(): void {
  pageLimiter.reset();
  addressLimiter.reset();
  nonces.reset();
}

const URL_RE = /https?:\/\/|www\./gi;
/** Zero-width and control characters that only ever arrive from scripts. */
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u2028\u2029\uFEFF]/g;

/**
 * One customer's submission.
 *
 * Accepts a rating, words, or both; refuses neither by itself. Returns the
 * same thank-you for a stored submission, a repeat and a bot, because telling
 * a bot it was caught only helps the bot — and telling a person their second
 * tap was ignored only worries them.
 */
export async function submitCustomerFeedback(
  db: PrismaClient,
  token: unknown,
  raw: CustomerSubmission,
  options: { now?: Date; address?: string | null } = {},
): Promise<ServiceResult<SubmitOutcome>> {
  const gateway = await resolvePublicGateway(db, token);
  if (!gateway) return err(NOT_ACTIVE_MESSAGE);

  const now = options.now ?? new Date();

  // A filled honeypot is not a person. Say thank you and store nothing.
  if (typeof raw.website === 'string' && raw.website.trim().length > 0) {
    return ok({ token: gateway.token, clientId: gateway.clientId, stored: false, itemId: null });
  }

  const stars = raw.stars;
  if (stars !== null && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
    return err('Pick a rating from 1 to 5.', { stars: 'Pick a rating from 1 to 5.' });
  }

  const text = (raw.text ?? '').replace(CONTROL_RE, '').trim();
  if (text.length > MAX_CUSTOMER_TEXT) {
    return err(TOO_LONG_MESSAGE, { text: TOO_LONG_MESSAGE });
  }
  const hasWords = /[\p{L}\p{N}]/u.test(text);

  // Keys the customer's own vertical defines, and nothing else. Someone who
  // rated five parts of their visit and typed nothing has said plenty.
  const structured = parseStructured(gateway.dimensions, {
    dimensions: raw.dimensions ?? undefined,
    signals: raw.signals ?? undefined,
  });
  if (!hasWords && stars === null && ratedCount(structured) === 0) {
    return err(NOTHING_MESSAGE, { text: NOTHING_MESSAGE });
  }

  // Ceilings, per page and per address when one is known. Counted before
  // anything is stored, so a flood counts even when it is all duplicates.
  const pageKey = hashKey(`page:${gateway.token}`);
  const addressKey = options.address ? hashKey(`addr:${options.address}`) : null;
  if (!pageLimiter.check(pageKey, now).allowed) return err(TOO_MANY_MESSAGE);
  if (addressKey && !addressLimiter.check(addressKey, now).allowed) return err(TOO_MANY_MESSAGE);
  pageLimiter.record(pageKey, now);
  if (addressKey) addressLimiter.record(addressKey, now);

  // The same form posted twice lands once.
  if (typeof raw.nonce === 'string' && raw.nonce.length > 0 && raw.nonce.length <= 64) {
    if (!nonces.useOnce(`${gateway.token}:${raw.nonce}`, now)) {
      return ok({ token: gateway.token, clientId: gateway.clientId, stored: false, itemId: null });
    }
  }

  // Two or more links is advertising, not feedback.
  if ((text.match(URL_RE) ?? []).length >= 2) {
    return ok({ token: gateway.token, clientId: gateway.clientId, stored: false, itemId: null });
  }

  const input = {
    text: hasWords ? text : '',
    stars,
    occurredAt: now,
    source: 'REP_OS_QR' as const,
    structured,
  };
  const dedupe = {
    mode: 'WINDOW' as const,
    textWindowMs: TEXT_DUPLICATE_WINDOW_MS,
    ratingOnlyWindowMs: RATING_DUPLICATE_WINDOW_MS,
  };

  // Both paths run the same preparation — the same redaction, the same
  // fingerprint, the same refusal of an empty submission — and differ only in
  // how the row reaches the database. The anonymous one goes through a
  // function that resolves the business from the token again, on its own, and
  // so is never told which client to write to.
  const ingested = isPublicClient(db)
    ? await ingestAsPublic(db, gateway.token, input, { now, dedupe })
    : await ingestFeedback(db, gateway.clientId, input, { now, allowEmptyText: true, dedupe });
  if (!ingested.ok) return err(ingested.message, ingested.errors);

  return ok({
    token: gateway.token,
    clientId: gateway.clientId,
    stored: !ingested.data.duplicate,
    itemId: ingested.data.duplicate ? null : ingested.data.id,
  });
}

/**
 * The anonymous half of the fork: prepare exactly as always, then store
 * through the privilege-less boundary.
 */
async function ingestAsPublic(
  db: PrismaClient,
  token: string,
  input: Parameters<typeof prepareIngest>[0],
  options: { now: Date; dedupe: { textWindowMs: number; ratingOnlyWindowMs: number } },
): Promise<ServiceResult<{ id: string; duplicate: boolean }>> {
  const prepared = prepareIngest(input, { now: options.now, allowEmptyText: true });
  if (!prepared.ok) return err(prepared.message, prepared.errors);
  const p = prepared.data;

  const stored = await writeSubmissionAsPublic(db, token, {
    text: p.text,
    stars: input.stars,
    reviewDate: input.occurredAt,
    source: input.source,
    fingerprint: p.fingerprint,
    dimensionsJson: encodeDimensions(p.structured.dimensions),
    signalsJson: encodeSignals(p.structured.signals),
    redacted: p.redacted,
    redactionsJson: JSON.stringify(p.redactions),
    textWindowMs: options.dedupe.textWindowMs,
    ratingOnlyWindowMs: options.dedupe.ratingOnlyWindowMs,
    now: p.now,
  });

  // No rows means the token stopped resolving between the read and the write —
  // the gateway was paused, or the business archived, mid-submission.
  if (!stored) return err(NOT_ACTIVE_MESSAGE);
  return ok(stored);
}
