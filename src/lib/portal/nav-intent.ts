/**
 * WHAT A TAP DOES TO THE BROWSER'S HISTORY (mobile back-navigation pass).
 *
 * On a phone, Back is the most used control in the app, and it is not ours:
 * it is the browser's, or Android's, or a swipe from the left edge on an
 * iPhone. All three walk the same thing — the browser's real history — so
 * the only way to make Back feel like it is moving inside Headway is to put
 * the right entries in that history in the first place. Nothing here
 * intercepts Back, and nothing ever pushes an entry to stop someone leaving.
 *
 * The rule, in one line each:
 *
 *   GOING DEEPER    (a topic, one entry, one change)  → a new entry
 *   SWITCHING DOORS (Feedback ↔ Improvements ↔ More)   → replace, don't pile up
 *   GOING HOME      (or up to a page already behind)  → go BACK to that entry
 *   THE SAME DOOR   (tapped again)                     → nothing; scroll to top
 *
 * So Home → Feedback → a topic → one entry leaves four entries, and three
 * Backs return through them to Home; a fourth leaves Headway the way the owner
 * came in. Ten taps between the doors still leave one entry above Home, not
 * ten.
 *
 * PURE. The history is handed in as a list of addresses, which in a browser
 * comes from the Navigation API (`navigation.entries()`). Where that API does
 * not exist the list is null, and every rule falls back to what an ordinary
 * link does — a push — because a guess about history we cannot see is worse
 * than a normal link.
 */

export type NavIntent =
  /** Already there: no history change at all. */
  | { kind: 'STAY' }
  /** The destination is already in history, `delta` entries back (negative). */
  | { kind: 'TRAVERSE'; delta: number }
  | { kind: 'PUSH' }
  | { kind: 'REPLACE' };

/** What history looks like from here, when the browser will say. */
export type HistoryView = {
  /** Same-origin entries, oldest first, as path + query (no origin, no hash). */
  entries: string[];
  /** Where the current entry sits in `entries`. */
  index: number;
} | null;

/** Path and query only: the hash is a scroll position, not a place. */
export function placeOf(url: string): string {
  const hash = url.indexOf('#');
  const bare = hash >= 0 ? url.slice(0, hash) : url;
  // Absolute URLs from the Navigation API carry the origin; addresses in the
  // app do not. Both reduce to the same path + query.
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/]+(\/.*)?$/i.exec(bare);
  const path = match ? (match[1] ?? '/') : bare;
  return path.endsWith('?') ? path.slice(0, -1) : path;
}

/** The first segment after the workspace base: '' is Home. */
export function sectionOf(place: string, basePath: string): string {
  const path = placeOf(place).split('?')[0] ?? '';
  if (!path.startsWith(basePath)) return '';
  return path.slice(basePath.length).split('/').filter(Boolean)[0] ?? '';
}

function inside(place: string, basePath: string): boolean {
  const path = placeOf(place).split('?')[0] ?? '';
  return path === basePath || path.startsWith(`${basePath}/`);
}

/**
 * How far back `target` sits in this stretch of Headway history, or null.
 *
 * Walks back from the entry before this one and stops at the first entry
 * that is not inside this workspace — a sign-in page, the marketing site, a
 * different business — because going back past one of those to reach a
 * Headway page would be exactly the surprise this module exists to prevent.
 */
export function stepsBackTo(target: string, basePath: string, history: HistoryView): number | null {
  if (!history) return null;
  const want = placeOf(target);
  for (let i = history.index - 1; i >= 0; i -= 1) {
    const place = history.entries[i];
    if (place === undefined || !inside(place, basePath)) return null;
    if (placeOf(place) === want) return i - history.index;
  }
  return null;
}

/**
 * A tap on one of the four doors.
 *
 * `door` is the section root being tapped (`basePath` itself for Home).
 * `current` is where the owner is now.
 */
export function doorIntent(input: {
  door: string;
  current: string;
  basePath: string;
  history: HistoryView;
}): NavIntent {
  const { door, current, basePath, history } = input;
  const target = placeOf(door);
  if (placeOf(current) === target) return { kind: 'STAY' };

  // Already behind us, with only Headway in between: go back to it. This is
  // Home from anywhere the owner reached from Home, and a door's own root from
  // a topic or an entry inside it.
  const back = stepsBackTo(target, basePath, history);
  if (back !== null) return { kind: 'TRAVERSE', delta: back };

  const doorIsHome = sectionOf(target, basePath) === '';
  if (doorIsHome) {
    // Home is the root. When the browser has shown us there is no Home behind
    // this entry, Home takes this entry's place, so Back from it leaves the
    // way the owner came in. When the browser will not say, an ordinary link.
    return history ? { kind: 'REPLACE' } : { kind: 'PUSH' };
  }

  // From Home, a door is a step deeper. Between doors it is a sideways move,
  // and a sideways move replaces: tapping round the bar ten times must not
  // leave ten entries to Back through.
  return sectionOf(current, basePath) === '' ? { kind: 'PUSH' } : { kind: 'REPLACE' };
}

/**
 * An in-page "back" — up to a parent the page names.
 *
 * When the parent is the entry right behind this one, that is literally Back.
 * Otherwise the owner arrived some other way (a link from Home, a shared
 * address), and the parent replaces this entry: going up never leaves the
 * page below it to come back to.
 */
export function upIntent(input: { parent: string; basePath: string; history: HistoryView }): NavIntent {
  const { parent, history } = input;
  if (!history) return { kind: 'PUSH' };
  const previous = history.entries[history.index - 1];
  if (previous !== undefined && placeOf(previous) === placeOf(parent)) return { kind: 'TRAVERSE', delta: -1 };
  return { kind: 'REPLACE' };
}
