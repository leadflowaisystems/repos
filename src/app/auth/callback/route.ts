import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { supabaseServerClient } from '@/lib/auth/supabase';
import { provisionUser } from '@/lib/tenancy/service';
import { landingPathFor } from '@/lib/onboarding/service';
import { safeNextPath } from '@/lib/auth/redirect';
import { loadActor } from '@/lib/tenancy/service';

/**
 * THE AUTH CALLBACK (M20 Stage 8A).
 *
 * Every link Supabase emails — confirm your address, reset your password —
 * comes back here carrying a one-time `code`. That code is not a session: it
 * has to be exchanged for one, and until M20 Stage 8A nothing in RepOS did
 * that. The links landed on a page that ignored the parameter, so a confirmed
 * account arrived signed out and a password reset could never complete.
 *
 * Two things this route is careful about.
 *
 * IT DOES NOT TRUST `next`. The parameter decides where somebody lands after
 * signing in, which is exactly the shape of an open redirect. Only a same-site
 * path is honoured — no scheme, no host, no protocol-relative `//evil.com`.
 *
 * IT PROVISIONS ON THE WAY THROUGH. A confirmation link is often the first
 * time an identity is genuinely usable, and the RepOS row behind it may not
 * exist yet. Provisioning here uses the same `provisionUser` every other entry
 * point uses — it cannot set `isPlatformAdmin`, and the database would refuse
 * it if it tried.
 */

/**
 * Only same-site paths. Anything else falls back to the caller's own home.
 *
 * The rule itself now lives in `@/lib/auth/redirect`, because there were three
 * copies of it and all three shared the same two holes — a leading backslash,
 * and a tab or newline the URL parser deletes before parsing. One
 * implementation, one set of adversarial tests, three call sites.
 */
export function safeNext(raw: string | null): string | null {
  return safeNextPath(raw);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  // Supabase reports a refused or expired link this way rather than by
  // omitting the code. Say the same thing for every failure.
  const failed = searchParams.get('error') ?? searchParams.get('error_description');

  if (!code || failed) {
    return NextResponse.redirect(new URL('/login?expired=1', origin));
  }

  const supabase = await supabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    return NextResponse.redirect(new URL('/login?expired=1', origin));
  }

  await provisionUser(prisma, {
    providerId: data.user.id,
    email: data.user.email,
  });

  // A recovery link asks for /reset-password and must go there even though the
  // person now holds a session. Otherwise send them where their memberships say.
  if (next) return NextResponse.redirect(new URL(next, origin));

  const actor = await loadActor(prisma, data.user.id);
  return NextResponse.redirect(new URL(actor ? landingPathFor(actor) : '/onboarding', origin));
}
