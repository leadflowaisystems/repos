'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useTransition } from 'react';

/**
 * KEEPS A PAGE FROM SHOWING YESTERDAY'S READING (freshness pass).
 *
 * Every workspace page is rendered fresh on the server when it is opened, so
 * the only ways to be looking at an old reading are the three this component
 * handles — and each one ends in the same ordinary call, `router.refresh()`,
 * which asks the server for this page again and swaps it in without a loading
 * screen, a flash or a lost scroll position:
 *
 *   BACK / FORWARD   The browser restores a page from Next's router cache
 *                    rather than asking the server. If the copy it restored is
 *                    more than a few seconds old, it is refreshed once.
 *   RETURNING        The owner comes back to the tab or the app after a while
 *                    away. Refreshed once, on the way back in.
 *   READING          Feedback has arrived and Headway is reading it right now.
 *                    The page looks again a handful of times, further apart
 *                    each time, so "Headway is reading them" becomes "Headway
 *                    just read 3" when it is true — and stops looking after
 *                    about a minute and a half either way. Nothing polls while
 *                    nothing is waiting, and nothing polls in a hidden tab.
 *
 * NOT REAL TIME, and the page never says it is. There is no socket and no
 * subscription: the database is asked only when one of the three conditions
 * above is true, and each ask is one ordinary page request that reads the
 * request-cached ledger once, exactly like opening the page.
 *
 * `stamp` identifies ONE server render. The first time this component sees a
 * stamp it notes when; seeing the same stamp again later means the browser
 * restored that render from its cache. Time is measured on the phone's own
 * clock at both ends, so a phone whose clock disagrees with the server's
 * cannot trigger a refresh.
 *
 * AT MOST ONE REFRESH PER RENDER. Whatever asks — a restore, a return, a look
 * while reading — a given render is refreshed once. A successful refresh
 * brings a new render and a new stamp; a failed one (a phone that has lost
 * its signal) leaves the stamp as it was, so nothing retries in a loop.
 */

/** A restored copy older than this is refreshed. Short: returning should show now. */
export const RESTORE_STALE_MS = 10_000;
/** Back in the tab after longer than this, refresh. */
export const RETURN_STALE_MS = 60_000;
/** While reading: when to look again, measured from the last look. Five looks, then stop. */
export const READING_LOOKS_MS = [3_000, 6_000, 12_000, 24_000, 45_000] as const;

/** When each render was first seen on this device. Pruned so it stays small. */
const firstSeen = new Map<string, number>();
const KEEP = 40;

function remember(stamp: string, at: number) {
  firstSeen.set(stamp, at);
  if (firstSeen.size > KEEP) {
    const oldest = firstSeen.keys().next().value;
    if (oldest !== undefined) firstSeen.delete(oldest);
  }
}

export function LiveRefresh({ stamp, reading = false }: { stamp: string; reading?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const looks = useRef(0);
  const refreshedFor = useRef<string | null>(null);

  const refresh = useCallback(
    (forStamp: string) => {
      if (refreshedFor.current === forStamp) return;
      refreshedFor.current = forStamp;
      startTransition(() => router.refresh());
    },
    [router],
  );

  // Back / Forward: the same render, seen again, after a while.
  useEffect(() => {
    const seen = firstSeen.get(stamp);
    if (seen === undefined) {
      remember(stamp, Date.now());
      return;
    }
    if (Date.now() - seen > RESTORE_STALE_MS) refresh(stamp);
  }, [stamp, refresh]);

  // Returning to the tab, or to a page the browser froze and thawed.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const seen = firstSeen.get(stamp) ?? 0;
      if (reading || Date.now() - seen > RETURN_STALE_MS) refresh(stamp);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refresh(stamp);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [stamp, reading, refresh]);

  // Reading: look again, a few times, further apart each time.
  useEffect(() => {
    if (!reading) {
      looks.current = 0;
      return;
    }
    const delay = READING_LOOKS_MS[looks.current];
    if (delay === undefined) return;
    const timer = window.setTimeout(() => {
      // A hidden tab waits; the visibility handler above looks when it returns.
      if (document.visibilityState !== 'visible') return;
      looks.current += 1;
      refresh(stamp);
    }, delay);
    return () => window.clearTimeout(timer);
    // `stamp` is here on purpose: each look produces a new render, and the
    // next look is scheduled from it.
  }, [reading, stamp, refresh]);

  return null;
}
