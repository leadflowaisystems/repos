import type { Pack } from '@/lib/packs';
import { summariseThemes, type StoredSnapshot } from '@/lib/health/health';
import { MIN_PERIOD_FEEDBACK_TO_COMPARE } from '@/lib/intelligence/engine';
import { formatDate } from '@/lib/format';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

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
  // A check-in with no label of its own is named by its date, in the same
  // format the rest of the workspace prints — never a raw 2026-09-08.
  return snapshot.label ?? formatDate(snapshot.capturedAt);
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
  /**
   * The two numbers the sentence is built from.
   *
   * Carried as numbers because something downstream needs them, and the only
   * other way to get them is to read them back out of the sentence — which
   * works in English and silently stops working the moment the sentence is in
   * Marathi. Null when there is no recurrence to describe.
   */
  raisedAt: number | null;
  outOf: number | null;
};

const NONE: Recurrence = {
  recurring: false,
  isNew: false,
  faded: false,
  line: null,
  raisedAt: null,
  outOf: null,
};

/**
 * The three things the history can say, per kind.
 *
 * A complaint and a piece of praise get WHOLE separate sentences rather than
 * one sentence with a verb dropped into it. English tolerates that trick;
 * Hindi and Marathi do not, because the verb changes the shape of everything
 * around it. One key per sentence is what makes the sentence translatable.
 */
const ISSUE_KEYS = {
  repeat: 'evidence.recurrence.issue.repeat',
  fresh: 'evidence.recurrence.issue.new',
  faded: 'evidence.recurrence.issue.faded',
} as const;

const PRAISE_KEYS = {
  repeat: 'evidence.recurrence.praise.repeat',
  fresh: 'evidence.recurrence.praise.new',
  faded: 'evidence.recurrence.praise.faded',
} as const;

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
  translator?: PortalTranslator,
): Recurrence {
  // Handed in, never looked up. Omitted means English, which is the operator
  // console's deliberate answer rather than an oversight.
  const t = translator ?? EN;
  if (presence.checkins < 2) return NONE;
  const p = (kind === 'ISSUE' ? presence.issues : presence.praises).get(themeKey);
  if (!p) return NONE;

  // "Raised at 2 of your last 3 check-ins" reads like a meeting minute. An
  // owner reads it once and understands it when the customers are the subject
  // of the sentence and the verb is the one they would use themselves.
  const keys = kind === 'ISSUE' ? ISSUE_KEYS : PRAISE_KEYS;

  if (p.raisedAt >= 2) {
    return {
      recurring: true,
      isNew: false,
      faded: false,
      line: t(keys.repeat, { raised: p.raisedAt, total: p.checkins }),
      raisedAt: p.raisedAt,
      outOf: p.checkins,
    };
  }
  if (p.latest && !p.before) {
    const earlier = p.checkins - 1;
    return {
      recurring: false,
      isNew: true,
      faded: false,
      line: t.plural(keys.fresh, earlier),
      raisedAt: 1,
      outOf: p.checkins,
    };
  }
  if (!p.latest && p.before) {
    return {
      recurring: false,
      isNew: false,
      faded: true,
      line: t(keys.faded),
      raisedAt: 0,
      outOf: p.checkins,
    };
  }
  return NONE;
}
