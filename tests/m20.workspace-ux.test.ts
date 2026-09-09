import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * THE OWNER EXPERIENCE, AS SHIPPED (launch pass).
 *
 * Source-level, like `m20.prefetch.test.ts`, because what is asserted here is
 * wording and structure an owner sees, and the components are server
 * components with no renderer in this suite. Each rule below is one an owner
 * would notice breaking and nobody would notice in a type check:
 *
 *   - every piece of feedback separates what the CUSTOMER GAVE from what
 *     REPOS UNDERSTOOD;
 *   - the workspace has six doors, and the week and month reports are reached
 *     from Check-in rather than as tabs of their own;
 *   - one word for one idea: Watching, What we know, What we cannot tell you,
 *     What we recommend;
 *   - an empty page is hopeful, never "No data".
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

describe('every piece of feedback', () => {
  const ui = code(read('components', 'portal', 'portal-ui.tsx'));
  const row = between(ui, 'export function ReviewRow(', 'export function RatingStrip(');

  it('separates what the customer gave from what Headway understood', () => {
    expect(row).toContain('Customer gave');
    expect(row).toContain('Headway understood');
    expect(row.indexOf('Customer gave')).toBeLessThan(row.indexOf('Headway understood'));
  });

  it('shows the overall stars, each part rated out of 5, the selected specifics and the words', () => {
    expect(row).toContain('<Stars value={item.stars} />');
    expect(row).toContain('gave.dimensions.map');
    expect(row).toContain('/5');
    expect(row).toContain('gave.selected.map');
    expect(row).toContain('Selected');
    expect(row).toContain('Written');
    expect(row).toContain('{item.text}');
  });

  it('never dresses up a rating-only submission as words', () => {
    expect(row).toContain('A rating only — no written comment.');
    expect(row).toContain('Nothing written — the ratings above are the whole message.');
  });

  it('keeps the themes on the Headway side, joined as a reading', () => {
    const understood = row.slice(row.indexOf('Headway understood'));
    expect(understood).toContain("{item.state === 'ANALYSED' ? (");
    expect(understood).toContain("item.themes.join(' · ')");
    expect(understood).toContain('Nothing here matched a topic Headway tracks.');
    expect(understood).toContain('in tone');
    expect(understood).toContain('Sorted as');
  });

  it('tells the four states apart: read, being read, waiting, could not read', () => {
    const understood = row.slice(row.indexOf('Headway understood'));
    expect(understood).toContain('Headway is reading this now.');
    expect(understood).toContain('Waiting for Headway to read it — usually within a minute of arriving.');
    expect(understood).toContain('Headway could not read this one yet. It will try again on its own.');
    expect(understood).not.toContain('Not read yet');
  });
});

describe('the reviews page', () => {
  const page = code(read('components', 'workspace', 'reviews.tsx'));
  const ui = code(read('components', 'portal', 'portal-ui.tsx'));

  it('offers the five ratings as one-tap filters, five stars first', () => {
    expect(page).toContain(
      '<RatingStrip base={base} ratings={view.ratings} active={view.filters.stars} />',
    );
    const strip = between(ui, 'export function RatingStrip(', 'export function PeriodSwitch(');
    expect(strip).toContain('.sort((a, b) => b.stars - a.stars)');
    expect(strip).toContain('href={`${base}?stars=${r.stars}`}');
    expect(strip).toContain("aria-current={active === r.stars ? 'page' : undefined}");
  });

  it('is hopeful before the first customer, never empty', () => {
    // Empty says what happens next, and how it starts, rather than stopping at
    // the absence.
    expect(page).toContain(
      'Nothing has come in yet. Feedback starts arriving once customers scan your QR code.',
    );
    expect(page).not.toContain('No feedback has been collected yet');
    expect(page).not.toMatch(/No data/i);
  });

  it('opens with the counts that matter and says when Headway is still reading', () => {
    expect(page).toContain('<StatusStrip');
    expect(page).toContain("{ label: 'read by Headway', value: view.analysed }");
    expect(page).toContain("{ label: 'being read now', value: inHand, tone: 'warn' as const }");
    expect(page).toContain(
      'Feedback has arrived. Headway is reading it now — usually under a minute. Reload to see what it found.',
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
  const labels = [...block.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  const slugs = [...block.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);

  it('has the doors an owner thinks in, in that order', () => {
    // Five on the shared link; three more once somebody is signed in. M21 added
    // the print kit (the one physical object in the product, which an owner
    // previously had to be sent) and the account.
    expect(labels).toEqual([
      'Home',
      'Customers',
      'Feedback',
      'Improvements',
      'Check-in',
      'Team',
      'Print kit',
      'Account',
    ]);
    // The door reads "Feedback" because what it lists is private customer
    // feedback, which this product promises is never posted publicly. The slug
    // stays `reviews`: a URL is not copy, and old links must keep working.
    expect(slugs).toContain('reviews');
  });

  it('keeps the extra doors out of the read-only shared link', () => {
    const extras = [...block.matchAll(/label: '([^']+)', extra: true/g)].map((m) => m[1]);
    expect(extras).toEqual(['Team', 'Print kit', 'Account']);
  });

  it('keeps every door on screen: wrapping on a phone, pinned from tablet up, finger-sized', () => {
    expect(source).toContain('flex flex-wrap');
    expect(source).not.toContain('overflow-x-auto');
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
    expect(report).toContain('eyebrow="Check-in"');
    const checkin = code(read('components', 'workspace', 'checkin.tsx'));
    expect(checkin).toContain('<PeriodSwitch basePath={basePath} current="checkin" />');
  });
});

describe('home, as a command centre', () => {
  const home = code(read('components', 'workspace', 'home.tsx'));
  const focus = code(read('components', 'workspace', 'focus.tsx'));
  const responsibility = code(read('components', 'portal', 'responsibility.tsx'));

  it('leads with one dominant block the owner can stop after', () => {
    // The hierarchy IS the design (M24). Anything that reorders these blocks
    // is changing what an owner reads first, which is not a styling decision.
    const order = [
      '<FocusBlock focus={focus} direction={direction} />', // right now, do I need to act, next step
      'eyebrow="Headway is watching"', // what is being carried
      'eyebrow="Going well"', // what to protect
      '<SinceVisit since={since}', // what changed while away
      'eyebrow="Your next check-in"', // when the next check-in is worth opening
      '<Limits limits={r.limitations} collapsed />', // what we cannot tell you, one tap away
    ];
    const at = order.map((token) => {
      const i = home.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(focus).toContain('Right now');
    expect(focus).toContain('What to do');
  });

  it('keeps what is going well apart from what is being watched', () => {
    expect(home).toContain("r.watching.filter((i) => i.state === 'KEEP_DOING')");
    expect(home).toContain("r.watching.filter((i) => i.state !== 'KEEP_DOING')");
    expect(home).toContain('eyebrow="Going well"');
    expect(home).toContain('<WatchingList items={watching} basePath={basePath} />');
  });

  it('pairs the carried things with what is next, and stacks them on a phone', () => {
    expect(home).toContain(
      'grid grid-cols-1 items-start gap-x-10 gap-y-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
    );
    expect(home).toContain('<aside');
    expect(home.indexOf('<FocusBlock')).toBeLessThan(home.indexOf('<aside'));
  });

  it('opens with the answer, never with arithmetic', () => {
    // An earlier version opened with a row of numbers, and a later one closed
    // with a grid that repeated the answer as figures. Neither survives: the
    // block is first, and no figure on the page is stated twice.
    expect(home.indexOf('<FocusBlock')).toBeLessThan(home.indexOf('<Section'));
    expect(home).not.toContain('<Tallies');
    expect(home).not.toMatch(/\+\d+%/);
  });

  it("shows the first customers' signals before anything is a pattern, and never a blank", () => {
    expect(home).toContain('<SoFar soFar={view.soFar} basePath={basePath} />');
    expect(home).toContain('eyebrow="What customers are mentioning so far"');
    // Counted, and said to be counts — never dressed up as a conclusion.
    expect(home).toContain('note="Counts, not conclusions"');
    expect(focus).toContain('{focus.cta.label}');
    // Before the first piece of feedback the page still says what will happen
    // and where it comes from, rather than stopping at the absence.
    expect(home).toMatch(
      /Nothing has come in yet\. Once customers leave feedback through your QR code, this\s+page will say what matters and whether anything needs you\./,
    );
    expect(home).not.toMatch(/No data/i);
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
    expect(row).toContain('{item.evidence.count} of {item.evidence.outOf}');
    expect(row).toContain('<StateChip item={item} />');
    expect(row).toContain('{item.recommendedNextStep}');
    expect(row).not.toMatch(/badge|streak|confetti|points|\bxp\b/i);
  });

  it('says when the next check-in is worth opening, as a condition', () => {
    expect(home).toContain('eyebrow="Your next check-in"');
    expect(home).toContain('{r.nextUsefulCheck}');
    expect(home).not.toMatch(/countdown|days left|streak/i);
  });
});

describe('one word for one idea', () => {
  const ui = code(read('components', 'portal', 'portal-ui.tsx'));
  const story = code(read('components', 'workspace', 'improvement-story.tsx'));
  const disclose = code(read('components', 'portal', 'disclose.tsx'));

  it('says Watching wherever a theme is being watched', () => {
    expect(ui).toContain("watch: 'Watching',");
    expect(ui).not.toContain('Headway will watch');
    expect(ui).not.toContain("'Watch this'");
  });

  it('labels what happened, what it means and what to do now, with the limit beside the finding', () => {
    expect(story).toContain('What happened');
    expect(story).toContain('What this means');
    expect(story).toContain('What to do now');
    // The engine's full sentence where it has one, its short one otherwise —
    // never both, which used to say the same thing twice in two lengths.
    expect(story).toContain('{outcome.caveat || outcome.note}');
    expect(disclose).toContain('{p.caveat}');
    expect(disclose.indexOf('{p.caveat}')).toBeLessThan(disclose.indexOf('Why Headway says this'));
  });

  it('reads the improvement loop as The problem · You changed · Headway checked again', () => {
    expect(story).toContain('label="The problem"');
    expect(story).toContain("declined ? 'Not doing' : 'You changed'");
    expect(story).toContain('label="Headway checked again"');
    expect(disclose).toContain("label: 'Before'");
    expect(disclose).toContain("label: 'After'");
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
      ['components', 'workspace', 'focus.tsx'],
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
    expect(between(ui, 'export function RatingStrip(', 'export function PeriodSwitch(')).toContain('min-w-11');
    expect(code(read('components', 'workspace', 'reviews.tsx'))).toContain("'h-11 w-full rounded-md");
  });

  it('has a calm error state for the workspace', () => {
    const error = code(read('app', '(workspace)', 'workspace', '[clientId]', 'error.tsx'));
    expect(error).toContain("'use client'");
    expect(error).toContain('Try again');
    expect(error).toContain('Back to Home');
    expect(error).not.toMatch(/error\.message|error\.digest|\.stack/);
  });
});
