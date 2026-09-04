import type { Pack } from '@/lib/packs';
import { summariseThemes, type StoredSnapshot } from '@/lib/health/health';
import { MIN_PERIOD_FEEDBACK_TO_COMPARE } from '@/lib/intelligence/engine';

/**
 * WHAT KEEPS COMING BACK (M12).
 *
 * The intelligence engine compares the latest two check-ins. An owner also
 * wants to know whether a complaint is a one-off or the same thing every time
 * — which needs every check-in, not two.
 *
 * Nothing new is counted here. Each check-in already carries the feedback the
 * operator attached to it, and the health engine already counts themes within
 * a check-in with its own pattern floor (`summariseThemes` → `qualifies`).
 * This module asks that existing function the same question once per
 * check-in and remembers the answers. A theme "was raised" at a check-in when
 * the health engine says it cleared the floor there.
 *
 * Check-ins with too little attached feedback to read theme by theme are left
 * out, using the same floor the intelligence engine uses before it will
 * compare two check-ins. They are counted so the wording can say so.
 */

export type ThemePresence = {
  /** Check-ins with enough attached feedback to be read theme by theme. */
  checkins: number;
  /** At how many of those the theme cleared the pattern floor. */
  raisedAt: number;
  /** Cleared the floor at the most recent readable check-in. */
  latest: boolean;
  /** Cleared the floor at any earlier readable check-in. */
  before: boolean;
  /** Labels of the check-ins it was raised at, newest first. */
  labels: string[];
};

export type PresenceMap = {
  /** Readable check-ins, newest first. */
  checkins: number;
  /** Check-ins skipped for having too little attached feedback. */
  skipped: number;
  issues: Map<string, ThemePresence>;
  praises: Map<string, ThemePresence>;
};

function labelOf(snapshot: StoredSnapshot): string {
  return snapshot.label ?? snapshot.capturedAt.toISOString().slice(0, 10);
}

export function presenceFrom(snapshots: StoredSnapshot[], pack: Pack): PresenceMap {
  const ordered = [...snapshots].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime() || a.id.localeCompare(b.id),
  );
  const readable = ordered.filter((s) => s.feedback.length >= MIN_PERIOD_FEEDBACK_TO_COMPARE);

  const build = (which: 'issues' | 'praises'): Map<string, ThemePresence> => {
    const out = new Map<string, ThemePresence>();
    readable.forEach((snapshot, index) => {
      for (const theme of summariseThemes(snapshot.feedback, pack, which)) {
        if (!theme.qualifies) continue;
        const current = out.get(theme.key) ?? {
          checkins: readable.length,
          raisedAt: 0,
          latest: false,
          before: false,
          labels: [],
        };
        current.raisedAt += 1;
        if (index === 0) current.latest = true;
        else current.before = true;
        current.labels.push(labelOf(snapshot));
        out.set(theme.key, current);
      }
    });
    return out;
  };

  return {
    checkins: readable.length,
    skipped: ordered.length - readable.length,
    issues: build('issues'),
    praises: build('praises'),
  };
}

export type Recurrence = {
  /** Raised at two or more check-ins. */
  recurring: boolean;
  /** Raised at the latest check-in and at none before it. */
  isNew: boolean;
  /** Raised before but not at the latest check-in. */
  faded: boolean;
  /** The plain sentence, or null when there is nothing honest to say. */
  line: string | null;
};

const NONE: Recurrence = { recurring: false, isNew: false, faded: false, line: null };

/**
 * What the check-in history says about one theme, in owner words.
 *
 * Says nothing unless there are at least two readable check-ins: with one,
 * "recurring" and "new" are both unknowable, and the sentence would be a guess.
 */
export function recurrenceFor(
  presence: PresenceMap,
  kind: 'PRAISE' | 'ISSUE',
  themeKey: string,
): Recurrence {
  if (presence.checkins < 2) return NONE;
  const p = (kind === 'ISSUE' ? presence.issues : presence.praises).get(themeKey);
  if (!p) return NONE;

  const verb = kind === 'ISSUE' ? 'Raised' : 'Praised';
  const of = `${p.raisedAt} of your last ${p.checkins} check-ins`;

  if (p.raisedAt >= 2) {
    return {
      recurring: true,
      isNew: false,
      faded: false,
      line: `${verb} at ${of}.`,
    };
  }
  if (p.latest && !p.before) {
    return {
      recurring: false,
      isNew: true,
      faded: false,
      line: `${verb} at your latest check-in only — not at the ${p.checkins - 1 === 1 ? 'one' : `${p.checkins - 1}`} before it.`,
    };
  }
  if (!p.latest && p.before) {
    return {
      recurring: false,
      isNew: false,
      faded: true,
      line: `${verb} at an earlier check-in, but not at your latest.`,
    };
  }
  return NONE;
}
