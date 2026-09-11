import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/**
 * A LINK INSIDE THE BUSINESS WORKSPACE.
 *
 * `next/link` with one difference: it never prefetches. Every address in the
 * workspace is a per-business dynamic route, and Next.js asks the server to
 * start on a link's destination as soon as the link is on screen. Measured on
 * a production build: opening one page fired eight prefetch requests, one per
 * tab, each passing through the middleware's session check for a response of
 * about 230 bytes — and once the workspace gained a loading boundary, every
 * per-business link on the page would have done the same, ten or more on the
 * Customers board alone. That is the same fault the operator console fixed in
 * M20 (`tests/m20.prefetch.test.ts`), arriving through another door.
 *
 * So the rule is a component rather than a prop to remember: the workspace
 * tree imports THIS `Link`, and `tests/perf.workspace-navigation.test.ts`
 * fails the moment a file in it reaches for `next/link` directly. Clicking is
 * unaffected — the page is fetched on the click, the loading boundary shows at
 * once, and the tab shows it was pressed (see `WorkspaceHeader`).
 *
 * A caller can still opt a single link in with `prefetch` after the spread;
 * none does, and the test above says so.
 */
export function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
