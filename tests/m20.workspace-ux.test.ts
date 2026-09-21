import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, type MessageKey } from '@/lib/i18n/strings';

/**
 * THE OWNER EXPERIENCE, AS SHIPPED (launch pass).
 *
 * Source-level, like `m20.prefetch.test.ts`, because what is asserted here is
 * wording and structure an owner sees, and the components are server
 * components with no renderer in this suite. Each rule below is one an owner
 * would notice breaking and nobody would notice in a type check:
 *
 *   - every piece of feedback separates what the CUSTOMER GAVE from what
 *     HEADWAY UNDERSTOOD;
 *   - the workspace has six doors, and the week and month reports are reached
 *     from Check-in rather than as tabs of their own;
 *   - one word for one idea: Watching, What we know, What we cannot tell you,
 *     What we recommend;
 *   - an empty page is hopeful, never "No data".
 *
 * WORDS LIVE IN THE DICTIONARY NOW (M31). The plain-English and localization
 * pass moved the owner-facing sentences out of these components and into
 * `src/lib/i18n/strings`, reached with `t('some.key')`. So every rule about
 * wording is pinned twice: the component still reaches for the right key, and
 * the key still says the right words in English. Checking only the key would
 * let the sentence be rewritten into anything; checking only the words would
 * not notice a screen pointed at the wrong phrase.
 */

const SRC = resolve(__dirname, '..', 'src');

function read(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), 'utf8');
}

/** The file with its comments removed, so prose cannot satisfy a rule. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

/** The text of `source` from one marker up to the next. */
function between(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  expect(start, `marker not found: ${from}`).toBeGreaterThanOrEqual(0);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** The English a dictionary key says, so a rule can still pin the actual words. */
function says(key: MessageKey): string {
  return MESSAGES[key].en;
}

describe('every piece of feedback', () => {
  const ui = code(read('components', 'portal', 'portal-ui.tsx'));
  const row = between(ui, 'export async function ReviewRow(', 'export async function RatingStrip(');

  // OWNER UX PASS: each entry is one card, and everything the CUSTOMER gave —
  // stars, the parts they rated, their words, what they tapped — comes before
  // "See details", behind which Headway's own reading sits, labelled as such.
  const details = row.slice(row.indexOf('<details'));
  const evidence = row.slice(0, row.indexOf('<details'));

  it('separates what the customer gave from what Headway understood', () => {
    expect(row).toContain('<details');
    expect(details).toContain("t('common.review.details')");
    expect(details).toContain("t('common.review.understood')");
    expect(evidence).not.toContain("t('common.review.understood')");
    expect(says('common.review.details')).toBe('See details');
    expect(says('common.review.understood')).toBe('Headway understood');
  });

  it('shows the overall stars, every question of the form with its rating and its own tags, and the words', () => {
    expect(evidence).toContain('<Stars value={item.stars} />');
    expect(says('common.review.overall')).toBe('Overall');
    // Every question the form asked, in the form's order — not only the ones
    // answered — each with its own stars and number, or "Not rated".
    expect(evidence).toContain('gave.questions.map((q) => (');
    expect(evidence).toContain('<Stars value={q.rating} />');
    expect(evidence).toContain('{q.rating}/5');
    expect(evidence).toContain("t('common.review.notRated')");
    expect(says('common.review.notRated')).toBe('Not rated');
    // Every tag tapped, under the question it belongs to.
    expect(evidence).toContain('q.liked.map');
    expect(evidence).toContain('q.problems.map');
    expect(evidence).toContain("t('common.review.problems')");
    expect(evidence).toContain("t('common.review.liked')");
    expect(says('common.review.problems')).toBe('Problems');
    expect(says('common.review.liked')).toBe('Liked');
    expect(evidence).toContain('{item.text}');
  });

  it('never dresses up a rating-only submission as words', () => {
    expect(row).toContain("t('common.review.ratingOnly')");
    expect(row).toContain("t('common.review.noWordsTapped')");
    expect(says('common.review.ratingOnly')).toBe('A rating only — no written comment.');
    expect(says('common.review.noWordsTapped')).toBe(
      'Nothing written — the ratings above are the whole message.',
    );
  });

  it('names the topics plainly, and keeps the tone and the sorting as Headway’s reading', () => {
    expect(evidence).toContain("t('common.review.mentioned')");
    expect(evidence).toContain("item.themes.join(' · ')");
    expect(says('common.review.mentioned')).toBe('Mentioned');
    expect(details).toContain("t('common.review.noTopic')");
    expect(details).toContain('{item.sentimentLabel}');
    expect(details).toContain("t('common.review.sortedAs')");
    expect(says('common.review.sortedAs')).toBe('Sorted as');
  });

  it('tells the four states apart: read, being read, waiting, could not read', () => {
    expect(row).toContain("item.state !== 'ANALYSED'");
    expect(row).toContain("t('common.review.reading')");
    expect(row).toContain("t('common.review.waiting')");
    expect(row).toContain("t('common.review.failed')");
    expect(says('common.review.reading')).toBe('Headway is reading this now.');
    expect(says('common.review.waiting')).toBe(
      'Waiting for Headway to read it — usually within a minute of it arriving.',
    );
    expect(says('common.review.failed')).toBe(
      'Headway could not read this one yet. It will try again on its own.',
    );
    for (const state of [
      'common.review.reading',
      'common.review.waiting',
      'common.review.failed',
    ] as const) {
      expect(says(state)).not.toContain('Not read yet');
    }
  });

  it('draws each customer as a separate card, so one never runs into the next', () => {
    expect(row).toContain('<li className="rounded-2xl border border-ink-200 bg-white');
    const page = code(read('components', 'workspace', 'reviews.tsx'));
    expect(page).toContain('<ul className="mt-3 space-y-3">');
    expect(page).not.toContain('divide-y divide-ink-200 border-t border-ink-200">\n              {items.map');
  });
});

describe('the reviews page', () => {
  const page = code(read('components', 'workspace', 'reviews.tsx'));
  const ui = code(read('components', 'portal', 'portal-ui.tsx'));

  it('offers the five ratings as one-tap filters, five stars first', () => {
    expect(page).toContain(
      '<RatingStrip base={base} ratings={view.ratings} active={view.filters.stars} />',
    );
    const strip = between(ui, 'export async function RatingStrip(', 'export async function PeriodSwitch(');
    expect(strip).toContain('.sort((a, b) => b.stars - a.stars)');
    expect(strip).toContain('href={`${base}?stars=${r.stars}`}');
    expect(strip).toContain("aria-current={active === r.stars ? 'page' : undefined}");
  });

  it('is hopeful before the first customer, never empty', () => {
    // Empty says what happens next, and how it starts, rather than stopping at
    // the absence.
    expect(page).toContain("t('feedback.intro.empty')");
    expect(says('feedback.intro.empty')).toBe(
      'No feedback yet. It starts coming in when customers scan your QR code.',
    );
    expect(page).not.toContain('No feedback has been collected yet');
    expect(page).not.toMatch(/No data/i);
    expect(says('feedback.intro.empty')).not.toMatch(/No data/i);
  });

  it('opens with the counts that matter and says when Headway is still reading', () => {
    expect(page).toContain('<StatusStrip');
    expect(page).toContain("{ label: t('feedback.status.read'), value: view.analysed }");
    expect(page).toContain(
      "{ label: t('feedback.status.reading'), value: inHand, tone: 'warn' as const }",
    );
    expect(says('feedback.status.read')).toBe('read by Headway');
    expect(says('feedback.status.reading')).toBe('being read now');
    expect(page).toContain("t('feedback.intro.reading')");
    expect(says('feedback.intro.reading')).toBe(
      'Feedback has come in. Headway is reading it now. This usually takes less than a minute. Reload the page to see what it found.',
    );
  });

  it('lays the filters out as a grid, never a sideways scroll', () => {
    expect(page).toContain('grid grid-cols-2 gap-3 sm:grid-cols-4');
    expect(page).not.toContain('overflow-x-auto');
  });

  it('carries the data it needs: the list is built with the pack', () => {
    const service = code(read('lib', 'portal', 'service.ts'));
    expect(service).toMatch(/listClientFeedback\(\s*db,\s*client\.id,\s*\{[^}]*\},\s*pack,?\s*\)/);
    const feedback = code(read('lib', 'feedback', 'service.ts'));
    expect(feedback).toMatch(/export async function listClientFeedback\([^)]*pack\?: Pack/);
  });
});

describe('the workspace navigation', () => {
  const source = code(read('components', 'portal', 'workspace.tsx'));
  const block = between(source, 'const SECTIONS', ']');
  // `label` holds the dictionary key now (M31); the door an owner reads is the
  // English behind it, and the slug — an address people have been sent — has
  // not moved.
  const labelKeys = [...block.matchAll(/label: '([^']+)'/g)].map((m) => m[1] as MessageKey);
  const labels = labelKeys.map((key) => says(key));
  const slugs = [...block.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);

  it('has the doors an owner thinks in, in that order', () => {
    // Five on the shared link; four more once somebody is signed in. M21 added
    // the kit (the one physical object in the product, which an owner
    // previously had to be sent) and the account; M33 added the orders placed
    // from the kit, which sits beside it. M39 removed Team for the pilot:
    // email/team invitations are not being used, so the door is hidden rather
    // than opened onto a broken invite flow — the route and its backend are
    // untouched, see src/app/(workspace)/workspace/[clientId]/team/page.tsx.
    expect(labelKeys).toEqual([
      'nav.section.home',
      'nav.section.customers',
      'nav.section.feedback',
      'nav.section.improvements',
      'nav.section.checkin',
      'nav.section.kit',
      'nav.section.orders',
      'nav.section.account',
    ]);
    expect(labels).toEqual([
      'Home',
      'Customers',
      'Feedback',
      'Trends', // mobile polish pass: the door opens on Trends; the route is still /improvements
      'Check-in',
      'Kit',
      'Orders',
      'Account',
    ]);
    // The door reads "Feedback" because what it lists is private customer
    // feedback, which this product promises is never posted publicly. The slug
    // stays `reviews`: a URL is not copy, and old links must keep working.
    expect(slugs).toContain('reviews');
  });

  it('keeps the extra doors out of the read-only shared link', () => {
    const extras = [...block.matchAll(/label: '([^']+)', extra: true/g)].map(
      (m) => m[1] as MessageKey,
    );
    expect(extras).toEqual([
      'nav.section.kit',
      'nav.section.orders',
      'nav.section.account',
    ]);
    expect(extras.map((key) => says(key))).toEqual(['Kit', 'Orders', 'Account']);
  });

  it('keeps every door on screen from tablet up, pinned and finger-sized', () => {
    // The phone no longer reads this row at all — eight tabs wrapped into
    // three lines of small text at the top of the screen, which is the far
    // end from the thumb. It is `hidden` below `sm` and the bottom bar takes
    // over. From tablet up it is the lower half of the navy app bar (final
    // experience pass): still wrapping rather than scrolling sideways, still
    // pinned, still 44px a door.
    expect(source).toContain('flex max-w-5xl flex-wrap');
    expect(source).not.toContain('overflow-x-auto');
    expect(source).toContain('className="hidden border-t border-white/10 sm:block"');
    expect(source).toContain('sm:sticky sm:top-0');
    expect(source).toContain('min-h-11');
    expect(source).toContain("aria-current={active ? 'page' : undefined}");
  });

  it('reaches the week and the month from Check-in rather than as tabs', () => {
    expect(slugs).not.toContain('pulse');
    expect(slugs).not.toContain('review');
    expect(source).toContain("CHECKIN_FAMILY = new Set(['checkin', 'pulse', 'review'])");
    expect(source).toContain("s.slug === 'checkin' ? CHECKIN_FAMILY.has(currentSlug)");
  });

  it('still routes the week and the month, with the switch inside the door', () => {
    for (const route of ['pulse', 'review']) {
      const page = code(read('app', '(workspace)', 'workspace', '[clientId]', route, 'page.tsx'));
      expect(page).toContain(
        '<PeriodReportView report={report} basePath={`/workspace/${clientId}`} />',
      );
    }
    const report = code(read('components', 'workspace', 'period-report.tsx'));
    expect(report).toContain(
      "<PeriodSwitch basePath={basePath} current={isWeek ? 'pulse' : 'review'} />",
    );
    expect(report).toContain("eyebrow={t('pulse.report.eyebrow')}");
    expect(says('pulse.report.eyebrow')).toBe('Check-in');
    const checkin = code(read('components', 'workspace', 'checkin.tsx'));
    expect(checkin).toContain('<PeriodSwitch basePath={basePath} current="checkin" />');
  });
});

describe('the phone’s four doors', () => {
  const bar = code(read('components', 'portal', 'mobile-nav.tsx'));
  const layout = code(read('app', '(workspace)', 'workspace', '[clientId]', 'layout.tsx'));
  const more = code(read('components', 'workspace', 'more.tsx'));
  const doors = between(bar, 'const DOORS', '] as const satisfies');
  const keys = [...doors.matchAll(/label: '([^']+)'/g)].map((m) => m[1] as MessageKey);

  it('offers four doors, each a question an owner has', () => {
    // Four, and no more. The number is the design: eight tabs asked the owner
    // to choose before they had read anything, which is the work they came
    // here to have done. Anything added here has to displace one of these.
    expect(keys).toEqual([
      'nav.section.home',
      'nav.section.feedback',
      'nav.section.improvements',
      'nav.section.more',
    ]);
    expect(keys.map((k) => says(k))).toEqual(['Home', 'Feedback', 'Trends', 'More']);
  });

  it('pairs every icon with its word, and never scrolls sideways', () => {
    // There is no widely-read glyph for "improvements", and a picture nobody
    // can name is a tap nobody makes — so the icon is never alone (final
    // experience pass). Every icon is decoration beside its word: hidden from
    // screen readers, which announce the word, and never focusable.
    const svgs = [...bar.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
    expect(svgs.length).toBe(4);
    for (const svg of svgs) {
      expect(svg).toContain('aria-hidden');
      expect(svg).toContain('focusable="false"');
    }
    // The word is always rendered, under the icon.
    expect(bar).toContain('<Icon active={active} />');
    expect(bar).toContain('<span className="truncate text-[12px] leading-tight">{label}</span>');
    expect(bar).not.toMatch(/react-icons|lucide/i);
    expect(bar).not.toContain('overflow-x-auto');
  });

  it('is thumb-sized, marks where you are three ways, and says so to a screen reader', () => {
    // 60px tall, a quarter of the screen wide. The selected state is a gold
    // rule above the icon, a heavier icon stroke and a heavier word — never
    // colour alone, because colour is the first signal a bright screen
    // outdoors takes away.
    expect(bar).toContain('min-h-15');
    expect(bar).toContain("aria-current={active ? 'page' : undefined}");
    expect(bar).toContain("active ? 'bg-brand-500' : 'bg-transparent'");
    expect(bar).toContain('strokeWidth: active ? 2.2 : 1.7');
    expect(bar).toContain("active ? 'font-semibold text-ink-900' : 'text-ink-500'");
    expect(bar).toContain("aria-label={t('nav.sections.label')}");
  });

  it('never strips the focus ring it cannot replace', () => {
    // It once carried `focus-visible:outline-none` with a ring class that did
    // not resolve, which left a keyboard user with no visible focus at all on
    // the bar. The app has one focus treatment, in globals.css, and it is
    // unlayered — so nothing here may turn it off.
    expect(bar).not.toContain('outline-none');
  });

  it('leaves room under itself, so it covers nothing and can show a focus ring', () => {
    // A fixed bar with no matching space at the end of the document sits on
    // top of the last control on every page. The spacer and the bar are
    // rendered together, and both disappear from tablet width up.
    expect(layout).toContain('<div aria-hidden className="h-20 sm:hidden" />');
    expect(layout).toContain('<MobileTabBar basePath={`/workspace/${clientId}`} locked={locked} />');
    expect(layout.indexOf('h-20 sm:hidden')).toBeLessThan(layout.indexOf('<MobileTabBar'));
    expect(bar).toContain('sm:hidden');
    expect(bar).toContain('pb-[max(0.25rem,env(safe-area-inset-bottom))]');
  });

  it('shows one door, not four, once the trial has locked the workspace', () => {
    // Every other door redirects to Account, so four of them would be a menu
    // of disappointments. The top row makes the same decision.
    expect(bar).toContain('if (locked) return null;');
  });

  it('moves the secondary doors behind More without moving their addresses', () => {
    // Nothing was removed and nothing was renamed: More is a menu, not a
    // redirect, so every bookmark and emailed link still works.
    const slugs = [...more.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);
    expect(slugs).toEqual(['analysis', 'checkin', 'kit', 'orders', 'account']);
    // And More stays lit while the owner is on any of them, so "where am I"
    // still has an answer three levels down.
    for (const slug of slugs) expect(doors).toContain(`'${slug}'`);
  });

  it('gives every row on More a reason to tap it, and the whole width to tap', () => {
    expect(more).toContain('min-h-15');
    expect(more).toContain('{t(door.hint)}');
    expect(says('more.hint.customers')).toBe('Every topic customers raise, with the evidence');
    expect(says('more.hint.account')).toBe('Language, team and your subscription');
    // Rows, not a grid of cards with icons: a card is a lot of screen to
    // spend on one word, and an unnamed icon is decoration.
    expect(more).not.toMatch(/<svg|grid-cols-2/);
  });
});

describe('home, as the owner’s brief', () => {
  const home = code(read('components', 'workspace', 'home.tsx'));
  const brief = code(read('components', 'workspace', 'brief.tsx'));
  const responsibility = code(read('components', 'portal', 'responsibility.tsx'));

  it('leads with the brief, and keeps the full reading behind one tap', () => {
    // The hierarchy IS the design. Anything that reorders these blocks is
    // changing what an owner reads first, which is not a styling decision.
    //
    // The mobile pass changed WHAT leads, not whether something does: the
    // dominant block used to be five pieces of prose (FocusBlock) and is now
    // four blocks of figures. Everything that followed it is unchanged and
    // sits under one disclosure.
    //
    // The final experience pass moved "since your last visit" INSIDE the
    // reveal: the band at the top already says how much arrived, so the full
    // account is detail, not headline.
    const order = [
      '<OwnerBrief', // the band, the story, the latest, what changed, your changes
      "t('brief.more.summary')", // the full reading, from here down
      '<SinceVisit since={since}', // what changed while away, in full
      "eyebrow={t('home.watching.title')}", // what is being carried
      "eyebrow={t('home.goingWell.title')}", // what to protect
      "eyebrow={t('home.nextCheck.title')}", // when the next check-in is worth opening
      '<Limits limits={r.limitations} collapsed />', // what we cannot tell you, one tap away
    ];
    const at = order.map((token) => {
      const i = home.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    // The eyebrows in that order are the words an owner reads.
    expect(says('home.watching.title')).toBe('Headway is watching');
    expect(says('home.goingWell.title')).toBe('Going well');
    expect(says('home.nextCheck.title')).toBe('Your next check-in');
    expect(says('brief.more.summary')).toBe('More detail');
  });

  it('answers what happened, what matters and what to do, in that order', () => {
    // The three questions an owner opens the app with, and the order they
    // arrive in. Each is a block in `brief.tsx`, and the order is the point:
    // a count with no conclusion is a dashboard, and a conclusion with no
    // count is an opinion. The customers' own words close it, newest first.
    const order = [
      "t('brief.mood.title')", // WHAT HAPPENED — the pile, split three ways
      "t('brief.attention.title')", // WHAT MATTERS
      "t('brief.suggest.title')", // WHAT TO DO
      "t('brief.evidence.cta')", // and the evidence, AFTER the conclusion
      "t('brief.latest.title')", // and the newest customers, read or not
    ];
    const at = order.map((token) => {
      const i = brief.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(says('brief.mood.title')).toBe('How customers feel');
    expect(says('brief.attention.title')).toBe('Needs your attention');
    expect(says('brief.suggest.title')).toBe('What to do');
    expect(says('brief.evidence.cta')).toBe('See what customers said');
    expect(says('brief.latest.title')).toBe('Latest from customers');
    // And the page is composed in that order.
    // OwnerBrief is the last thing in the file: from its name to the end.
    const composed = brief.slice(brief.indexOf('export async function OwnerBrief('));
    const blocks = ['<Band', '<Story', '<Latest', '<Loved', '<Changed', '<Memory'];
    const where = blocks.map((token) => {
      const i = composed.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(where).toEqual([...where].sort((a, b) => a - b));
  });

  it('leads with the problem, then how many customers, then which way — and opens its evidence', () => {
    // OWNER UX PASS: the problem's name is the headline and the count is said
    // as people ("39 customers mentioned it"), then "↑ Getting worse", then
    // what to do. The evidence behind the count is one tap away, every time.
    const block = between(brief, 'async function Story(', 'async function Calm(');
    const order = ['{card.label}', "t.plural('brief.mentioned', card.count)", '<Trend trend={card.trend} />', "t('brief.suggest.title')"];
    const at = order.map((token) => {
      const i = block.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(block).toContain('href={card.href}');
    expect(block).toContain('text-[28px]');
    expect(says('brief.mentioned.other')).toBe('{count} customers mentioned it');
  });

  it('draws no chart, and invents no number of its own', () => {
    // Three labelled figures instead of a four-segment bar nobody can label
    // at 375px — and every figure carried across from the builders, never
    // recomputed here.
    expect(brief).not.toMatch(/<svg|Chart|<Bar|recharts|donut|sparkline/i);
    expect(brief).not.toMatch(/\.reduce\(|\.filter\(|Math\.round|\/ *total/);
  });

  it('keeps what is going well apart from what is being watched', () => {
    expect(home).toContain("r.watching.filter((i) => i.state === 'KEEP_DOING')");
    expect(home).toContain("r.watching.filter((i) => i.state !== 'KEEP_DOING')");
    expect(home).toContain("eyebrow={t('home.goingWell.title')}");
    expect(says('home.goingWell.title')).toBe('Going well');
    expect(home).toContain('<WatchingList items={watching} basePath={basePath} />');
  });

  it('pairs the carried things with what is next, and stacks them on a phone', () => {
    expect(home).toContain(
      'grid grid-cols-1 items-start gap-x-10 gap-y-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
    );
    expect(home).toContain('<aside');
    expect(home.indexOf('<OwnerBrief')).toBeLessThan(home.indexOf('<aside'));
  });

  it('opens with the answer, never with arithmetic', () => {
    // An earlier version opened with a row of numbers, and a later one closed
    // with a grid that repeated the answer as figures. Neither survives: the
    // brief is first, and no figure on the page is stated twice.
    expect(home.indexOf('<OwnerBrief')).toBeLessThan(home.indexOf('<Section'));
    expect(home).not.toContain('<Tallies');
    expect(home).not.toMatch(/\+\d+%/);
  });

  it('never opens onto an empty disclosure', () => {
    // "The full reading" that opens onto nothing is worse than no control at
    // all, so the reveal is rendered only when something is in it.
    expect(home).toContain('const hasFullReading =');
    expect(home).toContain('{hasFullReading ? (');
  });

  it("shows the first customers' signals before anything is a pattern, and never a blank", () => {
    expect(home).toContain('<SoFar soFar={view.soFar} basePath={basePath} />');
    expect(home).toContain("eyebrow={t('home.soFar.title')}");
    expect(says('home.soFar.title')).toBe('What customers are mentioning so far');
    // Counted, and said to be counts — never dressed up as a conclusion.
    expect(home).toContain("note={t('home.soFar.note')}");
    expect(says('home.soFar.note')).toBe('Counts only, not conclusions');
    // Before the first piece of feedback the page still says what will happen
    // and where it comes from, rather than stopping at the absence. The brief
    // owns that message now, and says it in half the words — Home used to say
    // it a second time under the reveal, which was the same news twice.
    expect(brief).toContain("t('brief.early.body')");
    expect(says('brief.early.body')).toBe(
      'Headway will brief you here as soon as customers start giving feedback.',
    );
    expect(brief).not.toMatch(/No data/i);
    expect(says('brief.early.body')).not.toMatch(/No data/i);
    expect(home).not.toContain("t('home.empty.body')");
  });

  it('says what is watched, why, and when it will be flagged', () => {
    const row = between(responsibility, 'function WatchingRow(', 'function StrengthRow(');
    expect(row).toContain('{item.whyItMatters}');
    // The condition that brings it back is in the open, not behind the tap.
    expect(row.indexOf('{item.watching}')).toBeLessThan(row.indexOf('</summary>'));
    expect(row).toContain('<dt');
    // One line to scan; the reasons open on request.
    expect(row).toContain('<details');
  });

  it('proves a strength with a count rather than a badge', () => {
    const row = between(responsibility, 'function StrengthRow(', 'export function StrengthsList(');
    // Still the count out of the whole, both figures passed straight through;
    // the sentence they are read into is the dictionary's.
    expect(row).toContain("t('common.evidence.count', {");
    expect(row).toContain('count: item.evidence.count,');
    expect(row).toContain('total: item.evidence.outOf,');
    expect(says('common.evidence.count')).toBe('{count} of {total} feedback entries');
    expect(row).toContain('<StateChip item={item} />');
    expect(row).toContain('{item.recommendedNextStep}');
    expect(row).not.toMatch(/badge|streak|confetti|points|\bxp\b/i);
  });

  it('says when the next check-in is worth opening, as a condition', () => {
    expect(home).toContain("eyebrow={t('home.nextCheck.title')}");
    expect(says('home.nextCheck.title')).toBe('Your next check-in');
    expect(home).toContain('{r.nextUsefulCheck}');
    expect(home).not.toMatch(/countdown|days left|streak/i);
  });
});

describe('one word for one idea', () => {
  const ui = code(read('components', 'portal', 'portal-ui.tsx'));
  const story = code(read('components', 'workspace', 'improvement-story.tsx'));
  const disclose = code(read('components', 'portal', 'disclose.tsx'));

  it('says Watching wherever a theme is being watched', () => {
    // One key for the idea, so the four places that show it cannot drift apart.
    expect(ui).toContain("watch: 'common.state.watching',");
    expect(says('common.state.watching')).toBe('Watching');
    expect(ui).not.toContain('Headway will watch');
    expect(ui).not.toContain("'Watch this'");
  });

  it('labels what happened, what it means and what to do now, with the limit beside the finding', () => {
    expect(story).toContain("t('improvements.row.whatHappened')");
    expect(story).toContain("t('improvements.row.whatThisMeans')");
    expect(story).toContain("t('improvements.row.whatToDoNow')");
    expect(says('improvements.row.whatHappened')).toBe('What happened');
    expect(says('improvements.row.whatThisMeans')).toBe('What this means');
    expect(says('improvements.row.whatToDoNow')).toBe('What to do now');
    // The engine's full sentence where it has one, its short one otherwise —
    // never both, which used to say the same thing twice in two lengths.
    expect(story).toContain('{outcome.caveat || outcome.note}');
    expect(disclose).toContain('{p.caveat}');
    // The limit is beside the finding, above the reasons behind the tap.
    expect(disclose.indexOf('{p.caveat}')).toBeLessThan(
      disclose.indexOf("t('common.reveal.why')"),
    );
    expect(says('common.reveal.why')).toBe('Why Headway says this');
  });

  it('reads the improvement loop as The problem · You changed · Headway checked again', () => {
    expect(story).toContain("label={t('improvements.moment.problem')}");
    expect(story).toContain(
      "declined ? t('improvements.notDoing') : t('improvements.moment.youChanged')",
    );
    expect(story).toContain("label={t('improvements.moment.checkedAgain')}");
    expect(says('improvements.moment.problem')).toBe('The problem');
    expect(says('improvements.notDoing')).toBe('Not doing');
    expect(says('improvements.moment.youChanged')).toBe('You changed');
    expect(says('improvements.moment.checkedAgain')).toBe('Headway checked again');
    expect(disclose).toContain("label: 'common.population.before'");
    expect(disclose).toContain("label: 'common.population.after'");
    expect(says('common.population.before')).toBe('Before');
    expect(says('common.population.after')).toBe('After');
  });
});

describe('the customer thank-you', () => {
  const copy = code(read('lib', 'gateway', 'copy.ts'));

  it('tells the customer where their words went, and keeps the public review optional', () => {
    expect(copy).toContain('Your feedback has gone directly to the team.');
    expect(copy).toContain('Entirely optional');
    expect(copy).not.toMatch(/only if|if you (were|are) happy|4 or 5 stars/i);
  });
});

describe('the pipeline is wired to the product', () => {
  it('starts a reading after every stored submission, after the response, never on it', () => {
    const action = code(read('lib', 'actions', 'gateway.ts'));
    const trigger = action.indexOf("triggerFeedbackProcessing(result.data.clientId, 'SUBMITTED')");
    expect(trigger).toBeGreaterThan(0);
    expect(trigger).toBeLessThan(action.indexOf('redirect(`/feedback/${result.data.token}/thanks`)'));
    expect(action).toContain('if (result.data.stored) triggerFeedbackProcessing');
    // The public request itself never reaches the analysis or a provider.
    expect(action).not.toMatch(/@\/lib\/feedback\/analysis|classifyReviews|@\/lib\/ai\b/);
  });

  it('catches up whenever a workspace or the console is opened', () => {
    for (const layout of [
      ['app', '(workspace)', 'workspace', '[clientId]', 'layout.tsx'],
      ['app', '(app)', 'clients', '[id]', 'layout.tsx'],
    ] as const) {
      const source = code(read(...layout));
      expect(source).toContain("'VISIT')");
      expect(source).toContain('export const maxDuration = 60;');
      expect(source.indexOf('notFound()')).toBeLessThan(source.indexOf("'VISIT')"));
    }
    expect(code(read('app', '(feedback)', 'feedback', '[token]', 'page.tsx'))).toContain(
      'export const maxDuration = 60;',
    );
  });

  it('runs as a scope, not as a person, and only after the response', () => {
    const trigger = code(read('lib', 'pipeline', 'trigger.ts'));
    expect(trigger).toContain("import { after } from 'next/server';");
    expect(trigger).toContain('serviceScopedDb(clientId)');
    expect(trigger).toContain('after(run)');
    expect(trigger).not.toMatch(/app\.user_id|currentUserId|isPlatformAdmin/);
    const db = code(read('lib', 'db.ts'));
    expect(db).toContain("set_config('app.service_client_id', ${clientId}, TRUE)");
    expect(db).toContain('return scopeToClient(base, clientId);');
  });

  it('gives every tappable control a 44px hit area, never a 36px one', () => {
    for (const file of [
      ['components', 'portal', 'portal-ui.tsx'],
      ['components', 'portal', 'responsibility.tsx'],
      ['components', 'portal', 'workspace.tsx'],
      ['components', 'workspace', 'reviews.tsx'],
      ['components', 'portal', 'disclose.tsx'],
      ['components', 'portal', 'mobile-nav.tsx'],
      ['components', 'workspace', 'brief.tsx'],
      ['components', 'workspace', 'more.tsx'],
      ['components', 'workspace', 'improvements.tsx'],
      ['components', 'workspace', 'signal-board.tsx'],
      ['components', 'workspace', 'improvement-story.tsx'],
      ['components', 'workspace', 'checkin.tsx'],
      ['components', 'sign-out.tsx'],
      ['app', '(workspace)', 'workspace', '[clientId]', 'error.tsx'],
    ] as const) {
      const source = code(read(...file));
      expect(source, file.join('/')).not.toMatch(/min-h-9|min-h-10|h-10 w-full/);
    }
    const ui = code(read('components', 'portal', 'portal-ui.tsx'));
    expect(between(ui, 'export async function RatingStrip(', 'export async function PeriodSwitch(')).toContain('min-w-11');
    expect(code(read('components', 'workspace', 'reviews.tsx'))).toContain("'h-11 w-full rounded-md");
  });

  it('has a calm error state for the workspace', () => {
    const error = code(read('app', '(workspace)', 'workspace', '[clientId]', 'error.tsx'));
    expect(error).toContain("'use client'");
    expect(error).toContain("t('errors.workspace.retry')");
    expect(error).toContain("t('errors.workspace.home')");
    expect(says('errors.workspace.retry')).toBe('Try again');
    expect(says('errors.workspace.home')).toBe('Back to Home');
    expect(error).not.toMatch(/error\.message|error\.digest|\.stack/);
  });
});
