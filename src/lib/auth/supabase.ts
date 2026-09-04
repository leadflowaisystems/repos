import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * SUPABASE AUTH — the one place RepOS talks to an identity provider (M20).
 *
 * Supabase Auth is the single canonical identity system. RepOS does not hash,
 * store or compare a password anywhere: it holds a User row, the id of the
 * Supabase identity behind it, and the memberships that say what that person
 * may reach. There is no second sign-in path to keep in step.
 *
 * SERVER ONLY, and deliberately so. Supabase is normally wired up with a
 * browser client and a pair of NEXT_PUBLIC_ variables, but RepOS has never
 * defined a NEXT_PUBLIC_ variable in its life — a compliance test has asserted
 * that since M1 — and it does not start now. Every sign-in, sign-up and
 * recovery call runs inside a server action, which is where the rest of this
 * application's data access already lives. The browser gets a session cookie
 * and nothing else: no project URL, no anon key, no SDK.
 *
 * The service-role key is never read here at all, so no import chain from a
 * client component can reach it.
 */

export const SUPABASE_URL_VAR = 'SUPABASE_URL';
export const SUPABASE_ANON_KEY_VAR = 'SUPABASE_ANON_KEY';

export type SupabaseConfig = { url: string; anonKey: string };

/**
 * Reads the configuration, or says why it cannot.
 *
 * Returns a reason rather than throwing so a page can render an honest
 * "sign-in is not configured yet" state instead of a stack trace.
 */
export function supabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; config: SupabaseConfig } | { ok: false; reason: string } {
  const url = (env[SUPABASE_URL_VAR] ?? '').trim();
  const anonKey = (env[SUPABASE_ANON_KEY_VAR] ?? '').trim();
  if (!url || !anonKey) {
    return {
      ok: false,
      reason: `Set ${SUPABASE_URL_VAR} and ${SUPABASE_ANON_KEY_VAR} in .env.local.`,
    };
  }
  try {
    // A malformed URL would otherwise surface as a fetch failure deep inside
    // the SDK on someone's first sign-in attempt.
    void new URL(url);
  } catch {
    return { ok: false, reason: `${SUPABASE_URL_VAR} is not a valid URL.` };
  }
  return { ok: true, config: { url, anonKey } };
}

export function isSupabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return supabaseConfig(env).ok;
}

/**
 * The Supabase client for this request.
 *
 * Sessions live in cookies that Supabase manages; this wires its cookie reads
 * and writes to Next's own store. Writing is wrapped because a Server
 * Component may not set cookies — in that context a refreshed token is simply
 * not persisted, and the next server action writes it instead.
 */
export async function supabaseServerClient() {
  const config = supabaseConfig();
  if (!config.ok) throw new Error(config.reason);
  const store = await cookies();

  return createServerClient(config.config.url, config.config.anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Component render: nothing to do, and nothing broken.
        }
      },
    },
  });
}
