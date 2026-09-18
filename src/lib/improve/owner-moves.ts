import { canTransition, type ActionStatus } from './model';

/**
 * WHAT THE OWNER MAY DO NEXT (owner action-loop pass).
 *
 * The owner's four words for the improvement loop, and which of them are worth
 * offering from where an action stands.
 *
 * IT LIVES HERE, NOT IN THE COMPONENT. It began life inside the decision
 * button, which is a `'use client'` module — and every page that needed it
 * (Home, Feedback, the action centre) is a SERVER component. Importing a
 * client module's function into a server component type-checks, passes every
 * source-level test, and then throws at request time: "Attempted to call
 * movesFor() from the server but movesFor is on the client." A browser found
 * that; nothing else could have. Beside the state machine is also simply where
 * it belongs.
 *
 * LEGALITY IS NOT RESTATED HERE, IT IS ASKED FOR. `PREFERRED` says which moves
 * are worth putting in front of an owner; `canTransition` decides which are
 * allowed, and anything it refuses is dropped. So this table can never drift
 * into offering a move the server would reject — the failure that shows up as
 * a button that does nothing but produce an error.
 */

/** The owner's words. Never the database's six statuses. */
export type OwnerChoiceKey = 'HANDLE' | 'DONE' | 'WATCH' | 'NOT_DOING' | 'REVISIT';

/**
 * The state each word asks the loop to move to.
 *
 * REVISIT is absent on purpose: it is the one choice that is NOT a move. See
 * `movesFor` below.
 */
export const CHOICE_TARGET: Record<Exclude<OwnerChoiceKey, 'REVISIT'>, ActionStatus> = {
  HANDLE: 'ACCEPTED',
  DONE: 'DONE',
  WATCH: 'PAUSED',
  NOT_DOING: 'DECLINED',
};

/**
 * What is worth OFFERING from each status, before legality is applied.
 *
 * Editorial, and short on purpose: two choices, never four. Four equal buttons
 * ask an owner to compare rather than to act, which is the work they opened
 * the app to have done.
 *
 * DONE and MEASURED are deliberately empty although the machine allows moves
 * from both. What it allows is MEASURED (Headway's own job, and it happens
 * when the feedback arrives, not when a button is pressed) and a return to
 * ACCEPTED (an operator undoing a mis-click). Neither is a thing an owner has
 * any reason to press, so the page says where things stand in words instead.
 */
const PREFERRED: Record<ActionStatus, readonly OwnerChoiceKey[]> = {
  RECOMMENDED: ['HANDLE', 'NOT_DOING'],
  // Agreed but not made. "Done" is the next real event; "keep watching" parks
  // it without closing it.
  ACCEPTED: ['DONE', 'WATCH'],
  // Parked. Pick it up again, or say it is not happening.
  PAUSED: ['HANDLE', 'NOT_DOING'],
  DONE: [],
  MEASURED: [],
  DECLINED: [],
};

/**
 * The moves to offer for an action in `status`, or for a theme with no action.
 *
 * `null` means nobody has decided anything about this theme yet, which is the
 * common case on Home. Only the first decision is offered there: marking an
 * undecided suggestion "done", or declining a thing that was never put to the
 * owner, would each write a record of something that did not happen.
 */
export function movesFor(status: ActionStatus | null): readonly OwnerChoiceKey[] {
  if (status === null) return ['HANDLE'];

  /**
   * DECLINED IS TERMINAL, AND STAYS TERMINAL.
   *
   * An owner who said "not doing this" had no way back: no button, and a
   * sentence telling them what they had decided. That is a dead end on a
   * screen, and businesses change their minds.
   *
   * The fix moves nothing. `TRANSITIONS.DECLINED` is still empty and the
   * declined row is still frozen — it is a record of a decision that was
   * genuinely made, and rewriting it would lose that. What Revisit does is
   * what `transitionError` has told the operator to do since M11: "create a
   * new one if the business changes its mind". `createActionFromInsight`
   * already allows exactly that — its duplicate guard skips DECLINED rows —
   * and `loopByTheme` already ranks DECLINED lowest, so the new action becomes
   * the one the theme reports and the old one becomes history.
   *
   * So this is a button in front of a path the system already had, not a new
   * state, a new table or a loosened machine.
   */
  if (status === 'DECLINED') return ['REVISIT'];

  return (PREFERRED[status] ?? []).filter((choice) =>
    // REVISIT never reaches here, and could not be checked if it did: it is
    // not a transition, so it has no target to ask `canTransition` about.
    choice !== 'REVISIT' && canTransition(status, CHOICE_TARGET[choice]),
  );
}
