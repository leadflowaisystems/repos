import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPackOrFallback } from '@/lib/packs';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { parseStructured, ratedCount } from '@/lib/feedback/structured';
import { prepareIngest } from '@/lib/feedback/ingest';
import { fingerprintFeedback } from '@/lib/feedback/fingerprint';
import { MIN_MENTIONS_TO_NAME } from '@/lib/intelligence/engine';
import { MESSAGES } from '@/lib/i18n/strings';
import { CORNER_CAFE, storyFeedbackCount, type PublicReview } from '../scripts/demo/corner-cafe';

/**
 * THE COMMAND CENTRE (M24).
 *
 * Two things are pinned here, and each is a claim somebody could otherwise
 * undo without noticing.
 *
 * THE HIERARCHY. Home leads with one dominant block an owner can stop after;
 * every other page leads with its conclusion and keeps its method behind a
 * tap; every disclosure is a native <details>; every figure that matters
 * opens into the rows it counts. Source-level, like the launch-pass tests,
 * because these are server components with no renderer in this suite.
 *
 * WHERE THE WORDS ARE. Since the plain-English and localization pass the
 * owner-facing sentences live in the dictionary at src/lib/i18n/strings and
 * reach the page through t('some.key'), so a source scan pins the KEY the
 * component reaches for, and MESSAGES[key].en pins the words that key carries.
 * Both halves are needed: the key alone would let the sentence be rewritten,
 * and the sentence alone would not notice a component wired to another key.
 *
 * THE DEMO. The Corner Cafe story is the product's own demonstration, so
 * every record in it has to be one the current feedback form or paste box
 * would actually have stored — and the story has to read, through the real
 * deterministic reader, as the thing the pages say it is.
 */

const ROOT = resolve(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

function ordered(source: string, tokens: string[]): void {
  const at = tokens.map((token) => {
    const i = source.indexOf(token);
    expect(i, token).toBeGreaterThan(-1);
    return i;
  });
  expect(at).toEqual([...at].sort((a, b) => a - b));
}

// ---------------------------------------------------------------------------
// The hierarchy
// ---------------------------------------------------------------------------

describe('home is a command centre, not a briefing', () => {
  const home = code(read('src', 'components', 'workspace', 'home.tsx'));
  const focus = code(read('src', 'components', 'workspace', 'focus.tsx'));

  it('answers the seven questions in the order an owner asks them', () => {
    ordered(home, [
      '<FocusBlock focus={focus} direction={direction} />', // what is happening, why, do I need to act, what exactly
      "eyebrow={t('home.watching.title')}", // what is Headway watching
      "eyebrow={t('home.goingWell.title')}", // what is going well
      '{since ? <SinceVisit since={since} basePath={basePath} /> : null}', // what changed since I looked
      "eyebrow={t('home.nextCheck.title')}", // when the next check-in is worth opening
      '<Limits limits={r.limitations} collapsed />',
    ]);
    // The headings themselves, so a key can be rewired but not quietly reworded.
    expect(MESSAGES['home.watching.title'].en).toBe('Headway is watching');
    expect(MESSAGES['home.goingWell.title'].en).toBe('Going well');
    expect(MESSAGES['home.nextCheck.title'].en).toBe('Your next check-in');
  });

  it('reads as a decision: conclusion, why, evidence, what to do, what Headway checks next', () => {
    ordered(focus, [
      'Right now',
      '{focus.headline}',
      '<p className={EYEBROW}>Why</p>',
      '<ProofChips proofs={focus.proofs} />',
      'What to do',
      'bg-brand-700',
      'Why this step',
      'Headway will check next',
    ]);
    // The largest type on the page is the headline, and nothing else competes with it.
    expect(focus).toMatch(/text-\[26px\][^"]*sm:text-\[34px\]/);
    expect(home).not.toMatch(/text-\[2[6-9]px\]|text-\[3\dpx\]/);
  });

  it('no longer stacks four labelled layers under the decision', () => {
    expect(home).not.toContain('Do I need to do anything?');
    expect(home).not.toContain('<WatchingPanel');
    expect(home).not.toContain('<Picture');
    expect(home).not.toContain('ThemeStory');
    expect(home).not.toContain('Not worth your time right now');
  });

  it('keeps what Headway knows and what it cannot say behind a tap', () => {
    expect(home).toContain("t('home.knows.title')");
    expect(MESSAGES['home.knows.title'].en).toBe('What Headway knows about your business');
    expect(home.indexOf('<Reveal')).toBeGreaterThan(home.indexOf('<aside'));
    expect(home).toContain('<Limits limits={r.limitations} collapsed />');
  });

  it('states no figure twice: the tallies are gone, and the public rating is said once', () => {
    // The count read is the block's basis line; the leading complaint is the
    // headline; the strength is under Going well. A grid repeating all three
    // was the one part of Home that said things a second time.
    expect(home).not.toContain('<Tallies');
    expect(home).not.toContain('talliesFor');
    // Picked out by key, not by its label — the label is translated now — but
    // still picked out exactly once.
    expect(home.split("f.key === 'publicRating'").length - 1).toBe(1);
    // And the block itself no longer repeats the share chip's quotes under the reading.
    expect(focus).not.toContain('Show me the evidence');
    expect(focus).not.toContain('<Quotes');
  });

  it('shows, on every watched thing, the condition that brings it back', () => {
    const responsibility = code(read('src', 'components', 'portal', 'responsibility.tsx'));
    const row = responsibility.slice(responsibility.indexOf('function WatchingRow('), responsibility.indexOf('function StrengthRow('));
    expect(row.indexOf('{item.watching}')).toBeLessThan(row.indexOf('</summary>'));
  });

  it('computes the block from a module that can be tested without React', () => {
    expect(home).toContain("import { buildFocus } from '@/lib/portal/focus'");
    expect(focus).not.toMatch(/Math\.round|toFixed|\* 100|\/ 100/);
  });
});

describe('every figure that matters opens into the rows it counts', () => {
  const disclose = code(read('src', 'components', 'portal', 'disclose.tsx'));
  const board = code(read('src', 'components', 'workspace', 'signal-board.tsx'));
  const story = code(read('src', 'components', 'workspace', 'improvement-story.tsx'));

  it('is built on native disclosure, never on a script', () => {
    for (const source of [disclose, board]) {
      expect(source).toContain('<details');
      expect(source).toContain('<summary');
    }
    expect(story).toContain('<Reveal');
    for (const source of [disclose, board, story]) {
      expect(source).not.toMatch(/useState|useEffect|onClick|'use client'/);
    }
  });

  it('draws the two piles of a before/after one piece of feedback at a time, and switches motion off on request', () => {
    expect(disclose).toContain('hw-dot');
    expect(disclose).toContain("label: 'common.population.before'");
    expect(disclose).toContain("label: 'common.population.after'");
    expect(MESSAGES['common.population.before'].en).toBe('Before');
    expect(MESSAGES['common.population.after'].en).toBe('After');
    expect(disclose).toContain('{p.caveat}');
    expect(disclose).toContain("t('common.reveal.why')");
    expect(MESSAGES['common.reveal.why'].en).toBe('Why Headway says this');
    const css = read('src', 'app', 'globals.css');
    expect(css).toContain('@keyframes hw-pop');
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  });

  it('quotes customers with the door they came through and a way to all of them', () => {
    expect(disclose).toContain('{q.sourceLabel}');
    expect(disclose).toContain('{seeAll.label}');
    expect(disclose).toContain('“{q.text}”');
    expect(disclose).not.toMatch(/paraphras/i);
  });

  it('gives every summary a finger-sized hit area', () => {
    for (const [file, source] of [
      ['disclose', disclose],
      ['signal-board', board],
      ['improvement-story', story],
      ['focus', code(read('src', 'components', 'workspace', 'focus.tsx'))],
      ['responsibility', code(read('src', 'components', 'portal', 'responsibility.tsx'))],
      ['checkin', code(read('src', 'components', 'workspace', 'checkin.tsx'))],
    ] as const) {
      const summaries = source.match(/<summary[^>]*className=(?:"[^"]*"|\{[^}]*\})/g) ?? [];
      for (const s of summaries) {
        expect(s.includes('min-h-11') || s.includes('SUMMARY'), `${file}: ${s.slice(0, 80)}`).toBe(true);
      }
    }
  });
});

describe('customers is a signal board', () => {
  const page = code(read('src', 'components', 'workspace', 'analysis.tsx'));
  const board = code(read('src', 'components', 'workspace', 'signal-board.tsx'));

  it('groups by importance, in this order', () => {
    ordered(page, ["key: 'NEEDS_YOU'", "key: 'WATCHING'", "key: 'PROTECT'", "key: 'EARLY'"]);
    expect(board).toContain("NEEDS_YOU: 'customers.group.needsAttention.label'");
    expect(board).toContain("WATCHING: 'customers.group.watching.label'");
    expect(board).toContain("PROTECT: 'customers.group.goingWell.label'");
    expect(board).toContain("EARLY: 'customers.group.notClear.label'");
    expect(MESSAGES['customers.group.needsAttention.label'].en).toBe('Needs your attention');
    expect(MESSAGES['customers.group.watching.label'].en).toBe('Watching');
    expect(MESSAGES['customers.group.notClear.label'].en).toBe('Not yet clear');
    // The key stays PROTECT, but the word an owner reads is the one Home uses
    // for the same pile: one pile, one name.
    expect(MESSAGES['customers.group.goingWell.label'].en).toBe(MESSAGES['home.goingWell.title'].en);
  });

  it('opens each signal into the whole reading without leaving the page', () => {
    ordered(board, [
      "<Row label={t('customers.card.saying')}>",
      "<Row label={t('customers.tapped.label')}>",
      "<Row label={t('customers.card.sees')} strong>",
      "issue ? t('customers.card.whatToDo') : t('customers.card.whatToKeep')",
      "<Row label={t('customers.card.why')}>",
      "<Row label={t('customers.card.checkNext')}>",
      "<Row label={t('customers.card.basedOn')}>",
    ]);
    // The rows read the same way they always did, in the dictionary now.
    expect([
      MESSAGES['customers.card.saying'].en,
      MESSAGES['customers.tapped.label'].en,
      MESSAGES['customers.card.sees'].en,
      MESSAGES['customers.card.whatToDo'].en,
      MESSAGES['customers.card.whatToKeep'].en,
      MESSAGES['customers.card.why'].en,
      MESSAGES['customers.card.checkNext'].en,
      MESSAGES['customers.card.basedOn'].en,
    ]).toEqual([
      'What customers are saying',
      'What customers tapped',
      'What Headway sees',
      'What to do',
      'What to keep doing',
      'Why',
      'Headway will check next',
      'What Headway based this on',
    ]);
    // The taps are counted by the view, never by the component.
    expect(board).toContain('{s.tapped ? (');
    expect(board).not.toMatch(/reduce\(|summarise/);
    expect(board).toContain('id={`signal-${s.themeKey}`}');
    expect(page).toContain('open={open}');
  });

  it('keeps the movement and the method behind a tap, and the method on this page only', () => {
    ordered(page, [
      '<SignalBoard',
      "t('customers.changed.summary')",
      "t('customers.method.summary')",
      '<WorkList work={view.work} />',
      '<Limits limits={view.limits} />',
    ]);
    expect(MESSAGES['customers.changed.summary'].en).toBe('Show what changed between your check-ins');
    expect(MESSAGES['customers.method.summary'].en).toBe('How Headway read this');
    expect(page).not.toContain('eyebrow="Across your check-ins"');
    expect(page).not.toContain('<ThemeStory');
  });
});

describe('reviews reads as evidence, not an inbox', () => {
  const page = code(read('src', 'components', 'workspace', 'reviews.tsx'));

  it('opens with the transformation Headway made of the pile', () => {
    ordered(page, [
      'function Funnel(',
      "t.plural('feedback.funnel.read', funnel.read)",
      "t.plural('feedback.funnel.pattern', funnel.signals)",
      "t.plural('feedback.funnel.isolated', funnel.isolated)",
      "t('feedback.funnel.attention'",
    ]);
    // Each step still names its own noun in both numbers — one entry is an
    // entry — and the third step is still the counterweight that says these
    // topics are NOT being treated as patterns.
    expect(MESSAGES['feedback.funnel.read.one'].en).toBe('feedback entry read');
    expect(MESSAGES['feedback.funnel.read.other'].en).toBe('feedback entries read');
    expect(MESSAGES['feedback.funnel.pattern.one'].en).toBe('pattern');
    expect(MESSAGES['feedback.funnel.pattern.other'].en).toBe('patterns');
    expect(MESSAGES['feedback.funnel.isolated.one'].en).toBe('topic mentioned once or twice');
    expect(MESSAGES['feedback.funnel.isolated.other'].en).toBe('topics mentioned once or twice');
    expect(MESSAGES['feedback.funnel.attention'].en).toBe('needs attention · {topic}');
    expect(page.indexOf('<Funnel funnel={view.funnel} base={base} t={t} />')).toBeLessThan(page.indexOf('<StatusStrip'));
  });

  it('lets the owner see only the evidence behind one signal', () => {
    expect(page).toContain('function SignalChips(');
    expect(page).toContain("t('feedback.evidence.eyebrow')");
    expect(MESSAGES['feedback.evidence.eyebrow'].en).toBe('What Headway based this on');
    expect(page).toContain(
      "t('feedback.evidence.title', { topic: activeSignal.label.toLowerCase() })",
    );
    expect(MESSAGES['feedback.evidence.title'].en).toBe('Feedback about {topic}');
    // And it says the ones on top were chosen, not simply the first three — in
    // both numbers, because one entry is an entry.
    expect(page).toContain("t.plural('feedback.evidence.clearest', items.length)");
    expect(MESSAGES['feedback.evidence.clearest.one'].en).toBe('The clearest one is first.');
    expect(MESSAGES['feedback.evidence.clearest.other'].en).toBe('The clearest ones are first.');
  });

  it('leads with representative comments and keeps the whole pile one tap away', () => {
    // The same three quotes every figure on the workspace opens into, chosen
    // by the same rule, then "Show all N". Any other narrowing shows the list.
    expect(page).toContain("import { quotesFor } from '@/lib/portal/evidence'");
    expect(page).toContain('const REPRESENTATIVE = 3;');
    expect(page).toContain("activeSignal !== null && !searching && filters.stars === null && page === 1 && !all");
    expect(page).toContain("t('feedback.list.showAll', { count: view.matching })");
    expect(MESSAGES['feedback.list.showAll'].en).toBe('Show all {count}');
    expect(page).toContain('&all=1');
  });

  it('keeps the raw list, the search and the charts, under the intelligence', () => {
    ordered(page, [
      '<SignalChips',
      '<RatingStrip',
      "t('feedback.found.summary')",
      "t('feedback.filter.summary')",
      '<ReviewRow key={item.id} item={item} />',
    ]);
    expect(MESSAGES['feedback.found.summary'].en).toBe('What Headway found');
    expect(MESSAGES['feedback.filter.summary'].en).toBe('Search and filter');
  });
});

describe('improvements reads as memory', () => {
  const story = code(read('src', 'components', 'workspace', 'improvement-story.tsx'));
  const page = code(read('src', 'components', 'workspace', 'improvements.tsx'));

  it('tells three moments, then what happened, what it means and what to do now', () => {
    ordered(story, [
      "label={t('improvements.moment.problem')}",
      "declined ? t('improvements.notDoing') : t('improvements.moment.youChanged')",
      "label={t('improvements.moment.checkedAgain')}",
      "t('improvements.row.whatHappened')",
      "t('improvements.row.whatThisMeans')",
      "t('improvements.row.whatToDoNow')",
    ]);
    expect([
      MESSAGES['improvements.moment.problem'].en,
      MESSAGES['improvements.notDoing'].en,
      MESSAGES['improvements.moment.youChanged'].en,
      MESSAGES['improvements.moment.checkedAgain'].en,
      MESSAGES['improvements.row.whatHappened'].en,
      MESSAGES['improvements.row.whatThisMeans'].en,
      MESSAGES['improvements.row.whatToDoNow'].en,
    ]).toEqual([
      'The problem',
      'Not doing',
      'You changed',
      'Headway checked again',
      'What happened',
      'What this means',
      'What to do now',
    ]);
    // The before and after are the largest things on the page.
    expect(story).toMatch(/text-\[34px\][^"]*sm:text-\[40px\]/);
  });

  it('keeps the numbers, the evidence and how it started one tap away', () => {
    ordered(story, [
      "summary={t('improvements.reveal.numbers')}",
      "summary={t('improvements.reveal.evidence')}",
      "summary={t('improvements.reveal.howStarted')}",
    ]);
    expect(MESSAGES['improvements.reveal.numbers'].en).toBe('Show the numbers');
    expect(MESSAGES['improvements.reveal.evidence'].en).toBe('Show what customers wrote');
    expect(MESSAGES['improvements.reveal.howStarted'].en).toBe('How this started');
    expect(story).toContain('{outcome.caveat || outcome.note}');
    expect(page).toContain('<ImprovementStory');
    expect(page).not.toContain('<ActionStory');
  });
});

describe('the check-in is a pulse', () => {
  const page = code(read('src', 'components', 'workspace', 'checkin.tsx'));

  it('says the whole check-in in one sentence and three blocks, then the detail on request', () => {
    ordered(page, [
      '<PeriodSwitch basePath={basePath} current="checkin" />',
      '{pulse.sentence}',
      '<Blocks blocks={pulse.blocks}',
      "t('checkin.nextCheck.title')",
      '{r.nextUsefulCheck}',
      "summary={t('checkin.reveal.changed')}",
      "t('checkin.reveal.did'",
    ]);
    expect(MESSAGES['checkin.nextCheck.title'].en).toBe('What Headway will check next');
    expect(MESSAGES['checkin.reveal.changed'].en).toBe('Show what changed');
    expect(MESSAGES['checkin.reveal.did'].en).toBe('What Headway did · {since}');
    expect(page).toContain("import { checkinPulse, type CheckinBlock } from '@/lib/portal/focus'");
    expect(page).not.toContain('<Limits');
  });

  it('is named after the month, without a possessive', () => {
    const pages = code(read('src', 'lib', 'portal', 'pages.ts'));
    expect(pages).toContain('title: month ? `${month} check-in`');
  });
});

describe('the utility pages stay quiet', () => {
  it('sections the account into service, activity and continuing with Headway', () => {
    const page = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'account', 'page.tsx'));
    ordered(page, [
      "eyebrow={t('account.service.eyebrow')}",
      "eyebrow={t('account.activity.eyebrow')}",
    ]);
    expect(MESSAGES['account.service.eyebrow'].en).toBe('Your Headway service');
    expect(MESSAGES['account.activity.eyebrow'].en).toBe('What Headway has done so far');
    expect(MESSAGES['account.continue.eyebrow'].en).toBe('Continuing with Headway');
    // The same offer is made in two states — locked, above the facts, and
    // mid-trial, under them — so both sections carry one eyebrow. The one this
    // page ends on is the one after the activity.
    const afterActivity = page.slice(page.indexOf("eyebrow={t('account.activity.eyebrow')}"));
    expect(afterActivity).toContain("eyebrow={t('account.continue.eyebrow')}");
    expect(page).toContain("import { activityFacts } from '@/lib/portal/focus'");
    expect(page).not.toMatch(/₹|per month|pricing/i);
  });

  it('shows the team as who has access and what each can do', () => {
    const page = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'team', 'page.tsx'));
    expect(page).toContain("title={t('team.title')}");
    expect(MESSAGES['team.title'].en).toBe('Who has access');
    expect(page).toContain("'team.can.staff'");
    expect(MESSAGES['team.can.staff'].en).toBe(
      'Can see everything. Cannot change the team or the account.',
    );
  });

  it('shows the print kit as a deployed system, with what came through it', () => {
    const page = code(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx'));
    expect(page).toContain("source: 'REP_OS_QR'");
    expect(page).toContain("t.plural('kit.status.through', through)");
    expect(MESSAGES['kit.status.through.one'].en).toBe('feedback entry from the card');
    expect(MESSAGES['kit.status.through.other'].en).toBe('feedback entries from the card');
    expect(page).toContain("title={t('kit.intro.title')}");
    expect(MESSAGES['kit.intro.title'].en).toBe('Your feedback card');
  });
});

describe('no gimmicks', () => {
  const files = [
    ['src', 'components', 'portal', 'disclose.tsx'],
    ['src', 'components', 'workspace', 'focus.tsx'],
    ['src', 'components', 'workspace', 'signal-board.tsx'],
    ['src', 'components', 'workspace', 'improvement-story.tsx'],
    ['src', 'components', 'workspace', 'home.tsx'],
    ['src', 'components', 'workspace', 'checkin.tsx'],
    ['src', 'lib', 'portal', 'focus.ts'],
    ['src', 'lib', 'portal', 'evidence.ts'],
  ] as const;

  it('has no confetti, badge, streak, countdown or fake urgency', () => {
    const BANNED =
      /confetti|\bstreak|\bbadge|leaderboard|\bpoints?\b|hurry|last chance|expires (in|soon)|running out|only \d+ (hours?|days?) left|\bnotification/i;
    const offenders = files.filter((f) => BANNED.test(code(read(...f)))).map((f) => f.join('/'));
    expect(offenders).toEqual([]);
  });

  it('never turns a before/after into a cause', () => {
    const CAUSAL = /because of (the|your) change|due to (the|your) change|the change (fixed|helped|worked|caused)/i;
    const offenders = files.filter((f) => CAUSAL.test(code(read(...f)))).map((f) => f.join('/'));
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The demo, against the current feedback blueprint
// ---------------------------------------------------------------------------

const pack = getPackOrFallback('restaurant');
const dimensions = pack.gateway?.dimensions ?? [];
const NOW = new Date('2026-09-07T00:00:00Z');
const story = CORNER_CAFE;

const allPublic: PublicReview[] = [
  ...story.earlyReviews,
  ...story.firstCheckin.reviews,
  ...story.midReviews,
  ...story.lateReviews,
  ...story.secondCheckin.reviews,
];

function reading(text: string, stars: number | null) {
  return normalizeFeedback({ text, stars, pack });
}

describe('the Corner Cafe demo conforms to the current feedback blueprint', () => {
  it('has 87 pieces, and every date is real and in the past', () => {
    expect(storyFeedbackCount()).toBe(87);
    const dated = [
      ...story.earlyReviews,
      ...story.midReviews,
      ...story.lateReviews,
      ...story.qr,
    ].map((x) => new Date(x.at));
    for (const d of dated) {
      expect(Number.isNaN(d.getTime())).toBe(false);
      expect(d.getTime()).toBeLessThan(NOW.getTime());
    }
    for (const checkin of [story.firstCheckin, story.secondCheckin]) {
      for (const review of checkin.reviews) expect(review.at).toBe('');
    }
  });

  it('keeps the timeline in the order it could have happened', () => {
    const t = (iso: string) => new Date(iso).getTime();
    const last = (xs: PublicReview[]) => Math.max(...xs.map((x) => t(x.at)));
    const first = (xs: PublicReview[]) => Math.min(...xs.map((x) => t(x.at)));
    expect(last(story.earlyReviews)).toBeLessThan(t(story.firstCheckin.capturedAt));
    expect(first(story.midReviews)).toBeGreaterThan(t(story.firstCheckin.capturedAt));
    expect(last(story.midReviews)).toBeLessThan(t(story.action.suggestedAt));
    expect(t(story.action.suggestedAt)).toBeLessThan(t(story.action.decidedAt));
    expect(t(story.action.decidedAt)).toBeLessThan(t(story.action.doneAt));
    expect(t(story.action.doneAt)).toBeLessThan(t(story.secondCheckin.capturedAt));
    expect(t(story.secondCheckin.capturedAt)).toBeLessThan(t(story.action.measuredAt));
    // Nothing arrived between the decision and the change, so both piles are whole.
    for (const x of [...story.lateReviews, ...story.qr]) expect(t(x.at)).toBeGreaterThanOrEqual(t(story.action.doneAt));
    // The owner's words came in the right order too.
    expect(t(story.owner.conversation.at)).toBeLessThan(t(story.action.suggestedAt));
    expect(t(story.owner.answer.at)).toBeGreaterThanOrEqual(t(story.action.decidedAt));
    expect(t(story.owner.afterNote.at)).toBeGreaterThanOrEqual(t(story.action.measuredAt));
  });

  it('shapes every table-card submission exactly as the form would store it', () => {
    for (const q of story.qr) {
      const structured = parseStructured(dimensions, { dimensions: q.dimensions, signals: q.signals });
      // Nothing is dropped: every key is one the pack asks about.
      expect(Object.keys(structured.dimensions).sort(), q.at).toEqual(Object.keys(q.dimensions).sort());
      expect(structured.signals.sort(), q.at).toEqual([...q.signals].sort());
      for (const rating of Object.values(q.dimensions)) {
        expect(Number.isInteger(rating) && rating >= 1 && rating <= 5).toBe(true);
      }
      // A specific is only ever offered after a rating of 3 or below.
      for (const signal of q.signals) {
        const dim = dimensions.find((d) => d.signals.some((s) => s.key === signal));
        expect(dim, `${q.at} ${signal}`).toBeDefined();
        expect(q.dimensions[dim!.key], `${q.at} ${signal}`).toBeLessThanOrEqual(3);
      }
      if (q.stars !== null) expect(Number.isInteger(q.stars) && q.stars >= 1 && q.stars <= 5).toBe(true);
      expect(q.text.length).toBeLessThanOrEqual(1500);
      // The gateway refuses an empty submission; every one of these would be accepted.
      const hasWords = /[\p{L}\p{N}]/u.test(q.text);
      expect(hasWords || q.stars !== null || ratedCount(structured) > 0).toBe(true);
      const prepared = prepareIngest(
        { text: q.text, stars: q.stars, occurredAt: new Date(q.at), source: 'REP_OS_QR', structured },
        { allowEmptyText: true },
      );
      expect(prepared.ok, q.at).toBe(true);
      if (prepared.ok) expect(prepared.data.redacted, q.at).toBe(false);
    }
  });

  it('gives the form something to demonstrate: taps with words, taps alone, an overall rating alone', () => {
    const withDims = story.qr.filter((q) => Object.keys(q.dimensions).length > 0);
    const wordless = story.qr.filter((q) => q.text.trim().length === 0);
    const ratingOnly = story.qr.filter((q) => Object.keys(q.dimensions).length === 0 && q.text.trim().length === 0);
    const everyQuestion = story.qr.filter((q) => Object.keys(q.dimensions).length === dimensions.length);
    expect(withDims.length).toBeGreaterThanOrEqual(15);
    expect(wordless.length).toBeGreaterThanOrEqual(3);
    expect(ratingOnly.length).toBeGreaterThanOrEqual(1);
    expect(everyQuestion.length).toBeGreaterThanOrEqual(3);
    expect(story.qr.filter((q) => q.signals.length > 0).length).toBeGreaterThanOrEqual(10);
    expect(story.qr.filter((q) => (q.dimensions.waiting ?? 5) <= 3).length).toBeGreaterThanOrEqual(MIN_MENTIONS_TO_NAME);
  });

  it('keeps public reviews as public reviews: words and a rating, no structure', () => {
    for (const review of allPublic) {
      expect(review.text.trim().length).toBeGreaterThan(0);
      expect('dimensions' in review).toBe(false);
      if (review.stars !== null) expect(review.stars >= 1 && review.stars <= 5).toBe(true);
    }
    expect(allPublic.filter((r) => r.stars === null).length).toBeGreaterThanOrEqual(1);
  });

  it('is written by many people, not one template', () => {
    const texts = [...allPublic.map((r) => r.text), ...story.qr.map((q) => q.text)].filter((t) => t.trim().length > 0);
    const prints = texts.map((t) => fingerprintFeedback(t));
    expect(new Set(prints).size).toBe(prints.length);
    const CLOSERS = / (this time|again|on our last visit|as usual|this month|last week|on my second visit|at the weekend|during the evening rush|once more)\.?$/;
    expect(texts.filter((t) => CLOSERS.test(t))).toEqual([]);
    // No two texts share their first six words.
    const openings = texts.map((t) => t.toLowerCase().split(/\s+/).slice(0, 6).join(' '));
    expect(new Set(openings).size).toBe(openings.length);
    // Different lengths, three languages.
    const lengths = texts.map((t) => t.length);
    expect(Math.min(...lengths)).toBeLessThan(30);
    expect(Math.max(...lengths)).toBeGreaterThan(120);
    const languages = new Set(texts.map((t) => reading(t, null).language));
    expect(languages.has('en')).toBe(true);
    expect(languages.has('mixed')).toBe(true);
    expect(languages.has('mr')).toBe(true);
  });

  it('carries no personal details', () => {
    const texts = [...allPublic.map((r) => r.text), ...story.qr.map((q) => q.text)];
    for (const t of texts) {
      expect(t).not.toMatch(/@|\d{7,}|\+91/);
      expect(t).not.toMatch(/\b(?:mr|mrs|ms|dr)\.? [A-Z]/);
    }
  });

  it('reads, through the real deterministic reader, as the story the pages tell', () => {
    const rows = [
      ...story.earlyReviews.map((r) => ({ at: r.at, ...reading(r.text, r.stars) })),
      ...story.firstCheckin.reviews.map((r) => ({ at: story.firstCheckin.capturedAt, ...reading(r.text, r.stars) })),
      ...story.midReviews.map((r) => ({ at: r.at, ...reading(r.text, r.stars) })),
      ...story.lateReviews.map((r) => ({ at: r.at, ...reading(r.text, r.stars) })),
      ...story.secondCheckin.reviews.map((r) => ({ at: story.secondCheckin.capturedAt, ...reading(r.text, r.stars) })),
      ...story.qr.map((q) => ({ at: q.at, ...reading(q.text, q.stars) })),
    ];
    const count = (key: string, pred: (at: string) => boolean = () => true) =>
      rows.filter((r) => pred(r.at) && r.themes.some((t) => t.key === key)).length;
    const total = rows.length;
    const before = rows.filter((r) => r.at < story.action.doneAt).length;
    const after = total - before;

    // The one thing worth attention, and its share.
    const speed = count('service_speed');
    expect(speed / total).toBeGreaterThan(0.3);
    expect(speed / total).toBeLessThan(0.5);
    // More often after the change: the measurement engine's own 5-point floor, comfortably.
    const speedBefore = count('service_speed', (at) => at < story.action.doneAt) / before;
    const speedAfter = count('service_speed', (at) => at >= story.action.doneAt) / after;
    expect(speedAfter - speedBefore).toBeGreaterThan(0.1);
    expect(after).toBeGreaterThanOrEqual(10);
    expect(before).toBeGreaterThanOrEqual(10);

    // The strength worth protecting is the food, and it outnumbers every other praise.
    const praise = ['food_taste', 'staff_warmth', 'value_for_money', 'ambience'].map((k) => [k, count(k)] as const);
    expect(praise[0]![1]).toBeGreaterThanOrEqual(MIN_MENTIONS_TO_NAME * 2);
    for (const [key, n] of praise.slice(1)) expect(praise[0]![1], key).toBeGreaterThan(n);
    // A second issue is watched, below the first.
    const order = count('order_accuracy');
    expect(order).toBeGreaterThanOrEqual(MIN_MENTIONS_TO_NAME);
    expect(order).toBeLessThan(speed);
    // The second check-in raised both more than the first.
    const at1 = (key: string) => count(key, (at) => at === story.firstCheckin.capturedAt);
    const at2 = (key: string) => count(key, (at) => at === story.secondCheckin.capturedAt);
    expect(at2('service_speed') - at1('service_speed')).toBeGreaterThanOrEqual(2);
    expect(at2('order_accuracy') - at1('order_accuracy')).toBeGreaterThanOrEqual(2);
    // A few things mentioned once or twice, so "isolated mentions" is a real count.
    const keys = new Set(rows.flatMap((r) => r.themes.map((t) => t.key)));
    const isolated = [...keys].filter((k) => count(k) > 0 && count(k) < MIN_MENTIONS_TO_NAME);
    expect(isolated.length).toBeGreaterThanOrEqual(3);
  });
});
