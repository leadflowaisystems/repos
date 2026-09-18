'use client';

import { useRouter } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';
import { Link } from '@/components/portal/link';
import { placeOf, upIntent, type HistoryView, type NavIntent } from '@/lib/portal/nav-intent';

/**
 * THE BROWSER'S OWN HISTORY, READ — never replaced (mobile back-navigation pass).
 *
 * See `lib/portal/nav-intent.ts` for the rules. This file is the part that
 * touches the browser: it reads history through the Navigation API where the
 * browser has one, and carries out an intent with the calls Next.js and the
 * browser already provide — `router.push`, `router.replace` and
 * `history.go`. There is no second history kept anywhere, so Back, Forward,
 * Android's back gesture and an iPhone's edge swipe all keep doing exactly
 * what they do on every other site; they just find the right entries.
 */

type NavEntry = { url: string | null; index: number };
type NavigationLike = { entries: () => NavEntry[]; currentEntry: NavEntry | null };

/** This tab's same-origin history, oldest first — or null where the browser will not say. */
export function readHistory(): HistoryView {
  if (typeof window === 'undefined') return null;
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  if (!nav || typeof nav.entries !== 'function' || !nav.currentEntry) return null;
  try {
    const entries = nav.entries();
    const index = entries.findIndex((entry) => entry.index === nav.currentEntry?.index);
    if (index < 0) return null;
    return { entries: entries.map((entry) => (entry.url ? placeOf(entry.url) : '')), index };
  } catch {
    return null;
  }
}

/** A click the browser should handle itself: a new tab, a new window, a download. */
export function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/** Scroll to the top, instantly for anyone who has asked for less motion. */
export function scrollToTop(): void {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
}

/**
 * Carries out an intent the link itself cannot: staying put, or going back.
 * Returns true when it handled the click, so the caller stops the link.
 */
export function followIntent(
  intent: NavIntent,
  href: string,
  router: ReturnType<typeof useRouter>,
  linkReplaces: boolean,
): boolean {
  switch (intent.kind) {
    case 'STAY':
      scrollToTop();
      return true;
    case 'TRAVERSE':
      window.history.go(intent.delta);
      return true;
    case 'REPLACE':
      if (linkReplaces) return false;
      router.replace(href);
      return true;
    case 'PUSH':
      if (!linkReplaces) return false;
      router.push(href);
      return true;
  }
}

/**
 * "← Waiting time", "← Feedback", a topic an entry is filed under — up to
 * a page this one belongs to.
 *
 * When that page is the entry right behind this one, the link IS Back: it
 * steps back through history, so the next Back after it goes where the owner
 * expects rather than to the page they just left. Otherwise it replaces this
 * entry with the parent. Without JavaScript, or where the browser cannot show
 * its history, it is an ordinary link.
 */
export function UpLink({
  href,
  basePath,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & { href: string; basePath: string }) {
  const router = useRouter();
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        if (isModifiedClick(event)) return;
        const intent = upIntent({ parent: href, basePath, history: readHistory() });
        if (followIntent(intent, href, router, false)) event.preventDefault();
      }}
    />
  );
}
