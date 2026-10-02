import type { supabaseServerClient } from '@/lib/auth/supabase';

/**
 * WAS THIS SESSION OPENED BY AN EMAILED LINK, RECENTLY? (M52)
 *
 * The same rule Supabase itself uses for a "recovery session" (GoTrue's
 * `Session.IsRecovery`: an `otp`, `magiclink` or `recovery` sign-in), plus an
 * hour's limit. It is what keeps `/reset-password` from being a way to set a
 * new password from any ordinary signed-in browser without knowing the
 * current one — that is what Account's "Change password" is for. Used by the
 * reset page (to show the form or not) and its action (to accept it or not),
 * so the two cannot disagree.
 */

const RECOVERY_WINDOW_SECONDS = 60 * 60;

export async function isRecoverySession(
  supabase: Awaited<ReturnType<typeof supabaseServerClient>>,
): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  const amr: unknown = data?.claims?.amr;
  if (!Array.isArray(amr)) return false;
  const now = Date.now() / 1000;
  return amr.some((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    return (
      (method === 'recovery' || method === 'otp' || method === 'magiclink') &&
      typeof timestamp === 'number' &&
      now - timestamp < RECOVERY_WINDOW_SECONDS
    );
  });
}
