import { PrismaClient } from '@prisma/client';
import { cache } from 'react';
import { supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';

/**
 * THE DATABASE HANDLE, AND THE IDENTITY EVERY QUERY CARRIES (M20 Stage 10B).
 *
 * RepOS runs as a database role that CANNOT bypass Row Level Security. Every
 * policy decides what a query may see by reading `app.user_id`, so a query
 * that arrives without one sees nothing at all. That is the point: the failure
 * mode is an empty result, never someone else's data.
 *
 * WHERE THE IDENTITY COMES FROM. `supabase.auth.getUser()` — the session
 * cookie re-verified with the auth server on every request. Never a URL
 * parameter, a form field, a hidden input, a header, the Host, or anything
 * else a browser can set. There is no code path here that accepts an identity
 * as an argument, so there is nothing to forge.
 *
 * WHICH IDENTITY, EXACTLY. Two identifiers name the same person here, and
 * confusing them fails silently rather than loudly. Supabase Auth issues a
 * UUID; RepOS's own `User.id` is a cuid; `User.authProviderId` holds the UUID
 * so the two can be mapped. Every RLS policy compares against `User.id` —
 * `id = app.current_user_id()`, `m."userId" = app.current_user_id()` — so the
 * cuid is the canonical identity, and the UUID is resolved to it before it
 * ever reaches the database. Sending the UUID instead does not error: the
 * policies simply match no row, every query returns nothing, and the
 * application looks broken rather than insecure. That is the state this file
 * shipped in until the mistake was caught, before the runtime moved to a role
 * that cannot bypass the policies.
 *
 * HOW IT REACHES POSTGRES. Every model operation is wrapped in a transaction
 * whose first statement is `set_config('app.user_id', ..., TRUE)`. The `TRUE`
 * makes it transaction-local: it exists for exactly the queries inside that
 * transaction and is gone before the pooled connection serves anyone else.
 * A session-level `SET` would have leaked identity between unrelated requests,
 * which on a shared pooler is the whole disaster this exists to avoid.
 *
 * WHY AN EXTENSION AND NOT 56 EDITED CALL SITES. Services take their client as
 * an argument and pass it down; wrapping the exported client means a nested
 * call four levels deep is carrying the same context as the one that started
 * it, without a single service knowing this file exists. Proven, not assumed:
 * an outer service calling an inner one returns its own tenant's rows for an
 * owner, everything for an admin, and nothing for a forged or absent identity.
 *
 * THE ONE GAP, HANDLED ELSEWHERE. An explicit `db.$transaction(async tx => …)`
 * hands back a raw transaction client that does not pass through here. Three
 * such sites exist and each sets the context itself as its first statement —
 * see `withRlsContext`. They fail closed if that is ever forgotten: the
 * queries return nothing rather than everything.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaBase: PrismaClient | undefined;
};

const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

/**
 * The authenticated Supabase user id for this request, or null.
 *
 * `cache()` memoises it per request, so a page issuing thirty queries verifies
 * the session once rather than thirty times. Anything unexpected — no session,
 * no configuration, called outside a request — returns null, and null means
 * the policies show nothing.
 */
export const currentAuthUserId = cache(async (): Promise<string | null> => {
  try {
    if (!supabaseConfig().ok) return null;
    const supabase = await supabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    // Outside a request context (module init, a script) there is no session to
    // read. No identity is the safe answer, not an exception.
    return null;
  }
});

/**
 * Which mechanism resolves the UUID, decided once per process.
 *
 * `app.user_id_for_auth` is a SECURITY DEFINER function, and it exists because
 * the policies would otherwise ask a request to know who it is before it can
 * find out who it is: reading `User` is gated on an identity not yet resolved.
 * The function steps outside that circle for one row.
 *
 * The direct read is the same lookup without the function, and it is here only
 * for the window before that DDL is applied — while the runtime is still the
 * owner role, which bypasses RLS and can read `User` unaided. Once the runtime
 * is `repos_app` the direct read returns nothing, because the very policy this
 * resolution exists to satisfy is the one blocking it. That is a blank
 * application rather than an open one — safe, but still a failure. The
 * function has to be in place before the cutover.
 */
let resolution: 'definer' | 'direct' | undefined;

/**
 * A verified Supabase user id, in RepOS's own terms.
 *
 * Deliberately NOT routed through the extended client: that would set the very
 * context this call exists to work out. `base` issues one plain statement.
 */
async function resolveInternalUserId(authId: string): Promise<string | null> {
  if (resolution !== 'direct') {
    try {
      const rows = await base.$queryRaw<{ id: string | null }[]>`
        SELECT app.user_id_for_auth(${authId}) AS id`;
      resolution = 'definer';
      return rows[0]?.id ?? null;
    } catch (error) {
      // 42883 is "no such function". Anything else — a dropped connection, a
      // permission error — is a real failure, and must not be quietly
      // reinterpreted as "fall back and carry on".
      if (!String(error).includes('42883')) throw error;
      resolution = 'direct';
    }
  }

  // Unqualified on purpose: the schema comes from the connection string, the
  // way it does for every other query this client makes. Hardcoding `public.`
  // would be right in production and wrong everywhere else, which is a bug that
  // only shows up somewhere it is inconvenient to find. The definer function
  // above is the opposite case and pins its search_path, because SECURITY
  // DEFINER means an unqualified name there would be the caller's to choose.
  const rows = await base.$queryRaw<{ id: string }[]>`
    SELECT u.id FROM "User" u
    WHERE u."authProviderId" = ${authId} AND u.status = 'ACTIVE'`;
  return rows[0]?.id ?? null;
}

/**
 * The identity every policy is actually written against: `public.User.id`.
 *
 * Null for a signed-out request, for a UUID matching no account, and for an
 * account that is not ACTIVE — so a suspension removes access at the database
 * rather than only in the pages that remember to check. `cache()` keeps it to
 * one resolution per request.
 */
export const currentUserId = cache(async (): Promise<string | null> => {
  const authId = await currentAuthUserId();
  if (!authId) return null;
  try {
    return await resolveInternalUserId(authId);
  } catch {
    // No identity is the safe answer; the policies then show nothing.
    return null;
  }
});

/**
 * "That function is not in this database."
 *
 * The narrow SECURITY DEFINER functions live in `prisma/m20/rls.sql`, which is
 * applied to production by hand and is deliberately absent from the throwaway
 * schemas the test suite creates. Every caller of one therefore keeps a direct
 * fallback for the un-applied case, and this is what decides between them.
 *
 * 42883 is "no such function". 3F000 is "no such schema", which is what a
 * database that has never seen `rls.sql` at all answers instead. Anything else
 * — a dropped connection, a permission error, or an exception the function
 * itself raised on purpose — is a real failure and must reach the caller rather
 * than being quietly reinterpreted as "try the other way". That distinction is
 * the whole point: a fallback that swallows too much would turn a refusal into
 * a retry with weaker checks, which is exactly the wrong direction.
 */
export function isMissingDbFunction(error: unknown): boolean {
  const text = String(error);
  return text.includes('42883') || text.includes('3F000');
}

/** The statement every protected query runs behind. */
export function setContextSql(userId: string | null) {
  return base.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ''}, TRUE)`;
}

function build() {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const userId = await currentUserId();
          const [, result] = await base.$transaction([setContextSql(userId), query(args)]);
          return result as unknown;
        },
      },
    },
  });
}

/**
 * Exported as `PrismaClient` so the fifty-six services that declare
 * `db: PrismaClient` keep compiling untouched.
 *
 * The cast is narrow and checked: an extended client differs only by dropping
 * `$on`, `$use`, `$extends`, `$connect` and `$disconnect` from its type. None
 * of those is called anywhere in `src/` — verified, not assumed — and every
 * model delegate this application actually uses is present and behaves
 * identically, with the identity wrapper in front of it.
 */
export const prisma = (globalForPrisma.prisma ?? build()) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaBase = base;
}

/**
 * An explicit multi-statement transaction that still carries the identity.
 *
 * Prisma hands the callback a raw transaction client which does not pass
 * through the extension, so the context is set here as the first statement
 * inside the same transaction. Use this instead of `db.$transaction` anywhere
 * several writes must succeed or fail together.
 */
export async function withRlsContext<T>(
  db: PrismaClient,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  const userId = await currentUserId();
  return transactionHandle(db).$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ''}, TRUE)`;
    return fn(tx);
  });
}

/**
 * Which client an interactive transaction may be opened on.
 *
 * The comment above about `$transaction` handing back a raw client was true of
 * the client it was written about and false of the one it was called on. Opened
 * on the EXTENDED client, the `tx` handed to the callback is extended too, so
 * every model operation inside it re-enters `$allOperations` — which starts a
 * fresh `base.$transaction` of its own, on its own connection.
 *
 * The result was a helper named for a transaction that was not one. Each
 * statement committed separately, on a different connection from the one the
 * `set_config` had been issued to. Nothing failed loudly: the identity was
 * still right, because the extension sets the context itself, and none of the
 * three existing callers happened to read back a row it had just written. The
 * one that finally did — creating a business and then filling in the rest of
 * its columns — got "no record was found for an update", because the row was
 * sitting uncommitted on a connection the update could not see.
 *
 * So the transaction is opened on the unwrapped client. The `tx` inside is then
 * genuinely raw, every statement lands on one connection, and the `set_config`
 * at the top governs all of them — which is exactly what the helper always
 * claimed to do. The caller's own handle is still honoured for anything that is
 * not the module singleton: services are given their client as an argument, the
 * test suite hands them a throwaway database, and a helper that quietly reached
 * for the global instead would send those writes somewhere real.
 */
function transactionHandle(db: PrismaClient): PrismaClient {
  return (db as unknown) === (prisma as unknown) ? base : db;
}
