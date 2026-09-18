'use client';

import { BriefSkeleton } from '@/components/workspace/skeleton';

/**
 * What an owner sees between pressing a tab and the page arriving.
 *
 * The workspace already had a loading state one level up, in
 * `src/app/(workspace)/loading.tsx` — and it did its job exactly once: on the
 * way IN, when the whole workspace, header and all, was still being rendered.
 * It never showed again, because moving between Home and Feedback does not
 * re-render the workspace shell; only the page under the header changes, and
 * the boundary that covers THAT slot is the one in this folder, which did not
 * exist. So a tap on a tab kept the previous page on screen, untouched, until
 * the next one had finished rendering on the server. Locally that is eighty
 * milliseconds and invisible. On a phone, through a real connection, it was
 * the "nothing happened" that made people tap again.
 *
 * This boundary is what makes a tab answer at once. The header, the
 * navigation and the footer stay where they are; the page's place shows the
 * same calm skeleton the outer boundary uses, and the page streams in over it.
 * Same words, same shapes, same rule about the one line that is read aloud.
 *
 * Adding a loading boundary also changes what `<Link>` prefetches — see
 * `src/components/portal/link.tsx` for why every link in this tree is one
 * that does not.
 */
export default function Loading() {
  return <BriefSkeleton />;
}
