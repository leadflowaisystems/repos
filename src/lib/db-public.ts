import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isProduction } from '@/lib/config/public-url';

/**
 * THE ANONYMOUS DATABASE HANDLE (M20 Stage 10B).
 *
 * Everything else in RepOS talks to the database as `repos_app`, carrying the
 * signed-in person's identity so Row Level Security can decide what they may
 * see. A customer scanning a QR code has no account and no identity, so those
 * policies correctly show them nothing — including the one page they are
 * entitled to use.
 *
 * The fix is not to weaken a policy. It is a second, far smaller role. This
 * client connects as `repos_public`, which holds NO privilege on any table:
 * not SELECT, not INSERT, not on FeedbackGateway, not on Client. It may call
 * exactly two functions, `app.public_gateway` and `app.public_submit`, each of
 * which takes the customer's token, resolves the business from that token
 * itself, and returns one projection. There is no argument through which a
 * caller can name a business, so a stolen or guessed token reaches one
 * gateway or none — never a list, and never someone else's.
 *
 * Consequently a compromise of this connection string yields a stranger the
 * ability to submit feedback to a gateway whose token they already had. It
 * does not yield them a single row of anyone's data.
 *
 * NEVER import this from a client component. It is server-only, like every
 * database handle here, and the connection string is a secret.
 */

const globalForPublic = globalThis as unknown as { publicPrisma: PrismaClient | undefined };

/**
 * Which clients speak through the public boundary.
 *
 * THE MARK TRAVELS ON THE CLIENT, AND IT HAS TO.
 *
 * This was a module-local `WeakSet`, which is correct in a single module
 * instance and wrong the moment there are two. Next bundles this file into
 * more than one server chunk — the page and the server action are separate —
 * and the client itself is shared between them through `globalThis`. So one
 * chunk built the client and recorded it in ITS set, published it globally,
 * and the other chunk then received a handle its own set had never seen.
 * `isPublicClient` answered false, `readGateway` took the ordinary Prisma
 * branch, and `repos_public` — which holds no table privileges, exactly as
 * intended — refused it with `42501 permission denied for table
 * FeedbackGateway`. The customer saw "Something went wrong."
 *
 * `Symbol.for` resolves through the runtime-wide symbol registry, so every
 * copy of this module looks up the same symbol, and the property lives on the
 * client object itself. A handle therefore carries its own answer wherever it
 * is passed, across chunk boundaries and through `globalThis` alike.
 *
 * Still not a guess made by reading the connection string: the answer is
 * written once, here, where the client is built.
 */
const PUBLIC_CLIENT_MARK = Symbol.for('repos.db-public.privilegeless-client');

export function markPublicClient<T extends object>(client: T): T {
  Object.defineProperty(client, PUBLIC_CLIENT_MARK, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return client;
}

/** True when this handle reaches the database as the privilege-less role. */
export function isPublicClient(client: unknown): boolean {
  return (
    typeof client === 'object' &&
    client !== null &&
    (client as Record<symbol, unknown>)[PUBLIC_CLIENT_MARK] === true
  );
}

export const PUBLIC_DATABASE_URL_VAR = 'PUBLIC_DATABASE_URL';

export type PublicDbConfig =
  | { ok: true; url: string }
  /** Development and test only: one role owns everything, so there is no second one. */
  | { ok: true; url: null }
  | { ok: false; reason: string };

/**
 * Whether this installation has an anonymous connection, and whether it needs one.
 *
 * Pure, and takes its environment as an argument, so the production branch can
 * be tested without a database and without mutating `process.env` — the same
 * shape as `checkPublicBaseUrl` next door, for the same reason.
 */
export function publicDbConfig(env: NodeJS.ProcessEnv = process.env): PublicDbConfig {
  const url = (env[PUBLIC_DATABASE_URL_VAR] ?? '').trim();
  if (url.length > 0) return { ok: true, url };

  if (isProduction(env)) {
    return {
      ok: false,
      reason:
        `${PUBLIC_DATABASE_URL_VAR} is not set. The customer feedback page must reach the ` +
        'database as its own privilege-less role (repos_public — see ' +
        'prisma/m20/public-gateway.sql). Set it to that connection string and restart.',
    };
  }

  return { ok: true, url: null };
}

/**
 * THIS USED TO FAIL OPEN, AND THAT IS THE WHOLE POINT OF THE REWRITE.
 *
 * It was `if (!url) return prisma;` — with no dedicated connection, the
 * anonymous feedback page silently got the ORDINARY application client. That is
 * not a degraded mode, it is a different security model. The fork downstream is
 * `isPublicClient()`, and the fallback client was never marked, so every
 * consumer quietly took the other branch: `readGateway` stopped calling
 * `app.public_gateway(token)` and ran a plain `findUnique`, and
 * `submitCustomerFeedback` stopped calling `app.public_submit(...)` and wrote
 * with a tenant id the application had derived for itself — which is exactly the
 * property the SQL boundary exists to remove.
 *
 * The old comment argued this was safe because RLS would show an anonymous
 * request nothing anyway. That is true only while the runtime is a role that
 * cannot bypass RLS. It is a strong argument for why the fallback was not a
 * disaster; it is not an argument for keeping it, because it makes the safety of
 * the anonymous path depend on a fact established somewhere else entirely.
 *
 * And the failure it produced was the wrong shape. `.env.example` ships the
 * variable empty, so an operator who fills in the two documented database URLs
 * lands in the fallback by default — with every operator screen healthy and
 * every printed QR code pointing at a page whose boundary is gone. Nothing
 * logged, nothing warned, nothing failed.
 *
 * So: in production, no connection is a refusal. The anonymous pages are server
 * components, so the throw becomes an error page for the visitor (RepOS's
 * `global-error` shows no message, digest or stack) and the reason in the server
 * log for the operator. Deliberately NOT `notFound()` — a 404 is what a retired
 * gateway looks like, and hiding a total outage behind a message operators are
 * trained to ignore is how this went unnoticed in the first place.
 *
 * Outside production the fallback stays, because there one role genuinely does
 * own everything — but it now says so out loud instead of pretending.
 */
function build(): PrismaClient {
  const config = publicDbConfig();
  if (!config.ok) throw new Error(config.reason);

  if (config.url === null) {
    console.warn(
      `[db-public] ${PUBLIC_DATABASE_URL_VAR} is not set, so the feedback gateway is using the ` +
        'application client. Development and test only — production refuses to start it.',
    );
    return prisma;
  }

  return markPublicClient(
    new PrismaClient({ datasources: { db: { url: config.url } }, log: ['error'] }),
  );
}

/**
 * The anonymous handle, built on first use rather than on import.
 *
 * Laziness is what keeps the blast radius right. Built at import time, a
 * misconfigured production deployment would throw while some unrelated module
 * was being loaded, taking down the operator console too and burying the reason.
 * Built here, exactly the pages that need the boundary fail, loudly, and the
 * operator still has a working console to read the error from.
 */
export function publicDb(): PrismaClient {
  globalForPublic.publicPrisma ??= build();
  return globalForPublic.publicPrisma;
}
