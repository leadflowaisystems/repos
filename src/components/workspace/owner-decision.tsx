'use client';

import clsx from 'clsx';
import { useActionState } from 'react';
import { ownerDecideAction } from '@/lib/actions/improve';
import { IDLE } from '@/lib/actions/shared';
import { useT } from '@/components/portal/locale-provider';
import type { MessageKey } from '@/lib/i18n/strings';
import type { OwnerChoiceKey } from '@/lib/improve/owner-moves';

/**
 * THE OWNER DECIDES (owner action-loop pass).
 *
 * The one control in this product that changes a business's state from a
 * phone. It is deliberately small: two or three buttons in a row, no fields,
 * no modal, no date picker, no priority, no notes box. The owner is standing
 * behind a counter and the whole interaction is one thumb-press.
 *
 * WHAT IT IS NOT. It is not a task manager. There is no board, nothing is
 * dragged, nothing has a due date, and no state is invented for the interface:
 * every button maps onto a state the improvement loop has had since M11, and
 * `canTransition` in `improve/model.ts` decides which are offered from where
 * the action stands. If a button is not on screen it is because that move is
 * not legal, not because a designer hid it.
 *
 * THE CONFIRMATION IS RENDERED HERE, FROM THE CHOICE, NOT FROM THE SERVER.
 * Server actions in this codebase return an English sentence, which is fine
 * for the operator console and wrong on a screen an owner reads in Marathi. So
 * the action returns the choice as a token and this component says the
 * sentence out of the dictionary. The error path still shows the server's
 * words — those come from the service's own validation and are the same ones
 * the operator sees.
 *
 * NO PRAISE. Pressing "Done" does not produce "Great work!" — it produces
 * "Headway will watch the next feedback for this", because that is the true
 * next event and because the software has no standing to congratulate somebody
 * on running their own business. The reward arrives later, as a measured
 * count, and it arrives whether or not it is good news.
 */


const LABEL: Record<OwnerChoiceKey, MessageKey> = {
  HANDLE: 'loop.choice.handle',
  DONE: 'loop.choice.done',
  WATCH: 'loop.choice.watch',
  NOT_DOING: 'loop.choice.notDoing',
  REVISIT: 'loop.choice.revisit',
};

const SAVED: Record<OwnerChoiceKey, MessageKey> = {
  HANDLE: 'loop.saved.handle',
  DONE: 'loop.saved.done',
  WATCH: 'loop.saved.watch',
  NOT_DOING: 'loop.saved.notDoing',
  REVISIT: 'loop.saved.revisit',
};

function isChoice(value: string): value is OwnerChoiceKey {
  return (
    value === 'HANDLE' ||
    value === 'DONE' ||
    value === 'WATCH' ||
    value === 'NOT_DOING' ||
    value === 'REVISIT'
  );
}

export function OwnerDecision({
  clientId,
  themeKey,
  actionId,
  choices,
  /** `lead` draws the first button in gold. Home passes it; lists do not. */
  lead = false,
}: {
  clientId: string;
  themeKey: string;
  actionId: string | null;
  choices: readonly OwnerChoiceKey[];
  lead?: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(ownerDecideAction, IDLE);

  if (choices.length === 0) return null;

  // The server answers with the choice that was saved, so the sentence below
  // is the one for what actually happened — not for whichever button was
  // pressed last on a form that failed.
  const saved = state.ok && isChoice(state.message) ? state.message : null;

  if (saved) {
    return (
      <p
        role="status"
        className="mt-4 border-l-2 border-good-600 bg-good-50 px-3 py-2.5 text-[14px] leading-snug text-ink-800"
      >
        {t(SAVED[saved])}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="themeKey" value={themeKey} />
      {actionId ? <input type="hidden" name="actionId" value={actionId} /> : null}
      <div className="flex flex-wrap gap-2">
        {choices.map((choice, index) => (
          <button
            key={choice}
            type="submit"
            name="choice"
            value={choice}
            disabled={pending}
            // 48px tall and never narrower than its words. The first choice on
            // Home is the page's one gold control; every other choice is a
            // quiet outline, because offering four equal buttons is asking the
            // owner to compare rather than to act.
            className={clsx(
              'inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-[15px] font-semibold transition-colors disabled:opacity-60',
              lead && index === 0
                ? 'bg-brand-700 text-white hover:bg-brand-900'
                : 'border border-ink-300 bg-white font-medium text-ink-800 hover:border-ink-900',
            )}
          >
            {pending && index === 0 ? t('loop.saving') : t(LABEL[choice])}
          </button>
        ))}
      </div>
      {state.message && !state.ok ? (
        <p
          role="alert"
          className="mt-2 border-l-2 border-bad-600 bg-bad-50 px-3 py-2 text-[13px] leading-snug text-ink-800"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
