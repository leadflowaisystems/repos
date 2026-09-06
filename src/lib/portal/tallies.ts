import type { PortalSignal, PortalView } from './view';

/**
 * THE FOUR STANDING FIGURES AT THE FOOT OF HOME.
 *
 * How much has been read, what the public listing says, the strongest complaint
 * and the strongest strength. They are the supporting evidence under the
 * conclusion at the top of the page, which is why they sit at the bottom.
 *
 * IT LIVES HERE RATHER THAN IN THE COMPONENT because every rule below is a
 * judgement about what may honestly be shown, not about how it looks — and a
 * judgement that cannot be tested without rendering React and opening a
 * database is a judgement nobody re-checks. Two of the three rules were broken
 * when this was inline in the page.
 *
 * THE RULES.
 *
 *   An arrow appears only where the engine actually compared two check-ins. No
 *   percentage is invented to make the row look alive.
 *
 *   The arrow is the direction of the RAW MENTION COUNT, and the tone alone
 *   decides whether that direction is good news. A complaint mentioned more is
 *   an up arrow in red; a strength mentioned less is a down arrow, also in red.
 *   Getting this wrong is easy and invisible: for a while both praise
 *   directions drew a rising arrow, because the improving case had been
 *   special-cased and the worsening case fell through to the helper shaped for
 *   complaints.
 *
 *   A tile is omitted rather than filled with a weaker answer. `view.first` and
 *   `view.keep` are empty exactly when the leading theme is still EARLY — fewer
 *   than ten pieces read — and every other block on Home refuses to draw a
 *   conclusion there. Falling back to the top of the raw list would make this
 *   the one part of the page willing to call a first week a pattern.
 *
 *   A count says which pile it came from. `movementCounts` is the last two
 *   check-ins and `evidenceCount` is everything read; printed bare they look
 *   like the same number.
 */

export type PortalTally = {
  key: string;
  value: string;
  label: string;
  note: string;
  tone: 'neutral' | 'good' | 'bad';
  href: string | null;
  /** Present only where the engine read a movement. */
  movement: 'up' | 'down' | null;
};

/** The direction of the raw mention count, or nothing when it was not compared. */
function countDirection(signal: PortalSignal): 'up' | 'down' | null {
  if (signal.movementDirection === null || signal.movementDirection === 'STABLE') return null;
  const rose = signal.kind === 'ISSUE'
    ? signal.movementDirection === 'WORSENING'
    : signal.movementDirection === 'IMPROVING';
  return rose ? 'up' : 'down';
}

function noteFor(signal: PortalSignal): string {
  return signal.movementCounts
    ? `${signal.movementCounts} at your last two check-ins`
    : `${signal.evidenceCount} of ${signal.evidenceTotal} mention it`;
}

export function talliesFor(view: PortalView, basePath: string): PortalTally[] {
  const out: PortalTally[] = [];

  out.push({
    key: 'read',
    value: String(view.basedOn),
    label: view.basedOn === 1 ? 'Piece of feedback read' : 'Pieces of feedback read',
    note: view.soFar.waiting > 0 ? `${view.soFar.waiting} more being read now` : 'All caught up',
    tone: 'neutral',
    href: `${basePath}/reviews`,
    movement: null,
  });

  // Omitted entirely when the listing has never been observed, rather than
  // shown as a dash.
  const rating = view.facts.find((f) => f.label === 'Public rating');
  if (rating) {
    out.push({
      key: 'rating',
      value: rating.value,
      label: 'Public rating',
      note: rating.scope,
      tone: 'neutral',
      href: null,
      movement: null,
    });
  }

  if (view.first) {
    out.push({
      key: 'issue',
      value: view.first.themeLabel,
      label: 'Top issue right now',
      note: noteFor(view.first),
      tone: 'bad',
      href: `${basePath}/reviews?theme=${encodeURIComponent(view.first.themeKey)}`,
      movement: countDirection(view.first),
    });
  }

  if (view.keep) {
    out.push({
      key: 'praise',
      value: view.keep.themeLabel,
      label: 'Top positive theme',
      note: noteFor(view.keep),
      tone: 'good',
      href: `${basePath}/reviews?theme=${encodeURIComponent(view.keep.themeKey)}`,
      movement: countDirection(view.keep),
    });
  }

  return out;
}
