import type { Metadata } from 'next';
import Link from 'next/link';
import { HeadwayWordmark } from '@/components/brand';
import { safeNextPath } from '@/lib/auth/redirect';
import { ConfirmLinkButton } from '@/components/forms/confirm-link-button';

export const dynamic = 'force-dynamic';

// `same-origin`, not the site's usual `no-referrer`: under no-referrer a
// browser sends this page's form with `Origin: null`, and the callback takes
// the form only from this site. Same-origin still sends nothing to any other
// site (next.config.ts sets the same header for this path).
export const metadata: Metadata = { title: 'Continue · Headway', referrer: 'same-origin' };

/**
 * ONE BUTTON BETWEEN AN EMAILED LINK AND WHAT IT DOES (M53).
 *
 * Every link Supabase emails works once. Mail scanners and chat-app previews
 * open links before the person does, so the callback no longer spends the
 * token when a link is merely opened: it sends the browser here, and the
 * token is spent only when this button posts it back (`POST /auth/callback`).
 * Plain HTML — no script needed, so it works on any phone browser.
 *
 * The token is never shown and never logged; it rides in a hidden field, and
 * this page's address is passed on to nothing outside Headway.
 *
 * Pressed once: a second press would spend nothing (the token is already
 * gone) and only say "expired", so the button turns itself off after the
 * first one — without needing script to work at all.
 */

const COPY = {
  recovery: {
    title: 'Reset your password',
    body: 'Press the button to choose a new password.',
    button: 'Choose a new password',
  },
  signup: {
    title: 'Confirm your email',
    body: 'Press the button to confirm your email address.',
    button: 'Confirm my email',
  },
  email_change: {
    title: 'Confirm your email',
    body: 'Press the button to confirm your new email address.',
    button: 'Confirm my email',
  },
} as const;

type LinkType = keyof typeof COPY;

function one(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export default async function ConfirmLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const tokenHash = one(query.token_hash);
  const rawType = one(query.type);
  const type = rawType && Object.hasOwn(COPY, rawType) ? (rawType as LinkType) : null;
  const next = safeNextPath(one(query.next));

  if (!tokenHash || !type) {
    return (
      <main>
        <HeadwayWordmark className="mb-8" />
        <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
          That link is not complete
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
          Open the link from the email again, exactly as it arrived.
        </p>
        <p className="mt-6 text-[14px] text-ink-600">
          <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
            Go to sign in
          </Link>
        </p>
      </main>
    );
  }

  const copy = COPY[type];
  return (
    <main>
      <HeadwayWordmark className="mb-8" />
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">{copy.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{copy.body}</p>
      <ConfirmLinkButton label={copy.button}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
      </ConfirmLinkButton>
    </main>
  );
}
