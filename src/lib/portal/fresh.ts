import type { LedgerRow } from '@/lib/feedback/ledger';
import { sourceLabel } from '@/lib/feedback/service';
import { isCurrentAnalysis } from '@/lib/feedback/state';
import { parseJson } from '@/lib/format';
import type { NormalizedTheme } from '@/lib/analysis/normalize';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * WHAT JUST ARRIVED, AND WHETHER HEADWAY HAS READ IT (freshness pass).
 *
 * Home is a reading of the pile, and a reading always lags the pile by the
 * seconds it takes to read. Two things follow, and this module owns both:
 *
 *   THE LIVE LINE     one honest sentence in the band about the newest
 *                     feedback — "3 new · Headway is reading them" while the
 *                     pipeline has them, "Headway just read 3 new" once it has
 *                     finished. Never "real time", never a spinner with nothing
 *                     behind it: every word is a count of stored rows in a
 *                     stored state.
 *   THE LATEST FEW    the most recent customers, in their own words, each one
 *                     a tap from the whole entry. The intelligence stays the
 *                     headline; this is the proof that nothing a customer sent
 *                     is hidden behind it — including what has not been read
 *                     yet, which is exactly the feedback a summary cannot show.
 *
 * NO NEW QUERY. Everything here is computed from the ledger — the one read of
 * this client's feedback that Home already makes for its counts (see
 * `feedback/ledger.ts`). The ledger is memoised per request, so asking for it
 * again costs nothing and cannot disagree with the counts beside it.
 *
 * NO INVENTED TIMES. A feedback-card submission is stamped with the moment it
 * arrived, so it can honestly say "2 min ago". A pasted public review carries
 * the customer's own date at best, so it says the date and nothing finer —
 * "2 min ago" on a review written in March would be a lie told with a clock.
 *
 * PURE, AND HANDED ITS CLOCK AND LANGUAGE, like every builder beside it.
 */

/** "New" means arrived within this window. A day: long enough to matter, short enough to be news. */
export const NEW_WINDOW_MS = 24 * 60 * 60_000;

/** "Just read" means read within this window. Past it, the sentence would stop being true. */
export const JUST_READ_MS = 15 * 60_000;

/** How many customers Home shows. Three is a glance; four is a feed. */
export const LATEST_ON_HOME = 3;

/** The one sentence in the band about the newest feedback, or nothing. */
export type LiveState =
  /** Arrived, never read yet, and the pipeline is running for this business. */
  | { kind: 'READING'; count: number }
  /** Arrived, never read yet, and reading is paused with the account. */
  | { kind: 'HELD'; count: number }
  /** Read within the last few minutes. */
  | { kind: 'JUST_READ'; count: number }
  | null;

export type LatestEntry = {
  id: string;
  /** The customer's words, whitespace tidied. Empty when they only rated. */
  text: string;
  stars: number | null;
  /** The customer's own date where it was parsed, otherwise when it arrived. */
  at: Date;
  /**
   * Whether `at` is the moment it arrived — true only for the feedback card,
   * which stamps its submissions. Everything else is a date, not a time.
   */
  exact: boolean;
  sourceLabel: string;
  /** NEW: arrived, not read yet. READ: read by the current engine. FAILED: the last try failed. */
  state: 'NEW' | 'READ' | 'FAILED';
  /** What Headway filed it under, once read. Labels as the rest of the page says them. */
  topics: Array<{ key: string; label: string }>;
};

export type FreshFeed = {
  live: LiveState;
  latest: LatestEntry[];
  /** Everything this business holds, read or not — the size of "see all". */
  total: number;
};

/** The same evidence date every other reader of the ledger uses. */
function evidenceAt(row: Pick<LedgerRow, 'reviewDate' | 'createdAt'>): Date {
  return row.reviewDate ?? row.createdAt;
}

/** Never read, and not failed: the rows a run will pick up (or already has). */
function awaitingFirstRead(row: LedgerRow): boolean {
  return row.analysedAt === null && (row.analysisStatus === 'PENDING' || row.analysisStatus === 'PROCESSING');
}

function stateOf(row: LedgerRow): LatestEntry['state'] {
  if (isCurrentAnalysis(row)) return 'READ';
  if (row.analysisStatus === 'FAILED') return 'FAILED';
  // An older engine's reading still counts as read for the owner: the words
  // were understood, and a newer engine is only refining it.
  if (row.analysedAt !== null) return 'READ';
  return 'NEW';
}

export function buildFreshFeed(input: {
  ledger: LedgerRow[];
  now: Date;
  /** True while the account is paused or closed: rows are collected but not read. */
  readingPaused: boolean;
  /**
   * The label the rest of the page uses for a topic, when the page has one —
   * so the latest list and the story above it name a topic the same way.
   * Falls back to the label stored with the reading.
   */
  labelFor?: (key: string) => string | null;
  limit?: number;
}): FreshFeed {
  const { ledger, now, readingPaused } = input;
  const limit = input.limit ?? LATEST_ON_HOME;
  const newSince = now.getTime() - NEW_WINDOW_MS;
  const justSince = now.getTime() - JUST_READ_MS;

  let unread = 0;
  let justRead = 0;
  // Top `limit` by evidence date, found in one pass: the ledger can be ten
  // thousand rows and the answer is three of them.
  const top: LedgerRow[] = [];
  const newer = (a: LedgerRow, b: LedgerRow) =>
    evidenceAt(a).getTime() - evidenceAt(b).getTime() ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    // Ties broken the same way the ledger breaks them, so the three are stable.
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

  for (const row of ledger) {
    if (awaitingFirstRead(row)) unread += 1;
    else if (
      isCurrentAnalysis(row) &&
      row.analysedAt !== null &&
      row.analysedAt.getTime() >= justSince &&
      row.createdAt.getTime() >= newSince
    ) {
      // Read in the last few minutes AND arrived in the last day. The second
      // half is what keeps an engine upgrade — which re-reads old feedback —
      // from announcing a year of history as "just read".
      justRead += 1;
    }

    if (top.length < limit) {
      top.push(row);
      top.sort((a, b) => newer(b, a));
    } else if (newer(row, top[top.length - 1]!) > 0) {
      top[top.length - 1] = row;
      top.sort((a, b) => newer(b, a));
    }
  }

  const live: LiveState =
    unread > 0
      ? { kind: readingPaused ? 'HELD' : 'READING', count: unread }
      : justRead > 0
        ? { kind: 'JUST_READ', count: justRead }
        : null;

  const latest = top.map((row): LatestEntry => {
    const state = stateOf(row);
    const topics =
      state === 'READ'
        ? parseJson<NormalizedTheme[]>(row.themesJson, [])
            .filter((theme) => typeof theme?.key === 'string' && theme.key.length > 0)
            .map((theme) => ({
              key: theme.key,
              label: input.labelFor?.(theme.key) ?? theme.label ?? theme.key,
            }))
        : [];
    return {
      id: row.id,
      text: row.text.replace(/\s+/g, ' ').trim(),
      stars: row.stars,
      at: evidenceAt(row),
      exact: row.source === 'REP_OS_QR' && row.reviewDate !== null,
      sourceLabel: sourceLabel(row.source),
      state,
      topics,
    };
  });

  return { live, latest, total: ledger.length };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * When a customer said it, in words an owner reads at a glance.
 *
 * Relative only where the time is real and recent — "just now", "12 min ago",
 * "3 hours ago" — and a plain date everywhere else. A future timestamp (a
 * skewed clock) is "just now", never "in 2 minutes".
 */
export function whenSaid(
  entry: { at: Date; exact: boolean },
  now: Date,
  t: PortalTranslator = EN,
  formatDate: (d: Date) => string,
): string {
  if (!entry.exact) return formatDate(entry.at);
  const age = now.getTime() - entry.at.getTime();
  if (age < MINUTE) return t('common.ago.now');
  if (age < HOUR) return t.plural('common.ago.minutes', Math.floor(age / MINUTE));
  if (age < 24 * HOUR) return t.plural('common.ago.hours', Math.floor(age / HOUR));
  return formatDate(entry.at);
}
