'use client';

import { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Link } from '@/components/portal/link';
import { useT } from '@/components/portal/locale-provider';
import { followIntent, isModifiedClick, readHistory } from '@/components/portal/history';
import { doorIntent } from '@/lib/portal/nav-intent';
import type { MessageKey } from '@/lib/i18n/strings';

/**
 * THE BOTTOM BAR — four places, reachable with a thumb.
 *
 * The workspace had eight tabs across the top. On a phone they wrapped into
 * three rows of small text at the FAR END of the screen from the hand holding
 * it, and choosing between eight things is work the owner came here to avoid.
 *
 * Four places, each answering a question a person actually has:
 *
 *   HOME          what do I need to know?
 *   FEEDBACK      what are customers saying?
 *   IMPROVEMENTS  what am I doing about it, and did it help?
 *   MORE          everything else.
 *
 * Customers, Check-in, Kit, Orders, Account and Team all still exist at the
 * same addresses; they live behind MORE because none of them is a reason to
 * open the app. Nothing was removed, and every bookmark still works.
 *
 * ICON AND WORD, NEVER THE ICON ALONE (final experience pass). The first
 * version was words only, on the grounds that there is no widely-read glyph
 * for "improvements" and a picture nobody can name is a tap nobody makes. That
 * is still true of an icon on its own, so every icon here sits above its word
 * and is hidden from screen readers; the word is what is announced. What the
 * icon adds is recognition at a glance, which is what makes four text labels
 * feel like an app rather than a row of links.
 *
 * The Improvements icon is the brand mark's own gesture — a path that starts
 * low and leaves higher — so the one place in the product about getting
 * better is drawn in the same line as Headway itself.
 *
 * YOU ARE HERE, THREE WAYS: the word goes heavier and navy, the icon's stroke
 * thickens, and a short gold rule sits above it. Colour is never the only
 * signal — a bright screen outdoors takes colour away first.
 *
 * IT IS NOT ON SCREEN ABOVE `sm`. Desktop keeps the navy bar's tabs, where
 * there is room for the full set, and a bottom bar on a laptop is a phone app
 * pretending.
 *
 * WHAT A TAP LEAVES BEHIND IN HISTORY (mobile back-navigation pass). A door is
 * a place, not a page view, so the bar is careful about Back:
 *
 *   from Home, a door is a step deeper          → a new history entry
 *   between two doors                           → the entry is replaced
 *   Home, or a door whose root is behind you    → Back to that entry
 *   the door you are already on                 → nothing, but scroll to top
 *
 * So Back from Feedback, Improvements or More is Home, however many doors were
 * tapped in between, and Back from Home leaves Headway the way the owner came.
 * The rules are `doorIntent` in `lib/portal/nav-intent.ts`; nothing here
 * intercepts the browser's own Back.
 */

type DoorIcon = (props: { active: boolean }) => React.ReactElement;

const stroke = (active: boolean) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: active ? 2.2 : 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

const HomeIcon: DoorIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden focusable="false">
    <path {...stroke(active)} d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19z" />
  </svg>
);

const FeedbackIcon: DoorIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden focusable="false">
    <path {...stroke(active)} d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9A1.5 1.5 0 0 1 19 16.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z" />
    <path {...stroke(active)} d="M8 9.5h8M8 12.5h5" />
  </svg>
);

/** The brand's own gesture: a path that starts low and leaves higher. */
const ImprovementsIcon: DoorIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden focusable="false">
    <path {...stroke(active)} d="M3.5 17.5c4.5 0 7.5-1 10.5-4.5s4.5-5 6.5-6" />
    <path {...stroke(active)} d="M15.5 6.5h5v5" />
  </svg>
);

const MoreIcon: DoorIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden focusable="false">
    <circle cx="6" cy="12" r={active ? 1.9 : 1.6} fill="currentColor" />
    <circle cx="12" cy="12" r={active ? 1.9 : 1.6} fill="currentColor" />
    <circle cx="18" cy="12" r={active ? 1.9 : 1.6} fill="currentColor" />
  </svg>
);

/**
 * The four doors, in thumb order.
 *
 * `matches` is what counts as "you are here": Feedback owns the `reviews`
 * slug, and MORE lights up for every door that lives behind it, so an owner
 * on Account can still see where in the app they are. An empty slug is Home.
 */
const DOORS = [
  { slug: '', label: 'nav.section.home', icon: HomeIcon, matches: [''] },
  { slug: 'reviews', label: 'nav.section.feedback', icon: FeedbackIcon, matches: ['reviews'] },
  { slug: 'improvements', label: 'nav.section.improvements', icon: ImprovementsIcon, matches: ['improvements'] },
  {
    slug: 'more',
    label: 'nav.section.more',
    icon: MoreIcon,
    matches: ['more', 'analysis', 'checkin', 'pulse', 'review', 'kit', 'orders', 'account', 'team'],
  },
] as const satisfies ReadonlyArray<{
  slug: string;
  label: MessageKey;
  icon: DoorIcon;
  matches: readonly string[];
}>;

/**
 * One door's face. Its own component because `useLinkStatus` has to live
 * INSIDE the link: the moment a door is pressed it dims, before the server has
 * answered, so a tap on a slow connection never looks like a tap that missed.
 */
function DoorFace({
  label,
  Icon,
  active,
}: {
  label: string;
  Icon: DoorIcon;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      data-pending={pending ? 'true' : undefined}
      className={clsx(
        'flex flex-col items-center gap-0.5 transition-opacity',
        pending && !active && 'opacity-60',
      )}
    >
      {/* The gold rule sits above the icon, where a thumb does not cover it. */}
      <span
        aria-hidden
        className={clsx('mb-1 h-[3px] w-5 rounded-full', active ? 'bg-brand-500' : 'bg-transparent')}
      />
      <Icon active={active} />
      <span className="truncate text-[12px] leading-tight">{label}</span>
    </span>
  );
}

export function MobileTabBar({ basePath, locked = false }: { basePath: string; locked?: boolean }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const rest = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : '';
  const current = rest.split('/').filter(Boolean)[0] ?? '';

  // The trial has ended: every door redirects to Account, so a bar offering
  // four of them would be a menu of disappointments. The header makes the same
  // decision for the same reason.
  if (locked) return null;

  return (
    <nav
      aria-label={t('nav.sections.label')}
      // The padding does two jobs. It keeps the row clear of the home
      // indicator on an iPhone, where the bottom 34px is not a tappable place;
      // and the 4px floor under it keeps the tiles off the very bottom edge of
      // the screen, which is what gives the focus ring somewhere to be drawn.
      // The app's focus outline sits 2px OUTSIDE the element it marks, so a
      // tile flush with the viewport loses that edge of its ring off-screen.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(16,42,67,0.25)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {DOORS.map((door) => {
          const active = (door.matches as readonly string[]).includes(current);
          const href = door.slug ? `${basePath}/${door.slug}` : basePath;
          // Sideways between two doors replaces the entry; anything else is
          // decided on the tap, when the browser's history can be read.
          const replaces = door.slug !== '' && current !== '';
          return (
            <li key={door.slug} className="flex-1">
              <Link
                href={href}
                replace={replaces}
                onClick={(event) => {
                  if (isModifiedClick(event)) return;
                  const intent = doorIntent({
                    door: href,
                    current: `${window.location.pathname}${window.location.search}`,
                    basePath,
                    history: readHistory(),
                  });
                  if (followIntent(intent, href, router, replaces)) event.preventDefault();
                }}
                aria-current={active ? 'page' : undefined}
                // 60px tall and a quarter of the screen wide: well above the
                // 44px floor, and no two doors close enough to mis-tap.
                //
                // THE FOCUS RING IS THE GLOBAL ONE. It is unlayered in
                // globals.css, so it wins over any utility written here, and
                // nothing on this bar may turn it off: an earlier version did,
                // and left a keyboard user with no visible focus at all.
                className={clsx(
                  'flex min-h-15 flex-col items-center justify-center px-1 pt-0.5 pb-1',
                  active ? 'font-semibold text-ink-900' : 'text-ink-500',
                )}
              >
                <DoorFace label={t(door.label)} Icon={door.icon} active={active} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
