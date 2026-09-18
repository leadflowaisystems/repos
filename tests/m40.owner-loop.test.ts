import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, type MessageKey } from '@/lib/i18n/strings';
import { TRANSITIONS, type ActionStatus } from '@/lib/improve/model';
import { movesFor } from '@/lib/improve/owner-moves';
import { BANNED_IN_OWNER_TEXT } from '@/lib/i18n/glossary';

/**
 * THE OWNER'S HALF OF THE IMPROVEMENT LOOP (owner action-loop pass).
 *
 * The loop has existed since M11 and worked the whole time. What it did not
 * have was a way for the BUSINESS OWNER to move it — only the operator
 * console had buttons — so Improvements was a report about the owner rather
 * than a loop they were in. This file pins the half that was added, and the
 * four claims that make it trustworthy rather than merely present:
 *
 *   IT IS THE SAME LOOP. One table, one state machine, one measurement. A
 *   second action system would immediately disagree with the first about what
 *   had been decided, and the owner would be the one to find out.
 *
 *   NO BUTTON OFFERS AN ILLEGAL MOVE. Every choice the owner is shown is a
 *   transition `improve/model.ts` already allows from where the action stands.
 *   The server re-checks, so this is about not offering — being refused after
 *   pressing is the failure this prevents.
 *
 *   HEADWAY NEVER CLAIMS A CAUSE. "after the change" is the whole relationship
 *   it can honestly state between a decision and a count that moved.
 *
 *   AND IT NEVER CONGRATULATES ANYBODY. Pressing "Done" produces a statement
 *   of what happens next, not praise. The reward is the measured outcome.
 *
 * Source-level, like the other experience tests, because these are server
 * components and a client component with no renderer in this suite.
 */

const ROOT = resolve(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

/** The file with its comments removed, so prose cannot satisfy a rule. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

function says(key: MessageKey): string {
  return MESSAGES[key].en;
}

const ACTION = code(read('src', 'lib', 'actions', 'improve.ts'));
const DECISION = code(read('src', 'components', 'workspace', 'owner-decision.tsx'));
const BRIEF = code(read('src', 'components', 'workspace', 'brief.tsx'));
const IMPROVEMENTS = code(read('src', 'components', 'workspace', 'improvements.tsx'));
const REVIEWS = code(read('src', 'components', 'workspace', 'reviews.tsx'));

// ---------------------------------------------------------------------------
// It is the same loop
// ---------------------------------------------------------------------------

describe('the owner moves the loop that already existed', () => {
  it('calls the M11 services rather than writing to the table itself', () => {
    expect(ACTION).toContain('createActionForTheme(prisma, clientId, themeKey)');
    expect(ACTION).toContain('decideAction(prisma, clientId, actionId, {');
    expect(ACTION).toContain('moveAction(prisma, clientId, actionId, {');
    // No second path into the improvement table, and no second table.
    expect(ACTION).not.toMatch(/prisma\.improvementAction\.(create|update|upsert|delete)/);
  });

  it('needed no new permission: an owner already passes the member gate', () => {
    // `tenantGate(form, 'MEMBER')` resolves to `canRead`, and an owner can
    // read their own business. If this ever becomes 'OWNER' the loop silently
    // closes for staff members who were using it.
    expect(ACTION).toContain("tenantGate(form, 'MEMBER')");
    const guard = code(read('src', 'lib', 'auth', 'guard.ts'));
    expect(guard).toContain("const allowed = level === 'OWNER' ? canManage(actor, clientId) : canRead(actor, clientId);");
  });

  it('refuses a move it cannot attribute to a business', () => {
    expect(ACTION).toContain('if (!gate.ok) return gate.state;');
    expect(ACTION).toContain('if (!actionId && !themeKey) {');
  });

  it('will not open a loop with anything but the first decision', () => {
    // Marking an undecided suggestion "done", or declining a thing that was
    // never put to the owner, would both write a record of something that did
    // not happen.
    expect(ACTION).toContain("if (choice !== 'HANDLE') {");
  });

  it('records what was agreed in the product’s own frozen words', () => {
    // The service refuses an accept with no record of the decision. A one-tap
    // accept means the recommendation as shown — never a sentence this layer
    // invented and attributed to the owner.
    expect(ACTION).toContain('current.provenance.recommendationText.trim() || current.title');
  });

  it('files no minute for a tap', () => {
    // A minute is the operator's written record of a conversation. A tap on a
    // phone is not one.
    expect(ACTION).toContain('recordMinute: false');
  });

  it('refreshes every page that reads the loop', () => {
    for (const path of ['', '/improvements', '/analysis', '/checkin']) {
      expect(ACTION).toContain(`revalidatePath(\`/workspace/\${clientId}${path}\`)`);
    }
  });
});

// ---------------------------------------------------------------------------
// No button offers an illegal move
// ---------------------------------------------------------------------------

describe('every button the owner sees is a move the machine allows', () => {
  /** The owner's four words, and the state each one asks the machine for. */
  const TARGET: Record<string, ActionStatus> = {
    HANDLE: 'ACCEPTED',
    DONE: 'DONE',
    WATCH: 'PAUSED',
    NOT_DOING: 'DECLINED',
  };

  it('never offers a transition TRANSITIONS would refuse, from any status', () => {
    // Exhaustive over the machine's own states, and asked of the real
    // function rather than of its source text.
    //
    // REVISIT is the one choice that is not a move — it opens a NEW action
    // rather than transitioning the declined one — so it is excluded here and
    // pinned on its own below. Excluding it by NAME rather than by "anything
    // without a target" is deliberate: a fifth choice added tomorrow with no
    // target still fails this, which is the point.
    const illegal: string[] = [];
    for (const status of Object.keys(TRANSITIONS) as ActionStatus[]) {
      for (const choice of movesFor(status)) {
        if (choice === 'REVISIT') continue;
        const to = TARGET[choice];
        if (!to) {
          illegal.push(`${status}: unknown choice ${choice}`);
          continue;
        }
        if (!TRANSITIONS[status].includes(to)) {
          illegal.push(`${status} → ${to} (offered as ${choice})`);
        }
      }
    }
    expect(illegal).toEqual([]);
  });

  it('offers REVISIT from exactly one state, and it is the terminal one', () => {
    const offering = (Object.keys(TRANSITIONS) as ActionStatus[]).filter((s) =>
      movesFor(s).includes('REVISIT'),
    );
    expect(offering).toEqual(['DECLINED']);
  });

  it('offers only the first decision on a theme nobody has decided yet', () => {
    // Marking an undecided suggestion "done", or declining a thing that was
    // never put to the owner, would each record something that did not happen.
    expect(movesFor(null)).toEqual(['HANDLE']);
  });

  it('offers nothing once a change is made or measured, rather than a dead button', () => {
    expect(movesFor('DONE')).toEqual([]);
    expect(movesFor('MEASURED')).toEqual([]);
  });

  it('separates an accepted change from a paused one, which stage and state do not', () => {
    // `stage` and `actionState` both merge ACCEPTED with PAUSED. Reading
    // either would offer "Done" on a paused action, which the machine refuses.
    expect(movesFor('ACCEPTED')).toEqual(['DONE', 'WATCH']);
    expect(movesFor('PAUSED')).toEqual(['HANDLE', 'NOT_DOING']);
    // So every surface keys off the loop's own status.
    expect(BRIEF).toContain('movesFor(card.loop.status)');
    expect(IMPROVEMENTS).toContain('movesFor(a.status)');
    // Feedback now tells a selected topic as a story (final experience pass),
    // and the story is handed the topic's own signal.
    expect(REVIEWS).toContain('movesFor(signal.actionStatus)');
  });

  it('lives where the server can call it, not inside the client button', () => {
    // It started in the decision component, which is `'use client'`. Every
    // page that needs it is a SERVER component, so calling it type-checked,
    // passed every source-level rule here, and threw at request time. Only a
    // browser could have found that, and one did.
    expect(DECISION).not.toContain('export function movesFor');
    expect(DECISION).not.toContain('export const OWNER_MOVES');
    const moves = code(read('src', 'lib', 'improve', 'owner-moves.ts'));
    expect(moves).not.toContain("'use client'");
    // And legality is asked of the machine rather than restated beside it.
    expect(moves).toContain('canTransition(status, CHOICE_TARGET[choice])');
  });

  it('leaves "not doing this" reconsiderable, without moving the declined row', () => {
    // A business changes its mind, and "no" was a dead end: no button, and a
    // sentence telling the owner what they had decided.
    expect(movesFor('DECLINED')).toEqual(['REVISIT']);
    // The MACHINE is untouched. DECLINED is still terminal, because that row
    // records a decision that was genuinely made on a date, and rewriting it
    // would lose exactly the memory this product sells.
    expect(TRANSITIONS.DECLINED).toEqual([]);
  });

  it('revisits by opening a new action, which is what the machine already said to do', () => {
    // `transitionError` has told the operator since M11: "create a new one if
    // the business changes its mind". Revisit is a button in front of that
    // path, not a loosened state machine.
    expect(ACTION).toContain("if (choice === 'REVISIT') {");
    expect(ACTION).toContain('const reopened = await createActionForTheme(prisma, clientId, themeKey);');
    // The duplicate guard skips declined rows, which is what makes it legal…
    const service = code(read('src', 'lib', 'improve', 'service.ts'));
    expect(service).toContain("status: { notIn: ['DECLINED'] }");
    // …and the new action outranks the declined one, so the theme reports it.
    const view = code(read('src', 'lib', 'portal', 'view.ts'));
    expect(view).toContain('DECLINED: 1,');
    expect(view).toContain('RECOMMENDED: 2,');
  });

  it('stops revisiting at undecided, so it can never be mistaken for "done"', () => {
    // Revisit puts something back on the table; it does not decide it. The
    // confirmation has to say so, or an owner will believe they committed.
    expect(says('loop.choice.revisit')).toBe('Revisit this');
    expect(says('loop.saved.revisit')).toBe('Back on your list. Decide when you are ready.');
    expect(says('loop.saved.revisit')).not.toMatch(/done|watch|chang/i);
    // And the action returns before any decide/move call runs.
    const revisit = ACTION.slice(
      ACTION.indexOf("if (choice === 'REVISIT') {"),
      ACTION.indexOf('if (!actionId) {'),
    );
    expect(revisit).toContain('return success(choice);');
    expect(revisit).not.toMatch(/decideAction|moveAction/);
  });

  it('gives a declined decision somewhere it can always be found', () => {
    // On Home and Feedback the button appears wherever the theme does. The
    // action centre carries the shelf, because that is where an owner looks
    // for a decision they made and want back.
    expect(IMPROVEMENTS).toContain("t('loop.shelf.notDoing')");
    expect(says('loop.shelf.notDoing')).toBe('Not doing');
    expect(IMPROVEMENTS).toContain('view.notPursued.map');
    expect(IMPROVEMENTS).toContain('choices: movesFor(a.status)');
  });

  it('offers no decision on a strength, where there is nothing to decide', () => {
    // "Customers like this / Food quality / Keep the portions as they are"
    // followed by "I'll handle this" is nonsense. Praise is a thing to
    // protect, not a change anybody decided to make.
    // On Home the decision belongs to the story of the problem and is drawn
    // only when there is a move to make; the strength row never carries one.
    const story = BRIEF.slice(BRIEF.indexOf('async function Story('), BRIEF.indexOf('async function Calm('));
    expect(story).toContain('clientId && choices.length > 0 ? (');
    const loved = BRIEF.slice(BRIEF.indexOf('async function Loved('), BRIEF.indexOf('async function Changed('));
    expect(loved).not.toContain('<OwnerDecision');
    // Nor does Feedback's story of a strength: its fourth step is "keep doing".
    expect(REVIEWS).toContain("t('feedback.story.keep')");
  });
});

// ---------------------------------------------------------------------------
// Notice → decide → do → check → learn, on the screens an owner uses
// ---------------------------------------------------------------------------

describe('the loop is reachable where the owner already is', () => {
  it('puts the decision on Home, under the problem it is about', () => {
    expect(BRIEF).toContain('<OwnerDecision');
    // After the conclusion, the count, the reading and the action — never before.
    const at = ['{card.count}', '{card.line}', '{card.action}', '<OwnerDecision'].map((token) => {
      const i = BRIEF.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('puts it on Feedback, beside the words it rests on', () => {
    // The connection this pass was written for: the customers' words, what
    // Headway makes of them, and the decision, on one screen. Before this an
    // owner read the evidence here and had to go elsewhere to act.
    //
    // Since the final experience pass the selected topic is told as a story:
    // the customers' words first, then what Headway thinks, then what to do —
    // with the decision right there.
    const at = [
      "t('feedback.story.said')",
      "t('feedback.story.thinks')",
      '{signal.brief}',
      "t('feedback.story.todo')",
      '{signal.suggestion ?? signal.nextStep}',
      '<OwnerDecision',
      "t('feedback.story.next')",
    ].map((token) => {
      const i = REVIEWS.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(says('feedback.story.said')).toBe('What customers said');
    expect(says('feedback.story.thinks')).toBe('What Headway thinks');
    expect(says('feedback.story.todo')).toBe('What to do');
  });

  it('only pays for that reading when a topic is actually selected', () => {
    // The whole signal costs a core load. The unfiltered inbox cannot use it
    // and does not pay for it.
    expect(REVIEWS).toContain('const selected = filters.theme');
  });

  it('lays the action centre out as the five places a thing can be', () => {
    // Do now · Headway is watching · Checked · Keep doing · Not doing. The
    // "checking" and "waiting" shelves of the first version became one —
    // "Headway is watching" — whose rows say which of the two they are.
    const order = [
      "t('loop.shelf.doNow')",
      "t('loop.shelf.watching')",
      "t('loop.shelf.completed')",
      "t('loop.shelf.keepDoing')",
      "t('loop.shelf.notDoing')",
    ];
    const at = order.map((token) => {
      const i = IMPROVEMENTS.indexOf(token);
      expect(i, token).toBeGreaterThan(-1);
      return i;
    });
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(says('loop.shelf.doNow')).toBe('Do now');
    expect(says('loop.shelf.watching')).toBe('Headway is watching');
    expect(says('loop.shelf.completed')).toBe('Checked');
    expect(says('loop.shelf.notDoing')).toBe('Not doing');
  });

  it('splits "changed" by whether enough feedback has arrived, not by opinion', () => {
    // An owner cannot tick "checked": only new customer feedback moves a thing
    // onto that shelf. That is the product, and it is why the waiting shelf
    // exists rather than being folded into the one above it.
    // `awaiting` is a progress figure on EVERY made change, not a flag. The
    // split compares its two numbers, as the responsibility engine does — the
    // first version read it as a flag and filed a change with 30 new entries
    // under "waiting". tests/m40.owner-loop-e2e.test.ts proves this against a
    // real database; this pins the comparison in the source.
    expect(IMPROVEMENTS).toContain('return a.awaiting === null || a.awaiting.have >= a.awaiting.need;');
    // A made change is READY to check or still COLLECTING, and which one is
    // that comparison, never a choice.
    expect(IMPROVEMENTS).toContain('return enoughToCheck(a)');
    expect(IMPROVEMENTS).toContain("watch: 'READY'");
    expect(IMPROVEMENTS).toContain("watch: 'COLLECTING'");
    expect(IMPROVEMENTS).not.toContain('done.filter((a) => !a.awaiting)');
    expect(IMPROVEMENTS).not.toMatch(/draggable|onDragStart|dueDate|priority|assignee/i);
  });
});

// ---------------------------------------------------------------------------
// What Headway says back
// ---------------------------------------------------------------------------

describe('Headway answers a decision with what happens next, never with praise', () => {
  it('says what it will do, for each of the four choices', () => {
    expect(says('loop.saved.done')).toBe('Got it. Headway will watch the next feedback for this.');
    expect(says('loop.saved.handle')).toBe('Got it. Tell Headway when the change is made.');
    expect(says('loop.saved.watch')).toBe('Got it. Headway will keep counting this one.');
    expect(says('loop.saved.notDoing')).toBe('Got it. Headway will stop suggesting this.');
  });

  it('congratulates nobody, and invents no urgency', () => {
    const PRAISE = /well done|great job|congratulat|nice work|amazing|awesome|keep it up|🎉|🙌/i;
    const URGENCY = /hurry|act now|last chance|don.t miss|running out|expires soon|only \d+ left/i;
    for (const [key, phrase] of Object.entries(MESSAGES)) {
      if (!key.startsWith('loop.')) continue;
      expect(phrase.en, key).not.toMatch(PRAISE);
      expect(phrase.en, key).not.toMatch(URGENCY);
    }
  });

  it('has no streak, badge, points or progress bar anywhere in the loop', () => {
    const GAMIFY = /confetti|\bstreak|\bbadge|leaderboard|\bpoints?\b|\btrophy|<progress|role="progressbar"/i;
    for (const [name, source] of [
      ['owner-decision', DECISION],
      ['improvements', IMPROVEMENTS],
      ['brief', BRIEF],
      ['actions/improve', ACTION],
    ] as const) {
      expect(source, name).not.toMatch(GAMIFY);
    }
  });

  it('answers in the owner’s own language, not the server’s English', () => {
    // Server actions in this codebase return an English sentence. That is
    // right for the operator console and wrong on a screen read in Marathi,
    // so the action returns the CHOICE and the component says the sentence.
    expect(ACTION).toContain('return success(choice);');
    expect(DECISION).toContain('t(SAVED[saved])');
  });
});

// ---------------------------------------------------------------------------
// Never a cause, and never an overclaim
// ---------------------------------------------------------------------------

describe('the loop states what was observed, never what it caused', () => {
  const CAUSAL =
    /because of (the|your) change|due to (the|your) change|the change (fixed|helped|worked|caused)|thanks to your|your change (worked|fixed)/i;

  it('never turns a before and after into a cause', () => {
    for (const [name, source] of [
      ['owner-decision', DECISION],
      ['improvements', IMPROVEMENTS],
      ['brief', BRIEF],
    ] as const) {
      expect(source, name).not.toMatch(CAUSAL);
    }
    for (const [key, phrase] of Object.entries(MESSAGES)) {
      if (!key.startsWith('loop.')) continue;
      expect(phrase.en, key).not.toMatch(CAUSAL);
    }
  });

  it('says plainly when there is not enough feedback to call it', () => {
    expect(says('loop.waiting.tooEarly')).toBe('Too early to tell');
    expect(IMPROVEMENTS).toContain("t('loop.waiting.tooEarly')");
    // Counts, never a bar: a progress bar implies a finish line the owner
    // controls, and this one moves with the customers.
    expect(IMPROVEMENTS).toContain("t.plural('loop.waiting.need'");
    expect(IMPROVEMENTS).not.toMatch(/<progress|width: `\$\{.*%\}`/);
  });

  it('shows a change that made things worse on the same shelf as one that helped', () => {
    // Hiding it would make the record a trophy cabinet, and the record is the
    // reason to keep paying for this.
    expect(IMPROVEMENTS).toContain('view.checked.map');
    expect(IMPROVEMENTS).not.toMatch(/checked\.filter\([^)]*outcome\?\.good\)/);
    // And the arrow is coloured by what the engine judged, not by direction.
    expect(IMPROVEMENTS).toContain("a.outcome.result === 'IMPROVED'");
    expect(IMPROVEMENTS).toContain("a.outcome.result === 'WORSENED'");
  });

  it('keeps the before and after counts on the record, not just an adjective', () => {
    // By month three this shelf IS the owner's memory of what they changed
    // and what customers said afterward. A record made of adjectives is not
    // one.
    expect(IMPROVEMENTS).toContain('a.outcome.beforeCount');
    expect(IMPROVEMENTS).toContain('a.outcome.afterCount');
  });
});

// ---------------------------------------------------------------------------
// The words themselves
// ---------------------------------------------------------------------------

describe('the four choices read as a person would say them', () => {
  it('says them in all three languages, on one line', () => {
    const keys: MessageKey[] = [
      'loop.choice.handle',
      'loop.choice.done',
      'loop.choice.watch',
      'loop.choice.notDoing',
    ];
    for (const key of keys) {
      const phrase = MESSAGES[key];
      expect(phrase.hi, `${key} has no Hindi`).toBeTruthy();
      expect(phrase.mr, `${key} has no Marathi`).toBeTruthy();
      // Short enough for a button at 375px, in Devanagari as well as Latin.
      for (const text of [phrase.en, phrase.hi, phrase.mr]) {
        expect((text as string).length, `${key}: “${text}”`).toBeLessThanOrEqual(22);
      }
    }
    expect(says('loop.choice.handle')).toBe("I'll handle this");
    expect(says('loop.choice.done')).toBe('Done');
  });

  it('uses none of the banned words', () => {
    for (const [key, phrase] of Object.entries(MESSAGES)) {
      if (!key.startsWith('loop.')) continue;
      for (const banned of BANNED_IN_OWNER_TEXT) {
        expect(phrase.en.toLowerCase(), `${key} contains “${banned}”`).not.toContain(
          banned.toLowerCase(),
        );
      }
    }
  });

  it('asks for no form, no date and no note', () => {
    // The smallest useful interaction. Anything more turns this into project
    // management software, which is the one thing it must not become.
    expect(DECISION).not.toMatch(/<textarea|<select|type="date"|type="text"/);
    expect(DECISION).toMatch(/type="hidden"/);
  });

  it('gives every choice a thumb-sized target', () => {
    expect(DECISION).toContain('min-h-12');
    expect(DECISION).not.toMatch(/min-h-9|min-h-10/);
  });
});
