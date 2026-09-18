'use client';

import { BriefSkeleton } from '@/components/workspace/skeleton';

/**
 * What the business owner sees while their workspace is still loading.
 *
 * Without this file Next.js keeps the PREVIOUS page on screen, at the previous
 * URL, until the new one has finished rendering — so a click on a slow page
 * looks like a click that did nothing. That is not a theory: it is exactly how
 * a successful portal-token rotation appeared to fail, because the redirect was
 * still in flight and nothing on screen had changed.
 *
 * A skeleton is not decoration here. It is the acknowledgement.
 *
 * The one line of text is read aloud rather than seen, and it is translated
 * like everything else. It is read from the provider the workspace shell has
 * already filled, so this still renders in one pass with nothing to wait for —
 * a fallback that had to fetch its own words would defeat the whole file.
 */
export default function Loading() {
  // The shell is not there yet on the way in, so the skeleton draws the bar.
  return <BriefSkeleton withBar />;
}
