import type { PrismaClient } from '@prisma/client';
import { describeLifecycle } from '@/lib/lifecycle/service';
import { isPublicClient } from '@/lib/db-public';

/**
 * THE TWO DATABASE OPERATIONS A CUSTOMER PERFORMS (M20 Stage 10B).
 *
 * A customer with a QR code does exactly two things: their token is resolved
 * to a business, and their words are stored against it. Everything else the
 * gateway does — the copy, the vertical pack, redaction, fingerprinting, the
 * honeypot, the nonce, the rate limits, deciding what counts as a duplicate —
 * happens in the application, above this file, and is unchanged.
 *
 * WHY THIS FILE EXISTS. Those two operations are the only ones in RepOS that
 * a request with no identity must be able to perform, so they are the only
 * ones that cannot go through the RLS-protected client. They are forked here,
 * and nowhere else: an authenticated request that happens to touch a gateway
 * still takes the ordinary path and is still bound by every policy.
 *
 * The fork is decided by which handle the caller was given — `isPublicClient`,
 * settled where the client was constructed — not by sniffing a connection
 * string or reading an environment variable at the point of use. An
 * authenticated caller cannot accidentally end up on the anonymous path,
 * because an authenticated caller never holds the anonymous handle.
 */

export type GatewayRow = {
  clientId: string;
  businessName: string;
  vertical: string;
  publicReviewUrl: string;
};

/**
 * Whether this token belongs to a real, switched-on feedback page — regardless
 * of whether its service is currently live.
 *
 * Used for ONE thing: choosing between "feedback is temporarily unavailable"
 * and a 404. A customer holding a printed card whose business has lapsed should
 * not be told the page does not exist, because that reads as the BUSINESS being
 * broken. It returns a boolean and never a status, so nothing about the
 * commercial relationship reaches the page.
 */
export async function gatewayTokenExists(db: PrismaClient, token: string): Promise<boolean> {
  if (isPublicClient(db)) {
    try {
      const rows = await db.$queryRaw<{ exists: boolean }[]>`
        SELECT app.public_gateway_exists(${token}::text) AS exists`;
      return rows[0]?.exists === true;
    } catch {
      // An installation without the M28 function answers the old way: unknown.
      return false;
    }
  }
  const gateway = await db.feedbackGateway.findUnique({
    where: { publicToken: token },
    select: { enabled: true, client: { select: { archivedAt: true } } },
  });
  return Boolean(gateway?.enabled && gateway.client.archivedAt === null);
}

/** One gateway, by its public token, or nothing. */
export async function readGateway(db: PrismaClient, token: string): Promise<GatewayRow | null> {
  if (isPublicClient(db)) {
    const rows = await db.$queryRaw<
      { client_id: string; business_name: string; vertical: string; public_review_url: string }[]
    >`SELECT * FROM app.public_gateway(${token}::text)`;
    const row = rows[0];
    return row
      ? {
          clientId: row.client_id,
          businessName: row.business_name,
          vertical: row.vertical,
          publicReviewUrl: row.public_review_url,
        }
      : null;
  }

  const gateway = await db.feedbackGateway.findUnique({
    where: { publicToken: token },
    select: {
      enabled: true,
      publicReviewUrl: true,
      client: {
        select: {
          id: true,
          businessName: true,
          vertical: true,
          archivedAt: true,
          subscriptionStatus: true,
          trialStartsAt: true,
          trialEndsAt: true,
          serviceLockedAt: true,
          accessOverrideAt: true,
          serviceExemption: true,
        },
      },
    },
  });
  // The same conditions the SQL function applies, so both paths answer
  // identically for a paused gateway, an archived business, and — since M28 —
  // one whose trial ran out more than three calendar days ago. The grace itself
  // is computed by the one shared function both sides mirror.
  if (!gateway || !gateway.enabled || gateway.client.archivedAt !== null) return null;
  const { client } = gateway;
  if (!describeLifecycle({ ...client, now: new Date() }).qrActive) return null;
  return {
    clientId: gateway.client.id,
    businessName: gateway.client.businessName,
    vertical: gateway.client.vertical,
    publicReviewUrl: gateway.publicReviewUrl,
  };
}

export type SubmissionRow = {
  text: string;
  stars: number | null;
  reviewDate: Date | null;
  source: string;
  fingerprint: string;
  dimensionsJson: string;
  signalsJson: string;
  redacted: boolean;
  redactionsJson: string;
  textWindowMs: number;
  ratingOnlyWindowMs: number;
  now: Date;
};

/**
 * Stores one customer submission through the public boundary.
 *
 * The token goes in; no client id does. The function resolves the business
 * itself, so there is no parameter here through which a submission could be
 * aimed at another tenant — and a token it does not recognise writes nothing
 * and returns null.
 */
export async function writeSubmissionAsPublic(
  db: PrismaClient,
  token: string,
  row: SubmissionRow,
): Promise<{ id: string; duplicate: boolean } | null> {
  // Every argument is cast where it is passed. The driver decides on its own
  // how to type a JavaScript number or a null — a plain number arrives as a
  // 64-bit integer, and PostgreSQL will not implicitly narrow that when it
  // resolves which function is being called. Saying the type here means the
  // call cannot start failing because a value happened to be null, or because
  // a driver release changed its mind.
  const rows = await db.$queryRaw<{ item_id: string; was_duplicate: boolean }[]>`
    SELECT * FROM app.public_submit(
      ${token}::text,
      ${row.text}::text,
      ${row.stars}::integer,
      ${row.reviewDate ? row.reviewDate.toISOString() : ''}::text,
      ${row.source}::text,
      ${row.fingerprint}::text,
      ${row.dimensionsJson}::text,
      ${row.signalsJson}::text,
      ${row.redacted}::boolean,
      ${row.redactionsJson}::text,
      ${row.textWindowMs}::integer,
      ${row.ratingOnlyWindowMs}::integer,
      ${row.now.toISOString()}::text
    )`;
  const result = rows[0];
  return result ? { id: result.item_id, duplicate: result.was_duplicate } : null;
}
