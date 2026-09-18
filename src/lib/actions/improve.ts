'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import {
  createActionForTheme,
  createActionFromInsight,
  decideAction,
  getAction,
  measureClientAction,
  moveAction,
  recordLearning,
} from '@/lib/improve/service';
import { bool, failure, optDate, str, success, text, type ActionState } from './shared';
import { tenantGate } from '@/lib/auth/guard';

/**
 * Improvement action loop (M11).
 *
 * Every one of these is a human pressing a button about a business change.
 * Nothing here sends, posts or schedules anything, and nothing measures itself:
 * the operator asks for a measurement, and it reads only feedback they have
 * already pasted in.
 */

function revalidateActions(clientId: string) {
  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
}

export async function createActionFromInsightAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const insightId = str(form, 'insightId');
  if (!clientId || !insightId) {
    return failure('Could not tell which insight this is. Reload the page and try again.');
  }

  const result = await createActionFromInsight(prisma, clientId, insightId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success('Added. Record what the business decides.');
}

export async function decideActionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) {
    return failure('Could not tell which improvement this is. Reload the page and try again.');
  }

  const result = await decideAction(prisma, clientId, actionId, {
    decision: str(form, 'decision'),
    description: text(form, 'description'),
    statusNote: text(form, 'statusNote'),
    recordMinute: bool(form, 'recordMinute'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  revalidatePath(`/clients/${clientId}/minutes`);
  return success(
    result.data.status === 'ACCEPTED' ? 'Saved. Mark it done once the change is made.' : 'Saved.',
  );
}

export async function moveActionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) {
    return failure('Could not tell which improvement this is. Reload the page and try again.');
  }

  const result = await moveAction(prisma, clientId, actionId, {
    to: str(form, 'to'),
    note: text(form, 'note'),
    occurredAt: optDate(form, 'occurredAt'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success(
    result.data.status === 'DONE'
      ? 'Recorded. Bring in new feedback, then measure it.'
      : 'Saved.',
  );
}

export async function measureActionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) {
    return failure('Could not tell which improvement this is. Reload the page and try again.');
  }

  const result = await measureClientAction(prisma, clientId, actionId);
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success(result.data.measurement.resultLabel);
}

export async function recordLearningAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;
  const actionId = str(form, 'actionId');
  if (!clientId || !actionId) {
    return failure('Could not tell which improvement this is. Reload the page and try again.');
  }

  const result = await recordLearning(prisma, clientId, actionId, {
    note: text(form, 'note'),
  });
  if (!result.ok) return failure(result.message, result.errors);

  revalidateActions(clientId);
  return success('Saved.');
}

// ---------------------------------------------------------------------------
// The owner's half of the loop
// ---------------------------------------------------------------------------

/**
 * THE OWNER DECIDES, IN ONE TAP (owner action-loop pass).
 *
 * The improvement loop has existed since M11 and worked the whole time — it
 * was simply only reachable from the operator console. An owner could read
 * "check lunch staffing" on their phone and had no way to say "I'll do that",
 * so Improvements was a report ABOUT them rather than a loop they were in.
 * This is the missing half, and it is deliberately the SAME loop: the same
 * table, the same state machine, the same measurement. Nothing here is a
 * second action system.
 *
 * WHY IT NEEDED NO NEW PERMISSION. `tenantGate(form, 'MEMBER')` resolves to
 * `canRead`, and a business owner can read their own business — so the four
 * service calls below were already open to them and nobody had built the
 * buttons. No policy, role or row rule changed to ship this.
 *
 * FOUR CHOICES, AND THEY ARE THE OWNER'S WORDS FOR FOUR EXISTING STATES:
 *
 *   HANDLE      ACCEPTED  "I'll handle this"
 *   DONE        DONE      "Done" — the change was made. NOT that it worked.
 *   WATCH       PAUSED    "Keep watching" — not now, do not close it
 *   NOT_DOING   DECLINED  "Not doing this"
 *
 * There is no fifth, no priority, no due date and no free-text box. The state
 * machine in `improve/model.ts` decides which of the four are legal from where
 * the action stands, and an illegal one is refused by `canTransition` exactly
 * as it is for the operator.
 *
 * A THEME WITH NO ACTION YET IS THE COMMON CASE. Home shows the leading
 * complaint whether or not anybody has opened an action on it, so HANDLE
 * creates the action from the insight first and then accepts it — two existing
 * service calls in sequence, not a new path into the table.
 *
 * WHAT GOES IN `description`. The service refuses an accept with no record of
 * what was decided, and it is right to: "what the business actually decided"
 * is the thing that has to survive. A one-tap accept means the owner agreed to
 * the recommendation AS SHOWN, so the recommendation is what is stored — and
 * where the pack had none, the action's own title. Both are strings this
 * product already wrote and froze. Nothing here invents a sentence and puts it
 * in the owner's mouth.
 */
const OWNER_CHOICES = ['HANDLE', 'DONE', 'WATCH', 'NOT_DOING', 'REVISIT'] as const;
type OwnerChoice = (typeof OWNER_CHOICES)[number];

function isOwnerChoice(value: string): value is OwnerChoice {
  return (OWNER_CHOICES as readonly string[]).includes(value);
}

export async function ownerDecideAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'MEMBER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const choice = str(form, 'choice');
  if (!isOwnerChoice(choice)) {
    return failure('Could not tell what you chose. Reload the page and try again.');
  }

  // One of the two is always present: an action id when the loop is already
  // open on this theme, the theme key itself when it is not. NEVER an insight
  // id — that string carries the tool vocabulary the portal is forbidden to
  // show, and a hidden form field is page source. See `findInsightByTheme`.
  let actionId = str(form, 'actionId');
  const themeKey = str(form, 'themeKey');

  if (!actionId && !themeKey) {
    return failure('Could not tell which improvement this is. Reload the page and try again.');
  }

  /**
   * REVISITING A DECLINED DECISION.
   *
   * It opens a NEW action on the theme and leaves the declined one exactly as
   * it is. That row records a decision the business genuinely made on a date,
   * and editing it would erase that; the improvement loop's whole value is
   * that it remembers. `createActionForTheme` is allowed here for the same
   * reason the operator has always been able to do this — the duplicate guard
   * skips DECLINED rows — and `loopByTheme` ranks DECLINED lowest, so the new
   * action becomes the one the theme reports.
   *
   * It stops at RECOMMENDED. "Revisit" means the owner wants it back on the
   * table, not that they have decided to do it, so the next screen asks.
   */
  if (choice === 'REVISIT') {
    if (!themeKey) {
      return failure('Could not tell which improvement this is. Reload the page and try again.');
    }
    const reopened = await createActionForTheme(prisma, clientId, themeKey);
    if (!reopened.ok) return failure(reopened.message, reopened.errors);
    revalidateOwnerLoop(clientId);
    return success(choice);
  }

  // Nothing but "I'll handle this" can open a loop that does not exist yet:
  // there is no such thing as marking an undecided suggestion done, and
  // declining something nobody raised as an action would write a row saying
  // the owner refused a thing that was never put to them.
  if (!actionId) {
    if (choice !== 'HANDLE') {
      return failure('Choose “I’ll handle this” first, then say what happened.');
    }
    const created = await createActionForTheme(prisma, clientId, themeKey);
    if (!created.ok) return failure(created.message, created.errors);
    actionId = created.data.id;
  }

  const current = await getAction(prisma, clientId, actionId);
  if (!current) return failure('That improvement no longer exists.');

  // ACCEPT and DECLINE from RECOMMENDED are `decideAction`, because that is
  // the call that records a decision; every other move is `moveAction`. The
  // split is the existing service's, not a new one.
  const undecided = current.status === 'RECOMMENDED';
  const decided =
    choice === 'HANDLE' && undecided
      ? await decideAction(prisma, clientId, actionId, {
          decision: 'ACCEPT',
          // What the owner agreed to, in the product's own frozen words.
          description: current.provenance.recommendationText.trim() || current.title,
          statusNote: '',
          // No minute. A minute is the operator's written record of a
          // conversation; a tap on a phone is not one, and filing it as one
          // would put words into the agency's notes that nobody said.
          recordMinute: false,
        })
      : choice === 'NOT_DOING' && undecided
        ? await decideAction(prisma, clientId, actionId, {
            decision: 'DECLINE',
            description: '',
            statusNote: '',
            recordMinute: false,
          })
        : await moveAction(prisma, clientId, actionId, {
            to:
              choice === 'HANDLE'
                ? 'ACCEPTED'
                : choice === 'DONE'
                  ? 'DONE'
                  : choice === 'WATCH'
                    ? 'PAUSED'
                    : 'DECLINED',
            note: '',
            occurredAt: null,
          });

  if (!decided.ok) return failure(decided.message, decided.errors);

  revalidateOwnerLoop(clientId);

  // The confirmation an owner reads is rendered by the component, from the
  // choice they pressed, so that it arrives in their own language — this
  // string is never shown on the workspace. See the note on OwnerDecision.
  return success(choice);
}

/** Every owner-facing page that reads the improvement loop, plus the console. */
function revalidateOwnerLoop(clientId: string) {
  revalidatePath(`/workspace/${clientId}`);
  revalidatePath(`/workspace/${clientId}/improvements`);
  revalidatePath(`/workspace/${clientId}/analysis`);
  revalidatePath(`/workspace/${clientId}/checkin`);
  revalidatePath(`/workspace/${clientId}/reviews`);
  revalidateActions(clientId);
}
